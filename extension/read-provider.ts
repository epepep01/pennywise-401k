import { chromeApi } from "./chrome";
import { READ_ACCESS, isContributionUrl, revokeReadAccess, REVOKE_ALARM } from "./access";
import { extractCandidates, readVisibleDetails, type Candidate } from "./import";

export type ReviewedSource = { tabId: number; url: string; capturedAt: number; candidates: Candidate[] };
export const REVIEW_LIFETIME_MS = 60_000;

// Invoke directly from the Read button: permissions.request must run within
// that user gesture, without awaiting another operation first.
export async function readProvider(canContinue = () => true): Promise<ReviewedSource> {
  let source: ReviewedSource | undefined;
  try {
    if (!await chromeApi.permissions.request(READ_ACCESS)) {
      throw new Error("Page access was declined. Manual entry is still available.");
    }
    if (!canContinue()) throw new Error("Read cancelled. Nothing was imported.");
    await chromeApi.alarms.create(REVOKE_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
    const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined || !tab.url || !isContributionUrl(tab.url)) {
      throw new Error("Open Fidelity’s NetBenefits contribution overview on workplaceservices.fidelity.com. Other pages use manual entry.");
    }
    if (!canContinue()) throw new Error("Read cancelled. Nothing was imported.");
    const responses = await chromeApi.scripting.executeScript({
      target: { tabId: tab.id }, world: "ISOLATED", func: readVisibleDetails,
    });
    const snapshot: unknown = responses[0]?.result;
    if (responses.length !== 1 || responses[0]?.frameId !== 0 ||
      !snapshot || typeof snapshot !== "object" ||
      !("url" in snapshot) || snapshot.url !== tab.url ||
      !("text" in snapshot) || typeof snapshot.text !== "string" || snapshot.text.length > 10_000) {
      throw new Error("Page changed or returned unexpected details. Nothing was imported.");
    }
    // A second check catches navigation while the reader was running.
    const [current] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (current?.id !== tab.id || current.url !== tab.url) {
      throw new Error("The active page changed. Nothing was imported.");
    }
    source = { tabId: tab.id, url: tab.url, capturedAt: Date.now(), candidates: extractCandidates(snapshot.text) };
  } finally {
    // Do not display or apply extracted details if revocation fails.
    await revokeReadAccess();
  }
  return source;
}

export function reviewIsFresh(source: ReviewedSource, now = Date.now()): boolean {
  const elapsed = now - source.capturedAt;
  return elapsed >= 0 && elapsed < REVIEW_LIFETIME_MS && isContributionUrl(source.url);
}
