const fs = require('fs');

const drPath = 'frontend/src/pages/DailyReport.js';
let drCode = fs.readFileSync(drPath, 'utf8');

// 1. Add vehicle_expense to DailyReport.js state
drCode = drCode.replace(
  `const [quickForm, setQuickForm] = useState({ customer_name: '', supplier_name: '', expense_for: '', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });`,
  `const [quickForm, setQuickForm] = useState({ customer_name: '', supplier_name: '', expense_for: '', expense_category: 'Fuel', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });`
);

// 2. Add vehicle_expense to quickExpenses sum
drCode = drCode.replace(
  `const quickExpenses = quickEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);`,
  `const quickExpenses = quickEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);\n  const quickVehicleExpenses = quickEntries.filter(e => e.type === 'vehicle_expense').reduce((sum, e) => sum + e.amount, 0);`
);

drCode = drCode.replace(
  `const totalExpenses = quickExpenses;`,
  `const totalExpenses = quickExpenses + quickVehicleExpenses;`
);

// 3. Add to validation
drCode = drCode.replace(
  `if (quickFormType === 'expense' && !quickForm.expense_for.trim()) return toast.error(t('Expense details required', 'खर्च का विवरण आवश्यक है'));`,
  `if (quickFormType === 'expense' && !quickForm.expense_for.trim()) return toast.error(t('Expense details required', 'खर्च का विवरण आवश्यक है'));\n    if (quickFormType === 'vehicle_expense' && !quickForm.expense_for.trim()) return toast.error(t('Vehicle expense details required', 'वाहन खर्च का विवरण आवश्यक है'));`
);

// 4. Update entry creation
drCode = drCode.replace(
  `expense_for: quickForm.expense_for.trim(),`,
  `expense_for: quickFormType === 'vehicle_expense' ? \`[Vehicle - \${quickForm.expense_category}] \${quickForm.expense_for.trim()}\` : quickForm.expense_for.trim(),`
);

drCode = drCode.replace(
  `setQuickForm({ customer_name: '', supplier_name: '', expense_for: '', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });`,
  `setQuickForm({ customer_name: '', supplier_name: '', expense_for: '', expense_category: 'Fuel', product_name: '', product_price: 0, quantity: 1, amount: 0, notes: '', is_paid: true });`
);

// 5. Update Quick Entries List UI rendering
drCode = drCode.replace(
  `background: entry.type === 'bill' ? 'var(--primary-light)' : entry.type === 'payment_in' ? 'var(--success-light)' : entry.type === 'expense' ? 'var(--warning-light)' : 'var(--danger-light)',`,
  `background: entry.type === 'bill' ? 'var(--primary-light)' : entry.type === 'payment_in' ? 'var(--success-light)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning-light)' : 'var(--danger-light)',`
);

drCode = drCode.replace(
  `color: entry.type === 'bill' ? 'var(--primary)' : entry.type === 'payment_in' ? 'var(--success)' : entry.type === 'expense' ? 'var(--warning)' : 'var(--danger)',`,
  `color: entry.type === 'bill' ? 'var(--primary)' : entry.type === 'payment_in' ? 'var(--success)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning)' : 'var(--danger)',`
);

drCode = drCode.replace(
  `{entry.type === 'bill' ? t('BILL', 'बिल') : entry.type === 'payment_in' ? t('PAYMENT IN', 'भुगतान प्राप्त') : entry.type === 'expense' ? t('EXPENSE', 'खर्च') : t('PAYMENT OUT', 'भुगतान किया')}`,
  `{entry.type === 'bill' ? t('BILL', 'बिल') : entry.type === 'payment_in' ? t('PAYMENT IN', 'भुगतान प्राप्त') : entry.type === 'vehicle_expense' ? t('VEHICLE EXPENSE', 'वाहन खर्च') : entry.type === 'expense' ? t('EXPENSE', 'खर्च') : t('PAYMENT OUT', 'भुगतान किया')}`
);

// Second list occurrence
drCode = drCode.replace(
  `background: entry.type === 'bill' ? 'var(--primary-light)' : entry.type === 'payment_in' ? 'var(--success-light)' : entry.type === 'expense' ? 'var(--warning-light)' : 'var(--danger-light)',`,
  `background: entry.type === 'bill' ? 'var(--primary-light)' : entry.type === 'payment_in' ? 'var(--success-light)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning-light)' : 'var(--danger-light)',`
);

