"""
Anthropic provider — Claude models via Anthropic SDK.
"""

import logging
from typing import AsyncIterator
from .base import BaseProvider, ProviderConfig

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        if not config.model:
            config.model = "claude-sonnet-4-6"
        super().__init__(config)
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.AsyncAnthropic(api_key=self.config.api_key)
            except ImportError:
                raise RuntimeError("anthropic package not installed. Run: pip install anthropic")
        return self._client

    async def complete(self, prompt: str, system: str = "") -> str:
        client = self._get_client()
        kwargs = {
            "model": self.config.model,
            "max_tokens": 2048,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system

        msg = await client.messages.create(**kwargs)
        return msg.content[0].text

    async def stream(self, prompt: str, system: str = "") -> AsyncIterator[str]:
        client = self._get_client()
        kwargs = {
            "model": self.config.model,
            "max_tokens": 2048,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system

        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text

    async def health_check(self) -> bool:
        if not self.config.api_key:
            return False
        try:
            client = self._get_client()
            # Minimal test call
            await client.messages.create(
                model=self.config.model,
                max_tokens=5,
                messages=[{"role": "user", "content": "hi"}]
            )
            return True
        except Exception as e:
            logger.warning(f"[Anthropic] Health check failed: {e}")
            return False
