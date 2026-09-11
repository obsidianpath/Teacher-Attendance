// ============================================================
// Админ-панель: дашборд, пользователи, детали
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, openModal, closeModal, formatDate } from "./ui.js";

// ---------- Является ли текущий пользователь админом ----------
let cachedIsAdmin = null;
export async function checkIsAdmin() {
  if (cachedIsAdmin !== null) return cachedIsAdmin;
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    cachedIsAdmin = false;
    return false;
  }
  cachedIsAdmin = !!data;
  return cachedIsAdmin;
}

export function resetAdminCache() {
  cachedIsAdmin = null;
}

// ---------- Общая статистика системы ----------
export async function fetchSystemStats() {
  const { data, error } = await supabase.rpc("admin_system_stats").single();
  if (error) throw error;
  return data;
}

// ---------- Сводка по пользователям ----------
export async function fetchUsersSummary() {
  const { data, error } = await supabase.rpc("admin_users_summary");
  if (error) throw error;
  return data || [];
}

// ---------- Детали пользователя (школы + классы) ----------
export async function fetchUserDetail(userId) {
  const { data, error } = await supabase.rpc("admin_user_detail", {
    target_user_id: userId,
  });
  if (error) throw error;
  return data || [];
}

// ---------- Формат даты и времени ----------
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// ============================================================
// ЭКРАН: Админ-панель
// ============================================================
export async function renderAdminScreen() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty">Загрузка...</div>`;

  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    app.innerHTML = `<div class="empty">
      <div class="empty-icon">🚫</div>
      Доступ запрещён
    </div>`;
    return;
  }

  let stats, users;
  try {
    [stats, users] = await Promise.all([fetchSystemStats(), fetchUsersSummary()]);
  } catch (err) {
    app.innerHTML = `<div class="empty">Ошибка: ${esc(err.message)}</div>`;
    return;
  }

  // Состояние фильтров
  const state = {
    search: "",
    activity: "all", // all | active | empty
    sort: "date_desc", // date_desc | date_asc | students_desc | students_asc | name_asc
  };

  // ---------- Карточки статистики ----------
  const statCards = [
    { label: "Пользователей", value: stats.users_count, icon: "👥" },
    { label: "Школ", value: stats.schools_count, icon: "🏫" },
    { label: "Классов", value: stats.classes_count, icon: "📚" },
    { label: "Учеников", value: stats.students_count, icon: "🎓" },
    { label: "Уроков", value: stats.lessons_count, icon: "📅" },
    { label: "Отметок", value: stats.attendance_count, icon: "✓" },
  ]
    .map(
      (s) => `
      <div class="stat">
        <div class="stat-label">${s.icon} ${s.label}</div>
        <div class="stat-value">${Number(s.value).toLocaleString("ru-RU")}</div>
      </div>`
    )
    .join("");

  app.innerHTML = `
    <a href="#/dashboard" class="back-link">← На главную</a>
    <div class="class-toolbar">
      <div>
        <h1>🛡️ Админ-панель</h1>
        <p class="subtitle" style="margin:0;">Обзор системы Teacher-Attendance</p>
      </div>
      <div class="class-actions">
        <button class="btn btn-secondary" id="refresh-btn">🔄 Обновить</button>
        <a href="#/admin/reports" class="btn">📊 Отчёты</a>
      </div>
    </div>

    <div class="class-stats" style="margin:16px 0 28px; flex-wrap:wrap;">
      ${statCards}
    </div>

    <div class="admin-toolbar">
      <div class="admin-search">
        <span class="admin-search-icon">🔍</span>
        <input type="text" id="admin-search" placeholder="Поиск по ФИО или email..." />
      </div>
      <select id="admin-activity">
        <option value="all">Все пользователи</option>
        <option value="active">С данными</option>
        <option value="empty">Без данных</option>
      </select>
      <select id="admin-sort">
        <option value="date_desc">Сначала новые</option>
        <option value="date_asc">Сначала старые</option>
        <option value="students_desc">Больше учеников</option>
        <option value="students_asc">Меньше учеников</option>
        <option value="name_asc">По имени (А-Я)</option>
      </select>
    </div>

    <div class="admin-count" id="admin-count"></div>

    <div class="journal-wrap">
      <table class="journal admin-users-table" id="admin-table">
        <thead>
          <tr>
            <th style="text-align:left;">Пользователь</th>
            <th>Регистрация</th>
            <th>Последний вход</th>
            <th>Школ</th>
            <th>Классов</th>
            <th>Учеников</th>
            <th>Уроков</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="admin-tbody"></tbody>
      </table>
    </div>
  `;

  // ---------- Рендер строк по фильтрам ----------
  function renderTable() {
    let list = [...users];

    // Поиск
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          (u.full_name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q)
      );
    }

    // Активность
    if (state.activity === "active") {
      list = list.filter((u) => Number(u.schools_count) > 0);
    } else if (state.activity === "empty") {
      list = list.filter((u) => Number(u.schools_count) === 0);
    }

    // Сортировка
    switch (state.sort) {
      case "date_desc":
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case "date_asc":
        list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case "students_desc":
        list.sort((a, b) => Number(b.students_count) - Number(a.students_count));
        break;
      case "students_asc":
        list.sort((a, b) => Number(a.students_count) - Number(b.students_count));
        break;
      case "name_asc":
        list.sort((a, b) =>
          (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "ru")
        );
        break;
    }

    // Счётчик
    document.getElementById("admin-count").textContent =
      `Показано ${list.length} из ${users.length}`;

    // Таблица
    const tbody = document.getElementById("admin-tbody");
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--muted); padding:24px;">
        Ничего не найдено
      </td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map(
        (u) => `
      <tr data-user-id="${u.user_id}">
        <td>
          <div style="font-weight:600;">${esc(u.full_name || "—")}</div>
          <div style="font-size:12px; color:var(--muted);">${esc(u.email)}</div>
        </td>
        <td>${fmtDateTime(u.created_at)}</td>
        <td>${fmtDateTime(u.last_sign_in_at)}</td>
        <td>${u.schools_count}</td>
        <td>${u.classes_count}</td>
        <td>${u.students_count}</td>
        <td>${u.lessons_count}</td>
        <td>
          <button class="mini-btn" data-action="detail" title="Подробнее">🔍</button>
        </td>
      </tr>`
      )
      .join("");

    // Клик по кнопке
    tbody.querySelectorAll('[data-action="detail"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const userId = e.target.closest("tr").dataset.userId;
        const user = list.find((u) => u.user_id === userId);
        await openUserDetailModal(user);
      });
    });

    // Клик по строке = тоже открыть
    tbody.querySelectorAll("tr[data-user-id]").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        const user = list.find((u) => u.user_id === tr.dataset.userId);
        openUserDetailModal(user);
      });
    });
  }

  // ---------- Обработчики фильтров ----------
  const searchInput = document.getElementById("admin-search");
  let searchTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      renderTable();
    }, 200);
  });

  document.getElementById("admin-activity").addEventListener("change", (e) => {
    state.activity = e.target.value;
    renderTable();
  });

  document.getElementById("admin-sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderTable();
  });

  document.getElementById("refresh-btn").addEventListener("click", () => {
    renderAdminScreen();
  });

  // Первый рендер
  renderTable();
}
// ============================================================
// Модалка с деталями пользователя
// ============================================================
async function openUserDetailModal(user) {
  let rows = [];
  try {
    rows = await fetchUserDetail(user.user_id);
  } catch (err) {
    toast(err.message || "Ошибка", "error");
    return;
  }

  // Группируем: школа → список классов
  const schools = new Map();
  rows.forEach((r) => {
    if (!schools.has(r.school_id)) {
      schools.set(r.school_id, { name: r.school_name, classes: [] });
    }
    if (r.class_id) {
      schools.get(r.school_id).classes.push({
        name: r.class_name,
        students: r.students_count,
      });
    }
  });

  const bodyHTML = schools.size
    ? [...schools.entries()]
        .map(([_, s]) => {
          const classesHTML = s.classes.length
            ? `<ul style="margin:6px 0 0 20px; padding:0; color:var(--text);">
                ${s.classes
                  .map(
                    (c) =>
                      `<li>${esc(c.name)} — ${c.students} ученик(ов)</li>`
                  )
                  .join("")}
              </ul>`
            : `<div style="color:var(--muted); font-size:13px; margin-top:4px;">Нет классов</div>`;
          return `
          <div style="margin-bottom:14px;">
            <div style="font-weight:600;">🏫 ${esc(s.name)}</div>
            ${classesHTML}
          </div>`;
        })
        .join("")
    : `<div class="empty"><div class="empty-icon">📭</div>У пользователя нет школ</div>`;

  openModal({
    title: user.full_name || user.email,
    bodyHTML: `
      <p style="color:var(--muted); font-size:13px; margin-bottom:12px;">
        ${esc(user.email)}<br>
        Зарегистрирован: ${fmtDateTime(user.created_at)}<br>
        Последний вход: ${fmtDateTime(user.last_sign_in_at)}
      </p>
      <div style="max-height:400px; overflow-y:auto;">
        ${bodyHTML}
      </div>
    `,
    actions: [{ label: "Закрыть", variant: "btn-secondary", onClick: closeModal }],
  });
}
