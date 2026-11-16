/* 제설각 — 화면 흐름 (v11): 타이틀 → 생활관 로비 → 제설 비상 브리핑 → 작전(05:30~08:00) → 검열 결과(★) → 진급 → 로비
 * v11: 한 손가락 조작 · 빛나는 원 위에 서면 저절로 · 화면 위 '지금 할 일' 한 줄 · 등에 쌓이는 눈 블록 · 폭풍 제설·폭설 경보 같은 반전.
 * 보급·장구·PX는 로비에서만. 작전 중엔 눈과 사람에만 집중한다. */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim, A = JY.SnowAct, M = JY.SnowMeta, V2 = JY.SnowView, V3 = JY.SnowView3D, X = JY.SnowSfx;
  var V = V3 && V3.supported() && !/[?&]2d/.test(location.search) ? V3 : V2;
  var KEY = 'jeseol-v22', OLD_KEYS = ['jeseol-v1'];   // v22: 처음부터 다시 (예전 저장 jeseol-v10·v8은 지우지 않고 그대로 둔다)
  try { OLD_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* 저장소 없음 */ }
  var G2 = JY.SnowGear;   // v18 장구·상자·체력·임무·패스
  var save = load(), tab = 'tool', sayTimer = 0, toastTimer = 0, lastSave = 0, hud = {}, rankSeen = G.rankOf(save), dirty = false;

  function $(id) { return document.getElementById(id); }
  // v10 저장이 없으면 v8 저장을 읽어서 옮긴다 (계급은 쌓은 초코파이로 이어 준다). v8 저장은 그대로 둔다
  function load() {
    var s;
    try {
      var raw = localStorage.getItem(KEY);
      s = G.migrate(raw ? JSON.parse(raw) : null);
    } catch (e) { s = G.newSave(); }
    if (JY.SnowMeta && JY.SnowMeta.fixLook) JY.SnowMeta.fixLook(s);   // v24 입어 보다 꺼진 저장
    return seenOld(s);
  }
  // v13: 이미 하던 저장이면 지금 열린 기능·버튼은 본 것으로 (갑자기 '새로 생김'·N이 잔뜩 뜨지 않게)
  function seenOld(s) {
    if (s.seen && !s.seen.v13) {
      if ((s.stats && s.stats.ops) >= 1) { G.newFeatures(s, true); ['shop', 'px', 'look', 'medal', 'story'].forEach(function (k) { s.seen['hub:' + k] = 1; }); }
      s.seen.v13 = 1;
    }
    return s;
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
    if (id !== 'play') { $('xhair').hidden = true; $('sub').hidden = true; $('report-btn').hidden = true; $('throw-btn').hidden = true; } else fpLayout();   // v20: 작전 중 보급 화면 위에 눈덩이 버튼이 떠 있었다
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

  /* ── 생활관 (저녁 개인정비 시간): 계급·근무평정·지난 작전 + 출동 / 보급 / 장구 / PX ── */
  function started() { return !!(save.stats.ops || save.snow || save.discharges || save.day > 1); }
  function midOp() { return !!(save.snow && save.dayT > 0 && save.op && save.op.day === save.day); }
  function title() {
    document.body.style.removeProperty('--hudb'); hud.hb = 0; $('throw-btn').hidden = true; hudA.tk = null;
    // 이야기 장면이 열린 채 생활관으로 오면 닫는다 (장면은 다음에 다시 나온다)
    if (talking) { $('talk').hidden = true; talking = false; document.querySelector('.talk-box').onclick = null; }
    show('title');
    if (V.lobby) V.lobby(save); else V.demo(save);
    var on = started(), mid = midOp();
    $('t-start-b').textContent = !on ? '전입 신고' : mid ? '작전 이어하기' : save.exam ? '진급 심사 출동' : '제설 출동';
    $('t-start-s').textContent = !on ? '이병 · 싸리비 하나로 시작' : mid ? '하던 데서 계속 · ' + mmss(S.DAY_LEN - (save.dayT || 0)) + ' 남음' : save.day + '일차 · ' + S.WEATHER[G.weatherFor(save).id].name;
    $('t-start').classList.toggle('exam', !!save.exam && !mid);
    document.body.classList.toggle('fresh', !on);
    renderHub();
  }
  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.2 6.6.6-5 4.5 1.5 6.6L12 16.6 6 19.9l1.5-6.6-5-4.5 6.6-.6z" fill="#ffd24a" stroke="#a87a12" stroke-width="1.2"/></svg>';
  // 로비: 왼쪽 위 내 카드(얼굴·계급·★ 막대), 아래 진급 길 + 소식 3줄, 오른쪽 생활관 버튼 배지
  function renderHub() {
    var r = G.rankOf(save), nr = G.nextRank(save), m = save.merit || 0, R0 = S.RANKS[r], on = started();
    var lo = save.lastOp, wx = G.weatherFor(save), base = R0.merit, top = nr ? nr.merit : S.DISCHARGE_MERIT;
    var prog = Math.max(0, Math.min(1, (m - base) / Math.max(1, top - base))), sv = G.service(save);
    $('hub-card').innerHTML =
      '<div class="lc-face">' + (JY.art && M ? JY.art.character(M.lookSpec(save)) : '') + '</div>' +
      '<div class="lc-body"><b class="lc-name' + ((save.look.name || '').length >= 5 ? ' long' : '') + '"><span class="ins">' + insignia(r) + '</span><span>' + R0.name + ' ' + esc(save.look.name || '김제설') + '</span></b>' +
      '<small class="lc-role">' + sv.hob + '호봉 · 군생활 <b>' + sv.pct + '%</b>' + (specLast() ? ' · ' + esc(specLast()) : sv.left ? ' · 전역 ' + sv.left + '개월 전' : ' · 전역!') + '</small>' +   // 좁으면 뒤(특기)가 잘린다   // v20 호봉·군생활 (분대원 수는 보급·브리핑에)
      '<div class="lc-bar' + (save.exam ? ' exam' : '') + '"><i style="width:' + Math.round(prog * 100) + '%"></i><span>' + (save.exam ? '진급 심사!' : '★' + m + ' / ' + top) + '</span></div><div class="lc-svc" aria-hidden="true"><i style="width:' + sv.pct + '%"></i></div></div>';
    $('lb-bank').textContent = save.bank >= 1e7 ? short(save.bank) : fmt(save.bank); $('lb-dia').textContent = fmt(save.dia);
    var steps = S.RANKS.map(function (R, i) { return { name: R.name, need: R.merit, i: i }; }).concat([{ name: '전역', need: S.DISCHARGE_MERIT, i: S.RANKS.length }]);
    var road = '<ol class="road">' + steps.map(function (s) {
      var cls = s.i < r ? 'past' : s.i === r ? 'now' : s.i === r + 1 ? 'next' + (save.exam ? ' exam' : '') : '';
      return '<li class="' + cls + '"><i>' + (s.i < S.RANKS.length ? insignia(s.i) : STAR_SVG) + '</i><b>' + s.name + '</b><small>' + (s.i === r ? '지금' : s.i === r + 1 && save.exam ? '심사!' : '★' + s.need) + '</small></li>';
    }).join('') + '</ol>';
    var nextZone = S.ZONES.filter(function (Z) { return !save.zones[Z.id]; })[0], news = [];
    if (!on) news.push('<li class="hl">끌어서 걷고, 눈을 <b>등에 쌓아</b> 집하장에 붓는다</li>', '<li>★이 쌓이면 <b>진급</b> — 계급이 오를수록 편해진다</li>');
    if (G.canDischarge(save)) news.push('<li class="hl" data-hub="dis">전역할 수 있다! <b>전역 신고 ›</b></li>');
    var wkN = on && G.weekOf(save); if (wkN) news.push('<li class="week' + (save.seen['week:' + Math.floor((save.day - 1) / 7)] ? '' : ' hl') + '">이번 주 <b>' + esc(wkN.name) + '</b> · ' + esc(wkN.line) + '</li>');
    if (save.exam && nr) news.push('<li class="exam">다음 작전 = <b>' + nr.name + ' 진급 심사</b> · ★★ 이상이면 진급</li>');
    if (lo) news.push('<li>지난 작전 <b class="st">' + stars(lo.stars) + '</b>' + (lo.exam ? (lo.pass ? ' · 심사 합격' : ' · 심사 불합격') : '') + '</li>');
    if (on) news.push('<li>내일 새벽 <b>' + S.WEATHER[wx.id].name + '</b>' + (wx.inspect ? ' · <b class="red">사단장님 순시</b>' : '') + '</li>');
    var nt = A && on ? A.nextTool(save) : null, tb = on ? G.previewBonus(save) : null;
    if (nt) news.push('<li>다음 장비 <b>' + esc(nt.name) + '</b> · ' + (r < (nt.rank || 0) ? S.RANKS[nt.rank].name + '부터' : save.bank >= nt.cost ? '<b class="ok">받을 수 있다! (보급 원)</b>' : pie() + fmt(save.bank) + '/' + fmt(nt.cost)) + '</li>');
    if (tb) news.push('<li>내일 특명 <b>' + esc(tb.text) + '</b> · ' + dia() + '+' + tb.dia + '</li>');
    if (nextZone && on) news.push('<li>★' + nextZone.need + (r < (nextZone.rank || 0) ? ' · ' + S.RANKS[nextZone.rank].name : '') + '이면 <b>' + esc(nextZone.name) + '</b>도 맡는다</li>');
    // v13: 소식은 두 줄만 — 지금 할 일(안내)이 있으면 그게 먼저
    var q = M && on ? M.questNow(save) : null;
    if (q) news.unshift('<li class="hl">할 일: <b>' + esc(q.text) + '</b> · ' + esc(q.how) + '</li>');
    var pri = function (li) { return /data-hub="dis"|class="exam"/.test(li) ? 0 : /할 일:/.test(li) ? 1 : /class="week hl"/.test(li) ? 1.5 : /받을 수 있다/.test(li) ? 2 : /특명/.test(li) ? 3 : /class="week"/.test(li) ? 3.5 : 4; };
    news = news.map(function (li, k) { return { li: li, p: pri(li), k: k }; }).sort(function (a, b) { return a.p - b.p || a.k - b.k; }).map(function (x) { return x.li; });
    $('hub').innerHTML = road + '<ul class="news">' + news.slice(0, 2).join('') + '</ul>';
    // v13: 생활관 버튼도 열린 것만 (처음엔 출동·교범·설정). 새로 열린 버튼엔 N
    var GATE = { shop: 'lobby', px: 'px', look: 'look', medal: 'box', story: 'lobby', gear: 'gear', mission: 'mission' };
    // v15: 교범은 설정 안으로, 훈장은 수첩 안으로 · v19: 공중전화·체력단련·포상휴가는 뺐다 (재미가 없었다)
    var HIDE = { help: true, medal: true };
    document.querySelectorAll('.lb-side [data-hub]').forEach(function (b) {
      var k = b.getAttribute('data-hub'), f = GATE[k];
      if (HIDE[k]) { b.hidden = true; return; }
      if (!f) return;
      var open = G.feat(save, f); b.hidden = !open;
      b.classList.toggle('new', open && on && !save.seen['hub:' + k]);
    });
    var any = G.offers(save), n = 0;
    ['tool', 'crew', 'factory', 'perk'].forEach(function (k) { (any[k] || []).forEach(function (o) { if (o.ok) n++; }); });
    $('hub-shop-n').hidden = !n; $('hub-shop-n').textContent = n;
    if (G2) {   // v18 배지: 장구 = 무료 상자·합성할 것, 임무 = 받을 보상
      var now0 = Date.now(), gn = (G2.freeIn(save, 'basic', now0) === 0 ? 1 : 0) + G2.mergeable(save).length + (save.boxes || []).length, mn = G2.missions(save, now0).claim + G2.pass(save, now0).claim;
      $('hub-gear-n').hidden = !gn || !G.feat(save, 'gear'); $('hub-gear-n').textContent = gn;
      $('hub-mission-n').hidden = !mn || !G.feat(save, 'mission'); $('hub-mission-n').textContent = mn;
      enPill();
    }
    $('hub-grid').hidden = !on;
  }
  // v18 생활관 위 체력 (일병부터)
  function enPill() {
    if (!G2) return;
    var on = G2.needs(save) && !midOp() && started(), e = G2.energy(save, Date.now()), el = $('t-start-en');
    $('lb-en').hidden = true;   // v18: 체력은 출동 버튼 안에 (오른쪽 버튼과 겹치지 않게)
    if (!el) { el = document.createElement('em'); el.id = 't-start-en'; $('t-start').appendChild(el); }
    el.hidden = !on; if (!on) return;
    el.innerHTML = BOLT + ' ' + e.v + '/' + e.max + (e.v < e.max ? ' <small>' + mmss(e.next) + '</small>' : '');
    el.classList.toggle('low', e.v < e.cost);
  }
  function hubClick(e) {
    var b = e.target.closest('[data-hub]'); if (!b) return;
    var k = b.getAttribute('data-hub');
    if (!save.seen['hub:' + k]) { save.seen['hub:' + k] = 1; b.classList.remove('new'); persistRaw(); }
    if (X) { X.unlock(); X.pop(); }
    if (k === 'shop') { tab = 'tool'; openShop(); }
    else if (k === 'px') openPX();
    else if (k === 'help') help();
    else if (k === 'medal' || k === 'story' || k === 'look' || k === 'dis' || k === 'gear' || k === 'mission') { tab = k === 'gear' && (save.boxes || []).length ? 'chest' : k; openShop(); }   // v20: 받은 상자가 있으면 상자 탭부터
    else if (k === 'settings') settings();
  }
  // 설정: 소리·진동·작전 시점·교범·전역·처음부터
  var CAM_NAME = { near: '3인칭 (추천)', fp: '1인칭' };   // v22: 두 개만
  function settings() {
    function render() {
      modal('<div class="m-rank set"><p class="kicker">설정</p><h3>설정</h3><div class="set-list">' +
        '<button data-set="sound"><span>소리</span><b>' + (X && X.muted() ? '끔' : '켬') + '</b></button>' +
        '<button data-set="haptic"><span>진동</span><b>' + (JY.snowHaptic ? '켬' : '끔') + '</b></button>' +
        (V.toggleCam ? '<button data-set="cam"><span>작전 시점</span><b>' + (CAM_NAME[V.camMode()] || '') + '</b></button>' : '') +
        '<button data-set="help"><span>제설 교범 다시 보기</span><b>›</b></button>' +
        (specNames() ? '<button data-set="spec"><span>특기 다시 고르기 <small>' + esc(specNames()) + '</small></span><b>상점 5</b></button>' : '') +
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
        else if (k === 'spec') {
          if (save.dia < 5) { toast('상점이 5개 있어야 한다 (지금 ' + save.dia + '개)'); return; }
          $('modal').hidden = true; save.dia -= 5; save.spec = {}; persistRaw(); if (X) X.dia(); renderHub(); afterHub();
        }
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
    var sdue = G.specDue(save); if (sdue) { chooseSpec(sdue, startOp); return; }   // v16: 특기를 안 골랐으면 출동 전에
    // v13: 처음 출동 전 교범 4장은 뺐다 (읽을 게 너무 많다) — 화면 위 '지금 할 일' 한 줄과 노란 화살표로 충분. 교범은 로비 버튼
    if (!started() && !save.story.prologue) { play(false); return; }   // 첫 전입: 프롤로그가 이어진다
    if (midOp()) { play(true); return; }
    if (G2 && !G2.energy(save, Date.now()).ok) { energyGate(startOp); return; }   // v18 출동 체력
    briefing();
  }
  // v18 출동 체력이 모자라면: 기다리거나 상점으로 채운다
  function energyGate(done) {
    var e = G2.energy(save, Date.now()), p = G2.refillPrice(save, Date.now());
    modal('<div class="m-rank"><p class="kicker">출동 체력</p><h3>체력이 모자라다</h3><p class="m-big">' + BOLT + ' ' + e.v + ' / ' + e.max + '</p><p>작전 1번에 ' + e.cost + ' · ' + Math.round(S.ENERGY.regen / 60) + '분에 1씩 찬다<br>다음 1까지 <b>' + mmss(e.next) + '</b> · 아침 점호 때마다 가득</p>' +
      '<div class="res-btns"><button class="btn ghost" data-m="wait">기다린다</button><button class="btn big" data-m="refill"' + (save.dia < p ? ' disabled' : '') + '>' + dia() + ' ' + p + '로 가득</button></div></div>', function (k) {
      if (k !== 'refill') return;
      if (G2.refill(save, Date.now())) { persistRaw(); if (X) X.dia(); toast('체력 가득! (상점 -' + p + ')'); renderHub(); if (done) done(); }
    });
  }
  function briefing() {
    var r = G.rankOf(save), wx = G.weatherFor(save), B = S.BRIEF[r], exam = !!save.exam, goal = G.opGoal(save, wx.id, exam), wxCut = S.OP.wx[wx.id] || 0, bo = G.previewBonus(save);
    var zs = S.ZONES.filter(function (Z) { return save.zones[Z.id]; }).sort(function (a, b) { return (a.due || 480) - (b.due || 480); });
    var line = M.fill(pick(B.lines), save).replace('{zone}', zs.map(function (Z) { return Z.name; }).join(', '));
    var notes = [];
    // v13: 특이사항은 오늘만 다른 것만 짧게 (심사·날씨·순시·출근 차량). 늘 같은 설명은 '새로 생김'에서 한 번만
    if (exam) notes.push('<li class="exam">진급 심사 ' + Math.round(goal * 100) + '% · ★★면 ' + G.nextRank(save).name + (save.examFail ? ' (재심사)' : '') + '</li>');
    var wkB = G.weekOf(save); if (wkB) { notes.push('<li class="good">이번 주 ' + esc(wkB.name) + ' — ' + esc(wkB.line) + '</li>'); save.seen['week:' + Math.floor((save.day - 1) / 7)] = 1; }
    if (wxCut) notes.push('<li class="good">' + S.WEATHER[wx.id].name + ' · 기준 −' + Math.round(wxCut * 100) + '%p</li>');
    if (wx.inspect) notes.push('<li class="red">사단장님 순시 — 바로 경례</li>');
    if (save.zones.E) notes.push('<li>출근 차량이 온다 — 진입로 먼저</li>');
    var nf = G.newFeatures(save, true).slice(0, 3);
    var prep = Object.keys(save.prep || {}).map(function (k) { var it = S.PREP.filter(function (p) { return p.id === k; })[0]; return it ? it.name : k === 'support' ? '대대 지원' : k === 'morale' ? '전원 초코파이' : k === 'power' ? '체력단련' : ''; }).filter(Boolean);
    if (prep.length) notes.push('<li class="good">챙긴 것: ' + esc(prep.join(', ')) + '</li>');
    var crewRows = r >= 2 && G.crewCount(save) ? crewPlan() : '';
    modal('<div class="m-brief">' +
      '<p class="kicker">' + save.day + '일차 제설 비상 · 위에서부터 순서대로</p>' +
      '<div class="brief-who"><div class="m-face">' + portrait(B.who) + '</div><p>' + esc(line) + '</p></div>' +
      (nf.length ? '<div class="brief-new"><b>새로 생김</b>' + nf.map(function (F) { return '<p><span>' + esc(F.name) + '</span> ' + esc(F.line) + '</p>'; }).join('') + '</div>' : '') +
      '<ol class="brief-list' + (zs.length > 3 ? ' many' : '') + '">' + zs.map(function (Z) { return '<li><b>' + esc(Z.name) + ' ' + Math.round(goal * 100) + '%</b>' + (zs.length > 2 ? '' : '<span>' + esc(Z.why || '') + '</span>') + '</li>'; }).join('') + '</ol>' +
      (notes.length ? '<ul class="brief-notes">' + notes.join('') + '</ul>' : '') +
      (bo ? '<div class="brief-bonus"><b>특명</b><span>' + esc(bo.text) + '</span><small>' + dia() + '+' + bo.dia + '</small></div>' : '') + crewRows +
      '<button class="btn big" data-m="go">' + (exam ? '심사 받으러 출동!' : '출동!') + (G2 && G2.needs(save) ? ' <small class="en-cost">' + BOLT + S.ENERGY.cost + '</small>' : '') + '</button></div>', function (k) { if (k === 'go') { if (G2) { G2.spend(save, Date.now()); persistRaw(); } play(false); } });
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
      banner(op.exam ? '진급 심사 작전' : save.day + '일차 제설 작전', (w.week ? w.week.name + ' · ' : '') + S.WEATHER[w.weather].name + ' · 제한 시간 ' + Math.round(w.dayLen / 60 * 10) / 10 + '분', 2000);
      if (op.exam || w.weather === 'heavy' || w.weather === 'blizzard') setTimeout(function () { say(op.exam ? 'exam' : 'heavy'); }, 900);
      if (X) X.whistle(false);
    }
    if (!save.seen.tut) { hintText(); $('hint').hidden = false; }
    scanReady = 0; $('h-scan').disabled = !V.scan; $('h-scan').classList.remove('cool');
    // v13: 버튼도 열린 것만 (처음엔 정지 하나)
    $('h-scan').hidden = !G.feat(save, 'scan'); $('h-cam').hidden = !V.toggleCam || !G.feat(save, 'cam');
    document.querySelector('#hud .pill.bank').classList.toggle('nodia', !G.feat(save, 'box'));
    var fresh = S.ZONES.filter(function (Z) { return save.seen['new' + Z.id]; })[0];
    if (fresh) {
      delete save.seen['new' + fresh.id]; persist();
      setTimeout(function () { if (V.focusZone) V.focusZone(fresh.id, 3.2); say('새 구역 「' + fresh.name + '」', 2600); }, resume ? 400 : 2300);
    }
  }
  // v15: 시각(05:30·07:00) 대신 '남은 시간' 하나만 — 실제 초로 센다 (작전 4분)
  function mmss(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  function dayLabel(w) {
    hud.clock = null;
    $('h-day').textContent = mmss(w.dayLen - w.time);
    $('h-wx').textContent = '남음 · ' + S.WEATHER[w.weather].name + (w.op && w.op.exam ? ' · 심사' : '');
  }

  function onEvent(f) {
    if (onActEvent(f)) return;
    if (onV6Event(f)) return;
    if (onOpEvent(f)) return;
    if (f.t === 'deer') { vibrate(80); }
    else if (f.t === 'crewUp') { chip(f.name + '들 손이 빨라졌다! 숙련 Lv ' + f.lv + ' (다음 작전부터 +' + f.pct + '%)', 'good'); if (X) X.ding(); }
    else if (f.t === 'skillUp') { chip(f.name + ' 숙련 Lv ' + f.lv + '! ' + f.unit + (f.id === 'arm' ? ' -' : ' +') + f.pct + '%', 'good'); if (X) X.ding(); vibrate([20, 20, 40]); }
    // v23 골때리는 돌발
    else if (f.t === 'chaos') {
      var CH = { poop: ['급똥 비상!!', '배가 꾸르륵… 생활관 화장실까지 ' + f.sec + '초'], cat: ['짬타이거 접근 중', '…초코파이 냄새를 맡은 것 같다'], tree: ['행보관님 지시: 나무 눈 털기', '나무 세 그루 · 털면 눈이 머리로…'], scenic: ['사단장님: "설경이 보고 싶구나"', '빨간 구역 눈은 ' + f.sec + '초 동안 치우지 마!'], hotwater: ['누가 뜨거운 물을 들고 뛰어온다', '"이거 부으면 금방 녹지 않습니까?!"'] }[f.id] || [f.name, ''];
      banner(CH[0], CH[1], 2600); if (X) X.whistle(true); vibrate([60, 40, 60]);
    }
    else if (f.t === 'catSteal') { banner('짬타이거가 초코파이를 물고 튀었다!!', '-' + fmt(f.loot) + ' · 잡으면 1.5배로 돌려받는다', 2200); if (X) X.meow && X.meow(); vibrate([40, 30, 40]); }
    else if (f.t === 'treeDump') { chip('우수수수… 눈이 목덜미로 들어갔다', 'warn'); if (X) X.thud(); vibrate(60); }
    else if (f.t === 'hotwater') { banner('뜨거운 물 → 빙판!', '뜨거운 물은 금방 얼어붙는다 · 염화칼슘 뿌려라', 2600); if (X) X.deny(); }
    else if (f.t === 'chaosEnd') {
      var E2 = { poop: f.ok ? ['살았다…', '해방감: 15초 동안 이동 +20%'] : ['……', '아무 일도 없었다. 아무 일도. (분대원 사기 -12)'],
        cat: f.ok ? ['짬타이거 검거!', '초코파이 +' + fmt(f.back || 0) + ' (1.5배)'] : f.gone ? ['짬타이거가 그냥 갔다', '휴…'] : ['짬타이거: (냠냠)', '초코파이는 돌아오지 않는다'],
        tree: f.ok ? ['나무 눈 털기 끝', '상점 +1 · +' + fmt(f.pay || 0)] : ['행보관: "나무 하나 터는 데 몇 분이야!"', ''],
        scenic: f.ok ? ['사단장님: "허허, 설경 좋구먼"', '상점 +2'] : ['"거기 치우지 말라고!!!"', '행보관이 쫓아온다! 7초 버텨!'],
        hotwater: ['빙판이 생겼다', '제설함에서 염화칼슘을 들고 가자'] }[f.id];
      if (E2) banner(E2[0], E2[1], 2400); if (X) { if (f.ok) X.fanfare(); else X.deny(); }
    }
    // v23 후임 마음의 편지 · 달래기 · 고양이
    else if (f.t === 'mapyeon') { banner('후임이 마음의 편지를 쓰러 간다!!', '행정반 가기 전에 쫓아가서 달래라', 2600); if (X) X.whistle(true); vibrate([80, 40, 80, 40, 80]); }
    else if (f.t === 'mapyeonFiled') { banner('마음의 편지 접수…', '내일 중대장님 면담 · 지적 +1 · ' + f.took, 2800); if (X) X.deny(); vibrate([120, 60, 120]); flash(); }
    else if (f.t === 'soothe') { chip('달래기 성공 · 초코파이 -' + f.cost + ' · 후임이 다시 일하러 간다', 'good'); if (X) X.ding(); }
    // v24 후임 폐급짓
    else if (f.t === 'pye') {
      var PY = { dump: ['후임이 폐급짓을 한다!!', f.who + '이(가) 치운 길에 눈을 버린다 · 가서 "야! 멈춰!"'], hide: ['후임이 사라졌다…?', '짱박혔다 · ' + f.spot + ' 쪽을 찾아봐라'], broke: ['"넉가래가… 부러졌습니다…"', '가서 제설함에서 새 거 가져오라고 해라'] }[f.id] || [f.name, ''];
      banner(PY[0], PY[1], 2600); if (X) X.whistle(true); vibrate([50, 30, 50]);
    }
    else if (f.t === 'pyeEnd' && !f.gone) {
      if (f.id === 'dump') { if (f.ok) chip('폐급 수습! 후임이 눈을 들고 집하장으로 간다', 'good'); else banner('치운 길이 다시 하얘졌다…', '후임: "다 버렸습니다! 잘했지 말입니다?"', 2400); }
      else if (f.id === 'hide') { if (f.ok) banner('짱박힌 후임 검거!', '숨겨 둔 냉동 압수 · 10초 동안 이동 +20% · +' + fmt(f.pay || 0), 2400); else banner('행보관: "너네 후임 냉동 먹고 있더라?!"', '분대원 사기 -8', 2400); }
      else if (f.id === 'broke') { if (f.ok) chip('후임이 제설함에서 새 넉가래를 들고 왔다', 'good'); else chip('행보관: "후임 놀고 있잖아!" · 분대원 사기 -8', 'warn'); }
      if (X) { if (f.ok) X.ding(); else X.deny(); }
    }
    else if (f.t === 'catHit') { chip('짬타이거가 화났다… (털 곤두섬)', 'warn'); if (X) X.meow && X.meow(); }
    // v22 역동: 고라니 떼 · 보급품 낙하 · 대왕 눈덩이
    else if (f.t === 'herd') { banner('고라니 떼다!!', f.n + '마리 — 전부 눈덩이로 벌러덩시키면 몰이 보너스', 2400); if (X) X.deer && X.deer(); vibrate([60, 40, 60, 40, 60]); }
    else if (f.t === 'herdAll') { banner('고라니 몰이 성공!', '+' + fmt(f.pay) + ' · 상점 +1', 2400); if (X) X.fanfare(); vibrate([40, 30, 40, 30, 120]); }
    else if (f.t === 'drop') { chip('보급품 낙하! ' + f.name + ' — 근처에 떨어졌다', 'good'); if (X) X.whoosh(); }
    else if (f.t === 'dropGet') {
      if (f.kind === 'crate') chip('보급품 상자! +' + fmt(f.pay) + (f.dia ? ' · 상점 +1' : '') + (f.parts ? ' · 부품 +' + f.parts : ''), 'good');
      else banner(f.name + '!', (f.kind === 'gold' ? '넉가래 범위 ×1.7' : '이동 +40%') + ' · ' + f.sec + '초', 1600);
      if (X) X.buy(); vibrate([30, 20, 50]);
    }
    else if (f.t === 'big') { banner('대왕 눈덩이 등장!', '몸으로 밀면 굴러가며 커진다 · 집하장에 넣으면 1.5배', 2600); if (X) X.ding(); }
    else if (f.t === 'bigGoal') { banner('대왕 눈덩이 골인!!', '+' + fmt(f.pay) + ' · 눈 ' + fmt(f.units) + ' · 콤보 +20', 2400); if (X) X.fanfare(); vibrate([60, 30, 60, 30, 160]); coinFly({ x: f.x, y: f.y, pay: f.pay, src: 'player' }); }
    else if (f.t === 'bigBowl') { chip('스트라이크! 고라니가 눈덩이에 깔렸다', 'good'); if (X) X.thud(); }
    else if (f.t === 'fun') { banner('발견! ' + f.name, '상점 +' + f.dia + ' · 수첩 ' + f.n + '/' + f.of, 2400); vibrate([30, 30, 60]); }
    else if (f.t === 'deerDown') vibrate([40, 30, 90]);
    else if (f.t === 'goal') { if (!(save.fun && save.fun.goal && hud.goalSaid)) chip('족구 한 골! +' + fmt(f.pay), 'good'); hud.goalSaid = 1; if (X) X.fanfare(); }
    else if (f.t === 'ride') { if (f.on) chip(f.name + ' 탑승!', 'good'); else if (!f.hand) chip('기름 떨어짐 · 정비고 앞에 세우면 찬다', 'warn'); }
    else if (f.t === 'drift') vibrate([30, 20, 30, 20, 30]);
    else if (f.t === 'chase') { chip(f.who + ' 쫓아온다! 7초만 버텨!', 'bad'); vibrate([80, 40, 80]); }
    else if (f.t === 'caught') { banner('잡혔다… 얼차려', f.took + (f.jigeok ? ' · 지적 +1' : ''), 2400); vibrate([120, 60, 120]); flash(); if (X) X.deny(); }
    else if (f.t === 'escaped') { chip('따돌렸다! ' + f.who + ' 포기', 'good'); if (X) X.ding(); }
    else if (f.t === 'meHit') { chip('고라니한테 받혔다!', 'bad'); vibrate([60, 40, 120]); flash(); }
    else if (f.t === 'snowball') { splat(); vibrate(50); }
    else if (f.t === 'car') chip('출근 차량 온다 · 진입로', 'warn');
    else if (f.t === 'full') vibrate(30);
  }
  // v10 작전 사건: 지시서 완료·지연, 보고, 빙판, 출근 차량, 처마 눈, 지적, 끝
  function onOpEvent(f) {
    if (f.t === 'task') { banner(f.late ? '늦었지만 완료' : '작업 완료!', f.task.name + ' ' + Math.round(f.task.goal * 100) + '% · +' + fmt(f.pay), 2000); if (X) { X.stamp(); X.coin(); } vibrate([30, 30, 60]); hud.op = null; return true; }
    if (f.t === 'taskLate') { chip('마감 지났다: ' + f.task.name, 'bad'); if (X) X.deny(); hud.op = null; return true; }
    if (f.t === 'bonus') { banner('특명 완료!', '상점 +' + f.dia, 2200); if (X) X.fanfare(); vibrate([40, 30, 80]); hud.op = null; return true; }
    if (f.t === 'help') { if (!hud.helpSaid) { hud.helpSaid = true; chip(f.e.def.name + ' → ' + f.name + ' 지원', 'good'); } return true; }
    if (f.t === 'opReady') { banner('지시서 다 했다!', '보고 원으로', 2400); if (X) X.fanfare(); hud.op = null; return true; }
    if (f.t === 'opEnd') { setTimeout(function () { results(f.res); }, f.res.why === 'report' ? 300 : 900); if (X) { X.whistle(true); } return true; }
    if (f.t === 'icy') { vibrate(40); hud.op = null; return true; }   // v13: '지금 할 일'이 알려 준다
    if (f.t === 'salted') { if (X) X.ding(); hud.op = null; return true; }
    if (f.t === 'slip') { chip('미끄덩!', 'bad'); vibrate([40, 30, 80]); return true; }
    if (f.t === 'carStuck') { banner('차가 빠졌다!!', '차 뒤에 붙어서 밀기', 2400); vibrate([80, 40, 80]); if (X) X.deny(); hud.op = null; return true; }
    if (f.t === 'carFree') { chip('영차! 차가 빠져나왔다', 'good'); if (X) X.ding(); return true; }
    if (f.t === 'carPass') { chip('차가 한 번에 올라갔다 · 상점 +1', 'good'); if (X) X.perfect(); return true; }
    if (f.t === 'push') { vibrate(15); return true; }
    if (f.t === 'roofWarn') { var Pw = V.world && V.world() && V.world().player; if (Pw && Math.hypot(Pw.x - (f.x + f.w / 2), Pw.y - f.y) > 100) return true; chip('처마 눈! 피해', 'warn'); vibrate([20, 20, 20]); return true; }   // v14: 근처일 때만
    if (f.t === 'roof') return true;
    if (f.t === 'jigeok') { chip('지적 ' + f.n + '건 (경례 놓침)', 'bad'); vibrate([80, 40, 80]); hud.op = null; return true; }
    if (f.t === 'nag') return true;
    if (f.t === 'prep') return true;
    if (f.t === 'toolGet') { banner(f.name + ' 보급!', '', 2000); if (X) X.buy(); if (V.shake) V.shake(2); vibrate([30, 30, 60]); hud.ld = -1; return true; }
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
    var nb = (save.boxes || []).length; if (hud.nb !== nb) { hud.nb = nb; $('h-box').hidden = !nb || !G.feat(save, 'box'); $('h-box-n').textContent = nb; }
    // v20: 작전 중 보급 버튼 (지금 살 수 있는 것 수) · 작업 완료 보고 버튼
    var nowS = Date.now();
    if (!(hud.supT > nowS)) {
      hud.supT = nowS + 700; var supOn = G.feat(save, 'lobby'), offs = supOn ? G.offers(save) : {}, sn = 0;
      ['tool', 'crew', 'perk'].forEach(function (k) { (offs[k] || []).forEach(function (o) { if (o.ok) sn++; }); });
      $('h-sup').hidden = !supOn; $('h-sup-n').hidden = !sn; $('h-sup-n').textContent = sn;
    }
    var rdy = !!(w.op && w.op.ready && !w.opEnd);
    if (hud.rdy !== rdy) { hud.rdy = rdy; $('report-btn').hidden = !rdy; if (rdy) { vibrate(30); if (X) X.ding(); } }
    if (rdy) { var pctA = Math.floor(G.pct(w) * 100), rs = pctA >= 100 ? '완벽! 누르면 바로 보고' : '누르면 바로 보고 · 일찍 할수록 수당'; if (hud.rs !== rs) { hud.rs = rs; $('report-s').textContent = rs; } }
    areaHud(w); comboHud(w);
    if (hud.ld !== ld || hud.cap !== P.cap) {
      hud.ld = ld; hud.cap = P.cap;
      $('h-load').textContent = full ? '가득!' : fmt(ld); $('h-cap').textContent = full ? '' : '/' + fmt(P.cap);
      $('h-cring').style.strokeDashoffset = String(119.4 * (1 - Math.min(1, P.load / P.cap)));
      $('h-carry').classList.toggle('full', full); $('h-carry').classList.toggle('mid', !full && P.load > P.cap * 0.6);
    }
    if (!save.seen.tut && P.moving && P.load > 0) { save.seen.tut = true; $('hint').hidden = true; }
    var ck = mmss(w.dayLen - w.time);
    if (hud.clock !== ck) { hud.clock = ck; $('h-day').textContent = ck; var late = w.dayLen - w.time < 30; $('h-day').classList.toggle('late', late); }
    // 알림 줄은 HUD(지금 할 일·진행 막대) 바로 아래에서 시작한다
    if (nowP - (hud.stackAt || 0) > 150) { hud.stackAt = nowP; var hb = $('hud').getBoundingClientRect().bottom; if (Math.abs(hb - (hud.hb || 0)) > 2) { hud.hb = hb; $('stack').style.top = Math.round(hb + 8) + 'px'; document.body.style.setProperty('--hudb', Math.round(hb) + 'px'); } }
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
    $('throw-btn').hidden = true; hudA.tk = null;
    if (G2 && !res.demo) { var px0 = G2.pass(save, Date.now()).xp; G2.onOpEnd(save, Date.now(), res.stars); res.passXp = G2.pass(save, Date.now()).xp - px0; }
    persistRaw();
    var r = res.rank, nr = S.RANKS[r + 1], R0 = S.RANKS[r];
    // v13: 읽을 게 적게 — 지시서는 '완료 N/M' 한 줄 + 못 한 줄·늦은 줄만 (최대 3)
    var okN = res.lines.filter(function (l) { return l.done && !l.late; }).length;
    var lines = ['<li class="' + (okN === res.lines.length ? 'ok' : '') + '"><span>지시서</span><b>' + okN + '/' + res.lines.length + ' 완료</b></li>'];
    res.lines.filter(function (l) { return !l.done || l.late; }).slice(0, 3).forEach(function (l) {
      lines.push('<li class="' + (l.done ? 'late' : 'bad') + '"><span>' + esc(l.name) + '</span><b>' + (l.done ? '늦음' : Math.floor(l.pct * 100) + '%') + '</b></li>');
    });
    // 특명 결과는 지시서 바로 아래 (작전마다 하나뿐인 목표)
    if (res.bonus) lines.splice(1, 0, '<li class="' + (res.bonus.done ? 'ok' : 'bad') + '"><span>특명: ' + esc(res.bonus.text) + '</span><b>' + (res.bonus.done ? '성공 · 상점 +' + res.bonus.dia : '실패') + '</b></li>');
    if (res.jigeok) lines.push('<li class="bad"><span>지적 (경례)</span><b>−' + res.jigeok + '건</b></li>');
    if (res.stuck) lines.push('<li class="bad"><span>출근 차량 빠짐</span><b>감점</b></li>');
    if (res.icy) lines.push('<li class="bad"><span>빙판 방치</span><b>' + res.icy + '곳</b></li>');
    if (res.early) lines.push('<li class="ok"><span>전 구역 100%</span><b>가점</b></li>');
    if ((res.ach || []).length) lines.push('<li class="ok"><span>새 훈장 ' + (res.ach.length > 1 ? res.ach.length + '개' : esc(res.ach[0].name)) + '</span><b>상점 +' + res.ach.reduce(function (a, x) { return a + x.dia; }, 0) + '</b></li>');
    var meritTxt = nr ? '★' + res.merit + ' / ' + nr.merit + ' (' + nr.name + ')' : '★' + res.merit + ' / ' + S.DISCHARGE_MERIT + ' (전역)';
    var prog = nr ? Math.min(1, (res.merit - R0.merit) / (nr.merit - R0.merit)) : Math.min(1, res.merit / S.DISCHARGE_MERIT);
    var head = res.exam ? (res.pass ? '진급 심사 합격!' : '진급 심사 불합격') : ['재작업…', '미흡', '양호', '특급 제설!'][res.stars];
    var who = res.stars >= 2 ? '수고했다. 오늘 제설 아주 좋았다.' : res.stars === 1 ? '이 정도로 사단장님 오시면 큰일 난다.' : '내일 새벽 다시 나온다. 각오해라.';
    if (res.exam && !res.pass) who = '불합격이다. 다음 작전에 재심사 (★★ 이상).' + (res.help ? ' 내일은 대대 지원을 붙여 주마.' : ' 마감 빠른 구역부터, 분대원은 큰 구역에.');
    // 어디서 점수가 깎였는지 한 줄로 (다음엔 뭘 고치면 되는지)
    var tip = '';
    if (res.stars < 3) {
      var miss = res.lines.filter(function (l) { return !l.done; }).sort(function (a, b) { return a.due - b.due; })[0], lateL = res.lines.filter(function (l) { return l.late; })[0];
      tip = res.icy ? '빙판을 그냥 두면 감점 — 제설함 염화칼슘부터' : res.jigeok ? '경례를 놓치면 지적 — 간부가 오면 바로 큰 경례 버튼' : res.stuck ? '차가 오기 전에 진입로 가운데를 먼저 치워 두면 안 빠진다'
        : miss ? miss.name + ' ' + Math.floor(miss.pct * 100) + '% — 분대원을 그쪽에 배치하거나, 마감 순서대로' : lateL ? lateL.name + ' 마감을 넘겼다 — 마감 빠른 줄부터' : '';
    }
    modal('<div class="m-res' + (res.exam ? ' exam' : '') + '"><p class="kicker">' + res.day + '일차 제설 작전 · 행보관 검열' + (res.why === 'report' ? ' · ' + mmss(V.world().dayLen - V.world().time) + ' 남기고 보고' : ' · 시간 끝') + '</p>' +
      '<div class="res-stars s' + res.stars + '">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= res.stars ? 'on' : '') + '" style="animation-delay:' + (0.25 + i * 0.28) + 's">★</i>'; }).join('') + '</div>' +
      '<h3>' + head + '</h3><p class="res-who">' + esc(who) + '</p>' + (tip ? '<p class="res-tip">다음엔: ' + esc(tip) + '</p>' : '') +
      // v13: 줄은 4개까지만 보이고, 나머지는 '자세히'를 눌러야 펼쳐진다
      '<ul class="res-lines op">' + lines.slice(0, 4).join('') + '</ul>' +
      (lines.length > 4 ? '<details class="res-more"><summary>자세히 (' + (lines.length - 4) + ')</summary><ul class="res-lines op">' + lines.slice(4).join('') + '</ul></details>' : '') +
      '<div class="res-pay"><span>' + pie() + '+' + fmt(res.pie + res.earlyPie) + (res.earlyPie ? ' <small>(조기 퇴근 ' + fmt(res.earlyPie) + ')</small>' : '') + '</span>' + (res.dia ? '<span>' + dia() + '상점 +' + res.dia + '</span>' : '') + (res.box ? '<span>보급 상자</span>' : '') + '</div>' +
      (res.passXp ? '<p class="res-pass">복무 패스 +' + res.passXp + '</p>' : '') + skillLine() +
      (res.payday ? '<p class="res-svc pay">월급날! ' + S.RANKS[res.rank].name + ' ' + res.payday.hob + '호봉 · ' + pie() + '+' + fmt(res.payday.pie) + '</p>' : res.svc1 !== undefined && res.svc1 > res.svc0 ? '<p class="res-svc">군생활 ' + res.svc0 + '% → <b>' + res.svc1 + '%</b></p>' : '') +
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
  // v16 진급 특기: 둘 중 하나 (밸런스 점검에서 '무엇을 사든 결과가 같다'가 나와서 넣은 갈림길)
  function specLast() { var n = specNames().split(' · ').filter(Boolean); return n.length ? n[n.length - 1] : ''; }   // 생활관 카드엔 마지막 특기 하나 (전부는 설정에)
  function specNames() { var sp = save.spec || {}; return (S.SPECS || []).map(function (g) { var o = g.opts.filter(function (q) { return q.id === sp[g.rank]; })[0]; return o ? o.name : ''; }).filter(Boolean).join(' · '); }
  function chooseSpec(g, done) {
    var R = S.RANKS[g.rank];
    modal('<div class="m-spec"><p class="kicker">' + R.name + ' 특기 · 하나만 고른다</p><h3>어떤 ' + R.name + '이 될래?</h3><div class="spec-cards">' + g.opts.map(function (o, i) {
      return '<button class="spec-c" data-m="' + i + '"><small>' + esc(o.tag) + '</small><b>' + esc(o.name) + '</b><span>' + esc(o.line) + '</span></button>';
    }).join('') + '</div><p class="spec-note">이번 복무 동안 그대로 (전역하면 다시 고른다)</p></div>', function (k) {
      var o = g.opts[+k] || g.opts[0]; save.spec = save.spec || {}; save.spec[g.rank] = o.id; persistRaw();
      toast('특기: ' + o.name); if (X) X.fanfare(); renderHub(); if (done) done();
    });
  }
  function afterHub() {
    var sd = G.specDue && G.specDue(save);
    if (sd) { chooseSpec(sd, afterHub); return; }
    var ch = M && M.storyNext(save, null);
    if (ch) { playStory(ch, false, function () { renderHub(); afterHub(); }); return; }
    if (G.canDischarge(save) && !save.seen.dis) { save.seen.dis = true; persistRaw(); modal('<div class="m-rank"><p class="kicker">전역 신고 가능</p><h3>이제 전역할 수 있다</h3><p>생활관의 <b>전역 신고</b>를 누르면 처음(이병)부터 다시 시작하지만, 전역 메달로 초코파이 보상이 영원히 늘어난다. 꾸미기·훈장·상점은 남는다.</p><button class="btn big" data-m="ok">알겠다</button></div>'); }
  }

  /* ── 보급·인력·공장 ── */
  // v15: 보급 탭은 셋만 (장비 · 인원 · 강화). 꾸미기·수첩(훈장 포함)·전역은 생활관 버튼에서 따로 연다 (탭 줄 없이)
  var TABS = [['tool', '장비'], ['crew', '인원'], ['up', '강화']];
  var SOLO = { look: '꾸미기', story: '수첩', medal: '수첩', dis: '전역' };
  var GTABS = [['gear', '장구'], ['chest', '보급 상자'], ['skill', '숙련']];   // v23 숙련 탭
  var GROUP = { gear: { title: '장구류', tabs: GTABS }, chest: { title: '장구류', tabs: GTABS }, skill: { title: '장구류', tabs: GTABS },
    mission: { title: '임무', tabs: [['mission', '일일 임무'], ['pass', '복무 패스']] }, pass: { title: '임무', tabs: [['mission', '일일 임무'], ['pass', '복무 패스']] } };
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
    if (o.kind === 'rideup') { var rk = o.id.split(':')[0]; return vehicle(rk === 'tractor' ? 'tractor' : rk === 'atv' ? 'plow' : 'cart', 26); }
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
  var opShop = false;   // v20: 작전 중에 연 보급 (닫으면 바로 작전으로)
  function openShop() {
    var w = V.world();
    opShop = !!(w && V.mode() === 'play' && !w.opEnd && (tab === 'tool' || tab === 'crew' || tab === 'up'));
    if (w && V.mode() === 'play') { G.serialize(w); V.pause(true); }
    dirty = false;
    show('shop');
    $('s-go').textContent = opShop ? '작전으로 돌아가기' : '생활관으로';
    renderShop();
  }
  function closeShop() {
    untry();
    persist();
    dirty = false;
    if (opShop) {
      opShop = false; var w = V.world();
      show('play'); if (A && w) A.applyStats(w);
      hud.bank = -1; hud.nb = -1; hud.supT = 0; hud.rdy = undefined; hud.hb = 0; hudA.tk = null; V.pause(false);   // hb: 알림 줄 위치를 다시 잡는다 (화면을 바꾸면 지워진다)
      return;
    }
    title();
  }

  function renderShop() {
    if (tab !== 'look' && lookTry) untry();
    $('s-bank').textContent = fmt(save.bank);
    var all = G.offers(save);
    all.up = (G.feat(save, 'perk') ? all.perk : []).concat(G.feat(save, 'factory') ? all.factory : []).concat(all.ride || []);
    var TGATE = { crew: 'crew', up: function () { return G.feat(save, 'perk') || G.feat(save, 'factory') || (all.ride || []).length; }, look: 'look', story: 'lobby', medal: 'lobby' };
    function gate(k) { var g = TGATE[k]; return !g || (typeof g === 'function' ? g() : G.feat(save, g)); }
    if (tab === 'perk' || tab === 'factory' || tab === 'zone') tab = 'up';
    if (!gate(tab)) tab = 'tool';
    var solo = SOLO[tab], grp = GROUP[tab];
    document.querySelector('.shop-head h2').textContent = grp ? grp.title : solo || '보급';
    $('s-tabs').hidden = !!solo && !grp;
    var tabList = grp ? grp.tabs : solo ? [] : TABS.filter(function (t) { return gate(t[0]); });
    $('s-tabs').innerHTML = tabList.map(function (t) {
      var n = grp ? (t[0] === 'skill' ? 0 : t[0] === 'chest' ? (G2.freeIn(save, 'basic', Date.now()) === 0 ? 1 : 0) + (save.boxes || []).length : t[0] === 'gear' ? G2.mergeable(save).length : t[0] === 'mission' ? G2.missions(save, Date.now()).claim : G2.pass(save, Date.now()).claim) : (all[t[0]] || []).filter(function (x) { return x.ok; }).length;
      return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + (n ? '<i class="dot">' + n + '</i>' : '') + '</button>';
    }).join('');
    var list = $('s-list'); list.innerHTML = '';
    if (tab === 'gear') { renderGear(list); return; }
    if (tab === 'skill') { renderSkill(list); return; }
    if (tab === 'chest') { renderChest(list); return; }
    if (tab === 'mission') { renderMission(list); return; }
    if (tab === 'pass') { renderPass(list); return; }
    if (tab === 'dis') { renderDischarge(list); return; }
    if (tab === 'look') { renderLook(list); return; }
    if (tab === 'story' || tab === 'medal') { renderStory(list); if (G.feat(save, 'box')) renderMedals(list); return; }
    if (tab === 'crew') crewHead(list);
    if (tab === 'up' && G.feat(save, 'factory') && G.procLvl(save, 'press')) {
      var mk = save.made, pm = G.procMult(save);
      var head = document.createElement('div'); head.className = 'fac-head';
      head.innerHTML = '<b>눈 집하장 가공 라인</b><span>부은 눈 값 ×' + pm.toFixed(1) + '</span>' + (mk.brick >= 1 || mk.snowman >= 1 ? '<small>지금까지 눈벽돌 ' + fmt(mk.brick) + '장 · 환영 눈사람 ' + fmt(mk.snowman) + '개</small>' : '<small>압축기를 들이면 부은 눈이 눈벽돌이 된다</small>');
      list.appendChild(head);
    }
    var items = all[tab] || [];
    if (!items.length) { list.insertAdjacentHTML('beforeend', '<p class="empty">살 것이 없다.</p>'); return; }
    // v15: 지금 살 수 있거나 가진 것만 펼쳐 두고, 잠긴 것은 첫 하나만 — 나머지는 '잠긴 것 더 보기'
    var open = items.filter(function (o) { return o.state !== 'lock' && o.state !== 'later'; }), shut = items.filter(function (o) { return o.state === 'lock' || o.state === 'later'; });
    var more = null;
    if (shut.length > 1) { more = document.createElement('details'); more.className = 'more-items'; more.innerHTML = '<summary>잠긴 것 ' + (shut.length - 1) + '개 더 보기</summary>'; }
    open.concat(shut).forEach(function (o, idx) {
      var row = document.createElement('div');
      row.className = 'item s-' + o.state + (o.ok ? ' can' : '');
      var meta = o.kind === 'crew' ? (o.after && o.state === 'lock' ? o.after : o.tag + ' · ' + o.n + '/' + Math.max(o.n, o.max) + '명' + (o.pend ? ' (전입 대기 ' + o.pend + ')' : '') + (o.dia ? ' · 상점 ' + o.dia + '개 필요' : '')) : o.kind === 'perk' || o.kind === 'proc' || o.kind === 'rideup' ? 'Lv ' + o.n + '/' + o.max : o.kind === 'tool' || o.kind === 'star' ? o.stat : o.kind === 'zone' ? '눈 한 칸에 초코파이 ' + o.value + '개 · ' + G.clockText(S.ZONES.filter(function (Z) { return Z.id === o.id; })[0].due || 480) + '까지' : '';
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
      (more && idx > open.length ? more : list).appendChild(row);
    });
    if (more) list.appendChild(more);
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
  function persistRaw() {
    try {
      var s2 = save;   // v24: 입어 보는 중인 꾸미기는 저장하지 않는다
      if (lookTry) { s2 = JSON.parse(JSON.stringify(save)); if (lookTry.cat === 'extras') s2.look.extras = lookTry.prev; else s2.look[lookTry.cat] = lookTry.prev; }
      localStorage.setItem(KEY, JSON.stringify(s2));
    } catch (e) { /* 저장 불가 */ }
  }

  /* ── v18 장구류 · 보급 상자 · 일일 임무 · 복무 패스 ── */
  var BOLT = '<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#ffd24a" stroke="#8a6200" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  var GEAR_SVG = {
    glove: '<path d="M7 21v-7l-2-4 2-1 2 3V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v10c0 3-2 6-5 6z" fill="#6b7d4a" stroke="#2c361c" stroke-width="1.2" stroke-linejoin="round"/>',
    boots: '<path d="M6 3h6v9l6 3c2 1 2 3 2 5v1H4V3z" fill="#2c2a26" stroke="#000" stroke-width="1"/><path d="M4 19h16" stroke="#777" stroke-width="2"/>',
    blade: '<path d="M11 2h2v12h-2z" fill="#8a5a2b"/><path d="M4 14h16l-2 6H6z" fill="#e7ae2f" stroke="#8a6200" stroke-width="1.2" stroke-linejoin="round"/>',
    pack: '<rect x="5" y="6" width="14" height="15" rx="3" fill="#6b7d4a" stroke="#2c361c" stroke-width="1.2"/><path d="M9 6V4h6v2" stroke="#2c361c" stroke-width="1.4" fill="none"/><rect x="8" y="12" width="8" height="5" rx="1" fill="#55663a"/>',
    patch: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#3a5a8c" stroke="#1c2c47" stroke-width="1.2"/><path d="M12 7l1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.6-3 1.6.6-3.2-2.4-2.3 3.3-.5z" fill="#ffd24a"/>'
  };
  function gearIcon(slot) { return '<svg class="g-ico" viewBox="0 0 24 24" aria-hidden="true">' + (GEAR_SVG[slot] || '') + '</svg>'; }
  function pctTxt(x) { return '+' + (Math.round(x * 1000) / 10) + '%'; }
  function rewardText(r) {
    if (!r) return '';
    var t = [];
    if (r.dia) t.push(dia() + r.dia); if (r.parts) t.push('부품 ' + r.parts); if (r.box) t.push((M.TIER[r.box] || { name: '상자' }).name.replace(' 보급 상자', ' 상자'));
    if (r.gear) t.push(G2.rarDef(r.gear).name + ' 장구'); if (r.pie) t.push('초코파이');   // v21: 작은 글씨 옆 아이콘이 깨져 보여서 글자로
    return t.join(' · ');
  }
  function renderGear(list) {
    var bn = G2.bonus(save), sum = S.GEAR.slots.map(function (sl) { return sl.unit + ' ' + pctTxt(bn[sl.stat]); }).join(' · ');
    var html = '<div class="g-eq">' + S.GEAR.slots.map(function (sl) {
      var it = G2.equipped(save, sl.id), R = it ? G2.rarDef(it.rar) : null;
      return '<div class="g-slot' + (it ? '' : ' empty') + '" style="--rc:' + (R ? R.color : '#c9c0a6') + '">' + gearIcon(sl.id) + '<b>' + sl.name + '</b>' + (it ? '<small>' + R.name + ' · Lv' + it.lv + '</small><em>' + sl.unit + ' ' + pctTxt(G2.itemStat(it)) + '</em>' : '<small>비어 있음</small>') + '</div>';
    }).join('') + '</div><p class="g-sum">' + sum + '</p>';
    var mg = G2.mergeable(save);
    html += '<div class="gr-bar"><span>정비 부품 <b>' + fmt(save.parts || 0) + '</b></span>' + (mg.length ? '<button class="btn small merge" data-gmerge="1">같은 것 3개 합성 (' + mg.length + ')</button>' : '<small>같은 칸·같은 등급 3개면 한 등급 위로</small>') + '</div>';
    var items = (save.gear ? save.gear.items : []).slice().sort(function (a, b) { return G2.rarIdx(b.rar) - G2.rarIdx(a.rar) || b.lv - a.lv || (a.slot < b.slot ? -1 : 1); });
    if (!items.length) html += '<p class="empty">아직 장구가 없다. <b>보급 상자</b>를 열어 보자 (일반 상자는 4시간마다 무료)</p>';
    html += items.map(function (it) {
      var sl = G2.slotDef(it.slot), R = G2.rarDef(it.rar), on = save.gear.eq[it.slot] === it.id, c = G2.upCost(it), max = it.lv >= R.maxLv;
      return '<div class="g-item' + (on ? ' on' : '') + '" style="--rc:' + R.color + '">' + gearIcon(it.slot) + '<div class="gi-info"><b>' + R.name + ' ' + sl.name + ' <small>Lv' + it.lv + '/' + R.maxLv + '</small></b><small>' + sl.unit + ' ' + pctTxt(G2.itemStat(it)) + (on ? ' · 끼는 중' : '') + '</small></div>' +
        '<div class="gi-btns">' + (on ? '' : '<button class="gi-b" data-geq="' + it.id + '">끼기</button>') + (max ? '<span class="gi-max">최대</span>' : '<button class="gi-b up" data-gup="' + it.id + '"' + (G2.canUp(save, it) ? '' : ' disabled') + '>강화 ' + pie() + short(c.pie) + ' · 부품 ' + c.parts + '</button>') + '</div></div>';
    }).join('');
    list.insertAdjacentHTML('beforeend', html);
  }
  // v23 숙련: 내 몸(삽질·짐 나르기·체력·눈덩이) + 분대원 종류별. 하는 만큼 오르고 전역해도 남는다
  function renderSkill(list) {
    function row(name, L, eff) { var k = L.max ? 1 : L.into / L.need; return '<div class="sk-row"><div class="sk-top"><b>' + esc(name) + '</b><span class="sk-lv">Lv ' + L.lv + (L.max ? ' 최대' : '') + '</span></div><div class="sk-bar"><i style="width:' + Math.round(k * 100) + '%"></i></div><small>' + eff + '</small></div>'; }
    var html = '<p class="sec-t">내 몸 숙련 <small>하는 만큼 오른다 · 전역해도 남는다</small></p>';
    html += S.SKILLS.list.map(function (K) { var L = G.skillLv(save, K.id), v = Math.round((L.lv - 1) * K.step * 1000) / 10; return row(K.name, L, K.unit + (K.eff === 'throw' ? ' -' : ' +') + v + '%' + (L.max ? '' : ' · 다음 Lv까지 ' + fmt(Math.ceil(L.need - L.into)) + ({ shovel: ' (부은 눈 ×1/30)', haul: ' (붓기 1번 = 1.5)', legs: ' (걸은 거리)', arm: ' (던지기·맞히기)' }[K.id] || ''))); }).join('');
    var owned = S.CREW.filter(function (C) { return G.crewN(save, C.id) > 0 || (save.crewXp || {})[C.id]; });
    html += '<p class="sec-t">분대 숙련 <small>일할수록 손이 빨라진다</small></p>';
    html += owned.length ? owned.map(function (C) { var L = G.crewLv(save, C.id); return row(C.name + ' ' + G.crewN(save, C.id) + '명', L, '속도·손 +' + Math.round((L.lv - 1) * S.SKILLS.crew.step * 100) + '%'); }).join('') : '<p class="empty">아직 분대원이 없다. 보급 → 인원에서 후임부터</p>';
    list.insertAdjacentHTML('beforeend', html);
  }
  function renderChest(list) {
    var now = Date.now(), got = save.boxes || [], html = '';
    // v20: 받아 둔 상자 (★★★·점호·훈장·패스) — 작전 중에만 열리던 것을 여기서도
    if (got.length && M) {
      var cnt = {}; got.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; });
      var tiers = ['legend', 'rare', 'common'].filter(function (t) { return cnt[t]; }).map(function (t) { return (M.TIER[t] ? M.TIER[t].name : t) + ' ' + cnt[t]; }).join(' · ');
      html += '<div class="chest got"><div class="ch-art">' + BOX_SVG + '</div><div class="ch-info"><b>받은 보급 상자 ' + got.length + '개</b><small>' + esc(tiers) + '</small><small>★★★·아침 점호·훈장·패스로 받은 것</small></div><div class="ch-btns">' +
        '<button class="btn small free" data-boxone="1">하나 열기</button>' + (got.length > 1 ? '<button class="btn small" data-boxall="1">모두 열기</button>' : '') + '</div></div>';
    }
    html += S.CHESTS.map(function (ch) {
      var odds = Object.keys(ch.odds).map(function (k) { return G2.rarDef(k).name + ' ' + ch.odds[k] + '%'; }).join(' · ');
      var free = ch.free ? G2.freeIn(save, ch.id, now) : -1, p = G2.price(save, ch.id, now);
      var pity = ch.pity ? '<small class="pity">' + G2.rarDef(ch.pity.rar).name + ' 확정까지 <b>' + G2.pityLeft(save, ch.id) + '번</b></small>' : '';
      var btns = (ch.free ? '<button class="btn small' + (free === 0 ? ' free' : '') + '" data-chest="' + ch.id + '" data-how="free"' + (free === 0 ? '' : ' disabled') + '>' + (free === 0 ? '무료로 열기' : '무료 ' + hms(free)) + '</button>' : '') +
        '<button class="btn small" data-chest="' + ch.id + '" data-how="dia"' + (save.dia >= p ? '' : ' disabled') + '>' + dia() + ' ' + p + '</button>' +
        (ch.ten ? '<button class="btn small" data-chest="' + ch.id + '" data-how="ten"' + (save.dia >= ch.ten ? '' : ' disabled') + '>10개 ' + dia() + ' ' + ch.ten + '</button>' : '');
      return '<div class="chest c-' + ch.id + '"><div class="ch-art">' + chestArt(ch.id) + '</div><div class="ch-info"><b>' + ch.name + '</b><small>' + odds + '</small><small>장구 1 + 정비 부품 ' + ch.parts[0] + '~' + ch.parts[1] + (Array.isArray(ch.dia) ? ' · 오늘 살수록 싸진다' : '') + '</small>' + pity + '</div><div class="ch-btns">' + btns + '</div></div>';
    }).join('');
    html += '<p class="info-note">상점은 작전 ★★★·칼경례·특명·임무·훈장으로 모은다. 장구·상자·부품은 <b>전역해도 남는다</b>.</p>';
    list.insertAdjacentHTML('beforeend', html);
  }
  function chestArt(id) {
    var col = id === 'elite' ? ['#3a2a5a', '#ffbf3a'] : id === 'good' ? ['#2a4a7a', '#7fd0ff'] : ['#6b5420', '#e8d9a6'];
    return '<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="4" y="14" width="40" height="22" rx="3" fill="' + col[0] + '"/><path d="M4 16a20 10 0 0 1 40 0z" fill="' + col[0] + '" stroke="' + col[1] + '" stroke-width="2"/><rect x="21" y="16" width="6" height="8" rx="1.5" fill="' + col[1] + '"/><path d="M4 22h40" stroke="' + col[1] + '" stroke-width="2"/></svg>';
  }
  function hms(sec) { var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + '시간 ' + m + '분' : m + '분'; }
  function renderMission(list) {
    var m = G2.missions(save, Date.now());
    var html = '<div class="mi-pts"><div class="mi-bar"><i style="width:' + Math.round(m.pts / m.max * 100) + '%"></i></div><b>' + m.pts + '점</b></div><div class="mi-steps">' + m.steps.map(function (st, i) {
      return '<button class="mi-step' + (st.got ? ' got' : st.can ? ' can' : '') + '" data-mstep="' + i + '"' + (st.can ? '' : ' disabled') + '><b>' + st.at + '점</b><small>' + (st.got ? '받음' : rewardText(st.reward)) + '</small></button>';
    }).join('') + '</div>';
    html += m.list.map(function (q) {
      return '<div class="mi-row' + (q.done ? ' done' : '') + '"><span>' + esc(q.text) + '</span><div class="mi-bar small"><i style="width:' + Math.round(q.prog / q.goal * 100) + '%"></i></div><b>' + (q.done ? '✔ 20점' : q.prog + '/' + q.goal) + '</b></div>';
    }).join('');
    html += '<p class="info-note">임무는 날마다 바뀐다. 하나 끝낼 때마다 복무 패스 +' + S.PASS.mission + '</p>';
    list.insertAdjacentHTML('beforeend', html);
  }
  function renderPass(list) {
    var p = G2.pass(save, Date.now()), html = '<div class="pass-head"><div><b>복무 패스 ' + p.tier + ' / ' + S.PASS.tiers + '단계</b><small>시즌 끝까지 ' + p.days + '일 · 작전 ★마다 +' + S.PASS.opStar + ' · 임무 +' + S.PASS.mission + ' · 점호 +' + S.PASS.roll + '</small></div>' +
      '<div class="mi-bar"><i style="width:' + (p.tier >= S.PASS.tiers ? 100 : p.into) + '%"></i></div><div class="pass-btns">' +
      (p.claim ? '<button class="btn small" data-pclaim="1">보상 받기 (' + p.claim + ')</button>' : '') +
      (p.prem ? '<span class="prem-on">프리미엄 열림</span>' : '<button class="btn small prem" data-pprem="1"' + (save.dia >= S.PASS.premium ? '' : ' disabled') + '>프리미엄 열기 ' + dia() + ' ' + S.PASS.premium + '</button>') + '</div></div>';
    html += '<div class="pass-list"><div class="pl-h"><span>단계</span><span>무료</span><span>프리미엄</span></div>';
    for (var t = 1; t <= S.PASS.tiers; t++) {
      var reach = t <= p.tier, gf = save.pass.got[t], gp = save.pass.gotP[t];
      html += '<div class="pl-row' + (reach ? ' reach' : '') + (t === p.tier + 1 ? ' next' : '') + '"><b>' + t + '</b><span class="' + (gf ? 'got' : '') + '">' + rewardText(G2.passReward(t, false)) + '</span><span class="prem-c' + (gp ? ' got' : '') + (p.prem ? '' : ' locked') + '">' + rewardText(G2.passReward(t, true)) + '</span></div>';
    }
    list.insertAdjacentHTML('beforeend', html + '</div>');
  }
  // 상자 연 결과: 장구 카드 + 부품 (+ 합성할 게 생겼으면 알려 준다)
  function chestReveal(r) {
    var items = r.got.map(function (g) { var R = G2.rarDef(g.item.rar), sl = G2.slotDef(g.item.slot); return '<div class="cr-it' + (g.pity ? ' pity' : '') + '" style="--rc:' + R.color + '">' + gearIcon(sl.id) + '<b>' + R.name + '</b><small>' + sl.name + '</small></div>'; }).join('');
    var parts = r.got.reduce(function (a, g) { return a + g.parts; }, 0), best = r.got.reduce(function (a, g) { return Math.max(a, G2.rarIdx(g.item.rar)); }, 0);
    if (X) { if (best >= 3) X.fanfare(); else X.dia(); }
    modal('<div class="m-chest"><p class="kicker">' + esc(r.chest.name) + '</p><h3>' + (best >= 4 ? '전설!!' : best >= 3 ? '영웅!' : '보급 도착') + '</h3><div class="cr-grid' + (r.got.length > 1 ? ' many' : '') + '">' + items + '</div><p>정비 부품 +' + parts + (G2.mergeable(save).length ? ' · <b>합성할 수 있는 장구가 생겼다</b>' : '') + '</p><button class="btn big" data-m="ok">좋다!</button></div>', function () { renderShop(); });
  }

  function onShopClick(e) {
    // v18 장구·상자·임무·패스
    var bx = e.target.closest('[data-boxone],[data-boxall]');
    if (bx) { if (bx.hasAttribute('data-boxall')) openAllBoxes(); else openBox(); return; }
    var gq = e.target.closest('[data-geq],[data-gup],[data-gmerge],[data-chest],[data-mstep],[data-pclaim],[data-pprem]');
    if (gq && G2) {
      var now = Date.now(), r;
      if (gq.hasAttribute('data-geq')) { G2.equip(save, +gq.getAttribute('data-geq')); if (X) X.pop(); }
      else if (gq.hasAttribute('data-gup')) { r = G2.upgrade(save, +gq.getAttribute('data-gup')); if (r) { if (X) X.buy(); toast(G2.rarDef(r.item.rar).name + ' ' + G2.slotDef(r.item.slot).name + ' Lv' + r.item.lv + '!'); } else { if (X) X.deny(); toast('초코파이나 정비 부품이 모자라다'); } }
      else if (gq.hasAttribute('data-gmerge')) { r = G2.mergeAll(save); if (r.length) { if (X) X.fanfare(); toast('합성! ' + r.map(function (it) { return G2.rarDef(it.rar).name + ' ' + G2.slotDef(it.slot).name; }).join(', ')); } }
      else if (gq.hasAttribute('data-chest')) { r = G2.open(save, gq.getAttribute('data-chest'), gq.getAttribute('data-how'), now); if (r) { persistRaw(); renderShop(); chestReveal(r); return; } if (X) X.deny(); toast('상점이 모자라다'); }
      else if (gq.hasAttribute('data-mstep')) { r = G2.claimStep(save, now, +gq.getAttribute('data-mstep')); if (r) { if (X) X.dia(); toast('임무 보상: ' + r.join(' · ')); } }
      else if (gq.hasAttribute('data-pclaim')) { r = G2.claimPass(save, now); if (r.length) { if (X) X.fanfare(); toast('패스 보상 ' + r.length + '개: ' + r.slice(0, 3).join(' · ') + (r.length > 3 ? ' …' : '')); } }
      else if (gq.hasAttribute('data-pprem')) { if (G2.buyPremium(save, now)) { if (X) X.fanfare(); toast('프리미엄 패스 열림! 지난 단계 보상도 받을 수 있다'); } }
      persistRaw(); renderShop(); return;
    }
    var lt = e.target.closest('[data-ltab]');
    if (lt) { untry(); lookTab = lt.getAttribute('data-ltab'); renderShop(); return; }
    if (e.target.closest('[data-luntry]')) { untry(); if (X) X.pop(); renderShop(); return; }
    var lb = e.target.closest('[data-lbuy]');
    var lk = e.target.closest('[data-look]');
    if (lb && lookTry) lk = { getAttribute: function (k) { return k === 'data-cat' ? lookTry.cat : k === 'data-look' ? lookTry.id : 'buy!'; } };
    if (lk) {
      var cat = lk.getAttribute('data-cat'), id = lk.getAttribute('data-look'), st = lk.getAttribute('data-state');
      if (st === 'buy' && !(lookTry && lookTry.cat === cat && lookTry.id === id)) { tryOn(cat, id); if (X) X.pop(); lookTab = LOOK_TABS.filter(function (t) { return t[2].indexOf(cat) >= 0; })[0][0]; renderShop(); var sl = $('s-list'); if (sl) { try { sl.scrollTo({ top: 0, behavior: 'smooth' }); } catch (er) { sl.scrollTop = 0; } } return; }   // 입어 본 모습이 보이게 맨 위로
      if (st === 'buy' || st === 'buy!') {
        var tier = M.tierOf(cat, id); untry();
        if (M.buyLook(save, cat, id)) { if (X) { if (tier === 'l' || tier === 'e') X.fanfare(); else X.dia(); } toast((tier ? '[' + S.LOOK_TIER[tier].name + '] ' : '') + M.lookName(cat + ':' + id) + ' 획득! 멋 +' + S.LOOK_TIER[tier || 'c'].pts); vibrate(tier === 'l' ? [30, 30, 30, 30, 120] : 30); }
        else { tryOn(cat, id); if (X) X.deny(); toast('상점이 모자라다 (' + M.priceOf(save, cat, id) + '개 필요)'); }
      }
      else if (st === 'own') { untry(); M.setLook(save, cat, id); if (X) X.pop(); }
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
    if (n < 15 || !G.feat(save, 'combo')) { if (!el.hidden) el.hidden = true; comboShown = 0; return; }
    if (n === comboShown) return;
    comboShown = n; el.hidden = false;
    $('combo-n').textContent = '콤보 x' + n;
    var nf = S.FEVER.at.filter(function (a) { return a > n; })[0];
    $('combo-t').textContent = w.fever > 0 ? '폭풍 제설 중!' : nf && nf - n <= 15 ? '폭풍까지 ' + (nf - n) : '';   // v13: 평소엔 숫자만
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
      // v13: 흔한 건 그 자리 글자만, 희귀·전설만 배너
      if (f.item.r === 'r' || f.item.r === 'l') { banner(f.item.name + '!!', f.item.dia ? '상점 +' + f.item.dia : '', 2400); if (X) X.fanfare(); vibrate([40, 30, 40, 30, 120]); }
      else if (X) X.found();
      return true;
    }
    if (f.t === 'combo') return true;
    if (f.t === 'comboEnd') return true;
    if (f.t === 'zonePerfect') { banner(f.name + ' 완벽 제설!', '구역 전체 100% · +' + fmt(f.bonus) + (f.mine ? ' · 상점 +2' : ''), 2600); if (X) X.fanfare(); vibrate([60, 40, 60]); return true; }
    if (f.t === 'allClear') { banner('눈 한 톨 없다!', '맡은 구역 전부 100% · +' + fmt(f.bonus) + ' · 행보관에게 보고하자', 2800); if (X) { X.fanfare(); X.bugle(); } return true; }
    if (f.t === 'locked') { hud.lockSaid = hud.lockSaid || {}; if (hud.lockSaid[f.zone]) return true; hud.lockSaid[f.zone] = 1; var LZ = G.zoneById(f.zone); chip('출입 통제 · ' + f.name + ' (★' + (LZ ? LZ.need : 0) + (LZ && G.rankOf(save) < (LZ.rank || 0) ? ' · ' + S.RANKS[LZ.rank].name + '부터' : '') + ' 되면 맡는다)', 'warn'); if (X) X.deny(); vibrate(40); return true; }
    if (f.t === 'ach' && V.world && V.world() && V.world().opEnd) return true;   // 결과 화면에 같이 나온다
    if (f.t === 'ach') { banner('훈장: ' + f.ach.name, f.ach.desc + ' · 상점 +' + f.ach.dia + (f.ach.box ? ' · 보급 상자' : ''), 2600); if (X) X.fanfare(); return true; }
    if (f.t === 'officer') {
      if (f.state === 'arrive') { if (X) X.bugle(); }
      else if (f.state === 'near') { if (X) X.whistle(false); vibrate([30, 30, 30]); }
      else if (f.state === 'miss') { chip(f.title + '께 경례를 안 했다!' + (f.id === 'lt' ? '' : ' (지적)'), 'bad'); vibrate([80, 40, 80]); }
      else if (f.state === 'saluted') { chip(f.quick ? '칼경례!' + (f.dia ? ' 상점 +' + f.dia : '') : '경례 완료', 'good'); if (f.quick && X) X.perfect(); }
      else if (f.state === 'report') { chip(f.res === 'good' ? f.title + ' 칭찬! 보고 대성공' : f.res === 'ok' ? '보고 무난 · +' + fmt(f.pie || 0) : '보고했다가 혼났다…', f.res === 'bad' ? 'bad' : 'good'); }
      else if (f.state === 'help') chip('소대장님이 같이 치운다', 'good');
      return true;
    }
    if (f.t === 'quest') {
      chip('✔ ' + f.q.text + (f.dia ? ' · 상점 +' + f.dia : ''), 'good');
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
    modal('<div class="box-open"><p class="kicker">보급 상자</p><h3 class="tier-' + tier + '">' + T0.name + '</h3><div class="box-art shake" id="box-art"><div class="box-glow" style="background:conic-gradient(from 0deg,transparent,' + T0.color + ',transparent 30%,' + T0.color + ',transparent 60%)"></div>' + BOX_SVG + '</div><div id="box-loot" class="box-loot"></div><button class="btn big" data-m="ok" id="box-ok" disabled>여는 중…</button></div>', function () { if (wasPlay) V.pause(false); if (save.boxes.length) setTimeout(function () { hud.nb = -1; }, 50); if (!$('shop').hidden) renderShop(); else if (!$('title').hidden) renderHub(); });
    if (X) X.drum();
    setTimeout(function () {
      var r = M.openBox(save); persistRaw();
      var art = $('box-art'); if (!art) return;
      art.classList.remove('shake'); art.classList.add('open');
      var html = '<div>' + pie() + '+' + fmt(r.pie) + '</div>';
      if (r.dia) html += '<div>' + dia() + ' 상점 +' + r.dia + '</div>';
      if (r.item) html += '<div style="color:' + S.RARITY[r.item.r].color + '">' + esc(r.item.name) + ' (' + RAR[r.item.r] + ')</div>';
      if (r.gear) html += '<div class="loot-gear" style="color:' + G2.rarDef(r.gear.rar).color + '">' + gearIcon(r.gear.slot) + ' ' + G2.rarDef(r.gear.rar).name + ' ' + G2.slotDef(r.gear.slot).name + (r.parts ? ' <small>· 부품 +' + r.parts + '</small>' : '') + '</div>';
      $('box-loot').innerHTML = html;
      var ok = $('box-ok'); ok.disabled = false; ok.textContent = save.boxes.length ? '좋다! (상자 ' + save.boxes.length + '개 남음)' : '좋다!';
      if (X) { if (tier === 'legend') X.fanfare(); else X.perfect(); }
      if (w) hud.bank = -1;
    }, 900);
  }
  // v20: 받아 둔 상자 한꺼번에 열기 → 한 장으로 정리
  function openAllBoxes() {
    if (!M || !save.boxes.length) return;
    var n = 0, pie0 = 0, dia0 = 0, parts = 0, gear = [], items = [], best = 0;
    while (save.boxes.length && n < 60) {
      var r = M.openBox(save); n++; pie0 += r.pie; dia0 += r.dia; parts += r.parts || 0;
      if (r.gear) { gear.push(r.gear); best = Math.max(best, G2.rarIdx(r.gear.rar)); }
      if (r.item) items.push(r.item);
    }
    persistRaw(); renderShop();
    gear.sort(function (a, b) { return G2.rarIdx(b.rar) - G2.rarIdx(a.rar); });
    var cells = gear.map(function (g) { var R = G2.rarDef(g.rar), sl = G2.slotDef(g.slot); return '<div class="cr-it" style="--rc:' + R.color + '">' + gearIcon(sl.id) + '<b>' + R.name + '</b><small>' + sl.name + '</small></div>'; }).join('');
    if (X) { if (best >= 3) X.fanfare(); else X.perfect(); }
    modal('<div class="m-chest"><p class="kicker">보급 상자 ' + n + '개</p><h3>' + (best >= 4 ? '전설!!' : best >= 3 ? '영웅!' : '보급 도착') + '</h3><div class="cr-grid many">' + cells + '</div>' +
      '<p>' + pie() + '+' + fmt(pie0) + (dia0 ? ' · ' + dia() + ' 상점 +' + dia0 : '') + ' · 정비 부품 +' + parts + (items.length ? '<br>분실물 ' + items.length + '개 (' + esc(items.slice(0, 3).map(function (it) { return it.name; }).join(', ')) + (items.length > 3 ? ' …' : '') + ')' : '') +
      (G2.mergeable(save).length ? '<br><b>합성할 수 있는 장구가 생겼다</b>' : '') + '</p><button class="btn big" data-m="ok">좋다!</button></div>', function () { renderShop(); });
  }
  // v23 결과 화면 숙련 한 줄: 이번 작전에 오른 것
  function skillLine() {
    var w = V.world(), g = w && w.act && w.act.skGain; if (!g) return '';
    var parts = S.SKILLS.list.filter(function (K) { return g[K.id] >= 1; }).map(function (K) { return K.name + ' Lv' + G.skillLv(save, K.id).lv; });
    return parts.length ? '<p class="res-svc">숙련 ▲ ' + esc(parts.join(' · ')) + '</p>' : '';
  }
  function crewHead(list) {
    // v15: 한 줄 (분대원 수 · 사기 막대) + 상점으로 부르는 지원은 접어 둔다
    var mor = Math.round(save.mor || 80), n = G.crewCount(save), pr = save.prep || {}, pend = G.pendN(save);
    var head = document.createElement('div'); head.className = 'crew-head v15';
    head.innerHTML = '<div class="row"><b>분대원 ' + n + '명' + (pend ? ' <small>+ 내일 ' + pend + '명</small>' : '') + '</b><span class="cap">정원 ' + (n + pend) + '/' + G.crewCap(save) + '</span></div>' +
      (n ? '<div class="row"><small>사기</small><div class="morbar"><i style="width:' + mor + '%"></i></div></div>' : '') +
      (n && save.dia >= S.DIA.morale ? '<details class="dia-more"><summary>상점으로 지원 부르기</summary><div class="dia-btns"><button data-dia="morale"' + (save.dia >= S.DIA.morale && !pr.morale ? '' : ' disabled') + '>' + (pr.morale ? '요청함 · ' : '') + '전원 초코파이 ' + dia() + S.DIA.morale + '</button><button data-dia="support"' + (save.dia >= S.DIA.support && !pr.support ? '' : ' disabled') + '>' + (pr.support ? '요청함 · ' : '') + '대대 지원 ' + dia() + S.DIA.support + '</button></div></details>' : '');
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
    if (r && G2) G2.onRollCall(save, Date.now());   // v18: 점호 = 체력 가득 + 패스 +20
    if (!r) return false;
    persistRaw();
    modal('<div class="m-rank"><div class="m-face">' + haengFace() + '</div><p class="kicker">아침 점호</p><h3>출석 ' + r.streak + '일째!</h3><p>' + (r.tier === 'legend' ? '7일 연속! <b>전설 보급 상자</b>다!' : r.tier === 'rare' ? '연속 출석 보상: <b>희귀 보급 상자</b>' : '오늘의 보급 상자 하나. 3일 연속이면 희귀, 7일이면 전설!') + '</p><div class="res-btns"><button class="btn ghost" data-m="later">나중에</button><button class="btn big" data-m="open">바로 열기</button></div></div>', function (k) { if (k === 'open') openBox(); });
    return true;
  }

  /* ── 상호작용: 행동 버튼, 눈덩이, 조준점, 자막, 분노, 임무, 버프, PX, 취침 ── */
  var curT = null, actAt = 0, subTimer = 0, hudA = {};
  var CAM_NEXT = { near: '1인칭', fp: '3인칭' };
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
      : '<b>끌어서 걷기 · 노란 화살표를 따라가</b>';
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
    // v14: 탈것을 타고 있으면 같은 자리에 '탄 것 · 기름' (누르면 내린다)
    var hk = st.ride ? st.ride.name + (st.ride.max ? ' · 기름 ' + Math.ceil(st.ride.fuel) : '') : st.hand ? st.hand.name : '';
    if (hudA.hand !== hk) { hudA.hand = hk; $('h-hand').hidden = !st.hand && !st.ride; $('h-hand-n').textContent = hk; $('h-hand').classList.toggle('ride', !!st.ride); $('h-hand').querySelector('span').textContent = st.ride ? '타고 있다' : '손에 든 것'; }
    // v14 눈덩이 버튼: 던질 사람(고라니·분대원·행보관)이 근처에 있을 때만
    var canT = G.feat(save, 'snowball') && !(w.act && w.act.ride && w.act.ride.kind !== 'cart'), tt = st.throwT, tk = canT ? (tt ? tt.k + (tt.k === 'deer' ? '!' : '') + tt.name : 'free') : '';   // v23: 조준해서 아무 데나 던질 수 있게 늘 보인다
    if ($('throw-btn').classList.contains('aiming')) tk = hudA.tk;
    if (hudA.tk !== tk) { hudA.tk = tk; $('throw-btn').hidden = !canT; $('throw-btn').classList.toggle('deer', !!tt && tt.k === 'deer'); $('throw-btn').classList.remove('risky'); $('throw-n').textContent = tt && tt.k === 'deer' ? '고라니! 끌어서' : '끌어서 조준'; }   // v24: 자동 조준 없음 — 이름 대신 늘 '끌어서'
    $('throw-btn').classList.toggle('cd', st.ballCd > 0);
    $('throw-btn').classList.toggle('up', !$('act2-btn').hidden && !$('acts').classList.contains('off'));   // 행동 버튼에 두 번째 줄이 있으면 그 위로
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
  // v13 작업 지시서 카드: 구역이 2곳 이상일 때만 (1곳이면 위 '지금 할 일'과 같은 말). 지금 줄 + 다음 줄 하나, 특명 한 줄.
  // 경고·할 일 안내는 위 '지금 할 일' 한 줄이 맡는다 (같은 말을 두 번 하지 않는다)
  function opHud(w, st) {
    var o = st.op, bo = o && o.bonus;
    if (!o || (o.tasks.length < 2 && !bo)) { $('h-op').hidden = true; hud.op = null; return; }
    var todo = o.tasks.filter(function (t) { return !t.done; }), cur = todo[0];
    var bkey = bo ? (bo.done ? 'D' : Math.floor(bo.cur / bo.goal * 20)) : '';
    var key = bkey + '|' + o.tasks.map(function (t) { return t.id + (t.done ? 'd' : Math.floor(t.pct * 20)) + (t.late ? 'l' : ''); }).join(',') + (cur && cur.left < 300 ? Math.ceil(cur.left / 10) : '');
    if (hud.op === key) return;
    hud.op = key;
    $('h-op').hidden = false;
    $('op-title').textContent = o.exam ? '진급 심사' : '지시서';
    $('h-op').classList.toggle('exam', !!o.exam);
    $('op-n').textContent = o.done + '/' + o.tasks.length;
    var show = o.tasks.length < 2 ? [] : todo.slice(0, 2);
    if (!show.length && o.tasks.length >= 2) show = o.tasks.slice(-1);
    $('op-list').innerHTML = show.map(function (t) {
      var mins = Math.max(0, Math.ceil(t.left / S.DAY_LEN * (S.OP.end - S.OP.start)));
      var cls = t.done ? 'done' : t === cur ? 'cur' + (t.late ? ' late' : mins <= 15 ? ' soon' : '') : t.late ? 'late' : '';
      var pct = t.done ? '✔' : Math.floor(t.pct * 100) + '%';
      return '<li class="' + cls + '"><span>' + esc(t.name) + '</span><em>' + pct + '</em>' + (t === cur ? (t.late || mins <= 15 ? '<small>' + (t.late ? '늦음' : '곧 마감') + '</small>' : '') + '<i><u style="width:' + Math.min(100, t.pct / t.goal * 100) + '%"></u></i>' : '') + '</li>';
    }).join('');
    $('op-warn').hidden = true; $('op-tip').hidden = true;
    $('op-bonus').hidden = !bo;
    if (bo) {
      $('op-bonus').classList.toggle('done', !!bo.done);
      var bp = bo.done ? '✔' : bo.end ? '' : bo.goal > 1 ? Math.floor(bo.cur) + '/' + bo.goal : bo.cur > 0 && bo.cur < 1 ? Math.floor(bo.cur * 100) + '%' : '';
      $('op-bonus').innerHTML = '<b>특명</b> ' + esc(bo.text) + (bp ? ' <em>' + bp + '</em>' : '');
    }
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
    if (f.t === 'me') { if (/충성/.test(f.text)) subtitle(f.text); return true; }   // v13: 내 자막은 경례·보고 때만
    if (f.t === 'buff') return true;
    if (f.t === 'buffEnd') return true;
    if (f.t === 'hand') { hud.op = null; return true; }
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

  /* ── v8: 스토리 장면 · 꾸미기 · 수첩 · 처음부터 ── */
  var talking = false;
  function portrait(who) {
    if (!JY.art) return '';
    if (who === 'me') return JY.art.character(M.lookSpec(save));
    var C = JY.CHARS && JY.CHARS[who];
    if (!C || !C.spec) return '';
    var sp = C.spec;   // v24 간부는 빨간 모자 + 큰 계급장
    if (sp.hat === 'general' || /^(o1|o3|nco)$/.test(sp.hatRank || '')) { sp = Object.assign({}, sp, { hat: sp.hat === 'general' ? 'redgen' : 'redcap' }); }
    return JY.art.character(sp);
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
    if (ch && ch.id === 'prologue') playStory(ch, false);   // v13: 나머지 장면은 작전이 끝나고 생활관에서
  }
  function lookChanged() {
    if (JY.SNOW && M) JY.SNOW.FACES.me = M.lookSpec(save);
    if (V.lookChanged) V.lookChanged();
  }
  // ── 꾸미기: 옵션마다 그림 카드 + 위에 실제 모습 (대사 얼굴 · 3인칭 · 1인칭 손) ──
  var lookTab = 'hat', lookTry = null, LOOK_TABS = [['hat', '모자', ['hat']], ['face', '얼굴', ['eyes', 'mouth', 'brows', 'extras', 'head', 'skin']], ['wear', '군복·장갑', ['coat', 'glove']], ['tool', '넉가래', ['tool']]];
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
  // v24 입어 보기: 사기 전에 미리 걸쳐 본다 (저장은 안 한다. 화면을 나가면 원래대로)
  function tryOn(cat, id) {
    untry();
    lookTry = { cat: cat, id: id, prev: cat === 'extras' ? (save.look.extras || []).slice() : save.look[cat] };
    if (cat === 'extras') { var ex = (save.look.extras || []).filter(function (x) { return x !== id; }); ex.push(id); save.look.extras = ex.slice(-3); } else save.look[cat] = id;
    lookChanged();
  }
  function untry() { if (!lookTry) return; if (lookTry.cat === 'extras') save.look.extras = lookTry.prev; else save.look[lookTry.cat] = lookTry.prev; lookTry = null; lookChanged(); }
  function tierChip(t) { return t ? '<i class="tier t-' + t + '">' + S.LOOK_TIER[t].name + '</i>' : ''; }
  function renderLook(list) {
    var opts = M.lookOptions(save), si = M.styleInfo(save), dk = M.dealOf(save), dp = dk ? dk.split(':') : null, dOpt = dp ? opts[dp[0]].filter(function (o) { return o.id === dp[1]; })[0] : null;
    var top = document.createElement('div'); top.className = 'look-top';
    var snap = V.snapshot ? '<figure><img id="pv-3p" alt="3인칭 모습"><figcaption>3인칭</figcaption></figure><figure><img id="pv-fp" alt="1인칭 손"><figcaption>1인칭 손</figcaption></figure>' : '';
    var tr = lookTry ? opts[lookTry.cat].filter(function (o) { return o.id === lookTry.id; })[0] : null;
    top.innerHTML = '<div class="look-pv"><figure class="pv-face">' + (JY.art ? JY.art.character(M.lookSpec(save)) : '') + '<figcaption>대사 얼굴</figcaption></figure>' + snap + '</div>' +
      (tr ? '<div class="look-try t-' + (tr.tier || 'c') + '"><span><b>입어 보는 중</b> ' + esc(tr.name) + ' ' + tierChip(tr.tier) + '</span><span class="lt-btns"><button class="btn sm" data-luntry>벗기</button><button class="btn sm gold" data-lbuy' + (tr.ok ? '' : ' disabled') + '>' + dia() + tr.dia + ' 사기</button></span></div>' : '') +
      '<div class="look-style"><span>멋 <b>' + si.pts + '</b>점 · 초코파이 <b>+' + Math.round(si.bonus * 1000) / 10 + '%</b></span><small>' + (si.bonus >= si.cap ? '최대!' : '꾸미기를 살수록 오른다 (' + si.capPts + '점이면 최대 +' + Math.round(si.cap * 100) + '%)') + '</small><i style="width:' + Math.min(100, si.pts / si.capPts * 100).toFixed(1) + '%"></i></div>' +
      (dOpt ? '<button class="look-deal t-' + (dOpt.tier || 'c') + '" data-look="' + dOpt.id + '" data-cat="' + dOpt.cat + '" data-state="buy"><span class="lthumb">' + lookThumb(dOpt.cat, dOpt) + '</span><span><small>오늘의 특가 -' + Math.round(S.STYLE.deal * 100) + '%</small><b>' + esc(dOpt.name) + ' ' + tierChip(dOpt.tier) + '</b><em><s>' + dOpt.full + '</s> ' + dia() + dOpt.dia + '</em></span></button>' : '') +
      '<label class="look-name">이름<input id="look-name" maxlength="6" value="' + esc(save.look.name || '') + '" placeholder="김제설"><small>상점 ' + save.dia + '개 · 누르면 먼저 입어 보고, 한 번 더 누르면 산다</small></label>';
    list.appendChild(top);
    var nm = top.querySelector('#look-name');
    nm.onchange = function () { save.look.name = (nm.value || '').trim().slice(0, 6); persistRaw(); };
    nm.onkeydown = function (e) { e.stopPropagation(); };
    var tabs = document.createElement('div'); tabs.className = 'look-tabs';
    tabs.innerHTML = LOOK_TABS.map(function (t) { var nw = t[2].some(function (c) { return opts[c].some(function (o) { return o.isNew; }); }); return '<button data-ltab="' + t[0] + '" aria-pressed="' + (lookTab === t[0]) + '">' + t[1] + (nw ? '<i class="nd">N</i>' : '') + '</button>'; }).join('');
    list.appendChild(tabs);
    var cats = LOOK_TABS.filter(function (t) { return t[0] === lookTab; })[0][2];
    cats.forEach(function (cat) {
      var sec = document.createElement('div'); sec.className = 'look-cat';
      var ord = opts[cat].slice().sort(function (p, q) { var R = { '': 0, c: 1, r: 2, e: 3, l: 4 }; return (p.state === 'lock') - (q.state === 'lock') || R[p.tier] - R[q.tier]; });
      sec.innerHTML = '<b>' + S.LOOK_NAMES[cat] + (cat === 'extras' ? ' <small>(3개까지 켜고 끈다)</small>' : '') + '</b><div class="lgrid">' + ord.map(function (o) {
        var trying = lookTry && lookTry.cat === cat && lookTry.id === o.id;
        var badge = trying ? '<em class="try">입어 보는 중</em>' : o.on ? '<em class="on">사용 중</em>' : o.state === 'buy' ? '<em class="cost">' + (o.deal ? '<s>' + o.full + '</s>' : '') + dia() + o.dia + '</em>' : o.state === 'lock' ? '<em class="lock">스토리</em>' : '<em>보유</em>';
        return '<button class="lcard' + (o.on && !trying ? ' on' : '') + (trying ? ' trying' : '') + (o.state !== 'own' ? ' ' + o.state : '') + (o.tier ? ' t-' + o.tier : '') + '" data-look="' + o.id + '" data-cat="' + cat + '" data-state="' + o.state + '" aria-pressed="' + (o.on || trying) + '">' +
          (o.isNew ? '<i class="lnew">NEW</i>' : o.deal ? '<i class="lnew deal">특가</i>' : '') + (o.tier && o.tier !== 'c' ? '<i class="ltier">' + S.LOOK_TIER[o.tier].name + '</i>' : '') +
          '<span class="lthumb' + (cat === 'skin' ? ' skin' : '') + '">' + lookThumb(cat, o) + '</span><b>' + esc(o.name) + '</b>' + badge + '</button>';
      }).join('') + '</div>';
      list.appendChild(sec);
    });
    var sn = save.seen = save.seen || {}; cats.forEach(function (c) { sn['lk24:' + c] = 1; });
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
    // v14 발견: "아 이런 것도 되네" — 못 찾은 건 힌트만
    var FN = S.FUN || [], fs = save.fun || {};
    list.insertAdjacentHTML('beforeend', '<p class="sec-t">발견 (' + FN.filter(function (q) { return fs[q.id]; }).length + '/' + FN.length + ') <small>처음 하면 상점 +1</small></p><div class="fun-grid">' + FN.map(function (q) {
      return '<div class="fun-c' + (fs[q.id] ? ' on' : '') + '"><b>' + (fs[q.id] ? esc(q.name) : '???') + '</b><small>' + esc(q.hint) + '</small></div>';
    }).join('') + '</div>');
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
  setInterval(function () { if (G2 && !$('title').hidden) enPill(); }, 1000);   // v18 생활관 체력 시계
  function boot() {
    var SAY_OK = { exam: 1, heavy: 1, deer: 1, car: 1, carStuck: 1, roofWarn: 1, sleep: 1, slack: 1, surge: 1, surprise: 1, support: 1 };
    var hooks = { say: function (k) { if (SAY_OK[k]) say(k); }, tick: tick, event: onEvent };
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
    $('h-sup').onclick = function () { if (X) { X.unlock(); X.pop(); } tab = 'tool'; openShop(); };   // v20: 작전 중에도 보급 화면
    $('report-btn').onclick = function () { var w = V.world(); if (A && w && A.reportNow(w)) { $('report-btn').hidden = true; if (X) X.pop(); } };
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
    press('h-hand', function () {
      var w = V.world(); if (!A || !w || V.mode() !== 'play') return;
      if (w.act && w.act.ride) { A.act(w, { k: 'exit' }, w.player.dir); if (X) X.pop(); hudA.hand = null; return; }
      if (A.drop(w)) { if (X) X.pop(); hudA.hand = null; }
    });
    // v23 눈덩이: 버튼을 누른 채 끌면 조준(점선 + 떨어질 자리), 놓으면 그쪽으로
    // v24 무조건 수동: 그냥 누르면 안 던진다 (1인칭은 조준점 쪽으로). 대신 '끌어서' 안내
    (function () {
      var tb = $('throw-btn'), aim = null;
      function aimOf(e) {
        var dx = e.clientX - aim.x, dy = e.clientY - aim.y, l = Math.hypot(dx, dy);
        if (l < 14) return null;
        var d = V.aimDir ? V.aimDir(dx, dy) : { x: dx / l, y: dy / l }, k = Math.min(1, (l - 14) / 130);
        return { ux: d.x, uy: d.y, dist: A.AIM.min + (A.AIM.max - A.AIM.min) * k };
      }
      tb.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation(); if (X) X.unlock();
        aim = { id: e.pointerId, x: e.clientX, y: e.clientY, cur: null }; try { tb.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
        tb.classList.add('aiming');
      });
      tb.addEventListener('pointermove', function (e) {
        if (!aim || e.pointerId !== aim.id) return; e.preventDefault();
        aim.cur = aimOf(e); if (V.setAim) V.setAim(aim.cur);
        $('throw-n').textContent = aim.cur ? '놓으면 던진다' : '끌어서 조준';
      });
      function end(e, cancel) {
        if (!aim || (e && e.pointerId !== aim.id)) return;
        var cur = aim.cur; aim = null; tb.classList.remove('aiming'); if (V.setAim) V.setAim(null); hudA.tk = null;
        var w = V.world(); if (cancel || !A || !w || V.mode() !== 'play') return;
        var lk = !cur && V.look ? V.look() : null, r;
        if (cur) r = A.throwDir(w, cur.ux, cur.uy, cur.dist);
        else if (lk && lk.fp) r = A.throwDir(w, lk.x, lk.y, 150);
        else { r = { ok: false }; tb.classList.remove('nudge'); void tb.offsetWidth; tb.classList.add('nudge'); if (Date.now() - (hudA.nudgeAt || 0) > 4000) { hudA.nudgeAt = Date.now(); toast('버튼을 누른 채 던질 곳으로 끌었다 놓는다'); } }
        if (r.ok) vibrate(15);
      }
      tb.addEventListener('pointerup', function (e) { e.preventDefault(); end(e, false); });
      tb.addEventListener('pointercancel', function (e) { end(e, true); });
      tb.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
    })();
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
    } else if (!rollCall()) { var sd0 = G.specDue(save); if (sd0) chooseSpec(sd0); }
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
    setSave: function (s) { lookTry = null; save = seenOld(G.migrate(s)); if (M && M.fixLook) M.fixLook(save); rankSeen = G.rankOf(save); persistRaw(); lookChanged(); },
    play: play, startDay: function () { play(false); }, startOp: startOp, briefing: briefing, help: help, settings: settings, renderHub: renderHub, openShop: openShop, closeShop: closeShop, title: title, persist: persist,
    openPX: openPX, results: results, talk: function (ch) { playStory(ch || S.STORY[1], true, renderHub); },
    autopilot: function (b) { V.setAutopilot(b); },
    act: function (alt) { doAct(alt === true); }, openBox: function () { openBox(); }, target: function () { var w = V.world(); if (w) updAct(w, true); return curT; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.JY = window.JY || {});
