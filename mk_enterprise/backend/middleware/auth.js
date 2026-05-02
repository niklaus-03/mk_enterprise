const jwt = require('jsonwebtoken');

// ── Main auth middleware ────────────────────────────────────────────────────────
// Attaches req.user = { id, username, role } from JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Support both old tokens (req.admin.id) and new tokens (req.user)
    req.user = decoded;
    req.admin = decoded; // backward-compat alias
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

// ── Supervisor-only middleware ─────────────────────────────────────────────────
// Use after authMiddleware to restrict endpoint to supervisor role
function requireSupervisor(req, res, next) {
  if (!req.user || req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Access denied. Supervisor only.' });
  }
  next();
}

module.exports = authMiddleware;
module.exports.requireSupervisor = requireSupervisor;
