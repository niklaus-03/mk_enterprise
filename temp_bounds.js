const fs = require('fs');
const code = fs.readFileSync('c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js.bak', 'utf8');

const start = code.indexOf('<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>\\n                  {deliveryForm.items.map'.replace(/"/g, "'"));
const end = code.indexOf('Notes</label>', start);

console.log(code.substring(start - 200, end + 100));
