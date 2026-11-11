#!/usr/bin/env node
/* 제설각 휴대폰 화면 점검: 여러 크기 × 주요 장면에서 글씨 넘침·잘림·겹침을 찾는다 (+ 화면 사진)
 * node tests/snow-ui-audit.js [사진폴더]      (SNOW_URL로 다른 파일 지정) */
'use strict';
var path = require('path'), fs = require('fs');
var { chromium } = require('playwright');
var shots = process.argv[2] || null;
var url = process.env.SNOW_URL || 'file://' + path.join(__dirname, '..', 'snow.html');
var SIZES = [[360, 640], [375, 667], [390, 844], [412, 915]];

// 지금 화면에서 문제 찾기: 화면 밖으로 나감 / 말줄임으로 잘림 / HUD 조각끼리 겹침
function scan() {
  var vw = innerWidth, vh = innerHeight, out = [];
  function shown(el) { if (!el || el.closest('[hidden]')) return false; var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function name(el) { return el.id ? '#' + el.id : (el.className && el.className.baseVal === undefined ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase()) + (el.textContent ? '「' + el.textContent.trim().slice(0, 18) + '」' : ''); }
  document.querySelectorAll('#app *').forEach(function (el) {
    if (el.closest('svg') || el.tagName === 'CANVAS' || el.closest('#ov3d') || !shown(el)) return;
    var r = el.getBoundingClientRect(), scr = el.closest('.list, .tabs, .look-tabs, .modal-box, .shop');
    if (!scr && (r.left < -1 || r.right > vw + 1 || r.bottom > vh + 1 || r.top < -1)) out.push('화면 밖: ' + name(el) + ' [' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom) + ']');
    if (scr && !el.closest('.tabs, .look-tabs') && (r.left < -1 || r.right > vw + 1)) out.push('옆으로 넘침: ' + name(el));
    var cs = getComputedStyle(el);
    if ((cs.textOverflow === 'ellipsis' || cs.overflow === 'hidden') && el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim()) out.push('글씨 잘림: ' + name(el));
  });
  var HUD = ['.hud-top', '.prog', '.hud-btns', '#say', '#chip', '#banner', '#hint', '#acts', '#h-shop', '#side', '#salute', '#sub', '#xhair span'];
  var rs = HUD.map(function (q) { var el = document.querySelector(q); return shown(el) ? { q: q, r: el.getBoundingClientRect() } : null; }).filter(Boolean);
  for (var i = 0; i < rs.length; i++) for (var j = i + 1; j < rs.length; j++) {
    var a = rs[i].r, b = rs[j].r, ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 6 && oy > 6) out.push('겹침: ' + rs[i].q + ' ↔ ' + rs[j].q);
  }
  return out;
}

