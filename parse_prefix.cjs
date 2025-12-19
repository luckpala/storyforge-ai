const fs = require('fs');
const ts = require('typescript');
const lines = fs.readFileSync('components/StoryBoard.tsx','utf8').split(/\r?\n/);
const N = parseInt(process.argv[2],10);
const subset = lines.slice(0,N).join('\n') + '\n};\n';
const sf = ts.createSourceFile('subset.tsx', subset, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diag = sf.parseDiagnostics[0];
if (diag) {
  const { line, character } = sf.getLineAndCharacterOfPosition(diag.start);
  console.log('error line', line + 1, 'char', character + 1, diag.messageText.toString());
} else {
  console.log('no parse error for first', N, 'lines');
}
