"""Presidio DLP Wrapper for PromptWall.

Provides a lazy-loaded, multi-language DLP engine.
"""

from __future__ import annotations

import contextlib
import logging
from typing import Any

logger = logging.getLogger("promptwall.dlp")


class PresidioWrapper:
    """Singleton wrapper for Presidio Analyzer and Anonymizer engines."""

    _instance: PresidioWrapper | None = None

    def __init__(self) -> None:
        self._analyzer: Any = None
        self._anonymizer: Any = None
        self._initialized: bool = False
        self._enabled: bool = False

    @classmethod
    def get_instance(cls) -> PresidioWrapper:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _initialize(self) -> None:
        if self._initialized:
            return

        try:
            from presidio_analyzer import AnalyzerEngine
            from presidio_analyzer.nlp_engine import NlpEngineProvider
            from presidio_anonymizer import AnonymizerEngine

            # Configure multi-language support (English and generic multi-language)
            configuration = {
                "nlp_engine_name": "spacy",
                "models": [
                    {"lang_code": "en", "model_name": "en_core_web_sm"},
                    {"lang_code": "xx", "model_name": "xx_ent_wiki_sm"},
                ],
            }
            try:
                provider = NlpEngineProvider(nlp_configuration=configuration)
                nlp_engine = provider.create_engine()
                # We register en and xx as supported languages
                self._analyzer = AnalyzerEngine(
                    nlp_engine=nlp_engine, supported_languages=["en", "xx"]
                )
            except Exception as e:
                logger.warning("Could not load NLP models (run 'promptwall dlp install'): %s", e)
                # Fallback to default analyzer (English only, requires en_core_web_sm)
                self._analyzer = AnalyzerEngine()

            self._anonymizer = AnonymizerEngine()
            self._enabled = True
        except ImportError:
            logger.warning("Presidio not installed. DLP will be disabled.")
            self._enabled = False
        except Exception as e:
            logger.error("Failed to initialize Presidio: %s", e)
            self._enabled = False

        self._initialized = True

    def analyze(self, text: str, entities: list[str]) -> list[Any]:
        """Analyze text for specific PII entities.

        Since we support multiple languages, we first try English (en).
        If the language isn't english, Presidio doesn't auto-detect lang.
        For best effort, we can run both 'en' and 'xx' and merge results.
        """
        self._initialize()
        if not self._enabled or not self._analyzer:
            return []

        # Analyze using both configured languages for maximum coverage
        results = []
        try:
            res_en = self._analyzer.analyze(text=text, entities=entities, language="en")
            results.extend(res_en)
        except Exception as e:
            logger.debug("DLP analysis error (en): %s", e)

        with contextlib.suppress(Exception):
            res_xx = self._analyzer.analyze(text=text, entities=entities, language="xx")
            results.extend(res_xx)

        from presidio_analyzer.analyzer_engine import AnalyzerEngine

        # Deduplicate overlapping spans
        # The analyzer_engine has a helper function _remove_duplicates, but it's private in some versions
        # Let's just return results, Presidio usually handles overlaps well on anonymize step,
        # or we can write a simple deduplicator. The _remove_duplicates is sometimes available.
        with contextlib.suppress(Exception):
            results = (
                AnalyzerEngine.remove_duplicates_results(results)
                if hasattr(AnalyzerEngine, "remove_duplicates_results")
                else results
            )

        return results

    def anonymize(self, text: str, analyzer_results: list[Any]) -> str:
        """Anonymize text based on analyzer results."""
        self._initialize()
        if not self._enabled or not self._anonymizer or not analyzer_results:
            return text

        try:
            # We use default operators, which replaces entity with <ENTITY_TYPE>
            result = self._anonymizer.anonymize(
                text=text,
                analyzer_results=analyzer_results,
            )
            return str(result.text)
        except Exception as e:
            logger.error("DLP anonymization error: %s", e)
            return text
