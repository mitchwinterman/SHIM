# SHIM

SHIM is a static browser MVP for converting copied Koha holds queue text into a formatted, printable HOLDS list sorted by local shelf workflow.

## Use

Open `index.html` in a browser, paste the copied Koha holds queue text, and click `Format HOLDS List`.

The results screen shows:

- estimated input hold count
- parsed hold count
- output row count
- warnings for duplicate barcodes, blank call numbers, unparsed blocks, and records routed to `Other`
- grouped printable output

Use `Print` for the formatted list and `New Paste` to clear the screen for the next queue.

## Development

The shelf profile lives in `js/profile.js`.

The parser, classifier, sorter, and report builder live in `js/core.js`.

Run the dependency-free tests with:

```powershell
npm test
```
