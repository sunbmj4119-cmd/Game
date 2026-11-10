#!/usr/bin/env node
/* 화면 점검: 여러 휴대폰 크기에서 화면·모달·최악의 카드 상태를 띄우고
 *  - 화면 밖으로 나간 요소 / 잘린 글자 / 카드가 너무 작아지는 경우
 *  - 캐릭터 그림이 자기 틀(viewBox) 밖으로 삐져나가 잘리는 경우
 *  - 버튼을 눌렀을 때 실제로 상태가 바뀌는지
 * 를 찾는다.  node tests/ui-audit.js [스크린샷 폴더] */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path');
var { chromium } = require('playwright');
var root = path.join(__dirname, '..');
var shots = process.argv[2] || null;
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
var server = http.createServer(function (req, res) {
  var p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  var f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 }
];

/* 페이지 안에서 실행: 잘림 검사 */
function lint(opts) {
  var vw = document.documentElement.clientWidth, vh = window.innerHeight, out = [];
  var SKIP = '.gauge-bar,.lv-bar,.urgent-bar,.confetti,.mg-stage,.flash';
  document.querySelectorAll('body *').forEach(function (el) {
    if (el.closest('svg') || el.closest('[hidden]') || el.closest(SKIP)) return;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    var name = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    var txt = (el.textContent || '').trim().slice(0, 24);
    if (r.right > vw + 1 || r.left < -1) out.push({ t: 'offscreen-x', el: name, txt: txt, l: Math.round(r.left), r: Math.round(r.right) });
    var inScroller = false;
    for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) { var oy = getComputedStyle(a).overflowY; if (oy === 'auto' || oy === 'scroll') { inScroller = true; break; } }
    if (opts.fixed && !inScroller && el.closest('#scr-game') && (r.bottom > vh + 1)) out.push({ t: 'below-screen', el: name, txt: txt, bottom: Math.round(r.bottom), vh: vh });
    if (cs.textOverflow === 'ellipsis') return;
    var clipX = /hidden|clip/.test(cs.overflowX), clipY = /hidden|clip/.test(cs.overflowY);
    if (clipX && el.scrollWidth - el.clientWidth > 2 && el.id !== 'app') out.push({ t: 'clipped-x', el: name, txt: txt, by: el.scrollWidth - el.clientWidth });
    if (clipY && el.scrollHeight - el.clientHeight > 2) out.push({ t: 'clipped-y', el: name, txt: txt, by: el.scrollHeight - el.clientHeight });
    // 글자가 버튼·칩 밖으로 넘침 (overflow: visible인데 내용이 더 넓음)
    if (!clipX && /^(button|span|b|em|small|p)$/.test(el.tagName.toLowerCase()) && el.scrollWidth - el.clientWidth > 3 && el.clientWidth > 0 && cs.display !== 'inline') {
      out.push({ t: 'text-spill', el: name, txt: txt, by: el.scrollWidth - el.clientWidth });
    }
  });
  // 결과 쪽지·모달이 화면 안에 들어오는지
  ['#modal-box', '#result .note'].forEach(function (sel) {
    var el = document.querySelector(sel); if (!el || el.closest('[hidden]')) return;
    var r = el.getBoundingClientRect();
    if (r.top < -1 || r.bottom > vh + 1) out.push({ t: 'box-off-screen', el: sel, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: vh });
  });
  return out;
}

