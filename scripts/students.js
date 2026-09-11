// ============================================================
// Ученики: список, создание, редактирование, удаление
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, openModal, closeModal } from "./ui.js";

// ---------- Получить учеников класса ----------
export async function fetchStudents(classId) {
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_name, parent_phone, created_at")
    .eq("class_id", classId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Создать ученика ----------
export async function createStudent(classId, data) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Не авторизован");
  const { data: row, error } = await supabase
    .from("students")
    .insert({
      class_id: classId,
      user_id: userData.user.id,
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      parent_name: data.parent_name || null,
      parent_phone: data.parent_phone || null,
    })
    .select()
    .single();
  if (error) throw error;
  return row;
}

// ---------- Обновить ученика ----------
export async function updateStudent(id, data) {
  const { error } = await supabase
    .from("students")
    .update({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      parent_name: data.parent_name || null,
      parent_phone: data.parent_phone || null,
    })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Удалить ученика ----------
export async function deleteStudent(id) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Полное имя ученика ----------
export function studentFullName(s) {
  const parts = [s.last_name, s.first_name].filter(Boolean);
  return parts.join(" ") || "(без имени)";
}

// ============================================================
// Модалка: создать / редактировать ученика
// ============================================================
export function openStudentModal({ classId, student = null, onSaved }) {
  const isEdit = !!student;
  openModal({
    title: isEdit ? "Редактировать ученика" : "Новый ученик",
    bodyHTML: `
      <div class="form-group">
        <label for="st-last">Фамилия</label>
        <input type="text" id="st-last" value="${esc(student?.last_name || "")}" />
      </div>
      <div class="form-group">
        <label for="st-first">Имя</label>
        <input type="text" id="st-first" value="${esc(student?.first_name || "")}" />
      </div>
      <div class="form-group">
        <label for="st-parent">ФИО родителя (необязательно)</label>
        <input type="text" id="st-parent" value="${esc(student?.parent_name || "")}" />
      </div>
      <div class="form-group">
        <label for="st-phone">Телефон родителя (необязательно)</label>
        <input type="tel" id="st-phone" value="${esc(student?.parent_phone || "")}" />
      </div>
    `,
    actions: [
      { label: "Отмена", variant: "btn-secondary", onClick: closeModal },
      {
        label: isEdit ? "Сохранить" : "Добавить",
        onClick: async ({ close }) => {
          const data = {
            last_name: document.getElementById("st-last").value.trim(),
            first_name: document.getElementById("st-first").value.trim(),
            parent_name: document.getElementById("st-parent").value.trim(),
            parent_phone: document.getElementById("st-phone").value.trim(),
          };
          if (!data.last_name && !data.first_name) {
            toast("Введите хотя бы имя или фамилию", "error");
            return;
          }
          try {
            if (isEdit) {
              await updateStudent(student.id, data);
              toast("Ученик обновлён", "success");
            } else {
              await createStudent(classId, data);
              toast("Ученик добавлен", "success");
            }
            close();
            if (onSaved) onSaved();
          } catch (err) {
            toast(err.message || "Ошибка", "error");
          }
        },
      },
    ],
  });
}

// ============================================================
// Модалка: карточка ученика (просмотр + статистика)
// ============================================================
export async function openStudentCard(student, attendanceStats) {
  const { total_lessons, present_count, percent } = attendanceStats;
  openModal({
    title: studentFullName(student),
    bodyHTML: `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <div class="stat-label">Родитель</div>
          <div>${esc(student.parent_name || "—")}</div>
        </div>
        <div>
          <div class="stat-label">Телефон родителя</div>
          <div>${esc(student.parent_phone || "—")}</div>
        </div>
        <div class="class-stats" style="margin-top:8px;">
          <div class="stat">
            <div class="stat-label">Уроков всего</div>
            <div class="stat-value">${total_lessons}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Посещено</div>
            <div class="stat-value">${present_count}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Посещаемость</div>
            <div class="stat-value">${percent}%</div>
          </div>
        </div>
      </div>
    `,
    actions: [{ label: "Закрыть", variant: "btn-secondary", onClick: closeModal }],
  });
}
