const fs = require('fs');

let code = fs.readFileSync('src/pages/AdminPanel.js', 'utf8');

function wrapGrid(headerStart, tableEnd) {
    let s = code.indexOf(headerStart);
    if (s === -1) {
        console.error('Header not found:\n' + headerStart.slice(0, 50));
        return;
    }
    
    let e = code.indexOf(tableEnd, s);
    if (e === -1) {
        console.error('Table end not found:\n' + tableEnd);
        return;
    }
    e += tableEnd.length;

    let before = code.slice(0, s);
    let middle = code.slice(s, e);
    let after = code.slice(e);

    code = before + '<div className="hide-scroll" style={{ overflowX: \'auto\', width: \'100%\' }}>\n<div style={{ minWidth: 900 }}>\n' + middle + '\n</div>\n</div>' + after;
    console.log('Wrapped successfully!');
}

wrapGrid(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 180px 100px'",
    "))\n          )}\n        </div>"
);

wrapGrid(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px 100px'",
    "))\n          )}\n        </div>"
);

wrapGrid(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 140px minmax(200px, 1fr)'",
    "))}\n              </div>\n            )}\n          </div>"
);

wrapGrid(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 120px 150px minmax(180px, 1fr)'",
    "))\n            )}"
);

wrapGrid(
    "<div style={{ background: '#f8fafc', padding: '12px 24px', display: 'grid', gridTemplateColumns: '150px 180px 150px 100px minmax(180px, 1fr)'",
    "))\n            )}"
);

fs.writeFileSync('src/pages/AdminPanel.js', code);
