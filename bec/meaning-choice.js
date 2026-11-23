(function (global) {
  "use strict";

  // These are the matching scene assets already used by the visual word lesson.
  const scenes = Object.freeze({
    quotation: "v131-quotation.jpg", contract: "v131-contract.jpg", invoice: "v131-invoice.jpg",
    payment: "v131-payment.jpg", client: "v131-client.jpg", customer: "handshake-client.svg",
    send: "email-laptop.svg", receive: "email-laptop.svg", sign: "contract-signing.svg",
    review: "document-review.svg", confirm: "email-laptop.svg", meeting: "v131-meeting.jpg",
    schedule: "meeting-room.svg", report: "v131-report.jpg", renew: "v131-renew.jpg",
    service: "handshake-client.svg", price: "office-documents.svg", cost: "office-documents.svg",
    document: "v131-document.jpg", email: "v131-email.jpg"
  });

  const placeholders = /释义待补|中文待补|待人工|暂无释义|未提供释义/;
  const hasHan = /[\u3400-\u9fff]/;
  const hanKey = text => (text.match(/[\u3400-\u9fff]/g) || []).join("");
  const termKey = word => String(word?.w || "").trim().toLowerCase().replace(/[‘’]/g, "'");
  const chineseLabel = value => {
    const text = String(value ?? "").replace(/\\n/g, "；").replace(/\s+/g, " ").trim();
    if (!hasHan.test(text) || placeholders.test(text)) return "";
    const cleaned = text
      .replace(/^\s*(?:(?:n|v|vt|vi|adj|adv|prep|pron|abbr)\.?[\s./&]+)+/i, "")
      .replace(/^\s*\[(?:网络|经|法|医学|计|医|化|机)\]\s*/, "");
    const chunks = cleaned.split(/[；;。]/).map(part => part.trim()).filter(part => hasHan.test(part));
    if (!chunks.length) return "";
    const first = chunks[0];
    if (first.length > 34) {
      const short = first.split(/[、，,]/).find(part => hasHan.test(part)) || first;
      return short.length > 34 ? short.slice(0, 32).trim() + "…" : short.trim();
    }
    const second = chunks.find(part => part !== first && hanKey(part) !== hanKey(first));
    return second && first.length + second.length + 1 <= 26 ? first + "；" + second : first;
  };
  function getDistinctList(words, meaning) {
    const used = new Set();
    const result = [];
    for (const word of words) {
      const key = termKey(word);
      if (!key || used.has(key)) continue;
      used.add(key);
      const gloss = String(meaning(word) ?? "").replace(/\\n/g, "；").trim();
      const label = chineseLabel(gloss);
      if (!label) continue;
      result.push({word, key, gloss, label});
    }
    return result;
  }
  function overlap(a, b) {
    const x = hanKey(a), y = hanKey(b);
    if (!x || !y) return false;
    const parts = value => value.split(/[；;。！？，、,（）()\s]/).map(hanKey).filter(Boolean);
    const left = parts(a), right = parts(b);
    // Check individual meanings as well as the entire label; never ask the
    // learner to distinguish a duplicated meaning such as “客户”.
    return x === y || left.some(p => right.some(q => p === q || (p.length > 1 && q.length > 1 && (p.includes(q) || q.includes(p)))));
  }
  function shuffle(rows, random) {
    const list = rows.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  function makeQuiz({questions, allWords, meaning, examplesFor = () => [], ipa = () => "", random = Math.random}) {
    const picked = getDistinctList(questions || [], meaning);
    const optionsPool = shuffle(getDistinctList(allWords || questions || [], meaning), random);
    const cards = [];
    for (const question of picked) {
      const wrong = [];
      // Rotate each question through the shuffled bank for variety; fallback
      // candidates never substitute for the question's actual selected deck.
      const start = Math.floor(random() * optionsPool.length);
      for (let offset = 0; offset < optionsPool.length && wrong.length < 3; offset++) {
        const candidate = optionsPool[(start + offset) % optionsPool.length];
        if (!candidate || candidate.key === question.key ||
          overlap(question.gloss, candidate.label) ||
          wrong.some(other => overlap(other.label, candidate.label))) continue;
        wrong.push(candidate);
      }
      if (wrong.length !== 3) continue;
      const examples = examplesFor(question.word) || [];
      const example = examples.find(e => typeof e?.en === "string" && /[a-z]/i.test(e.en) && /[.!?]["']?$/.test(e.en.trim())) ||
        examples.find(e => typeof e?.en === "string" && /[a-z]/i.test(e.en));
      cards.push({
        term: question.word.w, key: question.key, label: question.label,
        ipa: String(ipa(question.word) || "").trim(),
        example: example ? {en: example.en.trim(), zh: String(example.zh || "").trim()} : null,
        image: Object.prototype.hasOwnProperty.call(scenes, question.key) ? scenes[question.key] : null,
        options: shuffle([{label: question.label, correct: true}, ...wrong.map(x => ({label: x.label, correct: false}))], random)
      });
    }
    let index = 0, answer = null, correct = 0;
    return {
      view() {
        return {card: cards[index] || null, index, total: cards.length, skipped: picked.length - cards.length,
          requested: (questions || []).length, correct, answer, done: cards.length > 0 && index === cards.length};
      },
      choose(option) {
        if (answer || !Number.isInteger(option) || !cards[index]?.options[option]) return false;
        answer = {index: option, correct: cards[index].options[option].correct};
        if (answer.correct) correct++;
        return true;
      },
      next() {
        if (!answer) return false;
        index++;
        answer = null;
        return true;
      }
    };
  }

  const svgSpeaker = '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l4 4V6l-4 4H4z"/><path d="M16 9a4.3 4.3 0 0 1 0 6m3-9a8.5 8.5 0 0 1 0 12"/></svg>';

  function mount({root, launch, getSelection, allWords, meaning, examplesFor, ipa, speak, onOpen, onClose, random}) {
    if (!root || !launch) throw new Error("Meaning choice requires an existing panel and launch button");
    const doc = root.ownerDocument;
    let quiz = null;
    let scope = "";
    root.hidden = true;
    root.classList.add("meaning-quiz");

    function element(tag, cls, text) {
      const el = doc.createElement(tag);
      if (cls) el.className = cls;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function button(label, cls, action) {
      const el = element("button", cls, label);
      el.type = "button";
      el.addEventListener("click", action);
      return el;
    }
    function speaker(text, label) {
      const el = button(undefined, "meaning-speaker", () => speak?.(text));
      el.setAttribute("aria-label", label);
      el.title = label;
      el.innerHTML = svgSpeaker;
      return el;
    }
    function scrollPrompt(target) {
      if (!target) return;
      target.focus?.({preventScroll: true});
      target.scrollIntoView?.({block: "nearest"});
    }
    function leave({focus = false} = {}) {
      quiz = null;
      root.hidden = true;
      root.textContent = "";
      if (focus) launch.focus?.({preventScroll: true});
    }
    function returnToPractice() {
      leave();
      onClose?.();
      launch.focus?.({preventScroll: true});
    }
    function open() {
      const selection = getSelection();
      const questions = Array.isArray(selection) ? selection : selection?.words;
      scope = Array.isArray(selection) ? "" : String(selection?.label || "");
      quiz = makeQuiz({questions, allWords: typeof allWords === "function" ? allWords() : allWords,
        meaning, examplesFor, ipa, random});
      root.hidden = false;
      onOpen?.();
      render(true);
    }
    function render(focusHeading = false) {
      if (!quiz) return;
      const {card, index, total, answer, correct, done} = quiz.view();
      root.textContent = "";
      const head = element("div", "meaning-head");
      const heading = element("h2", "meaning-title", "选中文释义");
      heading.tabIndex = -1;
      const back = button("返回", "meaning-back", returnToPractice);
      back.setAttribute("aria-label", "返回练习选择");
      head.append(heading, back);
      root.append(head);
      if (scope) root.append(element("p", "meaning-scope", scope));
      if (!total || done) {
        const summary = element("div", "meaning-summary");
        summary.append(element("h3", "", done ? "本轮完成" : "暂时没有可用的选择题"));
        summary.append(element("p", "", done ? `答对 ${correct} / ${total} 题。本轮结果不会改变拼写进度或掌握状态。` : "这个范围没有足够的中文释义可出题。可以先切换词库，或继续做拼写练习。"));
        if (done) summary.append(button("再练一轮", "primary meaning-next", open));
        root.append(summary);
        if (focusHeading) scrollPrompt(heading);
        return;
      }
      const progress = element("progress", "meaning-progress");
      progress.max = total;
      progress.value = index + (answer ? 1 : 0);
      progress.setAttribute("aria-label", "选择题完成进度");
      const meter = element("div", "meaning-meter");
      meter.append(progress, element("span", "", `${index + 1} / ${total}`));
      root.append(meter);

      if (card.image) {
        const picture = element("img", "meaning-scene");
        picture.src = "./images/" + card.image;
        picture.alt = "";
        picture.loading = "lazy";
        picture.decoding = "async";
        picture.addEventListener("error", () => { picture.hidden = true; });
        root.append(picture);
      }
      const word = element("h3", "meaning-word", card.term);
      word.lang = "en";
      if (focusHeading) word.tabIndex = -1;
      root.append(word);
      const phonetic = element("div", "meaning-pron");
      phonetic.append(speaker(card.term, "播放单词发音"));
      if (card.ipa && !/音标待补|暂无/.test(card.ipa)) phonetic.append(element("span", "meaning-ipa", card.ipa));
      root.append(phonetic);
      if (card.example) {
        const context = element("div", "meaning-example");
        const sentence = element("p", "", card.example.en);
        sentence.lang = "en";
        context.append(speaker(card.example.en, "播放英文例句"), sentence);
        root.append(context);
      }
      const grid = element("div", "meaning-options");
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", "选择最符合的中文意思");
      const feedback = element("p", "meaning-feedback");
      feedback.setAttribute("role", "status");
      const next = button(index === total - 1 ? "查看结果" : "下一题", "primary meaning-next", () => {
        if (quiz.next()) render(true);
      });
      next.hidden = true;
      const optionButtons = [];
      card.options.forEach((option, i) => {
        const el = button(option.label, "meaning-option", () => {
          if (!quiz.choose(i)) return;
          updateAnswer();
        });
        optionButtons.push(el);
        grid.append(el);
      });
      function updateAnswer() {
        const current = quiz.view().answer;
        if (!current) return;
        progress.value = index + 1;
        card.options.forEach((option, i) => {
          const el = optionButtons[i];
          // Keep focus on the selected option for keyboard/AT, while the
          // handler and aria-disabled prevent grading more than once.
          el.setAttribute("aria-disabled", "true");
          el.classList.toggle("is-correct", option.correct);
          el.classList.toggle("is-wrong", i === current.index && !current.correct);
          if (option.correct) el.setAttribute("aria-label", option.label + "，正确释义");
          else if (i === current.index) el.setAttribute("aria-label", option.label + "，回答错误");
        });
        const base = current.correct ? "✓ 答对了" : "答错了";
        feedback.className = "meaning-feedback " + (current.correct ? "is-correct" : "is-wrong");
        feedback.textContent = base + "。正确释义：" + card.label + (card.example?.zh ? "。例句：" + card.example.zh : "");
        next.hidden = false;
      }
      root.append(grid, feedback, next);
      if (answer) updateAnswer();
      if (focusHeading) scrollPrompt(word);
    }

    launch.addEventListener("click", open);
    return Object.freeze({open, leave});
  }

  const api = Object.freeze({makeQuiz, mount});
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.BECMeaningChoice = api;
})(typeof globalThis === "object" ? globalThis : this);
