#!/usr/bin/env node
/* 제설각 브라우저 점검: 걷고 → 퍼 담고 → 집하장에 붓고 → 사고 → 인력이 나르고 → 저장·이어하기 → 진급 → 전역
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
  async function vis(sel) { return page.evaluate(function (s) { var e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; }, sel); }
  function W() { return page.evaluate(function () { var w = __SNOW.view().world(), s = __SNOW.save(); return { x: w.player.x, y: w.player.y, load: w.player.load, cap: w.player.cap, clear: w.clear, bank: s.bank, crew: w.crew.length, mode: __SNOW.view().mode() }; }); }
  // 손가락 끌기 (pointerType: touch) — 1인칭 왼쪽 조이스틱은 터치로만 걷는다
  async function touchDrag(x0, y0, x1, y1, hold) {
    await page.evaluate(function (a) {
      var cv = document.getElementById('cv'); function ev(t, x, y) { cv.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true })); }
      ev('pointerdown', a[0], a[1]); for (var i = 1; i <= 6; i++) ev('pointermove', a[0] + (a[2] - a[0]) * i / 6, a[1] + (a[3] - a[1]) * i / 6);
    }, [x0, y0, x1, y1]);
    await sleep(hold);
    await page.evaluate(function (a) { document.getElementById('cv').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: a[0], clientY: a[1], bubbles: true })); }, [x1, y1]);
  }
  function verbIs(re) { return waitFor(new Function('return ' + re + '.test(document.getElementById("act-verb").textContent)'), 4000); }
  async function closeModal() { for (var i = 0; i < 3; i++) { if (!(await vis('#modal'))) return; await page.click('#modal [data-m]'); await sleep(250); } }
  async function waitFor(fn, ms) { for (var t = 0; t < (ms || 4000); t += 150) { if (await page.evaluate(fn)) return true; await sleep(150); } return false; }
  async function overflow() {
    return page.evaluate(function () {
      var bad = [];
      document.querySelectorAll('#app *').forEach(function (el) {
        if (el.closest('[hidden]') || el.closest('svg') || el.closest('#ov3d') || el.tagName === 'CANVAS' || el.closest('.tabs')) return;
        var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (r.right > innerWidth + 1 || r.left < -1) bad.push((el.id || el.className || el.tagName) + ' x' + Math.round(r.left) + '-' + Math.round(r.right));
      });
      return bad;
    });
  }

  await page.goto(url);
  await page.evaluate(function () { localStorage.clear(); });
  await page.reload();
  await sleep(1200);
  ok('타이틀 표시', await vis('#title .logo'));
  await shot('01-title');

  // ── 걷고 퍼 담기 ──
  await page.click('#t-start');
  await sleep(700);
  ok('작업 화면 + HUD + 보급 버튼', await vis('#hud') && await vis('#h-shop') && !(await vis('#title')));
  ok('첫 조작 안내', await vis('#hint'));
  var is3 = await page.evaluate(function () { return !!__SNOW.view().is3D; });
  var cam0 = await page.evaluate(function () { var V = __SNOW.view(); return V.camMode ? V.camMode() : 'none'; });
  ok('처음 시점은 1인칭 (조준점 + 행동·눈덩이 버튼)', !is3 || (cam0 === 'fp' && !(await page.evaluate(function () { return document.getElementById('xhair').hidden; })) && await vis('#act-btn') && await vis('#ball-btn')), cam0);
  await shot('02-start');
  var p0 = await W();
  // 1인칭: 왼쪽을 위로 끌면 앞으로 걷는다 (2D는 끈 방향으로)
  await touchDrag(size[0] * 0.2, size[1] * 0.7, size[0] * 0.2 + (is3 ? 0 : 40), size[1] * 0.7 - (is3 ? 50 : -10), 1500);
  var p1 = await W();
  ok('끌면 걷는다', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 30, [p0, p1]);
  ok('치우면 돈이 아니라 짐이 된다', p1.load > 0 && p1.bank === p0.bank && p1.clear > p0.clear, [p0, p1]);
  ok('짐을 지면 안내가 사라진다', !(await vis('#hint')));
  if (is3) {
    // 오른쪽을 끌면 둘러본다 (몸은 그대로)
    var lk0 = await page.evaluate(function () { return __SNOW.view().look(); }), q0 = await W();
    await page.mouse.move(size[0] * 0.75, size[1] * 0.5); await page.mouse.down();
    await page.mouse.move(size[0] * 0.75 + 120, size[1] * 0.5 - 30, { steps: 5 }); await page.mouse.up();
    var lk1 = await page.evaluate(function () { return __SNOW.view().look(); }), q1 = await W();
    ok('오른쪽을 끌면 고개만 돌아간다', Math.abs(Math.atan2(lk1.x, lk1.y) - Math.atan2(lk0.x, lk0.y)) > 0.4 && lk1.pitch > lk0.pitch && Math.hypot(q1.x - q0.x, q1.y - q0.y) < 4, [lk0, lk1]);
    await page.evaluate(function () { __SNOW.view().toggleCam('near'); });
  }
  var t0 = await W(), tap = await page.evaluate(function (p) { return __SNOW.view()._screenToWorld(p[0], p[1]); }, [size[0] * 0.75, size[1] * 0.6]);
  await page.mouse.click(size[0] * 0.75, size[1] * 0.6);
  await sleep(1300);
  var t1 = await W();
  ok('톡 하면 그쪽으로 간다', Math.hypot(tap.x - t1.x, tap.y - t1.y) < Math.hypot(tap.x - t0.x, tap.y - t0.y) - 15, [t0, t1, tap]);
  await page.evaluate(function () { __SNOW.view()._teleport(200, 160); });
  var k0 = (await W()).y;
  await page.keyboard.down('ArrowDown'); await sleep(700); await page.keyboard.up('ArrowDown');
  ok('방향키로도 걷는다', (await W()).y > k0 + 15);

  // ── 가득 차면 → 집하장에 붓기 ──
  await page.evaluate(function () { var w = __SNOW.view().world(); w.player.load = w.player.cap - 1; w.player.val = w.player.cap - 1; __SNOW.view()._teleport(250, 190); });
  await page.keyboard.down('ArrowRight'); await sleep(500); await page.keyboard.up('ArrowRight');
  var full = await waitFor(function () { return document.getElementById('h-carry').classList.contains('full'); }, 3000);
  ok('가득 차면 게이지에 "가득!"', full && /가득/.test(await page.evaluate(function () { return document.getElementById('h-load').textContent; })));
  ok('집하장 쪽 화살표', await page.evaluate(function () { var a = document.getElementById('arrow3d'); return !__SNOW.view().is3D || (a && a.style.display !== 'none'); }));
  await shot('03-full');
  var b0 = (await W()).bank;
  await page.evaluate(function () { var d = JY.SNOW.DUMP; __SNOW.view()._teleport(d.x + 40, d.y); });
  await page.keyboard.down('ArrowLeft'); await sleep(800); await page.keyboard.up('ArrowLeft');
  var dumped = await W();
  ok('집하장에 들어가면 붓고 초코파이', dumped.load === 0 && dumped.bank > b0, [b0, dumped]);
  await shot('04-dump');

  // ── 언제든 보급·인력 (멈춤) ──
  await page.evaluate(function () { __SNOW.save().bank += 5000; });
  await page.click('#h-shop');
  await sleep(400);
  ok('보급 화면 + 게임 멈춤', await vis('#shop .item') && (await W()).mode === 'paused');
  await shot('05-shop-tool');
  await page.click('#s-list .item.can .buy');
  ok('넉가래 지급', await page.evaluate(function () { return __SNOW.save().tool === 1; }));
  await page.click('#s-tabs [data-tab="crew"]');
  await page.click('#s-list .item.can .buy'); await sleep(150); await page.click('#s-list .item.can .buy');
  ok('후임 2명 채용', await page.evaluate(function () { return __SNOW.save().crew.hoobae === 2; }));
  await page.click('#s-tabs [data-tab="zone"]');
  await page.click('#s-list .item.can .buy');
  await page.click('#s-tabs [data-tab="factory"]');
  await sleep(200);
  await shot('06-shop-factory');
  var relayBtn = await page.$('#s-list .item.can .buy[data-kind="relay"]');
  if (relayBtn) await relayBtn.click();
  var pressBtn = await page.$('#s-list .item.can .buy[data-kind="proc"]');
  if (pressBtn) await pressBtn.click();
  var bought = await page.evaluate(function () { var s = __SNOW.save(); return { B: !!s.zones.B, relay: !!s.relays.B, press: s.proc.press || 0 }; });
  ok('구역·릴레이·압축기', bought.B && bought.relay && bought.press === 1, bought);
  var of2 = await overflow(); ok('보급 화면 넘침 없음', !of2.length, of2);
  await page.click('#s-go');
  await sleep(600);
  var after = await W();
  ok('작업 계속: 넉가래 적재 80 + 후임 2명', after.mode === 'play' && after.cap === 80 && after.crew === 2, after);
  ok('릴레이로 붓는 곳 2곳', await page.evaluate(function () { return __SNOW.view().world().dumps.length === 2; }));
  var crewPaid = await waitFor(function () { return __SNOW.view().world().crewEarned > 0; }, 25000);
  ok('후임이 담아서 집하장에 붓는다', crewPaid);
  await shot('07-crew');

  // ── 저장하고 다시 열어도 이어진다 ──
  var before = await page.evaluate(function () { __SNOW.persist(); var w = __SNOW.view().world(); return { clear: w.clear, bank: Math.floor(__SNOW.save().bank) }; });
  await page.reload();
  await sleep(1300);
  ok('다시 열면 "이어서 작업"', /이어서/.test(await page.evaluate(function () { return document.getElementById('t-start').textContent; })));
  if (await vis('#modal')) await page.click('#modal [data-m]');
  await page.click('#t-start');
  await sleep(700);
  var resumed = await page.evaluate(function () { var w = __SNOW.view().world(); return { clear: w.clear, bank: Math.floor(__SNOW.save().bank) }; });
  ok('치운 곳·초코파이 그대로', Math.abs(resumed.clear - before.clear) < 40 && resumed.bank >= before.bank - 1, [before, resumed]);

  // ── 진급 ──
  await page.evaluate(function () { var s = __SNOW.save(), w = __SNOW.view().world(); s.life = 1990; w.player.load = 30; w.player.val = 30; var d = JY.SNOW.DUMP; __SNOW.view()._teleport(d.x, d.y); });
  var promo = await waitFor(function () { return !document.getElementById('modal').hidden && /진급/.test(document.getElementById('modal').textContent); }, 4000);
  ok('일병 진급 축하 (게임 멈춤)', promo && (await W()).mode === 'paused');
  await shot('08-rankup');
  if (promo) await page.click('#modal [data-m]');

  // ── 방해꾼·띵·검열·남은 눈 ──
  await page.evaluate(function () {
    var w = __SNOW.view().world(); w.events = []; w.treas = [];
    w.player.load = 20; w.player.val = 20; JY.SnowSim.spawn(w, 'deer'); var d = w.deer[0]; d.x = w.player.x - 8; d.y = w.player.y; d.heading = 0; d.turnT = 9;
  });
  await sleep(700);
  var hz2 = await page.evaluate(function () { var w = __SNOW.view().world(); return { load: w.player.load, stun: w.player.stun > 0 || w.hits > 0, chip: !document.getElementById('chip').hidden && /고라니/.test(document.getElementById('chip').textContent) }; });
  ok('고라니에 받히면 짊어진 눈을 쏟는다', hz2.load === 0 && hz2.stun && hz2.chip, hz2);
  var hz = await page.evaluate(function () {
    var V = __SNOW.view(), w = V.world(); w.treas = [];
    var p = w.parts.filter(function (x) { return !x.done; })[0], bag = { cap: 1e9, load: 0, val: 0 };
    for (var y = p.y; y < p.y + p.h; y += 10) for (var x = p.x; x < p.x + p.w; x += 10) JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag);
    return { part: p.done, scan: V.scan ? V.scan() : 'none' };
  });
  await sleep(700);
  hz2.partOv = await page.evaluate(function () { return !__SNOW.view().is3D || !!document.querySelector('.ov-part, .ov-perfect'); });
  ok('조각 완료: 띵!', hz.part && hz2.partOv, [hz, hz2]);
  ok('남은 눈 보기', !(await page.evaluate(function () { return !!__SNOW.view().is3D; })) || hz.scan === true, hz.scan);
  await shot('09-hazard');

  // ── 1인칭 상호작용 ──
  if (is3) {
    await page.evaluate(function () { __SNOW.view().toggleCam('fp'); var w = __SNOW.view().world(); w.events = []; w.deer = []; w.crew.forEach(function (e, i) { e.x = 400 + i * 20; e.y = 600; e.tidx = -1; e.retarget = 30; }); w.haeng.x = 200; w.haeng.y = 228; w.haeng.hold = 30; w.player.stun = 0; __SNOW.view()._teleport(200, 205); __SNOW.view()._setLook(0, -0.1); });
    await verbIs('/경례/');
    ok('행보관을 보면 버튼이 "경례"', /경례/.test(await page.evaluate(function () { return document.getElementById('act-verb').textContent; })) && /행보관/.test(await page.evaluate(function () { return document.getElementById('xh-t').textContent; })));
    await page.click('#act-btn');
    await waitFor(function () { return !document.getElementById('sub').hidden; }, 2000);
    var sal = await page.evaluate(function () { return { sub: !document.getElementById('sub').hidden && document.getElementById('sub').textContent, buff: JY.SnowAct.state(__SNOW.view().world()).buffs.map(function (b) { return b.id; }) }; });
    ok('경례: "충성!" 자막 + 행보관 칭찬 버프', /충성/.test(sal.sub) && sal.buff.indexOf('praise') >= 0, sal);
    await shot('09a-fp-salute');
    var th0 = await page.evaluate(function () { var w = __SNOW.view().world(); w.haeng.x = 200; w.haeng.y = 228; w.haeng.hold = 30; w.player.stun = 0; __SNOW.view()._teleport(200, 205); __SNOW.view()._setLook(0, -0.1); return __SNOW.save().stats.throw || 0; });
    await page.click('#ball-btn'); await sleep(200);
    ok('눈덩이 던지기', await page.evaluate(function (n) { return (__SNOW.save().stats.throw || 0) === n + 1; }, th0));
    await waitFor(function () { return JY.SnowAct.state(__SNOW.view().world()).heat > 0; }, 1500);
    await sleep(250);
    var heat = await page.evaluate(function () { return JY.SnowAct.state(__SNOW.view().world()).heat; });
    ok('행보관 맞히면 분노 ★ (상단 표시)', heat >= 1 && await vis('#h-heat'), heat);
    await shot('09b-fp-heat');
    // 생활관에 숨기
    await page.evaluate(function () { var d = JY.SnowAct.door('barracks'), w = __SNOW.view().world(); w.act.heat = Math.max(1, w.act.heat); w.haeng.x = 700; w.haeng.y = 1100; w.player.stun = 0; __SNOW.view()._teleport(d.x, d.y + 14); __SNOW.view()._setLook(Math.PI, 0); });
    ok('쫓길 때 생활관 문 앞: "숨기"', await verbIs('/숨기/'));
    await page.click('#act-btn');
    await waitFor(function () { return JY.SnowAct.state(__SNOW.view().world()).heat === 0 && document.getElementById('h-heat').hidden; }, 3000);
    ok('숨으면 분노 해제', await page.evaluate(function () { return JY.SnowAct.state(__SNOW.view().world()).heat === 0; }) && !(await vis('#h-heat')));
    // PX
    await page.evaluate(function () { var d = JY.SnowAct.door('px'); __SNOW.save().bank += 500; __SNOW.view()._teleport(d.x, d.y + 16); __SNOW.view()._setLook(Math.PI, 0); });
    await verbIs('/들어가기/'); await page.click('#act-btn'); await waitFor(function () { return !!document.querySelector('#modal .px-it'); }, 3000);
    ok('PX 들어가면 매점 (게임 멈춤)', await vis('#modal .px-it') && (await W()).mode === 'paused');
    await shot('09c-fp-px');
    await page.click('#modal [data-px="matsta"]'); await sleep(150);
    ok('맛스타 구매 → 효과 중', await page.evaluate(function () { return !!document.querySelector('#modal .px-it.on'); }));
    await page.click('#modal [data-m="close"]'); await sleep(200);
    // 행정반 임무
    await page.evaluate(function () { var d = JY.SnowAct.door('office'); __SNOW.view()._teleport(d.x, d.y + 16); __SNOW.view()._setLook(Math.PI, 0); });
    await verbIs('/임무 받기/'); await page.click('#act-btn'); await waitFor(function () { return !document.getElementById('h-mis').hidden; }, 3000);
    ok('행정반: 임무 받기 → 임무 카드', await vis('#h-mis') && (await W()).mode === 'play');
    await shot('09d-fp-mission');
    var ov1 = await overflow(); ok('1인칭 화면 넘침 없음', !ov1.length, ov1);
    // 시점 바꾸기: 1인칭 → 3인칭 → 위에서 → 1인칭
    var cams = [];
    for (var ci = 0; ci < 3; ci++) { await page.click('#h-cam'); await sleep(150); cams.push(await page.evaluate(function () { return __SNOW.view().camMode() + ':' + !document.getElementById('xhair').hidden; })); }
    ok('시점 버튼: 3인칭 → 위에서 → 1인칭', cams.join(',') === 'near:false,far:false,fp:true', cams);
  }

  // ── v6: 다이아·구역 진행·출입 통제·완벽·간부 경례·보급 상자·인력 배치·훈장·조기 퇴근 ──
  await page.evaluate(function () { var V = __SNOW.view(); if (V.toggleCam) V.toggleCam('near'); var w = V.world(); w.events = []; w.deer = []; if (w.act) w.act.heat = 0; w.player.stun = 0; });
  ok('HUD: 다이아 + 지금 있는 구역 진행', await vis('#h-dia') && await vis('#h-area'));
  // 잠긴 연병장 쪽으로 걸어가면 막힌다
  await page.evaluate(function () { var s = __SNOW.save(); s.zones = { A: true, B: true }; __SNOW.persist(); __SNOW.play(true); });
  await sleep(600);
  await page.evaluate(function () { var w = __SNOW.view().world(); w.events = []; w.deer = []; __SNOW.view()._teleport(150, 296); });
  await page.keyboard.down('ArrowDown'); await sleep(1200); await page.keyboard.up('ArrowDown');
  var lk = await page.evaluate(function () { var w = __SNOW.view().world(); return { y: w.player.y, chip: document.getElementById('chip').textContent }; });
  ok('잠긴 구역은 테이프에 막힌다 + 출입 통제 알림', lk.y < 320 && /출입 통제/.test(lk.chip), lk);
  // 조각 하나를 마지막 칸까지 → 완벽 + 다이아
  var pf = await page.evaluate(function () {
    var w = __SNOW.view().world(), s = __SNOW.save(), d0 = s.dia, P = w.parts.filter(function (q) { return !q.done; })[0];
    if (!P) return { skip: true };
    for (var y = P.y; y < P.y + P.h; y += 10) for (var x = P.x; x < P.x + P.w; x += 10) JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 });
    return { done: P.done, dia: s.dia - d0 };
  });
  await sleep(500);
  ok('조각 100% → 완벽! + 다이아 +1', pf.skip || (pf.done && pf.dia >= 1 && (!is3 || await page.evaluate(function () { return !!document.querySelector('.ov-perfect'); }))), pf);
  await closeModal();
  // 콤보 표시
  await sleep(700); await closeModal();
  await page.evaluate(function () { var w = __SNOW.view().world(); w.combo = 42; w.comboT = 9; w.player.load = 0; });
  for (var cw = 0; cw < 12 && !(await vis('#combo')); cw++) { await closeModal(); await sleep(250); }
  ok('콤보 표시 (눈 값 +%)', await vis('#combo') && /42/.test(await page.evaluate(function () { return document.getElementById('combo-n').textContent; })));
  await closeModal();
  // 간부: 중대장이 다가오면 3초 경례 알림
  await page.evaluate(function () { var w = __SNOW.view().world(), o = JY.SnowAct.spawnOfficer(w, 'cpt'); o.x = w.player.x + 12; o.y = w.player.y + 30; o.phase = 'stay'; o.stayT = 60; });
  await waitFor(function () { return !document.getElementById('salute').hidden; }, 3000);
  ok('간부가 오면 "경례!" 알림 + 버튼', await vis('#salute') && /경례/.test(await page.evaluate(function () { return document.getElementById('act-verb').textContent; })));
  await shot('09e-officer');
  await page.click('#act-btn');
  await waitFor(function () { return document.getElementById('salute').hidden; }, 3000);
  ok('경례하면 알림이 사라지고 보상', !(await vis('#salute')) && await page.evaluate(function () { return (__SNOW.save().stats.salute || 0) >= 1; }));
  await closeModal();
  // 보급 상자
  await page.evaluate(function () { __SNOW.save().boxes.unshift('rare'); });
  await waitFor(function () { return !document.getElementById('h-box').hidden; }, 2000);
  ok('보급 상자 버튼', await vis('#h-box'));
  var bx0 = await page.evaluate(function () { var s = __SNOW.save(); return { dia: s.dia, bank: s.bank, n: s.boxes.length }; });
  await page.click('#h-box');
  await waitFor(function () { var b = document.getElementById('box-ok'); return b && !b.disabled; }, 4000);
  await shot('09f-box');
  var bx1 = await page.evaluate(function () { var s = __SNOW.save(); return { dia: s.dia, bank: s.bank, n: s.boxes.length, loot: document.getElementById('box-loot').textContent }; });
  ok('상자를 열면 초코파이·다이아·분실물', bx1.n === bx0.n - 1 && bx1.dia >= bx0.dia + 2 && bx1.bank > bx0.bank && bx1.loot.length > 3, [bx0, bx1]);
  await page.click('#box-ok'); await sleep(200);
  // 인력 배치 + 훈장 탭
  await page.click('#h-shop'); await page.click('#s-tabs [data-tab="crew"]'); await sleep(200);
  ok('인력 탭: 사기·배치·다이아 버튼', await vis('.crew-head .posts') && await vis('.dia-btns'));
  await page.click('.posts [data-post="B"]');
  ok('배치를 족구장으로', await page.evaluate(function () { return __SNOW.save().post === 'B'; }));
  await page.click('.posts [data-post="all"]');
  await page.click('#s-tabs [data-tab="medal"]'); await sleep(200);
  ok('훈장 탭: 분실물 도감 + 훈장 목록', await vis('.found-grid') && (await page.$$('.ach')).length >= 15);
  await shot('09g-medal');
  var ov2 = await overflow(); ok('훈장 탭 넘침 없음', !ov2.length, ov2);
  await page.click('#s-go'); await sleep(500);
  // 전 구역 완벽 → 조기 퇴근 결산
  await page.evaluate(function () { var w = __SNOW.view().world(); w.events = []; var bag = { cap: 1e9, load: 0, val: 0 }; w.cells.forEach(function (i) { JY.SnowSim.clearAt(w, (i % JY.SNOW.GW) * 10 + 5, ((i / JY.SNOW.GW) | 0) * 10 + 5, 2, 9, 'player', bag); }); });
  var early = await waitFor(function () { return !document.getElementById('modal').hidden && /조기 퇴근/.test(document.getElementById('modal').textContent); }, 5000);
  ok('전 구역 완벽 → 조기 퇴근 결산', early);
  await shot('09h-early');
  if (early) await page.click('#modal [data-m]');

  // ── 후반 ──
  await page.evaluate(function () {
    var s = JY.SnowSim.newSave(); s.day = 24; s.bank = 223456; s.life = 1600000; s.tool = 6;
    s.crew = { hoobae: 10, donggi: 8, cook: 6, malnyeon: 4, admin: 3, reserve: 3, plow: 1 }; s.proc = { press: 5, sculpt: 2 }; s.relays = { B: true, C: true, D: true, E: true };
    s.perks = { eisen: 3, back: 3, matsta: 2, praise: 5, song: 2, gear: 2 }; s.zones = { A: true, B: true, C: true, D: true, E: true }; s.fresh = { A: true, B: true, C: true, D: true, E: true };
    s.seen = { tut: true, dis: true }; s.made = { brick: 400, snowman: 40 }; s.px = 160; s.py = 300;
    __SNOW.setSave(s); __SNOW.play(true);
  });
  await sleep(4000);
  await shot('10-late');
  var late = await page.evaluate(function () { var w = __SNOW.view().world(); return { crew: w.crew.length, dumps: w.dumps.length }; });
  ok('후반: 인력 35명 + 집하장 5곳', late.crew === 35 && late.dumps === 5, late);
  if (is3) {
    var ride = await page.evaluate(function () {
      var w = __SNOW.view().world(), pl = w.crew.filter(function (e) { return e.def.vehicle; })[0]; w.crew.forEach(function (e, i) { if (e !== pl) { e.x = 560 + (i % 8) * 20; e.y = 900 + (i >> 3) * 20; e.injured = 30; } }); pl.x = 250; pl.y = 400; pl.speed = 0; pl.tidx = -1; pl.retarget = 99; w.events = [];
      __SNOW.view()._teleport(250, 372); __SNOW.view()._setLook(0, -0.1); var t = __SNOW.target(); return t && t.k;
    });
    ok('제설차 앞: 운전 교대', ride === 'plow', ride);
    await verbIs('/운전 교대/'); await page.click('#act-btn'); await waitFor(function () { return !document.getElementById('h-ride').hidden && /내리기/.test(document.getElementById('act-verb').textContent); }, 3000);
    ok('제설차 타면 운전 표시 + 버튼은 "내리기"', await vis('#h-ride') && /내리기/.test(await page.evaluate(function () { return document.getElementById('act-verb').textContent; })));
    await shot('10b-fp-ride');
    await page.click('#act-btn'); await waitFor(function () { return !JY.SnowAct.state(__SNOW.view().world()).ride; }, 3000);
    ok('내리면 운전병이 돌아온다', await page.evaluate(function () { var w = __SNOW.view().world(); return !JY.SnowAct.state(w).ride && w.crew.every(function (e) { return !e.off; }); }));
  }
  var fps = await page.evaluate(function () { return new Promise(function (res) { var n = 0, t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); } requestAnimationFrame(f); }); });
  var is3d = await page.evaluate(function () { return !!__SNOW.view().is3D; });
  ok('후반 프레임 (소프트웨어 렌더 기준 ' + (is3d ? '3D 1인칭' : '2D') + ' 3fps' + ' 이상)', fps >= 3, fps);
  var sim = await page.evaluate(function () { var w = __SNOW.view().world(), t0 = w.time; return new Promise(function (res) { setTimeout(function () { res(w.time - t0); }, 2000); }); });
  ok('느린 화면에서도 게임 시간은 제대로 흐른다', sim > (is3d ? 1.2 : 0.4), [sim, fps]);

  // ── 전역 ──
  await page.click('#h-shop');
  await page.click('#s-tabs [data-tab="dis"]');
  await sleep(300);
  await shot('11-discharge');
  await page.click('#dis-go');
  await page.click('#modal [data-m="yes"]');
  await sleep(400);
  var dis = await page.evaluate(function () { var s = __SNOW.save(); return { medals: s.medals, day: s.day, tool: s.tool, life: s.life, relays: Object.keys(s.relays).length }; });
  ok('전역: 메달 받고 처음부터', dis.medals >= 4 && dis.day === 1 && dis.tool === 0 && dis.life === 0 && dis.relays === 0, dis);
  await page.click('#modal [data-m]');
  await sleep(500);
  ok('전역 후 타이틀', await vis('#title .logo'));

  // ── 쉬는 동안 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.crewRate = 50; s.last = Date.now() - 3600 * 1000; localStorage.setItem('jeseol-v1', JSON.stringify(s)); });
  await page.reload();
  await sleep(1200);
  ok('쉬는 동안 인력이 번 초코파이', await page.evaluate(function () { return !document.getElementById('modal').hidden && /후임들이/.test(document.getElementById('modal').textContent); }));
  await shot('12-offline');

  await browser.close();
  checks.forEach(function (c) { console.log((c.ok ? '✓ ' : '✗ ') + c.name + (c.ok ? '' : ' ' + JSON.stringify(c.detail))); });
  if (errors.length) console.log('에러:\n  ' + errors.join('\n  '));
  var bad = checks.filter(function (c) { return !c.ok; }).length + errors.length;
  console.log(bad ? '문제 ' + bad + '개' : 'snow ok (' + checks.length + '개 통과)');
  process.exit(bad ? 1 : 0);
})();
