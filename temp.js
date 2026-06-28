const fs = require('fs');
const code = fs.readFileSync('c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js', 'utf8');
const idx = code.indexOf('Please select at least one supplier');
console.log(code.substring(idx - 1500, idx + 500));
