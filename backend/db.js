const path = require('path');
const Database = require('better-sqlite3');
const defaultProducts = require('./config/defaultProducts');

const dbPath = path.join(__dirname, 'data', 'mandem.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  image TEXT NOT NULL,
  badge TEXT DEFAULT '',
  colors TEXT DEFAULT '[]',
  sizes TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL,
  operator TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  total INTEGER NOT NULL,
  paytech_token TEXT DEFAULT '',
  paytech_ref TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL,
  product_id INTEGER,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  color TEXT DEFAULT '',
  size TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  payload TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_views (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('orders', 'customer_name', "TEXT DEFAULT ''");
ensureColumn('orders', 'customer_address', "TEXT DEFAULT ''");

const countProducts = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
if (countProducts === 0) {
  const insert = db.prepare(`
    INSERT INTO products (id, category, name, price, image, badge, colors, sizes)
    VALUES (@id, @category, @name, @price, @image, @badge, @colors, @sizes)
  `);

  const tx = db.transaction((items) => {
    for (const p of items) {
      insert.run({
        ...p,
        badge: p.badge || '',
        colors: JSON.stringify(p.colors || []),
        sizes: JSON.stringify(p.sizes || [])
      });
    }
  });

  tx(defaultProducts);
}

module.exports = db;
