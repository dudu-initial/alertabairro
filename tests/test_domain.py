"""Focused tests for the rules that drive the public workflow."""

import unittest

from backend.domain import (
    ValidationError,
    calculate_confidence,
    can_transition,
    classify_risk,
    validate_occurrence,
)


VALID_REPORT = {
    "title": "Água subindo na avenida central",
    "type": "Alagamento",
    "description": "A água já alcançou as calçadas e bloqueou o trânsito local.",
    "neighborhood": "Vila Mariana",
    "address": "Rua das Flores, 120",
    "severity": 4,
    "affected_people": 12,
}


class OccurrenceValidationTests(unittest.TestCase):
    def test_valid_report_is_normalized(self):
        report = validate_occurrence({**VALID_REPORT, "title": "  Água  subindo  na avenida central  "})
        self.assertEqual(report["title"], "Água subindo na avenida central")
        self.assertEqual(report["severity"], 4)
        self.assertIsNone(report["latitude"])

    def test_required_fields_and_coordinate_limits(self):
        for change in (
            {"title": "curto"},
            {"type": "Tipo desconhecido"},
            {"description": "curta"},
            {"neighborhood": ""},
            {"severity": 6},
            {"severity": 2.7},
            {"affected_people": -1},
            {"affected_people": 1.5},
            {"latitude": 91},
        ):
            with self.subTest(change=change), self.assertRaises(ValidationError):
                validate_occurrence({**VALID_REPORT, **change})

    def test_future_occurrence_is_rejected(self):
        with self.assertRaises(ValidationError):
            validate_occurrence({**VALID_REPORT, "occurred_at": "2999-01-01T00:00:00Z"})

    def test_unknown_people_are_distinct_from_zero(self):
        unknown = validate_occurrence({**VALID_REPORT, "affected_people": None})
        zero = validate_occurrence({**VALID_REPORT, "affected_people": 0})
        self.assertIsNone(unknown["affected_people"])
        self.assertEqual(zero["affected_people"], 0)
        self.assertEqual(classify_risk("Alagamento", 3, None), (49, "Moderado"))


class ClassificationTests(unittest.TestCase):
    def test_risk_rises_with_severity_and_people(self):
        low_score, low_level = classify_risk("Alagamento", 1, 0)
        high_score, high_level = classify_risk("Alagamento", 5, 20)
        self.assertLess(low_score, high_score)
        self.assertIn(low_level, {"Baixo", "Moderado", "Alto", "Crítico"})
        self.assertIn(high_level, {"Baixo", "Moderado", "Alto", "Crítico"})
        self.assertLessEqual(high_score, 100)

    def test_invalid_risk_inputs_are_rejected(self):
        for values in (("Inexistente", 2, 1), ("Incêndio", 0, 1), ("Incêndio", 3, -1)):
            with self.subTest(values=values), self.assertRaises(ValidationError):
                classify_risk(*values)

    def test_confidence_reflects_provenance_and_review(self):
        community = calculate_confidence("community")
        official = calculate_confidence("official")
        reviewed = calculate_confidence("community", evidence_count=2, corroborations=1, verified=True)
        self.assertLess(community, official)
        self.assertGreater(reviewed, community)
        self.assertTrue(0 <= reviewed <= 100)

    def test_invalid_confidence_inputs_are_rejected(self):
        with self.assertRaises(ValidationError):
            calculate_confidence("unknown")
        with self.assertRaises(ValidationError):
            calculate_confidence("community", evidence_count=-1)


class StateTests(unittest.TestCase):
    def test_main_path_and_discard_branch(self):
        path = (
            "Registrado",
            "Em validação",
            "Confirmado",
            "Alerta emitido",
            "Em monitoramento",
            "Encerrado",
        )
        for current, target in zip(path, path[1:]):
            with self.subTest(current=current, target=target):
                self.assertTrue(can_transition(current, target, "agente"))
        self.assertTrue(can_transition("Em validação", "Descartado", "gestor"))

    def test_unauthorized_and_skipped_transitions_are_forbidden(self):
        self.assertFalse(can_transition("Registrado", "Em validação", "morador"))
        self.assertFalse(can_transition("Registrado", "Alerta emitido", "agente"))
        self.assertFalse(can_transition("Encerrado", "Alerta emitido", "gestor"))


if __name__ == "__main__":
    unittest.main()
