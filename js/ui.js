/* 전역각 — 화면, 스와이프, 모달, 저장 */
(function (JY) {
  'use strict';

  var G = JY.Game, A = JY.art;
  var KEYS = { save: 'jy.save.v1', meta: 'jy.meta.v1', settings: 'jy.settings.v1' };
  var NAMES = ['나띨빵', '김어리', '박허당', '최멍청', '이덤덤', '정어벙', '강감자', '조뚝딱', '윤헐랭', '한삽질'];
  var ICON = { hp: '체력', mt: '멘탈', tr: '간부 신뢰', bd: '전우애' };
  var SHORT = { hp: '체력', mt: '멘탈', tr: '신뢰', bd: '전우애' };
  var HINTS = {
    normal: '그냥 끝까지 버텨라', model: '네 가지 스탯을 고르게 유지', malchul: '휴가를 아꼈다가 마지막에',
    cat: '짬통 앞 고양이와 친해져라', gf: '여자친구를 끝까지 챙겨라', cast: '말년에 낙엽을 조심하지 마라',
    elite: '특급전사와 특등사수를 둘 다', rich: '맞선임의 수상한 투자 권유', beloved: '후임에게 사랑받는 선임',
    hp0: '체력이 바닥나면', hp100: '체력이 넘쳐흐르면', mt0: '멘탈이 바닥나면', mt100: '멘탈이 넘쳐흐르면',
    tr0: '간부 신뢰가 바닥나면', tr100: '간부 신뢰가 넘쳐흐르면', bd0: '전우애가 바닥나면', bd100: '전우애가 넘쳐흐르면',
    desert: '멘탈이 바닥일 때의 유혹', awol: '휴가 복귀 시간을 어기면'
  };
  var PROMO_TEXT = {
    1: '훈련소 수료! 이제 진짜 자대 생활이다.',
    2: '작대기 두 개! 이제 막내는 아니다(아마도).',
    3: '상병 꺾였다! 짬이 차오르는 소리가 들린다.',
    4: '병장 진급! 말년의 시작. 떨어지는 낙엽을 조심하라.'
  };

  var state = null;
  var meta = null;
  var settings = null;
  var busy = false;
  var armed = null;
  var drag = null;
  var setup = { face: null, mos: 'infantry' };

  /* ── 저장소 ───────────────────────────── */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  function save() { if (state && !state.over) lsSet(KEYS.save, state); }
  function loadSave() {
    var s = lsGet(KEYS.save, null);
    if (!s || s.v !== 1 || s.over || !s.stats) return null;
    if (!G.getCardDef(s.current)) s.current = 'quiet';
    return s;
  }

  /* ── 도우미 ───────────────────────────── */
  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function won(n) {
    var abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 10000) {
      var man = Math.floor(abs / 10000), rest = abs % 10000;
      return sign + man.toLocaleString('ko-KR') + '만' + (rest ? ' ' + rest.toLocaleString('ko-KR') : '') + '원';
    }
    return sign + abs.toLocaleString('ko-KR') + '원';
  }
  function snd(name) { if (JY.Sound && JY.Sound[name]) JY.Sound[name](); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var toastTimer = 0;
  function toast(text, ms) {
    var t = $('#toast');
    t.textContent = text; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2200);
  }

  function showScreen(id) {
    ['scr-title', 'scr-setup', 'scr-game', 'scr-end', 'scr-album'].forEach(function (s) { document.getElementById(s).hidden = s !== id; });
    if (id === 'scr-game') requestAnimationFrame(fitCard);
  }

  /* ── 캐릭터 ───────────────────────────── */
  function randomFace() {
    var F = JY.FACE_OPTIONS;
    return {
      eyes: pick(F.eyes), mouth: pick(F.mouth), brows: pick(F.brows), head: pick(F.head), extras: pick(F.extras).slice(),
      skin: pick(['#ffd9b5', '#f6c79c', '#eab386', '#f9d2a8'])
    };
  }

  function moodOpts(m) {
    switch (m) {
      case 'happy': return { eyes: 'happy', mouth: 'grin' };
      case 'sad': return { eyes: 'teary', mouth: 'frown' };
      case 'zen': return { eyes: 'happy', mouth: 'smile', extras: ['sparkles'] };
      case 'cast': return { mouth: 'wavy', extras: ['bandage', 'sweat'] };
      case 'proud': return { eyes: 'sparkle', mouth: 'grin', extras: ['sparkles'] };
      default: return {};
    }
  }

  function playerSpec(o) {
    var f = (state && state.face) || setup.face || randomFace();
    var rank = state ? state.rank : (o && o.rank !== undefined ? o.rank : 0);
    var name = state ? state.name : (($('#in-name') && $('#in-name').value) || '나띨빵');
    var spec = {
      seed: 'me-' + name, skin: f.skin, eyes: f.eyes, mouth: f.mouth, brows: f.brows, head: f.head,
      extras: (f.extras || []).slice(), hat: rank === 0 ? 'helmet' : 'none', rank: 'e' + rank, tag: name.slice(0, 3), body: 'camo'
    };
    if (o && o.meSpec) for (var k in o.meSpec) spec[k] = o.meSpec[k];
    if (o && o.meProp) spec.prop = o.meProp;
    if (state && state.flags.cast) spec.extras.push('bandage');
    return spec;
  }

  function charSVG(who, o) {
    o = o || {};
    var ch = JY.CHARS[who] || JY.CHARS.me;
    switch (ch.special) {
      case 'cat': return A.cat({ fish: o.catFish, cap: o.catCap || (state && state.flags.catMascot), mood: o.mood === 'happy' ? 'happy' : 'derp' });
      case 'boar': return A.boar();
      case 'speaker': return A.speaker();
      case 'letter': return A.letter();
      case 'phone': return A.phone();
      case 'box': return A.box();
    }
    var spec;
    if (who === 'me') spec = playerSpec(o);
    else { spec = {}; for (var k in ch.spec) spec[k] = ch.spec[k]; spec.extras = (ch.spec.extras || []).slice(); }
    if (o.extras) spec.extras = (spec.extras || []).concat(o.extras);
    var mood = moodOpts(o.mood || (who === 'me' ? o.meMood : null));
    return A.character(spec, mood);
  }

  function charName(who) {
    var ch = JY.CHARS[who] || JY.CHARS.me;
    if (who === 'me') return { name: state ? state.name : '나', role: (state ? G.RANKS[state.rank] : '') + ' · 나' };
    return { name: ch.name, role: ch.role };
  }

  /* ── 타이틀 ───────────────────────────── */
  function renderTitle() {
    var crowd = $('#title-crowd');
    var lines = ['전역… 할 수 있겠지?', '국방부 시계는 돈다…', '오늘 짬밥 뭐임?', '행보관님이 찾으십니다', '말년엔 낙엽도 조심해'];
    crowd.innerHTML = '<p class="title-bubble">' + pick(lines) + '</p>' + ['malnyeon', 'dumb', 'haeng'].map(function (w) { return '<div class="peek">' + charSVG(w) + '</div>'; }).join('');
    var s = loadSave();
    $('#btn-continue').hidden = !s;
    $('#save-info').hidden = !s;
    if (s) $('#save-info').textContent = G.RANKS[s.rank] + ' ' + s.name + ' · 전역까지 D-' + G.daysLeft(s);
    var got = Object.keys(meta.endings).length;
    $('#album-count').textContent = got + '/' + JY.ENDING_ORDER.length;
    showScreen('scr-title');
  }

  /* ── 입영 통지서 ─────────────────────── */
  function renderSetup() {
    setup.face = randomFace();
    setup.mos = 'infantry';
    $('#in-name').value = pick(NAMES);
    $('#in-date').value = G.todayStr();
    $('#notice-no').textContent = '제 ' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900000) + 100000) + ' 호';
    var grid = $('#mos-grid');
    grid.innerHTML = Object.keys(G.MOS).map(function (k) {
      var m = G.MOS[k];
      return '<button type="button" class="mos" data-mos="' + k + '" aria-pressed="' + (k === setup.mos) + '"><b>' + m.emoji + ' ' + m.name + '</b><small>' + m.desc + '</small><small>✦ ' + m.perk + '</small></button>';
    }).join('');
    updateSetupPreview();
    updateDateNote();
    showScreen('scr-setup');
  }

  function updateSetupPreview() { $('#face-preview').innerHTML = charSVG('me'); }

  function updateDateNote() {
    var v = $('#in-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { $('#date-note').textContent = '전역 예정일: -'; return; }
    var tmp = G.newState({ start: v });
    $('#date-note').textContent = '전역 예정일: ' + G.fmtDate(tmp.end) + ' (' + (tmp.total + 1) + '일)';
  }

  function startGame() {
    var name = ($('#in-name').value || '').trim() || '나띨빵';
    var start = $('#in-date').value || G.todayStr();
    var paceEl = document.querySelector('input[name="pace"]:checked');
    state = G.newState({ name: name, start: start, mos: setup.mos, face: setup.face, pace: paceEl && paceEl.value === '3' ? 3 : 1 });
    meta.runs = (meta.runs || 0) + 1;
    lsSet(KEYS.meta, meta);
    save();
    busy = false;
    showScreen('scr-game');
    renderHUD();
    renderCard(true);
    snd('start');
    toast('입영을 환영한다, 훈련병 ' + state.name + '!', 2400);
  }

  /* ── HUD ─────────────────────────────── */
  function buildStats() {
    $('#stats').innerHTML = G.STATS.map(function (k) {
      var svg = A.statIcon(k);
      return '<div class="stat" data-k="' + k + '" title="' + ICON[k] + '"><i class="dot"></i>' +
        '<div class="stat-ic"><div class="ic-back">' + svg + '</div><div class="ic-front">' + svg + '</div></div>' +
        '<span class="stat-name">' + SHORT[k] + '</span></div>';
    }).join('');
  }

  function renderHUD() {
    if (!state) return;
    $('#hud-rank').innerHTML = A.rankInsignia(state.rank);
    $('#hud-name').textContent = G.RANKS[state.rank] + ' ' + state.name;
    $('#hud-date').textContent = G.dateOf(state) + ' · ' + G.SEASON_NAMES[state.season] + ' · ' + G.MOS[state.mos].name;
    $('#hud-dday').textContent = 'D-' + G.daysLeft(state);
    var pct = G.progress(state) * 100;
    $('#gauge-fill').style.width = pct.toFixed(2) + '%';
    $('#gauge-pct').textContent = pct.toFixed(1) + '%';
    G.STATS.forEach(function (k) {
      var el = document.querySelector('.stat[data-k="' + k + '"]');
      if (!el) return;
      var v = state.stats[k];
      el.style.setProperty('--v', v);
      el.classList.toggle('danger', v <= 15 || v >= 85);
      el.setAttribute('aria-label', ICON[k] + ' ' + v);
    });
    var bagN = 0; for (var id in state.items) bagN += state.items[id] || 0;
    $('#bag-badge').textContent = bagN;
    $('#leave-badge').textContent = state.leave + '일';
    var px = G.pxStatus(state);
    $('#px-badge').hidden = !px.ok;
    $('#dock-px').classList.toggle('off', !px.ok);
    $('#dock-leave').classList.toggle('off', !G.leaveStatus(state).ok);
  }

  function showPreview(side) {
    var dots = document.querySelectorAll('.stat .dot');
    dots.forEach(function (d) { d.classList.remove('on', 'big'); });
    if (!side || !state) return;
    var c = G.currentCard(state);
    var p = c[side].preview;
    G.STATS.forEach(function (k) {
      if (!p[k]) return;
      var d = document.querySelector('.stat[data-k="' + k + '"] .dot');
      d.classList.add('on'); if (p[k] === 'big') d.classList.add('big');
    });
  }

  function animateDeltas(deltas) {
    for (var k in deltas) {
      var v = deltas[k];
      if (!v) continue;
      var el = document.querySelector('.stat[data-k="' + k + '"]');
      if (!el) continue;
      var d = document.createElement('span');
      d.className = 'delta ' + (v > 0 ? 'up' : 'down');
      d.textContent = (v > 0 ? '+' : '') + v;
      el.appendChild(d);
      setTimeout(function (n) { return function () { n.remove(); }; }(d), 1150);
    }
  }

  /* ── 카드 ───────────────────────────── */
  function fitCard() {
    var zone = $('#card-zone'), card = $('#card');
    if (!zone || !card) return;
    var r = zone.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var ratio = 0.82;
    var w = Math.min(r.width, r.height * ratio, 400);
    var h = w / ratio;
    if (h > r.height) { h = r.height; w = h * ratio; }
    card.style.width = Math.floor(w) + 'px';
    card.style.height = Math.floor(h) + 'px';
  }

  function renderCard(enter) {
    if (!state || state.over) return;
    var c = G.currentCard(state);
    var nm = charName(c.who);
    $('#prompt').innerHTML = '<span class="who">' + esc(nm.name) + '</span><br>' + esc(c.text);
    var card = $('#card');
    card.className = 'card';
    card.style.transform = '';
    card.style.opacity = '';
    card.innerHTML = A.scene(c.bg || 'barracks', state.season) +
      '<div class="char-wrap">' + charSVG(c.who, c) + '</div>' +
      '<div class="card-label l' + (c.l.preview.mini ? ' mini' : '') + '">' + esc(c.l.t) + '</div>' +
      '<div class="card-label r' + (c.r.preview.mini ? ' mini' : '') + '">' + esc(c.r.t) + '</div>' +
      '<div class="nametape"><b>' + esc(nm.name) + '</b><span>' + esc(nm.role) + '</span></div>';
    $('#choice-l').textContent = c.l.t;
    $('#choice-r').textContent = c.r.t;
    document.querySelectorAll('.choice').forEach(function (b) { b.classList.remove('armed'); b.disabled = false; });
    armed = null;
    showPreview(null);
    if (enter) { void card.offsetWidth; card.classList.add('enter'); }
    fitCard();
  }

  function setCardPose(dx, dy) {
    var card = $('#card');
    card.style.transform = 'translate(' + dx + 'px,' + (dy || 0) + 'px) rotate(' + (dx * 0.06) + 'deg)';
    var side = dx < -14 ? 'l' : dx > 14 ? 'r' : null;
    var amt = Math.min(1, Math.abs(dx) / 70);
    card.querySelector('.card-label.l').style.opacity = side === 'l' ? amt : 0;
    card.querySelector('.card-label.r').style.opacity = side === 'r' ? amt : 0;
    return side;
  }

  function arm(side) {
    if (busy || !state || state.over) return;
    if (armed === side) { commit(side); return; }
    armed = side;
    document.querySelectorAll('.choice').forEach(function (b) { b.classList.toggle('armed', b.dataset.side === side); });
    var card = $('#card');
    card.classList.remove('enter'); card.classList.add('back');
    setCardPose(side === 'l' ? -46 : 46, 0);
    showPreview(side);
    snd('tap');
    toast('한 번 더 누르면 결정!', 1200);
  }

  function disarm() {
    armed = null;
    document.querySelectorAll('.choice').forEach(function (b) { b.classList.remove('armed'); });
  }

  function bindSwipe() {
    var card = $('#card');
    card.addEventListener('pointerdown', function (e) {
      if (busy || !state || state.over || drag) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (JY.Sound) JY.Sound.unlock();
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, side: null };
      card.classList.remove('back', 'enter');
      disarm();
      try { card.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
    });
    card.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x0;
      var side = setCardPose(drag.dx, (e.clientY - drag.y0) * 0.15);
      if (side !== drag.side) { drag.side = side; showPreview(side); }
    });
    function endDrag(e, cancel) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null;
      var th = Math.min(110, card.offsetWidth * 0.3);
      if (!cancel && Math.abs(d.dx) > th) { commit(d.dx < 0 ? 'l' : 'r'); return; }
      card.classList.add('back');
      setCardPose(0, 0);
      showPreview(null);
    }
    card.addEventListener('pointerup', function (e) { endDrag(e, false); });
    card.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); arm('l'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); arm('r'); }
    });
    document.querySelectorAll('.choice').forEach(function (b) {
      b.addEventListener('click', function () { arm(b.dataset.side); });
    });
    document.addEventListener('keydown', function (e) {
      if ($('#scr-game').hidden || !$('#modal').hidden || !$('#mini').hidden) return;
      if (!$('#result').hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#result').click(); return; }
      if (document.activeElement === card) return;
      if (e.key === 'ArrowLeft') arm('l');
      if (e.key === 'ArrowRight') arm('r');
    });
  }

  function commit(side) {
    if (busy || !state || state.over) return;
    busy = true;
    disarm();
    showPreview(null);
    snd('swipe');
    if (JY.buzz) JY.buzz(8);
    var card = $('#card');
    var w = window.innerWidth;
    card.classList.remove('back', 'enter');
    card.classList.add('fly');
    card.style.transform = 'translate(' + (side === 'l' ? -1.2 * w : 1.2 * w) + 'px, 60px) rotate(' + (side === 'l' ? -28 : 28) + 'deg)';
    card.style.opacity = '0';
    var res = G.choose(state, side);
    save();
    setTimeout(function () {
      if (!res) { busy = false; renderCard(true); return; }
      if (res.mini) runMini(res);
      else afterChoice(res);
    }, 280);
  }

  function runMini(res) {
    JY.Mini.start(res.mini, { stats: state.stats, mos: state.mos, face: function (w) { return charSVG(w); } }, function (tier) {
      var r2 = G.finishMini(state, tier);
      save();
      if (!r2) { busy = false; renderCard(true); return; }
      var merged = {
        say: [res.say, r2.say].filter(Boolean).join(' '),
        deltas: {}, events: (res.events || []).concat(r2.events || []), ending: r2.ending || res.ending
      };
      [res.deltas, r2.deltas].forEach(function (d) { for (var k in d) merged.deltas[k] = (merged.deltas[k] || 0) + d[k]; });
      afterChoice(merged);
    });
  }

  function afterChoice(res) {
    renderHUD();
    animateDeltas(res.deltas || {});
    var sum = 0, any = false;
    for (var k in res.deltas) { if (res.deltas[k]) any = true; sum += res.deltas[k]; }
    if (res.ending && !(JY.ENDINGS[res.ending] && JY.ENDINGS[res.ending].good)) snd('bad');
    else if (any) snd(sum >= 0 ? 'good' : 'bad');
    var has = res.say || any || (res.events && res.events.length);
    if (!has) { nextAfterResult(res); return; }
    showResult(res, function () { nextAfterResult(res); });
  }

  function eventLine(e) {
    switch (e.type) {
      case 'pay': return '💰 월급날! ' + won(e.n) + ' (적금 ' + won(e.save) + ' 자동 납입)';
      case 'promo': return '🎖️ ' + e.text;
      case 'promoFail': return '📉 ' + e.text;
      case 'season': return '🗓️ ' + e.text;
      case 'leave': return '🏖️ ' + e.text;
      case 'item': return '🎁 ' + (JY.ITEMS[e.id] ? JY.ITEMS[e.id].name : e.id) + ' ' + (e.n > 0 ? '+' : '') + e.n;
      case 'money': return (e.n > 0 ? '💰 ' : '💸 ') + (e.n > 0 ? '+' : '') + won(e.n);
      case 'save': return '🏦 적금 +' + won(e.n);
      case 'block': return '⛔ 휴가 통제 ' + e.n + '일';
      default: return e.text || '';
    }
  }

  function showResult(res, cb) {
    var box = $('#result');
    var chips = '';
    G.STATS.forEach(function (k) {
      var v = res.deltas && res.deltas[k];
      if (!v) return;
      chips += '<span class="chip ' + (v > 0 ? 'up' : 'down') + '">' + ICON[k] + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    });
    var evs = (res.events || []).map(function (e) { return '<div>' + esc(eventLine(e)) + '</div>'; }).join('');
    box.innerHTML = '<div class="note">' +
      (res.say ? '<p>' + esc(res.say) + '</p>' : '') +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      (evs ? '<div class="events">' + evs + '</div>' : '') +
      '<span class="tap-next">탭해서 계속 ▶</span></div>';
    box.hidden = false;
    var shownAt = Date.now();
    box.onclick = function () {
      if (Date.now() - shownAt < 350) return;
      box.onclick = null;
      box.hidden = true;
      cb();
    };
  }

  function nextAfterResult(res) {
    var promos = (res.events || []).filter(function (e) { return e.type === 'promo'; });
    function go() {
      if (state.over) { showEnding(); return; }
      if (state.pendingMini) { runMini({ mini: state.pendingMini.id, say: '', deltas: {}, events: [] }); return; }
      renderHUD();
      renderCard(true);
      busy = false;
    }
    if (promos.length) showPromo(promos[promos.length - 1], go);
    else go();
  }

  /* ── 모달 ───────────────────────────── */
  var modalClose = null;
  function openModal(html, bind, onClose) {
    var m = $('#modal'), box = $('#modal-box');
    box.innerHTML = html;
    m.hidden = false;
    modalClose = onClose || null;
    if (bind) bind(box);
  }
  function closeModal() {
    var m = $('#modal');
    if (m.hidden) return;
    m.hidden = true;
    $('#modal-box').innerHTML = '';
    var f = modalClose; modalClose = null;
    if (f) f();
  }

  function confetti() {
    var c = document.createElement('div');
    c.className = 'confetti';
    var cols = ['#e0b347', '#56662f', '#c4362b', '#f6f0dc', '#8fc6ea'];
    for (var i = 0; i < 40; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      p.style.animationDuration = (1.2 + Math.random() * 0.9) + 's';
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); }, 2600);
  }

  function showPromo(e, cb) {
    snd('promo');
    confetti();
    if (JY.buzz) JY.buzz([30, 40, 30]);
    openModal('<div class="promo-box"><div class="rank-big">' + A.rankInsignia(e.rank) + '</div>' +
      '<h3>' + G.RANKS[e.rank] + ' 진급!</h3><p class="sub">' + PROMO_TEXT[e.rank] + '</p>' +
      (e.leave ? '<p>🏖️ 휴가 +' + e.leave + '일 지급</p>' : '') +
      '<p class="sub">월급: ' + won(G.PAY[e.rank]) + '</p>' +
      '<div class="modal-actions"><button class="btn btn-primary" data-act="ok">충성!</button></div></div>',
    function (box) { box.querySelector('[data-act="ok"]').onclick = closeModal; }, cb);
  }

  function fxChips(fx) {
    return Object.keys(fx).map(function (k) {
      var v = fx[k];
      return '<span class="chip ' + (v > 0 ? 'up' : 'down') + '">' + ICON[k] + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    }).join('');
  }

  function openBag() {
    if (!state || busy) return;
    var sel = null;
    function html() {
      var ids = JY.ITEM_ORDER.filter(function (id) { return state.items[id] > 0; });
      var grid = ids.length ? '<div class="item-grid">' + ids.map(function (id) {
        var it = JY.ITEMS[id];
        return '<button class="item" data-id="' + id + '" aria-pressed="' + (sel === id) + '"><span class="count">×' + state.items[id] + '</span><i>' + it.icon + '</i><b>' + it.name + '</b></button>';
      }).join('') + '</div>' : '<p class="sub">가방이 비었다. PX에서 사 오자.</p>';
      var detail = '';
      if (sel && state.items[sel] > 0) {
        var it = JY.ITEMS[sel];
        detail = '<div class="item-detail"><p><b>' + it.icon + ' ' + it.name + '</b> — ' + it.desc + '</p><div class="chips">' + fxChips(it.fx) + '</div>' +
          '<button class="btn btn-primary btn-small" data-act="use">사용하기</button></div>';
      }
      return '<h3>가방</h3><p class="sub">아이템은 스탯을 5~95 사이에서만 움직인다. 위험할 때 쓰자.</p>' + grid + detail +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">닫기</button></div>';
    }
    function bind(box) {
      box.querySelectorAll('.item').forEach(function (b) { b.onclick = function () { sel = b.dataset.id; snd('tap'); box.innerHTML = html(); bind(box); }; });
      var u = box.querySelector('[data-act="use"]');
      if (u) u.onclick = function () {
        var r = G.useItem(state, sel);
        if (r) {
          save(); renderHUD(); animateDeltas(r.deltas);
          var moved = Object.keys(r.deltas).some(function (k) { return r.deltas[k]; });
          snd(moved ? 'good' : 'tap');
          toast(moved ? JY.ITEMS[sel].name + ' 사용!' : '이미 충분하다. 효과가 없었다.');
        }
        if (!(state.items[sel] > 0)) sel = null;
        box.innerHTML = html(); bind(box);
      };
      box.querySelector('[data-act="close"]').onclick = closeModal;
    }
    openModal(html(), bind);
  }

  function openPX() {
    if (!state || busy) return;
    var st = G.pxStatus(state);
    if (!st.ok) { toast(st.reason); return; }
    var bought = false;
    function html() {
      var list = JY.ITEM_ORDER.filter(function (id) { return JY.ITEMS[id].px !== false; });
      return '<h3>PX</h3><p class="sub">한 번 다녀오면 며칠 뒤에 다시 갈 수 있다.</p>' +
        '<div class="wallet"><span>현금 ' + won(state.money) + '</span><span>적금 ' + won(state.savings) + '</span></div>' +
        '<div class="item-grid">' + list.map(function (id) {
          var it = JY.ITEMS[id];
          var cant = state.money < it.price || (state.items[id] || 0) >= 9;
          return '<button class="item" data-id="' + id + '"' + (cant ? ' disabled' : '') + '><span class="count">×' + (state.items[id] || 0) + '</span><i>' + it.icon + '</i><b>' + it.name + '</b><small>' + won(it.price) + '</small><small>' + Object.keys(it.fx).map(function (k) { return SHORT[k] + (it.fx[k] > 0 ? '+' : '') + it.fx[k]; }).join(' ') + '</small></button>';
        }).join('') + '</div>' +
        '<div class="modal-actions"><button class="btn btn-primary" data-act="close">계산 끝, 나가기</button></div>';
    }
    function bind(box) {
      box.querySelectorAll('.item').forEach(function (b) {
        b.onclick = function () {
          if (G.buy(state, b.dataset.id)) { bought = true; snd('coin'); save(); renderHUD(); box.innerHTML = html(); bind(box); }
          else toast('돈이 부족하거나 가방이 꽉 찼다.');
        };
      });
      box.querySelector('[data-act="close"]').onclick = closeModal;
    }
    openModal(html(), bind, function () { G.closePX(state, bought); save(); renderHUD(); });
  }

  function openLeave() {
    if (!state || busy) return;
    var st = G.leaveStatus(state);
    var np = G.nextPromo(state);
    var head = '<h3>휴가 신청</h3><p class="sub">남은 휴가 ' + state.leave + '일 · 사용 ' + state.leaveUsed + '일' + (np ? ' · 다음 진급 ' + np.rank + ' (' + np.date + ')' : '') + '</p>';
    if (!st.ok) {
      openModal(head + '<p>' + esc(st.reason) + '</p><p class="sub">휴가는 진급할 때마다 지급되고, 특급전사·특등사수·대회 우승으로 포상휴가를 받을 수 있다. 남은 휴가가 전역까지 남은 날짜보다 많으면 말출(말년휴가) 후 그대로 전역!</p>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">닫기</button></div>',
      function (box) { box.querySelector('[data-act="close"]').onclick = closeModal; });
      return;
    }
    var n = Math.min(st.max, Math.max(1, Math.min(5, st.max)));
    function body() {
      var leaveEnd = G.dateOf(state, Math.min(state.total, state.day + n));
      var mal = n >= st.malchulAt;
      return head +
        '<div class="stepper"><button data-act="minus" aria-label="하루 줄이기">−</button><output id="leave-n">' + n + '일</output><button data-act="plus" aria-label="하루 늘리기">+</button></div>' +
        '<p class="leave-info">' + G.dateOf(state) + ' 출발 → ' + leaveEnd + (mal ? ' 전역' : ' 복귀') + '</p>' +
        (mal ? '<p class="malchul">🎉 말년휴가! 복귀 없이 그대로 전역한다!</p>' : '<p class="leave-info">휴가 중에는 멘탈·체력이 회복된다. 복귀 후 ' + 20 + '일은 다시 못 나간다.</p>') +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">취소</button><button class="btn btn-primary" data-act="go">' + (mal ? '말출 나가기' : '휴가 출발') + '</button></div>';
    }
    function bind(box) {
      box.querySelector('[data-act="minus"]').onclick = function () { n = Math.max(1, n - 1); snd('tick'); box.innerHTML = body(); bind(box); };
      box.querySelector('[data-act="plus"]').onclick = function () { n = Math.min(st.max, n + 1); snd('tick'); box.innerHTML = body(); bind(box); };
      box.querySelector('[data-act="close"]').onclick = closeModal;
      box.querySelector('[data-act="go"]').onclick = function () {
        var res = G.takeLeave(state, n);
        closeModal();
        if (!res) return;
        save();
        renderHUD();
        animateDeltas(res.deltas);
        showLeaveStory(res);
      };
    }
    openModal(body(), bind);
  }

  function showLeaveStory(res) {
    snd('win');
    var lines = (res.story || ['부대 밖 공기는 달았다.']).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    var evs = (res.events || []).map(function (e) { return '<li>' + esc(eventLine(e)) + '</li>'; }).join('');
    var malchul = state.over;
    openModal('<h3>' + (malchul ? '말년휴가 출발!' : '휴가 일기') + '</h3>' +
      (malchul ? '<p>부대 정문을 나선다. 다시 돌아올 일은… 짐 가지러 올 때뿐이다.</p>' : '<p class="sub">' + G.dateOf(state) + ' 복귀</p><ul class="story">' + lines + '</ul>') +
      (evs ? '<ul class="story">' + evs + '</ul>' : '') +
      '<div class="modal-actions"><button class="btn btn-primary" data-act="ok">' + (malchul ? '전역 신고하러 가기' : '부대 복귀…') + '</button></div>',
    function (box) { box.querySelector('[data-act="ok"]').onclick = closeModal; },
    function () {
      var promos = (res.events || []).filter(function (e) { return e.type === 'promo'; });
      function go() { if (state.over) showEnding(); else { renderHUD(); renderCard(true); } }
      if (promos.length && !state.over) showPromo(promos[promos.length - 1], go); else go();
    });
  }

  function openMenu() {
    if (!state) return;
    var np = G.nextPromo(state);
    var confirmReset = false;
    function html() {
      return '<h3>메뉴</h3>' +
        '<div class="wallet"><span>현금 ' + won(state.money) + '</span><span>적금 ' + won(state.savings) + '</span></div>' +
        '<p class="sub">입대 ' + G.dateOf(state, 0) + ' · 전역 ' + G.fmtDate(state.end) + (np ? ' · 다음 진급 ' + np.rank + ' ' + np.date : '') + '</p>' +
        '<div class="toggle-row"><span>효과음</span><button class="btn btn-small" data-act="sound">' + (settings.sound ? '켜짐' : '꺼짐') + '</button></div>' +
        '<div class="toggle-row"><span>진동</span><button class="btn btn-small" data-act="vibe">' + (settings.vibe ? '켜짐' : '꺼짐') + '</button></div>' +
        '<div class="toggle-row"><span>게임 방법</span><button class="btn btn-small" data-act="help">보기</button></div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" data-act="reset">' + (confirmReset ? '정말? 한 번 더 누르면 기록 삭제' : '처음부터 다시 입대') + '</button>' +
        '<button class="btn btn-ghost" data-act="title">타이틀로 (자동 저장)</button>' +
        '<button class="btn btn-primary" data-act="close">계속하기</button></div>';
    }
    function bind(box) {
      box.querySelector('[data-act="sound"]').onclick = function () { settings.sound = !settings.sound; applySettings(); box.innerHTML = html(); bind(box); };
      box.querySelector('[data-act="vibe"]').onclick = function () { settings.vibe = !settings.vibe; applySettings(); box.innerHTML = html(); bind(box); };
      box.querySelector('[data-act="help"]').onclick = function () { closeModal(); openHelp(); };
      box.querySelector('[data-act="reset"]').onclick = function () {
        if (!confirmReset) { confirmReset = true; box.innerHTML = html(); bind(box); return; }
        lsDel(KEYS.save); state = null; closeModal(); renderSetup();
      };
      box.querySelector('[data-act="title"]').onclick = function () { save(); closeModal(); renderTitle(); };
      box.querySelector('[data-act="close"]').onclick = closeModal;
    }
    openModal(html(), bind);
  }

  function openHelp() {
    openModal('<h3>게임 방법</h3>' +
      '<ul class="story">' +
      '<li>카드를 왼쪽·오른쪽으로 넘기거나 아래 버튼을 두 번 눌러 선택한다.</li>' +
      '<li>카드를 끌면 위쪽 스탯에 점이 뜬다. 점이 클수록 크게 변한다(오를지 내릴지는 비밀).</li>' +
      '<li>체력·멘탈·간부 신뢰·전우애 중 하나라도 0이나 100이 되면 전역 실패. 너무 잘해도 말뚝 박힌다.</li>' +
      '<li>매월 10일은 월급날. PX에서 산 아이템으로 위험한 스탯을 조절하자.</li>' +
      '<li>휴가는 진급할 때마다, 그리고 특급전사·특등사수 같은 포상으로 받는다.</li>' +
      '<li>남은 휴가가 전역까지 남은 날보다 많으면 말년휴가를 나가 그대로 전역할 수 있다.</li>' +
      '<li>간부 신뢰가 너무 낮으면 진급 심사에서 누락된다(2026년부터 자동 진급 폐지).</li>' +
      '</ul><div class="modal-actions"><button class="btn btn-primary" data-act="close">알겠습니다!</button></div>',
    function (box) { box.querySelector('[data-act="close"]').onclick = closeModal; });
  }

  /* ── 엔딩 ───────────────────────────── */
  function showEnding() {
    busy = false;
    var o = state.over;
    var E = JY.ENDINGS[o.id] || JY.ENDINGS.normal;
    meta.endings = meta.endings || {};
    o.list.forEach(function (id) { meta.endings[id] = (meta.endings[id] || 0) + 1; });
    meta.best = Math.max(meta.best || 0, o.day);
    if (o.good) meta.discharges = (meta.discharges || 0) + 1;
    lsSet(KEYS.meta, meta);
    lsDel(KEYS.save);
    var b = G.bank(state);
    var art = A.scene(E.bg, state.season) + charSVG(E.who, { mood: E.mood, meMood: E.mood, catCap: true });
    var also = o.list.slice(1).filter(function (id) { return id !== 'normal'; }).map(function (id) { return JY.ENDINGS[id].title; });
    var log = state.log.slice(-7).map(function (l) { return '<li>' + G.dateOf(state, l.day) + ' · ' + esc(l.text) + '</li>'; }).join('');
    var served = o.day + (o.good ? 1 : 0);
    $('#cert').className = 'cert ' + (o.good ? 'good' : 'bad');
    $('#cert').innerHTML =
      '<div class="cert-head"><small>' + (o.good ? '띨빵사단 인사과' : '띨빵사단 중대 행정반') + '</small><h2>' + (o.good ? '전 역 증' : '전역 보류 통지서') + '</h2></div>' +
      '<div class="cert-art">' + art + '</div>' +
      '<h3 class="ending-title">' + esc(E.title) + '</h3>' +
      '<p class="ending-text">' + esc(E.text) + '</p>' +
      (also.length ? '<p class="also">추가 달성: ' + also.map(esc).join(' · ') + '</p>' : '') +
      '<dl>' +
      '<dt>성명</dt><dd>' + G.RANKS[state.rank] + ' ' + esc(state.name) + '</dd>' +
      '<dt>보직</dt><dd>' + G.MOS[state.mos].name + '</dd>' +
      '<dt>복무 기간</dt><dd>' + G.dateOf(state, 0) + ' ~ ' + (o.good ? G.fmtDate(state.end) : G.dateOf(state) + ' (중단)') + '</dd>' +
      '<dt>복무 일수</dt><dd>' + served + '일 / ' + (state.total + 1) + '일 (' + Math.round(served / (state.total + 1) * 100) + '%)</dd>' +
      '<dt>넘긴 카드</dt><dd>' + state.cards + '장 · 미니게임 ' + state.minis.played + '회</dd>' +
      '<dt>사용한 휴가</dt><dd>' + state.leaveUsed + '일</dd>' +
      '<dt>' + (o.good ? '전역 통장' : '통장 잔고') + '</dt><dd>' + won(b.total) + (o.good ? ' (적금 매칭 포함)' : '') + '</dd>' +
      '</dl>' +
      (log ? '<ul class="log">' + log + '</ul>' : '') +
      '<div class="seal">' + (o.good ? '전역' : '보류') + '</div>';
    showScreen('scr-end');
    $('#scr-end').scrollTop = 0;
    if (o.good) { snd('win'); confetti(); } else { snd('fail'); if (JY.buzz) JY.buzz([80, 60, 80, 60, 200]); }
    state = null;
  }

  /* ── 도감 ───────────────────────────── */
  function renderAlbum(back) {
    var got = meta.endings || {};
    var ids = JY.ENDING_ORDER;
    var n = ids.filter(function (id) { return got[id]; }).length;
    $('#album-progress').textContent = n + '/' + ids.length;
    $('#album-grid').innerHTML = ids.map(function (id) {
      var E = JY.ENDINGS[id];
      if (!got[id]) {
        return '<div class="album-card locked ' + (E.good ? 'good' : 'bad') + '"><div class="thumb">?</div><b>' + (E.good ? '전역 엔딩' : '실패 엔딩') + '</b><small>힌트: ' + HINTS[id] + '</small></div>';
      }
      return '<div class="album-card ' + (E.good ? 'good' : 'bad') + '"><div class="thumb">' + A.scene(E.bg, 'spring') + charSVG(E.who, { mood: E.mood, meMood: E.mood, catCap: true, rank: E.good ? 4 : 2 }) + '</div><b>' + esc(E.title) + '</b><small>' + got[id] + '회 달성</small></div>';
    }).join('');
    $('#album-stats').textContent = '입대 ' + (meta.runs || 0) + '회 · 전역 ' + (meta.discharges || 0) + '회 · 최장 복무 ' + (meta.best || 0) + '일';
    $('#btn-album-back').onclick = back || renderTitle;
    showScreen('scr-album');
  }

  /* ── 설정 ───────────────────────────── */
  function applySettings() {
    lsSet(KEYS.settings, settings);
    JY.settings = settings;
    if (JY.Sound) JY.Sound.setEnabled(settings.sound);
  }

  /* ── 시작 ───────────────────────────── */
  function continueGame(s) {
    state = s;
    busy = false;
    showScreen('scr-game');
    renderHUD();
    if (state.pendingMini) { busy = true; runMini({ mini: state.pendingMini.id, say: '', deltas: {}, events: [] }); return; }
    renderCard(true);
  }

  function init(data) {
    meta = lsGet(KEYS.meta, null) || { endings: {}, runs: 0, discharges: 0, best: 0 };
    meta.endings = meta.endings || {};
    settings = lsGet(KEYS.settings, null) || { sound: true, vibe: true };
    applySettings();
    buildStats();
    bindSwipe();

    $('#btn-new').onclick = function () { if (JY.Sound) JY.Sound.unlock(); snd('tap'); renderSetup(); };
    $('#btn-continue').onclick = function () { if (JY.Sound) JY.Sound.unlock(); var s = loadSave(); if (s) continueGame(s); };
    $('#btn-album').onclick = function () { renderAlbum(renderTitle); };
    $('#btn-face').onclick = function () { setup.face = randomFace(); snd('tap'); updateSetupPreview(); };
    $('#in-name').addEventListener('input', updateSetupPreview);
    $('#in-date').addEventListener('change', updateDateNote);
    $('#in-date').addEventListener('input', updateDateNote);
    $('#mos-grid').addEventListener('click', function (e) {
      var b = e.target.closest('.mos'); if (!b) return;
      setup.mos = b.dataset.mos; snd('tap');
      document.querySelectorAll('.mos').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
    $('#btn-setup-back').onclick = renderTitle;
    $('#setup-form').addEventListener('submit', function (e) { e.preventDefault(); if (JY.Sound) JY.Sound.unlock(); startGame(); });

    $('#dock-bag').onclick = openBag;
    $('#dock-px').onclick = openPX;
    $('#dock-leave').onclick = openLeave;
    $('#dock-menu').onclick = openMenu;
    $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    $('#btn-reenlist').onclick = function () { renderSetup(); };
    $('#btn-end-album').onclick = function () { renderAlbum(function () { showScreen('scr-end'); }); };
    $('#btn-end-title').onclick = renderTitle;

    window.addEventListener('resize', fitCard);
    window.addEventListener('orientationchange', function () { setTimeout(fitCard, 200); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

    var restored = data && data.save && data.save.v === 1 && !data.save.over ? data.save : null;
    if (restored) continueGame(restored);
    else renderTitle();

    try {
      if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
        window.claude.hot.snapshot(function () { return { save: state && !state.over ? state : null }; });
      }
    } catch (e) { /* 뷰어 밖 */ }

    try {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname)) {
        navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 캐시 실패는 무시 */ });
      }
    } catch (e) { /* 무시 */ }
  }

  JY.UI = { init: init, charSVG: charSVG, _state: function () { return state; } };

  var hot = window.claude && window.claude.hot;
  function boot() {
    if (hot && hot.ready) hot.ready(init);
    else init((hot && hot.data) || {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.JY = window.JY || {});
