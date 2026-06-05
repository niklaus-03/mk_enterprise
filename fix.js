const fs = require('fs');

let content = fs.readFileSync('frontend/src/pages/AdminDashboard.js', 'utf8');

const searchStr = `              </button>

              <SortDropdown`;

const replaceStr = `              </button>

              <button
                className="btn btn-warning btn-sm"
                onClick={() => setShowWalkinModal(true)}
              >
                <UserCheck size={13} style={{ marginRight: 4 }} /> Walk-in Delivery
              </button>

              <SortDropdown`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.js', content);
  console.log('Success exact match');
} else if (content.includes(searchStr.replace(/\r\n/g, '\n'))) {
  content = content.replace(searchStr.replace(/\r\n/g, '\n'), replaceStr.replace(/\r\n/g, '\n'));
  fs.writeFileSync('frontend/src/pages/AdminDashboard.js', content);
  console.log('Success LF match');
} else {
  console.log('Not found at all');
}
