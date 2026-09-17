import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import OpenCC from "opencc-js";

const toTraditional = OpenCC.Converter({ from: "cn", to: "t" });
const blockedTags = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "TEXTAREA"]);
const visibleAttributes = ["alt", "aria-label", "placeholder", "title"];
const visibleMeta = new Set([
	"description",
	"og:description",
	"og:image:alt",
	"og:site_name",
	"og:title",
	"twitter:description",
	"twitter:image:alt",
	"twitter:title",
]);
const jsonLdProtectedKeys = new Set(["@id", "email", "image", "item", "logo", "sameAs", "url"]);

export function convertHtml(source) {
	const document = parse(source, { comment: true });
	visit(document, false);
	for (const element of document.querySelectorAll("*")) {
		for (const attribute of visibleAttributes) {
			if (element.hasAttribute(attribute)) {
				element.setAttribute(attribute, toTraditional(element.getAttribute(attribute)));
			}
		}
	}
	for (const meta of document.querySelectorAll("meta[content]")) {
		const key = meta.getAttribute("name") || meta.getAttribute("property");
		if (visibleMeta.has(key)) meta.setAttribute("content", toTraditional(meta.getAttribute("content")));
	}
	for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
		try {
			script.set_content(JSON.stringify(convertJsonLd(JSON.parse(script.text))));
		} catch {
			// Leave malformed third-party JSON-LD unchanged.
		}
	}
	return `<!doctype html>${document.toString().replace(/^<!doctype html>/i, "")}`;
}

export function convertProtectedText(source) {
	const values = [];
	const protect = (value) => `OPENCCPROTECTED${values.push(value) - 1}TOKEN`;
	let output = source
		.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, protect)
		.replace(/<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>/gi, protect)
		.replace(/`[^`\r\n]+`/g, protect)
		.replace(/https?:\/\/[^\s<>'")]+/g, protect)
		.replace(/(["'])(?:\/(?!\/)|\.\.?\/)[^"'\r\n]+\1/g, protect);
	output = toTraditional(output);
	return output.replace(/OPENCCPROTECTED(\d+)TOKEN/g, (_, index) => values[Number(index)]);
}

function visit(node, blocked) {
	const nextBlocked = blocked || blockedTags.has(node.tagName);
	if (node.nodeType === 3 && !nextBlocked) node.rawText = toTraditional(node.rawText);
	for (const child of node.childNodes || []) visit(child, nextBlocked);
}

function convertJsonLd(value, key = "") {
	if (typeof value === "string") return jsonLdProtectedKeys.has(key) ? value : toTraditional(value);
	if (Array.isArray(value)) return value.map((item) => convertJsonLd(item, key));
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(Object.entries(value).map(([itemKey, item]) => [itemKey, convertJsonLd(item, itemKey)]));
}

function main() {
	const root = path.resolve(process.argv[2] || "");
	if (!process.argv[2] || !fs.existsSync(root)) throw new Error(`output directory missing: ${process.argv[2] || "(none)"}`);
	for (const filePath of walk(root)) {
		const extension = path.extname(filePath).toLowerCase();
		if (![".html", ".js", ".txt", ".xml"].includes(extension)) continue;
		const source = fs.readFileSync(filePath, "utf8");
		const output = extension === ".html" ? convertHtml(source) : convertProtectedText(source);
		fs.writeFileSync(filePath, output, "utf8");
	}
	console.log(`[convert-traditional-output] converted ${root}`);
}

function walk(directory) {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const filePath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...walk(filePath));
		else if (entry.isFile()) files.push(filePath);
	}
	return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
