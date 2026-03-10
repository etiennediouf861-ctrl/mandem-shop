# MANDEM SHOP - Production Checklist

## 1) Installation
```bash
npm install
cp .env.example .env
npm run dev
```

## 2) Sécurisation admin
- L'UI admin demande un mot de passe via `/api/admin/login`.
- Token JWT requis pour `POST/DELETE /api/admin/products`.
- Change `ADMIN_PASSWORD` et `JWT_SECRET` dans `.env`.

## 3) Backend commandes
- `POST /api/orders` enregistre la commande dans SQLite.
- Tables: `orders`, `order_items`, `products`, `admin_audit`.

## 4) PayTech serveur
- Endpoint front: `POST /api/paytech/init`
- Callback PayTech: `POST /api/paytech/callback`
- Configure:
  - `PAYTECH_INIT_ENDPOINT`
  - `PAYTECH_API_KEY`
  - `PAYTECH_API_SECRET`

## 5) Emails automatiques
- Configure SMTP dans `.env` (`SMTP_HOST`, `SMTP_USER`, ...)
- Mails envoyés au client (si email) + admin (`ADMIN_EMAIL`)

## 6) Pages légales
- `cgv.html`
- `privacy.html`
- `shipping-returns.html`

## 7) Contact réel
- Mets ton vrai WhatsApp/téléphone dans `index.html`

## 8) Optimisation images
- Script: `./optimize-images.sh`
- Pré-requis: `cwebp` (`brew install webp`)

## 9) Tests recommandés
- Ajout panier / quantités
- Passage commande livraison
- Passage commande PayTech
- Callback PayTech (success/cancel)
- Admin CRUD produits
- Responsive mobile (iPhone SE, iPhone 14, Android)

## 10) Déploiement
- Hébergement: Render / Railway / VPS
- SSL: automatique via plateforme ou Nginx + Let's Encrypt
- Base SQLite: backup quotidien
- Logs: PM2 + rotation

## 11) SEO minimum
- Meta title/description et OG: configurés
- `robots.txt`: ajouté
- `sitemap.xml`: ajouté (remplace le domaine par le tien)
- `favicon.svg`: ajouté
