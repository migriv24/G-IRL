"""
Command graph. Commands are nodes. Each command:
  - Has a name and description
  - Declares input/output types (its ports)
  - Can pipe output into another command's input
  - Executes via the event bus

Commands are registered here and invoked by the terminal panel.
"""

import asyncio
from typing import Callable, Any
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class CommandResult:
    success: bool
    output: Any = None
    error: str = None
    # If set, this result is piped into the next command
    pipe_to: str = None


@dataclass
class Command:
    name: str
    description: str
    usage: str
    handler: Callable
    # Port declarations (what this command accepts/emits)
    input_type: str = "any"
    output_type: str = "any"


class CommandGraph:
    def __init__(self):
        self._commands: dict[str, Command] = {}

    def register(self, command: Command):
        self._commands[command.name] = command
        logger.debug(f"[CommandGraph] Registered command: '{command.name}'")

    def get(self, name: str) -> Command | None:
        return self._commands.get(name)

    def all_names(self) -> list[str]:
        return sorted(self._commands.keys())

    def help_text(self) -> list[dict]:
        return [
            {"name": cmd.name, "description": cmd.description, "usage": cmd.usage}
            for cmd in sorted(self._commands.values(), key=lambda c: c.name)
        ]

    async def execute(self, raw_input: str, piped_input: Any = None) -> CommandResult:
        """
        Parse and execute a command string.
        Supports pipes: 'cmd_a arg | cmd_b'
        """
        parts = [p.strip() for p in raw_input.split("|")]
        result = CommandResult(success=True, output=piped_input)

        for part in parts:
            if not part:
                continue
            tokens = part.split()
            cmd_name = tokens[0].lower()
            args = tokens[1:]

            cmd = self._commands.get(cmd_name)
            if cmd is None:
                return CommandResult(
                    success=False,
                    error=f"Unknown command: '{cmd_name}'. Type 'help' for available commands."
                )

            try:
                if asyncio.iscoroutinefunction(cmd.handler):
                    result = await cmd.handler(args, result.output)
                else:
                    result = cmd.handler(args, result.output)
            except Exception as e:
                logger.error(f"[CommandGraph] Error executing '{cmd_name}': {e}")
                return CommandResult(success=False, error=str(e))

            if not result.success:
                return result

        return result


graph = CommandGraph()
