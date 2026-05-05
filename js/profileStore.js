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
      categoryRules: cloneProfile(override.categoryRules || {}),
      groupSortSettings: cloneProfile(override.groupSortSettings || {}),
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
      const groupOrder = mergeGroupOrder(override.groupOrder, profile.groupOrder);
      return {
        ...cloneProfile(profile),
        groupOrder,
        disabledGroups: sanitizeDisabledGroups(override.disabledGroups, groupOrder),
        groupSortModes: sanitizeSortModes(override.groupSortModes, groupOrder),
        categoryRules: sanitizeCategoryRules(override.categoryRules, groupOrder),
        groupSortSettings: sanitizeGroupSortSettings(override.groupSortSettings, groupOrder),
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
      groupSortModes: profile.groupSortModes || {},
      categoryRules: profile.categoryRules || {},
      groupSortSettings: profile.groupSortSettings || {}
    }, null, 2);
  }

  function importOverride(text, profile) {
    const parsed = JSON.parse(String(text || ""));
    if (!parsed || !Array.isArray(parsed.groupOrder)) {
      throw new Error("Imported settings must include a groupOrder array.");
    }
    return {
      groupOrder: mergeGroupOrder(parsed.groupOrder, profile.groupOrder),
      disabledGroups: sanitizeDisabledGroups(parsed.disabledGroups, parsed.groupOrder || profile.groupOrder),
      groupSortModes: sanitizeSortModes(parsed.groupSortModes, parsed.groupOrder || profile.groupOrder),
      categoryRules: sanitizeCategoryRules(parsed.categoryRules, parsed.groupOrder || profile.groupOrder),
      groupSortSettings: sanitizeGroupSortSettings(parsed.groupSortSettings, parsed.groupOrder || profile.groupOrder)
    };
  }

  function mergeGroupOrder(candidateOrder, defaultOrder) {
    const result = [];
    for (const group of Array.isArray(candidateOrder) ? candidateOrder : []) {
      if (isValidGroupName(group) && !result.includes(group) && group !== "Other") {
        result.push(group);
      }
    }
    for (const group of defaultOrder) {
      if (isValidGroupName(group) && !result.includes(group) && group !== "Other") {
        result.push(group);
      }
    }
    result.push("Other");
    return result;
  }

  function cloneProfile(profile) {
    if (Array.isArray(profile)) {
      return profile.map(cloneProfile);
    }
    if (profile && typeof profile === "object") {
      const copy = {};
      for (const [key, value] of Object.entries(profile)) {
        copy[key] = cloneProfile(value);
      }
      return copy;
    }
    return profile;
  }

  function sanitizeDisabledGroups(groups, defaultOrder) {
    if (!Array.isArray(groups)) {
      return [];
    }
    const allowed = new Set(mergeGroupOrder(defaultOrder, []).filter((group) => group !== "Other"));
    return groups.filter((group, index) => allowed.has(group) && groups.indexOf(group) === index);
  }

  function sanitizeSortModes(modes, defaultOrder) {
    const allowedModes = new Set(["shelf", "raw-call", "title", "author", "barcode"]);
    const allowedGroups = new Set(mergeGroupOrder(defaultOrder, []));
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

  function sanitizeCategoryRules(rules, defaultOrder) {
    const allowedGroups = new Set(mergeGroupOrder(defaultOrder, []));
    const result = {};
    if (!rules || typeof rules !== "object") {
      return result;
    }
    for (const [group, rule] of Object.entries(rules)) {
      if (!allowedGroups.has(group) || !rule || typeof rule !== "object") {
        continue;
      }
      result[group] = {
        matchPresets: Array.isArray(rule.matchPresets) ? uniqueStrings(rule.matchPresets) : [],
        matchConditions: Array.isArray(rule.matchConditions)
          ? rule.matchConditions.filter((condition) => condition && condition.value).map((condition) => ({
            field: String(condition.field || "callNumber"),
            operator: condition.operator === "startsWith" ? "startsWith" : "contains",
            value: String(condition.value || "").trim()
          }))
          : []
      };
    }
    return result;
  }

  function sanitizeGroupSortSettings(settings, defaultOrder) {
    const allowedGroups = new Set(mergeGroupOrder(defaultOrder, []));
    const result = {};
    if (!settings || typeof settings !== "object") {
      return result;
    }
    for (const [group, groupSettings] of Object.entries(settings)) {
      if (!allowedGroups.has(group) || !groupSettings || typeof groupSettings !== "object") {
        continue;
      }
      result[group] = {
        ignorePrefixes: Array.isArray(groupSettings.ignorePrefixes) ? uniqueStrings(groupSettings.ignorePrefixes) : [],
        subgroups: Array.isArray(groupSettings.subgroups) ? uniqueStrings(groupSettings.subgroups) : [],
        interfileSubgroups: groupSettings.interfileSubgroups !== false
      };
    }
    return result;
  }

  function uniqueStrings(items) {
    const result = [];
    for (const item of items) {
      const value = String(item || "").trim();
      if (value && !result.includes(value)) {
        result.push(value);
      }
    }
    return result;
  }

  function isValidGroupName(value) {
    return typeof value === "string" && value.trim().length > 0;
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
    sanitizeSortModes,
    sanitizeCategoryRules,
    sanitizeGroupSortSettings
  };
});
