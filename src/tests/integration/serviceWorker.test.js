import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SW_PATH = join(REPO_ROOT, 'public', 'sw.js');

/**
 * public/sw.js had no tests, which is how it shipped for releases as a bare
 * `event.respondWith(fetch(event.request))` — a passthrough that cached
 * nothing, so an app documented and marketed as offline-first had no offline
 * availability at all. The same worker called `skipWaiting()` on install and
 * then `client.navigate()` on every open window, force-reloading the tab out
 * from under the user roughly every twelve seconds and making the app's own
 * "update available" prompt unreachable.
 *
 * It cannot be imported: it is a classic worker script that reads a `self`
 * global that does not exist in Node. So it is evaluated in a vm context with
 * a fake ServiceWorkerGlobalScope, and the handlers it registers are invoked
 * directly. That also makes the negative assertions possible — proving the
 * worker does NOT skipWaiting or navigate clients is the point.
 */

const ORIGIN = 'https://spotli.test';

/** A Cache/CacheStorage pair faithful enough for what sw.js actually calls. */
function createCacheStorage(fetchImpl) {
  const stores = new Map();

  const makeCache = (name) => {
    const entries = new Map();
    const keyOf = (req) => (typeof req === 'string' ? new URL(req, ORIGIN).href : req.url);
    return {
      _entries: entries,
      async put(req, res) { entries.set(keyOf(req), res); },
      async match(req) { return entries.get(keyOf(req)); },
      async add(req) {
        const res = await fetchImpl(req);
        // Matches the real Cache.add: a non-2xx response rejects.
        if (!res || !res.ok) throw new TypeError('Request failed');
        entries.set(keyOf(req), res);
      },
      async keys() { return [...entries.keys()].map((url) => ({ url })); },
      async delete(req) { return entries.delete(keyOf(req)); },
      name
    };
  };

  return {
    _stores: stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, makeCache(name));
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(req) {
      for (const cache of stores.values()) {
        const hit = await cache.match(req);
        if (hit) return hit;
      }
      return undefined;
    },
    _seed(name, url, response) {
      if (!stores.has(name)) stores.set(name, makeCache(name));
      stores.get(name)._entries.set(new URL(url, ORIGIN).href, response);
    }
  };
}

function loadServiceWorker({ version = '9.9.9', fetchImpl } = {}) {
  const raw = readFileSync(SW_PATH, 'utf8');
  // The build substitutes this; assert the contract rather than assume it.
  expect(raw).toContain('__APP_VERSION__');
  const source = raw.replace(/__APP_VERSION__/g, version);

  const listeners = {};
  const fetchMock = fetchImpl || vi.fn(async () => new Response('ok', { status: 200 }));

  const self = {
    addEventListener: (type, fn) => {
      (listeners[type] ||= []).push(fn);
    },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => undefined),
      matchAll: vi.fn(async () => []),
      openWindow: vi.fn(async () => undefined)
    },
    registration: { showNotification: vi.fn(async () => undefined) },
    location: { origin: ORIGIN }
  };

  const caches = createCacheStorage(fetchMock);
  const context = {
    self, caches, fetch: fetchMock,
    Response, URL, TypeError,
    Request: WorkerRequest,
    console: { log() {}, warn() {}, info() {}, error() {} },
    navigator: {}
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);

  const dispatch = async (type, event) => {
    const waits = [];
    const ev = { waitUntil: (p) => waits.push(p), ...event };
    for (const fn of listeners[type] || []) fn(ev);
    await Promise.all(waits);
    return ev;
  };

  /** Dispatches a fetch event and returns what respondWith got, or undefined. */
  const dispatchFetch = async (request) => {
    let responded;
    const ev = { request, respondWith: (r) => { responded = r; } };
    for (const fn of listeners.fetch || []) fn(ev);
    return responded === undefined ? undefined : await responded;
  };

  const cacheName = `spotli-shell-v${version}`;
  return { listeners, self, caches, fetchMock, dispatch, dispatchFetch, cacheName, source };
}

/**
 * Stands in for a fetch Request.
 *
 * Node's global Request rejects a relative URL because it has no base, while a
 * service worker resolves one against its own scope — and sw.js precaches '/'
 * and '/index.html'. Only the fields sw.js actually reads are modelled.
 */
class WorkerRequest {
  constructor(input, init = {}) {
    const base = typeof input === 'string' ? input : input.url;
    this.url = new URL(base, ORIGIN).href;
    this.method = init.method || input?.method || 'GET';
    this.mode = init.mode || input?.mode || 'no-cors';
    this.destination = init.destination || input?.destination || '';
    this.cache = init.cache;
  }
}

const req = (url, init) => new WorkerRequest(url, init);

let sw;
beforeEach(() => {
  sw = null;
});

