const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change-me';

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, SECRET, { expiresIn: '12h' });
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Token admin requis' });

  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.role !== 'admin') throw new Error('Role invalide');
    req.admin = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = { signAdminToken, requireAdmin };
