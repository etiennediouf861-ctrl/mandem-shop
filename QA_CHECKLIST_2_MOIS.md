# QA Checklist - MANDEM SHOP (2 mois)

## Semaine 1 - Setup & smoke tests
- [ ] Le site démarre avec `npm run dev`
- [ ] La page d'accueil charge sans erreur console
- [ ] Le logo vidéo s'affiche correctement desktop/mobile
- [ ] Les produits se chargent depuis l'API
- [ ] Le fallback local fonctionne si API indisponible

## Semaine 2 - Catalogue & navigation
- [ ] Recherche produit par nom fonctionne
- [ ] Recherche par catégorie fonctionne
- [ ] Bouton `Commander` ouvre `commande.html` avec bon produit
- [ ] Bouton `Ajouter au panier` ajoute l'article correct
- [ ] Prix en FCFA bien formatés

## Semaine 3 - Variantes & panier
- [ ] Sélection couleur sur page commande
- [ ] Sélection taille sur page commande
- [ ] Quantité +/- fonctionne
- [ ] Total commande se met à jour
- [ ] Panier conserve les données après refresh (`localStorage`)
- [ ] Changement quantité panier + / - fonctionne
- [ ] Suppression implicite quand quantité = 0

## Semaine 4 - Zone admin
- [ ] Login admin avec mot de passe
- [ ] Création produit (ID, nom, prix, image, catégorie, badge)
- [ ] Edition produit existant
- [ ] Suppression produit
- [ ] Réinitialisation catalogue
- [ ] Les changements admin apparaissent sur page commande
- [ ] Vérifier qu'un utilisateur non connecté admin ne peut pas modifier via API

## Semaine 5 - Commandes & paiements
- [ ] Commande en mode livraison enregistrée côté backend
- [ ] Commande PayTech test initie une session paiement
- [ ] Callback PayTech met à jour le statut commande
- [ ] Pages `paytech-success.html` et `paytech-cancel.html` accessibles
- [ ] WhatsApp récapitulatif s'ouvre avec bon contenu

## Semaine 6 - Emails & notifications
- [ ] Email client envoyé (si email fourni)
- [ ] Email admin reçu
- [ ] Notification navigateur fonctionne si permission accordée
- [ ] Message d'erreur clair si SMTP non configuré

## Semaine 7 - Mobile & performance
- [ ] Test iPhone SE / Android petit écran
- [ ] Test iPhone 14/15
- [ ] Header lisible sans overlap
- [ ] Formulaire commande utilisable au clavier mobile
- [ ] Images chargent rapidement en 4G lente
- [ ] CLS/UX acceptable (pas de sauts visuels majeurs)

## Semaine 8 - Pré-prod (go/no-go)
- [ ] Vérifier toutes les pages légales (CGV, Confidentialité, Livraison/Retours)
- [ ] Vérifier contact réel (WhatsApp / téléphone)
- [ ] Vérifier SEO minimum (title, description, OG, favicon, sitemap, robots)
- [ ] Sauvegarde DB planifiée
- [ ] Variables `.env` prod prêtes
- [ ] Domaine + SSL prêts
- [ ] Plan rollback défini

## Matrice de bugs
- [ ] Critique (bloque paiement/commande): corrigé sous 24h
- [ ] Majeur (impact fort UX): corrigé sous 72h
- [ ] Mineur (cosmétique): batch hebdo

## Go-live checklist finale
- [ ] `PAYTECH_ENV=prod`
- [ ] Clés PayTech prod actives
- [ ] `FRONTEND_URL=https://ton-domaine.com`
- [ ] Admin password fort changé
- [ ] JWT secret fort changé
- [ ] SMTP prod validé
- [ ] Test commande réel effectué (montant faible)

