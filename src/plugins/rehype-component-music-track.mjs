/// <reference types="mdast" />
import { h } from "hastscript";

function textOrEmpty(value) {
	return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {Record<string, string>} properties
 * @param {import('mdast').RootContent[]} children
 */
export function MusicTrackComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0) {
		return h(
			"div",
			{ class: "hidden" },
			'Invalid directive. ("music-track" must be a leaf directive)',
		);
	}

	const title = textOrEmpty(properties.title);
	const artist = textOrEmpty(properties.artist);
	const cover = textOrEmpty(properties.cover);
	const netease = textOrEmpty(properties.netease);
	const youtube = textOrEmpty(properties.youtube);
	const link = textOrEmpty(properties.link);

	if (!title || !artist) {
		return h(
			"div",
			{ class: "hidden" },
			'Invalid directive. ("title" and "artist" are required)',
		);
	}

	return h(
		"div",
		{
			class: "music-track-card no-styling paper-note paper-note-plain paper-tape",
			"data-music-track": "",
			"data-paper-tear": "drop",
			"data-state": "idle",
			"data-title": title,
			"data-artist": artist,
			...(cover ? { "data-cover": cover } : {}),
			...(netease ? { "data-netease": netease } : {}),
			...(youtube ? { "data-youtube": youtube } : {}),
			...(link ? { "data-link": link } : {}),
		},
		[
			h("div", { class: "music-track-top" }, [
				h("div", { class: "music-track-cover-shell", "aria-hidden": "true" }, [
					cover
						? h("img", {
								class: "music-track-cover",
								src: cover,
								alt: `${title} cover`,
								loading: "lazy",
								decoding: "async",
							})
						: h("div", { class: "music-track-cover music-track-cover--placeholder" }, [
								h("span", { class: "music-track-cover-mark" }, "♪"),
							]),
				]),
				h("div", { class: "music-track-meta" }, [
					h("div", { class: "music-track-title" }, title),
					h("div", { class: "music-track-artist" }, artist),
					h("div", { class: "music-track-time" }, [
						h("span", { "data-music-track-time": "" }, "0:00"),
						h("span", {}, " / "),
						h("span", { "data-music-track-duration": "" }, "--:--"),
					]),
				]),
				h("div", { class: "music-track-volume" }, [
					h(
						"button",
						{
							type: "button",
							class: "music-track-volume-button",
							"data-music-track-volume-toggle": "",
							"aria-label": "切换静音",
						},
						"♪",
					),
					h(
						"button",
						{
							type: "button",
							class: "music-track-volume-bar",
							"data-music-track-volume-slider": "",
							"aria-label": "调整音量",
						},
						[
							h("span", {
								class: "music-track-volume-fill",
								"data-music-track-volume-fill": "",
							}),
						],
					),
				]),
			]),
			h("button", {
				type: "button",
				class: "music-track-progress",
				"data-music-track-progress-slider": "",
				"aria-label": "调整播放进度",
			}, [
				h("span", {
					class: "music-track-progress-fill",
					"data-music-track-progress": "",
				}),
			]),
			h("div", { class: "music-track-controls" }, [
				h(
					"button",
					{
						type: "button",
						class: "music-track-play",
						"data-music-track-play": "",
						"aria-label": `播放 ${title}`,
					},
					[
						h("span", { class: "music-track-play-icon", "aria-hidden": "true" }, "▶"),
						h("span", { class: "music-track-play-label" }, "播放"),
					],
				),
			]),
			h("div", { class: "music-track-status", "data-music-track-status": "" }, "待播放"),
		],
	);
}
