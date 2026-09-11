# 📓 Журнал посещаемости для учителя

Веб-приложение для учёта посещаемости учеников по школам и классам
с автоматическим подсчётом заработанной суммы и формированием отчётов.

## ✨ Возможности

- Регистрация и вход учителя (email + пароль)
- Каждый учитель видит **только свои** данные (изоляция через RLS в Supabase)
- Школы → классы → ученики
- У ученика: имя, фамилия, ФИО родителя, телефон родителя
- Журнал класса: отметки по датам (зелёный — присутствует, красный — отсутствует)
- Автоматический подсчёт суммы за урок и за всё время
- Отчёты за неделю / месяц / произвольный период
- Экспорт отчёта в CSV (открывается в Excel) и печать
- 5 тем оформления: светлая, тёмная, синяя, зелёная, тёплая
- Полная адаптивность — работает на телефоне и планшете

---

## 🧱 Стек технологий

- **Фронтенд**: чистый HTML + CSS + JavaScript (ES-модули, без фреймворков и сборщиков)
- **Бэкенд / БД / Auth**: Supabase (PostgreSQL + Auth + Row Level Security)
- **Хостинг**: GitHub Pages (статика)

---

## 📁 Структура проекта

```
/
├── index.html
├── README.md
├── styles/
│   ├── main.css       — основные стили
│   ├── themes.css     — 5 тем через CSS-переменные
│   └── print.css      — стили для печати
└── scripts/
    ├── config.js      — URL и anon key Supabase (заполнить своими)
    ├── supabase.js    — инициализация клиента Supabase
    ├── auth.js        — регистрация, вход, выход, сброс пароля
    ├── schools.js     — CRUD школ
    ├── classes.js     — CRUD классов
    ├── students.js    — CRUD учеников
    ├── lessons.js     — уроки и отметки посещаемости
    ├── reports.js     — отчёты, CSV, печать
    ├── settings.js    — цена, темы, смена пароля
    ├── ui.js          — toast, модалки, helpers
    └── app.js         — роутинг и все экраны
```

---

## 🚀 Развёртывание с нуля

### Шаг 1. Создайте проект в Supabase

