"""Load demonstration users, sources, reports and notifications.

Run ``python -m backend.seed`` for a new database. Use ``--reset`` only when
intentionally replacing the local demonstration database contents.
"""

from __future__ import annotations

import argparse

from .db import default_db_path, seed_database
from .server import PROJECT_ROOT, load_dotenv


def main() -> None:
    parser = argparse.ArgumentParser(description="Carrega dados demonstrativos do AlertaBairro")
    parser.add_argument("--reset", action="store_true", help="apaga os dados locais e recarrega a demonstração")
    arguments = parser.parse_args()
    load_dotenv()
    path = default_db_path(PROJECT_ROOT)
    inserted = seed_database(path, reset=arguments.reset)
    if inserted:
        print(f"Dados demonstrativos carregados em {path}")
    else:
        print(f"Banco já contém dados; nenhuma alteração feita em {path}. Use --reset para reiniciar.")


if __name__ == "__main__":
    main()
