'use strict';

(() => {
  const originalButton = els.importDates;
  const importButton = originalButton.cloneNode(true);
  originalButton.replaceWith(importButton);
  els.importDates = importButton;

  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');

  function importMatchingDatesWithRange() {
    const dateIdx = Number(els.dateColumn.value);
    if (!Number.isInteger(dateIdx)) return;

    const filterIdx = els.filterColumn.value === '' ? null : Number(els.filterColumn.value);
    const filterValue = els.filterValue.value;
    const from = dateFrom.value ? parseDate(dateFrom.value) : null;
    const to = dateTo.value ? parseDate(dateTo.value) : null;

    if (from && to && from > to) {
      setStatus('The From date must be on or before the To date.', true);
      return;
    }

    const valueMatching = sheet.rows.filter(row =>
      filterIdx == null || !filterValue || String(row[filterIdx] ?? '').trim() === filterValue
    );

    const valid = [];
    const bad = [];
    let outsideRange = 0;

    valueMatching.forEach(row => {
      const raw = row[dateIdx];
      const date = parseDate(raw);
      if (!date) {
        if (String(raw ?? '').trim()) bad.push(String(raw).trim());
        return;
      }
      if ((from && date < from) || (to && date > to)) {
        outsideRange++;
        return;
      }
      valid.push(date);
    });

    const unique = [...new Map(valid.map(date => [dateKey(date), date])).values()].sort((a, b) => a - b);
    els.dates.value = unique.map(displayDate).join('\n');
    updateDateUI();

    const rangeText = from || to
      ? ` · ${outsideRange.toLocaleString('en-GB')} outside date range`
      : '';
    setStatus(
      `Loaded ${sheet.usedRows.toLocaleString('en-GB')} of ${sheet.totalRows.toLocaleString('en-GB')} rows` +
      ` · ${valueMatching.length.toLocaleString('en-GB')} matching rows` +
      rangeText +
      ` · ${unique.length.toLocaleString('en-GB')} unique dates` +
      (bad.length ? ` · ${bad.length} unrecognised date${bad.length === 1 ? '' : 's'}` : '') +
      '.'
    );

    if (unique.length) els.dates.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  importButton.addEventListener('click', importMatchingDatesWithRange);
})();
