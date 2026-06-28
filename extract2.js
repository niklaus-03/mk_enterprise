const fs = require('fs');
const transcript = fs.readFileSync('C:\\Users\\Dell\\.gemini\\antigravity\\brain\\d6bc97fe-879e-43d9-bc4b-f062cc5b401e\\.system_generated\\logs\\transcript_full.jsonl', 'utf-8');
const lines = transcript.split('\n');
lines.forEach(l => {
  if (l.includes('"step_index":170')) {
    const data = JSON.parse(l);
    data.tool_calls.forEach(t => {
      if(t.args && t.args.CodeContent) {
        fs.writeFileSync('C:\\Users\\Dell\\OneDrive\\Desktop\\mk_enterprise\\original_items_script.js', t.args.CodeContent);
        console.log('Saved to original_items_script.js');
      }
    });
  }
});
