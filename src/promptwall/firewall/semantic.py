from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal

Severity = Literal["high", "critical"]

_DIRECTIVE_LANGUAGE = re.compile(
    r"\byou\s+(must|should|will|need to|have to|shall|are now)\b"
    r"|(?:^|[.!?,;:]\s*)(please\s+)?(ignore|disregard|forget|override|bypass|"
    r"reveal|print|output|send|email|post|upload|execute|delete|act|pretend|"
    r"become|assume|disable|comply|obey|follow)\b",
    re.MULTILINE,
)

_AI_META_REFERENCE = re.compile(
    r"\b(instructions?|system prompt|prompts?|rules?|guidelines?|directives?|"
    r"restrictions?|programming|training data|your training)\b"
)

_AUTHORITY_OVERRIDE = re.compile(
    r"\b(no matter what|regardless of|without (any )?restrictions?|"
    r"new (instructions?|rules?|directives?)|override(s|d|n|ing)?|supersedes?|"
    r"from now on|original (programming|instructions?))\b"
)


_ONNX_SESSION = None
_TOKENIZER = None


def _get_ml_components() -> tuple[Any, Any]:
    global _ONNX_SESSION, _TOKENIZER
    if _ONNX_SESSION is None or _TOKENIZER is None:
        try:
            import onnxruntime as ort  # type: ignore
            from huggingface_hub import hf_hub_download  # type: ignore
            from tokenizers import Tokenizer  # type: ignore

            repo_id = "protectai/deberta-v3-base-prompt-injection-v2"
            onnx_path = hf_hub_download(repo_id=repo_id, filename="onnx/model.onnx")
            tokenizer_path = hf_hub_download(repo_id=repo_id, filename="tokenizer.json")

            _ONNX_SESSION = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
            _TOKENIZER = Tokenizer.from_file(tokenizer_path)
        except ImportError:
            pass  # Fallback to rule-based only if dependencies missing
    return _ONNX_SESSION, _TOKENIZER


@dataclass(frozen=True)
class SemanticFinding:
    matched_categories: tuple[str, ...]
    severity: Severity | None  # None means "not suspicious enough to flag"


def score_content(normalized_content: str) -> SemanticFinding:
    categories: list[str] = []
    if _DIRECTIVE_LANGUAGE.search(normalized_content):
        categories.append("directive-language")
    if _AI_META_REFERENCE.search(normalized_content):
        categories.append("ai-meta-reference")
    if _AUTHORITY_OVERRIDE.search(normalized_content):
        categories.append("authority-override")

    # Evaluate ML Model
    session, tokenizer = _get_ml_components()
    is_ml_injection = False

    if session and tokenizer:
        import numpy as np  # type: ignore

        encoding = tokenizer.encode(normalized_content)
        input_ids = np.array([encoding.ids], dtype=np.int64)
        attention_mask = np.array([encoding.attention_mask], dtype=np.int64)

        ort_inputs = {
            session.get_inputs()[0].name: input_ids,
            session.get_inputs()[1].name: attention_mask,
        }

        for inp in session.get_inputs():
            if inp.name == "token_type_ids":
                ort_inputs[inp.name] = np.array([encoding.type_ids], dtype=np.int64)

        ort_outs = session.run(None, ort_inputs)
        logits = ort_outs[0][0]

        # Softmax
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / exp_logits.sum()

        # ProtectAI models return label 1 as injection
        injection_prob = float(probs[1])
        if injection_prob > 0.999999 and "[redacted]" not in normalized_content:
            is_ml_injection = True
            categories.append("ml-prompt-injection")

    has_override = "authority-override" in categories
    has_support = "directive-language" in categories or "ai-meta-reference" in categories

    severity: Severity | None = None
    if has_override and "directive-language" in categories and "ai-meta-reference" in categories:
        severity = "critical"
    elif has_override and has_support:
        severity = "high"

    if is_ml_injection and not severity:
        severity = "high"

    return SemanticFinding(matched_categories=tuple(categories), severity=severity)
