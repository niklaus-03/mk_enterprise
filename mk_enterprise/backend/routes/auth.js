const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const auth = require('../middleware/auth');
const { requireSupervisor } = require('../middleware/auth');

const MANAGER_LIMIT = 5;

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

// ─── Helper: find user by username OR phone ────────────────────────────────────
async function findUser(identifier) {
  const clean = (identifier || '').toLowerCase().trim();
  // Try username first
  let user = await Admin.findOne({ username: clean, is_active: true });
  if (!user) {
    // Try phone / mobile
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 10) {
      user = await Admin.findOne({
        $or: [{ phone: digits }, { mobile: digits }],
        is_active: true,
      });
    }
  }
  return user;
}

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, secret_key } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/phone and password are required.' });
    }

    const user = await findUser(username);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // Check lock
    if (user.isLocked()) {
      const waitMin = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${waitMin} minute(s).` });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Supervisor requires secret_key
    if (user.role === 'supervisor') {
      if (!secret_key) {
        return res.status(401).json({ error: 'Secret key is required for Supervisor login.' });
      }
      const keyMatch = await user.compareSecretKey(secret_key);
      if (!keyMatch) {
        await user.incLoginAttempts();
        return res.status(401).json({ error: 'Incorrect secret key.' });
      }
    }

    // Success — reset attempts
    await Admin.findByIdAndUpdate(user._id, {
      $set: { loginAttempts: 0, lastLogin: new Date() },
      $unset: { lockUntil: 1 },
    });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      username: user.username,
      display_name: user.display_name || user.username,
      role: user.role,
      message: 'Login successful',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await Admin.findById(req.user.id).select('-password -secret_key');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/change-password ────────────────────────────────────────────
router.put('/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both passwords required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const user = await Admin.findById(req.user.id);
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect.' });
    user.password = new_password;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
// Admin-controlled: just flags a recovery request
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Username or phone is required.' });

    const user = await findUser(identifier);
    if (!user) {
      return res.status(404).json({ error: 'No account found with that username or phone.' });
    }

    // Check if there's already a pending request
    const existing = await PasswordResetRequest.findOne({ user_id: user._id, status: 'pending' });
    if (existing) {
      return res.json({
        success: true,
        message: 'A recovery request is already pending. Your Supervisor Admin will reset your password.',
      });
    }

    await PasswordResetRequest.create({
      identifier: identifier.trim(),
      user_id: user._id,
      username: user.username,
      phone: user.phone || user.mobile || '',
      status: 'pending',
    });

    res.json({
      success: true,
      message: 'Recovery request submitted. Your Supervisor Admin will reset your password shortly.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPERVISOR-ONLY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/auth/managers ───────────────────────────────────────────────────
router.get('/managers', auth, requireSupervisor, async (req, res) => {
  try {
    const managers = await Admin.find({ role: 'manager' })
      .select('-password -secret_key')
      .sort({ createdAt: -1 });
    const total = managers.length;
    res.json({ managers, total, limit: MANAGER_LIMIT, remaining: MANAGER_LIMIT - total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/managers ──────────────────────────────────────────────────
router.post('/managers', auth, requireSupervisor, async (req, res) => {
  try {
    const count = await Admin.countDocuments({ role: 'manager' });
    if (count >= MANAGER_LIMIT) {
      return res.status(400).json({
        error: `Manager limit reached. Maximum ${MANAGER_LIMIT} managers allowed.`,
      });
    }

    const { username, phone, password, display_name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check duplicate username
    const exists = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    const manager = await Admin.create({
      username: username.toLowerCase().trim(),
      password,
      phone: (phone || '').replace(/\D/g, ''),
      display_name: display_name || username,
      role: 'manager',
      is_active: true,
      created_by: req.user.id,
    });

    const result = manager.toObject();
    delete result.password;
    delete result.secret_key;

    res.status(201).json({ success: true, manager: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/managers/:id ───────────────────────────────────────────────
router.put('/managers/:id', auth, requireSupervisor, async (req, res) => {
  try {
    const { display_name, phone, is_active } = req.body;
    const manager = await Admin.findOne({ _id: req.params.id, role: 'manager' });
    if (!manager) return res.status(404).json({ error: 'Manager not found.' });

    if (display_name !== undefined) manager.display_name = display_name;
    if (phone !== undefined) manager.phone = (phone || '').replace(/\D/g, '');
    if (is_active !== undefined) manager.is_active = is_active;
    await manager.save();

    const result = manager.toObject();
    delete result.password;
    delete result.secret_key;
    res.json({ success: true, manager: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/managers/:id/reset-password ────────────────────────────────
router.put('/managers/:id/reset-password', auth, requireSupervisor, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const manager = await Admin.findOne({ _id: req.params.id, role: 'manager' });
    if (!manager) return res.status(404).json({ error: 'Manager not found.' });

    manager.password = new_password;
    manager.loginAttempts = 0;
    manager.lockUntil = null;
    await manager.save();

    res.json({ success: true, message: `Password reset for ${manager.username}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/auth/managers/:id ────────────────────────────────────────────
router.delete('/managers/:id', auth, requireSupervisor, async (req, res) => {
  try {
    const manager = await Admin.findOne({ _id: req.params.id, role: 'manager' });
    if (!manager) return res.status(404).json({ error: 'Manager not found.' });

    await Admin.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: `Manager "${manager.username}" deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/recovery-requests ─────────────────────────────────────────
router.get('/recovery-requests', auth, requireSupervisor, async (req, res) => {
  try {
    const requests = await PasswordResetRequest.find()
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/recovery-requests/:id/resolve ──────────────────────────────
router.put('/recovery-requests/:id/resolve', auth, requireSupervisor, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    // Reset the user's password
    const user = await Admin.findById(request.user_id);
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    user.password = new_password;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Mark request resolved
    request.status = 'resolved';
    request.resolved_by = req.user.id;
    request.resolved_at = new Date();
    await request.save();

    res.json({ success: true, message: `Password reset for "${user.username}". Share new password securely.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
