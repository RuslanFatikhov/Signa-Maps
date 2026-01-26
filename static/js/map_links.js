const GeoMapLinks = (() => {
  const toNumber = (value) => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const formatCoord = (value) => value.toFixed(6);

  const buildYandexUrl = ({ lat, lon, name } = {}) => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    const safeName = (name || "").trim();

    if (latNum != null && lonNum != null) {
      const latStr = formatCoord(latNum);
      const lonStr = formatCoord(lonNum);
      const ll = `${lonStr},${latStr}`;
      const text = `${latStr} ${lonStr}`;
      return `https://maps.yandex.ru/?ll=${ll}&text=${encodeURIComponent(text)}&z=17`;
    }

    if (safeName) {
      return `https://maps.yandex.ru/?text=${encodeURIComponent(safeName)}`;
    }

    return "";
  };

  const buildOrganicMapsUrl = ({ lat, lon, name } = {}) => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    if (latNum == null || lonNum == null) return "";

    const latStr = formatCoord(latNum);
    const lonStr = formatCoord(lonNum);
    const safeName = (name || "").trim();
    const label = safeName ? `&n=${encodeURIComponent(safeName)}` : "";
    return `https://omaps.app/map?v=1&ll=${latStr},${lonStr}${label}`;
  };

  return { buildYandexUrl, buildOrganicMapsUrl };
})();

if (typeof window !== "undefined") {
  window.GeoMapLinks = GeoMapLinks;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = GeoMapLinks;
}
