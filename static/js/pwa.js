(() => {
  const APP_VERSION = "1.4.1";
  const VERSION_KEY = "geo:pwa-app-version";
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const hintEl = document.getElementById("offlineHint");
  const viewMapEl = document.getElementById("viewMap");
  const updateBanner = document.getElementById("updateBanner");
  const updateRefreshBtn = document.getElementById("updateBannerRefresh");
  let waitingWorker = null;
  let refreshTriggered = false;
  const savedVersion = localStorage.getItem(VERSION_KEY) || "";
  const versionChanged = savedVersion !== APP_VERSION;

  const setConnectionStatus = () => {
    const online = navigator.onLine;
    if (hintEl) hintEl.hidden = online;
    if (viewMapEl) viewMapEl.classList.toggle("view-map--offline", !online);
  };

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

  setConnectionStatus();
  window.addEventListener("online", setConnectionStatus);
  window.addEventListener("offline", setConnectionStatus);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(`/static/sw.js?v=${encodeURIComponent(APP_VERSION)}`, { scope: "/" })
        .then((reg) => {
          if (!reg) return;
          reg.update().catch(() => {});
          if (reg.waiting) {
            waitingWorker = reg.waiting;
            if (versionChanged) {
              refreshTriggered = true;
              waitingWorker.postMessage({ type: "SKIP_WAITING" });
            } else if (updateBanner) {
              updateBanner.hidden = false;
            }
          }
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                waitingWorker = newWorker;
                if (versionChanged) {
                  refreshTriggered = true;
                  waitingWorker.postMessage({ type: "SKIP_WAITING" });
                } else if (updateBanner) {
                  updateBanner.hidden = false;
                }
              }
            });
          });
        })
        .catch((error) => {
          console.warn("Service worker registration failed:", error);
        });
    });
  }

  updateRefreshBtn?.addEventListener("click", () => {
    if (!waitingWorker) return;
    refreshTriggered = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  });

  navigator.serviceWorker?.addEventListener?.("controllerchange", () => {
    if (!refreshTriggered) return;
    refreshTriggered = false;
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    window.location.reload();
  });

  if (!versionChanged) {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  }
})();
