# Rapport de validation

## Connexion Neon et configuration Preview — 4 octobre 2026

Commit applicatif `db10561`, [déploiement Vercel READY](https://vercel.com/aziznabis-projects/spotlight/yDGUB96isBcr1cPtBxzj5S1L6hPZ). [URL stable à utiliser](https://spotlight-git-codex-dependency-audit-refresh-aziznabis-projects.vercel.app).

- Sept variables relues via Vercel, uniquement Preview / `codex/dependency-audit-refresh`. `DATABASE_URL` et `CRON_SECRET` sont sensitive. Aucun secret affiché ni committé; aucune configuration Production modifiée.
- Branche Neon `dev-spotlight-v1` confirmée; checksums des trois migrations identiques au dépôt. Rôle `spotlight_runtime_preview` sans privilèges de création, superuser ou bypass RLS; droits métier et lecture sous ce rôle vérifiés via Neon. Aucun utilisateur/produit/job créé sur cette branche.
- **Connexion depuis Vercel réellement exécutée** par le contrôle de build : le même pool que l’application ouvre la connexion poolée et lit users/products/jobs/assets en transaction read-only. Message de réussite observé dans les logs Vercel. Un premier build avait été bloqué avec `08P01`; retrait du paramètre startup `options` pour le pooler, utilisation du search_path du rôle, puis réussite. Ce résultat est une preuve depuis le build, pas encore une connexion ERP authentifiée dans une fonction.
- Lint, typage, **50 tests**, build et **10 E2E locaux sur next start** réussis après adaptation du pool. Contrôle pré-build essayé avec une vraie base locale; libellé de base production rejeté avant connexion.
- `/connexion` : HTTP 200 réel via connecteur Vercel, formulaire présent, HSTS reçu. `/api/cron` sans Bearer : HTTP 401 confirmé dans les **logs de la fonction serverless** (le connecteur interprète ce refus comme une protection d’accès). Aucun traitement métier déclenché par ces appels.
- `SESSION_COOKIE_SECURE=true`; code de session HttpOnly/Secure/SameSite=Lax conservé. Émission du cookie d’une session distante non vérifiée : aucun premier compte ERP n’existe encore. L’URL stable est l’Origin autorisée, pas les anciennes URL immuables.
- Cron `0 5 * * *` préparé, secret configuré; **pas d’ordonnancement Preview par Vercel**. Appel authentifié et exécution distante des jobs restent à vérifier. Le shell Codex ne peut pas joindre la preview (restriction réseau HTTP CONNECT 403); le connecteur GET ne permet pas d’ajouter le Bearer du cron.

Configuration et prochaines étapes dans [deployment.md](deployment.md). Shopify, Blob et fournisseurs IA n’ont pas été configurés dans cette intervention. Aucun abonnement ni passage en production.

## Mise à jour du 4 octobre 2026 — dépendances et reprise locale

Branche `codex/dependency-audit-refresh` : devalue 5.9.3 et http-cache-semantics 4.3.0 installés avec lockfile. Défaut de récupération locale des jobs au redémarrage corrigé. `npm ci`, migrations locales, lint, typage, **50 tests**, build et **10 E2E sur next start** réussis. Captures ordinateur/mobile inspectées. Test réel arrêt/redémarrage : même run, une seule variante, annulation sans exécution, retry contrôlé, 56 jobs préexistants conservés.

Audit final : **18 paquets high, 0 critical**, provenant de nanoid et braces. Aucune preview déployée ni nouvelle validation d’API commerciale distante. Rapport reproductible, changements de la base d’avis et limites : [dependency-audit.md](dependency-audit.md). Les preuves distantes ci-dessous datent de la livraison précédente et ne valident pas automatiquement cette branche locale.

## Livraison initiale du 2 octobre 2026

## Résultats exécutés

| Vérification | Résultat |
| --- | --- |
| Installation npm, versions exactes et lockfile | Réussie dans le cloud Node 24.19.0; .nvmrc fixé |
| ESLint | Réussi; sources Workflow générées exclues du lint |
| TypeScript strict | Réussi |
| Tests unitaires/intégration | **43 / 43**, 4 fichiers, dernier run 1,99 s; archivage, expédition externe et contrat de scène marketing inclus |
| Build Next.js production | Réussi; 20 étapes compilées dont dépendances, **1 workflow applicatif** détecté |
| E2E Chromium desktop/mobile sur `next start` | **10 / 10**; serveur local de production, pas seulement dev; parcours enrichis de suppression et d’expédition |
| PostgreSQL local | Vraie base PostgreSQL 18; base dédiée jetable par suite d’intégration, migrations exécutées |
| Neon dev | Migrations 001/002/003 appliquées via MCP, schéma relu; production intacte |
| GraphQL Shopify | Opérations Admin et Storefront validées contre le schéma officiel; lecture boutique réelle via MCP |
| Inspection UI | Captures ordinateur/mobile inventaire, Studio et boutique vide examinées |
| Publication/checkout/paiement réels | **Non exécutés : tokens applicatifs manquants** |
| Pricing web / détourage / scène / Blob réels | **Non exécutés : clés et réseau manquants** |
| Preview Vercel | **Non déployée** : outil déploiement indisponible, aucun token CLI |

Durées ci-dessus = environnement de vérification, pas benchmark de performance ni coût commercial. Aucun coût fournisseur mesuré : valeurs null, pas zéro.

## Invariants couverts

- R7/P25/P75, médianes/moyennes pondérées, inconnus, aliases, doublons, URLs autorisées, outliers après matching, variantes différentes, petits échantillons, devises et millimes TND, absence de markup achat.
- Password scrypt salé, tokens hashés, HMAC sur octets bruts, refus de corps altéré, absence de données privées dans les surfaces publiques, contrôle admin/opérateur et Origin côté serveur.
- SKU unique et immuable, edition optimiste, coûts initialement inconnus, validation administrateur, originaux non modifiables, formats photo, absence de variante dupliquée au rejeu.
- Jobs persistants, claim concurrent unique, exécution réelle Sharp, interruption ambiguë en échec sans nouvelle dépense automatique.
- Engagement à la commande non payée, événements dupliqués/retardés, aucune remise en stock sur remboursement, commandes concurrentes mises en quarantaine, deux lignes pour le même SKU détectées, une seule vente externe concurrente acceptée.
- Webhook synthétique signé passant par la vraie route HTTP/SQL; remises de ligne prises en compte; ID dédupliqué. Pas une livraison distante Shopify.
- Publication avec double réseau : réponse perdue, récupération de la variante, une seule activation, refus de réinitialiser un stock Shopify devenu nul. Aucun appel réel Admin d’écriture.
- Panier avec double réseau : création quantité 1, secret panier uniquement en cookie HttpOnly, ligne existante non ajoutée deux fois, retrait, refus hors collection et lien checkout retourné. Aucune commande réelle ni page de paiement validée.
- E2E : authentification privée, permission opérateur, création/édition, import photo, job durable exécuté hors réponse HTTP, avant/après, validation/export, suppression logique de variante avec conservation d’original, échec pricing sans clé au lieu de comparables fictifs, vente externe/retraits/expédition, états publics vides et absence de débordement viewport.

## Inspection et corrections

Fond neutre, accent olive, typographie système, listes/inventaire, contrôles mobile. Les illustrations DEMO sont clairement synthétiques; la boutique ne montre aucun faux produit ou avis. Les états d’accès fournisseur manquant sont explicites; presets Lifestyle/Ad et détourage sont indisponibles sans capacité configurée.

Corrections issues des tests : conflit de type SQL dans la vente externe; détection du workflow (directives sur lignes dédiées et formatage conservé); reprise Shopify après réponse perdue; verrouillage cohérent produit/image/listing; devise TND; ID de ligne normalisé entre webhook et rapprochement; remises; cache benchmark limité au produit; rejet d’un original marketing comme source documentaire; filtrage de la collection et éligibilité panier.

Captures locales reproductibles par E2E : `.local/inventory-desktop.png`, `inventory-mobile.png`, `studio-desktop.png`, `studio-mobile.png`, `store-desktop.png`, `store-mobile.png`, `orders-desktop.png`, `orders-mobile.png`. Non committées; la CI les conserve en artefacts 7 jours. Les tests utilisent des images plates synthétiques pour les invariants, pas des photos prétendument commerciales. Le navigateur interactif complète l’inspection. L’expédition et la suppression ont été inspectées; un export HTTP DELETE manquant, détecté par E2E, a été corrigé avant la relance réussie.

## Limites et suite obligatoire

Ce rapport ne vaut ni audit sécurité exhaustif, ni certification WCAG, ni preuve de fidélité d’un fournisseur IA. Aucune comparaison OpenAI/Gemini/PhotoRoom/Bria/fal sur pièces réelles. Le choix fournisseur reste provisoire. Il faut fournir/configurer les accès de deployment.md puis exécuter le parcours complet sur une boutique test autorisée. Les critères non satisfaits restent visibles dans acceptance.md et backlog.md; ne pas ouvrir la vente publique avant leur résolution.

La CI GitHub est fournie dans `.github/workflows/verify.yml`. [Exécution réelle 36987891652](https://github.com/aziznabi/Spotlight/actions/runs/36987891652) réussie sur d41f2c2 : installation, lint/typage/tests/build, migrations/seed, Chromium, E2E et artefacts. Le résultat de chaque nouvelle révision doit être contrôlé après push; cette preuve initiale n’est pas une validation automatique des changements ultérieurs.
