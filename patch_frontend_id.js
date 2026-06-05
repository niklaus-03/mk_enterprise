const fs = require('fs');

const patchFrontendId = () => {
  const file = 'frontend/src/pages/CustomerPaymentHistory.js';
  let content = fs.readFileSync(file, 'utf8');

  // Replace 'OPENING_BALANCE' with '000000000000000000000000'
  content = content.replace(/'OPENING_BALANCE'/g, "'000000000000000000000000'");

  fs.writeFileSync(file, content);
  console.log("Replaced OPENING_BALANCE with fake object ID in CustomerPaymentHistory.js");
};

patchFrontendId();
