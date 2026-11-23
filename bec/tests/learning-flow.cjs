// Requires Playwright. Start an HTTP server at the repository root first.
// BEC_URL points to the /bec/ entry. BEC_CHROMIUM can point to a system Chromium.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BEC_CHROMIUM || undefined });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: width <= 640 ? 667 : 844 }, isMobile: width < 600, hasTouch: width < 600 });
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
      assert.equal(await page.evaluate(() => WORDS.length), 6416);
      assert.equal(await page.evaluate(() => pdfStats.added), 582);
      assert.equal(await page.evaluate(() => Object.values(pdfStats.groups).every(g => g.unresolved === 0)), true);
      assert.equal(await page.evaluate(() => WORDS.filter(w=>w.official_bec).length), 2842);
      assert.equal(await page.evaluate(() => WORDS.filter(w=>filterGroup(w,"business")).length), 46);
      assert.equal(await page.evaluate(() => WORDS.filter(w=>filterGroup(w,"pet-new")).length), await page.evaluate(() => SUPPLEMENT.stats.petAdded));
      assert.deepEqual(await page.evaluate(() => {
        state.source = "official";
        const list = candidates();
        return [list.length, list.some(w => w.w === "B.Sc."), list.some(w => w.w === "annual report"),
          CORE_PRIMARY.size, new Set([...CORE.values()].filter(c=>c.example_en).map(c=>c.term)).size];
      }), [2842, true, true, 150, 84]);
      const go = async name => page.locator('[data-tab="' + name + '"]').click();
      const fit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await fit();
      if (width <= 640) {
        const first = await page.evaluate(() => ({
          homeStart: document.getElementById("homeStart").getBoundingClientRect().bottom,
          homeWeak: document.getElementById("homeWeak").getBoundingClientRect().bottom,
          bar: document.getElementById("navbar").getBoundingClientRect().top
        }));
        assert.ok(first.homeStart < first.bar && first.homeWeak < first.bar, "primary home actions stay above the fixed navigation");
      }
      await go("learn");
      const priorPracticeState = await page.evaluate(() => localStorage.getItem("bec-v12-state"));
      await page.click("#startMeaningChoice");
      assert.equal(await page.locator("#meaningChoicePanel .meaning-option").count(), 4);
      assert.equal(await page.locator("#learnCard").isVisible(), false);
      await page.getByRole("button",{name:"播放单词发音"}).click();
      assert.equal(await page.evaluate(() => window.spoken.at(-1)[0]), await page.locator(".meaning-word").innerText());
      await page.locator("#meaningChoicePanel .meaning-option").first().click();
      assert.ok(await page.locator(".meaning-feedback").innerText());
      await page.getByRole("button",{name:"下一题",exact:true}).click();
      await page.getByRole("button",{name:"返回练习选择"}).click();
      await page.click("#startTranslateSentence");
      assert.equal(await page.locator(".bec-sentence-title").innerText(),"翻译这句话");
      await page.getByRole("button",{name:"朗读英文句子",exact:true}).click();
      assert.equal(await page.evaluate(() => window.spoken.at(-1)[0]),"Please send me the invoice.");
      for (const chunk of ["请","把","发票","发给","我"]) await page.locator(".bes-bank").getByRole("button",{name:chunk,exact:true}).click();
      await page.getByRole("button",{name:"检查",exact:true}).click();
      assert.match(await page.locator(".bes-result").innerText(),/答对了/);
      await page.getByRole("button",{name:"退出句子练习"}).click();
      await page.click("#startFillSentence");
      assert.equal(await page.locator(".bec-sentence-title").innerText(),"选词填空");
      await page.locator(".bes-bank").getByRole("button",{name:"an",exact:true}).click();
      await page.getByRole("button",{name:"检查",exact:true}).click();
      assert.match(await page.locator(".bes-result").innerText(),/答对了/);
      await go("home");
      assert.equal(await page.locator(".bec-sentence").isVisible(),false);
      assert.equal(await page.evaluate(() => localStorage.getItem("bec-v12-state")),priorPracticeState);
      await go("learn");
      await fit();
      if (width <= 640) await page.locator("#learnSettings > summary").click();
      await page.selectOption("#wordSource", "official");
      await page.click("#startWords");
      const before = await page.evaluate(() => JSON.stringify(deck()));
      await go("library");
      await page.selectOption("#wordFilter", "core");
      await page.fill("#search", "company");
      assert.match(await page.locator(".result").first().innerText(), /company/);
      const row = page.locator("#searchResults .vocab-entry").first();
      await row.getByRole("button", {name: "读单词：company"}).click();
      assert.equal(await page.locator("#wordDetail").isHidden(), true, "speaker should not open the vocabulary card");
      assert.deepEqual(await page.evaluate(() => spoken.at(-1)), ["company", "en-GB", 0.82]);
      await row.locator(".result").click();
      await page.locator("#wordDetail .word-audio").getByRole("button", {name: "读单词：company"}).click();
      assert.deepEqual(await page.evaluate(() => spoken.at(-1)), ["company", "en-GB", 0.82]);
      if (width <= 640) assert.equal(await page.locator("#wordDetail .word-details").evaluate(d => d.open), false);
      assert.match(await page.locator("#wordDetail .example-preview").innerText(), /a trading company/);
      await page.locator('#wordDetail .example-preview [data-say="a trading company"]').click();
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
      await go("library");
      await page.selectOption("#wordFilter", "business");
      await page.fill("#search", "synergy");
      await page.locator(".result").first().click();
      assert.match(await page.locator("#wordDetail").textContent(), /商务英语补充/);
      await page.click("#practiceWord");
      await page.fill("#typing", "synergy");
      await page.click("#checkWord");
      assert.match(await page.locator("#typeResult").innerText(), /拼写正确/);
      await go("library");
      await page.selectOption("#wordFilter", "pet-new");
      await page.fill("#search", "alarm clock");
      await page.locator(".result").first().click();
      assert.match(await page.locator("#wordDetail").textContent(), /PET 2023/);
      for (const [source, term] of [["pet_intro","multiple-choice question"], ["pet_text","wordlist"], ["bec_text","annual report"], ["core_pdf","by the way"], ["bec_scenes","cold call"], ["bec_az","work order"]]) {
        await page.selectOption("#wordFilter", source);
        await page.fill("#search", term);
        await page.locator(".result").filter({hasText:term}).first().click();
        assert.match(await page.locator("#wordDetail").textContent(), /PDF|考试介绍|PET 正文|BEC 正文|BEC 场景词汇|BEC 通关 A–Z/);
      }
      await go("grammar");
      if (width <= 640) await page.locator("#grammarSettings > summary").click();
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
