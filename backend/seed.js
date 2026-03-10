const db = require('./db');
const defaultProducts = require('./config/defaultProducts');

db.prepare('DELETE FROM products').run();

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
console.log('Catalogue seedé avec succès.');
