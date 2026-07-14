/**
 * 返回顶部处理器
 * 管理返回顶部按钮和滚动监听
 */

import {
	BANNER_HEIGHT,
	BANNER_HEIGHT_HOME,
	SCROLL_CONFIG,
	SWUP_SELECTORS,
} from "../core/swup-config";
import { ScrollHandler } from "./scroll-handler";

/**
 * 返回顶部处理器类
 * 负责返回顶部按钮的显示/隐藏和滚动位置监听
 */
export class BackToTopHandler {
	private backToTopBtn: HTMLElement | null = null;
	private toc: HTMLElement | null = null;
	private navbar: HTMLElement | null = null;
	private bannerEnabled: boolean;
	private scrollHandler: () => void;

	constructor(bannerEnabled: boolean) {
		this.bannerEnabled = bannerEnabled;
		this.scrollHandler = ScrollHandler.throttle(
			this.handleScroll.bind(this),
			SCROLL_CONFIG.throttleInterval,
		);
	}

	/**
	 * 初始化返回顶部处理器
	 */
	init(): void {
		this.cacheElements();
		this.bindEvents();
	}

	/**
	 * 缓存 DOM 元素
	 */
	private cacheElements(): void {
		this.backToTopBtn = document.getElementById(
			SWUP_SELECTORS.backToTopBtn.slice(1),
		);
		this.toc = document.getElementById(SWUP_SELECTORS.tocWrapper.slice(1));
		this.navbar = document.getElementById(
			SWUP_SELECTORS.navbarWrapper.slice(1),
		);
	}

	/**
	 * 绑定事件监听
	 */
	private bindEvents(): void {
		// 使用 passive 事件监听器提升滚动性能
		window.addEventListener("scroll", this.scrollHandler, {
			passive: true,
		});
		window.addEventListener("resize", this.handleResize.bind(this), {
			passive: true,
		});
	}

	/**
	 * 处理滚动事件
	 */
	private handleScroll(): void {
		const scrollTop = document.documentElement.scrollTop;
		const bannerHeight = window.innerHeight * (BANNER_HEIGHT / 100);

		// 计算返回顶部按钮显示阈值
		const showBackToTopThreshold = this.calculateShowThreshold(scrollTop);

		// 批量处理 DOM 操作
		requestAnimationFrame(() => {
			this.updateBackToTopButton(scrollTop, showBackToTopThreshold);
			this.updateTOCVisibility(scrollTop, bannerHeight);
			this.updateNavbarVisibility(scrollTop);
		});
	}

	/**
	 * 计算返回顶部按钮显示阈值
	 */
	private calculateShowThreshold(scrollTop: number): number {
		const contentWrapper = document.getElementById(
			SWUP_SELECTORS.contentWrapper.slice(1),
		);
		let threshold =
			window.innerHeight * (BANNER_HEIGHT / 100) +
			SCROLL_CONFIG.backToTopOffset;

		if (contentWrapper) {
			const rect = contentWrapper.getBoundingClientRect();
			const absoluteTop = rect.top + scrollTop;
			threshold = absoluteTop + window.innerHeight / 4;
		}

		return threshold;
	}

	/**
	 * 更新返回顶部按钮可见性
	 */
	private updateBackToTopButton(scrollTop: number, threshold: number): void {
		if (!this.backToTopBtn) {
			return;
		}

		if (scrollTop > threshold) {
			this.backToTopBtn.classList.remove("hide");
		} else {
			this.backToTopBtn.classList.add("hide");
		}
	}

	/**
	 * 更新 TOC 可见性
	 */
	private updateTOCVisibility(scrollTop: number, bannerHeight: number): void {
		if (!this.bannerEnabled || !this.toc) {
			return;
		}

		const isBannerMode = document.body.classList.contains("enable-banner");

		if (isBannerMode) {
			if (scrollTop > bannerHeight) {
				this.toc.classList.remove("toc-hide");
			} else {
				this.toc.classList.add("toc-hide");
			}
		} else {
			// Fullscreen 或 None 模式下始终显示 TOC
			this.toc.classList.remove("toc-hide");
		}
	}

	/**
	 * 更新 Navbar 可见性
	 */
	private updateNavbarVisibility(scrollTop: number): void {
		if (!this.bannerEnabled || !this.navbar) {
			return;
		}

		const isHome =
			document.body.classList.contains("lg:is-home") &&
			window.innerWidth >= 1280;
		const currentBannerHeight = isHome ? BANNER_HEIGHT_HOME : BANNER_HEIGHT;

		const threshold =
			window.innerHeight * (currentBannerHeight / 100) -
			SCROLL_CONFIG.navbarHideOffset;

		if (scrollTop >= threshold) {
			this.navbar.classList.add("navbar-hidden");
		} else {
			this.navbar.classList.remove("navbar-hidden");
		}
	}

	/**
	 * 处理窗口大小变化
	 */
	private handleResize(): void {
		// 计算 --banner-height-extend
		// 需要是 4 的倍数以避免模糊文本
		let offset = Math.floor(
			window.innerHeight * (30 / 100), // BANNER_HEIGHT_EXTEND
		);
		offset = offset - (offset % 4);
		document.documentElement.style.setProperty(
			"--banner-height-extend",
			`${offset}px`,
		);
	}

	/**
	 * 销毁处理器
	 */
	destroy(): void {
		window.removeEventListener("scroll", this.scrollHandler);
		window.removeEventListener("resize", this.handleResize.bind(this));
		this.backToTopBtn = null;
		this.toc = null;
		this.navbar = null;
	}

	/**
	 * 更新 Banner 启用状态
	 */
	setBannerEnabled(enabled: boolean): void {
		this.bannerEnabled = enabled;
	}
}

// 创建全局实例
let globalBackToTopHandler: BackToTopHandler | null = null;

/**
 * 获取全局返回顶部处理器实例
 */
export function getBackToTopHandler(bannerEnabled: boolean): BackToTopHandler {
	if (!globalBackToTopHandler) {
		globalBackToTopHandler = new BackToTopHandler(bannerEnabled);
	}
	return globalBackToTopHandler;
}

/**
 * 初始化返回顶部处理器（便捷函数）
 */
export function initBackToTopHandler(bannerEnabled: boolean): void {
	const handler = getBackToTopHandler(bannerEnabled);
	handler.init();
}
