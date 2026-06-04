const fs = require('fs');
const path = require('path');

const outerDir = __dirname;
const innerDir = path.join(outerDir, 'mk_enterprise');

if (fs.existsSync(innerDir)) {
  const items = fs.readdirSync(innerDir);
  for (const item of items) {
    const srcPath = path.join(innerDir, item);
    const destPath = path.join(outerDir, item);
    
    // If the file/folder already exists in the outer directory, we can overwrite or skip.
    // For package.json, we probably want to overwrite with the inner one if it exists? Wait, inner doesn't have a package.json at root, it has backend and frontend.
    // Let's just move everything.
    if (fs.existsSync(destPath)) {
      if (fs.statSync(destPath).isDirectory()) {
         fs.rmSync(destPath, { recursive: true, force: true });
      } else {
         fs.unlinkSync(destPath);
      }
    }
    
    fs.renameSync(srcPath, destPath);
    console.log(`Moved ${item}`);
  }
  
  // Now remove the inner directory
  fs.rmdirSync(innerDir);
  console.log('Successfully merged and deleted the inner mk_enterprise folder.');
} else {
  console.log('Inner mk_enterprise folder not found.');
}
