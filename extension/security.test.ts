import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import manifest from "./manifest.json";

describe("extension security contract", () => {
  it("has no page access by default and limits optional access to one Fidelity host", () => {
    expect(manifest.manifest_version).toBe(3);
    expect([...manifest.permissions].sort()).toEqual(["alarms", "sidePanel"].sort());
    expect(manifest.optional_permissions).toEqual(["scripting"]);
    expect(manifest.optional_host_permissions).toEqual(["https://workplaceservices.fidelity.com/*"]);
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest).not.toHaveProperty("content_scripts");
    expect(manifest).not.toHaveProperty("externally_connectable");
    expect(manifest).not.toHaveProperty("web_accessible_resources");
    expect(manifest.incognito).toBe("not_allowed");
  });
  it("blocks extension-page connections, embedded content and remote code", () => {
    const csp = manifest.content_security_policy.extension_pages;
    for (const directive of ["default-src 'none'", "connect-src 'none'", "script-src 'self'", "object-src 'none'", "form-action 'none'", "frame-src 'none'", "require-trusted-types-for 'script'"]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toMatch(/unsafe-eval|unsafe-inline|https?:/);
  });
  it("does not interpolate page text as HTML or persist financial details", () => {
    const code = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|console\./);
  });
});
