const fs = require('fs');
let code = fs.readFileSync('backend/routes/deliveries.js', 'utf-8');
const searchStr = "const Supplier = require('../models/Supplier');";
if (code.indexOf(searchStr) === -1 || code.indexOf(searchStr) > 500) {
  code = code.replace(
    "const Delivery = require('../models/Delivery');", 
    "const Delivery = require('../models/Delivery');\nconst Supplier = require('../models/Supplier');"
  );
  fs.writeFileSync('backend/routes/deliveries.js', code);
  console.log('Added Supplier require to top of file');
} else {
  console.log('Already required at top');
}
