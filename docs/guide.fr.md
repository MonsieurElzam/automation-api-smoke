## À quoi ça sert

Un « test de fumée » vérifie en quelques secondes que l'essentiel d'une API fonctionne après un déploiement : la route de santé répond, l'authentification passe, un endpoint clé renvoie les bons champs. Vous décrivez les vérifications dans un fichier JSON, sans écrire de code.

## Avant de commencer

- Un fichier de spécification (voir l'exemple ci-dessous).
- Pour les routes protégées, un jeton placé dans une **variable d'environnement** (jamais dans le fichier).

## Pas à pas

1. Écrivez `smoke.json` :
   ```json
   { "baseUrl": "https://api.exemple.com",
     "checks": [
       { "name": "santé", "path": "/health", "status": 200, "json": { "status": "ok" }, "maxMs": 1500 },
       { "name": "profil", "path": "/me", "headers": { "authorization": "Bearer ${API_TOKEN}" }, "json": { "id": "*" } }
     ] }
   ```
2. Lancez :
   ```bash
   API_TOKEN=... node src/api-smoke.mjs smoke.json
   ```
3. `"*"` signifie « ce champ doit exister » ; une autre valeur doit correspondre exactement. Les chemins s'écrivent `a.b[0].c`.

## Lire le résultat

`✓` ou `✗` par vérification, avec le motif de l'échec (statut, champ, lenteur). Code de sortie 2 si une vérification échoue. Les valeurs des variables d'environnement ne sont jamais affichées.

## L'automatiser

En CI, juste après `21-wait-for-url`, sur l'environnement de pré-production.

## Pièges à éviter

- Ne testez en production que des routes sans effet de bord (lectures).
- Un test de fumée ne remplace pas vos tests fonctionnels : il dit « ça respire », pas « ça marche partout ».
