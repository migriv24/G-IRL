"""
Base provider interface. All LLM providers implement this.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class ProviderConfig:
    name: str           # e.g. "ollama", "anthropic", "openai", "deepseek"
    base_url: str = ""
    api_key: str = ""
    model: str = ""
    timeout: int = 120


class BaseProvider(ABC):
    def __init__(self, config: ProviderConfig):
        self.config = config

    @property
    def name(self) -> str:
        return self.config.name

    @abstractmethod
    async def complete(self, prompt: str, system: str = "") -> str:
        """Single completion, returns full response string."""
        ...

    @abstractmethod
    async def stream(self, prompt: str, system: str = "") -> AsyncIterator[str]:
        """Streaming completion, yields text chunks."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Returns True if provider is reachable and ready."""
        ...

    async def list_models(self) -> list[str]:
        """Return installed/available model names for this provider.
        Override in providers that support model enumeration.
        """
        return []
