const fs = require('fs');
const files = ['c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js', 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/ManagerDashboard.js'];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  // Replace \\` with `
  code = code.replace(/\\`/g, '`');
  // Replace \\$ with $
  code = code.replace(/\\\$/g, '$');
  
  fs.writeFileSync(file, code);
  console.log('Fixed ' + file);
}
