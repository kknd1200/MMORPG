"""Pack reviewed warrior walking pixels and both weapon-grip hand patches."""
from pathlib import Path
from compile_knight_walk import compile_walks

if __name__ == '__main__':
    compile_walks(Path(__file__).with_name('warrior-walk'))
