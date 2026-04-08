from .builtin import register_builtin_commands
from .generate import register_generate_command

def register_all_commands():
    register_builtin_commands()
    register_generate_command()
