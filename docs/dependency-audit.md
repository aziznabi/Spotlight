# Dépendances et reprise locale — 4 octobre 2026

Travail sur `codex/dependency-audit-refresh`, issu de `335d621`. Le constat initial `SECURITY_AUDIT_NOTES.txt` est conservé tel quel. Aucun `npm audit fix --force`, downgrade, push ou déploiement. Node 24.19.0 / npm 11.9.0.

## Décisions et résultats

| Bibliothèque | Décision | Justification / limite |
| --- | --- | --- |
| devalue 5.9.2 → **5.9.3** | Override limité à `@workflow/core@5.0.1`, version et intégrité verrouillées | Workflow verrouille exactement l’ancienne version. Tests de sérialisation, ancien payload, jobs persistés, build et E2E exécutés. Retirer l’override lorsque Workflow adopte un correctif compatible. |
| http-cache-semantics 4.2.0 → **4.3.0** | Actualisation du lockfile dans la plage `^4.2.0` de cacheable-request | Version disponible lors de la reprise du 4 octobre. Aucun override supplémentaire. Test du refus d’un cache `Vary: accept, *` même avec `max-stale`, et contrôles de cache public/privé. |
| nanoid 5.1.6 dans Workflow | **Conservé, risque ouvert** | Le correctif 5.1.16 change `customRandom` : pour un alphabet de 64 caractères et un ID de 21 caractères, 21 octets pseudo-aléatoires demandés au lieu de 34. Workflow partage ce flux déterministe avec ses autres identifiants. Un override peut modifier le rejeu des hooks existants. Spotlight n’utilise actuellement aucun hook et ne laisse pas choisir la taille des IDs. Attendre une adoption amont ou valider une migration explicite. |
| braces 3.0.3 | **Conservé, risque ouvert** | Toujours dernière version au 4 octobre. Dépendance du lint Next → fast-glob → micromatch, motifs configurés par le développeur. Aucun correctif publié observé. |

Workflow et son cœur restent en **5.0.1**. Les tags `latest` de devalue/nanoid sont des versions majeures 6.x : elles ne sont pas substituées aux correctifs examinés. ESLint 9.39.5 émet également un avertissement de fin de support; une migration majeure de l’outillage reste distincte de cette correction ciblée.

`npm audit` : **25 high / 0 critical** au début le 3 octobre, puis 24 après devalue. Le 4 octobre, la base d’avis actualisée donne 19 avant la mise à jour du cache et **18 high / 0 critical** après. Cette évolution mélange changements de dépendances et évolution des avis. Les 18 paquets restants propagent les avis de **deux bibliothèques racines**, pas 18 failles indépendantes du code Spotlight. L’audit final reste non nul.

## Reproductions et contrôles

- Avant devalue : un Buffer de deux octets issu d’une allocation synthétique de six octets sérialise aussi les quatre octets hors vue; une clé non textuelle coercible en `__proto__` est acceptée. Les deux tests échouent avant correction et passent après. Il s’agit de reproductions sur la dépendance, pas d’une exploitation démontrée de Spotlight.
- Après correction : même vérification de Buffer via le codec réel Workflow dans les modes client, step et workflow; types Date/Map/vue binaire, objet cyclique ordinaire et dictionnaire sans prototype conservés. Payload encodé sous devalue 5.9.2 relu correctement. Limite Workflow de 100 000 éléments pour un tableau creux conservée.
- Avant http-cache-semantics : un cache `Vary: accept, *` est accepté avec `max-stale`; après, il est refusé. Les hits publics valides restent possibles. Le consommateur doit toujours vérifier `storable()` avant stockage : `max-stale` ne donne pas le droit de stocker une réponse privée. Le consommateur cacheable-request présent dans cette chaîne effectue cette vérification.
- Les payloads métier de `runJob` restent des IDs et petits états, sans Buffer ni données arbitraires transmises par le public. Les protections du codec Workflow réduisent déjà une partie de l’exposition. Ce constat ne transforme pas les avis restants en risques nuls.

## Reprise des jobs : défaut trouvé et corrigé

La base contenait déjà des jobs. Deux runs Studio ont été créés sous devalue 5.9.2 et mis en attente par saturation de capacité; leurs événements et waits existaient sur disque avant arrêt. Après changement de version, les données restaient présentes mais aucun traitement ne repartait spontanément : l’application n’appelait pas le démarrage du World local.

`src/instrumentation.ts` appelle désormais `getWorld().start?.()` au démarrage Node **uniquement pour la cible locale**. Ce mécanisme récupère les runs pending/running enregistrés. Sur Vercel, la file est gérée par Vercel; cette modification n’y démarre pas de worker local.

Avec ce correctif, le run créé avant la mise à jour a terminé avec le même `run_id`, une seule tentative et une seule variante. L’autre, annulé en attente, n’a produit aucune variante; les 30 jobs antérieurs sont restés inchangés. Aucun nouveau `dispatch` n’a remplacé le run d’origine.

Le script reproductible a ensuite été exécuté sur `next start`, puis à nouveau après la mise à jour du cache : **56 jobs préexistants inchangés**, reprise avec même run, une tentative/une variante, annulation pending acceptée, annulation processing refusée (409), run annulé terminé par skip. Un pricing sans clé échoue explicitement; retry sans reconnaissance du risque refusé (400), retry explicite effectué et deuxième échec visible. Aucun appel payant.