drCode = drCode.replace(
  `color: entry.type === 'bill' ? 'var(--primary)' : entry.type === 'payment_in' ? 'var(--success)' : entry.type === 'expense' ? 'var(--warning)' : 'var(--danger)',`,
  `color: entry.type === 'bill' ? 'var(--primary)' : entry.type === 'payment_in' ? 'var(--success)' : ['expense', 'vehicle_expense'].includes(entry.type) ? 'var(--warning)' : 'var(--danger)',`
);

drCode = drCode.replace(
  `{entry.type === 'bill' ? t('Bill', 'बिल') : entry.type === 'payment_in' ? t('Payment In', 'पेमेंट इन') : entry.type === 'expense' ? t('Expense', 'खर्च') : t('Payment Out', 'पेमेंट आउट')}`,
  `{entry.type === 'bill' ? t('Bill', 'बिल') : entry.type === 'payment_in' ? t('Payment In', 'पेमेंट इन') : entry.type === 'vehicle_expense' ? t('Vehicle Expense', 'वाहन खर्च') : entry.type === 'expense' ? t('Expense', 'खर्च') : t('Payment Out', 'पेमेंट आउट')}`
);


// 6. Update type selector buttons
drCode = drCode.replace(
  `{ key: 'expense', label: t('Expense', 'खर्च'), icon: <Coffee size={13} /> },`,
  `{ key: 'expense', label: t('Expense', 'खर्च'), icon: <Coffee size={13} /> },
                  ...(user?.role === 'walkin_manager' ? [{ key: 'vehicle_expense', label: 'Vehicle Expense', icon: <Truck size={13} /> }] : [])`
);

// 7. Update quick form input block
const oldExpenseInput = `{quickFormType === 'expense' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{t('What was this expense for?', 'यह खर्च किस लिए था?')}</div>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder={t("e.g. Tea, Office supplies", "उदा. चाय, ऑफिस का सामान")}
                      value={quickForm.expense_for}
                      onChange={e => setQuickForm({ ...quickForm, expense_for: e.target.value })}
                    />
                  </div>
                )}`;

const newExpenseInput = `{['expense', 'vehicle_expense'].includes(quickFormType) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {quickFormType === 'vehicle_expense' ? t('What was this vehicle expense for?', 'यह वाहन खर्च किस लिए था?') : t('What was this expense for?', 'यह खर्च किस लिए था?')}
                    </div>
                    {quickFormType === 'vehicle_expense' && (
                      <select 
                        className="form-control"
                        value={quickForm.expense_category}
                        onChange={e => setQuickForm({ ...quickForm, expense_category: e.target.value })}
                        style={{ marginBottom: 10 }}
                      >
                        <option value="Fuel">Fuel</option>
                        <option value="Food">Food</option>
                        <option value="Challan">Challan</option>
                        <option value="Service">Service</option>
                        <option value="Other">Other</option>
                      </select>
                    )}
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder={quickFormType === 'vehicle_expense' ? t('e.g. Petrol pump name, reason', 'उदा. पेट्रोल पंप का नाम, कारण') : t('e.g. Tea, Office supplies', 'उदा. चाय, ऑफिस का सामान')}
                      value={quickForm.expense_for}
                      onChange={e => setQuickForm({ ...quickForm, expense_for: e.target.value })}
                    />
                  </div>
                )}`;

drCode = drCode.replace(oldExpenseInput, newExpenseInput);

fs.writeFileSync(drPath, drCode, 'utf8');
console.log('DailyReport.js patched');

const reportsPath = 'backend/routes/reports.js';
let repCode = fs.readFileSync(reportsPath, 'utf8');

// Update reports.js for vehicle_expense
const expenseBlock = `} else if (type === 'expense') {
          const amt = Number(amount) || 0;
          await Settlement.create({
            party_name: entry.expense_for || 'Expense',
            type: 'other_expense',
            amount: amt,
            date: entryDate,
            notes: entry.notes ? \`\${entry.expense_for}: \${entry.notes}\` : \`\${entry.expense_for}\`,
            created_by
          });
        }`;

