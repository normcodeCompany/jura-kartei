/* Jura-Kartei – private, lokale Karteikarten-Ablage.
   Alle Daten bleiben im Browser des jeweiligen Geräts (IndexedDB). Kein Server, kein Konto. */
(() => {
'use strict';

/* ============================================================
   1. Hilfsfunktionen
   ============================================================ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const heute = () => iso(new Date());
const plusTage = (datum, n) => { const d = new Date(datum + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const deDatum = ds => { if (!ds) return '—'; const [y, m, d] = ds.split('-'); return `${d}.${m}.${y}`; };
const deZeit  = ms => new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

function toast(text, ms = 2200) {
  const t = $('#toast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

/* Markdown-light: **fett**, *kursiv*, - Listen, Absätze */
function inlineFmt(s) {
  return esc(s)
    .replace(/\{\{(.+?)\}\}/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}
/* Markdown-Zeichen für Vorschautexte entfernen */
const klartext = s => String(s || '')
  .replace(/\{\{(.+?)\}\}/g, '$1')
  .replace(/\*\*/g, '').replace(/\*/g, '')
  .replace(/^[-•]\s+/gm, '').replace(/\s*\n+\s*/g, ' · ').trim();

function fmt(text) {
  const zeilen = String(text || '').split('\n');
  let out = '', inList = false;
  for (const roh of zeilen) {
    const z = roh.trim();
    if (/^[-*•]\s+/.test(z)) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += '<li>' + inlineFmt(z.replace(/^[-*•]\s+/, '')) + '</li>';
      continue;
    }
    if (inList) { out += '</ul>'; inList = false; }
    if (z) out += '<p>' + inlineFmt(z) + '</p>';
  }
  if (inList) out += '</ul>';
  return out;
}

/* Prüfungspunkte: Einrückung (Tab oder 2 Leerzeichen) = Ebene.
   Der Text bleibt unverändert – die Nummerierung schreibst du selbst. */
function parsePunkte(text) {
  return String(text || '').split('\n').map(z => {
    const m = z.match(/^([\t ]*)(.*)$/);
    const einzug = m[1].replace(/\t/g, '  ');
    const level = Math.min(3, Math.floor(einzug.length / 2));
    const t = m[2].trim();
    return t ? { level, text: t } : null;
  }).filter(Boolean);
}
const punkteText = p => (p || []).map(x => '  '.repeat(x.level) + x.text).join('\n');

function renderPunkte(punkte) {
  if (!punkte || !punkte.length) return '<p style="color:var(--ink-3)">Noch keine Prüfungspunkte.</p>';
  return '<ul class="schema-list">'
    + punkte.map(p => `<li class="lvl${p.level}">${inlineFmt(p.text)}</li>`).join('')
    + '</ul>';
}

/* ---------- Lückentext ----------
   Entweder du setzt Lücken selbst mit {{doppelten Klammern}},
   oder die App wählt Schlüsselwörter automatisch – pro Karte immer dieselben. */
const STOPPWORTE = new Set(('der die das den dem des ein eine einer eines einem einen und oder nicht '
  + 'ist sind sein war wird werden auf für mit von vom zur zum bei durch über unter nach aus als auch '
  + 'dass wenn sich ihre seine sowie bzw zwischen gegen ohne dieser diese dieses jeder jede jedes nur '
  + 'noch schon dann also aber sondern damit dadurch wegen kann muss soll').split(' '));

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const normWort = s => String(s || '').toLowerCase().replace(/[^a-zäöüß0-9]/g, '');

function luecke(wort) {
  const breite = Math.max(5, Math.min(26, wort.length + 1));
  return `<input class="cloze" type="text" autocapitalize="off" autocorrect="off" spellcheck="false"`
    + ` aria-label="Lücke" data-loesung="${esc(wort)}" style="width:${breite}ch">`;
}

const CLOZE_TRENNER = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*)/;
const istKandidat = w => w.length >= 5 && !STOPPWORTE.has(w.toLowerCase());

/* Wählt die Lücken für eine ganze Karte aus – nicht pro Zeile, sonst
   ersäuft ein langes Schema in Lücken. Die Auswahl bleibt pro Karte gleich. */
function clozeAufbau(zeilen, kartenId) {
  const zerlegt = zeilen.map((z, zi) => {
    const roh = String(z.text || '').replace(/\*\*/g, '').replace(/\*/g, '');
    return { zi, roh, level: z.level || 0, explizit: /\{\{.+?\}\}/.test(roh), teile: roh.split(CLOZE_TRENNER) };
  });

  const explizitModus = zerlegt.some(z => z.explizit);
  const gewaehlt = new Set();

  if (!explizitModus) {
    const kandidaten = [];
    for (const z of zerlegt)
      for (let i = 1; i < z.teile.length; i += 2)
        if (istKandidat(z.teile[i]))
          kandidaten.push({ key: z.zi + ':' + i });
    const budget = Math.max(3, Math.min(10, Math.round(kandidaten.length * 0.25)));
    /* Gleichmäßig über die Karte verteilen statt zufällig häufeln.
       Der Startversatz hängt an der Karten-Kennung – pro Karte stabil, aber nicht überall gleich. */
    const schritt = Math.max(1, Math.floor(kandidaten.length / budget));
    const start = kandidaten.length ? hashCode(kartenId) % schritt : 0;
    const nachbar = key => {
      const [zi, i] = key.split(':').map(Number);
      return gewaehlt.has(zi + ':' + (i - 2)) || gewaehlt.has(zi + ':' + (i + 2));
    };
    for (let k = start; k < kandidaten.length && gewaehlt.size < budget; k += schritt) {
      const key = kandidaten[k].key;
      if (!nachbar(key)) gewaehlt.add(key);
    }
    /* Auffüllen, falls die Nachbarschaftsregel Plätze gekostet hat */
    for (const k of kandidaten) {
      if (gewaehlt.size >= budget) break;
      if (!gewaehlt.has(k.key) && !nachbar(k.key)) gewaehlt.add(k.key);
    }
  }

  return zerlegt.map(z => ({ level: z.level, html: clozeZeile(z, gewaehlt, explizitModus) }));
}

function clozeZeile(z, gewaehlt, explizitModus) {
  if (explizitModus) {
    if (!z.explizit) return esc(z.roh);
    let out = '', last = 0, m;
    const re = /\{\{(.+?)\}\}/g;
    while ((m = re.exec(z.roh))) {
      out += esc(z.roh.slice(last, m.index)) + luecke(m[1].trim());
      last = m.index + m[0].length;
    }
    return out + esc(z.roh.slice(last));
  }
  let out = '';
  for (let i = 0; i < z.teile.length; i++)
    out += (i % 2 === 1 && gewaehlt.has(z.zi + ':' + i)) ? luecke(z.teile[i]) : esc(z.teile[i]);
  return out;
}

function clozeHtml(c) {
  const f = c.fields || {};
  if (c.type === 'schema') {
    const zeilen = (f.points || []).map(p => ({ text: p.text, level: p.level }));
    if (!zeilen.length) return '<p style="color:var(--ink-3)">Diese Karte hat keine Prüfungspunkte.</p>';
    return '<ul class="schema-list">'
      + clozeAufbau(zeilen, c.id).map(z => `<li class="lvl${z.level}">${z.html}</li>`).join('')
      + '</ul>';
  }
  const zeilen = String(f.text || '').split('\n').filter(z => z.trim()).map(t => ({ text: t }));
  if (!zeilen.length) return '<p style="color:var(--ink-3)">Diese Karte hat keine Rückseite.</p>';
  return clozeAufbau(zeilen, c.id).map(z => `<p>${z.html}</p>`).join('');
}

function clozePruefen(wurzel) {
  let richtig = 0, gesamt = 0;
  for (const inp of $$('input.cloze', wurzel)) {
    gesamt++;
    const soll = inp.dataset.loesung || '';
    const ist = inp.value.trim();
    const ok = normWort(ist) !== '' && normWort(ist) === normWort(soll);
    if (ok) richtig++;
    const span = document.createElement('span');
    span.className = 'gap ' + (ok ? 'ok' : 'falsch');
    span.innerHTML = ok ? esc(soll) : (ist ? '<s>' + esc(ist) + '</s> ' : '') + esc(soll);
    inp.replaceWith(span);
  }
  return { richtig, gesamt };
}

/* ============================================================
   2. Speicher (IndexedDB)
   ============================================================ */
const DB = (() => {
  let p = null;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('jura-kartei', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const store = async mode => (await open()).transaction('kv', mode).objectStore('kv');
  const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  return {
    async get(k)    { return wrap((await store('readonly')).get(k)); },
    async set(k, v) { return wrap((await store('readwrite')).put(v, k)); },
    async del(k)    { return wrap((await store('readwrite')).delete(k)); },
    async keys()    { return wrap((await store('readonly')).getAllKeys()); },
  };
})();

const leererStand = () => ({
  version: 1,
  folders: [],
  cards: [],
  settings: { theme: 'auto', lastFolder: null, lastExport: null, changesSinceExport: 0, answerMode: 'umdrehen' },
});

let S = leererStand();
let saveTimer = null;

function save() {
  S.settings.changesSinceExport = (S.settings.changesSinceExport || 0) + 1;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => DB.set('state', S).catch(e => toast('Speichern fehlgeschlagen: ' + e)), 300);
  renderSeitenfuss();
}
const saveNow = () => { clearTimeout(saveTimer); return DB.set('state', S); };

async function schnappschuss() {
  try {
    const keys = (await DB.keys()).filter(k => String(k).startsWith('backup:')).sort();
    const letzter = keys[keys.length - 1];
    if (letzter && Date.now() - Number(String(letzter).slice(7)) < 20 * 3600e3) return;
    if (!S.cards.length) return;
    await DB.set('backup:' + Date.now(), JSON.parse(JSON.stringify(S)));
    const alle = (await DB.keys()).filter(k => String(k).startsWith('backup:')).sort();
    for (const k of alle.slice(0, Math.max(0, alle.length - 15))) await DB.del(k);
  } catch (e) { /* Backups sind Kür, nie Show-Stopper */ }
}

/* ============================================================
   3. Ordner- und Kartenlogik
   ============================================================ */
const ordner      = id => S.folders.find(f => f.id === id) || null;
const karte       = id => S.cards.find(c => c.id === id) || null;
const kinder      = pid => S.folders.filter(f => f.parentId === pid)
                              .sort((a, b) => a.name.localeCompare(b.name, 'de'));

function nachkommen(id) {
  const out = [];
  (function lauf(p) { for (const k of kinder(p)) { out.push(k.id); lauf(k.id); } })(id);
  return out;
}
function pfad(id) {
  const teile = []; let f = ordner(id);
  while (f) { teile.unshift(f.name); f = f.parentId ? ordner(f.parentId) : null; }
  return teile;
}
function kartenIn(folderId, tief = true) {
  if (folderId === null) return S.cards.slice();
  const ids = new Set([folderId, ...(tief ? nachkommen(folderId) : [])]);
  return S.cards.filter(c => ids.has(c.folderId));
}
const faellig = cs => cs.filter(c => c.srs && c.srs.due && c.srs.due <= heute());
const neuKarten = cs => cs.filter(c => !c.srs || !c.srs.reps);

function neueSrs() { return { due: heute(), ivl: 0, ease: 2.5, reps: 0, lapses: 0 }; }

/* SM-2, leicht vereinfacht */
function bewerten(c, note) {
  const s = c.srs || (c.srs = neueSrs());
  if (note === 1) {
    s.lapses++; s.reps = 0; s.ivl = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = heute();
  } else if (note === 2) {
    s.ivl = s.reps ? Math.max(1, Math.round(s.ivl * 1.2)) : 1;
    s.ease = Math.max(1.3, s.ease - 0.15);
    s.reps++; s.due = plusTage(heute(), s.ivl);
  } else if (note === 3) {
    s.ivl = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.max(1, Math.round(s.ivl * s.ease));
    s.reps++; s.due = plusTage(heute(), s.ivl);
  } else {
    s.ease = Math.min(3.2, s.ease + 0.15);
    s.ivl = s.reps === 0 ? 4 : Math.max(1, Math.round(s.ivl * s.ease * 1.3));
    s.reps++; s.due = plusTage(heute(), s.ivl);
  }
  c.updated = Date.now();
  save();
}

const TYPEN = {
  definition: { name: 'Definition', hint: 'Begriff & Definition' },
  schema:     { name: 'Schema',     hint: 'Prüfungsaufbau' },
  frei:       { name: 'Frei',       hint: 'Vorder-/Rückseite' },
};

function kartenText(c) {
  const f = c.fields || {};
  if (c.type === 'schema') return (f.points || []).map(p => p.text).join(' · ');
  return f.text || '';
}
function suchtext(c) {
  return [c.title, kartenText(c), (c.fields || {}).source, (c.fields || {}).note, (c.tags || []).join(' ')]
    .join(' ').toLowerCase();
}

/* ============================================================
   4. Zustand der Oberfläche
   ============================================================ */
let aktuellerOrdner = null;   // null = „Alle Karten“
let suchbegriff = '';
let offeneOrdner = new Set();

/* ============================================================
   5. Ordnerbaum
   ============================================================ */
function renderTree() {
  const nav = $('#tree');
  nav.innerHTML = '';

  nav.appendChild(treeRow({ id: null, name: 'Alle Karten' }, 0, false));

  const bauen = (parentId, tiefe, container) => {
    for (const f of kinder(parentId)) {
      const node = document.createElement('div');
      node.className = 'tnode';
      const hatKinder = kinder(f.id).length > 0;
      node.appendChild(treeRow(f, tiefe, hatKinder));
      if (hatKinder && offeneOrdner.has(f.id)) {
        const kids = document.createElement('div');
        kids.className = 'tchildren';
        bauen(f.id, tiefe + 1, kids);
        node.appendChild(kids);
      }
      container.appendChild(node);
    }
  };
  bauen(null, 0, nav);

  if (!S.folders.length) {
    const hinweis = document.createElement('div');
    hinweis.style.cssText = 'font-size:.8rem;color:var(--ink-3);padding:.8rem .5rem;line-height:1.5';
    hinweis.textContent = 'Noch keine Ordner. Mit „+“ oben rechts anlegen.';
    nav.appendChild(hinweis);
  }
}

function treeRow(f, tiefe, hatKinder) {
  const row = document.createElement('div');
  row.className = 'trow' + (aktuellerOrdner === f.id ? ' sel' : '');

  const caret = document.createElement('span');
  caret.className = 'tcaret' + (hatKinder ? (offeneOrdner.has(f.id) ? ' open' : '') : ' leaf');
  caret.textContent = '▶';
  caret.addEventListener('click', e => {
    e.stopPropagation();
    if (!hatKinder) return;
    offeneOrdner.has(f.id) ? offeneOrdner.delete(f.id) : offeneOrdner.add(f.id);
    renderTree();
  });
  row.appendChild(caret);

  const name = document.createElement('span');
  name.className = 'tname';
  name.textContent = f.name;
  row.appendChild(name);

  const cs = kartenIn(f.id, true);
  const d = faellig(cs).length;
  if (d) { const b = document.createElement('span'); b.className = 'tdue'; b.textContent = d; row.appendChild(b); }
  const cnt = document.createElement('span');
  cnt.className = 'tcount'; cnt.textContent = cs.length || '';
  row.appendChild(cnt);

  if (f.id !== null) {
    const more = document.createElement('button');
    more.className = 'icon-btn tmore'; more.textContent = '⋯';
    more.title = 'Ordner-Optionen';
    more.addEventListener('click', e => { e.stopPropagation(); ordnerMenue(f); });
    row.appendChild(more);
  }

  row.addEventListener('click', () => {
    aktuellerOrdner = f.id;
    S.settings.lastFolder = f.id; save();
    if (f.id !== null && hatKinder) offeneOrdner.add(f.id);
    document.body.classList.remove('nav-open'); $('#scrim').hidden = true;
    renderTree(); renderListe();
  });
  return row;
}

function ordnerMenue(f) {
  sheet({
    titel: f.name,
    body: `
      <div class="settings-sec">
        <p>Pfad: <strong>${esc(pfad(f.id).join(' › '))}</strong><br>
        ${kartenIn(f.id, true).length} Karten (inkl. Unterordner)</p>
      </div>
      <div class="field"><label>Name</label><input id="o-name" value="${esc(f.name)}"></div>
      <div class="field"><label>Übergeordneter Ordner</label>${ordnerSelect('o-parent', f.parentId, f.id)}</div>
    `,
    buttons: [
      { text: 'Unterordner anlegen', fn: () => { schliessen(); neuerOrdner(f.id); } },
      { text: 'Ordner löschen', cls: 'danger', fn: () => ordnerLoeschen(f) },
      { spacer: true },
      { text: 'Abbrechen', fn: schliessen },
      { text: 'Speichern', cls: 'primary', fn: () => {
          const n = $('#o-name').value.trim();
          if (!n) return toast('Name darf nicht leer sein.');
          const p = $('#o-parent').value || null;
          if (p === f.id || nachkommen(f.id).includes(p)) return toast('Ordner kann nicht in sich selbst liegen.');
          f.name = n; f.parentId = p; save(); schliessen(); renderTree(); renderListe();
        } },
    ],
  });
}

function ordnerSelect(id, wert, ausschluss) {
  const tabu = ausschluss ? new Set([ausschluss, ...nachkommen(ausschluss)]) : new Set();
  let html = `<select id="${id}"><option value="">— oberste Ebene —</option>`;
  const lauf = (pid, tiefe) => {
    for (const f of kinder(pid)) {
      if (!tabu.has(f.id)) {
        html += `<option value="${f.id}"${wert === f.id ? ' selected' : ''}>${'&nbsp;&nbsp;'.repeat(tiefe)}${esc(f.name)}</option>`;
      }
      lauf(f.id, tiefe + 1);
    }
  };
  lauf(null, 0);
  return html + '</select>';
}

function neuerOrdner(parentId) {
  sheet({
    titel: parentId ? 'Unterordner in „' + ordner(parentId).name + '“' : 'Neuer Ordner',
    body: `<div class="field"><label>Name</label><input id="nf-name" placeholder="z. B. Schuldrecht AT" autofocus></div>
           <div class="field"><label>Übergeordneter Ordner</label>${ordnerSelect('nf-parent', parentId, null)}</div>`,
    buttons: [
      { text: 'Abbrechen', fn: schliessen },
      { text: 'Anlegen', cls: 'primary', fn: () => {
          const n = $('#nf-name').value.trim();
          if (!n) return toast('Bitte einen Namen eingeben.');
          const f = { id: uid(), parentId: $('#nf-parent').value || null, name: n, created: Date.now() };
          S.folders.push(f);
          if (f.parentId) offeneOrdner.add(f.parentId);
          aktuellerOrdner = f.id;
          save(); schliessen(); renderTree(); renderListe();
        } },
    ],
    focus: '#nf-name',
  });
}

function ordnerLoeschen(f) {
  const ids = [f.id, ...nachkommen(f.id)];
  const anzahl = S.cards.filter(c => ids.includes(c.folderId)).length;
  sheet({
    titel: 'Ordner löschen?',
    body: `<p>„<strong>${esc(f.name)}</strong>“ wird gelöscht – mit ${ids.length - 1} Unterordner(n)
           und <strong>${anzahl} Karten</strong>. Das lässt sich nicht rückgängig machen
           (ein Backup-Schnappschuss von heute liegt unter Einstellungen).</p>`,
    buttons: [
      { text: 'Abbrechen', fn: schliessen },
      { text: 'Endgültig löschen', cls: 'danger', fn: () => {
          S.cards = S.cards.filter(c => !ids.includes(c.folderId));
          S.folders = S.folders.filter(x => !ids.includes(x.id));
          if (ids.includes(aktuellerOrdner)) aktuellerOrdner = null;
          save(); schliessen(); renderTree(); renderListe(); toast('Ordner gelöscht.');
        } },
    ],
  });
}

/* ============================================================
   6. Kartenliste
   ============================================================ */
function renderListe() {
  const liste = $('#list');
  liste.innerHTML = '';

  let karten, titel, unterzeile;
  if (suchbegriff) {
    const q = suchbegriff.toLowerCase();
    karten = S.cards.filter(c => suchtext(c).includes(q));
    titel = 'Suche: ' + suchbegriff;
    unterzeile = karten.length + ' Treffer in allen Ordnern';
  } else {
    karten = kartenIn(aktuellerOrdner, true);
    titel = aktuellerOrdner === null ? 'Alle Karten' : pfad(aktuellerOrdner).join(' › ');
    const direkt = aktuellerOrdner === null ? karten.length : kartenIn(aktuellerOrdner, false).length;
    unterzeile = karten.length === direkt
      ? karten.length + ' Karten'
      : `${direkt} Karten hier · ${karten.length} mit Unterordnern`;
  }

  $('#crumb').innerHTML = esc(titel) + '<small>' + esc(unterzeile) + '</small>';

  const d = faellig(karten).length;
  const strip = $('#due-strip');
  if (d && !suchbegriff) {
    strip.hidden = false;
    strip.innerHTML = `<span><strong>${d}</strong> ${d === 1 ? 'Karte ist' : 'Karten sind'} zur Wiederholung fällig.</span>`;
    const b = document.createElement('button');
    b.className = 'btn primary'; b.textContent = 'Jetzt wiederholen';
    b.onclick = () => starteLernen({ mode: 'srs', scope: aktuellerOrdner, deep: true, order: 'random' });
    strip.appendChild(b);
  } else strip.hidden = true;

  if (!karten.length) {
    const leer = document.createElement('div');
    leer.className = 'list-empty';
    leer.innerHTML = suchbegriff
      ? '<strong>Keine Treffer</strong>Anderen Begriff versuchen.'
      : '<strong>Noch keine Karten hier</strong>Lege mit „Neue Karte“ eine Definition, ein Prüfungsschema<br>oder eine freie Karte an.';
    liste.appendChild(leer);
    renderSeitenfuss();
    return;
  }

  karten.sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const gruppen = { definition: [], schema: [], frei: [] };
  for (const c of karten) (gruppen[c.type] || gruppen.frei).push(c);

  for (const typ of ['definition', 'schema', 'frei']) {
    if (!gruppen[typ].length) continue;
    const lab = document.createElement('div');
    lab.className = 'sec-label';
    lab.textContent = TYPEN[typ].name + ' · ' + gruppen[typ].length;
    liste.appendChild(lab);
    for (const c of gruppen[typ]) liste.appendChild(kartenZeile(c));
  }
  renderSeitenfuss();
}

function kartenZeile(c) {
  const node = document.createElement('div');
  node.className = 'citem';

  const dot = document.createElement('div');
  dot.className = 'due-dot' + (c.srs && c.srs.due && c.srs.due <= heute() ? '' : ' off');
  dot.title = 'fällig';
  node.appendChild(dot);

  const main = document.createElement('div');
  main.className = 'ci-main';

  const top = document.createElement('div');
  top.className = 'ci-top';
  const t = document.createElement('div');
  t.className = 'ci-title'; t.textContent = c.title || '(ohne Titel)';
  top.appendChild(t);
  main.appendChild(top);

  const snip = document.createElement('div');
  snip.className = 'ci-snip'; snip.textContent = klartext(kartenText(c));
  main.appendChild(snip);

  const meta = document.createElement('div');
  meta.className = 'ci-meta';
  const bd = document.createElement('span');
  bd.className = 'badge ' + c.type; bd.textContent = TYPEN[c.type].name;
  meta.appendChild(bd);
  if ((c.fields || {}).source) {
    const s = document.createElement('span'); s.className = 'tag'; s.textContent = c.fields.source;
    meta.appendChild(s);
  }
  for (const tg of (c.tags || [])) {
    const s = document.createElement('span'); s.className = 'tag'; s.textContent = '#' + tg;
    meta.appendChild(s);
  }
  if (suchbegriff || aktuellerOrdner === null) {
    const p = document.createElement('span');
    p.className = 'path-hint'; p.textContent = pfad(c.folderId).join(' › ') || 'ohne Ordner';
    meta.appendChild(p);
  }
  main.appendChild(meta);

  node.appendChild(main);
  node.addEventListener('click', () => zeigeKarte(c.id));
  return node;
}

function renderSeitenfuss() {
  const alle = S.cards.length;
  const d = faellig(S.cards).length;
  const le = S.settings.lastExport;
  const warnen = !le || (Date.now() - le > 14 * 864e5 && (S.settings.changesSinceExport || 0) > 0);
  $('#side-stat').innerHTML =
    `${alle} Karten · ${S.folders.length} Ordner · ${d} fällig<br>` +
    (le ? 'Letztes Backup: ' + deZeit(le) : '<span style="color:var(--warn)">Noch kein Backup erstellt</span>') +
    (warnen && le ? ' <span style="color:var(--warn)">(überfällig)</span>' : '');
}

/* ============================================================
   7. Overlay / Sheet
   ============================================================ */
let sheetStack = [];

function sheet({ titel, body, buttons = [], focus, raw = false, onClose }) {
  const ov = $('#overlay');
  const s = document.createElement('div');
  s.className = 'sheet';

  if (raw) {
    s.innerHTML = body;
  } else {
    const head = document.createElement('div');
    head.className = 'sheet-head';
    const h = document.createElement('div');
    h.className = 'sheet-title'; h.textContent = titel || '';
    const x = document.createElement('button');
    x.className = 'icon-btn'; x.textContent = '✕'; x.setAttribute('aria-label', 'Schließen');
    x.onclick = () => schliessen();
    head.appendChild(h); head.appendChild(x);

    const bd = document.createElement('div');
    bd.className = 'sheet-body'; bd.innerHTML = body || '';

    const ft = document.createElement('div');
    ft.className = 'sheet-foot';
    for (const b of buttons) {
      if (b.spacer) { const sp = document.createElement('div'); sp.className = 'spacer'; ft.appendChild(sp); continue; }
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.cls ? ' ' + b.cls : '');
      btn.textContent = b.text; btn.onclick = b.fn;
      ft.appendChild(btn);
    }
    s.appendChild(head); s.appendChild(bd); if (buttons.length) s.appendChild(ft);
  }

  ov.innerHTML = '';
  ov.appendChild(s);
  ov.hidden = false;
  sheetStack = [{ onClose }];
  if (focus) setTimeout(() => { const f = $(focus); if (f) f.focus(); }, 60);
  return s;
}

