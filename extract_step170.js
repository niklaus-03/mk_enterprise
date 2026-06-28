const fs = require('fs');
const transcript = fs.readFileSync('C:\\Users\\Dell\\.gemini\\antigravity\\brain\\d6bc97fe-879e-43d9-bc4b-f062cc5b401e\\.system_generated\\logs\\transcript_full.jsonl', 'utf-8');
const lines = transcript.split('\n');
lines.forEach(l => {
  if (l.includes('"step_index":170')) {
    const data = JSON.parse(l);
    data.tool_calls.forEach(t => {
      console.log('--- Tool:', t.name);
      if(t.args && t.args.CodeContent) {
        console.log('CodeContent found');
      }
      if(t.args && t.args.ReplacementContent) {
        console.log('ReplacementContent:', t.args.ReplacementContent.substring(0, 1000));
      }
      if(t.args && t.args.CommandLine) {
        console.log('CommandLine:', t.args.CommandLine.substring(0, 1000));
      }
    });
  }
});
