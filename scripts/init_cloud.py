"""Explicit one-time initialization; never resets a cloud database."""
import os
from backend.db import seed_database

def main():
    url = os.environ.get("DATABASE_URL", "")
    if not url.startswith(("postgres://", "postgresql://")):
        raise SystemExit("Configure DATABASE_URL com a conexão PostgreSQL.")
    seeded = seed_database(url)
    print("Banco inicializado com dados demonstrativos." if seeded else "Banco existente preservado.")

if __name__ == "__main__":
    main()