function schliessen() {
  const top = sheetStack.pop();
  $('#overlay').hidden = true;
  $('#overlay').innerHTML = '';
  if (top && top.onClose) top.onClose();
}

/* ============================================================
   8. Karte ansehen
   ============================================================ */
function kartenHtml(c, { nurRueck = false, nurVorder = false } = {}) {
  const f = c.fields || {};
  let out = '';
  if (!nurRueck) {
    out += `<h2>${esc(c.title || '(ohne Titel)')}</h2>`;
    if (f.source) out += `<div class="src">${esc(f.source)}</div>`;
  }
  if (nurVorder) return `<div class="cardview">${out}</div>`;

  if (c.type === 'definition') {
    out += `<div class="block"><div class="block-label">Definition</div><div class="quote">${fmt(f.text)}</div></div>`;
  } else if (c.type === 'schema') {
    out += `<div class="block"><div class="block-label">Prüfungsaufbau</div>${renderPunkte(f.points)}</div>`;
  } else {
    out += `<div class="block"><div class="block-label">Rückseite</div>${fmt(f.text)}</div>`;
  }
  if (f.note) out += `<div class="block"><div class="block-label">${c.type === 'definition' ? 'Streitstand / Hinweis' : 'Hinweis'}</div><div class="note">${fmt(f.note)}</div></div>`;
  if ((c.tags || []).length) out += `<div class="ci-meta">${c.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`;
  return `<div class="cardview">${out}</div>`;
}

