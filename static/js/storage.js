const GeoStore = (() => {
  const STORAGE_KEY = "geonotion:places";
  const TITLE_KEY = "geonotion:title";
  const LISTS_KEY = "geonotion:lists";
  const ACTIVE_LIST_KEY = "geonotion:active-list";
  const DB_NAME = "geonotion";
  const DB_VERSION = 1;
  const STORE_NAME = "kv";
  const state = {
    lists: null,
    activeListId: null,
    idbReady: false,
  };

  const openDb = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const idbGet = async (key) => {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return null;
    }
  };

  const idbSet = async (key, value) => {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      // Fallback stays in localStorage.
    }
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn("Failed to parse saved places", err);
      return [];
    }
  };

  const save = (places) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  };

  const loadTitle = () => {
    const title = localStorage.getItem(TITLE_KEY);
    return title || "My map";
  };

  const saveTitle = (title) => {
    localStorage.setItem(TITLE_KEY, title || "My map");
  };

  const loadLists = () => {
    if (state.lists) return state.lists;
    try {
      const raw = localStorage.getItem(LISTS_KEY);
      if (raw) {
        state.lists = JSON.parse(raw);
        return state.lists;
      }
      const migrated = migrateLegacy();
      state.lists = migrated;
      return migrated;
    } catch (err) {
      console.warn("Failed to parse saved lists", err);
      return [];
    } finally {
      if (!state.idbReady) hydrateFromIdb();
    }
  };

  const saveLists = (lists) => {
    const payload = lists || [];
    state.lists = payload;
    localStorage.setItem(LISTS_KEY, JSON.stringify(payload));
    idbSet(LISTS_KEY, payload);
  };

  const loadActiveListId = () => {
    if (state.activeListId) return state.activeListId;
    const value = localStorage.getItem(ACTIVE_LIST_KEY);
    state.activeListId = value;
    if (!state.idbReady) hydrateFromIdb();
    return value;
  };

  const saveActiveListId = (id) => {
    if (!id) return;
    state.activeListId = id;
    localStorage.setItem(ACTIVE_LIST_KEY, id);
    idbSet(ACTIVE_LIST_KEY, id);
  };

  const createId = () => {
    return crypto.randomUUID ? crypto.randomUUID() : `place-${Date.now()}-${Math.random()}`;
  };

  const migrateLegacy = () => {
    try {
      const legacyPlaces = localStorage.getItem(STORAGE_KEY);
      const legacyTitleRaw = localStorage.getItem(TITLE_KEY);
      if (legacyPlaces == null && legacyTitleRaw == null) {
        return [];
      }
      const legacyTitle = legacyTitleRaw || "My map";
      const places = legacyPlaces ? JSON.parse(legacyPlaces) : [];
      const list = {
        id: createId(),
        title: legacyTitle,
        places,
        createdAt: new Date().toISOString(),
      };
      saveLists([list]);
      saveActiveListId(list.id);
      return [list];
    } catch (err) {
      console.warn("Legacy migration failed", err);
      return [];
    }
  };

  const hydrateFromIdb = async () => {
    if (state.idbReady) return;
    state.idbReady = true;
    const lists = await idbGet(LISTS_KEY);
    const activeId = await idbGet(ACTIVE_LIST_KEY);
    if (lists && !localStorage.getItem(LISTS_KEY)) {
      state.lists = lists;
      localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
    }
    if (activeId && !localStorage.getItem(ACTIVE_LIST_KEY)) {
      state.activeListId = activeId;
      localStorage.setItem(ACTIVE_LIST_KEY, activeId);
    }
  };

  const loadListsAsync = async () => {
    const lists = await idbGet(LISTS_KEY);
    if (lists) {
      state.lists = lists;
      localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
      return lists;
    }
    return loadLists();
  };

  const loadActiveListIdAsync = async () => {
    const activeId = await idbGet(ACTIVE_LIST_KEY);
    if (activeId) {
      state.activeListId = activeId;
      localStorage.setItem(ACTIVE_LIST_KEY, activeId);
      return activeId;
    }
    return loadActiveListId();
  };

  return {
    load,
    save,
    createId,
    loadTitle,
    saveTitle,
    loadLists,
    saveLists,
    loadActiveListId,
    saveActiveListId,
    loadListsAsync,
    loadActiveListIdAsync,
  };
})();
