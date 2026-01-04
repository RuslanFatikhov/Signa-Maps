const GeoRender = (() => {
  const placesEl = document.getElementById("places");
  const placeCountEl = document.getElementById("placeCount");
  const placesById = new Map();
  let onDeleteHandler = null;
  let listenersBound = false;

  const formatCoords = (place) => `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;

  const bindListEvents = () => {
    if (!placesEl || listenersBound) return;
    placesEl.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest("[data-delete]");
      if (deleteBtn) {
        e.stopPropagation();
        if (onDeleteHandler) onDeleteHandler(deleteBtn.dataset.delete);
        return;
      }
      const card = e.target.closest("[data-place-id]");
      if (!card) return;
      const place = placesById.get(card.dataset.placeId);
      if (place && typeof GeoView !== "undefined" && GeoView?.open) {
        GeoView.open(place);
      }
    });
    listenersBound = true;
  };

  const render = (
    places = [],
    { onDelete, editing = false, emptyMessage = "", totalCount = null } = {}
  ) => {
    if (!placesEl || !placeCountEl) return;

    bindListEvents();
    onDeleteHandler = onDelete || null;
    const countLabel =
      totalCount != null && totalCount !== places.length
        ? `${places.length}/${totalCount} saved spots`
        : `${places.length} saved spot${places.length === 1 ? "" : "s"}`;
    placeCountEl.textContent = countLabel;
    placesEl.innerHTML = "";
    placesById.clear();

    if (!places.length) {
      const message = emptyMessage || "Add the first place to your list";
      placesEl.innerHTML = `<div class="empty_state_list"><p>${message}</p><img src="/static/img/icons/arrow_empty.svg" alt="Empty state"></div>`;
      GeoMap.syncMarkers([]);
      return;
    }

    const fragment = document.createDocumentFragment();
    places
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((place) => {
        placesById.set(place.id, place);
        const card = document.createElement("article");
        card.className = "card";
        card.dataset.placeId = place.id;
        const address = place.address || formatCoords(place);
        card.innerHTML = `
            <div>
              <h3 class="card-title">${place.title}</h3>
              <p class="card-meta caption">${address}</p>
              ${place.photos?.length ? `<p class="card-meta">${place.photos.length} фото</p>` : ""}
            </div>
          
          ${
            editing
              ? `<div class="actions">
            <button type="button" class="btn_icon_ghost" data-delete="${place.id}">
              <img src="/static/img/icons/trash.svg" alt="Trash icon" />
            </button>
          </div>`
              : ""
          }
        `;
        fragment.appendChild(card);
      });
    placesEl.appendChild(fragment);

    GeoMap.syncMarkers(places);
  };

  return { render };
})();
