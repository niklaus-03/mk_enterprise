const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPanel.js', 'utf8');

function wrap(startSearch, endSearch) {
    const s = code.indexOf(startSearch);
    if (s === -1) { console.log('NOT FOUND: ' + startSearch.substring(0, 50)); return; }
    const e = code.indexOf(endSearch, s) + endSearch.length;
    const before = code.slice(0, s);
    const middle = code.slice(s, e);
    const after = code.slice(e);
    
    code = before + '<div className="hide-scroll" style={{ overflowX: \'auto\', width: \'100%\' }}><div style={{ minWidth: 900 }}>\n' + middle + '\n</div></div>' + after;
    console.log('WRAPPED: ' + startSearch.substring(0, 50));
}

// 1. Managers
wrap(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 180px 100px'",
    "))\n          )}\n        </div>"
);

// 2. Drivers
wrap(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 100px'",
    "))\n          )}\n        </div>"
);

// 3. Activity Logs
wrap(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 140px minmax(200px, 1fr)'",
    "))}\n              </div>\n            )}\n          </div>"
);

// 4. Trip Bypass
wrap(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 120px 150px minmax(180px, 1fr)'",
    "))\n            )}"
);

// 5. Password Requests
wrap(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 150px 100px minmax(180px, 1fr)'",
    "))\n            )}"
);

fs.writeFileSync('src/pages/AdminPanel.js', code);
