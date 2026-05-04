(function attachProfileStore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SHIM_PROFILE_STORE = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createProfileStore() {
  "use strict";

  const selectedProfileKey = "shim.selectedProfileId";
  const overridesKey = "shim.profileOverrides";

  function loadSelectedProfileId(storage, fallbackId) {
    return readStorage(storage, selectedProfileKey) || fallbackId;
  }

  function saveSelectedProfileId(storage, profileId) {
    writeStorage(storage, selectedProfileKey, profileId);
  }

  function loadOverrides(storage) {
    const raw = readStorage(storage, overridesKey);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveOverride(storage, profileId, override) {
    const overrides = loadOverrides(storage);
    overrides[profileId] = {
      groupOrder: [...override.groupOrder],
      disabledGroups: [...(override.disabledGroups || [])],
      groupSortModes: { ...(override.groupSortModes || {}) },
      savedAt: new Date().toISOString()
    };
    writeStorage(storage, overridesKey, JSON.stringify(overrides));
    return overrides[profileId];
  }

  function resetOverride(storage, profileId) {
    const overrides = loadOverrides(storage);
    delete overrides[profileId];
    writeStorage(storage, overridesKey, JSON.stringify(overrides));
  }

  function applyOverrides(profiles, overrides) {
    return profiles.map((profile) => {
      const override = overrides[profile.id];
      if (!override || !Array.isArray(override.groupOrder)) {
        return cloneProfile(profile);
      }
      return {
        ...cloneProfile(profile),
        groupOrder: mergeGroupOrder(override.groupOrder, profile.groupOrder),
        disabledGroups: sanitizeDisabledGroups(override.disabledGroups, profile.groupOrder),
        groupSortModes: sanitizeSortModes(override.groupSortModes, profile.groupOrder),
        hasLocalOverride: true
      };
    });
  }

  function exportOverride(profile) {
    return JSON.stringify({
      profileId: profile.id,
      branchName: profile.branchName || profile.name,
      groupOrder: profile.groupOrder,
      disabledGroups: profile.disabledGroups || [],
      groupSortModes: profile.groupSortModes || {}
    }, null, 2);
  }

  function importOverride(text, profile) {
    const parsed = JSON.parse(String(text || ""));
    if (!parsed || !Array.isArray(parsed.groupOrder)) {
      throw new Error("Imported settings must include a groupOrder array.");
    }
    return {
      groupOrder: mergeGroupOrder(parsed.groupOrder, profile.groupOrder),
      disabledGroups: sanitizeDisabledGroups(parsed.disabledGroups, profile.groupOrder),
      groupSortModes: sanitizeSortModes(parsed.groupSortModes, profile.groupOrder)
    };
  }

  function mergeGroupOrder(candidateOrder, defaultOrder) {
    const defaults = new Set(defaultOrder);
    const result = [];
    for (const group of candidateOrder) {
      if (defaults.has(group) && !result.includes(group)) {
        result.push(group);
      }
    }
    for (const group of defaultOrder) {
      if (!result.includes(group)) {
        result.push(group);
      }
    }
    return result;
  }

  function cloneProfile(profile) {
    const copy = { ...profile };
    for (const [key, value] of Object.entries(copy)) {
      if (Array.isArray(value)) {
        copy[key] = [...value];
      } else if (value && typeof value === "object") {
        copy[key] = { ...value };
      }
    }
    return copy;
  }

  function sanitizeDisabledGroups(groups, defaultOrder) {
    if (!Array.isArray(groups)) {
      return [];
    }
    const allowed = new Set(defaultOrder.filter((group) => group !== "Other"));
    return groups.filter((group, index) => allowed.has(group) && groups.indexOf(group) === index);
  }

  function sanitizeSortModes(modes, defaultOrder) {
    const allowedModes = new Set(["shelf", "raw-call", "title", "author", "barcode"]);
    const allowedGroups = new Set(defaultOrder);
    const result = {};
    if (!modes || typeof modes !== "object") {
      return result;
    }
    for (const [group, mode] of Object.entries(modes)) {
      if (allowedGroups.has(group) && allowedModes.has(mode) && mode !== "shelf") {
        result[group] = mode;
      }
    }
    return result;
  }

  function readStorage(storage, key) {
    try {
      return storage && storage.getItem ? storage.getItem(key) : "";
    } catch (error) {
      return "";
    }
  }

  function writeStorage(storage, key, value) {
    try {
      if (storage && storage.setItem) {
        storage.setItem(key, value);
      }
    } catch (error) {
      // Browser privacy modes can block localStorage; SHIM still works without persistence.
    }
  }

  return {
    selectedProfileKey,
    overridesKey,
    loadSelectedProfileId,
    saveSelectedProfileId,
    loadOverrides,
    saveOverride,
    resetOverride,
    applyOverrides,
    exportOverride,
    importOverride,
    mergeGroupOrder,
    sanitizeDisabledGroups,
    sanitizeSortModes
  };
});
