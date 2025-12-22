document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const sharedParam = params.get("share");
  const sharedPayload = sharedParam && GeoShare?.decodePayload ? GeoShare.decodePayload(sharedParam) : null;
  const readOnly = sharedPayload ? !sharedPayload.editable : false;

  const undoBanner = document.getElementById("undoBanner");
  const undoText = document.getElementById("undoText");
  const undoBtn = document.getElementById("undoBtn");
  const listsPanelBody = document.getElementById("listsPanelBody");
  const createListBtn = document.getElementById("createListBtn");
  const listsPanel = document.getElementById("listsPanel");
  const listsBackdrop = document.getElementById("listsBackdrop");
  const listEditToggle = document.getElementById("listEditToggle");
  const listEditSave = document.getElementById("listEditSave");
  const listEditCancel = document.getElementById("listEditCancel");

  let lists = [];
  let currentListId = null;
  let places = [];
  let savedTitle = "My List";
  let undoTimer = null;
  let lastDeleted = null;
  let pendingDeletedIds = new Set();
  let listEditMode = false;
  let listDrafts = [];
  let draggingListId = null;
  let dragHandleId = null;

  const createOnboardingList = () => {
    const now = Date.now();
    const places = [
      {
        title: "🧠 Stored in your browser",
        note: "No registration and no cloud.\nThe lists belong to you.\nSave the link to avoid losing it.",
        address: "New York",
        lat: 40.712728,
        lng: -74.006015,
      },
      {
        title: "🔗 Share the list",
        note: "Send the link to anyone —\nview-only or with editing access.",
        address: "Istanbul",
        lat: 41.006381,
        lng: 28.975872,
      },
      {
        title: "✏️ Name and notes",
        note: "You can name the list\nand add notes to each place.",
        address: "Tokyo",
        lat: 35.67686,
        lng: 139.763895,
      },
      {
        title: "🗂 The list is whatever you want",
        note: "It can be ideas, plans, notes,\na collection, or an archive.",
        address: "Almaty",
        lat: 43.236392,
        lng: 76.945728,
      },
      {
        title: "➕ Add places",
        note: "Save places to come back to them later or simply keep them at hand.",
        address: "Barcelona",
        lat: 41.38258,
        lng: 2.177073,
      },
      {
        title: "📌 This is your list",
        note: "Here you collect places for yourself — in the order and format that works for you.",
        address: "London",
        lat: 51.507446,
        lng: -0.127765,
      },
    ].map((place, index) => ({
      id: GeoStore.createId(),
      ...place,
      createdAt: new Date(now - index * 60000).toISOString(),
    }));

    return {
      id: GeoStore.createId(),
      title: "My List",
      places,
      createdAt: new Date(now).toISOString(),
    };
  };

  const closeListsPanel = () => {
    document.body.classList.remove("lists-open");
    listsPanel?.setAttribute("aria-hidden", "true");
    listsBackdrop?.setAttribute("aria-hidden", "true");
  };

  const getVisiblePlaces = () => places.filter((p) => !pendingDeletedIds.has(p.id));

  const renderPlaces = () => {
    const visiblePlaces = getVisiblePlaces();
    GeoRender.render(visiblePlaces, { onDelete: handlers.onDelete, editing: !readOnly && GeoEdit.isEditing() });
  };

  const updateActiveList = (updater) => {
    const idx = lists.findIndex((l) => l.id === currentListId);
    if (idx === -1) return;
    const updated = updater(lists[idx]);
    if (!updated) return;
    lists = [...lists.slice(0, idx), updated, ...lists.slice(idx + 1)];
    if (!readOnly) {
      GeoStore.saveLists(lists);
      GeoStore.saveActiveListId(currentListId);
    }
  };

  const getActiveList = () => lists.find((l) => l.id === currentListId) || null;

  const syncFromActiveList = () => {
    const active = getActiveList();
    places = active?.places ? [...active.places] : [];
    savedTitle = active?.title || "My List";
    GeoEdit.setTitle(savedTitle);
    pendingDeletedIds = new Set();
    if (undoBanner) undoBanner.style.display = "none";
    renderPlaces();
  };

  const renderListsPanel = () => {
    if (!listsPanelBody) return;
    listsPanelBody.innerHTML = "";
    const source = listEditMode ? listDrafts : lists;
    source.forEach((list, index) => {
      if (listEditMode) {
        const row = document.createElement("div");
        row.className = "list-edit-row";
        row.dataset.listId = list.id;
        row.setAttribute("draggable", "true");

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "btn_icon_ghost list-edit-handle";
        handle.dataset.listHandle = list.id;
        handle.title = "Перетащить";
        handle.textContent = "::";
        handle.draggable = true;

        const input = document.createElement("input");
        input.type = "text";
        input.value = list.title || "";
        input.placeholder = "List name";
        input.dataset.listId = list.id;

        const controls = document.createElement("div");
        controls.className = "list-edit-controls";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn_icon_ghost";
        deleteBtn.dataset.listDelete = list.id;
        deleteBtn.title = "Удалить список";
        deleteBtn.innerHTML = `<img src="/static/img/icons/trash.svg" alt="Trash icon">`;

        controls.append(deleteBtn);
        row.append(handle, input, controls);
        listsPanelBody.appendChild(row);
      } else {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `list-card${list.id === currentListId ? " cell" : ""}`;
        btn.dataset.listId = list.id;
        const title = document.createElement("span");
        title.className = "list-card__title";
        title.textContent = list.title || "Untitled";
        const meta = document.createElement("span");
        meta.className = "list-card__meta";
        const count = list.places?.length || 0;
        meta.textContent = `${count} point${count === 1 ? "" : "s"}`;
        btn.append(title, meta);
        listsPanelBody.appendChild(btn);
      }
    });
  };

  const setListEditToolbar = (editing) => {
    if (!listEditToggle || !listEditSave || !listEditCancel) return;
    listEditMode = editing;
    listEditToggle.style.display = editing ? "none" : "";
    listEditSave.style.display = editing ? "" : "none";
    listEditCancel.style.display = editing ? "" : "none";
    if (createListBtn) createListBtn.style.display = editing ? "none" : "";
  };

  const enterListEdit = () => {
    if (readOnly) return;
    listDrafts = lists.map((l) => ({ ...l, places: [...(l.places || [])] }));
    setListEditToolbar(true);
    renderListsPanel();
  };

  const exitListEdit = (persist) => {
    if (!listEditMode) return;
    if (persist && !readOnly) {
      lists = [...listDrafts];
      if (!lists.find((l) => l.id === currentListId)) {
        currentListId = lists[0]?.id || null;
      }
      GeoStore.saveLists(lists);
      if (currentListId) GeoStore.saveActiveListId(currentListId);
      syncFromActiveList();
    }
    listDrafts = [];
    setListEditToolbar(false);
    renderListsPanel();
  };

  const moveListDraft = (fromId, toId) => {
    const fromIndex = listDrafts.findIndex((l) => l.id === fromId);
    const toIndex = listDrafts.findIndex((l) => l.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [item] = listDrafts.splice(fromIndex, 1);
    listDrafts.splice(toIndex, 0, item);
    renderListsPanel();
  };

  const hashShareParam = (value = "") => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return `shared-${Math.abs(hash)}`;
  };

  const ensureLists = () => {
    if (readOnly) {
      const single = {
        id: "shared",
        title: sharedPayload?.title || "My List",
        places: sharedPayload?.places || [],
        createdAt: sharedPayload?.createdAt || new Date().toISOString(),
      };
      lists = [single];
      currentListId = single.id;
      return;
    }

    lists = GeoStore.loadLists();
    if (sharedPayload?.editable && sharedParam) {
      const sharedId = hashShareParam(sharedParam);
      const exists = lists.find((l) => l.id === sharedId);
      if (!exists) {
        lists = [
          {
            id: sharedId,
            title: sharedPayload.title || "My List",
            places: sharedPayload.places || [],
            createdAt: new Date().toISOString(),
          },
          ...lists,
        ];
        GeoStore.saveLists(lists);
      }
      currentListId = sharedId;
      GeoStore.saveActiveListId(currentListId);
    }
    if (!lists.length) {
      const onboardingList = createOnboardingList();
      lists = [onboardingList];
      GeoStore.saveLists(lists);
    }
    if (!currentListId) {
      const activeId = GeoStore.loadActiveListId();
      currentListId = lists.find((l) => l.id === activeId)?.id || lists[0].id;
      GeoStore.saveActiveListId(currentListId);
    }
  };

  const setActiveList = (listId) => {
    if (readOnly) return;
    const exists = lists.find((l) => l.id === listId);
    if (!exists) return;
    currentListId = listId;
    GeoStore.saveActiveListId(listId);
    syncFromActiveList();
    renderListsPanel();
    closeListsPanel();
  };

  const createList = () => {
    if (readOnly) return;
    const collection = listEditMode ? listDrafts : lists;
    const nextIndex = collection.length + 1;
    const title = `Новый список ${nextIndex}`;
    const list = {
      id: GeoStore.createId(),
      title,
      places: [],
      createdAt: new Date().toISOString(),
    };
    if (listEditMode) {
      listDrafts = [list, ...listDrafts];
      renderListsPanel();
    } else {
      lists = [list, ...lists];
      currentListId = list.id;
      GeoStore.saveLists(lists);
      GeoStore.saveActiveListId(currentListId);
      savedTitle = title;
      places = [];
      GeoEdit.setTitle(title);
      renderListsPanel();
      renderPlaces();
      closeListsPanel();
    }
  };

  ensureLists();
  const activeList = getActiveList();
  places = activeList?.places ? [...activeList.places] : [];
  savedTitle = activeList?.title || "My List";
  setListEditToolbar(false);

  const handlers = {
    onDelete: readOnly
      ? null
      : (id) => {
          const deletedPlace = places.find((p) => p.id === id) || null;
          pendingDeletedIds.add(id);
          renderPlaces();
          if (deletedPlace) {
            if (undoTimer) clearTimeout(undoTimer);
            lastDeleted = deletedPlace;
            if (undoText) {
              const title = deletedPlace.title || "Point";
              undoText.textContent = `${title} deleted`;
            }
            if (undoBanner) undoBanner.style.display = "flex";
            undoTimer = setTimeout(() => {
              if (undoBanner) undoBanner.style.display = "none";
              lastDeleted = null;
              undoTimer = null;
            }, 10000);
          }
        },
  };

  GeoEdit.init({
    title: savedTitle,
    onSave: (title) => {
      if (readOnly) return;
      const nextTitle = title || "My List";
      savedTitle = nextTitle;
      updateActiveList((list) => ({ ...list, title: nextTitle }));
      renderListsPanel();
    },
    onEditChange: renderPlaces,
    onExit: ({ persist }) => {
      if (readOnly) return;
      if (persist) {
        if (pendingDeletedIds.size) {
          places = places.filter((p) => !pendingDeletedIds.has(p.id));
          updateActiveList((list) => ({ ...list, places }));
        }
      }
      pendingDeletedIds = new Set();
      if (undoTimer) clearTimeout(undoTimer);
      undoTimer = null;
      lastDeleted = null;
      if (undoBanner) undoBanner.style.display = "none";
      renderPlaces();
    },
  });

  GeoMap.init({
    onSelect: (place) => {
      GeoView.open(place);
    },
  });

  GeoView.configure({
    readOnlyMode: readOnly,
    onEdit: readOnly
      ? null
      : (place) => {
          GeoForm.startEdit(place, (updatedPlace) => {
            places = places.map((p) => (p.id === updatedPlace.id ? { ...p, ...updatedPlace } : p));
            updateActiveList((list) => ({ ...list, places }));
            renderPlaces();
          });
        },
  });

  if (!readOnly) {
    GeoForm.bind({
      onSubmit: ({ title, lat, lng, note, photos = [], address, osm }) => {
        places = [
          ...places,
          {
            id: GeoStore.createId(),
            title,
            lat,
            lng,
            note,
            address,
            photos,
            osm,
            createdAt: new Date().toISOString(),
          },
        ];
        updateActiveList((list) => ({ ...list, places }));
        renderPlaces();
      },
    });
  } else {
    const addBtn = document.getElementById("add-btn");
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.title = "Просмотр только для чтения";
      addBtn.style.display = "none";
    }
    const editBtn = document.getElementById("edit-btn");
    if (editBtn) editBtn.style.display = "none";
    const cancelBtn = document.getElementById("cancel-btn");
    if (cancelBtn) cancelBtn.style.display = "none";
    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) saveBtn.style.display = "none";
    if (createListBtn) createListBtn.style.display = "none";
    if (listEditToggle) listEditToggle.style.display = "none";
    if (listEditSave) listEditSave.style.display = "none";
    if (listEditCancel) listEditCancel.style.display = "none";
  }

  const clearAllBtn = document.getElementById("clearAll");
  if (clearAllBtn && !readOnly) {
    clearAllBtn.addEventListener("click", () => {
      if (!confirm("Remove all saved places?")) return;
      places = [];
      updateActiveList((list) => ({ ...list, places }));
      renderPlaces();
    });
  }

  if (undoBtn && !readOnly) {
    undoBtn.addEventListener("click", () => {
      if (!lastDeleted) return;
      if (undoTimer) clearTimeout(undoTimer);
      pendingDeletedIds.delete(lastDeleted.id);
      renderPlaces();
      lastDeleted = null;
      undoTimer = null;
      if (undoBanner) undoBanner.style.display = "none";
    });
  }

  if (listsPanelBody && !readOnly) {
    listsPanelBody.addEventListener("click", (e) => {
      if (listEditMode) return;
      const target = e.target.closest("[data-list-id]");
      if (!target) return;
      const listId = target.dataset.listId;
      setActiveList(listId);
    });

    listsPanelBody.addEventListener("input", (e) => {
      if (!listEditMode) return;
      const input = e.target.closest("input[data-list-id]");
      if (!input) return;
      const listId = input.dataset.listId;
      listDrafts = listDrafts.map((l) => (l.id === listId ? { ...l, title: input.value } : l));
    });

    listsPanelBody.addEventListener("click", (e) => {
      if (!listEditMode) return;
      const deleteBtn = e.target.closest("[data-list-delete]");
      if (deleteBtn) {
        const id = deleteBtn.dataset.listDelete;
        listDrafts = listDrafts.filter((l) => l.id !== id);
        renderListsPanel();
        return;
      }
    });

    listsPanelBody.addEventListener("dragstart", (e) => {
      if (!listEditMode) return;
      const row = e.target.closest("[data-list-id]");
      if (!row) return;
      if (!dragHandleId || dragHandleId !== row.dataset.listId) {
        e.preventDefault();
        return;
      }
      draggingListId = row.dataset.listId;
      row.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggingListId || "");
    });

    listsPanelBody.addEventListener("dragover", (e) => {
      if (!listEditMode || !draggingListId) return;
      const row = e.target.closest("[data-list-id]");
      if (!row || row.dataset.listId === draggingListId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    });

    listsPanelBody.addEventListener("drop", (e) => {
      if (!listEditMode || !draggingListId) return;
      e.preventDefault();
      const row = e.target.closest("[data-list-id]");
      if (!row) return;
      const targetId = row.dataset.listId;
      if (targetId === draggingListId) return;
      moveListDraft(draggingListId, targetId);
      draggingListId = null;
      dragHandleId = null;
    });

    listsPanelBody.addEventListener("dragend", (e) => {
      draggingListId = null;
      dragHandleId = null;
      const draggingRow = listsPanelBody.querySelector(".list-edit-row.is-dragging");
      draggingRow?.classList.remove("is-dragging");
    });

    listsPanelBody.addEventListener("mousedown", (e) => {
      if (!listEditMode) return;
      const handle = e.target.closest(".list-edit-handle");
      if (!handle) return;
      const row = handle.closest("[data-list-id]");
      if (!row) return;
      dragHandleId = row.dataset.listId;
    });

    listsPanelBody.addEventListener("mouseup", () => {
      dragHandleId = null;
    });
  }

  createListBtn?.addEventListener("click", createList);
  listEditToggle?.addEventListener("click", enterListEdit);
  listEditCancel?.addEventListener("click", () => exitListEdit(false));
  listEditSave?.addEventListener("click", () => exitListEdit(true));

  GeoShare?.setDataProvider?.(() => ({ places: getVisiblePlaces(), title: savedTitle }));

  renderListsPanel();
  renderPlaces();
});
