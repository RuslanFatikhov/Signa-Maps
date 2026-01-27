const GeoMap = (() => {
  let map;
  let markers = [];
  let onSelectCb;
  let onPickCb;
  let ignoreMapClickUntil = 0;
  let mapContainer;
  let mapboxInitArgs = null;
  let mapboxLoadListener = false;
  let onlineListenerAdded = false;
  let mapInitTimer = null;
  let mapInitAttempts = 0;

  const ensureMapboxToken = () => {
    if (typeof mapboxgl === "undefined") return;
    if (window.MAPBOX_ACCESS_TOKEN) {
      mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
    }
  };

  const getMapStyle = () => window.MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12";

  const showMessage = (text) => {
    if (!mapContainer) return;
    mapContainer.classList.add("map--offline");
    mapContainer.innerHTML = "";
    const message = document.createElement("span");
    message.textContent = text;
    mapContainer.appendChild(message);
  };

  const showPlaceholder = (text, coords) => {
    if (!mapContainer) return;
    mapContainer.classList.add("map--offline");
    mapContainer.innerHTML = "";
    const message = document.createElement("span");
    message.textContent = text;
    mapContainer.appendChild(message);
    if (coords) {
      const coordEl = document.createElement("span");
      coordEl.className = "map-placeholder__coords";
      coordEl.textContent = coords;
      mapContainer.appendChild(coordEl);
    }
  };

  const scheduleInit = () => {
    if (mapInitTimer) return;
    mapInitAttempts = 0;
    mapInitTimer = setInterval(() => {
      mapInitAttempts += 1;
      if (!mapContainer) return;
      if (!navigator.onLine) return;
      if (typeof mapboxgl === "undefined") {
        if (mapInitAttempts >= 50) {
          clearInterval(mapInitTimer);
          mapInitTimer = null;
        }
        return;
      }
      if (mapContainer.clientWidth === 0 || mapContainer.clientHeight === 0) {
        if (mapInitAttempts >= 50) {
          clearInterval(mapInitTimer);
          mapInitTimer = null;
        }
        return;
      }
      clearInterval(mapInitTimer);
      mapInitTimer = null;
      init(mapboxInitArgs || {});
    }, 200);
  };

  const init = ({ onSelect, onPick } = {}) => {
    mapContainer = document.getElementById("map");
    if (!mapContainer) return;
    if (map) return;
    onSelectCb = onSelect;
    onPickCb = onPick;
    mapboxInitArgs = { onSelect, onPick };

    if (!navigator.onLine) {
      showPlaceholder("Карта недоступна");
      if (!onlineListenerAdded) {
        onlineListenerAdded = true;
        window.addEventListener("online", () => init(mapboxInitArgs || {}));
      }
      return;
    }

    if (mapContainer.clientWidth === 0 || mapContainer.clientHeight === 0) {
      scheduleInit();
      return;
    }

    if (typeof mapboxgl === "undefined") {
      mapboxInitArgs = { onSelect, onPick };
      if (!mapboxLoadListener) {
        mapboxLoadListener = true;
        window.addEventListener(
          "load",
          () => {
            if (typeof mapboxgl === "undefined") return;
            init(mapboxInitArgs || {});
          },
          { once: true }
        );
      }
      scheduleInit();
      return;
    }

    try {
      ensureMapboxToken();
      mapContainer.innerHTML = "";
      map = new mapboxgl.Map({
        container: "map",
        style: getMapStyle(),
        center: [0, 0],
        zoom: 1,
      });
      mapContainer.classList.remove("map--offline");
    } catch (err) {
      console.error(err);
      showMessage("Не удалось инициализировать карту.");
      return;
    }

    map.addControl(new mapboxgl.NavigationControl());

    map.on("error", (e) => {
      console.error("Map error:", e && e.error);
      showPlaceholder("Карта не загрузилась. Проверьте интернет.");
    });

    map.on("click", (e) => {
      if (!onPickCb) return;
      if (Date.now() < ignoreMapClickUntil) return;
      onPickCb({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
  };

  const syncMarkers = (places = []) => {
    if (!map) {
      if (places.length) {
        const first = places[0];
        const coords = `${first.lat.toFixed(5)}, ${first.lng.toFixed(5)}`;
        showPlaceholder("Карта недоступна", coords);
      }
      return;
    }

    markers.forEach((m) => m.remove());
    markers = [];

    if (!places.length) return;

    const bounds = new mapboxgl.LngLatBounds();

    places.forEach((place) => {
      const marker = new mapboxgl.Marker().setLngLat([place.lng, place.lat]);
      marker.addTo(map);
      const el = marker.getElement();
      el.style.cursor = "pointer";
      el.addEventListener("click", (event) => {
        ignoreMapClickUntil = Date.now() + 250;
        event.stopPropagation();
        if (onSelectCb) onSelectCb(place);
      });
      markers.push(marker);
      bounds.extend([place.lng, place.lat]);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    }
  };

  return { init, syncMarkers };
})();
