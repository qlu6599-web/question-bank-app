window.HomePage = {
  render(ctx) {
    ctx.setShell("智题库", "选择科目", { hideMode: true, showBack: false });
    const { el, percent } = window.AppUI;
    const root = el("section", "screen screen--home");
    const grid = el("div", "subject-grid");

    window.QuestionRepository.getSubjects(ctx.repository).forEach((subject) => {
      const questions = window.QuestionRepository.getQuestions(ctx.repository, { subject: subject.name });
      const done = questions.filter((question) => ctx.state.answers[question.id]).length;
      const card = el("button", "subject-card", "");
      card.type = "button";
      card.style.setProperty("--accent", subject.accent);
      card.innerHTML = `
        <span class="subject-card__mark"></span>
        <strong>${subject.name}</strong>
        <span>${subject.description}</span>
        <em>${done}/${subject.total} 已完成 · ${percent(done, subject.total)}%</em>
      `;
      card.addEventListener("click", () => ctx.openSubject(subject.name));
      grid.append(card);
    });

    root.append(grid);
    window.AppUI.setView(ctx.view, root);
  }
};
