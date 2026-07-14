const CACHE_NAME = "sayori-blog-v1";
const CORE_ASSETS = [
	"/",
	"/manifest.webmanifest",
	"/favicon/amiya-desk-192.png",
	"/favicon/amiya-desk-512.png",
];
const EXCLUDED_PREFIXES = ["/api/", "/admin/"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(CORE_ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);
	if (
		url.origin !== self.location.origin ||
		EXCLUDED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
	) {
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(request, copy);
					});
					return response;
				})
				.catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => {
			const network = fetch(request)
				.then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(request, copy);
						});
					}
					return response;
				})
				.catch(() => cached);

			return cached || network;
		}),
	);
});
