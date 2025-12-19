from pathlib import Path
lines = Path('components/StoryBoard.tsx').read_text(encoding='utf-8').splitlines()
for idx in range(2045, 2052):
    print(idx+1, repr(lines[idx]))
