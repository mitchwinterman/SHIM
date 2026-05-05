(function bootShimApp(root) {
  "use strict";

  const shim = root.SHIM;
  const profileStore = root.SHIM_PROFILE_STORE;
  const elements = {
    activeBranchName: document.getElementById("active-branch-name"),
    branchSelector: document.getElementById("branch-selector"),
    branchSettingsButton: document.getElementById("branch-settings-button"),
    pasteScreen: document.getElementById("paste-screen"),
    resultsScreen: document.getElementById("results-screen"),
    input: document.getElementById("koha-input"),
    formatButton: document.getElementById("format-button"),
    clearButton: document.getElementById("clear-button"),
    printButton: document.getElementById("print-button"),
    newPasteButton: document.getElementById("new-paste-button"),
    printPageStyle: document.getElementById("print-page-style"),
    report: document.getElementById("verification-report"),
    warnings: document.getElementById("warnings-report"),
    output: document.getElementById("holds-output"),
    settingsModal: document.getElementById("settings-modal"),
    settingsTitle: document.getElementById("settings-title"),
    closeSettingsButton: document.getElementById("close-settings-button"),
    addCategorySelect: document.getElementById("add-category-select"),
    addCategoryButton: document.getElementById("add-category-button"),
    customCategoryName: document.getElementById("custom-category-name"),
    addCustomCategoryButton: document.getElementById("add-custom-category-button"),
    groupOrderList: document.getElementById("group-order-list"),
    categoryEditor: document.getElementById("category-editor"),
    saveSettingsButton: document.getElementById("save-settings-button"),
    resetSettingsButton: document.getElementById("reset-settings-button"),
    exportSettingsButton: document.getElementById("export-settings-button"),
    importSettingsText: document.getElementById("import-settings-text"),
    importSettingsButton: document.getElementById("import-settings-button")
  };
  const storage = getStorage();
  const categoryLibrary = shim.getCategoryLibrary();
  const conditionFields = [
    { field: "collection", label: "Collection contains" },
    { field: "location", label: "Shelving location contains" },
    { field: "callNumber", label: "Call number contains" },
    { field: "callNumber", label: "Call number starts with", operator: "startsWith" },
    { field: "itemType", label: "Item type contains" },
    { field: "title", label: "Title contains" }
  ];
  let profiles = loadProfiles();
  let selectedProfileId = profileStore.loadSelectedProfileId(storage, shim.defaultProfileId);
  let editingGroupOrder = [];
  let editingDisabledGroups = [];
  let editingGroupSortModes = {};
  let editingCategoryRules = {};
  let editingGroupSortSettings = {};
  let selectedEditingGroup = "Other";
  let settingsSnapshot = "";
  let draggedGroup = "";

  renderAddCategoryOptions();
  renderBranchSelector();
  updateActiveBranch();

  elements.formatButton.addEventListener("click", () => {
    const result = shim.formatHolds(elements.input.value, getSelectedProfile());
    renderResult(result);
    elements.pasteScreen.classList.add("is-hidden");
    elements.resultsScreen.classList.remove("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  elements.clearButton.addEventListener("click", () => {
    elements.input.value = "";
    elements.input.focus();
  });

  elements.branchSettingsButton.addEventListener("click", openSettings);
  elements.closeSettingsButton.addEventListener("click", requestCloseSettings);
  elements.settingsModal.addEventListener("click", (event) => {
    if (event.target === elements.settingsModal) {
      requestCloseSettings();
    }
  });
  elements.addCategoryButton.addEventListener("click", () => {
    const name = elements.addCategorySelect.value;
    const template = categoryLibrary.find((item) => item.name === name);
    if (template) {
      addCategory(template.name, template);
    }
  });
  elements.addCustomCategoryButton.addEventListener("click", () => {
    const name = elements.customCategoryName.value.trim();
    if (name) {
      addCategory(name, { name, matchPresets: [] });
      elements.customCategoryName.value = "";
    }
  });

  elements.saveSettingsButton.addEventListener("click", () => {
    profileStore.saveOverride(storage, selectedProfileId, {
      groupOrder: editingGroupOrder,
      disabledGroups: editingDisabledGroups,
      groupSortModes: editingGroupSortModes,
      categoryRules: editingCategoryRules,
      groupSortSettings: editingGroupSortSettings
    });
    refreshProfiles();
    closeSettings();
  });

  elements.resetSettingsButton.addEventListener("click", () => {
    profileStore.resetOverride(storage, selectedProfileId);
    refreshProfiles();
    openSettings();
  });

  elements.exportSettingsButton.addEventListener("click", () => {
    elements.importSettingsText.value = profileStore.exportOverride({
      ...getSelectedProfile(),
      groupOrder: editingGroupOrder,
      disabledGroups: editingDisabledGroups,
      groupSortModes: editingGroupSortModes,
      categoryRules: editingCategoryRules,
      groupSortSettings: editingGroupSortSettings
    });
    elements.importSettingsText.focus();
    elements.importSettingsText.select();
  });

  elements.importSettingsButton.addEventListener("click", () => {
    try {
      const imported = profileStore.importOverride(elements.importSettingsText.value, getSelectedProfile());
      editingGroupOrder = ensureOtherLast(imported.groupOrder);
      editingDisabledGroups = imported.disabledGroups;
      editingGroupSortModes = imported.groupSortModes;
      editingCategoryRules = imported.categoryRules;
      editingGroupSortSettings = imported.groupSortSettings;
      selectedEditingGroup = editingGroupOrder.find((group) => group !== "Other") || "Other";
      renderGroupOrderEditor();
    } catch (error) {
      elements.importSettingsText.focus();
    }
  });

  function loadProfiles() {
    return profileStore.applyOverrides(shim.getProfiles(), profileStore.loadOverrides(storage));
  }

  function getStorage() {
    try {
      return root.localStorage;
    } catch (error) {
      return null;
    }
  }

  function refreshProfiles() {
    profiles = loadProfiles();
    renderBranchSelector();
    updateActiveBranch();
  }

  function getSelectedProfile() {
    return profiles.find((profile) => profile.id === selectedProfileId) || profiles[0];
  }

  function renderAddCategoryOptions() {
    elements.addCategorySelect.replaceChildren(...categoryLibrary.map((category) => (
      el("option", { value: category.name }, category.name)
    )));
  }

  function renderBranchSelector() {
    elements.branchSelector.replaceChildren(...profiles.map((profile) => (
      el("option", { value: profile.id }, profile.branchName || profile.name)
    )));
    if (!profiles.some((profile) => profile.id === selectedProfileId)) {
      selectedProfileId = shim.defaultProfileId;
      profileStore.saveSelectedProfileId(storage, selectedProfileId);
    }
    elements.branchSelector.value = selectedProfileId;
  }

  elements.branchSelector.addEventListener("change", () => {
    selectedProfileId = elements.branchSelector.value;
    profileStore.saveSelectedProfileId(storage, selectedProfileId);
    updateActiveBranch();
  });

  function updateActiveBranch() {
    const selected = getSelectedProfile();
    elements.activeBranchName.textContent = selected.branchName || selected.name;
    elements.branchSettingsButton.textContent = selected.hasLocalOverride ? "Settings*" : "Settings";
  }

  function openSettings() {
    const selected = getSelectedProfile();
    editingGroupOrder = ensureOtherLast([...selected.groupOrder]);
    editingDisabledGroups = [...(selected.disabledGroups || [])];
    editingGroupSortModes = { ...(selected.groupSortModes || {}) };
    editingCategoryRules = cloneData(selected.categoryRules || {});
    editingGroupSortSettings = cloneData(selected.groupSortSettings || {});
    selectedEditingGroup = editingGroupOrder.find((group) => group !== "Other") || "Other";
    settingsSnapshot = serializeSettingsState();
    elements.settingsTitle.textContent = `${selected.branchName || selected.name} sorting settings`;
    elements.importSettingsText.value = "";
    renderGroupOrderEditor();
    elements.settingsModal.classList.remove("is-hidden");
    elements.closeSettingsButton.focus();
  }

  function requestCloseSettings() {
    if (hasUnsavedSettings() && !root.confirm("Close branch settings without saving changes?")) {
      return;
    }
    closeSettings();
  }

  function closeSettings() {
    elements.settingsModal.classList.add("is-hidden");
    elements.branchSettingsButton.focus();
  }

  function hasUnsavedSettings() {
    return !elements.settingsModal.classList.contains("is-hidden")
      && settingsSnapshot
      && serializeSettingsState() !== settingsSnapshot;
  }

  function serializeSettingsState() {
    return JSON.stringify({
      groupOrder: editingGroupOrder,
      disabledGroups: editingDisabledGroups,
      groupSortModes: editingGroupSortModes,
      categoryRules: editingCategoryRules,
      groupSortSettings: editingGroupSortSettings
    });
  }

  function renderGroupOrderEditor() {
    elements.groupOrderList.replaceChildren(...editingGroupOrder.map((group, index) => {
      const isOther = group === "Other";
      const isEnabled = isOther || !editingDisabledGroups.includes(group);
      const dragHandle = el("span", { className: "drag-handle", "aria-hidden": "true" }, isOther ? "Fixed" : "Drag");
      const enabledCheckbox = el("input", {
        type: "checkbox",
        checked: isEnabled,
        disabled: isOther,
        "aria-label": `Include ${group}`
      });
      const upButton = el("button", {
        className: "move-button",
        type: "button",
        disabled: isOther || index === 0
      }, "Up");
      const downButton = el("button", {
        className: "move-button",
        type: "button",
        disabled: isOther || index === editingGroupOrder.length - 1
      }, "Down");

      upButton.addEventListener("click", () => moveGroup(index, -1));
      downButton.addEventListener("click", () => moveGroup(index, 1));
      enabledCheckbox.addEventListener("change", () => {
        setGroupEnabled(group, enabledCheckbox.checked);
      });

      const rowClasses = [
        "group-order-item",
        isEnabled ? "" : "is-disabled",
        group === selectedEditingGroup ? "is-selected" : ""
      ].filter(Boolean).join(" ");
      const editButton = el("button", {
        className: "move-button",
        type: "button"
      }, group === "Other" ? "View" : "Edit");

      const actionButtons = isOther ? [editButton] : [editButton, upButton, downButton];

      const row = el("li", {
        className: rowClasses,
        draggable: isOther ? "false" : "true",
        "data-group": group
      },
        el("div", { className: "group-order-main" },
          dragHandle,
          el("label", { className: "group-toggle" },
            enabledCheckbox,
            el("span", { className: "group-order-name" }, group)
          )
        ),
        el("div", { className: "group-order-actions" },
          ...actionButtons
        )
      );
      editButton.addEventListener("click", () => selectEditingGroup(group));
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, input, select, label")) {
          return;
        }
        selectEditingGroup(group);
      });
      row.addEventListener("dragstart", (event) => {
        draggedGroup = group;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", group);
        row.classList.add("is-dragging");
      });
      row.addEventListener("dragend", () => {
        draggedGroup = "";
        row.classList.remove("is-dragging");
      });
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const source = draggedGroup || event.dataTransfer.getData("text/plain");
        moveGroupTo(source, group);
      });
      return row;
    }));
    renderCategoryEditor();
  }

  function renderCategoryEditor() {
    const group = selectedEditingGroup;
    if (!editingGroupOrder.includes(group)) {
      selectedEditingGroup = editingGroupOrder.find((item) => item !== "Other") || "Other";
      renderCategoryEditor();
      return;
    }

    if (group === "Other") {
      elements.categoryEditor.replaceChildren(
        el("h3", {}, "Other"),
        el("p", { className: "settings-note" }, "Other is the safety category. Items land here when no enabled branch category matches them.")
      );
      return;
    }

    const rule = getEditingRule(group);
    const settings = getEditingSortSettings(group);
    const sortSelect = el("select", { "aria-label": `Item sort for ${group}` },
      el("option", { value: "shelf" }, "Shelf logic"),
      el("option", { value: "raw-call" }, "Raw call number"),
      el("option", { value: "title" }, "Title"),
      el("option", { value: "author" }, "Author"),
      el("option", { value: "barcode" }, "Barcode")
    );
    sortSelect.value = editingGroupSortModes[group] || "shelf";
    sortSelect.addEventListener("change", () => {
      setGroupSortMode(group, sortSelect.value);
    });
    const matchOptions = categoryLibrary.map((category) => {
      const checkbox = el("input", {
        type: "checkbox",
        checked: category.matchPresets.every((preset) => rule.matchPresets.includes(preset))
      });
      checkbox.addEventListener("change", () => {
        setMatchPresetGroup(group, category.matchPresets, checkbox.checked);
      });
      return el("label", { className: "match-option" },
        checkbox,
        el("span", {}, category.name)
      );
    });

    const conditionInputs = conditionFields.map((config) => {
      const operator = config.operator || "contains";
      const textarea = el("textarea", {
        className: "settings-mini-textarea",
        spellcheck: "false"
      }, conditionsToText(rule.matchConditions, config.field, operator));
      textarea.addEventListener("input", () => {
        setConditionText(group, config.field, operator, textarea.value);
      });
      return el("label", { className: "settings-field" },
        config.label,
        textarea
      );
    });

    const subgroupsInput = el("textarea", {
      className: "settings-mini-textarea",
      spellcheck: "false"
    }, listToText(settings.subgroups));
    subgroupsInput.addEventListener("input", () => {
      getEditingSortSettings(group).subgroups = parseList(subgroupsInput.value);
    });

    const ignoreInput = el("textarea", {
      className: "settings-mini-textarea",
      spellcheck: "false"
    }, listToText(settings.ignorePrefixes));
    ignoreInput.addEventListener("input", () => {
      getEditingSortSettings(group).ignorePrefixes = parseList(ignoreInput.value);
    });

    const interfileCheckbox = el("input", {
      type: "checkbox",
      checked: settings.interfileSubgroups !== false
    });
    interfileCheckbox.addEventListener("change", () => {
      getEditingSortSettings(group).interfileSubgroups = interfileCheckbox.checked;
    });

    const removeButton = el("button", { className: "secondary-button", type: "button" }, "Remove Category");
    removeButton.addEventListener("click", () => removeCategory(group));

    elements.categoryEditor.replaceChildren(
      el("div", { className: "category-editor-heading" },
        el("h3", {}, group),
        removeButton
      ),
      el("p", { className: "settings-note" }, "Check every signal that should go into this category. The first enabled category that matches an item wins."),
      el("label", { className: "settings-field settings-field-compact" },
        "Items sorted by",
        sortSelect
      ),
      el("div", { className: "match-options" }, ...matchOptions),
      el("h4", {}, "Additional Match Text"),
      el("div", { className: "settings-fields" }, ...conditionInputs),
      el("h4", {}, "Shelf Logic"),
      el("label", { className: "settings-field" },
        "Subgroups in shelf order",
        subgroupsInput
      ),
      el("label", { className: "settings-field" },
        "Ignore leading call-number text",
        ignoreInput
      ),
      el("label", { className: "inline-setting" },
        interfileCheckbox,
        "Interfile subgroups instead of printing one subgroup before another"
      )
    );
  }

  function addCategory(name, template) {
    const group = name.trim();
    if (!group || group === "Other") {
      return;
    }
    if (!editingGroupOrder.includes(group)) {
      const otherIndex = editingGroupOrder.indexOf("Other");
      const insertAt = otherIndex >= 0 ? otherIndex : editingGroupOrder.length;
      editingGroupOrder.splice(insertAt, 0, group);
    }
    editingGroupOrder = ensureOtherLast(editingGroupOrder);
    editingDisabledGroups = editingDisabledGroups.filter((item) => item !== group);
    editingCategoryRules[group] = {
      matchPresets: [...(template.matchPresets || [])],
      matchConditions: []
    };
    editingGroupSortSettings[group] = {
      ignorePrefixes: [...(template.ignorePrefixes || [])],
      subgroups: [...(template.subgroups || [])],
      interfileSubgroups: true
    };
    selectedEditingGroup = group;
    renderGroupOrderEditor();
  }

  function removeCategory(group) {
    if (group === "Other") {
      return;
    }
    editingGroupOrder = editingGroupOrder.filter((item) => item !== group);
    editingDisabledGroups = editingDisabledGroups.filter((item) => item !== group);
    delete editingGroupSortModes[group];
    delete editingCategoryRules[group];
    delete editingGroupSortSettings[group];
    selectedEditingGroup = editingGroupOrder.find((item) => item !== "Other") || "Other";
    renderGroupOrderEditor();
  }

  function selectEditingGroup(group) {
    selectedEditingGroup = group;
    renderGroupOrderEditor();
  }

  function getEditingRule(group) {
    if (!editingCategoryRules[group]) {
      editingCategoryRules[group] = { matchPresets: [], matchConditions: [] };
    }
    editingCategoryRules[group].matchPresets = editingCategoryRules[group].matchPresets || [];
    editingCategoryRules[group].matchConditions = editingCategoryRules[group].matchConditions || [];
    return editingCategoryRules[group];
  }

  function getEditingSortSettings(group) {
    if (!editingGroupSortSettings[group]) {
      editingGroupSortSettings[group] = { ignorePrefixes: [], subgroups: [], interfileSubgroups: true };
    }
    editingGroupSortSettings[group].ignorePrefixes = editingGroupSortSettings[group].ignorePrefixes || [];
    editingGroupSortSettings[group].subgroups = editingGroupSortSettings[group].subgroups || [];
    if (typeof editingGroupSortSettings[group].interfileSubgroups !== "boolean") {
      editingGroupSortSettings[group].interfileSubgroups = true;
    }
    return editingGroupSortSettings[group];
  }

  function setMatchPresetGroup(group, presets, checked) {
    const rule = getEditingRule(group);
    const next = new Set(rule.matchPresets);
    presets.forEach((preset) => {
      if (checked) {
        next.add(preset);
      } else {
        next.delete(preset);
      }
    });
    rule.matchPresets = Array.from(next);
    renderCategoryEditor();
  }

  function setConditionText(group, field, operator, text) {
    const rule = getEditingRule(group);
    rule.matchConditions = rule.matchConditions.filter((condition) => (
      condition.field !== field || condition.operator !== operator
    ));
    parseList(text).forEach((value) => {
      rule.matchConditions.push({ field, operator, value });
    });
  }

  function conditionsToText(conditions, field, operator) {
    return (conditions || [])
      .filter((condition) => condition.field === field && condition.operator === operator)
      .map((condition) => condition.value)
      .join("\n");
  }

  function parseList(text) {
    return String(text || "")
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter((item, index, items) => item && items.indexOf(item) === index);
  }

  function listToText(items) {
    return (items || []).join("\n");
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function moveGroup(index, offset) {
    if (editingGroupOrder[index] === "Other") {
      return;
    }
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= editingGroupOrder.length) {
      return;
    }
    const next = [...editingGroupOrder];
    const [group] = next.splice(index, 1);
    next.splice(targetIndex, 0, group);
    editingGroupOrder = ensureOtherLast(next);
    renderGroupOrderEditor();
  }

  function moveGroupTo(sourceGroup, targetGroup) {
    if (!sourceGroup || sourceGroup === targetGroup || sourceGroup === "Other") {
      return;
    }
    const sourceIndex = editingGroupOrder.indexOf(sourceGroup);
    const targetIndex = editingGroupOrder.indexOf(targetGroup);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    const next = [...editingGroupOrder];
    const [group] = next.splice(sourceIndex, 1);
    const adjustedTarget = targetGroup === "Other"
      ? next.indexOf("Other")
      : targetIndex - (sourceIndex < targetIndex ? 1 : 0);
    next.splice(adjustedTarget, 0, group);
    editingGroupOrder = ensureOtherLast(next);
    renderGroupOrderEditor();
  }

  function ensureOtherLast(groups) {
    return [
      ...groups.filter((group) => group !== "Other"),
      "Other"
    ];
  }

  function setGroupEnabled(group, enabled) {
    if (group === "Other") {
      return;
    }
    const disabled = new Set(editingDisabledGroups);
    if (enabled) {
      disabled.delete(group);
    } else {
      disabled.add(group);
    }
    editingDisabledGroups = Array.from(disabled);
    renderGroupOrderEditor();
  }

  function setGroupSortMode(group, mode) {
    if (mode === "shelf") {
      delete editingGroupSortModes[group];
    } else {
      editingGroupSortModes[group] = mode;
    }
  }

  elements.printButton.addEventListener("click", () => {
    updatePrintPageStyle();
    window.print();
  });

  window.addEventListener("beforeprint", updatePrintPageStyle);

  elements.newPasteButton.addEventListener("click", () => {
    elements.resultsScreen.classList.add("is-hidden");
    elements.pasteScreen.classList.remove("is-hidden");
    elements.input.value = "";
    elements.report.replaceChildren();
    elements.warnings.replaceChildren();
    elements.output.replaceChildren();
    elements.input.focus();
  });

  function renderResult(result) {
    renderReport(result.report);
    renderWarnings(result.report);
    renderGroups(result.groups);
  }

  function renderReport(report) {
    const statusClass = report.countMatches && totalWarningCount(report) === 0 ? "ok" : "warn";
    const statusText = report.countMatches
      ? `${report.estimatedInputCount} input holds, ${report.parsedCount} parsed, ${report.outputCount} output.`
      : `Review counts: ${report.estimatedInputCount} input holds, ${report.parsedCount} parsed, ${report.outputCount} output.`;

    elements.report.replaceChildren(
      el("div", { className: `print-summary ${statusClass}` }, statusText),
      metric(String(report.estimatedInputCount), "Estimated input"),
      metric(String(report.parsedCount), "Parsed holds"),
      metric(String(report.outputCount), "Output rows"),
      metric(String(totalWarningCount(report)), "Warnings"),
      el("div", { className: `status ${statusClass}` }, statusText)
    );
  }

  function renderWarnings(report) {
    const items = [];

    report.countWarnings.forEach((warning) => {
      items.push(warning);
    });

    report.unparsedBlocks.forEach((block) => {
      items.push(`Unparsed block near line ${block.line}: ${block.reason} "${block.text}"`);
    });

    report.blankCallNumbers.forEach((record) => {
      items.push(`Blank call number: ${record.title} (${record.barcode || "no barcode"})`);
    });

    report.duplicateGroups.forEach((group) => {
      const titles = group.records.map((record) => record.title).join("; ");
      items.push(`Duplicate barcode ${group.barcode}: ${titles}`);
    });

    report.otherRecords.forEach((record) => {
      const reason = record.reviewReasons.length > 0 ? record.reviewReasons.join("; ") : "No configured group matched.";
      items.push(`Other: ${record.title} (${record.callNumber || "blank call number"}) - ${reason}`);
    });

    if (items.length === 0) {
      elements.warnings.classList.add("is-hidden");
      elements.warnings.replaceChildren();
      return;
    }

    elements.warnings.classList.remove("is-hidden");
    elements.warnings.replaceChildren(
      el("h3", {}, "Warnings requiring review"),
      el("ul", {}, ...items.map((item) => el("li", {}, item)))
    );
  }

  function renderGroups(groups) {
    if (groups.length === 0) {
      elements.output.replaceChildren(
        el("div", { className: "holds-group" },
          el("h3", {}, "No holds parsed"),
          el("p", {}, "No barcode/date hold rows were found in the pasted text.")
        )
      );
      return;
    }

    elements.output.replaceChildren(...groups.map(renderGroup));
  }

  function renderGroup(group) {
    return el("section", { className: "holds-group" },
      el("h3", {},
        group.name,
        el("span", { className: "group-count" }, `${group.items.length} ${group.items.length === 1 ? "item" : "items"}`)
      ),
      el("table", {},
        el("thead", {},
          el("tr", {},
            el("th", { className: "check-cell" }, ""),
            el("th", { className: "call-cell" }, "Call number"),
            el("th", { className: "title-cell" }, "Title"),
            el("th", { className: "author-cell" }, "Author"),
            el("th", { className: "type-cell" }, "Item type"),
            el("th", { className: "barcode-cell" }, "Barcode")
          )
        ),
        el("tbody", {}, ...group.items.map(renderRow))
      )
    );
  }

  function renderRow(record) {
    const titleCell = el("td", { className: "title-cell" }, renderTitle(record.title));
    if (record.reviewReasons.length > 0) {
      titleCell.appendChild(el("div", { className: "row-note" }, record.reviewReasons.join("; ")));
    }

    return el("tr", {},
      el("td", { className: "check-cell" }, el("span", { className: "checkbox", "aria-hidden": "true" }, "")),
      el("td", { className: "call-cell" }, record.callNumber || ""),
      titleCell,
      el("td", { className: "author-cell" }, record.author || ""),
      el("td", { className: "type-cell" }, record.itemType || ""),
      el("td", { className: "barcode-cell" }, renderBarcode(record))
    );
  }

  function renderTitle(title) {
    const text = title || "";
    const slashIndex = text.indexOf("/");
    if (slashIndex === -1) {
      return el("span", { className: "title-main" }, text);
    }

    return [
      el("span", { className: "title-main" }, text.slice(0, slashIndex)),
      el("span", { className: "title-rest" }, text.slice(slashIndex))
    ];
  }

  function renderBarcode(record) {
    const text = record.barcodeText || record.barcode || "";
    const match = text.match(/^(\d{14})(.*)$/);
    if (!match) {
      return text;
    }

    const barcode = match[1];
    const suffix = match[2].trim();
    const formattedBarcode = el("span", { className: "barcode-number" },
      barcode.slice(0, -4),
      el("strong", { className: "barcode-last-four" }, barcode.slice(-4))
    );

    if (!suffix) {
      return formattedBarcode;
    }

    return [
      formattedBarcode,
      " ",
      el("span", { className: "availability-note" }, suffix)
    ];
  }

  function updatePrintPageStyle() {
    const selected = getSelectedProfile();
    const printedAt = new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date());

    const safeDate = printedAt.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    const safeBranch = (selected.branchName || selected.name).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    elements.printPageStyle.textContent = `
      @page {
        size: auto;
        margin: 0.42in 0.35in 0.46in;
        @top-left {
          content: "SHIM HOLDS List - ${safeBranch}";
          font-family: Arial, sans-serif;
          font-size: 8pt;
          color: #555555;
        }
        @top-right {
          content: "Printed ${safeDate}";
          font-family: Arial, sans-serif;
          font-size: 8pt;
          color: #555555;
        }
        @bottom-right {
          content: "Page " counter(page) " of " counter(pages);
          font-family: Arial, sans-serif;
          font-size: 8pt;
          color: #555555;
        }
      }
    `;
  }

  function totalWarningCount(report) {
    return report.countWarnings.length
      + report.unparsedBlocks.length
      + report.blankCallNumbers.length
      + report.duplicateGroups.length
      + report.otherRecords.length;
  }

  function metric(value, label) {
    return el("div", { className: "metric" },
      el("strong", {}, value),
      el("span", {}, label)
    );
  }

  function el(tagName, props, ...children) {
    const node = document.createElement(tagName);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (key === "className") {
        node.className = value;
      } else if (value === false || value === null || value === undefined) {
        return;
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, value);
      }
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined) {
        return;
      }
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }
})(window);
