import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workflow = fs.readFileSync(
	path.join(process.cwd(), ".github/workflows/deploy.yml"),
	"utf8",
);

test("D1 migration waits for an encrypted GitHub artifact", () => {
	const detectIndex = workflow.indexOf("Detect pending D1 migrations");
	const exportIndex = workflow.indexOf(
		"Export and encrypt D1 before migration",
	);
	const uploadIndex = workflow.indexOf(
		"Upload encrypted D1 backup to GitHub",
	);
	const migrationIndex = workflow.indexOf("Apply D1 migrations");

	assert.ok(detectIndex >= 0);
	assert.ok(exportIndex > detectIndex);
	assert.ok(uploadIndex > exportIndex);
	assert.ok(migrationIndex > uploadIndex);
	assert.match(workflow, /actions\/upload-artifact@v4/);
	assert.match(workflow, /retention-days:\s*30/);
	assert.match(workflow, /if-no-files-found:\s*error/);
	assert.doesNotMatch(
		workflow,
		/R2_BACKUP_ACCESS_KEY_ID|R2_BACKUP_SECRET_ACCESS_KEY|RESTIC_PASSWORD/,
	);
});

test("ordinary deployments do not create a D1 backup artifact", () => {
	assert.match(workflow, /id:\s*d1_migrations/);
	assert.match(workflow, /d1 migrations list sayori-analytics/);
	assert.match(workflow, /No migrations to apply!/);

	const pendingGates =
		workflow.match(
			/if:\s*github\.event_name != 'pull_request' && steps\.d1_migrations\.outputs\.pending == 'true'/g,
		) ?? [];
	assert.equal(pendingGates.length, 3);
});