(async function () {
  var browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  var problems = 0, report = [];
  for (var si = 0; si < SIZES.length; si++) {
    var sz = SIZES[si], tag = sz[0] + 'x' + sz[1];
    var page = await browser.newPage({ viewport: { width: sz[0], height: sz[1] }, deviceScaleFactor: 1 });
    page.on('pageerror', function (e) { report.push(tag + ' 에러: ' + e); problems++; });
    async function check(state) {
      var p = await page.evaluate(scan);
      p.forEach(function (x) { report.push(tag + ' [' + state + '] ' + x); });
      problems += p.length;
      if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, tag + '-' + state + '.png') }); }
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    await page.goto(url);
    await page.evaluate(function () { localStorage.clear(); });
    await page.reload(); await sleep(900);
    await check('title');
    // 진행된 저장으로 작업 화면
    await page.evaluate(function () {
      var s = JY.SnowSim.newSave(); s.day = 5; s.bank = 123456; s.life = 60000; s.dia = 27; s.tool = 3; s.zones = { A: true, B: true, C: true }; s.fresh = { A: true, B: true, C: true };
      s.crew = { hoobae: 3 }; s.cpost = { hoobae: ['A', 'B', 'C'] }; s.seen = { tut: true }; s.boxes = ['rare', 'common']; s.look.name = '김제설';
      JY.SNOW.STORY.forEach(function (c) { s.story[c.id] = true; }); __SNOW.setSave(s);
    });
    await page.click('#t-start'); await sleep(1500);
    await page.evaluate(function () {
      var w = __SNOW.view().world(), A = JY.SnowAct, a = A.init(w); w.events = [];
      a.mission = A.newMission(w); a.reqs = [{ who: w.crew[0], item: 'meal', t: 80, max: 100 }, { who: w.haeng, item: 'snack', t: 50, max: 100 }]; a.hand = 'meal';
      a.buffs = { matsta: 40, praise: 30, meal: 90 }; a.heat = 2; w.combo = 57; w.comboT = 30; w.player.load = w.player.cap; a.reqT = 999; a.fuelT = 999;
    });
    await page.evaluate(function () { var w = __SNOW.view().world(); w.fx.push({ t: 'locked', zone: 'D', name: '취사장 앞', cost: 7000, x: 500, y: 330 }); w.fx.push({ t: 'say', key: '자, 제설 작전 개시! 오늘은 눈이 허리까지 왔다. 다 치우기 전엔 점심 없다!' }); });
    await sleep(900);
    await check('play-busy');
    // 사람 앞: 긴 행동 이름 + 두 번째 버튼
    await page.evaluate(function () { var w = __SNOW.view().world(), e = w.crew[0]; e.x = 300; e.y = 230; e.speed = 0; e.retarget = 99; e.state = 'follow'; __SNOW.view()._teleport(300, 205); __SNOW.view()._setLook && __SNOW.view()._setLook(0, -0.1); });
    await sleep(600); await check('play-follow');
    await page.evaluate(function () { var w = __SNOW.view().world(), e = w.crew[0]; e.state = 'work'; JY.SnowAct.init(w).hand = null; e.mor = 30; });
    await sleep(600); await check('play-crew');
    // 간부 경례
    await page.evaluate(function () { var w = __SNOW.view().world(), o = JY.SnowAct.spawnOfficer(w, 'gen'); o.x = w.player.x + 10; o.y = w.player.y + 40; o.phase = 'stay'; o.stayT = 60; });
    await sleep(900); await check('play-salute');
    // 3인칭
    await page.evaluate(function () { __SNOW.view().toggleCam && __SNOW.view().toggleCam('near'); });
    await sleep(700); await check('play-third');
    await page.evaluate(function () { __SNOW.view().toggleCam && __SNOW.view().toggleCam('fp'); });
    // 상점 탭들
    await page.click('#h-shop'); await sleep(300);
    for (var t of ['tool', 'crew', 'factory', 'perk', 'zone', 'look', 'story', 'medal']) {
      var tb = await page.$('#s-tabs [data-tab="' + t + '"]'); if (!tb) continue;
      await tb.click(); await sleep(t === 'look' ? 900 : 250); await check('shop-' + t);
    }
    await page.click('#s-go'); await sleep(400);
    // PX · 상자 · 대사
    await page.evaluate(function () { var d = JY.SnowAct.door('px'); __SNOW.view()._teleport(d.x, d.y + 14); __SNOW.view()._setLook && __SNOW.view()._setLook(Math.PI, 0); });
    await sleep(500); await page.click('#act-btn'); await sleep(500); await check('px');
    var cl = await page.$('#modal [data-m]'); if (cl) await cl.click(); await sleep(300);
    await page.click('#h-box'); await sleep(1500); await check('box');
    var bo = await page.$('#box-ok'); if (bo) await bo.click(); await sleep(300);
    await page.evaluate(function () { var s = __SNOW.save(); delete s.story.malnyeon; });
    await sleep(1200); await check('talk');
    await page.close();
  }
  await browser.close();
  report.forEach(function (x) { console.log('✗ ' + x); });
  console.log(problems ? '화면 문제 ' + problems + '개' : '화면 점검 통과 (' + SIZES.length + '가지 크기)');
  process.exit(problems ? 1 : 0);
})();
