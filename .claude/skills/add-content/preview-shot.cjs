// Screenshot the sprite preview page for a proposal.
//
//   node .claude/skills/add-content/preview-shot.cjs <out.png> "<query>" [port]
//
//   query: the part after "?" in /preview.html, for example
//          "show=fishing_rod,campfire|campfire_2&bg=sand&compare=male_down,palm_tall"
//
// Needs a running dev server (npm run dev -- --port <port>) and Playwright
// (preinstalled in Claude cloud sessions; elsewhere: npx playwright install chromium).

const { chromium } = require('playwright');

(async () => {
  const [, , out, query, port = '5173'] = process.argv;
  if (!out || !query) {
    console.error('usage: node preview-shot.cjs <out.png> "<query>" [port]');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/preview.html?${query}`);
  await page.waitForTimeout(700);
  const problem = await page.locator('.error').allTextContents();
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  if (errors.length || problem.length) {
    console.error([...errors, ...problem].join('\n'));
    process.exit(1);
  }
  console.log(`saved ${out}`);
})();
