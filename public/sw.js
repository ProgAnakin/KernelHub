/* Cache only this app's public shell; keep authenticated APIs out of the cache. */
const BASE = new URL(".", self.location.href).pathname;
const PREFIX = `kernelhub-${BASE.replace(/[^a-z0-9]/gi, "") || "root"}-`;
const CACHE = `${PREFIX}shell-v3`;
const asset = (path) => `${BASE}${path}`;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch(BASE, { cache: "reload" });
      if (!shell.ok) throw new Error("Shell unavailable");
      const html = await shell.clone().text();
      const assets = [
        ...new Set(
          html.match(/\/(?:[A-Za-z0-9_-]+\/)*_next\/static\/[^"'\\\s<>]+/g) ||
            [],
        ),
      ].filter((path) => path.startsWith(BASE));
      await cache.addAll([
        asset("manifest.webmanifest"),
        asset("icon.svg"),
        asset("icons/icon-192.png"),
        asset("icons/icon-512.png"),
        ...assets,
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
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(event.request);
          if (
            response.ok &&
            (url.pathname === BASE || url.pathname === asset("index.html"))
          )
            await cache.put(BASE, response.clone());
          return response;
        } catch {
          return (await cache.match(BASE)) || Response.error();
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
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      })(),
    );
  }
});
