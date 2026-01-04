const GeoQr = (() => {
  const buildUrl = (text = "", size = 120) => {
    const safeSize = Math.max(80, Math.min(size, 512));
    const data = encodeURIComponent(text);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${safeSize}x${safeSize}&data=${data}`;
  };

  const render = (container, text, size = 120) => {
    if (!container || !text) return;
    container.innerHTML = "";
    const img = new Image();
    img.className = "qr-image";
    img.alt = "QR code";
    img.onerror = () => {
      container.innerHTML = '<div class="empty_state_search"><p>QR недоступен офлайн.</p></div>';
    };
    img.src = buildUrl(text, size);
    container.appendChild(img);
  };

  return { render };
})();
