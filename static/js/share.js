const GeoShare = (() => {
  const shareBtn = document.getElementById("share-btn");
  const sheet = document.getElementById("shareSheet");
  const backdrop = document.getElementById("shareSheetBackdrop");
  const closeBtn = document.getElementById("shareSheetClose");
  const exportButtons = document.querySelectorAll("[data-export]");
  const accessButtons = document.querySelectorAll("[data-share-access]");
  const shareCopyBtn = document.getElementById("shareCopyBtn");
  const shareQrBtn = document.getElementById("shareQrBtn");
  const sharePasswordRow = document.getElementById("sharePasswordRow");
  const sharePasswordStatus = document.getElementById("sharePasswordStatus");
  const shareTitle = document.getElementById("shareSheetTitle");
  const passwordSheet = document.getElementById("sharePasswordSheet");
  const passwordBackdrop = document.getElementById("sharePasswordBackdrop");
  const passwordCloseBtn = document.getElementById("sharePasswordClose");
  const passwordInput = document.getElementById("sharePasswordInput");
  const passwordEditBtn = document.getElementById("sharePasswordEdit");
  const passwordDeleteBtn = document.getElementById("sharePasswordDelete");
  const passwordDoneBtn = document.getElementById("sharePasswordDone");
  const qrSheet = document.getElementById("shareQrSheet");
  const qrBackdrop = document.getElementById("shareQrBackdrop");
  const qrCloseBtn = document.getElementById("shareQrClose");
  const qrDoneBtn = document.getElementById("shareQrDone");
  const qrDownloadBtn = document.getElementById("shareQrDownload");
  const qrCode = document.getElementById("shareQrSheetCode");
  const qrStatus = document.getElementById("shareQrSheetStatus");
  let dataProvider = null;
  let remoteShare = null;
  let remoteSharePromise = null;
  const MAX_QR_DATA_LENGTH = 1200;
  let activeAccess = "view";
  let passwordSet = false;
  let passwordEditing = false;
  let lastQrLink = "";
  const SHARE_ID_STORAGE_KEY = "geoShareId";

  const getStoredShareId = () => {
    try {
      return localStorage.getItem(SHARE_ID_STORAGE_KEY);
    } catch (err) {
      return null;
    }
  };

  const storeShareId = (shareId) => {
    if (!shareId) return;
    try {
      localStorage.setItem(SHARE_ID_STORAGE_KEY, shareId);
    } catch (err) {
      // Storage can be unavailable in private mode or blocked by browser settings.
    }
  };

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

  const escapeXml = (value = "") => {
    const safe = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    return safe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

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

  const buildBaseUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("share");
    url.searchParams.delete("share_id");
    url.searchParams.delete("editable");
    return url;
  };

  const buildShareIdUrl = (shareId, editable = false) => {
    const url = buildBaseUrl();
    url.searchParams.set("share_id", shareId);
    if (editable) url.searchParams.set("editable", "1");
    return url.toString();
  };

  const buildShareUrl = (payload) => {
    // backward compatible
    const encoded = encodePayload(payload);
    const url = buildBaseUrl();
    url.searchParams.set("share", encoded);
    return url.toString();
  };

  const getCurrentShareContext = () => {
    const url = new URL(window.location.href);
    return {
      shareId: url.searchParams.get("share_id"),
      shareParam: url.searchParams.get("share"),
    };
  };

  const getData = () => {
    if (dataProvider) return dataProvider();
    return {
      places: GeoStore?.load ? GeoStore.load() : [],
      title: GeoStore?.loadTitle ? GeoStore.loadTitle() : "My map",
    };
  };

  const setShareTitle = () => {
    if (!shareTitle) return;
    const { title } = getData();
    shareTitle.textContent = title || "My map";
  };

  const openSheet = (target, targetBackdrop) => {
    if (target) {
      target.classList.add("is-open");
      target.setAttribute("aria-hidden", "false");
    }
    if (targetBackdrop) {
      targetBackdrop.classList.add("is-open");
      targetBackdrop.setAttribute("aria-hidden", "false");
    }
  };

  const closeSheet = (target, targetBackdrop) => {
    if (target) {
      target.classList.remove("is-open");
      target.setAttribute("aria-hidden", "true");
    }
    if (targetBackdrop) {
      targetBackdrop.classList.remove("is-open");
      targetBackdrop.setAttribute("aria-hidden", "true");
    }
  };

  const setActiveAccess = (mode) => {
    activeAccess = mode === "edit" ? "edit" : "view";
    accessButtons.forEach((btn) => {
      const isActive = btn.dataset.shareAccess === activeAccess;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const getActiveShareId = () => {
    const current = getCurrentShareContext();
    if (current.shareId) {
      storeShareId(current.shareId);
      return current.shareId;
    }
    if (remoteShare?.id) {
      storeShareId(remoteShare.id);
      return remoteShare.id;
    }
    if (remoteShare?.viewUrl) {
      try {
        const url = new URL(remoteShare.viewUrl);
        const shareId = url.searchParams.get("share_id");
        if (shareId) storeShareId(shareId);
        return shareId;
      } catch (err) {
        return null;
      }
    }
    return getStoredShareId();
  };

  const ensureShareId = async () => {
    const currentId = getActiveShareId();
    if (currentId) return currentId;
    const share = await ensureRemoteShare();
    return share?.id || null;
  };

  const loadPasswordState = async () => {
    const shareId = getActiveShareId();
    if (!shareId) {
      passwordSet = false;
      return false;
    }
    try {
      const response = await fetch(`/api/share/${shareId}/password`);
      if (!response.ok) throw new Error("Password state failed");
      const data = await response.json();
      passwordSet = Boolean(data?.hasPassword);
      return passwordSet;
    } catch (err) {
      console.warn("Password state failed", err);
      passwordSet = false;
      return false;
    }
  };

  const updatePasswordStatus = () => {
    if (!sharePasswordStatus) return;
    sharePasswordStatus.textContent = passwordSet ? "Set" : "";
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

  const buildCsv = (places = []) => {
    const rows = [
      ["Title", "Note", "Address", "Latitude", "Longitude"],
      ...places.map((p) => [
        p.title || "",
        p.note || "",
        p.address || "",
        p.lat ?? "",
        p.lng ?? "",
      ]),
    ];
    return rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            if (/[",\n]/.test(text)) {
              return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
          })
          .join(",")
      )
      .join("\n");
  };

  const buildKml = (places = [], title = "My map") => {
    const items = places
      .map((p) => {
        const name = escapeXml(p.title || "Untitled");
        const address = p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
        const note = p.note ? `${p.note}\n${address}` : address;
        const desc = escapeXml(note);
        return `    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      <Point>
        <coordinates>${p.lng},${p.lat},0</coordinates>
      </Point>
    </Placemark>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(title)}</name>
${items}
  </Document>
</kml>`;
  };

  const toCrc32 = (bytes) => {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j += 1) {
        const mask = -(crc & 1);
        crc = (crc >>> 1) ^ (0xedb88320 & mask);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const getDosTimeDate = (date = new Date()) => {
    const year = Math.max(1980, date.getFullYear()) - 1980;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);
    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    const dosDate = (year << 9) | (month << 5) | day;
    return { dosTime, dosDate };
  };

  const buildKmz = (kmlContent, filename = "doc.kml") => {
    const encoder = new TextEncoder();
    const fileData = encoder.encode(kmlContent);
    const nameBytes = encoder.encode(filename);
    const { dosTime, dosDate } = getDosTimeDate();
    const flags = 0x0800;
    const crc32 = toCrc32(fileData);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    let offset = 0;
    view.setUint32(offset, 0x04034b50, true);
    offset += 4;
    view.setUint16(offset, 20, true);
    offset += 2;
    view.setUint16(offset, flags, true);
    offset += 2;
    view.setUint16(offset, 0, true);
    offset += 2;
    view.setUint16(offset, dosTime, true);
    offset += 2;
    view.setUint16(offset, dosDate, true);
    offset += 2;
    view.setUint32(offset, crc32, true);
    offset += 4;
    view.setUint32(offset, fileData.length, true);
    offset += 4;
    view.setUint32(offset, fileData.length, true);
    offset += 4;
    view.setUint16(offset, nameBytes.length, true);
    offset += 2;
    view.setUint16(offset, 0, true);
    offset += 2;
    localHeader.set(nameBytes, offset);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    offset = 0;
    centralView.setUint32(offset, 0x02014b50, true);
    offset += 4;
    centralView.setUint16(offset, 20, true);
    offset += 2;
    centralView.setUint16(offset, 20, true);
    offset += 2;
    centralView.setUint16(offset, flags, true);
    offset += 2;
    centralView.setUint16(offset, 0, true);
    offset += 2;
    centralView.setUint16(offset, dosTime, true);
    offset += 2;
    centralView.setUint16(offset, dosDate, true);
    offset += 2;
    centralView.setUint32(offset, crc32, true);
    offset += 4;
    centralView.setUint32(offset, fileData.length, true);
    offset += 4;
    centralView.setUint32(offset, fileData.length, true);
    offset += 4;
    centralView.setUint16(offset, nameBytes.length, true);
    offset += 2;
    centralView.setUint16(offset, 0, true);
    offset += 2;
    centralView.setUint16(offset, 0, true);
    offset += 2;
    centralView.setUint16(offset, 0, true);
    offset += 2;
    centralView.setUint16(offset, 0, true);
    offset += 2;
    centralView.setUint32(offset, 0, true);
    offset += 4;
    centralView.setUint32(offset, 0, true);
    offset += 4;
    centralHeader.set(nameBytes, offset);

    const endHeader = new Uint8Array(22);
    const endView = new DataView(endHeader.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, 1, true);
    endView.setUint16(10, 1, true);
    endView.setUint32(12, centralHeader.length, true);
    endView.setUint32(16, localHeader.length + fileData.length, true);
    endView.setUint16(20, 0, true);

    const blobParts = [localHeader, fileData, centralHeader, endHeader];
    return new Blob(blobParts, { type: "application/vnd.google-earth.kmz" });
  };

  const downloadTextFile = (content, filename, mime = "application/octet-stream") => {
    const blob = new Blob([content], { type: mime });
    downloadBlob(blob, filename);
  };

  const downloadBlob = (blob, filename) => {
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

  const shareAsCsv = () => {
    const { places, title } = getData();
    if (!places.length) {
      alert("Add some places on the map");
      return;
    }
    const csv = buildCsv(places);
    const cleanedTitle = (title || "My map").trim().replace(/[\\/:*?"<>|]+/g, "").trim() || "My map";
    const filename = `${cleanedTitle}.csv`;
    downloadTextFile(csv, filename, "text/csv;charset=utf-8");
  };

  const shareAsKmz = () => {
    const { places, title } = getData();
    if (!places.length) {
      alert("Add some places on the map");
      return;
    }
    const kml = buildKml(places, title);
    const kmz = buildKmz(kml, "doc.kml");
    const cleanedTitle = (title || "My map").trim().replace(/[\\/:*?"<>|]+/g, "").trim() || "My map";
    const filename = `${cleanedTitle}.kmz`;
    downloadBlob(kmz, filename);
  };

  const getShareLink = async (editable = false) => {
    const { places, title } = getData();
    if (!places.length) {
      alert("Add some places on the map");
      return "";
    }
    const current = getCurrentShareContext();
    if (current.shareId) {
      return buildShareIdUrl(current.shareId, editable);
    }
    const remote = await ensureRemoteShare();
    if (remote?.editUrl && remote?.viewUrl) {
      return editable ? remote.editUrl : remote.viewUrl;
    }
    if (!editable) {
      const payload = compactPayload({ places, title, editable: false });
      return buildShareUrl(payload);
    }
    alert("Не удалось создать ссылку.");
    return "";
  };

  const copyShareLink = async (editable = false) => {
    const link = await getShareLink(editable);
    if (!link) return;
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
    GeoAnalytics?.track?.("share_link_created");
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
          storeShareId(share.id);
        }
        return share;
      })
      .finally(() => {
        remoteSharePromise = null;
      });
    return remoteSharePromise;
  };

  const renderShareQr = async (editable = false) => {
    if (!qrCode) return;
    qrCode.innerHTML = "";
    if (qrStatus) qrStatus.textContent = "";
    const { places, title } = getData();
    if (!places.length) {
      if (qrStatus) qrStatus.textContent = "Add places to generate a link";
      return;
    }
    let link = "";
    const current = getCurrentShareContext();
    if (current.shareId) {
      link = buildShareIdUrl(current.shareId, editable);
    } else if (editable) {
      if (!remoteShare?.editUrl) {
        if (qrStatus) qrStatus.textContent = "Generating edit link...";
        const share = await ensureRemoteShare();
        if (!share?.editUrl) {
          if (qrStatus) qrStatus.textContent = "Unable to create link";
          return;
        }
      }
      link = remoteShare.editUrl;
    } else {
      const payload = compactPayload({ places, title, editable: false });
      const localLink = buildShareUrl(payload);
      if (localLink.length > MAX_QR_DATA_LENGTH) {
        if (qrStatus) qrStatus.textContent = "Generating short link...";
        if (!remoteShare?.viewUrl) {
          const share = await ensureRemoteShare();
          if (!share?.viewUrl) {
            if (qrStatus) qrStatus.textContent = "Unable to create link";
            return;
          }
        }
        link = remoteShare.viewUrl;
      } else {
        link = localLink;
      }
    }
    lastQrLink = link;
    if (link.length > MAX_QR_DATA_LENGTH) {
      if (qrStatus) qrStatus.textContent = "Link too long for QR";
      return;
    }
    if (GeoQr?.render) GeoQr.render(qrCode, link, 512);
  };

  const openPasswordSheet = async () => {
    const shareId = await ensureShareId();
    if (!shareId) return;
    await loadPasswordState();
    updatePasswordStatus();
    passwordEditing = false;
    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.disabled = passwordSet;
      passwordInput.placeholder = passwordSet ? "Password set" : "Password";
    }
    if (passwordEditBtn) passwordEditBtn.style.display = passwordSet ? "inline-flex" : "none";
    if (passwordDeleteBtn) passwordDeleteBtn.style.display = passwordSet ? "inline-flex" : "none";
    openSheet(passwordSheet, passwordBackdrop);
  };

  const closePasswordSheet = () => {
    closeSheet(passwordSheet, passwordBackdrop);
  };

  const setSharePassword = async (password) => {
    const shareId = await ensureShareId();
    if (!shareId) return false;
    try {
      const response = await fetch(`/api/share/${shareId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error("Password set failed");
      passwordSet = true;
      updatePasswordStatus();
      return true;
    } catch (err) {
      console.warn("Password set failed", err);
      alert("Не удалось сохранить пароль.");
      return false;
    }
  };

  const deleteSharePassword = async () => {
    const shareId = await ensureShareId();
    if (!shareId) return false;
    try {
      const response = await fetch(`/api/share/${shareId}/password`, { method: "DELETE" });
      if (!response.ok) throw new Error("Password delete failed");
      passwordSet = false;
      updatePasswordStatus();
      return true;
    } catch (err) {
      console.warn("Password delete failed", err);
      alert("Не удалось удалить пароль.");
      return false;
    }
  };

  const handlePasswordDone = async () => {
    if (passwordSet && !passwordEditing) {
      closePasswordSheet();
      return;
    }
    const nextPassword = (passwordInput?.value || "").trim();
    if (!nextPassword) {
      alert("Введите пароль.");
      return;
    }
    const ok = await setSharePassword(nextPassword);
    if (ok) {
      passwordEditing = false;
      closePasswordSheet();
    }
  };

  const openQrSheet = async () => {
    openSheet(qrSheet, qrBackdrop);
    if (qrStatus) qrStatus.textContent = "Generating QR...";
    await renderShareQr(activeAccess === "edit");
  };

  const closeQrSheet = () => {
    closeSheet(qrSheet, qrBackdrop);
  };

  const downloadQr = async () => {
    const link = lastQrLink || (await getShareLink(activeAccess === "edit"));
    if (!link || !GeoQr?.getUrl) return;
    try {
      const response = await fetch(GeoQr.getUrl(link, 512));
      if (!response.ok) throw new Error("QR download failed");
      const blob = await response.blob();
      downloadBlob(blob, "share-qr.png");
    } catch (err) {
      console.warn("QR download failed", err);
      window.open(GeoQr.getUrl(link, 512), "_blank");
    }
  };

  const open = async () => {
    openSheet(sheet, backdrop);
    setShareTitle();
    setActiveAccess("view");
    await loadPasswordState();
    updatePasswordStatus();
  };

  const close = () => {
    closeSheet(sheet, backdrop);
  };

  shareBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  passwordCloseBtn?.addEventListener("click", closePasswordSheet);
  passwordBackdrop?.addEventListener("click", closePasswordSheet);
  qrCloseBtn?.addEventListener("click", closeQrSheet);
  qrBackdrop?.addEventListener("click", closeQrSheet);
  qrDoneBtn?.addEventListener("click", closeQrSheet);
  qrDownloadBtn?.addEventListener("click", downloadQr);

  shareCopyBtn?.addEventListener("click", () => {
    copyShareLink(activeAccess === "edit");
  });
  shareQrBtn?.addEventListener("click", openQrSheet);
  sharePasswordRow?.addEventListener("click", openPasswordSheet);
  passwordDoneBtn?.addEventListener("click", handlePasswordDone);

  passwordEditBtn?.addEventListener("click", () => {
    passwordEditing = true;
    if (passwordInput) {
      passwordInput.disabled = false;
      passwordInput.value = "";
      passwordInput.placeholder = "New password";
      passwordInput.focus();
    }
  });

  passwordDeleteBtn?.addEventListener("click", async () => {
    const ok = await deleteSharePassword();
    if (ok) closePasswordSheet();
  });

  accessButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveAccess(btn.dataset.shareAccess || "view");
    });
  });

  exportButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.export;
      if (type === "gpx") {
        shareAsGpx();
      } else if (type === "csv") {
        shareAsCsv();
      } else if (type === "kmz") {
        shareAsKmz();
      }
    });
  });

  const setDataProvider = (fn) => {
    dataProvider = fn;
  };

  return { open, close, decodePayload, setDataProvider, normalizePlaces };
})();
