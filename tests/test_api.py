"""HTTP checks for persistence, authorization and the alert workflow."""

import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.server import create_server
from tests.test_domain import VALID_REPORT


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tempdir = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        cls.server = create_server("127.0.0.1", 0, Path(cls.tempdir.name) / "api.sqlite3")
        cls.server.RequestHandlerClass.log_message = lambda *_args: None
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.tokens = {}
        for role in ("morador", "agente", "gestor"):
            code, body = cls.request(
                "POST",
                "/api/auth/login",
                {"email": f"{role}@alertabairro.local", "password": "Demo@2026"},
            )
            assert code == 200, body
            cls.tokens[role] = body["token"]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        cls.tempdir.cleanup()

    @classmethod
    def request(cls, method, path, body=None, role=None, token=None):
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        auth_token = token or (cls.tokens[role] if role else None)
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        request = Request(cls.base + path, data=data, headers=headers, method=method)
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            parsed = json.loads(raw) if raw else {}
            return response.status, parsed

    def test_registration_and_login(self):
        payload = {"name": "Nova Moradora", "email": "nova@example.com", "password": "SenhaSegura123"}
        code, body = self.request("POST", "/api/auth/register", payload)
        self.assertEqual(code, 201, body)
        self.assertEqual(body["user"]["role"], "morador")
        self.assertNotIn("password", body["user"])
        code, session = self.request("POST", "/api/auth/login", {"email": payload["email"], "password": payload["password"]})
        self.assertEqual(code, 200)
        self.assertEqual(self.request("GET", "/api/auth/me", token=session["token"])[0], 200)
        self.assertEqual(self.request("GET", "/api/users", token=session["token"])[0], 403)
        self.assertEqual(self.request("POST", "/api/auth/register", {**payload, "email": "NOVA@example.com"})[0], 409)
        self.assertEqual(self.request("POST", "/api/auth/login", {"email": payload["email"], "password": "incorreta"})[0], 401)

    def test_registration_validation(self):
        valid = {"name": "Morador", "email": "valid@example.com", "password": "SenhaSegura123"}
        for changes in ({"name": "A"}, {"email": "invalido"}, {"password": "123"}, {"role": "gestor"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.request("POST", "/api/auth/register", {**valid, **changes})[0], 400)

    def create_report(self, role="morador"):
        code, body = self.request("POST", "/api/occurrences", VALID_REPORT, role)
        self.assertEqual(code, 201, body)
        return body["occurrence"]

    def test_health_meta_and_authentication(self):
        self.assertEqual(self.request("GET", "/api/health")[0], 200)
        code, meta = self.request("GET", "/api/meta")
        self.assertEqual(code, 200)
        self.assertIn("Alagamento", meta["types"])
        self.assertEqual(self.request("GET", "/api/dashboard")[0], 401)
        self.assertEqual(
            self.request("POST", "/api/auth/login", {"email": "nobody", "password": "x"})[0],
            401,
        )
        code, body = self.request("GET", "/api/auth/me", role="morador")
        self.assertEqual(code, 200)
        self.assertEqual(body["user"]["role"], "morador")

    def test_neighborhood_search_and_canonical_persistence(self):
        code, catalog = self.request("GET", "/api/neighborhoods?q=vila%20mariana")
        self.assertEqual(code, 200)
        self.assertEqual(catalog["items"][0]["name"], "Vila Mariana")
        self.assertEqual(self.request("GET", "/api/neighborhoods?q=naoexiste999")[1]["items"], [])
        code, result = self.request("POST", "/api/occurrences", {**VALID_REPORT, "title": "Alagamento em vila mariana", "neighborhood": "vila mariana", "latitude": -23.59, "longitude": -46.63}, "morador")
        self.assertEqual(code, 201, result)
        code, saved = self.request("GET", f"/api/occurrences/{result['occurrence']['id']}", role="morador")
        self.assertEqual(saved["occurrence"]["neighborhood"], "Vila Mariana")
        self.assertEqual(saved["occurrence"]["title"], "Alagamento em Vila Mariana")
        self.assertEqual(saved["occurrence"]["latitude"], -23.59)
        self.assertEqual(saved["occurrence"]["longitude"], -46.63)
        self.assertEqual(self.request("POST", "/api/occurrences", {**VALID_REPORT, "neighborhood": "Inventado999"}, "morador")[0], 400)

    def test_existing_neighborhood_cleanup_preserves_records(self):
        from backend.db import db_session
        from backend.places import normalize_existing
        report = self.create_report()
        with db_session(self.server.db_path) as conn:
            conn.execute("UPDATE occurrences SET neighborhood=? WHERE id=?", ("vila mariana", report["id"]))
            before = conn.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0]
            normalize_existing(conn)
            normalize_existing(conn)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0], before)
        saved = self.request("GET", f"/api/occurrences/{report['id']}", role="morador")[1]["occurrence"]
        self.assertEqual(saved["neighborhood"], "Vila Mariana")
        self.assertEqual(saved["description"], report["description"])

    def test_map_assets_are_served(self):
        for path, content_type in (("/geo.js", "javascript"), ("/vendor/leaflet/leaflet.js", "javascript"), ("/vendor/leaflet/leaflet.css", "text/css")):
            with self.subTest(path=path), urlopen(self.base + path, timeout=5) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(content_type, response.headers["Content-Type"])
                self.assertGreater(len(response.read()), 100)

    def test_logout_revokes_server_session(self):
        code, body = self.request(
            "POST", "/api/auth/login",
            {"email": "morador@alertabairro.local", "password": "Demo@2026"},
        )
        self.assertEqual(code, 200)
        token = body["token"]
        self.assertEqual(self.request("GET", "/api/auth/me", token=token)[0], 200)
        self.assertEqual(self.request("POST", "/api/auth/logout", {}, token=token)[0], 200)
        self.assertEqual(self.request("GET", "/api/auth/me", token=token)[0], 401)

    def test_report_validation_persistence_and_dashboard(self):
        _, before = self.request("GET", "/api/dashboard", role="morador")
        bad = {**VALID_REPORT, "title": "curto"}
        code, body = self.request("POST", "/api/occurrences", bad, "morador")
        self.assertEqual(code, 400, body)
        self.assertIn("error", body)
        report = self.create_report()
        self.assertEqual(report["status"], "Registrado")
        self.assertEqual(report["source_kind"], "community")
        self.assertGreater(report["confidence_score"], 0)
        code, detail = self.request("GET", f"/api/occurrences/{report['id']}", role="morador")
        self.assertEqual(code, 200)
        self.assertEqual(detail["occurrence"]["title"], VALID_REPORT["title"])
        self.assertEqual(detail["history"][0]["to_status"], "Registrado")
        _, after = self.request("GET", "/api/dashboard", role="morador")
        self.assertEqual(after["stats"]["total"], before["stats"]["total"] + 1)

    def test_permission_and_transition_constraints(self):
        report = self.create_report()
        path = f"/api/occurrences/{report['id']}/transition"
        self.assertEqual(
            self.request("POST", path, {"to": "Em validação"}, "morador")[0],
            403,
        )
        self.assertEqual(
            self.request("POST", path, {"to": "Alerta emitido"}, "agente")[0],
            409,
        )
        self.assertEqual(self.request("GET", "/api/users", role="morador")[0], 403)
        self.assertEqual(self.request("GET", "/api/users", role="gestor")[0], 200)
        self.assertEqual(self.request("GET", "/api/sources", role="morador")[0], 200)

    def test_alert_creates_notifications_and_can_be_closed(self):
        report = self.create_report()
        path = f"/api/occurrences/{report['id']}/transition"
        for target in ("Em validação", "Confirmado"):
            code, body = self.request("POST", path, {"to": target, "notes": "Vistoria local realizada."}, "agente")
            self.assertEqual(code, 200, body)
            self.assertEqual(body["occurrence"]["status"], target)
        code, body = self.request(
            "POST", path,
            {"to": "Alerta emitido", "message": "Evite a via central até a conclusão da vistoria local."},
            "agente",
        )
        self.assertEqual(code, 201, body)
        self.assertEqual(body["notifications_created"], 3)
        self.assertEqual(body["occurrence"]["status"], "Alerta emitido")
        code, alerts = self.request("GET", "/api/alerts", role="morador")
        self.assertEqual(code, 200)
        self.assertTrue(any(item["occurrence_id"] == report["id"] for item in alerts["items"]))
        _, notifications = self.request("GET", "/api/notifications", role="morador")
        notice = next(item for item in notifications["items"] if item["occurrence_id"] == report["id"])
        self.assertFalse(notice["is_read"])
        self.assertEqual(
            self.request("POST", f"/api/notifications/{notice['id']}/read", {}, "morador")[0],
            200,
        )
        for target in ("Em monitoramento", "Encerrado"):
            code, body = self.request("POST", path, {"to": target}, "gestor")
            self.assertEqual(code, 200, body)
        self.assertEqual(body["occurrence"]["status"], "Encerrado")

    def test_discard_requires_justification(self):
        report = self.create_report()
        path = f"/api/occurrences/{report['id']}/transition"
        self.assertEqual(self.request("POST", path, {"to": "Descartado"}, "agente")[0], 400)
        code, body = self.request(
            "POST", path, {"to": "Descartado", "notes": "Relato duplicado após inspeção."}, "agente"
        )
        self.assertEqual(code, 200, body)
        self.assertEqual(body["occurrence"]["status"], "Descartado")


if __name__ == "__main__":
    unittest.main()
