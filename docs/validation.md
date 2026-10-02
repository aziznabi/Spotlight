# Rapport de validation — 2 octobre 2026

## Résultats exécutés

| Vérification | Résultat |
| --- | --- |
| Installation npm, versions exactes et lockfile | Réussie dans le cloud Node 24.19.0; .nvmrc fixé |
| ESLint | Réussi; sources Workflow générées exclues du lint |
| TypeScript strict | Réussi |
| Tests unitaires/intégration | **40 / 40**, 4 fichiers, dernier run 1,88 s |
| Build Next.js production | Réussi; 20 étapes compilées dont dépendances, **1 workflow applicatif** détecté |
| E2E Chromium desktop/mobile sur `next start` | **10 / 10**, 28,3 s; serveur local de production, pas seulement dev |
| PostgreSQL local | Vraie base PostgreSQL 18; base dédiée jetable par suite d’intégration, migrations exécutées |
| Neon dev | Migrations 001/002 appliquées via MCP, colonnes relues; production intacte |
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
- E2E : authentification privée, permission opérateur, création/édition, import photo, job durable exécuté hors réponse HTTP, avant/après, validation/export, échec pricing sans clé au lieu de comparables fictifs, vente externe/retraits, états publics vides et absence de débordement viewport.

## Inspection et corrections

Fond neutre, accent olive, typographie système, listes/inventaire, contrôles mobile. Les illustrations DEMO sont clairement synthétiques; la boutique ne montre aucun faux produit ou avis. Les états d’accès fournisseur manquant sont explicites; presets Lifestyle/Ad et détourage sont indisponibles sans capacité configurée.

Corrections issues des tests : conflit de type SQL dans la vente externe; détection du workflow (directives sur lignes dédiées et formatage conservé); reprise Shopify après réponse perdue; verrouillage cohérent produit/image/listing; devise TND; ID de ligne normalisé entre webhook et rapprochement; remises; cache benchmark limité au produit; rejet d’un original marketing comme source documentaire; filtrage de la collection et éligibilité panier.

Captures locales reproductibles par E2E : `.local/inventory-desktop.png`, `inventory-mobile.png`, `studio-desktop.png`, `studio-mobile.png`, `store-desktop.png`, `store-mobile.png`. Non committées; la CI les conserve en artefacts 7 jours. Les tests utilisent des images plates synthétiques pour les invariants, pas des photos prétendument commerciales. Le navigateur interactif complète l’inspection.

## Limites et suite obligatoire

Ce rapport ne vaut ni audit sécurité exhaustif, ni certification WCAG, ni preuve de fidélité d’un fournisseur IA. Aucune comparaison OpenAI/Gemini/PhotoRoom/Bria/fal sur pièces réelles. Le choix fournisseur reste provisoire. Il faut fournir/configurer les accès de deployment.md puis exécuter le parcours complet sur une boutique test autorisée. Les critères non satisfaits restent visibles dans acceptance.md et backlog.md; ne pas ouvrir la vente publique avant leur résolution.

La CI GitHub est fournie dans `.github/workflows/verify.yml`. Son résultat distant doit être lu après le push; la présence du fichier n’est pas une preuve d’exécution distante.