/* 페이지 안에서 실행: 캐릭터 그림이 viewBox 밖으로 나가는지 */
function svgBounds() {
  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:232px;opacity:0;pointer-events:none';
  document.body.appendChild(host);
  var out = [];
  function check(label, svg) {
    host.innerHTML = svg;
    var s = host.querySelector('svg'); if (!s) return;
    s.style.width = '200px'; s.style.height = '232px'; s.style.animation = 'none';
    s.querySelectorAll('*').forEach(function (n) { n.style.animation = 'none'; });
    var box = s.getBoundingClientRect(), sx = box.width / 200, sy = box.height / 232;
    var over = { l: 0, t: 0, r: 0, b: 0 };
    s.querySelectorAll('path,circle,ellipse,rect,text,polygon').forEach(function (n) {
      if (n.closest('defs,clipPath,pattern,[clip-path]')) return;      // 클립으로 잘라 둔 장식은 제외
      var r = n.getBoundingClientRect();
      if (!r.width && !r.height) return;
      over.l = Math.max(over.l, (box.left - r.left) / sx);
      over.t = Math.max(over.t, (box.top - r.top) / sy);
      over.r = Math.max(over.r, (r.right - box.right) / sx);
      over.b = Math.max(over.b, (r.bottom - box.bottom) / sy);
    });
    // 아래쪽은 상반신 구도라 몸통이 조금 잘리는 게 의도 (12까지 허용)
    var bad = (over.l > 3 || over.t > 3 || over.r > 3 || over.b > 12);
    if (bad) out.push({ who: label, over: { l: Math.round(over.l), t: Math.round(over.t), r: Math.round(over.r), b: Math.round(over.b) } });
  }
  Object.keys(JY.CHARS).forEach(function (w) { check(w, JY.UI.charSVG(w)); });
  // 꾸미기 전부 하나씩 입혀 보기 (모자·소품·옷)
  var m = JY.Meta.get(), eq0 = JSON.stringify(m.cos.eq), own0 = JSON.stringify(m.cos.owned);
  JY.COSMETIC_ORDER.forEach(function (id) {
    var c = JY.COSMETICS[id];
    m.cos.owned[id] = true; m.cos.eq = { hat: null, face: null, fx: null, body: null, prop: null }; m.cos.eq[c.slot] = id;
    check('me+' + id, JY.UI.charSVG('me', { rank: 4 }));
  });
  m.cos.eq = JSON.parse(eq0); m.cos.owned = JSON.parse(own0);
  host.remove();
  return out;
}

