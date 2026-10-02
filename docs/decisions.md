# Décisions, hypothèses et résultats

## Validé

Stack imposée; un SKU physique, stock distinct du workflow, approbation humaine, Shopify pour commerce. Branche dev Neon `br-little-pine-b2rs2s22`, projet `aged-meadow-46817444`; production exclue des migrations de développement.

## Hypothèses initiales

Devise marché EUR, achats en EUR/TND/USD/GBP possibles avec taux explicite (source/date); TND en millimes. Pricing V1 : similarité pondérée configurable, état utilisé dans le matching seulement (aucun multiplicateur de prix). Recommandations par marketplace; Vinted prioritaire si échantillon suffisant, sinon Vestiaire. Pas de moyenne commune entre marchés. P25/médiane pondérée/P75; minimum 5 comparables et qualité faible sous 10. Valeurs de départ non apprises, à calibrer. Méthode détaillée dans engines.md.

Sessions privées scrypt et tokens opaques en base, aucun formulaire d'inscription. PostgreSQL SQL versionné choisi pour rendre explicites verrous, contraintes et idempotence. Vercel Workflow pour exécution durable. Blob privé pour stockage; un adaptateur de test local ne constitue pas une intégration Blob vérifiée.

OpenAI Responses + web search : premier candidat de recherche, connecteur isolé. PhotoRoom : candidat détourage; mise en scène via son API d'édition si clé appropriée. Choix provisoires faute de clés, aucun benchmark comparatif réel ni coût fictif. Les appels payants restent désactivés sans configuration.

## Accès constatés

GitHub lecture OK. Neon MCP lecture/admin OK, branche dev créée. Shopify MCP répond (boutique d'essai kaizjm-da.myshopify.com); cela ne fournit PAS un token applicatif. Vercel MCP liste l'équipe; aucun projet Spotlight initial. Aucun secret applicatif injecté. Réseau cloud limité aux gestionnaires de paquets, domaines APIs non autorisés. Le plan Neon refuse le réglage de suspension demandé; branche créée sans modifier ce réglage.

## Benchmarks

Aucun produit réel fourni et aucune clé de recherche/image. Jeux de tests synthétiques clairement marqués, jamais des preuves de marché. Mesures locales et preuves finales dans validation.md; aucun coût ou résultat fournisseur réel disponible.

## Questions ouvertes

Boutique cible, tokens applicatifs et domaines autorisés; coûts fournisseurs et modèle disponibles; premier administrateur; conditions de vente/livraison/retour, pays servis et fiscalité; validation du checkout test sur le plan Shopify. Aucun abonnement souscrit.
