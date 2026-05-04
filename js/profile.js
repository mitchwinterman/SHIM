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
    groupOrder,
    disabledGroups: [],
    groupSortModes: {},
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
      groupOrder: [...baseProfile.groupOrder],
      disabledGroups: [],
      groupSortModes: {}
    }))
  ];

  return {
    defaultProfileId: baseProfile.id,
    profiles
  };
});
