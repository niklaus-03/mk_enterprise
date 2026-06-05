const fs = require('fs');

const file = 'backend/routes/customers.js';
let content = fs.readFileSync(file, 'utf8');

const targetRoute = `router.get('/:id', async (req, res) => {`;
const newRoute = `// GET /:id/balance-breakdown
router.get('/:id/balance-breakdown', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const managerId = req.query.manager_id;
    let totalBalance = customer.balance || 0;
    
    // In mk_enterprise, manager balances are stored in an array
    if (managerId && customer.getManagerBalance && !customer.merged_by_admin) {
      totalBalance = customer.getManagerBalance(managerId);
    }

    const Invoice = require('../models/Invoice');
    const invoiceQuery = {
      customer_id: customer._id,
      balance_due: { $gt: 0.01 },
      status: { $ne: 'cancelled' }
    };
    
    // If we only care about invoices created by a specific manager
    // if (managerId && !customer.merged_by_admin) {
    //   invoiceQuery.created_by = managerId;
    // }

    const unpaidInvoices = await Invoice.find(invoiceQuery).sort({ date: 1 }).select('invoice_number balance_due date ist_formatted').lean();
    const unpaidInvoicesSum = unpaidInvoices.reduce((s, i) => s + (i.balance_due || 0), 0);

    const openingBalance = Math.max(0, totalBalance - unpaidInvoicesSum);
    const advance = Math.max(0, unpaidInvoicesSum - totalBalance);

    res.json({
      total_balance: totalBalance,
      opening_balance: openingBalance,
      unpaid_invoices: unpaidInvoices,
      unpaid_invoices_sum: unpaidInvoicesSum,
      unregistered_advance: advance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {`;

content = content.replace(targetRoute, newRoute);

fs.writeFileSync(file, content);
console.log("Patched backend customers.js with balance-breakdown endpoint");
