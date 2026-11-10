"""Database bootstrap and local demonstration data checks."""

import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from backend.db import connect, seed_database, verify_password, init_database


class DatabaseTests(unittest.TestCase):
    def test_unknown_people_migration_preserves_existing_records(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            path = Path(directory) / "legacy.sqlite3"
            seed_database(path)
            with closing(connect(path)) as conn:
                before = [tuple(row) for row in conn.execute("SELECT id,affected_people FROM occurrences ORDER BY id")]
                conn.execute("ALTER TABLE occurrences DROP COLUMN affected_people_unknown")
                conn.commit()
            init_database(path)
            init_database(path)
            with closing(connect(path)) as conn:
                after = [tuple(row) for row in conn.execute("SELECT id,affected_people FROM occurrences ORDER BY id")]
                self.assertEqual(before, after)
                self.assertEqual(conn.execute("SELECT SUM(affected_people_unknown) FROM occurrences").fetchone()[0], 0)

    def test_seed_is_repeatable_without_erasing_existing_records(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            db_path = Path(directory) / "demo.sqlite3"
            self.assertTrue(seed_database(db_path))
            with closing(connect(db_path)) as conn:
                first_count = conn.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0]
                self.assertGreaterEqual(first_count, 9)
                user = conn.execute(
                    "SELECT password_hash FROM users WHERE email = ?",
                    ("agente@alertabairro.local",),
                ).fetchone()
                self.assertTrue(verify_password("Demo@2026", user["password_hash"]))
                self.assertFalse(verify_password("errada", user["password_hash"]))
            self.assertFalse(seed_database(db_path))
            with closing(connect(db_path)) as conn:
                self.assertEqual(
                    conn.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0],
                    first_count,
                )


if __name__ == "__main__":
    unittest.main()
