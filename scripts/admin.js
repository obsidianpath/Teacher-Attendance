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

     // Клик по кнопке или строке → переход в карточку учителя
    const goToUser = (userId) => {
      location.hash = `#/admin/user/${userId}`;
    };

    tbody.querySelectorAll('[data-action="detail"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        goToUser(e.target.closest("tr").dataset.userId);
      });
    });

    tbody.querySelectorAll("tr[data-user-id]").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        goToUser(tr.dataset.userId);
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
// ============================================================
// Функции для карточки учителя
// ============================================================

export async function fetchUserStats(userId) {
  const { data, error } = await supabase
    .rpc("admin_user_stats", { target_user_id: userId })
    .single();
  if (error) throw error;
  return data;
}

export async function fetchUserSchoolsWithStats(userId) {
  const { data, error } = await supabase.rpc("admin_user_schools_with_stats", {
    target_user_id: userId,
  });
  if (error) throw error;
  return data || [];
}

export async function fetchUserRecentLessons(userId, limit = 10) {
  const { data, error } = await supabase.rpc("admin_user_recent_lessons", {
    target_user_id: userId,
    lim: limit,
  });
  if (error) throw error;
  return data || [];
}

// Одна карточка учителя из users_summary (для шапки)
export async function fetchOneUser(userId) {
  const list = await fetchUsersSummary();
  return list.find((u) => u.user_id === userId) || null;
}

// ============================================================
// ЭКРАН: Карточка учителя
// ============================================================
export async function renderUserCardScreen(userId) {
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

  let user, stats, schools, lessons;
  try {
    [user, stats, schools, lessons] = await Promise.all([
      fetchOneUser(userId),
      fetchUserStats(userId),
      fetchUserSchoolsWithStats(userId),
      fetchUserRecentLessons(userId, 10),
    ]);
  } catch (err) {
    app.innerHTML = `<div class="empty">Ошибка: ${esc(err.message)}</div>`;
    return;
  }

  if (!user) {
    app.innerHTML = `<div class="empty">Пользователь не найден</div>`;
    return;
  }

  // ---------- Карточки статистики ----------
  const statCards = [
    { label: "Школ", value: stats.schools_count, icon: "🏫" },
    { label: "Классов", value: stats.classes_count, icon: "📚" },
    { label: "Учеников", value: stats.students_count, icon: "🎓" },
    { label: "Уроков", value: stats.lessons_count, icon: "📅" },
    { label: "Отметок", value: stats.attendance_count, icon: "✓" },
    {
      label: "Посещаемость",
      value: Number(stats.avg_attendance).toFixed(1) + "%",
      icon: "📈",
    },
  ]
    .map(
      (s) => `
      <div class="stat">
        <div class="stat-label">${s.icon} ${s.label}</div>
        <div class="stat-value">${
          typeof s.value === "number"
            ? Number(s.value).toLocaleString("ru-RU")
            : s.value
        }</div>
      </div>`
    )
    .join("");

  // ---------- Группировка школ и классов ----------
  const schoolsMap = new Map();
  schools.forEach((r) => {
    if (!schoolsMap.has(r.school_id)) {
      schoolsMap.set(r.school_id, {
        id: r.school_id,
        name: r.school_name,
        created: r.school_created,
        classes: [],
      });
    }
    if (r.class_id) {
      schoolsMap.get(r.school_id).classes.push({
        id: r.class_id,
        name: r.class_name,
        created: r.class_created,
        students: Number(r.students_count),
        lessons: Number(r.lessons_count),
      });
    }
  });

  const schoolsHTML = schoolsMap.size
    ? [...schoolsMap.values()]
        .map((s) => {
          const classesHTML = s.classes.length
            ? `<table class="journal" style="font-size:13px; margin-top:8px;">
                <thead>
                  <tr>
                    <th style="text-align:left;">Класс</th>
                    <th>Учеников</th>
                    <th>Уроков</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.classes
                    .map(
                      (c) => `
                    <tr>
                      <td style="text-align:left; font-weight:500;">${esc(c.name)}</td>
                      <td>${c.students}</td>
                      <td>${c.lessons}</td>
                      <td>${fmtDateTime(c.created)}</td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
            : `<div style="color:var(--muted); font-size:13px; margin-top:6px;">
                Нет классов
              </div>`;

          return `
          <div class="admin-school-block">
            <div class="admin-school-title">
              🏫 ${esc(s.name)}
              <span class="admin-school-meta">создана ${fmtDateTime(s.created)}</span>
            </div>
            ${classesHTML}
          </div>`;
        })
        .join("")
    : `<div class="empty"><div class="empty-icon">📭</div>Учитель ещё не создал ни одной школы</div>`;

  // ---------- Последние уроки ----------
  const lessonsHTML = lessons.length
    ? `<table class="journal" style="font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;">Дата</th>
            <th style="text-align:left;">Школа</th>
            <th style="text-align:left;">Класс</th>
            <th>Отмечено</th>
            <th>Присутствовало</th>
          </tr>
        </thead>
        <tbody>
          ${lessons
            .map(
              (l) => `
            <tr>
              <td style="text-align:left;">${formatDate(l.lesson_date)}</td>
              <td style="text-align:left;">${esc(l.school_name)}</td>
              <td style="text-align:left;">${esc(l.class_name)}</td>
              <td>${l.attendance_count}</td>
              <td>${l.present_count}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : `<div class="empty" style="padding:20px;">Уроков пока нет</div>`;

  app.innerHTML = `
    <a href="#/admin" class="back-link">← К списку пользователей</a>

    <div class="class-toolbar">
      <div>
        <h1>${esc(user.full_name || "Без имени")}</h1>
        <p class="subtitle" style="margin:0;">
          ${esc(user.email)} · зарегистрирован ${fmtDateTime(user.created_at)}
        </p>
      </div>
      <div class="class-actions">
        <a href="#/admin/reports?teacher=${user.user_id}" class="btn btn-secondary">
          📊 Отчёт по учителю
        </a>
        <button class="btn btn-danger" id="delete-user-btn">🗑️ Удалить аккаунт</button>
      </div>
    </div>

    <div class="class-stats" style="margin:16px 0 28px; flex-wrap:wrap;">
      ${statCards}
    </div>

    <h2 style="margin-bottom:12px;">Школы и классы</h2>
    <div style="margin-bottom:28px;">
      ${schoolsHTML}
    </div>

    <h2 style="margin-bottom:12px;">Последние уроки</h2>
    <div class="journal-wrap">
      ${lessonsHTML}
    </div>
  `;

  // Кнопка удаления — пока заглушка, реализуем в 6.3
  document.getElementById("delete-user-btn").addEventListener("click", () => {
    toast("Функция удаления будет в следующем обновлении", "info");
  });
}
