# Moteurs V1 : méthodes et limites

## Pricing, version market-v1.0

L’achat ne détermine jamais la valeur marché. `fingerprint` conserve original/normalisé pour les dix caractéristiques; les inconnues ne deviennent pas des correspondances. Les poids initiaux (marque 25, catégorie 20, modèle 14, genre/taille/état 8 chacun, matière/variante 5, couleur 4, motif 3) sont des hypothèses modifiables dans `defaultConfig`, pas des paramètres appris.

Score = poids des champs connus correspondants / poids des champs connus de la cible. Marque, catégorie, genre et variante contradictoires sont exclus; seuil initial 0,60. L’état intervient uniquement dans le score, sans multiplicateur monétaire additionnel. Une variante différente est écartée avant la détection des prix extrêmes.

URLs HTTPS canoniques, domaines autorisés et déduplication; prix positifs entiers, preuve textuelle, date de récupération valide et au plus 30 jours. URLs inaccessibles exclues. Prix vendus conservés dans les données mais exclus de la série des prix demandés. EUR cible; change explicite avec taux, source et date sinon exclusion. Un taux signifie 1 unité de devise source = x EUR. EUR/USD/GBP ont deux décimales, TND trois; conversion puis arrondi au centime EUR.

Statistiques séparées par marketplace : moyenne des retenus, moyenne pondérée, médiane, médiane pondérée, P25/P75 et min/max nettoyés. Percentiles R7, interpolation à `(n-1)*p`. Médiane pondérée = première valeur atteignant la moitié du poids total. Exclusion IQR au-delà de 1,5 IQR seulement à partir de 8 observations et si IQR > 0; toutes les exclusions restent inspectables. Sur les petits échantillons : pas de nettoyage automatique IQR et aucune recommandation sous 5 retenus.

Vente rapide = P25, Recommandé = médiane pondérée, Marge maximale = P75, arrondis au centime. La fourchette centrale marché est P25–P75, pas un prix garanti. Ces stratégies ne prédisent pas les délais. Vinted est prioritaire si suffisant, sinon Vestiaire; **pas de moyenne commune entre marketplaces**. Les séries séparées exposent leurs écarts, à interpréter selon audience/frais/qualité de matching.

Qualité faible si moins de 10 retenus, similarité < 0,75, IQR/médiane > 0,60, moins de la moitié vérifiés, ancienneté > 7 jours, > 40 % de caractéristiques inconnues ou cible avec moins de 5 champs connus. Sinon modérée. Jamais de probabilité de vente ni de pourcentage de confiance calibrée. Les résultats web non vérifiés restent donc de qualité faible.

## Connecteur de recherche

OpenAI Responses + outil web_search, marchés d’origine Vinted/Vestiaire, quatre appels maximum : recherche proche sur chaque marché puis élargissement si moins de 20 résultats bruts. La sélection accessible n’est pas « les 50 premiers résultats Vinted ». Les URLs doivent être présentes dans les sources/citations renvoyées et correspondre à une annonce individuelle. Aucun navigateur automatisé ni scraping marketplace. Les extraits ne prouvent ni activité courante ni vente. Prix et preuves extraits par le fournisseur restent à contrôler humainement; les calculs sont backend déterministes.

Snapshots immuables, version, paramètres, requêtes, usage fournisseur, latence, provenance, dates, inconnus et exclusions conservés. Cache par fingerprint/marché/config/version, limité au produit afin que son historique soit visible; 24h par défaut, refresh manuel. Aucun prix publié n’est modifié par un benchmark. Absence de clé = échec explicite, pas de résultats inventés. Coût API non mesuré = null, pas zéro.

**Résultat de benchmark fournisseurs : non réalisé.** Aucun produit réel ni clé applicative disponibles. Les fixtures synthétiques des tests ne sont pas des comparables commerciaux. OpenAI est un premier adaptateur provisoire; une comparaison OpenAI/Gemini sur ~20 vrais produits reste à conduire (pertinence, couverture, extraction, coût, latence, stabilité).

## Studio, presets v1

| Preset | Format | Fond | Marge | Ombre | Capacité requise |
| --- | --- | --- | --- | --- | --- |
| Clean | 1:1 | blanc | 12 % | non | composition; détourage facultatif |
| Marketplace | 4:5 | gris clair | 10 % | non | idem |
| Luxury | 4:5 | noir | 16 % | oui | idem |
| Lifestyle | 4:5 | scène marketing | — | fournisseur | PhotoRoom Edit |
| Ad | 9:16 prévu | scène marketing | — | fournisseur | PhotoRoom Edit; paramètres de rendu à valider en essai |

Sharp redimensionne en `fit:inside`, conserve les proportions, centre et compose sans couper le produit; ombre elliptique simple. Sans détourage, le fond présent dans le fichier source reste visible dans le cadre : ce n’est pas une suppression de fond. Originaux immuables, chaque sortie a source/paramètres/job/provider/modèle/prompt et validation. Le Studio ne transforme que les originaux, pour empêcher de recycler une scène marketing en photo documentaire. Images max 4 Mo / 24 Mpx, JPEG/PNG/WebP statiques.

PhotoRoom segment et Edit sont des adaptateurs provisoires, non essayés réellement. Les presets marketing sont désactivés sans accès Edit explicitement confirmé. Les réglages avancés de composition déterministe ne sont pas appliqués à la scène générée; ne pas prétendre que tous les presets sont entièrement disponibles. Avant activation : vérifier le contrat courant des endpoints et les droits de la clé puis tester fidélité, formats, latence et coût. Aucun tarif fixe n’est déduit d’une synthèse.

Originaux privés Blob, jamais écrasés. Les variantes marketing sont distinctes; elles ne constituent pas une preuve d’état et ne remplacent pas les vues documentaires, étiquettes et défauts. Aucun angle absent ne doit être généré. Toutes les images exigent une approbation humaine avant sélection/publication. Rejet disponible; suppression physique et purge avec dépendances reportées, aucun original supprimé implicitement.

## Marges

La fiche distingue vente moins achat, après coûts variables connus et dossiers incomplets. Achat inconnu ou devise sans taux = marge inconnue. Chaque coût indique connu/inconnu (zéro doit être déclaré explicitement), devise et provenance FX. Rapport sur 30 jours : pièces vendues, commandes payées en EUR, hors tests/annulations/remboursements, uniquement SKU sans conflit; prix de ligne après remises. Estimation après coûts connus, non bénéfice comptable ni marge fiscale certifiée. Consolidation comptable, clôture des coûts et détail des retours restent au backlog.
