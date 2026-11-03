/**
 * Zero-dependency API smoke test (Node 24+).
 * Usage: node scripts/smoke.mjs [apiBaseUrl]
 * Expects a running API + seeded database (npm run setup).
 */
const API = (process.argv[2] ?? 'http://localhost:3333/api').replace(/\/$/, '');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  \x1b[32mPASS\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${name} ${extra}`); }
};
const section = (n) => console.log(`\n\x1b[1m${n}\x1b[0m`);

const j = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { res, body };
};

const doc = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

async function main() {
  section('Public content API');
  const { res: bres, body: boot } = await j('/content/bootstrap');
  ok('bootstrap 200', bres.status === 200);
  ok('bootstrap has options', !!boot?.options?.siteTitle);
  ok('bootstrap has active theme', !!boot?.theme?.id && !!boot?.theme?.settingsSchema?.length);
  ok('bootstrap has menus + categories', Array.isArray(boot?.menus) && Array.isArray(boot?.categories));

  const home = await j('/content/home');
  ok('home lists published posts', home.res.status === 200 && Array.isArray(home.body?.items));

  section('Auth');
  const { res: lres, body: login } = await j('/auth/login', {
    method: 'POST', body: JSON.stringify({ identifier: 'admin', password: 'admin12345' }),
  });
  ok('login', lres.status === 200 && !!login?.accessToken);
  const H = { authorization: `Bearer ${login.accessToken}` };
  const me = await j('/auth/me', { headers: H });
  ok('me', me.body?.username === 'admin');

  const cookie = lres.headers.get('set-cookie')?.split(';')[0];
  const refreshed = await fetch(`${API}/auth/refresh`, {
    method: 'POST', headers: { cookie },
  });
  const rbody = await refreshed.json().catch(() => null);
  ok('refresh rotation', refreshed.status === 200 && !!rbody?.accessToken);

  const bad = await j('/auth/login', {
    method: 'POST', body: JSON.stringify({ identifier: 'admin', password: 'wrong-password' }),
  });
  ok('bad login rejected', bad.res.status === 401, `got ${bad.res.status}`);

  section('Posts lifecycle');
  const slug = `smoke-${Date.now()}`;
  const created = await j('/posts', {
    method: 'POST', headers: H,
    body: JSON.stringify({ title: 'Smoke test', slug, status: 'DRAFT', content: doc('Hello smoke') }),
  });
  const id = created.body?.id;
  ok('create draft', created.res.status === 201 && created.body?.status === 'DRAFT');

  const notPublic = await j(`/content/posts/${slug}`);
  ok('draft hidden from public', notPublic.res.status === 404);

  await j(`/posts/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'PUBLISHED' }) });
  const pub = await j(`/content/posts/${slug}`);
  ok('published + SSR-visible', pub.res.status === 200 && pub.body?.contentHtml?.includes('Hello smoke'));
  ok('absolute og image field present', 'featuredImage' in pub.body);

  const renamed = await j(`/posts/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ slug: `${slug}-b` }) });
  ok('slug rename', renamed.body?.slug === `${slug}-b`);
  const redir = await j(`/content/redirect?from=/${slug}`);
  ok('301 recorded', redir.body?.to === `/${slug}-b` && redir.body?.status === 301);

  section('Comments');
  const c = await j('/comments', {
    method: 'POST',
    body: JSON.stringify({ postId: pub.body.id, authorName: 'Smoke', authorEmail: 's@example.com', content: 'hi', website: '' }),
  });
  ok('guest comment → pending', c.body?.status === 'pending');

  const pending = await j('/comments?status=PENDING', { headers: H });
  ok('moderation queue lists it', pending.body?.items?.some((x) => x.id === c.body.id));
  await j(`/comments/${c.body.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'APPROVED' }) });
  const approved = await j(`/comments/post/${pub.body.id}`);
  ok('approved comment public', approved.body?.some((x) => x.id === c.body.id));

  const spam = await j('/comments', {
    method: 'POST',
    body: JSON.stringify({ postId: pub.body.id, authorName: 'Bot', authorEmail: 'b@example.com', content: 'buy', website: 'http://spam' }),
  });
  ok('honeypot → spam', spam.body?.status === 'spam');

  section('Media (sharp pipeline)');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'px.png');
  const up = await fetch(`${API}/media`, { method: 'POST', headers: H, body: fd });
  const media = await up.json();
  ok('upload', up.status === 201 && !!media?.id);
  // 1x1 image: no upscale → no variants. Wider images get 320/768/... WebP.
  ok('variants match size contract',
    media?.width >= 320 ? !!media?.variants?.webp?.['320'] : Object.keys(media?.variants?.webp ?? {}).length === 0);
  if (media?.variants?.webp?.['320']) {
    const fileOk = await fetch(`${API}${media.variants.webp['320']}`);
    ok('variant served', fileOk.status === 200);
  }
  await fetch(`${API}/media/${media.id}`, { method: 'DELETE', headers: H });

  section('SEO');
  const sm = await (await fetch(`${API}/seo/sitemap`)).text();
  ok('sitemap xml', sm.startsWith('<?xml') && sm.includes(`<loc>`));
  const rb = await (await fetch(`${API}/seo/robots`)).text();
  ok('robots + sitemap link', rb.includes('User-agent:') && rb.includes('Sitemap:'));

  section('RBAC');
  const au = await j('/auth/login', {
    method: 'POST', body: JSON.stringify({ identifier: 'author', password: 'admin12345' }),
  });
  const AH = { authorization: `Bearer ${au.body.accessToken}` };
  for (const [name, path] of [['users', '/users'], ['moderation', '/comments'], ['options', '/options']]) {
    const r = await j(path, { headers: AH });
    ok(`author blocked from ${name}`, r.res.status === 403, `got ${r.res.status}`);
  }
  const own = await j('/posts?perPage=100', { headers: AH });
  ok('author sees only own posts', own.body?.items?.every((p) => p.author.id === au.body.user.id));

  section('Themes');
  const themes = await j('/themes', { headers: H });
  ok('3 themes listed', themes.body?.length >= 3);
  await j('/themes/modern/activate', { method: 'POST', headers: H });
  const active = await j('/themes/active');
  ok('activate modern', active.body?.id === 'modern');
  await j('/themes/classic/activate', { method: 'POST', headers: H });

  section('Cleanup');
  await j(`/posts/${id}`, { method: 'DELETE', headers: H });
  const gone = await j(`/posts/${id}`, { method: 'DELETE', headers: H });
  ok('trash → permanent delete', gone.res.status === 204);
  await j(`/comments/${c.body.id}`, { method: 'DELETE', headers: H });

  console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
