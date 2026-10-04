import { visit } from "unist-util-visit";

// Obsidian displays authored single newlines as line breaks within a paragraph.
export function remarkObsidianBreaks() {
	return (tree) => {
		visit(tree, "text", (node, index, parent) => {
			if (!/[\r\n]/.test(node.value)) return;
			const children = node.value.split(/\r\n|\r|\n/).flatMap((value, part) =>
				part === 0
					? [{ type: "text", value }]
					: [{ type: "break" }, { type: "text", value }],
			);
			parent.children.splice(index, 1, ...children);
			return index + children.length;
		});
	};
}
