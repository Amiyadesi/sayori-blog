export const analyticsPreferenceKey = "sayori:analytics-consent:v1";
export const analyticsConsentEvent = "sayori:analytics-consent";

let sessionChoice: boolean | undefined;

export function analyticsPreference() {
	if (sessionChoice !== undefined) return sessionChoice;
	try {
		return localStorage.getItem(analyticsPreferenceKey) === "allow";
	} catch {
		return false;
	}
}

export function setAnalyticsPreference(allowed: boolean) {
	const previouslyAllowed = analyticsPreference();
	sessionChoice = allowed;
	try {
		localStorage.setItem(analyticsPreferenceKey, allowed ? "allow" : "off");
		if (!allowed) localStorage.removeItem("sayoriAnalytics:visitor");
	} catch { /* Blocked storage leaves this tab's choice in memory. */ }
	if (!allowed) {
		try { sessionStorage.removeItem("sayoriAnalytics:session"); } catch { /* Storage may be blocked. */ }
	}
	document.dispatchEvent(new CustomEvent(analyticsConsentEvent, { detail: allowed }));
	// Third-party trackers already running cannot reliably be unloaded in place.
	if (!allowed && previouslyAllowed) window.location.reload();
}
