"""SQLite schema, connection helpers and self-contained demonstration data."""

from __future__ import annotations

import hashlib
import hmac
import os
from contextlib import contextmanager
from pathlib import Path
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

from .domain import TRANSITION_EVENTS, calculate_confidence, classify_risk


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('morador','agente','gestor')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('community','external','official')),
  url TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Demonstrativa',
  last_sync_at TEXT
);
CREATE TABLE IF NOT EXISTS occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  severity INTEGER NOT NULL,
  affected_people INTEGER NOT NULL,
  status TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  confidence_score INTEGER NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  corroborations INTEGER NOT NULL DEFAULT 0,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_occurrences_status ON occurrences(status);
CREATE INDEX IF NOT EXISTS idx_occurrences_risk ON occurrences(risk_level);
CREATE INDEX IF NOT EXISTS idx_occurrences_created ON occurrences(created_at DESC);
CREATE TABLE IF NOT EXISTS occurrence_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  event TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  actor_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurrence_id INTEGER NOT NULL UNIQUE REFERENCES occurrences(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'Todos os moradores',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurrence_id INTEGER NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE TABLE IF NOT EXISTS vision_assessments (
  occurrence_id INTEGER PRIMARY KEY REFERENCES occurrences(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  revision TEXT NOT NULL,
  suggested_type TEXT NOT NULL,
  score REAL NOT NULL,
  margin REAL NOT NULL,
  human_confirmed INTEGER NOT NULL CHECK (human_confirmed = 1),
  created_at TEXT NOT NULL
);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(db_path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def db_session(db_path: str | Path):
    """Commit or roll back, then always close the SQLite handle on Windows."""
    conn = connect(db_path)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def make_password(password: str) -> str:
    iterations = 180_000
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_hex, expected_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(actual, bytes.fromhex(expected_hex))
    except (ValueError, TypeError):
        return False


def init_database(db_path: str | Path) -> None:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with db_session(db_path) as conn:
        conn.executescript(SCHEMA)


def seed_database(db_path: str | Path, reset: bool = False) -> bool:
    """Insert local demo records once. Return True when data was inserted.

    The explicit ``reset`` option clears demo data and sessions; normal server
    startup never clears existing reports.
    """
    init_database(db_path)
    now = datetime.now(timezone.utc)
    with db_session(db_path) as conn:
        if reset:
            for table in (
                "notifications", "alerts", "occurrence_history", "occurrences",
                "sessions", "sources", "users",
            ):
                conn.execute(f"DELETE FROM {table}")
            conn.execute("DELETE FROM sqlite_sequence")
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
            return False
        created_at = now.isoformat(timespec="seconds")
        users = [
            ("Ana Costa", "morador@alertabairro.local", "morador"),
            ("Rafael Lima", "agente@alertabairro.local", "agente"),
            ("Marina Souza", "gestor@alertabairro.local", "gestor"),
        ]
        for name, email, role in users:
            conn.execute(
                "INSERT INTO users(name,email,role,password_hash,created_at) VALUES (?,?,?,?,?)",
                (name, email, role, make_password("Demo@2026"), created_at),
            )
        sources = [
            ("Relato comunitário", "community", None,
             "Ocorrências registradas por moradores e sujeitas à validação humana."),
            ("Defesa Civil · boletim demonstrativo", "official", None,
             "Exemplo de boletim institucional usado somente nos dados de demonstração."),
            ("Monitoramento climático · simulação", "external", None,
             "Dados simulados para demonstrar integração futura com provedores climáticos."),
        ]
        for name, kind, url, description in sources:
            conn.execute(
                "INSERT INTO sources(name,kind,url,description,last_sync_at) VALUES (?,?,?,?,?)",
                (name, kind, url, description, created_at),
            )

        # Representative reports cover each state, source and risk level.
        examples = [
            ("Alagamento na Rua das Flores", "Alagamento", "Água acima da calçada após chuva intensa; acesso de veículos comprometido.", "Vila Mariana", "Rua das Flores, 120", 4, 18, "Em monitoramento", 1, 1, 2, 1, 2, -23.5899, -46.6349),
            ("Risco de deslizamento em encosta", "Deslizamento", "Moradores observaram fissuras recentes e movimentação de terra perto das casas.", "Jardim Ângela", "Rua da Encosta, 45", 5, 32, "Alerta emitido", 2, 2, 2, 2, 1, -23.6902, -46.7709),
            ("Árvore caída bloqueia avenida", "Queda de árvore", "Uma árvore de grande porte caiu sobre a pista e impede a passagem de ônibus.", "Pinheiros", "Avenida das Palmeiras, 800", 3, 0, "Confirmado", 1, 2, 1, 1, 3, -23.5631, -46.7012),
            ("Fumaça próxima ao centro comunitário", "Incêndio", "Fumaça visível nos fundos do centro comunitário; ainda não há confirmação de foco ativo.", "Mooca", "Rua do Oratório, 220", 3, 5, "Em validação", 1, 1, 0, 1, 4, -23.5536, -46.5984),
            ("Falta de energia em várias quadras", "Falta de energia", "Residências e comércios da região relatam interrupção de energia desde o início da noite.", "Tatuapé", "Rua Serra de Bragança", 2, 40, "Registrado", 1, 1, 0, 1, 5, -23.5477, -46.5617),
            ("Via liberada após alagamento", "Alagamento", "A água escoou e a via foi liberada após vistoria local da equipe de resposta.", "Ipiranga", "Rua Bom Pastor, 600", 2, 2, "Encerrado", 2, 2, 2, 2, 30, -23.5843, -46.6091),
            ("Relato duplicado de queda de árvore", "Queda de árvore", "Registro duplicado da ocorrência da avenida, sem novo ponto de impacto identificado.", "Pinheiros", "Avenida das Palmeiras, 800", 2, 0, "Descartado", 1, 1, 0, 1, 6, -23.5631, -46.7012),
            ("Bueiro obstruído após chuva", "Alagamento", "Moradores relatam acúmulo de água ao redor de um bueiro, com calçada parcialmente tomada.", "Bela Vista", "Rua Treze de Maio, 300", 2, 0, "Registrado", 1, 1, 0, 1, 1, -23.5592, -46.6483),
            ("Incêndio controlado em depósito", "Incêndio", "Equipes locais controlaram o foco; a área segue isolada para inspeção e rescaldo.", "Lapa", "Rua Clélia, 900", 4, 12, "Em monitoramento", 2, 2, 2, 2, 10, -23.5258, -46.7058),
            ("Deslizamento suspeito no talude", "Deslizamento", "Solo encharcado e pequeno desprendimento de terra observados junto ao talude.", "Brasilândia", "Rua da Pedreira, 50", 3, 4, "Em validação", 3, 1, 1, 1, 8, -23.4597, -46.6907),
            ("Oscilação de energia no bairro", "Falta de energia", "Comércios registraram interrupções intermitentes e perda temporária de iluminação pública.", "Santo Amaro", "Praça Floriano Peixoto", 1, 5, "Confirmado", 3, 1, 1, 1, 14, -23.6477, -46.7119),
            ("Ponto de fumaça em terreno vazio", "Outro", "Fumaça de origem ainda indeterminada foi vista em terreno sem construções.", "Cambuci", "Rua Lins de Vasconcelos, 410", 2, 0, "Registrado", 1, 1, 0, 1, 3, -23.5698, -46.6194),
        ]
        for (title, type_, description, neighborhood, address, severity, affected,
             status, source_id, reporter_id, evidence, corroborations, hours_ago,
             latitude, longitude) in examples:
            created_time = now - timedelta(hours=hours_ago)
            timestamp = created_time.isoformat(timespec="seconds")
            state_path = ["Registrado", "Em validação", "Confirmado", "Alerta emitido", "Em monitoramento", "Encerrado"]
            if status == "Descartado":
                state_path = ["Registrado", "Descartado"]
            else:
                state_path = state_path[:state_path.index(status) + 1]
            updated_at = (created_time + timedelta(minutes=5 * (len(state_path) - 1))).isoformat(timespec="seconds")
            source_kind = {1: "community", 2: "official", 3: "external"}[source_id]
            risk_score, risk_level = classify_risk(type_, severity, affected)
            confidence_score = calculate_confidence(
                source_kind, evidence, corroborations, hours_ago,
                verified=status in ("Confirmado", "Alerta emitido", "Em monitoramento", "Encerrado"),
            )
            cursor = conn.execute(
                """INSERT INTO occurrences
                   (title,type,description,neighborhood,address,latitude,longitude,severity,
                    affected_people,status,risk_score,risk_level,confidence_score,evidence_count,
                    corroborations,reporter_id,source_id,occurred_at,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (title, type_, description, neighborhood, address, latitude, longitude,
                 severity, affected, status, risk_score, risk_level, confidence_score,
                 evidence, corroborations, reporter_id, source_id, timestamp, timestamp, updated_at),
            )
            occurrence_id = cursor.lastrowid
            conn.execute(
                """INSERT INTO occurrence_history
                   (occurrence_id,from_status,to_status,event,notes,actor_id,created_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (occurrence_id, None, "Registrado", "Relato criado",
                 "Dado demonstrativo", reporter_id, timestamp),
            )
            for step, (previous, target) in enumerate(zip(state_path, state_path[1:]), start=1):
                step_at = (created_time + timedelta(minutes=5 * step)).isoformat(timespec="seconds")
                conn.execute(
                    """INSERT INTO occurrence_history
                       (occurrence_id,from_status,to_status,event,notes,actor_id,created_at)
                       VALUES (?,?,?,?,?,?,?)""",
                    (occurrence_id, previous, target, TRANSITION_EVENTS[(previous, target)],
                     "Validação demonstrativa com dados fictícios", 2, step_at),
                )
            if status in ("Alerta emitido", "Em monitoramento", "Encerrado"):
                message = f"Atenção em {neighborhood}: {title.lower()}. Acompanhe as orientações locais."
                alert_at = (created_time + timedelta(minutes=15)).isoformat(timespec="seconds")
                alert_id = conn.execute(
                    "INSERT INTO alerts(occurrence_id,message,created_by,created_at) VALUES (?,?,?,?)",
                    (occurrence_id, message, 2, alert_at),
                ).lastrowid
                for user_id in (1, 2, 3):
                    conn.execute(
                        """INSERT INTO notifications
                           (user_id,occurrence_id,alert_id,title,body,is_read,created_at)
                           VALUES (?,?,?,?,?,?,?)""",
                        (user_id, occurrence_id, alert_id, title, message,
                         1 if user_id == 2 else 0, alert_at),
                    )
        return True


def default_db_path(project_root: Path) -> Path:
    raw = os.environ.get("ALERTABAIRRO_DB", "data/alertabairro.sqlite3")
    path = Path(raw)
    return path if path.is_absolute() else project_root / path
