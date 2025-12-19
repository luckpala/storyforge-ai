const fs = require('fs');
const text = fs.readFileSync('components/StoryBoard.tsx', 'utf8');
const stack = [];
let mode = null;
let escape = false;
for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  if (mode) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === mode) {
      mode = null;
    }
    continue;
  }
  if (ch === '\"' || ch === "'" || ch === '') {
    mode = ch;
    continue;
  }
  if (ch === '{') {
    stack.push(i);
  } else if (ch === '}') {
    if (!stack.length) {
      console.log('extra closing brace at', i);
      process.exit(0);
    }
    stack.pop();
  }
}
if (stack.length) {
  console.log('unmatched openings:', stack.length);
  const pos = stack[stack.length - 1];
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  console.log('last unmatched line', line);
} else {
  console.log('all balanced');
}
