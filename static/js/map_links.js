const GeoMapLinks = (() => {
  const toNumber = (value) => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const formatCoord = (value) => {
    const num = toNumber(value);
    if (num == null) return "";
    return num.toString();
  };

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

  const buildOrganicMapsUrl = ({ lat, lon, name, scheme = "https", versioned = true } = {}) => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    if (latNum == null || lonNum == null) return "";

    const latStr = formatCoord(latNum);
    const lonStr = formatCoord(lonNum);
    const safeName = (name || "").trim();
    const label = safeName ? `&n=${encodeURIComponent(safeName)}` : "";
    const version = versioned ? "v=1&" : "";
    if (scheme === "om") {
      return `om://map?${version}ll=${latStr},${lonStr}${label}`;
    }
    return `https://omaps.app/map?${version}ll=${latStr},${lonStr}${label}`;
  };

  const buildOrganicMapsLinks = ({ lat, lon, name } = {}) => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    if (latNum == null || lonNum == null) {
      return { geoUrl: "", appUrl: "", appUrlLegacy: "", webUrl: "", webUrlLegacy: "" };
    }
    const latStr = formatCoord(latNum);
    const lonStr = formatCoord(lonNum);
    const safeName = (name || "").trim();
    const label = safeName ? `&n=${encodeURIComponent(safeName)}` : "";
    const geoUrl = safeName
      ? `geo:${latStr},${lonStr}?q=${latStr},${lonStr}(${encodeURIComponent(safeName)})`
      : `geo:${latStr},${lonStr}`;
    return {
      geoUrl,
      appUrl: `om://map?ll=${latStr},${lonStr}${label}`,
      appUrlLegacy: `om://map?v=1&ll=${latStr},${lonStr}${label}`,
      webUrl: `https://omaps.app/map?ll=${latStr},${lonStr}${label}`,
      webUrlLegacy: `https://omaps.app/map?v=1&ll=${latStr},${lonStr}${label}`,
      appUrlLonLat: `om://map?ll=${lonStr},${latStr}${label}`,
      webUrlLonLat: `https://omaps.app/map?ll=${lonStr},${latStr}${label}`,
      webUrlQuery: `https://omaps.app/map?q=${latStr},${lonStr}${label}`,
      webUrlHash: `https://omaps.app/map?ll=${latStr},${lonStr}${label}#map=17/${latStr}/${lonStr}`,
    };
  };

  const buildOpenStreetMapUrl = ({ lat, lon } = {}) => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    if (latNum == null || lonNum == null) return "";
    const latStr = formatCoord(latNum);
    const lonStr = formatCoord(lonNum);
    return `https://www.openstreetmap.org/?mlat=${latStr}&mlon=${lonStr}#map=17/${latStr}/${lonStr}`;
  };

  const buildGeoUrl = ({ lat, lon, name } = {}) => {
    const latNum = toNumber(lat);
    const lonNum = toNumber(lon);
    if (latNum == null || lonNum == null) return "";
    const latStr = formatCoord(latNum);
    const lonStr = formatCoord(lonNum);
    const safeName = (name || "").trim();
    if (safeName) {
      return `geo:${latStr},${lonStr}?q=${latStr},${lonStr}(${encodeURIComponent(safeName)})`;
    }
    return `geo:${latStr},${lonStr}`;
  };

  return {
    buildYandexUrl,
    buildOrganicMapsUrl,
    buildOrganicMapsLinks,
    buildOpenStreetMapUrl,
    buildGeoUrl,
  };
})();

if (typeof window !== "undefined") {
  window.GeoMapLinks = GeoMapLinks;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = GeoMapLinks;
}
