const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'VehicleIncoming.js');
let code = fs.readFileSync(filePath, 'utf-8');

const startStr = `  const normalizeDelivery = (d) => ({`;
const endStr = `  });`;

const startIdx = code.indexOf(startStr);
if (startIdx !== -1) {
  const endIdx = code.indexOf(endStr, startIdx) + endStr.length;
  
  const newNormalize = `  const normalizeDelivery = (d) => {
    const allItems = (d.items || []).concat((d.suppliers_data || []).flatMap(s => s.items || []));
    const allSuppliers = (d.suppliers_data && d.suppliers_data.length > 0) 
      ? d.suppliers_data.map(s => s.supplier_name).join(', ') 
      : (d.supplier || '');

    return {
      _id: d._id,
      source: 'delivery',
      vehicle_number: d.vehicle_number || '—',
      driver_name: d.driver_name || '',
      supplier: allSuppliers,
      type: d.delivery_type || (d.vehicle_number?.toUpperCase().includes('WALK') ? 'walkin' : 'incoming'),
      expected_arrival: d.expected_arrival,
      expected_arrival_ist: d.expected_arrival_ist || '',
      arrival_date_ist: d.arrival_date_ist || getTodayIST(),
      items: allItems,
      status: d.status,
      delivered_at_ist: d.delivered_at_ist || '',
      link: \`/vehicle/\${d._id}\`,
      payment_status: d.payment_status || 'unpaid',
      created_by: d.created_by ? (d.created_by.display_name || d.created_by.username) : '',
    };
  };`;

  code = code.slice(0, startIdx) + newNormalize + code.slice(endIdx);
  fs.writeFileSync(filePath, code);
  console.log('VehicleIncoming.js patched successfully!');
} else {
  console.log('Could not find start string.');
}
