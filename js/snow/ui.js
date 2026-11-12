/* 제설각 — 화면 흐름 (v11): 타이틀 → 생활관 로비 → 제설 비상 브리핑 → 작전(05:30~08:00) → 검열 결과(★) → 진급 → 로비
 * v11: 한 손가락 조작 · 빛나는 원 위에 서면 저절로 · 화면 위 '지금 할 일' 한 줄 · 등에 쌓이는 눈 블록 · 폭풍 제설·폭설 경보 같은 반전.
 * 보급·인원·PX·공중전화·체력단련은 로비에서만. 작전 중엔 눈과 사람에만 집중한다. */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim, A = JY.SnowAct, M = JY.SnowMeta, V2 = JY.SnowView, V3 = JY.SnowView3D, X = JY.SnowSfx;
  var V = V3 && V3.supported() && !/[?&]2d/.test(location.search) ? V3 : V2;
  var KEY = 'jeseol-v10', PREV_KEY = 'jeseol-v8', OLD_KEYS = ['jeseol-v1'];
  try { OLD_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* 저장소 없음 */ }
  var save = load(), tab = 'tool', sayTimer = 0, toastTimer = 0, lastSave = 0, hud = {}, rankSeen = G.rankOf(save), dirty = false;

  function $(id) { return document.getElementById(id); }
  // v10 저장이 없으면 v8 저장을 읽어서 옮긴다 (계급은 쌓은 초코파이로 이어 준다). v8 저장은 그대로 둔다
  function load() {
    try {
      var raw = localStorage.getItem(KEY) || localStorage.getItem(PREV_KEY);
      return G.migrate(raw ? JSON.parse(raw) : null);
    } catch (e) { return G.newSave(); }
  }
  function persist() {
    var w = V.world && V.world();
    if (w && !w.demo && V.mode && V.mode() !== 'demo') G.serialize(w);
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 */ }
    lastSave = Date.now();
  }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  // 작전 HUD처럼 좁은 곳: 10만부터 '12.3만', 1억부터 '1.2억'
  function short(n) { n = Math.floor(n); return n >= 1e8 ? (n / 1e8).toFixed(n >= 1e9 ? 0 : 1) + '억' : n >= 1e5 ? (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + '만' : fmt(n); }
  // 받침 있으면 a(을·은·이), 없으면 b(를·는·가)
  function josa(w, a, b) { var c = String(w).charCodeAt(String(w).length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pie() { return '<i class="pie" aria-hidden="true"></i>'; }
  function dia() { return '<i class="dia" aria-hidden="true"></i>'; }
  function haengFace() { return JY.art && JY.CHARS ? JY.art.character(JY.CHARS.haeng.spec, { mouth: 'shout' }) : ''; }
  function insignia(r) { return JY.art ? JY.art.rankInsignia(r + 1) : ''; }

  function show(id) {
    ['splash', 'title', 'shop'].forEach(function (s) { $(s).hidden = s !== id; });
    $('hud').hidden = id !== 'play';
    $('h-shop').hidden = true;   // v10: 보급은 생활관에서만 (작전 중 장비는 행보관에게 직접 요청)
    ['acts', 'side'].forEach(function (k) { $(k).hidden = id !== 'play' || !A; });
    if (id !== 'play') { $('xhair').hidden = true; $('sub').hidden = true; } else fpLayout();
    if (id === 'title') $('say').hidden = true;
    $('stack').classList.toggle('low', id === 'shop');
    if (id !== 'play') {
      $('stack').style.top = ''; document.body.classList.remove('saluting');
      $('hint').hidden = true;
      ['fever', 'surge', 'combo', 'chip', 'banner', 'salute'].forEach(function (k) { $(k).hidden = true; });
      document.body.classList.remove('fever', 'surge'); hudA.fv = hudA.sg = false; comboShown = 0;
      $('coins').innerHTML = '';
    }
  }

  /* ── 행보관 말풍선·알림 ── */
  function say(textOrKey, ms) {
    var L = S.LINES[textOrKey], text = L ? pick(L) : textOrKey;
    if (!text) return;
    $('say-text').textContent = text;
    var box = $('say'); box.hidden = false; box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
    if (X) X.pop();
    clearTimeout(sayTimer); sayTimer = setTimeout(function () { box.hidden = true; }, ms || 2800);
  }
  function toast(html) {
    var t = $('toast'); t.innerHTML = html; t.hidden = false; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 1600);
  }
  function modal(html, onClick) {
    var m = $('modal'), b = $('modal-box');
    b.innerHTML = html; m.hidden = false; b.scrollTop = 0;   // 긴 창(검열 결과)은 위(★)부터
    b.onclick = function (e) { var el = e.target.closest('[data-m]'); if (!el) return; var k = el.getAttribute('data-m'); m.hidden = true; if (onClick) onClick(k); };
  }
  var chipTimer = 0, chipPrio = 0, chipAt = 0, PRIO = { bad: 3, warn: 2, good: 1 };
  // 중요한 알림(위험·경고)은 1.5초 동안 덜 중요한 알림에 덮이지 않는다
  function chip(text, cls) {
    var pr = PRIO[cls] || 0, now = Date.now(), c = $('chip');
    if (!c.hidden && pr < chipPrio && now - chipAt < 1500) return;
    chipPrio = pr; chipAt = now;
    c.textContent = text; c.className = cls || ''; c.hidden = false;
    clearTimeout(chipTimer); chipTimer = setTimeout(function () { c.hidden = true; }, 2600);
  }
  function banner(big, small, ms) {
    var bn = $('banner');
    bn.innerHTML = '<b>' + esc(big) + '</b>' + (small ? '<span>' + esc(small) + '</span>' : '');
    bn.hidden = false; bn.classList.remove('in'); void bn.offsetWidth; bn.classList.add('in');
    setTimeout(function () { bn.hidden = true; }, ms || 2200);
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 무시 */ } }
  function flash() { var f = $('flash'); f.hidden = false; f.classList.remove('in'); void f.offsetWidth; f.classList.add('in'); setTimeout(function () { f.hidden = true; }, 500); }
  function splat() {
    var sp = $('splat'), x = 15 + Math.random() * 50, y = 25 + Math.random() * 35;
    sp.style.left = x + '%'; sp.style.top = y + '%'; sp.hidden = false; sp.classList.remove('in'); void sp.offsetWidth; sp.classList.add('in');
    setTimeout(function () { sp.hidden = true; }, 2600);
  }

  /* ── 생활관 (저녁 개인정비 시간): 계급·근무평정·포상휴가·지난 작전 + 출동 / 보급 / PX / 공중전화 / 체력단련 ── */
  function started() { return !!(save.stats.ops || save.snow || save.discharges || save.day > 1); }
  function midOp() { return !!(save.snow && save.dayT > 0 && save.op && save.op.day === save.day); }
  function title() {
    show('title');
    if (V.lobby) V.lobby(save); else V.demo(save);
    var on = started(), mid = midOp();
    $('t-start-b').textContent = !on ? '전입 신고' : mid ? '작전 이어하기' : save.exam ? '진급 심사 출동' : '제설 출동';
    $('t-start-s').textContent = !on ? '이병 · 싸리비 하나로 시작' : mid ? G.clockText(G.clockOf(save.dayT)) + '부터 계속' : save.day + '일차 · 05:30 제설 비상';
    $('t-start').classList.toggle('exam', !!save.exam && !mid);
    document.body.classList.toggle('fresh', !on);
    renderHub();
  }
  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.2 6.6.6-5 4.5 1.5 6.6L12 16.6 6 19.9l1.5-6.6-5-4.5 6.6-.6z" fill="#ffd24a" stroke="#a87a12" stroke-width="1.2"/></svg>';
  // 로비: 왼쪽 위 내 카드(얼굴·계급·★ 막대), 아래 진급 길 + 소식 3줄, 오른쪽 생활관 버튼 배지
  function renderHub() {
    var r = G.rankOf(save), nr = G.nextRank(save), m = save.merit || 0, R0 = S.RANKS[r], on = started();
    var lo = save.lastOp, wx = G.weatherFor(save), base = R0.merit, top = nr ? nr.merit : S.DISCHARGE_MERIT;
    var prog = Math.max(0, Math.min(1, (m - base) / Math.max(1, top - base)));
    $('hub-card').innerHTML =
      '<div class="lc-face">' + (JY.art && M ? JY.art.character(M.lookSpec(save)) : '') + '</div>' +
      '<div class="lc-body"><b class="lc-name"><span class="ins">' + insignia(r) + '</span><span>' + R0.name + ' ' + esc(save.look.name || '김제설') + '</span></b>' +
      '<small class="lc-role">' + esc(R0.role.split(' — ')[0]) + ' · ' + save.day + '일차 · 분대원 ' + G.crewCount(save) + '명</small>' +
      '<div class="lc-bar' + (save.exam ? ' exam' : '') + '"><i style="width:' + Math.round(prog * 100) + '%"></i><span>' + (save.exam ? '진급 심사!' : '★' + m + ' / ' + top) + '</span></div></div>';
    $('lb-bank').textContent = save.bank >= 1e7 ? short(save.bank) : fmt(save.bank); $('lb-dia').textContent = fmt(save.dia);
    var steps = S.RANKS.map(function (R, i) { return { name: R.name, need: R.merit, i: i }; }).concat([{ name: '전역', need: S.DISCHARGE_MERIT, i: S.RANKS.length }]);
    var road = '<ol class="road">' + steps.map(function (s) {
      var cls = s.i < r ? 'past' : s.i === r ? 'now' : s.i === r + 1 ? 'next' + (save.exam ? ' exam' : '') : '';
      return '<li class="' + cls + '"><i>' + (s.i < S.RANKS.length ? insignia(s.i) : STAR_SVG) + '</i><b>' + s.name + '</b><small>' + (s.i === r ? '지금' : s.i === r + 1 && save.exam ? '심사!' : '★' + s.need) + '</small></li>';
    }).join('') + '</ol>';
    var nextZone = S.ZONES.filter(function (Z) { return !save.zones[Z.id]; })[0], news = [];
    if (!on) news.push('<li class="hl">끌어서 걷고, 눈을 <b>등에 쌓아</b> 집하장에 붓는다</li>', '<li>★이 쌓이면 <b>진급</b> — 계급이 오를수록 편해진다</li>');
    if (G.canDischarge(save)) news.push('<li class="hl" data-hub="dis">전역할 수 있다! <b>전역 신고 ›</b></li>');
    if (save.exam && nr) news.push('<li class="exam">다음 작전 = <b>' + nr.name + ' 진급 심사</b> · ★★ 이상이면 진급</li>');
    if (lo) news.push('<li>지난 작전 <b class="st">' + stars(lo.stars) + '</b>' + (lo.exam ? (lo.pass ? ' · 심사 합격' : ' · 심사 불합격') : '') + '</li>');
    if (on) news.push('<li>내일 새벽 <b>' + S.WEATHER[wx.id].name + '</b>' + (wx.inspect ? ' · <b class="red">사단장님 순시</b>' : '') + '</li>');
    if (nextZone && on) news.push('<li>★' + nextZone.need + '이면 <b>' + esc(nextZone.name) + '</b>도 맡는다</li>');
    $('hub').innerHTML = road + '<ul class="news">' + news.slice(0, 3).join('') + '</ul>';
    var any = G.offers(save), n = 0;
    ['tool', 'crew', 'factory', 'perk'].forEach(function (k) { (any[k] || []).forEach(function (o) { if (o.ok) n++; }); });
    $('hub-shop-n').hidden = !n; $('hub-shop-n').textContent = n;
    $('hub-phone-n').hidden = !on || save.daily.call === save.day;
    $('hub-leave-n').hidden = save.dia < S.LEAVE.cost;
    $('hub-grid').hidden = !on;
  }
  function hubClick(e) {
    var b = e.target.closest('[data-hub]'); if (!b) return;
    var k = b.getAttribute('data-hub');
    if (X) { X.unlock(); X.pop(); }
    if (k === 'shop') { tab = 'tool'; openShop(); }
    else if (k === 'px') openPX();
    else if (k === 'phone') phoneCall();
    else if (k === 'pull') pullUp();
    else if (k === 'leave') { if (save.dia >= S.LEAVE.cost) goLeave(); else toast('포상휴가는 상점 ' + S.LEAVE.cost + '개 (지금 ' + save.dia + '개) · 작전 ★★★·칼경례로 모은다'); }
    else if (k === 'help') help();
    else if (k === 'medal' || k === 'story' || k === 'look' || k === 'dis') { tab = k; openShop(); }
    else if (k === 'settings') settings();
  }
  // 설정: 소리·진동·작전 시점·교범·전역·처음부터
  var CAM_NAME = { near: '위에서 (추천)', far: '멀리서', fp: '1인칭' };
  function settings() {
    function render() {
      modal('<div class="m-rank set"><p class="kicker">설정</p><h3>설정</h3><div class="set-list">' +
        '<button data-set="sound"><span>소리</span><b>' + (X && X.muted() ? '끔' : '켬') + '</b></button>' +
        '<button data-set="haptic"><span>진동</span><b>' + (JY.snowHaptic ? '켬' : '끔') + '</b></button>' +
        (V.toggleCam ? '<button data-set="cam"><span>작전 시점</span><b>' + (CAM_NAME[V.camMode()] || '') + '</b></button>' : '') +
        '<button data-set="help"><span>제설 교범 다시 보기</span><b>›</b></button>' +
        (G.rankOf(save) >= 3 || save.discharges ? '<button data-set="dis"><span>전역 신고</span><b>›</b></button>' : '') +
        '<button data-set="reset" id="t-reset" class="danger"><span>처음부터 다시</span><b>›</b></button>' +
        '</div><button class="btn big" data-m="close">닫기</button></div>');
      var b = $('modal-box'), base = b.onclick;
      b.onclick = function (e) {
        var s = e.target.closest('[data-set]'); if (!s) return base(e);
        var k = s.getAttribute('data-set');
        if (k === 'sound') { if (X) { X.setMuted(!X.muted()); if (!X.muted()) { X.unlock(); X.pop(); } } render(); }
        else if (k === 'haptic') { JY.snowHaptic = !JY.snowHaptic; try { localStorage.setItem('jeseol-haptic', JY.snowHaptic ? '1' : '0'); } catch (er) { /* 무시 */ } if (JY.snowHaptic) vibrate(30); render(); }
        else if (k === 'cam') { V.toggleCam(); camLabel(); render(); }
        else { $('modal').hidden = true; if (k === 'help') help(); else if (k === 'dis') { tab = 'dis'; openShop(); } else if (k === 'reset') resetAll(); }
      };
    }
    render();
  }
  // 제설 교범: 처음 출동 전에 4장. 무엇을 하고(눈을 쌓아 붓는다), 어떻게 하고(끌기·원 위에 서기), 왜 하는지(★→진급)
  var HELP = [
    { t: '끌어서 걷는다', s: '화면 <b>아무 데나</b> 손가락을 대고 끌면 그쪽으로 걷는다. 빗자루·넉가래는 <b>알아서</b> 민다.', art: 'drag' },
    { t: '등에 쌓고 → 집하장에 붓는다', s: '치운 눈은 <b>등에 블록으로</b> 쌓인다. 꽉 차면 <b>노란 집하장</b>에 들어가기만 하면 와르르 — 그게 초코파이.', art: 'stack' },
    { t: '빛나는 원 위에 서 있기', s: '<b>보급 원</b>에 서면 다음 장비, <b>보고 원</b>에 서면 작전 끝. 뭘 할지 모르겠으면 화면 위 한 줄과 <b>노란 화살표</b>.', art: 'pad' },
    { t: '마감 전에 끝내면 ★', s: '지시서 구역을 시각 안에 치우면 ★. ★이 쌓이면 <b>진급</b>, 계급이 오르면 후임·장비·제설차가 대신 해 준다.', art: 'star' }
  ];
  var HELP_ART = {
    drag: '<svg viewBox="0 0 200 120"><rect x="60" y="6" width="80" height="108" rx="12" fill="#1d2f4d" stroke="#9fb6cd" stroke-width="3"/><rect x="67" y="16" width="66" height="88" rx="4" fill="#e9f1f8"/><path d="M78 84 q22 -30 44 -42" stroke="#ffd24a" stroke-width="4" fill="none" stroke-dasharray="6 5"/><path d="M122 42 l-12 0 l8 -9z" fill="#ffd24a"/><circle cx="78" cy="84" r="9" fill="rgba(255,210,74,.45)" stroke="#ffd24a" stroke-width="2"/><path d="M76 96 c-2-10 0-18 6-18 4 0 5 4 5 8 v-12 c0-3 2-5 4-5s4 2 4 5v14 c0-2 2-4 4-4s4 2 4 5v10 c0 8-6 14-14 14h-4c-8 0-12-6-13-17z" fill="#f6c79c" stroke="#23281e" stroke-width="2"/><circle cx="118" cy="52" r="7" fill="#5b6a3a"/><circle cx="118" cy="45" r="5" fill="#f6c79c"/></svg>',
    stack: '<svg viewBox="0 0 200 120"><ellipse cx="150" cy="100" rx="36" ry="12" fill="#ffd24a" opacity=".55"/><path d="M126 98 q24 -40 48 0z" fill="#f4f8fc" stroke="#9fb6cd" stroke-width="2"/><g transform="translate(52 0)"><rect x="-14" y="60" width="28" height="36" rx="8" fill="#5b6a3a" stroke="#23281e" stroke-width="2"/><circle cx="0" cy="50" r="11" fill="#f6c79c" stroke="#23281e" stroke-width="2"/><path d="M-11 46 q11 -14 22 0z" fill="#4d5b31"/>' + [0, 1, 2, 3, 4].map(function (i) { return '<rect x="-28" y="' + (84 - i * 11) + '" width="16" height="10" rx="2" fill="#fbfdff" stroke="#9fb6cd" stroke-width="1.5"/>'; }).join('') + '</g><path d="M78 60 q34 -26 62 6" stroke="#ffd24a" stroke-width="4" fill="none" stroke-dasharray="6 5"/>' + [0, 1, 2].map(function (i) { return '<rect x="' + (96 + i * 14) + '" y="' + (40 + i * 4) + '" width="12" height="8" rx="2" fill="#fbfdff" stroke="#9fb6cd" stroke-width="1.2" transform="rotate(' + (i * 18 - 10) + ' ' + (102 + i * 14) + ' ' + (44 + i * 4) + ')"/>'; }).join('') + '<text x="150" y="30" text-anchor="middle" font-size="18" fill="#b8861b" font-family="Black Han Sans,sans-serif">+120</text></svg>',
    pad: '<svg viewBox="0 0 200 120"><ellipse cx="100" cy="88" rx="62" ry="22" fill="rgba(255,210,74,.35)" stroke="#ffd24a" stroke-width="4"/><path d="M38 88 a62 22 0 0 1 124 0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="86" y="50" width="28" height="34" rx="8" fill="#5b6a3a" stroke="#23281e" stroke-width="2"/><circle cx="100" cy="40" r="11" fill="#f6c79c" stroke="#23281e" stroke-width="2"/><path d="M89 36 q11 -14 22 0z" fill="#4d5b31"/><rect x="58" y="4" width="84" height="22" rx="11" fill="#16233a"/><text x="100" y="20" text-anchor="middle" font-size="13" fill="#ffd24a" font-family="Jua,sans-serif">보급 · 넉가래</text></svg>',
    star: '<svg viewBox="0 0 200 120">' + [0, 1, 2].map(function (i) { return '<g transform="translate(' + (52 + i * 48) + ' ' + (i === 1 ? 44 : 54) + ') scale(' + (i === 1 ? 1.5 : 1.2) + ')"><path d="M0 -16l4.7 9.6 10.5 1.2-7.8 7.2 2.2 10.4L0 7.2l-9.6 5.2 2.2-10.4-7.8-7.2 10.5-1.2z" fill="#ffd24a" stroke="#a87a12" stroke-width="1.6"/></g>'; }).join('') + '<path d="M70 96 l30 -12 30 12 M70 108 l30 -12 30 12" stroke="#c8402e" stroke-width="6" fill="none" stroke-linejoin="round"/></svg>'
  };
  function help(done) {
    var i = 0;
    function render() {
      var h = HELP[i], last = i === HELP.length - 1;
      modal('<div class="m-help"><p class="kicker">제설 교범 ' + (i + 1) + ' / ' + HELP.length + '</p><div class="help-art">' + HELP_ART[h.art] + '</div><h3>' + h.t + '</h3><p>' + h.s + '</p>' +
        '<div class="dots">' + HELP.map(function (_, j) { return '<i class="' + (j === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="res-btns"><button class="btn ghost" data-h="' + (i ? 'prev' : 'skip') + '">' + (i ? '이전' : '건너뛰기') + '</button><button class="btn big" data-h="next">' + (last ? (done ? '알겠다! 출동' : '알겠다') : '다음') + '</button></div></div>');
      $('modal-box').onclick = function (e) {
        var b = e.target.closest('[data-h]'); if (!b) return;
        var k = b.getAttribute('data-h'); if (X) X.pop();
        if (k === 'next' && !last) { i++; render(); return; }
        if (k === 'prev') { i--; render(); return; }
        $('modal').hidden = true; save.seen.help = true; persistRaw(); if (done) done();
      };
    }
    render();
  }

  /* ── 제설 비상 브리핑: 누가 지시하나(계급마다), 날씨, 작업 지시서(마감 시각), 특이사항, 상병부터 조원 배치 ── */
  function startOp() {
    if (X) X.unlock();
    if (!save.seen.help) { help(startOp); return; }   // v11: 처음 한 번은 교범 4장
    if (!started() && !save.story.prologue) { play(false); return; }   // 첫 전입: 프롤로그가 이어진다
    if (midOp()) { play(true); return; }
    briefing();
  }
  function briefing() {
    var r = G.rankOf(save), wx = G.weatherFor(save), B = S.BRIEF[r], exam = !!save.exam, goal = exam ? S.OP.examGoal : S.OP.goal[r];
    var zs = S.ZONES.filter(function (Z) { return save.zones[Z.id]; }).sort(function (a, b) { return (a.due || 480) - (b.due || 480); });
    var line = M.fill(pick(B.lines), save).replace('{zone}', zs.map(function (Z) { return Z.name; }).join(', '));
    var notes = [];
    if (exam) notes.push('<li class="exam">진급 심사: 기준 ' + Math.round(goal * 100) + '%, ★★ 이상이면 ' + G.nextRank(save).name + ' 진급</li>');
    if (wx.inspect) notes.push('<li class="red">사단장님 순시 — 보이면 바로 경례</li>');
    if (save.zones.E) notes.push('<li>07:30 중대장님 출근 차량 — 진입로 가운데 바퀴 자리를 먼저</li>');
    if (S.ZONES.some(function (Z) { return save.zones[Z.id] && Z.parts.some(function (p) { return p[5]; }); })) notes.push('<li>그늘·비탈은 치우면 언다 → 제설함 염화칼슘</li>');
    if (r === 0) notes.push('<li>장비는 행보관에게 요청 (초코파이)</li>');
    var prep = Object.keys(save.prep || {}).map(function (k) { var it = S.PREP.filter(function (p) { return p.id === k; })[0]; return it ? it.name : k === 'support' ? '대대 지원' : k === 'morale' ? '전원 초코파이' : k === 'power' ? '체력단련' : ''; }).filter(Boolean);
    if (prep.length) notes.push('<li class="good">준비물: ' + esc(prep.join(', ')) + '</li>');
    var crewRows = r >= 2 && G.crewCount(save) ? crewPlan() : '';
    modal('<div class="m-brief">' +
      '<p class="kicker">' + save.day + '일차 · 05:30 제설 비상</p>' +
      '<div class="brief-who"><div class="m-face">' + portrait(B.who) + '</div><p>' + esc(line) + '</p></div>' +
      '<p class="brief-wx">' + S.WEATHER[wx.id].name + ' · 08:00 아침 식사 전까지</p>' +
      '<ol class="brief-list">' + zs.map(function (Z) { return '<li><b>' + esc(Z.name) + ' ' + Math.round(goal * 100) + '%</b><span>' + G.clockText(Z.due || 480) + '까지 · ' + esc(Z.why || '') + '</span></li>'; }).join('') + '</ol>' +
      (notes.length ? '<ul class="brief-notes">' + notes.join('') + '</ul>' : '') + crewRows +
      '<button class="btn big" data-m="go">' + (exam ? '심사 받으러 출동!' : '출동!') + '</button></div>', function (k) { if (k === 'go') play(false); });
    var box = $('modal-box'), base = box.onclick;
    box.onclick = function (e) {
      var c = e.target.closest('[data-post]');
      if (!c) return base(e);
      cyclePost(c.getAttribute('data-post'), +c.getAttribute('data-n'));
      var wrap = box.querySelector('.crew-plan'); if (wrap) wrap.outerHTML = crewPlan();
    };
  }
  // 상병부터: 걸어가서 데려오지 않아도 브리핑에서 조원을 구역에 나눈다 (짬이 차면 편해진다)
  function crewPlan() {
    var rows = [];
    S.CREW.forEach(function (C) {
      var posts = save.cpost[C.id] || [];
      for (var i = 0; i < G.crewN(save, C.id); i++) {
        var z = G.zoneById(posts[i] && save.zones[posts[i]] ? posts[i] : 'A');
        rows.push('<button class="cp" data-post="' + C.id + '" data-n="' + i + '"><span>' + esc(C.vehicle ? '제설차' : C.name) + '</span><b>' + esc(z.name) + '</b></button>');
      }
    });
    return '<div class="crew-plan"><p>작업 분담 <small>(눌러서 구역 바꾸기)</small></p><div class="cp-grid">' + rows.join('') + '</div></div>';
  }
  function cyclePost(id, n) {
    var open = S.ZONES.filter(function (Z) { return save.zones[Z.id]; }).map(function (Z) { return Z.id; });
    var posts = save.cpost[id] = save.cpost[id] || [], cur = open.indexOf(posts[n]);
    posts[n] = open[(cur + 1) % open.length]; persistRaw(); if (X) X.pop();
  }

  /* ── 작업 ── */
  function play(resume) {
    if (X) X.unlock();
    var w = V.play(save);
    show('play');
    hud = {};
    rankSeen = G.rankOf(save);
    $('h-ins').innerHTML = insignia(rankSeen);
    dayLabel(w);
    if (V.setSpeed) V.setSpeed(1);
    $('h-speed').hidden = !(rankSeen >= 3 && V.setSpeed); $('h-speed-t').textContent = '×1';
    if (X) X.wind({ light: 0.1, normal: 0.25, heavy: 0.55, blizzard: 0.9 }[w.weather] || 0.2);
    if (!resume) {
      var op = w.op || {};
      banner(op.exam ? '진급 심사 작전' : save.day + '일차 제설 작전', '05:30 · ' + S.WEATHER[w.weather].name + ' · 지시서 ' + (op.tasks || []).length + '개 구역', 2400);
      setTimeout(function () { say(op.exam ? 'exam' : w.weather === 'heavy' || w.weather === 'blizzard' ? 'heavy' : 'start'); }, 600);
      if (X) X.whistle(false);
    }
    if (!save.seen.tut) { hintText(); $('hint').hidden = false; }
    scanReady = 0; $('h-scan').disabled = !V.scan; $('h-scan').classList.remove('cool');
    var fresh = S.ZONES.filter(function (Z) { return save.seen['new' + Z.id]; })[0];
    if (fresh) {
      delete save.seen['new' + fresh.id]; persist();
      setTimeout(function () { if (V.focusZone) V.focusZone(fresh.id, 3.2); say('새 구역 「' + fresh.name + '」 — ' + fresh.reveal, 4200); }, resume ? 400 : 2300);
    }
  }
  function dayLabel(w) {
    hud.clock = null;
    $('h-day').textContent = G.clockText(G.clockOf(w.time));
    $('h-wx').textContent = S.WEATHER[w.weather].name + (w.op && w.op.exam ? ' · 심사' : w.inspect ? ' · 순시' : '');
  }

  function onEvent(f) {
    if (onActEvent(f)) return;
    if (onV6Event(f)) return;
    if (onOpEvent(f)) return;
    if (f.t === 'deer') { chip('고라니가 철책 넘어 들어왔다! 쫓아내라', 'warn'); vibrate(80); }
    else if (f.t === 'meHit') { chip('고라니한테 받혔다! (꾸에에엑)', 'bad'); vibrate([60, 40, 120]); flash(); }
    else if (f.t === 'snowball') { splat(); vibrate(50); chip('선임들 장난이다. 이병은 참는다', ''); }
    else if (f.t === 'car') chip('07:30 중대장님 출근 차량! 진입로로 올라온다', 'warn');
    else if (f.t === 'full') vibrate(30);
  }
  // v10 작전 사건: 지시서 완료·지연, 보고, 빙판, 출근 차량, 처마 눈, 지적, 끝
  function onOpEvent(f) {
    if (f.t === 'task') { banner(f.late ? '늦었지만 완료' : '작업 완료!', f.task.name + ' ' + Math.round(f.task.goal * 100) + '% · +' + fmt(f.pay), 2000); if (X) { X.stamp(); X.coin(); } vibrate([30, 30, 60]); hud.op = null; return true; }
    if (f.t === 'taskLate') { chip('마감 지났다: ' + f.task.name + ' (' + G.clockText(f.task.due) + ')', 'bad'); if (X) X.deny(); hud.op = null; return true; }
    if (f.t === 'opReady') { banner('지시서 다 했다!', '행보관에게 가서 "작업 완료 보고" — 일찍 보고할수록 수당', 2800); if (X) X.fanfare(); hud.op = null; return true; }
    if (f.t === 'opEnd') { setTimeout(function () { results(f.res); }, f.res.why === 'report' ? 300 : 900); if (X) { X.whistle(true); } return true; }
    if (f.t === 'icy') { chip(f.name + ' 얼었다! 제설함 염화칼슘', 'warn'); vibrate(40); hud.op = null; return true; }
    if (f.t === 'salted') { chip((f.auto ? '살포기로 ' : '') + f.name + ' 빙판 처리 완료', 'good'); if (X) X.ding(); hud.op = null; return true; }
    if (f.t === 'slip') { chip('미끄러졌다! 빙판엔 염화칼슘', 'bad'); vibrate([40, 30, 80]); return true; }
    if (f.t === 'carStuck') { banner('차가 빠졌다!!', '중대장님 차 — 가서 "차 밀기" 연타 (분대원도 와서 민다)', 2600); vibrate([80, 40, 80]); if (X) X.deny(); hud.op = null; return true; }
    if (f.t === 'carFree') { chip('영차! 차가 빠져나왔다', 'good'); if (X) X.ding(); return true; }
    if (f.t === 'carPass') { chip('중대장님 차가 한 번에 올라갔다 · 상점 +1', 'good'); if (X) X.perfect(); return true; }
    if (f.t === 'push') { vibrate(15); return true; }
    if (f.t === 'roofWarn') { chip('우두둑… 처마 눈이 떨어진다! 피해!', 'warn'); vibrate([20, 20, 20]); return true; }
    if (f.t === 'roof') return true;
    if (f.t === 'jigeok') { chip('지적 ' + f.n + '건 — 경례 안 했다 (등급 감점)', 'bad'); vibrate([80, 40, 80]); hud.op = null; return true; }
    if (f.t === 'nag') return true;
    if (f.t === 'prep') { chip('준비물: ' + f.used.join(', '), 'good'); return true; }
    if (f.t === 'toolGet') { banner(f.name + ' 보급!', '행보관이 창고에서 꺼내 줬다 · 초코파이 ' + fmt(f.cost), 2200); if (X) X.buy(); if (V.shake) V.shake(2); vibrate([30, 30, 60]); hud.ld = -1; return true; }
    if (f.t === 'fever') { if (f.on) { banner('폭풍 제설!!', '콤보 ' + f.n + ' · ' + S.FEVER.sec + '초 동안 눈 값 ×' + S.FEVER.value + ' · 넉가래 범위 UP', 2000); if (X && X.fever) X.fever(); vibrate([30, 30, 30, 30, 90]); } return true; }
    if (f.t === 'surge') { if (f.on) { banner('폭설 경보!', '눈이 미친 듯이 쏟아진다 · ' + Math.round(f.sec) + '초 버텨라', 2400); if (X) X.whistle(false); vibrate([100, 60, 100]); } else chip('폭설이 잦아들었다. 지금이 기회!', 'good'); return true; }
    if (f.t === 'support') { if (f.on) { banner('공병대 제설차 지원!', f.zone + '을(를) 한 줄 싹 밀고 간다', 2400); if (X) X.bugle(); } return true; }
    if (f.t === 'surprise') { banner('사단장님 불시 방문!!', '보이면 바로 경례 — 칼경례면 상점', 2600); if (X) X.bugle(); vibrate([80, 40, 80, 40, 80]); return true; }
    if (f.t === 'dump') { if (f.src === 'player') coinFly(f); return true; }
    return false;
  }

  var scanReady = 0;
  function scan() {
    if (!V.scan || Date.now() < scanReady) return;
    if (V.scan()) { scanReady = Date.now() + 9000; var b = $('h-scan'); b.classList.add('cool'); setTimeout(function () { b.classList.remove('cool'); }, 9000); if (X) X.pop(); }
  }

  function tick(w) {
    updAct(w); storyTick(w);
    var P = w.player, p = G.pct(w), pc = Math.floor(p * 100), bank = Math.floor(save.bank), ld = Math.floor(P.load), full = P.load >= P.cap;

    // 초코파이는 또르르 올라간다
    var bs = hud.bankShown === undefined || hud.bank === -1 ? bank : hud.bankShown;
    if (bs !== bank || hud.bank !== bank) {
      var df = bank - bs; bs = Math.abs(df) < 2 ? bank : Math.round(bs + df * 0.2 + (df > 0 ? 1 : -1));
      hud.bankShown = bs; hud.bank = bank; $('h-bank').textContent = short(bs);
    }
    // 퍼 담을 때마다 게이지가 통통, "+3"
    var nowP = Date.now();
    if (hud.ldPrev !== undefined && ld > hud.ldPrev) hud.gain = (hud.gain || 0) + (ld - hud.ldPrev);
    hud.ldPrev = ld;
    if (hud.gain > 0 && nowP - (hud.popAt || 0) > 220) {
      hud.popAt = nowP; var cg = $('h-carry'), pop = document.createElement('i'); pop.className = 'carry-pop'; pop.textContent = '+' + hud.gain; cg.appendChild(pop);
      setTimeout(function () { pop.remove(); }, 750); hud.gain = 0;
      cg.classList.remove('bump'); void cg.offsetWidth; cg.classList.add('bump');
    }
    if (hud.dia !== save.dia) { if (hud.dia !== undefined && save.dia > hud.dia) { var bp = document.querySelector('.pill.bank'); bp.classList.remove('flash-dia'); void bp.offsetWidth; bp.classList.add('flash-dia'); } hud.dia = save.dia; $('h-dia').textContent = fmt(save.dia); }
    var nb = (save.boxes || []).length; if (hud.nb !== nb) { hud.nb = nb; $('h-box').hidden = !nb; $('h-box-n').textContent = nb; }
    areaHud(w); comboHud(w);
    if (hud.ld !== ld || hud.cap !== P.cap) {
      hud.ld = ld; hud.cap = P.cap;
      $('h-load').textContent = full ? '가득!' : fmt(ld); $('h-cap').textContent = full ? '' : '/' + fmt(P.cap);
      $('h-cring').style.strokeDashoffset = String(119.4 * (1 - Math.min(1, P.load / P.cap)));
      $('h-carry').classList.toggle('full', full); $('h-carry').classList.toggle('mid', !full && P.load > P.cap * 0.6);
    }
    if (!save.seen.tut && P.moving && P.load > 0) { save.seen.tut = true; $('hint').hidden = true; }
    var ck = G.clockText(G.clockOf(w.time));
    if (hud.clock !== ck) { hud.clock = ck; $('h-day').textContent = ck; var late = w.dayLen - w.time < 30; $('h-day').classList.toggle('late', late); }
    // 알림 줄은 HUD(지금 할 일·진행 막대) 바로 아래에서 시작한다
    if (nowP - (hud.stackAt || 0) > 400) { hud.stackAt = nowP; var hb = $('hud').getBoundingClientRect().bottom; if (Math.abs(hb - (hud.hb || 0)) > 2) { hud.hb = hb; $('stack').style.top = Math.round(hb + 8) + 'px'; } }
    if (Date.now() - lastSave > 5000) persist();
  }

  // 진급 신고: 계급마다 '내 역할'이 바뀌고, 편해지는 것과 새로 할 수 있는 것을 보여 준다
  function rankUp(r, done) {
    var R = S.RANKS[r], unlocked = S.CREW.filter(function (C) { return C.rank === r; }).map(function (C) { return C.name; });
    var tools = S.TOOLS.filter(function (T) { return (T.rank || 0) === r; }).map(function (T) { return T.name; });
    if (X) X.rank();
    if (V.shake) V.shake(3);
    var more = R.more.slice();
    if (!more.length && unlocked.length) more.push(unlocked.join(', ') + ' 전입');
    modal('<div class="m-rank promo"><div class="m-ins">' + insignia(r) + '</div><p class="kicker">진급 신고</p><h3>' + R.name + ' 진급!</h3>' +
      '<p class="promo-line">"충성! ' + R.name + ' ' + esc(save.look.name || '김제설') + ', ' + R.name + ' 진급을 명 받았습니다!"</p>' +
      '<p class="promo-role">이제 <b>' + esc(R.role) + '</b></p>' +
      (R.easy.length ? '<ul class="promo-list easy">' + R.easy.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (more.length ? '<ul class="promo-list more">' + more.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (tools.length ? '<p>행보관 보급 목록에 <b>' + esc(tools.join(', ')) + '</b></p>' : '') +
      '<button class="btn big" data-m="ok">충성!</button></div>', function () { if (done) done(); });
  }

  /* ── 검열 결과: ★, 지시서 줄마다 이행, 감점, 보상, 근무평정 → 진급 심사 / 진급, 새 구역 ── */
  function results(res) {
    if (talking || !$('modal').hidden) { if (V.pause) V.pause(true); setTimeout(function () { results(res); }, 400); return; }   // 대사·다른 창이 끝난 뒤에
    if (V.pause) V.pause(true);
    if (V.setSpeed) V.setSpeed(1);
    persistRaw();
    var r = res.rank, nr = S.RANKS[r + 1], R0 = S.RANKS[r];
    var lines = res.lines.map(function (l) {
      var st = l.done ? (l.late ? '늦음' : '완료') : Math.floor(l.pct * 100) + '%';
      return '<li class="' + (l.done ? (l.late ? 'late' : 'ok') : 'bad') + '"><span>' + esc(l.name) + ' <small>' + G.clockText(l.due) + '</small></span><b>' + st + '</b></li>';
    });
    if (res.jigeok) lines.push('<li class="bad"><span>지적 (경례)</span><b>−' + res.jigeok + '건</b></li>');
    if (res.stuck) lines.push('<li class="bad"><span>출근 차량 빠짐</span><b>감점</b></li>');
    if (res.icy) lines.push('<li class="bad"><span>빙판 방치</span><b>' + res.icy + '곳</b></li>');
    if (res.carPass) lines.push('<li class="ok"><span>출근 차량 한 번에 통과</span><b>상점 +1</b></li>');
    if (res.report) lines.push('<li class="ok"><span>작업 완료 보고</span><b>가점</b></li>');
    if (res.early) lines.push('<li class="ok"><span>맡은 구역 전부 100%</span><b>가점</b></li>');
    var meritTxt = nr ? '★' + res.merit + ' / ' + nr.merit + ' (' + nr.name + ')' : '★' + res.merit + ' / ' + S.DISCHARGE_MERIT + ' (전역)';
    var prog = nr ? Math.min(1, (res.merit - R0.merit) / (nr.merit - R0.merit)) : Math.min(1, res.merit / S.DISCHARGE_MERIT);
    var head = res.exam ? (res.pass ? '진급 심사 합격!' : '진급 심사 불합격') : ['재작업…', '미흡', '양호', '특급 제설!'][res.stars];
    var who = res.stars >= 2 ? '수고했다. 오늘 제설 아주 좋았다.' : res.stars === 1 ? '이 정도로 사단장님 오시면 큰일 난다.' : '내일 새벽 다시 나온다. 각오해라.';
    modal('<div class="m-res' + (res.exam ? ' exam' : '') + '"><p class="kicker">' + res.day + '일차 제설 작전 · 행보관 검열' + (res.why === 'report' ? ' (보고 ' + G.clockText(G.clockOf(V.world().time)) + ')' : ' (08:00)') + '</p>' +
      '<div class="res-stars s' + res.stars + '">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= res.stars ? 'on' : '') + '" style="animation-delay:' + (0.25 + i * 0.28) + 's">★</i>'; }).join('') + '</div>' +
      '<h3>' + head + '</h3><p class="res-who">' + esc(who) + '</p>' +
      '<ul class="res-lines op">' + lines.join('') + '</ul>' +
      '<div class="res-pay"><span>' + pie() + '+' + fmt(res.pie + res.earlyPie) + (res.earlyPie ? ' <small>(조기 퇴근 ' + fmt(res.earlyPie) + ')</small>' : '') + '</span>' + (res.dia ? '<span>' + dia() + '상점 +' + res.dia + '</span>' : '') + (res.box ? '<span>보급 상자</span>' : '') + '</div>' +
      '<div class="res-merit"><span>근무평정 +' + res.stars + '</span><div class="hub-bar' + (res.examNext ? ' exam' : '') + '"><i style="width:' + Math.round(prog * 100) + '%"></i></div><small>' + meritTxt + (res.examNext && !res.promoted ? ' · 다음 작전은 진급 심사!' : '') + '</small></div>' +
      (res.zones.length ? '<p class="res-zone">새 담당 구역: <b>' + esc(res.zones.join(', ')) + '</b></p>' : '') +
      '<button class="btn big" data-m="ok">' + (res.promoted ? '진급 신고하러 간다' : '충성! 들어가 보겠습니다') + '</button></div>', function () {
      rankSeen = G.rankOf(save);
      if (res.promoted) rankUp(res.rank, function () { title(); afterHub(); });
      else { title(); afterHub(); }
    });
    if (X) setTimeout(function () { if (res.stars >= 3) X.fanfare(); else if (res.stars >= 1) X.stamp(); else X.deny(); }, 700);
  }
  // 생활관에 돌아오면: 이야기 장면 → 전역 안내
  function afterHub() {
    var ch = M && M.storyNext(save, null);
    if (ch) { playStory(ch, false, function () { renderHub(); afterHub(); }); return; }
    if (G.canDischarge(save) && !save.seen.dis) { save.seen.dis = true; persistRaw(); modal('<div class="m-rank"><p class="kicker">전역 신고 가능</p><h3>이제 전역할 수 있다</h3><p>생활관의 <b>전역 신고</b>를 누르면 처음(이병)부터 다시 시작하지만, 전역 메달로 초코파이 보상이 영원히 늘어난다. 꾸미기·훈장·상점은 남는다.</p><button class="btn big" data-m="ok">알겠다</button></div>'); }
  }

  /* ── 포상휴가: 상점 10개 → 집에 다녀온다 (가족 장면 + 용돈 + 보급 상자 + 다음 작전 분대 사기 100) ── */
  function goLeave() {
    if (save.dia < S.LEAVE.cost) return;
    modal('<div class="m-rank"><p class="kicker">포상휴가</p><h3>휴가 나갈래?</h3><p>상점 <b>' + S.LEAVE.cost + '개</b>를 포상휴가 1일로 바꾼다. 집에 다녀오면 용돈(초코파이)과 보급 상자, 분대원 사기 100.</p><div class="res-btns"><button class="btn ghost" data-m="no">아직</button><button class="btn big" data-m="yes">충성! 휴가 다녀오겠습니다</button></div></div>', function (k) {
      if (k !== 'yes') return;
      save.dia -= S.LEAVE.cost; save.leave = (save.leave || 0) + 1; save.stats.leave = (save.stats.leave || 0) + 1;
      var r = G.rankOf(save), money = Math.round((200 + 60 * save.day) * (1 + r) * G.incomeMult(save));
      save.bank += money; save.life += money; save.boxes.push('rare'); save.prep = save.prep || {}; save.prep.morale = 1;
      persistRaw();
      playStory({ id: 'leave', title: '포상휴가', lines: [
        ['narr', '위병소를 나서는 순간, 공기가 다르다.'],
        ['mom', '아이고 우리 아들! 얼굴이 왜 이렇게 탔어? 눈 치우느라 고생했지?'],
        ['me', '(엄마 밥… 엄마 밥이다…)'],
        ['mom', '이거 용돈. 후임들 맛있는 거 사 줘라.'],
        ['narr', '…휴가는 눈 깜짝할 사이에 끝났다. 복귀하니 눈이 또 와 있다.'],
        ['malnyeon', '왔냐? 너 없는 동안 우리가 다 치웠다. 사 온 거 내놔.']] }, true, function () {
        toast('용돈 ' + fmt(money) + ' · 희귀 보급 상자 · 분대 사기 100');
        if (M) M.check({ save: save, fx: [], demo: false, today: { dia: 0 }, player: { load: 0 } });
        persistRaw(); renderHub();
      });
    });
  }

  /* ── 보급·인력·공장 ── */
  var TABS = [['tool', '장비'], ['crew', '인원'], ['perk', '개인 장비'], ['factory', '시설'], ['zone', '구역'], ['look', '꾸미기'], ['story', '수첩'], ['medal', '훈장'], ['dis', '전역']];
  var PERK_ICON = {
    eisen: '<path d="M5 6h7v6l6 2a3 3 0 0 1 3 3v1H5z" fill="#3b3f33"/><path d="M6 19l1 3M10 19l1 3M14 19l1 3M18 19l1 3" stroke="#9aa3ab" stroke-width="1.6" stroke-linecap="round"/>',
    back: '<path d="M6 7c0-3 12-3 12 0l1 12c0 2-14 2-14 0z" fill="#8a7a52"/><path d="M8 7c1-2 7-2 8 0" stroke="#5a4c2c" stroke-width="1.6" fill="none"/><ellipse cx="12" cy="6" rx="5" ry="1.6" fill="#fbfdff"/>',
    matsta: '<rect x="7" y="3" width="10" height="18" rx="2" fill="#2f8f5b"/><rect x="7" y="8" width="10" height="7" fill="#f4d35e"/><rect x="9" y="1.5" width="6" height="2" rx="1" fill="#9aa3ab"/>',
    praise: '<path d="M12 2l2.9 6.2 6.6.6-5 4.5 1.5 6.6L12 16.6 6 19.9l1.5-6.6-5-4.5 6.6-.6z" fill="#ffd24a" stroke="#b8901a" stroke-width="1"/>',
    gong: '<circle cx="12" cy="12" r="8" fill="#d9a53a" stroke="#8a6512" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="#b8861b"/><path d="M19 4l3-2" stroke="#6b4a32" stroke-width="2"/>',
    medic: '<rect x="4" y="5" width="16" height="14" rx="3" fill="#fff" stroke="#c8402e" stroke-width="1.5"/><path d="M12 8v8M8 12h8" stroke="#c8402e" stroke-width="3"/>',
    song: '<path d="M4 9h4l6-5v16l-6-5H4z" fill="#4d5b31"/><path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a8.5 8.5 0 0 1 0 13" stroke="#4d5b31" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    gear: '<path d="M6 20L16 6" stroke="#8a6a44" stroke-width="2.2" stroke-linecap="round"/><rect x="13" y="2" width="9" height="5" rx="1.5" transform="rotate(35 17 4)" fill="#e7ae2f"/><path d="M18 20L8 6" stroke="#8a6a44" stroke-width="2.2" stroke-linecap="round"/><rect x="2" y="2" width="9" height="5" rx="1.5" transform="rotate(-35 7 4)" fill="#e7ae2f"/>',
    press: '<rect x="4" y="12" width="16" height="9" rx="1" fill="#6b7a8a"/><rect x="9" y="3" width="6" height="9" fill="#8a98a6"/><rect x="6" y="16" width="5" height="3" fill="#fbfdff"/><rect x="13" y="16" width="5" height="3" fill="#fbfdff"/>',
    sculpt: '<circle cx="12" cy="16" r="6" fill="#fbfdff" stroke="#9fb6cd"/><circle cx="12" cy="8" r="4.5" fill="#fbfdff" stroke="#9fb6cd"/><path d="M8 5h8l-1-3H9z" fill="#2f3a25"/><circle cx="12" cy="3.4" r="1" fill="#e2b33c"/>',
    relay: '<path d="M3 18h18" stroke="#8a6a44" stroke-width="2"/><circle cx="6" cy="9" r="2.5" fill="#f1c7a1"/><circle cx="12" cy="9" r="2.5" fill="#f1c7a1"/><circle cx="18" cy="9" r="2.5" fill="#f1c7a1"/><rect x="4" y="12" width="4" height="6" fill="#5b6a3a"/><rect x="10" y="12" width="4" height="6" fill="#5b6a3a"/><rect x="16" y="12" width="4" height="6" fill="#5b6a3a"/><path d="M8 13l2-1M14 13l2-1" stroke="#555" stroke-width="2"/>'
  };

  function iconCanvas(draw) {
    var c = document.createElement('canvas'), k = 2; c.width = 56 * k; c.height = 56 * k; c.className = 'ico-cv';
    var x = c.getContext('2d'); x.scale(k, k); draw(x); return c;
  }
  function person(opts, scale) {
    return iconCanvas(function (x) {
      x.translate(28, 49); x.scale(scale || 1.55, scale || 1.55);
      V2._drawPerson(x, { x: 0, y: 0, dir: { x: 0.45, y: 0.89 }, walk: 0, moving: false, swing: 0 }, opts);
    });
  }
  function vehicle(kind, r) {
    return iconCanvas(function (x) {
      x.translate(24, 38); x.scale(0.82, 0.82);
      V2._drawVehicle(x, { x: 0, y: 0, dir: { x: 0.85, y: -0.5 } }, { kind: kind, r: Math.min(r, 40) });
    });
  }
  function itemIcon(o) {
    if (o.kind === 'crew') {
      var C = S.CREW.filter(function (c) { return c.id === o.id; })[0];
      if (C.vehicle) return vehicle('plow', 30);
      return person({ coat: C.coat, hat: C.hat, seed: 5, tool: C.id === 'cook' ? 'shovel' : C.id === 'hoobae' ? 'broom' : 'pusher', r: C.r });
    }
    if (o.kind === 'tool') {
      var T = S.TOOLS[o.i];
      if (T.vehicle) return vehicle(T.id, T.r);
      if (T.id === 'salt') return person({ coat: '#5b6a3a', hat: 'beanie', seed: 3, salt: true });
      return person({ coat: '#5b6a3a', hat: 'beanie', seed: 3, tool: V2._toolKind(T), r: T.r, band: true });
    }
    if (o.kind === 'zone') {
      var Z = S.ZONES.filter(function (z) { return z.id === o.id; })[0];
      return iconCanvas(function (x) {
        x.fillStyle = '#dfe7ee'; x.fillRect(4, 4, 48, 48);
        var k = 44 / Math.max(S.W, S.H);
        S.ZONES.forEach(function (z) { x.fillStyle = z.id === Z.id ? '#ffd24a' : save.zones[z.id] ? '#8a98a6' : '#c3ccd5'; x.fillRect(4 + (48 - S.W * k) / 2 + z.x * k, 6 + z.y * k, Math.max(2, z.w * k), Math.max(2, z.h * k)); });
        x.strokeStyle = '#4d5b31'; x.lineWidth = 1.5; x.strokeRect(4, 4, 48, 48);
      });
    }
    var d = document.createElement('div'); d.className = 'ico-svg';
    d.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (PERK_ICON[o.kind === 'relay' ? 'relay' : o.id] || '') + '</svg>';
    return d;
  }

  // 보급·인원은 생활관에서만 연다 (작전 중엔 행보관에게 직접 장비 요청)
  function openShop() {
    var w = V.world();
    if (w && V.mode() === 'play') { G.serialize(w); V.pause(true); }
    dirty = false;
    show('shop');
    renderShop();
  }
  function closeShop() {
    persist();
    dirty = false;
    title();
  }

  function renderShop() {
    $('s-bank').textContent = fmt(save.bank);
    var showDis = G.rankOf(save) >= 3 || save.discharges > 0, all = G.offers(save);
    $('s-tabs').innerHTML = TABS.filter(function (t) { return t[0] !== 'dis' || showDis; }).map(function (t) {
      var o = all[t[0]] || [], n = o.filter(function (x) { return x.ok; }).length;
      return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + (n ? '<i class="dot">' + n + '</i>' : '') + '</button>';
    }).join('');
    var list = $('s-list'); list.innerHTML = '';
    if (tab === 'dis') { renderDischarge(list); return; }
    if (tab === 'medal') { renderMedals(list); return; }
    if (tab === 'look') { renderLook(list); return; }
    if (tab === 'story') { renderStory(list); return; }
    if (tab === 'crew') crewHead(list);
    if (tab === 'factory') {
      var mk = save.made, pm = G.procMult(save);
      var head = document.createElement('div'); head.className = 'fac-head';
      head.innerHTML = '<b>눈 집하장 가공 라인</b><span>부은 눈 값 ×' + pm.toFixed(1) + '</span>' + (mk.brick >= 1 || mk.snowman >= 1 ? '<small>지금까지 눈벽돌 ' + fmt(mk.brick) + '장 · 환영 눈사람 ' + fmt(mk.snowman) + '개</small>' : '<small>압축기를 들이면 부은 눈이 눈벽돌이 된다</small>');
      list.appendChild(head);
    }
    if (tab === 'zone') list.insertAdjacentHTML('beforeend', '<p class="info-note">구역은 사는 게 아니다. 작전에서 받은 <b>★(근무평정)</b>이 쌓이면 중대에서 더 맡긴다. 지금 ★' + (save.merit || 0) + '</p>');
    if (tab === 'tool') list.insertAdjacentHTML('beforeend', '<p class="info-note">작전 중에도 <b>행보관</b> 앞에서 "요청"으로 바로 받을 수 있다. 좋은 장비는 계급 순서.</p>');
    var items = all[tab];
    if (!items.length) { list.insertAdjacentHTML('beforeend', '<p class="empty">살 것이 없다.</p>'); return; }
    items.forEach(function (o) {
      var row = document.createElement('div');
      row.className = 'item s-' + o.state + (o.ok ? ' can' : '');
      var meta = o.kind === 'crew' ? o.tag + ' · ' + o.n + '/' + o.max + '명' + (o.pend ? ' (전입 대기 ' + o.pend + ')' : '') + (o.dia ? ' · 상점 ' + o.dia + '개 필요' : '') : o.kind === 'perk' || o.kind === 'proc' ? 'Lv ' + o.n + '/' + o.max : o.kind === 'tool' || o.kind === 'star' ? o.stat : o.kind === 'zone' ? '눈 한 칸에 초코파이 ' + o.value + '개 · ' + G.clockText(S.ZONES.filter(function (Z) { return Z.id === o.id; })[0].due || 480) + '까지' : '';
      var label;
      if (o.state === 'buy') label = (o.kind === 'crew' ? '전입 ' : '') + (o.cost ? pie() + fmt(o.cost) : '') + (o.dia ? dia() + o.dia : '');
      else if (o.state === 'own') label = o.kind === 'zone' ? '담당 중' : o.cur ? '사용 중' : '보유';
      else if (o.state === 'max') label = o.kind === 'relay' ? '가동 중' : '최대';
      else if (o.state === 'later') label = '다음 단계';
      else label = esc(o.lockText);
      var ico = document.createElement('div'); ico.className = 'ico'; ico.appendChild(itemIcon(o));
      row.appendChild(ico);
      var info = document.createElement('div'); info.className = 'info';
      info.innerHTML = '<b>' + esc(o.name) + '</b>' + (meta ? '<small>' + esc(meta) + '</small>' : '') + '<p>' + esc(o.desc) + '</p>';
      row.appendChild(info);
      var btn = document.createElement('button'); btn.className = 'buy'; btn.innerHTML = label;
      btn.disabled = o.state !== 'buy';
      if (o.state === 'buy' && !o.ok) btn.classList.add('short');
      btn.setAttribute('data-kind', o.kind); btn.setAttribute('data-id', o.id);
      row.appendChild(btn);
      list.appendChild(row);
    });
  }

  function renderDischarge(list) {
    var can = G.canDischarge(save), p = Math.min(1, (save.merit || 0) / S.DISCHARGE_MERIT), gain = G.medalGain(save);
    list.innerHTML = '<div class="dis"><div class="dis-ins">' + insignia(3) + '</div><h3>전역 신고</h3>' +
      '<p>지금까지 번 초코파이로 전역 메달을 받는다. 처음(이병, 싸리비)부터 다시 시작하지만 <b>메달 하나마다 모든 보상이 +10%</b> 영원히 늘어난다. 꾸미기·훈장·상점은 남는다.</p>' +
      '<div class="dis-bar"><i style="width:' + Math.round(p * 100) + '%"></i></div><p class="dis-num">근무평정 ★' + (save.merit || 0) + ' / ' + S.DISCHARGE_MERIT + ' · ' + (G.rankOf(save) >= 3 ? '병장' : '병장이 돼야 한다') + '</p>' +
      '<ul class="res-lines"><li><span>지금 메달</span><b>' + save.medals + '개</b></li><li><span>이번 전역으로 받는 메달</span><b>+' + (can ? gain : 0) + '개</b></li></ul>' +
      '<button class="btn big" id="dis-go"' + (can ? '' : ' disabled') + '>' + (can ? '전역 신고하기' : '아직 전역할 때가 아니다') + '</button></div>';
    var go = $('dis-go');
    if (go) go.onclick = function () {
      modal('<div class="m-rank"><p class="kicker">정말 전역?</p><h3>전역 신고</h3><p>초코파이, 도구, 인력, 구역, 공장이 모두 처음으로 돌아간다. 전역 메달 <b>+' + gain + '개</b>를 받는다.</p><div class="res-btns"><button class="btn ghost" data-m="no">조금 더 한다</button><button class="btn big" data-m="yes">충성! 전역합니다</button></div></div>', function (k) {
        if (k !== 'yes') return;
        var r = G.discharge(save); persistRaw();
        if (X) X.rank();
        modal('<div class="m-rank"><div class="m-ins">' + insignia(3) + '</div><p class="kicker">전역을 축하한다</p><h3>전역 메달 +' + r.medals + '</h3><p>메달 ' + r.total + '개 · 모든 보상 +' + r.total * 10 + '%. 그리고… 새 이병으로 재입대했다.</p><button class="btn big" data-m="ok">다시 싸리비를 든다</button></div>', function () { tab = 'tool'; title(); });
      });
    };
  }
  function persistRaw() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 */ } }

  function onShopClick(e) {
    var lt = e.target.closest('[data-ltab]');
    if (lt) { lookTab = lt.getAttribute('data-ltab'); renderShop(); return; }
    var lk = e.target.closest('[data-look]');
    if (lk) {
      var cat = lk.getAttribute('data-cat'), id = lk.getAttribute('data-look'), st = lk.getAttribute('data-state');
      if (st === 'buy') { if (M.buyLook(save, cat, id)) { if (X) X.dia(); toast(M.lookName(cat + ':' + id) + ' 획득!'); } else { if (X) X.deny(); toast('상점이 모자라다'); } }
      else if (st === 'own') { M.setLook(save, cat, id); if (X) X.pop(); }
      else { if (X) X.deny(); toast('스토리를 진행하면 열린다'); }
      persistRaw(); lookChanged(); renderShop(); return;
    }
    var rp = e.target.closest('[data-replay]');
    if (rp) { var ch = S.STORY.filter(function (c) { return c.id === rp.getAttribute('data-replay'); })[0]; if (ch) playStory(ch, true); return; }
    var du = e.target.closest('[data-dia]');
    if (du) {
      var r0 = A ? A.useDia(save, du.getAttribute('data-dia')) : { ok: false };
      if (r0.ok) { if (X) X.dia(); toast(du.getAttribute('data-dia') === 'morale' ? '다음 작전: 전원 초코파이 (사기 100)' : '다음 작전: 대대 지원 (처음 60초 분대원 두 배)'); persistRaw(); } else { if (X) X.deny(); if (r0.why === 'have') toast('이미 요청해 뒀다'); }
      renderShop(); return;
    }
    var t = e.target.closest('[data-tab]');
    if (t) { tab = t.getAttribute('data-tab'); renderShop(); $('s-list').scrollTop = 0; return; }
    var b = e.target.closest('.buy');
    if (!b) return;
    var kind = b.getAttribute('data-kind'), id = b.getAttribute('data-id');
    var r = G.buy(save, kind, id);
    if (!r.ok) { if (X) X.deny(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    if (X) X.buy();
    dirty = true; persistRaw();
    if (kind === 'crew') toast('전입 요청! ' + esc(r.item.name) + '은(는) 다음 작전 아침 생활관 앞에 온다'); else toast(esc(r.item.name) + ({ crew: ' 투입!', zone: ' 담당!', tool: ' 지급!', relay: ' 가동!', proc: ' 설치!', star: ' 완료!' }[kind] || ' 보급!'));
    if (kind === 'crew' && Math.random() < 0.5) say('hire', 2000);
    if (kind === 'tool') say('tool', 2000);
    if (kind === 'zone') say('zone', 2000);
    if (kind === 'relay') say('relay', 2000);
    if (kind === 'proc') say('proc', 2000);
    renderShop();
  }

  /* ── v6: 다이아·구역 진행·콤보·경례 알림·보급 상자·훈장·하루 결산 ── */
  function areaHud(w) {
    var P = w.player, idx = G.cellIndex(P.x, P.y), pi = idx >= 0 ? w.partOf[idx] : -1, Pt = pi >= 0 ? w.parts[pi] : null;
    var name, pr, txt, cls = '';
    if (Pt && w.zoneOpen[Pt.zi]) {
      pr = Pt.total ? Pt.clear / Pt.total : 1; var left = Pt.total - Pt.clear;
      name = Pt.name; txt = Pt.done ? '완벽!' : pr >= S.ALMOST ? '남은 ' + left + '칸' : Math.floor(pr * 100) + '%';
      cls = Pt.done ? 'done' : pr >= S.ALMOST ? 'almost' : '';
    } else { pr = G.pct(w); name = '부대 전체'; txt = Math.floor(pr * 100) + '%'; }
    var showP = !!(Pt && w.zoneOpen[Pt.zi] && (Pt.done || pr >= 0.7));
    var key = name + txt + cls + Math.round(pr * 200) + showP;
    if (hud.area === key) return;
    hud.area = key; $('h-prog').hidden = !showP;
    $('h-area').textContent = name; $('h-pct').textContent = txt; $('h-fill').style.width = Math.min(100, pr * 100) + '%';
    var pg = document.querySelector('.prog'); pg.classList.toggle('almost', cls === 'almost'); pg.classList.toggle('done', cls === 'done');
  }
  var comboShown = 0;
  function comboHud(w) {
    var n = w.combo || 0, el = $('combo');
    if (n < 10) { if (!el.hidden) el.hidden = true; comboShown = 0; return; }
    if (n === comboShown) return;
    comboShown = n; el.hidden = false;
    $('combo-n').textContent = '콤보 x' + n;
    var nf = S.FEVER.at.filter(function (a) { return a > n; })[0];
    $('combo-t').textContent = w.fever > 0 ? '폭풍 제설 중!' : nf && nf - n <= 30 ? '폭풍 제설까지 ' + (nf - n) : '눈 값 +' + Math.round((G.comboMult(w) - 1) * 100) + '%';
    el.classList.toggle('hot', n >= 50); el.classList.toggle('fire', n >= 150);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    if (X && n % 5 === 0) X.combo(n);
  }
  function saluteHud(st) {
    var el = $('salute'), s0 = st && st.salute;
    el.hidden = !s0;
    if (!s0) return;
    $('sal-t').textContent = s0.title + '이다!';
    $('sal-f').style.width = Math.max(0, s0.left / 3.5 * 100) + '%';
  }
  var RAR = { c: '흔함', u: '드묾', r: '희귀', l: '전설' };
  function onV6Event(f) {
    if (f.t === 'dia') { if (X) X.dia(); if (f.why === 'rank') chip('진급 기념 상점 +' + f.n, 'good'); return true; }
    if (f.t === 'found') {
      var rc = S.RARITY[f.item.r].color;
      chip((f.src === 'player' ? '' : '후임이 주웠다: ') + f.item.name + ' (' + RAR[f.item.r] + ')' + (f.first ? ' · 도감 등록!' : ''), f.item.r === 'c' ? '' : 'good');
      if (f.item.r === 'r' || f.item.r === 'l') { banner(f.item.name + '!!', f.item.line + (f.item.dia ? ' · 상점 +' + f.item.dia : ''), 2600); if (X) X.fanfare(); vibrate([40, 30, 40, 30, 120]); }
      else { if (f.src === 'player') subtitle(f.item.line); if (X) X.found(); }
      return true;
    }
    if (f.t === 'combo') { var msg = { 25: '좋아!', 50: '훌륭해!', 100: '미쳤다!!', 200: '제설의 신!!', 300: '전설의 제설병', 500: '인간 제설차' }[f.n]; if (msg) chip('콤보 ' + f.n + ' — ' + msg, 'good'); return true; }
    if (f.t === 'comboEnd') return true;
    if (f.t === 'zonePerfect') { banner(f.name + ' 완벽 제설!', '구역 전체 100% · +' + fmt(f.bonus) + (f.mine ? ' · 상점 +2' : ''), 2600); if (X) X.fanfare(); vibrate([60, 40, 60]); return true; }
    if (f.t === 'allClear') { banner('눈 한 톨 없다!', '맡은 구역 전부 100% · +' + fmt(f.bonus) + ' · 행보관에게 보고하자', 2800); if (X) { X.fanfare(); X.bugle(); } return true; }
    if (f.t === 'locked') { var LZ = G.zoneById(f.zone); chip('출입 통제 · ' + f.name + ' (아직 우리 담당 아님 · ★' + (LZ ? LZ.need : 0) + ')', 'warn'); if (X) X.deny(); vibrate(40); return true; }
    if (f.t === 'ach') { banner('훈장: ' + f.ach.name, f.ach.desc + ' · 상점 +' + f.ach.dia + (f.ach.box ? ' · 보급 상자' : ''), 2600); if (X) X.fanfare(); return true; }
    if (f.t === 'officer') {
      if (f.state === 'arrive') { chip(f.title + ' 순찰 중! 보면 경례!', 'warn'); if (X) X.bugle(); }
      else if (f.state === 'near') { if (X) X.whistle(false); vibrate([30, 30, 30]); }
      else if (f.state === 'miss') { chip(f.title + '께 경례를 안 했다!' + (f.id === 'lt' ? '' : ' (지적)'), 'bad'); vibrate([80, 40, 80]); }
      else if (f.state === 'saluted') { chip((f.quick ? '칼경례! ' : '경례 완료 · ') + f.title + (f.pie ? ' · +' + fmt(f.pie) : '') + (f.dia ? ' · 상점 +' + f.dia : ''), 'good'); if (f.quick && X) X.perfect(); }
      else if (f.state === 'report') { chip(f.res === 'good' ? f.title + ' 칭찬! 보고 대성공' : f.res === 'ok' ? '보고 무난 · +' + fmt(f.pie || 0) : '보고했다가 혼났다…', f.res === 'bad' ? 'bad' : 'good'); }
      else if (f.state === 'help') chip('소대장님이 40초 동안 같이 치운다!', 'good');
      return true;
    }
    if (f.t === 'quest') {
      chip('할 일 완료! ' + f.q.text + (f.pie ? ' · +' + fmt(f.pie) : '') + (f.dia ? ' · 상점 +' + f.dia : ''), 'good');
      if (X) X.ding(); var qc = $('h-op'); qc.classList.remove('pop'); void qc.offsetWidth; qc.classList.add('pop'); hud.op = null;
      if (!f.next) banner('할 일 끝!', '이제 짬으로 버틴다', 2400);
      return true;
    }
    if (f.t === 'warm') return true;
    if (f.t === 'recruit') { banner('신병 전입!', '생활관 앞에 신병 ' + f.n + '명' + (G.rankOf(save) >= 2 ? ' · 인솔해서 배치 (다음부턴 브리핑에서 배치)' : ' · 가서 인솔해서 구역에 배치해라'), 2600); if (X) X.bugle(); return true; }
    if (f.t === 'assigned') { chip(f.e.def.name + ' → ' + (G.zoneById(f.zone) || {}).name + ' 담당' + (f.moved ? ' (이동)' : '!'), 'good'); return true; }
    if (f.t === 'req') {
      if (f.state === 'new') chip(f.who + ' 기름 떨어졌다! (' + f.where + ' 기름통)', 'warn');
      else if (f.state === 'done') { chip('제설차 다시 출발! · +' + fmt(f.pay), 'good'); if (X) X.coin(); }
      else chip('운전병이 직접 기름 가지러 갔다…', 'bad');
      return true;
    }
    if (f.t === 'hand') { if (f.item) toast(josa(f.name, '을', '를') + ' 들었다'); return true; }
    if (f.t === 'slack') { if (!hud.slackSaid) { hud.slackSaid = true; chip('인력이 짱박혔다! 가서 일으켜라', 'warn'); setTimeout(function () { hud.slackSaid = false; }, 15000); } return true; }
    if (f.t === 'part' && f.perfect) {
      if (f.mine && f.first) { if (X) X.perfect(); vibrate([30, 30, 60]); }
      else if (X) X.ding();
      return true;
    }
    return false;
  }
  var BOX_SVG = '<svg viewBox="0 0 120 110"><path d="M10 40l50-25 50 25v45l-50 22-50-22z" fill="#b8913a" stroke="#5a4316" stroke-width="3" stroke-linejoin="round"/><path d="M10 40l50 22 50-22M60 62v45" stroke="#5a4316" stroke-width="3" fill="none"/><path d="M35 27l50 25" stroke="#d23a2a" stroke-width="7"/><text x="60" y="92" text-anchor="middle" font-size="14" fill="#3a2a0a" font-family="sans-serif">보급</text></svg>';
  function openBox() {
    if (!M || !save.boxes.length) return;
    var w = V.world(), wasPlay = V.mode() === 'play'; if (wasPlay) V.pause(true);
    var tier = save.boxes[0], T0 = M.TIER[tier];
    modal('<div class="box-open"><p class="kicker">보급 상자</p><h3 class="tier-' + tier + '">' + T0.name + '</h3><div class="box-art shake" id="box-art"><div class="box-glow" style="background:conic-gradient(from 0deg,transparent,' + T0.color + ',transparent 30%,' + T0.color + ',transparent 60%)"></div>' + BOX_SVG + '</div><div id="box-loot" class="box-loot"></div><button class="btn big" data-m="ok" id="box-ok" disabled>여는 중…</button></div>', function () { if (wasPlay) V.pause(false); if (save.boxes.length) setTimeout(function () { hud.nb = -1; }, 50); });
    if (X) X.drum();
    setTimeout(function () {
      var r = M.openBox(save); persistRaw();
      var art = $('box-art'); if (!art) return;
      art.classList.remove('shake'); art.classList.add('open');
      var html = '<div>' + pie() + '+' + fmt(r.pie) + '</div>';
      if (r.dia) html += '<div>' + dia() + ' 상점 +' + r.dia + '</div>';
      if (r.item) html += '<div style="color:' + S.RARITY[r.item.r].color + '">' + esc(r.item.name) + ' (' + RAR[r.item.r] + ')</div>';
      $('box-loot').innerHTML = html;
      var ok = $('box-ok'); ok.disabled = false; ok.textContent = save.boxes.length ? '좋다! (상자 ' + save.boxes.length + '개 남음)' : '좋다!';
      if (X) { if (tier === 'legend') X.fanfare(); else X.perfect(); }
      if (w) hud.bank = -1;
    }, 900);
  }
  function crewHead(list) {
    var mor = Math.round(save.mor || 80), n = G.crewCount(save), pr = save.prep || {};
    var head = document.createElement('div'); head.className = 'crew-head';
    head.innerHTML = '<div class="row"><b>분대원 ' + n + '명 · 사기 ' + (n ? mor : '-') + '</b><small>사기가 바닥나면 짱박힌다</small></div>' +
      (n ? '<div class="row"><div class="morbar"><i style="width:' + mor + '%"></i></div></div>' : '') +
      '<p class="info">정원 <b>' + (n + G.pendN(save)) + '/' + G.crewCap(save) + '명</b> (진급하면 늘어난다)' + (G.pendN(save) ? ' · 전입 대기 <b>' + G.pendN(save) + '명</b>: 다음 작전 아침 생활관 앞' : '') +
      '<br>분대원은 <b>담당 구역</b>만 치운다. ' + (G.rankOf(save) >= 2 ? '상병부터는 <b>브리핑에서</b> 구역을 나눈다' : '옮기려면 가서 "따라와" → 새 구역에서 "여기 배치"') + '</p>' +
      '<div class="dia-btns"><button data-dia="morale"' + (save.dia >= S.DIA.morale && n && !pr.morale ? '' : ' disabled') + '>' + (pr.morale ? '요청함 · ' : '') + '전원 초코파이 ' + dia() + S.DIA.morale + '</button><button data-dia="support"' + (save.dia >= S.DIA.support && n && !pr.support ? '' : ' disabled') + '>' + (pr.support ? '요청함 · ' : '') + '대대 지원 ' + dia() + S.DIA.support + '</button></div>';
    list.appendChild(head);
  }
  function renderMedals(list) {
    if (!M) return;
    var html = '<p class="sec-t">분실물 도감 (' + Object.keys(save.found).length + '/' + S.TREASURE.length + ')</p><div class="found-grid">' + S.TREASURE.map(function (t) {
      var n = save.found[t.id] || 0;
      return '<div class="' + (n ? 'got' : '') + '" style="--rc:' + S.RARITY[t.r].color + '">' + (n ? '<b>' + (n > 1 ? '×' + n : '★') + '</b>' + esc(t.name) : '<b>?</b>' + RAR[t.r]) + '</div>';
    }).join('') + '</div><p class="sec-t">훈장 (' + Object.keys(save.ach).length + '/' + S.ACH.length + ')</p>';
    html += M.achList(save).map(function (a) {
      return '<div class="ach' + (a.have ? ' have' : '') + '"><div class="medal">' + (a.have ? '★' : '?') + '</div><div><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + ' · ' + fmt(a.prog) + '/' + fmt(a.goal) + '</small><div class="pbar"><i style="width:' + Math.round(a.prog / a.goal * 100) + '%"></i></div></div><span class="rw">' + dia() + a.dia + (a.box ? ' +상자' : '') + '</span></div>';
    }).join('');
    list.insertAdjacentHTML('beforeend', html);
  }
  function rollCall() {
    if (!M) return false;
    var r = M.rollCall(save, Date.now());
    if (!r) return false;
    persistRaw();
    modal('<div class="m-rank"><div class="m-face">' + haengFace() + '</div><p class="kicker">아침 점호</p><h3>출석 ' + r.streak + '일째!</h3><p>' + (r.tier === 'legend' ? '7일 연속! <b>전설 보급 상자</b>다!' : r.tier === 'rare' ? '연속 출석 보상: <b>희귀 보급 상자</b>' : '오늘의 보급 상자 하나. 3일 연속이면 희귀, 7일이면 전설!') + '</p><div class="res-btns"><button class="btn ghost" data-m="later">나중에</button><button class="btn big" data-m="open">바로 열기</button></div></div>', function (k) { if (k === 'open') openBox(); });
    return true;
  }

  /* ── 상호작용: 행동 버튼, 눈덩이, 조준점, 자막, 분노, 임무, 버프, PX, 취침 ── */
  var curT = null, actAt = 0, subTimer = 0, hudA = {};
  var CAM_NEXT = { near: '멀리', far: '1인칭', fp: '위에서' };
  function camLabel() { if (V.camMode) $('h-cam-t').textContent = CAM_NEXT[V.camMode()] || '시점'; }
  function fp() { return !!(V.isFP && V.isFP()); }
  function fpLayout() {
    var on = fp() && V.mode && V.mode() !== 'demo';
    document.body.classList.toggle('fp', on);
    $('xhair').hidden = !on || $('hud').hidden;
  }
  function hintText() {
    $('hint').innerHTML = fp()
      ? '<b>왼쪽 끌면 걷고, 오른쪽 끌면 둘러본다</b><span>도구는 알아서 쓴다 · 가득 차면 <em>집하장</em> · 사람 앞에선 <em>행동</em> 버튼 (경례·요청·보고)</span>'
      : '<b>화면 아무 데나 끌면 걷는다</b><span>빗자루는 알아서 민다 · 위의 <em>지금 할 일</em>과 <em>노란 화살표</em>를 따라가라</span>';
  }
  function look() { return V.look ? V.look() : null; }
  function updAct(w, force) {
    if (!A) return;
    var now = Date.now();
    if (!force && now - actAt < 110) return;
    actAt = now;
    var lk = look(), t = lk ? A.best(w, lk, lk.fp) : null, key = t ? t.k + '|' + t.verb + '|' + t.name + '|' + (t.verb2 || '') + '|' + (t.ask || '') : '';
    curT = t; if (V.setFocus) V.setFocus(t);
    if (hudA.key !== key) {
      hudA.key = key;
      var b = $('act-btn'), b2 = $('act2-btn'); b.disabled = !t;
      b2.hidden = !(t && t.verb2); if (t && t.verb2) b2.textContent = t.verb2;
      $('act-name').textContent = t ? t.name : '';
      $('act-verb').textContent = t ? t.verb : '행동';
      b.classList.toggle('pulse', !!t && (t.k === 'car' || t.k === 'spread' || (t.k === 'haeng' && t.urgent)));
      $('acts').classList.toggle('off', !t);
      var salNow = !!t && t.k === 'officer' && t.urgent && t.verb === '경례';
      $('acts').classList.toggle('salute', salNow); document.body.classList.toggle('saluting', salNow);
      $('xh-t').innerHTML = t ? '<b>' + esc(t.verb) + '</b> · ' + esc(t.name) + (t.ask ? ' <small>' + esc(t.ask) + '</small>' : '') : '';
      $('xhair').classList.toggle('on', !!t);
    }
    var st = A.state(w);
    saluteHud(st);
    opHud(w, st);
    goalHud(st); twistHud(st);
    var hk = st.hand ? st.hand.name : '';
    if (hudA.hand !== hk) { hudA.hand = hk; $('h-hand').hidden = !st.hand; $('h-hand-n').textContent = hk; }
    var rk = st.reqs.map(function (q) { return q.who + q.item + Math.ceil(q.t / 5); }).join('|') + hk;
    if (hudA.rk !== rk) {
      hudA.rk = rk;
      var rs = st.reqs;
      $('h-reqs').innerHTML = rs.slice(0, 1).map(function (q) {
        var have = st.hand && st.hand.id === q.item;
        return '<div class="' + (have ? 'have' : '') + '"><span><b>' + esc(q.who) + '</b> ' + esc(q.want) + ' 떨어짐' + (rs.length > 1 ? ' <small>+' + (rs.length - 1) + '</small>' : '') + '</span><small>' + (have ? '들고 있다 → 넣어 주기' : esc(q.from) + '에서') + '</small><i><em style="width:' + Math.max(0, q.t / q.max * 100) + '%"></em></i></div>';
      }).join('');
    }
    var bk = st.buffs.map(function (x) { return x.name + ' ' + Math.ceil(x.t) + '초'; }).join('|');
    if (hudA.bk !== bk) { hudA.bk = bk; $('h-buffs').innerHTML = st.buffs.slice(0, 3).map(function (x) { return '<span>' + esc(x.name.length > 5 ? x.name.slice(0, 5) : x.name) + ' ' + Math.ceil(x.t) + '</span>'; }).join('') + (st.buffs.length > 3 ? '<span>+' + (st.buffs.length - 3) + '</span>' : ''); }
  }
  // v11 '지금 할 일' 한 줄: 화면 맨 위 가운데. 색 = 급한 정도 (빨강 경례·차 / 노랑 붓기·보급 / 파랑 빙판 / 초록 보고·신병 / 남색 치우기)
  function goalHud(st) {
    var g = st.goal, el = $('goal');
    if (!g) { el.hidden = true; hudA.goal = null; return; }
    var key = g.kind + '|' + g.text + '|' + g.sub + '|' + Math.round((g.pct || 0) * 50) + g.tone;
    if (hudA.goal === key) return;
    var changed = hudA.goalKind !== g.kind + g.text;
    hudA.goal = key; hudA.goalKind = g.kind + g.text;
    el.hidden = false; el.className = 'goal t-' + (g.tone || 'navy') + (g.pct !== undefined ? ' has-bar' : '');
    $('g-t').textContent = g.text; $('g-s').textContent = g.sub || '';
    $('g-f').style.width = g.pct !== undefined ? Math.round(Math.min(1, g.pct) * 100) + '%' : '0';
    if (changed) { void el.offsetWidth; el.classList.add('pop'); if (X && hudA.goalSeen && (g.tone === 'red' || g.kind === 'report' || g.kind === 'supply')) X.ding(); hudA.goalSeen = true; }
  }
  function twistHud(st) {
    var fv = st.fever > 0, sg = st.surge > 0;
    if (hudA.fv !== fv) { hudA.fv = fv; $('fever').hidden = !fv; document.body.classList.toggle('fever', fv); }
    if (fv) $('fever-t').textContent = '눈 값 ×' + S.FEVER.value + ' · ' + Math.ceil(st.fever) + '초';
    if (hudA.sg !== sg) { hudA.sg = sg; $('surge').hidden = !sg; document.body.classList.toggle('surge', sg); }
    if (sg) $('surge-t').textContent = '눈이 쏟아진다 · ' + Math.ceil(st.surge) + '초';
  }
  // 집하장에 부으면 초코파이가 화면 위 지갑으로 날아간다 (+금액 글자도 튀어 오른다)
  function coinFly(f) {
    var p = V.screenOf ? V.screenOf(f.x, f.y, 1) : null, dst = document.querySelector('#hud .pill.bank'), box = $('coins');
    if (!p || !p.on || !dst || !box || $('hud').hidden) return;
    var cr = $('cv').getBoundingClientRect(), r = dst.getBoundingClientRect(), sx = cr.left + p.x, sy = cr.top + p.y, dx = r.left + 22, dy = r.top + r.height / 2;
    var pop = document.createElement('b'); pop.className = 'pay-pop' + (f.full ? ' full' : ''); pop.textContent = '+' + fmt(f.pay) + (f.full ? ' 만재!' : '');
    pop.style.left = sx + 'px'; pop.style.top = sy + 'px'; box.appendChild(pop); setTimeout(function () { pop.remove(); }, 1100);
    var n = Math.max(3, Math.min(12, Math.round(Math.log(f.pay + 1) * 1.6))), reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Element.prototype.animate) return;
    for (var i = 0; i < n; i++) (function (i) {
      var c = document.createElement('i'); c.className = 'coin'; box.appendChild(c);
      var ox = (Math.random() - 0.5) * 90, oy = -30 - Math.random() * 60;
      var an = c.animate([
        { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.4)', opacity: 0 },
        { transform: 'translate(' + (sx + ox) + 'px,' + (sy + oy) + 'px) scale(1.15)', opacity: 1, offset: 0.35 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.7)', opacity: 1 }
      ], { duration: 620 + i * 45, easing: 'cubic-bezier(.45,0,.75,.55)', delay: i * 25 });
      an.onfinish = function () { c.remove(); if (i === n - 1) { dst.classList.remove('gain'); void dst.offsetWidth; dst.classList.add('gain'); if (X) X.coin(); } };
    })(i);
  }
  // 작업 지시서 카드: 마감 순서대로 3줄(지금 할 것 ▶), 빙판·차·보고 경고 한 줄, 처음엔 할 일 안내 한 줄
  function opHud(w, st) {
    var o = st.op; if (!o) { $('h-op').hidden = true; return; }
    var q = M ? M.questNow(save) : null, qp = q ? Math.min(q.goal, M.questProg(save, w, q)) : 0;
    var todo = o.tasks.filter(function (t) { return !t.done; }), cur = todo[0];
    var warn = st.car ? '중대장님 차 빠졌다! 진입로로 → 차 밀기 ' + Math.round(st.car.push * 100) + '%' : o.icy.length ? '빙판: ' + o.icy[0] + (o.icy.length > 1 ? ' 외 ' + (o.icy.length - 1) : '') + ' → 제설함 염화칼슘' : o.ready ? '다 했다! 행보관에게 "작업 완료 보고"' : '';
    var key = o.tasks.map(function (t) { return t.id + (t.done ? 'd' : Math.floor(t.pct * 50)) + (t.late ? 'l' : '') + (t.left < 300 ? Math.ceil(t.left / 10) : ''); }).join(',') + '|' + warn + '|' + (q ? q.id + qp : '') + o.jigeok;
    if (hud.op === key) return;
    hud.op = key;
    $('h-op').hidden = false;
    $('op-title').textContent = o.exam ? '진급 심사 지시서' : '작업 지시서';
    $('h-op').classList.toggle('exam', !!o.exam);
    $('op-n').textContent = o.done + '/' + o.tasks.length;
    var show = o.tasks.filter(function (t) { return !t.done; }).slice(0, 3);
    if (show.length < 3) show = show.concat(o.tasks.filter(function (t) { return t.done; }).slice(-(3 - show.length)));
    $('op-list').innerHTML = show.map(function (t) {
      var mins = Math.max(0, Math.ceil(t.left / S.DAY_LEN * (S.OP.end - S.OP.start)));
      var cls = t.done ? 'done' + (t.late ? ' late' : '') : t === cur ? 'cur' + (t.late ? ' late' : mins <= 15 ? ' soon' : '') : t.late ? 'late' : '';
      var right = t.done ? (t.late ? '늦음' : '✔') : t.late ? '마감 지남' : G.clockText(t.due) + (mins <= 30 ? ' · ' + mins + '분' : '');
      return '<li class="' + cls + '"><span>' + esc(t.name) + '</span><em>' + (t.done ? '' : Math.floor(t.pct * 100) + '/' + Math.round(t.goal * 100) + '%') + '</em><small>' + right + '</small>' +
        (t.done ? '' : '<i><u style="width:' + Math.min(100, t.pct / t.goal * 100) + '%"></u></i>') + '</li>';
    }).join('');
    $('op-warn').hidden = !warn; $('op-warn').textContent = warn; $('op-warn').classList.toggle('ok', !!o.ready && !st.car && !o.icy.length);
    $('op-tip').hidden = !q; if (q) $('op-tip').textContent = '할 일 ' + ((save.quest || 0) + 1) + '/' + S.QUESTS.length + ' · ' + q.text + (q.goal > 1 ? ' ' + qp + '/' + q.goal : '') + ' — ' + q.how;
  }
  function doAct(alt) {
    var w = V.world && V.world();
    if (!A || !w || V.mode() !== 'play') return;
    updAct(w, true);
    if (!curT || (alt === true && !curT.verb2)) { if (X) X.deny(); return; }
    var r = A.act(w, curT, look(), alt === true);
    if (!r.ok && r.why === 'money') toast('초코파이가 모자라다');
    if (!r.ok && r.why === 'rank') toast('아직 계급이 안 된다');
    if (!r.ok && r.why === 'zone') toast('구역 안으로 데려가서 배치해라');
    else if (!r.ok && r.why === 'stun') toast('넘어져서 아무것도 못 한다');
    if (r.ui === 'tool') { hud.ld = -1; if (V.shake) V.shake(1); }
    if (X && r.ok) X.pop();
    actAt = 0; hudA.key = null;
  }
  function subtitle(text) {
    var el = $('sub'); el.textContent = text; el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    clearTimeout(subTimer); subTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }
  function stars(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function onActEvent(f) {
    if (f.t === 'me') { subtitle(f.text); return true; }
    if (f.t === 'buff') { chip(f.name + ': ' + f.desc + ' (' + f.sec + '초)', 'good'); return true; }
    if (f.t === 'buffEnd') return true;
    if (f.t === 'hand') { if (f.item) toast(josa(f.name, '을', '를') + ' 들었다'); hud.op = null; return true; }
    return false;
  }
  // PX (생활관 저녁): 다음 작전 준비물. 사 두면 작전 시작부터 효과
  function openPX() {
    function render() {
      var items = A.prepItems(save);
      modal('<div class="m-rank px"><p class="kicker">PX · 저녁 개인정비</p><h3>내일 작전 준비물</h3><div class="px-list">' + items.map(function (it) {
        return '<button class="px-it' + (it.on ? ' on' : '') + '" data-px="' + it.id + '"' + (it.ok ? '' : ' disabled') + '><b>' + esc(it.name) + (it.on ? ' · 챙김' : '') + '</b><small>' + esc(it.need || it.desc) + '</small><span>' + pie() + fmt(it.cost) + '</span></button>';
      }).join('') + '</div><p class="px-bank">' + pie() + fmt(save.bank) + '</p><button class="btn big" data-m="close">나가기</button></div>', function () { renderHub(); });
      var b = $('modal-box'), base = b.onclick;
      b.onclick = function (e) {
        var px = e.target.closest('[data-px]');
        if (!px) return base(e);
        var r = A.prepBuy(save, px.getAttribute('data-px'));
        if (r.ok) { if (X) X.buy(); toast(esc(r.item.name) + ' 챙겼다! 내일 작전부터'); persistRaw(); } else if (X) X.deny();
        render();
      };
    }
    render();
  }

  /* ── 생활관 저녁: 공중전화 (하루 한 번) · 체력단련 ── */
  function phoneCall() {
    if (save.daily.call === save.day) { toast('오늘은 벌써 통화했다. 줄이 길다…'); return; }
    save.daily.call = save.day; save.stats.call = (save.stats.call || 0) + 1;
    var call = S.CALLS[(Math.random() * S.CALLS.length) | 0], rw = call.reward || {}, r = G.rankOf(save);
    if (rw.pie) { var p = Math.round(rw.pie * (1 + r) * G.incomeMult(save)); save.bank += p; save.life += p; }
    if (rw.mor) save.mor = Math.min(100, (save.mor || 80) + rw.mor);
    if (rw.buff) { save.prep = save.prep || {}; save.prep.hotpack = 1; }
    persistRaw();
    var C = JY.CHARS && JY.CHARS[call.who], lines = [['narr', '따르릉… 따르릉…']];
    call.lines.forEach(function (l) { lines.push([call.who, l]); });
    lines.push(['me', rw.pie || rw.buff ? '(…힘이 난다. 충성!)' : '(…그래도 목소리 들으니 좋다)']);
    if (rw.buff) lines.push(['narr', '여자친구가 핫팩을 보냈다. (내일 작전: 핫팩)']);
    playStory({ id: 'call', title: '공중전화 · ' + (C ? C.name : ''), lines: lines }, true, renderHub);
    if (X) X.ding();
  }
  var PULL_SVG = function (up) { return '<svg viewBox="0 0 120 120"><rect x="8" y="16" width="6" height="100" fill="#6b4a32"/><rect x="106" y="16" width="6" height="100" fill="#6b4a32"/><rect x="8" y="16" width="104" height="5" rx="2" fill="#9aa0a5"/>' +
    '<g transform="translate(0 ' + (up ? 0 : 26) + ')"><path d="M42 19 L50 44 M78 19 L70 44" stroke="#5b6a3a" stroke-width="9" stroke-linecap="round"/><circle cx="42" cy="19" r="5" fill="#2b3020"/><circle cx="78" cy="19" r="5" fill="#2b3020"/>' +
    '<circle cx="60" cy="' + (up ? 30 : 34) + '" r="13" fill="#f6c79c" stroke="#23281e" stroke-width="2.5"/><path d="M54 ' + (up ? 33 : 38) + ' q6 ' + (up ? 4 : -3) + ' 12 0" stroke="#23281e" stroke-width="2" fill="none"/><circle cx="55" cy="' + (up ? 28 : 32) + '" r="1.8"/><circle cx="65" cy="' + (up ? 28 : 32) + '" r="1.8"/>' +
    '<rect x="46" y="44" width="28" height="34" rx="8" fill="#5b6a3a" stroke="#23281e" stroke-width="2.5"/><path d="M52 78 v22 M68 78 v22" stroke="#3d4628" stroke-width="8" stroke-linecap="round"/></g></svg>'; };
  function pullUp() {
    var taps = 0, T0 = 0, LEN = 5000, done = false, up = false;
    modal('<div class="pull"><p class="kicker">저녁 체력단련 · 5초 동안 연타!</p><div class="pull-art" id="pull-art">' + PULL_SVG(false) + '</div><div class="pull-n" id="pull-n">0</div><div class="pull-t"><i id="pull-t"></i></div><button class="btn big pull-go" id="pull-go">올려!</button><p style="margin:0;color:var(--mute);font-size:13px">최고 ' + (save.stats.pullBest || 0) + '개 · 3개↑ 내일 적재 +25% · 15개↑ 상점</p></div>', function () { renderHub(); });
    var go = $('pull-go');
    function tick() {
      if (done) return;
      var left = Math.max(0, LEN - (Date.now() - T0));
      $('pull-t').style.width = (left / LEN * 100) + '%';
      if (left <= 0) return finish();
      requestAnimationFrame(tick);
    }
    function finish() {
      done = true;
      var n = Math.floor(taps / 2), r = A.pullDone(save, n);
      $('pull-n').textContent = n + '개!';
      go.textContent = r.dia ? '특급 전사! 상점 +1' : r.best ? '최고 기록!' : '수고했다';
      go.setAttribute('data-m', 'ok'); go.disabled = true; setTimeout(function () { go.disabled = false; }, 600);
      if (X) { if (r.best || r.dia) X.fanfare(); else X.pop(); }
      persistRaw();
    }
    go.addEventListener('pointerdown', function (e) {
      if (done) return;
      e.preventDefault();
      if (!T0) { T0 = Date.now(); requestAnimationFrame(tick); }
      taps++; up = !up;
      $('pull-art').innerHTML = PULL_SVG(up);
      $('pull-n').textContent = Math.floor(taps / 2);
      if (X && taps % 2 === 0) X.combo(taps * 3);
      vibrate(8);
    });
  }

  /* ── v8: 스토리 장면 · 꾸미기 · 수첩 · 처음부터 ── */
  var talking = false;
  function portrait(who) {
    if (!JY.art) return '';
    if (who === 'me') return JY.art.character(M.lookSpec(save));
    var C = JY.CHARS && JY.CHARS[who];
    return C && C.spec ? JY.art.character(C.spec) : '';
  }
  function whoName(who) {
    if (who === 'me') return (save.look.name || '김제설') + '<small>' + S.RANKS[G.rankOf(save)].name + ' · 나</small>';
    var C = JY.CHARS && JY.CHARS[who];
    return C ? esc(C.name) + '<small>' + esc(C.role || '') + '</small>' : '';
  }
  // 장면 재생: 한 줄씩, 화면을 누르면 다음. 'name' 줄에선 이름을 받는다
  function playStory(ch, replay, done) {
    var i = 0, box = document.querySelector('.talk-box'), wasPlay = V.mode && V.mode() === 'play';
    talking = true; if (wasPlay) V.pause(true);
    $('talk').hidden = false; $('talk-title').textContent = M.fill(ch.title, save);
    function show() {
      var L = ch.lines[i], who = L[0], ask = L[2] === 'name' && !replay;
      box.classList.toggle('narr', who === 'narr');
      $('talk-face').innerHTML = who === 'narr' ? '' : portrait(who);
      $('talk-who').innerHTML = who === 'narr' ? '' : whoName(who);
      $('talk-text').textContent = M.fill(L[1], save);
      $('talk-name').hidden = !ask; $('talk-next').hidden = ask;
      if (ask) { var inp = $('talk-input'); inp.value = save.look.name || ''; setTimeout(function () { try { inp.focus(); } catch (e) { /* 무시 */ } }, 50); }
      if (X) X.pop();
    }
    function next() {
      if (!$('talk-name').hidden) return;
      i++;
      if (i >= ch.lines.length) return end();
      show();
    }
    function end() {
      $('talk').hidden = true; talking = false; box.onclick = null;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (!replay) {
        var r = M.storyDone(save, ch); persistRaw();
        if (r && (r.dia || r.box || r.unlock)) chip('「' + M.fill(ch.title, save) + '」 ' + (r.dia ? '상점 +' + r.dia + ' ' : '') + (r.box ? '보급 상자 ' : '') + (r.unlock ? '· ' + r.unlock + ' 해금' : ''), 'good');
      }
      if (wasPlay) V.pause(false);
      if (done) done();
    }
    $('talk-ok').onclick = function (e) {
      e.stopPropagation();
      var v = ($('talk-input').value || '').trim().slice(0, 6);
      save.look.name = v || '김제설'; persistRaw(); lookChanged();
      try { $('talk-input').blur(); } catch (er) { /* 무시 */ }
      $('talk-name').hidden = true; $('talk-next').hidden = false; next();
    };
    $('talk-input').onkeydown = function (e) { if (e.key === 'Enter') $('talk-ok').onclick(e); e.stopPropagation(); };
    box.onclick = function (e) { if (e.target.closest('.talk-name')) return; next(); };
    show();
  }
  var storyAt = 0;
  function storyTick(w) {
    if (!M || talking || Date.now() - storyAt < 600) return;
    storyAt = Date.now();
    if (V.mode() !== 'play' || !$('modal').hidden || w.opEnd) return;
    var ch = M.storyNext(save, w);
    if (ch) playStory(ch, false);
  }
  function lookChanged() {
    if (JY.SNOW && M) JY.SNOW.FACES.me = M.lookSpec(save);
    if (V.lookChanged) V.lookChanged();
  }
  // ── 꾸미기: 옵션마다 그림 카드 + 위에 실제 모습 (대사 얼굴 · 3인칭 · 1인칭 손) ──
  var lookTab = 'face', LOOK_TABS = [['face', '얼굴', ['eyes', 'mouth', 'brows', 'head', 'skin', 'extras']], ['hat', '모자', ['hat']], ['wear', '군복·장갑', ['coat', 'glove']], ['tool', '넉가래', ['tool']]];
  var CROP = { hat: '14 -16 172 178', coat: '0 34 200 198' };
  function lookThumb(cat, o) {
    if (cat === 'glove') return '<svg viewBox="0 0 64 64"><path d="M18 58V30c0-4 3-6 6-6V12c0-3 2-5 4-5s4 2 4 5v10c0-3 2-5 4-5s4 2 4 5v4c0-2 2-4 4-4s4 2 4 5v18c0 9-6 14-14 14h-6c-6 0-10-3-10-8z" fill="' + o.color + '" stroke="#23281e" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 30c-4 0-8 3-8 8s4 8 8 8" fill="' + o.color + '" stroke="#23281e" stroke-width="2.5"/><rect x="16" y="54" width="30" height="8" rx="2" fill="#4d5b31" stroke="#23281e" stroke-width="2"/></svg>';
    if (cat === 'tool') {
      var gold = o.id === 'gold', wood = o.id === 'malnyeon', fill = gold ? 'url(#lg-gold)' : o.color;
      return '<svg viewBox="0 0 64 64">' + (gold ? '<defs><linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f5c542"/><stop offset="1" stop-color="#a87a12"/></linearGradient></defs>' : '') +
        '<path d="M44 6L26 40" stroke="#8a6a44" stroke-width="5" stroke-linecap="round"/><rect x="38" y="2" width="12" height="7" rx="3" transform="rotate(28 44 5)" fill="#3b3128"/>' +
        '<path d="M8 40h40l-4 14H12z" fill="' + fill + '" stroke="#23281e" stroke-width="2.5" stroke-linejoin="round"/><rect x="9" y="52" width="38" height="5" rx="1.5" fill="#555"/>' +
        (wood ? '<text x="28" y="50" text-anchor="middle" font-size="8" fill="#fff3d6" font-family="sans-serif">김말년</text><path d="M12 44h32" stroke="#6b4a32" stroke-width="1"/>' : '') +
        (gold ? '<path d="M14 43l3 3M38 42l3 4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' : '') + '</svg>';
    }
    if (!JY.art) return '';
    var L2 = {}; Object.keys(save.look).forEach(function (k) { L2[k] = save.look[k]; });
    if (cat === 'extras') { var ex = (L2.extras || []).filter(function (x) { return x !== o.id; }); ex.push(o.id); L2.extras = ex.slice(-3); }
    else L2[cat] = o.id;
    var svg = JY.art.character(M.lookSpec({ look: L2 }));
    return svg.replace('viewBox="0 0 200 232"', 'viewBox="' + (CROP[cat] || '24 26 152 150') + '"');
  }
  function renderLook(list) {
    var opts = M.lookOptions(save);
    var top = document.createElement('div'); top.className = 'look-top';
    var snap = V.snapshot ? '<figure><img id="pv-3p" alt="3인칭 모습"><figcaption>3인칭</figcaption></figure><figure><img id="pv-fp" alt="1인칭 손"><figcaption>1인칭 손</figcaption></figure>' : '';
    top.innerHTML = '<div class="look-pv"><figure class="pv-face">' + (JY.art ? JY.art.character(M.lookSpec(save)) : '') + '<figcaption>대사 얼굴</figcaption></figure>' + snap + '</div>' +
      '<label class="look-name">이름<input id="look-name" maxlength="6" value="' + esc(save.look.name || '') + '" placeholder="김제설"><small>상점 ' + save.dia + '개 · 상점으로 사거나 스토리로 연다</small></label>';
    list.appendChild(top);
    var nm = top.querySelector('#look-name');
    nm.onchange = function () { save.look.name = (nm.value || '').trim().slice(0, 6); persistRaw(); };
    nm.onkeydown = function (e) { e.stopPropagation(); };
    var tabs = document.createElement('div'); tabs.className = 'look-tabs';
    tabs.innerHTML = LOOK_TABS.map(function (t) { return '<button data-ltab="' + t[0] + '" aria-pressed="' + (lookTab === t[0]) + '">' + t[1] + '</button>'; }).join('');
    list.appendChild(tabs);
    var cats = LOOK_TABS.filter(function (t) { return t[0] === lookTab; })[0][2];
    cats.forEach(function (cat) {
      var sec = document.createElement('div'); sec.className = 'look-cat';
      sec.innerHTML = '<b>' + S.LOOK_NAMES[cat] + (cat === 'extras' ? ' <small>(3개까지 켜고 끈다)</small>' : '') + '</b><div class="lgrid">' + opts[cat].map(function (o) {
        var badge = o.on ? '<em class="on">사용 중</em>' : o.state === 'buy' ? '<em class="cost">' + dia() + o.dia + '</em>' : o.state === 'lock' ? '<em class="lock">스토리</em>' : '<em>보유</em>';
        return '<button class="lcard' + (o.on ? ' on' : '') + (o.state !== 'own' ? ' ' + o.state : '') + '" data-look="' + o.id + '" data-cat="' + cat + '" data-state="' + o.state + '" aria-pressed="' + o.on + '">' +
          '<span class="lthumb' + (cat === 'skin' ? ' skin' : '') + '">' + lookThumb(cat, o) + '</span><b>' + esc(o.name) + '</b>' + badge + '</button>';
      }).join('') + '</div>';
      list.appendChild(sec);
    });
    refreshSnaps();
  }
  // 3D 미리보기는 얼굴 그림이 늦게 오므로 몇 번 다시 찍는다
  var snapTimers = [];
  function refreshSnaps() {
    if (!V.snapshot) return;
    snapTimers.forEach(clearTimeout); snapTimers = [];
    [30, 400, 1100].forEach(function (ms) {
      snapTimers.push(setTimeout(function () {
        var a = document.getElementById('pv-3p'), b = document.getElementById('pv-fp'); if (!a || !b) return;
        var u1 = V.snapshot('third'), u2 = V.snapshot('fp'); if (u1) a.src = u1; if (u2) b.src = u2;
      }, ms));
    });
  }

  var WHEN = { start: '처음', dump1: '처음 집하장에 부으면', perfect1: '처음 완벽 제설하면', crew1: '첫 분대원이 오면', inspect: '사단장님 순시 날', canDischarge: '전역할 때', op1: '첫 작전이 끝나면', exam: '첫 진급 심사' };
  function whenText(w) { if (WHEN[w]) return WHEN[w]; if (w.indexOf('zone:') === 0) return josa((G.zoneById(w.slice(5)) || {}).name || '', '을', '를') + ' 맡으면'; if (w.indexOf('rank:') === 0) return S.RANKS[+w.slice(5)].name + ' 진급'; return ''; }
  function renderStory(list) {
    list.insertAdjacentHTML('beforeend', '<p class="sec-t">제설 수첩 (' + S.STORY.filter(function (c) { return save.story[c.id]; }).length + '/' + S.STORY.length + ')</p>' + S.STORY.map(function (c, i) {
      var done = !!save.story[c.id];
      return '<div class="story-row' + (done ? '' : ' lock') + '"><div class="n">' + (i + 1) + '</div><div><b>' + (done ? esc(M.fill(c.title, save)) : '???') + '</b><small>' + esc(whenText(c.when)) + (c.reward ? ' · 보상 있음' : '') + '</small></div>' + (done ? '<button data-replay="' + c.id + '">다시 보기</button>' : '<span></span>') + '</div>';
    }).join(''));
  }
  function resetAll() {
    modal('<div class="m-rank"><p class="kicker">처음부터 다시</p><h3>정말 다 지울까?</h3><p>초코파이, 상점, 분대원, 구역, 꾸미기, 스토리가 <b>전부</b> 사라지고 이병부터 다시 시작한다.</p><div class="res-btns"><button class="btn ghost" data-m="no">아니</button><button class="btn big" data-m="yes">다 지운다</button></div></div>', function (k) {
      if (k !== 'yes') return;
      try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
      save = G.newSave(); rankSeen = 0; lookChanged(); persistRaw(); title(); toast('처음부터! 이병 신병으로 전입한다');
    });
  }

  /* ── 시작 ── */
  function boot() {
    var hooks = { say: function (k) { say(k); }, tick: tick, event: onEvent };
    try { V.init($('cv'), hooks); } catch (e) { V = V2; V.init($('cv'), hooks); }
    document.body.classList.toggle('is3d', !!V.is3D);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { V.rebuildArt(); });
    $('say-face').innerHTML = haengFace();
    $('t-start').onclick = startOp;
    $('title').addEventListener('click', hubClick);
    $('h-speed').onclick = function () { if (!V.setSpeed) return; var s = V.speed && V.speed() > 1 ? 1 : 2; V.setSpeed(s); $('h-speed-t').textContent = '×' + s; $('h-speed').classList.toggle('on', s > 1); if (X) X.pop(); };
    try { JY.snowHaptic = localStorage.getItem('jeseol-haptic') !== '0'; } catch (e) { JY.snowHaptic = true; }
    lookChanged();
    $('s-go').onclick = closeShop;
    $('s-back').onclick = closeShop;
    $('h-shop').onclick = openShop;
    $('shop').addEventListener('click', onShopClick);
    $('h-pause').onclick = pause;
    $('h-scan').onclick = scan;
    $('h-box').onclick = openBox;
    $('h-cam').hidden = !V.toggleCam;
    if (V.toggleCam) camLabel();
    $('h-cam').onclick = function () { if (!V.toggleCam) return; V.toggleCam(); camLabel(); fpLayout(); hintText(); if (X) X.pop(); };
    window.addEventListener('keydown', function (e) {
      if (!$('talk').hidden && (e.key === ' ' || e.key === 'Enter' || e.key === 'e')) { e.preventDefault(); if ($('talk-name').hidden) document.querySelector('.talk-box').click(); return; }
      if (V.mode() !== 'play' || e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'Tab' || k === 'q') { e.preventDefault(); scan(); }
      if (k === 'e' || k === ' ' || k === 'Enter') { e.preventDefault(); doAct(false); }
      if (k === 'r') doAct(true);
      if (k === 'c') $('h-cam').onclick();
    });
    function press(id, fn) { var b = $(id); b.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); fn(); }); b.addEventListener('click', function (e) { if (e.detail === 0) fn(); }); }
    press('act-btn', function () { doAct(false); }); press('act2-btn', function () { doAct(true); });
    press('h-hand', function () { var w = V.world(); if (A && w && V.mode() === 'play' && A.drop(w)) { if (X) X.pop(); hudA.hand = null; } });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { persist(); if (V.mode() === 'play') pause(); } });
    window.addEventListener('pagehide', persist);
    var off = G.offline(save, Date.now());
    // 타이틀 화면: 뒤에선 생활관 앞 3D 장면이 돌고, 누르면 로비로
    if (V.lobby) V.lobby(save); else V.demo(save);
    show('splash');
    var entered = false;
    function enter(e) {
      if (entered) return; entered = true; if (e && e.preventDefault) e.preventDefault();
      if (X) { X.unlock(); X.pop(); }
      $('splash').classList.add('out');
      setTimeout(function () { $('splash').classList.remove('out'); title(); welcome(off); }, 260);
    }
    $('splash').addEventListener('pointerup', enter);
    window.addEventListener('keydown', function (e) { if (!entered && !$('splash').hidden && (e.key === 'Enter' || e.key === ' ')) enter(e); });
    if (/[?&]go\b/.test(location.search)) { entered = true; title(); welcome(off); }
    save.last = Date.now(); persistRaw();
  }
  function welcome(off) {
    if (off > 0) {
      save.bank += off; save.life += off; persistRaw(); renderHub();
      modal('<div class="m-rank"><div class="m-face">' + haengFace() + '</div><p class="kicker">당직 서는 동안</p><h3>분대원들이 정리해 뒀다</h3><p class="m-big">' + pie() + '+' + fmt(off) + '</p><p>쉬는 동안에도 분대원은 일한다. 그게 군대다.</p><button class="btn big" data-m="ok">수고했다</button></div>', function () { rollCall(); });
    } else rollCall();
  }

  function pause() {
    if (V.mode() !== 'play') return;
    V.pause(true); persist();
    modal('<div class="m-rank"><p class="kicker">잠깐 · ' + $('h-day').textContent + '</p><h3>작전 일시 정지</h3><p>치운 곳·시계·지시서는 그대로 저장된다. 생활관에 갔다 와도 이어서 한다.</p><div class="res-btns"><button class="btn ghost" data-m="quit">생활관으로</button><button class="btn big" data-m="go">계속 치운다</button></div></div>', function (k) {
      if (k === 'quit') { persist(); title(); } else V.pause(false);
    });
  }

  window.__SNOW = {
    view: function () { return V; },
    save: function () { return save; },
    setSave: function (s) { save = G.migrate(s); rankSeen = G.rankOf(save); persistRaw(); lookChanged(); },
    play: play, startDay: function () { play(false); }, startOp: startOp, briefing: briefing, help: help, settings: settings, renderHub: renderHub, openShop: openShop, closeShop: closeShop, title: title, persist: persist,
    openPX: openPX, phone: phoneCall, pullUp: pullUp, leave: goLeave, results: results,
    autopilot: function (b) { V.setAutopilot(b); },
    act: function (alt) { doAct(alt === true); }, openBox: function () { openBox(); }, target: function () { var w = V.world(); if (w) updAct(w, true); return curT; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.JY = window.JY || {});
