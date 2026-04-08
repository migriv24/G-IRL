"""
Ollama provider — local inference via HTTP API.
"""

import httpx
import json
import logging
from typing import AsyncIterator
from .base import BaseProvider, ProviderConfig

logger = logging.getLogger(__name__)


class OllamaProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        if not config.base_url:
            config.base_url = "http://localhost:11434"
        if not config.model:
            config.model = "llama3.2:1b"
        super().__init__(config)

    async def complete(self, prompt: str, system: str = "") -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            resp = await client.post(
                f"{self.config.base_url}/api/chat",
                json={"model": self.config.model, "messages": messages, "stream": False}
            )
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]

    async def stream(self, prompt: str, system: str = "") -> AsyncIterator[str]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.config.base_url}/api/chat",
                json={"model": self.config.model, "messages": messages, "stream": True}
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                    except json.JSONDecodeError:
                        continue

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.config.base_url}/api/tags")
                return resp.status_code == 200
        except Exception as e:
            logger.warning(f"[Ollama] Health check failed: {e}")
            return False
