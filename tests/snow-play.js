#!/usr/bin/env node
/* 제설각 브라우저 점검: 실제로 걷고, 치우고, 검열받고, 사고, 진급하고, 화면을 찍는다.
 * node tests/snow-play.js [스크린샷 폴더] [너비x높이] */
'use strict';
var path = require('path'), fs = require('fs');
var { chromium } = require('playwright');
var shots = process.argv[2] || null, size = (process.argv[3] || '390x844').split('x').map(Number);
var url = process.env.SNOW_URL || 'file://' + path.join(__dirname, '..', 'snow.html');

(async function () {
  var browser = await chromium.launch();
  var page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: shots ? 2 : 1, hasTouch: false });
  var errors = [], checks = [];
  page.on('pageerror', function (e) { errors.push(String(e)); });
  page.on('console', function (m) { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  function ok(name, cond, detail) { checks.push({ name: name, ok: !!cond, detail: detail }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function shot(name) { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name + '.png') }); }
  async function vis(sel) { return page.evaluate(function (s) { var e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; }, sel); }
  async function overflow() {
    return page.evaluate(function () {
      var bad = [];
      document.querySelectorAll('#app *').forEach(function (el) {
        if (el.closest('[hidden]') || el.closest('svg') || el.tagName === 'CANVAS' && el.id === 'cv') return;
        var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (r.right > innerWidth + 1 || r.left < -1) bad.push((el.id || el.className || el.tagName) + ' x' + Math.round(r.left) + '-' + Math.round(r.right));
        if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible' && el.children.length === 0 && el.textContent.trim()) bad.push('text-overflow ' + (el.className || el.tagName) + ' "' + el.textContent.trim().slice(0, 20) + '"');
      });
      return bad;
    });
  }

  await page.goto(url);
  await page.evaluate(function () { localStorage.clear(); });
  await page.reload();
  await sleep(900);
  ok('타이틀 표시', await vis('#title .logo'));
  await shot('01-title');

  // 1일차: 직접 끌어서 걷기
  await page.click('#t-start');
  await sleep(600);
  ok('작업 화면 + HUD', await vis('#hud') && !(await vis('#title')));
  ok('첫날 조작 안내', await vis('#hint'));
  await shot('02-day1-start');
  var p0 = await page.evaluate(function () { var w = JY.SnowView.world(); return { x: w.player.x, y: w.player.y, clear: w.clear, bank: __SNOW.save().bank }; });
  await page.mouse.move(size[0] / 2, size[1] * 0.6);
  await page.mouse.down();
  await page.mouse.move(size[0] / 2 + 40, size[1] * 0.6 + 10, { steps: 6 });
  await sleep(1500);
  await page.mouse.move(size[0] / 2 - 30, size[1] * 0.6 + 30, { steps: 6 });
  await sleep(1200);
  await page.mouse.up();
  var p1 = await page.evaluate(function () { var w = JY.SnowView.world(); return { x: w.player.x, y: w.player.y, clear: w.clear, bank: __SNOW.save().bank, tut: __SNOW.save().seen.tut }; });
  ok('끌면 걷는다', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 40, [p0, p1]);
  ok('걸으면 눈이 치워지고 초코파이가 생긴다', p1.clear > p0.clear && p1.bank > p0.bank, [p0, p1]);
  ok('조작하면 안내가 사라진다', p1.tut === true && !(await vis('#hint')));
  // 톡 해서 이동
  var t0 = await page.evaluate(function () { var w = JY.SnowView.world(); return { x: w.player.x, y: w.player.y }; });
  await page.mouse.click(size[0] * 0.8, size[1] * 0.45);
  await sleep(1300);
  var t1 = await page.evaluate(function () { var w = JY.SnowView.world(); return { x: w.player.x, y: w.player.y }; });
  ok('톡 하면 그쪽으로 간다', t1.x > t0.x + 20, [t0, t1]);
  // 키보드
  var k0 = await page.evaluate(function () { JY.SnowView._teleport(190, 160); return JY.SnowView.world().player.y; });
  await page.keyboard.down('ArrowDown'); await sleep(700); await page.keyboard.up('ArrowDown');
  var k1 = await page.evaluate(function () { return JY.SnowView.world().player.y; });
  ok('방향키로도 걷는다', k1 > k0 + 20, [k0, k1]);
  await page.evaluate(function () { __SNOW.autopilot(true); });
  await sleep(4000);
  await shot('03-day1-mid');
  ok('행보관 말풍선이 나온다', await page.evaluate(function () { return document.getElementById('say-text').textContent.length > 0; }));
  await page.evaluate(function () { __SNOW.endNow(); });
  await sleep(1800);
  ok('검열 결과', await vis('#result .res') && await vis('#result .stamp'));
  var day = await page.evaluate(function () { return __SNOW.save().day; });
  ok('하루가 지나면 2일차', day === 2, day);
  await shot('04-result');
  var of1 = await overflow(); ok('결과 화면 넘침 없음', !of1.length, of1);

  // 보급·인력
  await page.evaluate(function () { var s = __SNOW.save(); s.bank += 5000; });
  await page.click('#result [data-r="shop"]');
  await sleep(500);
  ok('보급·인력 화면', await vis('#shop .item'));
  await shot('05-shop-crew');
  var c0 = await page.evaluate(function () { return __SNOW.save().crew.hoobae || 0; });
  await page.click('#s-list .item.can .buy');
  await sleep(300);
  await page.click('#s-list .item.can .buy');
  var c1 = await page.evaluate(function () { return __SNOW.save().crew.hoobae || 0; });
  ok('후임 채용', c1 === c0 + 2, [c0, c1]);
  await page.click('#s-tabs [data-tab="tool"]');
  await sleep(200);
  await shot('06-shop-tool');
  await page.click('#s-list .item.can .buy');
  var tool = await page.evaluate(function () { return __SNOW.save().tool; });
  ok('넉가래 지급', tool === 1, tool);
  await page.click('#s-tabs [data-tab="zone"]');
  await page.click('#s-list .item.can .buy');
  ok('구역 확장', await page.evaluate(function () { return !!__SNOW.save().zones.B; }));
  await page.click('#s-tabs [data-tab="perk"]');
  await sleep(200);
  await shot('07-shop-perk');
  var of2 = await overflow(); ok('보급 화면 넘침 없음', !of2.length, of2);

  // 2일차: 인력이 일한다
  await page.click('#s-go');
  await sleep(4500);
  var crew = await page.evaluate(function () { var w = JY.SnowView.world(); return { n: w.crew.length, moved: w.crew.filter(function (e) { return Math.hypot(e.x - 320, e.y - 126) > 30; }).length, crewEarned: w.crewEarned }; });
  ok('채용한 후임이 나와서 일한다', crew.n === 2 && crew.moved >= 1 && crew.crewEarned > 0, crew);
  await shot('08-day2-crew');

  // 진급
  await page.evaluate(function () { var s = __SNOW.save(); s.life = 3200; __SNOW.endNow(); });
  await sleep(1800);
  var r2 = await page.evaluate(function () { return { rank: JY.SnowSim.rankOf(__SNOW.save()), modal: !document.getElementById('modal').hidden }; });
  ok('일병 진급 축하', r2.rank === 1 && r2.modal, r2);
  await shot('09-rankup');
  await page.click('#modal [data-m]');

  // 후반: 많은 인력과 제설차
  await page.evaluate(function () {
    var s = JY.SnowSim.newSave(); s.day = 24; s.bank = 123456; s.life = 900000; s.tool = 6;
    s.crew = { hoobae: 10, donggi: 8, cook: 6, malnyeon: 4, admin: 3, reserve: 3, plow: 1 };
    s.perks = { eisen: 3, hotpack: 3, matsta: 2, praise: 5, song: 2, gear: 2 }; s.zones = { A: true, B: true, C: true, D: true, E: true }; s.seen = { tut: true, dis: true };
    __SNOW.setSave(s); __SNOW.startDay();
  });
  await sleep(5000);
  await shot('10-late-game');
  var late = await page.evaluate(function () { var w = JY.SnowView.world(); return { crew: w.crew.length, pct: JY.SnowSim.pct(w) }; });
  ok('후반: 인력 35명 + 트랙터', late.crew === 35 && late.pct > 0, late);
  // 성능: 프레임 측정
  var fps = await page.evaluate(function () {
    return new Promise(function (res) { var n = 0, t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / ((performance.now() - t0) / 1000))); } requestAnimationFrame(f); });
  });
  ok('후반 프레임 (헤드리스 기준 30fps 이상)', fps >= 30, fps);
  await page.evaluate(function () { __SNOW.endNow(); });
  await sleep(1800);
  await page.click('#result [data-r="shop"]');
  await sleep(400);
  await page.click('#s-tabs [data-tab="dis"]');
  await sleep(300);
  await shot('11-discharge');
  await page.click('#dis-go');
  await page.click('#modal [data-m="yes"]');
  await sleep(400);
  var dis = await page.evaluate(function () { var s = __SNOW.save(); return { medals: s.medals, day: s.day, tool: s.tool, life: s.life }; });
  ok('전역: 메달 받고 처음부터', dis.medals >= 4 && dis.day === 1 && dis.tool === 0 && dis.life === 0, dis);
  await page.click('#modal [data-m]');
  await sleep(500);
  ok('전역 후 타이틀', await vis('#title .logo'));

  // 오프라인 보상
  await page.evaluate(function () { var s = __SNOW.save(); s.crewRate = 50; s.last = Date.now() - 3600 * 1000; localStorage.setItem('jeseol-v1', JSON.stringify(s)); });
  await page.reload();
  await sleep(900);
  ok('쉬는 동안 인력이 번 초코파이', await page.evaluate(function () { return !document.getElementById('modal').hidden && /후임들이/.test(document.getElementById('modal').textContent); }));
  await shot('12-offline');

  await browser.close();
  checks.forEach(function (c) { console.log((c.ok ? '✓ ' : '✗ ') + c.name + (c.ok ? '' : ' ' + JSON.stringify(c.detail))); });
  if (errors.length) console.log('에러:\n  ' + errors.join('\n  '));
  var bad = checks.filter(function (c) { return !c.ok; }).length + errors.length;
  console.log(bad ? '문제 ' + bad + '개' : 'snow ok (' + checks.length + '개 통과)');
  process.exit(bad ? 1 : 0);
})();
