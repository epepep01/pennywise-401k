export type ImportField = "currentContributionRate" | "contributionsYtdThisEmployer";
export type Candidate = { field: ImportField; value: number; evidence: string };

export function providerName(hostname: string): string {
  return /(^|\.)(netbenefits\.com|fidelity\.com)$/i.test(hostname)
    ? "Fidelity / NetBenefits" : hostname;
}

// Deliberately accept explicit totals only. Split sources, balances and matches
// must never silently become employee elective deferrals.
export function extractCandidates(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  const lines = text.slice(0, 30_000).split(/\n/).map((line) => line.trim()).filter(Boolean);
  const rateLabel = /^(?:current\s+)?(?:total\s+)?(?:employee\s+)?contribution\s+rate\s*[:–-]?\s*/i;
  const ytdLabel = /^(?:(?:total\s+)?employee\s+(?:ytd|year.to.date)\s+contributions|(?:ytd|year.to.date)\s+(?:total\s+)?employee\s+contributions|(?:total\s+)?employee\s+contributions\s*\((?:ytd|year.to.date)\))\s*[:–-]?\s*/i;
  for (let index = 0; index < lines.length && candidates.length < 20; index++) {
    const line = lines[index];
    for (const [field, label, valuePattern] of [
      ["currentContributionRate", rateLabel, /^(\d{1,3}(?:\.\d+)?)\s*%$/],
      ["contributionsYtdThisEmployer", ytdLabel, /^\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)$/],
    ] as const) {
      const match = line.match(label);
      if (!match) continue;
      const rest = line.slice(match[0].length).trim();
      const valueText = rest || lines[index + 1] || "";
      const amount = valueText.match(valuePattern);
      if (!amount) continue;
      const value = Number(amount[1].replaceAll(",", ""));
      if (!Number.isSafeInteger(Math.round(value * 100)) || value > 1_000_000 || (field === "currentContributionRate" && value > 100)) continue;
      const evidence = rest ? line : `${line}: ${valueText}`;
      if (!candidates.some((candidate) => candidate.field === field && candidate.value === value)) {
        candidates.push({ field, value, evidence });
      }
    }
  }
  return candidates;
}

// Serialized by Chrome: keep this function self-contained. Read rendered text,
// never input values, cookies, credentials, network responses or hidden state.
export function readVisibleDetails(): { url: string; text: string } {
  // Repeat the caller's check inside the injected function to close the
  // navigation race between checking a tab URL and executing this script.
  const url = new URL(location.href);
  if (url.origin !== "https://workplaceservices.fidelity.com" || url.username || url.password || url.search !== "" ||
    !/^\/mybenefits\/dcnav\/pages\/contributions\/?$/.test(url.pathname) ||
    !["", "#", "#/", "#/landing"].includes(url.hash) || window.top !== window.self) {
    throw new Error("Unsupported contribution page.");
  }
  if (document.querySelector('input[type="password"], input[autocomplete="one-time-code"]')) {
    throw new Error("Do not read authentication screens.");
  }
  // Visit bounded small DOM elements, not the account page's entire body text.
  // Skip controls, editable content, hidden elements and executable content.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const selected: string[] = [];
  const label = /^(?:(?:current\s+)?(?:total\s+)?(?:employee\s+)?contribution\s+rate|(?:total\s+)?employee\s+(?:ytd|year.to.date)\s+contributions|(?:ytd|year.to.date)\s+(?:total\s+)?employee\s+contributions|(?:total\s+)?employee\s+contributions\s*\((?:ytd|year.to.date)\))(?:\s*[:–-]?\s*)(?:\$?\s*[\d,.]+\s*%?)?$/i;
  function textOf(element: HTMLElement): string {
    const excluded = 'input, textarea, select, [contenteditable], script, style, noscript, [hidden], [aria-hidden="true"]';
    if (element.childElementCount > 4 || [...element.children].some((child) => child.childElementCount > 0) ||
      element.closest(excluded) || element.querySelector(excluded) ||
      element.getClientRects().length === 0 || getComputedStyle(element).visibility !== "visible" ||
      typeof element.innerText !== "string") return "";
    const text = element.innerText.trim();
    return text.length <= 240 ? text : "";
  }
  let visited = 0;
  for (let node = walker.nextNode(); node && visited++ < 10_000 && selected.length < 40; node = walker.nextNode()) {
    const element = node as HTMLElement;
    // Only leaf labels or a compact label/value row. Never inspect containers
    // with grandchildren (which could contain large unrelated account sections).
    if ([...element.children].some((child) => child.childElementCount > 0)) continue;
    const text = textOf(element);
    if (!label.test(text.replace(/\n/g, " "))) continue;
    const next = element.nextElementSibling as HTMLElement | null;
    const value = next ? textOf(next) : "";
    selected.push(text);
    if (/^(?:\$\s*\d+(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:\.\d+)?\s*%)$/.test(value)) selected.push(value);
  }
  return { url: url.href, text: selected.join("\n") };
}
