/* Cache only this app's public shell; keep authenticated APIs out of the cache. */
const BASE = new URL(".", self.location.href).pathname;
const PREFIX = `kernelhub-${BASE === "/" ? "root" : encodeURIComponent(BASE)}-`;
const NAVIGATION_TIMEOUT_MS = 3000;
const asset = (path) => `${BASE}${path}`;
// This build dependency also participates in the browser's worker update check.
// It includes worker-only chunks that never appear in the initial HTML.
importScripts(asset("precache-manifest.js"));
const manifest = self.__KERNELHUB_PRECACHE;
if (
  !manifest ||
  manifest.version !== 1 ||
  typeof manifest.revision !== "string" ||
  !/^[a-f0-9]{64}$/.test(manifest.revision) ||
  !Array.isArray(manifest.assets) ||
  manifest.assets.length === 0 ||
  manifest.assets.length > 512 ||
  new Set(manifest.assets).size !== manifest.assets.length
)
  throw new Error("Invalid offline build manifest");
const buildAssets = manifest.assets.map((path) => {
  if (
    typeof path !== "string" ||
    path.length > 512 ||
    !/^_next\/static\/[A-Za-z0-9_./-]+\.(js|css)$/.test(path) ||
    path.split("/").some((part) => part === "." || part === "..")
  )
    throw new Error("Invalid offline build asset");
  const url = new URL(asset(path), self.location.origin);
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(asset("_next/static/"))
  )
    throw new Error("Offline build asset is outside the app");
  return url.href;
});
// An unsuccessful install cannot replace the active build's cached shell.
const CACHE = `${PREFIX}shell-v5-${manifest.revision}`;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch(BASE, { cache: "reload" });
      if (!shell.ok) throw new Error("Shell unavailable");
      await cache.addAll([
        asset("manifest.webmanifest"),
        asset("icon.svg"),
        asset("icons/icon-192.png"),
        asset("icons/icon-512.png"),
        ...buildAssets,
      ]);
      await cache.put(BASE, shell);
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith(PREFIX) ||
                (BASE === "/" && key.startsWith("kernelhub-shell-"))) &&
              key !== CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE) ||
    url.pathname.startsWith(asset("api/"))
  )
    return;
  if (event.request.mode === "navigate") {
    const cachePromise = caches.open(CACHE);
    const network = (async () => {
      const response = await fetch(event.request);
      if (
        response.ok &&
        (url.pathname === BASE || url.pathname === asset("index.html"))
      ) {
        const cache = await cachePromise;
        await cache.put(BASE, response.clone());
      }
      return response;
    })();
    // Keep a late successful request alive after the cached shell has opened.
    event.waitUntil(network.then(() => undefined).catch(() => undefined));
    event.respondWith(
      (async () => {
        const cache = await cachePromise;
        const cached = await cache.match(BASE);
        let timeout;
        try {
          if (!cached) return await network;
          // A stalled connection must not block a shell already on the device.
          const response = await Promise.race([
            network,
            new Promise((resolve) => {
              timeout = setTimeout(
                () => resolve(cached),
                NAVIGATION_TIMEOUT_MS,
              );
            }),
          ]);
          return response.ok ? response : cached;
        } catch {
          return cached || Response.error();
        } finally {
          clearTimeout(timeout);
        }
      })(),
    );
    return;
  }
  if (
    url.pathname.startsWith(asset("_next/static/")) ||
    url.pathname.startsWith(asset("icons/")) ||
    url.pathname === asset("icon.svg")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const forRequestedWorker = (response) =>
          event.request.destination === "worker"
            ? new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              })
            : response;
        // Static files are identified by their path. Arbitrary search strings
        // must not create unlimited copies of the same public asset.
        // A cached response has a canonical URL without the worker's #params.
        // A synthetic response lets WorkerLocation retain its original URL.
        const key = `${url.origin}${url.pathname}`;
        const cached = await cache.match(key);
        if (cached) return forRequestedWorker(cached);
        const response = await fetch(key);
        if (response.ok) await cache.put(key, response.clone());
        return forRequestedWorker(response);
      })(),
    );
  }
});
