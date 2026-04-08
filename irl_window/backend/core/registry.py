"""
Module registry. Each backend module registers itself here on startup.
Commands look up modules via registry to route events.
"""

from typing import Any
import logging

logger = logging.getLogger(__name__)


class ModuleRegistry:
    def __init__(self):
        self._modules: dict[str, Any] = {}

    def register(self, name: str, module: Any):
        self._modules[name] = module
        logger.info(f"[Registry] Registered module: '{name}'")

    def get(self, name: str) -> Any:
        if name not in self._modules:
            raise KeyError(f"Module '{name}' not registered")
        return self._modules[name]

    def all(self) -> dict[str, Any]:
        return dict(self._modules)

    def names(self) -> list[str]:
        return list(self._modules.keys())


registry = ModuleRegistry()
