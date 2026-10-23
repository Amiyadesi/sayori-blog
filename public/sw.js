const CACHE_NAME = "sayori-blog-v2";
const CORE_ASSETS = [
	"/",
	"/manifest.webmanifest",
	"/favicon/amiya-desk-192.png",
	"/favicon/amiya-desk-512.png",
];
const EXCLUDED_PREFIXES = ["/api/", "/admin/", "/project-34/"];

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

	// ClientRouter fetches HTML with mode=cors, so the blog's page URLs also need fresh responses.
	const isBlogPage = self.location.hostname === "blog.sayori.org" &&
		(!/\/[^/]*\.[^/]+$/.test(url.pathname) || /\.html$/.test(url.pathname));
	if (request.mode === "navigate" || isBlogPage) {
		event.respondWith(
			fetch(request, { cache: "no-store" })
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
