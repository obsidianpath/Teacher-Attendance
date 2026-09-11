// ============================================================
// Настройки: цена за ученика, темы, смена пароля
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc } from "./ui.js";
import { updatePassword } from "./auth.js";

const THEMES = ["light", "dark", "blue", "green", "warm"];

// ---------- Применить тему ----------
export function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : "light";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
}

// ---------- Загрузить тему из localStorage ----------
export function loadLocalTheme() {
  const t = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", t);
  return t;
}

// ---------- Загрузить настройки учителя ----------
export async function fetchSettings() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("settings")
    .select("price_per_student, theme")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) return null;
  return data;
}

// ---------- Обновить настройки ----------
export async function updateSettings(updates) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Не авторизован");
  const { error } = await supabase
    .from("settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userData.user.id);
  if (error) throw error;
}

// ---------- Смена пароля ----------
export async function changePassword(newPassword) {
  await updatePassword(newPassword);
}

// ---------- Смена темы + сохранение в БД ----------
export async function changeTheme(theme) {
  applyTheme(theme);
  try {
    await updateSettings({ theme });
  } catch (e) {
    // не критично
  }
}

// ============================================================
// ЭКРАН: Настройки
// ============================================================
export async function renderSettingsScreen() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty">Загрузка...</div>`;

  const settings = await fetchSettings();
  const price = settings?.price_per_student || 0;
  const currentTheme = settings?.theme || localStorage.getItem("theme") || "light";

  const themeOptions = [
    { id: "light", name: "Светлая" },
    { id: "dark", name: "Тёмная" },
    { id: "blue", name: "Синяя" },
    { id: "green", name: "Зелёная" },
    { id: "warm", name: "Тёплая" },
  ]
    .map(
      (t) =>
        `<option value="${t.id}" ${
          t.id === currentTheme ? "selected" : ""
        }>${t.name}</option>`
    )
    .join("");

  app.innerHTML = `
    <a href="#/dashboard" class="back-link">← Назад</a>
    <h1>Настройки</h1>
    <p class="subtitle">Персональные параметры журнала</p>

    <div style="max-width:520px; display:flex; flex-direction:column; gap:20px;">
      <div class="card" style="cursor:default;">
        <h2>Оплата</h2>
        <div class="form-group">
          <label for="price-input">Сумма за одного присутствующего ученика (₽)</label>
          <input type="number" id="price-input" min="0" step="1" value="${esc(
            price
          )}" />
        </div>
        <button class="btn" id="save-price-btn">Сохранить</button>
      </div>

      <div class="card" style="cursor:default;">
        <h2>Тема оформления</h2>
        <div class="form-group">
          <label for="theme-select">Выберите тему</label>
          <select id="theme-select">${themeOptions}</select>
        </div>
        <p style="font-size:13px; color:var(--muted);">
          Тема применяется на весь сайт и сохраняется автоматически.
        </p>
      </div>

      <div class="card" style="cursor:default;">
        <h2>Смена пароля</h2>
        <div class="form-group">
          <label for="new-password">Новый пароль</label>
          <input type="password" id="new-password" minlength="6" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label for="new-password-2">Повторите пароль</label>
          <input type="password" id="new-password-2" minlength="6" autocomplete="new-password" />
        </div>
        <button class="btn" id="save-password-btn">Сменить пароль</button>
      </div>
    </div>
  `;

  // Сохранение цены
  document.getElementById("save-price-btn").addEventListener("click", async () => {
    const val = Number(document.getElementById("price-input").value) || 0;
    try {
      await updateSettings({ price_per_student: val });
      toast("Сумма сохранена", "success");
    } catch (err) {
      toast(err.message || "Ошибка", "error");
    }
  });

  // Смена темы
  document.getElementById("theme-select").addEventListener("change", async (e) => {
    await changeTheme(e.target.value);
    toast("Тема изменена", "success");
  });

  // Смена пароля
  document.getElementById("save-password-btn").addEventListener("click", async () => {
    const p1 = document.getElementById("new-password").value;
    const p2 = document.getElementById("new-password-2").value;
    if (!p1 || p1.length < 6) {
      toast("Пароль минимум 6 символов", "error");
      return;
    }
    if (p1 !== p2) {
      toast("Пароли не совпадают", "error");
      return;
    }
    try {
      await changePassword(p1);
      toast("Пароль обновлён", "success");
      document.getElementById("new-password").value = "";
      document.getElementById("new-password-2").value = "";
    } catch (err) {
      toast(err.message || "Ошибка", "error");
    }
  });
}
