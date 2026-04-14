const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cntrd_jwt_secret_change_in_production';

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET };
