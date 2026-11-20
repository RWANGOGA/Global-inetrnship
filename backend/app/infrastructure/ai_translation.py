"""AI-powered translation adapter using Groq (LLM).

Implements the ``TranslationClient`` port so chat translations are done by an
AI model instead of a dedicated translation API. Falls back gracefully when no
Groq key is configured.
"""
import json
from typing import Optional

import groq

from app.application.ports import TranslationClient
from app.core.config import get_settings
from app.core.errors import TranslationNotConfigured


class AITranslationClient(TranslationClient):
    def __init__(self) -> None:
        s = get_settings()
        self._api_key = s.groq_api_key
        self._model = s.groq_model or "llama-3.3-70b-versatile"
        self._client = None
        if self._api_key:
            self._client = groq.AsyncGroq(api_key=self._api_key)

    async def translate(self, text: str, target_lang: str, source_lang: str = "auto") -> str:
        if self._client is None:
            raise TranslationNotConfigured(
                "AI translation is not configured. Set GROQ_API_KEY in backend/.env.local."
            )
        if not text or not text.strip():
            return text

        source_hint = "" if source_lang == "auto" else f" The source language is {source_lang}."
        prompt = (
            f"Translate the following message into {target_lang}.{source_hint} "
            "Return ONLY the translated text, with no explanations, quotes, or "
            "extra formatting. Preserve line breaks and emoji.\n\n"
            f"{text}"
        )
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": "You are a precise translation engine."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=1024,
            )
            translated = response.choices[0].message.content or ""
            translated = translated.strip()
            return translated or text
        except Exception:
            return text

    async def detect_language(self, text: str) -> str:
        if self._client is None:
            raise TranslationNotConfigured(
                "AI translation is not configured. Set GROQ_API_KEY in backend/.env.local."
            )
        if not text or not text.strip():
            return "en"
        prompt = (
            "Detect the language of the following text and reply with ONLY the "
            "ISO 639-1 two-letter code (lowercase), nothing else.\n\n"
            f"{text[:500]}"
        )
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": "You are a language detector."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
                max_tokens=8,
            )
            code = (response.choices[0].message.content or "").strip().lower()
            if len(code) == 2 and code.isalpha():
                return code
            return "en"
        except Exception:
            return "en"

    async def close(self) -> None:
        return None
