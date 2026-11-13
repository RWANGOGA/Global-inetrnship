"""DeepL translation adapter — the concrete TranslationClient for production.

Implements the ``TranslationClient`` port. It reads the key from settings
(never hardcoded) and raises ``TranslationNotConfigured`` — before any network call —
when the key is missing, so the app stays healthy until you opt in.
"""
from typing import Optional

from app.application.ports import TranslationClient
from app.core.config import Settings, get_settings
from app.core.errors import TranslationNotConfigured


class DeepLTranslationClient(TranslationClient):
    def __init__(self, settings: Optional[Settings] = None) -> None:
        s = settings or get_settings()
        self._api_key = s.deepl_api_key
        self._base_url = "https://api-free.deepl.com/v2"
        self._client = None
        if self._api_key:
            import httpx
            self._client = httpx.AsyncClient(
                headers={"Authorization": f"DeepL-Auth-Key {self._api_key}"},
                timeout=30.0,
            )

    async def translate(self, text: str, target_lang: str, source_lang: str = "auto") -> str:
        if self._client is None:
            raise TranslationNotConfigured(
                "DeepL translation is not configured. Set DEEPL_API_KEY in backend/.env.local."
            )
        
        if not text or not text.strip():
            return text
            
        # DeepL uses uppercase language codes
        target_lang = target_lang.upper()
        if source_lang != "auto":
            source_lang = source_lang.upper()
        
        response = await self._client.post(
            f"{self._base_url}/translate",
            data={
                "text": text,
                "target_lang": target_lang,
                **({"source_lang": source_lang} if source_lang != "auto" else {}),
            },
        )
        response.raise_for_status()
        result = response.json()
        translations = result.get("translations", [])
        if translations:
            return translations[0].get("text", text)
        return text

    async def detect_language(self, text: str) -> str:
        if self._client is None:
            raise TranslationNotConfigured(
                "DeepL translation is not configured. Set DEEPL_API_KEY in backend/.env.local."
            )
        
        response = await self._client.post(
            f"{self._base_url}/translate",
            data={
                "text": text[:500],  # Only need sample for detection
                "target_lang": "EN",
            },
        )
        response.raise_for_status()
        result = response.json()
        translations = result.get("translations", [])
        if translations:
            return translations[0].get("detected_source_language", "EN").lower()
        return "en"

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()