const vehicleExpenseBlock = `} else if (type === 'expense') {
          const amt = Number(amount) || 0;
          await Settlement.create({
            party_name: entry.expense_for || 'Expense',
            type: 'other_expense',
            amount: amt,
            date: entryDate,
            notes: entry.notes ? \`\${entry.expense_for}: \${entry.notes}\` : \`\${entry.expense_for}\`,
            created_by
          });
        } else if (type === 'vehicle_expense') {
          const amt = Number(amount) || 0;
          await Settlement.create({
            party_name: entry.expense_for || 'Vehicle Expense',
            type: 'vehicle_expense',
            amount: amt,
            date: entryDate,
            notes: entry.notes ? \`\${entry.expense_for}: \${entry.notes}\` : \`\${entry.expense_for}\`,
            created_by
          });
        }`;

repCode = repCode.replace(expenseBlock, vehicleExpenseBlock);

// Update logic to return stock to global inventory
const walkinLogicStart = `// Handle Walk-in Manager logic`;
const oldWalkinLogic = `// Handle Walk-in Manager logic
    if (req.user.role === 'walkin_manager') {
      const admin = await Admin.findById(req.user.id);
      if (admin && admin.is_trip_active) {
        // Fetch final remaining stock
        const remainingProducts = await Product.find({ created_by: req.user.id, stock: { $gt: 0 } });
        const finalStock = remainingProducts.map(p => ({
          product_id: p._id,
          quantity: p.stock
        }));

        // Mark trip completed
        const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
        if (trip) {
          trip.status = 'completed';
          trip.completed_at = new Date();
          trip.final_stock = finalStock;
          trip.total_sales_amount = system_sales_reported || 0;
          await trip.save();
        }

        admin.is_trip_active = false;
        admin.active_vehicle_number = '';
        admin.active_driver_name = '';
        admin.active_destination = '';
        await admin.save();

        // Reset all stock for this manager to 0
        await Product.updateMany({ created_by: req.user.id }, { stock: 0 });
      }
    }`;

const newWalkinLogic = `// Handle Walk-in Manager logic
    if (req.user.role === 'walkin_manager') {
      const admin = await Admin.findById(req.user.id);
      if (admin && admin.is_trip_active) {
        // Fetch final remaining stock
        const remainingProducts = await Product.find({ created_by: req.user.id, stock: { $gt: 0 } });
        const finalStock = remainingProducts.map(p => ({
          product_id: p._id,
          quantity: p.stock
        }));

        const supervisor = await Admin.findOne({ role: 'supervisor' });

        // Return unsold stock to global inventory
        if (supervisor) {
          const StockMovement = require('../models/StockMovement');
          for (const p of remainingProducts) {
            if (p.stock > 0) {
              const globalProduct = await Product.findOne({ name: p.name, created_by: supervisor._id });
              if (globalProduct) {
                const globalStockBefore = globalProduct.stock;
                globalProduct.stock += p.stock;
                await globalProduct.save();

                await StockMovement.create({
                  product_id: globalProduct._id,
                  product_name: globalProduct.name,
                  created_by: req.user.id,
                  type: 'incoming',
                  qty: p.stock,
                  stock_before: globalStockBefore,
                  stock_after: globalProduct.stock,
                  reference: \`Returned unsold stock by \${req.user.username || 'Manager'}\`,
                  notes: \`Returned from vehicle \${admin.active_vehicle_number} at end of trip\`,
                  source: 'trip_completion',
                  vehicle_number: admin.active_vehicle_number,
                  driver_name: admin.active_driver_name,
                  ist_formatted: formatIST(new Date()),
                });
              }
            }
          }
        }

        // Mark trip completed
        const trip = await VehicleTrip.findOne({ manager_id: req.user.id, status: 'active' });
        if (trip) {
          trip.status = 'completed';
          trip.completed_at = new Date();
          trip.final_stock = finalStock;
          trip.total_sales_amount = system_sales_reported || 0;
          await trip.save();
        }

        admin.is_trip_active = false;
        admin.active_vehicle_number = '';
        admin.active_driver_name = '';
        admin.active_destination = '';
        await admin.save();

        // Reset all stock for this manager to 0
        await Product.updateMany({ created_by: req.user.id }, { stock: 0 });
      }
    }`;

repCode = repCode.replace(oldWalkinLogic, newWalkinLogic);

fs.writeFileSync(reportsPath, repCode, 'utf8');
console.log('reports.js patched');
