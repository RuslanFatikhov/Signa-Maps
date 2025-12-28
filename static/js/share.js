const GeoShare = (() => {
  const shareBtn = document.getElementById("share-btn");
  const sheet = document.getElementById("shareSheet");
  const backdrop = document.getElementById("shareSheetBackdrop");
  const closeBtn = document.getElementById("shareSheetClose");
  const options = document.querySelectorAll("[data-share]");
  const shareListBtn = document.getElementById("shareListBtn");
  const editableToggle = document.getElementById("shareEditableToggle");
  const shareQrCode = document.getElementById("shareSheetQrCode");
  const shareQrLabel = document.getElementById("shareSheetQrLabel");
  let dataProvider = null;
  let remoteShare = null;
  let remoteSharePromise = null;

  // Lightweight LZ-based compressor (subset of lz-string, MIT) to shrink shared URLs.
  const LZString = (() => {
    const f = String.fromCharCode;
    const keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
    const baseReverseDic = {};

    const getBaseValue = (alphabet, character) => {
      if (!baseReverseDic[alphabet]) {
        baseReverseDic[alphabet] = {};
        for (let i = 0; i < alphabet.length; i++) baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
      return baseReverseDic[alphabet][character];
    };

    const compressToEncodedURIComponent = (input) => {
      if (input == null) return "";
      return compress(input, 6, (a) => keyStrUriSafe.charAt(a));
    };

    const decompressFromEncodedURIComponent = (input) => {
      if (input == null) return "";
      if (input === "") return null;
      const sanitized = input.replace(/ /g, "+");
      return decompress(sanitized.length, 32, (index) => getBaseValue(keyStrUriSafe, sanitized.charAt(index)));
    };

    const compress = (uncompressed, bitsPerChar, getCharFromInt) => {
      if (uncompressed == null) return "";
      let i;
      let value;
      const contextDictionary = {};
      const contextDictionaryToCreate = {};
      let contextC = "";
      let contextWC = "";
      let contextW = "";
      let contextEnlargeIn = 2;
      let contextDictSize = 3;
      let contextNumBits = 2;
      const contextData = [];
      let contextDataVal = 0;
      let contextDataPosition = 0;

      for (let ii = 0; ii < uncompressed.length; ii += 1) {
        contextC = uncompressed.charAt(ii);
        if (!Object.prototype.hasOwnProperty.call(contextDictionary, contextC)) {
          contextDictionary[contextC] = contextDictSize++;
          contextDictionaryToCreate[contextC] = true;
        }

        contextWC = contextW + contextC;
        if (Object.prototype.hasOwnProperty.call(contextDictionary, contextWC)) {
          contextW = contextWC;
        } else {
          if (Object.prototype.hasOwnProperty.call(contextDictionaryToCreate, contextW)) {
            if (contextW.charCodeAt(0) < 256) {
              for (i = 0; i < contextNumBits; i++) {
                contextDataVal <<= 1;
                if (contextDataPosition === bitsPerChar - 1) {
                  contextDataPosition = 0;
                  contextData.push(getCharFromInt(contextDataVal));
                  contextDataVal = 0;
                } else {
                  contextDataPosition++;
                }
              }
              value = contextW.charCodeAt(0);
              for (i = 0; i < 8; i++) {
                contextDataVal = (contextDataVal << 1) | (value & 1);
                if (contextDataPosition === bitsPerChar - 1) {
                  contextDataPosition = 0;
                  contextData.push(getCharFromInt(contextDataVal));
                  contextDataVal = 0;
                } else {
                  contextDataPosition++;
                }
                value >>= 1;
              }
            } else {
              value = 1;
              for (i = 0; i < contextNumBits; i++) {
                contextDataVal = (contextDataVal << 1) | value;
                if (contextDataPosition === bitsPerChar - 1) {
                  contextDataPosition = 0;
                  contextData.push(getCharFromInt(contextDataVal));
                  contextDataVal = 0;
                } else {
                  contextDataPosition++;
                }
                value = 0;
              }
              value = contextW.charCodeAt(0);
              for (i = 0; i < 16; i++) {
                contextDataVal = (contextDataVal << 1) | (value & 1);
                if (contextDataPosition === bitsPerChar - 1) {
                  contextDataPosition = 0;
                  contextData.push(getCharFromInt(contextDataVal));
                  contextDataVal = 0;
                } else {
                  contextDataPosition++;
                }
                value >>= 1;
              }
            }
            contextEnlargeIn--;
            if (contextEnlargeIn === 0) {
              contextEnlargeIn = Math.pow(2, contextNumBits);
              contextNumBits++;
            }
            delete contextDictionaryToCreate[contextW];
          } else {
            value = contextDictionary[contextW];
            for (i = 0; i < contextNumBits; i++) {
              contextDataVal = (contextDataVal << 1) | (value & 1);
              if (contextDataPosition === bitsPerChar - 1) {
                contextDataPosition = 0;
                contextData.push(getCharFromInt(contextDataVal));
                contextDataVal = 0;
              } else {
                contextDataPosition++;
              }
              value >>= 1;
            }
          }
          contextEnlargeIn--;
          if (contextEnlargeIn === 0) {
            contextEnlargeIn = Math.pow(2, contextNumBits);
            contextNumBits++;
          }
          contextDictionary[contextWC] = contextDictSize++;
          contextW = String(contextC);
        }
      }

      if (contextW !== "") {
        if (Object.prototype.hasOwnProperty.call(contextDictionaryToCreate, contextW)) {
          if (contextW.charCodeAt(0) < 256) {
            for (i = 0; i < contextNumBits; i++) {
              contextDataVal <<= 1;
              if (contextDataPosition === bitsPerChar - 1) {
                contextDataPosition = 0;
                contextData.push(getCharFromInt(contextDataVal));
                contextDataVal = 0;
              } else {
                contextDataPosition++;
              }
            }
            value = contextW.charCodeAt(0);
            for (i = 0; i < 8; i++) {
              contextDataVal = (contextDataVal << 1) | (value & 1);
              if (contextDataPosition === bitsPerChar - 1) {
                contextDataPosition = 0;
                contextData.push(getCharFromInt(contextDataVal));
                contextDataVal = 0;
              } else {
                contextDataPosition++;
              }
              value >>= 1;
            }
          } else {
            value = 1;
            for (i = 0; i < contextNumBits; i++) {
              contextDataVal = (contextDataVal << 1) | value;
              if (contextDataPosition === bitsPerChar - 1) {
                contextDataPosition = 0;
                contextData.push(getCharFromInt(contextDataVal));
                contextDataVal = 0;
              } else {
                contextDataPosition++;
              }
              value = 0;
            }
            value = contextW.charCodeAt(0);
            for (i = 0; i < 16; i++) {
              contextDataVal = (contextDataVal << 1) | (value & 1);
              if (contextDataPosition === bitsPerChar - 1) {
                contextDataPosition = 0;
                contextData.push(getCharFromInt(contextDataVal));
                contextDataVal = 0;
              } else {
                contextDataPosition++;
              }
              value >>= 1;
            }
          }
          contextEnlargeIn--;
          if (contextEnlargeIn === 0) {
            contextEnlargeIn = Math.pow(2, contextNumBits);
            contextNumBits++;
          }
          delete contextDictionaryToCreate[contextW];
        } else {
          value = contextDictionary[contextW];
          for (i = 0; i < contextNumBits; i++) {
            contextDataVal = (contextDataVal << 1) | (value & 1);
            if (contextDataPosition === bitsPerChar - 1) {
              contextDataPosition = 0;
              contextData.push(getCharFromInt(contextDataVal));
              contextDataVal = 0;
            } else {
              contextDataPosition++;
            }
            value >>= 1;
          }
        }
        contextEnlargeIn--;
        if (contextEnlargeIn === 0) {
          contextEnlargeIn = Math.pow(2, contextNumBits);
          contextNumBits++;
        }
      }

      value = 2;
      for (i = 0; i < contextNumBits; i++) {
        contextDataVal = (contextDataVal << 1) | (value & 1);
        if (contextDataPosition === bitsPerChar - 1) {
          contextDataPosition = 0;
          contextData.push(getCharFromInt(contextDataVal));
          contextDataVal = 0;
        } else {
          contextDataPosition++;
        }
        value >>= 1;
      }

      while (true) {
        contextDataVal <<= 1;
        if (contextDataPosition === bitsPerChar - 1) {
          contextData.push(getCharFromInt(contextDataVal));
          break;
        }
        contextDataPosition++;
      }
      return contextData.join("");
    };

    const decompress = (length, resetValue, getNextValue) => {
      const dictionary = [];
      let next;
      let enlargeIn = 4;
      let dictSize = 4;
      let numBits = 3;
      let entry = "";
      const result = [];
      let i;
      let w;
      let bits;
      let resb;
      let maxpower;
      let power;
      let c;
      const data = { val: getNextValue(0), position: resetValue, index: 1 };

      for (i = 0; i < 3; i += 1) {
        dictionary[i] = i;
      }

      bits = 0;
      maxpower = Math.pow(2, 2);
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch ((next = bits)) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          c = f(bits);
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          c = f(bits);
          break;
        case 2:
          return "";
        default:
          c = "";
      }

      dictionary[3] = c;
      w = c;
      result.push(c);
      while (true) {
        if (data.index > length) return "";
        bits = 0;
        maxpower = Math.pow(2, numBits);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }

        switch ((c = bits)) {
          case 0:
            bits = 0;
            maxpower = Math.pow(2, 8);
            power = 1;
            while (power !== maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position === 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            c = dictSize - 1;
            enlargeIn--;
            break;
          case 1:
            bits = 0;
            maxpower = Math.pow(2, 16);
            power = 1;
            while (power !== maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position === 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            c = dictSize - 1;
            enlargeIn--;
            break;
          case 2:
            return result.join("");
        }

        if (enlargeIn === 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }

        if (dictionary[c]) {
          entry = dictionary[c];
        } else {
          if (c === dictSize) {
            entry = w + w.charAt(0);
          } else {
            return null;
          }
        }
        result.push(entry);
        dictionary[dictSize++] = w + entry.charAt(0);
        enlargeIn--;

        if (enlargeIn === 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }

        w = entry;
      }
    };

    return { compressToEncodedURIComponent, decompressFromEncodedURIComponent };
  })();

  const normalizePlaces = (places = []) =>
    places
      .map((place, idx) => {
        if (!place) return null;
        const lat = Number(place.lat);
        const lng = Number(place.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: place.id || `p${idx}`,
          title: place.title || "",
          lat,
          lng,
          note: place.note || "",
          address: place.address || "",
          createdAt: place.createdAt || Date.now(),
        };
      })
      .filter(Boolean);

  // Remove heavy fields (e.g., photos) and shorten ids to keep the link smaller.
  const compactPayload = ({ places = [], title = "My map", editable = false } = {}) => {
    const normalized = normalizePlaces(places);
    const compactPlaces = normalized.map((place, idx) => ({
      id: `p${idx}`,
      title: place.title,
      lat: place.lat,
      lng: place.lng,
      note: place.note,
      address: place.address,
      createdAt: place.createdAt,
    }));
    return {
      title: title || "My map",
      places: compactPlaces,
      editable: Boolean(editable),
    };
  };

  const escapeXml = (value = "") =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const encodePayload = (payload) => {
    const json = JSON.stringify(payload);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    const compressed = LZString.compressToEncodedURIComponent(json);
    if (compressed && compressed.length < base64.length) return compressed;
    return base64;
  };

  const decodePayload = (value) => {
    if (!value) return null;
    const tryParse = (raw) => {
      try {
        return JSON.parse(raw);
      } catch (err) {
        return null;
      }
    };

    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(value);
      const parsed = tryParse(decompressed);
      if (parsed) {
        return {
          title: parsed.title || "My map",
          places: normalizePlaces(parsed.places || parsed.p || []),
          editable: Boolean(parsed.editable),
        };
      }
    } catch (err) {
      console.warn("Failed to decompress shared payload", err);
    }

    try {
      const json = decodeURIComponent(escape(atob(value)));
      const parsed = tryParse(json);
      if (parsed) {
        return {
          title: parsed.title || "My map",
          places: normalizePlaces(parsed.places || parsed.p || []),
          editable: Boolean(parsed.editable),
        };
      }
    } catch (err) {
      console.warn("Failed to decode shared payload", err);
    }

    return null;
  };

  const buildShareUrl = (payload) => {
    const encoded = encodePayload(payload);
    const url = new URL(window.location.href);
    url.searchParams.set("share", encoded);
    return url.toString();
  };

  const getData = () => {
    if (dataProvider) return dataProvider();
    return {
      places: GeoStore?.load ? GeoStore.load() : [],
      title: GeoStore?.loadTitle ? GeoStore.loadTitle() : "My map",
    };
  };

  const buildGpx = (places = [], title = "My map") => {
    const metaTime = new Date().toISOString();
    const wpts = places
      .map((p) => {
        const name = escapeXml(p.title || "Untitled");
        const address = p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
        const note = p.note ? `${p.note}\n${address}` : address;
        const desc = escapeXml(note);
        return `  <wpt lat="${p.lat}" lon="${p.lng}">
    <name>${name}</name>
    <desc>${desc}</desc>
  </wpt>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoNotion" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(title)}</name>
    <time>${metaTime}</time>
  </metadata>
${wpts}
</gpx>`;
  };

  const downloadTextFile = (content, filename, mime = "application/octet-stream") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const shareAsGpx = () => {
    const { places, title } = getData();
    if (!places.length) {
      alert("Add some places on the map");
      return;
    }
    const gpx = buildGpx(places, title);
    const cleanedTitle = (title || "My map").trim().replace(/[\\/:*?"<>|]+/g, "").trim() || "My map";
    const filename = `${cleanedTitle}.gpx`;
    downloadTextFile(gpx, filename, "application/gpx+xml");
  };

  const shareLink = async () => {
    const { places, title } = getData();
    if (!places.length) {
      alert("Нет мест для ссылки.");
      return;
    }
    const payload = compactPayload({ places, title, editable: false });
    const link = buildShareUrl(payload);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        copied = true;
      }
    } catch (err) {
      console.warn("Clipboard write failed", err);
    }
    if (!copied) {
      prompt("Скопируйте ссылку:", link);
    }
    GeoToast?.show?.({
      title: "Link copied",
    });
  };

  const createRemoteShare = async () => {
    const { places, title } = getData();
    if (!places.length) {
      alert("Нет мест для ссылки.");
      return null;
    }
    try {
      const normalized = normalizePlaces(places);
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, places: normalized }),
      });
      if (!response.ok) throw new Error("Share create failed");
      return await response.json();
    } catch (err) {
      console.warn("Remote share create failed", err);
      alert("Не удалось создать ссылку.");
      return null;
    }
  };

  const ensureRemoteShare = async () => {
    if (remoteShare?.editUrl) return remoteShare;
    if (remoteSharePromise) return remoteSharePromise;
    remoteSharePromise = createRemoteShare()
      .then((share) => {
        if (share?.editUrl) {
          remoteShare = share;
        }
        return share;
      })
      .finally(() => {
        remoteSharePromise = null;
      });
    return remoteSharePromise;
  };

  const shareMagicLink = async () => {
    const remote = await ensureRemoteShare();
    if (!remote?.editUrl) return;
    const link = remote.editUrl;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        copied = true;
      }
    } catch (err) {
      console.warn("Clipboard write failed", err);
    }
    if (!copied) {
      prompt("Скопируйте ссылку:", link);
    }
    GeoToast?.show?.({
      title: "Magic link copied",
    });
  };

  const renderShareQr = async (editable = false) => {
    if (!shareQrCode) return;
    shareQrCode.innerHTML = "";
    const { places, title } = getData();
    if (!places.length) {
      if (shareQrLabel) shareQrLabel.textContent = "Add places to generate a link";
      return;
    }
    let link = "";
    if (editable) {
      if (!remoteShare?.editUrl) {
        if (shareQrLabel) shareQrLabel.textContent = "Generating edit link...";
        const share = await ensureRemoteShare();
        if (!share?.editUrl) {
          if (shareQrLabel) shareQrLabel.textContent = "Не удалось создать ссылку.";
          return;
        }
      }
      link = remoteShare.editUrl;
    } else {
      const payload = compactPayload({ places, title, editable: false });
      link = buildShareUrl(payload);
    }
    if (GeoQr?.render) GeoQr.render(shareQrCode, link, 512);
    if (shareQrLabel) {
      shareQrLabel.textContent = editable ? "QR for edit link" : "QR for view-only link";
    }
  };

  const open = () => {
    if (sheet) {
      sheet.classList.add("is-open");
      sheet.setAttribute("aria-hidden", "false");
    }
    if (backdrop) {
      backdrop.classList.add("is-open");
      backdrop.setAttribute("aria-hidden", "false");
    }
    if (editableToggle) {
      editableToggle.checked = false;
    }
    renderShareQr(false);
  };

  const close = () => {
    if (sheet) {
      sheet.classList.remove("is-open");
      sheet.setAttribute("aria-hidden", "true");
    }
    if (backdrop) {
      backdrop.classList.remove("is-open");
      backdrop.setAttribute("aria-hidden", "true");
    }
  };

  shareBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  shareListBtn?.addEventListener("click", () => {
    if (editableToggle?.checked) {
      shareMagicLink();
    } else {
      shareLink();
    }
    close();
  });
  editableToggle?.addEventListener("change", () => {
    renderShareQr(Boolean(editableToggle?.checked));
  });

  options.forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.share;
      if (type === "gpx") {
        shareAsGpx();
      } else if (type === "link") {
        shareLink();
      } else if (type === "magic") {
        shareMagicLink();
      }
      close();
    });
  });

  const setDataProvider = (fn) => {
    dataProvider = fn;
  };

  return { open, close, decodePayload, setDataProvider, normalizePlaces };
})();
