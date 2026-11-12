"""Run the existing HTTP contract suite against the deployment WSGI adapter."""
import unittest
from unittest.mock import patch
from pathlib import Path

from app import app
from backend.db import seed_database, default_db_path, SCHEMA
from backend.postgres import schema_for_postgres, Row
from tests import test_api
from werkzeug.serving import make_server


def wsgi_server(host, port, db_path):
    seed_database(db_path)
    app.config["DATABASE_TARGET"] = db_path
    server = make_server(host, port, app, threaded=True)
    server.db_path = db_path
    return server


class WSGIContractTests(test_api.APITests):
    @classmethod
    def setUpClass(cls):
        with patch.object(test_api, "create_server", wsgi_server):
            super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        app.config.pop("DATABASE_TARGET", None)


class DeploymentTests(unittest.TestCase):
    def test_separate_database_password_is_passed_without_url_interpolation(self):
        from backend.postgres import Connection
        with patch.dict("os.environ", {"DATABASE_PASSWORD": "test@:/?#pass"}), patch("psycopg.connect") as connect:
            connection = Connection("postgresql://test@example.test:6543/postgres")
            connect.assert_called_once_with("postgresql://test@example.test:6543/postgres",
                connect_timeout=10, prepare_threshold=None, password="test@:/?#pass")
            connection.close()

    def test_cloud_refuses_ephemeral_sqlite(self):
        with patch.dict("os.environ", {"VERCEL": "1", "DATABASE_URL": ""}):
            response = app.test_client().get("/api/health")
            self.assertEqual(response.status_code, 503)

    def test_public_files_do_not_expose_backend(self):
        client = app.test_client()
        for path in ("/", "/notifications.js"):
            with client.get(path) as response:
                self.assertEqual(response.status_code, 200)
        for path in ("/.env", "/backend/db.py", "/data/alertabairro.sqlite3", "/../app.py"):
            self.assertEqual(client.get(path).status_code, 404)

    def test_cloud_database_url_is_not_treated_as_a_file(self):
        with patch.dict("os.environ", {"DATABASE_URL": "postgresql://example/test"}):
            self.assertEqual(default_db_path(Path(".")), "postgresql://example/test")

    def test_postgres_schema_and_rows_preserve_api_contract(self):
        schema = schema_for_postgres(SCHEMA)
        for unsupported in ("PRAGMA", "AUTOINCREMENT", "COLLATE NOCASE"):
            self.assertNotIn(unsupported, schema)
        self.assertIn("users_email_lower", schema)
        row = Row(id=7, name="Ana")
        self.assertEqual(row[0], row["id"])
        self.assertEqual(dict(row), {"id": 7, "name": "Ana"})
