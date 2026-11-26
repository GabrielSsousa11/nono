/*
 * Service worker — Charlene Gonçalves Odontologia
 *
 * Política (LGPD): NUNCA armazenar em cache respostas de áreas autenticadas,
 * APIs, autenticação ou do Supabase. Apenas a página offline, ícones e os
 * assets estáticos versionados do Next (/_next/static) são guardados.
 */
const VERSION = "cg-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];
const PRIVATE_PREFIXES = ["/portal", "/auth", "/entrar", "/api", "/studio"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase e terceiros: sempre rede.
  if (PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (request.mode === "navigate") {
    // Rede primeiro; sem conexão, página offline. Navegações não são guardadas.
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// Web Push: apenas título e link (o banco nunca envia conteúdo clínico).
self.addEventListener("push", (event) => {
  let data = { title: "Charlene Gonçalves Odontologia", link: "/portal" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: "Abra o portal para ver os detalhes.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { link: data.link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/portal";
  const url = new URL(link.startsWith("/") ? link : "/portal", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url === url && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