function zeigeKarte(id) {
  const c = karte(id);
  if (!c) return;
  const s = c.srs || {};
  const meta = `<div style="margin-top:1.6rem;font-size:.78rem;color:var(--ink-3);line-height:1.6">
      Ordner: ${esc(pfad(c.folderId).join(' › ') || 'ohne Ordner')}<br>
      Nächste Wiederholung: ${deDatum(s.due)} · ${s.reps || 0}× gelernt${s.lapses ? ' · ' + s.lapses + '× vergessen' : ''}<br>
      Geändert: ${deZeit(c.updated || c.created)}
    </div>`;
  sheet({
    titel: TYPEN[c.type].name,
    body: kartenHtml(c) + meta,
    buttons: [
      { text: 'Löschen', cls: 'danger', fn: () => karteLoeschen(c) },
      { spacer: true },
      { text: 'Schließen', fn: schliessen },
      { text: 'Bearbeiten', cls: 'primary', fn: () => { schliessen(); karteBearbeiten(c.id); } },
    ],
  });
}

function karteLoeschen(c) {
  sheet({
    titel: 'Karte löschen?',
    body: `<p>„<strong>${esc(c.title)}</strong>“ wird endgültig gelöscht.</p>`,
    buttons: [
      { text: 'Abbrechen', fn: () => { schliessen(); zeigeKarte(c.id); } },
      { text: 'Löschen', cls: 'danger', fn: () => {
          S.cards = S.cards.filter(x => x.id !== c.id);
          save(); schliessen(); renderTree(); renderListe(); toast('Karte gelöscht.');
        } },
    ],
  });
}

