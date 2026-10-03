# Développement et démonstration

`npm ci`; `npm run db:local` dans un terminal (PostgreSQL 18 local lié exclusivement à 127.0.0.1:5433). Copier .env.example vers .env.local et renseigner DATABASE_URL avec LOCAL_DATABASE_URL, DATABASE_ENV=development, STORAGE_DRIVER=local, APP_URL=http://localhost:3000 et DEMO_SEED=true. Puis `npm run db:migrate`, `npm run db:seed`, `npm run dev`.

Comptes **uniquement pour le jeu synthétique local** : admin@spotlight.test et operator@spotlight.test, mot de passe `Spotlight-demo-2026!`. Jamais créés sur Neon ou Vercel. Le seed refuse un hôte non local; les produits is_demo sont interdits de publication. Les illustrations sont procédurales, aucune photo ni donnée de marché réelle n'est fabriquée.

Pour Neon : DATABASE_URL de la branche dev `br-little-pine-b2rs2s22`, TLS conservé, migration versionnée, créer votre administrateur via `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run user:create` dans un environnement secret. Ne pas utiliser les comptes de démonstration en ligne.

Local Blob est uniquement un adaptateur de vérification. Pour Vercel : configurer un Blob store privé et un store public distinct; les images originales ne quittent le store privé que vers un provider explicitement déclenché. Les copies publiques exigent une approbation, sélection et validation de publication.
