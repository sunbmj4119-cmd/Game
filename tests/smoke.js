#!/usr/bin/env node
/* 스모크 테스트: 모바일 화면에서 출석 → 상점 → 입대 → 카드 넘기기(돌발·미니게임 포함) → PX/동료/휴가 → 엔딩 → 랭킹 → 기록실 → 오늘의 작전
 * node tests/smoke.js [스크린샷 폴더]  — 콘솔 에러가 있으면 실패 (VERBOSE=1 로 진행 로그) */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path');
var { chromium, devices } = require('playwright');

var root = path.join(__dirname, '..');
var shots = process.argv[2] || null;
var verbose = !!process.env.VERBOSE;
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

var server = http.createServer(function (req, res) {
  var p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  var f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function log() { if (verbose) console.log.apply(console, arguments); }

(async function () {
  await new Promise(function (r) { server.listen(0, r); });
  var url = 'http://127.0.0.1:' + server.address().port + '/';
  var browser = await chromium.launch();
  var ctx = await browser.newContext(Object.assign({}, devices['iPhone 13'], { deviceScaleFactor: shots ? 2 : 1 }));
  var page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  var errors = [], warnings = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); log('PAGEERROR', e.message, e.stack); });
  page.on('console', function (m) {
    var where = (m.location() && m.location().url) || '';
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + where) && !/ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text() + ' @ ' + where);
  });
  page.on('requestfailed', function (r) { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { r.abort(); });

  async function shot(name) { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name + '.png') }); } }
  async function vis(sel) { return page.evaluate(function (s) { var e = document.querySelector(s); return !!e && !e.hidden; }, sel); }
  async function tap(sel) {
    try { await page.click(sel, { timeout: 2500 }); return true; }
    catch (e) {
      var ok = await page.evaluate(function (s) { var el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
      if (ok) warnings.push('tap blocked (DOM click used): ' + sel);
      return ok;
    }
  }

  await page.goto(url);
  await page.waitForSelector('#btn-new');
  await sleep(400);
  // 1) 입대 환영 + 출석
  if (await vis('#modal')) { await shot('00-greet'); await tap('#modal-box [data-act="close"]'); await sleep(250); }
  await shot('01-title');

  // 2) 상점: 전역 보험 구매, 꾸미기 탭
  await tap('#btn-shop'); await sleep(300);
  await shot('02-shop');
  var gems0 = await page.evaluate(function () { return JY.Meta.get().gems; });
  await tap('[data-buy="insurance"]'); await sleep(200);
  var gems1 = await page.evaluate(function () { return JY.Meta.get().gems; });
  if (gems1 !== gems0 - 40) errors.push('insurance purchase did not cost 40: ' + gems0 + ' -> ' + gems1);
  await tap('#shop-tabs [data-tab="cos"]'); await sleep(200);
  await tap('[data-cos="blush"]'); await sleep(200);
  await shot('02b-shop-cos');
  await tap('#shop-tabs [data-tab="box"]'); await sleep(200);
  await shot('02c-shop-box');
  await tap('#btn-shop-back'); await sleep(250);

  // 2b) 막사: 외모 바꾸기, 옷장 (되돌리기 테스트용으로 국방부 시계 +1 장착)
  await tap('#btn-barracks'); await sleep(300);
  await tap('[data-face="eyes"][data-d="1"]'); await sleep(150);
  await shot('02d-barracks-face');
  await tap('#barracks-tabs [data-tab="wardrobe"]'); await sleep(200);
  await tap('[data-equip="blush"]'); await sleep(150);
  await shot('02e-barracks-wardrobe');
  await tap('#barracks-tabs [data-tab="mission"]'); await sleep(200);
  await shot('02f-barracks-mission');
  await tap('#btn-barracks-back'); await sleep(250);
  await page.evaluate(function () { JY.Meta.get().up.watch = 1; JY.Meta.save(); });

  // 3) 입영 통지서: 성격 카드, 보험, 속성 복무
  await tap('#btn-new');
  await page.waitForSelector('#scr-setup:not([hidden])');
  await page.fill('#in-name', '나띨빵');
  await tap('.trait:nth-child(2)');
  await tap('.mos[data-mos="cook"]');
  await page.check('input[name="pace"][value="3"]', { force: true });
  if (!(await vis('#row-insurance'))) errors.push('insurance row not shown after purchase');
  await sleep(200);
  await shot('03-setup');
  await tap('#setup-form button[type="submit"]');
  await page.waitForSelector('#scr-game:not([hidden])');
  await sleep(600);
  await shot('04-game');

  var cards = 0, minis = 0, emergencies = 0, leaveTaken = false, pxDone = false, matesDone = false, undoUsed = false, specialUsed = 0;
  var shotResult = false, shotMini = false, shotDrag = false, shotUrgent = false;
  for (var i = 0; i < 200; i++) {
    var st = await page.evaluate(function () {
      return {
        over: !document.getElementById('scr-end').hidden,
        mini: !document.getElementById('mini').hidden,
        modal: !document.getElementById('modal').hidden,
        result: !document.getElementById('result').hidden,
        urgent: document.getElementById('card').classList.contains('urgent')
      };
    });
    if (st.over) break;
    if (verbose) log(i, JSON.stringify(st), await page.evaluate(function () { var s = JY.UI._state(); return s ? s.current + ' day' + s.day : 'nostate'; }));
    if (st.mini) {
      minis++;
      if (!shotMini) { await sleep(2600); await shot('06-mini'); shotMini = true; }
      for (var k = 0; k < 120; k++) {
        if (!(await vis('#mini'))) break;
        var btns = await page.$$('#mini .gear:not([disabled]), #mini .memo-opts button');
        if (btns.length) { await btns[Math.floor(Math.random() * btns.length)].click({ timeout: 1500 }).catch(function () {}); }
        else {
          var box = await page.$('#mini .mg-stage');
          var bb = box && await box.boundingBox();
          if (bb) {
            var x = bb.x + Math.random() * bb.width, y = bb.y + Math.random() * bb.height;
            await page.mouse.move(x, y); await page.mouse.down();
            await page.mouse.move(x + 60, y + 30, { steps: 3 }); await page.mouse.up();
          }
        }
        await sleep(180);
      }
      continue;
    }
    if (st.modal) {
      var prim = (await page.$('#modal-box .btn-primary')) ? '#modal-box .btn-primary' : '#modal-box [data-act="close"]';
      await tap(prim);
      await sleep(250); continue;
    }
    if (st.result) {
      if (!shotResult) { await shot('05-result'); shotResult = true; }
      await sleep(380);
      if (!undoUsed && (await page.$('#undo-btn'))) {
        await shot('05b-undo');
        await tap('#undo-btn'); undoUsed = true; await sleep(400); continue;
      }
      await tap('#result'); await sleep(250); continue;
    }
    if (st.urgent) {
      emergencies++;
      if (!shotUrgent) { await sleep(500); await shot('07-urgent'); shotUrgent = true; }
      if (emergencies === 1) { await sleep(6500); continue; } // 한 번은 시간 초과 경로를 탄다
    }

    // PX 한 번 + 가방, 동료 선물 한 번, 휴가 한 번
    if (!pxDone && cards > 4 && !st.urgent) {
      var pxOk = await page.evaluate(function () { return !document.getElementById('dock-px').classList.contains('off'); });
      if (pxOk) {
        await tap('#dock-px'); await sleep(300);
        var buyTuna = await page.$('#modal-box .item[data-id="chocopie"]:not([disabled])');
        if (buyTuna) { await buyTuna.click(); await sleep(150); await buyTuna.click().catch(function () {}); await sleep(150); }
        await shot('08-px');
        await tap('#modal-box [data-act="close"]'); await sleep(250);
        await tap('#dock-bag'); await sleep(250);
        await tap('#modal-box [data-tab="premium"]'); await sleep(200);
        await shot('09-bag-premium');
        await tap('#modal-box [data-act="close"]'); await sleep(200);
        pxDone = true;
      }
    }
    if (pxDone && !matesDone && !st.urgent) {
      await tap('#dock-mates'); await sleep(300);
      if (await vis('#modal')) {
        await tap('#modal-box [data-talk]'); await sleep(200);
        await tap('#modal-box [data-giftto="dumb"]'); await sleep(200);
        var g = await page.$('#modal-box [data-gift]');
        if (g) { await g.click(); await sleep(250); }
        await shot('10-mates');
        await tap('#modal-box [data-act="close"]'); await sleep(200);
      }
      matesDone = true;
    }
    if (!leaveTaken && cards > 12 && !st.urgent) {
      var lv = await page.evaluate(function () { return !document.getElementById('dock-leave').classList.contains('off'); });
      if (lv) {
        await tap('#dock-leave'); await sleep(300);
        var go = await page.$('#modal-box [data-act="go"]');
        if (go) { await go.click(); await sleep(300); leaveTaken = true; }
        else await tap('#modal-box [data-act="close"]');
        continue;
      }
    }

    // 특수 대답이 있으면 가끔 쓴다
    if (specialUsed < 2 && (await vis('#choice-x-btn'))) {
      if (!specialUsed) await shot('04c-special');
      await tap('#choice-x-btn'); await sleep(120); await tap('#choice-x-btn');
      specialUsed++; cards++; await sleep(450); continue;
    }

    // 카드 끌어서 넘기기 (가끔은 버튼 두 번, 가끔은 인물 톡)
    var card = await page.$('#card');
    var cb = await card.boundingBox();
    var cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
    if (i % 9 === 3) { await page.mouse.click(cx, cy); await sleep(150); }
    var dir = Math.random() < 0.5 ? -1 : 1;
    if (Math.random() < 0.25) {
      var side = dir < 0 ? 'l' : 'r';
      await tap('.choice[data-side="' + side + '"]'); await sleep(120);
      await tap('.choice[data-side="' + side + '"]');
    } else {
      await page.mouse.move(cx, cy); await page.mouse.down();
      await page.mouse.move(cx + dir * 70, cy + 5, { steps: 4 });
      if (!shotDrag) { await sleep(150); await shot('04b-drag'); shotDrag = true; }
      await page.mouse.move(cx + dir * 190, cy + 10, { steps: 4 });
      await page.mouse.up();
    }
    cards++;
    await sleep(420);
  }

  var ended = await vis('#scr-end');
  if (ended) {
    await sleep(900);
    await shot('11-ending');
    await sleep(900);
    if (await vis('#modal')) { await shot('11c-levelup'); await tap('#modal-box [data-act="close"]'); await sleep(250); }
    await page.evaluate(function () { document.getElementById('score-panel').scrollIntoView(); });
    await sleep(200);
    await shot('11b-score');
    await tap('#btn-end-rank'); await sleep(600);
    await shot('12-rank');
    await tap('#rank-tabs [data-tab="mine"]'); await sleep(200);
    await shot('12b-rank-mine');
    await tap('#btn-rank-back'); await sleep(200);
    await tap('#btn-end-title'); await sleep(300);
    if (await vis('#modal')) { await tap('#modal-box [data-act="close"]'); await sleep(200); }
    await tap('#btn-album'); await sleep(250);
    await tap('#album-tabs [data-tab="medals"]'); await sleep(200);
    await shot('13-medals');
    await tap('#album-tabs [data-tab="scenes"]'); await sleep(200);
    await shot('13b-scenes');
    await tap('#btn-album-back'); await sleep(250);
    // 막사: 장비 강화, 임무 보상
    await tap('#btn-barracks'); await sleep(250);
    await tap('#barracks-tabs [data-tab="gear"]'); await sleep(200);
    var jjamBefore = await page.evaluate(function () { return JY.Meta.get().jjam; });
    var upBtn = await page.$('[data-up="boots"]:not([disabled])');
    if (upBtn) { await upBtn.click(); await sleep(900); }
    var bootsLv = await page.evaluate(function () { return JY.Meta.upLevel('boots'); });
    if (jjamBefore >= 80 && bootsLv < 1) errors.push('boots upgrade failed with enough jjam: ' + jjamBefore);
    await shot('15-gear');
    await tap('#barracks-tabs [data-tab="mission"]'); await sleep(200);
    var claim = await page.$('[data-claim]');
    if (claim) { await claim.click(); await sleep(300); if (await vis('#modal')) await tap('#modal-box [data-act="close"]'); }
    await shot('16-missions');
    await tap('#btn-barracks-back'); await sleep(250);
    await tap('#btn-album-back'); await sleep(250);
    // 오늘의 작전 시작만 확인
    await tap('#btn-daily'); await sleep(300);
    await shot('14-daily');
    await tap('#modal-box [data-act="go"]'); await sleep(700);
    var daily = await page.evaluate(function () { var s = JY.UI._state(); return s && s.daily; });
    if (!daily) errors.push('daily run did not start');
  }
  var meta = await page.evaluate(function () { var m = JY.Meta.get(); return { gems: m.gems, jjam: m.jjam, lv: JY.Meta.level().lv, up: m.up, scenes: Object.keys(m.scenes).length, ach: Object.keys(m.ach).length, records: m.records.length }; });
  if (warnings.length) console.log('WARN:\n' + warnings.join('\n'));
  console.log(JSON.stringify({ cards: cards, minis: minis, emergencies: emergencies, leaveTaken: leaveTaken, pxDone: pxDone, matesDone: matesDone, undoUsed: undoUsed, specialUsed: specialUsed, ended: ended, meta: meta }));
  await browser.close();
  server.close();
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  if (!ended) { console.error('게임이 끝나지 않았다'); process.exit(1); }
  console.log('smoke ok');
})().catch(function (e) { console.error(e); server.close(); process.exit(1); });
