"""Pure business rules for community reports and the alert life cycle."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


TYPES = (
    "Alagamento",
    "Deslizamento",
    "Incêndio",
    "Queda de árvore",
    "Falta de energia",
    "Outro",
)
STATUSES = (
    "Registrado",
    "Em validação",
    "Confirmado",
    "Alerta emitido",
    "Em monitoramento",
    "Encerrado",
    "Descartado",
)
RISKS = ("Baixo", "Moderado", "Alto", "Crítico")
TRANSITIONS = {
    "Registrado": ("Em validação", "Descartado"),
    "Em validação": ("Confirmado", "Descartado"),
    "Confirmado": ("Alerta emitido", "Descartado"),
    "Alerta emitido": ("Em monitoramento",),
    "Em monitoramento": ("Encerrado",),
    "Encerrado": (),
    "Descartado": (),
}
TRANSITION_EVENTS = {
    ("Registrado", "Em validação"): "Agente assume a triagem",
    ("Registrado", "Descartado"): "Triagem identifica relato inválido ou duplicado",
    ("Em validação", "Confirmado"): "Agente verifica evidências e confirma",
    ("Em validação", "Descartado"): "Evidências não sustentam o relato",
    ("Confirmado", "Alerta emitido"): "Agente publica aviso à comunidade",
    ("Confirmado", "Descartado"): "Nova evidência invalida a ocorrência",
    ("Alerta emitido", "Em monitoramento"): "Equipe inicia acompanhamento",
    ("Em monitoramento", "Encerrado"): "Risco cessou e equipe encerra o caso",
}


class ValidationError(ValueError):
    """Invalid user supplied occurrence or transition data."""


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def validate_occurrence(payload: dict[str, Any]) -> dict[str, Any]:
    """Return normalized report fields or raise ``ValidationError``.

    Free-text fields are bounded to prevent oversized records and keep the
    dashboard legible. A precise street address is optional for safety and
    inclusiveness; the neighborhood is mandatory.
    """
    if not isinstance(payload, dict):
        raise ValidationError("A ocorrência deve ser um objeto JSON.")
    title = _clean_text(payload.get("title"))
    description = _clean_text(payload.get("description"))
    neighborhood = _clean_text(payload.get("neighborhood"))
    address = _clean_text(payload.get("address"))
    occurrence_type = _clean_text(payload.get("type"))
    if not 8 <= len(title) <= 120:
        raise ValidationError("O título deve conter entre 8 e 120 caracteres.")
    if occurrence_type not in TYPES:
        raise ValidationError("Selecione um tipo de ocorrência válido.")
    if not 20 <= len(description) <= 2000:
        raise ValidationError("A descrição deve conter entre 20 e 2000 caracteres.")
    if not 2 <= len(neighborhood) <= 100:
        raise ValidationError("Informe um bairro com 2 a 100 caracteres.")
    if len(address) > 180:
        raise ValidationError("O endereço pode ter no máximo 180 caracteres.")
    severity_input = payload.get("severity", 3)
    try:
        if isinstance(severity_input, float) and not severity_input.is_integer():
            raise ValueError
        severity = int(severity_input)
    except (ValueError, TypeError):
        raise ValidationError("A gravidade deve ser um número de 1 a 5.") from None
    if isinstance(severity_input, bool) or severity not in range(1, 6):
        raise ValidationError("A gravidade deve ser um número de 1 a 5.")
    affected_input = payload.get("affected_people", 0)
    try:
        if isinstance(affected_input, float) and not affected_input.is_integer():
            raise ValueError
        affected_people = int(affected_input)
    except (ValueError, TypeError):
        raise ValidationError("O número de pessoas afetadas deve ser inteiro.") from None
    if isinstance(affected_input, bool) or not 0 <= affected_people <= 100000:
        raise ValidationError("O número de pessoas afetadas deve estar entre 0 e 100000.")
    coords = {}
    for key, limit in (("latitude", 90), ("longitude", 180)):
        value = payload.get(key)
        if value in (None, ""):
            coords[key] = None
            continue
        try:
            value = float(value)
        except (ValueError, TypeError):
            raise ValidationError(f"{key} inválida.") from None
        if not -limit <= value <= limit:
            raise ValidationError(f"{key} fora do intervalo permitido.")
        coords[key] = value
    occurred_at = payload.get("occurred_at")
    if occurred_at in (None, ""):
        occurred_at = None
    else:
        if not isinstance(occurred_at, str):
            raise ValidationError("Data da ocorrência inválida.")
        try:
            parsed = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            occurred_at = parsed.astimezone(timezone.utc).isoformat(timespec="seconds")
        except ValueError:
            raise ValidationError("Data da ocorrência inválida.") from None
        if parsed > datetime.now(timezone.utc):
            raise ValidationError("A data da ocorrência não pode estar no futuro.")
    return {
        "title": title,
        "type": occurrence_type,
        "description": description,
        "neighborhood": neighborhood,
        "address": address,
        "severity": severity,
        "affected_people": affected_people,
        "latitude": coords["latitude"],
        "longitude": coords["longitude"],
        "occurred_at": occurred_at,
    }


def classify_risk(occurrence_type: str, severity: int, affected_people: int) -> tuple[int, str]:
    """Classify a report using a transparent, bounded score (0–100)."""
    if occurrence_type not in TYPES or not 1 <= severity <= 5 or affected_people < 0:
        raise ValidationError("Parâmetros de risco inválidos.")
    base = {
        "Alagamento": 25,
        "Deslizamento": 45,
        "Incêndio": 40,
        "Queda de árvore": 25,
        "Falta de energia": 15,
        "Outro": 10,
    }[occurrence_type]
    score = min(100, base + severity * 8 + min(20, affected_people * 2))
    if score <= 34:
        level = "Baixo"
    elif score <= 59:
        level = "Moderado"
    elif score <= 79:
        level = "Alto"
    else:
        level = "Crítico"
    return score, level


def calculate_confidence(
    source_kind: str,
    evidence_count: int = 0,
    corroborations: int = 0,
    age_hours: float = 0,
    verified: bool = False,
) -> int:
    """Return explainable confidence; agent review supplements source provenance.

    This is a heuristic for prioritizing review, not a probability of truth.
    """
    bases = {"community": 35, "external": 60, "official": 85}
    if source_kind not in bases or evidence_count < 0 or corroborations < 0 or age_hours < 0:
        raise ValidationError("Parâmetros de confiança inválidos.")
    recency = 10 if age_hours <= 24 else 5 if age_hours <= 72 else 0
    return min(
        100,
        bases[source_kind]
        + min(15, evidence_count * 5)
        + min(20, corroborations * 10)
        + recency
        + (20 if verified else 0),
    )


def can_transition(current: str, target: str, role: str) -> bool:
    """Only trained roles can change state, and only along allowed edges."""
    return role in {"agente", "gestor"} and target in TRANSITIONS.get(current, ())
