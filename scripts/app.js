// ============================================================
// Главный модуль: роутинг и экраны
// ============================================================

import { supabase } from "./supabase.js";
import {
  toast,
  esc,
  openModal,
  closeModal,
  parseHash,
  formatDate,
  todayISO,
  formatMoney,
  confirmDelete,
  el,
} from "./ui.js";
import {
  getCurrentUser,
  signOut,
  renderAuthScreen,
  renderForgotPassword,
  renderResetPassword,
} from "./auth.js";
import {
  fetchSchools,
  openSchoolModal,
  deleteSchool,
  fetchSchool,
} from "./schools.js";
import {
  fetchClasses,
  openClassModal,
  deleteClass,
  fetchClass,
  countStudents,
} from "./classes.js";
import {
  fetchStudents,
  openStudentModal,
  openStudentCard,
  deleteStudent,
  studentFullName,
} from "./students.js";
import {
  fetchLessons,
  fetchAttendanceForLessons,
  createLesson,
  deleteLesson,
  saveAttendance,
  getPricePerStudent,
  getStudentStats,
} from "./lessons.js";
import {
  buildReport,
  periodWeek,
  periodMonth,
  exportCSV,
  renderReportTable,
} from "./reports.js";
import {
  renderSettingsScreen,
  loadLocalTheme,
  applyTheme,
} from "./settings.js";

// ============================================================
// Инициализация
// ============================================================
loadLocalTheme();

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupHeaderHandlers();
  setupAuthListener();
  await route();
  window.addEventListener("hashchange", route);
}

// ============================================================
// Обработчики шапки
// ============================================================
function setupHeaderHandlers() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await signOut();
    toast("Вы вышли", "success");
  });

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const themes = ["light", "dark", "blue", "green", "warm"];
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    applyTheme(next);
    // Тихая синхронизация с БД
    import("./settings.js").then((m) => m.changeTheme(next));
  });
}

// ============================================================
// Реакция на смену авторизации
// ============================================================
function setupAuthListener() {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      location.hash = "#/login";
    }
  });
}

// ============================================================
// Показ/скрытие шапки
// ============================================================
function showHeader(show, email = "") {
  const header = document.getElementById("app-header");
  if (show) {
    header.classList.remove("hidden");
    document.getElementById("user-email").textContent = email || "";
  } else {
    header.classList.add("hidden");
  }
}

// ============================================================
// Роутинг
// ============================================================
async function route() {
  const { path, parts } = parseHash();
  const user = await getCurrentUser();

  // Публичные маршруты
  if (path === "/login" || path === "/register") {
    if (user) {
      location.hash = "#/dashboard";
      return;
    }
    showHeader(false);
    renderAuthScreen(path === "/login" ? "login" : "register");
    return;
  }

  if (path === "/forgot-password") {
    showHeader(false);
    renderForgotPassword();
    return;
  }

  if (path === "/reset-password") {
    showHeader(false);
    renderResetPassword();
    return;
  }

  // Защищённые маршруты
  if (!user) {
    location.hash = "#/login";
    return;
  }

  showHeader(true, user.email);

  if (path === "/dashboard" || path === "/") {
    await renderDashboard();
  } else if (parts[0] === "school" && parts[1]) {
    await renderSchool(parts[1]);
  } else if (parts[0] === "class" && parts[1]) {
    await renderClass(parts[1]);
  } else if (path === "/reports") {
    await renderReports();
  } else if (path === "/settings") {
    await renderSettingsScreen();
  } else {
    location.hash = "#/dashboard";
  }
}

