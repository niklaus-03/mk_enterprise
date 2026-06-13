const fs = require('fs');
let css = fs.readFileSync('frontend/src/App.css', 'utf8');

const badString = '.pg-workspace {\\n  display: flex;\\n  flex: 1;\\n  overflow: hidden;\\n  padding: 16px 0 80px 0;\\n  gap: 20px;\\n}\\n.pg-category-sidebar {\\n  width: 200px;\\n  overflow-y: auto;\\n  display: flex;\\n  flex-direction: column;\\n  gap: 8px;\\n  flex-shrink: 0;\\n  border-right: 1px solid var(--border);\\n  padding-right: 12px;\\n}\\n.pg-product-grid {\\n  flex: 1;\\n  overflow-y: auto;\\n  display: grid;\\n  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));\\n  grid-auto-rows: max-content;\\n  gap: 16px;\\n  align-content: start;\\n  padding: 16px;\\n  background: var(--bg);\\n  border-radius: 16px;\\n}';

const goodString = `.pg-workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 16px 0 80px 0;
  gap: 20px;
}
.pg-category-sidebar {
  width: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding-right: 12px;
}
.pg-product-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-auto-rows: max-content;
  gap: 16px;
  align-content: start;
  padding: 16px;
  background: var(--bg);
  border-radius: 16px;
}`;

css = css.replace(badString, goodString);
fs.writeFileSync('frontend/src/App.css', css);
console.log('Fixed literal newlines in App.css');
