# Déploiement et connexions à terminer

## Compte administrateur — 6 octobre 2026

Le premier compte administrateur est créé dans Neon dev, avec l'adresse fournie par le propriétaire. La mention « reste à créer » dans l'état historique du 4 octobre ci-dessous est désormais résolue.

Le mot de passe initial est temporairement conservé dans [Vercel / Spotlight / Environment Variables](https://vercel.com/aziznabis-projects/spotlight/settings/environment-variables), variable `ADMIN_PASSWORD`, Preview, branche `codex/dependency-audit-refresh`. Son type `encrypted` permet au propriétaire autorisé de révéler la valeur et de la sauvegarder dans son gestionnaire; `sensitive` ne permettrait pas cette récupération. Ne pas le coller dans une conversation, des logs ou Git. Après récupération, supprimer `ADMIN_PASSWORD` et `ADMIN_EMAIL`, puis redéployer pour les retirer des nouveaux runtimes. La connexion ERP utilise le hash en base, pas ces variables.

Création effectuée une seule fois avec le script existant `npm run user:create`, via une commande spécifique au déploiement `dpl_2MpgBshHiuoPPpLMorR5XC4Bv5Xe`, gardée sur Preview et l'hôte Neon dev. Ne pas redéployer cette commande exceptionnelle : utiliser le build normal `npm run build` pour la suite. Aucun endpoint de provisioning ajouté, aucune inscription publique ouverte.

La politique réseau du cloud Codex reste limitée aux gestionnaires de paquets. Ajouter `spotlight-git-codex-dependency-audit-refresh-aziznabis-projects.vercel.app` aux domaines autorisés dans les paramètres de cet environnement. L'outil Codex disponible peut lire cette politique mais ne peut pas la modifier. Conserver la protection Vercel; elle est distincte de cette restriction sortante. Session ERP et cron authentifié restent à tester depuis un environnement autorisé.

## Configuration Preview — 4 octobre 2026

Projet Vercel `spotlight` (`prj_PrXgWQhMQ6PzT9kAp2LozJSQbFPp`), relié au dépôt GitHub. La branche `codex/dependency-audit-refresh` dispose d’un alias stable : https://spotlight-git-codex-dependency-audit-refresh-aziznabis-projects.vercel.app . Utiliser cette URL pour les formulaires : elle est la valeur de `APP_URL` acceptée par la protection Origin. Les URL immuables des anciens déploiements ne récupèrent pas les nouvelles variables. Protection d’accès Vercel conservée.

Variables configurées **uniquement pour Preview et cette branche Git** : `DATABASE_URL` et `CRON_SECRET` de type sensitive; `DATABASE_ENV=development`, `APP_URL`, `SESSION_COOKIE_SECURE=true`, `JOBS_MAX_CONCURRENCY=2`, `DEMO_SEED=false`. Aucun secret en Git ou dans la documentation, aucune variable Production modifiée. Le fichier local de démonstration n’a pas été remplacé.

Neon confirmé par l’utilisateur : `dev-spotlight-v1` / `br-little-pine-b2rs2s22`, projet `aged-meadow-46817444`, base `neondb`. Connexion poolée et TLS `verify-full`. Rôle dédié `spotlight_runtime_preview`, sans superuser, création de base/rôle, bypass RLS ni appartenance à neon_superuser. Usage du schéma Spotlight, CRUD sur les tables métier, usage/lecture des séquences; aucun droit de modification des migrations ni création d’objets. Les nouvelles tables/séquences créées par neondb_owner dans ce schéma héritent des permissions applicatives. Le propriétaire peut prendre ce rôle pour vérifier les droits, sans en hériter automatiquement.

Les checksums des migrations 001/002/003 ont été comparés au dépôt et correspondent. Les lectures sous le rôle applicatif ont réussi via Neon; aucun utilisateur, produit ou job n’existait à la configuration. Le premier compte administrateur reste à créer avec l’email choisi par l’utilisateur. Pas de seed cloud, pas de modification de Neon production.

Le rôle possède `search_path=spotlight,public`. Pour les hôtes Neon `-pooler`, le client n’envoie pas `options=-c search_path` au démarrage; il utilise ce défaut du rôle. Les connexions directes/locales conservent leur option explicite. Le contrôle Vercel vérifie la résolution des noms de tables non qualifiés pour détecter un rôle mal configuré.

Le build exécute `scripts/verify-preview-db.ts` avant Next : uniquement sur Vercel Preview avec une DATABASE_URL configurée, contrôle de configuration puis transaction **en lecture seule** avec le pool applicatif réel et quatre tables du schéma. Un échec bloque le build sans exposer de secret. Ce contrôle valide la connexion depuis le build Vercel, pas une session ERP ou une exécution cron dans une fonction déployée.

Cron : `/api/cron`, calendrier `0 5 * * *` (05:00 UTC), Bearer obligatoire et comparaison constante. **Vercel ne planifie les crons que sur Production**, pas sur Preview. Secret Preview prêt pour test manuel autorisé; aucun ordonnanceur payant ajouté ni promotion production. Il reste à vérifier l’appel authentifié en fonction déployée et les jobs distants. Le rapprochement Shopify reste désactivé tant que son token Admin manque.

Le réseau de l’environnement Codex refuse actuellement le domaine preview (HTTP CONNECT 403); les tests HTTP authentifiés depuis ce poste restent bloqués. Les lectures via connecteurs ne prouvent pas à elles seules le fonctionnement de l’application : vérifier la preuve du build et l’état final de déploiement dans validation.md.

Résultat : déploiement `db10561` READY, contrôle de connexion/lecture réel réussi dans le build Vercel. `/connexion` répond 200; la fonction `/api/cron` refuse sans Bearer (401 dans les logs). Premier compte ERP, émission de son cookie et invocation cron authentifiée restent à vérifier séparément. Ne pas assimiler la présence des variables à un parcours commerce validé.

## Accès initiaux vérifiés le 2 octobre 2026 (historique)

- GitHub : dépôt `aziznabi/Spotlight`, lecture et branche de travail `codex/spotlight-v1`. Aucun push direct sur main.
- Neon MCP : projet Spotlight `aged-meadow-46817444`; branche dev créée `br-little-pine-b2rs2s22` (`dev-spotlight-v1`), base neondb. Migrations 001, 002 et 003 appliquées et schéma lu sur **dev uniquement**. Aucune modification de production `br-withered-heart-b2wo6xy6`.
- Shopify MCP : lecture boutique d’essai `kaizjm-da.myshopify.com`, EUR; emplacement `gid://shopify/Location/124917743947`. Confirmation de la boutique cible et sélection du canal Headless nécessaires avant publication.
- Vercel MCP : équipe `team_rLcX7bBvmkVSxeTiL1vUSLfX` lisible; aucun projet Spotlight initial. L’outil de déploiement a retourné « Tool deploy_to_vercel not found ». Pas de token CLI injecté, pas de preview créée.
- Cloud : aucun secret/variable applicatif injecté. Réseau sortant limité au preset package_managers, sans domaines API métier autorisés. Le fichier local de démonstration ne contient que des identifiants PostgreSQL locaux jetables, pas des credentials cloud.

Ces lectures MCP ne donnent **aucun droit d’exécution à l’application déployée**. Ne pas copier de credentials dans Git, une issue ou la conversation.

## Variables serveur requises

| Service | Configuration | Où l’obtenir / condition |
| --- | --- | --- |
| Neon | DATABASE_URL, DATABASE_ENV=development | Connection string de la branche **dev**, TLS; rôle applicatif dédié conseillé |
| Site | APP_URL, SESSION_COOKIE_SECURE=true | URL exacte de la preview pour vérification Origin; jamais localhost en ligne |
| Équipe | ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE | Créer via `npm run user:create`, retirer ensuite le mot de passe du runtime |
| Shopify ERP | SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_API_VERSION=2026-10 | Application personnalisée installée sur la boutique cible |
| Shopify canaux | SHOPIFY_LOCATION_ID, SHOPIFY_PUBLICATION_ID | Emplacement de stock et publication Headless correspondant au token Storefront |
| Shopify boutique | SHOPIFY_STOREFRONT_ACCESS_TOKEN | **Token privé Storefront**, conservé côté serveur; pas de NEXT_PUBLIC |
| Webhooks | SHOPIFY_WEBHOOK_SECRET | Secret utilisé pour signer les notifications de cette application Shopify |
| Pricing + propositions IA | OPENAI_API_KEY, OPENAI_MODEL | Compte/projet autorisé à Responses et web_search; plafond de dépenses configuré |
| Studio | PHOTOROOM_API_KEY; PHOTOROOM_EDIT_ENABLED | Clé/API et droits segment/Edit vérifiés; ne pas activer Edit avant les essais |
| Stockage | BLOB_READ_WRITE_TOKEN, BLOB_PUBLIC_READ_WRITE_TOKEN, STORAGE_DRIVER=blob | Deux stores distincts privé/public liés à Vercel; pas de disque temporaire |
| Jobs/cron | CRON_SECRET, JOBS_MAX_CONCURRENCY | Secret fort; concurrence 2 par défaut, bornée à 4 |

`.env.example` liste aussi le cache et les variables locales. `DEMO_SEED=false` sur toute preview connectée; le seed refuse un hôte non local. Aucun abonnement ni store facturable ne doit être créé sans validation du plan disponible.

## Procédure Vercel

1. Importer le dépôt GitHub, framework Next.js, racine du dépôt, Node 22+, build `npm run build`. Déploiements preview sur branche codex, pas de promotion production automatique.
2. Lier Neon dev et les stores Blob, renseigner les secrets **Preview** uniquement. Interdire le mélange de branche Neon production et preview. Vérifier quotas/prix Workflow/Blob avant activation.
3. Autoriser dans le cloud les hôtes strictement nécessaires : host Neon dev, api.vercel.com si CLI, api.openai.com, sdk.photoroom.com, image-api.photoroom.com, boutique Shopify et domaines Blob pertinents. Le réseau de Vercel est distinct de celui du poste d’exécution.
4. Appliquer `npm run db:migrate` à dev, pas `db push`; créer le premier administrateur. Le code Workflow utilise `withWorkflow`; Vercel fournit son infrastructure durable. Ne pas servir les routes `.well-known/workflow` via un proxy qui retire les signatures.
5. Déployer une preview, fixer APP_URL à son **alias de branche stable**, redéployer si nécessaire et utiliser cet alias dans le navigateur. Vercel doit pouvoir délivrer ses jobs; vérifier les interactions avec Deployment Protection dans ce projet.
6. Vérifier connexion privée, upload Blob privé (URL anonyme refusée), composition Studio, reprise durable, export et logs. Ajouter ensuite les clés payantes dans la limite de budget autorisée.

## Shopify : installation et essai complet

Scopes de base à vérifier selon l’app installée : read/write_products, read/write_inventory, read_locations, read/write_publications, read_orders. Les opérations GraphQL sont validées contre le schéma officiel courant; les autorisations de la boutique doivent encore être vérifiées réellement. Le connecteur peut annoncer des scopes alternatifs marketplace/quick_sale qui ne sont pas requis pour une commande standard.

Storefront privé : lecture catalogue/listings, lecture/écriture checkouts selon configuration Headless. Ne pas confondre token Admin et Storefront. Le produit doit être publié sur le canal associé à ce token.

Notifications sur `/api/webhooks/shopify` : orders/create, orders/updated, orders/paid, orders/cancelled, orders/fulfilled. HMAC corps brut + domaine boutique + ID événement. La commande engage la pièce dès sa création, sans attendre le paiement. Les updates financières couvrent les remboursements; ni remboursement ni annulation ne réassortent. Une panne renvoie 500 pour livraison Shopify ultérieure. Cron quotidien 05:00 UTC : relance pending et rapprochement des commandes mises à jour sur 7 jours; commande manuelle disponible. Limite explicite 500 commandes / 100 lignes; alerte d’échec si dépassée, pas de succès partiel silencieux.

Essai à autoriser/configurer : une vraie pièce de test explicitement autorisée (pas un produit DEMO), images privées approuvées, publication sur boutique test, catalogue et recherche, panier, redirection checkout, paiement en **mode test** Shopify, webhook reçu dans ERP, pièce engagée puis vendue, annonce externe à retirer. Répéter webhook, annulation, retard et rapprochement. Vérifier quantité 1, overselling désactivé, frais/livraison/taxes du checkout. Ne jamais effectuer une commande réelle payante pour vérifier.

## Sources officielles utilisées

- Documentation Next.js fournie avec le package installé : `node_modules/next/dist/docs/` (App Router, API routes, sécurité serveur/client).
- Documentation Workflow installée : `node_modules/workflow/docs/` (Next.js, étapes, idempotence et erreurs), [Workflow](https://useworkflow.dev/).
- [Shopify Admin GraphQL 2026-10](https://shopify.dev/docs/api/admin-graphql/2026-10) et [Storefront GraphQL](https://shopify.dev/docs/api/storefront/2026-10), recherches documentaires et validation de chaque opération via outils Shopify officiels. Les scripts de skill distants n’étaient pas présents dans le workspace : validation via connecteur en remplacement.
- [Neon serverless / PostgreSQL](https://neon.com/docs), guide Neon de la session et lectures du projet.
- [Vercel Blob](https://vercel.com/docs/vercel-blob), documentation get/put privé/public via connecteur; APIs installées typées.
- [OpenAI Responses](https://platform.openai.com/docs/api-reference/responses), README officiel du SDK OpenAI consulté. Appel réel bloqué par clé/réseau.
- [PhotoRoom API](https://docs.photoroom.com/) : accès documentaire direct refusé par réseau cloud. Adaptateur **provisoire à confirmer**, pas choix issu d’un benchmark ni contrat d’API certifié testé.
