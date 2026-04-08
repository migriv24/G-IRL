"""
Provider manager — holds the active provider and handles switching.
"""

import logging
from .base import BaseProvider, ProviderConfig
from .ollama import OllamaProvider
from .anthropic_provider import AnthropicProvider
from .openai_compat import OpenAICompatProvider

logger = logging.getLogger(__name__)

PROVIDER_MAP = {
    "ollama": OllamaProvider,
    "anthropic": AnthropicProvider,
    "openai": OpenAICompatProvider,
    "deepseek": OpenAICompatProvider,
    "groq": OpenAICompatProvider,
}


class ProviderManager:
    def __init__(self):
        self._providers: dict[str, BaseProvider] = {}
        self._active: str = "ollama"

        # Default Ollama (no key needed)
        self.add_provider(ProviderConfig(name="ollama"))

    def add_provider(self, config: ProviderConfig):
        cls = PROVIDER_MAP.get(config.name)
        if cls is None:
            raise ValueError(f"Unknown provider: '{config.name}'. Available: {list(PROVIDER_MAP.keys())}")
        self._providers[config.name] = cls(config)
        logger.info(f"[ProviderManager] Configured provider: '{config.name}' model='{config.model}'")

    def set_active(self, name: str):
        if name not in self._providers:
            raise KeyError(f"Provider '{name}' not configured. Add it first.")
        self._active = name
        logger.info(f"[ProviderManager] Active provider set to: '{name}'")

    @property
    def active(self) -> BaseProvider:
        return self._providers[self._active]

    @property
    def active_name(self) -> str:
        return self._active

    def get(self, name: str) -> BaseProvider:
        return self._providers[name]

    async def status(self) -> dict:
        result = {}
        for name, provider in self._providers.items():
            result[name] = {
                "active": name == self._active,
                "model": provider.config.model,
                "healthy": await provider.health_check(),
            }
        return result


provider_manager = ProviderManager()
