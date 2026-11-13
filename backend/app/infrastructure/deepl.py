"""DeepL adapter — the concrete VoiceClient for production.

Implements the ``VoiceClient`` port. It reads the key from settings
(never hardcoded) and raises ``VoiceNotConfigured`` — before any network call —
when the key is missing, so the app stays healthy until you opt in.
"""
from typing import Optional
from dataclasses import dataclass

from app.application.ports import VoiceClient
from app.core.config import Settings, get_settings
from app.core.errors import VoiceNotConfigured


@dataclass
class VoiceOptions:
    lang: str = "EN-US"
    voice: str = "default"
    speed: float = 1.0


class DeepLClient(VoiceClient):
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

    async def text_to_speech(self, text: str, options: VoiceOptions = VoiceOptions()) -> bytes:
        if self._client is None:
            raise VoiceNotConfigured(
                "DeepL voice is not configured. Set DEEPL_API_KEY in backend/.env.local."
            )
        
        response = await self._client.post(
            f"{self._base_url}/tts",
            json={
                "text": text,
                "target_lang": options.lang,
                "voice": options.voice,
                "speed": options.speed,
            },
        )
        response.raise_for_status()
        return response.content

    async def speech_to_text(self, audio_data: bytes, options: VoiceOptions = VoiceOptions()) -> str:
        if self._client is None:
            raise VoiceNotConfigured(
                "DeepL voice is not configured. Set DEEPL_API_KEY in backend/.env.local."
            )
        
        files = {"audio": ("recording.webm", audio_data, "audio/webm")}
        data = {"target_lang": options.lang}
        
        response = await self._client.post(
            f"{self._base_url}/stt",
            files=files,
            data=data,
        )
        response.raise_for_status()
        result = response.json()
        return result.get("text", "")

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()