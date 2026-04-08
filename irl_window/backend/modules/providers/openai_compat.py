"""
OpenAI-compatible provider — covers OpenAI, DeepSeek, Groq, any OpenAI-API-compatible endpoint.
Set base_url to swap providers (e.g. https://api.deepseek.com/v1).
"""

import logging
from typing import AsyncIterator
from .base import BaseProvider, ProviderConfig

logger = logging.getLogger(__name__)


class OpenAICompatProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        if not config.base_url:
            config.base_url = "https://api.openai.com/v1"
        if not config.model:
            config.model = "gpt-4o-mini"
        super().__init__(config)
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(
                    api_key=self.config.api_key,
                    base_url=self.config.base_url,
                )
            except ImportError:
                raise RuntimeError("openai package not installed. Run: pip install openai")
        return self._client

    async def complete(self, prompt: str, system: str = "") -> str:
        client = self._get_client()
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = await client.chat.completions.create(
            model=self.config.model,
            messages=messages,
        )
        return resp.choices[0].message.content

    async def stream(self, prompt: str, system: str = "") -> AsyncIterator[str]:
        client = self._get_client()
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        stream = await client.chat.completions.create(
            model=self.config.model,
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def health_check(self) -> bool:
        if not self.config.api_key:
            return False
        try:
            client = self._get_client()
            await client.chat.completions.create(
                model=self.config.model,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=5,
            )
            return True
        except Exception as e:
            logger.warning(f"[OpenAICompat] Health check failed: {e}")
            return False
