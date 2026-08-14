import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const localeRoots = [dist, path.join(dist, "en")];
const removedRoutes = [
	"about",
	"albums",
	"admin",
	"anime",
	"archive",
	"diary",
	"devices",
	"essays",
	"friends",
	"guestbook",
	"projects",
	"skills",
	"sponsor",
	"timeline",
	"topics",
	"api",
	"sayori-diary",
];

for (const localeRoot of localeRoots) {
	if (!fs.existsSync(localeRoot)) continue;
	for (const route of removedRoutes) {
		fs.rmSync(path.join(localeRoot, route), {
			recursive: true,
			force: true,
		});
	}
	const postsRoot = path.join(localeRoot, "posts");
	if (!fs.existsSync(postsRoot)) continue;
	for (const entry of fs.readdirSync(postsRoot, { withFileTypes: true })) {
		if (!entry.name.startsWith("sayori-diary")) {
			fs.rmSync(path.join(postsRoot, entry.name), {
				recursive: true,
				force: true,
			});
		}
	}
}

for (const root of [
	path.join(dist, "assets"),
	path.join(dist, "images"),
	path.join(dist, "en", "assets"),
	path.join(dist, "en", "images"),
]) {
	if (!fs.existsSync(root)) continue;
	const relativeRoot = path.relative(dist, root).replaceAll("\\", "/");
	const keep = relativeRoot.endsWith("assets")
		? new Set(["font", "pet", "js"])
		: new Set(["posts"]);
	for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
		if (!keep.has(entry.name)) {
			fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
		}
	}
	if (relativeRoot.endsWith("assets")) {
		for (const font of fs.readdirSync(path.join(root, "font"), {
			withFileTypes: true,
		})) {
			if (font.name !== "ZenMaruGothic-Medium.ttf") {
				fs.rmSync(path.join(root, "font", font.name), {
					recursive: true,
					force: true,
				});
			}
		}
		const scriptsRoot = path.join(root, "js");
		if (fs.existsSync(scriptsRoot)) {
			for (const script of fs.readdirSync(scriptsRoot, { withFileTypes: true })) {
				if (script.name !== "twikoo.all.min.js") {
					fs.rmSync(path.join(scriptsRoot, script.name), {
						recursive: true,
						force: true,
					});
				}
			}
		}
	}
	if (relativeRoot.endsWith("images")) {
		const postsRoot = path.join(root, "posts");
		if (fs.existsSync(postsRoot)) {
			for (const entry of fs.readdirSync(postsRoot, { withFileTypes: true })) {
				if (entry.name !== "sayori-diary") {
					fs.rmSync(path.join(postsRoot, entry.name), {
						recursive: true,
						force: true,
					});
				}
			}
		}
	}
}

for (const root of localeRoots) {
	for (const directory of ["pio", "data"]) {
		fs.rmSync(path.join(root, directory), { recursive: true, force: true });
	}
}

console.log("[prune-sayori-diary] kept only public Sayori diary routes");
