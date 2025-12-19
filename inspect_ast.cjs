const ts = require('typescript');
const source = ts.sys.readFile('components/StoryBoard.tsx');
const sf = ts.createSourceFile('components/StoryBoard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const stmt = sf.statements[8];
const decl = stmt.declarationList.declarations[0];
const body = decl.initializer.body;
body.statements.forEach((s, idx) => {
  const { line } = sf.getLineAndCharacterOfPosition(s.pos);
  console.log(idx, 'line', line + 1, ts.SyntaxKind[s.kind]);
});
