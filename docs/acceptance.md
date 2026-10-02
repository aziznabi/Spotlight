# Matrice d’acceptation — 2 octobre 2026

« Vérifié local » ne signifie pas qu’une intégration externe fonctionne. Voir validation.md et deployment.md.

| Parcours | Résultat | Preuve / état |
| --- | --- | --- |
| Auth | Sessions réelles, admin/opérateur, permissions serveur, Origin | PostgreSQL + E2E desktop/mobile |
| SKU | Création/édition, SKU stable, revision, recherche/stock, coûts et taux d’achat | Vérifié local; migrations 001/002/003 appliquées sur Neon dev |
| Pricing | Fingerprint, sources, déduplication, statistiques déterministes, séries séparées, cache/snapshots | Calculs testés; extraction OpenAI implémentée mais clé/réseau absents. Aucun benchmark réel |
| IA produit | Propositions traçables, observations/déductions/inconnus, aucun certificat IA | Adaptateur implémenté, appel réel bloqué |
| Studio documentaire | Upload, originaux immuables, fit/centrage/fond/ombre/formats, variantes, comparaison, validation/rejet/ordre/export et suppression logique | Vérifié avec fichiers synthétiques, Sharp et workflow durable local; suppression interdite si original, sélectionné, publié ou dépendant |
| Détourage / scène IA | PhotoRoom isolé, capacités exposées, scènes marketing distinctes | Provisoire non validé; presets IA désactivés sans accès. Contrat fournisseur courant et essais à confirmer |
| Stockage | Blob privé/public distinct, proxy authentifié | API typée; disque local vérifié. Blob externe non testé sans tokens |
| Jobs | Workflow durable, concurrence, déduplication, délais, relance contrôlée | 1 workflow découvert; exécution complète sur serveur Next de production local. Vercel non vérifié |
| Publication | Validation humaine, IDs, récupération réponse perdue, activation unique | Schéma officiel + contrat simulé testés; publication réelle bloquée |
| Boutique / panier | Catalogue Spotlight, produit, panier privé, quantité 1, checkout Shopify | État public vide vérifié; contrats panier avec doubles. Catalogue réel/checkout test bloqués |
| Commandes | HMAC brut, déduplication, engagement avant paiement, conflits/retards, aucun réassort aveugle | PostgreSQL + webhook synthétique signé; livraison Shopify réelle non testée |
| Marketplaces | Listings à copier, URL/prix/statut déclaratifs, vente externe, retraits, confirmation d’expédition | Vérifié local; SKU/emplacement affichés; transporteur/suivi tracés; retrait Shopify réel bloqué; retraits externes manuels |
| Reporting | Stock/tâches/commandes, ventes 30j, estimation après coûts connus | Données de base; inconnus explicites et tests exclus des résultats commerciaux; non comptabilité certifiée |
| UI | Français, états vide/erreur/succès/chargement, focus, desktop/mobile | 10 E2E + inspection des captures; pas d’audit WCAG exhaustif |
| Livraison | Versions/lockfile, migrations, seed, docs, CI | Lint/types/43 tests/build exécutés; première CI distante réussie, suite renforcée à revérifier sur PR; preview bloquée |

## Bloqueurs du parcours commerce complet

Secrets runtime Neon/Shopify/Blob/OpenAI/PhotoRoom/Vercel et droits réseau manquants; confirmation boutique/canal, premier compte cloud, budget API et mode checkout test nécessaires. Il faut encore mesurer un benchmark réel, un détourage et une scène fidèles, publier une pièce autorisée et passer une commande de test jusqu’au webhook/retrait. Aucune simulation ne remplace ces critères.

## Périmètre fonctionnel encore incomplet

Réassort après retour/conflit volontairement bloqué pour contrôle humain; purge physique des objets archivés à définir selon rétention; presets marketing avancés à adapter au contrat fournisseur validé; expéditions Shopify effectuées dans Shopify Admin, état remonté dans ERP; consolidation comptable à compléter. Conditions légales, taxes, livraison/retours et comptes clients à décider/configurer avant ouverture publique.
