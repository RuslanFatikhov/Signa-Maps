const GeoMap = (() => {
  let map;
  let markers = [];
  let onSelectCb;
  let onPickCb;
  let ignoreMapClickUntil = 0;

  const ensureMapboxToken = () => {
    if (typeof mapboxgl === "undefined") return;
    if (window.MAPBOX_ACCESS_TOKEN) {
      mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
    }
  };

  const getMapStyle = () => window.MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12";

  const showMessage = (text) => {
    const mapContainer = document.getElementById("map");
    if (mapContainer) {
      mapContainer.textContent = text;
    }
  };

  const init = ({ onSelect, onPick } = {}) => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;
    onSelectCb = onSelect;
    onPickCb = onPick;

    if (typeof mapboxgl === "undefined") {
      showMessage("Map failed to load. Проверьте подключение.");
      return;
    }

    try {
      ensureMapboxToken();
      map = new mapboxgl.Map({
        container: "map",
        style: getMapStyle(),
        center: [0, 0],
        zoom: 1,
      });
    } catch (err) {
      console.error(err);
      showMessage("Не удалось инициализировать карту.");
      return;
    }

    map.addControl(new mapboxgl.NavigationControl());

    map.on("error", (e) => {
      console.error("Map error:", e && e.error);
      showMessage("Карта не загрузилась. Проверьте интернет.");
    });

    map.on("click", (e) => {
      if (!onPickCb) return;
      if (Date.now() < ignoreMapClickUntil) return;
      onPickCb({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
  };

  const syncMarkers = (places = []) => {
    if (!map) return;

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
