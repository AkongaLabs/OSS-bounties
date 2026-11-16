// Tiny static server for the two optional browser checks. The app itself needs no server.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
};

export async function startServer() {
  const server = createServer((request, response) => {
    const path = request.url === "/" ? "/index.html" : request.url.split("?")[0];
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    try {
      const body = readFileSync(file);
      response.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

export async function loadPlaywright() {
  try {
    const { chromium } = await import("playwright");
    return chromium;
  } catch {
    console.error("Playwright is not installed. Run:\n  bun add -d playwright");
    process.exit(2);
  }
}

// Prefers the Chrome that is already installed on this machine, which is also the browser this
// bounty targets. Falls back to Edge, then to Playwright's own Chromium if it was downloaded.
export async function launchBrowser(chromium, options = {}) {
  const attempts = [
    { channel: "chrome", label: "installed Google Chrome" },
    { channel: "msedge", label: "installed Microsoft Edge" },
    { label: "Playwright's bundled Chromium" },
  ];

  const problems = [];
  for (const attempt of attempts) {
    const { label, ...channel } = attempt;
    try {
      const browser = await chromium.launch({ ...channel, ...options });
      console.log(`Using ${label} (${browser.version()}).`);
      return browser;
    } catch (error) {
      problems.push(`${label}: ${error.message.split("\n")[0]}`);
    }
  }

  console.error("No usable browser found.\n  " + problems.join("\n  "));
  console.error("\nInstall Chrome, or download Playwright's Chromium: bun x playwright install chromium");
  process.exit(2);
}
