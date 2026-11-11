/* 제설각 — 화면 흐름: 타이틀 → 계속 이어지는 작업(HUD) ↔ 보급·인력·공장, 진급, 전역 */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim, V2 = JY.SnowView, V3 = JY.SnowView3D, X = JY.SnowSfx;
  var V = V3 && V3.supported() && !/[?&]2d/.test(location.search) ? V3 : V2;
  var KEY = 'jeseol-v1';
  var save = load(), tab = 'tool', sayTimer = 0, toastTimer = 0, lastSave = 0, hud = {}, rankSeen = G.rankOf(save), dirty = false;

  function $(id) { return document.getElementById(id); }
  function load() { try { var raw = localStorage.getItem(KEY); return G.migrate(raw ? JSON.parse(raw) : null); } catch (e) { return G.newSave(); } }
  function persist() {
    var w = V.world && V.world();
    if (w && !w.demo && V.mode && V.mode() !== 'demo') G.serialize(w);
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 */ }
    lastSave = Date.now();
  }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pie() { return '<i class="pie" aria-hidden="true"></i>'; }
  function haengFace() { return JY.art && JY.CHARS ? JY.art.character(JY.CHARS.haeng.spec, { mouth: 'shout' }) : ''; }
  function insignia(r) { return JY.art ? JY.art.rankInsignia(r + 1) : ''; }

  function show(id) {
    ['title', 'shop'].forEach(function (s) { $(s).hidden = s !== id; });
    $('hud').hidden = id !== 'play' && id !== 'shop';
    $('h-shop').hidden = id !== 'play';
    if (id === 'title') $('say').hidden = true;
    $('say').classList.toggle('low', id === 'shop');
    if (id !== 'play') $('hint').hidden = true;
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
    b.innerHTML = html; m.hidden = false;
    b.onclick = function (e) { var el = e.target.closest('[data-m]'); if (!el) return; var k = el.getAttribute('data-m'); m.hidden = true; if (onClick) onClick(k); };
  }
  var chipTimer = 0;
  function chip(text, cls) {
    var c = $('chip'); c.textContent = text; c.className = cls || ''; c.hidden = false;
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

  /* ── 타이틀 ── */
  function title() {
    show('title');
    V.demo(save);
    var r = G.rankOf(save), started = !!save.snow;
    $('t-info').innerHTML = started || save.discharges
      ? '<span class="ins">' + insignia(r) + '</span><span>' + S.RANKS[r].name + ' · ' + save.day + '일차</span><span class="sep"></span>' + pie() + '<b>' + fmt(save.bank) + '</b>' +
        (G.crewCount(save) ? '<span class="sep"></span><span>인력 ' + G.crewCount(save) + '명</span>' : '') + (save.medals ? '<span class="sep"></span><span>전역 메달 ' + save.medals + '</span>' : '')
      : '<span>이병 · 싸리비 하나로 부대를 치운다</span>';
    $('t-start').textContent = started ? '이어서 작업' : '작업 개시';
    $('t-shop').hidden = !started;
    $('t-sound').textContent = X && X.muted() ? '소리 끔' : '소리 켬';
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
    if (X) X.wind({ light: 0.1, normal: 0.25, heavy: 0.55, blizzard: 0.9 }[w.weather] || 0.2);
    if (!resume) {
      banner(save.day + '일차 제설 작전', S.WEATHER[w.weather].name + ' · 퍼 담고 → 집하장에 부어라', 2400);
      setTimeout(function () { say(w.weather === 'heavy' || w.weather === 'blizzard' ? 'heavy' : 'start'); }, 600);
      if (X) X.whistle(false);
    }
    if (!save.seen.tut) $('hint').hidden = false;
    scanReady = 0; $('h-scan').disabled = !V.scan; $('h-scan').classList.remove('cool');
    var fresh = S.ZONES.filter(function (Z) { return save.seen['new' + Z.id]; })[0];
    if (fresh) {
      delete save.seen['new' + fresh.id]; persist();
      setTimeout(function () { if (V.focusZone) V.focusZone(fresh.id, 3.2); say('새 구역 「' + fresh.name + '」 — ' + fresh.reveal, 4200); }, resume ? 400 : 2300);
    }
  }
  function dayLabel(w) {
    $('h-day').textContent = save.day + '일차';
    $('h-wx').textContent = S.WEATHER[w.weather].name + (w.inspect ? ' · 순시' : '');
  }

  function onEvent(f) {
    if (f.t === 'deer') { chip('고라니 출현! 부딪히면 짊어진 눈을 쏟는다', 'warn'); vibrate(80); }
    else if (f.t === 'meHit') { chip(f.spilled ? '고라니한테 받혀서 짊어진 눈 ' + fmt(f.spilled) + ' 다 쏟았다!' : '고라니한테 받혔다!', 'bad'); vibrate([60, 40, 120]); flash(); }
    else if (f.t === 'snowball') { splat(); vibrate(50); }
    else if (f.t === 'car') chip('간부 차량 통과 중… 진입로가 더러워진다', 'warn');
    else if (f.t === 'heli') chip('헬기 착륙! 하강풍이 헬기장 눈을 날린다', 'good');
    else if (f.t === 'full') vibrate(30);
    else if (f.t === 'inspect') { chip('행보관 검열 통과: ' + f.name + ' +' + fmt(f.bonus), 'good'); if (X) X.stamp(); }
    else if (f.t === 'day') {
      var w = V.world(); dayLabel(w);
      banner(f.day + '일차', S.WEATHER[f.weather].name + (f.inspect ? ' · 대대장 순시 (검열 보너스 ×2)' : '') + ' · 어제 ' + fmt(f.earned) + ' 벌었다', 2600);
      if (f.dumped) setTimeout(function () { say('밤사이 눈이 또 왔다. 다시 치워!'); }, 900);
      else say('dayEnd');
      if (X) { X.whistle(false); X.wind({ light: 0.1, normal: 0.25, heavy: 0.55, blizzard: 0.9 }[f.weather] || 0.2); }
      persist();
    }
  }

  var scanReady = 0;
  function scan() {
    if (!V.scan || Date.now() < scanReady) return;
    if (V.scan()) { scanReady = Date.now() + 9000; var b = $('h-scan'); b.classList.add('cool'); setTimeout(function () { b.classList.remove('cool'); }, 9000); if (X) X.pop(); }
  }

  function tick(w) {
    var P = w.player, p = G.pct(w), pc = Math.floor(p * 100), bank = Math.floor(save.bank), ld = Math.floor(P.load), full = P.load >= P.cap;
    if (hud.pc !== pc) { hud.pc = pc; $('h-pct').textContent = pc + '%'; $('h-fill').style.width = Math.min(100, p * 100) + '%'; }
    if (hud.bank !== bank) { hud.bank = bank; $('h-bank').textContent = fmt(bank); }
    if (hud.ld !== ld || hud.cap !== P.cap) {
      hud.ld = ld; hud.cap = P.cap;
      $('h-load').textContent = full ? '가득!' : fmt(ld); $('h-cap').textContent = full ? '' : '/' + fmt(P.cap);
      $('h-cring').style.strokeDashoffset = String(119.4 * (1 - Math.min(1, P.load / P.cap)));
      $('h-carry').classList.toggle('full', full); $('h-carry').classList.toggle('mid', !full && P.load > P.cap * 0.6);
    }
    if (!save.seen.tut && P.moving && P.load > 0) { save.seen.tut = true; $('hint').hidden = true; }
    var r = G.rankOf(save);
    if (r > rankSeen) { rankSeen = r; $('h-ins').innerHTML = insignia(r); rankUp(r); }
    else if (G.canDischarge(save) && !save.seen.dis) { save.seen.dis = true; V.pause(true); modal('<div class="m-rank"><p class="kicker">전역 신고 가능</p><h3>이제 전역할 수 있다</h3><p>보급·인력의 <b>전역</b> 탭에서 신고하면 처음부터 다시 시작하지만, 전역 메달로 초코파이 보상이 영원히 늘어난다.</p><button class="btn big" data-m="ok">알겠다</button></div>', function () { V.pause(false); }); }
    var any = G.offers(save), n = 0;
    ['tool', 'crew', 'factory', 'zone'].forEach(function (k) { any[k].forEach(function (o) { if (o.ok) n++; }); });
    if (hud.n !== n) { hud.n = n; $('h-shop').classList.toggle('glow', n > 0); $('h-shop-n').textContent = n ? n : ''; $('h-shop-n').hidden = !n; }
    if (Date.now() - lastSave > 5000) persist();
  }

  function rankUp(r) {
    var unlocked = S.CREW.filter(function (C) { return C.rank === r; }).map(function (C) { return C.name; });
    if (X) X.rank();
    V.shake(3); V.pause(true);
    modal('<div class="m-rank"><div class="m-ins">' + insignia(r) + '</div><p class="kicker">진급을 축하한다</p><h3>' + S.RANKS[r].name + ' 진급!</h3>' +
      (unlocked.length ? '<p>새로 부려 먹을 수 있다: <b>' + unlocked.join(', ') + '</b></p>' : '<p>짬이 찼다. 이제 시키는 쪽이다.</p>') +
      '<button class="btn big" data-m="ok">충성!</button></div>', function () { V.pause(false); });
  }

  /* ── 보급·인력·공장 ── */
  var TABS = [['tool', '도구'], ['crew', '인력'], ['factory', '공장'], ['perk', '보급'], ['zone', '구역'], ['dis', '전역']];
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

  function openShop() {
    var w = V.world();
    if (w && V.mode() === 'play') { G.serialize(w); V.pause(true); }
    dirty = false;
    show('shop');
    renderShop();
  }
  function closeShop() {
    persist();
    if (dirty) play(true); else { show('play'); V.pause(false); }
    dirty = false;
  }

  function renderShop() {
    $('s-bank').textContent = fmt(save.bank);
    var showDis = G.rankOf(save) >= 3 || save.discharges > 0, all = G.offers(save);
    $('s-tabs').innerHTML = TABS.filter(function (t) { return t[0] !== 'dis' || showDis; }).map(function (t) {
      var o = t[0] === 'dis' ? [] : all[t[0]], n = o.filter(function (x) { return x.ok; }).length;
      return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + (n ? '<i class="dot">' + n + '</i>' : '') + '</button>';
    }).join('');
    var list = $('s-list'); list.innerHTML = '';
    if (tab === 'dis') { renderDischarge(list); return; }
    if (tab === 'factory') {
      var mk = save.made, pm = G.procMult(save);
      var head = document.createElement('div'); head.className = 'fac-head';
      head.innerHTML = '<b>눈 집하장 가공 라인</b><span>부은 눈 값 ×' + pm.toFixed(1) + '</span>' + (mk.brick >= 1 || mk.snowman >= 1 ? '<small>지금까지 눈벽돌 ' + fmt(mk.brick) + '장 · 환영 눈사람 ' + fmt(mk.snowman) + '개</small>' : '<small>압축기를 들이면 부은 눈이 눈벽돌이 된다</small>');
      list.appendChild(head);
    }
    var items = all[tab];
    if (!items.length) { list.insertAdjacentHTML('beforeend', '<p class="empty">' + (tab === 'zone' ? '모든 구역을 맡았다. 이제 부대 전체가 우리 담당이다.' : '살 것이 없다.') + '</p>'); return; }
    items.forEach(function (o) {
      var row = document.createElement('div');
      row.className = 'item s-' + o.state + (o.ok ? ' can' : '');
      var meta = o.kind === 'crew' ? o.tag + ' · ' + o.n + '/' + o.max + '명' : o.kind === 'perk' || o.kind === 'proc' ? 'Lv ' + o.n + '/' + o.max : o.kind === 'tool' ? o.stat : o.kind === 'zone' ? '눈 한 칸에 초코파이 ' + o.value + '개' : '';
      var label;
      if (o.state === 'buy') label = pie() + fmt(o.cost);
      else if (o.state === 'own') label = o.cur ? '사용 중' : '보유';
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
    var can = G.canDischarge(save), p = Math.min(1, save.life / S.DISCHARGE_LIFE), gain = G.medalGain(save);
    list.innerHTML = '<div class="dis"><div class="dis-ins">' + insignia(3) + '</div><h3>전역 신고</h3>' +
      '<p>지금까지 번 초코파이로 전역 메달을 받는다. 처음(이병, 싸리비)부터 다시 시작하지만 <b>메달 하나마다 모든 보상이 +10%</b> 영원히 늘어난다.</p>' +
      '<div class="dis-bar"><i style="width:' + Math.round(p * 100) + '%"></i></div><p class="dis-num">' + fmt(save.life) + ' / ' + fmt(S.DISCHARGE_LIFE) + ' (병장 + 누적 초코파이)</p>' +
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
    var t = e.target.closest('[data-tab]');
    if (t) { tab = t.getAttribute('data-tab'); renderShop(); $('s-list').scrollTop = 0; return; }
    var b = e.target.closest('.buy');
    if (!b) return;
    var kind = b.getAttribute('data-kind'), id = b.getAttribute('data-id');
    var r = G.buy(save, kind, id);
    if (!r.ok) { if (X) X.deny(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
    if (X) X.buy();
    dirty = true; persistRaw();
    toast(esc(r.item.name) + ({ crew: ' 투입!', zone: ' 담당!', tool: ' 지급!', relay: ' 가동!', proc: ' 설치!' }[kind] || ' 보급!'));
    if (kind === 'crew' && Math.random() < 0.5) say('hire', 2000);
    if (kind === 'tool') say('tool', 2000);
    if (kind === 'zone') say('zone', 2000);
    if (kind === 'relay') say('relay', 2000);
    if (kind === 'proc') say('proc', 2000);
    renderShop();
  }

  /* ── 시작 ── */
  function boot() {
    var hooks = { say: function (k) { say(k); }, tick: tick, event: onEvent };
    try { V.init($('cv'), hooks); } catch (e) { V = V2; V.init($('cv'), hooks); }
    document.body.classList.toggle('is3d', !!V.is3D);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { V.rebuildArt(); });
    $('say-face').innerHTML = haengFace();
    $('t-start').onclick = function () { play(false); };
    $('t-shop').onclick = function () { play(true); openShop(); };
    $('t-sound').onclick = function () { if (!X) return; X.setMuted(!X.muted()); $('t-sound').textContent = X.muted() ? '소리 끔' : '소리 켬'; if (!X.muted()) { X.unlock(); X.pop(); } };
    $('s-go').onclick = closeShop;
    $('s-back').onclick = closeShop;
    $('h-shop').onclick = openShop;
    $('shop').addEventListener('click', onShopClick);
    $('h-pause').onclick = pause;
    $('h-scan').onclick = scan;
    $('h-cam').hidden = !V.toggleCam;
    function camLabel() { $('h-cam-t').textContent = V.camMode && V.camMode() === 'near' ? '위에서 보기' : '가까이 보기'; }
    if (V.toggleCam) camLabel();
    $('h-cam').onclick = function () { if (!V.toggleCam) return; V.toggleCam(); camLabel(); if (X) X.pop(); };
    window.addEventListener('keydown', function (e) {
      if (V.mode() !== 'play') return;
      if (e.key === 'Tab' || e.key === 'q') { e.preventDefault(); scan(); }
      if (e.key === 'b' || e.key === 'e') openShop();
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { persist(); if (V.mode() === 'play') pause(); } });
    window.addEventListener('pagehide', persist);
    var off = G.offline(save, Date.now());
    title();
    if (off > 0) {
      save.bank += off; save.life += off;
      modal('<div class="m-rank"><div class="m-face">' + haengFace() + '</div><p class="kicker">당직 서는 동안</p><h3>후임들이 눈을 치웠다</h3><p class="m-big">' + pie() + '+' + fmt(off) + '</p><p>쉬는 동안에도 인력은 일한다. 그게 군대다.</p><button class="btn big" data-m="ok">수고했다</button></div>');
    }
    save.last = Date.now(); persistRaw();
  }

  function pause() {
    if (V.mode() !== 'play') return;
    V.pause(true); persist();
    modal('<div class="m-rank"><p class="kicker">잠깐</p><h3>쉬는 시간</h3><p>치운 곳과 짊어진 눈은 그대로 저장된다.</p><div class="res-btns"><button class="btn ghost" data-m="quit">처음 화면</button><button class="btn big" data-m="go">계속 치운다</button></div></div>', function (k) {
      if (k === 'quit') { persist(); title(); } else V.pause(false);
    });
  }

  window.__SNOW = {
    view: function () { return V; },
    save: function () { return save; },
    setSave: function (s) { save = G.migrate(s); rankSeen = G.rankOf(save); persistRaw(); },
    play: play, startDay: function () { play(false); }, openShop: openShop, closeShop: closeShop, title: title, persist: persist,
    autopilot: function (b) { V.setAutopilot(b); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.JY = window.JY || {});
