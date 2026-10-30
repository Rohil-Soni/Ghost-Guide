export function initLoader() {
  const el = document.getElementById('loader');
  const pct = document.getElementById('loader-pct');
  const fill = document.getElementById('loader-fill');
  return {
    progress(p) {
      const v = Math.round(Math.min(1, p) * 100);
      pct.textContent = `${v}%`;
      fill.style.width = `${v}%`;
    },
    done() {
      this.progress(1);
      el.classList.add('is-done');
      setTimeout(() => el.remove(), 700);
    },
  };
}
