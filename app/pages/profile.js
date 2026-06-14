window.ProfilePage = {
  render(ctx) {
    const { el } = window.AppUI;
    ctx.setShell("我的", "用户系统占位", { hideMode: true, showBack: false });
    const user = window.UserService.getCurrentUser();
    const root = el("section", "screen profile-screen");
    const profile = el("div", "profile-card");
    profile.innerHTML = `
      <div class="avatar">${user.name.slice(0, 1)}</div>
      <div>
        <h2>${user.name}</h2>
        <p>${user.plan}</p>
      </div>
    `;

    const actions = el("div", "settings-list");
    actions.append(
      settingButton(user.id === "guest" ? "Demo 登录" : "退出登录", user.id === "guest" ? "体验用户系统预留入口" : "清除本地 Demo 用户", () => {
        if (user.id === "guest") window.UserService.loginDemo();
        else window.UserService.logout();
        ctx.render();
      }),
      settingButton("云同步", "预留 API，当前保存到本地草稿", async () => {
        const result = await window.CloudSyncService.pushProgress(ctx.state);
        window.AppUI.showToast(result.ok ? "已写入本地同步草稿。" : "同步失败");
      }),
      settingButton("重置练习数据", "清空答题、错题和进度", () => {
        window.AppStore.resetStudyState(ctx.state);
        window.AppUI.showToast("练习数据已重置。");
        ctx.render();
      })
    );

    root.append(profile, actions);
    window.AppUI.setView(ctx.view, root);

    function settingButton(title, desc, onClick) {
      const button = el("button", "setting-row", "");
      button.type = "button";
      button.innerHTML = `<span><strong>${title}</strong><em>${desc}</em></span><b>›</b>`;
      button.addEventListener("click", onClick);
      return button;
    }
  }
};
