/**
 * Fancybox 处理器
 * 管理图片灯箱的初始化和清理
 */

import {
	FANCYBOX_SELECTORS,
	getDefaultFancyboxConfig,
} from "../core/swup-config";

// Fancybox 模块类型
type FancyboxType = any;

/**
 * Fancybox 处理器类
 * 负责图片灯箱的按需加载和管理
 */
export class FancyboxHandler {
	private Fancybox: FancyboxType | null = null;
	private boundSelectors: string[] = [];
	private initialized = false;
	private loading: Promise<void> | null = null;
	private listening = false;
	private activation = 0;

	/**
	 * 初始化 Fancybox
	 * 按需加载 Fancybox 模块和样式
	 */
	async init(): Promise<void> {
		if (document.body.classList.contains("desk-lite")) {
			this.listenForActivation();
			return;
		}
		await this.prepare();
	}

	private async prepare(): Promise<void> {
		const hasImages = this.checkForImages();

		if (!hasImages) {
			return;
		}

		// 按需加载 Fancybox 模块
		if (!this.Fancybox) {
			this.loading ??= this.loadFancybox().finally(() => { this.loading = null; });
			await this.loading;
		}

		// 避免重复初始化
		if (this.boundSelectors.length > 0) {
			return;
		}

		this.bindImageSelectors();
		this.initialized = true;
	}

