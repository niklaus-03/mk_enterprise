const fs = require('fs');
let code = fs.readFileSync('backend/routes/deliveries.js', 'utf-8');
const searchStr = "const Settlement = require('../models/Settlement');";
if (code.indexOf(searchStr) === -1 || code.indexOf(searchStr) > 500) {
  code = code.replace(
    "const Delivery = require('../models/Delivery');", 
    "const Delivery = require('../models/Delivery');\nconst Settlement = require('../models/Settlement');"
  );
  fs.writeFileSync('backend/routes/deliveries.js', code);
  console.log('Added Settlement require to top of file');
} else {
  console.log('Already required at top');
}
