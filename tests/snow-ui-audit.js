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
  var HUD = ['.hud-top', '#goal', '.prog', '.hud-btns', '#combo', '#say', '#chip', '#banner', '#hint', '#acts', '#side', '#salute', '#sub', '#xhair span'];
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
    await check('splash');
    await page.click('#splash'); await sleep(600);
    var rc = await page.$('#modal:not([hidden]) [data-m]'); if (rc) { await rc.click(); await sleep(300); }
    await check('lobby-new');
    await page.click('#t-start'); await sleep(1200); await check('prologue');
    async function closeAll() { for (var i = 0; i < 8; i++) { if (await page.evaluate(function () { return !document.getElementById('talk').hidden; })) { if (await page.evaluate(function () { return !document.getElementById('talk-name').hidden; })) { await page.click('#talk-ok'); await sleep(120); continue; } await page.click('.talk-box'); await sleep(120); continue; } var m = await page.$('#modal:not([hidden]) [data-m]') || await page.$('#modal:not([hidden]) [data-h="skip"]') || await page.$('#modal:not([hidden]) [data-h="next"]'); if (!m) return; await m.click(); await sleep(250); } }
    // 생활관 (진행된 저장: 일병, 분대원 3명, 상점·상자)
    await page.evaluate(function () {
      var s = JY.SnowSim.newSave(); s.day = 9; s.bank = 123456; s.life = 60000; s.dia = 27; s.tool = 3; s.rank = 1; s.merit = 13; JY.SnowSim.assignZones(s);
      s.crew = { hoobae: 2, donggi: 1 }; s.cpost = { hoobae: ['A', 'B'], donggi: ['C'] }; s.seen = { tut: true, dis: true, help: true }; s.boxes = ['rare', 'common']; s.look.name = '김제설';
      s.lastOp = { day: 8, stars: 2, score: 88, exam: false, pass: false }; s.prep = { hotpack: 1 }; s.stats.ops = 8;
      JY.SNOW.STORY.forEach(function (c) { s.story[c.id] = true; }); __SNOW.setSave(s); __SNOW.title();
    });
    await sleep(700); await closeAll(); await check('hub');
    await page.click('[data-hub="settings"]'); await sleep(300); await check('settings');
    await closeAll();
    await page.click('[data-hub="help"]'); await sleep(300); await check('help');
    await closeAll();
    // 상병 브리핑 (조원 배치까지 있는 가장 긴 브리핑)
    await page.evaluate(function () { var s = __SNOW.save(); s.rank = 2; s.merit = 26; JY.SnowSim.assignZones(s); s.crew = { hoobae: 4, donggi: 3 }; s.cpost = { hoobae: ['A', 'B', 'C', 'D'], donggi: ['E', 'F', 'A'] }; s.exam = true; __SNOW.title(); });
    await sleep(400); await closeAll();
    await page.click('#t-start'); await sleep(500); await check('brief');
    await page.click('#modal [data-m="go"]'); await sleep(1500); await closeAll();
    // 바쁜 작전 화면: 지시서 6줄 + 빙판 경고 + 기름 + 손에 든 것 + 버프 + 콤보 + 출입 통제 + 말풍선
    await page.evaluate(function () {
      var w = __SNOW.view().world(), A = JY.SnowAct, a = A.init(w); w.events = []; a.offPlan = [];
      var p = w.parts.filter(function (q) { return q.ice; })[0], bag = { cap: 1e9, load: 0, val: 0 }; for (var y = p.y; y < p.y + p.h; y += 10) for (var x = p.x; x < p.x + p.w; x += 10) JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag);
      a.reqs = [{ who: w.crew[0], item: 'fuel', t: 80, max: 100 }]; a.hand = 'salt';
      a.buffs = { matsta: 40, praise: 30, hotpack: 90, rally: 20 }; w.combo = 57; w.comboT = 30; w.player.load = w.player.cap; a.fuelT = 999; a.nagT = 999;
      w.time = JY.SnowSim.timeAt(425);
    });
    await page.evaluate(function () { var w = __SNOW.view().world(); w.fx.push({ t: 'locked', zone: 'G', name: '위병소 앞', cost: 0, x: 500, y: 330 }); w.fx.push({ t: 'say', key: '자, 제설 작전 개시! 오늘은 눈이 허리까지 왔다. 다 치우기 전엔 아침 없다!' }); });
    await sleep(900);
    await check('play-busy');
    // 사람 앞: 긴 행동 이름 + 두 번째 버튼
    await page.evaluate(function () { var w = __SNOW.view().world(), e = w.crew[0]; JY.SnowAct.init(w).hand = null; if (__SNOW.view().focusZone) __SNOW.view().focusZone('A', 0.01); e.x = 300; e.y = 230; e.speed = 0; e.retarget = 99; e.state = 'follow'; __SNOW.view()._teleport(300, 205); __SNOW.view()._setLook && __SNOW.view()._setLook(0, -0.1); });
    await sleep(600); await check('play-follow');
    await page.evaluate(function () { var w = __SNOW.view().world(), e = w.crew[0]; e.state = 'work'; e.mor = 30; });
    await sleep(600); await check('play-crew');
    // 행보관 앞: 장비 요청 버튼
    await page.evaluate(function () { var w = __SNOW.view().world(); w.haeng.x = 300; w.haeng.y = 228; w.haeng.hold = 60; w.crew[0].x = 600; __SNOW.save().bank = 1e7; __SNOW.view()._teleport(300, 205); __SNOW.view()._setLook && __SNOW.view()._setLook(0, -0.1); });
    await sleep(700); await check('play-haeng');
    // 간부 경례
    await page.evaluate(function () { var w = __SNOW.view().world(), o = JY.SnowAct.spawnOfficer(w, 'gen'); o.x = w.player.x + 10; o.y = w.player.y + 40; o.phase = 'stay'; o.stayT = 60; });
    await sleep(900); await check('play-salute');
    // 반전: 폭풍 제설 + 폭설 경보 + 콤보
    await page.evaluate(function () { var w = __SNOW.view().world(); JY.SnowAct.init(w).off = []; w.fever = 6; w.surge = 10; w.combo = 45; w.comboT = 30; });
    await sleep(700); await check('play-fever');
    await page.evaluate(function () { var w = __SNOW.view().world(); w.fever = 0; w.surge = 0; });
    // 1인칭 (시점 버튼)
    await page.evaluate(function () { __SNOW.view().toggleCam && __SNOW.view().toggleCam('fp'); });
    await sleep(700); await check('play-fp');
    // 검열 결과 (가장 긴 경우) → 진급 신고
    await page.evaluate(function () {
      var lines = JY.SNOW.ZONES.slice(0, 7).map(function (Z, i) { return { name: Z.name, due: Z.due, done: i % 3 !== 2, late: i === 1, pct: 0.7 }; });
      __SNOW.results({ why: 'report', day: 9, stars: 2, score: 0.88, base: 0.9, lines: lines, icy: 1, jigeok: 2, stuck: true, report: true, early: true, carPass: false, pie: 123456, earlyPie: 23456, dia: 3, merit: 42, rank: 3, rank0: 2, exam: true, pass: true, promoted: true, examNext: false, zones: ['위병소 앞'], box: 'rare' });
    });
    await sleep(1300); await check('results');
    await page.click('#modal [data-m]'); await sleep(600); await check('promo');
    await closeAll(); await sleep(500); await closeAll();
    // 상점 탭들 (생활관에서)
    await page.click('[data-hub="shop"]'); await sleep(300);
    for (var t of ['tool', 'crew', 'perk', 'factory', 'zone', 'look', 'story', 'medal', 'dis']) {
      var tb = await page.$('#s-tabs [data-tab="' + t + '"]'); if (!tb) continue;
      await tb.click(); await sleep(t === 'look' ? 900 : 250); await check('shop-' + t);
    }
    await page.click('#s-go'); await sleep(400); await closeAll();
    // PX · 상자 · 대사
    await page.click('[data-hub="px"]'); await sleep(400); await check('px');
    var cl = await page.$('#modal [data-m]'); if (cl) await cl.click(); await sleep(300);
    await page.evaluate(function () { __SNOW.save().boxes.unshift('legend'); __SNOW.openBox(); });
    await sleep(1500); await check('box');
    var bo = await page.$('#box-ok'); if (bo) await bo.click(); await sleep(300);
    await page.evaluate(function () { var s = __SNOW.save(); s.story = { prologue: true }; s.stats.ops = 1; __SNOW.title(); });
    await page.click('[data-hub="phone"]'); await sleep(900); await check('talk');
    await page.close();
  }
  await browser.close();
  report.forEach(function (x) { console.log('✗ ' + x); });
  console.log(problems ? '화면 문제 ' + problems + '개' : '화면 점검 통과 (' + SIZES.length + '가지 크기)');
  process.exit(problems ? 1 : 0);
})();
