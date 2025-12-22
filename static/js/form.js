const GeoForm = (() => {
  const form = document.getElementById("placeForm");
  const latInput = document.getElementById("placeLat");
  const lngInput = document.getElementById("placeLng");
  const titleInput = document.getElementById("placeTitle");
  const noteInput = document.getElementById("placeNote");
  const pickedLocation = document.getElementById("pickedLocation");
  const pickedCoords = document.getElementById("pickedCoords");
  const formError = document.getElementById("formError");
  const photosInput = document.getElementById("photosInput");
  const photoPreview = document.getElementById("photoPreview");
  const sheetTitle = document.getElementById("placeSheetTitle");
  const sheet = document.getElementById("addSheet");
  const backdrop = document.getElementById("addSheetBackdrop");
  const sheetClose = document.getElementById("sheetClose");
  const searchTrigger = document.getElementById("searchTrigger");
  const addBtn = document.getElementById("add-btn");
  const sheetMapEl = document.getElementById("sheetMap");
  const sheetMapWrap = document.getElementById("sheetMapWrap");
  const sheetMapFullToggle = document.getElementById("sheetMapFullToggle");
  const sheetMyLocation = document.getElementById("sheetMyLocation");
  const searchSheet = document.getElementById("searchSheet");
  const searchSheetBackdrop = document.getElementById("searchSheetBackdrop");
  const searchSheetClose = document.getElementById("searchSheetClose");
  const searchSheetInput = document.getElementById("searchSheetInput");
  const searchSheetList = document.getElementById("searchSheetList");
  const mapStyleUrl = window.MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12";

  const ensureMapboxToken = () => {
    if (typeof mapboxgl === "undefined") return;
    if (window.MAPBOX_ACCESS_TOKEN) {
      mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
    }
  };

  let onSubmitCb;
  let titleDirty = false;
  let lastSuggestedTitle = "";
  let searchTimer;
  let sheetMap;
  let sheetMarker;
  let sheetMapFullscreen = false;
  let lastSearchItems = [];
  let editContext = null;
  let lastPlaceDetails = null;
  const defaultPickedLabel = "Нажмите на карту или найдите место в поиске.";
  const defaultCoordsLabel = "Координаты появятся после выбора точки.";

  const allowedTypes = ["image/jpeg", "image/png"];
  const MAX_PHOTOS = 10;
  const MAX_SIZE_BYTES = 2 * 1024 * 1024;

  const normalizeOsmDetails = (data) => {
    if (!data) return null;
    return {
      displayName: data.display_name || "",
      address: data.address || null,
      extratags: data.extratags || null,
      namedetails: data.namedetails || null,
      category: data.category || data.type || null,
    };
  };

  const setPickedLabel = (text) => {
    if (pickedLocation) pickedLocation.textContent = text || defaultPickedLabel;
  };

  const setPickedCoords = (lat, lng) => {
    if (!pickedCoords) return;
    if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      pickedCoords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      return;
    }
    pickedCoords.textContent = defaultCoordsLabel;
  };

  const clearError = () => {
    if (formError) formError.textContent = "";
  };

  const setSheetTitle = (text) => {
    if (sheetTitle) sheetTitle.textContent = text || "";
  };

  const showError = (text) => {
    if (formError) formError.textContent = text;
  };

  const openSheet = () => {
    ensureSheetMap();
    setSheetTitle(editContext ? "Edit place" : "New place");
    if (sheet) {
      sheet.classList.add("is-open");
      sheet.setAttribute("aria-hidden", "false");
    }
    if (backdrop) {
      backdrop.classList.add("is-open");
      backdrop.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("sheet-open");
    setTimeout(() => {
      if (sheetMap) sheetMap.resize();
    }, 150);
  };

  const renderPhotosPreview = (files = []) => {
    if (!photoPreview) return;
    photoPreview.innerHTML = "";
    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "photo-preview__item";
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      item.textContent = `${file.name} (${sizeMb} МБ)`;
      photoPreview.appendChild(item);
    });
  };

  const clearForm = () => {
    form?.reset();
    lastSuggestedTitle = "";
    titleDirty = false;
    renderPhotosPreview([]);
    setPickedLabel(defaultPickedLabel);
    setPickedCoords();
    clearError();
    setSheetTitle("New place");
    editContext = null;
    lastPlaceDetails = null;
  };

  const closeSheet = () => {
    setSheetFullscreen(false);
    if (sheet) {
      sheet.classList.remove("is-open");
      sheet.setAttribute("aria-hidden", "true");
    }
    if (backdrop) {
      backdrop.classList.remove("is-open");
      backdrop.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("sheet-open");
    clearForm();
  };

  const fillCoordinates = (lat, lng) => {
    if (!latInput || !lngInput) return;
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
      setPickedCoords();
      return;
    }
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    setPickedCoords(lat, lng);
  };

  const ensureSheetMap = () => {
    if (!sheetMapEl || sheetMap || typeof mapboxgl === "undefined") return;
    try {
      ensureMapboxToken();
      sheetMap = new mapboxgl.Map({
        container: sheetMapEl,
        style: mapStyleUrl,
        center: [0, 0],
        zoom: 1,
      });
      sheetMap.on("click", (e) => {
        handleMapPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
    } catch (err) {
      console.warn("Sheet map init failed", err);
    }
  };

  const setSheetMarker = (lat, lng) => {
    ensureSheetMap();
    if (!sheetMap) return;
    if (sheetMarker) {
      sheetMarker.setLngLat([lng, lat]);
    } else {
      sheetMarker = new mapboxgl.Marker({ color: "#121212" }).setLngLat([lng, lat]).addTo(sheetMap);
    }
    sheetMap.flyTo({ center: [lng, lat], zoom: Math.max(sheetMap.getZoom(), 12) });
  };

  const setSheetFullscreen = (flag) => {
    sheetMapFullscreen = Boolean(flag);
    if (!sheetMapEl) return;
    if (sheetMapFullscreen) {
      sheetMapEl.classList.add("is-fullscreen");
      document.body.classList.add("sheet-map-fullscreen");
      if (sheetMapWrap) sheetMapWrap.classList.add("is-fullscreen");
    } else {
      sheetMapEl.classList.remove("is-fullscreen");
      document.body.classList.remove("sheet-map-fullscreen");
      if (sheetMapWrap) sheetMapWrap.classList.remove("is-fullscreen");
    }
    setTimeout(() => {
      if (sheetMap) sheetMap.resize();
    }, 120);
    if (sheetMapFullToggle) {
      const icon = sheetMapFullToggle.querySelector("img");
      const expandIcon = sheetMapFullToggle.dataset.iconExpand;
      const collapseIcon = sheetMapFullToggle.dataset.iconCollapse;
      if (icon && expandIcon && collapseIcon) {
        icon.src = sheetMapFullscreen ? collapseIcon : expandIcon;
      }
      const label = sheetMapFullscreen ? "Свернуть карту" : "Развернуть карту";
      sheetMapFullToggle.setAttribute("aria-label", label);
      sheetMapFullToggle.title = label;
    }
  };

  const focusOnUser = () => {
    if (!navigator.geolocation) {
      showError("Геолокация недоступна в этом браузере.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleMapPick({ lat: latitude, lng: longitude });
      },
      () => {
        showError("Не получилось получить геопозицию.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const bytesFromDataUrl = (dataUrl) => Math.ceil((dataUrl.length * 3) / 4);

  const compressImage = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxSide = Math.max(img.width, img.height);
        let scale = maxSide > 1600 ? 1600 / maxSide : 1;

        const attemptCompress = () => {
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          let quality = 0.9;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);
          while (bytesFromDataUrl(dataUrl) > MAX_SIZE_BYTES && quality > 0.35) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          const size = bytesFromDataUrl(dataUrl);
          if (size > MAX_SIZE_BYTES && scale > 0.4) {
            scale *= 0.85;
            attemptCompress();
            return;
          }

          URL.revokeObjectURL(url);
          resolve({
            dataUrl,
            size,
            name: file.name,
            type: "image/jpeg",
          });
        };

        attemptCompress();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Не удалось обработать изображение."));
      };
      img.src = url;
    });

  const validatePhotos = (files) => {
    if (files.length > MAX_PHOTOS) {
      showError(`Можно загрузить не более ${MAX_PHOTOS} фото.`);
      return false;
    }
    const invalid = files.find((file) => !allowedTypes.includes(file.type));
    if (invalid) {
      showError("Допустимы только JPG или PNG.");
      return false;
    }
    clearError();
    return true;
  };

  const buildResultButton = (item, target) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result";
    btn.innerHTML = `
        <div class="search-result__title">${item.display_name.split(",")[0]}</div>
        <div class="search-result__meta caption">${item.display_name}</div>
      `;
    btn.addEventListener("click", () => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const details = normalizeOsmDetails(item);
      lastPlaceDetails = details;
      fillCoordinates(lat, lng);
      setLocationLabel(item.display_name);
      setSheetMarker(lat, lng);
      lastSuggestedTitle = item.display_name.split(",")[0];
      if (!titleDirty && titleInput) {
        titleInput.value = lastSuggestedTitle;
      }
      if (searchSheetList) searchSheetList.innerHTML = "";
      closeSearchSheet();
      openSheet();
    });
    target.appendChild(btn);
  };

  const renderSearchSheetList = (items = []) => {
    if (!searchSheetList) return;
    searchSheetList.innerHTML = "";
    if (!items.length) {
      const query = searchSheetInput?.value?.trim() || "";
      if (query.length >= 3) {
        searchSheetList.innerHTML =
          '<div class="empty_state_search"><h3>Nothing here yet</h3><p>This search looks through OpenStreetMap places. If you don’t see what you need, you can add it directly on the map.</p></div>';
      }
      return;
    }
    items.forEach((item) => buildResultButton(item, searchSheetList));
  };

  const renderSearchResults = (items = []) => {
    lastSearchItems = items;
    renderSearchSheetList(items);
  };

  const searchPlaces = async (query) => {
    if (!query || query.length < 3) {
      renderSearchResults([]);
      return;
    }
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&namedetails=1&q=${encodeURIComponent(query)}&limit=20`,
        {
          headers: {
            "Accept-Language": "ru",
          },
        }
      );
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      renderSearchResults(data || []);
    } catch (err) {
      console.warn("Search error", err);
    }
  };

  const setLocationLabel = (label) => {
    if (label) {
      setPickedLabel(label);
    } else {
      setPickedLabel("Точка выбрана на карте");
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&extratags=1&namedetails=1&lat=${lat}&lon=${lng}`,
        {
          headers: { "Accept-Language": "ru" },
        }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return normalizeOsmDetails(data);
    } catch (err) {
      console.warn("Reverse geocode error", err);
      return null;
    }
  };

  const handleMapPick = async ({ lat, lng }) => {
    fillCoordinates(lat, lng);
    setPickedLabel("Определяем адрес выбранной точки...");
    setSheetMarker(lat, lng);
    openSheet();
    const details = await reverseGeocode(lat, lng);
    lastPlaceDetails = details;
    const label = details?.displayName || "";
    if (label) {
      setLocationLabel(label);
      lastSuggestedTitle = label.split(",")[0];
      if (!titleDirty && titleInput) {
        titleInput.value = lastSuggestedTitle;
      }
    } else {
      setLocationLabel("Точка выбрана на карте");
    }
  };

  const handlePhotoChange = () => {
    if (!photosInput) return;
    const files = Array.from(photosInput.files || []);
    if (!validatePhotos(files)) {
      photosInput.value = "";
      renderPhotosPreview([]);
      return;
    }
    renderPhotosPreview(files);
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    clearError();

    const lat = parseFloat(latInput?.value);
    const lng = parseFloat(lngInput?.value);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      showError("Выберите точку на карте или через поиск.");
      return;
    }

    const files = Array.from(photosInput?.files || []);
    if (!validatePhotos(files)) {
      return;
    }

    const resolvedTitle =
      (titleInput?.value || "").trim() ||
      lastSuggestedTitle ||
      "Без названия";
    const note = (noteInput?.value || "").trim();

    const photos = [];
    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        if (compressed.size > MAX_SIZE_BYTES) {
          showError("Не удалось сжать фото до 2 МБ. Попробуйте уменьшить изображение.");
          return;
        }
        photos.push(compressed);
      } catch (err) {
        console.warn(err);
        showError("Не получилось сжать одно из фото. Попробуйте другое.");
        return;
      }
    }

    const payload = {
      title: resolvedTitle,
      lat,
      lng,
      note,
      photos,
      address: lastSuggestedTitle,
      osm: lastPlaceDetails,
    };

    if (editContext) {
      const mergedPhotos = photos.length ? photos : editContext.originalPhotos || [];
      const updated = {
        ...payload,
        photos: mergedPhotos,
        id: editContext.id,
        osm: lastPlaceDetails || editContext.originalDetails || null,
      };
      if (editContext.onSave) {
        editContext.onSave(updated);
      }
      closeSheet();
      return;
    }

    if (onSubmitCb) {
      onSubmitCb(payload);
    }

    closeSheet();
  };

  const bind = ({ onSubmit } = {}) => {
    onSubmitCb = onSubmit;

    if (addBtn) addBtn.addEventListener("click", openSheet);
    if (sheetClose) sheetClose.addEventListener("click", closeSheet);
    if (backdrop) backdrop.addEventListener("click", closeSheet);

    if (form) {
      form.addEventListener("submit", submitHandler);
    }

    if (titleInput) {
      titleInput.addEventListener("input", () => {
        titleDirty = titleInput.value.trim().length > 0;
      });
    }

    if (searchSheetInput) {
      searchSheetInput.addEventListener("input", (e) => {
        const value = e.target.value || "";
        handleSearchInput(value);
      });
    }

    if (searchTrigger) {
      searchTrigger.addEventListener("click", () => {
        openSearchSheet();
        setTimeout(() => {
          searchSheetInput?.focus();
        }, 80);
      });
    }

    if (photosInput) {
      photosInput.addEventListener("change", handlePhotoChange);
    }

    if (sheetMapFullToggle) {
      sheetMapFullToggle.addEventListener("click", () => {
        ensureSheetMap();
        setSheetFullscreen(!sheetMapFullscreen);
      });
    }

    if (sheetMyLocation) {
      sheetMyLocation.addEventListener("click", () => {
        ensureSheetMap();
        focusOnUser();
      });
    }

    if (searchSheetClose) searchSheetClose.addEventListener("click", closeSearchSheet);
    if (searchSheetBackdrop) searchSheetBackdrop.addEventListener("click", closeSearchSheet);
  };

  const openSearchSheet = () => {
    if (!searchSheet || !searchSheetList) return;
    renderSearchSheetList(lastSearchItems);
    searchSheet.classList.add("is-open");
    searchSheet.setAttribute("aria-hidden", "false");
    if (searchSheetBackdrop) {
      searchSheetBackdrop.classList.add("is-open");
      searchSheetBackdrop.setAttribute("aria-hidden", "false");
    }
    setTimeout(() => {
      searchSheetInput?.focus();
    }, 60);
  };

  const closeSearchSheet = () => {
    if (searchSheet) {
      searchSheet.classList.remove("is-open");
      searchSheet.setAttribute("aria-hidden", "true");
    }
    if (searchSheetBackdrop) {
      searchSheetBackdrop.classList.remove("is-open");
      searchSheetBackdrop.setAttribute("aria-hidden", "true");
    }
  };

  const handleSearchInput = (rawValue) => {
    const value = (rawValue || "").trim();
    clearTimeout(searchTimer);
    if (!value) {
      renderSearchResults([]);
      return;
    }
    searchTimer = setTimeout(() => searchPlaces(value), 320);
  };

  const startEdit = (place, onSave) => {
    if (!place) return;
    editContext = {
      id: place.id,
      onSave,
      originalPhotos: place.photos || [],
      originalDetails: place.osm || null,
    };
    lastPlaceDetails = place.osm || null;
    const addressLabel = place.address || `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
    lastSuggestedTitle = addressLabel;
    titleDirty = Boolean(place.title);
    if (titleInput) titleInput.value = place.title || "";
    if (noteInput) noteInput.value = place.note || "";
    fillCoordinates(place.lat, place.lng);
    setLocationLabel(addressLabel);
    setSheetMarker(place.lat, place.lng);
    renderPhotosPreview([]);
    openSheet();
  };

  return { bind, fillCoordinates, handleMapPick, openSheet, startEdit };
})();
