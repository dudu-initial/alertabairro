import unittest
from backend.vision import MODEL, REVISION, validate_assistance
from backend.domain import ValidationError

ASSISTANCE = {"model": MODEL, "revision": REVISION, "suggested_type": "Alagamento", "score": .9, "margin": .8, "human_confirmed": True}

class VisionTests(unittest.TestCase):
    def test_optional_and_confirmed_assistance(self):
        self.assertIsNone(validate_assistance(None, "Alagamento"))
        self.assertEqual(validate_assistance(ASSISTANCE, "Alagamento"), ASSISTANCE)

    def test_forged_unsupported_or_inconclusive_payloads_are_rejected(self):
        for change in ({"human_confirmed": False}, {"model": "fake"}, {"revision": "latest"}, {"suggested_type": "Falta de energia"}, {"score": float("nan")}, {"score": True}, {"score": .3}, {"margin": .01}, {"margin": .99}, {"image": "base64"}):
            with self.subTest(change=change), self.assertRaises(ValidationError):
                validate_assistance({**ASSISTANCE, **change}, "Alagamento")
        with self.assertRaises(ValidationError):
            validate_assistance(ASSISTANCE, "Incêndio")
        with self.assertRaises(ValidationError):
            validate_assistance({**ASSISTANCE, "suggested_type": []}, "Alagamento")
