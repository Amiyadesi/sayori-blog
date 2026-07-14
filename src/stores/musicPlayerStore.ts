import Key from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

import {
	DEFAULT_SONG,
	LOCAL_PLAYLIST,
	MUSIC_SETTINGS,
	SKIP_ERROR_DELAY,
	STORAGE_KEY_VOLUME,
} from "@/components/widgets/music-player/constants";
import type { RepeatMode, Song } from "@/components/widgets/music-player/types";
import { musicPlayerConfig } from "@/config";

export interface MusicPlayerState {
	currentSong: Song;
	playlist: Song[];
	currentIndex: number;
	isPlaying: boolean;
	isLoading: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
	isShuffled: boolean;
	isRepeating: RepeatMode;
	showPlaylist: boolean;
	errorMessage: string;
	showError: boolean;
	isExpanded: boolean;
	isHidden: boolean;
	autoplayFailed: boolean;
	willAutoPlay: boolean;
	externalPlayerUrl: string;
	externalProvider: "netease" | "youtube" | "";
	fallbackLink: string;
}

function getAssetPath(path: string): string {
	if (!path) {
		return "";
	}
	if (path.startsWith("http://") || path.startsWith("https://")) {
		return path;
	}
	if (path.startsWith("/")) {
		return path;
	}
	return `/${path}`;
}

function isChinaRegion(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	const override = new URLSearchParams(window.location.search).get("music");
	if (override === "netease") {
		return true;
	}
	if (override === "youtube") {
		return false;
	}
	try {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
		return [
			"Asia/Shanghai",
			"Asia/Chongqing",
			"Asia/Harbin",
			"Asia/Urumqi",
			"Asia/Taipei",
			"Asia/Hong_Kong",
			"Asia/Macau",
			"PRC",
		].some((zone) => tz === zone || tz.startsWith(zone));
	} catch {
		return navigator.language.toLowerCase().startsWith("zh");
	}
}

function getPreferredProvider(): "netease" | "youtube" {
	if (
		MUSIC_SETTINGS.defaultProvider === "netease" ||
		(MUSIC_SETTINGS.defaultProvider === "auto" &&
			MUSIC_SETTINGS.regionAware &&
			isChinaRegion())
	) {
		return "netease";
	}
	return "youtube";
}

function providerHasSource(song: Song, provider: "netease" | "youtube"): boolean {
	if (song.url) {
		return true;
	}
	return provider === "netease" ? Boolean(song.netease) : Boolean(song.youtube);
}

type SongIdentity = Pick<Song, "title" | "artist" | "netease" | "youtube" | "url">;

function normalizeSongIdentity(song: SongIdentity) {
	return {
		title: song.title?.trim() ?? "",
		artist: song.artist?.trim() ?? "",
		url: song.url?.trim() ?? "",
		netease: song.netease?.trim() ?? "",
		youtube: song.youtube?.trim() ?? "",
	};
}

function matchesSongIdentity(currentSong: SongIdentity, targetSong: SongIdentity): boolean {
	const current = normalizeSongIdentity(currentSong);
	const target = normalizeSongIdentity(targetSong);

	if (target.url) {
		return current.url === target.url;
	}
	if (target.netease) {
		return current.netease === target.netease;
	}
	if (target.youtube) {
		return current.youtube === target.youtube;
	}
	return current.title === target.title && current.artist === target.artist;
}

function buildMetingApiUrl(type: string, id: string): string {
	const api =
		musicPlayerConfig.meting_api ||
		"https://meting.mysqil.com/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
	const server = musicPlayerConfig.server || "netease";
	return api
		.replace(":server", encodeURIComponent(server))
		.replace(":type", encodeURIComponent(type))
		.replace(":id", encodeURIComponent(id))
		.replace(":auth", "")
		.replace(":r", Date.now().toString());
}

function buildNeteaseAudioUrl(id: string): string {
	return buildMetingApiUrl("url", id);
}

