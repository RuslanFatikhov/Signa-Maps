const GeoStore = (() => {
  const STORAGE_KEY = "geonotion:places";
  const TITLE_KEY = "geonotion:title";
  const LISTS_KEY = "geonotion:lists";
  const ACTIVE_LIST_KEY = "geonotion:active-list";

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
    return title || "My List";
  };

  const saveTitle = (title) => {
    localStorage.setItem(TITLE_KEY, title || "My List");
  };

  const loadLists = () => {
    try {
      const raw = localStorage.getItem(LISTS_KEY);
      if (raw) return JSON.parse(raw);
      return migrateLegacy();
    } catch (err) {
      console.warn("Failed to parse saved lists", err);
      return [];
    }
  };

  const saveLists = (lists) => {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists || []));
  };

  const loadActiveListId = () => {
    return localStorage.getItem(ACTIVE_LIST_KEY);
  };

  const saveActiveListId = (id) => {
    if (!id) return;
    localStorage.setItem(ACTIVE_LIST_KEY, id);
  };

  const createId = () => {
    return crypto.randomUUID ? crypto.randomUUID() : `place-${Date.now()}-${Math.random()}`;
  };

  const migrateLegacy = () => {
    try {
      const legacyPlaces = localStorage.getItem(STORAGE_KEY);
      const legacyTitle = localStorage.getItem(TITLE_KEY) || "My List";
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
  };
})();
