const GeoStore = (() => {
  const STORAGE_KEY = "geonotion:places";
  const TITLE_KEY = "geonotion:title";
  const LISTS_KEY = "geonotion:lists";
  const ACTIVE_LIST_KEY = "geonotion:active-list";
  const MIGRATION_KEY = "geonotion:idb-migrated";
  const DB_NAME = "geonotion";
  const DB_VERSION = 1;
  const STORE_NAME = "kv";
  const state = {
    lists: null,
    activeListId: null,
    idbReady: false,
    migrationDone: false,
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
      // Fallback stays in memory/localStorage.
    }
  };

  const createId = () => {
    return crypto.randomUUID ? crypto.randomUUID() : `place-${Date.now()}-${Math.random()}`;
  };

  const ensureMigration = async () => {
    if (state.migrationDone) return;
    if (localStorage.getItem(MIGRATION_KEY) === "1") {
      state.migrationDone = true;
      return;
    }

    let migratedLists = null;
    try {
      const legacyListsRaw = localStorage.getItem(LISTS_KEY);
      if (legacyListsRaw) {
        migratedLists = JSON.parse(legacyListsRaw);
      }
    } catch (err) {
      migratedLists = null;
    }

    if (!migratedLists) {
      try {
        const legacyPlacesRaw = localStorage.getItem(STORAGE_KEY);
        const legacyTitleRaw = localStorage.getItem(TITLE_KEY);
        if (legacyPlacesRaw || legacyTitleRaw) {
          const places = legacyPlacesRaw ? JSON.parse(legacyPlacesRaw) : [];
          const title = legacyTitleRaw || "My map";
          migratedLists = [
            {
              id: createId(),
              title,
              places,
              createdAt: new Date().toISOString(),
            },
          ];
        }
      } catch (err) {
        migratedLists = null;
      }
    }

    if (migratedLists) {
      await idbSet(LISTS_KEY, migratedLists);
      const activeId = localStorage.getItem(ACTIVE_LIST_KEY);
      if (activeId) {
        await idbSet(ACTIVE_LIST_KEY, activeId);
      }
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TITLE_KEY);
    localStorage.removeItem(LISTS_KEY);
    localStorage.setItem(MIGRATION_KEY, "1");
    state.migrationDone = true;
  };

  const load = () => {
    return [];
  };

  const save = (places) => {
    idbSet(STORAGE_KEY, places || []);
  };

  const loadTitle = () => {
    const title = localStorage.getItem(TITLE_KEY);
    return title || "My map";
  };

  const saveTitle = (title) => {
    localStorage.setItem(TITLE_KEY, title || "My map");
  };

  const loadLists = () => {
    return state.lists || [];
  };

  const saveLists = (lists) => {
    const payload = lists || [];
    state.lists = payload;
    idbSet(LISTS_KEY, payload);
  };

  const loadActiveListId = () => {
    if (state.activeListId) return state.activeListId;
    const value = localStorage.getItem(ACTIVE_LIST_KEY);
    state.activeListId = value;
    return value;
  };

  const saveActiveListId = (id) => {
    if (!id) return;
    state.activeListId = id;
    localStorage.setItem(ACTIVE_LIST_KEY, id);
    idbSet(ACTIVE_LIST_KEY, id);
  };

  const hydrateFromIdb = async () => {
    if (state.idbReady) return;
    state.idbReady = true;
    await ensureMigration();
    const lists = await idbGet(LISTS_KEY);
    const activeId = await idbGet(ACTIVE_LIST_KEY);
    if (lists) {
      state.lists = lists;
    }
    if (activeId) {
      state.activeListId = activeId;
      localStorage.setItem(ACTIVE_LIST_KEY, activeId);
    }
  };

  const loadListsAsync = async () => {
    await hydrateFromIdb();
    return state.lists || [];
  };

  const loadActiveListIdAsync = async () => {
    await hydrateFromIdb();
    return state.activeListId || localStorage.getItem(ACTIVE_LIST_KEY);
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