// ============================================================
// ЭКРАН: Dashboard — список школ
// ============================================================
async function renderDashboard() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty">Загрузка...</div>`;

  try {
    const schools = await fetchSchools();
    const cardsHTML = schools.length
      ? schools
          .map(
            (s) => `
        <div class="card" data-id="${s.id}">
          <div class="card-actions">
            <button class="mini-btn" data-action="rename" title="Переименовать">✏️</button>
            <button class="mini-btn" data-action="delete" title="Удалить">🗑️</button>
          </div>
          <div class="card-title">${esc(s.name)}</div>
          <div class="card-meta" data-count>…</div>
        </div>`
          )
          .join("")
      : `<div class="empty" style="grid-column:1/-1;">
          <div class="empty-icon">🏫</div>
          Нет школ. Создайте первую.
        </div>`;

    app.innerHTML = `
      <h1>Мои школы</h1>
      <p class="subtitle">Выберите школу, чтобы открыть классы</p>
      <div style="margin-bottom:20px;">
        <button class="btn" id="add-school-btn">+ Добавить школу</button>
      </div>
      <div class="card-grid" id="schools-grid">${cardsHTML}</div>
    `;

    document.getElementById("add-school-btn").addEventListener("click", () => {
      openSchoolModal({ onSaved: renderDashboard });
    });

    // Клики по карточкам
    app.querySelectorAll(".card[data-id]").forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        location.hash = `#/school/${id}`;
      });
      card.querySelector('[data-action="rename"]').addEventListener("click", async (e) => {
        e.stopPropagation();
        const school = schools.find((s) => s.id === id);
        openSchoolModal({ school, onSaved: renderDashboard });
      });
      card.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirmDelete("Удалить школу и все её классы?")) return;
        try {
          await deleteSchool(id);
          toast("Школа удалена", "success");
          renderDashboard();
        } catch (err) {
          toast(err.message || "Ошибка", "error");
        }
      });
    });

    // Подгружаем количество классов в каждой школе
    for (const s of schools) {
      const card = app.querySelector(`.card[data-id="${s.id}"] [data-count]`);
      if (card) {
        try {
          const list = await fetchClasses(s.id);
          card.textContent = `${list.length} класс(ов)`;
        } catch {
          card.textContent = "";
        }
      }
    }
  } catch (err) {
    app.innerHTML = `<div class="empty">Ошибка загрузки: ${esc(err.message)}</div>`;
  }
}

// ============================================================
// ЭКРАН: Школа — список классов
// ============================================================
async function renderSchool(schoolId) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty">Загрузка...</div>`;

  try {
    const school = await fetchSchool(schoolId);
    const classes = await fetchClasses(schoolId);

    const cardsHTML = classes.length
      ? classes
          .map(
            (c) => `
        <div class="card" data-id="${c.id}">
          <div class="card-actions">
            <button class="mini-btn" data-action="rename" title="Переименовать">✏️</button>
            <button class="mini-btn" data-action="delete" title="Удалить">🗑️</button>
          </div>
          <div class="card-title">${esc(c.name)}</div>
          <div class="card-meta" data-count>…</div>
        </div>`
          )
          .join("")
      : `<div class="empty" style="grid-column:1/-1;">
          <div class="empty-icon">👥</div>
          Нет классов. Создайте первый.
        </div>`;

    app.innerHTML = `
      <a href="#/dashboard" class="back-link">← К списку школ</a>
      <h1>${esc(school.name)}</h1>
      <p class="subtitle">Классы школы</p>
      <div style="margin-bottom:20px;">
        <button class="btn" id="add-class-btn">+ Добавить класс</button>
      </div>
      <div class="card-grid" id="classes-grid">${cardsHTML}</div>
    `;

    document.getElementById("add-class-btn").addEventListener("click", () => {
      openClassModal({ schoolId, onSaved: () => renderSchool(schoolId) });
    });

    app.querySelectorAll(".card[data-id]").forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        location.hash = `#/class/${id}`;
      });
      card.querySelector('[data-action="rename"]').addEventListener("click", (e) => {
        e.stopPropagation();
        const cls = classes.find((c) => c.id === id);
        openClassModal({ schoolId, cls, onSaved: () => renderSchool(schoolId) });
      });
      card.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirmDelete("Удалить класс и всех его учеников?")) return;
        try {
          await deleteClass(id);
          toast("Класс удалён", "success");
          renderSchool(schoolId);
        } catch (err) {
          toast(err.message || "Ошибка", "error");
        }
      });
    });

    for (const c of classes) {
      const elCount = app.querySelector(`.card[data-id="${c.id}"] [data-count]`);
      if (elCount) {
        try {
          const n = await countStudents(c.id);
          elCount.textContent = `${n} ученик(ов)`;
        } catch {
          elCount.textContent = "";
        }
      }
    }
  } catch (err) {
    app.innerHTML = `<div class="empty">Ошибка: ${esc(err.message)}</div>`;
  }
}

