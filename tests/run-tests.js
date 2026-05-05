const assert = require("assert");
const shim = require("../js/core");
const profileStore = require("../js/profileStore");

const fixture = `Koha
Circulation
Holds queue
5 items found for Test Library
Title\tAuthor\tCollection\tShelving location\tItem type\tCall number\tBarcode\tSend to\tDate
Title
Author
Collection
Location
Item type
Call number
Barcode
Send to
Date
Scream VI [Blu-ray] / BLU-RAY VIDEO

DVD / Blu-rays\t\tBlu-ray 07 Day\tBLU-RAY VIDEO SCREAM\t31235600026640 or any available\tRN Downtown Reno Library\t05/01/2026
Finestkind [DVD videorecording] / DVD VIDEO

DVD / Blu-rays\t\tDVD 07 Day\tDVD VIDEO FINEST\t31235600044536 or any available\tRN Downtown Reno Library\t05/01/2026
Flat Stanley goes camping / J E Flat Stanley (easy readers) I can read!

Houran, Lori Haskins,\tChildren's Early Readers\t\tBook\tJ E BROWN 2013 =\t31235400809245 or any available\tSP Sparks Library\t05/01/2026
American fantasy [large print] / FICTION

Straub, Emma\tAdult Fiction\tNew Arrivals Shelf\tBook - Large Print\tLP FICTION STRAUB 2026\t31235800218484 or any available\tSS Spanish Springs Library\t04/30/2026
Tall water / YA 741.5

Sindu, SJ,\tYoung Adult Nonfiction\tNew Arrivals Shelf\tBook\tYA 741.5 SINDU 2025\t31235800169539 or any available\tSV Sierra View Library\t05/01/2026`;

const result = shim.formatHolds(fixture);
assert.strictEqual(result.report.estimatedInputCount, 5);
assert.strictEqual(result.report.parsedCount, 5);
assert.strictEqual(result.report.outputCount, 5);
assert.strictEqual(result.report.countMatches, true);

const groups = Object.fromEntries(result.groups.map((group) => [group.name, group.items]));
assert.strictEqual(groups["BluRays and DVDs"].length, 2);
assert.deepStrictEqual(groups["BluRays and DVDs"].map((record) => record.callNumber), [
  "DVD VIDEO FINEST",
  "BLU-RAY VIDEO SCREAM"
]);
assert.strictEqual(groups["Early Readers"][0].title, "Flat Stanley goes camping / J E Flat Stanley (easy readers) I can read!");
assert.strictEqual(groups["NEW Large Print"][0].callNumber, "LP FICTION STRAUB 2026");
assert.strictEqual(groups["New YA"][0].callNumber, "YA 741.5 SINDU 2025");

const duplicateFixture = `2 items found for Test Library
First duplicate / FICTION

Author One\tAdult Fiction\t\tBook\tFICTION ONE 2020\t31235000000000 or any available\tRN Downtown Reno Library\t05/01/2026
Second duplicate / FICTION

Author Two\tAdult Fiction\t\tBook\tFICTION TWO 2021\t31235000000000 or any available\tRN Downtown Reno Library\t05/01/2026`;

const duplicateResult = shim.formatHolds(duplicateFixture);
assert.strictEqual(duplicateResult.report.duplicateGroups.length, 1);
assert.strictEqual(duplicateResult.groups.find((group) => group.name === "Other").items.length, 2);

const itemTypeSpecialFixture = `The road home / J E

Cotton, Katie,\tChildren's Picture Books\t\tBook Special Collections\tJ E COTTON 2017\t31235400818626 or any available\tSP Sparks Library\t04/29/2026`;

const itemTypeSpecialResult = shim.formatHolds(itemTypeSpecialFixture);
assert.strictEqual(itemTypeSpecialResult.groups[0].name, "Picture Books/Easy Readers");

const locationSpecialFixture = `Local history item / 979.3

Author Name\tAdult Nonfiction\tSpecial Collections Shelf\tBook\t979.3 AUTHOR 2020\t31235400818627 or any available\tSP Sparks Library\t04/29/2026`;

const locationSpecialResult = shim.formatHolds(locationSpecialFixture);
assert.strictEqual(locationSpecialResult.groups[0].name, "Special Collections");

const languageFixture = `La piñata que la campesina colgó / SPANISH J E

Vamos, Samantha R.\tChildren's Picture Books\tNew Arrivals Shelf\tBook\tSPANISH J E VAMOS 2025\t31235800167962 or any available\tSS Spanish Springs Library\t04/05/2026`;