(async function () {
  await new Promise(function (r) { server.listen(0, r); });
  var url = 'http://127.0.0.1:' + server.address().port + '/';
  var browser = await chromium.launch();
  var report = { layout: {}, svg: null, cardSize: {}, functional: [], errors: [] };

  for (var vi = 0; vi < VIEWPORTS.length; vi++) {
    var V = VIEWPORTS[vi];
    var ctx = await browser.newContext({ viewport: { width: V.width, height: V.height }, deviceScaleFactor: shots && (V.name === '360x640' || V.name === '390x844') ? 2 : 1, isMobile: V.width < 700, hasTouch: true });
    var page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', function (e) { report.errors.push(V.name + ' ' + e.message); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { r.abort(); });
    await page.goto(url);
    await sleep(300);
    var issues = [];
    async function snap(label, fixed) {
      await sleep(120);
      var r = await page.evaluate(lint, { fixed: !!fixed });
      r.forEach(function (x) { x.where = label; });
      issues = issues.concat(r);
      if (shots && (V.name === '360x640')) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, V.name + '-' + label + '.png') }); }
    }
    async function T(fn, arg) { await page.evaluate(function (a) { var t = JY.UI._t; return (new Function('t', 'a', 'return (' + a.fn + ')(t, a.arg)'))(t, a); }, { fn: fn.toString(), arg: arg }); await sleep(150); }

    // 준비: 메타 꽉 채우기 (꾸미기·보급품·레벨)
    await page.evaluate(function () {
      var m = JY.Meta.get();
      m.gems = 999; m.jjam = 2000; m.jjamTotal = 1600; m.freeBoxes = 2; m.discharges = 3; m.tutorialDone = true;
      JY.PREMIUM_ORDER.forEach(function (id) { m.stash[id] = 2; });
      JY.COSMETIC_ORDER.forEach(function (id) { m.cos.owned[id] = true; });
      m.cos.eq = { hat: 'gold', face: 'sunglasses', fx: 'sparkle', body: 'dress', prop: 'shovel' };
      m.records = [];
      for (var i = 0; i < 10; i++) m.records.push({ score: 20000 - i * 1500, title: JY.scoreTitle(20000 - i * 1500), name: '아주긴이름병' + i, ending: JY.ENDING_ORDER[i], good: true, mos: 'clerk', unit: JY.UNIT_ORDER[i % 5], days: 547, daily: null, date: '2026-11-09', cos: '🪖😎✨🎖️⛏️' });
      JY.Meta.save();
      document.getElementById('modal').hidden = true;
    });

    // 타이틀 · 설정
    await T(function (t) { t.closeModal(); t.renderTitle(); });
    await snap('title', true);
    await T(function (t) { t.renderSetup(); });
    await snap('setup');

    // 게임: 최악의 카드 (긴 글 + 특수 대답 + 상태칩 4개 + 돌발 막대)
    await page.evaluate(function () {
      var s = JY.Game.newState({ start: '2026-03-02', name: '아주긴이름', mos: 'clerk', trait: 'glass', up: { watch: 3 }, insurance: true });
      s.rank = 3; s.day = 300; s.queue = []; s.insight = 9; s.luck = 9; s.insurance = 1;
      s.conds = [{ id: 'captainOff', left: 3 }, { id: 'inspect', left: 2 }];
      s.items = { chocopie: 9, buldak: 9, mandu: 9, banana: 9, tuna: 9, hot6: 9, polish: 9, cream: 9, matdasi: 9, earplug: 9, comic: 9, homefood: 9 };
      s.flags.hoobae = true; s.vars.cat = 2; s.money = 1234567;
      s.current = 'hol_birthday'; s.cv = null;
      JY.UI._t.setState(s);
      JY.UI._t.showScreen('scr-game');
    });
    await T(function (t) { t.renderHUD(); t.renderCard(false); });
    await snap('game-special', true);
    await page.evaluate(function () { var s = JY.UI._state(); s.current = 'v5e_captain_kim'; s.cv = null; JY.UI._t.renderCard(false); });
    await snap('game-legend', true);
    await page.evaluate(function () { var s = JY.UI._state(); s.current = 'hol_birthday'; s.cv = null; JY.UI._t.renderCard(false); });
    await T(function (t) { t.startCoach(); });
    await snap('coach-1', true);
    await page.evaluate(function () { document.querySelector('#coach-box [data-c="next"]').click(); document.querySelector('#coach-box [data-c="next"]').click(); document.querySelector('#coach-box [data-c="next"]').click(); });
    await snap('coach-4', true);
    await T(function (t) { t.endCoach(); });
    var cs = await page.evaluate(function () { var c = document.getElementById('card').getBoundingClientRect(), w = document.querySelector('#card .char-wrap').getBoundingClientRect(); return { card: [Math.round(c.width), Math.round(c.height)], char: Math.round(w.height), x: !document.getElementById('choice-x-btn').hidden }; });
    report.cardSize[V.name] = cs;
    await page.evaluate(function () { var s = JY.UI._state(); s.current = 'em_snake'; s.cv = null; });
    await T(function (t) { t.renderCard(false); });
    await snap('game-alert', true);
    await page.evaluate(function () { document.getElementById('alert').click(); });
    await sleep(250);
    await snap('game-urgent', true);
    var cs2 = await page.evaluate(function () { var c = document.getElementById('card').getBoundingClientRect(); return [Math.round(c.width), Math.round(c.height)]; });
    report.cardSize[V.name].urgent = cs2;
    await T(function (t) { t.stopUrgent(); });
    // 결과 쪽지: 이벤트 잔뜩
    await T(function (t) {
      t.showResult({ say: '김말년이 누운 채로 짜장이냐 짬뽕이냐를 물었다. 생활관이 반으로 갈렸고 토론은 새벽 두 시까지 이어졌다. 결국 짬짜면으로 합의했다.', deltas: { hp: -12, mt: 15, tr: -8, bd: 11 },
        events: [{ type: 'cond', id: 'gifts', text: '' }, { type: 'pay', n: 1200000, save: 550000 }, { type: 'promo', text: '병장 진급! 휴가 +10일' }, { type: 'season', text: '겨울이 왔다. 하늘에서 쓰레기(눈)가 내린다.' }, { type: 'leave', text: '포상휴가 +3일' },
          { type: 'item', id: 'chocopie', n: 2 }, { type: 'money', n: -30000 }, { type: 'cond', text: '🤧 독감 유행 시작! (카드마다 체력 -2)' }, { type: 'aff', who: 'dumb', n: 6 }, { type: 'bff', who: 'dumb', text: '동기 사랑 — 전우애 증가 1.15배' }, { type: 'insurance', text: '🛡️ 전역 보험 발동! "…꿈이었다!" 멘탈이(가) 50으로 돌아왔다.' }] }, function () {});
    });
    await snap('result-many', true);
    await page.evaluate(function () { document.getElementById('result').hidden = true; });

    // 모달들
    var modals = [
      ['bag', function (t) { t.openBag(); }], ['bag-premium', function (t) { t.openBag('premium'); }], ['px', function (t) { var s = JY.UI._state(); s.pxDay = 0; t.openPX(); }],
      ['mates', function (t) { t.openMates(); var b = document.querySelector('[data-giftto="dumb"]'); if (b) b.click(); }],
      ['leave', function (t) { var s = JY.UI._state(); s.leave = 12; s.lastLeaveEnd = -99; s.conds = []; t.openLeave(); }], ['menu', function (t) { t.openMenu(); }], ['help', function (t) { t.openHelp(); }],
      ['promo', function (t) { t.showPromo({ rank: 1, leave: 4 }, function () {}); }],
      ['levelup', function (t) { t.showLevelUp([{ lv: 10, gem: 70, box: 1 }], ['beanie', 'chefhat', 'jogyohat', 'pinkcamo']); }],
      ['daily', function (t) { t.openDaily(); }]
    ];
    for (var mi = 0; mi < modals.length; mi++) {
      await T(modals[mi][1]);
      await snap('modal-' + modals[mi][0], true);
      await T(function (t) { var m = document.getElementById('modal'); m.hidden = true; document.getElementById('modal-box').innerHTML = ''; });
    }
    // 화면들
    var screens = [
      ['barracks-face', function (t) { t.renderBarracks('face'); }], ['barracks-wardrobe', function (t) { t.renderBarracks('wardrobe'); }],
      ['barracks-gear', function (t) { t.renderBarracks('gear'); }], ['barracks-mission', function (t) { t.renderBarracks('mission'); }],
      ['shop-items', function (t) { t.renderShop('items'); }], ['shop-cos', function (t) { t.renderShop('cos'); }], ['shop-box', function (t) { t.renderShop('box'); }],
      ['album-endings', function (t) { t.renderAlbum('endings'); }], ['album-scenes', function (t) { t.renderAlbum('scenes'); }], ['album-medals', function (t) { t.renderAlbum('medals'); }],
      ['rank-mine', function (t) { t.renderRank('mine'); }]
    ];
    for (var si = 0; si < screens.length; si++) { await T(screens[si][1]); await snap(screens[si][0]); }
    // 엔딩 화면
    await page.evaluate(function () {
      var s = JY.Game.newState({ start: '2026-03-02', name: '아주긴이름', mos: 'clerk', trait: 'glass' });
      s.rank = 4; s.day = s.total; s.flags.catAdopt = s.flags.gfStay = s.flags.special = s.flags.sharp = s.flags.malchul = true;
      s.over = { id: 'cat', list: ['cat', 'gf', 'elite', 'model', 'malchul', 'normal'], good: true, day: s.total }; s.over.score = JY.Game.score(s);
      JY.UI._t.setState(s); JY.UI._t.showEnding();
      document.getElementById('modal').hidden = true;
    });
    await sleep(1000); // 도장 애니메이션이 끝난 뒤 잰다
    await snap('ending');
    await page.evaluate(function () { document.getElementById('score-panel').scrollIntoView(); });
    await sleep(300);
    await snap('ending-score');
    // 미니게임 화면
    for (var mg of ['dressup', 'memory']) {
      await page.evaluate(function (id) { JY.Mini.start(id, { stats: { hp: 50, mt: 50 }, mos: 'clerk', face: function (w) { return JY.UI.charSVG(w); } }, function () {}); }, mg);
      await sleep(2300);
      await snap('mini-' + mg, true);
      await page.evaluate(function () { document.getElementById('mini').hidden = true; });
    }
    if (vi === 0) report.svg = await page.evaluate(svgBounds);
    report.layout[V.name] = issues;
    await ctx.close();
  }

  /* 버튼을 눌렀을 때 실제로 바뀌는지 (390x844, 실제 탭) */
  var ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  var p = await ctx2.newPage(); p.setDefaultTimeout(5000);
  p.on('pageerror', function (e) { report.errors.push('func ' + e.message); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { r.abort(); });
  await p.goto(url); await sleep(300);
  function F(name, okv, detail) { report.functional.push({ name: name, ok: !!okv, detail: detail }); }
  async function tapSel(sel) { await p.click(sel); await sleep(250); }
  await p.evaluate(function () {
    var m = JY.Meta.get(); m.gems = 500; m.jjam = 500; JY.PREMIUM_ORDER.forEach(function (id) { m.stash[id] = 1; }); JY.Meta.save();
    document.getElementById('modal').hidden = true;
    var s = JY.Game.newState({ start: '2026-03-02', name: '점검병', mos: 'clerk' });
    s.rank = 2; s.day = 120; s.queue = []; s.money = 200000; s.pxDay = 0; s.leave = 9; s.lastLeaveEnd = -99;
    s.items = { mandu: 2, chocopie: 2 }; s.current = 'hol_birthday'; s.cv = null; s.promo = [0, 35, 60, 9999, 9999];
    JY.Game.STATS.forEach(function (k) { s.stats[k] = 50; });
    JY.UI._t.setState(s); JY.UI._t.showScreen('scr-game'); JY.UI._t.renderHUD(); JY.UI._t.renderCard(false);
  });
  await sleep(300);
  var st = function () { return p.evaluate(function () { var s = JY.UI._state(); return { items: Object.assign({}, s.items), stats: Object.assign({}, s.stats), money: s.money, leave: s.leave, insight: s.insight, aff: Object.assign({}, s.aff), cur: s.current, day: s.day, specials: s.specials, gifts: (s.conds || []).filter(function (c) { return c.id === 'gifts'; }).length }; }); };
  var a = await st();
  // 가방 → 만두 사용
  await tapSel('#dock-bag'); await tapSel('#modal-box .item[data-id="mandu"]'); await tapSel('#modal-box [data-act="use"]');
  var b = await st();
  F('가방: 만두 사용', b.items.mandu === a.items.mandu - 1 && b.stats.mt > a.stats.mt && b.stats.hp > a.stats.hp, { before: a.items.mandu, after: b.items.mandu, mt: [a.stats.mt, b.stats.mt] });
  var hudV = await p.evaluate(function () { return document.querySelector('.stat[data-k="mt"]').style.getPropertyValue('--v'); });
  F('HUD 멘탈 게이지 갱신', +hudV === b.stats.mt, hudV);
  // 특급 보급품: 포상휴가증
  await tapSel('#modal-box [data-tab="premium"]'); await tapSel('#modal-box .item[data-id="leave3"]'); await tapSel('#modal-box [data-act="usep"]');
  var c = await st();
  F('특급: 포상휴가증 +3', c.leave === b.leave + 3, [b.leave, c.leave]);
  var badge = await p.textContent('#leave-badge');
  F('휴가 배지 갱신', badge === c.leave + '일', badge);
  await tapSel('#modal-box .item[data-id="insight"]'); await tapSel('#modal-box [data-act="usep"]');
  var d = await st();
  F('특급: 투시경 사용', d.insight === c.insight + 12, [c.insight, d.insight]);
  await tapSel('#modal-box [data-act="close"]');
  // 투시경 → 카드 끌면 ▲▼ 표시
  var cb = await (await p.$('#card')).boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.mouse.down(); await p.mouse.move(cb.x + cb.width / 2 - 50, cb.y + cb.height / 2, { steps: 4 });
  var arrows = await p.evaluate(function () { return Array.prototype.map.call(document.querySelectorAll('.stat .dot.dir'), function (x) { return x.textContent; }).join(''); });
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 3 }); await p.mouse.up(); await sleep(300);
  F('투시경: 미리보기 화살표', /[▲▼]/.test(arrows), arrows);
  // PX 구매
  await tapSel('#dock-px');
  var w0 = await p.textContent('#modal-box .wallet span');
  await tapSel('#modal-box .item[data-id="tuna"]');
  var w1 = await p.textContent('#modal-box .wallet span');
  var e = await st();
  F('PX: 참치캔 구매', e.items.tuna === 1 && e.money < d.money && w0 !== w1, { money: [d.money, e.money], wallet: [w0, w1] });
  await tapSel('#modal-box [data-act="close"]');
  F('PX 나가면 쿨다운', await p.evaluate(function () { return document.getElementById('dock-px').classList.contains('off'); }));
  // 동료: 박덤벙에게 초코파이
  await tapSel('#dock-mates'); await tapSel('#modal-box [data-giftto="dumb"]'); await tapSel('#modal-box [data-gift="chocopie"]');
  var f = await st();
  F('동료: 초코파이 선물', f.items.chocopie === e.items.chocopie - 1 && f.aff.dumb >= e.aff.dumb + 18, { aff: [e.aff.dumb, f.aff.dumb] });
  await tapSel('#modal-box [data-act="close"]');
  // 특수 대답 버튼 (박덤벙 카드 + 초코파이)
  var xVisible = await p.evaluate(function () { return !document.getElementById('choice-x-btn').hidden; });
  F('특수 대답 버튼 표시', xVisible);
  if (xVisible) {
    await tapSel('#choice-x-btn'); await tapSel('#choice-x-btn'); await sleep(400);
    var g = await st();
    // 같은 턴에 '위문품 대량 도착'(초코파이 +2)이 시작될 수 있다
    var chocoWant = f.items.chocopie - 1 + (g.gifts > f.gifts ? 2 : 0);
    F('특수 대답: 초코파이 소모 + 카드 진행', g.specials === f.specials + 1 && g.items.chocopie === chocoWant && g.cur !== 'hol_birthday', { choco: [f.items.chocopie, g.items.chocopie, chocoWant], specials: [f.specials, g.specials], cur: g.cur });
    if (await p.evaluate(function () { return !document.getElementById('result').hidden; })) { await sleep(400); await tapSel('#result'); }
  }
  // 돌발 상황: 경보 → (경보 중엔 선택 안 됨) → 탭하면 시간 시작 → 시간 초과 결과
  await p.evaluate(function () { var s = JY.UI._state(); s.current = 'em_snake'; s.cv = null; JY.UI._t.renderCard(false); });
  var al = await p.evaluate(function () { return { alert: !document.getElementById('alert').hidden, bar: !document.getElementById('urgent-bar').hidden, text: document.getElementById('alert').textContent }; });
  F('돌발: 경보 화면 먼저', al.alert && !al.bar && /돌발 상황/.test(al.text) && /놓치면/.test(al.text), al);
  await p.evaluate(function () { var b = document.querySelector('.choice[data-side="l"]'); b.click(); b.click(); });
  var e1 = await st();
  F('돌발: 경보 중엔 선택 안 됨', e1.cur === 'em_snake');
  await tapSel('#alert');
  var al2 = await p.evaluate(function () { return { alert: !document.getElementById('alert').hidden, bar: !document.getElementById('urgent-bar').hidden, hint: document.getElementById('timeout-hint').textContent, hintOn: !document.getElementById('timeout-hint').hidden }; });
  F('돌발: 탭하면 제한 시간 시작 + 놓치면 안내', !al2.alert && al2.bar && al2.hintOn && /못 고르면/.test(al2.hint), al2);
  var urgSec = await p.evaluate(function () { return JY.Game.currentCard(JY.UI._state()).urgent; });
  await sleep(urgSec * 1000 + 700);
  var e2 = await p.evaluate(function () { var r = document.getElementById('result'); return { result: !r.hidden, head: (r.querySelector('.note-head') || {}).textContent || '', cur: JY.UI._state().current }; });
  F('돌발: 시간 초과 결과 표시', e2.result && /시간 초과/.test(e2.head) && e2.cur !== 'em_snake', e2);
  if (e2.result) { await sleep(400); await tapSel('#result'); }
  // 도크: 훈련소에선 동료·PX·휴가 버튼이 안 보인다
  var dk = await p.evaluate(function () {
    var keep = JY.UI._state(), t = JY.Game.newState({ start: '2026-03-02' });
    JY.UI._t.setState(t); JY.UI._t.renderHUD();
    var r = ['dock-mates', 'dock-px', 'dock-leave', 'dock-bag'].map(function (id) { return document.getElementById(id).hidden; });
    JY.UI._t.setState(keep); JY.UI._t.renderHUD();
    return r;
  });
  F('도크: 훈련소에선 쓸 수 없는 버튼 숨김', dk[0] && dk[1] && dk[2] && !dk[3], dk);
  // 휴가 출발
  await p.evaluate(function () { var s = JY.UI._state(); s.lastLeaveEnd = -99; s.conds = []; s.blockUntil = 0; JY.UI._t.renderHUD(); });
  var h0 = await st();
  await tapSel('#dock-leave'); await tapSel('#modal-box [data-act="go"]');
  var h1 = await st();
  F('휴가 출발: 날짜·휴가일 변화', h1.day > h0.day && h1.leave < h0.leave, { day: [h0.day, h1.day], leave: [h0.leave, h1.leave] });
  if (await p.evaluate(function () { return !document.getElementById('modal').hidden; })) await tapSel('#modal-box .btn-primary');
  if (await p.evaluate(function () { return !document.getElementById('modal').hidden; })) await tapSel('#modal-box .btn-primary');
  // 상점: 꾸미기 사면 내 캐릭터에 반영
  await p.evaluate(function () { JY.UI._t.renderShop('cos'); });
  await sleep(200);
  var svg0 = await p.innerHTML('#shop-me');
  await tapSel('[data-cos="gold"]');
  var svg1 = await p.innerHTML('#shop-me');
  F('상점: 황금 헬멧 구매 → 캐릭터에 표시', svg1.indexOf('#f2c335') >= 0 && svg0 !== svg1);
  // 막사: 외모 바꾸기, 강화
  await p.evaluate(function () { JY.UI._t.renderBarracks('face'); });
  await sleep(200);
  var f0 = await p.innerHTML('#me-big');
  await tapSel('[data-face="mouth"][data-d="1"]');
  var f1 = await p.innerHTML('#me-big');
  F('막사: 입 모양 변경 반영', f0 !== f1);
  await tapSel('#barracks-tabs [data-tab="gear"]');
  var j0 = await p.evaluate(function () { return JY.Meta.get().jjam; });
  await tapSel('[data-up="wallet"]'); await sleep(900);
  var up = await p.evaluate(function () { return { lv: JY.Meta.upLevel('wallet'), jjam: JY.Meta.get().jjam }; });
  F('막사: 지갑 강화', up.lv === 1 && up.jjam === j0 - 80, up);
  var txt = await p.textContent('.gear-row:nth-child(4) b');
  F('강화 수치 화면 반영', /\+1/.test(txt), txt);

  await ctx2.close();
  await browser.close(); server.close();

  // 보고
  var total = 0;
  Object.keys(report.layout).forEach(function (vn) {
    var list = report.layout[vn];
    var uniq = {};
    list.forEach(function (x) { var k = x.t + ' ' + x.el + ' @' + x.where; if (!uniq[k]) uniq[k] = x; });
    var keys = Object.keys(uniq);
    total += keys.length;
    console.log('\n[' + vn + '] 레이아웃 문제 ' + keys.length + '개');
    keys.slice(0, 40).forEach(function (k) { var x = uniq[k]; console.log('  - ' + k + ' ' + JSON.stringify(Object.assign({}, x, { where: undefined, el: undefined, t: undefined }))); });
  });
  console.log('\n카드 크기:', JSON.stringify(report.cardSize));
  console.log('\n캐릭터 그림이 틀 밖으로:', report.svg.length ? '' : '없음');
  report.svg.forEach(function (x) { console.log('  - ' + x.who + ' ' + JSON.stringify(x.over)); });
  console.log('\n기능:');
  report.functional.forEach(function (x) { console.log('  ' + (x.ok ? '✓' : '✗') + ' ' + x.name + (x.ok ? '' : ' ' + JSON.stringify(x.detail))); });
  if (report.errors.length) console.log('\n에러:\n  ' + report.errors.join('\n  '));
  var bad = total + report.svg.length + report.functional.filter(function (x) { return !x.ok; }).length + report.errors.length;
  console.log('\n문제 합계: ' + bad);
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); server.close(); process.exit(1); });
