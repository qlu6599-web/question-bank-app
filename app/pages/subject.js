window.SubjectPage = {
  render(ctx, subjectName) {
    const { el, percent, typeLabel } = window.AppUI;
    const subject = window.QuestionRepository.getSubject(ctx.repository, subjectName);
    if (!subject) {
      window.AppUI.setView(ctx.view, window.AppUI.emptyState("科目不存在", "请返回首页重新选择科目。"));
      return;
    }

    ctx.setShell(subject.name, "先选择题型再开始", { hideMode: false, showBack: true });
    const root = el("section", "screen subject-screen");
    const summary = el("div", "section-summary");
    summary.style.setProperty("--accent", subject.accent);
    summary.innerHTML = `
      <strong>${subject.name}</strong>
      <span>${subject.description}</span>
      <em>${subject.total} 道题 · ${subject.types.length} 个练习分类</em>
    `;
    root.append(summary);

    const grid = el("div", "type-grid");
    window.QuestionRepository.getTypesForSubject(ctx.repository, subject.name).forEach((item) => {
      const questions = window.QuestionRepository.getQuestions(ctx.repository, { subject: subject.name, type: item.type });
      const done = questions.filter((question) => ctx.state.answers[question.id]).length;
      const card = el("button", "type-card", "");
      card.type = "button";
      card.style.setProperty("--accent", subject.accent);
      card.innerHTML = `
        <span>${typeLabel(item.type)}</span>
        <strong>${item.count}</strong>
        <em>${done}/${item.count} 已完成 · ${percent(done, item.count)}%</em>
      `;
      card.addEventListener("click", () => ctx.startQuiz(subject.name, item.type));
      grid.append(card);
    });
    root.append(grid);
    window.AppUI.setView(ctx.view, root);
  }
};