const languageResult = shim.formatHolds(languageFixture);
assert.strictEqual(languageResult.groups[0].name, "Children's World Language");

const musicFixture = `2 items found for Test Library
Lost Americana [sound recording] / CD/RAP/HIP-HOP

Machine Gun Kelly,\tMusic - CD\t\tCD Music\tCD/RAP/HIP-HOP MACHIN 2025\t31235600078971 or any available\tNV North Valleys Library\t05/01/2026
Chuck [sound recording] / CD/POP/ROCK

Berry, Chuck.\tMusic - CD\t\tCD Music\tCD/POP/ROCK BERRY 2017\t31235038556838 or any available\tRN Downtown Reno Library\t05/01/2026`;

const musicResult = shim.formatHolds(musicFixture);
assert.deepStrictEqual(musicResult.groups[0].items.map((record) => record.callNumber), [
  "CD/POP/ROCK BERRY 2017",
  "CD/RAP/HIP-HOP MACHIN 2025"
]);

const customProfile = shim.resolveProfile("downtown-reno");
customProfile.id = "test-reordered";
customProfile.groupOrder = profileStore.mergeGroupOrder([
  "Early Readers",
  "BluRays and DVDs",
  ...customProfile.groupOrder
], customProfile.groupOrder);
const reorderedResult = shim.formatHolds(fixture, customProfile);
assert.strictEqual(reorderedResult.groups[0].name, "Early Readers");
assert.strictEqual(reorderedResult.groups[1].name, "BluRays and DVDs");

assert.strictEqual(shim.defaultProfileId, "downtown-reno");
assert.strictEqual(shim.getProfiles().length, 12);
assert.ok(!shim.getProfiles().some((profile) => profile.id === "mvp"));
assert.ok(shim.getProfiles().some((profile) => profile.id === "verdi"));
assert.strictEqual(shim.resolveProfile("sparks").groupOrder[0], "New Adult Fiction");
assert.strictEqual(shim.resolveProfile("sparks").groupOrder.at(-1), "Other");
const seededBranchResult = shim.formatHolds(fixture, "sparks");
assert.strictEqual(seededBranchResult.groups[0].name, "NEW Large Print");

const languageDvdFixture = `The worst person in the world [DVD videorecording] / NORWEGIAN DVD VIDEO Criterion collection

DVD / Blu-rays\t\tDVD 07 Day\tNORWEGIAN DVD VIDEO WORST\t31235499962582 or any available\tSSD Spanish Springs Drive-Up\t05/01/2026`;
const languageDvdResult = shim.formatHolds(languageDvdFixture, "downtown-reno");
assert.strictEqual(languageDvdResult.report.otherRecords.length, 0);
assert.strictEqual(languageDvdResult.groups[0].name, "BluRays and DVDs");

const disabledNevadaProfile = shim.resolveProfile("downtown-reno");
disabledNevadaProfile.disabledGroups = ["Nevada Collection"];
const nevadaBioFixture = `Nevada biography / BIO

Historian, Local\tAdult Nonfiction\tNevada Room\tBook\tBIO SMITH 2020\t31235000000001 or any available\tRN Downtown Reno Library\t05/01/2026`;
const disabledNevadaResult = shim.formatHolds(nevadaBioFixture, disabledNevadaProfile);
assert.strictEqual(disabledNevadaResult.groups[0].name, "Biography");

const titleSortProfile = shim.resolveProfile("downtown-reno");
titleSortProfile.groupSortModes = { "Adult Fiction": "title" };
const titleSortFixture = `2 items found for Test Library
Zoo story / FICTION

Author One\tAdult Fiction\t\tBook\tFICTION ALPHA 2020\t31235000000002 or any available\tRN Downtown Reno Library\t05/01/2026
Apple story / FICTION

Author Two\tAdult Fiction\t\tBook\tFICTION ZULU 2021\t31235000000003 or any available\tRN Downtown Reno Library\t05/01/2026`;
const titleSortResult = shim.formatHolds(titleSortFixture, titleSortProfile);
assert.deepStrictEqual(titleSortResult.groups[0].items.map((record) => record.title), [
  "Apple story / FICTION",
  "Zoo story / FICTION"
]);

