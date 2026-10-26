## What it's for

A "smoke test" checks in a few seconds that the essentials of an API work after a deployment: the health route answers, authentication passes, a key endpoint returns the right fields. You describe the checks in a JSON file, no code required.

## Before you start

- A specification file (see the example below).
- For protected routes, a token placed in an **environment variable** (never in the file).

## Step by step

1. Write `smoke.json`:
   ```json
   { "baseUrl": "https://api.example.com",
     "checks": [
       { "name": "health", "path": "/health", "status": 200, "json": { "status": "ok" }, "maxMs": 1500 },
       { "name": "profile", "path": "/me", "headers": { "authorization": "Bearer ${API_TOKEN}" }, "json": { "id": "*" } }
     ] }
   ```
2. Run:
   ```bash
   API_TOKEN=... node src/api-smoke.mjs smoke.json
   ```
3. `"*"` means "this field must exist"; any other value must match exactly. Paths are written `a.b[0].c`.

## Reading the output

`✓` or `✗` per check, with the reason for failure (status, field, slowness). Exit code 2 if a check fails. Environment variable values are never printed.

## Automating it

In CI, right after `21-wait-for-url`, against the staging environment.

## Pitfalls

- In production, only test routes with no side effects (reads).
- A smoke test does not replace your functional tests: it says "it's breathing", not "it works everywhere".
