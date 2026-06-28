const fs = require('fs');

const files = [
  'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js',
  'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/ManagerDashboard.js'
];

for (let file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  // Replace literal backslash-n before return
  // We can just replace the literal string "\n"
  code = code.replace(/\\n/g, '\n');
  
  fs.writeFileSync(file, code);
  console.log('Fixed literal \\n in ' + file);
}
