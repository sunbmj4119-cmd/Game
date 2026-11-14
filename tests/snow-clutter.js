#!/usr/bin/env node
/* 제설각 "화면이 얼마나 복잡한가" 측정 (폰): 진행 단계별 장면에서
 *  - 덮임: 게임 화면을 가리는 HUD·알림·카드 넓이 (화면의 %)
 *  - 글자: 한 번에 보이는 글자 수 (읽을 거리)
 *  - 나 가림: 내 캐릭터 위에 덮인 HUD가 있는가
 *  - 조각: 보이는 HUD 조각 수
 * node tests/snow-clutter.js [사진폴더] [너비x높이]      (SNOW_URL로 다른 파일) */
'use strict';
var path = require('path'), fs = require('fs');
var { chromium } = require('playwright');
var shots = process.argv[2] || null, size = (process.argv[3] || '360x640').split('x').map(Number);
var url = process.env.SNOW_URL || 'file://' + path.join(__dirname, '..', 'snow.html');
var LIMIT = { cover: 34, chars: 140 };   // 작전 중 한 장면 기준 (넘으면 ✗)

function measure() {
  var vw = innerWidth, vh = innerHeight;
  function shown(el) { if (!el || el.closest('[hidden]')) return false; var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; var r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < vh; }
  // 게임 화면 위에 떠 있는 것 (화면 전체를 덮는 창은 따로)
  var SEL = ['.hud-top > *', '#goal', '#h-prog', '.hud-btns > *', '#stack > *', '#side > *', '#acts', '#xhair span', '#combo'];
  var els = []; SEL.forEach(function (q) { document.querySelectorAll(q).forEach(function (e) { if (shown(e) && els.indexOf(e) < 0) els.push(e); }); });
  // 넓이: 4px 격자로 합집합
  var G = 8, cols = Math.ceil(vw / G), rows = Math.ceil(vh / G), grid = new Uint8Array(cols * rows), chars = 0, pieces = 0;
  els.forEach(function (e) {
    var r = e.getBoundingClientRect(); pieces++;
    for (var y = Math.max(0, Math.floor(r.top / G)); y < Math.min(rows, Math.ceil(r.bottom / G)); y++) for (var x = Math.max(0, Math.floor(r.left / G)); x < Math.min(cols, Math.ceil(r.right / G)); x++) grid[y * cols + x] = 1;
    if (!e.querySelector('*') || e.id === 'goal' || e.closest('#side') || e.closest('#stack')) { /* 아래에서 글자 수만 */ }
  });
  var seen = new Set();
  els.forEach(function (e) { var t = (e.innerText || '').replace(/\s+/g, ''); if (!seen.has(e)) { seen.add(e); chars += t.length; } });
  var on = 0; for (var i = 0; i < grid.length; i++) on += grid[i];
  // 내 캐릭터 위치가 가려졌나
  var V = __SNOW.view(), w = V.world(), me = null, hid = [];
  if (w && V.screenOf) { var p = V.screenOf(w.player.x, w.player.y, 1.2); if (p && p.on) { me = { x: Math.round(p.x), y: Math.round(p.y) }; els.forEach(function (e) { var r = e.getBoundingClientRect(); if (p.x > r.left - 14 && p.x < r.right + 14 && p.y > r.top - 22 && p.y < r.bottom + 10) hid.push(e.id || e.className); }); } }
  var modal = !document.getElementById('modal').hidden || !document.getElementById('talk').hidden;
  return { cover: Math.round(on / grid.length * 100), chars: chars, pieces: pieces, me: me, hidMe: hid, modal: modal, list: els.map(function (e) { return (e.id || String(e.className).split(' ')[0]) + ':' + (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24); }) };
}

