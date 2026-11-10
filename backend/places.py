"""Versioned São Paulo place catalogue. No network request on the report path."""

import json
import re
import unicodedata
from pathlib import Path

CATALOG = Path(__file__).parent / "catalog"
IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios/3550308/distritos"


def name_key(value):
    text = unicodedata.normalize("NFD", str(value).strip().casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"\b(vl|vila)\.?\s+", "vila ", text)
    text = re.sub(r"\b(jd|jardim)\.?\s+", "jardim ", text)
    return " ".join(text.split())


def _load():
    # Accent corrections follow the municipal district list (Lei 11.220/1992).
    corrections = {"Cangaiba": "Cangaíba", "Cidade Lider": "Cidade Líder"}
    result = {}
    for entry in json.loads((CATALOG / "ibge-districts.json").read_text(encoding="utf-8-sig")):
        name = corrections.get(entry["nome"], entry["nome"])
        result[name_key(name)] = {"name": name, "kind": "Distrito", "source": "IBGE", "source_url": IBGE_URL, "id": str(entry["id"])}
    osm_file = CATALOG / "osm-neighborhoods.json"
    if osm_file.exists():
        raw = json.loads(osm_file.read_text(encoding="utf-8-sig")) or {}
        for entry in raw.get("elements", []):
            name = entry.get("tags", {}).get("name", "").strip()
            if not name or not 2 <= len(name) <= 100:
                continue
            if name.islower():
                name = " ".join(word if word in {"de", "do", "da", "dos", "das", "e"} else word.capitalize() for word in name.split())
            key = name_key(name)
            point = entry.get("center", entry)
            # A place label is only a navigation reference, never an occurrence pin.
            if key in result:
                result[key].setdefault("center", [point["lat"], point["lon"]])
            else:
                result[key] = {"name": name, "kind": "Bairro", "source": "OpenStreetMap", "source_url": f"https://www.openstreetmap.org/{entry['type']}/{entry['id']}", "id": f"osm-{entry['type']}-{entry['id']}", "center": [point["lat"], point["lon"]]}
    return result


PLACES = _load()
ALIASES = {"arthur alvim": "artur alvim", "sao miguel paulista": "sao miguel"}


def find_place(value):
    key = name_key(value)
    return PLACES.get(ALIASES.get(key, key))


def search_places(query=""):
    key = name_key(query)
    matches = [place for candidate, place in PLACES.items() if not key or key in candidate]
    exact = find_place(query)
    if exact and exact not in matches:
        matches.append(exact)
    return sorted(matches, key=lambda p: (p != exact, name_key(p["name"])))


def normalize_existing(conn):
    """Idempotent, non-destructive spelling cleanup; retain unmatched legacy data."""
    for row in conn.execute("SELECT id,neighborhood,title FROM occurrences").fetchall():
        place = find_place(row["neighborhood"])
        if place and place["name"] != row["neighborhood"]:
            old_suffix = " em " + row["neighborhood"]
            title = row["title"]
            if title.endswith(old_suffix):
                title = title[:-len(old_suffix)] + " em " + place["name"]
            conn.execute("UPDATE occurrences SET neighborhood=?,title=? WHERE id=?", (place["name"], title, row["id"]))
