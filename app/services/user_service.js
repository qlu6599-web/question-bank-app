window.UserService = {
  getCurrentUser() {
    const raw = localStorage.getItem("question-bank-user");
    return raw ? JSON.parse(raw) : { id: "guest", name: "游客用户", plan: "MVP 免费版" };
  },

  loginDemo() {
    const user = { id: "demo-user", name: "学习者", plan: "Demo Pro" };
    localStorage.setItem("question-bank-user", JSON.stringify(user));
    return user;
  },

  logout() {
    localStorage.removeItem("question-bank-user");
    return this.getCurrentUser();
  }
};
