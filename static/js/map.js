const GeoMap = (() => {
  let map;
  let markers = [];
  let onSelectCb;

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

  const init = ({ onSelect } = {}) => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;
    onSelectCb = onSelect;

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
      el.addEventListener("click", () => {
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
