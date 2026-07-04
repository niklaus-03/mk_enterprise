const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { requireSupervisor } = require('../middleware/auth');

const failedLogins = new Map(); // Track failed logins in memory

// Manager limit removed — unlimited managers allowed

// ─── Helper: find user by username OR phone ────────────────────────────────────
async function findUser(identifier) {
  const clean = (identifier || '').trim();
  // Try username first
  let user = await Admin.findOne({ username: clean });
  if (!user) {
    // Try phone / mobile
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 10) {
      user = await Admin.findOne({
        $or: [{ phone: digits }, { mobile: digits }]
      });
    }
  }
  return user;
}

// ─── GET /api/auth/check-user ──────────────────────────────────────────────────
// Public endpoint to check if a credential exists (used to enable/disable login button)
router.get('/check-user', async (req, res) => {
  try {
    const { identifier } = req.query;
    if (!identifier) return res.json({ exists: false });
    const user = await findUser(identifier);
    res.json({ exists: !!user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
// Step 1: Validate username/phone + password. If supervisor, return requires_secret flag.
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/phone and password are required.' });
    }

    const user = await findUser(username);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    
    if (user.is_active === false) {
      return res.status(401).json({ error: 'Your account is disabled. Contact admin.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const currentFails = (failedLogins.get(user.username) || 0) + 1;
      failedLogins.set(user.username, currentFails);
      
      let actionType = 'failed_login';
      let desc = 'Failed login attempt (incorrect password)';
      
      if (currentFails >= 3) {
        actionType = 'security_alert';
        desc = `SECURITY ALERT: Failed login attempt ${currentFails} times for user ${user.username}`;
      }
      
      if (user.role !== 'supervisor') {
        await ActivityLog.create({
          user_id: user._id,
          username: user.username,
          user_role: user.role,
          action: actionType,
          entity_type: 'Admin',
          description: desc,
          ip_address: req.ip || req.connection?.remoteAddress || '',
        });
      }
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // 2-Step: If supervisor, don't issue token yet — ask for secret key
    if (user.role === 'supervisor') {
      return res.json({
        requires_secret: true,
        username: user.username,
        message: 'Password verified. Please enter your secret key.',
      });
    }

    // Non-supervisor (manager/driver) — issue token immediately
    failedLogins.delete(user.username); // Clear failed attempts on success
    await Admin.findByIdAndUpdate(user._id, { $set: { lastLogin: new Date(), is_online: true } });

    await ActivityLog.create({
      user_id: user._id,
      username: user.username,
      user_role: user.role,
      action: 'login',
      entity_type: 'Admin',
      description: 'Logged in successfully',
      ip_address: req.ip || req.connection?.remoteAddress || '',
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

// ─── POST /api/auth/verify-secret ─────────────────────────────────────────────
// Step 2: Supervisor provides secret key after password was already verified.
router.post('/verify-secret', async (req, res) => {
  try {
    const { username, secret_key } = req.body;
    if (!username || !secret_key) {
      return res.status(400).json({ error: 'Username and secret key are required.' });
    }

    const user = await findUser(username);
    if (!user || user.role !== 'supervisor') {
      return res.status(404).json({ error: 'Supervisor account not found.' });
    }

    const keyMatch = await user.compareSecretKey(secret_key);
    if (!keyMatch) {
      if (user.role !== 'supervisor') {
        await ActivityLog.create({
          user_id: user._id,
          username: user.username,
          user_role: user.role,
          action: 'failed_login',
          entity_type: 'Admin',
          description: 'Failed verify-secret attempt (incorrect secret key)',
          ip_address: req.ip || req.connection?.remoteAddress || '',
        });
      }
      return res.status(401).json({ error: 'Incorrect secret key.' });
    }

    // Success — issue token
    await Admin.findByIdAndUpdate(user._id, { $set: { lastLogin: new Date(), is_online: true } });

    await ActivityLog.create({
      user_id: user._id,
      username: user.username,
      user_role: user.role,
      action: 'login',
      entity_type: 'Admin',
      description: 'Logged in successfully',
      ip_address: req.ip || req.connection?.remoteAddress || '',
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
        message: 'A recovery request is already pending. Your Super Admin will reset your password.',
      });
    }

    await PasswordResetRequest.create({
      identifier: identifier.trim(),
      user_id: user._id,
      username: user.username,
      phone: user.phone || user.mobile || '',
      status: 'pending',
    });

    try {
      await Notification.create({
        type: 'security',
        title: 'Password Recovery Request',
        message: `User ${user.username} has requested a password reset.`,
      });
    } catch (notifErr) {
      console.error('Failed to create notification:', notifErr);
    }

    res.json({
      success: true,
      message: 'Recovery request submitted. Your Super Admin will reset your password shortly.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUPERVISOR-ONLY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/auth/managers ───────────────────────────────────────────────────
router.get('/managers', auth, async (req, res) => {
  try {
    const managers = await Admin.find({ role: { $in: ['manager', 'temp_manager', 'walkin_manager'] } })
      .select('-password -secret_key')
      .sort({ createdAt: -1 });
    const total = managers.length;
    res.json({ managers, total, limit: null, remaining: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/managers ──────────────────────────────────────────────────
router.post('/managers', auth, requireSupervisor, async (req, res) => {
  try {
    // Manager limit removed — no cap on number of managers

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

    const role = ['temp_manager', 'walkin_manager'].includes(req.body.role) ? req.body.role : 'manager';
    const assigned_managers = req.body.assigned_managers || [];

    const manager = await Admin.create({
      username: username.toLowerCase().trim(),
      password,
      phone: (phone || '').replace(/\D/g, ''),
      display_name: display_name || username,
      role: role,
      assigned_managers: assigned_managers,
      is_active: true,
      created_by: req.user.id,
      can_edit_products: req.body.can_edit_products === true || req.body.can_edit_products === 'true',
    });

    // Auto-create a ProductList for this new manager
    const Product = require('../models/Product');
    const ProductList = require('../models/ProductList');
    
    await ProductList.create({
      name: manager.display_name || manager.username,
      created_by: req.user.id,
      auto_for_manager: manager._id,
      products: [], // Start with empty products, Admin must authorize manually
      shares: [{ manager_id: manager._id, overrides: [] }]
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
    const { display_name, phone, is_active, username, can_edit_products, assigned_managers } = req.body;
    const manager = await Admin.findOne({ _id: req.params.id, role: { $in: ['manager', 'temp_manager', 'walkin_manager'] } });
    if (!manager) return res.status(404).json({ error: 'Manager not found.' });

    if (username) {
      const exists = await Admin.findOne({ username: username.toLowerCase().trim(), _id: { $ne: manager._id } });
      if (exists) return res.status(400).json({ error: 'Username already taken.' });
      manager.username = username.toLowerCase().trim();
    }
    if (display_name !== undefined) manager.display_name = display_name;
    if (phone !== undefined) manager.phone = (phone || '').replace(/\D/g, '');
    if (is_active !== undefined) manager.is_active = is_active;
    if (req.body.is_on_hold !== undefined) manager.is_on_hold = req.body.is_on_hold;
    if (can_edit_products !== undefined) {
      manager.can_edit_products = can_edit_products === true || can_edit_products === 'true';
    }
    if (assigned_managers !== undefined && manager.role === 'temp_manager') {
      manager.assigned_managers = assigned_managers;
    }
    await manager.save();

    // If manager is disabled, instantly log them out via socket
    if (manager.is_active === false) {
      if (global.io) {
        global.io.to(manager._id.toString()).emit('force_logout');
      }
    }
    
    // If hold status changed, emit appropriate socket event
    if (req.body.is_on_hold !== undefined) {
      if (global.io) {
        if (req.body.is_on_hold === true) {
          global.io.to(manager._id.toString()).emit('force_hold');
        } else {
          global.io.to(manager._id.toString()).emit('lift_hold');
        }
      }
    }

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

    const manager = await Admin.findOne({ _id: req.params.id, role: { $in: ['manager', 'temp_manager', 'walkin_manager'] } });
    if (!manager) return res.status(404).json({ error: 'Manager not found.' });

    manager.password = new_password;
    await manager.save();

    res.json({ success: true, message: `Password reset for ${manager.username}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/auth/managers/:id ────────────────────────────────────────────
router.delete('/managers/:id', auth, requireSupervisor, async (req, res) => {
  try {
    const manager = await Admin.findOne({ _id: req.params.id, role: { $in: ['manager', 'temp_manager', 'walkin_manager'] } });
    if (!manager) return res.status(404).json({ error: 'Manager not found.' });

    await Admin.deleteOne({ _id: req.params.id });

    // Also delete their auto-created ProductList
    const ProductList = require('../models/ProductList');
    await ProductList.deleteOne({ auto_for_manager: req.params.id });

    res.json({ success: true, message: `Manager "${manager.username}" deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/managers/:id/clone ────────────────────────────────────────
// Clone a manager: create new account + copy all data visibility from source
router.post('/managers/:id/clone', auth, requireSupervisor, async (req, res) => {
  try {
    const sourceManager = await Admin.findOne({ _id: req.params.id, role: { $in: ['manager', 'temp_manager', 'walkin_manager'] } });
    if (!sourceManager) return res.status(404).json({ error: 'Source manager not found.' });

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

    // 1. Create the new manager with same role & permissions
    const newManager = await Admin.create({
      username: username.toLowerCase().trim(),
      password,
      phone: (phone || '').replace(/\D/g, ''),
      display_name: display_name || username,
      role: sourceManager.role,
      assigned_managers: sourceManager.assigned_managers || [],
      is_active: true,
      created_by: req.user.id,
      can_edit_products: sourceManager.can_edit_products,
    });

    const sourceId = sourceManager._id.toString();
    const newId = newManager._id;
    const stats = { customers: 0, products: 0, suppliers: 0, invoices: 0, customerLists: 0, productLists: 0 };

    // 2. Copy Customer access: add new manager to allowed_managers of all customers where source exists
    const Customer = require('../models/Customer');
    const customerResult = await Customer.updateMany(
      { allowed_managers: sourceManager._id },
      { $addToSet: { allowed_managers: newId } }
    );
    stats.customers = customerResult.modifiedCount || 0;

    // 3. Copy Product access: add new manager to allowed_managers of all products where source exists
    const Product = require('../models/Product');
    const productResult = await Product.updateMany(
      { allowed_managers: sourceManager._id },
      { $addToSet: { allowed_managers: newId } }
    );
    stats.products = productResult.modifiedCount || 0;

    // 4. Copy Supplier access: find suppliers created by source manager or shared with source
    const Supplier = require('../models/Supplier');
    // Suppliers don't have allowed_managers yet, so we track via created_by
    // We don't change created_by, but we'll count them for info
    const supplierCount = await Supplier.countDocuments({ created_by: sourceManager._id });
    stats.suppliers = supplierCount;

    // 5. Copy Invoice shared_with: add new manager to shared_with of all invoices where source is creator or shared
    const Invoice = require('../models/Invoice');
    const invoiceResult = await Invoice.updateMany(
      { $or: [{ created_by: sourceManager._id }, { shared_with: sourceManager._id }] },
      { $addToSet: { shared_with: newId } }
    );
    stats.invoices = invoiceResult.modifiedCount || 0;

    // 6. Copy CustomerList access: for each list that has source manager in shares, add new manager
    const CustomerList = require('../models/CustomerList');
    const custLists = await CustomerList.find({ 'shares.manager_id': sourceManager._id });
    for (const list of custLists) {
      const alreadyShared = list.shares.some(s => s.manager_id.toString() === newId.toString());
      if (!alreadyShared) {
        list.shares.push({ manager_id: newId, overrides: [] });
        await list.save();
        stats.customerLists++;
      }
    }

    // 7. Copy ProductList access: for each list that has source manager in shares, add new manager
    const ProductList = require('../models/ProductList');
    const prodLists = await ProductList.find({ 'shares.manager_id': sourceManager._id });
    for (const list of prodLists) {
      const alreadyShared = list.shares.some(s => s.manager_id.toString() === newId.toString());
      if (!alreadyShared) {
        list.shares.push({ manager_id: newId, overrides: [] });
        await list.save();
        stats.productLists++;
      }
    }

    // 8. Also create the auto ProductList for new manager (same as normal creation, but with same products as source)
    const sourceProductList = await ProductList.findOne({ auto_for_manager: sourceManager._id });
    const allProductIds = sourceProductList
      ? sourceProductList.products
      : [];
    
    // Check if auto list already created by above steps
    const existingAutoList = await ProductList.findOne({ auto_for_manager: newId });
    if (!existingAutoList) {
      await ProductList.create({
        name: newManager.display_name || newManager.username,
        created_by: req.user.id,
        auto_for_manager: newId,
        products: allProductIds,
        shares: [{ manager_id: newId, overrides: [] }]
      });
    }

    const result = newManager.toObject();
    delete result.password;
    delete result.secret_key;

    res.status(201).json({
      success: true,
      message: `Manager "${newManager.display_name || newManager.username}" cloned from "${sourceManager.display_name || sourceManager.username}" successfully!`,
      manager: result,
      stats,
    });
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

// ═══════════════════════════════════════════════════════════════════════════════
//  DRIVER MANAGEMENT (Supervisor only)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/auth/drivers ────────────────────────────────────────────────────
router.get('/drivers', auth, async (req, res) => {
  try {
    const drivers = await Admin.find({ role: 'driver' })
      .select('-password -secret_key')
      .sort({ createdAt: -1 });
    res.json({ drivers, total: drivers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/drivers ───────────────────────────────────────────────────
// Auto-generates: username = vehicle_number (lowercase), password = vehicle_number
router.post('/drivers', auth, requireSupervisor, async (req, res) => {
  try {
    const { vehicle_number, driver_name, phone } = req.body;
    if (!vehicle_number || !driver_name) {
      return res.status(400).json({ error: 'Vehicle number and driver name are required.' });
    }

    const username = vehicle_number.replace(/\s+/g, '');

    // Check duplicate
    const exists = await Admin.findOne({ username });
    if (exists) {
      return res.status(400).json({ error: 'A driver with this vehicle number already exists.' });
    }

    const driver = await Admin.create({
      username,
      password: vehicle_number.replace(/\s+/g, ''), // default password = vehicle number
      phone: (phone || '').replace(/\D/g, ''),
      display_name: driver_name.trim(),
      role: 'driver',
      is_active: true,
      created_by: req.user.id,
    });

    const result = driver.toObject();
    delete result.password;
    delete result.secret_key;

    res.status(201).json({ success: true, driver: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/drivers/:id ────────────────────────────────────────────────
router.put('/drivers/:id', auth, requireSupervisor, async (req, res) => {
  try {
    const { display_name, phone, is_active, username } = req.body;
    const driver = await Admin.findOne({ _id: req.params.id, role: 'driver' });
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });

    if (username) {
      const exists = await Admin.findOne({ username: username.toLowerCase().replace(/\s+/g, ''), _id: { $ne: driver._id } });
      if (exists) return res.status(400).json({ error: 'Vehicle number already taken.' });
      driver.username = username.toLowerCase().replace(/\s+/g, '');
    }
    if (display_name !== undefined) driver.display_name = display_name;
    if (phone !== undefined) driver.phone = (phone || '').replace(/\D/g, '');
    if (is_active !== undefined) driver.is_active = is_active;
    if (req.body.is_on_hold !== undefined) driver.is_on_hold = req.body.is_on_hold;
    await driver.save();

    // If driver is disabled, instantly log them out via socket
    if (driver.is_active === false) {
      if (global.io) {
        global.io.to(driver._id.toString()).emit('force_logout');
      }
    }
    
    // If hold status changed, emit appropriate socket event
    if (req.body.is_on_hold !== undefined) {
      if (global.io) {
        if (req.body.is_on_hold === true) {
          global.io.to(driver._id.toString()).emit('force_hold');
        } else {
          global.io.to(driver._id.toString()).emit('lift_hold');
        }
      }
    }

    const result = driver.toObject();
    delete result.password;
    delete result.secret_key;
    res.json({ success: true, driver: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/drivers/:id/reset-password ─────────────────────────────────
router.put('/drivers/:id/reset-password', auth, requireSupervisor, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    const driver = await Admin.findOne({ _id: req.params.id, role: 'driver' });
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });

    driver.password = new_password;
    await driver.save();

    res.json({ success: true, message: `Password reset for driver ${driver.display_name}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/auth/drivers/:id ─────────────────────────────────────────────
router.delete('/drivers/:id', auth, requireSupervisor, async (req, res) => {
  try {
    const driver = await Admin.findOne({ _id: req.params.id, role: 'driver' });
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });

    await Admin.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: `Driver "${driver.display_name}" deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/vacant-walkin-managers ─────────────────────────────────────
// Fetch all vacant (is_trip_active = false) walkin_managers
router.get('/vacant-walkin-managers', auth, requireSupervisor, async (req, res) => {
  try {
    const managers = await Admin.find({ 
      role: 'walkin_manager',
      is_active: true,
      is_trip_active: false
    }).select('-password -secret_key -login_secret');
    res.json({ success: true, managers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// --- POST /api/auth/logout ------------------------------------------------------
router.post('/logout', auth, async (req, res) => {
  try {
    if (req.user && req.user.id) {
      await Admin.findByIdAndUpdate(req.user.id, { $set: { is_online: false } });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

