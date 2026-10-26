#!/usr/bin/env node
/* Test de fumée d'une API : une liste de requêtes décrite en JSON, avec les statuts et contenus attendus.
   Les valeurs « ${VARIABLE} » sont remplacées par l'environnement (jetons) et jamais affichées. */
import { readFileSync } from 'node:fs'
import { isMain, parseArgs, usage, fail } from '../lib/cli.mjs'

/** Lit « a.b[0].c » dans un objet. */
export function getPath(obj, path) {
  return path.split(/\.|\[(\d+)\]/).filter((p) => p !== undefined && p !== '').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj)
}

export function substitute(value, env = process.env) {
  if (typeof value === 'string') return value.replace(/\$\{(\w+)\}/g, (_, k) => { if (!(k in env)) throw new Error(`variable d'environnement absente : ${k}`); return env[k] })
  if (Array.isArray(value)) return value.map((v) => substitute(v, env))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, env)]))
  return value
}

/** Spec : { baseUrl, checks: [{ name, method, path, headers, body, status, json: {chemin: valeur}, contains, maxMs }] } */
export async function runChecks(spec, { fetchImpl = fetch, env = process.env } = {}) {
  const results = []
  for (const raw of spec.checks ?? []) {
    const c = substitute(raw, env)
    const started = Date.now()
    const problems = []
    try {
      const res = await fetchImpl(new URL(c.path ?? '', substitute(spec.baseUrl ?? '', env)).toString(), {
        method: c.method ?? 'GET', headers: { 'user-agent': 'elzam-api-smoke/1.0', ...(c.body ? { 'content-type': 'application/json' } : {}), ...(c.headers ?? {}) },
        body: c.body ? JSON.stringify(c.body) : undefined, redirect: 'manual',
      })
      const text = await res.text()
      const ms = Date.now() - started
      if (res.status !== (c.status ?? 200)) problems.push(`statut ${res.status} au lieu de ${c.status ?? 200}`)
      if (c.maxMs && ms > c.maxMs) problems.push(`trop lent : ${ms} ms (max ${c.maxMs})`)
      if (c.contains && !text.includes(c.contains)) problems.push(`le corps ne contient pas « ${c.contains} »`)
      if (c.json) {
        let data
        try { data = JSON.parse(text) } catch { problems.push('réponse non JSON') }
        if (data !== undefined) for (const [p, expected] of Object.entries(c.json)) {
          const actual = getPath(data, p)
          if (expected === '*' ? actual === undefined : JSON.stringify(actual) !== JSON.stringify(expected)) problems.push(`${p} : ${actual === undefined ? 'absent' : JSON.stringify(actual)} au lieu de ${JSON.stringify(expected)}`)
        }
      }
      results.push({ name: c.name ?? `${c.method ?? 'GET'} ${c.path}`, ok: problems.length === 0, status: res.status, ms, problems })
    } catch (e) { results.push({ name: c.name ?? c.path, ok: false, status: 0, ms: Date.now() - started, problems: [e.cause?.code ?? e.message] }) }
  }
  return results
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), ['help'])
  usage(`
Usage : node src/api-smoke.mjs spec.json
Exemple de spec : { "baseUrl": "https://api.exemple.com", "checks": [
  { "name": "santé", "path": "/health", "status": 200, "json": { "status": "ok" }, "maxMs": 1500 },
  { "name": "profil", "path": "/me", "headers": { "authorization": "Bearer \${API_TOKEN}" }, "status": 200 } ] }
Code de sortie 2 si une vérification échoue.`, args, 1)
  let results
  try { results = await runChecks(JSON.parse(readFileSync(args._[0], 'utf8'))) } catch (e) { fail(e.message) }
  results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name} — ${r.status || '---'} · ${r.ms} ms${r.problems.length ? `\n    ${r.problems.join('\n    ')}` : ''}`))
  const bad = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - bad}/${results.length} vérifications réussies.`)
  process.exit(bad ? 2 : 0)
}