// ============================================================
// ЭКРАН: Класс — список учеников
// ============================================================
async function renderClass(classId) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty">Загрузка...</div>`;

  try {
    const cls = await fetchClass(classId);
    const school = await fetchSchool(cls.school_id);
    const students = await fetchStudents(classId);
    const lessons = await fetchLessons(classId);

    const studentsHTML = students.length
      ? students
          .map(
            (s) => `
        <div class="card" data-id="${s.id}">
          <div class="card-actions">
            <button class="mini-btn" data-action="edit" title="Редактировать">✏️</button>
            <button class="mini-btn" data-action="delete" title="Удалить">🗑️</button>
          </div>
          <div class="card-title">${esc(studentFullName(s))}</div>
          <div class="card-meta">${s.parent_name ? esc(s.parent_name) : "—"}</div>
        </div>`
          )
          .join("")
      : `<div class="empty" style="grid-column:1/-1;">
          <div class="empty-icon">👤</div>
          Нет учеников. Добавьте первого.
        </div>`;

    // Общая статистика класса
    const totalStudents = students.length;
    const totalLessons = lessons.length;

    app.innerHTML = `
      <a href="#/school/${school.id}" class="back-link">← К классам школы</a>
      <div class="class-toolbar">
        <div>
          <h1>${esc(cls.name)}</h1>
          <p class="subtitle" style="margin:0;">${esc(school.name)}</p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-secondary" id="add-student-btn">+ Ученик</button>
          <button class="btn" id="open-journal-btn">Открыть журнал</button>
        </div>
      </div>

      <div class="class-stats" style="margin:16px 0 24px;">
        <div class="stat">
          <div class="stat-label">Учеников</div>
          <div class="stat-value">${totalStudents}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Уроков</div>
          <div class="stat-value">${totalLessons}</div>
        </div>
      </div>

      <h2>Ученики</h2>
      <div class="card-grid" id="students-grid">${studentsHTML}</div>
    `;

    document.getElementById("add-student-btn").addEventListener("click", () => {
      openStudentModal({ classId, onSaved: () => renderClass(classId) });
    });

    document.getElementById("open-journal-btn").addEventListener("click", () => {
      location.hash = `#/class/${classId}?journal=1`;
    });

    // Если в URL есть ?journal=1 — открываем журнал сразу
    if (location.hash.includes("journal=1")) {
      setTimeout(() => renderJournal(classId, cls, students), 100);
    }

    // Клики по ученикам
    app.querySelectorAll(".card[data-id]").forEach((card) => {
      const id = card.dataset.id;
      const student = students.find((s) => s.id === id);
      card.addEventListener("click", async (e) => {
        if (e.target.closest("[data-action]")) return;
        try {
          const lessonIds = lessons.map((l) => l.id);
          const stats = await getStudentStats(id, lessonIds);
          openStudentCard(student, stats);
        } catch (err) {
          toast(err.message || "Ошибка", "error");
        }
      });
      card.querySelector('[data-action="edit"]').addEventListener("click", (e) => {
        e.stopPropagation();
        openStudentModal({ classId, student, onSaved: () => renderClass(classId) });
      });
      card.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirmDelete("Удалить ученика?")) return;
        try {
          await deleteStudent(id);
          toast("Ученик удалён", "success");
          renderClass(classId);
        } catch (err) {
          toast(err.message || "Ошибка", "error");
        }
      });
    });
  } catch (err) {
    app.innerHTML = `<div class="empty">Ошибка: ${esc(err.message)}</div>`;
  }
}

