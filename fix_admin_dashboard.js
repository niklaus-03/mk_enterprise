const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'AdminDashboard.js');
let code = fs.readFileSync(filePath, 'utf-8');

// I will add a useEffect to sync selectedSuppliers with deliveryForm.suppliers_data
const searchStr = `  const [selectedSuppliers, setSelectedSuppliers] = useState([]);`;
const idx = code.indexOf(searchStr);

if (idx !== -1) {
  const insertStr = `
  useEffect(() => {
    setDeliveryForm(f => {
      let updated = [...(f.suppliers_data || [])];
      // Remove any that are no longer in selectedSuppliers
      updated = updated.filter(s => selectedSuppliers.includes(s.supplier_name));
      // Add any new ones
      selectedSuppliers.forEach(name => {
        if (!updated.find(s => s.supplier_name === name)) {
          updated.push({
            supplier_id: '',
            supplier_name: name,
            items: [{ item_name: '', quantity: '0', unit: 'unit', product_id: '', label: 'Goods' }],
            cash_given: ''
          });
        }
      });
      return { ...f, suppliers_data: updated };
    });
  }, [selectedSuppliers]);
`;
  
  if (!code.includes('useEffect(() => {') || !code.includes('updated = updated.filter(s => selectedSuppliers.includes')) {
      code = code.slice(0, idx + searchStr.length) + insertStr + code.slice(idx + searchStr.length);
      fs.writeFileSync(filePath, code);
      console.log('Fixed selectedSuppliers sync in AdminDashboard.js!');
  } else {
      console.log('Already fixed.');
  }
} else {
  console.log('Could not find selectedSuppliers state definition in AdminDashboard.js');
}