describe('service worker — install', () => {
  it('precaches the app shell so the app can boot with no network', async () => {
    sw = loadServiceWorker();
    await sw.dispatch('install', {});

    const cache = await sw.caches.open(sw.cacheName);
    const cached = (await cache.keys()).map((r) => new URL(r.url).pathname);
    expect(cached).toEqual(expect.arrayContaining(['/', '/index.html', '/manifest.json']));
  });

  it('does not call skipWaiting, so an update waits for the user to accept it', async () => {
    sw = loadServiceWorker();
    await sw.dispatch('install', {});
    // skipWaiting() on install is what made the "update available" prompt in
    // serviceWorkerRegistration.js unreachable: the new worker took over
    // before the user could ever be asked.
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('survives an entry that 404s rather than failing the whole install', async () => {
    const fetchImpl = vi.fn(async (request) => {
      const url = typeof request === 'string' ? request : request.url;
      if (url.includes('manifest.json')) return new Response('nope', { status: 404 });
      return new Response('ok', { status: 200 });
    });
    sw = loadServiceWorker({ fetchImpl });
    await expect(sw.dispatch('install', {})).resolves.toBeDefined();

    const cache = await sw.caches.open(sw.cacheName);
    const cached = (await cache.keys()).map((r) => new URL(r.url).pathname);
    expect(cached).toContain('/index.html');
    expect(cached).not.toContain('/manifest.json');
  });
});

describe('service worker — activate', () => {
  it('drops superseded caches but keeps the current one', async () => {
    sw = loadServiceWorker({ version: '2.0.0' });
    sw.caches._seed('spotli-shell-v1.0.0', '/old', new Response('old'));
    sw.caches._seed('deliveree-cache-v0.6.0-alpha', '/legacy', new Response('legacy'));
    sw.caches._seed('spotli-shell-v2.0.0', '/current', new Response('current'));

    await sw.dispatch('activate', {});

    expect(await sw.caches.keys()).toEqual(['spotli-shell-v2.0.0']);
  });

  it('leaves caches it does not own alone', async () => {
    sw = loadServiceWorker({ version: '2.0.0' });
    sw.caches._seed('some-other-tool-cache', '/x', new Response('x'));
    await sw.dispatch('activate', {});
    // The previous worker deleted every cache unconditionally, including ones
    // it had never written.
    expect(await sw.caches.keys()).toContain('some-other-tool-cache');
  });

  it('does not navigate open clients', async () => {
    sw = loadServiceWorker();
    const client = { url: `${ORIGIN}/`, navigate: vi.fn() };
    sw.self.clients.matchAll = vi.fn(async () => [client]);

    await sw.dispatch('activate', {});

    // `client.navigate(client.url)` on every window is what reloaded the tab
    // out from under the user.
    expect(client.navigate).not.toHaveBeenCalled();
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });
});

describe('service worker — update opt-in', () => {
  it('skips waiting only when the page asks it to', async () => {
    sw = loadServiceWorker();
    await sw.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('ignores unrelated messages', async () => {
    sw = loadServiceWorker();
    await sw.dispatch('message', { data: { type: 'SOMETHING_ELSE' } });
    await sw.dispatch('message', {});
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });
});

describe('service worker — fetch', () => {
  it('serves a navigation from the network when online, and refreshes the cached shell', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>live</html>', { status: 200 }));
    sw = loadServiceWorker({ fetchImpl });

    const res = await sw.dispatchFetch(req('/', { mode: 'navigate' }));

    expect(await res.text()).toContain('live');
    expect(fetchImpl).toHaveBeenCalled();
    // Network-first, so a release is picked up immediately — but the shell is
    // refreshed on the way through, which is what makes the next cold start
    // work offline.
    const cache = await sw.caches.open(sw.cacheName);
    expect(await cache.match('/index.html')).toBeDefined();
  });

  it('falls back to the cached shell when the network is gone', async () => {
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    sw = loadServiceWorker({ fetchImpl: offline });
    sw.caches._seed(sw.cacheName, '/index.html', new Response('<html>cached shell</html>', { status: 200 }));

    const res = await sw.dispatchFetch(req('/', { mode: 'navigate' }));
    expect(res).toBeDefined();
    expect(await res.text()).toContain('cached shell');
  });

  it('serves a readable offline page when nothing is cached at all', async () => {
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    sw = loadServiceWorker({ fetchImpl: offline });

    const res = await sw.dispatchFetch(req('/', { mode: 'navigate' }));
    expect(res.status).toBe(503);
    expect(await res.text()).toMatch(/offline/i);
  });

  it('serves a hashed asset from cache without hitting the network', async () => {
    const fetchImpl = vi.fn(async () => new Response('network copy', { status: 200 }));
    sw = loadServiceWorker({ fetchImpl });
    sw.caches._seed(sw.cacheName, '/assets/app-abc123.js', new Response('cached copy', { status: 200 }));

    const res = await sw.dispatchFetch(req('/assets/app-abc123.js', { destination: 'script' }));
    expect(await res.text()).toBe('cached copy');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never interposes on another origin', async () => {
    sw = loadServiceWorker();
    // Firebase, Firestore and carrier endpoints must stay live and uncached.
    const responded = await sw.dispatchFetch(req('https://firestore.googleapis.com/v1/projects/x'));
    expect(responded).toBeUndefined();
  });

  it('never interposes on a non-GET request', async () => {
    sw = loadServiceWorker();
    const responded = await sw.dispatchFetch(req('/api/thing', { method: 'POST' }));
    expect(responded).toBeUndefined();
  });
});
