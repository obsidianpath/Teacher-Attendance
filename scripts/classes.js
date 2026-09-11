// ============================================================
// Классы: список внутри школы, создание, переименование, удаление
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, openModal, closeModal } from "./ui.js";

// ---------- Получить классы школы ----------
export async function fetchClasses(schoolId) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, school_id, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Получить один класс ----------
export async function fetchClass(id) {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ---------- Создать класс ----------
export async function createClass(schoolId, name) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Не авторизован");
  const { data, error } = await supabase
    .from("classes")
    .insert({ name, school_id: schoolId, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Переименовать класс ----------
export async function renameClass(id, name) {
  const { error } = await supabase.from("classes").update({ name }).eq("id", id);
  if (error) throw error;
}

// ---------- Удалить класс ----------
export async function deleteClass(id) {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Получить количество учеников в классе ----------
export async function countStudents(classId) {
  const { count, error } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  if (error) throw error;
  return count || 0;
}

// ============================================================
// Модалка: создать / переименовать класс
// ============================================================
export function openClassModal({ schoolId, cls = null, onSaved }) {
  const isEdit = !!cls;
  openModal({
    title: isEdit ? "Переименовать класс" : "Новый класс",
    bodyHTML: `
      <div class="form-group">
        <label for="class-name">Название класса</label>
        <input type="text" id="class-name" value="${esc(
          cls?.name || ""
        )}" placeholder="Например, 5А" />
      </div>
    `,
    actions: [
      { label: "Отмена", variant: "btn-secondary", onClick: closeModal },
      {
        label: isEdit ? "Сохранить" : "Создать",
        onClick: async ({ close }) => {
          const name = document.getElementById("class-name").value.trim();
          if (!name) {
            toast("Введите название", "error");
            return;
          }
          try {
            if (isEdit) {
              await renameClass(cls.id, name);
              toast("Класс переименован", "success");
            } else {
              await createClass(schoolId, name);
              toast("Класс создан", "success");
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
