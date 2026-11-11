/* 제설각 — 화면 흐름: 타이틀 → 계속 이어지는 작업(HUD) ↔ 보급·인력·공장, 진급, 전역 */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim, A = JY.SnowAct, M = JY.SnowMeta, V2 = JY.SnowView, V3 = JY.SnowView3D, X = JY.SnowSfx;
  var V = V3 && V3.supported() && !/[?&]2d/.test(location.search) ? V3 : V2;
  var KEY = 'jeseol-v8', OLD_KEYS = ['jeseol-v1'];
  // v8: 예전 저장은 지우고 처음부터 (요청)
  try { OLD_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* 저장소 없음 */ }
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
  function dia() { return '<i class="dia" aria-hidden="true"></i>'; }
  function haengFace() { return JY.art && JY.CHARS ? JY.art.character(JY.CHARS.haeng.spec, { mouth: 'shout' }) : ''; }
  function insignia(r) { return JY.art ? JY.art.rankInsignia(r + 1) : ''; }

  function show(id) {
    ['title', 'shop'].forEach(function (s) { $(s).hidden = s !== id; });
    $('hud').hidden = id !== 'play' && id !== 'shop';
    $('h-shop').hidden = id !== 'play';
    ['acts', 'side'].forEach(function (k) { $(k).hidden = id !== 'play' || !A; });
    if (id !== 'play') { $('xhair').hidden = true; $('sub').hidden = true; } else fpLayout();
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
    if (!save.seen.tut) { hintText(); $('hint').hidden = false; }
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
    if (onActEvent(f)) return;
    if (onV6Event(f)) return;
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
    updAct(w); storyTick(w);
    var P = w.player, p = G.pct(w), pc = Math.floor(p * 100), bank = Math.floor(save.bank), ld = Math.floor(P.load), full = P.load >= P.cap;

    // 초코파이는 또르르 올라간다
    var bs = hud.bankShown === undefined || hud.bank === -1 ? bank : hud.bankShown;
    if (bs !== bank || hud.bank !== bank) {
      var df = bank - bs; bs = Math.abs(df) < 2 ? bank : Math.round(bs + df * 0.2 + (df > 0 ? 1 : -1));
      hud.bankShown = bs; hud.bank = bank; $('h-bank').textContent = fmt(bs);
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
  var TABS = [['tool', '도구'], ['crew', '인력'], ['factory', '공장'], ['perk', '보급'], ['zone', '구역'], ['look', '꾸미기'], ['story', '수첩'], ['medal', '훈장'], ['dis', '전역']];
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
    var items = all[tab];
    if (!items.length) { list.insertAdjacentHTML('beforeend', '<p class="empty">' + (tab === 'zone' ? '모든 구역을 맡았다. 이제 부대 전체가 우리 담당이다.' : '살 것이 없다.') + '</p>'); return; }
    items.forEach(function (o) {
      var row = document.createElement('div');
      row.className = 'item s-' + o.state + (o.ok ? ' can' : '');
      var meta = o.kind === 'crew' ? o.tag + ' · ' + o.n + '/' + o.max + '명' + (o.pend ? ' (전입 대기 ' + o.pend + ')' : '') + (o.dia ? ' · 다이아 ' + o.dia + '개 필요' : '') : o.kind === 'perk' || o.kind === 'proc' ? 'Lv ' + o.n + '/' + o.max : o.kind === 'tool' || o.kind === 'star' ? o.stat : o.kind === 'zone' ? '눈 한 칸에 초코파이 ' + o.value + '개' : '';
      var label;
      if (o.state === 'buy') label = (o.kind === 'crew' ? '전입 ' : '') + (o.cost ? pie() + fmt(o.cost) : '') + (o.dia ? dia() + o.dia : '');
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
    var lt = e.target.closest('[data-ltab]');
    if (lt) { lookTab = lt.getAttribute('data-ltab'); renderShop(); return; }
    var lk = e.target.closest('[data-look]');
    if (lk) {
      var cat = lk.getAttribute('data-cat'), id = lk.getAttribute('data-look'), st = lk.getAttribute('data-state');
      if (st === 'buy') { if (M.buyLook(save, cat, id)) { if (X) X.dia(); toast(M.lookName(cat + ':' + id) + ' 획득!'); } else { if (X) X.deny(); toast('다이아가 모자라다'); } }
      else if (st === 'own') { M.setLook(save, cat, id); if (X) X.pop(); }
      else { if (X) X.deny(); toast('스토리를 진행하면 열린다'); }
      persistRaw(); lookChanged(); renderShop(); return;
    }
    var rp = e.target.closest('[data-replay]');
    if (rp) { var ch = S.STORY.filter(function (c) { return c.id === rp.getAttribute('data-replay'); })[0]; if (ch) playStory(ch, true); return; }
    var du = e.target.closest('[data-dia]');
    if (du) {
      var w0 = V.world(), r0 = w0 && A ? A.useDia(w0, du.getAttribute('data-dia')) : { ok: false };
      if (r0.ok) { if (X) X.dia(); toast(du.getAttribute('data-dia') === 'morale' ? '전원 초코파이! 사기 100' : '대대 지원 요청! 60초 동안 인력 두 배'); persistRaw(); } else if (X) X.deny();
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
    if (kind === 'crew') toast('전입 요청! ' + esc(r.item.name) + '은(는) 내일 아침 생활관 앞에 온다'); else toast(esc(r.item.name) + ({ crew: ' 투입!', zone: ' 담당!', tool: ' 지급!', relay: ' 가동!', proc: ' 설치!', star: ' 완료!' }[kind] || ' 보급!'));
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
    var key = name + txt + cls + Math.round(pr * 200);
    if (hud.area === key) return;
    hud.area = key;
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
    $('combo-t').textContent = '눈 값 +' + Math.round((G.comboMult(w) - 1) * 100) + '%';
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
    if (f.t === 'dia') { if (X) X.dia(); if (f.why === 'rank') chip('진급 기념 다이아 +' + f.n, 'good'); return true; }
    if (f.t === 'found') {
      var rc = S.RARITY[f.item.r].color;
      chip((f.src === 'player' ? '' : '후임이 주웠다: ') + f.item.name + ' (' + RAR[f.item.r] + ')' + (f.first ? ' · 도감 등록!' : ''), f.item.r === 'c' ? '' : 'good');
      if (f.item.r === 'r' || f.item.r === 'l') { banner(f.item.name + '!!', f.item.line + (f.item.dia ? ' · 다이아 +' + f.item.dia : ''), 2600); if (X) X.fanfare(); vibrate([40, 30, 40, 30, 120]); }
      else { if (f.src === 'player') subtitle(f.item.line); if (X) X.found(); }
      return true;
    }
    if (f.t === 'combo') { var msg = { 25: '좋아!', 50: '훌륭해!', 100: '미쳤다!!', 200: '제설의 신!!', 300: '전설의 제설병', 500: '인간 제설차' }[f.n]; if (msg) chip('콤보 ' + f.n + ' — ' + msg, 'good'); return true; }
    if (f.t === 'comboEnd') return true;
    if (f.t === 'zonePerfect') { banner(f.name + ' 완벽 제설!', '구역 전체 100% · +' + fmt(f.bonus) + (f.mine ? ' · 다이아 +2' : ''), 2600); if (X) X.fanfare(); vibrate([60, 40, 60]); return true; }
    if (f.t === 'allClear') { if (X) { X.fanfare(); X.bugle(); } setTimeout(function () { daySummary(f); }, 1200); return true; }
    if (f.t === 'locked') { chip('출입 통제: ' + f.name + ' — 보급·인력에서 확장 (' + fmt(f.cost) + ')', 'warn'); if (X) X.deny(); vibrate(40); return true; }
    if (f.t === 'ach') { banner('훈장: ' + f.ach.name, f.ach.desc + ' · 다이아 +' + f.ach.dia + (f.ach.box ? ' · 보급 상자' : ''), 2600); if (X) X.fanfare(); return true; }
    if (f.t === 'officer') {
      if (f.state === 'arrive') { chip(f.title + ' 순찰 중! 마주치면 바로 경례!', 'warn'); if (X) X.bugle(); }
      else if (f.state === 'near') { if (X) X.whistle(false); vibrate([30, 30, 30]); }
      else if (f.state === 'miss') { chip(f.title + '께 경례를 안 했다! (분노)', 'bad'); vibrate([80, 40, 80]); }
      else if (f.state === 'saluted') { chip((f.quick ? '칼경례! ' : '경례 완료 · ') + f.title + (f.pie ? ' · +' + fmt(f.pie) : '') + (f.dia ? ' · 다이아 +' + f.dia : ''), 'good'); if (f.quick && X) X.perfect(); }
      else if (f.state === 'report') { chip(f.res === 'good' ? f.title + ' 칭찬! 보고 대성공' : f.res === 'ok' ? '보고 무난 · +' + fmt(f.pie || 0) : '보고했다가 혼났다…', f.res === 'bad' ? 'bad' : 'good'); }
      else if (f.state === 'help') chip('소대장님이 40초 동안 같이 치운다!', 'good');
      return true;
    }
    if (f.t === 'recruit') { banner('신병 전입!', '생활관 앞에 신병 ' + f.n + '명 · 가서 인솔해서 구역에 배치해라', 2600); if (X) X.bugle(); return true; }
    if (f.t === 'assigned') { chip(f.e.def.name + ' → ' + (G.zoneById(f.zone) || {}).name + ' 담당' + (f.moved ? ' (이동)' : '!'), 'good'); return true; }
    if (f.t === 'req') {
      if (f.state === 'new') chip(f.who + ': ' + (A.ITEM[f.item] || {}).want + ' 부탁 (' + f.where + ')', 'warn');
      else if (f.state === 'done') { chip('심부름 완료! ' + f.who + ' · +' + fmt(f.pay), 'good'); if (X) X.coin(); }
      else chip(f.who + '의 부탁을 못 들어줬다…', 'bad');
      return true;
    }
    if (f.t === 'hand') { if (f.item) toast(f.name + '을(를) 들었다'); return true; }
    if (f.t === 'slack') { if (!hud.slackSaid) { hud.slackSaid = true; chip('인력이 짱박혔다! 가서 일으키거나 초코파이를 줘라', 'warn'); setTimeout(function () { hud.slackSaid = false; }, 15000); } return true; }
    if (f.t === 'part' && f.perfect) {
      if (f.mine && f.first) { if (X) X.perfect(); vibrate([30, 30, 60]); }
      else if (X) X.ding();
      return true;
    }
    return false;
  }
  function daySummary(f) {
    if (V.mode() !== 'play') return;
    V.pause(true);
    var td = f.today || {};
    modal('<div class="m-rank"><div class="m-face">' + haengFace() + '</div><p class="kicker">' + f.day + '일차 · 전 구역 완벽</p><h3>조기 퇴근!</h3>' +
      '<ul class="sum"><li><span>오늘 번 초코파이</span><b>' + pie() + fmt(save.today) + '</b></li><li><span>조기 퇴근 보너스</span><b>' + pie() + '+' + fmt(f.bonus) + '</b></li>' +
      '<li><span>완벽 제설 조각</span><b>' + (td.perfect || 0) + '곳</b></li><li><span>오늘 받은 다이아</span><b>' + dia() + (td.dia || 0) + '</b></li>' +
      '<li><span>분실물</span><b>' + (td.found && td.found.length ? esc(td.found.join(', ')) : '없음') + '</b></li></ul>' +
      '<p>희귀 보급 상자도 하나 받았다. 오늘은 쉬어라. …내일도 눈 온다.</p><button class="btn big" data-m="ok">충성! 내일 뵙겠습니다</button></div>', function () { V.pause(false); });
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
      if (r.dia) html += '<div>' + dia() + ' 다이아 +' + r.dia + '</div>';
      if (r.item) html += '<div style="color:' + S.RARITY[r.item.r].color + '">' + esc(r.item.name) + ' (' + RAR[r.item.r] + ')</div>';
      $('box-loot').innerHTML = html;
      var ok = $('box-ok'); ok.disabled = false; ok.textContent = save.boxes.length ? '좋다! (상자 ' + save.boxes.length + '개 남음)' : '좋다!';
      if (X) { if (tier === 'legend') X.fanfare(); else X.perfect(); }
      if (w) hud.bank = -1;
    }, 900);
  }
  function crewHead(list) {
    var w = V.world(), mor = w && w.crew.length ? Math.round(w.crew.reduce(function (a, e) { return a + e.mor; }, 0) / w.crew.length) : save.mor || 80;
    var slack = w ? w.crew.filter(function (e) { return e.slack; }).length : 0, n = G.crewCount(save);
    var head = document.createElement('div'); head.className = 'crew-head';
    head.innerHTML = '<div class="row"><b>인력 ' + n + '명 · 사기 ' + (n ? mor : '-') + '</b>' + (slack ? '<small>짱박힌 인력 ' + slack + '명</small>' : '<small>사기가 바닥나면 짱박힌다</small>') + '</div>' +
      (n ? '<div class="row"><div class="morbar"><i style="width:' + mor + '%"></i></div></div>' : '') +
      '<p class="info">정원 <b>' + (n + G.pendN(save)) + '/' + G.crewCap(save) + '명</b> (진급하면 늘어난다)' + (G.pendN(save) ? ' · 전입 대기 <b>' + G.pendN(save) + '명</b>: 다음 날 아침 생활관 앞' : '') +
      '<br>인력은 <b>담당 구역</b>만 치운다. 옮기려면 가서 "따라와" → 새 구역에서 "여기 배치"</p>' +
      '<div class="dia-btns"><button data-dia="morale"' + (save.dia >= S.DIA.morale && n ? '' : ' disabled') + '>전원 초코파이 ' + dia() + S.DIA.morale + '</button><button data-dia="support"' + (save.dia >= S.DIA.support && n ? '' : ' disabled') + '>대대 지원 요청 ' + dia() + S.DIA.support + '</button></div>';
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
  var CAM_NEXT = { fp: '3인칭', near: '위에서', far: '1인칭' };
  function camLabel() { if (V.camMode) $('h-cam-t').textContent = CAM_NEXT[V.camMode()] || '시점'; }
  function fp() { return !!(V.isFP && V.isFP()); }
  function fpLayout() {
    var on = fp() && V.mode && V.mode() !== 'demo';
    document.body.classList.toggle('fp', on);
    $('xhair').hidden = !on || $('hud').hidden;
  }
  function hintText() {
    $('hint').innerHTML = fp()
      ? '<b>왼쪽 끌면 걷고, 오른쪽 끌면 둘러본다</b><span>도구는 알아서 쓴다 · 가까이 가면 <em>행동</em> 버튼이 바뀐다 (경례·갈구기·탈취…)</span>'
      : '<b>끌면 걷고, 빗자루는 알아서 쓴다</b><span>가득 차면 <em>눈 집하장</em>에 가서 부어야 초코파이!</span>';
  }
  function look() { return V.look ? V.look() : null; }
  function updAct(w, force) {
    if (!A) return;
    var now = Date.now();
    if (!force && now - actAt < 110) return;
    actAt = now;
    var lk = look(), t = lk ? A.best(w, lk, lk.fp) : null, key = t ? t.k + '|' + t.verb + '|' + t.name + '|' + (t.verb2 || '') : '';
    curT = t; if (V.setFocus) V.setFocus(t);
    if (hudA.key !== key) {
      hudA.key = key;
      var b = $('act-btn'), b2 = $('act2-btn'); b.disabled = !t;
      b2.hidden = !(t && t.verb2); if (t && t.verb2) b2.textContent = t.verb2;
      $('act-name').textContent = t ? t.name : '';
      $('act-verb').textContent = t ? t.verb : '행동';
      b.classList.toggle('pulse', !!t && (t.k === 'car' || t.k === 'exit' || t.k === 'plow'));
      $('xh-t').innerHTML = t ? '<b>' + esc(t.verb) + '</b> · ' + esc(t.name) : '';
      $('xhair').classList.toggle('on', !!t);
    }
    var can = A.canThrow(w); if (hudA.can !== can) { hudA.can = can; $('ball-btn').disabled = !can; }
    var st = A.state(w);
    saluteHud(st);
    if (hudA.heat !== st.heat) { hudA.heat = st.heat; $('h-heat').hidden = !st.heat; $('h-heat-s').textContent = '★★★'.slice(0, st.heat) + '☆☆☆'.slice(0, 3 - st.heat); }
    var rd = st.ride ? st.ride.name + ' ' + Math.ceil(st.ride.t) + '초' : '';
    if (hudA.rd !== rd) { hudA.rd = rd; $('h-ride').hidden = !st.ride; if (st.ride) { $('h-ride-n').textContent = rd; $('h-ride-f').style.width = Math.max(0, st.ride.t / st.ride.max * 100) + '%'; } }
    var m = st.mission, mk = m ? m.text + Math.floor(m.prog * 100) + Math.ceil(m.t) : '';
    if (hudA.m !== mk) {
      hudA.m = mk; $('h-mis').hidden = !m;
      if (m) {
        var pr = m.kind === 'clear' ? Math.round(m.prog * 100) + '% / ' + Math.round(m.goal * 100) + '%' : m.kind === 'ball' ? '' : fmt(Math.min(m.prog, m.goal)) + ' / ' + fmt(m.goal);
        $('h-mis-t').textContent = m.text + (pr ? ' · ' + pr : '');
        $('h-mis-fill').style.width = Math.min(100, Math.max(0, m.prog / m.goal * 100)) + '%';
        $('h-mis-time').innerHTML = '남은 시간 ' + Math.floor(m.t / 60) + ':' + ('0' + Math.max(0, Math.floor(m.t % 60))).slice(-2) + ' · 보상 ' + pie() + fmt(m.reward);
        $('h-mis').classList.toggle('late', m.t < 20);
      }
    }
    var hk = st.hand ? st.hand.name : '';
    if (hudA.hand !== hk) { hudA.hand = hk; $('h-hand').hidden = !st.hand; $('h-hand-n').textContent = hk; }
    var rk = st.reqs.map(function (q) { return q.who + q.item + Math.ceil(q.t / 5); }).join('|') + hk;
    if (hudA.rk !== rk) {
      hudA.rk = rk;
      $('h-reqs').innerHTML = st.reqs.slice(0, 3).map(function (q) {
        var have = st.hand && st.hand.id === q.item;
        return '<div class="' + (have ? 'have' : '') + '"><span><b>' + esc(q.who) + '</b>: ' + esc(q.want) + ' 부탁</span><small>' + (have ? '들고 있다 → 가서 건네줘라' : esc(q.from) + '에서 가져오기') + '</small><i><em style="width:' + Math.max(0, q.t / q.max * 100) + '%"></em></i></div>';
      }).join('');
    }
    var bk = st.buffs.map(function (x) { return x.name + ' ' + Math.ceil(x.t) + '초'; }).join('|');
    if (hudA.bk !== bk) { hudA.bk = bk; $('h-buffs').innerHTML = st.buffs.slice(0, 4).map(function (x) { return '<span>' + esc(x.name) + ' ' + Math.ceil(x.t) + '초</span>'; }).join(''); }
  }
  function doAct(alt) {
    var w = V.world && V.world();
    if (!A || !w || V.mode() !== 'play') return;
    updAct(w, true);
    if (!curT || (alt === true && !curT.verb2)) { if (X) X.deny(); return; }
    var r = A.act(w, curT, look(), alt === true);
    if (!r.ok && r.why === 'money') toast('초코파이가 모자라다');
    if (!r.ok && r.why === 'zone') toast('구역 안으로 데려가서 배치해라');
    if (r.ui === 'px') openPX();
    else if (r.ui === 'sleep') sleepFx(r);
    else if (!r.ok && r.why === 'stun') toast('넘어져서 아무것도 못 한다');
    if (X && r.ok) X.pop();
    actAt = 0; hudA.key = null;
  }
  function doBall() {
    var w = V.world && V.world();
    if (!A || !w || V.mode() !== 'play') return;
    var lk = look(), r = A.throwBall(w, lk, lk ? lk.pitch + 0.25 : 0.2);
    if (!r.ok && X) X.deny();
    hudA.can = null;
  }
  function subtitle(text) {
    var el = $('sub'); el.textContent = text; el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    clearTimeout(subTimer); subTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }
  function stars(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
  function onActEvent(f) {
    if (f.t === 'me') { subtitle(f.text); return true; }
    if (f.t === 'heat') {
      if (f.heat > 0) { chip('행보관 분노 ' + stars(f.heat) + ' 도망쳐! (생활관에 숨거나 경례로 무마)', 'bad'); vibrate([40, 30, 40]); }
      else if (f.why === 'forgive') chip('행보관이 봐줬다. 휴…', 'good');
      else if (f.why === 'hide') chip('생활관에 숨었다. 행보관이 그냥 지나간다', 'good');
      else if (f.why === 'lost') chip('따돌렸다…', 'good');
      return true;
    }
    if (f.t === 'caught') { banner('엎드려 뻗쳐!!', '행보관한테 잡혔다 · 초코파이 ' + fmt(f.fine) + '개 압수', 2600); flash(); vibrate([80, 50, 160]); return true; }
    if (f.t === 'buff') { chip(f.name + ': ' + f.desc + ' (' + f.sec + '초)', 'good'); return true; }
    if (f.t === 'buffEnd') return true;
    if (f.t === 'mission') {
      if (f.state === 'new') { chip('임무: ' + f.m.text, 'warn'); if (X) X.whistle(false); }
      else if (f.state === 'done') { banner('임무 완수!', f.m.text + ' · +' + fmt(f.pay) + ' 초코파이', 2200); if (X) { X.stamp(); X.coin(); } }
      else chip('임무 실패: ' + f.m.text, 'bad');
      return true;
    }
    if (f.t === 'gift') { if (X) { if (f.kind === 'none') X.deny(); else X.ding(); } return true; }
    if (f.t === 'ride') {
      if (f.on) chip(f.name + ' 운전 중! 기름 떨어지기 전에 실컷 밀어라', 'good');
      else chip(f.hand ? f.name + '에서 내렸다' : f.name + ' 기름이 떨어졌다', '');
      return true;
    }
    if (f.t === 'sleep' || f.t === 'gong') return true;
    return false;
  }
  function sleepFx(r) {
    var f = $('fade');
    f.innerHTML = '<b>Zzz…</b><span>' + (r.bonus ? '자는 동안 후임들이 ' + fmt(r.bonus) + ' 벌었다' : '꿀잠 잤다. 눈은 또 왔다') + '</span>';
    f.hidden = false; f.classList.remove('in'); void f.offsetWidth; f.classList.add('in');
    setTimeout(function () { f.hidden = true; }, 2200);
    persist();
  }
  function openPX() {
    var w = V.world(); V.pause(true);
    function render() {
      var items = A.pxItems(w);
      modal('<div class="m-rank px"><p class="kicker">PX · 냉동 있음</p><h3>뭐 사 먹을래?</h3><div class="px-list">' + items.map(function (it) {
        return '<button class="px-it' + (it.on ? ' on' : '') + '" data-px="' + it.id + '"' + (it.ok ? '' : ' disabled') + '><b>' + esc(it.name) + (it.on ? ' · 효과 중' : '') + '</b><small>' + esc(it.need || it.desc) + '</small><span>' + pie() + fmt(it.cost) + '</span></button>';
      }).join('') + '</div><p class="px-bank">' + pie() + fmt(save.bank) + '</p><button class="btn big" data-m="close">나가기</button></div>', function () { V.pause(false); });
      var b = $('modal-box'), base = b.onclick;
      b.onclick = function (e) {
        var px = e.target.closest('[data-px]');
        if (!px) return base(e);
        var r = A.pxBuy(w, px.getAttribute('data-px'));
        if (r.ok) { if (X) X.buy(); toast(esc(r.item.name) + ' 샀다!'); persistRaw(); } else if (X) X.deny();
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
      if (!replay) {
        var r = M.storyDone(save, ch); persistRaw();
        if (r && (r.dia || r.box || r.unlock)) chip('「' + M.fill(ch.title, save) + '」 ' + (r.dia ? '다이아 +' + r.dia + ' ' : '') + (r.box ? '보급 상자 ' : '') + (r.unlock ? '· ' + r.unlock + ' 해금' : ''), 'good');
      }
      if (wasPlay) V.pause(false);
      if (done) done();
    }
    $('talk-ok').onclick = function (e) {
      e.stopPropagation();
      var v = ($('talk-input').value || '').trim().slice(0, 6);
      save.look.name = v || '김제설'; persistRaw(); lookChanged();
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
    if (V.mode() !== 'play' || !$('modal').hidden) return;
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
      '<label class="look-name">이름<input id="look-name" maxlength="6" value="' + esc(save.look.name || '') + '" placeholder="김제설"><small>다이아 ' + save.dia + '개 · 다이아로 사거나 스토리로 연다</small></label>';
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

  var WHEN = { start: '처음', dump1: '처음 집하장에 부으면', perfect1: '처음 완벽 제설하면', crew1: '첫 인력이 오면', inspect: '사단장님 순시 날', canDischarge: '전역할 때' };
  function whenText(w) { if (WHEN[w]) return WHEN[w]; if (w.indexOf('zone:') === 0) return (G.zoneById(w.slice(5)) || {}).name + '을(를) 열면'; if (w.indexOf('rank:') === 0) return S.RANKS[+w.slice(5)].name + ' 진급'; return ''; }
  function renderStory(list) {
    list.insertAdjacentHTML('beforeend', '<p class="sec-t">제설 수첩 (' + S.STORY.filter(function (c) { return save.story[c.id]; }).length + '/' + S.STORY.length + ')</p>' + S.STORY.map(function (c, i) {
      var done = !!save.story[c.id];
      return '<div class="story-row' + (done ? '' : ' lock') + '"><div class="n">' + (i + 1) + '</div><div><b>' + (done ? esc(M.fill(c.title, save)) : '???') + '</b><small>' + esc(whenText(c.when)) + (c.reward ? ' · 보상 있음' : '') + '</small></div>' + (done ? '<button data-replay="' + c.id + '">다시 보기</button>' : '<span></span>') + '</div>';
    }).join(''));
  }
  function resetAll() {
    modal('<div class="m-rank"><p class="kicker">처음부터 다시</p><h3>정말 다 지울까?</h3><p>초코파이, 다이아, 인력, 구역, 꾸미기, 스토리가 <b>전부</b> 사라지고 이병부터 다시 시작한다.</p><div class="res-btns"><button class="btn ghost" data-m="no">아니</button><button class="btn big" data-m="yes">다 지운다</button></div></div>', function (k) {
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
    $('t-start').onclick = function () { play(false); };
    $('t-shop').onclick = function () { play(true); openShop(); };
    $('t-look').onclick = function () { tab = 'look'; play(true); openShop(); };
    $('t-reset').onclick = resetAll;
    function hapticLabel() { $('t-haptic').textContent = JY.snowHaptic ? '진동 켬' : '진동 끔'; }
    try { JY.snowHaptic = localStorage.getItem('jeseol-haptic') !== '0'; } catch (e) { JY.snowHaptic = true; }
    hapticLabel();
    $('t-haptic').onclick = function () { JY.snowHaptic = !JY.snowHaptic; try { localStorage.setItem('jeseol-haptic', JY.snowHaptic ? '1' : '0'); } catch (e) { /* 무시 */ } hapticLabel(); if (JY.snowHaptic) vibrate(30); };
    lookChanged();
    $('t-sound').onclick = function () { if (!X) return; X.setMuted(!X.muted()); $('t-sound').textContent = X.muted() ? '소리 끔' : '소리 켬'; if (!X.muted()) { X.unlock(); X.pop(); } };
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
      if (V.mode() !== 'play' || e.repeat) return;
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'Tab' || k === 'q') { e.preventDefault(); scan(); }
      if (k === 'b') openShop();
      if (k === 'e' || k === ' ' || k === 'Enter') { e.preventDefault(); doAct(false); }
      if (k === 'f') doBall();
      if (k === 'r') doAct(true);
      if (k === 'c') $('h-cam').onclick();
    });
    function press(id, fn) { var b = $(id); b.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); fn(); }); b.addEventListener('click', function (e) { if (e.detail === 0) fn(); }); }
    press('act-btn', function () { doAct(false); }); press('ball-btn', doBall); press('act2-btn', function () { doAct(true); });
    press('h-hand', function () { var w = V.world(); if (A && w && V.mode() === 'play' && A.drop(w)) { if (X) X.pop(); hudA.hand = null; } });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { persist(); if (V.mode() === 'play') pause(); } });
    window.addEventListener('pagehide', persist);
    var off = G.offline(save, Date.now());
    title();
    if (off > 0) {
      save.bank += off; save.life += off;
      modal('<div class="m-rank"><div class="m-face">' + haengFace() + '</div><p class="kicker">당직 서는 동안</p><h3>후임들이 눈을 치웠다</h3><p class="m-big">' + pie() + '+' + fmt(off) + '</p><p>쉬는 동안에도 인력은 일한다. 그게 군대다.</p><button class="btn big" data-m="ok">수고했다</button></div>', function () { rollCall(); });
    } else rollCall();
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
    setSave: function (s) { save = G.migrate(s); rankSeen = G.rankOf(save); persistRaw(); lookChanged(); },
    play: play, startDay: function () { play(false); }, openShop: openShop, closeShop: closeShop, title: title, persist: persist,
    autopilot: function (b) { V.setAutopilot(b); },
    act: function () { doAct(); }, ball: function () { doBall(); }, openBox: function () { openBox(); }, target: function () { var w = V.world(); if (w) updAct(w, true); return curT; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.JY = window.JY || {});