// ============================================================
// ЭКРАН: Журнал класса
// ============================================================
async function renderJournal(classId, cls, students) {
  const app = document.getElementById("app");
  const price = await getPricePerStudent();

  let lessons = await fetchLessons(classId);
  const lessonIds = lessons.map((l) => l.id);
  let attendance = await fetchAttendanceForLessons(lessonIds);

  // Карта отметок: { lessonId: { studentId: present } }
  const marks = {};
  lessons.forEach((l) => (marks[l.id] = {}));
  attendance.forEach((a) => {
    if (!marks[a.lesson_id]) marks[a.lesson_id] = {};
    marks[a.lesson_id][a.student_id] = a.present;
  });

  // Какие уроки уже сохранены (есть хотя бы одна отметка)
  const savedLessons = new Set(
    attendance.map((a) => a.lesson_id)
  );

  app.innerHTML = `
    <a href="#/class/${classId}" class="back-link">← Назад к ученикам</a>
    <div class="class-toolbar">
      <div>
        <h1>Журнал — ${esc(cls.name)}</h1>
        <p class="subtitle" style="margin:0;">Цена за ученика: ${formatMoney(price)}</p>
      </div>
      <button class="btn" id="add-lesson-btn">+ Добавить урок</button>
    </div>

    <div id="journal-container"></div>
  `;

  document.getElementById("add-lesson-btn").addEventListener("click", () => {
    openAddLessonModal(classId, cls, students, () => renderJournal(classId, cls, students));
  });

  const container = document.getElementById("journal-container");

  if (!students.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">👤</div>Сначала добавьте учеников в класс</div>`;
    return;
  }
  if (!lessons.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📅</div>Нет уроков. Нажмите «Добавить урок»</div>`;
    return;
  }

  // Строим таблицу
  const headerCells = lessons
    .map((l) => {
      const isSaved = savedLessons.has(l.id);
      const lessonMarks = marks[l.id] || {};
      const presentCount = Object.values(lessonMarks).filter((v) => v === true).length;
      const sum = presentCount * price;
      return `
      <th data-lesson-id="${l.id}">
        <div class="lesson-head">
          <div class="lesson-date">${formatDate(l.date)}</div>
          <div class="lesson-actions">
            <button data-action="save" data-lesson-id="${l.id}">
              ${isSaved ? "Изменить" : "Сохранить"}
            </button>
            <button data-action="delete-lesson" data-lesson-id="${l.id}">×</button>
          </div>
          <div class="lesson-summary" data-summary="${l.id}">
            ${presentCount} чел. · ${formatMoney(sum)}
          </div>
        </div>
      </th>`;
    })
    .join("");

  const rowsHTML = students
    .map((s) => {
      const cells = lessons
        .map((l) => {
          const val = marks[l.id] ? marks[l.id][s.id] : undefined;
          const stateClass =
            val === true ? "present" : val === false ? "absent" : "empty";
          const symbol = val === true ? "✓" : val === false ? "✕" : "";
          return `<td class="mark-cell ${stateClass}" data-student-id="${s.id}" data-lesson-id="${l.id}">${symbol}</td>`;
        })
        .join("");
      return `
      <tr data-student-id="${s.id}">
        <td class="student-col">${esc(studentFullName(s))}</td>
        ${cells}
      </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="journal-wrap">
      <table class="journal">
        <thead>
          <tr>
            <th class="student-col">Ученик</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  `;

  // Клик по ячейке — переключение состояния
  container.querySelectorAll(".mark-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const lessonId = cell.dataset.lessonId;
      const studentId = cell.dataset.studentId;
      const current = marks[lessonId]?.[studentId];

      // пусто -> true -> false -> пусто
      let next;
      if (current === undefined) next = true;
      else if (current === true) next = false;
      else next = undefined;

      if (!marks[lessonId]) marks[lessonId] = {};
      if (next === undefined) {
        delete marks[lessonId][studentId];
        cell.className = "mark-cell empty";
        cell.textContent = "";
      } else {
        marks[lessonId][studentId] = next;
        cell.className = "mark-cell " + (next ? "present" : "absent");
        cell.textContent = next ? "✓" : "✕";
      }

      // Обновляем счётчик и сумму в заголовке
      const lessonMarks = marks[lessonId] || {};
      const presentCount = Object.values(lessonMarks).filter((v) => v === true).length;
      const summaryEl = container.querySelector(`[data-summary="${lessonId}"]`);
      if (summaryEl) {
        summaryEl.textContent = `${presentCount} чел. · ${formatMoney(presentCount * price)}`;
      }
    });
  });

  // Сохранить / изменить урок
  container.querySelectorAll('[data-action="save"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lessonId = btn.dataset.lessonId;
      const lessonMarks = marks[lessonId] || {};
      if (!Object.keys(lessonMarks).length) {
        toast("Отметьте хотя бы одного ученика", "error");
        return;
      }
      try {
        await saveAttendance(lessonId, lessonMarks);
        toast("Урок сохранён", "success");
        savedLessons.add(lessonId);
        btn.textContent = "Изменить";
        renderJournal(classId, cls, students);
      } catch (err) {
        toast(err.message || "Ошибка", "error");
      }
    });
  });

  // Удалить урок
  container.querySelectorAll('[data-action="delete-lesson"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lessonId = btn.dataset.lessonId;
      if (!confirmDelete("Удалить урок и все отметки?")) return;
      try {
        await deleteLesson(lessonId);
        toast("Урок удалён", "success");
        renderJournal(classId, cls, students);
      } catch (err) {
        toast(err.message || "Ошибка", "error");
      }
    });
  });
}

// ============================================================
// Модалка: добавить урок
// ============================================================
function openAddLessonModal(classId, cls, students, onDone) {
  openModal({
    title: "Добавить урок",
    bodyHTML: `
      <div class="form-group">
        <label for="lesson-date">Дата урока</label>
        <input type="date" id="lesson-date" value="${todayISO()}" />
      </div>
    `,
    actions: [
      { label: "Отмена", variant: "btn-secondary", onClick: closeModal },
      {
        label: "Создать",
        onClick: async ({ close }) => {
          const date = document.getElementById("lesson-date").value;
          if (!date) {
            toast("Выберите дату", "error");
            return;
          }
          try {
            await createLesson(classId, date);
            toast("Урок создан", "success");
            close();
            onDone();
          } catch (err) {
            if (err.code === "23505" || /duplicate/i.test(err.message)) {
              toast("Урок на эту дату уже есть", "error");
            } else {
              toast(err.message || "Ошибка", "error");
            }
          }
        },
      },
    ],
  });
}

// ============================================================
// ЭКРАН: Отчёты
// ============================================================
async function renderReports() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty">Загрузка...</div>`;

  try {
    const schools = await fetchSchools();
    const price = await getPricePerStudent();

    app.innerHTML = `
      <a href="#/dashboard" class="back-link">← На главную</a>
      <h1>Отчёты</h1>
      <p class="subtitle">Посещаемость и суммы за период</p>

      <div class="report-filters">
        <div>
          <label for="rep-school">Школа</label>
          <select id="rep-school">
            <option value="">— выберите —</option>
            ${schools
              .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
              .join("")}
          </select>
        </div>
        <div>
          <label for="rep-class">Класс</label>
          <select id="rep-class"><option value="">— сначала школа —</option></select>
        </div>
        <div>
          <label for="rep-period">Период</label>
          <select id="rep-period">
            <option value="week">Неделя</option>
            <option value="month" selected>Месяц</option>
            <option value="custom">Произвольный</option>
          </select>
        </div>
        <div id="rep-custom-from" style="display:none;">
          <label for="rep-from">С</label>
          <input type="date" id="rep-from" />
        </div>
        <div id="rep-custom-to" style="display:none;">
          <label for="rep-to">По</label>
          <input type="date" id="rep-to" />
        </div>
      </div>

      <div class="report-actions">
        <button class="btn" id="rep-build-btn">Построить отчёт</button>
        <button class="btn btn-secondary" id="rep-csv-btn" disabled>Экспорт CSV</button>
        <button class="btn btn-secondary" id="rep-print-btn" disabled>Печать</button>
      </div>

      <div id="rep-result" style="margin-top:20px;"></div>
    `;

    let lastReport = null;
    let lastClassName = "";

    const schoolSel = document.getElementById("rep-school");
    const classSel = document.getElementById("rep-class");
    const periodSel = document.getElementById("rep-period");
    const customFrom = document.getElementById("rep-custom-from");
    const customTo = document.getElementById("rep-custom-to");

    schoolSel.addEventListener("change", async () => {
      classSel.innerHTML = `<option value="">— загрузка —</option>`;
      if (!schoolSel.value) {
        classSel.innerHTML = `<option value="">— сначала школа —</option>`;
        return;
      }
      try {
        const list = await fetchClasses(schoolSel.value);
        classSel.innerHTML = list.length
          ? list.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")
          : `<option value="">— нет классов —</option>`;
      } catch (err) {
        toast(err.message, "error");
      }
    });

    periodSel.addEventListener("change", () => {
      const isCustom = periodSel.value === "custom";
      customFrom.style.display = isCustom ? "block" : "none";
      customTo.style.display = isCustom ? "block" : "none";
    });

    document.getElementById("rep-build-btn").addEventListener("click", async () => {
      const classId = classSel.value;
      if (!classId) {
        toast("Выберите класс", "error");
        return;
      }
      let from, to;
      if (periodSel.value === "week") {
        ({ from, to } = periodWeek());
      } else if (periodSel.value === "month") {
        ({ from, to } = periodMonth());
      } else {
        from = document.getElementById("rep-from").value;
        to = document.getElementById("rep-to").value;
        if (!from || !to) {
          toast("Укажите даты", "error");
          return;
        }
        if (from > to) {
          toast("Дата «С» больше даты «По»", "error");
          return;
        }
      }

      try {
        const report = await buildReport(classId, from, to, price);
        lastReport = report;
        lastClassName = classSel.options[classSel.selectedIndex].textContent;
        document.getElementById("rep-result").innerHTML = `
          <h2>${esc(lastClassName)} · ${formatDate(from)} — ${formatDate(to)}</h2>
          ${renderReportTable(report)}
        `;
        document.getElementById("rep-csv-btn").disabled = false;
        document.getElementById("rep-print-btn").disabled = false;
      } catch (err) {
        toast(err.message || "Ошибка", "error");
      }
    });

    document.getElementById("rep-csv-btn").addEventListener("click", () => {
      if (!lastReport) return;
      const filename = `report_${lastClassName}_${Date.now()}.csv`;
      exportCSV(filename, lastReport, lastClassName);
    });

    document.getElementById("rep-print-btn").addEventListener("click", () => {
      window.print();
    });
  } catch (err) {
    app.innerHTML = `<div class="empty">Ошибка: ${esc(err.message)}</div>`;
  }
}
