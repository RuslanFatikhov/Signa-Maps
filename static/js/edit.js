const GeoEdit = (() => {
  let editing = false;
  let originalTitle = "My List";
  const titleDisplay = document.getElementById("listTitle");
  const titleInput = document.getElementById("listTitleInput");
  const editBtn = document.getElementById("edit-btn");
  const saveBtn = document.getElementById("save-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const shareBtn = document.getElementById("share-btn");
  const addBtn = document.getElementById("add-btn");
  const listToggleBtn = document.getElementById("listToggleBtn");
  const createListBtn = document.getElementById("createListBtn");

  const setTitle = (value) => {
    const safe = value || "My List";
    if (titleDisplay) titleDisplay.textContent = safe;
    if (titleInput) titleInput.value = safe;
  };

  const setToolbar = (isEditing) => {
    if (editBtn) editBtn.style.display = isEditing ? "none" : "";
    if (shareBtn) shareBtn.style.display = isEditing ? "none" : "";
    if (addBtn) addBtn.style.display = isEditing ? "none" : "";
    if (listToggleBtn) listToggleBtn.style.display = isEditing ? "none" : "";
    if (createListBtn) createListBtn.style.display = isEditing ? "none" : "";
    if (saveBtn) saveBtn.style.display = isEditing ? "" : "none";
    if (cancelBtn) cancelBtn.style.display = isEditing ? "" : "none";
  };

  let onEditChangeCb;
  let onExitCb;

  const notifyEditChange = () => {
    if (onEditChangeCb) onEditChangeCb(editing);
  };

  const enterEdit = () => {
    if (editing) return;
    editing = true;
    if (titleDisplay) titleDisplay.style.display = "none";
    if (titleInput) {
      titleInput.style.display = "";
      titleInput.focus();
      titleInput.select();
    }
    originalTitle = titleInput ? titleInput.value : originalTitle;
    setToolbar(true);
    notifyEditChange();
  };

  const exitEdit = (persist, onSave) => {
    if (!editing) return;
    editing = false;
    if (titleDisplay) titleDisplay.style.display = "";
    if (titleInput) titleInput.style.display = "none";
    setToolbar(false);

    if (persist && titleInput) {
      const newTitle = titleInput.value.trim() || originalTitle || "My List";
      setTitle(newTitle);
      if (onSave) onSave(newTitle);
    } else {
      setTitle(originalTitle);
    }
    if (onExitCb) onExitCb({ persist });
    notifyEditChange();
  };

  const init = ({ title = "My List", onSave, onEditChange, onExit } = {}) => {
    onEditChangeCb = onEditChange;
    onExitCb = onExit;
    setTitle(title);

    if (editBtn) editBtn.addEventListener("click", enterEdit);
    if (cancelBtn) cancelBtn.addEventListener("click", () => exitEdit(false, onSave));
    if (saveBtn) saveBtn.addEventListener("click", () => exitEdit(true, onSave));
  };

  const isEditing = () => editing;

  return { init, setTitle, isEditing };
})();
