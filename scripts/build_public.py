"""Publish frontend assets through Vercel CDN, including large WASM files."""
from pathlib import Path
from shutil import copytree

root = Path(__file__).resolve().parent.parent
copytree(root / "frontend", root / "public", dirs_exist_ok=True)
print("Frontend copiado para public/.")
