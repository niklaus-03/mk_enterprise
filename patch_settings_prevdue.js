const fs = require('fs');

// Patch Settings.js
const settingsFile = 'frontend/src/pages/Settings.js';
let settingsContent = fs.readFileSync(settingsFile, 'utf8');

const targetSettings = `{radioGroup('discount_enabled', [`;
const repSettings = `{admin?.role !== 'temp_manager' && radioGroup('customize_prev_due_enabled', [
                    { value: true, title: '✅ Show Customize Previous Due', desc: 'Allow managers to selectively include/exclude past invoices when printing new bills.' },
                    { value: false, title: '❌ Hide Customize Previous Due', desc: 'Strictly enforce the system-calculated previous due without allowing manual edits.' }
                  ], 'Customize Previous Due')}

                  {radioGroup('discount_enabled', [`;

if (!settingsContent.includes('customize_prev_due_enabled')) {
  settingsContent = settingsContent.replace(targetSettings, repSettings);
  fs.writeFileSync(settingsFile, settingsContent);
  console.log("Patched Settings.js");
}

// Patch NewInvoice.js
const newInvoiceFile = 'frontend/src/pages/NewInvoice.js';
let newInvoiceContent = fs.readFileSync(newInvoiceFile, 'utf8');

const targetState = `const discountEnabled = settings.discount_enabled !== false;`;
const repState = `const discountEnabled = settings.discount_enabled !== false;
  const customizePrevDueEnabled = settings.customize_prev_due_enabled !== false;`;

if (!newInvoiceContent.includes('const customizePrevDueEnabled')) {
  newInvoiceContent = newInvoiceContent.replace(targetState, repState);
}

// Find where the block is rendered in NewInvoice.js
const targetRender = `{['supervisor', 'manager', 'walkin_manager'].includes(user?.role) && prevBalance > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>`;
const repRender = `{['supervisor', 'manager', 'walkin_manager'].includes(user?.role) && prevBalance > 0 && customizePrevDueEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>`;

newInvoiceContent = newInvoiceContent.replace(targetRender, repRender);
fs.writeFileSync(newInvoiceFile, newInvoiceContent);
console.log("Patched NewInvoice.js");

