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

    def test_unknown_affected_people_persist_and_remain_distinct_from_zero(self):
        for count in (None, 0, 7):
            with self.subTest(count=count):
                code, body = self.request("POST", "/api/occurrences", {**VALID_REPORT, "affected_people": count}, "morador")
                self.assertEqual(code, 201, body)
                report = body["occurrence"]
                self.assertEqual(report["affected_people"], count)
                detail = self.request("GET", f"/api/occurrences/{report['id']}", role="agente")[1]
                self.assertEqual(detail["occurrence"]["affected_people"], count)
                from backend.db import db_session
                with db_session(self.server.db_path) as conn:
                    stored = conn.execute("SELECT affected_people_unknown FROM occurrences WHERE id=?", (report["id"],)).fetchone()
                    self.assertEqual(stored[0], int(count is None))

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

    def test_ai_assistance_is_saved_without_verification_or_notifications(self):
        from tests.test_vision import ASSISTANCE
        manual = self.create_report()
        before = self.request("GET", "/api/notifications", role="morador")[1]["unread"]
        code, created = self.request("POST", "/api/occurrences", {**VALID_REPORT, "ai_assistance": ASSISTANCE}, "morador")
        self.assertEqual(code, 201, created)
        report = created["occurrence"]
        self.assertEqual(report["status"], "Registrado")
        self.assertEqual(report["confidence_score"], manual["confidence_score"])
        self.assertEqual(report["evidence_count"], 0)
        detail = self.request("GET", f"/api/occurrences/{report['id']}", role="agente")[1]
        self.assertEqual(detail["ai_assistance"]["suggested_type"], "Alagamento")
        self.assertEqual(detail["ai_assistance"]["score"], .9)
        self.assertIsNone(detail["alert"])
        self.assertNotIn("image", detail["ai_assistance"])
        self.assertEqual(self.request("GET", "/api/notifications", role="morador")[1]["unread"], before)
        invalid = {**VALID_REPORT, "ai_assistance": {**ASSISTANCE, "human_confirmed": False}}
        self.assertEqual(self.request("POST", "/api/occurrences", invalid, "morador")[0], 400)

    def test_vision_runtime_assets_and_module_mime(self):
        for path, mime in (("/vision-worker.mjs", "javascript"), ("/vision.js", "javascript"), ("/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs", "javascript"), ("/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm", "application/wasm")):
            request = Request(self.base + path, method="HEAD")
            with self.subTest(path=path), urlopen(request, timeout=5) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(mime, response.headers["Content-Type"])

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

    def test_notification_read_all_is_private_and_idempotent(self):
        report = self.create_report()
        path = f"/api/occurrences/{report['id']}/transition"
        for target in ("Em validação", "Confirmado", "Alerta emitido"):
            code, body = self.request("POST", path, {
                "to": target, "message": "Evite a via durante a vistoria da equipe local."
            }, "agente")
            self.assertIn(code, (200, 201), body)
        other_before = self.request("GET", "/api/notifications", role="agente")[1]
        own_before = self.request("GET", "/api/notifications", role="morador")[1]
        self.assertGreater(own_before["unread"], 0)
        code, body = self.request("POST", "/api/notifications/read-all", {}, "morador")
        self.assertEqual(code, 200, body)
        self.assertEqual(body["updated"], own_before["unread"])
        own_after = self.request("GET", "/api/notifications", role="morador")[1]
        self.assertEqual(own_after["unread"], 0)
        self.assertTrue(all(item["is_read"] for item in own_after["items"]))
        self.assertEqual(self.request("GET", "/api/notifications", role="agente")[1], other_before)
        self.assertEqual(self.request("POST", "/api/notifications/read-all", {}, "morador")[1]["updated"], 0)

    def test_notification_permissions(self):
        for method, path in (("GET", "/api/notifications"), ("POST", "/api/notifications/read-all"), ("POST", "/api/notifications/1/read")):
            self.assertEqual(self.request(method, path)[0], 401)
        notice = self.request("GET", "/api/notifications", role="agente")[1]["items"][0]
        before = self.request("GET", "/api/notifications", role="agente")[1]
        self.assertEqual(self.request("POST", f"/api/notifications/{notice['id']}/read", {}, "morador")[0], 404)
        self.assertEqual(self.request("GET", "/api/notifications", role="agente")[1], before)

    def test_notifications_include_occurrence_context(self):
        code, body = self.request("GET", "/api/notifications", role="gestor")
        self.assertEqual(code, 200)
        self.assertTrue(body["items"])
        for notice in body["items"]:
            occurrence = self.request("GET", f"/api/occurrences/{notice['occurrence_id']}", role="gestor")[1]["occurrence"]
            for field in ("neighborhood", "risk_level", "confidence_score", "source_label", "status"):
                self.assertEqual(notice[field], occurrence[field])
            self.assertIsInstance(notice["is_read"], bool)

    def test_discard_requires_justification(self):
        report = self.create_report()
        path = f"/api/occurrences/{report['id']}/transition"
        self.assertEqual(self.request("POST", path, {"to": "Descartado"}, "agente")[0], 400)
        code, body = self.request(
            "POST", path, {"to": "Descartado", "notes": "Relato duplicado após inspeção."}, "agente"
        )
        self.assertEqual(code, 200, body)
        self.assertEqual(body["occurrence"]["status"], "Descartado")

    def test_delete_requires_agent_or_manager(self):
        report = self.create_report()
        path = f"/api/occurrences/{report['id']}"
        self.assertEqual(self.request("DELETE", path)[0], 401)
        self.assertEqual(self.request("DELETE", path, role="morador")[0], 403)
        self.assertEqual(self.request("GET", path, role="morador")[0], 200)
        for role in ("agente", "gestor"):
            with self.subTest(role=role):
                current = self.create_report()
                target = f"/api/occurrences/{current['id']}"
                code, result = self.request("DELETE", target, role=role)
                self.assertEqual(code, 200, result)
                self.assertEqual(result["deleted_id"], current["id"])
                self.assertEqual(self.request("GET", target, role="morador")[0], 404)
                self.assertEqual(self.request("DELETE", target, role=role)[0], 404)

    def test_delete_cascades_related_records_and_updates_lists(self):
        from tests.test_vision import ASSISTANCE
        from backend.db import db_session
        code, result = self.request("POST", "/api/occurrences", {**VALID_REPORT, "ai_assistance": ASSISTANCE}, "morador")
        self.assertEqual(code, 201)
        occurrence_id = result["occurrence"]["id"]
        path = f"/api/occurrences/{occurrence_id}"
        for state in ("Em validação", "Confirmado", "Alerta emitido"):
            payload = {"to": state, "message": "Alerta de teste de exclusão com registros vinculados."}
            self.assertIn(self.request("POST", path + "/transition", payload, "agente")[0], (200, 201))
        other = self.create_report()
        before = self.request("GET", "/api/dashboard", role="gestor")[1]["stats"]["total"]
        with db_session(self.server.db_path) as conn:
            for table in ("occurrence_history", "alerts", "notifications", "vision_assessments"):
                self.assertGreater(conn.execute(f"SELECT COUNT(*) FROM {table} WHERE occurrence_id=?", (occurrence_id,)).fetchone()[0], 0)
        self.assertEqual(self.request("DELETE", path, role="agente")[0], 200)
        with db_session(self.server.db_path) as conn:
            for table in ("occurrence_history", "alerts", "notifications", "vision_assessments"):
                self.assertEqual(conn.execute(f"SELECT COUNT(*) FROM {table} WHERE occurrence_id=?", (occurrence_id,)).fetchone()[0], 0)
            self.assertEqual(conn.execute("PRAGMA foreign_key_check").fetchall(), [])
        self.assertEqual(self.request("GET", f"/api/occurrences/{other['id']}", role="morador")[0], 200)
        after = self.request("GET", "/api/dashboard", role="gestor")[1]["stats"]["total"]
        self.assertEqual(after, before - 1)
        for endpoint in ("/api/alerts", "/api/notifications"):
            items = self.request("GET", endpoint, role="morador")[1]["items"]
            self.assertFalse(any(item["occurrence_id"] == occurrence_id for item in items))
        items = self.request("GET", "/api/occurrences?limit=100", role="morador")[1]["items"]
        self.assertFalse(any(item["id"] == occurrence_id for item in items))


if __name__ == "__main__":
    unittest.main()
