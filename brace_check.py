from pathlib import Path
text = Path('components/StoryBoard.tsx').read_text(encoding='utf-8')
stack = []
in_string = None
escape = False
for idx, ch in enumerate(text):
    if in_string:
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == in_string:
            in_string = None
        continue
    if ch in "'\"":
        in_string = ch
        continue
    if ch == '{':
        stack.append(idx)
    elif ch == '}':
        if stack:
            stack.pop()
        else:
            print('extra closing at', idx)
            break
else:
    if stack:
        for pos in stack[-5:]:
            line = text.count('\n', 0, pos) + 1
            print('unmatched open at line', line)
    else:
        print('all balanced')
