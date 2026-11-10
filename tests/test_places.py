"""Real place names, canonical persistence, and honest coordinate handling."""
import unittest
from backend.domain import ValidationError, validate_occurrence
from backend.places import PLACES, find_place, search_places
from tests.test_domain import VALID_REPORT


class PlaceTests(unittest.TestCase):
    def test_authoritative_districts_and_real_neighborhoods(self):
        self.assertEqual(sum(p["source"] == "IBGE" for p in PLACES.values()), 96)
        self.assertEqual(find_place("vila madalena")["name"], "Vila Madalena")
        self.assertEqual(find_place("interlagos")["kind"], "Bairro")
        self.assertEqual(find_place("jardim piratininga")["name"], "Jardim Piratininga")

    def test_case_accents_whitespace_and_abbreviations(self):
        for typed, expected in (("  vila   mariana ", "Vila Mariana"), ("JD. ANGELA", "Jardim Ângela"), ("vl. sonia", "Vila Sônia"), ("cidade lider", "Cidade Líder"), ("arthur alvim", "Artur Alvim")):
            with self.subTest(typed=typed):
                report = validate_occurrence({**VALID_REPORT, "neighborhood": typed})
                self.assertEqual(report["neighborhood"], expected)

    def test_unknown_name_is_not_invented(self):
        with self.assertRaises(ValidationError):
            validate_occurrence({**VALID_REPORT, "neighborhood": "Bairro Que Não Existe 999"})
        self.assertIsNone(find_place("vila mar"))
        self.assertIn("Vila Mariana", [p["name"] for p in search_places("vila mar")])
        self.assertEqual(search_places("sao miguel paulista")[0]["name"], "São Miguel")

    def test_missing_coordinates_stay_missing(self):
        report = validate_occurrence(VALID_REPORT)
        self.assertIsNone(report["latitude"])
        self.assertIsNone(report["longitude"])

    def test_coordinate_pairs_and_region(self):
        point = {"latitude": -23.5925, "longitude": -46.6357}
        self.assertEqual(validate_occurrence({**VALID_REPORT, **point})["latitude"], point["latitude"])
        for change in ({"latitude": -23.5}, {"longitude": -46.6}, {"latitude": 0, "longitude": 0}, {"latitude": float("nan"), "longitude": -46.6}):
            with self.subTest(change=change), self.assertRaises(ValidationError):
                validate_occurrence({**VALID_REPORT, **change})
