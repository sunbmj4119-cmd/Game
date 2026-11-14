#!/usr/bin/env node
/* 제설각 브라우저 점검 (v11): 타이틀 → 로비 → 교범 → 전입 → 작전('지금 할 일'·끌어서 걷기) → 붓기(초코파이가 날아간다)
 * → 보급 원 → 경례 → 빙판(지나가면 줍고 들어가면 뿌린다) → 간부(가운데 큰 경례 버튼) → 폭풍 제설·폭설 → 보고 원 → 검열 결과
 * → 로비(PX·전화·체력단련·보급) → 브리핑 → 신병(다가가면 따라온다) → 이어하기 → 진급 심사 → 진급 신고 → 상병 조원 배치
 * → 빠진 차(붙어 있으면 민다) → 병장 2배속 → 전역 → 설정·처음부터 → 쉬는 동안 → v8 저장 이전
 * node tests/snow-play.js [스크린샷 폴더] [너비x높이]      (SNOW_URL로 다른 파일/2D 지정) */
'use strict';
var path = require('path'), fs = require('fs');
var { chromium } = require('playwright');
var shots = process.argv[2] || null, size = (process.argv[3] || '390x844').split('x').map(Number);
var url = process.env.SNOW_URL || 'file://' + path.join(__dirname, '..', 'snow.html');

