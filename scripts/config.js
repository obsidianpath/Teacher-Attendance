// ============================================================
// Конфигурация подключения к Supabase
// ============================================================
// ВАЖНО: anon key — публичный ключ, его безопасно держать в коде.
// Безопасность обеспечивается RLS-политиками на стороне Supabase.
// НИКОГДА не вставляйте сюда service_role key.
// ============================================================

export const SUPABASE_URL = "https://eshmsrmwffebdboquuhv.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzaG1zcm13ZmZlYmRib3F1dWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzIxMDUsImV4cCI6MjEwNDcwODEwNX0.p4JIJpEtN2itKNthypPYd7GUjuOdi0MUhV95_dN0BLc";

// Название приложения (используется в шапке и title)
export const APP_NAME = "Журнал посещаемости";
