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
  await shot('02-start');
  var p0 = await W();
  await page.mouse.move(size[0] / 2, size[1] * 0.6);
  await page.mouse.down();
  await page.mouse.move(size[0] / 2 + 40, size[1] * 0.6 + 10, { steps: 6 });
  await sleep(1500);
  await page.mouse.up();
  var p1 = await W();
  ok('끌면 걷는다', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 30, [p0, p1]);
  ok('치우면 돈이 아니라 짐이 된다', p1.load > 0 && p1.bank === p0.bank && p1.clear > p0.clear, [p0, p1]);
  ok('짐을 지면 안내가 사라진다', !(await vis('#hint')));
  var t0 = await W();
  await page.mouse.click(size[0] * 0.8, size[1] * 0.45);
  await sleep(1300);
  var t1 = await W();
  ok('톡 하면 그쪽으로 간다', t1.x > t0.x + 15, [t0, t1]);
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
  var hz = await page.evaluate(function () {
    var V = __SNOW.view(), w = V.world(); w.events = [];
    w.player.load = 20; w.player.val = 20; JY.SnowSim.spawn(w, 'deer'); var d = w.deer[0]; d.x = w.player.x - 8; d.y = w.player.y; d.heading = 0; d.turnT = 9;
    var p = w.parts.filter(function (x) { return !x.done; })[0], bag = { cap: 1e9, load: 0, val: 0 };
    for (var y = p.y; y < p.y + p.h; y += 10) for (var x = p.x; x < p.x + p.w; x += 10) JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag);
    return { part: p.done, scan: V.scan ? V.scan() : 'none' };
  });
  await sleep(700);
  var hz2 = await page.evaluate(function () { var w = __SNOW.view().world(); return { load: w.player.load, stun: w.player.stun > 0 || w.hits > 0, chip: !document.getElementById('chip').hidden && /고라니/.test(document.getElementById('chip').textContent), partOv: !__SNOW.view().is3D || !!document.querySelector('.ov-part') }; });
  ok('고라니에 받히면 짊어진 눈을 쏟는다', hz2.load === 0 && hz2.stun && hz2.chip, hz2);
  ok('조각 완료: 띵!', hz.part && hz2.partOv, [hz, hz2]);
  ok('남은 눈 보기', !(await page.evaluate(function () { return !!__SNOW.view().is3D; })) || hz.scan === true, hz.scan);
  await shot('09-hazard');

  // ── 후반 ──
  await page.evaluate(function () {
    var s = JY.SnowSim.newSave(); s.day = 24; s.bank = 223456; s.life = 1100000; s.tool = 6;
    s.crew = { hoobae: 10, donggi: 8, cook: 6, malnyeon: 4, admin: 3, reserve: 3, plow: 1 }; s.proc = { press: 5, sculpt: 2 }; s.relays = { B: true, C: true, D: true, E: true };
    s.perks = { eisen: 3, back: 3, matsta: 2, praise: 5, song: 2, gear: 2 }; s.zones = { A: true, B: true, C: true, D: true, E: true }; s.fresh = { A: true, B: true, C: true, D: true, E: true };
    s.seen = { tut: true, dis: true }; s.made = { brick: 400, snowman: 40 }; s.px = 160; s.py = 300;
    __SNOW.setSave(s); __SNOW.play(true);
  });
  await sleep(4000);
  await shot('10-late');
  var late = await page.evaluate(function () { var w = __SNOW.view().world(); return { crew: w.crew.length, dumps: w.dumps.length }; });
  ok('후반: 인력 35명 + 집하장 5곳', late.crew === 35 && late.dumps === 5, late);
  var fps = await page.evaluate(function () { return new Promise(function (res) { var n = 0, t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); } requestAnimationFrame(f); }); });
  var is3d = await page.evaluate(function () { return !!__SNOW.view().is3D; });
  ok('후반 프레임 (소프트웨어 렌더 기준 ' + (is3d ? '3D 5fps' : '2D 10fps') + ' 이상)', fps >= (is3d ? 5 : 10), fps);
  var sim = await page.evaluate(function () { var w = __SNOW.view().world(), t0 = w.time; return new Promise(function (res) { setTimeout(function () { res(w.time - t0); }, 2000); }); });
  ok('느린 화면에서도 게임 시간은 제대로 흐른다', sim > (fps >= 8 ? 1.6 : 0.9), [sim, fps]);

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
