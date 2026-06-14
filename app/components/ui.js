window.AppUI = (() => {
  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function setView(container, node) {
    container.replaceChildren(node);
    requestAnimationFrame(() => node.classList.add("is-visible"));
  }

  function optionLetter(index) {
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index] || "";
  }

  function percent(done, total) {
    return total ? Math.round((done / total) * 100) : 0;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function typeLabel(type) {
    return window.AppConfig.types[type]?.label || type;
  }

  function showToast(message) {
    const old = document.querySelector(".toast");
    old?.remove();
    const toast = el("div", "toast", message);
    document.body.append(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => toast.remove(), 3200);
  }

  function emptyState(title, text) {
    const root = el("section", "screen empty-screen");
    root.innerHTML = `<div class="empty-card"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
    return root;
  }

  function renderImageList(images, label) {
    const wrap = el("div", "image-list", "");
    (images || []).forEach((src, index) => {
      const figure = el("figure", "answer-figure", "");
      figure.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(label)} ${index + 1}" loading="lazy" />`;
      wrap.append(figure);
    });
    return wrap;
  }

  function imageListHtml(images, label) {
    if (!Array.isArray(images) || !images.length) return "";
    return `<div class="image-list">${images
      .map((src, index) => `<figure class="answer-figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)} ${index + 1}" loading="lazy" /></figure>`)
      .join("")}</div>`;
  }

  function makeButton(className, text, onClick) {
    const button = el("button", className, text);
    button.type = "button";
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  return {
    el,
    setView,
    optionLetter,
    percent,
    escapeHtml,
    typeLabel,
    showToast,
    emptyState,
    renderImageList,
    imageListHtml,
    makeButton
  };
})();
