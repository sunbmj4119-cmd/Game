/* 제설각 — 화면 흐름: 타이틀, 작업(HUD), 검열 결과, 보급·인력, 진급, 전역 */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim, V2 = JY.SnowView, V3 = JY.SnowView3D, X = JY.SnowSfx;
  var V = V3 && V3.supported() && !/[?&]2d/.test(location.search) ? V3 : V2;
  var KEY = 'jeseol-v1';
  var save = load(), tab = 'crew', sayTimer = 0, toastTimer = 0, lastSave = 0, hud = {}, tutT = 0;
  var GRADE = { S: '특급', A: '양호', B: '미흡', C: '재작업' };

  function $(id) { return document.getElementById(id); }
  function load() { try { var raw = localStorage.getItem(KEY); return G.migrate(raw ? JSON.parse(raw) : null); } catch (e) { return G.newSave(); } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 */ } lastSave = Date.now(); }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pie() { return '<i class="pie" aria-hidden="true"></i>'; }
  function haengFace() { return JY.art && JY.CHARS ? JY.art.character(JY.CHARS.haeng.spec, { mouth: 'shout' }) : ''; }
  function insignia(r) { return JY.art ? JY.art.rankInsignia(r + 1) : ''; }

  function show(id) {
    ['title', 'result', 'shop'].forEach(function (s) { $(s).hidden = s !== id; });
    $('hud').hidden = id !== 'play';
    if (id !== 'play' && id !== 'shop') $('say').hidden = true;
    $('say').classList.toggle('low', id === 'shop');
    if (id !== 'play') $('hint').hidden = true;
  }

  /* ── 행보관 말풍선 ── */
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
    b.innerHTML = html; m.hidden = false;
    b.onclick = function (e) { var el = e.target.closest('[data-m]'); if (!el) return; var k = el.getAttribute('data-m'); m.hidden = true; if (onClick) onClick(k); };
  }

  /* ── 타이틀 ── */
  function title() {
    show('title');
    V.demo(save);
    var r = G.rankOf(save);
    $('t-info').innerHTML = save.day > 1 || save.discharges
      ? '<span class="ins">' + insignia(r) + '</span><span>' + S.RANKS[r].name + ' · ' + save.day + '일차</span><span class="sep"></span>' + pie() + '<b>' + fmt(save.bank) + '</b>' +
        (G.crewCount(save) ? '<span class="sep"></span><span>인력 ' + G.crewCount(save) + '명</span>' : '') + (save.medals ? '<span class="sep"></span><span>전역 메달 ' + save.medals + '</span>' : '')
      : '<span>이병 · 싸리비 하나로 시작한다</span>';
    $('t-start').textContent = save.day > 1 ? save.day + '일차 작업 개시' : '작업 개시';
    $('t-shop').hidden = save.day <= 1 && !save.bank;
    $('t-sound').textContent = X && X.muted() ? '소리 끔' : '소리 켬';
  }

  /* ── 작업 ── */
  function startDay() {
    if (X) X.unlock();
    var w = V.play(save);
    show('play');
    hud = {};
    $('h-ins').innerHTML = insignia(G.rankOf(save));
    $('h-day').textContent = save.day + '일차';
    $('h-wx').textContent = w.wx.name + (w.inspect ? ' · 순시' : '');
    $('h-goal').style.left = Math.round(w.goal * 100) + '%';
    var bn = $('banner');
    bn.innerHTML = '<b>' + save.day + '일차 제설 작전</b><span>' + w.wx.name + (w.inspect ? ' · 대대장 순시' : '') + ' · 목표 ' + Math.round(w.goal * 100) + '%' + (w.wx.mult !== 1 ? ' · 보상 ×' + w.wx.mult : '') + '</span>';
    bn.hidden = false; bn.classList.remove('in'); void bn.offsetWidth; bn.classList.add('in');
    setTimeout(function () { bn.hidden = true; }, 2200);
    setTimeout(function () { say(w.inspect ? 'inspect' : w.weather === 'heavy' || w.weather === 'blizzard' ? 'heavy' : 'start'); }, 500);
    if (X) { X.whistle(false); X.wind({ light: 0.1, normal: 0.25, heavy: 0.55, blizzard: 0.9 }[w.weather] || 0.2); }
    if (!save.seen.tut) { $('hint').hidden = false; tutT = 0; }
    scanReady = 0; $('h-scan').disabled = !V.scan; $('h-scan').classList.remove('cool');
    var fresh = S.ZONES.filter(function (Z) { return save.seen['new' + Z.id]; })[0];
    if (fresh) {
      delete save.seen['new' + fresh.id]; persist();
      setTimeout(function () { if (V.focusZone) V.focusZone(fresh.id, 3.2); say('새 구역 「' + fresh.name + '」 — ' + fresh.reveal, 4200); }, 2300);
    }
  }

  /* ── 방해꾼 알림 ── */
  var chipTimer = 0;
  function chip(text, cls) {
    var c = $('chip'); c.textContent = text; c.className = cls || ''; c.hidden = false;
    clearTimeout(chipTimer); chipTimer = setTimeout(function () { c.hidden = true; }, 2600);
  }
  function onEvent(f) {
    if (f.t === 'deer') { chip('고라니 출현! 부딪히면 다친다', 'warn'); vibrate(80); }
    else if (f.t === 'meHit') { chip(f.lose ? '고라니한테 받혀서 초코파이 ' + fmt(f.lose) + '개 떨어뜨림!' : '고라니한테 받혔다!', 'bad'); vibrate([60, 40, 120]); flash(); }
    else if (f.t === 'snowball') { splat(); vibrate(50); }
    else if (f.t === 'car') chip('간부 차량 통과 중… 진입로가 더러워진다', 'warn');
    else if (f.t === 'heli') chip('헬기 착륙! 하강풍이 헬기장 눈을 날린다', 'good');
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 무시 */ } }
  function flash() { var f = $('flash'); f.hidden = false; f.classList.remove('in'); void f.offsetWidth; f.classList.add('in'); setTimeout(function () { f.hidden = true; }, 500); }
  function splat() {
    var sp = $('splat'), x = 15 + Math.random() * 50, y = 25 + Math.random() * 35;
    sp.style.left = x + '%'; sp.style.top = y + '%'; sp.hidden = false; sp.classList.remove('in'); void sp.offsetWidth; sp.classList.add('in');
    setTimeout(function () { sp.hidden = true; }, 2600);
  }
  var scanReady = 0;
  function scan() {
    if (!V.scan || Date.now() < scanReady) return;
    if (V.scan()) { scanReady = Date.now() + 9000; var b = $('h-scan'); b.classList.add('cool'); setTimeout(function () { b.classList.remove('cool'); }, 9000); if (X) X.pop(); }
  }

  function tick(w) {
    var left = Math.max(0, Math.ceil(w.dayLen - w.time)), p = G.pct(w), pc = Math.floor(p * 100), bank = Math.floor(save.bank);
    if (hud.left !== left) { hud.left = left; $('h-time').textContent = left; $('h-time').parentNode.classList.toggle('late', left <= 10); }
    var ring = Math.round((1 - w.time / w.dayLen) * 1000) / 1000;
    if (hud.ring !== ring) { hud.ring = ring; $('h-ring').style.strokeDashoffset = String(119.4 * (1 - ring)); }
    if (hud.pc !== pc) { hud.pc = pc; $('h-pct').textContent = pc + '%'; $('h-fill').style.width = Math.min(100, p * 100) + '%'; $('hud').classList.toggle('goal-ok', p >= w.goal); }
    if (hud.bank !== bank) { hud.bank = bank; $('h-bank').textContent = fmt(bank); }
    if (!save.seen.tut && w.player.moving && w.time > 1.2) { save.seen.tut = true; $('hint').hidden = true; }
    if (Date.now() - lastSave > 5000) persist();
  }

  function dayDone(w) {
    var r = G.finishDay(w);
    persist();
    if (X) { X.whistle(true); X.wind(0); }
    setTimeout(function () { result(r); }, 700);
  }

  /* ── 검열 결과 ── */
  function result(r) {
    show('result');
    var base = r.bonus - r.timeBonus;
    var lines = '<li><span>치운 눈</span><b>' + fmt(r.units) + '칸</b></li>' +
      '<li><span>작업 보상</span><b>' + pie() + fmt(r.earned) + '</b></li>' +
      '<li><span>검열 보너스' + (r.inspect ? ' (순시 ×2)' : '') + '</span><b>' + (base ? '+' + fmt(base) : '없음') + '</b></li>' +
      (r.early ? '<li class="early"><span>조기 퇴근 (' + Math.floor(r.left) + '초 남김)</span><b>+' + fmt(r.timeBonus) + '</b></li>' : '') +
      (r.partsTotal ? '<li class="early"><span>구역 완료 ' + r.parts + '/' + r.partsTotal + ' (띵!)</span><b>' + (r.partBonus ? '+' + fmt(r.partBonus) : '없음') + '</b></li>' : '') +
      (r.hits ? '<li class="bad"><span>고라니·지붕 피해 ' + r.hits + '번</span><b>' + (r.lost ? '-' + fmt(r.lost) : '부상만') + '</b></li>' : '');
    $('result').innerHTML = '<div class="card res">' +
      '<div class="res-head"><div class="face">' + haengFace() + '</div><div><p class="kicker">행보관 검열 · ' + r.day + '일차</p><h2>' + esc(S.WEATHER[r.weather].name) + (r.inspect ? ' · 대대장 순시' : '') + '</h2></div></div>' +
      '<div class="res-pct"><div><b>' + Math.floor(r.pct * 100) + '<small>%</small></b><span>제설률 · 목표 ' + Math.round(r.goal * 100) + '%</span></div><div class="stamp g-' + r.grade + '">' + GRADE[r.grade] + '</div></div>' +
      '<ul class="res-lines">' + lines + '</ul>' +
      '<p class="res-say">“' + esc(pick(S.LINES.grade[r.grade])) + '”</p>' +
      '<div class="res-total"><span>보유 초코파이</span><b>' + pie() + fmt(save.bank) + '</b></div>' +
      '<div class="res-btns"><button class="btn ghost" data-r="shop">보급·인력</button><button class="btn big" data-r="next">' + save.day + '일차 작업</button></div></div>';
    if (X) setTimeout(X.stamp, 350);
    $('result').onclick = function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return;
      if (b.getAttribute('data-r') === 'shop') shop(); else startDay();
    };
    if (r.rankUp) setTimeout(function () { rankUp(r.rankUp); }, 900);
    else if (G.canDischarge(save) && !save.seen.dis) { save.seen.dis = true; persist(); setTimeout(function () { modal('<div class="m-rank"><p class="kicker">전역 신고 가능</p><h3>이제 전역할 수 있다</h3><p>보급·인력 관리의 <b>전역</b> 탭에서 신고하면 처음부터 다시 시작하지만, 전역 메달로 초코파이 보상이 영원히 늘어난다.</p><button class="btn big" data-m="ok">알겠다</button></div>'); }, 900); }
  }

  function rankUp(r) {
    var unlocked = S.CREW.filter(function (C) { return C.rank === r; }).map(function (C) { return C.name; });
    if (X) X.rank();
    V.shake(3);
    modal('<div class="m-rank"><div class="m-ins">' + insignia(r) + '</div><p class="kicker">진급을 축하한다</p><h3>' + S.RANKS[r].name + ' 진급!</h3>' +
      (unlocked.length ? '<p>새로 부려 먹을 수 있다: <b>' + unlocked.join(', ') + '</b></p>' : '<p>짬이 찼다. 이제 시키는 쪽이다.</p>') +
      '<button class="btn big" data-m="ok">충성!</button></div>');
  }

  /* ── 보급·인력 ── */
  var TABS = [['crew', '인력'], ['tool', '도구'], ['perk', '보급'], ['zone', '구역'], ['dis', '전역']];
  var PERK_ICON = {
    eisen: '<path d="M5 6h7v6l6 2a3 3 0 0 1 3 3v1H5z" fill="#3b3f33"/><path d="M6 19l1 3M10 19l1 3M14 19l1 3M18 19l1 3" stroke="#9aa3ab" stroke-width="1.6" stroke-linecap="round"/>',
    hotpack: '<rect x="5" y="6" width="14" height="14" rx="3" fill="#e4572e"/><path d="M9 3c-1 1 1 2 0 3M12 3c-1 1 1 2 0 3M15 3c-1 1 1 2 0 3" stroke="#e4572e" stroke-width="1.4" fill="none"/><rect x="8" y="10" width="8" height="5" rx="1" fill="#fff3"/>',
    matsta: '<rect x="7" y="3" width="10" height="18" rx="2" fill="#2f8f5b"/><rect x="7" y="8" width="10" height="7" fill="#f4d35e"/><rect x="9" y="1.5" width="6" height="2" rx="1" fill="#9aa3ab"/>',
    praise: '<path d="M12 2l2.9 6.2 6.6.6-5 4.5 1.5 6.6L12 16.6 6 19.9l1.5-6.6-5-4.5 6.6-.6z" fill="#ffd24a" stroke="#b8901a" stroke-width="1"/>',
    song: '<path d="M4 9h4l6-5v16l-6-5H4z" fill="#4d5b31"/><path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a8.5 8.5 0 0 1 0 13" stroke="#4d5b31" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    gear: '<path d="M6 20L16 6" stroke="#8a6a44" stroke-width="2.2" stroke-linecap="round"/><rect x="13" y="2" width="9" height="5" rx="1.5" transform="rotate(35 17 4)" fill="#e7ae2f"/><path d="M18 20L8 6" stroke="#8a6a44" stroke-width="2.2" stroke-linecap="round"/><rect x="2" y="2" width="9" height="5" rx="1.5" transform="rotate(-35 7 4)" fill="#e7ae2f"/>'
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
    d.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (PERK_ICON[o.id] || '') + '</svg>';
    return d;
  }

  function shop() {
    show('shop');
    V.demo(save);
    renderShop();
  }

  function renderShop() {
    $('s-bank').textContent = fmt(save.bank);
    $('s-go').textContent = save.day + '일차 작업 개시';
    var showDis = G.rankOf(save) >= 3 || save.discharges > 0;
    $('s-tabs').innerHTML = TABS.filter(function (t) { return t[0] !== 'dis' || showDis; }).map(function (t) {
      var o = t[0] === 'dis' ? [] : G.offers(save)[t[0]], n = o.filter(function (x) { return x.ok; }).length;
      return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + (n ? '<i class="dot">' + n + '</i>' : '') + '</button>';
    }).join('');
    var list = $('s-list'); list.innerHTML = '';
    if (tab === 'dis') { renderDischarge(list); return; }
    var items = G.offers(save)[tab];
    if (!items.length) { list.innerHTML = '<p class="empty">모든 구역을 맡았다. 이제 부대 전체가 우리 담당이다.</p>'; return; }
    items.forEach(function (o) {
      var row = document.createElement('div');
      row.className = 'item s-' + o.state + (o.ok ? ' can' : '');
      var meta = o.kind === 'crew' ? o.tag + ' · ' + o.n + '/' + o.max + '명' : o.kind === 'perk' ? 'Lv ' + o.n + '/' + o.max : o.kind === 'tool' ? o.stat : o.kind === 'zone' ? '눈 한 칸에 초코파이 ' + o.value + '개' : '';
      var label;
      if (o.state === 'buy') label = pie() + fmt(o.cost);
      else if (o.state === 'own') label = o.cur ? '사용 중' : '보유';
      else if (o.state === 'max') label = '최대';
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
    var can = G.canDischarge(save), p = Math.min(1, save.life / S.DISCHARGE_LIFE), gain = G.medalGain(save);
    list.innerHTML = '<div class="dis"><div class="dis-ins">' + insignia(3) + '</div><h3>전역 신고</h3>' +
      '<p>지금까지 번 초코파이로 전역 메달을 받는다. 처음(이병, 싸리비)부터 다시 시작하지만 <b>메달 하나마다 모든 보상이 +10%</b> 영원히 늘어난다.</p>' +
      '<div class="dis-bar"><i style="width:' + Math.round(p * 100) + '%"></i></div><p class="dis-num">' + fmt(save.life) + ' / ' + fmt(S.DISCHARGE_LIFE) + ' (병장 + 누적 초코파이)</p>' +
      '<ul class="res-lines"><li><span>지금 메달</span><b>' + save.medals + '개</b></li><li><span>이번 전역으로 받는 메달</span><b>+' + (can ? gain : 0) + '개</b></li></ul>' +
      '<button class="btn big" id="dis-go"' + (can ? '' : ' disabled') + '>' + (can ? '전역 신고하기' : '아직 전역할 때가 아니다') + '</button></div>';
    var go = $('dis-go');
    if (go) go.onclick = function () {
      modal('<div class="m-rank"><p class="kicker">정말 전역?</p><h3>전역 신고</h3><p>초코파이, 도구, 인력, 구역이 모두 처음으로 돌아간다. 전역 메달 <b>+' + gain + '개</b>를 받는다.</p><div class="res-btns"><button class="btn ghost" data-m="no">조금 더 한다</button><button class="btn big" data-m="yes">충성! 전역합니다</button></div></div>', function (k) {
        if (k !== 'yes') return;
        var r = G.discharge(save); persist();
        if (X) X.rank();
        modal('<div class="m-rank"><div class="m-ins">' + insignia(3) + '</div><p class="kicker">전역을 축하한다</p><h3>전역 메달 +' + r.medals + '</h3><p>메달 ' + r.total + '개 · 모든 보상 +' + r.total * 10 + '%. 그리고… 새 이병으로 재입대했다.</p><button class="btn big" data-m="ok">다시 싸리비를 든다</button></div>', function () { tab = 'crew'; title(); });
      });
    };
  }

  function onShopClick(e) {
    var t = e.target.closest('[data-tab]');
    if (t) { tab = t.getAttribute('data-tab'); renderShop(); $('s-list').scrollTop = 0; return; }
    var b = e.target.closest('.buy');
    if (!b) return;
    var kind = b.getAttribute('data-kind'), id = b.getAttribute('data-id');
    var r = G.buy(save, kind, id);
    if (!r.ok) { if (X) X.deny(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    if (X) X.buy();
    persist();
    toast(esc(r.item.name) + (kind === 'crew' ? ' 투입!' : kind === 'zone' ? ' 담당!' : kind === 'tool' ? ' 지급!' : ' 보급!'));
    if (kind === 'crew' && Math.random() < 0.5) say('hire', 2000);
    if (kind === 'tool') say('tool', 2000);
    if (kind === 'zone') say('zone', 2000);
    renderShop();
  }

  /* ── 시작 ── */
  function boot() {
    var hooks = { say: function (k) { say(k); }, tick: tick, done: dayDone, event: onEvent };
    try { V.init($('cv'), hooks); } catch (e) { V = V2; V.init($('cv'), hooks); }
    document.body.classList.toggle('is3d', !!V.is3D);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { V.rebuildArt(); });
    $('say-face').innerHTML = haengFace();
    $('t-start').onclick = startDay;
    $('t-shop').onclick = shop;
    $('t-sound').onclick = function () { if (!X) return; X.setMuted(!X.muted()); $('t-sound').textContent = X.muted() ? '소리 끔' : '소리 켬'; if (!X.muted()) { X.unlock(); X.pop(); } };
    $('s-go').onclick = startDay;
    $('s-back').onclick = title;
    $('shop').addEventListener('click', onShopClick);
    $('h-pause').onclick = pause;
    $('h-scan').onclick = scan;
    window.addEventListener('keydown', function (e) { if ((e.key === 'Tab' || e.key === 'q') && V.mode() === 'play') { e.preventDefault(); scan(); } });
    document.addEventListener('visibilitychange', function () { if (document.hidden && V.mode() === 'play') pause(); });
    var off = G.offline(save, Date.now());
    title();
    if (off > 0) {
      save.bank += off; save.life += off;
      modal('<div class="m-rank"><div class="m-face">' + haengFace() + '</div><p class="kicker">당직 서는 동안</p><h3>후임들이 눈을 치웠다</h3><p class="m-big">' + pie() + '+' + fmt(off) + '</p><p>쉬는 동안에도 인력은 일한다. 그게 군대다.</p><button class="btn big" data-m="ok">수고했다</button></div>');
    }
    save.last = Date.now(); persist();
  }

  function pause() {
    if (V.mode() !== 'play') return;
    V.pause(true);
    modal('<div class="m-rank"><p class="kicker">잠깐</p><h3>작업 중지</h3><p>지금 그만두면 지금까지 치운 만큼만 검열받는다.</p><div class="res-btns"><button class="btn ghost" data-m="quit">여기까지</button><button class="btn big" data-m="go">계속 치운다</button></div></div>', function (k) {
      V.pause(false);
      if (k === 'quit') { var w = V.world(); w.time = w.dayLen; }
    });
  }

  window.__SNOW = {
    view: function () { return V; },
    save: function () { return save; },
    setSave: function (s) { save = G.migrate(s); persist(); },
    startDay: startDay, shop: shop, title: title, endNow: function () { var w = V.world(); if (w) w.time = w.dayLen; },
    autopilot: V.setAutopilot
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.JY = window.JY || {});
