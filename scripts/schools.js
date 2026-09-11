// ============================================================
// Школы: список, создание, переименование, удаление
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, openModal, closeModal, confirmDelete } from "./ui.js";

// ---------- Получить список школ текущего учителя ----------
export async function fetchSchools() {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Создать школу ----------
export async function createSchool(name) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Не авторизован");
  const { data, error } = await supabase
    .from("schools")
    .insert({ name, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Переименовать школу ----------
export async function renameSchool(id, name) {
  const { error } = await supabase
    .from("schools")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Удалить школу ----------
export async function deleteSchool(id) {
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Получить одну школу ----------
export async function fetchSchool(id) {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// Модалка: создать / переименовать школу
// ============================================================
export function openSchoolModal({ school = null, onSaved }) {
  const isEdit = !!school;
  openModal({
    title: isEdit ? "Переименовать школу" : "Новая школа",
    bodyHTML: `
      <div class="form-group">
        <label for="school-name">Название школы</label>
        <input type="text" id="school-name" value="${esc(
          school?.name || ""
        )}" placeholder="Например, Школа №1" />
      </div>
    `,
    actions: [
      { label: "Отмена", variant: "btn-secondary", onClick: closeModal },
      {
        label: isEdit ? "Сохранить" : "Создать",
        onClick: async ({ close }) => {
          const name = document.getElementById("school-name").value.trim();
          if (!name) {
            toast("Введите название", "error");
            return;
          }
          try {
            if (isEdit) {
              await renameSchool(school.id, name);
              toast("Школа переименована", "success");
            } else {
              await createSchool(name);
              toast("Школа создана", "success");
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
