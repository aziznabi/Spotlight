# Spotlight

ERP privé, boutique Shopify personnalisée, pricing explicable et atelier photo dans une application Next.js/TypeScript. Interface française, pièces uniques, validation humaine avant publication.

## Démarrer

Node.js 22+, `npm ci`. Suivre [le guide local](docs/development.md) pour démarrer PostgreSQL, appliquer les migrations, charger les six pièces de démonstration et créer les comptes privés locaux. Puis `npm run dev` et ouvrir `http://localhost:3000/connexion`.

`npm run verify` exécute lint, typage, tests et build. `npm run test:e2e` vérifie les parcours desktop/mobile (PostgreSQL et seed requis). Les tests de contrats Shopify emploient des réponses synthétiques : ils ne prouvent pas un checkout réel.

## État de livraison

Le parcours ERP et Studio déterministe est utilisable localement. Les moteurs et connecteurs externes sont implémentés mais leur activation nécessite des secrets applicatifs : les credentials des connecteurs MCP ne sont pas ceux du site. Aucun produit fictif publié, aucun paiement réel, aucune souscription.

- [Critères d’acceptation et état réel](docs/acceptance.md)
- [Rapport de validation](docs/validation.md)
- [Mise en ligne et accès manquants](docs/deployment.md)
- [Architecture et autorités](docs/architecture.md)
- [Méthode de pricing et Studio](docs/engines.md)
- [Décisions / hypothèses](docs/decisions.md), [vision](docs/product-vision.md), [exigences](docs/requirements.md), [backlog](docs/backlog.md)

Les migrations sont versionnées et non destructives. Utiliser exclusivement une branche Neon de développement pour la preview. Les données internes et les originaux restent privés. Le fonctionnement externe complet et la preview ne sont pas déclarés validés tant que les essais réels documentés ne sont pas terminés.
