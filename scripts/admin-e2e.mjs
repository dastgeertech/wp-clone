/**
 * Zero-dependency admin SPA end-to-end check.
 *
 * Drives the real UI in headless Edge over the Chrome DevTools Protocol:
 *   login → dashboard → every admin screen → TipTap editor round-trip
 *   (type → save → reload → verify) → featured-image dialog → trash →
 *   permanent delete → logout.
 *
 * Usage:  node scripts/admin-e2e.mjs
 * Needs:  nx serve admin (:4300), nx serve api (:3333), admin/admin12345.
 */
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { rmSync } from 'node:fs';

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const ADMIN = 'http://localhost:4300';
const PROFILE = process.env.TEMP + '\\wp-clone-edge-e2e';
const USER = 'admin';
const PASS = 'admin12345';
const TITLE = `E2E Draft ${Date.now()}`;
const TYPED = `Typed by the e2e check ${Date.now()}`;

const results = [];
const consoleErrors = [];
const exceptions = [];
let failures = 0;

const check = (name, ok) => {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}`;
  results.push(line);
  console.log(line); // live output so hangs are diagnosable
  if (!ok) failures += 1;
};

// Watchdog: always leave a trail if something stalls.
const watchdog = setTimeout(() => {
  console.error('\nWATCHDOG: e2e exceeded 150s — aborting.');
  process.exit(2);
}, 150_000);

async function main() {
  rmSync(PROFILE, { recursive: true, force: true });

  let edge = launchEdge('new');
  if (!(await devtoolsUp())) {
    edge.kill();
    edge = launchEdge('legacy');
    if (!(await devtoolsUp())) throw new Error('Edge DevTools endpoint never came up');
  }

  const targets = await (
    await fetch(`http://localhost:${PORT}/json/list`, { signal: AbortSignal.timeout(5000) })
  ).json();
  const target = targets.find((t) => t.type === 'page');
  if (!target) throw new Error('No page target found');
  console.log(`edge up — target: ${target.url}`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await Promise.race([
    new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('WebSocket connect failed'));
    }),
    sleep(15_000).then(() => {
      throw new Error('WebSocket open timeout');
    }),
  ]);
  console.log('cdp connected');

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      exceptions.push(`${d?.text ?? ''} ${d?.exception?.description ?? ''}`.trim());
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(
        m.params.args.map((a) => a.value ?? a.description ?? '').join(' '),
      );
    }
  };

  const send = (method, params = {}) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 20_000);
      pending.set(id, (m) => {
        clearTimeout(timer);
        resolve(m);
      });
    });
  };

  const evaluate = async (expression) => {
    try {
      const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.result?.exceptionDetails) return undefined;
      return r.result?.result?.value;
    } catch {
      return undefined;
    }
  };

  const waitFor = async (expression, timeout = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try {
        if (await evaluate(`Boolean(${expression})`)) return true;
      } catch {
        /* execution context may be mid-navigation */
      }
      await sleep(300);
    }
    return false;
  };

  const setVal = (sel, value) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);

  const clickText = (selector, text) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((b) => b.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}));
      if (!el) return false;
      el.click();
      return true;
    })()`);

  const clickDialog = (text) => clickText('.cdk-overlay-container button', text);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: `${ADMIN}/` });

  /* ---------------- login ---------------- */
  const loginOk = await waitFor(`document.querySelector('#identifier')`);
  if (!loginOk) {
    console.log('DIAG url:', await evaluate('location.href'));
    console.log('DIAG readyState:', await evaluate('document.readyState'));
    console.log(
      'DIAG body:',
      String(await evaluate('document.body?.innerText?.slice(0, 400)')).replace(/\n/g, ' | '),
    );
    console.log('DIAG html:', String(await evaluate('document.body?.innerHTML?.slice(0, 800)')));
    console.log('DIAG exceptions:', JSON.stringify(exceptions.slice(0, 5)));
    console.log('DIAG console.error:', JSON.stringify(consoleErrors.slice(0, 5)));
  }
  check('login screen renders', loginOk);
  await setVal('#identifier', USER);
  await setVal('#password', PASS);
  await evaluate(
    `(() => { const b = document.querySelector('form button'); if (b) b.click(); return true; })()`,
  );
  check(
    'login → dashboard',
    await waitFor(`location.pathname === '/' && document.body.innerText.includes('Howdy')`),
  );
  check(
    'dashboard widgets load',
    await waitFor(`document.querySelector('h1')?.innerText.includes('Dashboard') &&
                   document.body.innerText.includes('At a Glance')`),
  );

  /* ---------------- every screen ---------------- */
  const screens = [
    ['/posts', `document.querySelector('h1')?.innerText.includes('Posts') &&
                document.querySelectorAll('tbody tr').length > 0`, 'posts list has rows'],
    ['/pages', `document.querySelector('h1')?.innerText.includes('Pages')`, 'pages list'],
    ['/media', `document.querySelector('h1')?.innerText.includes('Media Library')`, 'media library'],
    ['/comments', `document.querySelector('h1')?.innerText.includes('Comments')`, 'comments list'],
    ['/appearance/themes', `document.querySelector('h1')?.innerText.includes('Themes') &&
                            document.querySelectorAll('article').length >= 3`, 'themes (3 cards)'],
    ['/appearance/customizer', `document.querySelector('h1')?.innerText.includes('Customize') &&
                                document.querySelectorAll('input[type=color]').length >= 1`, 'customizer form'],
    ['/appearance/menus', `document.querySelector('h1')?.innerText.includes('Menus')`, 'menus editor'],
    ['/users', `document.querySelector('h1')?.innerText.includes('Users') &&
                document.querySelectorAll('tbody tr').length >= 3`, 'users (3 accounts)'],
    ['/settings', `document.querySelector('h1')?.innerText.includes('Settings') &&
                   document.querySelector('#siteTitle')`, 'settings form'],
  ];
  for (const [path, expr, name] of screens) {
    await send('Page.navigate', { url: ADMIN + path });
    check(name, await waitFor(expr));
  }

  /* ---------------- post editor round-trip ---------------- */
  await send('Page.navigate', { url: `${ADMIN}/posts/new` });
  check(
    'editor + TipTap boot',
    await waitFor(`document.querySelector('.wp-title-input') && document.querySelector('.ProseMirror')`),
  );

  await setVal('.wp-title-input', TITLE);
  check(
    'type into TipTap',
    await evaluate(`(() => {
      const pm = document.querySelector('.ProseMirror');
      pm.focus();
      return document.execCommand('insertText', false, ${JSON.stringify(TYPED)});
    })()`) && (await waitFor(`document.querySelector('.ProseMirror').innerText.includes(${JSON.stringify(TYPED)})`)),
  );

  check('permalink preview updates', await waitFor(`document.body.innerText.includes('/e2e-draft-')`));

  check('save draft → edit route', await clickText('button', 'Save Draft') &&
    await waitFor(`location.pathname.startsWith('/posts/') && location.pathname !== '/posts/new'`));
  await sleep(600);
  check(
    'title round-trips',
    await waitFor(`document.querySelector('.wp-title-input')?.value === ${JSON.stringify(TITLE)}`),
  );
  check(
    'TipTap content round-trips through the API',
    await waitFor(`document.querySelector('.ProseMirror')?.innerText.includes(${JSON.stringify(TYPED)})`),
  );

  check('featured image dialog opens', await clickText('button', 'Set featured image') &&
    await waitFor(`document.querySelector('.cdk-overlay-container')?.childElementCount > 0`));
  check('featured image dialog closes', await clickDialog('Cancel'));

  /* ---------------- trash → permanent delete ---------------- */
  check('move to trash', await clickText('button', 'Move to Trash') &&
    await clickDialog('OK') &&
    await waitFor(`location.pathname === '/posts'`));

  await send('Page.navigate', { url: `${ADMIN}/posts?status=TRASH` });
  check('trashed post visible in Trash view', await waitFor(`document.body.innerText.includes(${JSON.stringify(TITLE)})`));
  check('delete permanently', await evaluate(`(() => {
      const row = [...document.querySelectorAll('tbody tr')]
        .find((r) => r.textContent.includes(${JSON.stringify(TITLE)}));
      if (!row) return false;
      const btn = [...row.querySelectorAll('button')]
        .find((b) => b.textContent.includes('Delete Permanently'));
      if (!btn) return false;
      btn.click();
      return true;
    })()`) && await clickDialog('Delete'));
  check('post gone after delete', await waitFor(
    `![...document.querySelectorAll('tbody tr')].some((r) => r.textContent.includes(${JSON.stringify(TITLE)}))`,
    15000,
  ));

  /* ---------------- logout + unauthenticated guard ---------------- */
  await send('Page.navigate', { url: `${ADMIN}/` });
  check('session survives reload (token in storage)', await waitFor(`document.body.innerText.includes('Howdy')`, 15000));
  await evaluate(`(() => {
      const b = [...document.querySelectorAll('header button')].find((x) => x.textContent.includes('Log Out'));
      if (b) b.click();
      return true;
    })()`);
  check('logout → login screen', await waitFor(`location.pathname === '/login'`, 8000));

  await send('Page.navigate', { url: `${ADMIN}/settings` });
  check('guard: logged-out /settings → /login', await waitFor(
    `location.pathname === '/login'`,
    15000,
  ));

  /* ---------------- verdict ---------------- */
  console.log('\n=== admin e2e summary ===');
  if (exceptions.length) {
    console.log('Uncaught page exceptions:');
    for (const e of exceptions) console.log('  ! ' + e.slice(0, 300));
  }
  if (consoleErrors.length) {
    console.log('console.error (non-fatal):');
    for (const e of [...new Set(consoleErrors)].slice(0, 10)) console.log('  · ' + e.slice(0, 200));
  }
  const passed = results.length - failures;
  console.log(`${passed}/${results.length} checks passed` + (failures ? `, ${failures} FAILED` : ''));
  if (exceptions.length) failures += 1;

  ws.close();
  clearTimeout(watchdog);
  spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
  process.exit(failures ? 1 : 0);
}

function launchEdge(mode) {
  const args = [
    mode === 'new' ? '--headless=new' : '--headless',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    'about:blank',
  ];
  return spawn(EDGE, args, { stdio: 'ignore', windowsHide: true });
}

async function devtoolsUp() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/json/version`, {
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

main().catch((err) => {
  console.error('admin e2e crashed:', err);
  process.exit(1);
});
