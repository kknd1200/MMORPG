"""Pack reviewed mage/priest walking bodies and their equipped-item hand sockets."""
from pathlib import Path
from compile_knight_walk import compile_walks

if __name__ == '__main__':
    compile_walks(Path(__file__).with_name('caster-walk'))
