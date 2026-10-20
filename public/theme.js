// Read the saved preference before CSS paints, so dark mode does not flash white.
(() => {
  let theme = "light";
  try { if (localStorage.getItem("micro-theme") === "dark") theme = "dark"; } catch {}
  document.documentElement.dataset.theme = theme;
  const color = document.querySelector('meta[name="theme-color"]');
  if (color) color.content = theme === "dark" ? "#111c18" : "#174f41";
})();
