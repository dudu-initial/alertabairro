"""Compatibility layer for the application's parameterized SQL on PostgreSQL."""
import re
import sqlite3
import os

SERIAL_TABLES = {"users", "sources", "occurrences", "occurrence_history", "alerts", "notifications"}


class Row(dict):
    def __getitem__(self, key):
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


class Cursor:
    def __init__(self, cursor, inserted=False):
        self.cursor = cursor
        self.rowcount = cursor.rowcount
        self.lastrowid = cursor.fetchone()[0] if inserted else None

    def fetchone(self):
        values = self.cursor.fetchone()
        return None if values is None else Row(zip((c.name for c in self.cursor.description), values))

    def fetchall(self):
        return list(self)

    def __iter__(self):
        while (row := self.fetchone()) is not None:
            yield row


class Connection:
    def __init__(self, url):
        import psycopg
        self.driver = psycopg
        options = {"connect_timeout": 10, "prepare_threshold": None}
        # A separate secret avoids manual URL-encoding of database passwords.
        if os.environ.get("DATABASE_PASSWORD"):
            options["password"] = os.environ["DATABASE_PASSWORD"]
        self.raw = psycopg.connect(url, **options)

    def execute(self, sql, params=()):
        # Only repository-owned SQL is translated; values stay bound separately.
        sql = sql.replace("%", "%%").replace("?", "%s")
        sql = re.sub(r"\bLIKE\b", "ILIKE", sql)
        match = re.match(r"\s*INSERT INTO (\w+)", sql, re.I)
        inserted = bool(match and match[1] in SERIAL_TABLES)
        if inserted:
            sql = sql.rstrip().rstrip(";") + " RETURNING id"
        try:
            return Cursor(self.raw.execute(sql, params), inserted)
        except self.driver.IntegrityError as exc:
            raise sqlite3.IntegrityError("Database constraint conflict") from exc

    def executescript(self, script):
        for statement in script.split(";"):
            if statement.strip():
                self.execute(statement)

    def __enter__(self):
        return self

    def __exit__(self, kind, value, traceback):
        if kind:
            self.raw.rollback()
        else:
            self.raw.commit()

    def close(self):
        self.raw.close()


def schema_for_postgres(schema):
    schema = schema.replace("PRAGMA foreign_keys = ON;", "")
    schema = schema.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    schema = schema.replace(" UNIQUE COLLATE NOCASE", " UNIQUE")
    schema = schema.replace(" REAL", " DOUBLE PRECISION")
    schema += "\nCREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));"
    # Supabase REST clients must never read application tables directly.
    # The server connects as the database owner; no public RLS policies exist.
    for table in (*sorted(SERIAL_TABLES), "sessions", "vision_assessments"):
        schema += f"\nALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"
    return schema
