import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_ATTEMPTS = 12;
const DEFAULT_DELAY_MS = 5_000;

export async function verifyBlogDeployment(
	baseUrl,
	expected,
	{
		fetchImpl = fetch,
		attempts = DEFAULT_ATTEMPTS,
		delayMs = DEFAULT_DELAY_MS,
	} = {},
) {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			await verifyOnce(baseUrl, expected, fetchImpl);
			return;
		} catch (error) {
			lastError = error;
			if (attempt < attempts) await delay(delayMs);
		}
	}
	throw lastError;
}

async function verifyOnce(baseUrl, expected, fetchImpl) {
	const root = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
	const manifestResponse = await requireOk(fetchImpl, new URL("deployment.json", root));
	const manifest = await manifestResponse.json();
	for (const [key, value] of Object.entries(expected)) {
		if (manifest[key] !== value) {
			throw new Error(`deployment manifest mismatch for ${key}`);
		}
	}

	const pagefind = await requireOk(fetchImpl, new URL("pagefind/pagefind.js", root));
	if ((await pagefind.text()).length < 100) {
		throw new Error("Pagefind asset is unexpectedly small");
	}

	const rss = await requireOk(fetchImpl, new URL("rss.xml", root));
	if (!(await rss.text()).includes("<rss")) {
		throw new Error("RSS output is invalid");
	}

	const health = await requireOk(
		fetchImpl,
		new URL("api/healthz", root),
		{ headers: { Origin: "https://sayori.org" } },
	);
	if (health.headers.get("access-control-allow-origin") !== "*") {
		throw new Error("health endpoint CORS policy is missing");
	}
	const healthBody = await health.json();
	if (healthBody.status !== "ok") {
		throw new Error("health endpoint did not confirm D1 availability");
	}
}

async function requireOk(fetchImpl, url, init) {
	const response = await fetchImpl(url, init);
	if (!response.ok) {
		throw new Error(`${url.pathname} returned HTTP ${response.status}`);
	}
	return response;
}

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function required(name) {
	const value = String(process.env[name] || "").trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

const isMain = process.argv[1]
	&& path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
	await verifyBlogDeployment(process.argv[2] || "https://blog.sayori.org", {
		codeSha: required("DEPLOYMENT_CODE_SHA"),
		contentSha: required("DEPLOYMENT_CONTENT_SHA"),
		builtAt: required("DEPLOYMENT_BUILT_AT"),
		workflowRun: required("DEPLOYMENT_WORKFLOW_RUN"),
	});
	console.log("[deployment-smoke] Blog manifest, Pagefind, RSS, D1, and CORS passed");
}
