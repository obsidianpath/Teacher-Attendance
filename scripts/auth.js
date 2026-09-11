// ============================================================
// Авторизация: регистрация, вход, выход, сброс пароля
// ============================================================

import { supabase } from "./supabase.js";
import { toast, esc } from "./ui.js";

// ---------- Получить текущего пользователя ----------
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

// ---------- Регистрация ----------
export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data;
}

// ---------- Вход ----------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ---------- Выход ----------
export async function signOut() {
  await supabase.auth.signOut();
  // Сброс кэша админа, чтобы новый вход перепроверил права
  const { resetAdminCache } = await import("./admin.js");
  resetAdminCache();
  location.hash = "#/login";
}

// ---------- Сброс пароля ----------
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname + "#/reset-password",
  });
  if (error) throw error;
}

// ---------- Обновление пароля (после перехода по ссылке из письма) ----------
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ============================================================
// ЭКРАН: Вход / Регистрация
// ============================================================
export function renderAuthScreen(mode = "login") {
  const app = document.getElementById("app");
  const isLogin = mode === "login";

  app.innerHTML = `
    <div class="auth-screen">
      <h1>${isLogin ? "Вход" : "Регистрация"}</h1>
      <p class="subtitle">Teacher-Attendance</p>
      <form id="auth-form">
        ${
          isLogin
            ? ""
            : `
          <div class="form-group">
            <label for="auth-fullname">ФИО</label>
            <input type="text" id="auth-fullname" required placeholder="Иванов Иван Иванович" autocomplete="name" />
          </div>`
        }
        <div class="form-group">
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="auth-password">Пароль</label>
          <input type="password" id="auth-password" required minlength="6" autocomplete="${
            isLogin ? "current-password" : "new-password"
          }" />
        </div>
        <button type="submit" class="btn btn-block" id="auth-submit">
          ${isLogin ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>
      <div class="auth-switch">
        ${
          isLogin
            ? `Нет аккаунта? <a id="switch-mode">Зарегистрироваться</a><br><br>
               <a id="forgot-link">Забыли пароль?</a>`
            : `Уже есть аккаунт? <a id="switch-mode">Войти</a>`
        }
      </div>
    </div>
  `;

  document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const btn = document.getElementById("auth-submit");

    let fullName = "";
    if (!isLogin) {
      fullName = document.getElementById("auth-fullname").value.trim();
      if (!fullName) {
        toast("Введите ФИО", "error");
        return;
      }
    }

    btn.disabled = true;
    btn.textContent = "Подождите...";

    try {
      if (isLogin) {
        await signIn(email, password);
        toast("Вы вошли", "success");
        location.hash = "#/dashboard";
      } else {
        const data = await signUp(email, password, fullName);
        if (data.session) {
          toast("Аккаунт создан", "success");
          location.hash = "#/dashboard";
        } else {
          toast("Регистрация успешна. Проверьте почту.", "success", 6000);
          location.hash = "#/login";
        }
      }
    } catch (err) {
      toast(err.message || "Ошибка", "error", 5000);
      btn.disabled = false;
      btn.textContent = isLogin ? "Войти" : "Зарегистрироваться";
    }
  });

  const switchBtn = document.getElementById("switch-mode");
  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      location.hash = isLogin ? "#/register" : "#/login";
    });
  }

  const forgotBtn = document.getElementById("forgot-link");
  if (forgotBtn) {
    forgotBtn.addEventListener("click", () => {
      location.hash = "#/forgot-password";
    });
  }
}

// ============================================================
// ЭКРАН: Восстановление пароля (запрос email)
// ============================================================
export function renderForgotPassword() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="auth-screen">
      <h1>Восстановление пароля</h1>
      <p class="subtitle">Введите email, на который зарегистрирован аккаунт</p>
      <form id="forgot-form">
        <div class="form-group">
          <label for="forgot-email">Email</label>
          <input type="email" id="forgot-email" required autocomplete="email" />
        </div>
        <button type="submit" class="btn btn-block" id="forgot-submit">Отправить ссылку</button>
      </form>
      <div class="auth-switch">
        <a id="back-to-login">← Вернуться к входу</a>
      </div>
    </div>
  `;

  document.getElementById("forgot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value.trim();
    const btn = document.getElementById("forgot-submit");
    btn.disabled = true;
    btn.textContent = "Отправка...";
    try {
      await resetPassword(email);
      toast("Ссылка отправлена на почту", "success", 5000);
      location.hash = "#/login";
    } catch (err) {
      toast(err.message || "Ошибка", "error", 5000);
      btn.disabled = false;
      btn.textContent = "Отправить ссылку";
    }
  });

  document.getElementById("back-to-login").addEventListener("click", () => {
    location.hash = "#/login";
  });
}

// ============================================================
// ЭКРАН: Установка нового пароля (после перехода по ссылке)
// ============================================================
export function renderResetPassword() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="auth-screen">
      <h1>Новый пароль</h1>
      <p class="subtitle">Придумайте новый пароль для входа</p>
      <form id="reset-form">
        <div class="form-group">
          <label for="reset-password">Новый пароль</label>
          <input type="password" id="reset-password" required minlength="6" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label for="reset-password-2">Повторите пароль</label>
          <input type="password" id="reset-password-2" required minlength="6" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn-block" id="reset-submit">Сохранить пароль</button>
      </form>
    </div>
  `;

  document.getElementById("reset-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = document.getElementById("reset-password").value;
    const p2 = document.getElementById("reset-password-2").value;
    if (p1 !== p2) {
      toast("Пароли не совпадают", "error");
      return;
    }
    const btn = document.getElementById("reset-submit");
    btn.disabled = true;
    btn.textContent = "Сохранение...";
    try {
      await updatePassword(p1);
      toast("Пароль обновлён", "success");
      location.hash = "#/dashboard";
    } catch (err) {
      toast(err.message || "Ошибка", "error", 5000);
      btn.disabled = false;
      btn.textContent = "Сохранить пароль";
    }
  });
}
