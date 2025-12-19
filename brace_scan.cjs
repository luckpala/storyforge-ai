const ts = require('typescript');
const source = ts.sys.readFile('components/StoryBoard.tsx');
const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.JSX, source);
const stack = [];
while (true) {
  const token = scanner.scan();
  if (token === ts.SyntaxKind.EndOfFileToken) break;
  if (token === ts.SyntaxKind.OpenBraceToken) {
    stack.push(scanner.getStartPos());
  } else if (token === ts.SyntaxKind.CloseBraceToken) {
    if (!stack.length) {
      console.log('extra closing brace at pos', scanner.getStartPos());
    } else {
      stack.pop();
    }
  }
}
console.log('unmatched open count', stack.length);
const sf = ts.createSourceFile('components/StoryBoard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
stack.slice(-10).forEach(pos => {
  const { line, character } = sf.getLineAndCharacterOfPosition(pos);
  console.log('unmatched open at line', line + 1, 'char', character + 1);
});
