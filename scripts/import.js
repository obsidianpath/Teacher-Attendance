// ============================================================
// Импорт учеников из CSV + скачивание шаблона
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, openModal, closeModal } from "./ui.js";
import { createStudent } from "./students.js";

// ---------- Парсинг CSV ----------
// Формат: ФИО ученика;ФИО родителя;Телефон родителя
// Первая строка — заголовки, пропускается
export function parseCSV(text) {
  // Убираем BOM, если есть
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/);

  const rows = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    const cells = raw.split(";").map((c) => c.trim());

    // Пропускаем заголовки (первая непустая строка)
    if (i === 0 && /фио|ученик|имя/i.test(cells.join(" "))) {
      continue;
    }

    const [studentFullName = "", parentName = "", parentPhone = ""] = cells;

    if (!studentFullName) {
      errors.push(`Строка ${i + 1}: пустое ФИО ученика`);
      continue;
    }

    // Разбираем ФИО ученика: последнее слово — фамилия? Нет,
    // принимаем как "Фамилия Имя Отчество" в стандартном порядке.
    // Разделяем по пробелам: [Фамилия, Имя, Отчество?]
    const parts = studentFullName.split(/\s+/);
    const last_name = parts[0] || "";
    const first_name = parts.slice(1).join(" ") || "";

    rows.push({
      last_name,
      first_name,
      parent_name: parentName || "",
      parent_phone: parentPhone || "",
    });
  }

  return { rows, errors };
}

// ---------- Скачивание шаблона ----------
export function downloadTemplate() {
  const lines = [
    "ФИО ученика;ФИО родителя;Телефон родителя",
    "Иванов Иван Иванович;Иванова Мария Петровна;+7 900 123-45-67",
    "Петров Пётр;Петрова Анна;+7 900 765-43-21",
    "Сидорова Мария;;",
  ];
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_students.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("Шаблон скачан", "success");
}

// ---------- Массовая вставка ----------
export async function bulkInsertStudents(classId, rows) {
  if (!rows.length) return 0;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Не авторизован");

  const payload = rows.map((r) => ({
    class_id: classId,
    user_id: userData.user.id,
    first_name: r.first_name || "",
    last_name: r.last_name || "",
    parent_name: r.parent_name || null,
    parent_phone: r.parent_phone || null,
  }));

  const { error } = await supabase.from("students").insert(payload);
  if (error) throw error;
  return payload.length;
}

// ============================================================
// Модалка импорта
// ============================================================
export function openImportModal({ classId, onDone }) {
  openModal({
    title: "Импорт учеников из CSV",
    bodyHTML: `
      <p style="color:var(--muted); font-size:13px; margin-bottom:12px;">
        Формат: <b>ФИО ученика; ФИО родителя; Телефон родителя</b><br>
        Разделитель — точка с запятой. Первая строка — заголовки.
      </p>
      <div class="form-group">
        <label for="import-file">Выберите CSV-файл</label>
        <input type="file" id="import-file" accept=".csv,text/csv" />
      </div>
      <div id="import-preview"></div>
    `,
    actions: [
      { label: "Отмена", variant: "btn-secondary", onClick: closeModal },
      {
        label: "Импортировать",
        variant: "btn",
        onClick: async ({ close }) => {
          const preview = document.getElementById("import-preview");
          const rows = preview._parsedRows;
          if (!rows || !rows.length) {
            toast("Сначала выберите файл с данными", "error");
            return;
          }
          try {
            const count = await bulkInsertStudents(classId, rows);
            toast(`Добавлено учеников: ${count}`, "success");
            close();
            if (onDone) onDone();
          } catch (err) {
            toast(err.message || "Ошибка импорта", "error");
          }
        },
      },
    ],
    onMount: (modal) => {
      const fileInput = modal.querySelector("#import-file");
      const preview = modal.querySelector("#import-preview");

      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const { rows, errors } = parseCSV(text);
          preview._parsedRows = rows;

          if (!rows.length) {
            preview.innerHTML = `
              <div class="empty" style="padding:16px;">
                <div class="empty-icon">⚠️</div>
                Не найдено ни одной строки с учениками
              </div>`;
            return;
          }

          const previewRows = rows
            .slice(0, 5)
            .map(
              (r) => `
            <tr>
              <td>${esc([r.last_name, r.first_name].filter(Boolean).join(" "))}</td>
              <td>${esc(r.parent_name || "—")}</td>
              <td>${esc(r.parent_phone || "—")}</td>
            </tr>`
            )
            .join("");

          const more =
            rows.length > 5
              ? `<tr><td colspan="3" style="text-align:center; color:var(--muted);">
                  … и ещё ${rows.length - 5}
                </td></tr>`
              : "";

          const errorsHTML = errors.length
            ? `<div style="margin-top:10px; color:var(--absent); font-size:13px;">
                Пропущено строк с ошибками: ${errors.length}
              </div>`
            : "";

          preview.innerHTML = `
            <div style="margin-top:12px;">
              <div class="stat-label" style="margin-bottom:6px;">
                Найдено учеников: <b>${rows.length}</b>
              </div>
              <div class="journal-wrap" style="max-height:220px; overflow:auto;">
                <table class="journal" style="font-size:13px;">
                  <thead>
                    <tr>
                      <th class="student-col" style="position:static;">Ученик</th>
                      <th>Родитель</th>
                      <th>Телефон</th>
                    </tr>
                  </thead>
                  <tbody>${previewRows}${more}</tbody>
                </table>
              </div>
              ${errorsHTML}
            </div>
          `;
        } catch (err) {
          preview.innerHTML = `<div class="empty" style="padding:16px; color:var(--absent);">
            Ошибка чтения файла: ${esc(err.message)}
          </div>`;
        }
      });
    },
  });
}
