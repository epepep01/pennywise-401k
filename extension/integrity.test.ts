import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { digestInventory, inventory, verify } from "../scripts/extension-integrity.mjs";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "pennywise-integrity-"));
  directories.push(directory);
  await writeFile(path.join(directory, "panel.js"), "// synthetic package\n");
  const digest = digestInventory(await inventory(directory));
  return { directory, digest };
}
describe("release integrity verification", () => {
  it("verifies byte-identical artifacts independent of file ordering", async () => {
    const { directory, digest } = await fixture();
    expect(await verify(directory, digest)).toBe(digest);
    expect(digestInventory({ b: "2", a: "1" })).toBe(digestInventory({ a: "1", b: "2" }));
  });
  it("detects modified and unexpected files", async () => {
    const { directory, digest } = await fixture();
    await writeFile(path.join(directory, "extra.js"), "// unexpected\n");
    await expect(verify(directory, digest)).rejects.toThrow("mismatch");
    await rm(path.join(directory, "extra.js"));
    await writeFile(path.join(directory, "panel.js"), "// changed\n");
    await expect(verify(directory, digest)).rejects.toThrow("mismatch");
  });
  it("refuses symlinks rather than following files outside the package", async () => {
    const { directory, digest } = await fixture();
    await symlink(path.join(directory, "panel.js"), path.join(directory, "link.js"));
    await expect(verify(directory, digest)).rejects.toThrow("Symlink refused");
  });
});
