"""Dependency-free HTTP API and static frontend server for AlertaBairro.

Run from the project root with ``python -m backend.server``.
"""

from __future__ import annotations

import hashlib
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from .db import db_session, default_db_path, seed_database, utc_now, verify_password, make_password
from .places import search_places, normalize_existing
from .vision import validate_assistance
from .domain import (
    RISKS, STATUSES, TRANSITIONS, TRANSITION_EVENTS, TYPES,
    ValidationError, calculate_confidence, can_transition, classify_risk,
    validate_occurrence,
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
OCCURRENCE_SELECT = """SELECT o.*, u.name AS reporter_name,
    s.name AS source_label, s.kind AS source_kind
    FROM occurrences o
    JOIN users u ON u.id = o.reporter_id
    JOIN sources s ON s.id = o.source_id"""


class APIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def load_dotenv(path: Path = PROJECT_ROOT / ".env") -> None:
    """Read basic KEY=VALUE lines without overriding process environment."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            continue
        value = value.strip()
        if value and value[0] in "\"'" and value[-1] == value[0]:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def public_user(row: sqlite3.Row | dict) -> dict:
    return {key: row[key] for key in ("id", "name", "email", "role")}


def public_occurrence(row: sqlite3.Row | dict) -> dict:
    keys = (
        "id", "title", "type", "description", "neighborhood", "address",
        "latitude", "longitude", "severity", "affected_people", "status",
        "risk_score", "risk_level", "confidence_score", "evidence_count",
        "corroborations", "reporter_id", "reporter_name", "source_id",
        "source_label", "source_kind", "occurred_at", "created_at", "updated_at",
    )
    result = {key: row[key] for key in keys}
    if row["affected_people_unknown"]:
        result["affected_people"] = None
    return result


def fetch_occurrence(conn: sqlite3.Connection, occurrence_id: int) -> dict | None:
    row = conn.execute(OCCURRENCE_SELECT + " WHERE o.id = ?", (occurrence_id,)).fetchone()
    return public_occurrence(row) if row else None


def parse_positive_int(value: str | None, default: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        result = int(value)
    except ValueError:
        raise APIError(400, "Parâmetro numérico inválido.") from None
    if result < 1 or result > maximum:
        raise APIError(400, f"O valor deve estar entre 1 e {maximum}.")
    return result


def make_handler(db_path: Path):
    class AlertaBairroHandler(SimpleHTTPRequestHandler):
        server_version = "AlertaBairro/1.0"

        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(FRONTEND_ROOT), **kwargs)

        def end_headers(self):
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
            self.send_header("X-Frame-Options", "DENY")
            super().end_headers()

        def send_json(self, status: int, payload: dict | list) -> None:
            # A response prepared inside a database transaction is written
            # only after the transaction commits. Otherwise a second request
            # can race the commit and observe a missing freshly created row.
            if getattr(self, "_buffer_json", False):
                self._pending_json = (status, payload)
                return
            data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def read_json(self) -> dict:
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise APIError(400, "Cabeçalho Content-Length inválido.") from None
            if not 0 < length <= 1_000_000:
                raise APIError(413 if length > 1_000_000 else 400, "Corpo JSON ausente ou grande demais.")
            try:
                result = json.loads(self.rfile.read(length))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise APIError(400, "JSON inválido.") from None
            if not isinstance(result, dict):
                raise APIError(400, "O corpo deve ser um objeto JSON.")
            return result

        def current_user(self, conn: sqlite3.Connection) -> dict:
            auth = self.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                raise APIError(401, "Faça login para continuar.")
            token = auth[7:].strip()
            if not token:
                raise APIError(401, "Sessão inválida.")
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            row = conn.execute(
                """SELECT u.id,u.name,u.email,u.role FROM sessions s
                   JOIN users u ON u.id = s.user_id
                   WHERE s.token_hash = ? AND s.expires_at > ?""",
                (token_hash, utc_now()),
            ).fetchone()
            if not row:
                raise APIError(401, "Sessão expirada ou inválida.")
            return public_user(row)

        def require_role(self, user: dict, *roles: str) -> None:
            if user["role"] not in roles:
                raise APIError(403, "Seu perfil não permite esta ação.")

        def api(self, method: str) -> None:
            path = urlparse(self.path).path.rstrip("/") or "/"
            query = parse_qs(urlparse(self.path).query, keep_blank_values=True)
            self._buffer_json = True
            self._pending_json = None
            try:
                if path == "/api/health" and method == "GET":
                    with db_session(db_path) as conn:
                        conn.execute("SELECT COUNT(*) FROM users").fetchone()
                    self.send_json(200, {"status": "ok", "database": "ready", "version": "1.0.0"})
                    return
                if path == "/api/auth/login" and method == "POST":
                    return self.login()
                if path == "/api/auth/register" and method == "POST":
                    return self.register()
                if path == "/api/meta" and method == "GET":
                    self.send_json(200, {
                        "types": TYPES, "statuses": STATUSES, "risks": RISKS,
                        "transitions": TRANSITIONS,
                        "transition_events": [
                            {"from": source, "to": target, "event": event}
                            for (source, target), event in TRANSITION_EVENTS.items()
                        ],
                    })
                    return
                if path == "/api/neighborhoods" and method == "GET":
                    term = query.get("q", [""])[0][:100]
                    return self.send_json(200, {"items": search_places(term), "city": "São Paulo", "updated_at": "2026-11-10"})
                with db_session(db_path) as conn:
                    user = self.current_user(conn)
                    if path == "/api/auth/me" and method == "GET":
                        return self.send_json(200, {"user": user})
                    if path == "/api/auth/logout" and method == "POST":
                        token = self.headers["Authorization"][7:].strip()
                        conn.execute("DELETE FROM sessions WHERE token_hash=?", (
                            hashlib.sha256(token.encode()).hexdigest(),
                        ))
                        return self.send_json(200, {"ok": True})
                    if path == "/api/dashboard" and method == "GET":
                        return self.dashboard(conn)
                    if path == "/api/occurrences":
                        if method == "GET":
                            return self.list_occurrences(conn, query)
                        if method == "POST":
                            return self.create_occurrence(conn, user)
                    match = re.fullmatch(r"/api/occurrences/(\d+)", path)
                    if match and method == "GET":
                        return self.occurrence_detail(conn, int(match.group(1)))
                    if match and method == "DELETE":
                        return self.delete_occurrence(conn, user, int(match.group(1)))
                    match = re.fullmatch(r"/api/occurrences/(\d+)/transition", path)
                    if match and method == "POST":
                        return self.transition_occurrence(conn, user, int(match.group(1)))
                    if path == "/api/alerts" and method == "GET":
                        return self.list_alerts(conn)
                    if path == "/api/notifications" and method == "GET":
                        return self.list_notifications(conn, user)
                    if path == "/api/notifications/read-all" and method == "POST":
                        cursor = conn.execute("UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0", (user["id"],))
                        return self.send_json(200, {"ok": True, "updated": cursor.rowcount})
                    match = re.fullmatch(r"/api/notifications/(\d+)/read", path)
                    if match and method == "POST":
                        return self.read_notification(conn, user, int(match.group(1)))
                    if path == "/api/sources" and method == "GET":
                        return self.list_sources(conn)
                    if path == "/api/users" and method == "GET":
                        self.require_role(user, "gestor")
                        rows = conn.execute(
                            "SELECT id,name,email,role,created_at FROM users ORDER BY id"
                        ).fetchall()
                        return self.send_json(200, {"items": [dict(row) for row in rows]})
                raise APIError(404, "Rota não encontrada.")
            except ValidationError as exc:
                self.send_json(400, {"error": str(exc)})
            except APIError as exc:
                self.send_json(exc.status, {"error": exc.message})
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "Conflito de dados. Atualize a página e tente novamente."})
            except Exception:
                self.log_error("Unexpected API error on %s %s", method, path)
                self.send_json(500, {"error": "Erro interno. Tente novamente."})
            finally:
                pending = self._pending_json
                self._buffer_json = False
                self._pending_json = None
                if pending is not None:
                    self.send_json(*pending)

        def register(self) -> None:
            body = self.read_json()
            name, email, password = body.get("name"), body.get("email"), body.get("password")
            if not all(isinstance(value, str) for value in (name, email, password)):
                raise APIError(400, "Informe nome, e-mail e senha.")
            name = " ".join(name.split())
            email = email.strip().lower()
            if not 2 <= len(name) <= 100:
                raise APIError(400, "O nome deve conter entre 2 e 100 caracteres.")
            if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                raise APIError(400, "Informe um e-mail válido.")
            if not 8 <= len(password) <= 128 or not password.strip():
                raise APIError(400, "A senha deve conter entre 8 e 128 caracteres.")
            if body.get("role", "morador") != "morador":
                raise APIError(400, "O cadastro público permite somente contas de morador.")
            with db_session(db_path) as conn:
                if conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
                    raise APIError(409, "Já existe uma conta com este e-mail. Entre com sua senha.")
                cursor = conn.execute(
                    "INSERT INTO users(name,email,role,password_hash,created_at) VALUES (?,?,?,?,?)",
                    (name, email, "morador", make_password(password), utc_now()),
                )
                self.send_json(201, {"user": {"id": cursor.lastrowid, "name": name, "email": email, "role": "morador"}})

        def login(self) -> None:
            body = self.read_json()
            email = body.get("email", "")
            password = body.get("password", "")
            if not isinstance(email, str) or not isinstance(password, str):
                raise APIError(400, "Informe e-mail e senha.")
            with db_session(db_path) as conn:
                row = conn.execute(
                    "SELECT id,name,email,role,password_hash FROM users WHERE email=?",
                    (email.strip().lower(),),
                ).fetchone()
                if not row or not verify_password(password, row["password_hash"]):
                    raise APIError(401, "E-mail ou senha incorretos.")
                token = secrets.token_urlsafe(36)
                token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
                expires_at = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(timespec="seconds")
                conn.execute(
                    "INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)",
                    (token_hash, row["id"], expires_at, utc_now()),
                )
                self.send_json(200, {"token": token, "user": public_user(row), "expires_at": expires_at})

        def dashboard(self, conn: sqlite3.Connection) -> None:
            by_status = {status: 0 for status in STATUSES}
            for row in conn.execute("SELECT status, COUNT(*) AS amount FROM occurrences GROUP BY status"):
                by_status[row["status"]] = row["amount"]
            by_risk = {risk: 0 for risk in RISKS}
            for row in conn.execute("SELECT risk_level, COUNT(*) AS amount FROM occurrences GROUP BY risk_level"):
                by_risk[row["risk_level"]] = row["amount"]
            total = sum(by_status.values())
            stats = {
                "total": total,
                "active": total - by_status["Encerrado"] - by_status["Descartado"],
                "alerts": conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0],
                "pending": by_status["Registrado"] + by_status["Em validação"],
                "critical": by_risk["Crítico"],
            }
            rows = conn.execute(OCCURRENCE_SELECT + " ORDER BY o.updated_at DESC, o.id DESC LIMIT 6").fetchall()
            self.send_json(200, {
                "stats": stats,
                "recent": [public_occurrence(row) for row in rows],
                "by_risk": by_risk,
                "by_status": by_status,
            })

        def list_occurrences(self, conn: sqlite3.Connection, query: dict) -> None:
            conditions = []
            params: list = []
            status = query.get("status", [""])[0]
            risk = query.get("risk", [""])[0]
            search = query.get("search", [""])[0].strip()
            if status:
                if status not in STATUSES:
                    raise APIError(400, "Estado inválido.")
                conditions.append("o.status=?")
                params.append(status)
            if risk:
                if risk not in RISKS:
                    raise APIError(400, "Classificação de risco inválida.")
                conditions.append("o.risk_level=?")
                params.append(risk)
            if search:
                if len(search) > 100:
                    raise APIError(400, "Busca grande demais.")
                conditions.append("(o.title LIKE ? OR o.neighborhood LIKE ? OR o.description LIKE ?)")
                params.extend([f"%{search}%"] * 3)
            where = " WHERE " + " AND ".join(conditions) if conditions else ""
            page = parse_positive_int(query.get("page", [None])[0], 1, 10000)
            limit = parse_positive_int(query.get("limit", [None])[0], 30, 100)
            total = conn.execute(
                "SELECT COUNT(*) FROM occurrences o" + where, params
            ).fetchone()[0]
            rows = conn.execute(
                OCCURRENCE_SELECT + where + " ORDER BY o.updated_at DESC, o.id DESC LIMIT ? OFFSET ?",
                [*params, limit, (page - 1) * limit],
            ).fetchall()
            self.send_json(200, {
                "items": [public_occurrence(row) for row in rows],
                "total": total, "page": page, "limit": limit,
            })

        def delete_occurrence(self, conn: sqlite3.Connection, user: dict, occurrence_id: int) -> None:
            self.require_role(user, "agente", "gestor")
            # All dependent tables reference occurrences with ON DELETE CASCADE.
            # The surrounding transaction commits before the response is sent.
            cursor = conn.execute("DELETE FROM occurrences WHERE id=?", (occurrence_id,))
            if cursor.rowcount != 1:
                raise APIError(404, "Ocorrência não encontrada.")
            self.send_json(200, {"ok": True, "deleted_id": occurrence_id})

        def occurrence_detail(self, conn: sqlite3.Connection, occurrence_id: int) -> None:
            occurrence = fetch_occurrence(conn, occurrence_id)
            if not occurrence:
                raise APIError(404, "Ocorrência não encontrada.")
            history = [dict(row) for row in conn.execute(
                """SELECT h.id,h.from_status,h.to_status,h.event,h.notes,h.created_at,
                   u.name AS actor_name FROM occurrence_history h
                   JOIN users u ON u.id = h.actor_id
                   WHERE h.occurrence_id=? ORDER BY h.id""",
                (occurrence_id,),
            )]
            alert_row = conn.execute(
                "SELECT id,message,audience,created_at FROM alerts WHERE occurrence_id=?",
                (occurrence_id,),
            ).fetchone()
            self.send_json(200, {
                "occurrence": occurrence,
                "history": history,
                "alert": dict(alert_row) if alert_row else None,
                "ai_assistance": self.vision_assistance(conn, occurrence_id),
            })

        def vision_assistance(self, conn, occurrence_id):
            row = conn.execute("SELECT model,revision,suggested_type,score,margin,human_confirmed,created_at FROM vision_assessments WHERE occurrence_id=?", (occurrence_id,)).fetchone()
            return dict(row) if row else None

        def create_occurrence(self, conn: sqlite3.Connection, user: dict) -> None:
            body = self.read_json()
            fields = validate_occurrence(body)
            assistance = validate_assistance(body.get("ai_assistance"), fields["type"])
            risk_score, risk_level = classify_risk(
                fields["type"], fields["severity"], fields["affected_people"]
            )
            now = utc_now()
            confidence = calculate_confidence("community")
            cursor = conn.execute(
                """INSERT INTO occurrences
                   (title,type,description,neighborhood,address,latitude,longitude,severity,
                    affected_people,affected_people_unknown,status,risk_score,risk_level,confidence_score,
                    reporter_id,source_id,occurred_at,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    fields["title"], fields["type"], fields["description"],
                    fields["neighborhood"], fields["address"], fields["latitude"],
                    fields["longitude"], fields["severity"], fields["affected_people"] if fields["affected_people"] is not None else 0,
                    int(fields["affected_people"] is None),
                    "Registrado", risk_score, risk_level, confidence, user["id"], 1,
                    fields["occurred_at"] or now, now, now,
                ),
            )
            occurrence_id = cursor.lastrowid
            if assistance:
                conn.execute("INSERT INTO vision_assessments(occurrence_id,model,revision,suggested_type,score,margin,human_confirmed,created_at) VALUES (?,?,?,?,?,?,?,?)", (
                    occurrence_id, assistance["model"], assistance["revision"], assistance["suggested_type"], assistance["score"], assistance["margin"], 1, now,
                ))
            conn.execute(
                """INSERT INTO occurrence_history
                   (occurrence_id,from_status,to_status,event,actor_id,created_at)
                   VALUES (?,?,?,?,?,?)""",
                (occurrence_id, None, "Registrado", "Relato criado", user["id"], now),
            )
            self.send_json(201, {"occurrence": fetch_occurrence(conn, occurrence_id)})

        def transition_occurrence(self, conn: sqlite3.Connection, user: dict, occurrence_id: int) -> None:
            self.require_role(user, "agente", "gestor")
            occurrence = fetch_occurrence(conn, occurrence_id)
            if not occurrence:
                raise APIError(404, "Ocorrência não encontrada.")
            body = self.read_json()
            target = body.get("to")
            if not isinstance(target, str) or not can_transition(occurrence["status"], target, user["role"]):
                raise APIError(409, "Transição não permitida para o estado atual.")
            notes = body.get("notes", body.get("comment", ""))
            message = body.get("message", "")
            if not isinstance(notes, str) or len(notes.strip()) > 1000:
                raise APIError(422, "Observação inválida (máximo de 1000 caracteres).")
            if not isinstance(message, str) or len(message.strip()) > 500:
                raise APIError(400, "Mensagem de alerta inválida (máximo de 500 caracteres).")
            if target == "Descartado" and len(notes.strip()) < 8:
                raise APIError(400, "Justifique o descarte com pelo menos 8 caracteres.")
            if target == "Alerta emitido" and len(message.strip()) < 20:
                raise APIError(400, "Escreva uma mensagem de alerta com pelo menos 20 caracteres.")
            now = utc_now()
            confidence = occurrence["confidence_score"]
            if target == "Confirmado":
                created = datetime.fromisoformat(occurrence["created_at"])
                age_hours = max(0, (datetime.now(timezone.utc) - created).total_seconds() / 3600)
                confidence = calculate_confidence(
                    occurrence["source_kind"], occurrence["evidence_count"],
                    occurrence["corroborations"], age_hours, verified=True,
                )
            cursor = conn.execute(
                """UPDATE occurrences SET status=?,confidence_score=?,updated_at=?
                   WHERE id=? AND status=?""",
                (target, confidence, now, occurrence_id, occurrence["status"]),
            )
            if not cursor.rowcount:
                raise APIError(409, "O estado mudou. Atualize e tente novamente.")
            conn.execute(
                """INSERT INTO occurrence_history
                   (occurrence_id,from_status,to_status,event,notes,actor_id,created_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (occurrence_id, occurrence["status"], target,
                 TRANSITION_EVENTS[(occurrence["status"], target)], notes.strip(),
                 user["id"], now),
            )
            alert = None
            notifications_created = 0
            if target == "Alerta emitido":
                alert_id = conn.execute(
                    """INSERT INTO alerts(occurrence_id,message,created_by,created_at)
                       VALUES (?,?,?,?)""",
                    (occurrence_id, message.strip(), user["id"], now),
                ).lastrowid
                title = f"Alerta em {occurrence['neighborhood']}"
                for row in conn.execute("SELECT id FROM users"):
                    conn.execute(
                        """INSERT INTO notifications
                           (user_id,occurrence_id,alert_id,title,body,created_at)
                           VALUES (?,?,?,?,?,?)""",
                        (row["id"], occurrence_id, alert_id, title, message.strip(), now),
                    )
                    notifications_created += 1
                alert = {"id": alert_id, "occurrence_id": occurrence_id,
                         "message": message.strip(), "created_at": now}
            self.send_json(201 if target == "Alerta emitido" else 200, {
                "occurrence": fetch_occurrence(conn, occurrence_id),
                "alert": alert,
                "notifications_created": notifications_created,
            })

        def list_alerts(self, conn: sqlite3.Connection) -> None:
            rows = conn.execute(
                """SELECT a.id,a.occurrence_id,a.message,a.audience,a.created_at,
                   o.title,o.neighborhood,o.status,o.risk_level,o.risk_score,
                   o.confidence_score,s.name AS source_label
                   FROM alerts a JOIN occurrences o ON o.id=a.occurrence_id
                   JOIN sources s ON s.id=o.source_id
                   ORDER BY a.created_at DESC,a.id DESC"""
            ).fetchall()
            self.send_json(200, {"items": [dict(row) for row in rows]})

        def list_notifications(self, conn: sqlite3.Connection, user: dict) -> None:
            rows = conn.execute(
                """SELECT n.id,n.occurrence_id,n.alert_id,n.title,n.body,
                   n.is_read,n.created_at,o.neighborhood,o.risk_level,
                   o.confidence_score,o.status,s.name AS source_label
                   FROM notifications n JOIN occurrences o ON o.id=n.occurrence_id
                   JOIN sources s ON s.id=o.source_id
                   WHERE n.user_id=? ORDER BY n.created_at DESC,n.id DESC""",
                (user["id"],),
            ).fetchall()
            items = [{**dict(row), "is_read": bool(row["is_read"])} for row in rows]
            self.send_json(200, {
                "items": items,
                "unread": sum(not item["is_read"] for item in items),
            })

        def read_notification(self, conn: sqlite3.Connection, user: dict, notification_id: int) -> None:
            cursor = conn.execute(
                "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
                (notification_id, user["id"]),
            )
            if not cursor.rowcount:
                raise APIError(404, "Notificação não encontrada.")
            self.send_json(200, {"ok": True})

        def list_sources(self, conn: sqlite3.Connection) -> None:
            rows = conn.execute(
                """SELECT s.id,s.name,s.kind,s.url,s.description,s.status,s.last_sync_at,
                   COUNT(o.id) AS occurrences_count FROM sources s
                   LEFT JOIN occurrences o ON o.source_id=s.id
                   GROUP BY s.id ORDER BY s.id"""
            ).fetchall()
            self.send_json(200, {"items": [dict(row) for row in rows]})

        def do_GET(self):
            if urlparse(self.path).path.startswith("/api/"):
                self.api("GET")
            else:
                super().do_GET()

        def do_POST(self):
            if urlparse(self.path).path.startswith("/api/"):
                self.api("POST")
            else:
                self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

        def do_HEAD(self):
            if urlparse(self.path).path.startswith("/api/"):
                self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)
            else:
                super().do_HEAD()

        def do_DELETE(self):
            if urlparse(self.path).path.startswith("/api/"):
                self.api("DELETE")
            else:
                self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    return AlertaBairroHandler


def create_server(
    host: str = "127.0.0.1", port: int = 8000, db_path: str | Path | None = None
) -> ThreadingHTTPServer:
    """Create an initialized server; pass port 0 in tests for a free local port."""
    if db_path is None:
        load_dotenv()
        db_path = default_db_path(PROJECT_ROOT)
    resolved = str(db_path) if str(db_path).startswith(("postgres://", "postgresql://")) else Path(db_path).resolve()
    seed_database(resolved)
    with db_session(resolved) as conn:
        normalize_existing(conn)
    server = ThreadingHTTPServer((host, int(port)), make_handler(resolved))
    server.db_path = resolved  # Introspection for integration tests.
    return server


def main() -> None:
    load_dotenv()
    host = os.environ.get("ALERTABAIRRO_HOST", "127.0.0.1")
    port = int(os.environ.get("ALERTABAIRRO_PORT", "8000"))
    with create_server(host, port, default_db_path(PROJECT_ROOT)) as server:
        print(f"AlertaBairro em http://{host}:{server.server_address[1]}", flush=True)
        try:
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            print("Encerrando servidor.", flush=True)


if __name__ == "__main__":
    main()
