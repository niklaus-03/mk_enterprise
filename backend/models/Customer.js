const mongoose = require('mongoose');

// Per-manager balance ledger entry
const managerBalanceSchema = new mongoose.Schema({
  manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  balance: { type: Number, default: 0 }, // positive = owes us, negative = advance
}, { _id: false });

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  alternate_phones: [{ type: String, trim: true }],
  address: { type: String, default: '', trim: true },
  balance: { type: Number, default: 0 }, // global aggregate (sum of all manager_balances)
  gstin: { type: String, default: '', trim: true },
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  added_by_admin: { type: Boolean, default: false },
  // Phase 2: Visibility — which managers can see this customer
  allowed_managers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
  // Phase 2: Multi-ledger — track per-manager balances independently
  manager_balances: [managerBalanceSchema],
  merged_by_admin: { type: Boolean, default: false },
}, { timestamps: true });

// Helper: get balance for a specific manager
customerSchema.methods.getManagerBalance = function (managerId) {
  const entry = this.manager_balances.find(
    mb => mb.manager_id.toString() === managerId.toString()
  );
  return entry ? entry.balance : 0;
};

// Helper: set balance for a specific manager and recalculate global
customerSchema.methods.setManagerBalance = function (managerId, newBalance) {
  const entry = this.manager_balances.find(
    mb => mb.manager_id.toString() === managerId.toString()
  );
  if (entry) {
    entry.balance = newBalance;
  } else {
    this.manager_balances.push({ manager_id: managerId, balance: newBalance });
  }
  
  // Explicitly tell Mongoose that the array of subdocuments has changed
  this.markModified('manager_balances');
  
  // Recalculate global aggregate balance
  this.balance = this.manager_balances.reduce((sum, mb) => sum + mb.balance, 0);
};

customerSchema.index({ name: 1 });

module.exports = mongoose.model('Customer', customerSchema);
