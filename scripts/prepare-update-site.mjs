import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [,, input, tag] = process.argv;
const version = tag?.replace(/^v/, "");
const base = process.env.ORCHA_DESKTOP_UPDATE_PUBLIC_BASE_URL?.replace(/\/$/, "");
if (!input || !/^\d+\.\d+\.\d+/.test(version || "") || !base?.startsWith("https://")) throw new Error("Expected artifact directory, SemVer tag, and HTTPS public base URL");
const all = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => { const target = path.join(directory, entry.name); return entry.isDirectory() ? all(target) : [target]; });
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
const one = (files, check, label) => { const file = files.find(check); if (!file) throw new Error(`Missing ${label}`); return file; };
const sha = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const files = all(path.resolve(input));
fs.rmSync("site", { recursive: true, force: true });
fs.rmSync("release-assets", { recursive: true, force: true });
for (const arch of ["x64", "arm64"]) {
  const folder = one(files, file => file.replaceAll("\\", "/").endsWith(`/squirrel.windows/${arch}/RELEASES`), `Windows ${arch} RELEASES`);
  const source = path.dirname(folder);
  for (const name of fs.readdirSync(source)) if (name === "RELEASES" || /\.(nupkg|exe)$/.test(name)) copy(path.join(source, name), path.join("site", "win32", arch, name));
  const setup = one(all(source), file => /setup\.exe$/i.test(file), `Windows ${arch} setup EXE`);
  copy(setup, path.join("release-assets", `orcha-desktop-win32-${arch}-${version}.exe`));
}
for (const arch of ["x64", "arm64"]) {
  const normal = file => file.replaceAll("\\", "/").toLowerCase();
  const zip = one(files, file => normal(file).endsWith(".zip") && normal(file).includes(`/darwin/${arch}/`), `macOS ${arch} ZIP`);
  const dmg = one(files, file => normal(file).endsWith(".dmg") && normal(file).includes(`/${arch}/`), `macOS ${arch} DMG`);
  const name = `orcha-desktop-darwin-${arch}-${version}.zip`;
  const target = path.join("site", "darwin", arch, name);
  copy(zip, target); copy(zip, path.join("release-assets", name)); copy(dmg, path.join("release-assets", `orcha-desktop-darwin-${arch}-${version}.dmg`));
  fs.writeFileSync(path.join("site", "darwin", arch, "RELEASES.json"), JSON.stringify({ currentRelease: version, releases: [{ version, updateTo: { version, name: `Orcha Desktop ${version}`, notes: "Signed desktop release.", pub_date: new Date().toISOString(), url: `${base}/darwin/${arch}/${name}`, sha256: sha(target), size: fs.statSync(target).size } }] }, null, 2));
}
