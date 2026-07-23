export const GROWTH_TOPIC_STATUSES = [
	"candidate",
	"draft",
	"published",
	"archived",
] as const;

export type GrowthTopicStatus = (typeof GROWTH_TOPIC_STATUSES)[number];

export interface SearchConsoleRow {
	query: string;
	page?: string;
	clicks: number;
	impressions: number;
	ctr: number;
	position: number;
}

export interface SearchOpportunity {
	eligible: boolean;
	reason: "position" | "low_ctr" | "insufficient_evidence" | "none";
	expectedCtr: number | null;
}

export interface CampaignEvidence {
	landingVisits: number;
	effectiveReads: number;
}

export interface CampaignReview {
	status: "ready" | "insufficient_evidence";
	effectiveReadRate: number | null;
}

export interface TopicCandidateSignal {
	slug: string;
	manualPriority?: number;
	longTermEvidenceCount: number;
	recentPublishedCount: number;
}

export const GSC_MIN_IMPRESSIONS = 20;
export const CAMPAIGN_MIN_LANDING_VISITS = 20;
export const DEVLOG_REMINDER_DAYS = 14;

export function formatGrowthMetric(
	input: unknown,
	locale = "zh-CN",
	fallback = "证据不足",
): string {
	if (input === null || input === undefined || input === "") return fallback;
	const number = Number(input);
	return Number.isFinite(number)
		? new Intl.NumberFormat(locale).format(number)
		: fallback;
}

function expectedCtrForPosition(position: number): number {
	if (position <= 1) return 0.18;
	if (position <= 3) return 0.08;
	if (position <= 10) return 0.025;
	return 0.01;
}

export function classifySearchOpportunity(
	row: SearchConsoleRow,
): SearchOpportunity {
	if (row.impressions < GSC_MIN_IMPRESSIONS) {
		return {
			eligible: false,
			reason: "insufficient_evidence",
			expectedCtr: null,
		};
	}

	if (row.position >= 4 && row.position <= 20) {
		return {
			eligible: true,
			reason: "position",
			expectedCtr: expectedCtrForPosition(row.position),
		};
	}

	const expectedCtr = expectedCtrForPosition(row.position);
	if (row.ctr < expectedCtr * 0.5) {
		return { eligible: true, reason: "low_ctr", expectedCtr };
	}

	return { eligible: false, reason: "none", expectedCtr };
}

export function reviewCampaign(
	evidence: CampaignEvidence,
): CampaignReview {
	if (evidence.landingVisits < CAMPAIGN_MIN_LANDING_VISITS) {
		return { status: "insufficient_evidence", effectiveReadRate: null };
	}

	return {
		status: "ready",
		effectiveReadRate:
			evidence.landingVisits === 0
				? 0
				: evidence.effectiveReads / evidence.landingVisits,
	};
}

export function shouldRemindDevlog(
	lastMilestoneAt: Date | string | number | null,
	now = new Date(),
): boolean {
	if (!lastMilestoneAt) return true;
	const timestamp = new Date(lastMilestoneAt).getTime();
	if (!Number.isFinite(timestamp)) return true;
	return now.getTime() - timestamp >= DEVLOG_REMINDER_DAYS * 86_400_000;
}

export function rankTopicCandidates(
	candidates: TopicCandidateSignal[],
): TopicCandidateSignal[] {
	return [...candidates].sort((left, right) => {
		const score = (candidate: TopicCandidateSignal) =>
			(candidate.manualPriority || 0) * 100 +
			candidate.longTermEvidenceCount * 10 +
			Math.min(candidate.recentPublishedCount, 5);
		return score(right) - score(left);
	});
}
