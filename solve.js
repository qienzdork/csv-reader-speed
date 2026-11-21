// csv-reader-speed: a fast drop-in for csv-reader 1.0.0 (make.fun).
// run(input) returns {columns, rows, errors} with exactly csv-reader
// 1.0.0's broken-row policy. Instead of walking the text character by
// character, the parser jumps between delimiters with indexOf and slices
// whole fields at once; a record whose line holds no quote and no stray
// CR is split in one go.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  // How the last field read ended: 0 comma, 1 line break, 2 end of text.
  let ended = 2;
  // Characters the last unquoted read kept (quote_junk needs it).
  let added = 0;

  // Reads an unquoted field starting at pos, onto `value`. A CR not
  // followed by LF is dropped with a stray_cr error and the field goes
  // on; a comma ends it, a line break ends it and the record, the end
  // of the text ends both. Sets `ended` and `added`.
  function readUnquoted(value) {
    let start = pos;
    added = 0;
    for (;;) {
      const ci = text.indexOf(',', start);
      const ni = text.indexOf('\n', start);
      let m = -1;
      let kind = 0;
      if (ci !== -1) { m = ci; kind = 0; }
      if (ni !== -1 && (m === -1 || ni < m)) { m = ni; kind = 1; }
      if (m === -1) {
        // No comma or line break ahead: the rest of the text is this field.
        const ri = text.indexOf('\r', start);
        if (ri === -1) {
          added += len - start;
          value += text.slice(start);
          pos = len;
          ended = 2;
          return value;
        }
        // A lone CR (no LF follows anywhere): stray, drop it, carry on.
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        added += ri - start;
        value += text.slice(start, ri);
        start = ri + 1;
        continue;
      }
      // A CR before the next delimiter: the CR of a CRLF when the
      // delimiter is a line break and the CR sits right before it,
      // else a stray CR that is dropped with an error.
      let r = -1;
      for (let k = start; k < m; k++) {
        if (text.charCodeAt(k) === 13) { r = k; break; }
      }
      if (r !== -1) {
        if (kind === 1 && r === m - 1) {
          added += r - start;
          value += text.slice(start, r);
          pos = m + 1;
          line += 1;
          ended = 1;
          return value;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        added += r - start;
        value += text.slice(start, r);
        start = r + 1;
        continue;
      }
      added += m - start;
      value += text.slice(start, m);
      if (kind === 0) {
        pos = m + 1;
        ended = 0;
        return value;
      }
      pos = m + 1;
      line += 1;
      ended = 1;
      return value;
    }
  }

  // The raw content of a quoted chunk, text[a..b): each CRLF and each
  // lone CR becomes one LF, and every line break inside it moves the
  // line count. Chunks with no line break are returned as one slice.
  function processChunk(a, b) {
    const chunk = text.slice(a, b);
    const ri = chunk.indexOf('\r');
    if (ri === -1) {
      const ni = chunk.indexOf('\n');
      if (ni === -1) return chunk;
      let n = 0;
      let p = 0;
      for (;;) {
        const k = chunk.indexOf('\n', p);
        if (k === -1) break;
        n += 1;
        p = k + 1;
      }
      line += n;
      return chunk;
    }
    let out = '';
    let p = 0;
    let s = 0;
    while (p < chunk.length) {
      const c = chunk.charCodeAt(p);
      if (c === 13) {
        out += chunk.slice(s, p);
        out += '\n';
        line += 1;
        p += (p + 1 < chunk.length && chunk.charCodeAt(p + 1) === 10) ? 2 : 1;
        s = p;
      } else {
        if (c === 10) line += 1;
        p += 1;
      }
    }
    out += chunk.slice(s);
    return out;
  }

  // Reads a quoted field whose opening quote is at pos. A doubled quote
  // inside it is one quote; what follows the closing quote, up to the
  // next comma or line break, is appended as it stands (quote_junk when
  // the field ends with anything appended); a quote that never closes is
  // a literal character and the text after it is read again as unquoted.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    let seg = pos;
    for (;;) {
      const q = text.indexOf('"', seg);
      if (q === -1) {
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        pos = open + 1;
        return readUnquoted('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        value += processChunk(seg, q);
        value += '"';
        seg = q + 2;
        continue;
      }
      value += processChunk(seg, q);
      pos = q + 1;
      if (pos >= len) {
        ended = 2;
        return value;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        ended = 0;
        return value;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        ended = 1;
        return value;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        ended = 1;
        return value;
      }
      const junk = readUnquoted(value);
      if (added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    let fields = null;
    let lastQuoted = false;
    // A line with no quote and no stray CR splits in one go.
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd === -1 ? len : lineEnd;
    const lineStr = text.slice(pos, end);
    if (lineStr.indexOf('"') === -1) {
      const ri = lineStr.indexOf('\r');
      if (ri === -1) {
        fields = lineStr.split(',');
        pos = lineEnd === -1 ? len : lineEnd + 1;
        line += 1;
      } else if (lineEnd !== -1 && ri === lineStr.length - 1) {
        fields = lineStr.slice(0, -1).split(',');
        pos = lineEnd + 1;
        line += 1;
      }
    }
    if (fields === null) {
      fields = [];
      do {
        if (text.charCodeAt(pos) === 34) {
          fields.push(readQuoted());
          lastQuoted = true;
        } else {
          fields.push(readUnquoted(''));
          lastQuoted = false;
        }
      } while (ended === 0);
    }

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
