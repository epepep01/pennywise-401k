import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function inventory(directory, prefix = "") {
  const entries = await readdir(path.join(directory, prefix));
  const files = {};
  for (const name of entries.sort()) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = await lstat(path.join(directory, relative));
    if (stat.isSymbolicLink()) throw new Error(`Symlink refused: ${relative}`);
    if (stat.isDirectory()) Object.assign(files, await inventory(directory, relative));
    else if (stat.isFile()) files[relative] = hash(await readFile(path.join(directory, relative)));
    else throw new Error(`Unexpected file type: ${relative}`);
  }
  return files;
}
export function digestInventory(files) {
  return hash(JSON.stringify(Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))));
}
export async function verify(directory, expected) {
  const files = await inventory(directory);
  const actual = digestInventory(files);
  if (actual !== expected) throw new Error(`Extension integrity mismatch: expected ${expected}, found ${actual}`);
  return actual;
}
