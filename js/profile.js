(function attachProfile(root, factory) {
  const profile = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = profile;
  } else {
    root.SHIM_PROFILE = profile;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createProfileRegistry() {
  const groupOrder = [
    "New Adult Fiction",
    "New Adult Nonfiction",
    "New Adult Biography",
    "NEW Large Print",
    "Adult Fiction",
    "New YA",
    "YA Nonfiction",
    "YA Fiction",
    "Large Print Fiction",
    "Biography",
    "Adult Nonfiction",
    "Nevada Collection",
    "Adult World Language",
    "BluRays and DVDs",
    "Music CDs",
    "Audiobook CDs",
    "Special Collections",
    "Board Books",
    "Early Readers",
    "Picture Books/Easy Readers",
    "Children's NONFiction",
    "Children's Fiction",
    "Children's World Language",
    "NEW Children's Fiction",
    "Other"
  ];

  const baseProfile = {
    id: "mvp",
    name: "Washoe County Library System MVP",
    branchName: "MVP",
    ruleMode: "mvp",
    groupOrder,
    disabledGroups: [],
    groupSortModes: {},
    categoryRules: {},
    groupSortSettings: {},
    defaultGroup: "Other",
    enabledRules: {
      separateEarlyReaders: true,
      separateNewYa: true,
      separateChildrenWorldLanguage: true,
      combineDvdAndBluRay: true,
      interfileLargePrintNonfiction: true
    },
    newItemBehavior: {
      location: "New Arrivals Shelf",
      ignoreNewForMediaAndChildrenNonfiction: true
    },
    knownCollections: [
      "Adult Fiction",
      "Adult Nonfiction",
      "Children's Board Books",
      "Children's DVD / Blu-rays",
      "Children's Early Readers",
      "Children's Fiction",
      "Children's Nonfiction",
      "Children's Picture Books",
      "DVD / Blu-rays",
      "Government Documents",
      "Music - CD",
      "Periodicals",
      "Young Adult Fiction",
      "Young Adult Nonfiction"
    ],
    mediaCollections: ["DVD / Blu-rays", "Children's DVD / Blu-rays"],
    musicCollections: ["Music - CD"],
    newLocation: "New Arrivals Shelf",
    specialSignals: ["SPECIAL COLLECTION"],
    worldLanguageSignals: [
      "BILINGUAL",
      "WORLD LANG",
      "SPANISH",
      "FRENCH",
      "GERMAN",
      "CHINESE",
      "JAPANESE",
      "KOREAN",
      "ITALIAN",
      "PORTUGUESE",
      "RUSSIAN",
      "ARABIC",
      "VIETNAMESE"
    ],
    languageNames: [
      "SPANISH",
      "FRENCH",
      "GERMAN",
      "CHINESE",
      "JAPANESE",
      "KOREAN",
      "ITALIAN",
      "PORTUGUESE",
      "RUSSIAN",
      "ARABIC",
      "VIETNAMESE"
    ],
    fictionPrefixes: ["SCIENCE FICTION", "FICTION", "MYSTERY", "ROMANCE"],
    dvdPrefixes: ["J", "DVD", "BLU-RAY", "BLURAY", "VIDEO"],
    dvdTrailingFormats: ["WIDE", "WIDESCREEN", "FULLSCREEN"],
    musicPrefixes: [
      "POP/ROCK",
      "RAP/HIP-HOP",
      "FOLK",
      "COUNTRY",
      "JAZZ",
      "CLASSICAL",
      "BLUES",
      "SOUNDTRACK",
      "HOLIDAY",
      "WORLD",
      "CHILDREN",
      "NEW AGE"
    ]
  };

  const categoryLibrary = [
    { name: "New Adult Fiction", matchPresets: ["new-adult-fiction"] },
    { name: "New Adult Nonfiction", matchPresets: ["new-adult-nonfiction"] },
    { name: "New Adult Biography", matchPresets: ["new-adult-biography"] },
    { name: "NEW Large Print", matchPresets: ["new-large-print"] },
    { name: "Adult Fiction", matchPresets: ["adult-fiction"] },
    { name: "Adult Nonfiction", matchPresets: ["adult-nonfiction"] },
    { name: "Biography", matchPresets: ["biography"] },
    { name: "Large Print Fiction", matchPresets: ["large-print-fiction"] },
    { name: "New YA", matchPresets: ["new-ya"] },
    { name: "YA Fiction", matchPresets: ["ya-fiction"] },
    { name: "YA Nonfiction", matchPresets: ["ya-nonfiction"] },
    { name: "Board Books", matchPresets: ["board-books"] },
    { name: "Early Readers", matchPresets: ["early-readers"] },
    { name: "Picture Books/Easy Readers", matchPresets: ["picture-books"] },
    { name: "Children's NONFiction", matchPresets: ["children-nonfiction"] },
    { name: "Children's Fiction", matchPresets: ["children-fiction"] },
    { name: "NEW Children's Fiction", matchPresets: ["new-children-fiction"] },
    { name: "Nevada Collection", matchPresets: ["nevada"] },
    { name: "Adult World Language", matchPresets: ["adult-world-language"] },
    { name: "Children's World Language", matchPresets: ["children-world-language"] },
    { name: "Special Collections", matchPresets: ["special-collections"] },
    {
      name: "DVDs",
      matchPresets: ["adult-dvd"],
      subgroups: ["DVD"],
      ignorePrefixes: ["DVD", "VIDEO"]
    },
    {
      name: "Blu-rays",
      matchPresets: ["adult-bluray"],
      subgroups: ["BLU-RAY", "BLURAY"],
      ignorePrefixes: ["BLU-RAY", "BLURAY", "VIDEO"]
    },
    {
      name: "Children's DVDs",
      matchPresets: ["j-dvd"],
      subgroups: ["J DVD"],
      ignorePrefixes: ["J DVD", "DVD", "VIDEO"]
    },
    {
      name: "Children's Blu-rays",
      matchPresets: ["j-bluray"],
      subgroups: ["J BLU-RAY", "J BLURAY"],
      ignorePrefixes: ["J BLU-RAY", "J BLURAY", "BLU-RAY", "BLURAY", "VIDEO"]
    },
    {
      name: "BluRays and DVDs",
      matchPresets: ["adult-dvd", "adult-bluray", "j-dvd", "j-bluray"],
      subgroups: ["J DVD", "DVD", "J BLU-RAY", "BLU-RAY"],
      ignorePrefixes: ["J DVD", "DVD", "J BLU-RAY", "BLU-RAY", "BLURAY", "VIDEO"]
    },
    { name: "Music CDs", matchPresets: ["music-cd"] },
    { name: "Audiobook CDs", matchPresets: ["audiobook-cd"] }
  ];

  const defaultCategoryRules = Object.fromEntries(
    categoryLibrary
      .filter((category) => groupOrder.includes(category.name))
      .map((category) => [category.name, {
        matchPresets: [...category.matchPresets],
        matchConditions: []
      }])
  );

  const defaultGroupSortSettings = Object.fromEntries(
    categoryLibrary
      .filter((category) => groupOrder.includes(category.name))
      .map((category) => [category.name, {
        ignorePrefixes: [...(category.ignorePrefixes || [])],
        subgroups: [...(category.subgroups || [])],
        interfileSubgroups: true
      }])
  );

  const branchProfiles = [
    ["downtown-reno", "Downtown Reno Library"],
    ["duncan-traner", "Duncan/Traner Community Library"],
    ["gerlach", "Gerlach Community Library"],
    ["incline-village", "Incline Village Library"],
    ["north-valleys", "North Valleys Library"],
    ["northwest-reno", "Northwest Reno Library"],
    ["senior-center", "Senior Center Library"],
    ["sierra-view", "Sierra View Library"],
    ["south-valleys", "South Valleys Library"],
    ["spanish-springs", "Spanish Springs Library"],
    ["sparks", "Sparks Library"],
    ["verdi", "Verdi Community Library & Nature Center"]
  ];

  const profiles = [
    baseProfile,
    ...branchProfiles.map(([id, name]) => ({
      ...baseProfile,
      id,
      name,
      branchName: name,
      ruleMode: "custom",
      groupOrder: [...baseProfile.groupOrder],
      disabledGroups: [],
      groupSortModes: {},
      categoryRules: defaultCategoryRules,
      groupSortSettings: defaultGroupSortSettings
    }))
  ];

  return {
    defaultProfileId: baseProfile.id,
    categoryLibrary,
    profiles
  };
});
