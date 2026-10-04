import { readFileSync } from "node:fs";

// Encode scan terms so the guard can scan its own source without exclusions.
const encoded: [string, string?][] = [
  ["JFL"], ["kooB ytidiuqiL"], ["riaPBL"], ["2v-eoj"], ["yvirP"],
  ["aisylE"], ["sjaisyle@"], ["nede", "word"], ["ztilB"],
  ["atrakaJ"], ["tsuguA 8", "date"], ["yfihparg"], ["yedipS"],
  ["naM-redipS", "hero"], ["erecniv-repmes"],
];
const terms = encoded.map(([value, rule]) => {
  const term = [...value].reverse().join("");
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const source = rule === "word" ? `\\b${escaped}\\b`
    : rule === "date" ? `(?<!\\d)${escaped}`
    : rule === "hero" ? term.replace("-", "[- ]?") : escaped;
  return { term, pattern: new RegExp(source, "i") };
});
const warnings = new RegExp(`\\b(${["ODOT", "DBT", "EMXIF"]
  .map((value) => [...value].reverse().join("")).join("|")})\\b`, "g");

function git(...args: string[]): Buffer {
  const result = Bun.spawnSync(["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `git exited ${result.exitCode}`);
  }
  return Buffer.from(result.stdout);
}

let files = 0;
let hits = 0;
function scan(path: string, content: Buffer) {
  files++;
  if (content.subarray(0, 8000).includes(0)) {
    const text = content.toString("latin1");
    for (const { term, pattern } of terms) {
      if (term.length < 5 || !pattern.test(text)) continue;
      console.error(`${path}:binary: ${term}`);
      hits++;
    }
    return;
  }
  content.toString("utf8").split(/\r?\n/).forEach((line, index) => {
    line = line.replace(
      /(?:sha1-[A-Za-z0-9+/]{27}=|sha256-[A-Za-z0-9+/]{43}=|sha384-[A-Za-z0-9+/]{64}|sha512-[A-Za-z0-9+/]{86}==)(?![A-Za-z0-9+/=])/g,
      "",
    );
    for (const { term, pattern } of terms) {
      if (!pattern.test(line)) continue;
      console.error(`${path}:${index + 1}: ${term}`);
      hits++;
    }
    for (const match of line.matchAll(warnings)) {
      console.warn(`warning: ${path}:${index + 1}: ${match[0]}`);
    }
  });
}

try {
  const args = process.argv.slice(2);
  const paths: string[] = [];
  let all = false;
  let message: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--all") all = true;
    else if (arg === "--msg") {
      message = args[++i];
      if (!message) throw new Error("--msg requires a file path");
    } else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else paths.push(arg);
  }
  const staged = !all && paths.length === 0;
  const selected = paths.length ? paths : git(...(all
    ? ["ls-files", "-z"]
    : ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]))
    .toString("utf8").split("\0").filter(Boolean);
  for (const path of selected) {
    scan(path, staged ? git("show", `:${path}`) : readFileSync(path));
  }
  if (message) scan("<commit message>", readFileSync(message));
  if (hits === 0) console.log(`guard: clean (${files} files)`);
  process.exitCode = hits ? 1 : 0;
} catch (error) {
  console.error(`guard: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