(async function () {
  var browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  var page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: shots ? 2 : 1 });
  var errors = [], checks = [];
  page.on('pageerror', function (e) { errors.push(String(e)); });
  page.on('console', function (m) { if (m.type() === 'error' && !/fonts\.g|ERR_|net::|vibrate/.test(m.text())) errors.push(m.text()); });
  function ok(name, cond, detail) { checks.push({ name: name, ok: !!cond, detail: detail }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function shot(name) { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name + '.png') }); }
  async function vis(sel) { return page.evaluate(function (s) { var e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0; }, sel); }
  function txt(id) { return page.evaluate(function (i) { var e = document.getElementById(i); return e ? e.textContent : ''; }, id); }
  function W() { return page.evaluate(function () { var w = __SNOW.view().world(), s = __SNOW.save(); return { x: w.player.x, y: w.player.y, load: w.player.load, cap: w.player.cap, clear: w.clear, bank: s.bank, crew: w.crew.length, mode: __SNOW.view().mode() }; }); }
  // 손가락 끌기 (pointerType: touch)
  async function touchDrag(x0, y0, x1, y1, hold) {
    await page.evaluate(function (a) {
      var cv = document.getElementById('cv'); function ev(t, x, y) { cv.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true })); }
      ev('pointerdown', a[0], a[1]); for (var i = 1; i <= 6; i++) ev('pointermove', a[0] + (a[2] - a[0]) * i / 6, a[1] + (a[3] - a[1]) * i / 6);
    }, [x0, y0, x1, y1]);
    await sleep(hold);
    await page.evaluate(function (a) { document.getElementById('cv').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: a[0], clientY: a[1], bubbles: true })); }, [x1, y1]);
  }
  function verbIs(re) { return waitFor(new Function('return ' + re + '.test(document.getElementById("act-verb").textContent) && !document.getElementById("acts").classList.contains("off")'), 4000); }
  function goalIs(re) { return waitFor(new Function('return ' + re + '.test(document.getElementById("g-t").textContent) && !document.getElementById("goal").hidden'), 4000); }
  async function closeModal() { for (var i = 0; i < 3; i++) { if (!(await vis('#modal'))) return; await page.click('#modal [data-m]'); await sleep(250); } }
  async function waitFor(fn, ms) { for (var t = 0; t < (ms || 4000); t += 150) { if (await page.evaluate(fn)) return true; await sleep(150); } return false; }
  async function overflow() {
    return page.evaluate(function () {
      var bad = [];
      document.querySelectorAll('#app *').forEach(function (el) {
        if (el.closest('[hidden]') || el.closest('svg') || el.closest('#ov3d') || el.closest('#coins') || el.tagName === 'CANVAS' || el.closest('.tabs')) return;
        var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (r.right > innerWidth + 1 || r.left < -1) bad.push((el.id || el.className || el.tagName) + ' x' + Math.round(r.left) + '-' + Math.round(r.right));
      });
      return bad;
    });
  }
  async function enter() { if (await vis('#splash')) { await page.click('#splash'); await sleep(500); } }
  async function talkThrough(name) { for (var i = 0; i < 30 && await vis('#talk'); i++) { if (await vis('#talk-name')) { await page.fill('#talk-input', name || '홍길동'); await page.click('#talk-ok'); } else await page.click('.talk-box'); await sleep(130); } }
  function clearZone(id, upto) { return page.evaluate(function (a) { var w = __SNOW.view().world(), Z = JY.SnowSim.zoneById(a[0]), zi = JY.SnowSim.zoneIndex(a[0]), bag = { cap: 1e9, load: 0, val: 0 }; for (var y = Z.y; y < Z.y + Z.h; y += 10) for (var x = Z.x; x < Z.x + Z.w; x += 10) { if (a[1] && w.zoneClear[zi] / w.zoneTotal[zi] >= a[1]) return; JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag); } }, [id, upto || 0]); }
  function quiet() { return page.evaluate(function () { var w = __SNOW.view().world(); w.events = []; w.deer = []; w.player.stun = 0; if (w.act) { w.act.off = []; w.act.offPlan = []; w.act.nagT = 999; } }); }
  function goTo(x, y, yaw, pitch) { return page.evaluate(function (a) { var V = __SNOW.view(), w = V.world(); V._teleport(a[0], a[1]); w.player.dir = { x: Math.sin(a[2]), y: Math.cos(a[2]) }; if (V._setLook) V._setLook(a[2], a[3] === undefined ? -0.1 : a[3]); }, [x, y, yaw || 0, pitch]); }
  function onPad(id) { return page.evaluate(function (k) { var p = JY.SNOW.PADS[k]; __SNOW.view()._teleport(p.x, p.y); }, id); }
  async function toHub() { for (var i = 0; i < 12; i++) { await talkThrough(); if (await vis('#modal')) { await page.click('#modal [data-m]'); await sleep(350); continue; } if (await vis('#hub')) return true; await sleep(300); } return vis('#hub'); }

  page.setDefaultTimeout(8000);
  try {
  await page.goto(url);
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('jeseol-v1', '{"bank":999}'); });
  await page.reload();
  await sleep(600);
  ok('아주 예전 저장(v1)은 지워지고 처음부터', await page.evaluate(function () { return localStorage.getItem('jeseol-v1') === null && __SNOW.save().bank === 0 && __SNOW.save().v === 10; }));
  ok('타이틀 화면: 큰 로고 + "화면을 눌러 시작"', await vis('#splash') && await vis('.sp-logo') && /눌러/.test(await txt('sp-go')) && !(await vis('#t-start')));
  await shot('00-splash');
  await enter();
  await closeModal();
  ok('누르면 로비', !(await vis('#splash')) && await vis('#t-start') && await vis('#hub-card'));
  var lb = await page.evaluate(function () { return { b: document.getElementById('t-start-b').textContent, card: document.getElementById('hub-card').textContent, road: document.querySelectorAll('#hub .road li').length, now: (document.querySelector('#hub .road li.now') || {}).textContent, side: document.querySelectorAll('.lb-left button').length, right: document.getElementById('hub-grid').hidden }; });
  ok('처음 로비: 전입 신고 · 내 카드 · 진급 길 5칸(이병 지금) · 왼쪽 버튼 5개 · 생활관 버튼은 아직', /전입 신고/.test(lb.b) && /이병/.test(lb.card) && lb.road === 5 && /이병/.test(lb.now) && lb.side === 5 && lb.right, lb);
  await shot('01-lobby');
  var ov0 = await overflow(); ok('로비 넘침 없음', !ov0.length, ov0);

  // ── v13: 처음 출동하면 교범 없이 바로 짧은 장면 (교범은 로비 버튼) ──
  await page.click('[data-hub="help"]');
  ok('로비 교범 버튼: 4장 (끌기·쌓기·원·★)', await waitFor(function () { return !!document.querySelector('#modal .m-help'); }, 3000) && /끌어서 걷는다/.test(await txt('modal')));
  await shot('01a-help');
  for (var hp = 0; hp < 4; hp++) { await page.click('#modal [data-h="next"]'); await sleep(150); }
  await page.click('#t-start');
  var talk = await waitFor(function () { return !document.getElementById('talk').hidden; }, 4000);
  ok('처음 출동: 교범 없이 바로 전입 첫날 장면', talk && /전입 첫날/.test(await txt('talk-title')) && !(await vis('#modal')));
  for (var tk = 0; tk < 6 && !(await vis('#talk-name')); tk++) { await page.click('.talk-box'); await sleep(150); }
  ok('이름을 묻는다', await vis('#talk-name'));
  await page.fill('#talk-input', '홍길동'); await page.click('#talk-ok');
  for (tk = 0; tk < 12 && !(await page.evaluate(function () { return document.getElementById('talk').hidden; })); tk++) { await page.click('.talk-box'); await sleep(150); }
  var pro = await page.evaluate(function () { var s = __SNOW.save(); return { name: s.look.name, done: !!s.story.prologue, mode: __SNOW.view().mode() }; });
  ok('이름 저장 + 장면 끝나면 작전 시작', pro.name === '홍길동' && pro.done && pro.mode === 'play', pro);

  // ── 작전 화면: 시계 · '지금 할 일' · 지시서 ──
  await sleep(700);
  ok('v13 작전 HUD: 시계 05:3x · 구역 1곳이면 지시서 카드 없음 (위 한 줄이 같은 말)', /^05:3\d$/.test(await txt('h-day')) && !(await vis('#h-op')));
  ok('화면 위 "지금 할 일" 한 줄: 생활관 앞 길 치우기 + 막대', await goalIs('/생활관 앞 길 치우기/') && await page.evaluate(function () { return document.getElementById('goal').classList.contains('has-bar'); }));
  ok('작전 중엔 보급 버튼·눈덩이 버튼이 없다 (집중)', !(await vis('#h-shop')) && !(await page.$('#ball-btn')) && !(await page.$('#h-heat')));
  ok('할 게 없으면 행동 버튼이 숨는다', await page.evaluate(function () { return document.getElementById('acts').classList.contains('off'); }));
  ok('v13 처음엔 버튼이 정지 하나 (돋보기·시점·상자·상점은 나중에)', await vis('#h-pause') && !(await vis('#h-scan')) && !(await vis('#h-cam')) && !(await vis('#h-box')) && !(await vis('#h-dia')));
  // 시작 배너가 떠 있는 동안엔 숨는다 (배너가 지나가면 나온다)
  ok('첫 조작 안내 한 줄 (끌어서 걷기)', await waitFor(function () { var e = document.getElementById('hint'); return !e.hidden && e.getBoundingClientRect().height > 0; }, 4000) && /끌어서 걷기/.test(await txt('hint')));
  var is3 = await page.evaluate(function () { return !!__SNOW.view().is3D; });
  var cam0 = await page.evaluate(function () { var V = __SNOW.view(); return V.camMode ? V.camMode() : 'none'; });
  ok('처음 시점은 위에서 내려다보기 (조준점 없음)', !is3 || (cam0 === 'near' && await page.evaluate(function () { return document.getElementById('xhair').hidden; })), cam0);
  await shot('02-start');
  var p0 = await W();
  await touchDrag(size[0] * 0.5, size[1] * 0.55, size[0] * 0.5, size[1] * 0.55 - 60, 1500);
  var p1 = await W();
  ok('화면 가운데를 위로 끌면 위(북쪽)로 걷는다', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 30 && p1.y < p0.y, [p0, p1]);
  ok('치우면 돈이 아니라 짐이 된다', p1.load > 0 && p1.clear > p0.clear && p1.bank - p0.bank <= 20, [p0, p1]);
  await page.evaluate(function () { var w = __SNOW.view().world(); if (w.player.load < 21) { w.player.load = 21; w.player.val = 21; } });
  ok('짐 20 → 할 일 완료 알림', await waitFor(function () { return (__SNOW.save().quest || 0) >= 1; }, 3000));
  ok('짐을 지면 안내가 사라진다', !(await vis('#hint')));
  if (is3) {
    await page.evaluate(function () { __SNOW.view().toggleCam('fp'); });
    var lk0 = await page.evaluate(function () { return __SNOW.view().look(); }), q0 = await W();
    await page.mouse.move(size[0] * 0.75, size[1] * 0.5); await page.mouse.down();
    await page.mouse.move(size[0] * 0.75 + 120, size[1] * 0.5 - 30, { steps: 5 }); await page.mouse.up();
    var lk1 = await page.evaluate(function () { return __SNOW.view().look(); }), q1 = await W();
    ok('1인칭(시점 버튼)에선 오른쪽을 끌면 고개만 돌아간다', Math.abs(Math.atan2(lk1.x, lk1.y) - Math.atan2(lk0.x, lk0.y)) > 0.4 && lk1.pitch > lk0.pitch && Math.hypot(q1.x - q0.x, q1.y - q0.y) < 4, [lk0, lk1]);
    await page.evaluate(function () { __SNOW.view().toggleCam('near'); });
  }
  await page.evaluate(function () { __SNOW.view()._teleport(200, 160); });
  var k0 = (await W()).y;
  await page.keyboard.down('ArrowDown'); await sleep(700); await page.keyboard.up('ArrowDown');
  ok('방향키로도 걷는다', (await W()).y > k0 + 15);

  // ── 가득 차면 → 집하장에 붓기 (+금액, 초코파이가 지갑으로) ──
  await page.evaluate(function () { var w = __SNOW.view().world(); w.player.load = w.player.cap - 1; w.player.val = w.player.cap - 1; __SNOW.view()._teleport(250, 190); });
  await page.keyboard.down('ArrowRight'); await sleep(500); await page.keyboard.up('ArrowRight');
  var full = await waitFor(function () { return document.getElementById('h-carry').classList.contains('full'); }, 3000);
  ok('가득 차면 게이지에 "가득!"', full && /가득/.test(await txt('h-load')));
  ok('가득 차면 "지금 할 일" = 집하장에 붓기 (노란색)', await goalIs('/집하장에 붓기/') && await page.evaluate(function () { return document.getElementById('goal').classList.contains('t-gold'); }));
  if (is3) ok('등에 눈 블록이 쌓인다', await page.evaluate(function () { return __SNOW.view().world().player.load > 0; }));
  await shot('03-full');
  // (느린 2D에서는 앞 단계에서 이미 한 번 부어 '첫 초코파이' 장면이 먼저 떴을 수 있다 → 장면을 넘기고 다시 가득 채운다)
  var early = await page.evaluate(function () { return !document.getElementById('talk').hidden && /첫 초코파이/.test(document.getElementById('talk-title').textContent); });
  if (early) { await talkThrough(); await page.evaluate(function () { var w = __SNOW.view().world(); w.player.load = w.player.cap; w.player.val = w.player.cap; }); }
  var b0 = (await W()).bank;
  await page.evaluate(function () { window.__pay = 0; new MutationObserver(function () { if (document.querySelector('#coins .pay-pop')) window.__pay++; }).observe(document.getElementById('coins'), { childList: true }); var d = JY.SNOW.DUMP; __SNOW.view()._teleport(d.x + 40, d.y); });
  await page.keyboard.down('ArrowLeft'); await sleep(800); await page.keyboard.up('ArrowLeft');
  var dumped = await W();
  ok('집하장에 들어가면 붓고 초코파이', dumped.load === 0 && dumped.bank > b0, [b0, dumped]);
  ok('부으면 +금액이 튀어 오른다 (초코파이가 지갑으로)', await page.evaluate(function () { return window.__pay > 0; }) || !is3);
  var t2 = await waitFor(function () { return !document.getElementById('talk').hidden && /첫 초코파이/.test(document.getElementById('talk-title').textContent); }, 4000);
  var d2 = await page.evaluate(function () { return __SNOW.save().dia; });
  await talkThrough();
  ok('v13 작전 중엔 이야기 장면이 끊지 않는다 (생활관에서)', !t2 && !early);
  await page.evaluate(function () { var s = __SNOW.save(); JY.SNOW.STORY.forEach(function (c) { if (c.id !== 'firstOp') s.story[c.id] = true; }); });
  await shot('04-dump');

  // ── 보급 원: 초코파이가 모이면 원 위에 1초 ──
  await quiet();
  await page.evaluate(function () { __SNOW.save().bank = 400; var w = __SNOW.view().world(); w.haeng.x = 330; w.haeng.y = 268; w.haeng.hold = 60; });
  await goTo(200, 205, 0);
  ok('살 수 있으면 "지금 할 일" = 넉가래 받을 수 있다!', await goalIs('/넉가래 받을 수 있다/'));
  if (is3) ok('땅 위 보급 원 이름표 (넉가래 · 값)', await waitFor(function () { var e = document.querySelector('.ov-pad.supply.ok'); return e && /넉가래/.test(e.textContent) && e.style.display !== 'none'; }, 3000));
  await shot('05a-supply');
  await onPad('supply');
  ok('보급 원 위에 서 있으면 → 바로 지급 (적재 110)', await waitFor(function () { return __SNOW.save().tool === 1 && __SNOW.view().world().player.cap === 110; }, 4000) && await waitFor(function () { return /넉가래 보급/.test(document.getElementById('banner').textContent); }, 2000));
  await shot('05-tool');
  // 행보관에게 경례 (버튼)
  await page.evaluate(function () { var w = __SNOW.view().world(); w.haeng.x = 200; w.haeng.y = 228; w.haeng.hold = 60; });
  await goTo(200, 205, 0); await verbIs('/경례/');
  await page.click('#act-btn');
  await waitFor(function () { var s = document.getElementById('sub'); return !s.hidden && /충성/.test(s.textContent); }, 2500);
  var sal = await page.evaluate(function () { return { sub: document.getElementById('sub').textContent, buff: JY.SnowAct.state(__SNOW.view().world()).buffs.map(function (b) { return b.id; }) }; });
  ok('행보관 앞에선 행동 버튼: 경례 → "충성!" + 칭찬 버프', /충성/.test(sal.sub) && sal.buff.indexOf('praise') >= 0, sal);

  // ── 빙판 → 제설함을 지나가면 포대 → 빙판에 들어가면 뿌린다 ──
  await quiet();
  await page.evaluate(function () { __SNOW.save().rank = 1; var w = __SNOW.view().world(), p = w.parts.filter(function (q) { return q.ice; })[0], bag = { cap: 1e9, load: 0, val: 0 }; w.haeng.x = 700; w.haeng.y = 1100; w.haeng.hold = 60; for (var y = p.y; y < p.y + p.h; y += 10) for (var x = p.x; x < p.x + p.w; x += 10) JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag); __SNOW.view()._teleport(200, 160); });
  ok('그늘 구간이 언다 (v13: 일병부터)', await waitFor(function () { return __SNOW.view().world().parts.some(function (q) { return q.icy && !q.salted; }); }, 3000));
  ok('"지금 할 일" = 제설함에서 염화칼슘 (파란색)', await goalIs('/제설함/') && await page.evaluate(function () { return document.getElementById('goal').classList.contains('t-blue'); }));
  await page.evaluate(function () { var b = JY.SNOW.PROPS.filter(function (p) { return p.id === 'saltbox'; })[0]; __SNOW.view()._teleport(b.ux, b.uy + 10); });
  ok('제설함 옆을 지나가면 포대를 든다', await waitFor(function () { return !document.getElementById('h-hand').hidden && /염화칼슘/.test(document.getElementById('h-hand').textContent); }, 3000));
  ok('"지금 할 일" = 빙판에 염화칼슘', await goalIs('/빙판에 염화칼슘/'));
  await page.evaluate(function () { var w = __SNOW.view().world(), p = w.parts.filter(function (q) { return q.ice; })[0]; __SNOW.view()._teleport(p.x + p.w / 2, p.y + p.h / 2); });
  await shot('06-salt');
  ok('빙판에 들어가면 저절로 뿌린다 (경고 사라짐)', await waitFor(function () { var w = __SNOW.view().world(); return w.parts.filter(function (q) { return q.ice; })[0].salted && document.getElementById('h-hand').hidden && !/빙판/.test(document.getElementById('g-t').textContent || ''); }, 3000));
  await page.evaluate(function () { __SNOW.save().rank = 0; });

  // ── 간부 순찰: 화면 가운데 큰 빨간 "경례" ──
  await quiet();
  await page.evaluate(function () { var w = __SNOW.view().world(), o = JY.SnowAct.spawnOfficer(w, 'cpt'); o.x = w.player.x + 12; o.y = w.player.y + 30; o.phase = 'stay'; o.stayT = 60; });
  await sleep(300);
  ok('v13 간부가 오면 큰 경례 버튼(아래쪽) + 빨간 한 줄 (같은 말 띠는 숨김)', await waitFor(function () { return /경례/.test(document.getElementById('act-verb').textContent) && document.getElementById('acts').classList.contains('salute') && document.getElementById('goal').classList.contains('t-red'); }, 3000));
  await shot('07-officer');
  await page.click('#act-btn', { force: true });
  await waitFor(function () { return document.getElementById('salute').hidden; }, 3000);
  ok('경례하면 알림이 사라지고 보상', !(await vis('#salute')) && await page.evaluate(function () { return (__SNOW.save().stats.salute || 0) >= 2 && !document.getElementById('acts').classList.contains('salute'); }));
  var ov1 = await overflow(); ok('작전 화면 넘침 없음', !ov1.length, ov1);

  // ── 반전: 폭풍 제설 · 폭설 경보 ──
  await page.evaluate(function () { var w = __SNOW.view().world(); w.fever = 6; w.fx.push({ t: 'fever', on: true, n: 40 }); });
  ok('폭풍 제설: 배너 + 금빛 배지(남은 초)', await waitFor(function () { return /폭풍 제설/.test(document.getElementById('banner').textContent) && !document.getElementById('fever').hidden && document.body.classList.contains('fever'); }, 3000));
  await shot('07b-fever');
  await page.evaluate(function () { var w = __SNOW.view().world(); w.fever = 0; JY.SnowSim.spawn(w, 'surge'); });
  ok('폭설 경보: 배너 + 남은 초', await waitFor(function () { return /폭설 경보/.test(document.getElementById('banner').textContent) && !document.getElementById('surge').hidden; }, 3000));
  await page.evaluate(function () { __SNOW.view().world().surge = 0.01; });
  ok('폭설이 끝나면 배지가 사라진다', await waitFor(function () { return document.getElementById('surge').hidden && !document.body.classList.contains('surge'); }, 3000));

  // ── 지시서 완료 → 보고 원 → 검열 결과 ──
  await quiet();
  await clearZone('A', 0.87);
  ok('지시서 완료 → "작업 완료!"', await waitFor(function () { return /작업 완료|지시서 다 했다/.test(document.getElementById('banner').textContent); }, 4000));
  ok('다 하면 "지금 할 일" = 작업 완료 보고 (초록색)', await goalIs('/작업 완료 보고/') && await page.evaluate(function () { return document.getElementById('goal').classList.contains('t-green'); }));
  await onPad('report');
  var res = await waitFor(function () { return !!document.querySelector('#modal .m-res'); }, 5000);
  ok('보고 원 위에 서 있으면 검열 결과 (★·지시서·보상·근무평정)', res && await page.evaluate(function () { var m = document.getElementById('modal'); return m.querySelectorAll('.res-stars i.on').length >= 1 && /지시서/.test(m.textContent) && /근무평정/.test(m.textContent) && __SNOW.view().mode() === 'paused'; }));
  ok('일찍 보고하면 조기 퇴근 수당', /조기 퇴근/.test(await txt('modal')));
  await sleep(900); await shot('08-results');
  var ov2 = await overflow(); ok('검열 결과 넘침 없음', !ov2.length, ov2);
  var after = await page.evaluate(function () { var s = __SNOW.save(); return { day: s.day, merit: s.merit, ops: s.stats.ops }; });
  ok('작전 끝: 2일차, 근무평정 쌓임', after.day === 2 && after.merit >= 2 && after.ops === 1, after);
  await page.click('#modal [data-m]');
  ok('첫 작전 끝 장면', await waitFor(function () { return !document.getElementById('talk').hidden && /첫 작전 끝/.test(document.getElementById('talk-title').textContent); }, 3000));

  // ── 로비 (저녁) ──
  ok('로비로', await toHub());
  var hub = await page.evaluate(function () { return { card: document.getElementById('hub-card').textContent, info: document.getElementById('hub').textContent, b: document.getElementById('t-start-b').textContent, s: document.getElementById('t-start-s').textContent, grid: !document.getElementById('hub-grid').hidden, fever: !document.getElementById('fever').hidden || document.body.classList.contains('fever') }; });
  var news13 = await page.evaluate(function () { return { n: document.querySelectorAll('#hub .news li').length, t: document.querySelector('#hub .news').textContent }; });
  ok('v13 로비: 내 카드 + 소식 2줄(할 일 먼저) + 출동', /이병 홍길동/.test(hub.card) && /막내/.test(hub.card) && /★/.test(hub.card) && news13.n <= 2 && /할 일/.test(news13.t) && /제설 출동/.test(hub.b), [hub, news13]);
  await shot('09-hub');
  var ov3 = await overflow(); ok('로비 넘침 없음', !ov3.length, ov3);
  // v13: 첫 작전 뒤 로비 — 열린 것만 (PX·체력단련·휴가는 일병부터), 새로 열린 버튼엔 N
  var gate13 = await page.evaluate(function () { function h(k) { var b = document.querySelector('.lb-side [data-hub="' + k + '"]'); return !b || b.hidden; } var sh = document.querySelector('.lb-side [data-hub="shop"]'); return { px: h('px'), pull: h('pull'), leave: h('leave'), shop: !h('shop'), help: !h('help'), newShop: sh && sh.classList.contains('new') }; });
  ok('v13 첫 작전 뒤 로비: 보급 열림(N), PX·체력단련·휴가는 아직', gate13.shop && gate13.help && gate13.newShop && gate13.px && gate13.pull && gate13.leave, gate13);
  await page.evaluate(function () { __SNOW.save().rank = 1; __SNOW.renderHub(); });
  ok('v13 일병이 되면 PX·체력단련·휴가가 열린다', await page.evaluate(function () { return ['px', 'pull', 'leave'].every(function (k) { var b = document.querySelector('.lb-side [data-hub="' + k + '"]'); return b && !b.hidden && b.classList.contains('new'); }); }));
  // PX: 내일 작전 준비물
  await page.evaluate(function () { __SNOW.save().bank += 2000; __SNOW.renderHub(); });
  await page.click('[data-hub="px"]'); await sleep(300);
  ok('PX: 내일 작전 준비물', await vis('#modal .px-it') && /준비물/.test(await txt('modal')));
  await page.click('#modal [data-px="hotpack"]'); await sleep(150);
  ok('핫팩 챙김', await page.evaluate(function () { return !!__SNOW.save().prep.hotpack && !!document.querySelector('#modal .px-it.on'); }));
  await shot('10-px');
  await page.click('#modal [data-m="close"]'); await sleep(200);
  // 공중전화 (하루 한 번)
  ok('공중전화에 "!" 배지', await vis('#hub-phone-n'));
  await page.click('[data-hub="phone"]');
  ok('공중전화 → 통화 장면', await waitFor(function () { return !document.getElementById('talk').hidden && /공중전화/.test(document.getElementById('talk-title').textContent); }, 3000));
  await talkThrough();
  ok('전화는 하루 한 번 (배지 사라짐)', !(await vis('#hub-phone-n')) && await page.evaluate(function () { return __SNOW.save().daily.call === __SNOW.save().day; }));
  // 체력단련
  await page.click('[data-hub="pull"]');
  ok('체력단련 → 턱걸이 미니게임', await waitFor(function () { return !!document.getElementById('pull-go'); }, 3000));
  for (var tp = 0; tp < 26; tp++) await page.dispatchEvent('#pull-go', 'pointerdown');
  await waitFor(function () { return /개!/.test(document.getElementById('pull-n').textContent); }, 7000);
  ok('턱걸이 → 기록 + 내일 적재 버프', await page.evaluate(function () { var s = __SNOW.save(); return (s.stats.pullBest || 0) >= 10 && s.prep.power >= 10; }));
  await sleep(700); await page.click('#pull-go'); await sleep(200);
  // 휴가 (상점 모자라면 안내)
  await page.evaluate(function () { __SNOW.save().dia = 3; __SNOW.renderHub(); });
  await page.click('[data-hub="leave"]'); await sleep(200);
  ok('휴가: 상점이 모자라면 안내만', await vis('#toast') && /상점/.test(await txt('toast')));
  await page.evaluate(function () { __SNOW.save().rank = 0; __SNOW.renderHub(); });
  // 보급·인원
  await page.click('[data-hub="shop"]'); await sleep(400);
  ok('보급 화면 (장비·인원·개인 장비·시설·구역…)', await vis('#shop .item') && /인원/.test(await txt('s-tabs')));
  await shot('11-shop');
  await page.click('#s-tabs [data-tab="crew"]'); await sleep(150);
  await page.click('#s-list .item.can .buy[data-kind="crew"]'); await sleep(150);
  var hire = await page.evaluate(function () { var s = __SNOW.save(); return { pend: s.pend.length, crew: s.crew.hoobae || 0, more: !!document.querySelector('#s-list .item.can .buy[data-kind="crew"]') }; });
  ok('후임 전입 요청 (다음 작전 아침, 이병 정원 1명)', hire.pend === 1 && hire.crew === 0 && !hire.more, hire);
  await page.click('#s-tabs [data-tab="zone"]'); await sleep(150);
  ok('구역 탭: 사는 게 아니라 ★으로 맡는다', !(await page.$('#s-list .item.can')) && /근무평정/.test(await txt('s-list')));
  var ov4 = await overflow(); ok('보급 화면 넘침 없음', !ov4.length, ov4);
  await page.click('#s-go'); await sleep(400);
  ok('보급 닫으면 로비', await vis('#hub'));
  // 왼쪽 버튼: 훈장 · 수첩 · 꾸미기 · 교범 · 설정
  await page.click('[data-hub="medal"]'); await sleep(300);
  ok('훈장 버튼 → 훈장 탭', await vis('#shop') && await page.evaluate(function () { return document.querySelector('#s-tabs [aria-selected="true"]').getAttribute('data-tab') === 'medal'; }));
  await page.click('#s-back'); await sleep(300);
  await page.click('[data-hub="look"]'); await sleep(300);
  ok('꾸미기 버튼 → 꾸미기 탭', await vis('#shop') && !!(await page.$('#s-list .lcard')));
  await page.click('#s-back'); await sleep(300);
  await page.click('[data-hub="help"]'); await sleep(200);
  ok('교범 버튼 → 교범 다시 보기', !!(await page.$('#modal .m-help')));
  await page.click('#modal [data-h="skip"]'); await sleep(200);

  // ── 브리핑 → 두 번째 작전 (족구장 추가, 핫팩, 신병) ──
  await page.click('#t-start');
  ok('출동 → 제설 비상 브리핑 (지시하는 사람·지시서·특이사항)', await waitFor(function () { return !!document.querySelector('#modal .m-brief'); }, 3000) && await page.evaluate(function () { var m = document.getElementById('modal').textContent; return /05:30 제설 비상/.test(m) && /족구장/.test(m) && /생활관 앞 길/.test(m) && /핫팩/.test(m) && document.querySelectorAll('.brief-list li').length === 2; }));
  await shot('12-brief');
  var ov5 = await overflow(); ok('브리핑 넘침 없음', !ov5.length, ov5);
  ok('v13 브리핑: 새로 생김 (족구장 → 간부 순찰·콤보·분대원) · 이병은 특명 없음', await vis('#modal .brief-new') && /간부 순찰/.test(await page.evaluate(function () { return document.querySelector('#modal .brief-new').textContent; })) && !(await vis('#modal .brief-bonus')));
  await page.click('#modal [data-m="go"]'); await sleep(900); await talkThrough();
  ok('v13 지시서 카드: 구역 2곳이면 나온다 (지금 줄 + 다음 줄)', await waitFor(function () { var c = document.getElementById('h-op'); return c && !c.hidden && document.querySelectorAll('#op-list li').length === 2 && document.getElementById('op-bonus').hidden; }, 3000));
  ok('v12 노란 화살표 길목: 집하장 → 보급 원은 구령대를 돌아서', await page.evaluate(function () {
    var w = __SNOW.view().world(), A = JY.SnowAct, S = JY.SNOW; w.player.x = S.DUMP.x; w.player.y = S.DUMP.y + 14; w.act.nav = null;
    var save = w.save, b0 = save.bank; save.bank = Math.max(save.bank, (A.nextTool(save) || { cost: 0 }).cost + 10); var o = A.objective(w); save.bank = b0;
    return !o || o.kind !== 'supply' || !!o.via;
  }));
  ok('두 번째 작전: 지시서 2줄 + 핫팩 효과', await waitFor(function () { var w = __SNOW.view().world(); return w.op.tasks.length === 2 && JY.SnowAct.state(w).buffs.some(function (b) { return b.id === 'hotpack'; }); }, 3000));
  ok('다음 작전 아침 생활관 앞에 신병', await waitFor(function () { return __SNOW.view().world().recruits.length === 1; }, 3000));
  await quiet();
  ok('"지금 할 일" = 신병 데려오기', await goalIs('/신병 데려오기/'));
  await page.evaluate(function () { var w = __SNOW.view().world(), r = w.recruits[0], V = __SNOW.view(); w.haeng.x = 700; w.haeng.y = 1100; w.haeng.hold = 60; V._teleport(r.x, r.y - 18); });
  ok('신병에게 다가가면 따라온다', await waitFor(function () { return __SNOW.view().world().recruits[0].state === 'follow'; }, 3000));
  ok('"지금 할 일" = 배치할 구역에서 멈춰 서기', await goalIs('/멈춰 서기/'));
  await page.evaluate(function () { var w = __SNOW.view().world(), r = w.recruits[0]; __SNOW.view()._teleport(150, 200); r.x = 160; r.y = 190; });
  ok('구역에서 1초 멈춰 서면 배치 → 후임이 된다', await waitFor(function () { var w = __SNOW.view().world(); return w.crew.length === 1 && w.crew[0].post === 'A' && __SNOW.save().crew.hoobae === 1; }, 4000));
  await talkThrough();

  // ── 저장하고 다시 열어도 작전이 이어진다 ──
  var before = await page.evaluate(function () { var w = __SNOW.view().world(); w.time = 50; __SNOW.persist(); return { clear: w.clear, t: w.time, day: __SNOW.save().day }; });
  await page.reload({ timeout: 20000 }); await sleep(1300); await enter(); await closeModal();
  ok('다시 열면 "작전 이어하기 · 시각부터 계속"', /작전 이어하기/.test(await txt('t-start-b')) && /0[5-6]:\d\d부터 계속/.test(await txt('t-start-s')));
  await page.click('#t-start'); await sleep(800); await talkThrough();
  var resumed = await page.evaluate(function () { var w = __SNOW.view().world(); return { clear: w.clear, t: w.time, day: __SNOW.save().day, brief: !!document.querySelector('#modal .m-brief') }; });
  ok('치운 곳·시계 그대로 (브리핑 없이 바로)', Math.abs(resumed.clear - before.clear) < 40 && Math.abs(resumed.t - before.t) < 3 && resumed.day === before.day && !resumed.brief, [before, resumed]);

  // ── 진급 심사 → 진급 신고 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.merit = 6; s.exam = true; s.snow = null; s.dayT = 0; s.op = null; s.crew = {}; s.pend = []; s.zones = { A: true, B: true }; s.story.exam1 = true; __SNOW.setSave(s); __SNOW.title(); });
  await sleep(500); await closeModal();
  ok('로비: 진급 심사 (주황 출동 버튼 + 진급 길 "심사!")', /진급 심사/.test(await txt('t-start-b')) && await page.evaluate(function () { return document.getElementById('t-start').classList.contains('exam') && /심사/.test(document.querySelector('#hub .road li.next').textContent); }));
  await shot('12b-exam-lobby');
  await page.click('#t-start'); await waitFor(function () { return !!document.querySelector('#modal .m-brief'); }, 3000);
  ok('심사 브리핑: 기준 = 평소 +5%p (날씨가 나쁘면 낮춤)', /진급 심사 (90|80|70)%/.test(await txt('modal')));
  await page.click('#modal [data-m="go"]'); await sleep(900); await talkThrough();
  ok('지시서 제목 "진급 심사 지시서"', await waitFor(function () { return /진급 심사/.test(document.getElementById('op-title').textContent); }, 3000));
  await quiet();
  await clearZone('A', 0.96); await clearZone('B', 0.96);
  await page.evaluate(function () { var w = __SNOW.view().world(); w.parts.forEach(function (p) { if (p.icy) p.salted = true; }); });
  await goalIs('/작업 완료 보고/'); await onPad('report');
  ok('심사 합격 결과', await waitFor(function () { var m = document.querySelector('#modal .m-res.exam'); return m && /합격/.test(m.textContent); }, 5000));
  await shot('13-exam');
  await page.click('#modal [data-m]');
  ok('진급 신고: 역할·편해지는 것·새로 할 수 있는 것', await waitFor(function () { var m = document.querySelector('#modal .promo'); return m && /일병 진급/.test(m.textContent) && m.querySelectorAll('.promo-list.easy li').length >= 1 && m.querySelectorAll('.promo-list.more li').length >= 1; }, 3000));
  await shot('14-promo');
  var ov6 = await overflow(); ok('진급 신고 넘침 없음', !ov6.length, ov6);
  await toHub();
  ok('로비: 일병 + 진급 길 "일병 지금"', await page.evaluate(function () { var s = __SNOW.save(); return s.rank === 1 && /일병/.test(document.getElementById('hub-card').textContent) && /일병/.test(document.querySelector('#hub .road li.now').textContent); }));

  // ── 상병: 브리핑에서 조원 배치 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.rank = 2; s.merit = 20; s.exam = false; s.crew = { hoobae: 2, donggi: 1 }; s.cpost = { hoobae: ['A', 'A'], donggi: ['A'] }; s.zones = { A: true, B: true, C: true, D: true, E: true }; s.snow = null; s.dayT = 0; s.op = null; s.pend = []; JY.SNOW.STORY.forEach(function (c) { s.story[c.id] = true; }); __SNOW.setSave(s); __SNOW.title(); });
  await sleep(400); await closeModal();
  await shot('15a-lobby-sangbyeong');
  await page.click('#t-start'); await waitFor(function () { return !!document.querySelector('#modal .crew-plan'); }, 3000);
  ok('상병 브리핑: 작업 분담 (조원 3명)', (await page.$$('#modal .cp')).length === 3 && /출근 차량/.test(await txt('modal')));
  await page.click('#modal .cp'); await sleep(150);
  ok('누르면 담당 구역이 바뀐다', await page.evaluate(function () { return __SNOW.save().cpost.hoobae[0] !== 'A'; }));
  await shot('15-brief-crew');
  await page.click('#modal [data-m="go"]'); await sleep(900); await talkThrough();
  ok('배치한 대로 일한다', await page.evaluate(function () { var w = __SNOW.view().world(), s = __SNOW.save(); return w.crew.filter(function (e) { return e.def.id === 'hoobae'; })[0].post === s.cpost.hoobae[0]; }));
  // 07:30 출근 차량이 빠진다 → 차 옆에 붙어 있으면 민다
  await quiet();
  await page.evaluate(function () { var w = __SNOW.view().world(); w.crew.forEach(function (e) { e.x = 600; e.y = 200; e.speed = 0; }); JY.SnowSim.spawn(w, 'car'); });
  ok('진입로를 안 치우면 차가 빠진다 → 위 한 줄 "빠진 차 밀기" (빨강)', await waitFor(function () { var w = __SNOW.view().world(); return w.car && w.car.stuck && /빠진 차/.test(document.getElementById('g-t').textContent); }, 15000));
  ok('"지금 할 일" = 빠진 차 밀기 (빨간색)', await goalIs('/빠진 차 밀기/'));
  await page.evaluate(function () { var w = __SNOW.view().world(), c = w.car; __SNOW.view()._teleport(c.x, c.y + 26); });
  await shot('16-car');
  ok('차 뒤에 붙어 있으면 "영차!" 하며 밀어서 빠져나온다', await waitFor(function () { var w = __SNOW.view().world(); return !w.car || !w.car.stuck; }, 6000) && await page.evaluate(function () { return __SNOW.save().stats.carPush === 1; }));

  // ── 병장: 말년 특권 2배속 · 후반 ──
  await page.evaluate(function () {
    var s = JY.SnowSim.newSave(); s.day = 24; s.bank = 223456; s.life = 1600000; s.tool = 6; s.rank = 3; s.merit = 60;
    s.crew = { hoobae: 4, donggi: 3, cook: 2, malnyeon: 2, admin: 2, reserve: 2, plow: 1 }; s.proc = { press: 5, sculpt: 2 }; s.relays = { B: true, C: true, D: true, E: true };
    s.perks = { eisen: 3, back: 3, matsta: 2, praise: 5, song: 2, gear: 2 }; JY.SnowSim.assignZones(s); s.seen = { tut: true, dis: true, help: true }; s.px = 160; s.py = 300;
    s.look.name = '홍길동'; JY.SNOW.STORY.forEach(function (c) { s.story[c.id] = true; });
    __SNOW.setSave(s); __SNOW.play(false);
  });
  await sleep(3000);
  ok('병장: 2배속 버튼 (말년 특권)', await vis('#h-speed'));
  var sp0 = await page.evaluate(function () { var w = __SNOW.view().world(), t0 = w.time; return new Promise(function (r) { setTimeout(function () { r(w.time - t0); }, 1500); }); });
  await page.click('#h-speed');
  var sp1 = await page.evaluate(function () { var w = __SNOW.view().world(), t0 = w.time; return new Promise(function (r) { setTimeout(function () { r(w.time - t0); }, 1500); }); });
  ok('2배속이면 작전 시간이 빨리 흐른다 (소프트웨어 렌더는 CPU 한계)', sp1 > sp0 * 1.15 && /×2/.test(await txt('h-speed')), [sp0, sp1]);
  await page.click('#h-speed');
  await shot('17-late');
  var late = await page.evaluate(function () { var w = __SNOW.view().world(); return { crew: w.crew.length, dumps: w.dumps.length, tasks: w.op.tasks.length }; });
  ok('후반: 분대원 16명 + 집하장 5곳 + 지시서 8줄', late.crew === 16 && late.dumps === 5 && late.tasks === 8, late);
  var fps = await page.evaluate(function () { return new Promise(function (res) { var n = 0, t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); } requestAnimationFrame(f); }); });
  ok('후반 프레임 (소프트웨어 렌더 기준 3fps 이상)', fps >= 3, fps);
  var simT = await page.evaluate(function () { var w = __SNOW.view().world(), t0 = w.time; return new Promise(function (res) { setTimeout(function () { res(w.time - t0); }, 2000); }); });
  ok('느린 화면에서도 작전 시간은 제대로 흐른다', simT > (is3 ? 1.2 : 0.4), [simT, fps]);
  var ov7 = await overflow(); ok('후반 작전 화면 넘침 없음', !ov7.length, ov7);

  // ── 전역 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.merit = JY.SNOW.DISCHARGE_MERIT; s.snow = null; s.op = null; s.dayT = 0; __SNOW.persist(); __SNOW.title(); });
  await sleep(500); await closeModal();
  ok('로비 소식: "전역할 수 있다!"', await vis('#hub [data-hub="dis"]'));
  await page.click('#hub [data-hub="dis"]'); await sleep(300);
  await shot('18-discharge');
  await page.click('#dis-go'); await page.click('#modal [data-m="yes"]'); await sleep(400);
  var dis = await page.evaluate(function () { var s = __SNOW.save(); return { medals: s.medals, day: s.day, tool: s.tool, rank: s.rank, merit: s.merit, relays: Object.keys(s.relays).length }; });
  ok('전역: 메달 받고 이병부터', dis.medals >= 4 && dis.day === 1 && dis.tool === 0 && dis.rank === 0 && dis.merit === 0 && dis.relays === 0, dis);
  await page.click('#modal [data-m]'); await sleep(500);
  ok('전역 후 로비', await vis('#t-start') && await vis('#hub-card'));
  // 설정: 소리·진동·시점 · 처음부터
  await page.click('[data-hub="settings"]'); await sleep(200);
  ok('설정: 소리·진동·시점·처음부터', await page.evaluate(function () { var m = document.getElementById('modal').textContent; return /소리/.test(m) && /진동/.test(m) && /처음부터/.test(m); }));
  await shot('18b-settings');
  await page.click('#modal [data-set="haptic"]'); await sleep(100);
  ok('진동 끄기', await page.evaluate(function () { return localStorage.getItem('jeseol-haptic') === '0' && /끔/.test(document.querySelector('#modal [data-set="haptic"]').textContent); }));
  await page.click('#modal [data-set="haptic"]'); await sleep(100);
  await page.click('#t-reset'); await sleep(150); await page.click('#modal [data-m="yes"]'); await sleep(300);
  ok('처음부터 다시: 전부 초기화', await page.evaluate(function () { var s = __SNOW.save(); return s.bank === 0 && s.medals === 0 && !Object.keys(s.story).length && s.day === 1; }));

  // ── 쉬는 동안 · v8 저장 이전 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.crewRate = 50; s.last = Date.now() - 3600 * 1000; s.stats.ops = 3; localStorage.setItem('jeseol-v10', JSON.stringify(s)); });
  await page.reload({ timeout: 20000 }); await sleep(1200); await enter();
  ok('쉬는 동안 분대원이 번 초코파이', await page.evaluate(function () { return !document.getElementById('modal').hidden && /분대원들이/.test(document.getElementById('modal').textContent); }));
  await shot('19-offline');
  await page.evaluate(function () { localStorage.clear(); Storage.prototype._set = Storage.prototype.setItem; localStorage._set('jeseol-v8', JSON.stringify({ v: 5, life: 30000, bank: 777, day: 12, tool: 3, zones: { A: true, B: true, C: true, D: true, E: true, F: true }, crew: { hoobae: 2 }, story: { prologue: true }, look: { name: '옛날사람' } })); Storage.prototype.setItem = function () {}; });
  await page.reload({ timeout: 20000 }); await sleep(1200);
  var mig = await page.evaluate(function () { var s = __SNOW.save(); return { v: s.v, rank: s.rank, bank: s.bank, zones: Object.keys(s.zones).join(''), name: s.look.name, v8: !!localStorage.getItem('jeseol-v8') }; });
  ok('v8 저장을 옮겨 온다 (상병, 근무평정만큼 구역, v8 저장은 그대로)', mig.v === 10 && mig.rank === 2 && mig.bank === 777 && mig.zones === 'ABCD' && mig.name === '옛날사람' && mig.v8, mig);

  } catch (err) { ok('흐름이 중간에 멈췄다', false, String(err).split('\n')[0]); await shot('zz-stuck'); }
  await browser.close();
  checks.forEach(function (c) { console.log((c.ok ? '✓ ' : '✗ ') + c.name + (c.ok ? '' : ' ' + JSON.stringify(c.detail))); });
  if (errors.length) console.log('에러:\n  ' + errors.join('\n  '));
  var bad = checks.filter(function (c) { return !c.ok; }).length + errors.length;
  console.log(bad ? '문제 ' + bad + '개' : 'snow ok (' + checks.length + '개 통과)');
  process.exit(bad ? 1 : 0);
})();
