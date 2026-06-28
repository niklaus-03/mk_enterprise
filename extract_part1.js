const fs = require('fs');
const code = fs.readFileSync('c:/Users/Dell/OneDrive/Desktop/mk_enterprise/patch_frontend_deliveries.js', 'utf8');
const searchIndex = code.indexOf('oldEffect');
if (searchIndex !== -1) {
    console.log(code.substring(searchIndex - 100, searchIndex + 1500));
} else {
    console.log("No oldEffect found");
}
