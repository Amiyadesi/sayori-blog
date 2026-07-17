import fs from "node:fs";
import path from "node:path";

const outputPath = process.argv[2];
if (!outputPath) {
	fail("output path is required");
}

const fields = {
	codeSha: required("DEPLOYMENT_CODE_SHA"),
	contentSha: required("DEPLOYMENT_CONTENT_SHA"),
	builtAt: required("DEPLOYMENT_BUILT_AT"),
	workflowRun: required("DEPLOYMENT_WORKFLOW_RUN"),
};

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(fields, null, 2)}\n`, "utf8");
console.log(`[deployment-manifest] wrote ${outputPath}`);

function required(name) {
	const value = String(process.env[name] || "").trim();
	if (!value) {
		fail(`${name} is required`);
	}
	return value;
}

function fail(message) {
	console.error(`[deployment-manifest] ${message}`);
	process.exit(1);
}
