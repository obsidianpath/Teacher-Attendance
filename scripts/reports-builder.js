// ============================================================
// Конструктор отчётов для админки + экспорт в XLSX/CSV
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, formatDate } from "./ui.js";
import { checkIsAdmin, fetchUsersSummary } from "./admin.js";

// ---------- RPC: отчёты ----------
export async function fetchReportStudents(f) {
  const { data, error } = await supabase.rpc("admin_report_students", {
    p_teacher: f.teacher || null,
    p_school: f.school || null,
    p_class: f.class || null,
    p_from: f.from || null,
    p_to: f.to || null,
  });
  if (error) throw error;
  return data || [];
}

export async function fetchReportClasses(f) {
  const { data, error } = await supabase.rpc("admin_report_classes", {
    p_teacher: f.teacher || null,
    p_school: f.school || null,
    p_class: f.class || null,
    p_from: f.from || null,
    p_to: f.to || null,
  });
  if (error) throw error;
  return data || [];
}

export async function fetchReportDays(f) {
  const { data, error } = await supabase.rpc("admin_report_days", {
    p_teacher: f.teacher || null,
    p_school: f.school || null,
    p_class: f.class || null,
    p_from: f.from || null,
    p_to: f.to || null,
  });
  if (error) throw error;
  return data || [];
}

// ---------- Список школ конкретного учителя (для каскадного селекта) ----------
export async function fetchSchoolsOfTeacher(teacherId) {
  // admin может смотреть чужие школы только через RPC. Здесь используем
  // прямой запрос с RLS-обходом через отдельный RPC не нужен: admin видит всё,
  // но RLS на schools не пропустит. Поэтому для упрощения — берём из сводки
  // классов (уникальные школы), либо требуем сначала выбрать учителя.
  const { data, error } = await supabase.rpc("admin_user_schools_with_stats", {
    target_user_id: teacherId,
  });
  if (error) throw error;
  const seen = new Map();
  (data || []).forEach((r) => {
    if (r.school_id && !seen.has(r.school_id)) {
      seen.set(r.school_id, { id: r.school_id, name: r.school_name });
    }
  });
  return [...seen.values()];
}