const customBranchProfile = shim.resolveProfile("sparks");
customBranchProfile.groupOrder = ["Children's DVDs", "DVDs", "Other"];
customBranchProfile.categoryRules = {
  "Children's DVDs": { matchPresets: ["j-dvd"], matchConditions: [] },
  DVDs: { matchPresets: ["adult-dvd"], matchConditions: [] }
};
const dvdSplitFixture = `2 items found for Test Library
Kid movie [DVD] / J DVD

Director One\tChildren's DVD / Blu-rays\t\tDVD 07 Day\tJ DVD KIDMOVIE\t31235000000004 or any available\tRN Downtown Reno Library\t05/01/2026
Adult movie [DVD] / DVD

Director Two\tDVD / Blu-rays\t\tDVD 07 Day\tDVD ADULTMOVIE\t31235000000005 or any available\tRN Downtown Reno Library\t05/01/2026`;
const dvdSplitResult = shim.formatHolds(dvdSplitFixture, customBranchProfile);
assert.deepStrictEqual(dvdSplitResult.groups.map((group) => group.name), ["Children's DVDs", "DVDs"]);

const subgroupProfile = shim.resolveProfile("sparks");
subgroupProfile.groupOrder = ["Media", "Other"];
subgroupProfile.categoryRules = {
  Media: { matchPresets: ["j-dvd", "adult-dvd", "adult-bluray"], matchConditions: [] }
};
subgroupProfile.groupSortSettings = {
  Media: {
    subgroups: ["J DVD", "DVD", "BLU-RAY"],
    ignorePrefixes: ["J DVD", "DVD", "BLU-RAY", "VIDEO"],
    interfileSubgroups: false
  }
};
const subgroupFixture = `3 items found for Test Library
Bravo [Blu-ray] / BLU-RAY

Director B\tDVD / Blu-rays\t\tBlu-ray 07 Day\tBLU-RAY VIDEO BRAVO\t31235000000006 or any available\tRN Downtown Reno Library\t05/01/2026
Alpha [DVD] / DVD

Director A\tDVD / Blu-rays\t\tDVD 07 Day\tDVD VIDEO ALPHA\t31235000000007 or any available\tRN Downtown Reno Library\t05/01/2026
Charlie [DVD] / J DVD

Director C\tChildren's DVD / Blu-rays\t\tDVD 07 Day\tJ DVD VIDEO CHARLIE\t31235000000008 or any available\tRN Downtown Reno Library\t05/01/2026`;
const subgroupResult = shim.formatHolds(subgroupFixture, subgroupProfile);
assert.deepStrictEqual(subgroupResult.groups[0].items.map((record) => record.callNumber), [
  "J DVD VIDEO CHARLIE",
  "DVD VIDEO ALPHA",
  "BLU-RAY VIDEO BRAVO"
]);

const store = createMemoryStorage();
profileStore.saveSelectedProfileId(store, "sparks");
assert.strictEqual(profileStore.loadSelectedProfileId(store, "downtown-reno"), "sparks");

profileStore.saveOverride(store, "downtown-reno", {
  groupOrder: ["Other", "Early Readers"],
  disabledGroups: ["Nevada Collection"],
  groupSortModes: { "Adult Fiction": "title" },
  categoryRules: { "Early Readers": { matchPresets: ["early-readers"], matchConditions: [] } },
  groupSortSettings: { "Early Readers": { subgroups: ["J E"], ignorePrefixes: ["J E"], interfileSubgroups: true } }
});
let profiles = profileStore.applyOverrides([shim.resolveProfile("downtown-reno")], profileStore.loadOverrides(store));
assert.strictEqual(profiles[0].groupOrder[0], "Early Readers");
assert.strictEqual(profiles[0].groupOrder[profiles[0].groupOrder.length - 1], "Other");
assert.deepStrictEqual(profiles[0].disabledGroups, ["Nevada Collection"]);
assert.strictEqual(profiles[0].groupSortModes["Adult Fiction"], "title");
assert.deepStrictEqual(profiles[0].categoryRules["Early Readers"].matchPresets, ["early-readers"]);
assert.deepStrictEqual(profiles[0].groupSortSettings["Early Readers"].ignorePrefixes, ["J E"]);
assert.strictEqual(profiles[0].hasLocalOverride, true);

const exported = profileStore.exportOverride(profiles[0]);
const imported = profileStore.importOverride(exported, shim.resolveProfile("downtown-reno"));
assert.strictEqual(imported.groupOrder[0], "Early Readers");

profileStore.resetOverride(store, "downtown-reno");
profiles = profileStore.applyOverrides([shim.resolveProfile("downtown-reno")], profileStore.loadOverrides(store));
assert.strictEqual(profiles[0].groupOrder[0], "New Adult Fiction");
assert.strictEqual(Boolean(profiles[0].hasLocalOverride), false);

console.log("All SHIM tests passed.");

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}
