"""Publish frontend assets through Vercel CDN, including large WASM files."""
from pathlib import Path
from shutil import copytree
import os
import sys

root = Path(__file__).resolve().parent.parent
copytree(root / "frontend", root / "public", dirs_exist_ok=True)
print("Frontend copiado para public/.")

# Explicit opt-in: initialize only the dedicated cloud database during build.
# No credentials need to be copied onto the developer's computer.
if os.environ.get("ALERTABAIRRO_INIT_DB") == "1":
    sys.path.insert(0, str(root))
    from scripts.init_cloud import main
    main()
