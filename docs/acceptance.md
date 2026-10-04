# Matrice d’acceptation — 4 octobre 2026

« Vérifié local » ne signifie pas qu’une intégration externe fonctionne. Voir validation.md et deployment.md.

| Parcours | Résultat | Preuve / état |
| --- | --- | --- |
| Auth | Sessions réelles, admin/opérateur, permissions serveur, Origin | PostgreSQL + E2E desktop/mobile |
| SKU | Création/édition, SKU stable, revision, recherche/stock, coûts et taux d’achat | Vérifié local; migrations 001/002/003 sur Neon dev; connexion Vercel → Neon et lecture du schéma validées au build. Premier compte cloud absent |
| Pricing | Fingerprint, sources, déduplication, statistiques déterministes, séries séparées, cache/snapshots | Calculs testés; extraction OpenAI implémentée mais clé/réseau absents. Aucun benchmark réel |
| IA produit | Propositions traçables, observations/déductions/inconnus, aucun certificat IA | Adaptateur implémenté, appel réel bloqué |
| Studio documentaire | Upload, originaux immuables, fit/centrage/fond/ombre/formats, variantes, comparaison, validation/rejet/ordre/export et suppression logique | Vérifié avec fichiers synthétiques, Sharp et workflow durable local; suppression interdite si original, sélectionné, publié ou dépendant |
| Détourage / scène IA | PhotoRoom isolé, capacités exposées, scènes marketing distinctes | Provisoire non validé; presets IA désactivés sans accès. Contrat fournisseur courant et essais à confirmer |
| Stockage | Blob privé/public distinct, proxy authentifié | API typée; disque local vérifié. Blob externe non testé sans tokens |
| Jobs | Workflow durable, concurrence, déduplication, délais, relance contrôlée | 1 workflow découvert; exécution et reprise après arrêt réel sur next start, annulation, retry, absence de doublon vérifiés. Vercel non vérifié |
| Publication | Validation humaine, IDs, récupération réponse perdue, activation unique | Schéma officiel + contrat simulé testés; publication réelle bloquée |
| Boutique / panier | Catalogue Spotlight, produit, panier privé, quantité 1, checkout Shopify | État public vide vérifié; contrats panier avec doubles. Catalogue réel/checkout test bloqués |
| Commandes | HMAC brut, déduplication, engagement avant paiement, conflits/retards, aucun réassort aveugle | PostgreSQL + webhook synthétique signé; livraison Shopify réelle non testée |
| Marketplaces | Listings à copier, URL/prix/statut déclaratifs, vente externe, retraits, confirmation d’expédition | Vérifié local; SKU/emplacement affichés; transporteur/suivi tracés; retrait Shopify réel bloqué; retraits externes manuels |
| Reporting | Stock/tâches/commandes, ventes 30j, estimation après coûts connus | Données de base; inconnus explicites et tests exclus des résultats commerciaux; non comptabilité certifiée |
| UI | Français, états vide/erreur/succès/chargement, focus, desktop/mobile | 10 E2E + inspection des captures; pas d’audit WCAG exhaustif |
| Livraison | Versions/lockfile, migrations, seed, docs, CI | Lint/types/50 tests/build et 10 E2E réussis localement; branche poussée; preview Vercel READY avec Neon dev configuré, contrôle de lecture au build. Connexion ERP et parcours complet distants encore à vérifier |
| URL/cookies/cron | URL stable, cookies sécurisés, secret cron | Paramètres Preview de la branche configurés; page de connexion HTTP 200; refus cron non authentifié 401 observé. Cookies de session distante et appel cron authentifié non testés; ordonnancement automatique réservé à Production |
| Dépendances | Correctifs compatibles et risques tracés | devalue/cache corrigés et testés. Audit encore à 18 paquets high (nanoid/braces); détails et limites dans dependency-audit.md |

## Bloqueurs du parcours commerce complet

Neon dev est configuré dans Vercel Preview et la lecture réelle depuis le build est validée. Restent les secrets Shopify/Blob/OpenAI/PhotoRoom, les droits réseau du poste de test, la confirmation boutique/canal, le premier compte cloud, les budgets API et le mode checkout test. Il faut encore vérifier les jobs en fonction déployée, mesurer un benchmark réel, un détourage et une scène fidèles, publier une pièce autorisée et passer une commande de test jusqu’au webhook/retrait. Aucune simulation ne remplace ces critères.

## Périmètre fonctionnel encore incomplet

Réassort après retour/conflit volontairement bloqué pour contrôle humain; purge physique des objets archivés à définir selon rétention; presets marketing avancés à adapter au contrat fournisseur validé; expéditions Shopify effectuées dans Shopify Admin, état remonté dans ERP; consolidation comptable à compléter. Conditions légales, taxes, livraison/retours et comptes clients à décider/configurer avant ouverture publique.
