import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const URL = "https://workplaceservices.fidelity.com/mybenefits/dcnav/pages/contributions#/landing";

async function setup() {
  vi.resetModules();
  const request = vi.fn().mockResolvedValue(true);
  const remove = vi.fn().mockResolvedValue(true);
  const contains = vi.fn().mockResolvedValue(false);
  const query = vi.fn().mockResolvedValue([{ id: 7, url: URL }]);
  const executeScript = vi.fn().mockResolvedValue([{ frameId: 0, result: {
    url: URL, text: "Contribution rate: 6%\nEmployee YTD contributions: $12,000.00",
  } }]);
  vi.stubGlobal("chrome", {
    permissions: { request, remove, contains },
    tabs: { query }, scripting: { executeScript },
    alarms: { create: vi.fn().mockResolvedValue(undefined) },
  });
  const access = await import("./access");
  const reader = await import("./read-provider");
  return { request, remove, contains, query, executeScript, ...access, ...reader };
}

describe("scoped permission lifecycle", () => {
  it("requests on invocation and revokes both privileges before returning candidates", async () => {
    const api = await setup();
    const promise = api.readProvider();
    expect(api.request).toHaveBeenCalledWith(api.READ_ACCESS);
    const source = await promise;
    expect(source.candidates.map((item) => item.value)).toEqual([6, 12000]);
    expect(api.executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 7 }, world: "ISOLATED" }));
    expect(api.remove).toHaveBeenCalledWith(api.READ_ACCESS);
    expect(api.contains).toHaveBeenCalledTimes(2);
  });
  it("does not read if access is denied", async () => {
    const api = await setup();
    api.request.mockResolvedValue(false);
    await expect(api.readProvider()).rejects.toThrow("declined");
    expect(api.executeScript).not.toHaveBeenCalled();
    expect(api.remove).toHaveBeenCalled();
  });
  it("cleans up if data is cleared while the permission prompt is open", async () => {
    const api = await setup();
    await expect(api.readProvider(() => false)).rejects.toThrow("cancelled");
    expect(api.executeScript).not.toHaveBeenCalled();
    expect(api.remove).toHaveBeenCalled();
  });
  it("refuses unsupported hosts and routes before injection", async () => {
    const api = await setup();
    for (const url of ["https://example.com", URL.replace("contributions", "withdrawals"), URL.replace("fidelity.com", "fidelity.com.evil.example")]) {
      api.query.mockResolvedValue([{ id: 7, url }]);
      await expect(api.readProvider()).rejects.toThrow("Open Fidelity");
    }
    expect(api.executeScript).not.toHaveBeenCalled();
  });
  it("revokes access after an injection error", async () => {
    const api = await setup();
    api.executeScript.mockRejectedValue(new Error("Injection refused"));
    await expect(api.readProvider()).rejects.toThrow("Injection refused");
    expect(api.remove).toHaveBeenCalled();
  });
  it("discards results if the page navigated or the active tab changed", async () => {
    const api = await setup();
    api.query.mockResolvedValueOnce([{ id: 7, url: URL }]).mockResolvedValueOnce([{ id: 8, url: URL }]);
    await expect(api.readProvider()).rejects.toThrow("active page changed");
    api.query.mockResolvedValue([{ id: 7, url: URL }]);
    api.executeScript.mockResolvedValue([{ frameId: 0, result: { url: URL + "/changed", text: "Contribution rate: 6%" } }]);
    await expect(api.readProvider()).rejects.toThrow("Page changed");
  });
  it("rejects malformed or oversized messages and subframe results", async () => {
    const api = await setup();
    for (const response of [
      [{ frameId: 1, result: { url: URL, text: "Contribution rate: 6%" } }],
      [{ frameId: 0, result: { url: URL, text: "x".repeat(10_001) } }],
      [{ frameId: 0, result: { url: URL, text: { bad: true } } }], [],
    ]) {
      api.executeScript.mockResolvedValue(response);
      await expect(api.readProvider()).rejects.toThrow("Page changed");
    }
  });
  it("never returns data if either permission remains granted", async () => {
    const api = await setup();
    api.contains.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(api.readProvider()).rejects.toThrow("could not be removed");
  });
  it("expires review after one minute and rejects clocks moving backwards", async () => {
    const api = await setup();
    const source = await api.readProvider();
    expect(api.reviewIsFresh(source, source.capturedAt + 59_999)).toBe(true);
    expect(api.reviewIsFresh(source, source.capturedAt + 60_000)).toBe(false);
    expect(api.reviewIsFresh(source, source.capturedAt - 1)).toBe(false);
  });
  it("allows only the exact HTTPS overview without queries, credentials or editing routes", async () => {
    const api = await setup();
    expect(api.isContributionUrl(URL)).toBe(true);
    for (const url of [URL.replace("https", "http"), URL.replace("#/landing", "#/edit"), URL.replace("#/landing", "?token=secret"), URL.replace("https://", "https://user@"), URL.replace(".com/", ".com:444/"), URL.replace("workplaceservices", "nb")]) {
      expect(api.isContributionUrl(url)).toBe(false);
    }
  });
});
