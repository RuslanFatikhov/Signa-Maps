document.addEventListener("DOMContentLoaded", () => {
  const init = async () => {
    const route = { url: new URL(window.location.href), hash: window.location.hash || "" };
    let remoteShareId = null;
    let remoteEditable = false;
    let isRemoteShare = false;
    let readOnly = false;
    let remoteSharePassword = "";
    let pendingShare = null;
    let shareSyncTimer = null;
    let sharePollTimer = null;
    let lastShareUpdatedAt = null;

  const appLoading = document.getElementById("appLoading");
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
  const listToggleBtn = document.getElementById("listToggleBtn");
  const listSearch = document.getElementById("listSearch");
  const listSearchInput = document.getElementById("listSearchInput");
  const shareGate = document.getElementById("sharePasswordGate");
  const shareGatePanel = shareGate?.querySelector(".share-gate__panel");
  const shareGateInput = document.getElementById("shareGateInput");
  const shareGateOpen = document.getElementById("shareGateOpen");

  let lists = [];
  let currentListId = null;
  let places = [];
  let savedTitle = "My map";
  let undoTimer = null;
  let lastDeleted = null;
  let pendingDeletedIds = new Set();
  let listEditMode = false;
  let listDrafts = [];
  let draggingListId = null;
  let dragHandleId = null;
  let remoteSaveTimer = null;
  let listsWithPlaces = new Set();
  let listSearchQuery = "";

  const loadRemoteShare = async (shareId, password = "") => {
    if (!shareId) return null;
    try {
      const headers = password ? { "X-Share-Password": password } : {};
      const response = await fetch(`/api/share/${shareId}`, { headers });
      if (response.status === 401) {
        return { requiresPassword: true };
      }
      if (!response.ok) throw new Error("Remote share load failed");
      return await response.json();
    } catch (err) {
      console.warn("Remote share load failed", err);
      return null;
    }
  };

  const loadRemoteShareMeta = async (shareId, password = "") => {
    if (!shareId) return null;
    try {
      const headers = password ? { "X-Share-Password": password } : {};
      const response = await fetch(`/api/share/${shareId}/meta`, { headers });
      if (response.status === 401) {
        return { requiresPassword: true };
      }
      if (!response.ok) throw new Error("Remote share meta failed");
      return await response.json();
    } catch (err) {
      console.warn("Remote share meta failed", err);
      return null;
    }
  };

  const saveRemoteShare = async (list) => {
    if (!remoteShareId || !remoteEditable) return;
    try {
      const headers = { "Content-Type": "application/json" };
      if (remoteSharePassword) headers["X-Share-Password"] = remoteSharePassword;
      await fetch(`/api/share/${remoteShareId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ title: list.title || "My map", places: list.places || [] }),
      });
    } catch (err) {
      console.warn("Remote share save failed", err);
    }
  };

  const saveOwnedShare = async (list, shareId) => {
    if (!shareId) return;
    try {
      const headers = { "Content-Type": "application/json" };
      const password = GeoShare?.getSharePassword?.(shareId) || "";
      if (password) headers["X-Share-Password"] = password;
      const normalized =
        GeoShare?.normalizePlaces && Array.isArray(list.places)
          ? GeoShare.normalizePlaces(list.places)
          : list.places || [];
      await fetch(`/api/share/${shareId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ title: list.title || "My map", places: normalized }),
      });
    } catch (err) {
      console.warn("Owned share sync failed", err);
    }
  };

  const scheduleRemoteSave = (list) => {
    if (!remoteShareId || !remoteEditable) return;
    if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(() => saveRemoteShare(list), 400);
  };

  const scheduleOwnedShareSave = (list) => {
    if (!list || isRemoteShare || readOnly) return;
    const shareId = GeoShare?.getShareIdForList?.(list.id);
    if (!shareId) return;
    if (shareSyncTimer) clearTimeout(shareSyncTimer);
    shareSyncTimer = setTimeout(() => saveOwnedShare(list, shareId), 400);
  };

  const stopSharePolling = () => {
    if (sharePollTimer) {
      clearInterval(sharePollTimer);
      sharePollTimer = null;
    }
  };

  const startSharePolling = () => {
    stopSharePolling();
    if (!isRemoteShare || remoteEditable || !remoteShareId) return;
    const poll = async () => {
      const meta = await loadRemoteShareMeta(remoteShareId, remoteSharePassword);
      if (!meta || meta.requiresPassword) return;
      if (!lastShareUpdatedAt) {
        lastShareUpdatedAt = meta.updatedAt || null;
        return;
      }
      if (meta.updatedAt && meta.updatedAt !== lastShareUpdatedAt) {
        lastShareUpdatedAt = meta.updatedAt;
        const data = await loadRemoteShare(remoteShareId, remoteSharePassword);
        if (data && !data.requiresPassword) {
          applyRemoteShareData(remoteShareId, data, remoteEditable);
        }
      }
    };
    poll();
    sharePollTimer = setInterval(poll, 8000);
  };
  const parseHashRoute = (hashValue) => {
    if (!hashValue || hashValue === "#") {
      return { mode: null, listId: null, params: new URLSearchParams() };
    }
    const trimmed = hashValue.startsWith("#") ? hashValue.slice(1) : hashValue;
    const [path, query = ""] = trimmed.split("?");
    const parts = path.split("/").filter(Boolean);
    return {
      mode: parts[0] || null,
      listId: parts[1] || null,
      params: new URLSearchParams(query),
    };
  };

  const resolveList = async (routeInfo) => {
    const searchParams = routeInfo.url.searchParams;
    const hashRoute = parseHashRoute(routeInfo.hash);
    const hashShareId = hashRoute.params.get("share_id");
    const hashShareParam = hashRoute.params.get("share");
    const hashEditable = hashRoute.params.get("editable") === "1";
    const searchShareId = searchParams.get("share_id");
    const searchShareParam = searchParams.get("share");
    const searchEditable = searchParams.get("editable") === "1";

    const routeShareParam = hashShareParam || searchShareParam;
    const decodedPayload =
      routeShareParam && GeoShare?.decodePayload ? GeoShare.decodePayload(routeShareParam) : null;
    const routeShareId = hashShareId || searchShareId || (!decodedPayload ? routeShareParam : null); // backward compatible
    const routeEditable = hashEditable || searchEditable;
    const isLocalMode = hashRoute.mode === "local";

    if (routeShareId) {
      const remoteData = await loadRemoteShare(routeShareId, remoteSharePassword);
      if (remoteData?.requiresPassword) {
        return {
          lists: [],
          currentListId: null,
          readOnly: true,
          isRemoteShare: true,
          remoteShareId: routeShareId,
          remoteEditable: routeEditable,
          sharedParam: null,
          sharedPayload: null,
          requiresPassword: true,
        };
      }
      if (remoteData) {
        const list = {
          id: routeShareId,
          title: remoteData.title || "My map",
          places: remoteData.places || [],
          createdAt: remoteData.updatedAt || new Date().toISOString(),
        };
        GeoStore.saveLists([list]);
        GeoStore.saveActiveListId(list.id);
        return {
          lists: [list],
          currentListId: list.id,
          readOnly: !routeEditable,
          isRemoteShare: true,
          remoteShareId: routeShareId,
          remoteEditable: routeEditable,
          sharedParam: null,
          sharedPayload: null,
        };
      }
      return {
        lists: [],
        currentListId: null,
        readOnly: !routeEditable,
        isRemoteShare: true,
        remoteShareId: routeShareId,
        remoteEditable: routeEditable,
        sharedParam: null,
        sharedPayload: null,
      };
    }

    if (decodedPayload) {
      const list = {
        id: "shared",
        title: decodedPayload.title || "My map",
        places: decodedPayload.places || [],
        createdAt: decodedPayload.createdAt || new Date().toISOString(),
      };
      return {
        lists: [list],
        currentListId: list.id,
        readOnly: !decodedPayload.editable,
        isRemoteShare: false,
        remoteShareId: null,
        remoteEditable: false,
        sharedParam: routeShareParam, // backward compatible
        sharedPayload: decodedPayload,
      };
    }

    if (isLocalMode || (!routeShareId && !decodedPayload)) {
      const localLists = await GeoStore.loadListsAsync();
      const activeId = await GeoStore.loadActiveListIdAsync();
      const resolvedId = localLists.find((l) => l.id === activeId)?.id || localLists[0]?.id || null;
      return {
        lists: localLists,
        currentListId: resolvedId,
        readOnly: false,
        isRemoteShare: false,
        remoteShareId: null,
        remoteEditable: false,
        sharedParam: null,
        sharedPayload: null,
      };
    }

    return {
      lists: [],
      currentListId: null,
      readOnly: false,
      isRemoteShare: false,
      remoteShareId: null,
      remoteEditable: false,
      sharedParam: null,
      sharedPayload: null,
    };
  };

  const createOnboardingList = () => {
    const now = Date.now();
    const places = [
      {
        title: "📌 This is your list",
        note: "Here you collect places for yourself —\nin the order and format that works for you.",
        address: "New York",
        lat: 40.712728,
        lng: -74.006015,
      },
      {
        title: "➕ Add places",
        note: "Save places to come back to them later\nor simply keep them at hand.",
        address: "Almaty",
        lat: 43.236392,
        lng: 76.945728,
      },
      {
        title: "🗂 The list is whatever you want",
        note: "It can be ideas, plans, notes,\na collection, or an archive.",
        address: "Tokyo",
        lat: 35.67686,
        lng: 139.763895,
      },
      {
        title: "✏️ Name and notes",
        note: "You can name the list\nand add notes to each place.",
        address: "Paris",
        lat: 48.856613,
        lng: 2.352222,
      },
      {
        title: "🔗 Share the list",
        note: "Send the link to anyone —\nview-only or with editing access.",
        address: "London",
        lat: 51.507446,
        lng: -0.127765,
      },
      {
        title: "🧠 Stored free",
        note: "No registration.\nThe lists belong to you.\nSave the link to avoid losing it.",
        address: "Hong Kong",
        lat: 22.319303,
        lng: 114.169361,
      },
    ].map((place, index) => ({
      id: GeoStore.createId(),
      ...place,
      createdAt: new Date(now - index * 60000).toISOString(),
    }));

    return {
      id: GeoStore.createId(),
      title: "My map",
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

  const filterPlaces = (items) => {
    const query = listSearchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((place) => {
      const haystack = [
        place.title || "",
        place.address || "",
        place.note || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  };

  const renderPlaces = () => {
    const visiblePlaces = getVisiblePlaces();
    const totalCount = visiblePlaces.length;
    const showSearch = totalCount > 10;
    if (listSearch) listSearch.style.display = showSearch ? "" : "none";
    if (!showSearch && listSearchQuery) {
      listSearchQuery = "";
      if (listSearchInput) listSearchInput.value = "";
    }
    const filteredPlaces = filterPlaces(visiblePlaces);
    const emptyMessage =
      currentListId == null
        ? "Open a link or create a new share"
        : listSearchQuery
          ? "Ничего не найдено"
          : "";
    GeoRender.render(filteredPlaces, {
      onDelete: handlers.onDelete,
      editing: !readOnly && GeoEdit.isEditing(),
      emptyMessage,
      totalCount,
    });
  };

  const updateActiveList = (updater) => {
    const idx = lists.findIndex((l) => l.id === currentListId);
    if (idx === -1) return;
    const updated = updater(lists[idx]);
    if (!updated) return;
    lists = [...lists.slice(0, idx), updated, ...lists.slice(idx + 1)];
    if (!readOnly && !isRemoteShare) {
      GeoStore.saveLists(lists);
      GeoStore.saveActiveListId(currentListId);
    }
    scheduleRemoteSave(updated);
    scheduleOwnedShareSave(updated);
  };

  const getActiveList = () => lists.find((l) => l.id === currentListId) || null;

  const syncFromActiveList = () => {
    const active = getActiveList();
    places = active?.places ? [...active.places] : [];
    savedTitle = active?.title || "My map";
    GeoEdit.setTitle(savedTitle);
    pendingDeletedIds = new Set();
    listSearchQuery = "";
    if (listSearchInput) listSearchInput.value = "";
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
    if (readOnly || isRemoteShare) return;
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

  const applyResolvedState = (resolved) => {
    lists = resolved.lists;
    currentListId = resolved.currentListId;
    readOnly = resolved.readOnly;
    isRemoteShare = resolved.isRemoteShare;
    remoteShareId = resolved.remoteShareId;
    remoteEditable = resolved.remoteEditable;
    if (!isRemoteShare || remoteEditable) {
      stopSharePolling();
      lastShareUpdatedAt = null;
    }
  };

  const openShareGate = () => {
    if (shareGate) {
      shareGate.classList.add("is-open");
      shareGate.setAttribute("aria-hidden", "false");
    }
    if (shareGateInput) {
      shareGateInput.value = "";
      shareGateInput.focus();
      if (shareGateOpen) {
        shareGateOpen.disabled = !(shareGateInput.value || "").trim();
      }
    }
    if (shareGatePanel) {
      shareGatePanel.classList.remove("is-shaking");
    }
  };

  const closeShareGate = () => {
    if (shareGate) {
      shareGate.classList.remove("is-open");
      shareGate.setAttribute("aria-hidden", "true");
    }
    if (shareGatePanel) {
      shareGatePanel.classList.remove("is-shaking");
    }
  };

  const applyResolvedList = async () => {
    const resolved = await resolveList(route);
    if (resolved.requiresPassword) {
      pendingShare = { id: resolved.remoteShareId, editable: resolved.remoteEditable };
      applyResolvedState(resolved);
      openShareGate();
      return;
    }
    applyResolvedState(resolved);
    if (resolved.isRemoteShare && !resolved.remoteEditable) {
      lastShareUpdatedAt = resolved.lists[0]?.createdAt || null;
      startSharePolling();
    }
  };

  const applyRemoteShareData = (shareId, remoteData, editable) => {
    const list = {
      id: shareId,
      title: remoteData.title || "My map",
      places: remoteData.places || [],
      createdAt: remoteData.updatedAt || new Date().toISOString(),
    };
    GeoStore.saveLists([list]);
    GeoStore.saveActiveListId(list.id);
    applyResolvedState({
      lists: [list],
      currentListId: list.id,
      readOnly: !editable,
      isRemoteShare: true,
      remoteShareId: shareId,
      remoteEditable: editable,
    });
    listsWithPlaces = new Set([list.id].filter(() => (list.places || []).length > 0));
    renderListsPanel();
    syncFromActiveList();
    lastShareUpdatedAt = remoteData.updatedAt || null;
    if (!editable) startSharePolling();
  };

  const submitShareGate = async () => {
    if (!pendingShare) return;
    const password = (shareGateInput?.value || "").trim();
    if (!password) return;
    if (shareGateOpen) shareGateOpen.disabled = true;
    const pending = pendingShare;
    const remoteData = await loadRemoteShare(pending.id, password);
    if (!remoteData || remoteData.requiresPassword) {
      if (remoteData?.requiresPassword && shareGatePanel) {
        shareGatePanel.classList.remove("is-shaking");
        // Restart animation each time the password is rejected.
        void shareGatePanel.offsetWidth;
        shareGatePanel.classList.add("is-shaking");
      }
      if (shareGateInput) shareGateInput.value = "";
      if (shareGateOpen) shareGateOpen.disabled = true;
      return;
    }
    remoteSharePassword = password;
    pendingShare = null;
    closeShareGate();
    applyRemoteShareData(pending.id, remoteData, pending.editable);
  };

  const setActiveList = (listId) => {
    if (readOnly || isRemoteShare) return;
    const exists = lists.find((l) => l.id === listId);
    if (!exists) return;
    currentListId = listId;
    GeoStore.saveActiveListId(listId);
    syncFromActiveList();
    renderListsPanel();
    closeListsPanel();
  };

  const createList = () => {
    if (readOnly || isRemoteShare) return;
    const collection = listEditMode ? listDrafts : lists;
    const nextIndex = collection.length + 1;
    const title = `New map ${nextIndex}`;
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
      GeoAnalytics?.track?.("list_created");
    }
  };

  await applyResolvedList();
  if (!isRemoteShare && !readOnly && !lists.length) {
    const fallbackList = createOnboardingList();
    lists = [fallbackList];
    currentListId = fallbackList.id;
    GeoStore.saveLists(lists);
    GeoStore.saveActiveListId(currentListId);
  }
  const activeList = getActiveList();
  places = activeList?.places ? [...activeList.places] : [];
  savedTitle = activeList?.title || "My map";
  listsWithPlaces = new Set(
    lists.filter((list) => (list.places || []).length > 0).map((list) => list.id)
  );
  setListEditToolbar(false);
  if (shareGateInput && shareGateOpen) {
    shareGateOpen.disabled = !(shareGateInput.value || "").trim();
    shareGateInput.addEventListener("input", () => {
      shareGateOpen.disabled = !(shareGateInput.value || "").trim();
      if (shareGatePanel) shareGatePanel.classList.remove("is-shaking");
    });
    shareGateInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitShareGate();
    });
  }
  shareGateOpen?.addEventListener("click", submitShareGate);

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
      const nextTitle = title || "My map";
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
    onPick: readOnly
      ? null
      : ({ lat, lng }) => {
          GeoForm.handleMapPick({ lat, lng });
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
        const wasEmpty = places.length === 0;
        const listId = currentListId;
        const alreadyNonEmpty = listId ? listsWithPlaces.has(listId) : false;
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
        GeoAnalytics?.track?.("place_added");
        if (wasEmpty && listId && !alreadyNonEmpty) {
          GeoAnalytics?.track?.("list_became_non_empty");
          listsWithPlaces.add(listId);
        }
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
  if (isRemoteShare) {
    if (createListBtn) createListBtn.style.display = "none";
    if (listEditToggle) listEditToggle.style.display = "none";
    if (listEditSave) listEditSave.style.display = "none";
    if (listEditCancel) listEditCancel.style.display = "none";
    if (listToggleBtn) listToggleBtn.style.display = "none";
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

  if (listSearchInput) {
    listSearchInput.addEventListener("input", (e) => {
      listSearchQuery = e.target.value || "";
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

  GeoShare?.setDataProvider?.(() => ({
    places: getVisiblePlaces(),
    title: savedTitle,
    listId: currentListId,
  }));

  renderListsPanel();
  renderPlaces();
  if (appLoading) appLoading.classList.add("is-hidden");
  };

  init();
});
