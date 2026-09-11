// ============================================================
// Отчёты: неделя / месяц / произвольный период, CSV, печать
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, formatDate, formatMoney, todayISO } from "./ui.js";
import { studentFullName } from "./students.js";

// ---------- Получить данные отчёта ----------
// Возвращает массив по ученикам: {student, present, absent, total, percent, sum}
export async function buildReport(classId, dateFrom, dateTo, pricePerStudent) {
  // 1. Уроки в диапазоне
  const { data: lessons, error: lErr } = await supabase
    .from("lessons")
    .select("id, date")
    .eq("class_id", classId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true });
  if (lErr) throw lErr;

  const lessonIds = (lessons || []).map((l) => l.id);

  // 2. Ученики класса
  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("class_id", classId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (sErr) throw sErr;

  // 3. Отметки
  let attendance = [];
  if (lessonIds.length) {
    const { data: att, error: aErr } = await supabase
      .from("attendance")
      .select("student_id, present, lesson_id")
      .in("lesson_id", lessonIds);
    if (aErr) throw aErr;
    attendance = att || [];
  }

  // 4. Считаем по ученикам
  const rows = (students || []).map((s) => {
    const attForStudent = attendance.filter((a) => a.student_id === s.id);
    const present = attForStudent.filter((a) => a.present).length;
    const total = lessonIds.length;
    const absent = total - present;
    const percent = total ? Math.round((present / total) * 100) : 0;
    const sum = present * pricePerStudent;
    return { student: s, present, absent, total, percent, sum };
  });

  // 5. Итоги
  const totalSum = rows.reduce((acc, r) => acc + r.sum, 0);
  const avgPercent = rows.length
    ? Math.round(rows.reduce((acc, r) => acc + r.percent, 0) / rows.length)
    : 0;
  const totalPresent = rows.reduce((acc, r) => acc + r.present, 0);

  return {
    rows,
    lessonsCount: lessonIds.length,
    totalSum,
    avgPercent,
    totalPresent,
  };
}

// ---------- Периоды ----------
export function periodWeek() {
  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { from: toISO(mon), to: toISO(sun) };
}

export function periodMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toISO(first), to: toISO(last) };
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------- Экспорт в CSV ----------
export function exportCSV(filename, report, className, teacherName = "") {
  const lines = [];
  if (teacherName) {
    lines.push(`Учитель;${teacherName}`);
  }
  lines.push(`Отчёт по классу;${className}`);
  lines.push(`Ученик;Посещено;Пропущено;Всего;Процент;Сумма`);
  report.rows.forEach((r) => {
    lines.push(
      [
        studentFullName(r.student),
        r.present,
        r.absent,
        r.total,
        r.percent + "%",
        r.sum,
      ].join(";")
    );
  });
  lines.push("");
  lines.push(
    `ИТОГО;;;${report.lessonsCount} уроков;${report.avgPercent}%;${report.totalSum}`
  );

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

// ---------- Рендер таблицы отчёта ----------
export function renderReportTable(report) {
  if (!report.rows.length) {
    return `<div class="empty"><div class="empty-icon">📊</div>Нет учеников в классе</div>`;
  }
  const rowsHTML = report.rows
    .map(
      (r) => `
    <tr>
      <td>${esc(studentFullName(r.student))}</td>
      <td>${r.present}</td>
      <td>${r.absent}</td>
      <td>${r.total}</td>
      <td>${r.percent}%</td>
      <td>${formatMoney(r.sum)}</td>
    </tr>`
    )
    .join("");

  return `
    <table class="report">
      <thead>
        <tr>
          <th>Ученик</th>
          <th>Посещено</th>
          <th>Пропущено</th>
          <th>Всего уроков</th>
          <th>Посещаемость</th>
          <th>Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML}
        <tr class="total-row">
          <td>ИТОГО</td>
          <td>${report.totalPresent}</td>
          <td>—</td>
          <td>${report.lessonsCount}</td>
          <td>${report.avgPercent}%</td>
          <td>${formatMoney(report.totalSum)}</td>
        </tr>
      </tbody>
    </table>
  `;
}
