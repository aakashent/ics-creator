'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  sheetUrl: $('sheetUrl'), loadSheet: $('loadSheet'), rowLimit: $('rowLimit'), sheetGid: $('sheetGid'),
  sheetStatus: $('sheetStatus'), mapping: $('mapping'), dateColumn: $('dateColumn'), filterColumn: $('filterColumn'),
  filterValueWrap: $('filterValueWrap'), filterValue: $('filterValue'), importDates: $('importDates'), dates: $('dates'),
  dateCount: $('dateCount'), sortDates: $('sortDates'), dateError: $('dateError'), eventTitle: $('eventTitle'),
  modeIndividual: $('modeIndividual'), modeGrouped: $('modeGrouped'), preview: $('preview'), fileName: $('fileName'), download: $('download')
};

let sheet = { headers: [], rows: [], totalRows: 0, usedRows: 0 };

function parseSheetLink(value) {
  const text = String(value || '').trim();
  const idMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error('That does not look like a Google Sheets link.');
  let gid = '';
  try {
    const url = new URL(text);
    gid = url.searchParams.get('gid') || (url.hash.match(/gid=(\d+)/) || [])[1] || '';
  } catch (_) {
    gid = (text.match(/[?#&]gid=(\d+)/) || [])[1] || '';
  }
  return { id: idMatch[1], gid: gid || '0' };
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

function setStatus(message, error = false) {
  els.sheetStatus.hidden = false;
  els.sheetStatus.textContent = message;
  els.sheetStatus.classList.toggle('error', error);
}

function fillSelect(select, options, firstLabel) {
  select.replaceChildren();
  if (firstLabel != null) select.add(new Option(firstLabel, ''));
  options.forEach((label, i) => select.add(new Option(label || `Column ${i + 1}`, String(i))));
}

function guessDateColumn(headers) {
  const exact = headers.findIndex(h => /^\s*(date|shift date|clinic date|start date)\s*$/i.test(h));
  if (exact >= 0) return exact;
  return headers.findIndex(h => /date/i.test(h));
}

async function loadSheet() {
  els.loadSheet.disabled = true;
  els.mapping.hidden = true;
  setStatus('Loading sheet…');
  try {
    const parsed = parseSheetLink(els.sheetUrl.value);
    const gid = String(els.sheetGid.value || parsed.gid || '0').trim();
    els.sheetGid.value = gid;
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(parsed.id)}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`Google returned ${response.status}. Check that the sheet can be viewed without signing in.`);
    const csv = await response.text();
    if (/<!doctype html|<html/i.test(csv.slice(0, 300))) throw new Error('Google returned a sign-in page. The sheet must be accessible without signing in.');
    const parsedRows = parseCSV(csv);
    if (parsedRows.length < 2) throw new Error('No data rows were found in this sheet tab.');

    const headers = parsedRows[0].map((h, i) => String(h).trim() || `Column ${i + 1}`);
    const allRows = parsedRows.slice(1);
    const limitValue = els.rowLimit.value;
    const limit = limitValue === 'all' ? allRows.length : Number(limitValue);
    const rows = allRows.slice(Math.max(0, allRows.length - limit));
    sheet = { headers, rows, totalRows: allRows.length, usedRows: rows.length };

    fillSelect(els.dateColumn, headers);
    fillSelect(els.filterColumn, headers, 'No filter — include all rows');
    const guessed = guessDateColumn(headers);
    if (guessed >= 0) els.dateColumn.value = String(guessed);
    els.filterColumn.value = '';
    els.filterValueWrap.hidden = true;
    els.mapping.hidden = false;
    setStatus(`Loaded ${rows.length.toLocaleString('en-GB')} of ${allRows.length.toLocaleString('en-GB')} data rows from this tab.`);
  } catch (err) {
    setStatus(err.message || 'Could not load the sheet.', true);
  } finally {
    els.loadSheet.disabled = false;
  }
}

function updateFilterValues() {
  const idx = els.filterColumn.value;
  if (idx === '') {
    els.filterValueWrap.hidden = true;
    els.filterValue.replaceChildren();
    return;
  }
  const values = [...new Set(sheet.rows.map(r => String(r[Number(idx)] ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en-GB', { numeric: true, sensitivity: 'base' }));
  els.filterValue.replaceChildren(new Option('All values', ''));
  values.forEach(v => els.filterValue.add(new Option(v, v)));
  els.filterValue.value = '';
  els.filterValueWrap.hidden = false;
}

function pad2(n) { return String(n).padStart(2, '0'); }
function makeUTCDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

function parseDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  let m = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) {
    let y = Number(m[3]); if (y < 100) y += y >= 70 ? 1900 : 2000;
    return makeUTCDate(y, Number(m[2]), Number(m[1]));
  }
  m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return makeUTCDate(Number(m[1]), Number(m[2]), Number(m[3]));
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return makeUTCDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return null;
}

function dateKey(date) { return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`; }
function displayDate(date) { return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`; }
function addDays(date, days) { const d = new Date(date.getTime()); d.setUTCDate(d.getUTCDate() + days); return d; }

function splitDateInput(text) {
  return String(text || '').replace(/\r/g, '\n').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
}

function parseDateList(text) {
  const dates = new Map();
  const invalid = [];
  for (const token of splitDateInput(text)) {
    const rangeParts = token.split(/\s+(?:to|–|—|-)\s+/i);
    if (rangeParts.length === 2) {
      const start = parseDate(rangeParts[0]), end = parseDate(rangeParts[1]);
      if (!start || !end || end < start) { invalid.push(token); continue; }
      const span = Math.round((end - start) / 86400000);
      if (span > 3660) { invalid.push(token); continue; }
      for (let i = 0; i <= span; i++) { const d = addDays(start, i); dates.set(dateKey(d), d); }
    } else {
      const d = parseDate(token);
      if (!d) invalid.push(token); else dates.set(dateKey(d), d);
    }
  }
  return { dates: [...dates.values()].sort((a, b) => a - b), invalid };
}

function importMatchingDates() {
  const dateIdx = Number(els.dateColumn.value);
  if (!Number.isInteger(dateIdx)) return;
  const filterIdx = els.filterColumn.value === '' ? null : Number(els.filterColumn.value);
  const filterValue = els.filterValue.value;
  const matching = sheet.rows.filter(row => filterIdx == null || !filterValue || String(row[filterIdx] ?? '').trim() === filterValue);
  const valid = [], bad = [];
  matching.forEach(row => {
    const raw = row[dateIdx];
    const d = parseDate(raw);
    if (d) valid.push(d); else if (String(raw ?? '').trim()) bad.push(String(raw).trim());
  });
  const unique = [...new Map(valid.map(d => [dateKey(d), d])).values()].sort((a, b) => a - b);
  els.dates.value = unique.map(displayDate).join('\n');
  updateDateUI();
  setStatus(`Loaded ${sheet.usedRows.toLocaleString('en-GB')} of ${sheet.totalRows.toLocaleString('en-GB')} rows · ${matching.length.toLocaleString('en-GB')} matching rows · ${unique.length.toLocaleString('en-GB')} unique dates${bad.length ? ` · ${bad.length} unrecognised date${bad.length === 1 ? '' : 's'}` : ''}.`);
  if (unique.length) els.dates.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function groupConsecutive(dates) {
  if (!dates.length) return [];
  const groups = [];
  let start = dates[0], end = dates[0];
  for (let i = 1; i < dates.length; i++) {
    if ((dates[i] - end) / 86400000 === 1) end = dates[i];
    else { groups.push({ start, end }); start = end = dates[i]; }
  }
  groups.push({ start, end });
  return groups;
}

function shortDisplay(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); }
function updateDateUI() {
  const parsed = parseDateList(els.dates.value);
  els.dateCount.textContent = `${parsed.dates.length} date${parsed.dates.length === 1 ? '' : 's'}`;
  els.dateError.hidden = parsed.invalid.length === 0;
  els.dateError.textContent = parsed.invalid.length ? `Could not understand: ${parsed.invalid.slice(0, 4).join(', ')}${parsed.invalid.length > 4 ? '…' : ''}` : '';
  els.download.disabled = parsed.dates.length === 0 || parsed.invalid.length > 0;

  if (!parsed.dates.length) { els.preview.hidden = true; return; }
  const grouped = els.modeGrouped.checked;
  const groups = grouped ? groupConsecutive(parsed.dates) : parsed.dates.map(d => ({ start: d, end: d }));
  const examples = groups.slice(0, 5).map(g => dateKey(g.start) === dateKey(g.end) ? shortDisplay(g.start) : `${shortDisplay(g.start)}–${shortDisplay(g.end)}`);
  els.preview.hidden = false;
  els.preview.innerHTML = `<strong>${parsed.dates.length} date${parsed.dates.length === 1 ? '' : 's'} → ${groups.length} calendar event${groups.length === 1 ? '' : 's'}</strong><br>${examples.join(' · ')}${groups.length > 5 ? ' · …' : ''}`;
}

function sortAndNormalise() {
  const parsed = parseDateList(els.dates.value);
  if (parsed.invalid.length) { updateDateUI(); return; }
  els.dates.value = parsed.dates.map(displayDate).join('\n');
  updateDateUI();
}

function icsDate(date) { return dateKey(date).replaceAll('-', ''); }
function escapeICS(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function utcStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}
function uid() {
  if (globalThis.crypto?.randomUUID) return `${crypto.randomUUID()}@ics-creator`;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}@ics-creator`;
}
function foldICS(line) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts = []; let current = '';
  for (const ch of line) {
    if (encoder.encode(current + ch).length > (parts.length ? 74 : 75)) { parts.push(current); current = ch; }
    else current += ch;
  }
  if (current) parts.push(current);
  return parts.map((p, i) => i ? ` ${p}` : p).join('\r\n');
}

function buildICS() {
  const parsed = parseDateList(els.dates.value);
  if (!parsed.dates.length || parsed.invalid.length) return null;
  const groups = els.modeGrouped.checked ? groupConsecutive(parsed.dates) : parsed.dates.map(d => ({ start: d, end: d }));
  const title = els.eventTitle.value.trim() || 'Event';
  const stamp = utcStamp();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ICS Creator//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  groups.forEach(g => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid()}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(g.start)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDays(g.end, 1))}`);
    lines.push(`SUMMARY:${escapeICS(title)}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldICS).join('\r\n') + '\r\n';
}

function downloadICS() {
  const content = buildICS();
  if (!content) return;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (els.fileName.value.trim() || 'calendar').replace(/\.ics$/i, '').replace(/[\\/:*?"<>|]+/g, '-');
  a.href = url; a.download = `${safeName}.ics`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

els.loadSheet.addEventListener('click', loadSheet);
els.filterColumn.addEventListener('change', updateFilterValues);
els.importDates.addEventListener('click', importMatchingDates);
els.dates.addEventListener('input', updateDateUI);
els.sortDates.addEventListener('click', sortAndNormalise);
els.modeIndividual.addEventListener('change', updateDateUI);
els.modeGrouped.addEventListener('change', updateDateUI);
els.download.addEventListener('click', downloadICS);
els.sheetUrl.addEventListener('paste', () => setTimeout(() => {
  try { const parsed = parseSheetLink(els.sheetUrl.value); els.sheetGid.value = parsed.gid; } catch (_) {}
}, 0));

updateDateUI();
