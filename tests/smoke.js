#!/usr/bin/env node
/* 스모크 테스트: 모바일 화면에서 입대 → 카드 넘기기 → 미니게임 → PX/휴가 → 엔딩까지 자동 플레이.
 * node tests/smoke.js [스크린샷 폴더]  — 콘솔 에러가 있으면 실패 */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path');
var { chromium, devices } = require('playwright');

var root = path.join(__dirname, '..');
var shots = process.argv[2] || null;
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

(async function () {
  await new Promise(function (r) { server.listen(0, r); });
  var url = 'http://127.0.0.1:' + server.address().port + '/';
  var browser = await chromium.launch();
  var ctx = await browser.newContext(Object.assign({}, devices['iPhone 13'], { deviceScaleFactor: shots ? 2 : 1 }));
  var page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  var errors = [];
  var warnings = [];
  var verbose = !!process.env.VERBOSE;
  page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); if (verbose) console.log('PAGEERROR', e.message, e.stack); });
  page.on('console', function (m) {
    var where = (m.location() && m.location().url) || '';
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + where) && !/ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text() + ' @ ' + where);
  });
  page.on('requestfailed', function (r) { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { r.abort(); });

  async function shot(name) { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name + '.png') }); } }

  await page.goto(url);
  await page.waitForSelector('#btn-new');
  await sleep(300);
  await shot('01-title');

  await page.click('#btn-new');
  await page.waitForSelector('#scr-setup:not([hidden])');
  await page.fill('#in-name', '나띨빵');
  await page.click('.mos[data-mos="cook"]');
  await page.check('input[name="pace"][value="3"]', { force: true });
  await sleep(200);
  await shot('02-setup');
  await page.click('#setup-form button[type="submit"]');
  await page.waitForSelector('#scr-game:not([hidden])');
  await sleep(600);
  await shot('03-game');

  var cards = 0, minis = 0, leaveTaken = false, pxDone = false, shotResult = false, shotMini = false, shotDrag = false;
  for (var i = 0; i < 160; i++) {
    var st = await page.evaluate(function () {
      return {
        over: !document.getElementById('scr-end').hidden,
        mini: !document.getElementById('mini').hidden,
        modal: !document.getElementById('modal').hidden,
        result: !document.getElementById('result').hidden
      };
    });
    if (st.over) break;
    if (verbose) console.log(i, JSON.stringify(st), await page.evaluate(function () { var s = JY.UI._state(); return s ? s.current + ' day' + s.day + ' pend:' + JSON.stringify(s.pendingMini) : 'nostate'; }));
    if (st.mini) {
      minis++;
      if (!shotMini) { await sleep(2600); await shot('05-mini'); shotMini = true; }
      // 미니게임: 버튼이 있으면 누르고, 없으면 무대를 문지르고 두드린다
      for (var k = 0; k < 120; k++) {
        var still = await page.evaluate(function () { return !document.getElementById('mini').hidden; });
        if (!still) break;
        var btns = await page.$$('#mini .gear:not([disabled]), #mini .memo-opts button');
        if (btns.length) { await btns[Math.floor(Math.random() * btns.length)].click().catch(function () {}); }
        else {
          var box = await page.$('#mini .mg-stage');
          if (box) {
            var bb = await box.boundingBox();
            if (bb) {
              var x = bb.x + Math.random() * bb.width, y = bb.y + Math.random() * bb.height;
              await page.mouse.move(x, y); await page.mouse.down();
              await page.mouse.move(x + 60, y + 30, { steps: 3 }); await page.mouse.up();
            }
          }
        }
        await sleep(180);
      }
      continue;
    }
    if (st.modal) {
      if (verbose) console.log('modal:', await page.evaluate(function () { var h = document.querySelector('#modal-box h3'); return h ? h.textContent : '?'; }));
      var prim = await page.$('#modal-box .btn-primary');
      var clicked = false;
      if (prim) await prim.click({ timeout: 2500 }).then(function () { clicked = true; }).catch(function () {});
      else await page.click('#modal-box [data-act="close"]', { timeout: 2500 }).then(function () { clicked = true; }).catch(function () {});
      if (!clicked) {
        var info = await page.evaluate(function () {
          var btn = document.querySelector('#modal-box .btn-primary') || document.querySelector('#modal-box [data-act="close"]');
          if (!btn) return 'no button';
          var b = btn.getBoundingClientRect(), mb = document.getElementById('modal-box').getBoundingClientRect();
          var hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          var out = { btn: [b.x, b.y, b.width, b.height].map(Math.round), box: [mb.x, mb.y, mb.width, mb.height].map(Math.round), scrollTop: document.getElementById('modal-box').scrollTop, hit: hit ? (hit.id || hit.className) : null, title: (document.querySelector('#modal-box h3') || {}).textContent };
          btn.click();
          return out;
        });
        warnings.push('modal tap blocked: ' + JSON.stringify(info));
        if (shots) await page.screenshot({ path: path.join(shots, 'blocked-' + warnings.length + '.png') });
      }
      await sleep(250); continue;
    }
    if (st.result) {
      if (!shotResult) { await shot('04-result'); shotResult = true; }
      await sleep(380);
      await page.click('#result'); await sleep(250); continue;
    }

    // PX 한 번, 휴가 한 번 써 보기
    if (!pxDone && cards > 6) {
      var pxOk = await page.evaluate(function () { return !document.getElementById('dock-px').classList.contains('off'); });
      if (pxOk) {
        await page.click('#dock-px'); await sleep(300);
        var buy = await page.$('#modal-box .item:not([disabled])');
        if (buy) { await buy.click(); await sleep(200); }
        await shot('06-px');
        await page.click('#modal-box [data-act="close"]'); await sleep(250);
        await page.click('#dock-bag'); await sleep(250);
        var it = await page.$('#modal-box .item');
        if (it) { await it.click(); await sleep(150); var use = await page.$('#modal-box [data-act="use"]'); if (use) await use.click(); await sleep(200); }
        await page.click('#modal-box [data-act="close"]'); await sleep(200);
        pxDone = true;
      }
    }
    if (!leaveTaken && cards > 12) {
      var lv = await page.evaluate(function () { return !document.getElementById('dock-leave').classList.contains('off'); });
      if (lv) {
        await page.click('#dock-leave'); await sleep(300);
        await shot('07-leave');
        var go = await page.$('#modal-box [data-act="go"]');
        if (go) { await go.click(); await sleep(300); leaveTaken = true; }
        else await page.click('#modal-box [data-act="close"]');
        continue;
      }
    }

    // 카드 끌어서 넘기기 (가끔은 버튼 두 번)
    var card = await page.$('#card');
    var cb = await card.boundingBox();
    var cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
    var dir = Math.random() < 0.5 ? -1 : 1;
    if (Math.random() < 0.25) {
      var side = dir < 0 ? 'l' : 'r';
      await page.click('.choice[data-side="' + side + '"]'); await sleep(120);
      await page.click('.choice[data-side="' + side + '"]');
    } else {
      await page.mouse.move(cx, cy); await page.mouse.down();
      await page.mouse.move(cx + dir * 70, cy + 5, { steps: 4 });
      if (!shotDrag) { await sleep(150); await shot('03b-drag'); shotDrag = true; }
      await page.mouse.move(cx + dir * 190, cy + 10, { steps: 4 });
      await page.mouse.up();
    }
    cards++;
    await sleep(420);
  }

  var ended = await page.evaluate(function () { return !document.getElementById('scr-end').hidden; });
  if (ended) {
    await sleep(900);
    await shot('08-ending');
    await page.click('#btn-end-album'); await sleep(300);
    await shot('09-album');
  }
  if (warnings.length) console.log('WARN:\n' + warnings.join('\n'));
  console.log(JSON.stringify({ cards: cards, minis: minis, leaveTaken: leaveTaken, pxDone: pxDone, ended: ended }));
  await browser.close();
  server.close();
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  if (!ended) { console.error('게임이 끝나지 않았다'); process.exit(1); }
  console.log('smoke ok');
})().catch(function (e) { console.error(e); server.close(); process.exit(1); });
