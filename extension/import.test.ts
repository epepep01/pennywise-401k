import { afterEach, describe, expect, it, vi } from "vitest";
import { extractCandidates, providerName, readVisibleDetails } from "./import";

afterEach(() => vi.unstubAllGlobals());
const contributionUrl = "https://workplaceservices.fidelity.com/mybenefits/dcnav/pages/contributions#/landing";

function pageFixture(texts: string[], forbidden: number[] = []) {
  const marker = {};
  vi.stubGlobal("window", { top: marker, self: marker });
  vi.stubGlobal("location", { href: contributionUrl });
  vi.stubGlobal("NodeFilter", { SHOW_ELEMENT: 1 });
  vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible" }));
  const nodes = texts.map((text, index) => ({
    innerText: text, children: [], childElementCount: 0,
    nextElementSibling: null as unknown,
    closest: () => forbidden.includes(index) ? {} : null,
    querySelector: () => null,
    getClientRects: () => [1],
  }));
  nodes.forEach((node, index) => { node.nextElementSibling = nodes[index + 1] ?? null; });
  let index = 0;
  const documentMock = {
    body: { get innerText(): never { throw new Error("Whole body text must not be read"); } },
    querySelector: () => null as unknown,
    createTreeWalker: () => ({ nextNode: () => nodes[index++] ?? null }),
  };
  vi.stubGlobal("document", documentMock);
  return documentMock;
}

describe("provider page imports", () => {
  it("reads explicit totals with inline and stacked layouts", () => {
    expect(extractCandidates("Current contribution rate\n8%\nEmployee year-to-date contributions: $12,345.67"))
      .toEqual([
        { field: "currentContributionRate", value: 8, evidence: "Current contribution rate: 8%" },
        { field: "contributionsYtdThisEmployer", value: 12345.67, evidence: "Employee year-to-date contributions: $12,345.67" },
      ]);
  });
  it("does not treat balances, employer match, after-tax or split sources as employee totals", () => {
    expect(extractCandidates([
      "Account balance: $100,000.00", "Employer YTD contributions: $4,000.00",
      "Pretax contribution rate: 6%", "Roth contribution rate: 3%",
      "After-tax contribution rate: 10%", "YTD contributions: $20,000.00",
      "Employee contributions: $12,000.00", "Employee YTD contributions including match: $15,000.00",
    ].join("\n"))).toEqual([]);
  });
  it("keeps conflicting plan values as separate choices without adding them together", () => {
    const result = extractCandidates("Contribution rate: 6%\nContribution rate: 9%\nContribution rate: 6%");
    expect(result.map((candidate) => candidate.value)).toEqual([6, 9]);
  });
  it("rejects malformed, negative and unbounded values and trailing untrusted markup", () => {
    expect(extractCandidates([
      "Contribution rate: 101%", "Contribution rate: -6%", "Contribution rate: 6% <script>alert(1)</script>",
      "Employee YTD contributions: $12,34.00", "Employee YTD contributions: -$10.00",
      "Employee YTD contributions: $10,000.00 including match",
    ].join("\n"))).toEqual([]);
  });
  it("only labels genuine Fidelity domains as Fidelity", () => {
    expect(providerName("nb.fidelity.com")).toBe("Fidelity / NetBenefits");
    expect(providerName("workplaceservices.fidelity.com")).toBe("Fidelity / NetBenefits");
    expect(providerName("www.netbenefits.com")).toBe("Fidelity / NetBenefits");
    expect(providerName("fidelity.com.evil.example")).toBe("fidelity.com.evil.example");
  });
  it("refuses password or OTP screens, including hidden authentication controls", () => {
    const fixture = pageFixture([]);
    fixture.querySelector = () => ({});
    expect(() => readVisibleDetails()).toThrow("Do not read authentication screens.");
  });
  it("reads only small contribution elements, without reading the whole page or controls", () => {
    pageFixture(["Private account information", "Contribution rate", "6%", "Employee YTD contributions: $12,000.00", "Contribution rate: 99%"], [4]);
    expect(readVisibleDetails()).toEqual({ url: contributionUrl, text: "Contribution rate\n6%\nEmployee YTD contributions: $12,000.00" });
  });
  it("checks the URL again in the page before inspecting its DOM", () => {
    pageFixture([]);
    vi.stubGlobal("location", { href: "https://workplaceservices.fidelity.com/mybenefits/dcnav/pages/withdrawals" });
    expect(() => readVisibleDetails()).toThrow("Unsupported");
  });
  it("refuses iframe execution", () => {
    pageFixture([]);
    vi.stubGlobal("window", { top: {}, self: {} });
    expect(() => readVisibleDetails()).toThrow("Unsupported");
  });
  it("bounds the number of returned elements", () => {
    pageFixture(Array(100).fill("Contribution rate: 6%"));
    expect(readVisibleDetails().text.split("\n")).toHaveLength(40);
  });
  it("does not return arbitrary text following a contribution label", () => {
    pageFixture(["Contribution rate", "Secret account detail"]);
    expect(readVisibleDetails().text).toBe("Contribution rate");
  });
});
