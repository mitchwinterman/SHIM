# SHIM

SHIM is a dependency-free static browser MVP for converting copied Koha holds queue text into a formatted, printable HOLDS list sorted by local shelf workflow.

The app does not change Koha and does not save pasted data. Staff paste a copied holds queue, click `Format HOLDS List`, verify counts/warnings, print the list, then use `New Paste` for the next queue.

## Use

Open `index.html` in a browser.

1. Copy the holds queue from Koha.
2. Paste the copied text into SHIM.
3. Click `Format HOLDS List`.
4. Review the verification counts and warnings.
5. Click `Print`.
6. Click `New Paste` to clear the screen for another list.

## Current MVP Behavior

- Parses Koha full-page copies and table-only copies.
- Ignores Koha navigation, repeated headers, blank lines, filters, and trailing sidebar/list text.
- Detects hold records from lines containing a 14-digit barcode and date.
- Reconstructs titles from the preceding title block.
- Preserves visible Koha values for title, author, call number, barcode, and item type.
- Uses collection, shelving location, and call number for grouping/sorting.
- Treats item type as display-only; item type does not determine grouping or sorting.
- Routes duplicate barcodes inside one paste to `Other` and reports them for review.
- Keeps unknown valid records in `Other` instead of dropping them.

## Verification Report

The results screen shows:

- estimated input hold count
- parsed hold count
- output row count
- warning count
- unparsed blocks
- blank call numbers
- duplicate barcode clusters
- records routed to `Other`
- count mismatch warnings

## Print Output

The print view is optimized as a working shelf list:

- compact count summary instead of the large verification banner
- group headings with item counts
- checkboxes for each item row
- alternating row shading
- title, author, call number, barcode, and item type columns
- barcode prints without the `or any available` suffix
- date/time and page number are added through print page metadata

Browser print support for custom page headers/footers varies. If the browser does not render SHIM's page metadata, enable browser print headers/footers as a fallback.

## Shelf Profile

The local shelf profile lives in `js/profile.js`.

Current group order:

```js
[
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
]
```

Important current rules:

- `Special Collections` is based on collection or shelving location, not item type.
- `New Arrivals Shelf` redirects only configured new groups.
- New status is ignored for DVDs/Blu-rays, music CDs, audiobook CDs, board books, early readers, picture books, world language, and children's nonfiction.
- Children's world language is separate from adult world language and appears after `Children's Fiction`.
- Large print adult nonfiction is interfiled with `Adult Nonfiction`.
- DVDs and Blu-rays interfile together.
- Music CDs sort by artist after stripping music genre prefixes.
- Early Readers are identified by `J E` or `JE` call numbers ending in `=`.

## Development

Key files:

- `index.html` - static app shell
- `css/styles.css` - screen and print styles
- `js/profile.js` - local shelf profile and configurable rule data
- `js/core.js` - parser, classifier, sorter, and report builder
- `js/app.js` - browser UI rendering and actions
- `tests/run-tests.js` - dependency-free behavior tests

Run tests with:

```powershell
npm test
```

Run syntax checks with:

```powershell
node --check js\profile.js
node --check js\core.js
node --check js\app.js
```