## Vérifications finales

| Commande / parcours | Résultat |
| --- | --- |
| `npm ci` après chaque changement | Réussi; arbre résolu vérifié avec `npm ls` |
| `npm run db:migrate` | Réussi sur PostgreSQL local existant, aucune migration en attente; aucune nouvelle migration nécessaire |
| `npm run lint`, `npm run typecheck` | Réussis |
| `npm test` | **50/50**, 6 fichiers, vraie base de test jetable pour les intégrations SQL |
| `npm run build` | Réussi; 20 étapes compilées, 1 workflow applicatif |
| `npm run test:e2e` sur `next start` | **10/10**, Chromium ordinateur/mobile, dernier run 35 s |
| Arrêt/redémarrage réel | Script prepare/verify réussi sur le build final, état SQL et fichiers Workflow conservés |
| Inspection visuelle | Inventaire, Studio, commandes et boutique; captures E2E examinées, pas de régression constatée dans ces vues |

## Contenu du build et limites

Les traces `.nft.json` **et les chunks de production** ont été inspectés, en excluant `.next/dev`. Devalue corrigé est bien incorporé côté serveur (message spécifique du parseur trouvé dans cinq chunks). L’alphabet de nanoid apparaît dans deux chunks serveur Workflow; il ne faut pas déduire son absence de ses traces externes. La seule entrée nanoid du trace global Next pointe vers la copie compilée de Next, distincte de celle de Workflow.

Aucune occurrence de http-cache-semantics/braces dans les traces de production ni des marqueurs de leur code dans les chunks examinés. Leur chaîne d’appel observée relève respectivement du téléchargement SWC et du lint. Cette recherche ne constitue pas une preuve formelle d’absence après toute transformation/minification.

**Aucun artefact Vercel déployé n’a été inspecté.** Les constats concernent le build Next local. Une preview et l’inspection de ses fonctions restent nécessaires; publication, checkout Shopify, fournisseurs IA et Blob réels restent bloqués par les accès applicatifs décrits dans deployment.md. Les tests avec doubles ne valident pas ces services.

Une investigation et une revue indépendantes en lecture seule ont examiné le correctif devalue et le démarrage local. La revue n’a pas identifié de régression concrète dans ce périmètre; son complément sur le script a été interrompu par une limite d’usage. La mise à jour du cache, ajoutée ensuite, a été examinée et testée dans la tâche principale, sans deuxième revue indépendante. Aucun audit sécurité exhaustif n’est revendiqué.

## Reproduire le test de redémarrage

Utiliser exclusivement une base locale de démonstration et les comptes du seed, avec `DATABASE_ENV=development`, `DEMO_SEED=true`, `STORAGE_DRIVER=local`, sans clé OpenAI. Serveur et script doivent charger la même `.env.local`; laisser Workflow utiliser sa configuration locale Next par défaut.

1. Lancer `npm run db:local`, puis `npm run db:migrate` (et `npm run db:seed` seulement si la base de démonstration n’est pas initialisée).
2. Compiler avec `npm run build`, puis lancer `npm start`.
3. Exécuter `node --env-file=.env.local scripts/verify-workflow-restart.mjs prepare`.
4. Arrêter et redémarrer le serveur Next, sans recompiler ni supprimer `.next/workflow-data`.
5. Exécuter `node --env-file=.env.local scripts/verify-workflow-restart.mjs verify`.

Le test crée des jobs synthétiques et une variante sur un produit DEMO existant. Les quatre lignes de capacité sont libérées par verify; en cas d’arrêt entre les phases, leurs leases expirent après 45 minutes. Le scénario attend un redémarrage rapide (boucle applicative de capacité limitée à environ dix minutes). Les preuves locales sont dans `.local/workflow-restart` et `.local/dependency-audit`, ignorées par Git. Pour une comparaison traversant `next build`, conserver séparément les fichiers de runs : le build peut effacer `.next`. Le World local est un outil de développement, pas un système de production distribué.

## Références

- Paquets et code publiés inspectés : [devalue 5.9.3](https://www.npmjs.com/package/devalue/v/5.9.3), [http-cache-semantics 4.3.0](https://www.npmjs.com/package/http-cache-semantics/v/4.3.0), [Workflow 5.0.1](https://www.npmjs.com/package/workflow/v/5.0.1).
- Avis npm : GHSA-j22f-vq7h-c4qm, GHSA-4q55-j62x-fr9h (devalue); GHSA-ch52-4w7c-c8xp (cache); GHSA-28wg-ghj8-5hjv / GHSA-xwg4-73v4-xw9w (nanoid); GHSA-vfj7-8cjw-p6xm (braces). La lecture HTTP directe de l’avis GitHub est bloquée par le réseau cloud; les métadonnées d’avis proviennent de `npm audit`.
- Documentation officielle livrée dans les paquets : `next/dist/docs/01-app/02-guides/instrumentation.md`, `workflow/docs/worlds/local.mdx`, `workflow/docs/worlds/postgres.mdx` (exemple d’initialisation), et implémentation `@workflow/world-local/dist/index.js`.
