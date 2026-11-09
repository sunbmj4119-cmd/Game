#!/usr/bin/env node
/* 카드 검사기: 새 장면이 게임 규칙에 맞는지, 화면에서 잘리지 않을 길이인지, 한쪽만 공짜인 선택이 없는지 본다.
 *   node tools/lint-cards.js                 전체 요약 + 파일별 장면 수
 *   node tools/lint-cards.js js/data/cards5.js   그 파일이 추가한 장면만 자세히 (오류·경고 목록)
 * 오류가 있으면 종료 코드 1. 경고는 고치면 좋은 것. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var files = require('./data-files');
global.window = global;
var store = {};
global.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };

var only = process.argv[2] ? path.normalize(process.argv[2]).replace(/^\.\//, '') : null;
var LIMIT = { text: 62, textHard: 75, label: 14, labelHard: 18, say: 46, sayHard: 60, fx: 15, fxHard: 20 };

// 파일을 하나씩 읽으며 어떤 파일이 어떤 카드·장면을 더했는지 기록
var owner = {}, variantOwner = {}, perFile = {};
function groups() { var C = global.JY && global.JY.CARDS; if (!C) return []; return ['training', 'arrival', 'returns', 'pool', 'emergency'].map(function (g) { return C[g] || []; }); }
function snapshot() { var m = {}; groups().forEach(function (g) { g.forEach(function (c) { m[c.id] = { c: c, v: (c.variants || []).length }; }); }); return m; }
files().forEach(function (f) {
  var before = snapshot();
  vm.runInThisContext(fs.readFileSync(path.join(files.root, f), 'utf8'), { filename: f });
  var after = snapshot();
  perFile[f] = { cards: 0, scenes: 0 };
  for (var id in after) {
    if (!before[id]) { owner[id] = f; perFile[f].cards++; }
    else if (after[id].v > before[id].v) { (variantOwner[id] = variantOwner[id] || []).push({ f: f, from: before[id].v, to: after[id].v }); }
  }
});
var JY = global.JY, G = JY.Game;
var idx = {}; // 보정(BALANCE) 전 원래 수치로 검사한다
groups().forEach(function (g) { g.forEach(function (c) { idx[c.id] = c; }); });

var STATS = ['hp', 'mt', 'tr', 'bd'];
var BGS = ['barracks', 'night', 'training', 'field', 'gate', 'rain', 'mess', 'office', 'home', 'px', 'hospital', 'beach'];
var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
var MOS = ['infantry', 'cook', 'clerk', 'driver', 'medic'];
var REQ_KEYS = ['rank', 'season', 'mos', 'unit', 'trait', 'month', 'flag', 'noflag', 'vars', 'stat', 'aff', 'left', 'minDay', 'leaveGte'];
var OPT_KEYS = ['t', 'fx', 'say', 'roll', 'cases', 'need', 'aff', 'gem', 'leave', 'money', 'flag', 'unflag', 'cond', 'add', 'mini', 'end', 'next', 'vars', 'item', 'items', 'tuned', 'days', 'mood', 'queue', 'luck', 'insight', 'p', 'if', 'set', 'chain', 'unset', 'save', 'block'];

var errors = [], warns = [], stat = { scenes: 0, fx: { hp: [], mt: [], tr: [], bd: [] } };
function arr(x) { return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]; }
function where(id, vi) { return id + (vi !== undefined ? '#' + vi : ''); }
function E(w, m) { errors.push(w + ': ' + m); }
function W(w, m) { warns.push(w + ': ' + m); }

function strs(w, x, name, soft, hard, need) {
  var a = arr(x);
  if (need && !a.length) E(w, name + ' 없음');
  a.forEach(function (t) {
    if (typeof t !== 'string' || !t.trim()) { E(w, name + ' 빈 문자열'); return; }
    if (t.length > hard) E(w, name + ' 너무 김 (' + t.length + '자 > ' + hard + '): ' + t);
    else if (t.length > soft) W(w, name + ' 김 (' + t.length + '자 > ' + soft + '): ' + t);
  });
}
function checkFx(w, fx) {
  for (var k in (fx || {})) {
    if (STATS.indexOf(k) < 0) { E(w, 'fx에 모르는 스탯 ' + k); continue; }
    var v = fx[k];
    if (typeof v !== 'number' || Math.round(v) !== v) E(w, 'fx.' + k + ' 정수가 아님');
    else if (Math.abs(v) > LIMIT.fxHard) E(w, 'fx.' + k + ' = ' + v + ' (±' + LIMIT.fxHard + ' 초과)');
    else if (Math.abs(v) > LIMIT.fx) W(w, 'fx.' + k + ' = ' + v + ' (큰 값)');
  }
}
function checkAff(w, aff) { for (var a in (aff || {})) if (!JY.NPCS[a]) E(w, 'aff에 모르는 동료 ' + a); }
function expFx(o) { var fx = {}; for (var k in (o.fx || {})) fx[k] = o.fx[k]; arr(o.roll).forEach(function (r) { for (var k in (r.fx || {})) fx[k] = (fx[k] || 0) + r.fx[k] * r.p; }); return fx; }
function checkOpt(w, o, name, scene) {
  if (!o) return;
  for (var k in o) if (OPT_KEYS.indexOf(k) < 0) W(w, name + '.' + k + ' 처음 보는 필드 (오타?)');
  strs(w, o.t, name + ' 선택지', LIMIT.label, LIMIT.labelHard, true);
  checkFx(w, o.fx);
  checkAff(w, o.aff);
  if (o.say !== '' && o.say !== undefined) strs(w, o.say, name + ' 결과', LIMIT.say, LIMIT.sayHard, false);
  else if (!o.roll && !o.cases && !o.mini) E(w, name + ' 결과 문장(say) 없음');
  if (o.roll) {
    var p = 0;
    arr(o.roll).forEach(function (r, i) {
      p += r.p || 0;
      checkFx(w, r.fx); checkAff(w, r.aff);
      strs(w, r.say, name + ' roll[' + i + '] 결과', LIMIT.say, LIMIT.sayHard, true);
      if (r.gem && r.gem > 10) W(w, 'roll 다이아 ' + r.gem);
      if (r.leave && r.leave > 3) W(w, 'roll 휴가 ' + r.leave);
    });
    if (Math.abs(p - 1) > 0.01) E(w, name + ' roll 확률 합 ' + p.toFixed(2) + ' (1이어야 함)');
  }
  if (o.need) {
    var n = o.need;
    if (n.item && !JY.ITEMS[n.item]) E(w, 'need.item 모르는 아이템 ' + n.item);
    if (n.trait && JY.TRAIT_ORDER.indexOf(n.trait) < 0) E(w, 'need.trait 모르는 성격 ' + n.trait);
    if (n.aff) checkAff(w, n.aff);
  }
  if (o.gem && o.gem > 10) W(w, name + ' 다이아 ' + o.gem + ' (많음)');
  if (o.leave && o.leave > 3) W(w, name + ' 휴가 ' + o.leave + '일 (많음)');
  if (o.end && !(JY.ENDINGS && JY.ENDINGS[o.end])) E(w, name + ' 모르는 엔딩 ' + o.end);
  var e = expFx(o);
  STATS.forEach(function (k) { if (e[k]) stat.fx[k].push(e[k]); });
  scene.opts.push(e);
}
function checkReq(w, req) {
  if (!req) return;
  for (var k in req) if (REQ_KEYS.indexOf(k) < 0) E(w, 'req.' + k + ' 모르는 조건');
  if (req.rank && !(req.rank.length === 2 && req.rank[0] >= 0 && req.rank[1] <= 4 && req.rank[0] <= req.rank[1])) E(w, 'req.rank는 [0~4, 0~4]');
  arr(req.season).forEach(function (s) { if (SEASONS.indexOf(s) < 0) E(w, 'req.season ' + s + ' (spring/summer/autumn/winter)'); });
  arr(req.unit).forEach(function (s) { if (JY.UNIT_ORDER.indexOf(s) < 0) E(w, 'req.unit ' + s); });
  arr(req.mos).forEach(function (s) { if (MOS.indexOf(s) < 0) E(w, 'req.mos ' + s); });
  arr(req.trait).forEach(function (s) { if (JY.TRAIT_ORDER.indexOf(s) < 0) E(w, 'req.trait ' + s); });
  if (req.month && !(req.month[0] >= 1 && req.month[1] <= 12)) E(w, 'req.month는 [1~12, 1~12]');
  if (req.aff) checkAff(w, req.aff);
}
function checkScene(w, sc, card, isUrgent) {
  var scene = { opts: [] };
  var who = sc.who || card.who;
  if (!JY.CHARS[who]) E(w, '모르는 인물 who=' + who);
  if (sc.bg && BGS.indexOf(sc.bg) < 0) E(w, '모르는 배경 bg=' + sc.bg);
  strs(w, sc.text, '본문', LIMIT.text, LIMIT.textHard, true);
  if (!sc.l || !sc.r) E(w, '왼쪽(l)·오른쪽(r) 선택지가 둘 다 있어야 함');
  checkOpt(w, sc.l, 'l', scene); checkOpt(w, sc.r, 'r', scene);
  if (sc.x) { checkOpt(w, sc.x, 'x', scene); if (!sc.x.need) E(w, 'x(특수 대답)에는 need 조건이 필요'); }
  if (isUrgent) { if (!sc.t) E(w, '돌발 카드는 t(시간 초과) 결과가 필요'); else checkOpt(w, sc.t, 't', scene); }
  if (sc.req) checkReq(w, sc.req);
  // 한쪽만 공짜: 두 선택지가 모두 손해 없이 큰 이득이면 고민할 게 없다
  var free = scene.opts.slice(0, 2).filter(function (e) { var s = 0, neg = false; for (var k in e) { s += e[k]; if (e[k] < -0.5) neg = true; } return !neg && s >= 8; });
  if (free.length === 2) W(w, '두 선택지 모두 손해 없이 이득 (고민할 게 없음)');
  if (scene.opts.length >= 2) {
    var a = scene.opts[0], b = scene.opts[1], same = true;
    STATS.forEach(function (k) { if (Math.abs((a[k] || 0) - (b[k] || 0)) > 0.5) same = false; });
    if (same && !sc.l.roll && !sc.r.roll && !sc.l.aff && !sc.r.aff && !sc.l.gem && !sc.r.gem) W(w, '두 선택지 효과가 똑같음');
  }
  stat.scenes++;
}

var ids = {};
groups().forEach(function (g) { g.forEach(function (c) { if (ids[c.id]) E(c.id, '카드 id 중복'); ids[c.id] = 1; }); });

function mine(id) { return !only || owner[id] === only; }
var count = 0;
Object.keys(idx).forEach(function (id) {
  var c = idx[id];
  if (!owner[id] && !variantOwner[id]) return; // SPECIAL 등
  var vlist = c.variants || [];
  if (mine(id)) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) E(id, 'id는 영어 소문자·숫자·_ 만');
    if (!c.who || !JY.CHARS[c.who]) E(id, '카드 who 없음/모름: ' + c.who);
    if (BGS.indexOf(c.bg) < 0) E(id, '카드 bg 없음/모름: ' + c.bg);
    checkReq(id, c.req);
    if (c.repeat && !(c.cd >= 10)) W(id, 'repeat 카드인데 cd(재등장 간격 일수)가 작거나 없음');
    if (c.w && c.w > 2.5) W(id, '가중치 w=' + c.w + ' (너무 자주 나옴)');
    if (c.text || c.l) checkScene(id, c, c, !!c.urgent);
    vlist.forEach(function (v, i) { checkScene(where(id, i), v, c, !!c.urgent); });
    if (!c.text && !vlist.length) E(id, '본문도 장면(variants)도 없음');
  } else if (only && variantOwner[id]) {
    variantOwner[id].forEach(function (vo) {
      if (vo.f !== only) return;
      for (var i = vo.from; i < vo.to; i++) checkScene(where(id, i), vlist[i], c, !!c.urgent);
    });
  }
});

// 파일별 장면 수
var fileScenes = {};
Object.keys(idx).forEach(function (id) {
  var c = idx[id];
  if (owner[id]) { var f = owner[id]; var base = (c.text && c.l) ? 1 : 0; var own = (c.variants || []).length; (variantOwner[id] || []).forEach(function (vo) { own -= vo.to - vo.from; }); fileScenes[f] = (fileScenes[f] || 0) + base + own; }
  (variantOwner[id] || []).forEach(function (vo) { fileScenes[vo.f] = (fileScenes[vo.f] || 0) + vo.to - vo.from; });
});
var total = 0; for (var f in fileScenes) total += fileScenes[f];

function mean(a) { return a.length ? (a.reduce(function (x, y) { return x + y; }, 0) / a.length) : 0; }
console.log((only ? only + ' 검사' : '전체 검사') + ' — 장면 ' + stat.scenes + '개 검사');
console.log('파일별 장면 수: ' + Object.keys(fileScenes).map(function (f) { return f.replace('js/data/', '') + ' ' + fileScenes[f]; }).join(', ') + ' / 합계 ' + total);
console.log('선택지 평균 효과(원래 수치): ' + STATS.map(function (k) { return k + ' ' + mean(stat.fx[k]).toFixed(2) + ' (n' + stat.fx[k].length + ')'; }).join(', '));
if (warns.length) console.log('\n경고 ' + warns.length + '개\n  ' + warns.slice(0, 80).join('\n  ') + (warns.length > 80 ? '\n  …' : ''));
if (errors.length) { console.log('\n오류 ' + errors.length + '개\n  ' + errors.slice(0, 120).join('\n  ')); process.exit(1); }
console.log('\n오류 없음');
