const GeoView = (() => {
  const sheet = document.getElementById("viewSheet");
  const backdrop = document.getElementById("viewSheetBackdrop");
  const closeBtn = document.getElementById("viewSheetClose");
  const titleEl = document.getElementById("viewTitle");
  const mapLabelEl = document.getElementById("viewMapLabel");
  const addressEl = document.getElementById("viewAddress");
  const coordsEl = document.getElementById("viewCoords");
  const noteEl = document.getElementById("viewNote");
  const photosEl = document.getElementById("viewPhotos");
  const detailsSectionEl = document.getElementById("viewDetailsSection");
  const detailsBodyEl = document.getElementById("viewDetailsBody");
  const detailsRowTemplate = document.getElementById("viewDetailsRowTemplate");
  const editBtn = document.getElementById("viewEditBtn");
  const shareBtn = document.getElementById("viewShareBtn");
  const openBtn = document.getElementById("viewOpenBtn");
  const viewMapEl = document.getElementById("viewMap");
  const listsPanel = document.getElementById("listsPanel");
  const listsPanelClose = document.getElementById("listsPanelClose");
  const listsBackdrop = document.getElementById("listsBackdrop");
  const listToggleButtons = document.querySelectorAll("[data-lists-toggle]");

  const openMapSheet = document.getElementById("openMapSheet");
  const openMapSheetBackdrop = document.getElementById("openMapSheetBackdrop");
  const openMapSheetClose = document.getElementById("openMapSheetClose");
  const serviceButtons = document.querySelectorAll("[data-map-service]");
  const mapStyleUrl = window.MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12";

  let currentPlace = null;
  let readOnly = false;
  let handlers = { onEdit: null, onShare: null };
  let viewMap = null;
  let viewMarker = null;

  const ensureMapboxToken = () => {
    if (typeof mapboxgl === "undefined") return;
    if (window.MAPBOX_ACCESS_TOKEN) {
      mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
    }
  };

  const close = () => {
    if (sheet) {
      sheet.classList.remove("is-open");
      sheet.setAttribute("aria-hidden", "true");
    }
    if (backdrop) {
      backdrop.classList.remove("is-open");
      backdrop.setAttribute("aria-hidden", "true");
    }
  };

  const openListsPanel = () => {
    document.body.classList.add("lists-open");
    listsPanel?.setAttribute("aria-hidden", "false");
    listsBackdrop?.setAttribute("aria-hidden", "false");
  };

  const closeListsPanel = () => {
    document.body.classList.remove("lists-open");
    listsPanel?.setAttribute("aria-hidden", "true");
    listsBackdrop?.setAttribute("aria-hidden", "true");
  };

  const closeOpenMapSheet = () => {
    if (openMapSheet) {
      openMapSheet.classList.remove("is-open");
      openMapSheet.setAttribute("aria-hidden", "true");
    }
    if (openMapSheetBackdrop) {
      openMapSheetBackdrop.classList.remove("is-open");
      openMapSheetBackdrop.setAttribute("aria-hidden", "true");
    }
  };

  const renderPhotos = (photos = []) => {
    if (!photosEl) return;
    photosEl.innerHTML = "";
    if (!photos.length) return;
    photos.forEach((photo) => {
      const img = document.createElement("img");
      img.src = photo.dataUrl;
      img.alt = photo.name || "Фото точки";
      photosEl.appendChild(img);
    });
  };

  const formatCoords = (place) => {
    if (!place) return "";
    return `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
  };

  const getMapName = (place) => {
    if (!place) return "";
    const address = place.address || "";
    if (!address) return formatCoords(place);
    const [first] = address.split(",");
    return (first || address).trim();
  };

  const formatAddress = (place) => {
    if (!place) return "";
    const osmAddress = place.osm?.address;
    if (!osmAddress) return place.address || formatCoords(place);

    const street =
      osmAddress.road ||
      osmAddress.street ||
      osmAddress.residential ||
      osmAddress.pedestrian ||
      osmAddress.path ||
      osmAddress.highway ||
      "";

    const parts = [];
    if (street) parts.push(street);
    if (osmAddress.house_number) parts.push(osmAddress.house_number);
    if (osmAddress.city) parts.push(osmAddress.city);
    if (osmAddress.postcode) parts.push(osmAddress.postcode);

    const formatted = parts.join(", ").trim();
    return formatted || place.address || formatCoords(place);
  };

  const extractDetails = (place) => {
    if (!place?.osm) return [];
    const list = [];
    const address = place.osm.address || {};
    if (address.city) list.push(["addr:city", address.city]);
    if (address.house_number) list.push(["addr:housenumber", address.house_number]);
    if (address.postcode) list.push(["addr:postcode", address.postcode]);
    const street =
      address.road ||
      address.street ||
      address.residential ||
      address.pedestrian ||
      address.path ||
      address.highway ||
      null;
    if (street) list.push(["addr:street", street]);

    const extras = place.osm.extratags || {};
    Object.entries(extras).forEach(([key, value]) => {
      const val = value == null ? "" : String(value).trim();
      if (!val) return;
      list.push([key, val]);
    });
    return list;
  };

  const createDetailRow = () => {
    if (detailsRowTemplate?.content?.firstElementChild) {
      const clone = detailsRowTemplate.content.firstElementChild.cloneNode(true);
      return clone;
    }
    const tr = document.createElement("tr");
    tr.className = "info-table__row";
    const th = document.createElement("th");
    th.className = "info-table__key";
    th.scope = "row";
    const td = document.createElement("td");
    td.className = "info-table__value";
    tr.append(th, td);
    return tr;
  };

  const buildServiceUrl = (service, place) => {
    if (!place) return "";
    const { lat, lng } = place;
    const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const title = place.title || "Метка";
    switch (service) {
      case "2gis":
        return `https://2gis.com/?query=${encodeURIComponent(coords)}%20${encodeURIComponent(title)}`;
      case "apple":
        return `https://maps.apple.com/?ll=${coords}&q=${encodeURIComponent(title)}`;
      case "google":
        return `https://www.google.com/maps/search/?api=1&query=${coords}`;
      case "yandex": {
        const ll = `${lng.toFixed(6)},${lat.toFixed(6)}`;
        return `https://yandex.ru/maps/?pt=${ll}&z=16&text=${encodeURIComponent(title)}`;
      }
      default:
        return "";
    }
  };

  const sharePlace = async () => {
    if (!currentPlace) return;
    const coords = formatCoords(currentPlace);
    const address = currentPlace.address ? `, ${currentPlace.address}` : "";
    const shareText = `${currentPlace.title || "Метка"} — ${coords}${address}`;
    const url = buildServiceUrl("google", currentPlace);

    if (handlers.onShare) {
      handlers.onShare(currentPlace);
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: currentPlace.title || "Метка", text: shareText, url });
        return;
      } catch (err) {
        console.warn("Native share failed", err);
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      GeoToast?.show?.({
        title: "Link copied",
      });
    } catch (err) {
      console.warn("Clipboard error", err);
      prompt("Скопируйте ссылку на метку:", url);
    }
  };

  const openService = (service) => {
    if (!currentPlace) return;
    const url = buildServiceUrl(service, currentPlace);
    if (url) {
      window.open(url, "_blank", "noopener");
    }
    closeOpenMapSheet();
    close();
  };

  const openMapServices = () => {
    if (!openMapSheet || !openMapSheetBackdrop) return;
    openMapSheet.classList.add("is-open");
    openMapSheet.setAttribute("aria-hidden", "false");
    openMapSheetBackdrop.classList.add("is-open");
    openMapSheetBackdrop.setAttribute("aria-hidden", "false");
  };

  const handleEdit = () => {
    if (!currentPlace || readOnly) return;
    if (handlers.onEdit) {
      handlers.onEdit(currentPlace);
      close();
    }
  };

  const ensureViewMap = () => {
    if (!viewMapEl || viewMap) return;
    if (typeof mapboxgl === "undefined") {
      viewMapEl.textContent = "Карта недоступна";
      return;
    }
    try {
      ensureMapboxToken();
      viewMap = new mapboxgl.Map({
        container: viewMapEl,
        style: mapStyleUrl,
        center: [0, 0],
        zoom: 1,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: false,
      });
      if (viewMap.scrollZoom) viewMap.scrollZoom.disable();
      if (viewMap.boxZoom) viewMap.boxZoom.disable();
      if (viewMap.dragPan) viewMap.dragPan.disable();
      if (viewMap.touchZoomRotate) viewMap.touchZoomRotate.disable();
      if (viewMap.doubleClickZoom) viewMap.doubleClickZoom.disable();
    } catch (err) {
      console.warn("View map init failed", err);
      viewMap = null;
    }
  };

  const setViewMarker = (lat, lng) => {
    ensureViewMap();
    if (!viewMap) {
      if (viewMapEl) viewMapEl.textContent = formatCoords({ lat, lng });
      return;
    }
    const target = [lng, lat];

    const placeMarker = () => {
      if (viewMarker) {
        viewMarker.setLngLat(target);
      } else {
        viewMarker = new mapboxgl.Marker({ color: "#121212" }).setLngLat(target).addTo(viewMap);
      }
      viewMap.jumpTo({ center: target, zoom: 14 });
    };

    if (viewMap.isStyleLoaded()) {
      placeMarker();
    } else {
      viewMap.once("load", placeMarker);
    }
  };

  const open = (place) => {
    if (!place) return;
    currentPlace = place;

    if (titleEl) titleEl.textContent = place.title || "Без названия";
    const mapName = getMapName(place);
    if (mapLabelEl) mapLabelEl.textContent = mapName;
    if (addressEl) addressEl.textContent = formatAddress(place);
    if (coordsEl) coordsEl.textContent = formatCoords(place);
    if (noteEl) noteEl.textContent = place.note || "";
    if (detailsBodyEl && detailsSectionEl) {
      detailsBodyEl.innerHTML = "";
      const details = extractDetails(place);
      detailsSectionEl.style.display = details.length ? "" : "none";
      details.forEach(([key, value]) => {
        const row = createDetailRow();
        const keyEl = row.querySelector(".info-table__key") || row.querySelector("th");
        const valueEl = row.querySelector(".info-table__value") || row.querySelector("td");
        if (keyEl) keyEl.textContent = key;
        if (valueEl) valueEl.textContent = value;
        detailsBodyEl.appendChild(row);
      });
    }
    renderPhotos(place.photos || []);
    setViewMarker(place.lat, place.lng);

    if (sheet) {
      sheet.classList.add("is-open");
      sheet.setAttribute("aria-hidden", "false");
    }
    if (backdrop) {
      backdrop.classList.add("is-open");
      backdrop.setAttribute("aria-hidden", "false");
    }
    if (viewMap) {
      setTimeout(() => viewMap.resize(), 150);
    }
  };

  const configure = ({ onEdit, onShare, readOnlyMode } = {}) => {
    handlers = {
      ...handlers,
      ...(onEdit ? { onEdit } : {}),
      ...(onShare ? { onShare } : {}),
    };
    readOnly = Boolean(readOnlyMode);
    if (editBtn) {
      editBtn.style.display = "";
      editBtn.disabled = false;
    }
  };

  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  listsPanelClose?.addEventListener("click", closeListsPanel);
  listsBackdrop?.addEventListener("click", closeListsPanel);
  openMapSheetClose?.addEventListener("click", closeOpenMapSheet);
  openMapSheetBackdrop?.addEventListener("click", closeOpenMapSheet);

  shareBtn?.addEventListener("click", sharePlace);
  openBtn?.addEventListener("click", openMapServices);
  editBtn?.addEventListener("click", handleEdit);

  listToggleButtons.forEach((btn) => {
    btn.addEventListener("click", openListsPanel);
  });

  serviceButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const service = btn.dataset.mapService;
      openService(service);
    });
  });

  return { open, close, configure };
})();