1. Зарегистрируйтесь на [supabase.com](https://supabase.com).
2. Создайте организацию (тип **Personal** — бесплатно).
3. Создайте проект:
   - **Name**: например, `attendance-journal`
   - **Database Password**: сгенерируйте и сохраните
   - **Region**: ближайший к вам
   - **Pricing Plan**: **Free**
4. Подождите 1–2 минуты, пока проект инициализируется.

### Шаг 2. Создайте таблицы

Откройте **SQL Editor** → **New query**, вставьте скрипт ниже **целиком** и нажмите **Run**.

```sql
-- ============================================================
-- 1. ТАБЛИЦА schools (школы)
-- ============================================================
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.schools enable row level security;
alter table public.schools force row level security;

create policy "Users manage own schools"
  on public.schools for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================
-- 2. ТАБЛИЦА classes (классы)
-- ============================================================
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;
alter table public.classes force row level security;

create policy "Users manage own classes"
  on public.classes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_classes_school_id on public.classes(school_id);
create index idx_classes_user_id on public.classes(user_id);


-- ============================================================
-- 3. ТАБЛИЦА students (ученики)
-- ============================================================
create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  parent_name text,
  parent_phone text,
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;
alter table public.students force row level security;

create policy "Users manage own students"
  on public.students for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_students_class_id on public.students(class_id);
create index idx_students_user_id on public.students(user_id);


-- ============================================================
-- 4. ТАБЛИЦА lessons (уроки — один в день на класс)
-- ============================================================
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (class_id, date)
);

alter table public.lessons enable row level security;
alter table public.lessons force row level security;

create policy "Users manage own lessons"
  on public.lessons for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_lessons_class_id on public.lessons(class_id);
create index idx_lessons_user_id on public.lessons(user_id);
create index idx_lessons_date on public.lessons(date);


-- ============================================================
-- 5. ТАБЛИЦА attendance (отметки посещаемости)
-- ============================================================
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  present boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lesson_id, student_id)
);

alter table public.attendance enable row level security;
alter table public.attendance force row level security;

create policy "Users manage own attendance"
  on public.attendance for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_attendance_lesson_id on public.attendance(lesson_id);
create index idx_attendance_student_id on public.attendance(student_id);
create index idx_attendance_user_id on public.attendance(user_id);


-- ============================================================
-- 6. ТАБЛИЦА settings (настройки учителя)
-- ============================================================
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  price_per_student numeric not null default 0,
  theme text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
alter table public.settings force row level security;

create policy "Users manage own settings"
  on public.settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================
-- 7. АВТОСОЗДАНИЕ settings при регистрации
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.settings (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
```

После выполнения проверьте: **Table Editor** должен показать 6 таблиц
(`schools`, `classes`, `students`, `lessons`, `attendance`, `settings`).

### Шаг 3. Отключите подтверждение email

**Authentication → Sign In / Providers → Email → Confirm email → Off → Save**

Без этого шага зарегистрированный учитель не сможет войти, пока не подтвердит email.
На бесплатном тарифе Supabase без собственного SMTP действует лимит ~3–4 письма в час.

### Шаг 4. Получите ключи доступа

**Project Settings → API**:

- **Project URL** — например, `https://xxxx.supabase.co`
- **anon public key** — длинная строка, начинается с `eyJ...`

⚠️ **Не используйте `service_role` key** — он даёт полный доступ к БД
и **никогда не должен попадать в браузерный код или на GitHub**.

### Шаг 5. Вставьте ключи в `scripts/config.js`

```js
export const SUPABASE_URL = "https://ВАШ-ПРОЕКТ.supabase.co";
export const SUPABASE_ANON_KEY = "ваш-anon-key";
```

---

## 💻 Локальный запуск

Из-за ES-модулей и CORS просто открыть `index.html` файлом (`file://`)
не получится. Нужен локальный HTTP-сервер.

**Python 3** (обычно уже установлен на Mac/Linux, на Windows — [скачать](https://www.python.org/downloads/)):

```bash
cd путь/к/проекту
python -m http.server 8000
```

**Node.js** (если установлен):

```bash
npx serve
```

Откройте в браузере: **http://localhost:8000**

---

## 🌐 Развёртывание на GitHub Pages

### 1. Создайте репозиторий на GitHub

Например, `attendance-journal`. **Public** (для бесплатного GitHub Pages).

### 2. Загрузите файлы

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/attendance-journal.git
git push -u origin main
```

### 3. Включите GitHub Pages

- Откройте репозиторий на GitHub
- **Settings** → **Pages**
- **Source**: `Deploy from a branch`
- **Branch**: `main`, папка `/ (root)`
- **Save**

### 4. Откройте сайт

Через 1–2 минуты сайт будет доступен:

```
https://ВАШ_ЛОГИН.github.io/attendance-journal/
```

---

## 🔐 Безопасность

- **anon key** — публичный ключ, его безопасно держать в открытом коде.
  Доступ к данным контролируется RLS-политиками на стороне Supabase.
- **service_role key** — секретный, даёт полный доступ ко всей БД в обход RLS.
  **Никогда** не вставляйте его в код фронтенда и не коммитьте в Git.
- Все таблицы защищены политикой `user_id = auth.uid()`:
  учитель A физически не может прочитать или изменить данные учителя B —
  даже если вручную отправит запрос через DevTools.

---

## 📖 Как пользоваться

1. Зарегистрируйтесь (email + пароль).
2. На главном экране нажмите **«+ Добавить школу»** — создайте 2 школы.
3. Внутри школы — **«+ Добавить класс»** (например, «5А»).
4. Внутри класса — **«+ Ученик»**: имя, фамилия, при желании ФИО и телефон родителя.
5. Откройте **«Журнал»** класса:
   - Нажмите **«+ Добавить урок»** → выберите дату.
   - Появится новый столбец. Клик по ячейке переключает состояние:
     пусто → зелёный (✓ присутствует) → красный (✕ отсутствует) → пусто.
   - Нажмите **«Сохранить»** под столбцом.
   - Внизу столбца автоматически считается: количество присутствующих и сумма за урок.
6. **Настройки** (⚙️ в шапке) — задайте цену за одного присутствующего ученика.
7. **Отчёты** (📊 в шапке) — выберите школу, класс, период → **«Построить отчёт»**.
   Доступны экспорт в CSV и печать.
8. **Тема** (🎨 в шапке) — переключение между 5 темами; нажмите несколько раз, чтобы пролистать.

---

## 🛠 Возможные проблемы

**«Failed to fetch» при регистрации**

- Проверьте, что `SUPABASE_URL` и `SUPABASE_ANON_KEY` в `scripts/config.js` правильные.
- Откройте DevTools → Network — там будет видна реальная ошибка.

**«Email not confirmed»**

- Значит, вы не отключили подтверждение email в Supabase. См. Шаг 3.
- Либо подтвердите пользователя вручную через SQL:
  ```sql
  update auth.users
  set email_confirmed_at = now()
  where email_confirmed_at is null;
  ```

**Пустая страница / ошибки в консоли**

- Скорее всего, открыли `index.html` через `file://`.
  Запустите локальный HTTP-сервер (см. «Локальный запуск»).

**На GitHub Pages ничего не отображается**

- Проверьте Settings → Pages: должна быть ветка `main`, папка `/ (root)`.
- Проверьте, что `index.html` лежит в корне репозитория.
- Подождите 2–3 минуты после пуша — Pages деплоится не мгновенно.

---

## 📄 Лицензия

Свободное использование в личных и образовательных целях.
