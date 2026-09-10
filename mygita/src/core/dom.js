// @ts-check
export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

export function setDocumentTitle(title) {
  document.title = title ? `${title} — My Gita` : "My Gita";
}
