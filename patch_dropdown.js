const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf-8');

code = code.replace(
  '<div style={{ position: \\\'relative\\\' }}>\\n                        <div \\n                          onClick={() => setShowLowStockMenu(!showLowStockMenu)}',
  `<div style={{ position: 'relative' }}>
                        <div 
                          onClick={() => setShowLowStockMenu(!showLowStockMenu)}`
);

fs.writeFileSync('frontend/src/pages/AdminDashboard.js', code);
