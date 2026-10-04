# Architecture et autorité

Une application Next.js. Les routes ERP requièrent une session et une permission; les modules serveur accèdent à PostgreSQL. La boutique lit exclusivement le DTO Storefront Shopify. Aucun join vers les coûts/notes ERP dans une réponse publique.

| Donnée                                                                       | Autorité                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| SKU, sourcing, coûts, préparation, authenticité, photos, comparables, tâches | ERP/Neon                                            |
| Disponibilité globale                                                        | ERP, sous réserve des engagements Shopify           |
| Catalogue commercial et stock local Shopify                                  | Shopify; publication initiale par ERP               |
| Panier, checkout, paiement, commande et expédition Shopify                   | Shopify                                             |
| Annonce externe                                                              | Déclaration opérateur, date de confirmation visible |

Jobs en base + lancement durable Workflow, étapes rejouables, bail/concurrence, limites de temps et d'essais. Cron quotidien 05:00 UTC : réexpédie les jobs pending et enfile un rapprochement Shopify si token configuré. Une étape fournisseur a maxRetries=0 : appel payant ambigu non rejoué automatiquement. Bail de cinq minutes puis échec visible; relance manuelle au plus trois tentatives, avec confirmation du risque de double coût. Le coût non communiqué reste inconnu. La base et la file durable ont des responsabilités distinctes; une ligne SQL seule n’exécute rien.

En local, `src/instrumentation.ts` initialise le World au démarrage Node pour récupérer les runs persistés après interruption. Sa garde exige `WORKFLOW_TARGET_WORLD=local`, défini par l’intégration Next locale. Les fichiers `.next/workflow-data` doivent être conservés pour le rejeu; une recompilation peut les supprimer. Cette file de développement ne remplace pas le World Vercel distribué. Scénario de reprise et limites dans [dependency-audit.md](dependency-audit.md).

Webhooks : HMAC du corps brut, enveloppe persistée, identifiant unique, transaction par commande et verrou SKU, traitement monotone, événements retardés ignorés pour statut logistique mais pouvant confirmer un engagement. Rapprochement Admin API manuel + planifiable. Pas de remise en stock automatique.

Stockage : Vercel Blob privé pour originaux/variantes. Proxy authentifié pour lecture; copie publique uniquement après approbation et sélection. Adaptateur disque strictement local pour vérification, interdit sur Vercel. Ne jamais assimiler ce dernier à du stockage déployé.
