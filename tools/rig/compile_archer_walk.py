"""Pack reviewed archer walk bodies and the equipped-bow gripping hand."""
from pathlib import Path
from compile_knight_walk import compile_walks

if __name__ == '__main__':
    compile_walks(Path(__file__).with_name('archer-walk'))
