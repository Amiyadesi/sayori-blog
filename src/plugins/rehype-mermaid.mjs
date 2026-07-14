import { readFileSync } from "node:fs";

import { h } from "hastscript";
import { visit } from "unist-util-visit";

const mermaidRenderScriptUrl = new URL(
	"./mermaid-render-script.js",
	import.meta.url,
);

export function rehypeMermaid() {
	return (tree) => {
		const mermaidRenderScript = readFileSync(
			mermaidRenderScriptUrl,
			"utf8",
		);

		visit(tree, "element", (node) => {
			if (
				node.tagName === "div" &&
				node.properties &&
				node.properties.className &&
				node.properties.className.includes("mermaid-container")
			) {
				const mermaidCode = node.properties["data-mermaid-code"] || "";
				const mermaidId = `mermaid-${Math.random().toString(36).slice(-6)}`;

				// 创建 Mermaid 容器
				const mermaidContainer = h(
					"div",
					{
						class: "mermaid-wrapper",
						id: mermaidId,
					},
					[
						h(
							"div",
							{
								class: "mermaid",
								"data-mermaid-code": mermaidCode,
							},
							mermaidCode,
						),
					],
				);

				// 创建客户端渲染脚本
				const renderScript = h(
					"script",
					{
						type: "text/javascript",
					},
					mermaidRenderScript,
				);

				// 替换原始节点
				node.tagName = "div";
				node.properties = { class: "mermaid-diagram-container" };
				node.children = [mermaidContainer, renderScript];
			}
		});
	};
}
