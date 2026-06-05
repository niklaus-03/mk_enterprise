const fs = require('fs');
const file = 'backend/routes/payments.js';

let content = fs.readFileSync(file, 'utf8');

const targetStart = `    // IF there is still 'paid' remaining, and we used specific invoices, we should cascade to OTHER unpaid invoices!`;
const targetEnd = `    // Remaining amount becomes advance`;

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + `    // Remaining amount becomes advance` + content.substring(endIndex + targetEnd.length);
  fs.writeFileSync(file, content);
  console.log("Successfully reverted cascade in payments.js");
} else {
  console.log("Could not find cascade logic to remove");
}
