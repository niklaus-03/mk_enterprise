const fs = require('fs');

const files = [
  'frontend/src/pages/CustomerPaymentHistory.js',
  'frontend/src/pages/AdminDashboard.js',
  'frontend/src/pages/ManagerDashboard.js'
];

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix CustomerPaymentHistory UI
  const targetHistory = `<div style={{ width: 18, height: 18, borderRadius: 10, border: \\\`1px solid \\\${isSelected ? '#22c55e' : '#cbd5e1'}\\\`, background: isSelected ? '#22c55e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                              {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}></div>}
                            </div>`;
  const replacementHistory = `<div style={{ width: 18, height: 18, borderRadius: 4, border: \\\`1px solid \\\${isSelected ? '#22c55e' : '#cbd5e1'}\\\`, background: isSelected ? '#22c55e' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                              {isSelected && <div style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</div>}
                            </div>`;

  if (content.includes(`<div style={{ width: 18, height: 18, borderRadius: 10`)) {
    content = content.replace(
      /<div style=\{\{ width: 18, height: 18, borderRadius: 10, border: `1px solid \$\{isSelected \? '#22c55e' : '#cbd5e1'\}`/g,
      `<div style={{ width: 18, height: 18, borderRadius: 4, border: \`1px solid \${isSelected ? '#22c55e' : '#cbd5e1'}\``
    );
    content = content.replace(
      /\{isSelected && <div style=\{\{ width: 8, height: 8, borderRadius: '50%', background: '#fff' \}\}><\/div>\}/g,
      `{isSelected && <div style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>✓</div>}`
    );
  }

  // Ensure AdminDashboard / ManagerDashboard has the correct font size for the checkmark
  content = content.replace(
    /\{isSelected && <div style=\{\{ color: '#fff', fontSize: 12 \}\}>✓<\/div>\}/g,
    `{isSelected && <div style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>✓</div>}`
  );

  fs.writeFileSync(file, content);
  console.log('Patched UI in', file);
}
