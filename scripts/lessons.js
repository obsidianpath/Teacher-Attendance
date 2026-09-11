// ============================================================
// Уроки и посещаемость: журнал класса
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc, formatDate, todayISO, formatMoney } from "./ui.js";

// ---------- Получить уроки класса ----------
export async function fetchLessons(classId) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, date")
    .eq("class_id", classId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Получить все отметки для набора уроков ----------
export async function fetchAttendanceForLessons(lessonIds) {
  if (!lessonIds.length) return [];
  const { data, error } = await supabase
    .from("attendance")
    .select("id, lesson_id, student_id, present")
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return data || [];
}

// ---------- Создать урок ----------
export async function createLesson(classId, date) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Не авторизован");
  const { data, error } = await supabase
    .from("lessons")
    .insert({ class_id: classId, date, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Удалить урок ----------
export async function deleteLesson(lessonId) {
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw error;
}

// ---------- Сохранить посещаемость урока (upsert) ----------
// marks: { studentId: true|false }
export async function saveAttendance(lessonId, marks) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Не авторизован");
  const rows = Object.entries(marks).map(([student_id, present]) => ({
    lesson_id: lessonId,
    student_id,
    present,
    user_id: userData.user.id,
  }));
  if (!rows.length) return;
  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "lesson_id,student_id" });
  if (error) throw error;
}

// ---------- Получить цену за ученика ----------
export async function getPricePerStudent() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;
  const { data, error } = await supabase
    .from("settings")
    .select("price_per_student")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) return 0;
  return Number(data?.price_per_student || 0);
}

// ---------- Статистика ученика по всем урокам класса ----------
export async function getStudentStats(studentId, lessonIds) {
  if (!lessonIds.length) {
    return { total_lessons: 0, present_count: 0, percent: 0 };
  }
  const { data, error } = await supabase
    .from("attendance")
    .select("present")
    .eq("student_id", studentId)
    .in("lesson_id", lessonIds);
  if (error) return { total_lessons: lessonIds.length, present_count: 0, percent: 0 };
  const present_count = (data || []).filter((r) => r.present).length;
  const percent = lessonIds.length
    ? Math.round((present_count / lessonIds.length) * 100)
    : 0;
  return {
    total_lessons: lessonIds.length,
    present_count,
    percent,
  };
}
