#!/usr/bin/env node
/* 제설각 브라우저 점검 (v10): 전입 → 작전(시계·지시서) → 장비 요청 → 빙판 → 경례 → 보고 → 검열 결과 → 생활관(PX·전화·체력단련·보급)
 * → 브리핑 → 신병 → 이어하기 → 진급 심사 → 진급 신고 → 상병 조원 배치 → 빠진 차 → 병장 2배속 → 전역 → 쉬는 동안 → v8 저장 이전
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

  async function talkThrough(name) { for (var i = 0; i < 30 && await vis('#talk'); i++) { if (await vis('#talk-name')) { await page.fill('#talk-input', name || '홍길동'); await page.click('#talk-ok'); } else await page.click('.talk-box'); await sleep(130); } }
  function clearZone(id, upto) { return page.evaluate(function (a) { var w = __SNOW.view().world(), Z = JY.SnowSim.zoneById(a[0]), zi = JY.SnowSim.zoneIndex(a[0]), bag = { cap: 1e9, load: 0, val: 0 }; for (var y = Z.y; y < Z.y + Z.h; y += 10) for (var x = Z.x; x < Z.x + Z.w; x += 10) { if (a[1] && w.zoneClear[zi] / w.zoneTotal[zi] >= a[1]) return; JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag); } }, [id, upto || 0]); }
  function quiet() { return page.evaluate(function () { var w = __SNOW.view().world(); w.events = []; w.deer = []; w.player.stun = 0; if (w.act) { w.act.off = []; w.act.offPlan = []; w.act.nagT = 999; } }); }
  function goTo(x, y, yaw, pitch) { return page.evaluate(function (a) { var V = __SNOW.view(), w = V.world(); V._teleport(a[0], a[1]); w.player.dir = { x: Math.sin(a[2]), y: Math.cos(a[2]) }; if (V._setLook) V._setLook(a[2], a[3] === undefined ? -0.1 : a[3]); }, [x, y, yaw || 0, pitch]); }
  async function toHub() { for (var i = 0; i < 12; i++) { await talkThrough(); if (await vis('#modal')) { await page.click('#modal [data-m]'); await sleep(350); continue; } if (await vis('#hub')) return true; await sleep(300); } return vis('#hub'); }

  await page.goto(url);
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('jeseol-v1', '{"bank":999}'); });
  await page.reload();
  await sleep(600);
  ok('아주 예전 저장(v1)은 지워지고 처음부터', await page.evaluate(function () { return localStorage.getItem('jeseol-v1') === null && __SNOW.save().bank === 0 && __SNOW.save().v === 10; }));
  await sleep(900);
  await closeModal();
  ok('타이틀 표시 (처음엔 전입 신고)', await vis('#title .logo') && /전입 신고/.test(await page.evaluate(function () { return document.getElementById('t-start').textContent; })) && !(await vis('#hub')));
  await shot('01-title');

  // ── 프롤로그: 행보관이 이름을 묻는다 ──
  await page.click('#t-start');
  var talk = await waitFor(function () { return !document.getElementById('talk').hidden; }, 4000);
  ok('처음 시작하면 스토리 장면 (전입 첫날)', talk && /전입 첫날/.test(await page.evaluate(function () { return document.getElementById('talk-title').textContent; })));
  await shot('01b-prologue');
  for (var tk = 0; tk < 6 && !(await vis('#talk-name')); tk++) { await page.click('.talk-box'); await sleep(150); }
  ok('이름을 묻는다', await vis('#talk-name'));
  await page.fill('#talk-input', '홍길동'); await page.click('#talk-ok');
  for (tk = 0; tk < 12 && !(await page.evaluate(function () { return document.getElementById('talk').hidden; })); tk++) { await page.click('.talk-box'); await sleep(150); }
  var pro = await page.evaluate(function () { var s = __SNOW.save(); return { name: s.look.name, done: !!s.story.prologue, mode: __SNOW.view().mode() }; });
  ok('이름 저장 + 장면 끝나면 작전 시작', pro.name === '홍길동' && pro.done && pro.mode === 'play', pro);

  // ── 작전 화면: 시계 · 작업 지시서 · 행동 버튼 (보급 버튼·눈덩이 없음) ──
  await sleep(700);
  ok('작전 HUD: 시계 05:3x + 작업 지시서', /^05:3\d$/.test(await page.evaluate(function () { return document.getElementById('h-day').textContent; })) && await vis('#h-op') && /생활관 앞 길/.test(await page.evaluate(function () { return document.getElementById('op-list').textContent; })));
  ok('작전 중엔 보급 버튼·눈덩이 버튼이 없다 (집중)', !(await vis('#h-shop')) && !(await page.$('#ball-btn')) && !(await page.$('#h-heat')));
  ok('지시서에 처음 할 일 안내', await vis('#op-tip') && /퍼 담기/.test(await page.evaluate(function () { return document.getElementById('op-tip').textContent; })));
  ok('첫 조작 안내', await vis('#hint'));
  var is3 = await page.evaluate(function () { return !!__SNOW.view().is3D; });
  var cam0 = await page.evaluate(function () { var V = __SNOW.view(); return V.camMode ? V.camMode() : 'none'; });
  ok('처음 시점은 1인칭 (조준점 + 행동 버튼)', !is3 || (cam0 === 'fp' && !(await page.evaluate(function () { return document.getElementById('xhair').hidden; })) && await vis('#act-btn')), cam0);
  await shot('02-start');
  var p0 = await W();
  await touchDrag(size[0] * 0.2, size[1] * 0.7, size[0] * 0.2 + (is3 ? 0 : 40), size[1] * 0.7 - (is3 ? 50 : -10), 1500);
  var p1 = await W();
  ok('끌면 걷는다', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 30, [p0, p1]);
  ok('치우면 돈이 아니라 짐이 된다', p1.load > 0 && p1.clear > p0.clear && p1.bank - p0.bank <= 20, [p0, p1]);
  await page.evaluate(function () { var w = __SNOW.view().world(); if (w.player.load < 21) { w.player.load = 21; w.player.val = 21; } });
  ok('짐 20 → 다음 할 일 (집하장)', await waitFor(function () { return /집하장/.test(document.getElementById('op-tip').textContent); }, 3000));
  ok('짐을 지면 안내가 사라진다', !(await vis('#hint')));
  if (is3) {
    var lk0 = await page.evaluate(function () { return __SNOW.view().look(); }), q0 = await W();
    await page.mouse.move(size[0] * 0.75, size[1] * 0.5); await page.mouse.down();
    await page.mouse.move(size[0] * 0.75 + 120, size[1] * 0.5 - 30, { steps: 5 }); await page.mouse.up();
    var lk1 = await page.evaluate(function () { return __SNOW.view().look(); }), q1 = await W();
    ok('오른쪽을 끌면 고개만 돌아간다', Math.abs(Math.atan2(lk1.x, lk1.y) - Math.atan2(lk0.x, lk0.y)) > 0.4 && lk1.pitch > lk0.pitch && Math.hypot(q1.x - q0.x, q1.y - q0.y) < 4, [lk0, lk1]);
    await page.evaluate(function () { __SNOW.view().toggleCam('near'); });
  }
  await page.evaluate(function () { __SNOW.view()._teleport(200, 160); });
  var k0 = (await W()).y;
  await page.keyboard.down('ArrowDown'); await sleep(700); await page.keyboard.up('ArrowDown');
  ok('방향키로도 걷는다', (await W()).y > k0 + 15);

  // ── 가득 차면 → 집하장에 붓기 ──
  await page.evaluate(function () { var w = __SNOW.view().world(); w.player.load = w.player.cap - 1; w.player.val = w.player.cap - 1; __SNOW.view()._teleport(250, 190); });
  await page.keyboard.down('ArrowRight'); await sleep(500); await page.keyboard.up('ArrowRight');
  var full = await waitFor(function () { return document.getElementById('h-carry').classList.contains('full'); }, 3000);
  ok('가득 차면 게이지에 "가득!"', full && /가득/.test(await page.evaluate(function () { return document.getElementById('h-load').textContent; })));
  await shot('03-full');
  var b0 = (await W()).bank;
  await page.evaluate(function () { var d = JY.SNOW.DUMP; __SNOW.view()._teleport(d.x + 40, d.y); });
  await page.keyboard.down('ArrowLeft'); await sleep(800); await page.keyboard.up('ArrowLeft');
  var dumped = await W();
  ok('집하장에 들어가면 붓고 초코파이', dumped.load === 0 && dumped.bank > b0, [b0, dumped]);
  var t2 = await waitFor(function () { return !document.getElementById('talk').hidden && /첫 초코파이/.test(document.getElementById('talk-title').textContent); }, 4000);
  var d2 = await page.evaluate(function () { return __SNOW.save().dia; });
  await talkThrough();
  ok('첫 초코파이 장면 → 상점 보상', t2 && await page.evaluate(function (d) { return __SNOW.save().dia > d && __SNOW.save().story.firstDump; }, d2));
  await page.evaluate(function () { var s = __SNOW.save(); JY.SNOW.STORY.forEach(function (c) { if (c.id !== 'firstOp') s.story[c.id] = true; }); });
  await shot('04-dump');

  // ── 행보관: 장비 요청 (작전 중 보급) · 경례 ──
  if (is3) await page.evaluate(function () { __SNOW.view().toggleCam('fp'); });
  await quiet();
  await page.evaluate(function () { __SNOW.save().bank = 400; var w = __SNOW.view().world(); w.haeng.x = 200; w.haeng.y = 228; w.haeng.hold = 60; });
  await goTo(200, 205, 0);
  await verbIs('/경례/');
  ok('행보관 앞: 위쪽 작은 버튼 "넉가래 요청"', await waitFor(function () { var b = document.getElementById('act2-btn'); return !b.hidden && /넉가래 요청/.test(b.textContent); }, 3000));
  await page.click('#act2-btn');
  ok('넉가래 요청 → 바로 지급 (적재 110)', await waitFor(function () { return __SNOW.save().tool === 1 && __SNOW.view().world().player.cap === 110; }, 3000) && await waitFor(function () { return /넉가래 보급/.test(document.getElementById('banner').textContent); }, 2000));
  await shot('05-tool');
  await page.evaluate(function () { var w = __SNOW.view().world(); w.haeng.x = 200; w.haeng.y = 228; w.haeng.hold = 60; });
  await goTo(200, 205, 0); await verbIs('/경례/');
  await page.click('#act-btn');
  await waitFor(function () { var s = document.getElementById('sub'); return !s.hidden && /충성/.test(s.textContent); }, 2500);
  var sal = await page.evaluate(function () { return { sub: document.getElementById('sub').textContent, buff: JY.SnowAct.state(__SNOW.view().world()).buffs.map(function (b) { return b.id; }) }; });
  ok('경례: "충성!" 자막 + 행보관 칭찬 버프', /충성/.test(sal.sub) && sal.buff.indexOf('praise') >= 0, sal);

  // ── 빙판 → 제설함 염화칼슘 → 뿌리기 ──
  await quiet();
  await page.evaluate(function () { var w = __SNOW.view().world(), p = w.parts.filter(function (q) { return q.ice; })[0], bag = { cap: 1e9, load: 0, val: 0 }; w.haeng.x = 700; w.haeng.y = 1100; w.haeng.hold = 60; for (var y = p.y; y < p.y + p.h; y += 10) for (var x = p.x; x < p.x + p.w; x += 10) JY.SnowSim.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag); });
  ok('그늘 구간이 얼면 지시서에 "빙판" 경고', await waitFor(function () { var e = document.getElementById('op-warn'); return !e.hidden && /빙판/.test(e.textContent); }, 3000));
  await page.evaluate(function () { var b = JY.SNOW.PROPS.filter(function (p) { return p.id === 'saltbox'; })[0]; __SNOW.view()._teleport(b.ux, b.uy + 12); var w = __SNOW.view().world(); w.player.dir = { x: 0, y: -1 }; if (__SNOW.view()._setLook) __SNOW.view()._setLook(Math.PI, 0); });
  await verbIs('/염화칼슘 들기/'); await page.click('#act-btn');
  ok('제설함에서 염화칼슘 포대를 든다', await waitFor(function () { return !document.getElementById('h-hand').hidden && /염화칼슘/.test(document.getElementById('h-hand').textContent); }, 3000));
  await page.evaluate(function () { var w = __SNOW.view().world(), p = w.parts.filter(function (q) { return q.ice; })[0]; __SNOW.view()._teleport(p.x + p.w / 2, p.y + p.h / 2); });
  await verbIs('/염화칼슘 뿌리기/');
  await shot('06-salt');
  await page.click('#act-btn');
  ok('빙판에 뿌리면 처리 완료 (경고 사라짐)', await waitFor(function () { var w = __SNOW.view().world(); return w.parts.filter(function (q) { return q.ice; })[0].salted && document.getElementById('h-hand').hidden && !/빙판/.test(document.getElementById('op-warn').textContent || ''); }, 3000));

  // ── 간부 순찰: 경례 알림 ──
  await quiet();
  await page.evaluate(function () { var w = __SNOW.view().world(), o = JY.SnowAct.spawnOfficer(w, 'cpt'); o.x = w.player.x + 12; o.y = w.player.y + 30; o.phase = 'stay'; o.stayT = 60; });
  await waitFor(function () { return !document.getElementById('salute').hidden; }, 3000);
  ok('간부가 오면 "경례!" 알림 + 버튼', await vis('#salute') && /경례/.test(await page.evaluate(function () { return document.getElementById('act-verb').textContent; })));
  await shot('07-officer');
  await page.click('#act-btn');
  await waitFor(function () { return document.getElementById('salute').hidden; }, 3000);
  ok('경례하면 알림이 사라지고 보상', !(await vis('#salute')) && await page.evaluate(function () { return (__SNOW.save().stats.salute || 0) >= 2; }));
  var ov1 = await overflow(); ok('작전 화면 넘침 없음', !ov1.length, ov1);

  // ── 지시서 완료 → 행보관에게 보고 → 검열 결과 ──
  await quiet();
  await clearZone('A', 0.87);
  ok('지시서 완료 → "작업 완료!"', await waitFor(function () { return /작업 완료|지시서 다 했다/.test(document.getElementById('banner').textContent); }, 4000));
  ok('다 하면 지시서 아래 "보고" 안내', await waitFor(function () { return /보고/.test(document.getElementById('op-warn').textContent); }, 3000));
  await page.evaluate(function () { var w = __SNOW.view().world(); w.haeng.hold = 0; w.haeng.x = 200; w.haeng.y = 228; });
  await goTo(200, 205, 0);
  await verbIs('/작업 완료 보고/');
  await page.click('#act-btn');
  var res = await waitFor(function () { return !!document.querySelector('#modal .m-res'); }, 5000);
  ok('보고하면 검열 결과 (★·지시서·보상·근무평정)', res && await page.evaluate(function () { var m = document.getElementById('modal'); return m.querySelectorAll('.res-stars i.on').length >= 1 && /생활관 앞 길/.test(m.textContent) && /근무평정/.test(m.textContent) && __SNOW.view().mode() === 'paused'; }));
  ok('일찍 보고하면 조기 퇴근 수당', /조기 퇴근/.test(await page.evaluate(function () { return document.getElementById('modal').textContent; })));
  await sleep(900); await shot('08-results');
  var ov2 = await overflow(); ok('검열 결과 넘침 없음', !ov2.length, ov2);
  var after = await page.evaluate(function () { var s = __SNOW.save(); return { day: s.day, merit: s.merit, ops: s.stats.ops }; });
  ok('작전 끝: 2일차, 근무평정 쌓임', after.day === 2 && after.merit >= 2 && after.ops === 1, after);
  await page.click('#modal [data-m]');
  ok('첫 작전 끝 장면', await waitFor(function () { return !document.getElementById('talk').hidden && /첫 작전 끝/.test(document.getElementById('talk-title').textContent); }, 3000));

  // ── 생활관 (저녁) ──
  ok('생활관으로', await toHub());
  var hub = await page.evaluate(function () { return { txt: document.getElementById('hub').textContent, start: document.getElementById('t-start').textContent }; });
  ok('생활관: 계급·역할·근무평정·내일 날씨 + 출동 버튼', /이병 홍길동/.test(hub.txt) && /막내/.test(hub.txt) && /근무평정/.test(hub.txt) && /내일 새벽/.test(hub.txt) && /출동/.test(hub.start), hub);
  await shot('09-hub');
  var ov3 = await overflow(); ok('생활관 넘침 없음', !ov3.length, ov3);
  // PX: 내일 작전 준비물
  await page.evaluate(function () { __SNOW.save().bank += 2000; });
  await page.click('[data-hub="px"]'); await sleep(300);
  ok('PX: 내일 작전 준비물', await vis('#modal .px-it') && /준비물/.test(await page.evaluate(function () { return document.getElementById('modal').textContent; })));
  await page.click('#modal [data-px="hotpack"]'); await sleep(150);
  ok('핫팩 챙김', await page.evaluate(function () { return !!__SNOW.save().prep.hotpack && !!document.querySelector('#modal .px-it.on'); }));
  await shot('10-px');
  await page.click('#modal [data-m="close"]'); await sleep(200);
  // 공중전화 (하루 한 번)
  await page.click('[data-hub="phone"]');
  ok('공중전화 → 통화 장면', await waitFor(function () { return !document.getElementById('talk').hidden && /공중전화/.test(document.getElementById('talk-title').textContent); }, 3000));
  await talkThrough();
  ok('전화는 하루 한 번', /통화했다/.test(await page.evaluate(function () { return document.getElementById('hub-phone-s').textContent; })));
  // 체력단련
  await page.click('[data-hub="pull"]');
  ok('체력단련 → 턱걸이 미니게임', await waitFor(function () { return !!document.getElementById('pull-go'); }, 3000));
  for (var tp = 0; tp < 26; tp++) await page.dispatchEvent('#pull-go', 'pointerdown');
  await waitFor(function () { return /개!/.test(document.getElementById('pull-n').textContent); }, 7000);
  ok('턱걸이 → 기록 + 내일 적재 버프', await page.evaluate(function () { var s = __SNOW.save(); return (s.stats.pullBest || 0) >= 10 && s.prep.power >= 10; }));
  await sleep(700); await page.click('#pull-go'); await sleep(200);
  // 보급·인원
  await page.click('[data-hub="shop"]'); await sleep(400);
  ok('보급 화면 (장비·인원·개인 장비·시설·구역…)', await vis('#shop .item') && /인원/.test(await page.evaluate(function () { return document.getElementById('s-tabs').textContent; })));
  await shot('11-shop');
  await page.click('#s-tabs [data-tab="crew"]'); await sleep(150);
  await page.click('#s-list .item.can .buy[data-kind="crew"]'); await sleep(150);
  var hire = await page.evaluate(function () { var s = __SNOW.save(); return { pend: s.pend.length, crew: s.crew.hoobae || 0, more: !!document.querySelector('#s-list .item.can .buy[data-kind="crew"]') }; });
  ok('후임 전입 요청 (다음 작전 아침, 이병 정원 1명)', hire.pend === 1 && hire.crew === 0 && !hire.more, hire);
  await page.click('#s-tabs [data-tab="zone"]'); await sleep(150);
  ok('구역 탭: 사는 게 아니라 ★으로 맡는다', !(await page.$('#s-list .item.can')) && /근무평정/.test(await page.evaluate(function () { return document.getElementById('s-list').textContent; })));
  var ov4 = await overflow(); ok('보급 화면 넘침 없음', !ov4.length, ov4);
  await page.click('#s-go'); await sleep(400);
  ok('보급 닫으면 생활관', await vis('#hub'));

  // ── 브리핑 → 두 번째 작전 (족구장 추가, 핫팩, 신병) ──
  await page.click('#t-start');
  ok('출동 → 제설 비상 브리핑 (지시하는 사람·지시서·특이사항)', await waitFor(function () { return !!document.querySelector('#modal .m-brief'); }, 3000) && await page.evaluate(function () { var m = document.getElementById('modal').textContent; return /05:30 제설 비상/.test(m) && /족구장/.test(m) && /생활관 앞 길/.test(m) && /핫팩/.test(m) && document.querySelectorAll('.brief-list li').length === 2; }));
  await shot('12-brief');
  var ov5 = await overflow(); ok('브리핑 넘침 없음', !ov5.length, ov5);
  await page.click('#modal [data-m="go"]'); await sleep(900); await talkThrough();
  ok('두 번째 작전: 지시서 2줄 + 핫팩 효과', await waitFor(function () { var w = __SNOW.view().world(); return w.op.tasks.length === 2 && JY.SnowAct.state(w).buffs.some(function (b) { return b.id === 'hotpack'; }); }, 3000));
  ok('다음 작전 아침 생활관 앞에 신병', await waitFor(function () { return __SNOW.view().world().recruits.length === 1; }, 3000));
  await quiet();
  await page.evaluate(function () { var w = __SNOW.view().world(), r = w.recruits[0], V = __SNOW.view(); w.haeng.x = 700; w.haeng.y = 1100; w.haeng.hold = 60; V._teleport(r.x, r.y - 18); w.player.dir = { x: 0, y: 1 }; if (V._setLook) V._setLook(0, -0.2); });
  await verbIs('/인솔하기/'); await page.click('#act-btn');
  ok('인솔하면 따라온다', await waitFor(function () { return __SNOW.view().world().recruits[0].state === 'follow'; }, 3000));
  await page.evaluate(function () { var w = __SNOW.view().world(), r = w.recruits[0]; __SNOW.view()._teleport(150, 200); r.x = 160; r.y = 190; });
  await verbIs('/여기 배치/'); await page.click('#act-btn');
  ok('생활관 앞 길에 배치 → 후임이 된다', await waitFor(function () { var w = __SNOW.view().world(); return w.crew.length === 1 && w.crew[0].post === 'A' && __SNOW.save().crew.hoobae === 1; }, 3000));
  await talkThrough();

  // ── 저장하고 다시 열어도 작전이 이어진다 ──
  var before = await page.evaluate(function () { var w = __SNOW.view().world(); w.time = 50; __SNOW.persist(); return { clear: w.clear, t: w.time, day: __SNOW.save().day }; });
  await page.reload(); await sleep(1300); await closeModal();
  ok('다시 열면 "작전 이어하기 (시각)"', /작전 이어하기 \(0[5-6]:\d\d\)/.test(await page.evaluate(function () { return document.getElementById('t-start').textContent; })));
  await page.click('#t-start'); await sleep(800); await talkThrough();
  var resumed = await page.evaluate(function () { var w = __SNOW.view().world(); return { clear: w.clear, t: w.time, day: __SNOW.save().day, brief: !!document.querySelector('#modal .m-brief') }; });
  ok('치운 곳·시계 그대로 (브리핑 없이 바로)', Math.abs(resumed.clear - before.clear) < 40 && Math.abs(resumed.t - before.t) < 3 && resumed.day === before.day && !resumed.brief, [before, resumed]);

  // ── 진급 심사 → 진급 신고 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.merit = 6; s.exam = true; s.snow = null; s.dayT = 0; s.op = null; s.crew = {}; s.pend = []; s.zones = { A: true, B: true }; s.story.exam1 = true; __SNOW.setSave(s); __SNOW.title(); });
  await sleep(500); await closeModal();
  ok('생활관: "다음 작전: 일병 진급 심사"', /진급 심사/.test(await page.evaluate(function () { return document.getElementById('hub').textContent + document.getElementById('t-start').textContent; })));
  await page.click('#t-start'); await waitFor(function () { return !!document.querySelector('#modal .m-brief'); }, 3000);
  ok('심사 브리핑: 기준 95%', /진급 심사: 기준 95%/.test(await page.evaluate(function () { return document.getElementById('modal').textContent; })));
  await page.click('#modal [data-m="go"]'); await sleep(900); await talkThrough();
  ok('지시서 제목 "진급 심사 지시서"', await waitFor(function () { return /진급 심사/.test(document.getElementById('op-title').textContent); }, 3000));
  await quiet();
  await clearZone('A', 0.96); await clearZone('B', 0.96);
  await page.evaluate(function () { var w = __SNOW.view().world(); w.parts.forEach(function (p) { if (p.icy) p.salted = true; }); w.haeng.hold = 0; w.haeng.x = 200; w.haeng.y = 228; });
  await goTo(200, 205, 0); await verbIs('/작업 완료 보고/'); await page.click('#act-btn');
  ok('심사 합격 결과', await waitFor(function () { var m = document.querySelector('#modal .m-res.exam'); return m && /합격/.test(m.textContent); }, 5000));
  await shot('13-exam');
  await page.click('#modal [data-m]');
  ok('진급 신고: 역할·편해지는 것·새로 할 수 있는 것', await waitFor(function () { var m = document.querySelector('#modal .promo'); return m && /일병 진급/.test(m.textContent) && m.querySelectorAll('.promo-list.easy li').length >= 1 && m.querySelectorAll('.promo-list.more li').length >= 1; }, 3000));
  await shot('14-promo');
  var ov6 = await overflow(); ok('진급 신고 넘침 없음', !ov6.length, ov6);
  await toHub();
  ok('생활관: 일병 + 2인용 넉가래 보급 가능', await page.evaluate(function () { var s = __SNOW.save(); return s.rank === 1 && /일병/.test(document.getElementById('hub').textContent) && JY.SnowSim.offers(s).tool.some(function (o) { return o.id === 'twin'; }) || s.tool < 2; }));

  // ── 상병: 브리핑에서 조원 배치 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.rank = 2; s.merit = 20; s.exam = false; s.crew = { hoobae: 2, donggi: 1 }; s.cpost = { hoobae: ['A', 'A'], donggi: ['A'] }; s.zones = { A: true, B: true, C: true, D: true, E: true }; s.snow = null; s.dayT = 0; s.op = null; s.pend = []; JY.SNOW.STORY.forEach(function (c) { s.story[c.id] = true; }); __SNOW.setSave(s); __SNOW.title(); });
  await sleep(400); await closeModal();
  await page.click('#t-start'); await waitFor(function () { return !!document.querySelector('#modal .crew-plan'); }, 3000);
  ok('상병 브리핑: 작업 분담 (조원 3명)', (await page.$$('#modal .cp')).length === 3 && /출근 차량/.test(await page.evaluate(function () { return document.getElementById('modal').textContent; })));
  await page.click('#modal .cp'); await sleep(150);
  ok('누르면 담당 구역이 바뀐다', await page.evaluate(function () { return __SNOW.save().cpost.hoobae[0] !== 'A'; }));
  await shot('15-brief-crew');
  await page.click('#modal [data-m="go"]'); await sleep(900); await talkThrough();
  ok('배치한 대로 일한다', await page.evaluate(function () { var w = __SNOW.view().world(), s = __SNOW.save(); return w.crew.filter(function (e) { return e.def.id === 'hoobae'; })[0].post === s.cpost.hoobae[0]; }));
  // 07:30 출근 차량이 빠진다 → 차 밀기
  await quiet();
  await page.evaluate(function () { var w = __SNOW.view().world(); w.crew.forEach(function (e) { e.x = 600; e.y = 200; e.speed = 0; }); JY.SnowSim.spawn(w, 'car'); });
  ok('진입로를 안 치우면 차가 빠진다 → 지시서 경고', await waitFor(function () { var w = __SNOW.view().world(); return w.car && w.car.stuck && /차 빠졌다/.test(document.getElementById('op-warn').textContent); }, 15000));
  await page.evaluate(function () { var w = __SNOW.view().world(), c = w.car; __SNOW.view()._teleport(c.x, c.y + 26); w.player.dir = { x: 0, y: -1 }; if (__SNOW.view()._setLook) __SNOW.view()._setLook(Math.PI, -0.1); });
  await verbIs('/차 밀기/');
  await shot('16-car');
  for (var pc = 0; pc < 4; pc++) { await page.click('#act-btn'); await sleep(150); }
  ok('네 번 밀면 빠져나온다', await waitFor(function () { var w = __SNOW.view().world(); return !w.car || !w.car.stuck; }, 3000) && await page.evaluate(function () { return __SNOW.save().stats.carPush === 1; }));

  // ── 병장: 말년 특권 2배속 · 후반 ──
  await page.evaluate(function () {
    var s = JY.SnowSim.newSave(); s.day = 24; s.bank = 223456; s.life = 1600000; s.tool = 6; s.rank = 3; s.merit = 60;
    s.crew = { hoobae: 4, donggi: 3, cook: 2, malnyeon: 2, admin: 2, reserve: 2, plow: 1 }; s.proc = { press: 5, sculpt: 2 }; s.relays = { B: true, C: true, D: true, E: true };
    s.perks = { eisen: 3, back: 3, matsta: 2, praise: 5, song: 2, gear: 2 }; JY.SnowSim.assignZones(s); s.seen = { tut: true, dis: true }; s.px = 160; s.py = 300;
    s.look.name = '홍길동'; JY.SNOW.STORY.forEach(function (c) { s.story[c.id] = true; });
    __SNOW.setSave(s); __SNOW.play(false);
  });
  await sleep(3000);
  ok('병장: 2배속 버튼 (말년 특권)', await vis('#h-speed'));
  var sp0 = await page.evaluate(function () { var w = __SNOW.view().world(), t0 = w.time; return new Promise(function (r) { setTimeout(function () { r(w.time - t0); }, 1500); }); });
  await page.click('#h-speed');
  var sp1 = await page.evaluate(function () { var w = __SNOW.view().world(), t0 = w.time; return new Promise(function (r) { setTimeout(function () { r(w.time - t0); }, 1500); }); });
  ok('2배속이면 작전 시간이 빨리 흐른다 (소프트웨어 렌더는 CPU 한계)', sp1 > sp0 * 1.15 && /×2/.test(await page.evaluate(function () { return document.getElementById('h-speed').textContent; })), [sp0, sp1]);
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
  ok('생활관: 전역 신고 버튼', await vis('#hub-dis') && !(await page.evaluate(function () { return document.getElementById('hub-dis').disabled; })));
  await page.click('#hub-dis'); await sleep(300);
  await shot('18-discharge');
  await page.click('#dis-go'); await page.click('#modal [data-m="yes"]'); await sleep(400);
  var dis = await page.evaluate(function () { var s = __SNOW.save(); return { medals: s.medals, day: s.day, tool: s.tool, rank: s.rank, merit: s.merit, relays: Object.keys(s.relays).length }; });
  ok('전역: 메달 받고 이병부터', dis.medals >= 4 && dis.day === 1 && dis.tool === 0 && dis.rank === 0 && dis.merit === 0 && dis.relays === 0, dis);
  await page.click('#modal [data-m]'); await sleep(500);
  ok('전역 후 타이틀', await vis('#title .logo'));
  await page.click('#t-reset'); await page.click('#modal [data-m="yes"]'); await sleep(300);
  ok('처음부터 다시: 전부 초기화', await page.evaluate(function () { var s = __SNOW.save(); return s.bank === 0 && s.medals === 0 && !Object.keys(s.story).length && s.day === 1; }));

  // ── 쉬는 동안 · v8 저장 이전 ──
  await page.evaluate(function () { var s = __SNOW.save(); s.crewRate = 50; s.last = Date.now() - 3600 * 1000; s.stats.ops = 3; localStorage.setItem('jeseol-v10', JSON.stringify(s)); });
  await page.reload(); await sleep(1200);
  ok('쉬는 동안 분대원이 번 초코파이', await page.evaluate(function () { return !document.getElementById('modal').hidden && /분대원들이/.test(document.getElementById('modal').textContent); }));
  await shot('19-offline');
  await page.evaluate(function () { localStorage.clear(); Storage.prototype._set = Storage.prototype.setItem; localStorage._set('jeseol-v8', JSON.stringify({ v: 5, life: 30000, bank: 777, day: 12, tool: 3, zones: { A: true, B: true, C: true, D: true, E: true, F: true }, crew: { hoobae: 2 }, story: { prologue: true }, look: { name: '옛날사람' } })); Storage.prototype.setItem = function () {}; });
  await page.reload(); await sleep(1200);
  var mig = await page.evaluate(function () { var s = __SNOW.save(); return { v: s.v, rank: s.rank, bank: s.bank, zones: Object.keys(s.zones).join(''), name: s.look.name, v8: !!localStorage.getItem('jeseol-v8') }; });
  ok('v8 저장을 옮겨 온다 (상병, 근무평정만큼 구역, v8 저장은 그대로)', mig.v === 10 && mig.rank === 2 && mig.bank === 777 && mig.zones === 'ABCDE' && mig.name === '옛날사람' && mig.v8, mig);

  await browser.close();
  checks.forEach(function (c) { console.log((c.ok ? '✓ ' : '✗ ') + c.name + (c.ok ? '' : ' ' + JSON.stringify(c.detail))); });
  if (errors.length) console.log('에러:\n  ' + errors.join('\n  '));
  var bad = checks.filter(function (c) { return !c.ok; }).length + errors.length;
  console.log(bad ? '문제 ' + bad + '개' : 'snow ok (' + checks.length + '개 통과)');
  process.exit(bad ? 1 : 0);
})();
