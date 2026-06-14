window.WrongBookPage = {
  render(ctx) {
    const { el, escapeHtml, typeLabel } = window.AppUI;
    ctx.setShell("错题本", "重新作答后再看解析", { hideMode: true, showBack: false });
    const questions = window.ErrorBook.getMistakeQuestions(ctx.state, ctx.repository);
    if (!questions.length) {
      window.AppUI.setView(ctx.view, window.AppUI.emptyState("暂无错题", "答错的题会自动进入错题本。"));
      return;
    }

    const root = el("section", "screen wrongbook-screen");
    const summary = el("div", "section-summary");
    summary.innerHTML = `<strong>${questions.length} 道待巩固</strong><span>错题不会直接显示答案，需要重新作答。</span>`;
    root.append(summary);

    const list = el("div", "wrong-list");
    questions.forEach((question) => {
      const row = el("button", "wrong-card", "");
      row.type = "button";
      row.style.setProperty("--accent", question.accent);
      row.innerHTML = `
        <span>${escapeHtml(question.subject)} · ${escapeHtml(typeLabel(question.type))}</span>
        <strong>${escapeHtml(question.question)}</strong>
        <em>重新作答</em>
      `;
      row.addEventListener("click", () => ctx.startWrongReview(question.id));
      list.append(row);
    });

    root.append(list);
    window.AppUI.setView(ctx.view, root);
  }
};
