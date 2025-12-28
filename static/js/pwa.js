(() => {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    const ensureKeyboard = (event) => {
      const target = event.target?.closest?.("input, textarea, [contenteditable='true']");
      if (!target || target.disabled || target.readOnly) return;
      if (document.activeElement === target) return;
      target.focus();
    };

    document.addEventListener("touchend", ensureKeyboard, { passive: true });
    document.addEventListener("click", ensureKeyboard);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/static/sw.js", { scope: "/" })
        .catch((error) => {
          console.warn("Service worker registration failed:", error);
        });
    });
  }
})();
