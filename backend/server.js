require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
let bcrypt = null;
try {
  bcrypt = require('bcryptjs');
} catch (_error) {
  bcrypt = null;
}

const db = require('./db');
const { signAdminToken, requireAdmin } = require('./auth');
const { sendOrderEmails } = require('./notifier');
const { initPayTechPayment } = require('./paytech');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
const IS_PROD = process.env.NODE_ENV === 'production';
const LOGIN_WINDOW_MS = Number(process.env.ADMIN_LOGIN_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 8);
const loginAttempts = new Map();

function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGINS || FRONTEND_URL;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!IS_PROD) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin non autorisée par CORS'));
  }
};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use((error, _req, res, next) => {
  if (error && String(error.message || '').includes('Origin non autorisée')) {
    return res.status(403).json({ error: 'Accès refusé (CORS)' });
  }
  return next(error);
});

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyAdminPassword(password) {
  const adminHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (adminHash) {
    if (!bcrypt) {
      throw new Error('bcryptjs manquant alors que ADMIN_PASSWORD_HASH est défini');
    }
    return bcrypt.compareSync(password, adminHash);
  }

  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!adminPassword) return false;
  return safeEqual(password, adminPassword);
}

function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function hasTooManyAttempts(ip) {
  const current = loginAttempts.get(ip);
  if (!current) return false;
  if (Date.now() > current.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return current.count >= LOGIN_MAX_ATTEMPTS;
}

function registerFailedAttempt(ip) {
  const current = loginAttempts.get(ip);
  if (!current || Date.now() > current.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

function clearFailedAttempts(ip) {
  loginAttempts.delete(ip);
}

function mapProduct(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    price: row.price,
    image: row.image,
    badge: row.badge || '',
    colors: JSON.parse(row.colors || '[]'),
    sizes: JSON.parse(row.sizes || '[]')
  };
}

function generateOrderRef() {
  const ts = Date.now().toString().slice(-7);
  return `MS-${ts}`;
}

function formatDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() });
});

app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  if (hasTooManyAttempts(ip)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' });
  }

  const password = String(req.body.password || '');
  if (!password) {
    registerFailedAttempt(ip);
    return res.status(401).json({ error: 'Mot de passe admin invalide' });
  }

  let ok = false;
  try {
    ok = verifyAdminPassword(password);
  } catch (error) {
    console.error('[ADMIN_LOGIN_ERROR]', error.message);
    return res.status(500).json({ error: 'Configuration admin invalide côté serveur' });
  }

  if (!ok) {
    registerFailedAttempt(ip);
    return res.status(401).json({ error: 'Mot de passe admin invalide' });
  }

  clearFailedAttempts(ip);
  const token = signAdminToken();
  return res.json({ token, expiresIn: '12h' });
});

app.get('/api/products', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  res.json(rows.map(mapProduct));
});

// Tracking traffic simple (public)
app.post('/api/metrics/track', (req, res) => {
  const day = formatDay(new Date());
  db.prepare('INSERT OR IGNORE INTO page_views (day, count) VALUES (?, 0)').run(day);
  db.prepare('UPDATE page_views SET count = count + 1, updated_at = CURRENT_TIMESTAMP WHERE day = ?').run(day);
  res.json({ ok: true });
});

app.get('/api/admin/verify', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  res.json(rows.map(mapProduct));
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { id, category, name, price, image, badge, colors, sizes } = req.body;

  if (!id || !category || !name || !price || !image) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  const safeId = Number(id);
  const safePrice = Number(price);
  if (!Number.isInteger(safeId) || safeId <= 0 || !Number.isFinite(safePrice) || safePrice <= 0) {
    return res.status(400).json({ error: 'ID/prix invalides' });
  }

  const safeCategory = String(category).trim();
  const safeName = String(name).trim();
  const safeImage = String(image).trim();
  const safeBadge = String(badge || '').trim();
  const safeColors = Array.isArray(colors) ? colors.map((c) => String(c).trim()).filter(Boolean) : [];
  const safeSizes = Array.isArray(sizes) ? sizes.map((s) => String(s).trim()).filter(Boolean) : [];
  if (!safeCategory || !safeName || !safeImage) {
    return res.status(400).json({ error: 'Champs texte invalides' });
  }

  const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(safeId);

  if (exists) {
    db.prepare(`
      UPDATE products
      SET category = ?, name = ?, price = ?, image = ?, badge = ?, colors = ?, sizes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      safeCategory,
      safeName,
      safePrice,
      safeImage,
      safeBadge,
      JSON.stringify(safeColors),
      JSON.stringify(safeSizes),
      safeId
    );
  } else {
    db.prepare(`
      INSERT INTO products (id, category, name, price, image, badge, colors, sizes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      safeId,
      safeCategory,
      safeName,
      safePrice,
      safeImage,
      safeBadge,
      JSON.stringify(safeColors),
      JSON.stringify(safeSizes)
    );
  }

  db.prepare('INSERT INTO admin_audit (action, payload) VALUES (?, ?)').run('product_upsert', JSON.stringify({ id: safeId }));

  return res.json({ ok: true });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  db.prepare('INSERT INTO admin_audit (action, payload) VALUES (?, ?)').run('product_delete', JSON.stringify({ id }));
  res.json({ ok: true });
});

