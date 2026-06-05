const fs = require('fs');

const file = 'backend/routes/payments.js';
let content = fs.readFileSync(file, 'utf8');

const target = `    // Remaining amount becomes advance
    advance = paid;`;

const replacement = `    // IF there is still 'paid' remaining, and we used specific invoices, we should cascade to OTHER unpaid invoices!
    if (paid > 0 && invoiceIdsToFetch && invoiceIdsToFetch.length > 0) {
      const specificIds = invoicesToPay.map(i => i._id);
      const otherInvoices = await Invoice.find({
        customer_id: customer_id,
        _id: { $nin: specificIds },
        balance_due: { $gt: 0.01 },
        status: { $ne: 'cancelled' },
      }).sort({ date: 1 });

      for (let invoice of otherInvoices) {
        if (paid <= 0) break;
        const currentDue = invoice.balance_due || 0;
        const amountToApply = Math.min(paid, currentDue);

        invoice.payments.push({ mode: mode || 'cash', amount: amountToApply, reference: reference || '' });
        invoice.amount_received = (invoice.amount_received || 0) + amountToApply;
        invoice.balance_due = currentDue - amountToApply;
        await invoice.save();

        if (customer.setManagerBalance && !customer.merged_by_admin && invoice.created_by) {
          const creatorId = invoice.created_by;
          let currentMB = customer.getManagerBalance(creatorId);
          customer.setManagerBalance(creatorId, currentMB - amountToApply);
        } else {
          customer.balance = customer.balance - amountToApply;
        }

        paid -= amountToApply;
        invoicesToPay.push(invoice);
      }
    }

    // Remaining amount becomes advance
    advance = paid;`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Successfully patched payments.js');
} else {
  console.log('Target not found in payments.js');
}
