(function attachCore(root, factory) {
  const profile = typeof module === "object" && module.exports
    ? require("./profile")
    : root.SHIM_PROFILE;
  const api = factory(profile);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SHIM = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore(profileRegistry) {
  "use strict";

  const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/;
  const barcodePattern = /\b\d{14}\b/;
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
    ignorePunctuation: true
  });

  const builtInProfiles = normalizeProfileRegistry(profileRegistry);
  const categoryLibrary = Array.isArray(profileRegistry.categoryLibrary)
    ? profileRegistry.categoryLibrary.map(cloneProfile)
    : [];
  const defaultProfileId = profileRegistry.defaultProfileId || builtInProfiles[0].id;
  let profile = resolveProfile(defaultProfileId);
  let collectionLookup = buildCollectionLookup(profile);
  let groupRank = buildGroupRank(profile);

  function formatHolds(rawText, profileInput) {
    setActiveProfile(profileInput);
    const parseResult = parseHolds(rawText);
    const records = parseResult.records.map((record, index) => ({
      ...record,
      inputIndex: index,
      reviewReasons: []
    }));

    markDuplicateBarcodes(records);

    for (const record of records) {
      record.group = classifyRecord(record);
      record.sortKey = buildSortKey(record);
    }

    records.sort(compareRecords);

    const groups = profile.groupOrder.map((name) => ({
      name,
      items: records.filter((record) => record.group === name)
    })).filter((group) => group.items.length > 0);

    const report = buildReport(parseResult, records);

    return {
      profileName: profile.name,
      records,
      groups,
      report
    };
  }

  function setActiveProfile(profileInput) {
    profile = resolveProfile(profileInput);
    collectionLookup = buildCollectionLookup(profile);
    groupRank = buildGroupRank(profile);
  }

  function resolveProfile(profileInput) {
    if (!profileInput) {
      return cloneProfile(builtInProfiles.find((item) => item.id === defaultProfileId) || builtInProfiles[0]);
    }
    if (typeof profileInput === "string") {
      return cloneProfile(builtInProfiles.find((item) => item.id === profileInput) || builtInProfiles[0]);
    }
    if (profileInput.id && profileInput.groupOrder) {
      return cloneProfile(profileInput);
    }
    return cloneProfile(builtInProfiles[0]);
  }

  function getProfiles() {
    return builtInProfiles.map(cloneProfile);
  }

  function getCategoryLibrary() {
    return categoryLibrary.map(cloneProfile);
  }

  function normalizeProfileRegistry(registry) {
    if (Array.isArray(registry)) {
      return registry.map(cloneProfile);
    }
    if (registry && Array.isArray(registry.profiles)) {
      return registry.profiles.map(cloneProfile);
    }
    return [cloneProfile(registry)];
  }

  function buildCollectionLookup(activeProfile) {
    return new Map(activeProfile.knownCollections.map((name) => [normalizeText(name), name]));
  }

  function buildGroupRank(activeProfile) {
    return new Map(activeProfile.groupOrder.map((group, index) => [group, index]));
  }

  function cloneProfile(source) {
    if (Array.isArray(source)) {
      return source.map(cloneProfile);
    }
    if (source && typeof source === "object") {
      const copy = {};
      for (const [key, value] of Object.entries(source)) {
        copy[key] = cloneProfile(value);
      }
      return copy;
    }
    return source;
  }

  function parseHolds(rawText) {
    const text = String(rawText || "").replace(/\r\n?/g, "\n");
    const lines = text.split("\n");
    const countBanners = [];
    const records = [];
    const unparsedBlocks = [];

    lines.forEach((line, index) => {
      const countMatch = line.match(/\b(\d+)\s+items?\s+found\b/i);
      if (countMatch) {
        countBanners.push({
          line: index + 1,
          count: Number(countMatch[1]),
          text: clean(line)
        });
      }
    });

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!isHoldMetadataLine(line)) {
        continue;
      }

      const parsed = parseMetadataLine(line);
      if (!parsed.ok) {
        unparsedBlocks.push({
          line: index + 1,
          text: clean(line),
          reason: parsed.reason
        });
        continue;
      }

      const scannedTitle = scanTitle(lines, index);
      const title = chooseTitle(parsed.leadingFields, scannedTitle);
      const author = chooseAuthor(parsed.leadingFields, scannedTitle);

      records.push({
        line: index + 1,
        title: title || "[Title missing]",
        author,
        collection: parsed.collection,
        location: parsed.location,
        itemType: parsed.itemType,
        callNumber: parsed.callNumber,
        barcodeText: parsed.barcodeText,
        barcode: parsed.barcode,
        sendTo: parsed.sendTo,
        date: parsed.date,
        rawLine: line
      });
    }

    return {
      rawText: text,
      countBanners,
      estimatedInputCount: estimateInputCount(countBanners, records.length),
      records,
      unparsedBlocks
    };
  }

  function isHoldMetadataLine(line) {
    return barcodePattern.test(line) && datePattern.test(line);
  }

  function parseMetadataLine(line) {
    const fields = line.split("\t").map(clean);
    const barcodeIndex = fields.findIndex((field) => barcodePattern.test(field));
    const dateIndex = findLastIndex(fields, (field) => datePattern.test(field));

    if (barcodeIndex < 0 || dateIndex < 0 || dateIndex <= barcodeIndex) {
      return { ok: false, reason: "Could not find barcode/date fields." };
    }

    const beforeBarcode = fields.slice(0, barcodeIndex);
    const collectionIndex = findCollectionIndex(beforeBarcode);
    if (collectionIndex < 0) {
      return { ok: false, reason: "Could not identify collection field." };
    }

    const right = beforeBarcode.slice(collectionIndex + 1);
    if (right.length < 2) {
      return { ok: false, reason: "Not enough fields after collection." };
    }

    let location = "";
    let itemType = "";
    let callNumber = "";

    if (right.length >= 3) {
      location = right[0] || "";
      itemType = right[1] || "";
      callNumber = right.slice(2).join(" ").trim();
    } else {
      itemType = right[0] || "";
      callNumber = right[1] || "";
    }

    const barcodeText = fields[barcodeIndex] || "";
    const barcodeMatch = barcodeText.match(barcodePattern);
    const dateMatch = fields[dateIndex].match(datePattern);

    return {
      ok: true,
      leadingFields: beforeBarcode.slice(0, collectionIndex),
      collection: collectionLookup.get(normalizeText(beforeBarcode[collectionIndex])) || beforeBarcode[collectionIndex],
      location,
      itemType,
      callNumber,
      barcodeText,
      barcode: barcodeMatch ? barcodeMatch[0] : "",
      sendTo: fields.slice(barcodeIndex + 1, dateIndex).filter(Boolean).join(" "),
      date: dateMatch ? dateMatch[0] : fields[dateIndex]
    };
  }

  function findCollectionIndex(fields) {
    for (let index = 0; index < fields.length; index += 1) {
      if (collectionLookup.has(normalizeText(fields[index]))) {
        return index;
      }
    }

    if (fields.length >= 4) {
      return fields.length - 4;
    }

    return -1;
  }

  function scanTitle(lines, metadataIndex) {
    const block = [];
    for (let index = metadataIndex - 1; index >= 0; index -= 1) {
      const line = clean(lines[index]);
      if (!line) {
        if (block.length > 0) {
          break;
        }
        continue;
      }
      if (isHoldMetadataLine(line)) {
        break;
      }
      if (isIgnorableTitleLine(line)) {
        if (block.length > 0) {
          break;
        }
        continue;
      }
      if (line.includes("\t")) {
        if (block.length > 0) {
          break;
        }
        continue;
      }
      block.unshift(line);
    }
    return clean(block.join(" "));
  }

  function chooseTitle(leadingFields, scannedTitle) {
    const fields = leadingFields.filter(Boolean);
    if (fields.length >= 2) {
      return clean(fields.slice(0, -1).join(" "));
    }
    if (fields.length === 1 && !scannedTitle) {
      return fields[0];
    }
    return scannedTitle;
  }

  function chooseAuthor(leadingFields, scannedTitle) {
    const fields = leadingFields.filter(Boolean);
    if (fields.length >= 2) {
      return fields[fields.length - 1];
    }
    if (fields.length === 1 && scannedTitle) {
      return fields[0];
    }
    return "";
  }

  function isIgnorableTitleLine(line) {
    const normalized = normalizeText(line);
    if (!normalized) {
      return true;
    }
    if (/^\d+\s+ITEMS?\s+FOUND\b/.test(normalized)) {
      return true;
    }
    if (normalized.includes("TITLE AUTHOR COLLECTION SHELVING LOCATION ITEM TYPE CALL NUMBER BARCODE SEND TO DATE")) {
      return true;
    }
    if ([
      "KOHA",
      "CIRCULATION",
      "PATRONS",
      "SEARCH",
      "MORE",
      "CHECK OUT",
      "CHECK IN",
      "RENEW",
      "SEARCH CATALOG",
      "HOME",
      "RESULTS",
      "HELP",
      "HOLDS QUEUE",
      "TITLE",
      "AUTHOR",
      "COLLECTION",
      "LOCATION",
      "SHELVING LOCATION",
      "ITEM TYPE",
      "CALL NUMBER",
      "BARCODE",
      "SEND TO",
      "DATE",
      "LIBRARY:",
      "ITEM TYPE:",
      "COLLECTION:",
      "SHELVING LOCATION:",
      "ALL"
    ].includes(normalized)) {
      return true;
    }
    if (/^ENTER PATRON/.test(normalized) || /^MWINTERMAN\b/.test(normalized)) {
      return true;
    }
    if (/^ALL[A-Z]/.test(normalized)) {
      return true;
    }
    return false;
  }

  function estimateInputCount(countBanners, parsedCount) {
    if (countBanners.length === 1) {
      return countBanners[0].count;
    }
    return parsedCount;
  }

  function markDuplicateBarcodes(records) {
    const byBarcode = new Map();
    for (const record of records) {
      if (!record.barcode) {
        continue;
      }
      const list = byBarcode.get(record.barcode) || [];
      list.push(record);
      byBarcode.set(record.barcode, list);
    }

    for (const duplicates of byBarcode.values()) {
      if (duplicates.length <= 1) {
        continue;
      }
      for (const record of duplicates) {
        record.reviewReasons.push(`Duplicate barcode ${record.barcode}`);
      }
    }
  }

  function classifyRecord(record) {
    if (profile.ruleMode === "custom") {
      return classifyCustomRecord(record);
    }

    const text = recordText(record);
    const collection = normalizeText(record.collection);

    if (record.reviewReasons.length > 0) {
      return "Other";
    }
    if (isSpecial(record)) {
      const group = chooseGroup(["Special Collections"]);
      if (group) {
        return group;
      }
    }
    if (isDvdOrBluRay(record)) {
      const group = chooseGroup(["BluRays and DVDs"]);
      if (group) {
        return group;
      }
    }
    if (isMusicCd(record)) {
      const group = chooseGroup(["Music CDs"]);
      if (group) {
        return group;
      }
    }
    if (isAudiobookCd(record)) {
      const group = chooseGroup(["Audiobook CDs"]);
      if (group) {
        return group;
      }
    }
    if (isNevada(record)) {
      const group = chooseGroup(["Nevada Collection"]);
      if (group) {
        return group;
      }
    }
    if (isWorldLanguage(record)) {
      const group = chooseGroup([isChildOrYa(record) ? "Children's World Language" : "Adult World Language"]);
      if (group) {
        return group;
      }
    }

    if (isLargePrint(record)) {
      if (isNew(record)) {
        const group = chooseGroup(["NEW Large Print"]);
        if (group) {
          return group;
        }
      }
      if (isAdultFictionLike(record)) {
        const group = chooseGroup(["Large Print Fiction", "Adult Fiction"]);
        if (group) {
          return group;
        }
      }
      if (isAdultBiography(record)) {
        const group = chooseGroup(["Biography"]);
        if (group) {
          return group;
        }
      }
      if (isAdultNonfictionLike(record)) {
        const group = chooseGroup(["Adult Nonfiction"]);
        if (group) {
          return group;
        }
      }
    }

    if (isAdultBiography(record)) {
      const group = chooseGroup(isNew(record) ? ["New Adult Biography", "Biography"] : ["Biography"]);
      if (group) {
        return group;
      }
    }
    if (isAdultFictionLike(record)) {
      const group = chooseGroup(isNew(record) ? ["New Adult Fiction", "Adult Fiction"] : ["Adult Fiction"]);
      if (group) {
        return group;
      }
    }
    if (isAdultNonfictionLike(record)) {
      const group = chooseGroup(isNew(record) ? ["New Adult Nonfiction", "Adult Nonfiction"] : ["Adult Nonfiction"]);
      if (group) {
        return group;
      }
    }
    if (isYa(record)) {
      const group = chooseGroup(isNew(record)
        ? ["New YA", isYaNonfiction(record) ? "YA Nonfiction" : "YA Fiction"]
        : [isYaNonfiction(record) ? "YA Nonfiction" : "YA Fiction"]);
      if (group) {
        return group;
      }
    }
    if (collection === "CHILDREN'S BOARD BOOKS") {
      const group = chooseGroup(["Board Books"]);
      if (group) {
        return group;
      }
    }
    if (isEarlyReader(record)) {
      const group = chooseGroup(["Early Readers", "Picture Books/Easy Readers"]);
      if (group) {
        return group;
      }
    }
    if (isPictureBook(record)) {
      const group = chooseGroup(["Picture Books/Easy Readers"]);
      if (group) {
        return group;
      }
    }
    if (isChildrenNonfiction(record)) {
      const group = chooseGroup(["Children's NONFiction"]);
      if (group) {
        return group;
      }
    }
    if (isChildrenFiction(record)) {
      const group = chooseGroup(isNew(record) ? ["NEW Children's Fiction", "Children's Fiction"] : ["Children's Fiction"]);
      if (group) {
        return group;
      }
    }

    record.reviewReasons.push(`No configured group matched ${text}`);
    return "Other";
  }

  function classifyCustomRecord(record) {
    if (record.reviewReasons.length > 0) {
      return "Other";
    }

    for (const group of customMatchOrder()) {
      if (group === "Other" || !isGroupEnabled(group)) {
        continue;
      }
      if (matchesCategoryRule(record, (profile.categoryRules || {})[group])) {
        return group;
      }
    }

    record.reviewReasons.push("No branch category matched.");
    return "Other";
  }

  function customMatchOrder() {
    const groups = profile.groupOrder || [];
    const priority = Array.isArray(profile.matchPriority) ? profile.matchPriority : [];
    return [
      ...priority.filter((group) => groups.includes(group)),
      ...groups.filter((group) => !priority.includes(group))
    ];
  }

  function matchesCategoryRule(record, rule) {
    if (!rule) {
      return false;
    }
    const presets = Array.isArray(rule.matchPresets) ? rule.matchPresets : [];
    const conditions = Array.isArray(rule.matchConditions) ? rule.matchConditions : [];
    return presets.some((preset) => matchesPreset(record, preset))
      || conditions.some((condition) => matchesCondition(record, condition));
  }

  function matchesPreset(record, preset) {
    switch (preset) {
      case "new-adult-fiction":
        return isNew(record) && isAdultFictionLike(record);
      case "new-adult-nonfiction":
        return isNew(record) && isAdultNonfictionLike(record);
      case "new-adult-biography":
        return isNew(record) && isAdultBiography(record);
      case "new-large-print":
        return isNew(record) && isLargePrint(record);
      case "adult-fiction":
        return !isNew(record) && isAdultFictionLike(record);
      case "adult-nonfiction":
        return !isNew(record) && isAdultNonfictionLike(record);
      case "biography":
        return !isNew(record) && isAdultBiography(record);
      case "large-print-fiction":
        return !isNew(record) && isLargePrint(record) && isAdultFictionLike(record);
      case "new-ya":
        return isNew(record) && isYa(record);
      case "ya-fiction":
        return !isNew(record) && isYa(record) && !isYaNonfiction(record);
      case "ya-nonfiction":
        return !isNew(record) && isYaNonfiction(record);
      case "board-books":
        return normalizeText(record.collection) === "CHILDREN'S BOARD BOOKS";
      case "early-readers":
        return isEarlyReader(record);
      case "picture-books":
        return isPictureBook(record);
      case "children-nonfiction":
        return isChildrenNonfiction(record);
      case "children-fiction":
        return !isNew(record) && isChildrenFiction(record);
      case "new-children-fiction":
        return isNew(record) && isChildrenFiction(record);
      case "nevada":
        return isNevada(record);
      case "adult-world-language":
        return isWorldLanguage(record) && !isChildOrYa(record);
      case "children-world-language":
        return isWorldLanguage(record) && isChildOrYa(record);
      case "special-collections":
        return isSpecial(record);
      case "adult-dvd":
        return isAdultDvd(record);
      case "adult-bluray":
        return isAdultBluRay(record);
      case "j-dvd":
        return isChildDvd(record);
      case "j-bluray":
        return isChildBluRay(record);
      case "music-cd":
        return isMusicCd(record);
      case "audiobook-cd":
        return isAudiobookCd(record);
      default:
        return false;
    }
  }

  function matchesCondition(record, condition) {
    const value = normalizeText(condition && condition.value);
    if (!value) {
      return false;
    }
    const fieldValue = normalizeText(fieldForCondition(record, condition.field));
    if (condition.operator === "startsWith") {
      return fieldValue.startsWith(value);
    }
    return fieldValue.includes(value);
  }

  function fieldForCondition(record, field) {
    if (field === "collection") {
      return record.collection;
    }
    if (field === "location") {
      return record.location;
    }
    if (field === "itemType") {
      return record.itemType;
    }
    if (field === "title") {
      return record.title;
    }
    return record.callNumber;
  }

  function chooseGroup(candidates) {
    return candidates.find((group) => isGroupEnabled(group)) || "";
  }

  function isGroupEnabled(group) {
    if (group === "Other") {
      return true;
    }
    return !(profile.disabledGroups || []).includes(group);
  }

  function buildSortKey(record) {
    const group = record.group;
    const sortMode = profile.groupSortModes && profile.groupSortModes[group];
    if (profile.ruleMode === "custom") {
      return buildCustomSortKey(record, sortMode || "shelf");
    }
    if (sortMode === "title") {
      return normalizeTitle(record.title);
    }
    if (sortMode === "author") {
      return `${normalizeText(record.author)} ${normalizeTitle(record.title)}`;
    }
    if (sortMode === "barcode") {
      return record.barcode || "";
    }
    if (sortMode === "raw-call") {
      return normalizeText(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "BluRays and DVDs") {
      return stripDvdPrefix(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "Music CDs") {
      return stripMusicPrefix(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "Audiobook CDs") {
      return `${subtypeRank(record)} ${stripAudiobookPrefix(record.callNumber) || normalizeTitle(record.title)}`;
    }
    if (group === "Adult Fiction" || group === "New Adult Fiction" || group === "Large Print Fiction") {
      return stripFictionPrefix(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "YA Fiction") {
      return stripYaFictionPrefix(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "New YA") {
      return `${isYaNonfiction(record) ? "0" : "1"} ${stripYaPrefix(record.callNumber) || normalizeTitle(record.title)}`;
    }
    if (group === "Children's Fiction" || group === "NEW Children's Fiction") {
      return stripChildrenFictionPrefix(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "Early Readers") {
      return stripEasyReaderPrefix(record.callNumber).replace(/\s*=\s*$/, "") || normalizeTitle(record.title);
    }
    if (group === "Picture Books/Easy Readers" || group === "Board Books") {
      return stripEasyReaderPrefix(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "Biography" || group === "New Adult Biography") {
      return stripBioPrefix(record.callNumber) || normalizeTitle(record.title);
    }
    if (group === "Nevada Collection") {
      return `${subtypeRank(record)} ${stripShelfPrefixes(record.callNumber) || normalizeTitle(record.title)}`;
    }
    if (group === "Adult World Language" || group === "Children's World Language") {
      return `${languageRank(record)} ${subtypeRank(record)} ${stripShelfPrefixes(record.callNumber) || normalizeTitle(record.title)}`;
    }
    if (group === "Adult Nonfiction" || group === "New Adult Nonfiction" || group === "YA Nonfiction" || group === "Children's NONFiction") {
      return stripShelfPrefixes(record.callNumber) || normalizeTitle(record.title);
    }
    return stripShelfPrefixes(record.callNumber) || normalizeTitle(record.title);
  }

  function buildCustomSortKey(record, sortMode) {
    const settings = (profile.groupSortSettings || {})[record.group] || {};
    const subgroup = findSubgroup(record, settings.subgroups || []);
    const subgroupKey = settings.interfileSubgroups ? "" : `${String(subgroup.index).padStart(3, "0")} `;

    if (sortMode === "title") {
      return `${subgroupKey}${normalizeTitle(record.title)}`;
    }
    if (sortMode === "author") {
      return `${subgroupKey}${normalizeText(record.author)} ${normalizeTitle(record.title)}`;
    }
    if (sortMode === "barcode") {
      return `${subgroupKey}${record.barcode || ""}`;
    }
    if (sortMode === "raw-call") {
      return `${subgroupKey}${normalizeText(record.callNumber) || normalizeTitle(record.title)}`;
    }

    return `${subgroupKey}${cleanCustomCallNumber(record.callNumber, settings, subgroup.value) || normalizeTitle(record.title)}`;
  }

  function findSubgroup(record, subgroups) {
    const call = normalizeText(record.callNumber);
    const normalizedSubgroups = subgroups.map(normalizeText).filter(Boolean);
    for (let index = 0; index < normalizedSubgroups.length; index += 1) {
      const subgroup = normalizedSubgroups[index];
      if (call.startsWith(subgroup)) {
        return { index, value: subgroup };
      }
    }
    return { index: normalizedSubgroups.length, value: "" };
  }

  function cleanCustomCallNumber(value, settings, subgroup) {
    let output = normalizeText(value);
    const prefixes = [
      subgroup,
      ...((settings.ignorePrefixes || []).map(normalizeText))
    ].filter(Boolean);
    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of prefixes) {
        const pattern = new RegExp(`^${escapeRegExp(prefix)}\\b\\s*`);
        if (pattern.test(output)) {
          output = output.replace(pattern, "").trim();
          changed = true;
        }
      }
    }
    return output;
  }

  function compareRecords(a, b) {
    const groupCompare = (groupRank.get(a.group) ?? 999) - (groupRank.get(b.group) ?? 999);
    if (groupCompare !== 0) {
      return groupCompare;
    }
    return collator.compare(a.sortKey, b.sortKey)
      || collator.compare(normalizeTitle(a.title), normalizeTitle(b.title))
      || collator.compare(a.barcode || "", b.barcode || "")
      || a.inputIndex - b.inputIndex;
  }

  function buildReport(parseResult, records) {
    const duplicateGroups = collectDuplicateGroups(records);
    const blankCallNumbers = records.filter((record) => !record.callNumber);
    const otherRecords = records.filter((record) => record.group === "Other");
    const countWarnings = [];
    const outputCount = records.length;
    const parsedCount = parseResult.records.length;
    const estimatedInputCount = parseResult.estimatedInputCount;

    if (parseResult.countBanners.length > 1) {
      countWarnings.push("Multiple item-count banners were pasted; estimated input count uses detected records.");
    }
    if (estimatedInputCount !== parsedCount || parsedCount !== outputCount) {
      countWarnings.push(`Count mismatch: ${estimatedInputCount} input, ${parsedCount} parsed, ${outputCount} output.`);
    }

    return {
      estimatedInputCount,
      parsedCount,
      outputCount,
      countMatches: estimatedInputCount === parsedCount && parsedCount === outputCount,
      countBanners: parseResult.countBanners,
      countWarnings,
      unparsedBlocks: parseResult.unparsedBlocks,
      blankCallNumbers,
      duplicateGroups,
      otherRecords,
      unknownWarnings: otherRecords.filter((record) => record.reviewReasons.length > 0)
    };
  }

  function collectDuplicateGroups(records) {
    const grouped = new Map();
    for (const record of records) {
      if (!record.barcode) {
        continue;
      }
      const list = grouped.get(record.barcode) || [];
      list.push(record);
      grouped.set(record.barcode, list);
    }
    return Array.from(grouped.entries())
      .filter(([, list]) => list.length > 1)
      .map(([barcode, list]) => ({ barcode, records: list }));
  }

  function isSpecial(record) {
    const fields = [record.collection, record.location].map(normalizeText);
    return fields.some((field) => profile.specialSignals.some((signal) => field.includes(signal)));
  }

  function isDvdOrBluRay(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return profile.mediaCollections.map(normalizeText).includes(collection)
      || /^(J\s+)?(DVD|BLU-?RAY)\b/.test(call);
  }

  function isAdultDvd(record) {
    const call = normalizeText(record.callNumber);
    return !isChildDvd(record) && /^DVD\b/.test(call);
  }

  function isAdultBluRay(record) {
    const call = normalizeText(record.callNumber);
    return !isChildBluRay(record) && (/^BLU-?RAY\b/.test(call) || /^BLURAY\b/.test(call));
  }

  function isChildDvd(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return /^J\s+DVD\b/.test(call)
      || (collection.includes("CHILDREN") && /^DVD\b/.test(call));
  }

  function isChildBluRay(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return /^J\s+BLU-?RAY\b/.test(call)
      || /^J\s+BLURAY\b/.test(call)
      || (collection.includes("CHILDREN") && (/^BLU-?RAY\b/.test(call) || /^BLURAY\b/.test(call)));
  }

  function isMusicCd(record) {
    return normalizeText(record.collection) === "MUSIC - CD"
      || /^CD\//.test(normalizeText(record.callNumber));
  }

  function isAudiobookCd(record) {
    const location = normalizeText(record.location);
    const call = normalizeText(record.callNumber);
    return location.includes("AUDIOBOOK")
      || /^CD\s+/.test(call);
  }

  function isNevada(record) {
    return normalizeText(record.location).includes("NEVADA")
      || normalizeText(record.collection).includes("NEVADA")
      || /^NEVADA\b/.test(normalizeText(record.callNumber));
  }

  function isWorldLanguage(record) {
    const text = [record.collection, record.location, record.callNumber].map(normalizeText).join(" ");
    return profile.worldLanguageSignals.some((signal) => text.includes(signal));
  }

  function isChildOrYa(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return collection.includes("CHILDREN")
      || collection.includes("YOUNG ADULT")
      || /^(SPANISH\s+)?J\b/.test(call)
      || /^J\s+SPANISH\b/.test(call)
      || /^YA\b/.test(call);
  }

  function isNew(record) {
    return normalizeText(record.location).includes(normalizeText(profile.newLocation));
  }

  function isLargePrint(record) {
    const text = [record.location, record.callNumber, record.title].map(normalizeText).join(" ");
    return text.includes("LARGE PRINT") || /^LP\b/.test(normalizeText(record.callNumber));
  }

  function isAdultBiography(record) {
    if (isChildOrYa(record)) {
      return false;
    }
    const call = normalizeText(record.callNumber).replace(/^LP\s+/, "");
    return normalizeText(record.location).includes("BIOGRAPHY")
      || /^BIO\b/.test(call);
  }

  function isAdultFictionLike(record) {
    if (isChildOrYa(record)) {
      return false;
    }
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber).replace(/^LP\s+/, "");
    return collection === "ADULT FICTION" || startsWithAnyFictionPrefix(call);
  }

  function isAdultNonfictionLike(record) {
    if (isChildOrYa(record)) {
      return false;
    }
    const collection = normalizeText(record.collection);
    const call = stripShelfPrefixes(record.callNumber);
    return collection === "ADULT NONFICTION" || /^\d/.test(call);
  }

  function isYa(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return collection.includes("YOUNG ADULT") || /^YA\b/.test(call);
  }

  function isYaNonfiction(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return collection === "YOUNG ADULT NONFICTION" || /^YA\s+\d/.test(call) || /^YA\s+BIO\b/.test(call);
  }

  function isEarlyReader(record) {
    const call = normalizeText(record.callNumber);
    return /^(SPANISH\s+)?J\s*E\b/.test(call) && /=\s*$/.test(call);
  }

  function isPictureBook(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return collection === "CHILDREN'S PICTURE BOOKS"
      || (/^(SPANISH\s+)?J\s*E\b/.test(call) && !/=\s*$/.test(call));
  }

  function isChildrenNonfiction(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return collection === "CHILDREN'S NONFICTION" || /^J\s+(\d|BIO\b|SPANISH\s+\d)/.test(call);
  }

  function isChildrenFiction(record) {
    const collection = normalizeText(record.collection);
    const call = normalizeText(record.callNumber);
    return collection === "CHILDREN'S FICTION" || /^J\s+FICTION\b/.test(call);
  }

  function startsWithAnyFictionPrefix(call) {
    return /^(SCIENCE FICTION|FICTION|MYSTERY|ROMANCE)\b/.test(call);
  }

  function subtypeRank(record) {
    const call = normalizeText(record.callNumber);
    if (isBioCall(call)) {
      return "1";
    }
    if (isFictionCall(call)) {
      return "2";
    }
    return "0";
  }

  function isBioCall(call) {
    const stripped = call.replace(/^(CD|LP|J|YA|SPANISH)\s+/g, "");
    return /^BIO\b/.test(stripped) || /\bBIO\b/.test(stripped);
  }

  function isFictionCall(call) {
    const stripped = call.replace(/^(CD|LP|J|YA|SPANISH)\s+/g, "");
    return startsWithAnyFictionPrefix(stripped) || /^E\b/.test(stripped) || /^J\s*E\b/.test(call);
  }

  function languageRank(record) {
    const text = [record.location, record.callNumber, record.collection].map(normalizeText).join(" ");
    const found = profile.languageNames.find((language) => text.includes(language));
    return found || "ZZZ";
  }

  function stripDvdPrefix(value) {
    let output = normalizeText(value);
    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of profile.dvdPrefixes) {
        const pattern = new RegExp(`^${escapeRegExp(prefix)}\\b\\s*`);
        if (pattern.test(output)) {
          output = output.replace(pattern, "");
          changed = true;
        }
      }
    }
    for (const suffix of profile.dvdTrailingFormats) {
      output = output.replace(new RegExp(`\\b${escapeRegExp(suffix)}\\b$`), "").trim();
    }
    return output;
  }

  function stripMusicPrefix(value) {
    let output = normalizeText(value).replace(/^CD\//, "");
    for (const prefix of profile.musicPrefixes) {
      if (output === prefix) {
        return "";
      }
      if (output.startsWith(`${prefix}/`)) {
        return output.slice(prefix.length + 1).trim();
      }
      if (output.startsWith(`${prefix} `)) {
        return output.slice(prefix.length + 1).trim();
      }
    }
    return output;
  }

  function stripAudiobookPrefix(value) {
    const stripped = normalizeText(value).replace(/^CD\s+/, "");
    if (isFictionCall(stripped)) {
      return stripFictionPrefix(stripped);
    }
    return stripShelfPrefixes(stripped);
  }

  function stripFictionPrefix(value) {
    return normalizeText(value)
      .replace(/^LP\s+/, "")
      .replace(/^(SCIENCE FICTION|FICTION|MYSTERY|ROMANCE)\s+/, "")
      .trim();
  }

  function stripYaFictionPrefix(value) {
    return normalizeText(value).replace(/^YA\s+FICTION\s+/, "").trim();
  }

  function stripYaPrefix(value) {
    const call = normalizeText(value);
    if (/^YA\s+FICTION\b/.test(call)) {
      return stripYaFictionPrefix(call);
    }
    return call.replace(/^YA\s+/, "").trim();
  }

  function stripChildrenFictionPrefix(value) {
    return normalizeText(value).replace(/^J\s+FICTION\s+/, "").trim();
  }

  function stripEasyReaderPrefix(value) {
    return normalizeText(value)
      .replace(/^SPANISH\s+/, "")
      .replace(/^J\s*E\s+/, "")
      .trim();
  }

  function stripBioPrefix(value) {
    return normalizeText(value).replace(/^LP\s+/, "").replace(/^BIO\s+/, "").trim();
  }

  function stripShelfPrefixes(value) {
    let output = normalizeText(value);
    output = output.replace(/^CD\s+/, "");
    output = output.replace(/^LP\s+/, "");
    output = output.replace(/^J\s+SPANISH\s+/, "");
    output = output.replace(/^SPANISH\s+J\s+/, "");
    output = output.replace(/^SPANISH\s+/, "");
    output = output.replace(/^J\s+/, "");
    output = output.replace(/^YA\s+/, "");
    output = output.replace(/^NEVADA\s+/, "");
    return output.trim();
  }

  function recordText(record) {
    return [record.collection, record.location, record.itemType, record.callNumber]
      .filter(Boolean)
      .join(" / ");
  }

  function normalizeTitle(value) {
    return normalizeText(value).replace(/^(THE|A|AN)\s+/, "");
  }

  function normalizeText(value) {
    return clean(value).toUpperCase().replace(/\s+/g, " ");
  }

  function clean(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function findLastIndex(items, predicate) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (predicate(items[index], index)) {
        return index;
      }
    }
    return -1;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return {
    profile,
    defaultProfileId,
    getProfiles,
    getCategoryLibrary,
    resolveProfile,
    formatHolds,
    parseHolds,
    classifyRecord,
    buildSortKey,
    helpers: {
      normalizeText,
      stripDvdPrefix,
      stripMusicPrefix,
      stripShelfPrefixes
    }
  };
});
