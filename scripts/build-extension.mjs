import ts from "typescript";
import { mkdir, readFile, writeFile, copyFile, rm, cp, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inventory, digestInventory, verify, hash } from "./extension-integrity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "build/extension");
await rm(output, { recursive: true, force: true });
const visited = new Set();
const sourceHashes = {};
const allowedSources = new Set([
  "extension/background.ts", "extension/chrome.ts", "extension/access.ts",
  "extension/panel.ts", "extension/import.ts", "extension/read-provider.ts",
  "src/lib/calc/calculator.ts", "src/lib/calc/limits.ts",
]);
async function compile(relative) {
  if (!allowedSources.has(relative)) throw new Error(`Unreviewed runtime source: ${relative}`);
  if (visited.has(relative)) return;
  visited.add(relative);
  const source = await readFile(path.join(root, relative), "utf8");
  sourceHashes[relative] = hash(source);
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: relative,
  });
  const ast = ts.createSourceFile(relative, result.outputText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const imports = [];
  const rewrites = [];
  function inspect(node) {
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (!ts.isStringLiteral(specifier) || !specifier.text.startsWith("./") && !specifier.text.startsWith("../")) {
        throw new Error(`External runtime dependency refused in ${relative}`);
      }
      imports.push(specifier.text);
      rewrites.push({ start: specifier.getStart(ast), end: specifier.end, text: JSON.stringify(`${specifier.text}.js`) });
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const call = node.expression.getText(ast);
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || /(^|\.)(eval|Function|require|fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)$/.test(call)) {
        throw new Error(`Dynamic code or network API refused in ${relative}: ${call}`);
      }
    }
    if (ts.isPropertyAccessExpression(node) && ["innerHTML", "outerHTML", "insertAdjacentHTML"].includes(node.name.text)) {
      throw new Error(`HTML injection sink refused in ${relative}`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(ast);
  let js = result.outputText;
  for (const edit of rewrites.sort((a, b) => b.start - a.start)) js = js.slice(0, edit.start) + edit.text + js.slice(edit.end);
  const destination = path.join(output, relative.replace(/\.ts$/, ".js"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, js);
  for (const dependency of imports) {
    await compile(path.normalize(path.join(path.dirname(relative), `${dependency}.ts`)));
  }
}
await compile("extension/background.ts");
await compile("extension/panel.ts");
for (const asset of ["sidepanel.html", "panel.css"]) {
  sourceHashes[`extension/${asset}`] = hash(await readFile(path.join(root, "extension", asset)));
  await copyFile(path.join(root, "extension", asset), path.join(output, "extension", asset));
}
await copyFile(path.join(root, "extension/manifest.json"), path.join(output, "manifest.json"));
sourceHashes["extension/manifest.json"] = hash(await readFile(path.join(root, "extension/manifest.json")));
const files = await inventory(output);
const sha256 = digestInventory(files);
const release = path.join(root, "build/extension-releases", sha256);
let exists = false;
try { await access(release); exists = true; } catch { /* New snapshot. */ }
if (exists) await verify(release, sha256);
else await cp(output, release, { recursive: true, errorOnExist: true, force: false });
await writeFile(path.join(root, "build/extension-integrity.json"), JSON.stringify({
  sha256, files, sources: sourceHashes,
  lockfileSha256: hash(await readFile(path.join(root, "package-lock.json"))),
  compiler: ts.version,
}, null, 2) + "\n");
console.log(`Reviewed snapshot directory: ${release}\nSHA-256: ${sha256}\nVerify with npm run verify:extension`);
