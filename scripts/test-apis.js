#!/usr/bin/env node
/**
 * External API smoke tests — run from project root:
 *   node scripts/test-apis.js
 *
 * Reads keys from .env.local (root), then backend/.env, then environment.
 * Each test makes one minimal API call and prints PASS / FAIL + details.
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ── Load env files ────────────────────────────────────────────────────────────

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}

const root = path.join(__dirname, '..');
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, 'backend', '.env'));
loadEnvFile(path.join(root, '.env'));

// Normalise alternate key names
if (!process.env.OPENAI_API_KEY && process.env.OPEN_API_KEY)
  process.env.OPENAI_API_KEY = process.env.OPEN_API_KEY;
if (!process.env.AVIATIONSTACK_API_KEY && process.env.AVIATIONSTACK_API)
  process.env.AVIATIONSTACK_API_KEY = process.env.AVIATIONSTACK_API;

// ── Helpers ───────────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const YELLOW= '\x1b[33m';
const RESET = '\x1b[0m';

const results = [];

function pass(name, detail = '') {
  console.log(`${GREEN}✓ PASS${RESET}  ${name}${detail ? '  — ' + detail : ''}`);
  results.push({ name, status: 'pass' });
}

function fail(name, detail = '') {
  console.log(`${RED}✗ FAIL${RESET}  ${name}${detail ? '  — ' + detail : ''}`);
  results.push({ name, status: 'fail', detail });
}

function skip(name, reason) {
  console.log(`${YELLOW}– SKIP${RESET}  ${name}  — ${reason}`);
  results.push({ name, status: 'skip', detail: reason });
}

async function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function post(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testEIA() {
  const key = process.env.EIA_API_KEY;
  if (!key) return skip('EIA oil prices', 'EIA_API_KEY not set');
  try {
    const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&length=1`;
    const res = await get(url);
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.response?.data?.length > 0) {
      pass('EIA oil prices', `Brent $${data.response.data[0].value}/bbl on ${data.response.data[0].period}`);
    } else {
      fail('EIA oil prices', `HTTP ${res.status}: ${res.body.slice(0, 120)}`);
    }
  } catch (e) { fail('EIA oil prices', e.message); }
}

async function testAviationStack() {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) return skip('AviationStack flights', 'AVIATIONSTACK_API_KEY / AVIATIONSTACK_API not set');
  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${key}&limit=1&flight_status=active`;
    const res = await get(url);
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.data?.length > 0) {
      const f = data.data[0];
      pass('AviationStack flights', `${f.flight?.iata || 'unknown'} ${f.departure?.iata}→${f.arrival?.iata}`);
    } else if (data.error) {
      fail('AviationStack flights', `${data.error.code}: ${data.error.message}`);
    } else {
      fail('AviationStack flights', `HTTP ${res.status}: ${res.body.slice(0, 120)}`);
    }
  } catch (e) { fail('AviationStack flights', e.message); }
}

async function testACLED() {
  const token = process.env.ACLED_ACCESS_TOKEN;
  const email = process.env.ACLED_EMAIL;
  const password = process.env.ACLED_PASSWORD;
  if (!token && (!email || !password)) return skip('ACLED conflicts', 'ACLED_ACCESS_TOKEN (or ACLED_EMAIL+ACLED_PASSWORD) not set');
  try {
    let url = 'https://acleddata.com/api/acled/read?limit=1&format=json';
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      url += `&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    }
    const res = await get(url, headers);
    if (res.status === 401) return fail('ACLED conflicts', 'token expired — regenerate with: curl -X POST https://acleddata.com/oauth/token -d "username=<email>&password=<pw>&grant_type=password&client_id=acled"');
    if (res.status === 403) return fail('ACLED conflicts', 'forbidden — check credentials');
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.status === 200 && data.data?.length > 0) {
      const e = data.data[0];
      pass('ACLED conflicts', `${e.event_type} in ${e.country} (${e.event_date})`);
    } else {
      fail('ACLED conflicts', `HTTP ${res.status}: ${data.error || res.body.slice(0, 120)}`);
    }
  } catch (e) { fail('ACLED conflicts', e.message); }
}

async function testAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return skip('Anthropic Claude', 'ANTHROPIC_API_KEY not set');
  try {
    const res = await post(
      'https://api.anthropic.com/v1/messages',
      { model: 'claude-haiku-4-5-20251001', max_tokens: 16, messages: [{ role: 'user', content: 'say hi' }] },
      { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
    );
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.content?.[0]?.text) {
      pass('Anthropic Claude', `haiku replied: "${data.content[0].text.trim().slice(0, 40)}"`);
    } else {
      fail('Anthropic Claude', `HTTP ${res.status}: ${data.error?.message || res.body.slice(0, 120)}`);
    }
  } catch (e) { fail('Anthropic Claude', e.message); }
}

async function testOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return skip('OpenAI', 'OPENAI_API_KEY / OPEN_API_KEY not set');
  try {
    const res = await post(
      'https://api.openai.com/v1/chat/completions',
      { model: 'gpt-4o-mini', max_tokens: 8, messages: [{ role: 'user', content: 'say hi' }] },
      { Authorization: `Bearer ${key}` }
    );
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.choices?.[0]?.message?.content) {
      pass('OpenAI gpt-4o-mini', `replied: "${data.choices[0].message.content.trim().slice(0, 40)}"`);
    } else {
      fail('OpenAI gpt-4o-mini', `HTTP ${res.status}: ${data.error?.message || res.body.slice(0, 120)}`);
    }
  } catch (e) { fail('OpenAI gpt-4o-mini', e.message); }
}

async function testTiingo() {
  const key = process.env.TIINGO_API_KEY;
  if (!key) return skip('Tiingo financial news', 'TIINGO_API_KEY not set');
  try {
    const url = `https://api.tiingo.com/tiingo/news?token=${key}&tickers=xom&limit=1`;
    const res = await get(url, { 'Content-Type': 'application/json' });
    const data = JSON.parse(res.body);
    if (res.status === 200 && Array.isArray(data) && data.length > 0) {
      const a = data[0];
      pass('Tiingo financial news', `"${a.title?.slice(0, 50)}" (${a.source})`);
    } else if (res.status === 401 || res.status === 403) {
      fail('Tiingo financial news', 'invalid or expired API token');
    } else if (res.status === 200 && Array.isArray(data) && data.length === 0) {
      pass('Tiingo financial news', 'connected — no XOM articles at this moment');
    } else {
      fail('Tiingo financial news', `HTTP ${res.status}: ${res.body.slice(0, 120)}`);
    }
  } catch (e) { fail('Tiingo financial news', e.message); }
}

// ── Run all ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nNewsflash — External API Smoke Tests\n' + '─'.repeat(45));
  await testEIA();
  await testAviationStack();
  await testACLED();
  await testAnthropic();
  await testOpenAI();
  await testTiingo();

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log('\n' + '─'.repeat(45));
  console.log(`${passed} passed · ${failed} failed · ${skipped} skipped`);
  if (failed > 0) process.exit(1);
})();
