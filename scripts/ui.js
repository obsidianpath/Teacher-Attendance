// ============================================================
// UI-утилиты: toast, модалки, escape, helpers
// ============================================================

// ---------- Toast-уведомления ----------
export function toast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.2s, transform 0.2s";
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 200);
  }, duration);
}

// ---------- Escape HTML ----------
export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- Модальные окна ----------
let activeModal = null;

export function openModal({ title, bodyHTML, actions = [], onMount }) {
  closeModal(); // закрыть предыдущую

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const actionsHTML = actions
    .map(
      (a, i) =>
        `<button class="btn ${a.variant || ""}" data-action-index="${i}">${esc(
          a.label
        )}</button>`
    )
    .join("");

  modal.innerHTML = `
    <h2>${esc(title)}</h2>
    <div class="modal-body">${bodyHTML || ""}</div>
    ${actions.length ? `<div class="modal-actions">${actionsHTML}</div>` : ""}
  `;

  overlay.appendChild(modal);
  document.getElementById("modal-root").appendChild(overlay);
  activeModal = overlay;

  // Обработчики кнопок
  actions.forEach((a, i) => {
    const btn = modal.querySelector(`[data-action-index="${i}"]`);
    if (btn && a.onClick) {
      btn.addEventListener("click", () => a.onClick({ modal, close: closeModal }));
    }
  });

  // Закрытие по клику на фон
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  // Закрытие по Escape
  document.addEventListener("keydown", escHandler);

  // Фокус на первое поле ввода
  const firstInput = modal.querySelector("input, select, textarea");
  if (firstInput) setTimeout(() => firstInput.focus(), 50);

  if (onMount) onMount(modal);
}

function escHandler(e) {
  if (e.key === "Escape") closeModal();
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
    document.removeEventListener("keydown", escHandler);
  }
}

// ---------- Форматирование ----------
export function formatDate(dateStr) {
  // dateStr — "YYYY-MM-DD"
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("ru-RU") + " ₽";
}

// ---------- Хелпер для рендера ----------
export function el(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

// ---------- Получение параметров из hash ----------
export function parseHash() {
  const hash = location.hash.slice(1) || "/dashboard";
  const parts = hash.split("/").filter(Boolean);
  return {
    path: "/" + parts.join("/"),
    parts,
  };
}

// ---------- Подтверждение ----------
export function confirmDelete(message) {
  return window.confirm(message || "Вы уверены?");
}
