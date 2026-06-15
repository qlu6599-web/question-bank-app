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
      const currentIndex = window.QuizEngine.getCurrentIndex(ctx.state, subject.name, item.type, questions.length);
      const hasProgress = done > 0 || currentIndex > 0;
      const isComplete = done >= item.count && item.count > 0;
      const card = el("article", "type-card", "");
      card.style.setProperty("--accent", subject.accent);
      card.innerHTML = `
        <span>${typeLabel(item.type)}</span>
        <strong>${item.count}</strong>
        <em>${done}/${item.count} 已完成 · ${percent(done, item.count)}%</em>
      `;
      const actions = el("div", "type-card__actions");
      if (!hasProgress) {
        actions.append(makeTypeAction("primary", "开始刷题", () => ctx.startQuiz(subject.name, item.type)));
      } else if (isComplete) {
        actions.append(makeTypeAction("primary", "重新刷", () => ctx.restartQuiz(subject.name, item.type)));
      } else {
        actions.append(
          makeTypeAction("ghost", "继续", () => ctx.startQuiz(subject.name, item.type)),
          makeTypeAction("primary", "重新刷", () => ctx.restartQuiz(subject.name, item.type))
        );
      }
      card.append(actions);
      grid.append(card);
    });
    root.append(grid);

    const mixedTitle = el("h2", "section-title", "综合随机刷题");
    const mixedGrid = el("div", "type-grid");
    const allQuestions = window.QuestionRepository.getQuestions(ctx.repository, { subject: subject.name });
    window.MixedPractice.countOptions.forEach((count) => {
      const actualCount = Math.min(count, allQuestions.length);
      const card = el("button", "type-card", "");
      card.type = "button";
      card.style.setProperty("--accent", subject.accent);
      card.innerHTML = `
        <span>不限题型</span>
        <strong>${actualCount}</strong>
        <em>随机抽题 · 尽量避开已抽题</em>
      `;
      card.disabled = actualCount === 0;
      card.addEventListener("click", () => ctx.startMixedPractice(subject.name, actualCount));
      mixedGrid.append(card);
    });
    root.append(mixedTitle, mixedGrid);
    window.AppUI.setView(ctx.view, root);

    function makeTypeAction(variant, text, onClick) {
      const button = el("button", `type-card__action type-card__action--${variant}`, text);
      button.type = "button";
      button.addEventListener("click", onClick);
      return button;
    }
  }
};
