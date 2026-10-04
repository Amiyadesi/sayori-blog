export function initCodeCollapse() {
	if (!document.body.classList.contains("desk-lite")) return;
	for (const block of document.querySelectorAll(".expressive-code:not(.collapsible)")) {
		const frame = block.querySelector(".frame");
		if (!frame || frame.classList.contains("has-title")) continue;
		block.classList.add("collapsible", "expanded");
		const button = document.createElement("button");
		button.className = "collapse-toggle-btn";
		button.type = "button";
		button.setAttribute("aria-label", document.documentElement.lang === "en" ? "Toggle code block" : "折叠或展开代码块");
		button.setAttribute("aria-expanded", "true");
		button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
		button.addEventListener("click", () => {
			const collapsed = block.classList.toggle("collapsed");
			block.classList.toggle("expanded", !collapsed);
			button.setAttribute("aria-expanded", String(!collapsed));
		});
		frame.appendChild(button);
	}
}
initCodeCollapse();
document.addEventListener("content-decrypted", initCodeCollapse);
