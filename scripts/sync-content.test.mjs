import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./sync-content.js", import.meta.url));
const repoRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "blog-sync-"));

try {
	const fixtureRoot = tmpRoot;
	const fixtureBlog = path.join(tmpRoot, "sayori-blog");
	const fixtureArticles = path.join(tmpRoot, "sayori-articles");

	fs.mkdirSync(path.join(fixtureBlog, "scripts"), { recursive: true });
	fs.cpSync(scriptPath, path.join(fixtureBlog, "scripts", "sync-content.js"));
	fs.cpSync(path.join(path.dirname(scriptPath), "load-env.js"), path.join(fixtureBlog, "scripts", "load-env.js"));
	write(path.join(fixtureBlog, "package.json"), '{"type":"module"}\n');
	for (const status of ["watching", "completed", "planned"]) {
		fs.mkdirSync(path.join(fixtureArticles, "anime", status), { recursive: true });
	}

	write(path.join(fixtureArticles, "posts", "hello", "hello.md"), [
		"---",
		"title: Hello",
		"published: 2026-05-29",
		"description: Test",
		"tags: [test]",
		"category: Test",
		"---",
		"",
		"hello",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "current-public-plan", "current-public-plan.md"), [
		"---",
		"title: 最近的公开计划书",
		"published: 2026-06-01",
		"description: Test",
		"tags: [test]",
		"category: Test",
		"---",
		"",
		"plan",
	].join("\n"));
	write(path.join(fixtureArticles, "essays", "small-note.md"), [
		"---",
		"title: Small Note",
		"published: 2026-06-02",
		"description: Essay",
		"tags: [note]",
		"category: Notes",
		"---",
		"",
		"essay body",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "diary", "2026-06-07", "2026-06-07.md"), [
		"---",
		"title: 日记：2026-06-07",
		"published: 2026-06-07",
		"description: Test",
		"tags:",
		"  - test",
		"  - diary",
		"category: Test",
		"---",
		"",
		"See [[计划书]].",
		"See [[Small Note]].",
		"See [[#^answer1|block answer]].",
		"Keep inline `[[keep inline link]] ==keep inline highlight== %% keep inline comment %%`.",
		"==highlight me==",
		"%% hide me %%",
		"",
		"^answer1",
		"",
		"```md",
		"%% keep code comment %% [[keep code link]] ==keep code highlight==",
		"```",
		"",
		"~~~md",
		"%% keep tilde code comment %% [[keep tilde code link]] ==keep tilde code highlight==",
		"~~~",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "space-images", "space-images.md"), [
		"---",
		"title: Space Images",
		"published: 2026-05-29",
		"description: Test",
		"tags: [test]",
		"category: Test",
		"---",
		"",
		"![[Pasted image 20260601203747.png]]",
		"![[Pasted image 20260601203747.png|320]]",
		"![[Pasted image 20260601203747.png|A pasted screenshot|640x360]]",
		"![[Pasted image 20260601203747.png|width=520|align=center|caption=居中截图说明]]",
		"![[Pasted image 20260601203747.png|480|right|右侧截图说明]]",
		"{{spoiler:被遮住的答案|鼠标移上去会看到提示}}",
		"{{黑幕:没有提示的文字}}",
		"",
		":::photo-grid",
		"![[Pasted image 20260601203747.png|左边照片说明]]",
		"![右边照片说明](second image.jpg)",
		":::",
		"",
		":::photo-grid columns=3",
		"![[Pasted image 20260601203747.png|caption=带宽度的左图|width=360]]",
		"![[second image.jpg|caption=右对齐小图|align=right|width=40%]]",
		":::",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "space-images", "Pasted image 20260601203747.png"), "image");
	write(path.join(fixtureArticles, "posts", "space-images", "second image.jpg"), "second image");
	write(path.join(fixtureArticles, "spec", "about.md"), "# About\n");
	write(path.join(fixtureArticles, "site", "profile.json"), JSON.stringify({
		avatar: "profile/avatar.webp",
		name: "Test Name",
		bio: "Test bio",
		links: [{ name: "Home", icon: "material-symbols:home", url: "https://example.com/" }],
	}, null, 2));
	write(path.join(fixtureArticles, "site", "banner.json"), JSON.stringify({
		desktop: ["desktop/1.webp"],
		mobile: ["mobile/1.webp"],
		interval: 7,
	}, null, 2));
	write(path.join(fixtureArticles, "site", "navigation.json"), JSON.stringify({
		links: [
			{ preset: "Home" },
			{
				name: "More",
				url: "#",
				children: [
					{ name: "Visible", url: "/visible/", icon: "material-symbols:link" },
					{ name: "Hidden", url: "/hidden/", visible: false },
					{ name: "Sponsor", url: "/sponsor/", icon: "material-symbols:favorite" },
				],
			},
		],
	}, null, 2));
	write(path.join(fixtureArticles, "site", "announcement.json"), JSON.stringify({
		content: "Test announcement",
		link: { enable: true, text: "Read", url: "/about/", external: false },
	}, null, 2));
	write(path.join(fixtureArticles, "site", "sponsor.md"), [
		"---",
		"title: Sponsor",
		"---",
		"",
		"Support this site.",
	].join("\n"));
	write(path.join(fixtureArticles, "site", "sponsor.json"), JSON.stringify({
		supporters: [
			{ name: "Dna", source: "爱发电" },
			{ name: "爱发电用户_04571", source: "爱发电" },
		],
	}, null, 2));
	write(path.join(fixtureArticles, "site", "music.json"), JSON.stringify({
		shuffle: true,
		tracks: [
			{
				id: 1,
				title: "Test Song",
				artist: "Test Artist",
				cover: "cover/test.webp",
				url: "url/test.mp3",
				youtube: "abc123",
				netease: "123456",
			},
		],
	}, null, 2));
	write(path.join(fixtureArticles, "friends", "example-friend.md"), [
		"---",
		"id: 7",
		"title: Example Friend",
		"siteurl: https://friend.example/",
		"imgurl: avatar.webp",
		"desc: Friend site",
		"feedurl: https://friend.example/rss.xml",
		"tags:",
		"  - blog",
		"  - friend",
		"posts:",
		"  - title: Friend Post",
		"    url: https://friend.example/post",
		"    excerpt: A recent friend post",
		"    date: 2026-06-25",
		"---",
		"",
		"notes",
	].join("\n"));
	write(path.join(fixtureArticles, "friends", "hidden-friend.md"), [
		"---",
		"title: Hidden Friend",
		"siteurl: https://hidden.example/",
		"visible: false",
		"---",
	].join("\n"));
	write(path.join(fixtureArticles, "assets", "profile", "avatar.webp"), "avatar");
	write(path.join(fixtureArticles, "assets", "friends", "avatar.webp"), "friend-avatar");
	write(path.join(fixtureArticles, "assets", "banner", "desktop", "1.webp"), "desktop");
	write(path.join(fixtureArticles, "assets", "banner", "mobile", "1.webp"), "mobile");
	write(path.join(fixtureArticles, "assets", "music", "cover", "test.webp"), "cover");
	write(path.join(fixtureArticles, "assets", "music", "url", "test.mp3"), "audio");
	write(path.join(fixtureArticles, "assets", "sponsor", "kofi.jpg"), "kofi");
	write(path.join(fixtureBlog, "public", "images", "posts", "deleted-post", "stale.png"), "stale-post-image");
	write(path.join(fixtureBlog, "public", "assets", "friends", "deleted-avatar.webp"), "stale-friend-avatar");
	write(path.join(fixtureBlog, "src", "data", "anime.ts"), [
		"const localAnimeList = [{ title: \"Old Anime\" }];",
		"export default localAnimeList;",
	].join("\n"));

	const result = spawnSync(process.execPath, [path.join(fixtureBlog, "scripts", "sync-content.js")], {
		cwd: fixtureRoot,
		encoding: "utf8",
		env: {
			...process.env,
			CONTENT_DIR: path.relative(fixtureBlog, fixtureArticles),
		},
	});

	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "profile", "avatar.webp")), "avatar");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "friends", "avatar.webp")), "friend-avatar");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "desktop-banner", "1.webp")), "desktop");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "mobile-banner", "1.webp")), "mobile");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "music", "url", "test.mp3")), "audio");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "sponsor", "kofi.jpg")), "kofi");
	assert.equal(
		read(path.join(fixtureBlog, "public", "images", "posts", "space-images", "Pasted image 20260601203747.png")),
		"image",
	);
	assert.equal(
		fs.existsSync(path.join(fixtureBlog, "public", "images", "posts", "deleted-post", "stale.png")),
		false,
	);
	assert.equal(
		fs.existsSync(path.join(fixtureBlog, "public", "assets", "friends", "deleted-avatar.webp")),
		false,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/!\[Pasted image 20260601203747\.png\]\(\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png\)/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="Pasted image 20260601203747\.png" width="320" \/>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="A pasted screenshot" width="640" height="360" \/>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<figure class="sayori-figure sayori-figure--center" style="--sayori-image-width: 520px;">\n<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="居中截图说明" loading="lazy" width="520" \/>\n<figcaption>居中截图说明<\/figcaption>\n<\/figure>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<figure class="sayori-figure sayori-figure--right" style="--sayori-image-width: 480px;">\n<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="右侧截图说明" loading="lazy" width="480" \/>\n<figcaption>右侧截图说明<\/figcaption>\n<\/figure>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<span class="sayori-spoiler" tabindex="0" data-tooltip="鼠标移上去会看到提示" aria-label="鼠标移上去会看到提示">被遮住的答案<\/span>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<span class="sayori-spoiler" tabindex="0">没有提示的文字<\/span>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<div class="sayori-photo-grid" style="--photo-grid-columns: 2;">[\s\S]*<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="左边照片说明" loading="lazy" \/>[\s\S]*<figcaption>左边照片说明<\/figcaption>[\s\S]*<img src="\/images\/posts\/space-images\/second%20image\.jpg" alt="右边照片说明" loading="lazy" \/>[\s\S]*<figcaption>右边照片说明<\/figcaption>[\s\S]*<\/div>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<div class="sayori-photo-grid" style="--photo-grid-columns: 3;">[\s\S]*<figure class="sayori-photo-grid-item" style="--sayori-image-width: 360px;">[\s\S]*<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="带宽度的左图" loading="lazy" width="360" \/>[\s\S]*<figcaption>带宽度的左图<\/figcaption>[\s\S]*<figure class="sayori-photo-grid-item sayori-figure--right" style="--sayori-image-width: 40%;">[\s\S]*<img src="\/images\/posts\/space-images\/second%20image\.jpg" alt="右对齐小图" loading="lazy" \/>[\s\S]*<figcaption>右对齐小图<\/figcaption>[\s\S]*<\/div>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/See \[计划书\]\(\/posts\/current-public-plan\/\)\./,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/See \[Small Note\]\(\/essays\/#small-note\)\./,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/See \[block answer\]\(#answer1\)\./,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/<a id="answer1"><\/a>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/<mark>highlight me<\/mark>/,
	);
	assert.doesNotMatch(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/hide me/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/%% keep code comment %% \[\[keep code link\]\] ==keep code highlight==/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/`\[\[keep inline link\]\] ==keep inline highlight== %% keep inline comment %%`/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/%% keep tilde code comment %% \[\[keep tilde code link\]\] ==keep tilde code highlight==/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "essays", "small-note.md")),
		/essay body/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "site", "sponsor.md")),
		/Support this site\./,
	);

	const generated = read(path.join(fixtureBlog, "src", "generated", "obsidian-config.ts"));
	assert.match(generated, /profileConfigOverride/);
	assert.match(generated, /"Test Name"/);
	assert.match(generated, /"\/assets\/profile\/avatar.webp"/);
	assert.match(generated, /"\/assets\/desktop-banner\/1.webp"/);
	assert.match(generated, /navBarConfigOverride/);
	assert.match(generated, /LinkPreset\.Home/);
	assert.match(generated, /"Visible"/);
	assert.doesNotMatch(generated, /"Hidden"/);
	assert.match(generated, /"Sponsor"/);
	assert.match(generated, /"Test announcement"/);
	assert.match(generated, /sponsorConfigOverride/);
	assert.match(generated, /"Dna"/);
	assert.match(generated, /"爱发电用户_04571"/);
	assert.match(generated, /"abc123"/);
	assert.match(generated, /"123456"/);

	const generatedFriends = read(path.join(fixtureBlog, "src", "generated", "friends.ts"));
	assert.match(generatedFriends, /Example Friend/);
	assert.match(generatedFriends, /"\/assets\/friends\/avatar.webp"/);
	assert.match(generatedFriends, /"blog"/);
	assert.match(generatedFriends, /"friend"/);
	assert.match(generatedFriends, /FriendPostItem/);
	assert.match(generatedFriends, /screenshotUrl/);
	assert.match(generatedFriends, /feedurl/);
	assert.match(generatedFriends, /https:\/\/friend\.example\/rss\.xml/);
	assert.match(generatedFriends, /\/api\/screenshot\?url=/);
	assert.match(generatedFriends, /Friend Post/);
	assert.match(generatedFriends, /A recent friend post/);
	assert.match(generatedFriends, /getShuffledFriendsList/);
	assert.doesNotMatch(generatedFriends, /Hidden Friend/);

	const generatedScreenshotTargets = read(path.join(fixtureBlog, "functions", "_generated", "friend-screenshot-targets.js"));
	assert.match(generatedScreenshotTargets, /allowedFriendScreenshotUrls/);
	assert.match(generatedScreenshotTargets, /https:\/\/friend\.example\//);
	assert.doesNotMatch(generatedScreenshotTargets, /hidden\.example/);

	const generatedFriendUpdateSources = read(path.join(fixtureBlog, "functions", "_generated", "friend-update-sources.js"));
	assert.match(generatedFriendUpdateSources, /friendUpdateSources/);
	assert.match(generatedFriendUpdateSources, /Example Friend/);
	assert.match(generatedFriendUpdateSources, /https:\/\/friend\.example\/rss\.xml/);
	assert.match(generatedFriendUpdateSources, /Friend Post/);
	assert.doesNotMatch(generatedFriendUpdateSources, /Hidden Friend/);

	const generatedAnime = read(path.join(fixtureBlog, "src", "data", "anime.ts"));
	assert.match(generatedAnime, /const localAnimeList: AnimeItem\[\] = \[\];/);
	assert.doesNotMatch(generatedAnime, /Old Anime/);
} finally {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function write(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content);
}

function read(filePath) {
	return fs.readFileSync(filePath, "utf8");
}
