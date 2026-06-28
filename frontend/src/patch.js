const fs = require('fs');

// Patch AdminDashboard.js
const adminFile = 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/AdminDashboard.js';
let adminCode = fs.readFileSync(adminFile, 'utf8');

const adminSearch = `                          </div>
                        )}
                      </div>

        <WalkinManagerAssignModal `;

const adminReplace = `                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {idx === 0 && <div style={{ fontSize: 11, height: 16, marginBottom: 6 }}>&nbsp;</div>}
                        {items.length > 1 && (
                          <button type="button" onClick={() => onChangeItems(items.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}><X size={16} /></button>
                        )}
                      </div>

                    </div>
                  ))}</>
    );
  };

  return (
    <div>
      {showWalkinManagerModal && (
        <WalkinManagerAssignModal `;

if (adminCode.includes(adminSearch)) {
  adminCode = adminCode.replace(adminSearch, adminReplace);
  
  // also fix the stray \n  return (
  adminCode = adminCode.replace(/\\n  return \(/, '  return (');

  fs.writeFileSync(adminFile, adminCode);
  console.log('AdminDashboard.js patched.');
} else {
  console.log('AdminDashboard search string not found.');
}

// Patch ManagerDashboard.js
const mgrFile = 'c:/Users/Dell/OneDrive/Desktop/mk_enterprise/frontend/src/pages/ManagerDashboard.js';
let mgrCode = fs.readFileSync(mgrFile, 'utf8');

const mgrSearch = `                          </div>
                        )}
  };
  \\n  return (
    <div>`;

const mgrReplace = `                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {idx === 0 && <div style={{ fontSize: 11, height: 16, marginBottom: 6 }}>&nbsp;</div>}
                        {items.length > 1 && (
                          <button type="button" onClick={() => onChangeItems(items.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}><X size={16} /></button>
                        )}
                      </div>

                    </div>
                  ))}</>
    );
  };

  return (
    <div>`;

if (mgrCode.includes(mgrSearch)) {
  mgrCode = mgrCode.replace(mgrSearch, mgrReplace);
  
  // also fix the stray \n  return ( if any
  mgrCode = mgrCode.replace(/\\n  return \(/, '  return (');

  fs.writeFileSync(mgrFile, mgrCode);
  console.log('ManagerDashboard.js patched.');
} else {
  console.log('ManagerDashboard search string not found.');
}
