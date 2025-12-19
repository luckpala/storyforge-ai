from pathlib import Path
lines = Path('components/StoryBoard.tsx').read_text(encoding='utf-8').splitlines()
print(repr(lines[2045]))
