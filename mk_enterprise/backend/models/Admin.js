const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },       // bcrypt hashed
  mobile: { type: String, default: '', trim: true }, // for supervisor (legacy)
  phone: { type: String, default: '', trim: true },  // for manager login by phone
  role: {
    type: String,
    enum: ['supervisor', 'manager'],
    default: 'supervisor',
  },
  secret_key: { type: String, default: '' },         // hashed, supervisor only
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  display_name: { type: String, default: '' },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
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

// Check if account is locked
adminSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment failed login attempt
adminSchema.methods.incLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 15 * 60 * 1000; // 15 minutes
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_TIME) };
  }
  return this.updateOne(updates);
};

module.exports = mongoose.model('Admin', adminSchema);
