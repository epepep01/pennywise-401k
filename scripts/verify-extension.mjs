import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verify } from "./extension-integrity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const record = JSON.parse(await readFile(path.join(root, "build/extension-integrity.json"), "utf8"));
const digest = process.argv[3] ?? record.sha256;
if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Invalid SHA-256 digest");
const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "build/extension-releases", digest);
console.log(`Verified extension SHA-256: ${await verify(directory, digest)}`);
