// Requires Playwright. Start an HTTP server at the repository root first.
// BEC_URL points to the /bec/ entry. BEC_CHROMIUM can point to a system Chromium.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BEC_CHROMIUM || undefined });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600 });
      await context.addInitScript(() => {
        window.spoken = [];
        window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
        Object.defineProperty(window, "speechSynthesis", { value: {
          getVoices: () => [{ lang: "en-GB" }], cancel() {},
          speak(u) { window.spoken.push([u.text, u.lang, u.rate]); }
        } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", err => errors.push(err.message));
      await page.goto(process.env.BEC_URL || "http://127.0.0.1:8765/bec/");
      await page.waitForFunction(() => !document.querySelector('#wordSource option[value="core"]').disabled);
      assert.equal(await page.title(), "BEC 起步｜手机学习版");
      assert.equal(await page.evaluate(() => WORDS.length), 5293);
      assert.deepEqual(await page.evaluate(() => {
        state.source = "official";
        const list = candidates();
        return [list.length, list.some(w => w.w === "B.Sc."), list.some(w => w.w === "annual report"),
          CORE_PRIMARY.size, new Set([...CORE.values()].filter(c=>c.example_en).map(c=>c.term)).size];
      }), [2842, true, true, 150, 84]);
      const go = async name => page.locator('[data-tab="' + name + '"]').click();
      const fit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await fit();
      await go("learn");
      await page.selectOption("#wordSource", "official");
      await page.click("#startWords");
      const before = await page.evaluate(() => JSON.stringify(deck()));
      await go("library");
      await page.selectOption("#wordFilter", "core");
      await page.fill("#search", "company");
      assert.match(await page.locator(".result").first().innerText(), /company/);
      await page.locator(".result").first().click();
      assert.match(await page.locator("#wordDetail").innerText(), /a trading company/);
      await page.locator('#wordDetail [data-say="a trading company"]').click();
      assert.deepEqual(await page.evaluate(() => spoken.at(-1)), ["a trading company", "en-GB", 0.82]);
      await page.locator('#wordDetail [data-level="unfamiliar"]').click();
      assert.equal(await page.locator('#wordDetail [data-level="unfamiliar"]').getAttribute("aria-pressed"), "true");
      await page.reload();
      assert.match(await page.locator("#homeWeak").innerText(), /（1）/);
      await page.click("#homeWeak");
      await page.locator('#reviewArea [data-level="mastered"]').click();
      assert.equal(await page.locator('#reviewArea [data-level="mastered"]').getAttribute("aria-pressed"), "true");
      await go("home");
      assert.match(await page.locator("#homeWeak").innerText(), /（0）/);
      await go("library");
      await page.selectOption("#wordFilter", "mastered");
      assert.match(await page.locator("#searchResults").innerText(), /company/);
      await page.selectOption("#wordFilter", "official");
      await page.fill("#search", "annual report");
      await page.locator(".result").first().click();
      await page.click("#practiceWord");
      await fit();
      assert.equal(await page.getAttribute("#typing", "autocorrect"), "off");
      await page.fill("#typing", "annual reports");
      await page.click("#checkWord");
      assert.match(await page.locator("#typeResult").innerText(), /再练一次/);
      await page.fill("#typing", "annual report");
      await page.press("#typing", "Enter");
      assert.match(await page.locator("#typeResult").innerText(), /拼写正确/);
      await page.click("#nextWord");
      assert.equal(await page.evaluate(() => JSON.stringify(deck())), before);
      await page.evaluate(() => {
        for (const event of state.events) event.day = today(-1);
        persist();
      });
      await page.reload();
      await page.click("#homeReview");
      await page.click('#reviewArea [data-say="annual report"]');
      await page.fill("#reviewTyping", "annual report");
      await page.click("#reviewCheck");
      assert.match(await page.locator("#reviewFeedback").innerText(), /正确/);
      await fit();
      await go("grammar");
      await page.locator("[data-lesson]").last().click();
      assert.equal(await page.locator("[data-lesson]").count(), 16);
      await fit();
      assert.deepEqual(errors, []);
      console.log(width + "px: navigation, official pool, PDF data, speak calls, spelling, day rollover and grammar OK");
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err);process.exitCode = 1; });
