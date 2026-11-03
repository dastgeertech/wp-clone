/**
 * Visual verification: screenshots the public site (all 3 themes) and the
 * wp-admin panel in headless Edge via CDP (zero dependencies).
 *
 * Usage: node scripts/screenshots.mjs
 * Needs: prod or dev web server (:4100 preferred, falls back to :4200),
 *        nx serve admin (:4300), nx serve api (:3333).
 * Output: screenshots/*.png
 */
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9334;
const PROFILE = process.env.TEMP + '\\wp-clone-shots';
const OUT = 'screenshots';
const API = 'http://localhost:3333/api';

const WEB = (await reachable('http://localhost:4100/')) ? 'http://localhost:4100'
  : (await reachable('http://localhost:4200/')) ? 'http://localhost:4200'
  : (() => { throw new Error('No web server on :4100 or :4200'); })();

async function reachable(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

async function main() {
  rmSync(PROFILE, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const edge = launchEdge();
  if (!(await devtoolsUp())) throw new Error('Edge DevTools never came up');

  const targets = await (await fetch(`http://localhost:${PORT}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws failed')); });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 20_000);
      pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
    });
  };
  const evaluate = async (expression) => {
    try {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) return undefined;
      return r.result?.result?.value;
    } catch { return undefined; }
  };
  const waitFor = async (expression, timeout = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await evaluate(`Boolean(${expression})`)) return true; } catch {}
      await sleep(300);
    }
    return false;
  };
  const shot = async (name) => {
    await sleep(700); // settle fonts/layout
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
    console.log(`  saved ${OUT}/${name}.png`);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true }); // HTML is max-age=60 — never serve stale shots
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });

  /* -------- public site: every theme -------- */
  const original = await (await fetch(`${API}/themes/active`)).json();
  console.log(`active theme: ${original.id}`);

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin12345' }),
  }).then((r) => r.json());
  if (!login.accessToken) throw new Error('admin login failed: ' + JSON.stringify(login));

  const activate = async (id) => {
    const res = await fetch(`${API}/themes/${id}/activate`, {
      method: 'POST', headers: { authorization: `Bearer ${login.accessToken}` },
    });
    if (!res.ok) throw new Error(`activate ${id} → HTTP ${res.status}`);
    console.log(`activated ${id}`);
  };

  let current = original.id;
  for (const id of ['modern', 'classic', 'minimal']) {
    if (current !== id) { await activate(id); current = id; }

    await send('Page.navigate', { url: `${WEB}/` });
    // wait for the EXPECTED theme root to render (proves the switch landed)
    const rendered = await waitFor(`!!document.querySelector('wp-${id}-theme')`);
    console.log(`  ${id} home rendered: ${rendered ? 'OK' : 'WRONG THEME (' +
      (await evaluate(`[...document.querySelectorAll('wp-classic-theme,wp-modern-theme,wp-minimal-theme')].map(e=>e.tagName).join(',')`) || 'none') + ')'}`);
    await shot(`theme-${id}-home`);

    await send('Page.navigate', { url: `${WEB}/hello-world/` });
    await waitFor(`document.body.innerText.includes('Hello world')`);
    await waitFor(`!!document.querySelector('wp-${id}-theme')`);
    await shot(`theme-${id}-post`);
  }

  await activate(original.id); // always restore the originally-active theme

  /* -------- wp-admin (logged in) -------- */
  if (await reachable('http://localhost:4300/')) {
    const diag = async (label) => {
      const info = await evaluate(`(() => ({
        path: location.pathname + location.search,
        text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 90),
        tables: document.querySelectorAll('tbody tr').length,
        prose: !!document.querySelector('.ProseMirror'),
        colors: document.querySelectorAll('input[type=color]').length,
        login: !!document.querySelector('#identifier'),
      }))()`);
      console.log(`  [${label}] ${JSON.stringify(info)}`);
    };
    const goto = async (url, marker, name) => {
      await send('Page.navigate', { url });
      // wait for the URL itself first, then the content marker — a stale DOM
      // can satisfy content selectors before the navigation commits
      await waitFor(`location.pathname === '${new URL(url).pathname}'`, 20000);
      const ok = await waitFor(marker, 20000);
      await diag(`${name}${ok ? '' : ' MARKER-TIMEOUT'}`);
      await shot(name);
    };

    await send('Page.navigate', { url: 'http://localhost:4300/' });
    await waitFor(`location.pathname === '/'`, 20000);
    if (await waitFor(`!!document.querySelector('#identifier')`, 8000)) {
      // fresh browser profile → no stored token, log in through the UI.
      // Fill and click must be SEPARATE evaluates: the submit button is
      // [disabled]="f.invalid" and only re-enables after change detection
      // runs, which can't happen inside the same synchronous block.
      const setVal = (sel, v) => evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return false;
        el.value = ${JSON.stringify(v)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      await setVal('#identifier', 'admin');
      await setVal('#password', 'admin12345');
      await waitFor(`!document.querySelector('form button').disabled`, 8000);
      await evaluate(`(() => {
        const b = document.querySelector('form button');
        if (!b || b.disabled) return false;
        b.click(); return true;
      })()`);
      if (!(await waitFor(`document.body.innerText.includes('Howdy')`, 20000))) {
        console.log('  login FAILED — showing: ' +
          (await evaluate(`(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,120)`) ?? '?'));
      }
    }
    await diag('admin-dashboard');
    await shot('admin-dashboard');
    await goto('http://localhost:4300/posts', `document.querySelectorAll('tbody tr').length > 0`, 'admin-posts');
    await goto('http://localhost:4300/posts/new', `!!document.querySelector('.ProseMirror')`, 'admin-editor');
    await goto('http://localhost:4300/appearance/customizer', `document.querySelectorAll('input[type=color]').length > 0`, 'admin-customizer');
  } else {
    console.log('admin (:4300) not reachable — skipping admin shots');
  }

  ws.close();
  spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
  console.log('done');
  process.exit(0);
}

function launchEdge() {
  return spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
}

async function devtoolsUp() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/json/version`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

void existsSync; void readFileSync;

main().catch((err) => { console.error('screenshots failed:', err); process.exit(1); });