	private listenForActivation(): void {
		for (const image of document.querySelectorAll<HTMLImageElement>(FANCYBOX_SELECTORS.albumImages)) {
			if (image.closest("a, button")) continue;
			image.tabIndex = 0;
			image.setAttribute("role", "button");
			image.setAttribute("aria-haspopup", "dialog");
			image.setAttribute("aria-label", `${document.documentElement.lang === "en" ? "Enlarge image" : document.documentElement.lang === "zh-Hant" ? "放大圖片" : "放大图片"}${image.alt ? `: ${image.alt}` : ""}`);
		}
		if (this.listening) return;
		this.listening = true;
		const selector = Object.values(FANCYBOX_SELECTORS).join(",");
		document.documentElement.addEventListener("click", event => {
			if (this.initialized || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
			const target = event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null;
			if (!target) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			void this.openAfterLoad(target);
		}, true);
		document.documentElement.addEventListener("keydown", event => {
			const target = event.target;
			if ((event.key === "Enter" || event.key === " ") && target instanceof HTMLImageElement && target.matches(`${selector}`) && target.getAttribute("role") === "button") {
				event.preventDefault();
				void this.openAfterLoad(target);
			}
		});
		document.addEventListener("astro:before-swap", () => {
			this.activation++;
			this.Fancybox?.close();
		});
	}

	private async openAfterLoad(target: HTMLElement): Promise<void> {
		const activation = ++this.activation;
		const previous = (target.closest("a") || target).nextElementSibling;
		if (previous?.matches(".lightbox-load-error")) previous.remove();
		target.setAttribute("aria-busy", "true");
		try {
			await this.prepare();
			if (!target.isConnected || activation !== this.activation) return;
			this.Fancybox.fromTriggerEl(target);
		} catch (error) {
			console.error("Image viewer unavailable", error);
			if (!target.isConnected || activation !== this.activation) return;
			const english = document.documentElement.lang === "en";
			const traditional = document.documentElement.lang === "zh-Hant";
			const message = document.createElement("p");
			message.className = "lightbox-load-error";
			message.setAttribute("role", "status");
			const retry = document.createElement("button");
			retry.type = "button";
			retry.textContent = english ? "Image viewer failed. Retry" : traditional ? "圖片檢視器載入失敗，重試" : "图片查看器加载失败，重试";
			retry.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); void this.openAfterLoad(target); });
			const original = document.createElement("a");
			const image = target instanceof HTMLImageElement ? target : target.querySelector("img");
			original.href = target.dataset.src || target.getAttribute("href") || image?.dataset.src || image?.currentSrc || image?.src || "";
			original.textContent = english ? "Open original" : traditional ? "開啟原圖" : "打开原图";
			original.target = "_blank";
			original.rel = "noopener";
			message.append(retry, " · ", original);
			(target.closest("a") || target).after(message);
		} finally { target.removeAttribute("aria-busy"); }
	}

	/**
	 * 检查页面是否有需要 Fancybox 的图片
	 */
	private checkForImages(): boolean {
		return (
			document.querySelector(FANCYBOX_SELECTORS.albumImages) !== null ||
			document.querySelector(FANCYBOX_SELECTORS.albumLinks) !== null ||
			document.querySelector(FANCYBOX_SELECTORS.singleFancybox) !== null
		);
	}

	/**
	 * 加载 Fancybox 模块和样式
	 */
	private async loadFancybox(): Promise<void> {
		const [mod, vendorStyles, customStyles] = await Promise.all([
			import("@fancyapps/ui"),
			import("@fancyapps/ui/dist/fancybox/fancybox.css?inline"),
			import("../../styles/fancybox-custom.css?inline"),
		]);
		if (!document.querySelector("[data-fancybox-styles]")) {
			const style = document.createElement("style");
			style.dataset.fancyboxStyles = "true";
			style.textContent = vendorStyles.default + customStyles.default;
			(document.getElementById("desk-features") || document.head).append(style);
		}
		this.Fancybox = mod.Fancybox;
	}

	/**
	 * 绑定图片选择器
	 */
	private bindImageSelectors(): void {
		if (!this.Fancybox) {
			return;
		}

		const commonConfig = getDefaultFancyboxConfig();
		// Astro replaces body during navigation; keep click delegation on html.

		// 绑定相册/文章图片
		this.Fancybox.bind(document.documentElement, FANCYBOX_SELECTORS.albumImages, {
			...commonConfig,
			groupAll: true,
			Carousel: {
				transition: "slide",
				preload: 2,
			},
		});
		this.boundSelectors.push(FANCYBOX_SELECTORS.albumImages);

		// 绑定相册链接
		this.Fancybox.bind(document.documentElement, FANCYBOX_SELECTORS.albumLinks, {
			...commonConfig,
			source: (el: any) => {
				return el.getAttribute("data-src") || el.getAttribute("href");
			},
		});
		this.boundSelectors.push(FANCYBOX_SELECTORS.albumLinks);

		// 绑定单独的 fancybox 图片
		this.Fancybox.bind(document.documentElement, FANCYBOX_SELECTORS.singleFancybox, commonConfig);
		this.boundSelectors.push(FANCYBOX_SELECTORS.singleFancybox);
	}

	/**
	 * 清理 Fancybox 绑定
	 * 在页面切换前调用
	 */
	cleanup(): void {
		if (!this.Fancybox) {
			return;
		}

		this.boundSelectors.forEach((selector) => {
			this.Fancybox.unbind(document.documentElement, selector);
		});
		this.boundSelectors = [];
		this.initialized = false;
	}

	/**
	 * 完全销毁 Fancybox
	 */
	destroy(): void {
		this.cleanup();
		this.Fancybox = null;
		this.initialized = false;
	}

	/**
	 * 获取初始化状态
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * 获取已绑定的选择器列表
	 */
	getBoundSelectors(): string[] {
		return [...this.boundSelectors];
	}
}

// 创建全局实例
const fancyboxScope = window as typeof window & { __sayoriFancyboxHandler?: FancyboxHandler };

/**
 * 获取全局 Fancybox 处理器实例
 */
export function getFancyboxHandler(): FancyboxHandler {
	return fancyboxScope.__sayoriFancyboxHandler ??= new FancyboxHandler();
}

/**
 * 初始化 Fancybox（便捷函数）
 */
export async function initFancybox(): Promise<void> {
	const handler = getFancyboxHandler();
	await handler.init();
}

/**
 * 清理 Fancybox（便捷函数）
 */
export function cleanupFancybox(): void {
	if (fancyboxScope.__sayoriFancyboxHandler) {
		fancyboxScope.__sayoriFancyboxHandler.cleanup();
	}
}
