from pathlib import Path
text = Path('components/StoryBoard.tsx').read_text(encoding='utf-8')
for i, ch in enumerate(text):
    if ch == '}':
        line = text.count('\n', 0, i) + 1
        if 140 <= line <= 155:
            print(line, ord(ch))
