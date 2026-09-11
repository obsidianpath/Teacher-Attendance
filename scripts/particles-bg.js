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

  container.classList.remove("hidden");
  document.body.classList.add("has-particles");

  // Если библиотека не загрузилась — тихо выходим (фон просто будет однотонным)
  if (typeof window.particlesJS !== "function") return;

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
      size: {
        value: 3,
        random: true,
        anim: { enable: false },
      },
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
