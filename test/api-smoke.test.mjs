import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sample = (n) => readFileSync(new URL(`../samples/${n}`, import.meta.url), 'utf8')
const mod = (n) => import(`../src/${n}.mjs`)
const run = (n, args = []) => spawnSync(process.execPath, [fileURLToPath(new URL(`../src/${n}.mjs`, import.meta.url)), ...args], { encoding: 'utf8' })
const samplePath = (n) => fileURLToPath(new URL(`../samples/${n}`, import.meta.url))

test('22 API : statut, JSON, contenu, variables d\'environnement', async () => {
  const { runChecks, getPath, substitute } = await mod('api-smoke')
  assert.equal(getPath({ a: { b: [{ c: 5 }] } }, 'a.b[0].c'), 5); assert.equal(getPath({}, 'x.y'), undefined)
  assert.equal(substitute('Bearer ${T}', { T: 'abc' }), 'Bearer abc'); assert.throws(() => substitute('${ABSENT}', {}), /ABSENT/)
  const seen = []
  const fetchImpl = async (url, opts) => { seen.push([url, opts.headers.authorization]); return url.endsWith('/health') ? new Response('{"status":"ok","n":[1]}', { status: 200 }) : new Response('nope', { status: 500 }) }
  const spec = { baseUrl: 'https://api.test', checks: [
    { name: 'santé', path: '/health', json: { status: 'ok', 'n[0]': 1 } },
    { name: 'mauvais json', path: '/health', json: { status: 'ko' } },
    { name: 'erreur', path: '/boom', headers: { authorization: 'Bearer ${T}' }, contains: 'ok' } ] }
  const r = await runChecks(spec, { fetchImpl, env: { T: 'jeton' } })
  assert.deepEqual(r.map((x) => x.ok), [true, false, false])
  assert.match(r[1].problems[0], /status/); assert.match(r[2].problems.join(' '), /statut 500/)
  assert.equal(seen[2][1], 'Bearer jeton'); assert.ok(!JSON.stringify(r).includes('jeton'))
})