(async function () {
  var browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  var page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1, hasTouch: true });
  var errors = [], rows = [], bad = 0;
  page.on('pageerror', function (e) { errors.push(String(e)); });
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function closeAll() { for (var i = 0; i < 12; i++) { var t = await page.evaluate(function () { return !document.getElementById('talk').hidden; }); if (t) { await page.click('.talk-box'); await sleep(150); continue; } var b = await page.$('#modal:not([hidden]) [data-h="next"]') || await page.$('#modal:not([hidden]) [data-m="go"]') || await page.$('#modal:not([hidden]) [data-m="ok"]') || await page.$('#modal:not([hidden]) [data-m]'); if (!b) return; await b.click(); await sleep(250); } }
  async function scene(name, setup, ms, inOp) {
    if (setup) await page.evaluate(setup);
    await sleep(ms || 900);
    var m = await page.evaluate(measure);
    var over = inOp && (m.cover > LIMIT.cover || m.chars > LIMIT.chars || m.hidMe.length);
    if (over) bad++;
    rows.push((over ? '✗ ' : '  ') + name.padEnd(22) + ' 덮임 ' + String(m.cover).padStart(3) + '%  글자 ' + String(m.chars).padStart(4) + '  조각 ' + String(m.pieces).padStart(2) + (m.hidMe.length ? '  나를 가림: ' + m.hidMe.join(',') : ''));
    rows.push('      ' + m.list.join(' | ').slice(0, 330));
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, size.join('x') + '-' + name + '.png') }); }
  }
  // 저장을 꾸며서 작전을 시작한다 (장면이 뜨지 않게 이야기는 다 본 것으로)
  function startWith(conf) {
    return page.evaluate(function (c) {
      var s = JY.SnowSim.newSave(); s.seed = 31; s.seen = { tut: c.tut !== false, help: true };
      Object.keys(c.s || {}).forEach(function (k) { s[k] = c.s[k]; });
      (c.zones || ['A']).forEach(function (z) { s.zones[z] = true; s.fresh[z] = true; });
      JY.SNOW.STORY.forEach(function (st) { if (!c.keepStory || c.keepStory.indexOf(st.id) < 0) s.story[st.id] = true; });
      __SNOW.setSave(s); __SNOW.title(); __SNOW.play(false);
    }, conf);
  }
  await page.goto(url); await page.evaluate(function () { localStorage.clear(); }); await page.reload(); await sleep(1200);
  await page.evaluate(function () { var b = document.getElementById('sp-go'); if (b) b.click(); }); await sleep(500); await closeAll();
  await scene('로비-처음', null, 600, false);
  // 1일차 이병 첫 작전
  await startWith({ tut: false, s: { day: 1 } }); await sleep(2600); await closeAll();
  await scene('1일차-시작', null, 1500, true);
  await scene('1일차-가득', function () { var w = __SNOW.view().world(); w.player.load = w.player.cap; w.player.val = w.player.cap; }, 900, true);
  // 3일차 이병: 족구장, 후임 1, 소대장 순찰
  await startWith({ s: { day: 3, merit: 5, tool: 2, bank: 900, dia: 6, crew: { hoobae: 1 }, cpost: { hoobae: ['B'] } }, zones: ['A', 'B'] }); await sleep(2600); await closeAll();
  await scene('3일차-작업', function () { var w = __SNOW.view().world(); w.player.load = Math.round(w.player.cap * 0.4); }, 1200, true);
  await scene('3일차-경례', function () { var w = __SNOW.view().world(), o = JY.SnowAct.spawnOfficer(w, 'lt'); o.x = w.player.x + 20; o.y = w.player.y + 30; o.phase = 'stay'; o.stayT = 60; }, 1200, true);
  // 9일차 일병: 4구역, 분대원 3, 빙판, 콤보, 특명
  await startWith({ s: { day: 9, rank: 1, merit: 15, tool: 3, bank: 25000, dia: 18, crew: { hoobae: 3 }, cpost: { hoobae: ['B', 'C', 'D'] } }, zones: ['A', 'B', 'C', 'D'] }); await sleep(2600); await closeAll();
  await scene('9일차-바쁨', function () {
    var w = __SNOW.view().world(), A = JY.SnowAct; w.combo = 57; w.comboT = 30; w.player.load = w.player.cap;
    var P = w.parts.filter(function (p) { return p.ice; })[0]; if (P) { P.icy = true; P.salted = false; }
    w.fx.push({ t: 'say', key: '자, 제설 작전 개시! 오늘은 눈이 허리까지 왔다.' }); w.fx.push({ t: 'found', item: JY.SNOW.TREASURE[1], x: w.player.x, y: w.player.y, pie: 40, src: 'player', first: true });
  }, 1200, true);
  // 18일차 상병: 6구역, 분대원 6, 출근 차량
  await startWith({ s: { day: 18, rank: 2, merit: 32, tool: 5, bank: 300000, dia: 30, crew: { hoobae: 3, donggi: 2, cook: 1 }, cpost: { hoobae: ['A', 'B', 'C'], donggi: ['D', 'E'], cook: ['F'] } }, zones: ['A', 'B', 'C', 'D', 'E', 'F'] }); await sleep(2600); await closeAll();
  await scene('18일차-상병', function () { var w = __SNOW.view().world(); w.player.load = Math.round(w.player.cap * 0.5); w.combo = 130; w.comboT = 30; }, 1200, true);
  await page.evaluate(function () { var w = __SNOW.view().world(); JY.SnowAct.init(w).off = []; JY.SnowSim.endOp(w, 'time'); }); await sleep(1800);
  await scene('결과', null, 400, false);
  await closeAll(); await sleep(800);
  await scene('로비-상병', null, 600, false);
  await browser.close();
  rows.forEach(function (r) { console.log(r); });
  if (errors.length) console.log('페이지 오류', errors.slice(0, 3));
  console.log(bad ? '복잡한 장면 ' + bad + '개 (덮임 ' + LIMIT.cover + '% / 글자 ' + LIMIT.chars + '자 넘음 또는 나를 가림)' : '작전 화면 모두 기준 안 (' + size.join('x') + ')');
  process.exit(bad || errors.length ? 1 : 0);
})();
