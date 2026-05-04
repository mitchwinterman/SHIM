(function bootShimApp(root) {
  "use strict";

  const shim = root.SHIM;
  const elements = {
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
    output: document.getElementById("holds-output")
  };

  elements.formatButton.addEventListener("click", () => {
    const result = shim.formatHolds(elements.input.value);
    renderResult(result);
    elements.pasteScreen.classList.add("is-hidden");
    elements.resultsScreen.classList.remove("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  elements.clearButton.addEventListener("click", () => {
    elements.input.value = "";
    elements.input.focus();
  });

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
            el("th", { className: "title-cell" }, "Title"),
            el("th", { className: "author-cell" }, "Author"),
            el("th", { className: "call-cell" }, "Call number"),
            el("th", { className: "barcode-cell" }, "Barcode"),
            el("th", { className: "type-cell" }, "Item type")
          )
        ),
        el("tbody", {}, ...group.items.map(renderRow))
      )
    );
  }

  function renderRow(record) {
    const titleCell = el("td", { className: "title-cell" }, record.title);
    if (record.reviewReasons.length > 0) {
      titleCell.appendChild(el("div", { className: "row-note" }, record.reviewReasons.join("; ")));
    }

    return el("tr", {},
      el("td", { className: "check-cell" }, el("span", { className: "checkbox", "aria-hidden": "true" }, "")),
      titleCell,
      el("td", { className: "author-cell" }, record.author || ""),
      el("td", { className: "call-cell" }, record.callNumber || ""),
      el("td", { className: "barcode-cell" }, renderBarcode(record)),
      el("td", { className: "type-cell" }, record.itemType || "")
    );
  }

  function renderBarcode(record) {
    const text = record.barcodeText || record.barcode || "";
    const match = text.match(/^(\d{14})(.*)$/);
    if (!match) {
      return text;
    }

    const suffix = match[2].trim();
    if (!suffix) {
      return match[1];
    }

    return [
      el("span", { className: "barcode-number" }, match[1]),
      " ",
      el("span", { className: "availability-note" }, suffix)
    ];
  }

  function updatePrintPageStyle() {
    const printedAt = new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date());

    const safeDate = printedAt.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    elements.printPageStyle.textContent = `
      @page {
        size: auto;
        margin: 0.42in 0.35in 0.46in;
        @top-left {
          content: "SHIM HOLDS List";
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
