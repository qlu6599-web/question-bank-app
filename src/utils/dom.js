window.DomUtils = (() => {
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
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index];
}

function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}

return { el, setView, optionLetter, percent };
})();
