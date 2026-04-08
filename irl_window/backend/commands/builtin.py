"""
Built-in command nodes. These are registered on startup.
Each command is a node in the command graph.
"""

from backend.core import graph, Command, CommandResult
from backend.modules.providers import provider_manager, ProviderConfig, PROVIDER_MAP
import logging

logger = logging.getLogger(__name__)


async def cmd_help(args: list[str], piped: any) -> CommandResult:
    return CommandResult(success=True, output={
        "type": "table",
        "columns": ["command", "description", "usage"],
        "rows": [[c["name"], c["description"], c["usage"]] for c in graph.help_text()]
    })


async def cmd_status(args: list[str], piped: any) -> CommandResult:
    status = await provider_manager.status()
    rows = []
    for name, info in status.items():
        rows.append([
            name,
            info["model"],
            "ACTIVE" if info["active"] else "",
            "OK" if info["healthy"] else "UNREACHABLE",
        ])
    return CommandResult(success=True, output={
        "type": "table",
        "columns": ["provider", "model", "active", "health"],
        "rows": rows,
    })


async def cmd_provider(args: list[str], piped: any) -> CommandResult:
    """
    provider list               — list configured providers
    provider set <name>         — switch active provider
    provider add <name> [--key KEY] [--model MODEL] [--url URL]
    """
    if not args:
        return CommandResult(success=False, error="Usage: provider <list|set|add> ...")

    sub = args[0]

    if sub == "list":
        return await cmd_status([], None)

    elif sub == "set":
        if len(args) < 2:
            return CommandResult(success=False, error="Usage: provider set <name>")
        try:
            provider_manager.set_active(args[1])
            return CommandResult(success=True, output={"type": "text", "text": f"Active provider set to '{args[1]}'"})
        except KeyError as e:
            return CommandResult(success=False, error=str(e))

    elif sub == "add":
        if len(args) < 2:
            return CommandResult(success=False, error="Usage: provider add <name> [--key KEY] [--model MODEL] [--url URL]")
        name = args[1]
        config = ProviderConfig(name=name)

        i = 2
        while i < len(args):
            if args[i] == "--key" and i + 1 < len(args):
                config.api_key = args[i + 1]; i += 2
            elif args[i] == "--model" and i + 1 < len(args):
                config.model = args[i + 1]; i += 2
            elif args[i] == "--url" and i + 1 < len(args):
                config.base_url = args[i + 1]; i += 2
            else:
                i += 1

        try:
            provider_manager.add_provider(config)
            return CommandResult(success=True, output={"type": "text", "text": f"Provider '{name}' configured."})
        except ValueError as e:
            return CommandResult(success=False, error=str(e))

    return CommandResult(success=False, error=f"Unknown subcommand: '{sub}'")


async def cmd_ping(args: list[str], piped: any) -> CommandResult:
    provider = provider_manager.active
    healthy = await provider.health_check()
    text = f"[{provider.name}] {'OK — reachable' if healthy else 'UNREACHABLE'}"
    return CommandResult(success=healthy, output={"type": "text", "text": text})


async def cmd_echo(args: list[str], piped: any) -> CommandResult:
    text = " ".join(args) if args else (str(piped) if piped else "")
    return CommandResult(success=True, output={"type": "text", "text": text})


def register_builtin_commands():
    commands = [
        Command(
            name="help",
            description="List all available commands",
            usage="help",
            handler=cmd_help,
            output_type="table",
        ),
        Command(
            name="status",
            description="Show provider health and active model",
            usage="status",
            handler=cmd_status,
            output_type="table",
        ),
        Command(
            name="provider",
            description="Manage LLM providers (list, set, add)",
            usage="provider <list|set|add> [options]",
            handler=cmd_provider,
        ),
        Command(
            name="ping",
            description="Ping the active provider to check connectivity",
            usage="ping",
            handler=cmd_ping,
            output_type="text",
        ),
        Command(
            name="echo",
            description="Echo text (useful for testing pipes)",
            usage="echo <text>",
            handler=cmd_echo,
            output_type="text",
        ),
    ]
    for cmd in commands:
        graph.register(cmd)
    logger.info(f"[Commands] Registered {len(commands)} built-in commands")
