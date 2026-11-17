/* Тренажёр казахского: уроки, интервальное повторение, словарь. Весь прогресс — в localStorage. */
(function () {
  'use strict';
  var KEY = 'kz-crm-v1';
  var IV = [0, 1, 3, 7, 14, 30, 60]; // через сколько дней повторять слово на каждой ступени
  var LESSON = 5;
  var TOPICS = window.KZ_TOPICS, LETTERS = window.KZ_LETTERS, GRAMMAR = window.KZ_GRAMMAR;
  var KZ_KEYS = ['ә', 'ғ', 'қ', 'ң', 'ө', 'ұ', 'ү', 'һ', 'і'];
  var view = document.getElementById('view');

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dstr(d) { function z(n) { return String(n).padStart(2, '0'); } return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return dstr(d); }
  function today() { return dstr(new Date()); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function plural(n, a, b, c) { var m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  function words(n) { return n + ' ' + plural(n, 'слово', 'слова', 'слов'); }

  /* ---------- состояние ---------- */
  var S = null;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  S = normalize(S);
  function normalize(o) {
    o = o && typeof o === 'object' ? o : {};
    return { words: o.words || {}, custom: Array.isArray(o.custom) ? o.custom : [], log: o.log || {}, goal: o.goal || 10 };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function logDay(kind, n) { var t = today(), l = S.log[t] || (S.log[t] = { n: 0, r: 0 }); l[kind] += n; }

  function allWords() {
    var out = [];
    TOPICS.forEach(function (t) { t.words.forEach(function (w) { out.push({ id: w[0], kk: w[0], ru: w[1], topic: t.id }); }); });
    S.custom.forEach(function (w) { out.push({ id: 'c:' + w.kk, kk: w.kk, ru: w.ru, topic: 'custom' }); });
    return out;
  }
  function topicWords(id) { return allWords().filter(function (w) { return w.topic === id; }); }
  function topicList() {
    var l = TOPICS.slice();
    if (S.custom.length) l.push({ id: 'custom', icon: '📝', kk: 'Менің сөздерім', ru: 'Мои слова' });
    return l;
  }
  function prog(w) { return S.words[w.id]; }
  function status(w) { var p = prog(w); return !p ? 'new' : p.box >= 4 ? 'done' : 'learn'; }
  var ST = { new: 'новое', learn: 'учу', done: 'знаю' };
  function dueWords() { var t = today(); return allWords().filter(function (w) { var p = prog(w); return p && p.due <= t; }); }
  function typable(w) { return w.kk.indexOf('…') < 0 && w.kk.split(' ').length <= 2; }

  function streak() {
    var n = 0, d = new Date();
    if (!S.log[dstr(d)]) d.setDate(d.getDate() - 1);
    while (S.log[dstr(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- озвучка (только если в системе есть казахский голос) ---------- */
  var voice = null;
  function findVoice() {
    if (!('speechSynthesis' in window)) return;
    voice = speechSynthesis.getVoices().filter(function (v) { return /^kk/i.test(v.lang); })[0] || null;
    document.body.classList.toggle('tts', !!voice);
  }
  findVoice();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = findVoice;
  function speak(text) {
    if (!voice) return;
    var u = new SpeechSynthesisUtterance(text.replace('…', ''));
    u.voice = voice; u.lang = voice.lang; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function spk(kk) { return '<button class="spk" data-act="speak" data-kk="' + esc(kk) + '" aria-label="Прослушать">🔊</button>'; }

  /* ---------- занятие ---------- */
  var ses = null;

  function startLesson(topicId) {
    var ws = topicWords(topicId).filter(function (w) { return !prog(w); }).slice(0, LESSON);
    if (!ws.length) return;
    var q = [];
    ws.forEach(function (w) { q.push({ w: w, t: 'kr', first: true }); });
    shuffle(ws).forEach(function (w) { q.push({ w: w, t: 'rk' }); });
    shuffle(ws).forEach(function (w) { q.push({ w: w, t: typable(w) ? 'ty' : 'kr' }); });
    ses = { mode: 'lesson', topic: topicId, words: ws, intro: 0, q: q, i: 0, miss: {}, ans: null };
    render();
  }
  function startReview(list, mode, topicId) {
    list = shuffle(list).slice(0, 20);
    if (!list.length) return;
    var q = list.map(function (w) {
      var p = prog(w), kinds = ['kr', 'rk'];
      if (typable(w) && p && p.box >= 2) kinds.push('ty', 'ty');
      return { w: w, t: kinds[Math.floor(Math.random() * kinds.length)], first: true };
    });
    ses = { mode: mode, topic: topicId, words: list, intro: list.length, q: q, i: 0, miss: {}, ans: null };
    render();
  }

  function options(task) {
    if (task.opts) return task.opts;
    var key = task.t === 'kr' ? 'ru' : 'kk', all = allWords(), right = task.w[key];
    var pool = shuffle(all.filter(function (w) { return w.topic === task.w.topic && w[key] !== right; }))
      .concat(shuffle(all.filter(function (w) { return w.topic !== task.w.topic && w[key] !== right; })));
    var seen = {}, opts = [right];
    seen[right] = 1;
    for (var i = 0; i < pool.length && opts.length < 4; i++) if (!seen[pool[i][key]]) { seen[pool[i][key]] = 1; opts.push(pool[i][key]); }
    return (task.opts = shuffle(opts));
  }

  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е').replace(/[.,!?…—\-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  var LOOSE = { 'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и', 'ы': 'и' };
  function loose(s) { return norm(s).replace(/[әғқңөұүһіы]/g, function (c) { return LOOSE[c]; }); }

  function answer(value) {
    if (!ses || ses.ans) return;
    var task = ses.q[ses.i], w = task.w, ok, warn = false;
    if (task.t === 'ty') {
      if (!norm(value)) return;
      ok = norm(value) === norm(w.kk);
      if (!ok && loose(value) === loose(w.kk)) { ok = true; warn = true; }
    } else ok = value === (task.t === 'kr' ? w.ru : w.kk);

    if (!ok) { ses.miss[w.id] = 1; ses.q.push({ w: w, t: task.t === 'ty' ? 'rk' : task.t }); }
    if (task.first && ses.mode !== 'lesson') {
      var p = prog(w);
      if (!ok) S.words[w.id] = { box: 1, due: addDays(1) };
      else if (ses.mode === 'review') { var b = Math.min(6, p.box + 1); S.words[w.id] = { box: b, due: addDays(IV[b]) }; }
      if (ses.mode === 'review') logDay('r', 1);
      save();
    }
    ses.ans = { ok: ok, warn: warn, value: value };
    render();
    if (ok) speak(w.kk);
  }
  function next() {
    if (!ses) return;
    if (ses.intro < ses.words.length) { ses.intro++; render(); return; }
    if (!ses.ans) return;
    ses.ans = null; ses.i++;
    if (ses.i >= ses.q.length) finish(); else render();
  }
  function finish() {
    if (ses.mode === 'lesson') {
      ses.words.forEach(function (w) { S.words[w.id] = { box: 1, due: addDays(1) }; });
      logDay('n', ses.words.length);
    } else if (ses.mode === 'practice') logDay('r', ses.words.length);
    save();
    ses.done = true;
    render();
  }

  function renderSession() {
    var head = '<div class="ses-head"><button class="x" data-act="quit" aria-label="Закрыть">✕</button><div class="bar"><i style="width:' +
      Math.round(100 * (ses.done ? 1 : (ses.intro + ses.i) / (ses.words.length + ses.q.length))) + '%"></i></div></div>';
    if (ses.mode !== 'lesson') head = head.replace(/width:\d+%/, 'width:' + Math.round(100 * (ses.done ? 1 : ses.i / ses.q.length)) + '%');

    if (ses.done) {
      var missed = Object.keys(ses.miss).length, total = ses.words.length;
      var more = ses.mode === 'lesson' && topicWords(ses.topic).some(function (w) { return !prog(w); });
      view.innerHTML = head + '<div class="card center fin"><div class="big-emoji">🎉</div><h2>Жарайсың! Молодец!</h2>' +
        '<p class="muted">' + (ses.mode === 'lesson' ? 'Новых слов: ' + total + '. Завтра они появятся в повторении.' : 'Повторено: ' + words(total) + '.') +
        '<br>Без ошибок: ' + (total - missed) + ' из ' + total + '.</p><div class="row center-row">' +
        (more ? '<button class="btn primary" data-act="lesson" data-id="' + ses.topic + '">Ещё 5 слов</button>' : '') +
        '<button class="btn' + (more ? '' : ' primary') + '" data-act="quit">На главную</button></div></div>';
      return;
    }

    if (ses.intro < ses.words.length) {
      var iw = ses.words[ses.intro];
      view.innerHTML = head + '<p class="hint">Новое слово ' + (ses.intro + 1) + ' из ' + ses.words.length + '</p>' +
        '<div class="card center word-card"><div class="kk">' + esc(iw.kk) + ' ' + spk(iw.kk) + '</div><div class="ru">' + esc(iw.ru) + '</div></div>' +
        '<button class="btn primary wide" data-act="next">' + (ses.intro + 1 < ses.words.length ? 'Дальше' : 'К упражнениям') + '</button>';
      speak(iw.kk);
      return;
    }

    var task = ses.q[ses.i], w = task.w, a = ses.ans, body;
    if (task.t === 'ty') {
      body = '<p class="hint">Напишите по-казахски</p><div class="prompt">' + esc(w.ru) + '</div>' +
        '<input id="ty" class="ty" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Ваш ответ" ' +
        (a ? 'disabled value="' + esc(a.value) + '"' : '') + '>' +
        '<div class="keys">' + KZ_KEYS.map(function (k) { return '<button data-act="key" data-k="' + k + '"' + (a ? ' disabled' : '') + '>' + k + '</button>'; }).join('') + '</div>' +
        (a ? '' : '<button class="btn primary wide" data-act="check">Проверить</button>');
    } else {
      var right = task.t === 'kr' ? w.ru : w.kk;
      body = '<p class="hint">' + (task.t === 'kr' ? 'Как переводится?' : 'Как это по-казахски?') + '</p>' +
        '<div class="prompt">' + esc(task.t === 'kr' ? w.kk : w.ru) + (task.t === 'kr' ? ' ' + spk(w.kk) : '') + '</div><div class="opts">' +
        options(task).map(function (o, i) {
          var cls = a ? (o === right ? ' ok' : o === a.value ? ' bad' : '') : '';
          return '<button class="opt' + cls + '" data-act="opt" data-i="' + i + '"' + (a ? ' disabled' : '') + '><span>' + (i + 1) + '</span>' + esc(o) + '</button>';
        }).join('') + '</div>';
    }
    var fb = '';
    if (a) fb = '<div class="fb ' + (a.ok ? 'ok' : 'bad') + '"><div><b>' + (a.ok ? (a.warn ? 'Почти! Проверьте буквы' : 'Дұрыс! Верно') : 'Правильный ответ') + '</b>' +
      '<div class="fb-word">' + esc(w.kk) + ' ' + spk(w.kk) + ' — ' + esc(w.ru) + '</div></div><button class="btn primary" data-act="next">Дальше</button></div>';
    view.innerHTML = head + body + fb;
    var inp = document.getElementById('ty');
    if (inp && !a) inp.focus();
  }

  /* ---------- экраны ---------- */
  var LEVELS = [[0, 'Бастаушы', 'Новичок'], [50, 'Үйренуші', 'Ученик'], [150, 'Білгір', 'Знаток'], [300, 'Шебер', 'Мастер']];

  function renderHome() {
    var all = allWords(), seen = all.filter(prog).length, known = all.filter(function (w) { return status(w) === 'done'; }).length;
    var due = dueWords().length, log = S.log[today()] || { n: 0, r: 0 }, st = streak();
    var nextT = topicList().filter(function (t) { return topicWords(t.id).some(function (w) { return !prog(w); }); })[0];
    var lvl = LEVELS.filter(function (l) { return seen >= l[0]; }).pop(), nl = LEVELS[LEVELS.indexOf(lvl) + 1];
    var base = allWords().filter(function (w) { return w.topic !== 'custom'; });
    var wod = base[Math.floor(Date.now() / 864e5) % base.length];

    var days = [], max = 1, names = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var l = S.log[dstr(d)] || { n: 0, r: 0 }; days.push({ n: l.n, r: l.r, name: names[d.getDay()] }); max = Math.max(max, l.n + l.r); }

    var cta = '';
    if (due) cta += '<button class="btn primary" data-act="review">Повторить ' + words(due) + '</button>';
    if (nextT) cta += '<button class="btn' + (due ? '' : ' primary') + '" data-act="lesson" data-id="' + nextT.id + '">Новые слова: ' + esc(nextT.ru) + '</button>';
    if (!cta) cta = '<p class="muted">На сегодня всё сделано. Добавьте свои слова в словаре или потренируйте любую тему.</p>';

    view.innerHTML = '<h1>Сәлем! <small>Привет!</small></h1>' +
      '<div class="card hero"><div><div class="eyebrow">План на сегодня</div><div class="goal-line"><b>' + Math.min(log.n, S.goal) + ' / ' + S.goal + '</b> новых слов' +
      (log.r ? ' · повторено ' + log.r : '') + '</div><div class="bar"><i style="width:' + Math.min(100, Math.round(100 * log.n / S.goal)) + '%"></i></div></div>' +
      '<div class="row">' + cta + '</div></div>' +
      '<div class="stats">' +
      stat('🔥', st, plural(st, 'день подряд', 'дня подряд', 'дней подряд')) +
      stat('📚', seen, 'изучено из ' + all.length) +
      stat('✅', known, 'знаю уверенно') +
      stat('🔁', due, 'ждут повторения') + '</div>' +
      '<div class="grid2"><div class="card"><div class="eyebrow">Уровень</div><div class="lvl">' + lvl[1] + ' <small>' + lvl[2] + '</small></div>' +
      (nl ? '<div class="bar"><i style="width:' + Math.round(100 * (seen - lvl[0]) / (nl[0] - lvl[0])) + '%"></i></div><p class="muted small">До уровня «' + nl[1] + '» — ещё ' + words(nl[0] - seen) + '</p>' : '<p class="muted small">Высший уровень курса!</p>') + '</div>' +
      '<div class="card"><div class="eyebrow">Слово дня</div><div class="wod">' + esc(wod.kk) + ' ' + spk(wod.kk) + '</div><p class="muted">' + esc(wod.ru) + '</p></div></div>' +
      '<div class="card"><div class="eyebrow">Активность за неделю</div><div class="chart">' + days.map(function (d) {
        return '<div class="col" title="новых: ' + d.n + ', повторено: ' + d.r + '"><div class="num">' + (d.n + d.r || '') + '</div><div class="stack">' +
          '<i class="r" style="height:' + (90 * d.r / max) + 'px"></i><i class="n" style="height:' + (90 * d.n / max) + 'px"></i></div><span>' + d.name + '</span></div>';
      }).join('') + '</div><div class="legend"><span><i class="n"></i>новые слова</span><span><i class="r"></i>повторения</span></div></div>' +
      '<details class="card settings"><summary>Настройки и резервная копия</summary>' +
      '<label>Цель на день: <select id="goal">' + [5, 10, 15, 20].map(function (g) { return '<option' + (g === S.goal ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select> новых слов</label>' +
      '<p class="muted small">Прогресс хранится только в этом браузере. Чтобы перенести его на другое устройство, сохраните файл и загрузите его там.</p>' +
      '<div class="row"><button class="btn" data-act="export">Сохранить прогресс в файл</button><label class="btn">Загрузить из файла<input type="file" id="imp" accept="application/json,.json" hidden></label>' +
      '<button class="btn danger" data-act="reset">Сбросить прогресс</button></div></details>';
  }
  function stat(icon, n, label) { return '<div class="card stat"><span>' + icon + '</span><b>' + n + '</b><small>' + label + '</small></div>'; }

  function renderLessons() {
    view.innerHTML = '<h1>Сабақтар <small>Уроки</small></h1><p class="muted">Каждый урок — 5 новых слов и упражнения на них. Идите по порядку или выберите нужную тему.</p><div class="topics">' +
      topicList().map(function (t) {
        var ws = topicWords(t.id), seen = ws.filter(prog).length;
        return '<a class="card topic" href="#topic/' + t.id + '"><div class="ic">' + t.icon + '</div><div class="grow"><b>' + esc(t.kk) + '</b><div class="muted small">' + esc(t.ru) + '</div>' +
          '<div class="bar"><i style="width:' + Math.round(100 * seen / ws.length) + '%"></i></div></div><div class="cnt">' + (seen === ws.length ? '✓' : seen + '/' + ws.length) + '</div></a>';
      }).join('') + '</div>';
  }

  function renderTopic(id) {
    var t = topicList().filter(function (x) { return x.id === id; })[0];
    if (!t) { location.hash = '#lessons'; return; }
    var ws = topicWords(id), fresh = ws.filter(function (w) { return !prog(w); }).length, seen = ws.length - fresh;
    view.innerHTML = '<a class="back" href="#lessons">← Все темы</a><h1>' + t.icon + ' ' + esc(t.kk) + ' <small>' + esc(t.ru) + '</small></h1>' +
      '<div class="row">' + (fresh ? '<button class="btn primary" data-act="lesson" data-id="' + id + '">Учить новые слова (' + Math.min(LESSON, fresh) + ')</button>' : '') +
      (seen ? '<button class="btn' + (fresh ? '' : ' primary') + '" data-act="practice" data-id="' + id + '">Тренировать изученные (' + seen + ')</button>' : '') + '</div>' +
      '<div class="card list">' + ws.map(function (w) {
        return '<div class="li"><div class="grow"><b>' + esc(w.kk) + '</b> ' + spk(w.kk) + '<div class="muted small">' + esc(w.ru) + '</div></div><span class="badge ' + status(w) + '">' + ST[status(w)] + '</span></div>';
      }).join('') + '</div>';
  }

  function renderReview() {
    var due = dueWords().length, t1 = addDays(1), tomorrow = allWords().filter(function (w) { var p = prog(w); return p && p.due === t1; }).length;
    var seen = allWords().filter(prog).length;
    view.innerHTML = '<h1>Қайталау <small>Повторение</small></h1>' +
      '<div class="card center"><div class="big-emoji">' + (due ? '🔁' : '🌙') + '</div><h2>' + (due ? 'Сегодня к повторению: ' + words(due) : 'Сегодня повторять нечего') + '</h2>' +
      '<p class="muted">Слово возвращается через 1, 3, 7, 14, 30 и 60 дней — как раз когда вы начинаете его забывать. Ошиблись — слово начинает путь заново.</p>' +
      (due ? '<button class="btn primary" data-act="review">Начать повторение</button>' : seen ? '<button class="btn" data-act="practice-all">Свободная тренировка</button>' : '<a class="btn primary" href="#lessons">К урокам</a>') +
      (tomorrow ? '<p class="muted small">Завтра: ' + words(tomorrow) + '</p>' : '') + '</div>';
  }

  var dict = { q: '', st: '', tp: '' };
  function renderDict() {
    view.innerHTML = '<h1>Сөздік <small>Словарь</small></h1>' +
      '<div class="filters"><input id="dq" type="search" placeholder="Поиск по казахскому или русскому" value="' + esc(dict.q) + '">' +
      '<select id="dst"><option value="">Все статусы</option>' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (dict.st === k ? ' selected' : '') + '>' + ST[k] + '</option>'; }).join('') + '</select>' +
      '<select id="dtp"><option value="">Все темы</option>' + topicList().map(function (t) { return '<option value="' + t.id + '"' + (dict.tp === t.id ? ' selected' : '') + '>' + esc(t.ru) + '</option>'; }).join('') + '</select></div>' +
      '<div class="card list" id="dlist"></div>' +
      '<form class="card add" id="addw"><div class="eyebrow">Добавить своё слово</div><div class="row"><input name="kk" placeholder="по-казахски" required maxlength="80" autocapitalize="off">' +
      '<input name="ru" placeholder="перевод" required maxlength="80"><button class="btn primary">Добавить</button></div>' +
      '<div class="keys">' + KZ_KEYS.map(function (k) { return '<button type="button" data-act="key" data-k="' + k + '" data-for="kk">' + k + '</button>'; }).join('') + '</div></form>';
    fillDict();
  }
  function fillDict() {
    var q = norm(dict.q), tnames = {};
    topicList().forEach(function (t) { tnames[t.id] = t.ru; });
    var ws = allWords().filter(function (w) {
      return (!dict.st || status(w) === dict.st) && (!dict.tp || w.topic === dict.tp) && (!q || norm(w.kk).indexOf(q) >= 0 || norm(w.ru).indexOf(q) >= 0 || loose(w.kk).indexOf(loose(q)) >= 0);
    });
    document.getElementById('dlist').innerHTML = '<div class="li muted small">Найдено: ' + ws.length + '</div>' + ws.map(function (w) {
      var p = prog(w);
      return '<div class="li"><div class="grow"><b>' + esc(w.kk) + '</b> ' + spk(w.kk) + '<div class="muted small">' + esc(w.ru) + ' · ' + esc(tnames[w.topic]) +
        (p ? ' · повтор ' + (p.due <= today() ? 'сегодня' : p.due.split('-').reverse().slice(0, 2).join('.')) : '') + '</div></div>' +
        '<span class="badge ' + status(w) + '">' + ST[status(w)] + '</span>' +
        (w.topic === 'custom' ? '<button class="x" data-act="del" data-kk="' + esc(w.kk) + '" aria-label="Удалить">✕</button>' : '') + '</div>';
    }).join('');
  }

  function renderRef() {
    view.innerHTML = '<h1>Анықтама <small>Справочник</small></h1>' +
      '<h2>Особые буквы казахского алфавита</h2><p class="muted">В алфавите 42 буквы: 33 русские и 9 своих. Остальные читаются почти как в русском.</p><div class="letters">' +
      LETTERS.map(function (l) {
        return '<div class="card letter"><div class="l">' + l.l + '</div><p>' + esc(l.how) + '</p>' + l.ex.map(function (e) {
          return '<div class="ex"><b>' + esc(e[0]) + '</b> ' + spk(e[0]) + ' — ' + esc(e[1]) + '</div>'; }).join('') + '</div>';
      }).join('') + '</div><h2>Грамматика для начинающих</h2>' +
      GRAMMAR.map(function (g, i) {
        return '<details class="card gram"' + (i ? '' : ' open') + '><summary>' + (i + 1) + '. ' + esc(g.t) + '</summary><p>' + esc(g.body) + '</p>' + g.ex.map(function (e) {
          return '<div class="ex"><b>' + esc(e[0]) + '</b> — ' + esc(e[1]) + '</div>'; }).join('') + '</details>';
      }).join('');
  }

  /* ---------- маршрутизация и события ---------- */
  function render() {
    document.body.classList.toggle('in-session', !!ses);
    if (ses) { renderSession(); window.scrollTo(0, 0); return; }
    var h = location.hash.slice(1) || 'home', parts = h.split('/');
    var tab = parts[0] === 'topic' ? 'lessons' : parts[0];
    document.querySelectorAll('nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + tab); });
    var due = dueWords().length, bd = document.getElementById('due-badge');
    bd.textContent = due || ''; bd.hidden = !due;
    if (parts[0] === 'lessons') renderLessons();
    else if (parts[0] === 'topic') renderTopic(parts[1]);
    else if (parts[0] === 'review') renderReview();
    else if (parts[0] === 'dict') renderDict();
    else if (parts[0] === 'ref') renderRef();
    else renderHome();
  }
  window.addEventListener('hashchange', function () { ses = null; render(); window.scrollTo(0, 0); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act;
    if (act === 'speak') speak(b.dataset.kk);
    else if (act === 'lesson') startLesson(b.dataset.id);
    else if (act === 'review') startReview(dueWords(), 'review');
    else if (act === 'practice') startReview(topicWords(b.dataset.id).filter(prog), 'practice', b.dataset.id);
    else if (act === 'practice-all') startReview(allWords().filter(prog), 'practice');
    else if (act === 'quit') { ses = null; render(); }
    else if (act === 'next') next();
    else if (act === 'opt') answer(ses.q[ses.i].opts[+b.dataset.i]);
    else if (act === 'check') answer(document.getElementById('ty').value);
    else if (act === 'key') {
      var inp = b.dataset.for ? document.querySelector('#addw [name=' + b.dataset.for + ']') : document.getElementById('ty');
      var s = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
      inp.value = inp.value.slice(0, s) + b.dataset.k + inp.value.slice(inp.selectionEnd == null ? s : inp.selectionEnd);
      inp.focus(); inp.setSelectionRange(s + 1, s + 1);
    }
    else if (act === 'del') {
      if (!confirm('Удалить слово «' + b.dataset.kk + '»?')) return;
      S.custom = S.custom.filter(function (w) { return w.kk !== b.dataset.kk; });
      delete S.words['c:' + b.dataset.kk]; save(); renderDict();
    }
    else if (act === 'export') {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
      a.download = 'kazakh-progress-' + today() + '.json'; a.click();
    }
    else if (act === 'reset') {
      if (!confirm('Удалить весь прогресс и свои слова? Отменить это нельзя.')) return;
      S = normalize(null); save(); render();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!ses || ses.done) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (ses.intro < ses.words.length || ses.ans) next();
      else if (ses.q[ses.i].t === 'ty') answer(document.getElementById('ty').value);
    } else if (!ses.ans && ses.intro >= ses.words.length && ses.q[ses.i].t !== 'ty' && /^[1-4]$/.test(e.key)) {
      var o = ses.q[ses.i].opts[+e.key - 1];
      if (o) answer(o);
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'dq') { dict.q = e.target.value; fillDict(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'dst') { dict.st = t.value; fillDict(); }
    else if (t.id === 'dtp') { dict.tp = t.value; fillDict(); }
    else if (t.id === 'goal') { S.goal = +t.value; save(); render(); }
    else if (t.id === 'imp' && t.files[0]) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var o = JSON.parse(fr.result);
          if (!o || typeof o.words !== 'object') throw 0;
          if (!confirm('Заменить текущий прогресс данными из файла?')) return;
          S = normalize(o); save(); render();
        } catch (err) { alert('Не удалось прочитать файл: это не файл прогресса.'); }
      };
      fr.readAsText(t.files[0]);
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'addw') return;
    e.preventDefault();
    var kk = e.target.kk.value.trim(), ru = e.target.ru.value.trim();
    if (!kk || !ru) return;
    if (allWords().some(function (w) { return norm(w.kk) === norm(kk); })) { alert('Такое слово уже есть в словаре.'); return; }
    S.custom.push({ kk: kk, ru: ru }); save();
    dict = { q: '', st: '', tp: 'custom' }; renderDict();
  });

  render();
})();
