// ============================================================
// Фон с частицами для страниц авторизации (particles.js)
// ============================================================

let particlesReady = false;

// ---------- Получить цвет из CSS-переменной темы ----------
function getAccent() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue("--accent").trim() || "#2563eb";
}

// ---------- Показать фон ----------
export function showParticles() {
  const container = document.getElementById("particles-bg");
  if (!container) return;

  // 1. Снять hidden ДО инициализации
  container.classList.remove("hidden");
  document.body.classList.add("has-particles");

  // 2. Дождаться, пока браузер рассчитает размеры контейнера
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;

      // 3. Если размеры нулевые — принудительно задать (страховка)
      if (w === 0 || h === 0) {
        container.style.position = "fixed";
        container.style.top = "0";
        container.style.left = "0";
        container.style.right = "0";
        container.style.bottom = "0";
        container.style.width = "100vw";
        container.style.height = "100vh";
      }

      // 4. Ждём загрузку библиотеки (до 3 секунд)
      const start = Date.now();
      const tryInit = () => {
        if (typeof window.particlesJS === "function") {
          initParticles();
        } else if (Date.now() - start < 3000) {
          setTimeout(tryInit, 100);
        } else {
          console.warn("particles.js не загрузился");
        }
      };
      tryInit();
    });
  });
}

function initParticles() {
  const accent = getAccent();
  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  window.particlesJS("particles-bg", {
    particles: {
      number: {
        value: isMobile ? 25 : 60,
        density: { enable: true, value_area: 800 },
      },
      color: { value: accent },
      shape: { type: "circle" },
      opacity: {
        value: 0.5,
        random: true,
        anim: { enable: true, speed: 1, opacity_min: 0.1 },
      },
      size: { value: 3, random: true, anim: { enable: false } },
      line_linked: {
        enable: true,
        distance: 140,
        color: accent,
        opacity: 0.25,
        width: 1,
      },
      move: {
        enable: true,
        speed: 1.5,
        direction: "none",
        random: false,
        straight: false,
        out_mode: "out",
        bounce: false,
      },
    },
    interactivity: {
      detect_on: "canvas",
      events: {
        onhover: { enable: !isMobile, mode: "grab" },
        onclick: { enable: true, mode: "push" },
        resize: true,
      },
      modes: {
        grab: { distance: 140, line_linked: { opacity: 0.5 } },
        push: { particles_nb: 3 },
      },
    },
    retina_detect: true,
  });

  particlesReady = true;

  // 5. Финальный пинок: через мгновение после инициализации
  //    принудительно обновляем размер canvas
  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
  }, 100);
}

// ---------- Скрыть фон ----------
export function hideParticles() {
  const container = document.getElementById("particles-bg");
  if (!container) return;
  container.classList.add("hidden");
  container.innerHTML = "";
  document.body.classList.remove("has-particles");
  particlesReady = false;
}

// ---------- Обновить цвет частиц при смене темы ----------
export function refreshParticlesColor() {
  if (!particlesReady) return;
  // Перезапускаем: скрыть + показать
  hideParticles();
  showParticles();
}
