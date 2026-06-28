const fs = require('fs');
const filePath = 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/DailyReport.js';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/borderRadius: 10, padding: '12px 14px'/g, "borderRadius: 8, padding: '8px 10px'");
content = content.replace(/marginTop: 4/g, "marginTop: 2");
fs.writeFileSync(filePath, content);
console.log("Replaced successfully");