app.post('/api/orders', async (req, res) => {
  const {
    paymentMethod,
    operator = '',
    phone = '',
    customerEmail = '',
    customerName = '',
    customerAddress = '',
    items = []
  } = req.body;

  if (!paymentMethod || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Commande invalide' });
  }

  const sanitizedItems = items.map((item) => ({
    product_id: Number(item.id || 0),
    name: String(item.name || ''),
    price: Number(item.price || 0),
    quantity: Number(item.qty || item.quantity || 1),
    color: String(item.color || ''),
    size: String(item.size || '')
  })).filter((it) => it.name && it.price > 0 && it.quantity > 0);

  if (!sanitizedItems.length) return res.status(400).json({ error: 'Items invalides' });

  const total = sanitizedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const orderRef = generateOrderRef();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (order_ref, status, payment_method, operator, phone, customer_name, customer_address, customer_email, total)
      VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).run(orderRef, paymentMethod, operator, phone, customerName, customerAddress, customerEmail, total);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_ref, product_id, name, price, quantity, color, size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of sanitizedItems) {
      insertItem.run(orderRef, item.product_id, item.name, item.price, item.quantity, item.color, item.size);
    }
  });

  tx();

  try {
    await sendOrderEmails({
      orderRef,
      customerEmail,
      total,
      paymentMethod,
      items: sanitizedItems
    });
  } catch (error) {
    console.error('[MAIL_ERROR]', error.message);
  }

  return res.status(201).json({
    orderRef,
    total,
    status: 'pending'
  });
});

app.post('/api/paytech/init', async (req, res) => {
  const { orderRef } = req.body;
  if (!orderRef) return res.status(400).json({ error: 'orderRef requis' });

  const order = db.prepare('SELECT * FROM orders WHERE order_ref = ?').get(orderRef);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_ref = ?').all(orderRef);

  try {
    const payload = {
      item_name: `Commande ${orderRef}`,
      item_price: order.total,
      currency: 'XOF',
      ref_command: orderRef,
      command_name: `Commande ${orderRef}`,
      env: process.env.PAYTECH_ENV || 'test',
      ipn_url: `${FRONTEND_URL}/api/paytech/callback`,
      success_url: `${FRONTEND_URL}/paytech-success.html?orderRef=${encodeURIComponent(orderRef)}`,
      cancel_url: `${FRONTEND_URL}/paytech-cancel.html?orderRef=${encodeURIComponent(orderRef)}`,
      custom_field: JSON.stringify({
        orderRef,
        phone: order.phone,
        operator: order.operator,
        items: items.map((i) => ({ name: i.name, qty: i.quantity }))
      })
    };

    const result = await initPayTechPayment(payload);

    db.prepare(`
      UPDATE orders
      SET status = 'payment_initiated', paytech_token = ?, paytech_ref = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_ref = ?
    `).run(result.token, result.ref, orderRef);

    return res.json({ redirect_url: result.redirectUrl });
  } catch (error) {
    console.error('[PAYTECH_INIT_ERROR]', error.message);
    return res.status(500).json({ error: error.message || 'Erreur init PayTech' });
  }
});

app.post('/api/paytech/callback', (req, res) => {
  const status = String(req.body.status || '').toLowerCase();
  const ref = String(req.body.ref_command || req.body.ref || '');

  if (!ref) return res.status(400).json({ error: 'Référence commande absente' });

  const nextStatus = status === 'completed' || status === 'success' ? 'paid' : status === 'cancelled' ? 'cancelled' : 'pending';

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_ref = ?').run(nextStatus, ref);
  return res.json({ ok: true });
});

app.get('/api/orders/:orderRef', requireAdmin, (req, res) => {
  const { orderRef } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE order_ref = ?').get(orderRef);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_ref = ?').all(orderRef);
  res.json({ ...order, items });
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const orders = db.prepare(`
    SELECT order_ref, status, payment_method, operator, phone, customer_name, customer_address, customer_email, total, created_at
    FROM orders
    ORDER BY id DESC
    LIMIT 200
  `).all();
  res.json(orders);
});

app.get('/api/admin/metrics', requireAdmin, (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 30), 7), 180);
  const since = `-${days - 1} day`;

  const trafficRows = db.prepare(`
    SELECT day, count
    FROM page_views
    WHERE date(day) >= date('now', ?)
    ORDER BY day ASC
  `).all(since);

  const salesRows = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS orders, SUM(total) AS revenue
    FROM orders
    WHERE date(created_at) >= date('now', ?)
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(since);

  const totalOrders = db.prepare('SELECT COUNT(*) AS total FROM orders').get().total || 0;
  const totalRevenue = db.prepare('SELECT SUM(total) AS total FROM orders').get().total || 0;
  const paidOrders = db.prepare("SELECT COUNT(*) AS total FROM orders WHERE status = 'paid'").get().total || 0;

  // Normalize series for charting
  const daySeries = [];
  const trafficMap = new Map(trafficRows.map((r) => [r.day, r.count]));
  const salesMap = new Map(salesRows.map((r) => [r.day, { orders: r.orders, revenue: r.revenue || 0 }]));

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = formatDay(d);
    daySeries.push({
      day: key,
      traffic: trafficMap.get(key) || 0,
      orders: salesMap.get(key)?.orders || 0,
      revenue: salesMap.get(key)?.revenue || 0
    });
  }

  res.json({
    days,
    summary: {
      totalOrders,
      totalRevenue,
      paidOrders
    },
    series: daySeries
  });
});

app.use(express.static(path.join(__dirname, '..')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  if (IS_PROD) {
    const hasHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim().length > 0;
    const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    if (!hasHash && (!adminPassword || adminPassword === 'change-this-password' || adminPassword === 'admin123')) {
      console.warn('[SECURITY_WARNING] Configure ADMIN_PASSWORD_HASH ou ADMIN_PASSWORD fort avant production.');
    }
  }
  console.log(`MANDem SHOP server running on http://localhost:${PORT}`);
});
