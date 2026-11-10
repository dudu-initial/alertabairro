"""Validate client-reported AI assistance; it is not verified evidence."""
import math
from .domain import ValidationError

MODEL = "Xenova/clip-vit-base-patch32"
REVISION = "6b7c523703ae26e39be4b03774966f8571c7f523"
SUPPORTED_TYPES = {"Alagamento", "Incêndio", "Deslizamento", "Queda de árvore"}


def validate_assistance(value, occurrence_type):
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValidationError("Sugestão de IA inválida.")
    allowed = {"model", "revision", "suggested_type", "score", "margin", "human_confirmed"}
    if set(value) != allowed or value.get("model") != MODEL or value.get("revision") != REVISION:
        raise ValidationError("Modelo de análise de imagem não reconhecido.")
    if value.get("human_confirmed") is not True:
        raise ValidationError("Confirme a sugestão antes de enviar o relato.")
    if not isinstance(value.get("suggested_type"), str) or value["suggested_type"] not in SUPPORTED_TYPES or value["suggested_type"] != occurrence_type:
        raise ValidationError("A sugestão da IA deve corresponder ao tipo confirmado no relato.")
    for key, minimum in (("score", 0.60), ("margin", 0.15)):
        number = value.get(key)
        if isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or not minimum <= number <= 1:
            raise ValidationError("Pontuação da sugestão inválida ou inconclusiva.")
    if value["margin"] > value["score"]:
        raise ValidationError("Pontuação da sugestão inconsistente.")
    return {key: value[key] for key in allowed}
