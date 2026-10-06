(() => {
  'use strict';

  const STORE_KEY = 'vvrv-quiz-v1';
  const PASS_PCT = 70;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---------- persistence (best-effort) ----------
  const store = (() => {
    let data = { stats: {}, flags: {}, exams: {}, sel: null, mode: null, count: null };
    try { Object.assign(data, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch (e) {}
    return {
      data,
      save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {} },
      reset() { data.stats = {}; data.flags = {}; data.exams = {}; this.save(); }
    };
  })();

  // ---------- state ----------
  let clusters = [];          // [{id,titel,bron,vragen:[...]}]
  let exams = [];             // proefexamens: [{id,titel,duur_min,norm_pct,eisen,vragen:[...]}]
  let byId = {};              // question id -> question (with cluster ref)
  let session = null;
  let timer = null;

  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- views ----------
  function show(view) {
    for (const v of ['start', 'quiz', 'result']) $('#view-' + v).hidden = v !== view;
    $('#btn-home').hidden = view === 'start';
    if (view === 'start') { $('#top-title').textContent = 'Vakkennis Machinist'; $('#top-meta').textContent = ''; }
    window.scrollTo(0, 0);
  }

  const MODE_HINTS = {
    oefen: 'Direct feedback en uitleg na elke vraag.',
    examen: 'Geen feedback tussendoor, tijdslimiet (1,5 min per vraag). Uitslag aan het eind.',
    fouten: 'Alleen vragen die je de laatste keer fout had of hebt gemarkeerd.'
  };

  function selectedClusterIds() {
    return [...document.querySelectorAll('#clusters input:checked')].map((i) => i.value);
  }
  function currentMode() { return document.querySelector('input[name=mode]:checked').value; }
  function currentCount() { return +document.querySelector('input[name=count]:checked').value; }

  function poolFor(mode, ids) {
    const qs = clusters.filter((c) => ids.includes(c.id)).flatMap((c) => c.vragen);
    if (mode !== 'fouten') return qs;
    return qs.filter((q) => (store.data.stats[q.id] && store.data.stats[q.id].last === false) || store.data.flags[q.id]);
  }

  function renderProef() {
    const list = $('#proef-list');
    list.innerHTML = '';
    $('#proef-card').hidden = !exams.length;
    for (const ex of exams) {
      const b = el('button', 'primary proef-btn');
      const txt = el('span', null, ex.titel);
      txt.appendChild(el('small', null, `${ex.vragen.length} vragen · ${ex.duur_min} min · norm ${ex.norm_pct}%`));
      const r = store.data.exams[ex.id];
      b.append(txt, el('span', 'best', r ? `beste ${r.best}%` : 'Start'));
      b.addEventListener('click', () => startSession(ex.vragen, 'proef', {
        durationMs: ex.duur_min * 60000, pass: ex.norm_pct, title: ex.titel, exam: ex
      }));
      list.appendChild(b);
    }
  }

  function renderStart() {
    renderProef();
    const ul = $('#clusters');
    ul.innerHTML = '';
    const sel = store.data.sel || clusters.map((c) => c.id);
    for (const c of clusters) {
      const answered = c.vragen.filter((q) => store.data.stats[q.id]);
      const right = answered.filter((q) => store.data.stats[q.id].last).length;
      const li = el('li');
      const lab = el('label');
      const cb = el('input');
      cb.type = 'checkbox'; cb.value = c.id; cb.checked = sel.includes(c.id);
      cb.addEventListener('change', updateStartInfo);
      const name = el('span', 'cl-name', c.titel);
      name.appendChild(el('small', null, `${c.id === '12' ? 'ORE' : 'Cluster ' + c.id} · ${c.vragen.length} vragen`));
      const stat = el('span', 'cl-stat', `${answered.length ? Math.round((right / c.vragen.length) * 100) : 0}%`);
      const bar = el('div', 'mini-bar');
      const fill = el('i');
      fill.style.width = (right / c.vragen.length) * 100 + '%';
      bar.appendChild(fill); stat.appendChild(bar);
      lab.append(cb, name, stat); li.appendChild(lab); ul.appendChild(li);
    }
    const src = $('#sources');
    src.innerHTML = '';
    for (const c of clusters) {
      const li = el('li');
      const a = el('a', null, c.titel);
      a.href = 'bronnen/' + c.bron; a.target = '_blank'; a.rel = 'noopener';
      li.appendChild(a); src.appendChild(li);
    }
    for (const extra of window.EXTRA_SOURCES || []) {
      const li = el('li');
      const a = el('a', null, extra.titel);
      a.href = extra.href; a.target = '_blank'; a.rel = 'noopener';
      li.appendChild(a); src.appendChild(li);
    }
    updateStartInfo();
  }

  function updateStartInfo() {
    const ids = selectedClusterIds();
    const mode = currentMode();
    const pool = poolFor(mode, ids);
    const n = Math.min(pool.length, currentCount());
    $('#mode-hint').textContent = MODE_HINTS[mode];
    $('#start-info').textContent = pool.length
      ? `${n} van ${pool.length} beschikbare vragen`
      : mode === 'fouten' ? 'Geen foute of gemarkeerde vragen in de gekozen clusters.' : 'Kies minstens één cluster.';
    $('#btn-start').disabled = !pool.length;
    $('#toggle-all').textContent = ids.length === clusters.length ? 'Alles uit' : 'Alles aan';
    store.data.sel = ids; store.data.mode = mode; store.data.count = currentCount(); store.save();
  }

  // ---------- quiz ----------
  function startSession(questions, mode, opts = {}) {
    const items = shuffle(questions).map((q) => {
      const order = shuffle([0, 1, 2, 3]);
      return { q, order, chosen: null };
    });
    const exam = mode === 'examen' || mode === 'proef';
    session = { mode, exam, items, i: 0, deadline: null, pass: opts.pass || PASS_PCT, proef: opts.exam || null };
    clearInterval(timer);
    if (exam) {
      session.deadline = Date.now() + (opts.durationMs || items.length * 90 * 1000);
      timer = setInterval(tick, 1000);
      tick();
    }
    $('#btn-prev').hidden = !exam;
    $('#top-title').textContent = opts.title || (mode === 'examen' ? 'Examen' : mode === 'fouten' ? 'Fouten oefenen' : 'Oefenen');
    show('quiz');
    renderQuestion();
  }

  function tick() {
    if (!session || !session.deadline) return;
    const left = Math.max(0, session.deadline - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    $('#top-meta').textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
    if (left <= 0) finish(true);
  }

  function renderQuestion() {
    const it = session.items[session.i];
    const q = it.q;
    const total = session.items.length;
    $('#progress-bar').style.width = (session.i / total) * 100 + '%';
    $('#q-cluster').textContent = q.eis ? `Eis ${q.eis} · ${q._cluster.titel}` : q._cluster.titel;
    $('#q-num').textContent = `${session.i + 1} / ${total}`;
    $('#q-text').textContent = q.vraag;
    const ol = $('#q-options');
    ol.innerHTML = '';
    it.order.forEach((orig, pos) => {
      const li = el('li');
      const b = el('button', null, q.opties[orig]);
      b.dataset.orig = orig;
      b.addEventListener('click', () => choose(orig));
      li.appendChild(b); ol.appendChild(li);
    });
    $('#q-feedback').hidden = true;
    const next = $('#btn-next');
    next.disabled = !session.exam;
    next.textContent = session.i === total - 1 ? 'Afronden' : 'Volgende';
    $('#btn-prev').disabled = session.i === 0;
    const flagged = !!store.data.flags[q.id];
    $('#btn-flag').setAttribute('aria-pressed', flagged);
    $('#btn-flag').textContent = flagged ? '★ Gemarkeerd' : '☆ Markeer';
    if (it.chosen != null) paintChoice(it);
  }

  function choose(orig) {
    const it = session.items[session.i];
    if (!session.exam && it.chosen != null) return;
    it.chosen = orig;
    paintChoice(it);
  }

  function paintChoice(it) {
    const q = it.q;
    const buttons = [...document.querySelectorAll('#q-options button')];
    const exam = session.exam;
    for (const b of buttons) {
      const o = +b.dataset.orig;
      b.classList.remove('selected', 'correct', 'wrong');
      if (exam) {
        if (o === it.chosen) b.classList.add('selected');
      } else {
        b.disabled = true;
        if (o === q.antwoord) b.classList.add('correct');
        else if (o === it.chosen) b.classList.add('wrong');
      }
    }
    if (!exam) {
      const ok = it.chosen === q.antwoord;
      const fb = $('#q-feedback');
      fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = '';
      fb.appendChild(el('strong', null, ok ? 'Goed!' : 'Fout'));
      fb.appendChild(el('div', null, q.uitleg));
      if (q.bron) fb.appendChild(el('div', 'src', 'Bron: ' + q._cluster.titel + ' – ' + q.bron));
      fb.hidden = false;
      record(q, ok);
    }
    $('#btn-next').disabled = false;
  }

  function record(q, ok) {
    const s = store.data.stats[q.id] || { c: 0, w: 0 };
    if (ok) s.c++; else s.w++;
    s.last = ok;
    store.data.stats[q.id] = s;
    store.save();
  }

  function next() {
    if (session.i < session.items.length - 1) {
      session.i++;
      renderQuestion();
      window.scrollTo(0, 0);
    } else {
      const open = session.items.filter((it) => it.chosen == null).length;
      if (session.exam && open && !confirm(`Je hebt ${open} ${open === 1 ? 'vraag' : 'vragen'} nog niet beantwoord. Toch afronden?`)) return;
      finish();
    }
  }

  function prev() {
    if (session && session.exam && session.i > 0) {
      session.i--;
      renderQuestion();
      window.scrollTo(0, 0);
    }
  }

  function renderBreakdown(s) {
    const box = $('#eis-breakdown');
    box.innerHTML = '';
    box.hidden = !s.proef;
    if (!s.proef) return;
    const groups = {};
    for (const it of s.items) {
      const main = (it.q.eis || '?').split('.')[0];
      const g = (groups[main] = groups[main] || { right: 0, total: 0 });
      g.total++;
      if (it.chosen === it.q.antwoord) g.right++;
    }
    box.appendChild(el('h2', null, 'Score per vakbekwaamheidseis'));
    const table = el('table', 'eis-table');
    for (const key of Object.keys(s.proef.eisen || {}).filter((k) => groups[k]).concat(Object.keys(groups).filter((k) => !(s.proef.eisen || {})[k]))) {
      const g = groups[key];
      const pct = Math.round((g.right / g.total) * 100);
      const tr = el('tr');
      const name = el('td', null, 'Eis ' + key);
      if (s.proef.eisen && s.proef.eisen[key]) name.appendChild(el('small', null, s.proef.eisen[key]));
      tr.append(name, el('td', 'n ' + (pct >= s.pass ? 'ok' : 'bad'), `${g.right}/${g.total} · ${pct}%`));
      table.appendChild(tr);
    }
    box.appendChild(table);
  }

  function finish(timeUp) {
    clearInterval(timer);
    const s = session;
    if (s.exam) for (const it of s.items) record(it.q, it.chosen === it.q.antwoord);
    const total = s.items.length;
    const right = s.items.filter((it) => it.chosen === it.q.antwoord).length;
    const pct = Math.round((right / total) * 100);
    $('#top-meta').textContent = '';
    $('#score-pct').textContent = pct + '%';
    $('#score-txt').textContent = `${right} van ${total} goed`;
    const v = $('#score-verdict');
    const passed = pct >= s.pass;
    const prefix = timeUp ? 'Tijd is om. ' : '';
    if (s.proef) {
      const need = Math.ceil((s.pass / 100) * total);
      v.textContent = prefix + `${passed ? 'Geslaagd' : 'Gezakt'} (norm ${s.pass}% = ${need} goed)`;
      const before = store.data.exams[s.proef.id];
      store.data.exams[s.proef.id] = { best: Math.max(pct, before ? before.best : 0), last: pct, date: new Date().toISOString().slice(0, 10) };
      store.save();
    } else {
      v.textContent = prefix + (passed ? 'Goed bezig!' : 'Nog even oefenen') + ` (indicatie: ≥ ${s.pass}%)`;
    }
    v.className = 'verdict ' + (passed ? 'ok' : 'bad');
    renderBreakdown(s);
    const wrong = s.items.filter((it) => it.chosen !== it.q.antwoord);
    $('#btn-retry-wrong').hidden = !wrong.length;
    $('#btn-retry-wrong').onclick = () => startSession(wrong.map((it) => it.q), 'oefen');

    const ol = $('#review');
    ol.innerHTML = '';
    // wrong answers first
    for (const it of [...wrong, ...s.items.filter((it) => it.chosen === it.q.antwoord)]) {
      const ok = it.chosen === it.q.antwoord;
      const li = el('li', ok ? '' : 'bad');
      li.appendChild(el('div', 'rq', (it.q.eis ? `[Eis ${it.q.eis}] ` : '') + it.q.vraag));
      if (!ok) li.appendChild(el('div', 'ra your', '✗ ' + (it.chosen == null ? '(niet beantwoord)' : it.q.opties[it.chosen])));
      li.appendChild(el('div', 'ra right', '✓ ' + it.q.opties[it.q.antwoord]));
      li.appendChild(el('div', 'ru', it.q.uitleg + (it.q.bron ? ' — ' + it.q.bron : '')));
      ol.appendChild(li);
    }
    show('result');
    $('#top-title').textContent = 'Uitslag';
  }

  // ---------- wiring ----------
  function wire() {
    const restore = (name, val) => {
      if (val == null) return;
      const r = document.querySelector(`input[name=${name}][value="${val}"]`);
      if (r) r.checked = true;
    };
    restore('mode', store.data.mode);
    restore('count', store.data.count);
    document.querySelectorAll('input[name=mode], input[name=count]').forEach((i) => i.addEventListener('change', updateStartInfo));
    $('#toggle-all').addEventListener('click', () => {
      const all = selectedClusterIds().length !== clusters.length;
      document.querySelectorAll('#clusters input').forEach((i) => (i.checked = all));
      updateStartInfo();
    });
    $('#btn-start').addEventListener('click', () => {
      const mode = currentMode();
      const pool = poolFor(mode, selectedClusterIds());
      startSession(shuffle(pool).slice(0, currentCount()), mode === 'fouten' ? 'oefen' : mode);
    });
    $('#btn-next').addEventListener('click', next);
    $('#btn-prev').addEventListener('click', prev);
    $('#btn-flag').addEventListener('click', () => {
      const q = session.items[session.i].q;
      if (store.data.flags[q.id]) delete store.data.flags[q.id]; else store.data.flags[q.id] = 1;
      store.save();
      renderQuestion();
    });
    $('#btn-home').addEventListener('click', () => {
      if ($('#view-quiz').hidden || confirm('Stoppen met deze sessie?')) {
        clearInterval(timer); session = null; renderStart(); show('start');
      }
    });
    $('#btn-again').addEventListener('click', () => { renderStart(); show('start'); });
    $('#reset').addEventListener('click', () => {
      if (confirm('Alle voortgang en markeringen wissen?')) { store.reset(); renderStart(); }
    });
    document.addEventListener('keydown', (e) => {
      if ($('#view-quiz').hidden) return;
      const k = e.key.toUpperCase();
      const idx = 'ABCD'.indexOf(k) >= 0 ? 'ABCD'.indexOf(k) : '1234'.indexOf(k);
      if (idx >= 0) {
        const b = document.querySelectorAll('#q-options button')[idx];
        if (b && !b.disabled) b.click();
      } else if (e.key === 'Enter' && !$('#btn-next').disabled) next();
      else if (e.key === 'ArrowLeft') prev();
    });
  }

  async function init() {
    try {
      const manifest = await (await fetch('data/manifest.json')).json();
      window.EXTRA_SOURCES = manifest.extra || [];
      clusters = await Promise.all(manifest.clusters.map(async (f) => (await fetch('data/' + f)).json()));
      for (const c of clusters) for (const q of c.vragen) { q._cluster = c; byId[q.id] = q; }
      exams = await Promise.all((manifest.examens || []).map(async (f) => (await fetch('data/' + f)).json()));
      const clusterTitle = Object.fromEntries(clusters.map((c) => [c.id, c.titel]));
      for (const ex of exams) for (const q of ex.vragen) {
        q._cluster = { id: q.cluster, titel: clusterTitle[q.cluster] || ex.titel };
        byId[q.id] = q;
      }
    } catch (e) {
      $('#view-start').innerHTML = '<p class="card">Vragen konden niet geladen worden. Probeer de pagina te verversen.</p>';
      return;
    }
    wire();
    renderStart();
  }

  init();
})();
