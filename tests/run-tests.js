const assert = require("assert");
const shim = require("../js/core");

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

console.log("All SHIM tests passed.");
