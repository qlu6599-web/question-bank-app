window.WrongBookPage = (() => {
  function render(ctx) {
    const { el, escapeHtml, typeLabel } = window.AppUI;
    ctx.setShell("错题本", "重新作答后再看解析", { hideMode: true, showBack: false });
    const questions = window.ErrorBook.getMistakeQuestions(ctx.state, ctx.repository);
    if (!questions.length) {
      window.AppUI.setView(ctx.view, window.AppUI.emptyState("暂无错题", "答错的题会自动进入错题本。"));
      return;
    }

    const root = el("section", "screen wrongbook-screen");
    const summary = el("div", "section-summary");
    summary.innerHTML = `<strong>${questions.length} 道待巩固</strong><span>按科目连续重刷，答完一题直接进入下一题。</span>`;
    root.append(summary);

    const bySubject = groupBySubject(questions);
    const subjectGrid = el("div", "type-grid");
    Object.entries(bySubject).forEach(([subject, subjectQuestions]) => {
      const card = el("button", "type-card", "");
      card.type = "button";
      card.style.setProperty("--accent", subjectQuestions[0]?.accent || "#2563eb");
      card.innerHTML = `
        <span>${escapeHtml(subject)}</span>
        <strong>${subjectQuestions.length}</strong>
        <em>开始错题重刷</em>
      `;
      card.addEventListener("click", () => ctx.startWrongReviewSession(subject));
      subjectGrid.append(card);
    });
    root.append(subjectGrid);

    const title = el("h2", "section-title", "全部错题");
    root.append(title);

    const list = el("div", "wrong-list");
    questions.forEach((question) => {
      const row = el("button", "wrong-card", "");
      row.type = "button";
      row.style.setProperty("--accent", question.accent);
      row.innerHTML = `
        <span>${escapeHtml(question.subject)} · ${escapeHtml(typeLabel(question.type))}</span>
        <strong>${escapeHtml(question.question)}</strong>
        <em>从这里开始重刷</em>
      `;
      row.addEventListener("click", () => ctx.startWrongReviewSession(question.subject, question.id));
      list.append(row);
    });

    root.append(list);
    window.AppUI.setView(ctx.view, root);
  }

  function groupBySubject(questions) {
    return questions.reduce((acc, question) => {
      acc[question.subject] ||= [];
      acc[question.subject].push(question);
      return acc;
    }, {});
  }

  return { render };
})();
