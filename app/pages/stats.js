window.StatsPage = {
  render(ctx) {
    const { el, percent, typeLabel } = window.AppUI;
    ctx.setShell("学习统计", "数据分析模块", { hideMode: true, showBack: false });
    const summary = window.StatsEngine.summarize(ctx.state, ctx.repository.questions);
    const root = el("section", "screen stats-screen");
    const cards = el("div", "metric-grid");

    [
      ["已完成", summary.totalAnswered, "题"],
      ["正确率", summary.accuracy, "%"],
      ["错题数", summary.wrongCount, "题"],
      ["总题量", summary.totalQuestions, "题"]
    ].forEach(([label, value, unit]) => {
      const card = el("div", "metric-card");
      card.innerHTML = `<span>${label}</span><strong>${value}</strong><em>${unit}</em>`;
      cards.append(card);
    });

    const subjectList = el("div", "stats-list");
    Object.entries(summary.subjectStats).forEach(([subject, item]) => {
      subjectList.append(statsRow(subject, item));
    });

    const typeList = el("div", "stats-list");
    Object.entries(summary.typeStats).forEach(([type, item]) => {
      typeList.append(statsRow(typeLabel(type), item));
    });

    root.append(cards, sectionTitle("按科目"), subjectList, sectionTitle("按题型"), typeList);
    window.AppUI.setView(ctx.view, root);

    function sectionTitle(text) {
      const title = el("h2", "section-title", text);
      return title;
    }

    function statsRow(title, item) {
      const rate = item.scored ? Math.round((item.correct / item.scored) * 100) : 0;
      const row = el("div", "stats-row");
      row.innerHTML = `
        <div>
          <strong>${title}</strong>
          <span>${item.answered}/${item.total} 已完成</span>
        </div>
        <div class="mini-track"><span style="width:${percent(item.correct, item.scored)}%"></span></div>
        <em>${rate}%</em>
      `;
      return row;
    }
  }
};