function buildYoutubeUrl(id: string): string {
	const origin =
		typeof location !== "undefined"
			? encodeURIComponent(location.origin)
			: "";
	return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&enablejsapi=1&origin=${origin}&rel=0&modestbranding=1`;
}

function getPlayablePlaylist(playlist: Song[]): Song[] {
	const preferredProvider = getPreferredProvider();
	const regionalPlaylist = playlist.filter((song) =>
		providerHasSource(song, preferredProvider),
	);
	if (regionalPlaylist.length > 0) {
		return regionalPlaylist;
	}
	return playlist.filter((song) => Boolean(song.url || song.netease || song.youtube));
}

function buildExternalPlayer(song: Song): {
	url: string;
	provider: "netease" | "youtube" | "";
} {
	const preferredProvider = getPreferredProvider();

	if (preferredProvider === "youtube" && song.youtube) {
		return {
			url: buildYoutubeUrl(song.youtube),
			provider: "youtube",
		};
	}

	if (song.url) {
		return { url: "", provider: "" };
	}

	if (song.youtube) {
		return {
			url: buildYoutubeUrl(song.youtube),
			provider: "youtube",
		};
	}

	return { url: "", provider: "" };
}

function buildAudioSource(song: Song): string {
	const preferredProvider = getPreferredProvider();
	if (preferredProvider === "netease" && song.netease) {
		return buildNeteaseAudioUrl(song.netease);
	}
	if (song.url) {
		return getAssetPath(song.url);
	}
	if (song.netease) {
		return buildNeteaseAudioUrl(song.netease);
	}
	return "";
}

class MusicPlayerStore {
	private audio: HTMLAudioElement | null = null;
	private externalFrame: HTMLIFrameElement | null = null;
	private externalFrameArmed = false;
	private audioFallbackSongKey = "";
	private instanceId = createPlaybackInstanceId();
	private playbackChannel: BroadcastChannel | null = null;
	private unregisterPlaybackLock: (() => void) | undefined;
	private shuffleQueue: number[] = [];
	private state: MusicPlayerState;
	private isInitialized = false;
	private unregisterInteraction: (() => void) | undefined;
	private listeners = new Set<(state: MusicPlayerState) => void>();

	constructor() {
		this.state = this.createInitialState();
	}

	private createInitialState(): MusicPlayerState {
		return {
			currentSong: { ...DEFAULT_SONG },
			playlist: [],
			currentIndex: 0,
			isPlaying: false,
			isLoading: false,
			currentTime: 0,
			duration: 0,
			volume: 0.7,
			isMuted: false,
			isShuffled: false,
			isRepeating: 0,
			showPlaylist: false,
			errorMessage: "",
			showError: false,
			isExpanded: false,
			isHidden: false,
			autoplayFailed: false,
			willAutoPlay: false,
			externalPlayerUrl: "",
			externalProvider: "",
			fallbackLink: "",
		};
	}

	private createSnapshot(): MusicPlayerState {
		return {
			...this.state,
			currentSong: { ...this.state.currentSong },
			playlist: this.state.playlist.map((song) => ({ ...song })),
		};
	}

	getState(): MusicPlayerState {
		return this.createSnapshot();
	}

	getAudio(): HTMLAudioElement | null {
		return this.audio;
	}

	bindExternalFrame(frame: HTMLIFrameElement): void {
		if (this.externalFrame && this.externalFrame !== frame) {
			this.externalFrame.src = "about:blank";
		}
		this.externalFrame = frame;
		this.syncExternalFrame();
	}

	unbindExternalFrame(frame: HTMLIFrameElement): void {
		frame.src = "about:blank";
		if (this.externalFrame !== frame) {
			return;
		}
		this.externalFrame = null;
	}

	subscribe(listener: (state: MusicPlayerState) => void): () => void {
		this.listeners.add(listener);
		listener(this.createSnapshot());
		return () => {
			this.listeners.delete(listener);
		};
	}

	async initialize(): Promise<void> {
		if (typeof window === "undefined" || this.isInitialized) {
			return;
		}
		this.isInitialized = true;

		if (!musicPlayerConfig.enable) {
			return;
		}

		this.audio = new Audio();
		this.audio.preload = "metadata";
		this.setupAudioListeners();
		this.setupPlaybackLock();
		this.loadVolumeFromStorage();
		this.registerInteractionHandler();
		await this.loadPlaylist();
	}

	private setupAudioListeners(): void {
		if (!this.audio) {
			return;
		}

		this.audio.volume = this.state.volume;
		this.audio.muted = this.state.isMuted;

		this.audio.addEventListener("play", () => {
			this.claimPlayback();
			this.state.isPlaying = true;
			this.broadcastState();
		});

		this.audio.addEventListener("pause", () => {
			this.state.isPlaying = false;
			this.broadcastState();
		});

		this.audio.addEventListener("timeupdate", () => {
			if (this.audio) {
				this.state.currentTime = this.audio.currentTime;
				this.broadcastState();
			}
		});

		this.audio.addEventListener("ended", () => {
			this.handleAudioEnded();
		});

		this.audio.addEventListener("error", () => {
			this.handleAudioError();
		});

		this.audio.addEventListener("loadeddata", () => {
			this.handleAudioLoaded();
		});

		this.audio.addEventListener("loadedmetadata", () => {
			this.updateAudioDuration();
		});

		this.audio.addEventListener("durationchange", () => {
			this.updateAudioDuration();
		});

		this.audio.addEventListener("loadstart", () => {
			this.state.isLoading = true;
			this.broadcastState();
		});
	}

	private syncExternalFrame(): void {
		if (!this.externalFrame) {
			return;
		}
		const nextSrc = this.state.isPlaying && this.externalFrameArmed
			? this.state.externalPlayerUrl
			: "about:blank";
		if ((this.externalFrame.getAttribute("src") || "") === nextSrc) {
			return;
		}
		this.externalFrame.src = nextSrc;
	}

	private setupPlaybackLock(): void {
		if (typeof window === "undefined") {
			return;
		}
		const handleClaim = (data: unknown) => {
			if (!isPlaybackClaim(data) || data.instanceId === this.instanceId) {
				return;
			}
			this.stopForPeerPlayback();
		};
		if ("BroadcastChannel" in window) {
			this.playbackChannel = new BroadcastChannel("sayori-music-player");
			this.playbackChannel.addEventListener("message", (event) =>
				handleClaim(event.data),
			);
		}
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== STORAGE_KEY_PLAYBACK_LOCK || !event.newValue) {
				return;
			}
			try {
				handleClaim(JSON.parse(event.newValue));
			} catch {}
		};
		window.addEventListener("storage", handleStorage);
		this.unregisterPlaybackLock = () => {
			window.removeEventListener("storage", handleStorage);
			this.playbackChannel?.close();
			this.playbackChannel = null;
		};
	}

	private claimPlayback(): void {
		if (typeof window === "undefined") {
			return;
		}
		const message: PlaybackClaim = {
			type: "claim-playback",
			instanceId: this.instanceId,
			timestamp: Date.now(),
		};
		this.playbackChannel?.postMessage(message);
		try {
			localStorage.setItem(STORAGE_KEY_PLAYBACK_LOCK, JSON.stringify(message));
		} catch {}
	}

	private stopForPeerPlayback(): void {
		let changed = false;
		if (this.audio && !this.audio.paused) {
			this.audio.pause();
			changed = true;
		}
		if (this.state.isPlaying || this.externalFrameArmed) {
			this.state.isPlaying = false;
			this.externalFrameArmed = false;
			changed = true;
		}
		this.syncExternalFrame();
		if (changed) {
			this.broadcastState();
		}
	}

	private handleAudioEnded(): void {
		if (this.state.isRepeating === 1) {
			if (this.audio) {
				this.audio.currentTime = 0;
				this.audio.play().catch(() => {});
			}
		} else {
			this.next(true);
		}
	}

	private handleAudioError(): void {
		const song = this.state.currentSong;
		const songKey = `${song.id}:${song.title}`;
		if (
			song.youtube &&
			this.audioFallbackSongKey !== songKey &&
			!this.state.externalPlayerUrl
		) {
			this.audioFallbackSongKey = songKey;
			this.fallbackToExternalPlayer(song);
			return;
		}

		this.state.isLoading = false;
		this.showError(i18n(Key.musicPlayerErrorSong));

		if (this.state.playlist.length > 1 && !this.isCurrentSongTransient()) {
			setTimeout(() => this.next(true), SKIP_ERROR_DELAY);
		} else if (this.state.playlist.length <= 1) {
			this.showError(i18n(Key.musicPlayerErrorEmpty));
		}
		this.broadcastState();
	}

	private updateAudioDuration(): void {
		if (!this.audio || !Number.isFinite(this.audio.duration)) {
			return;
		}
		if (this.audio.duration <= 1) {
			return;
		}
		this.state.duration = Math.floor(this.audio.duration);
		this.state.currentSong = {
			...this.state.currentSong,
			duration: this.state.duration,
		};
		this.broadcastState();
	}

	private handleAudioLoaded(): void {
		this.state.isLoading = false;
		this.updateAudioDuration();

		if (this.state.willAutoPlay || this.state.isPlaying) {
			const playPromise = this.audio?.play();
			if (playPromise !== undefined) {
				playPromise.catch(() => {
					this.state.autoplayFailed = true;
					this.state.isPlaying = false;
				});
			}
		}
		this.broadcastState();
	}

	private fallbackToExternalPlayer(song: Song): void {
		const external = song.youtube
			? { url: buildYoutubeUrl(song.youtube), provider: "youtube" as const }
			: buildExternalPlayer(song);
		if (!external.url || !this.audio) {
			return;
		}

		this.audio.pause();
		this.audio.src = "";
		this.state.isLoading = false;
		this.state.externalPlayerUrl = external.url;
		this.state.externalProvider = external.provider;
		this.state.isPlaying = this.state.willAutoPlay || this.state.isPlaying;
		this.externalFrameArmed = this.state.isPlaying;
		if (this.state.isPlaying) {
			this.claimPlayback();
		}
		this.syncExternalFrame();
		this.broadcastState();
	}

	private loadVolumeFromStorage(): void {
		if (typeof localStorage !== "undefined") {
			const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
			if (savedVolume) {
				const volume = parseFloat(savedVolume);
				if (!isNaN(volume) && volume >= 0 && volume <= 1) {
					this.state.volume = volume;
					this.state.isMuted = volume === 0;
					if (this.audio) {
						this.audio.volume = volume;
						this.audio.muted = this.state.isMuted;
					}
				}
			}
		}
	}

	private registerInteractionHandler(): void {
		const handler = () => {
			if (this.state.autoplayFailed && this.audio) {
				const playPromise = this.audio.play();
				if (playPromise !== undefined) {
					playPromise
						.then(() => {
							this.state.autoplayFailed = false;
						})
						.catch(() => {});
				}
			}
		};
		document.addEventListener("click", handler, { once: true });
		document.addEventListener("keydown", handler, { once: true });
		this.unregisterInteraction = () => {
			document.removeEventListener("click", handler);
			document.removeEventListener("keydown", handler);
		};
	}

	private async loadPlaylist(): Promise<void> {
		const mode = musicPlayerConfig.mode ?? "meting";
		const meting_api =
			musicPlayerConfig.meting_api ??
			"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
		const meting_id = musicPlayerConfig.id ?? "14164869977";
		const meting_server = musicPlayerConfig.server ?? "netease";
		const meting_type = musicPlayerConfig.type ?? "playlist";

		if (mode === "meting") {
			await this.fetchMetingPlaylist(
				meting_api,
				meting_server,
				meting_type,
				meting_id,
			);
		} else {
			this.loadLocalPlaylist();
		}
	}

	private async fetchMetingPlaylist(
		api: string,
		server: string,
		type: string,
		id: string,
	): Promise<void> {
		if (!api || !id) {
			return;
		}

		this.state.isLoading = true;
		this.broadcastState();

		const apiUrl = api
			.replace(":server", server)
			.replace(":type", type)
			.replace(":id", id)
			.replace(":auth", "")
			.replace(":r", Date.now().toString());

		try {
			const res = await fetch(apiUrl);
			if (!res.ok) {
				throw new Error("meting api error");
			}
			const list: any[] = await res.json();
			this.state.playlist = list.map((song) =>
				this.convertMetingSong(song),
			);
			this.state.isLoading = false;

			if (this.state.playlist.length > 0) {
				this.selectInitialSong(this.state.playlist[0]);
			}
		} catch (e) {
			this.showError(i18n(Key.musicPlayerErrorPlaylist));
			this.state.isLoading = false;
		}
		this.broadcastState();
	}

	private convertMetingSong(song: any): Song {
		const title = song.name ?? song.title ?? i18n(Key.unknownSong);
		const artist = song.artist ?? song.author ?? i18n(Key.unknownArtist);
		let dur = song.duration ?? 0;
		if (typeof dur === "string") {
			dur = parseInt(dur, 10);
		}
		if (dur > 10000) {
			dur = Math.floor(dur / 1000);
		}
		if (!Number.isFinite(dur) || dur <= 0) {
			dur = 0;
		}

		return {
			id:
				typeof song.id === "string"
					? parseInt(song.id, 10)
					: (song.id ?? 0),
			title,
			artist,
			cover: song.pic ?? "",
			url: song.url ?? "",
			duration: dur,
		};
	}

	private loadLocalPlaylist(): void {
		this.state.playlist = getPlayablePlaylist(LOCAL_PLAYLIST);
		if (MUSIC_SETTINGS.shuffle && this.state.playlist.length > 1) {
			this.state.isShuffled = true;
			this.state.currentIndex = Math.floor(
				Math.random() * this.state.playlist.length,
			);
			this.resetShuffleQueue();
		}
		if (this.state.playlist.length === 0) {
			this.showError("本地播放列表为空");
		} else {
			this.selectInitialSong(this.state.playlist[this.state.currentIndex]);
		}
	}

	private selectInitialSong(song: Song): void {
		this.state.currentSong = { ...song };
		this.state.currentTime = 0;
		this.state.duration = song.duration ?? 0;
		this.state.isLoading = false;
		this.state.willAutoPlay = false;
		this.state.externalPlayerUrl = "";
		this.state.externalProvider = "";
		this.state.fallbackLink = "";
		this.broadcastState();
	}

	private loadSong(
		song: Song,
		autoPlay = true,
		options?: { fallbackLink?: string },
	): void {
		if (!song) {
			return;
		}
		const audioSource = buildAudioSource(song);
		const external = audioSource
			? { url: "", provider: "" as const }
			: buildExternalPlayer(song);
		const previousExternalUrl = this.state.externalPlayerUrl;
		this.audioFallbackSongKey = "";
		this.externalFrameArmed = autoPlay;
		this.state.fallbackLink = options?.fallbackLink?.trim() ?? "";
		this.state.externalPlayerUrl = external.url;
		this.state.externalProvider = external.provider;
		if (
			song.id !== this.state.currentSong.id ||
			song.url !== this.state.currentSong.url ||
			external.url !== previousExternalUrl
		) {
			this.state.currentSong = { ...song };
		}
		if (audioSource && !external.url) {
			this.state.isLoading = true;
		} else {
			this.state.isLoading = false;
		}
		this.state.willAutoPlay = autoPlay;
		if (this.audio && !external.url) {
			this.syncExternalFrame();
			if (this.audio.src) {
				this.audio.src = "";
			}
			this.state.currentTime = 0;
			this.state.duration = song.duration ?? 0;
			if (audioSource) {
				this.audio.src = audioSource;
				this.audio.load();
			}
		} else if (this.audio) {
			this.audio.pause();
			this.audio.src = "";
			this.state.isPlaying = autoPlay;
			this.state.currentTime = 0;
			this.state.duration = song.duration ?? 0;
			if (autoPlay) {
				this.claimPlayback();
			}
			this.syncExternalFrame();
		}
		this.broadcastState();
	}

	private isCurrentSongTransient(): boolean {
		if (this.state.playlist.length === 0) {
			return true;
		}
		const playlistSong = this.state.playlist[this.state.currentIndex];
		if (!playlistSong) {
			return true;
		}
		return !matchesSongIdentity(playlistSong, this.state.currentSong);
	}

	private showError(message: string): void {
		this.state.errorMessage = message;
		this.state.showError = true;
		setTimeout(() => {
			this.state.showError = false;
			this.broadcastState();
		}, 3000);
		this.broadcastState();
	}

	hideError(): void {
		this.state.showError = false;
		this.broadcastState();
	}

	toggle(): void {
		if (this.state.externalPlayerUrl) {
			this.state.isPlaying = !this.state.isPlaying;
			this.externalFrameArmed = this.state.isPlaying;
			if (this.state.isPlaying) {
				this.claimPlayback();
			}
			this.syncExternalFrame();
			this.broadcastState();
			return;
		}
		if (!this.audio) {
			return;
		}
		if (!this.audio.src) {
			this.loadSong(this.state.currentSong, true);
			return;
		}
		if (this.state.isPlaying) {
			this.audio.pause();
		} else {
			this.claimPlayback();
			this.audio.play().catch(() => {});
		}
	}

	play(): void {
		if (this.state.externalPlayerUrl) {
			this.state.isPlaying = true;
			this.externalFrameArmed = true;
			this.claimPlayback();
			this.syncExternalFrame();
			this.broadcastState();
			return;
		}
		if (!this.audio) {
			return;
		}
		if (!this.audio.src) {
			this.loadSong(this.state.currentSong, true);
			return;
		}
		this.claimPlayback();
		this.audio.play().catch(() => {});
	}

	playTrack(song: Song, options?: { fallbackLink?: string }): void {
		if (!song.url && !song.netease && !song.youtube) {
			this.state.isLoading = false;
			this.state.isPlaying = false;
			this.state.willAutoPlay = false;
			this.state.fallbackLink = options?.fallbackLink?.trim() ?? "";
			this.showError(i18n(Key.musicPlayerErrorSong));
			this.broadcastState();
			return;
		}

		const transientSong: Song = {
			id: song.id || Date.now(),
			title: song.title,
			artist: song.artist,
			cover: song.cover || DEFAULT_SONG.cover,
			url: song.url || "",
			duration: song.duration ?? 0,
			category: song.category,
			youtube: song.youtube,
			netease: song.netease,
		};
		this.loadSong(transientSong, true, options);
	}

	isCurrentTrack(song: Pick<Song, "title" | "artist" | "netease" | "youtube" | "url">): boolean {
		return matchesSongIdentity(this.state.currentSong, song);
	}

	pause(): void {
		if (this.state.externalPlayerUrl) {
			this.state.isPlaying = false;
			this.externalFrameArmed = false;
			this.syncExternalFrame();
			this.broadcastState();
			return;
		}
		if (!this.audio) {
			return;
		}
		this.audio.pause();
	}

	next(autoPlay = true): void {
		if (this.state.playlist.length <= 1) {
			return;
		}

		let newIndex: number;
		if (this.state.isShuffled) {
			newIndex = this.getNextShuffleIndex();
		} else {
			newIndex =
				this.state.currentIndex < this.state.playlist.length - 1
					? this.state.currentIndex + 1
					: 0;
		}

		this.state.currentIndex = newIndex;
		this.loadSong(this.state.playlist[newIndex], autoPlay);
	}

	prev(): void {
		if (this.state.playlist.length <= 1) {
			return;
		}
		const newIndex =
			this.state.currentIndex > 0
				? this.state.currentIndex - 1
				: this.state.playlist.length - 1;
		this.state.currentIndex = newIndex;
		this.loadSong(this.state.playlist[newIndex], true);
	}

	playIndex(index: number): void {
		if (index < 0 || index >= this.state.playlist.length) {
			return;
		}
		this.state.currentIndex = index;
		this.resetShuffleQueue();
		this.loadSong(this.state.playlist[index], true);
	}

	seek(time: number): void {
		if (!this.audio) {
			return;
		}
		if (time >= 0 && time <= this.state.duration) {
			this.audio.currentTime = time;
			this.state.currentTime = time;
			this.broadcastState();
		}
	}

	setVolume(volume: number): void {
		const clampedVolume = Math.max(0, Math.min(1, volume));
		this.state.volume = clampedVolume;
		this.state.isMuted = clampedVolume === 0;
		if (this.audio) {
			this.audio.volume = clampedVolume;
			this.audio.muted = this.state.isMuted;
		}
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY_VOLUME, String(clampedVolume));
		}
		this.broadcastState();
	}

	toggleMute(): void {
		this.state.isMuted = !this.state.isMuted;
		if (this.audio) {
			this.audio.muted = this.state.isMuted;
		}
		this.broadcastState();
	}

	toggleShuffle(): void {
		this.state.isShuffled = !this.state.isShuffled;
		this.resetShuffleQueue();
		if (this.state.isShuffled) {
			this.state.isRepeating = 0;
		}
		this.broadcastState();
	}

	toggleRepeat(): void {
		this.state.isRepeating = ((this.state.isRepeating + 1) %
			3) as RepeatMode;
		if (this.state.isRepeating !== 0) {
			this.state.isShuffled = false;
		}
		this.broadcastState();
	}

	toggleMode(): void {
		if (this.state.isShuffled) {
			this.toggleShuffle();
			return;
		}
		if (this.state.isRepeating === 2) {
			this.toggleRepeat();
			this.toggleShuffle();
			return;
		}
		this.toggleRepeat();
	}

	togglePlaylist(): void {
		this.state.showPlaylist = !this.state.showPlaylist;
		this.broadcastState();
	}

	toggleExpanded(): void {
		this.state.isExpanded = !this.state.isExpanded;
		// 保持与原先 usePlayerState.toggleExpandedUI 一致的联动行为：
		// 展开时强制取消隐藏，并关闭播放列表，避免状态组合异常
		if (this.state.isExpanded) {
			this.state.showPlaylist = false;
			this.state.isHidden = false;
		}
		this.broadcastState();
	}

	toggleHidden(): void {
		this.state.isHidden = !this.state.isHidden;
		// 保持与原先 usePlayerState.toggleHiddenUI 一致的联动行为：
		// 隐藏时收起播放器并关闭播放列表，防止展开 UI 悬挂在小球旁边
		if (this.state.isHidden) {
			this.state.isExpanded = false;
			this.state.showPlaylist = false;
		}
		this.broadcastState();
	}

	canSkip(): boolean {
		return this.state.playlist.length > 1;
	}

	setProgress(percent: number): void {
		if (!this.audio) {
			return;
		}
		const newTime = percent * this.state.duration;
		this.audio.currentTime = newTime;
		this.state.currentTime = newTime;
		this.broadcastState();
	}

	private broadcastState(): void {
		const snapshot = this.createSnapshot();

		for (const listener of this.listeners) {
			listener(snapshot);
		}

		if (typeof window === "undefined") {
			return;
		}
		window.dispatchEvent(
			new CustomEvent("music-sidebar:state", {
				detail: snapshot,
			}),
		);
	}

	destroy(): void {
		if (this.unregisterInteraction) {
			this.unregisterInteraction();
		}
		if (this.unregisterPlaybackLock) {
			this.unregisterPlaybackLock();
			this.unregisterPlaybackLock = undefined;
		}
		if (this.audio) {
			this.audio.pause();
			this.audio.src = "";
			this.audio = null;
		}
		if (this.externalFrame) {
			this.externalFrame.src = "";
			this.externalFrame = null;
		}
		this.externalFrameArmed = false;
		this.isInitialized = false;
	}

	private getNextShuffleIndex(): number {
		if (this.shuffleQueue.length === 0) {
			this.shuffleQueue = this.buildShuffleQueue();
		}
		return this.shuffleQueue.shift() ?? this.state.currentIndex;
	}

	private buildShuffleQueue(): number[] {
		const indices = this.state.playlist
			.map((_, index) => index)
			.filter((index) => index !== this.state.currentIndex);

		for (let i = indices.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}

		return indices;
	}

	private resetShuffleQueue(): void {
		this.shuffleQueue = [];
	}
}

type PlaybackClaim = {
	type: "claim-playback";
	instanceId: string;
	timestamp: number;
};

const STORAGE_KEY_PLAYBACK_LOCK = "music-player-active-instance";

function createPlaybackInstanceId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isPlaybackClaim(value: unknown): value is PlaybackClaim {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as PlaybackClaim).type === "claim-playback" &&
		typeof (value as PlaybackClaim).instanceId === "string"
	);
}

const globalMusicPlayerScope = globalThis as typeof globalThis & {
	__sayoriMusicPlayerStore?: MusicPlayerStore;
};

export const musicPlayerStore =
	globalMusicPlayerScope.__sayoriMusicPlayerStore ?? new MusicPlayerStore();

globalMusicPlayerScope.__sayoriMusicPlayerStore = musicPlayerStore;

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		globalMusicPlayerScope.__sayoriMusicPlayerStore?.destroy();
		globalMusicPlayerScope.__sayoriMusicPlayerStore = undefined;
	});
}
