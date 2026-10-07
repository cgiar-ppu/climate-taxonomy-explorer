// Placeholder build: writes dist/index.html + dist/robots.txt so the deploy pipeline has something to publish.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const title = "CGIAR Climate Adaptation and Mitigation Taxonomy v5 — Explorer";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
writeFileSync(
  "dist/index.html",
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f5f7f4; color: #1f3324; }
  main { max-width: 40rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.6rem; line-height: 1.3; margin: 0 0 .75rem; }
  p { font-size: 1.1rem; color: #4a5d4f; margin: 0; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p>Coming shortly.</p>
</main>
</body>
</html>
`
);
writeFileSync("dist/robots.txt", "User-agent: *\nDisallow: /\n");
console.log("placeholder written to dist/");
