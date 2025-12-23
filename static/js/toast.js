const GeoToast = (() => {
  const toast = document.getElementById("shareToast");
  const closeBtn = document.getElementById("shareToastClose");
  const titleEl = document.getElementById("shareToastTitle");
  const descEl = document.getElementById("shareToastDesc");
  let timer = null;

  const hide = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    toast?.classList.remove("is-visible");
  };

  const show = ({ title, desc, ttl = 4200 } = {}) => {
    if (!toast) return;
    if (titleEl && title) titleEl.textContent = title;
    if (descEl && desc) descEl.textContent = desc;
    toast.classList.add("is-visible");
    if (timer) clearTimeout(timer);
    if (ttl > 0) timer = setTimeout(hide, ttl);
  };

  closeBtn?.addEventListener("click", hide);

  return { show, hide };
})();
