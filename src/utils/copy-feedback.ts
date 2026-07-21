export const COPY_FEEDBACK_EVENT = "sayori:copy-feedback";

export type CopyFeedbackState = "working" | "success" | "error";

export interface CopyFeedbackDetail {
	state: CopyFeedbackState;
	message?: string;
}

const MINIMUM_WORKING_TIME_MS = 260;
let programmaticCopyDepth = 0;

export function getCopyFeedbackMessages(language: string) {
	if (language.toLowerCase().startsWith("zh")) {
		return {
			action: "复制代码",
			working: "正在复制...",
			success: "已复制",
			error: "复制失败，请手动复制",
		};
	}

	return {
		action: "Copy code",
		working: "Copying...",
		success: "Copied",
		error: "Copy failed. Please copy manually.",
	};
}

export function announceCopyFeedback(
	state: CopyFeedbackState,
	message?: string,
) {
	document.dispatchEvent(
		new CustomEvent<CopyFeedbackDetail>(COPY_FEEDBACK_EVENT, {
			detail: { state, message },
		}),
	);
}

export function isProgrammaticCopyActive() {
	return programmaticCopyDepth > 0;
}

export async function copyTextWithFeedback(text: string) {
	const startedAt = Date.now();
	programmaticCopyDepth += 1;
	announceCopyFeedback("working");

	try {
		await writeText(text);
		const remainingTime =
			MINIMUM_WORKING_TIME_MS - (Date.now() - startedAt);
		if (remainingTime > 0) {
			await new Promise((resolve) =>
				window.setTimeout(resolve, remainingTime),
			);
		}
		announceCopyFeedback("success");
	} catch (error) {
		announceCopyFeedback("error");
		throw error;
	} finally {
		programmaticCopyDepth = Math.max(0, programmaticCopyDepth - 1);
	}
}

async function writeText(text: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.inset = "-9999px auto auto -9999px";
	document.body.appendChild(textarea);
	textarea.select();

	try {
		if (!document.execCommand("copy")) {
			throw new Error("Clipboard API unavailable");
		}
	} finally {
		textarea.remove();
	}
}
