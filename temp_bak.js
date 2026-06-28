const fs = require('fs');
const code = fs.readFileSync('c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js.bak', 'utf8');
const start = code.indexOf('<form onSubmit={handleSaveDelivery}>');
console.log(code.substring(start + 2500, start + 7000));
