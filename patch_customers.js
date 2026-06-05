const fs = require('fs');
const file = 'backend/routes/customers.js';

let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Initialize manager_balances with the creator's balance\s*if \(initialBalance !== 0\) \{\s*customerData\.manager_balances = \[\{ manager_id: req\.user\.id, balance: initialBalance \}\];\s*\}/g;

const replacement = `// Initialize manager_balances with the creator's balance
    if (initialBalance !== 0) {
      customerData.manager_balances = [{ manager_id: customerData.created_by, balance: initialBalance }];
    }`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
  console.log("Successfully patched customers.js");
} else {
  console.log("Target regex not found in customers.js");
}
