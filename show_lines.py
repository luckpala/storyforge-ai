from pathlib import Path
lines = Path('components/StoryBoard.tsx').read_text(encoding='utf-8').splitlines()
for i in range(118, 158):
    line = lines[i-1]
    if '{' in line or '}' in line:
        print(i, line)
