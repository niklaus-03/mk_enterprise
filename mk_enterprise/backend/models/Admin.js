const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },       // bcrypt hashed
  mobile: { type: String, default: '', trim: true }, // for supervisor (legacy)
  phone: { type: String, default: '', trim: true },  // for manager login by phone
  role: {
    type: String,
    enum: ['supervisor', 'manager', 'driver'],
    default: 'supervisor',
  },
  secret_key: { type: String, default: '' },         // hashed, supervisor only
  is_active: { type: Boolean, default: true },
  is_on_hold: { type: Boolean, default: false },
  is_online: { type: Boolean, default: false },
  can_edit_products: { type: Boolean, default: false },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  display_name: { type: String, default: '' },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  // Hash secret_key if it was modified and is non-empty
  if (this.isModified('secret_key') && this.secret_key) {
    this.secret_key = await bcrypt.hash(this.secret_key, 10);
  }
  next();
});

// Compare password
adminSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Compare secret key
adminSchema.methods.compareSecretKey = async function (plain) {
  if (!plain || !this.secret_key) return false;
  return bcrypt.compare(plain, this.secret_key);
};

// Generate a 3-letter prefix code from username (e.g., 'bharat' -> 'BRT', supervisor -> 'ADM')
adminSchema.methods.getPrefixCode = function () {
  if (this.role === 'supervisor') return 'ADM';
  const name = (this.username || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (name.length <= 3) return name || 'USR';
  // Take first, middle, last consonant-heavy letters
  return (name[0] + name[Math.floor(name.length / 2)] + name[name.length - 1]);
};

module.exports = mongoose.model('Admin', adminSchema);
