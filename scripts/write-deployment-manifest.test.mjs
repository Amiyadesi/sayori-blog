import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
	new URL("./write-deployment-manifest.mjs", import.meta.url),
);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-manifest-"));

try {
	const outputPath = path.join(tmpRoot, "deployment.json");
	const result = run(outputPath, {
		DEPLOYMENT_CODE_SHA: "1".repeat(40),
		DEPLOYMENT_CONTENT_SHA: "2".repeat(40),
		DEPLOYMENT_BUILT_AT: "2026-07-16T04:05:06.000Z",
		DEPLOYMENT_WORKFLOW_RUN: "https://github.com/Amiyadesi/sayori-blog/actions/runs/123",
	});

	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), {
		codeSha: "1".repeat(40),
		contentSha: "2".repeat(40),
		builtAt: "2026-07-16T04:05:06.000Z",
		workflowRun: "https://github.com/Amiyadesi/sayori-blog/actions/runs/123",
	});

	const incompletePath = path.join(tmpRoot, "incomplete.json");
	const incomplete = run(incompletePath, {
		DEPLOYMENT_CODE_SHA: "1".repeat(40),
	});
	assert.equal(incomplete.status, 1);
	assert.match(incomplete.stderr, /DEPLOYMENT_CONTENT_SHA/);
	assert.equal(fs.existsSync(incompletePath), false);
} finally {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function run(outputPath, env) {
	const childEnv = { ...process.env };
	for (const name of [
		"DEPLOYMENT_CODE_SHA",
		"DEPLOYMENT_CONTENT_SHA",
		"DEPLOYMENT_BUILT_AT",
		"DEPLOYMENT_WORKFLOW_RUN",
	]) {
		delete childEnv[name];
	}

	return spawnSync(process.execPath, [scriptPath, outputPath], {
		encoding: "utf8",
		env: { ...childEnv, ...env },
	});
}
