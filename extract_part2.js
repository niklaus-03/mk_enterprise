const fs = require('fs');
const code = fs.readFileSync('c:/Users/Dell/OneDrive/Desktop/mk_enterprise/patch_frontend_deliveries_part2.js', 'utf8');
console.log(code.substring(code.indexOf('const newCode = `') + 17, code.indexOf('`;', code.indexOf('const newCode = `'))));
