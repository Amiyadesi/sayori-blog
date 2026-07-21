import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	buildIpReview,
	buildCommentStats,
	canonicalCommentPath,
	getCommentIp,
	maskIp,
	normalizeCommentQuery,
	sanitizeComment,
} from "./comments.js";

describe("admin comment stats", () => {
	it("normalizes comment paths", () => {
		assert.equal(
			canonicalCommentPath("/posts/blog-author-9-questions-answer/"),
			"/posts/blog-author-9-questions-answer",
		);
		assert.equal(
			canonicalCommentPath(
				"https://blog.sayori.org/posts/blog-author-9-questions-answer/",
			),
			"/posts/blog-author-9-questions-answer",
		);
	});

	it("clamps Twikoo admin pagination query values", () => {
		const query = normalizeCommentQuery(
			new URL("https://blog.sayori.org/api/admin/comments?per=500&pages=20"),
		);
		assert.deepEqual(query, { per: 100, pages: 5 });
	});

	it("sanitizes comments for the admin dashboard without exposing raw Twikoo fields", () => {
		const comment = sanitizeComment({
			_id: "comment-id",
			url: "/posts/blog-author-9-questions-answer/",
			nick: "Visitor",
			mail: " visitor@example.com ",
			ip: "203.0.113.10",
			comment: "<p>这个怎么处理？</p>",
			created: 1760000000000,
			isSpam: true,
		});

		assert.equal(comment.url, "/posts/blog-author-9-questions-answer");
		assert.equal(comment.commentText, "这个怎么处理？");
		assert.equal(comment.email, "visitor@example.com");
		assert.equal(comment.status, "hidden");
		assert.equal(comment.isQuestion, true);
		assert.equal(comment.ipReview.present, true);
		assert.equal(comment.ipReview.maskedIp, "203.0.113.x");
		assert.equal(JSON.stringify(comment).includes("203.0.113.10"), false);
		assert.equal(JSON.stringify(comment).includes("comment-id"), false);
	});

	it("builds masked IP review summaries without exposing raw IP", () => {
		const review = buildIpReview({
			ip: "2001:db8:85a3::8a2e:370:7334",
			country: "US",
			region: "California",
			city: "Los Angeles",
			isp: "Example ISP",
			isProxy: true,
		});

		assert.equal(getCommentIp({ ip: "203.0.113.10, 198.51.100.1" }), "203.0.113.10");
		assert.equal(maskIp("203.0.113.10"), "203.0.113.x");
		assert.equal(review.present, true);
		assert.equal(review.maskedIp.startsWith("2001:db8:85a3"), true);
		assert.equal(review.countryCode, "US");
		assert.equal(review.flag, "🇺🇸");
		assert.equal(review.riskLevel, "medium");
		assert.deepEqual(review.riskLabels, ["Proxy"]);
		assert.equal(JSON.stringify(review).includes("7334"), false);
	});

	it("builds aggregate stats from sanitized comments", () => {
		const comments = [
			sanitizeComment({
				_id: "1",
				url: "/posts/a",
				nick: "A",
				comment: "请问可以这样吗？",
				created: 3,
			}),
			sanitizeComment({
				_id: "2",
				url: "/posts/a",
				nick: "B",
				comment: "普通评论",
				created: 2,
			}),
			sanitizeComment({
				_id: "3",
				url: "/posts/b",
				nick: "C",
				comment: "第二个问题？",
				created: 1,
				isSpam: true,
			}),
		];

		const stats = buildCommentStats(10, 8, 2, comments);
		assert.equal(stats.summary.total, 10);
		assert.equal(stats.summary.loaded, 3);
		assert.equal(stats.summary.sampled, true);
		assert.equal(stats.summary.questionCount, 2);
		assert.equal(stats.summary.ipReviewed, 0);
		assert.equal(stats.summary.ipRisky, 0);
		assert.equal(stats.topPages[0].url, "/posts/a");
		assert.equal(stats.topPages[0].count, 2);
		assert.equal(stats.recentQuestions[0].nick, "A");
		assert.equal(stats.recentComments[0].created, 3);
	});

	it("includes risky IP review samples in aggregate stats", () => {
		const comments = [
			sanitizeComment({
				url: "/posts/a",
				nick: "A",
				comment: "普通评论",
				created: 1,
				ip: "203.0.113.10",
				isVpn: true,
			}),
		];

		const stats = buildCommentStats(1, 1, 0, comments);

		assert.equal(stats.summary.ipReviewed, 1);
		assert.equal(stats.summary.ipRisky, 1);
		assert.equal(stats.riskyComments[0].ipReview.maskedIp, "203.0.113.x");
		assert.equal(JSON.stringify(stats).includes("203.0.113.10"), false);
	});

	it("keeps IP.SB-only reviews at unknown risk", () => {
		const review = buildIpReview(
			{ ip: "1.1.1.1" },
			{
				countryCode: "US",
				asn: "AS13335",
				organization: "Cloudflare, Inc.",
				riskSignalsKnown: false,
				source: "ipsb",
			},
		);

		assert.equal(review.riskSignalsKnown, false);
		assert.equal(review.riskScore, null);
		assert.equal(review.riskLevel, "unknown");
		assert.deepEqual(review.riskLabels, []);
		assert.equal(review.source, "ipsb");
	});
});
