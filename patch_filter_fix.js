const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

const targetStr = "setDeliveryForm(f => ({ ...f, suppliers_data: f.suppliers_data.filter((_, i) => i !== idx) }));";

if (code.includes(targetStr)) {
  code = code.replace(targetStr, "// Removed redundant and dangerous setDeliveryForm that caused filter on undefined. useEffect handles this.");
  fs.writeFileSync(filePath, code);
  console.log('Successfully patched AdminDashboard.js to fix the undefined filter error.');
} else {
  console.log('Could not find the target string in AdminDashboard.js');
}
