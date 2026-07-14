/**
 * TOC 组件统一导出
 *
 * Astro 组件使用包装器模式重导出
 * Svelte 组件（MobileTOC）请从原始位置导入：@components/MobileTOC.svelte
 */

// 组件导出（兼容包装器）
export { default as FloatingTOC } from "./FloatingTOC.astro";
export { default as SidebarTOC } from "./SidebarTOC.astro";

// 子组件导出
export { default as TOCBadge } from "./components/TOCBadge.astro";
export { default as TOCItemComponent } from "./components/TOCItem.astro";
export { default as TOCProgressBar } from "./components/TOCProgressBar.astro";

// 类型导出
export type {
	HeadingData,
	TOCBaseProps,
	TOCConfig,
	TOCItem,
	TOCObserverOptions,
	TOCScrollOptions,
} from "./types/toc";

// 工具函数导出
export {
	calculateReadingProgress,
	createHeadingObserver,
	debounce,
	extractHeadings,
	generateTOCItems,
	getMinLevel,
	getTOCConfig,
	scrollToHeading,
} from "./utils/toc-utils";

// Hooks 导出
export * from "./hooks/useFloatingTOC";

// Navigation hooks
export {
	createHeadingClickHandler,
	extractHeadingsFromDOM,
	getContainerSelector,
	getTOCConfig as getTocConfig,
	isPostPage,
	scrollToHeading as scrollToTocHeading,
} from "./hooks/useTocNavigation";

// Highlight hooks
export {
	calculateActiveHeadingRange,
	calculateFallbackActiveHeading,
	createHeadingVisibilityObserver,
	findActiveHeadingByObserver,
	findActiveHeadingIndex,
	isElementInViewport,
} from "./hooks/useTocHighlight";

// Scroll hooks
export {
	calculateActiveIndicatorPosition,
	createScrollHandler,
	debounce as debounceScroll,
	calculateReadingProgress as getReadingProgress,
	scrollActiveIntoView,
	throttle as throttleScroll,
	updateProgressRing,
} from "./hooks/useTocScroll";

// Calculator utilities
export {
	getKatakanaBadge,
	JAPANESE_KATAKANA,
	KATAKANA_COUNT,
} from "./utils/japanese-katakana";
export {
	getMinLevel as calcMinLevel,
	generateTOCItems as calcTOCItems,
	getBadgeClass,
	getBadgeText,
	getIndentClass,
	getTextClass,
	isInRange,
} from "./utils/toc-calculator";