// ---------- Периоды ----------
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getPeriod(preset) {
  const now = new Date();
  if (preset === "week") {
    const day = now.getDay() || 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - day + 1);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: toISO(mon), to: toISO(sun) };
  }
  if (preset === "month") {
    return {
      from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      from: toISO(new Date(now.getFullYear(), q * 3, 1)),
      to: toISO(new Date(now.getFullYear(), q * 3 + 3, 0)),
    };
  }
  if (preset === "year") {
    return {
      from: toISO(new Date(now.getFullYear(), 0, 1)),
      to: toISO(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return { from: "", to: "" };
}

// ============================================================
// ЭКСПОРТ В XLSX
// ============================================================
export function exportXLSX({ rows, columns, meta, filename }) {
  if (!window.XLSX) {
    toast("Библиотека XLSX не загрузилась", "error");
    return;
  }

  const { utils, writeFile } = window.XLSX;

  // Строим массив массивов (AOA)
  const aoa = [];

  // Шапка
  aoa.push([meta.title]);
  aoa.push(["Период:", `${formatDate(meta.from)} — ${formatDate(meta.to)}`]);
  aoa.push(["Сформировал:", meta.author]);
  aoa.push(["Дата формирования:", meta.generatedAt]);
  aoa.push([]); // пустая строка

  // Заголовки колонок
  aoa.push(columns.map((c) => c.header));

  // Данные
  rows.forEach((r) => {
    aoa.push(columns.map((c) => c.value(r)));
  });

  // Итоговая строка (если задана)
  if (meta.totals) {
    aoa.push(columns.map((c) => (c.total ? c.total(rows) : "")));
  }

  const ws = utils.aoa_to_sheet(aoa);

  // Авто-ширина колонок
  const colWidths = columns.map((c) => {
    const headerLen = String(c.header).length;
    const maxLen = rows.reduce((max, r) => {
      const v = String(c.value(r) ?? "");
      return Math.max(max, v.length);
    }, headerLen);
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  ws["!cols"] = colWidths;

  // Объединяем ячейки шапки
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Отчёт");

  writeFile(wb, filename);
  toast("Файл Excel сохранён", "success");
}

// ============================================================
// ЭКСПОРТ В CSV (для совместимости)
// ============================================================
export function exportCSVUniversal({ rows, columns, meta, filename }) {
  const lines = [];
  lines.push(meta.title);
  lines.push(`Период;${formatDate(meta.from)} — ${formatDate(meta.to)}`);
  lines.push(`Сформировал;${meta.author}`);
  lines.push(`Дата формирования;${meta.generatedAt}`);
  lines.push("");
  lines.push(columns.map((c) => c.header).join(";"));
  rows.forEach((r) => {
    lines.push(
      columns
        .map((c) => String(c.value(r) ?? "").replace(/;/g, ","))
        .join(";")
    );
  });

  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// ЭКРАН: Конструктор отчётов
// ============================================================
export async function renderAdminReportsScreen() {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="empty">Загрузка...</div>`;

  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    app.innerHTML = `<div class="empty"><div class="empty-icon">🚫</div>Доступ запрещён</div>`;
    return;
  }

  let teachers = [];
  try {
    teachers = await fetchUsersSummary();
  } catch (err) {
    app.innerHTML = `<div class="empty">Ошибка: ${esc(err.message)}</div>`;
    return;
  }

  // Предзаполнение из query (?teacher=uuid)
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const presetTeacher = params.get("teacher") || "";

  app.innerHTML = `
    <a href="#/admin" class="back-link">← В админ-панель</a>
    <h1>📊 Конструктор отчётов</h1>
    <p class="subtitle">Настройте параметры и постройте отчёт по любому учителю, школе или классу</p>

    <div class="report-filters" style="flex-direction:column; align-items:stretch;">
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
          <label for="rb-teacher">Учитель</label>
          <select id="rb-teacher">
            <option value="">— Все учителя —</option>
            ${teachers
              .map(
                (t) =>
                  `<option value="${t.user_id}" ${
                    t.user_id === presetTeacher ? "selected" : ""
                  }>${esc(t.full_name || t.email)} (${t.email})</option>`
              )
              .join("")}
          </select>
        </div>
        <div style="flex:1; min-width:200px;">
          <label for="rb-school">Школа</label>
          <select id="rb-school"><option value="">— Все школы —</option></select>
        </div>
        <div style="flex:1; min-width:200px;">
          <label for="rb-class">Класс</label>
          <select id="rb-class"><option value="">— Все классы —</option></select>
        </div>
      </div>

      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">
        <div style="flex:1; min-width:200px;">
          <label for="rb-period">Период</label>
          <select id="rb-period">
            <option value="month" selected>Месяц (текущий)</option>
            <option value="week">Неделя (текущая)</option>
            <option value="quarter">Квартал</option>
            <option value="year">Год</option>
            <option value="custom">Произвольный</option>
          </select>
        </div>
        <div style="flex:1; min-width:160px;" id="rb-from-wrap" hidden>
          <label for="rb-from">С</label>
          <input type="date" id="rb-from" />
        </div>
        <div style="flex:1; min-width:160px;" id="rb-to-wrap" hidden>
          <label for="rb-to">По</label>
          <input type="date" id="rb-to" />
        </div>
        <div style="flex:1; min-width:220px;">
          <label for="rb-type">Тип отчёта</label>
          <select id="rb-type">
            <option value="students" selected>По ученикам</option>
            <option value="classes">По классам</option>
            <option value="days">По дням</option>
          </select>
        </div>
      </div>
    </div>

    <div class="report-actions">
      <button class="btn" id="rb-build">Построить отчёт</button>
      <button class="btn btn-secondary" id="rb-xlsx" disabled>📥 Excel (XLSX)</button>
      <button class="btn btn-secondary" id="rb-csv" disabled>📄 CSV</button>
      <button class="btn btn-secondary" id="rb-print" disabled>🖨️ Печать</button>
    </div>

    <div id="rb-result" style="margin-top:20px;"></div>
  `;

  const teacherSel = document.getElementById("rb-teacher");
  const schoolSel = document.getElementById("rb-school");
  const classSel = document.getElementById("rb-class");
  const periodSel = document.getElementById("rb-period");
  const typeSel = document.getElementById("rb-type");

  // При смене учителя — перезагружаем школы
  async function reloadSchools() {
    schoolSel.innerHTML = `<option value="">— Все школы —</option>`;
    classSel.innerHTML = `<option value="">— Все классы —</option>`;
    if (!teacherSel.value) return;
    try {
      const list = await fetchSchoolsOfTeacher(teacherSel.value);
      schoolSel.innerHTML += list
        .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
        .join("");
    } catch (err) {
      toast(err.message || "Ошибка", "error");
    }
  }

  // При смене школы — перезагружаем классы (если учитель выбран)
  async function reloadClasses() {
    classSel.innerHTML = `<option value="">— Все классы —</option>`;
    if (!schoolSel.value || !teacherSel.value) return;
    try {
      const res = await supabase.rpc("admin_user_schools_with_stats", {
        target_user_id: teacherSel.value,
      });
      if (res.error) throw res.error;
      const classes = (res.data || []).filter(
        (r) => r.school_id === schoolSel.value && r.class_id
      );
      classSel.innerHTML += classes
        .map((c) => `<option value="${c.class_id}">${esc(c.class_name)}</option>`)
        .join("");
    } catch (err) {
      toast(err.message || "Ошибка", "error");
    }
  }

  teacherSel.addEventListener("change", reloadSchools);
  schoolSel.addEventListener("change", reloadClasses);

  periodSel.addEventListener("change", () => {
    const isCustom = periodSel.value === "custom";
    document.getElementById("rb-from-wrap").hidden = !isCustom;
    document.getElementById("rb-to-wrap").hidden = !isCustom;
  });

  if (presetTeacher) {
    reloadSchools();
  }

  // ---------- Переменные с построенным отчётом ----------
  let lastBuild = null; // { type, rows, meta, columns, filename }

  // ---------- Обработчик кнопки "Построить" ----------
  document.getElementById("rb-build").addEventListener("click", async () => {
    const filters = {
      teacher: teacherSel.value || null,
      school: schoolSel.value || null,
      class: classSel.value || null,
    };

    if (periodSel.value === "custom") {
      filters.from = document.getElementById("rb-from").value || null;
      filters.to = document.getElementById("rb-to").value || null;
      if (!filters.from || !filters.to) {
        toast("Укажите обе даты", "error");
        return;
      }
      if (filters.from > filters.to) {
        toast("Дата «С» позже даты «По»", "error");
        return;
      }
    } else {
      const p = getPeriod(periodSel.value);
      filters.from = p.from;
      filters.to = p.to;
    }

    const type = typeSel.value;
    const resultBox = document.getElementById("rb-result");
    resultBox.innerHTML = `<div class="empty">Строим отчёт...</div>`;

    try {
      if (type === "students") {
        const rows = await fetchReportStudents(filters);
        const columns = [
          { header: "Учитель", value: (r) => r.teacher_name },
          { header: "Email", value: (r) => r.teacher_email },
          { header: "Школа", value: (r) => r.school_name },
          { header: "Класс", value: (r) => r.class_name },
          { header: "Ученик", value: (r) => r.student_name },
          { header: "Родитель", value: (r) => r.parent_name },
          { header: "Телефон", value: (r) => r.parent_phone },
          { header: "Посещено", value: (r) => Number(r.present_count) },
          { header: "Пропущено", value: (r) => Number(r.absent_count) },
          { header: "Всего", value: (r) => Number(r.total_lessons) },
          { header: "%", value: (r) => Number(r.percent) },
          { header: "Сумма", value: (r) => Number(r.total_sum) },
        ];
        lastBuild = {
          type: "students",
          rows,
          columns,
          meta: {
            title: "Отчёт по ученикам",
            from: filters.from,
            to: filters.to,
            author: await getAuthorName(),
            generatedAt: new Date().toLocaleString("ru-RU"),
            totals: true,
          },
          filename: `report_students_${filters.from}_${filters.to}.xlsx`,
        };
        renderStudentsPreview(resultBox, rows);
      } else if (type === "classes") {
        const rows = await fetchReportClasses(filters);
        const columns = [
          { header: "Учитель", value: (r) => r.teacher_name },
          { header: "Email", value: (r) => r.teacher_email },
          { header: "Школа", value: (r) => r.school_name },
          { header: "Класс", value: (r) => r.class_name },
          { header: "Учеников", value: (r) => Number(r.students_count) },
          { header: "Уроков", value: (r) => Number(r.lessons_count) },
          { header: "Посещено", value: (r) => Number(r.present_count) },
          { header: "%", value: (r) => Number(r.percent) },
          { header: "Сумма", value: (r) => Number(r.total_sum) },
        ];
        lastBuild = {
          type: "classes",
          rows,
          columns,
          meta: {
            title: "Сводный отчёт по классам",
            from: filters.from,
            to: filters.to,
            author: await getAuthorName(),
            generatedAt: new Date().toLocaleString("ru-RU"),
            totals: true,
          },
          filename: `report_classes_${filters.from}_${filters.to}.xlsx`,
        };
        renderClassesPreview(resultBox, rows);
      } else {
        const rows = await fetchReportDays(filters);
        const columns = [
          { header: "Дата", value: (r) => formatDate(r.lesson_date) },
          { header: "Школа", value: (r) => r.school_name },
          { header: "Класс", value: (r) => r.class_name },
          { header: "Учитель", value: (r) => r.teacher_name },
          { header: "Учеников", value: (r) => Number(r.total_students) },
          { header: "Присутствовало", value: (r) => Number(r.present_count) },
          { header: "Отсутствовало", value: (r) => Number(r.absent_count) },
          { header: "%", value: (r) => Number(r.percent) },
        ];
        lastBuild = {
          type: "days",
          rows,
          columns,
          meta: {
            title: "Отчёт по дням",
            from: filters.from,
            to: filters.to,
            author: await getAuthorName(),
            generatedAt: new Date().toLocaleString("ru-RU"),
            totals: false,
          },
          filename: `report_days_${filters.from}_${filters.to}.xlsx`,
        };
        renderDaysPreview(resultBox, rows);
      }

      document.getElementById("rb-xlsx").disabled = false;
      document.getElementById("rb-csv").disabled = false;
      document.getElementById("rb-print").disabled = false;
    } catch (err) {
      resultBox.innerHTML = `<div class="empty" style="color:var(--absent);">
        Ошибка: ${esc(err.message)}
      </div>`;
    }
  });

  // ---------- Экспорт XLSX ----------
  document.getElementById("rb-xlsx").addEventListener("click", () => {
    if (!lastBuild) return;
    exportXLSX(lastBuild);
  });

  // ---------- Экспорт CSV ----------
  document.getElementById("rb-csv").addEventListener("click", () => {
    if (!lastBuild) return;
    exportCSVUniversal({
      ...lastBuild,
      filename: lastBuild.filename.replace(".xlsx", ".csv"),
    });
  });

  // ---------- Печать ----------
  document.getElementById("rb-print").addEventListener("click", () => {
    window.print();
  });
}

// ---------- Имя текущего админа ----------
async function getAuthorName() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.user_metadata?.full_name || data?.user?.email || "Администратор";
}

// ============================================================
// Превью отчётов (таблицы на экране)
// ============================================================
function renderStudentsPreview(container, rows) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div>Нет данных за выбранный период</div>`;
    return;
  }
  container.innerHTML = `
    <div class="journal-wrap">
      <table class="journal" style="font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;">Учитель</th>
            <th style="text-align:left;">Школа</th>
            <th style="text-align:left;">Класс</th>
            <th style="text-align:left;">Ученик</th>
            <th>Посещено</th>
            <th>Пропущено</th>
            <th>Всего</th>
            <th>%</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td style="text-align:left;">${esc(r.teacher_name || r.teacher_email)}</td>
              <td style="text-align:left;">${esc(r.school_name)}</td>
              <td style="text-align:left;">${esc(r.class_name)}</td>
              <td style="text-align:left;">${esc(r.student_name)}</td>
              <td>${r.present_count}</td>
              <td>${r.absent_count}</td>
              <td>${r.total_lessons}</td>
              <td>${r.percent}%</td>
              <td>${Number(r.total_sum).toLocaleString("ru-RU")} ₽</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="admin-count" style="margin-top:8px;">Найдено строк: ${rows.length}</p>
  `;
}

function renderClassesPreview(container, rows) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div>Нет данных за выбранный период</div>`;
    return;
  }
  container.innerHTML = `
    <div class="journal-wrap">
      <table class="journal" style="font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;">Учитель</th>
            <th style="text-align:left;">Школа</th>
            <th style="text-align:left;">Класс</th>
            <th>Учеников</th>
            <th>Уроков</th>
            <th>Посещено</th>
            <th>%</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td style="text-align:left;">${esc(r.teacher_name || r.teacher_email)}</td>
              <td style="text-align:left;">${esc(r.school_name)}</td>
              <td style="text-align:left;">${esc(r.class_name)}</td>
              <td>${r.students_count}</td>
              <td>${r.lessons_count}</td>
              <td>${r.present_count}</td>
              <td>${r.percent}%</td>
              <td>${Number(r.total_sum || 0).toLocaleString("ru-RU")} ₽</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="admin-count" style="margin-top:8px;">Найдено строк: ${rows.length}</p>
  `;
}

function renderDaysPreview(container, rows) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div>Нет данных за выбранный период</div>`;
    return;
  }
  container.innerHTML = `
    <div class="journal-wrap">
      <table class="journal" style="font-size:13px;">
        <thead>
          <tr>
            <th style="text-align:left;">Дата</th>
            <th style="text-align:left;">Школа</th>
            <th style="text-align:left;">Класс</th>
            <th style="text-align:left;">Учитель</th>
            <th>Учеников</th>
            <th>Присутствовало</th>
            <th>Отсутствовало</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td style="text-align:left;">${formatDate(r.lesson_date)}</td>
              <td style="text-align:left;">${esc(r.school_name)}</td>
              <td style="text-align:left;">${esc(r.class_name)}</td>
              <td style="text-align:left;">${esc(r.teacher_name)}</td>
              <td>${r.total_students}</td>
              <td>${r.present_count}</td>
              <td>${r.absent_count}</td>
              <td>${r.percent}%</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="admin-count" style="margin-top:8px;">Найдено строк: ${rows.length}</p>
  `;
}