/* ============================================================
   9. Karte anlegen / bearbeiten
   ============================================================ */
function karteBearbeiten(id) {
  const vorhanden = id ? karte(id) : null;
  let typ = vorhanden ? vorhanden.type : 'definition';
  const entwurf = vorhanden
    ? JSON.parse(JSON.stringify(vorhanden))
    : { id: null, type: typ, title: '', fields: {}, tags: [], folderId: aktuellerOrdner };

  const s = sheet({
    titel: vorhanden ? 'Karte bearbeiten' : 'Neue Karte',
    body: '<div id="ed-type"></div><div id="ed-fields"></div>',
    buttons: [
      { text: 'Abbrechen', fn: schliessen },
      { text: 'Speichern', cls: 'primary', fn: speichern },
    ],
  });

  function typeLeiste() {
    const wrap = $('#ed-type');
    wrap.innerHTML = '<div class="typepick">' + Object.entries(TYPEN).map(([k, v]) =>
      `<button type="button" data-t="${k}" class="${k === typ ? 'on' : ''}">${v.name}<small>${v.hint}</small></button>`
    ).join('') + '</div>';
    $$('button', wrap).forEach(b => b.onclick = () => { uebernehmen(); typ = b.dataset.t; entwurf.type = typ; typeLeiste(); felder(); });
  }

  function felder() {
    const f = entwurf.fields || {};
    let html = '';
    if (typ === 'definition') {
      html += feld('Begriff', `<input id="ed-title" value="${esc(entwurf.title)}" placeholder="z. B. Willenserklärung">`);
      html += feld('Definition', `<textarea id="ed-text" rows="6" placeholder="Eine Willenserklärung ist …">${esc(f.text || '')}</textarea>`,
        '**fett**, *kursiv* und Listen mit „- “ werden formatiert. Wörter in {{doppelten Klammern}} werden im Lückentext abgefragt.');
      html += feld('Fundstelle', `<input id="ed-source" value="${esc(f.source || '')}" placeholder="z. B. § 133 BGB">`);
      html += feld('Streitstand / Hinweis', `<textarea id="ed-note" rows="3" placeholder="h. M.: … · a. A.: …">${esc(f.note || '')}</textarea>`);
    } else if (typ === 'schema') {
      html += feld('Bezeichnung', `<input id="ed-title" value="${esc(entwurf.title)}" placeholder="z. B. Anspruch aus § 823 I BGB">`);
      html += feld('Fundstelle', `<input id="ed-source" value="${esc(f.source || '')}" placeholder="z. B. § 823 Abs. 1 BGB">`);
      html += feld('Prüfungspunkte', `<textarea id="ed-points" rows="12" spellcheck="false" placeholder="I. Rechtsgutsverletzung&#10;&#9;1. Leben, Körper, Gesundheit&#10;II. Verletzungshandlung&#10;III. Haftungsbegründende Kausalität">${esc(punkteText(f.points))}</textarea>`,
        'Eine Zeile pro Punkt, Nummerierung schreibst du selbst. Mit <span class="kbd">Tab</span> einrücken = Unterpunkt (bis 4 Ebenen).');
      html += feld('Hinweis', `<textarea id="ed-note" rows="3" placeholder="Klausurtipp, Streitstand, Abgrenzung …">${esc(f.note || '')}</textarea>`);
    } else {
      html += feld('Vorderseite (Frage)', `<textarea id="ed-title" rows="2" placeholder="Was wird gefragt?">${esc(entwurf.title)}</textarea>`);
      html += feld('Rückseite (Antwort)', `<textarea id="ed-text" rows="7">${esc(f.text || '')}</textarea>`);
      html += feld('Fundstelle', `<input id="ed-source" value="${esc(f.source || '')}" placeholder="optional">`);
      html += feld('Hinweis', `<textarea id="ed-note" rows="2">${esc(f.note || '')}</textarea>`);
    }
    html += '<div class="row">'
      + feld('Ordner', ordnerSelect('ed-folder', entwurf.folderId, null))
      + feld('Tags', `<input id="ed-tags" value="${esc((entwurf.tags || []).join(', '))}" placeholder="BGB AT, Examen, Streit">`, 'Mit Komma trennen.')
      + '</div>';
    $('#ed-fields').innerHTML = html;

    const pts = $('#ed-points');
    if (pts) pts.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const a = pts.selectionStart, b = pts.selectionEnd;
      if (e.shiftKey) {
        const zs = pts.value.lastIndexOf('\n', a - 1) + 1;
        if (pts.value.slice(zs, zs + 1) === '\t') {
          pts.value = pts.value.slice(0, zs) + pts.value.slice(zs + 1);
          pts.selectionStart = pts.selectionEnd = Math.max(zs, a - 1);
        }
      } else {
        pts.value = pts.value.slice(0, a) + '\t' + pts.value.slice(b);
        pts.selectionStart = pts.selectionEnd = a + 1;
      }
    });
  }

  function feld(label, inner, hint) {
    return `<div class="field"><label>${label}</label>${inner}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  }

  function uebernehmen() {
    const g = sel => { const n = $(sel); return n ? n.value : undefined; };
    const t = g('#ed-title'); if (t !== undefined) entwurf.title = t.trim();
    entwurf.fields = entwurf.fields || {};
    const src = g('#ed-source'); if (src !== undefined) entwurf.fields.source = src.trim();
    const note = g('#ed-note');  if (note !== undefined) entwurf.fields.note = note.trim();
    const txt = g('#ed-text');   if (txt !== undefined) entwurf.fields.text = txt;
    const pts = g('#ed-points'); if (pts !== undefined) entwurf.fields.points = parsePunkte(pts);
    const fo = g('#ed-folder');  if (fo !== undefined) entwurf.folderId = fo || null;
    const tg = g('#ed-tags');
    if (tg !== undefined) entwurf.tags = tg.split(',').map(x => x.trim()).filter(Boolean);
  }

  function speichern() {
    uebernehmen();
    if (!entwurf.title) return toast('Bitte Begriff / Vorderseite ausfüllen.');
    if (vorhanden) {
      Object.assign(vorhanden, {
        type: entwurf.type, title: entwurf.title, fields: entwurf.fields,
        tags: entwurf.tags, folderId: entwurf.folderId, updated: Date.now(),
      });
    } else {
      S.cards.push({
        id: uid(), type: entwurf.type, title: entwurf.title, fields: entwurf.fields,
        tags: entwurf.tags, folderId: entwurf.folderId,
        created: Date.now(), updated: Date.now(), srs: neueSrs(),
      });
    }
    save(); schliessen(); renderTree(); renderListe();
    toast(vorhanden ? 'Gespeichert.' : 'Karte angelegt.');
  }

  s.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); speichern(); }
  });

  typeLeiste(); felder();
  setTimeout(() => { const f = $('#ed-title'); if (f) f.focus(); }, 60);
}

/* ============================================================
   10. Lernen
   ============================================================ */
let L = null;

function lernDialog() {
  const basis = kartenIn(aktuellerOrdner, true);
  const name = aktuellerOrdner === null ? 'Alle Karten' : pfad(aktuellerOrdner).join(' › ');
  sheet({
    titel: 'Lernen',
    body: `
      <p style="margin-top:0;color:var(--ink-2)">Aus <strong>${esc(name)}</strong> –
        ${basis.length} Karten, davon ${faellig(basis).length} fällig und ${neuKarten(basis).length} neu.</p>
      <div class="field"><label>Modus</label>
        <div class="typepick" id="l-mode">
          <button type="button" data-v="srs" class="on">Wiederholen<small>Fällige Karten, mit Lernplan</small></button>
          <button type="button" data-v="browse">Durchblättern<small>Alle Karten, ohne Plan</small></button>
        </div>
      </div>
      <div class="field"><label>Umfang</label>
        <div class="typepick" id="l-deep">
          <button type="button" data-v="deep" class="on">Mit Unterordnern</button>
          <button type="button" data-v="flat">Nur dieser Ordner</button>
        </div>
      </div>
      <div class="field"><label>Reihenfolge</label>
        <div class="typepick" id="l-order">
          <button type="button" data-v="random" class="on">Zufällig</button>
          <button type="button" data-v="alpha">Alphabetisch</button>
        </div>
      </div>`,
    buttons: [
      { text: 'Abbrechen', fn: schliessen },
      { text: 'Los', cls: 'primary', fn: () => {
          const w = id => { const b = $('#' + id + ' button.on'); return b ? b.dataset.v : null; };
          starteLernen({ mode: w('l-mode'), scope: aktuellerOrdner, deep: w('l-deep') === 'deep', order: w('l-order') });
        } },
    ],
  });
  ['l-mode', 'l-deep', 'l-order'].forEach(id => {
    $$('#' + id + ' button').forEach(b => b.onclick = () => {
      $$('#' + id + ' button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
  });
}

function starteLernen(opt) {
  let karten = kartenIn(opt.scope, opt.deep !== false);
  if (opt.mode === 'srs') {
    karten = karten.filter(c => !c.srs || !c.srs.due || c.srs.due <= heute());
    if (!karten.length) {
      sheet({
        titel: 'Alles erledigt',
        body: `<div class="study-done"><div class="big">Nichts fällig 🎉</div>
               <p>In diesem Bereich steht heute keine Wiederholung an.
               Mit „Durchblättern“ kannst du trotzdem jederzeit alles ansehen.</p></div>`,
        buttons: [
          { text: 'Schließen', fn: schliessen },
          { text: 'Durchblättern', cls: 'primary', fn: () => starteLernen({ ...opt, mode: 'browse' }) },
        ],
      });
      return;
    }
  }
  if (!karten.length) { schliessen(); return toast('Hier gibt es noch keine Karten.'); }

  if (opt.order === 'alpha') karten.sort((a, b) => a.title.localeCompare(b.title, 'de'));
  else for (let i = karten.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [karten[i], karten[j]] = [karten[j], karten[i]];
  }

  L = { mode: opt.mode, queue: karten.map(c => c.id), idx: 0, gesamt: karten.length,
        erledigt: 0, auf: false, eingabe: '', ergebnis: null, antwortHtml: null };
  lernAnsicht();
}

const ANTWORT_MODI = [
  ['umdrehen',  'Umdrehen',  'Antwort im Kopf, dann aufdecken'],
  ['eintippen', 'Eintippen', 'Antwort selbst formulieren'],
  ['luecken',   'Lücken',    'Schlüsselwörter ergänzen'],
];

function lernAnsicht() {
  const id = L.queue[L.idx];
  const c = karte(id);
  if (!c) { L.queue.splice(L.idx, 1); return L.queue.length ? lernAnsicht() : lernFertig(); }

  const fortschritt = L.mode === 'srs'
    ? Math.round(100 * L.erledigt / Math.max(1, L.gesamt))
    : Math.round(100 * (L.idx + 1) / L.queue.length);
  const zaehler = L.mode === 'srs'
    ? `${L.queue.length} offen` : `${L.idx + 1} / ${L.queue.length}`;
  const modus = () => S.settings.answerMode || 'umdrehen';

  const s = sheet({
    raw: true,
    body: `<div class="study">
      <div class="study-head">
        <button class="icon-btn" id="st-close" aria-label="Beenden">✕</button>
        <div class="progress"><i style="width:${fortschritt}%"></i></div>
        <div class="study-count">${zaehler}</div>
      </div>
      <div class="study-modes" id="st-modes">${ANTWORT_MODI.map(([k, n, t]) =>
        `<button type="button" data-m="${k}" title="${t}"${modus() === k ? ' class="on"' : ''}>${n}</button>`
      ).join('')}</div>
      <div class="study-body"><div class="flashcard" id="st-card"></div></div>
      <div class="study-foot" id="st-foot"></div>
    </div>`,
  });

  const kartenBox = $('#st-card');
  const fuss = $('#st-foot');
  $('#st-close').onclick = () => { L = null; schliessen(); renderTree(); renderListe(); };

  /* Abfrageart jederzeit umschaltbar – auch mitten in der Karte */
  $$('#st-modes button').forEach(b => b.onclick = () => {
    S.settings.answerMode = b.dataset.m; save();
    $$('#st-modes button').forEach(x => x.classList.toggle('on', x === b));
    zuruecksetzen(); zeichne();
  });

  function zuruecksetzen() { L.auf = false; L.eingabe = ''; L.ergebnis = null; L.antwortHtml = null; }

  const vorderseite = () => `<div class="flash-front">${esc(c.title)}
    <div class="sub">${TYPEN[c.type].name}${c.type === 'schema' ? ' – Aufbau nennen' : ''}${
      (c.fields || {}).source && c.type !== 'definition' ? ' · ' + esc(c.fields.source) : ''}</div></div>`;

  const rahmen = inner => vorderseite() + '<hr class="flash-sep"><div id="st-answer">' + inner + '</div>';

  function fussKnopf(text, sub, fn, cls) {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || 'primary');
    b.innerHTML = `<span class="grade"><b>${text}</b><small>${sub}</small></span>`;
    b.onclick = fn;
    fuss.appendChild(b);
    return b;
  }

  function zeichne() {
    fuss.innerHTML = '';
    if (!L.auf) frageZeigen();
    else { loesungZeigen(); bewertungsKnoepfe(); }
  }

  function frageZeigen() {
    const m = modus();
    if (m === 'eintippen') {
      kartenBox.innerHTML = rahmen('<div class="block-label">Deine Antwort</div>'
        + '<textarea id="st-input" rows="6" placeholder="Aus dem Kopf formulieren …"></textarea>');
      const n = $('#st-input');
      n.value = L.eingabe || '';
      setTimeout(() => n.focus(), 60);
      fussKnopf('Prüfen', '⌘ + ↩', () => { L.eingabe = n.value; L.auf = true; zeichne(); });
    } else if (m === 'luecken') {
      kartenBox.innerHTML = rahmen('<div class="block-label">Lücken füllen</div>' + clozeHtml(c));
      const erste = $('input.cloze', kartenBox);
      if (erste) setTimeout(() => erste.focus(), 60);
      fussKnopf('Prüfen', '⌘ + ↩', () => {
        L.ergebnis = clozePruefen(kartenBox);
        L.antwortHtml = $('#st-answer').innerHTML;
        L.auf = true; zeichne();
      });
    } else {
      kartenBox.innerHTML = vorderseite();
      fussKnopf('Aufdecken', 'Leertaste', () => { L.auf = true; zeichne(); });
    }
  }

  function loesungZeigen() {
    const m = modus();
    if (m === 'luecken' && L.antwortHtml) {
      const r = L.ergebnis || { richtig: 0, gesamt: 0 };
      const voll = r.gesamt && r.richtig === r.gesamt;
      kartenBox.innerHTML = rahmen(
        `<div class="treffer${voll ? ' voll' : ''}">${r.richtig} von ${r.gesamt} richtig</div>`
        + L.antwortHtml.replace('<div class="block-label">Lücken füllen</div>', ''));
    } else if (m === 'eintippen') {
      const eigen = (L.eingabe || '').trim();
      kartenBox.innerHTML = rahmen(
        '<div class="block-label">Deine Antwort</div>'
        + '<div class="note">' + (eigen ? fmt(eigen) : '<em>nichts eingetragen</em>') + '</div>'
        + '<div style="height:1.2rem"></div>'
        + kartenHtml(c, { nurRueck: true }));
    } else {
      kartenBox.innerHTML = rahmen(kartenHtml(c, { nurRueck: true }));
    }
  }

  function bewertungsKnoepfe() {
    if (L.mode === 'srs') {
      const noten = [
        [1, 'Nochmal', 'gleich wieder'],
        [2, 'Schwer', vorschau(c, 2)],
        [3, 'Gut', vorschau(c, 3)],
        [4, 'Einfach', vorschau(c, 4)],
      ];
      for (const [n, titel, sub] of noten) fussKnopf(titel, sub, () => note(n), 'g' + n);
    } else {
      const zur = document.createElement('button');
      zur.className = 'btn'; zur.textContent = '← Zurück';
      zur.disabled = L.idx === 0;
      zur.onclick = () => { L.idx = Math.max(0, L.idx - 1); zuruecksetzen(); lernAnsicht(); };
      const bearb = document.createElement('button');
      bearb.className = 'btn'; bearb.textContent = 'Bearbeiten';
      bearb.onclick = () => { const cid = c.id; L = null; schliessen(); karteBearbeiten(cid); };
      const weiter = document.createElement('button');
      weiter.className = 'btn primary'; weiter.textContent = 'Weiter →';
      weiter.onclick = weiterBlaettern;
      fuss.appendChild(zur); fuss.appendChild(bearb); fuss.appendChild(weiter);
    }
  }

  function weiterBlaettern() {
    if (L.idx + 1 >= L.queue.length) return lernFertig();
    L.idx++; zuruecksetzen(); lernAnsicht();
  }

  function vorschau(card, n) {
    const s2 = JSON.parse(JSON.stringify(card.srs || neueSrs()));
    let tage; // Bewertung nur simulieren, nicht speichern
    if (n === 2) tage = s2.reps ? Math.max(1, Math.round(s2.ivl * 1.2)) : 1;
    else if (n === 3) tage = s2.reps === 0 ? 1 : s2.reps === 1 ? 3 : Math.max(1, Math.round(s2.ivl * s2.ease));
    else tage = s2.reps === 0 ? 4 : Math.max(1, Math.round(s2.ivl * Math.min(3.2, s2.ease + 0.15) * 1.3));
    return tage === 1 ? 'morgen' : tage < 30 ? tage + ' Tage' : Math.round(tage / 30) + ' Mon.';
  }

  function note(n) {
    bewerten(c, n);
    if (n === 1) {
      L.queue.splice(L.idx, 1);
      L.queue.splice(Math.min(L.queue.length, L.idx + 3), 0, c.id);
      if (L.idx >= L.queue.length) L.idx = 0;
    } else {
      L.queue.splice(L.idx, 1);
      L.erledigt++;
      if (L.idx >= L.queue.length) L.idx = 0;
    }
    zuruecksetzen();
    if (!L.queue.length) return lernFertig();
    lernAnsicht();
  }

  s.addEventListener('keydown', tasten);
  document.addEventListener('keydown', tasten);
  function tasten(e) {
    if (!L) return;
    const tippt = /^(INPUT|TEXTAREA)$/.test(e.target.tagName || '');
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!L.auf) { const b = $('#st-foot .btn'); if (b) b.click(); }
      return;
    }
    if (tippt) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!L.auf) { const b = $('#st-foot .btn'); if (b) b.click(); }
      else if (L.mode === 'browse') weiterBlaettern();
    } else if (L.auf && L.mode === 'srs' && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault(); note(Number(e.key));
    } else if (L.mode === 'browse' && e.key === 'ArrowRight') {
      e.preventDefault(); if (L.idx + 1 < L.queue.length) weiterBlaettern();
    } else if (L.mode === 'browse' && e.key === 'ArrowLeft') {
      e.preventDefault(); if (L.idx > 0) { L.idx--; zuruecksetzen(); lernAnsicht(); }
    }
  }
  lernAnsicht._cleanup = () => document.removeEventListener('keydown', tasten);
  if (lernAnsicht._prev) lernAnsicht._prev();
  lernAnsicht._prev = lernAnsicht._cleanup;

  zeichne();
}

function lernFertig() {
  const n = L ? L.erledigt : 0;
  if (lernAnsicht._prev) lernAnsicht._prev();
  L = null;
  sheet({
    titel: 'Fertig',
    body: `<div class="study-done"><div class="big">Durchgearbeitet.</div>
      <p>${n ? n + ' Karten bewertet. ' : ''}Die nächsten Termine stehen schon im Plan.</p></div>`,
    buttons: [{ text: 'Schließen', cls: 'primary', fn: () => { schliessen(); renderTree(); renderListe(); } }],
  });
}

/* ============================================================
   11. Einstellungen, Export, Import, Backups
   ============================================================ */
function einstellungen() {
  const theme = S.settings.theme || 'auto';
  sheet({
    titel: 'Einstellungen & Backup',
    body: `
      <div class="settings-sec">
        <h3>Backup / Export</h3>
        <p>Alle Karten liegen nur auf <em>diesem</em> Gerät. Sichere sie regelmäßig als Datei –
           das ist zugleich der Weg, um deine Kartei auf das andere Gerät zu übertragen.
           ${S.settings.lastExport ? 'Letztes Backup: <strong>' + deZeit(S.settings.lastExport) + '</strong>' : '<strong style="color:var(--warn)">Noch nie gesichert.</strong>'}</p>
        <div class="row">
          <button class="btn primary" id="se-export">Als Datei sichern</button>
          <button class="btn" id="se-share">Teilen / in Dateien sichern</button>
        </div>
      </div>

      <div class="settings-sec">
        <h3>Import</h3>
        <p>Backup-Datei einlesen. <strong>Zusammenführen</strong> ergänzt fehlende Ordner und Karten,
           <strong>Ersetzen</strong> wirft den aktuellen Stand weg.</p>
        <input type="file" id="se-file" accept="application/json,.json">
        <div class="row" style="margin-top:.6rem">
          <button class="btn" id="se-merge">Zusammenführen</button>
          <button class="btn danger" id="se-replace">Ersetzen</button>
        </div>
      </div>

      <div class="settings-sec">
        <h3>Automatische Schnappschüsse</h3>
        <p>Die App legt täglich eine Kopie auf diesem Gerät ab (die letzten 15).
           Hilft bei Versehen – ersetzt aber kein Backup auf Datei.</p>
        <div id="se-backups">wird geladen …</div>
      </div>

      <div class="settings-sec">
        <h3>Darstellung</h3>
        <div class="typepick" id="se-theme">
          <button type="button" data-v="auto"  class="${theme === 'auto' ? 'on' : ''}">Automatisch</button>
          <button type="button" data-v="light" class="${theme === 'light' ? 'on' : ''}">Hell</button>
          <button type="button" data-v="dark"  class="${theme === 'dark' ? 'on' : ''}">Dunkel</button>
        </div>
      </div>

      <div class="settings-sec">
        <h3>Tastatur (Mac)</h3>
        <p><span class="kbd">Leertaste</span> aufdecken · <span class="kbd">⌘</span>+<span class="kbd">↩</span> prüfen · <span class="kbd">1</span>–<span class="kbd">4</span> bewerten ·
           <span class="kbd">←</span> <span class="kbd">→</span> blättern · <span class="kbd">N</span> neue Karte ·
           <span class="kbd">⌘</span>+<span class="kbd">↩</span> speichern · <span class="kbd">Esc</span> schließen</p>
      </div>

      <div class="settings-sec">
        <h3>Alles löschen</h3>
        <p>Entfernt sämtliche Ordner, Karten und Schnappschüsse von diesem Gerät.</p>
        <button class="btn danger" id="se-wipe">Kartei zurücksetzen</button>
      </div>`,
    buttons: [{ text: 'Schließen', cls: 'primary', fn: schliessen }],
  });

  $('#se-export').onclick = exportieren;
  $('#se-share').onclick = teilen;
  $('#se-merge').onclick = () => importieren(false);
  $('#se-replace').onclick = () => importieren(true);
  $$('#se-theme button').forEach(b => b.onclick = () => {
    S.settings.theme = b.dataset.v; save(); themaAnwenden();
    $$('#se-theme button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#se-wipe').onclick = () => sheet({
    titel: 'Wirklich alles löschen?',
    body: '<p>Alle Ordner, Karten und Schnappschüsse auf diesem Gerät werden entfernt. Das ist endgültig.</p>',
    buttons: [
      { text: 'Abbrechen', fn: () => { schliessen(); einstellungen(); } },
      { text: 'Alles löschen', cls: 'danger', fn: async () => {
          for (const k of await DB.keys()) await DB.del(k);
          S = leererStand(); aktuellerOrdner = null;
          await saveNow(); schliessen(); renderTree(); renderListe(); toast('Kartei zurückgesetzt.');
        } },
    ],
  });
  backupListe();
}

function dateiName() {
  const d = new Date();
  return `jura-kartei-${iso(d)}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`;
}
const exportBlob = () => new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });

function exportiertVermerken() {
  S.settings.lastExport = Date.now();
  S.settings.changesSinceExport = 0;
  save(); renderSeitenfuss();
}

function exportieren() {
  const url = URL.createObjectURL(exportBlob());
  const a = document.createElement('a');
  a.href = url; a.download = dateiName();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  exportiertVermerken();
  toast('Backup gespeichert – leg die Datei in iCloud/Drive ab.');
}

async function teilen() {
  const datei = new File([exportBlob()], dateiName(), { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: 'Jura-Kartei Backup' }); exportiertVermerken(); }
    catch (e) { /* abgebrochen */ }
  } else {
    exportieren();
  }
}

function importieren(ersetzen) {
  const f = $('#se-file').files[0];
  if (!f) return toast('Bitte zuerst eine Datei auswählen.');
  const r = new FileReader();
  r.onload = () => {
    let daten;
    try { daten = JSON.parse(r.result); } catch (e) { return toast('Datei konnte nicht gelesen werden.'); }
    if (!daten || !Array.isArray(daten.cards) || !Array.isArray(daten.folders)) return toast('Das sieht nicht nach einem Backup aus.');
    if (ersetzen) {
      S = Object.assign(leererStand(), daten);
      S.settings = Object.assign(leererStand().settings, daten.settings || {});
      aktuellerOrdner = null;
      toast(`Ersetzt: ${S.cards.length} Karten.`);
    } else {
      const fIds = new Set(S.folders.map(x => x.id));
      const cIds = new Set(S.cards.map(x => x.id));
      let nf = 0, nc = 0;
      for (const x of daten.folders) if (!fIds.has(x.id)) { S.folders.push(x); nf++; }
      for (const x of daten.cards)   if (!cIds.has(x.id)) { S.cards.push(x); nc++; }
      toast(`Ergänzt: ${nc} Karten, ${nf} Ordner.`);
    }
    save(); schliessen(); renderTree(); renderListe();
  };
  r.readAsText(f);
}

async function backupListe() {
  const box = $('#se-backups');
  if (!box) return;
  const keys = (await DB.keys()).filter(k => String(k).startsWith('backup:')).sort().reverse();
  if (!keys.length) { box.innerHTML = '<p style="color:var(--ink-3)">Noch keine Schnappschüsse.</p>'; return; }
  box.innerHTML = '';
  for (const k of keys) {
    const ts = Number(String(k).slice(7));
    const row = document.createElement('div');
    row.className = 'backup-item';
    const sp = document.createElement('span'); sp.textContent = deZeit(ts);
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = 'Wiederherstellen';
    b.onclick = async () => {
      const d = await DB.get(k);
      if (!d) return toast('Schnappschuss nicht lesbar.');
      S = d; aktuellerOrdner = null;
      await saveNow(); schliessen(); renderTree(); renderListe();
      toast('Stand vom ' + deZeit(ts) + ' wiederhergestellt.');
    };
    row.appendChild(sp); row.appendChild(b);
    box.appendChild(row);
  }
}

/* ============================================================
   12. Thema, Start, Beispielinhalte
   ============================================================ */
function themaAnwenden() {
  const t = S.settings.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function beispiele() {
  const mk = (name, parentId) => { const f = { id: uid(), parentId, name, created: Date.now() }; S.folders.push(f); return f.id; };
  const zivil = mk('Zivilrecht', null);
  const bgbAt = mk('BGB AT', zivil);
  const delikt = mk('Deliktsrecht', zivil);
  const straf = mk('Strafrecht', null);
  mk('Strafrecht AT', straf);
  mk('Öffentliches Recht', null);

  const card = (folderId, type, title, fields, tags) => S.cards.push({
    id: uid(), type, title, fields, tags: tags || [], folderId,
    created: Date.now(), updated: Date.now(), srs: neueSrs(),
  });

  card(bgbAt, 'definition', 'Willenserklärung', {
    text: 'Eine Willenserklärung ist eine **private Willensäußerung**, die auf die Herbeiführung eines rechtlichen Erfolges gerichtet ist.',
    source: '§§ 116 ff. BGB',
    note: 'Objektiver Tatbestand: Handlungswille, Erklärungsbewusstsein, Geschäftswille.\nSubjektiv umstritten ist, ob das Erklärungsbewusstsein notwendiger Bestandteil ist (h. M.: nein, potenzielles Erklärungsbewusstsein genügt).',
  }, ['BGB AT', 'Grundbegriff']);

  card(delikt, 'schema', 'Anspruch aus § 823 Abs. 1 BGB', {
    source: '§ 823 Abs. 1 BGB',
    points: parsePunkte(
      'I. Rechtsgutsverletzung\n\t1. Leben, Körper, Gesundheit, Freiheit, Eigentum\n\t2. Sonstiges Recht\n\t\ta) Recht am eingerichteten und ausgeübten Gewerbebetrieb\n\t\tb) Allgemeines Persönlichkeitsrecht\n' +
      'II. Verletzungshandlung\n\t1. Tun oder pflichtwidriges Unterlassen\n' +
      'III. Haftungsbegründende Kausalität\n\t1. Äquivalenz\n\t2. Adäquanz\n\t3. Schutzzweck der Norm\n' +
      'IV. Rechtswidrigkeit\n\t1. Indiziert bei unmittelbarer Verletzung\n\t2. Rechtfertigungsgründe\n' +
      'V. Verschulden\n\t1. Vorsatz oder Fahrlässigkeit, § 276 BGB\n\t2. Verschuldensfähigkeit, §§ 827, 828 BGB\n' +
      'VI. Schaden und haftungsausfüllende Kausalität\n\t1. §§ 249 ff. BGB\n\t2. Mitverschulden, § 254 BGB'),
    note: 'Beispielkarte – die Nummerierung ist selbst getippt, die Einrückung macht nur den Versatz. Kannst du löschen oder überschreiben.',
  }, ['Deliktsrecht', 'Schema']);

  card(bgbAt, 'frei', 'Worin unterscheidet sich die Anfechtung nach § 119 I BGB von der nach § 119 II BGB?', {
    text: '**§ 119 Abs. 1 BGB** erfasst den Irrtum im *Erklärungsakt* (Inhalts- und Erklärungsirrtum) – der Erklärende sagt etwas anderes, als er sagen wollte.\n\n**§ 119 Abs. 2 BGB** erfasst den Eigenschaftsirrtum über verkehrswesentliche Eigenschaften – ein Motivirrtum, den das Gesetz ausnahmsweise beachtet.',
    source: '§ 119 BGB',
    note: '',
  }, ['BGB AT']);
}

async function start() {
  try {
    const gespeichert = await DB.get('state');
    if (gespeichert && Array.isArray(gespeichert.cards)) {
      S = Object.assign(leererStand(), gespeichert);
      S.settings = Object.assign(leererStand().settings, gespeichert.settings || {});
    } else {
      beispiele();
      await DB.set('state', S);
    }
  } catch (e) {
    toast('Speicher nicht verfügbar – Daten können nicht gesichert werden.', 6000);
  }

  themaAnwenden();
  aktuellerOrdner = S.settings.lastFolder && ordner(S.settings.lastFolder) ? S.settings.lastFolder : null;
  for (const f of S.folders) if (f.parentId) offeneOrdner.add(f.parentId);

  renderTree(); renderListe();
  schnappschuss();

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* Bedienelemente */
  $('#btn-new-folder').onclick = () => neuerOrdner(aktuellerOrdner);
  $('#btn-new-card').onclick = () => karteBearbeiten(null);
  $('#btn-study').onclick = lernDialog;
  $('#btn-settings').onclick = einstellungen;
  $('#btn-menu').onclick = () => { document.body.classList.add('nav-open'); $('#scrim').hidden = false; };
  $('#scrim').onclick = () => { document.body.classList.remove('nav-open'); $('#scrim').hidden = true; };

  let suchTimer = null;
  $('#search').addEventListener('input', e => {
    clearTimeout(suchTimer);
    const v = e.target.value.trim();
    suchTimer = setTimeout(() => { suchbegriff = v; renderListe(); }, 160);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#overlay').hidden) { if (L) { if (lernAnsicht._prev) lernAnsicht._prev(); L = null; } schliessen(); renderTree(); renderListe(); return; }
    const tippt = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''));
    if (tippt || !$('#overlay').hidden) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); karteBearbeiten(null); }
    if (e.key === 'l' || e.key === 'L') { e.preventDefault(); lernDialog(); }
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  });

  window.addEventListener('beforeunload', () => { if (saveTimer) { clearTimeout(saveTimer); DB.set('state', S); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

window.addEventListener('error', e => {
  console.error(e.error || e.message);
  toast('Fehler: ' + (e.message || e.error), 8000);
});
window.addEventListener('unhandledrejection', e => {
  console.error(e.reason);
  toast('Fehler: ' + (e.reason && e.reason.message ? e.reason.message : e.reason), 8000);
});

start().catch(e => { console.error(e); toast('Start fehlgeschlagen: ' + e.message, 8000); });
})();
