#!/usr/bin/env node
/* 제설각 v10/v11 페이싱: 가상 플레이어가 제설 작전을 하나씩 치른다.
 * 마감 순서대로 치우고, 빙판엔 염화칼슘, 간부에겐 경례(반응 시간), 빠진 차는 밀고, 다 하면 보고. 작전 사이엔 보급을 산다.
 * v11: 보고·보급은 빛나는 원 위에 서 있기, 제설함·빙판·차 밀기는 그 자리에 가기만 하면 저절로.
 * node tests/snow-sim.js [작전 수] [시드] [효율 0~1] [-v] */
'use strict';
global.window = {};
['data', 'sim', 'act', 'meta'].forEach(function (f) { require('../js/snow/' + f + '.js'); });
var JY = window.JY, S = JY.SNOW, G = JY.SnowSim, A = JY.SnowAct;

var OPS = +process.argv[2] || 40, SEED = +process.argv[3] || 7, EFF = process.argv[4] ? +process.argv[4] : 0.8, VERBOSE = process.argv.indexOf('-v') > 0;
// v16 밸런스 점검: STRAT=default|tool|crew|perk|cheap|none (보급 사는 순서), RIDE=1 (리어카 타고 일하기), --json (요약 한 줄)
var STRAT = process.env.STRAT || 'default', RIDE = process.env.RIDE === '1', JSONOUT = process.argv.indexOf('--json') > 0, SPECI = process.env.SPEC === 'b' ? 1 : 0;   // SPEC=a|b 진급 특기 (앞/뒤)
var paySum = {}, diaSum = {}, examFail = 0, scores = [];
var rnd = G.mulberry(SEED * 31 + 5);
Math.random = rnd;   // 같은 시드면 같은 결과
var save = G.newSave(); save.seed = SEED;
var DT = 0.05, total = 0, firsts = {}, log = [], stars = [0, 0, 0, 0];

function toward(P, x, y) { var dx = x - P.x, dy = y - P.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l, d: l }; }
function cellXY(idx) { return { x: (idx % S.GW) * S.CELL + 5, y: ((idx / S.GW) | 0) * S.CELL + 5 }; }

function runOp() {
  var w = G.createWorld(save), bot = { idx: -1, t: 0, react: 0 }, t = 0;
  if (w.recruits.length) G.autoPost(w);
  function tryAct(kind, alt) {
    var c = A.candidates(w).filter(function (q) { return q.k === kind && Math.hypot(q.x - w.player.x, q.y - w.player.y) <= q.r; })[0];
    if (!c) return false;
    var r = A.act(w, c, w.player.dir, alt);
    return r.ok;
  }
  function input() {
    var P = w.player, st = A.state(w), o = st.op;
    if (P.stun > 0) return { x: 0, y: 0 };
    if (RIDE && !w.act.ride && !bot.rode && G.feat(save, 'cart')) {
      var cart = w.act.rides[0], cv0 = toward(P, cart.x, cart.y);
      if (cv0.d < 20) { A.startRide(w, cart); bot.rode = true; return { x: 0, y: 0 }; }
      return cv0;
    }
    if (rnd() > EFF) return { x: 0, y: 0 };   // 딴짓
    // 간부 경례 (반응 시간 0.6~2초)
    if (st.salute) { bot.react += DT; if (bot.react > 0.6 + (1 - EFF) * 3) { tryAct('officer'); bot.react = 0; } }
    else bot.react = 0;
    var off = (w.act.off || []).filter(function (q) { return q.saluted && !q.done.report && q.id !== 'lt' && Math.hypot(q.x - P.x, q.y - P.y) < 40; })[0];
    if (off) A.act(w, { k: 'officer', ref: off }, P.dir, false);
    // 보고 (빙판을 다 처리한 뒤에)
    var icy0 = w.parts.some(function (q) { return q.icy && !q.salted; });
    if (o.ready && !icy0) { var hv = toward(P, S.PADS.report.x, S.PADS.report.y); if (hv.d < 8) return { x: 0, y: 0 }; return hv; }
    // 빠진 차 밀기
    if (w.car && w.car.stuck) { var cv = toward(P, w.car.x, w.car.y + 14); if (cv.d < 30) return { x: 0, y: 0 }; return cv; }
    // 짐이 가득 → 집하장
    if (P.load >= P.cap * 0.95) { var d = G.nearestDump(w, P.x, P.y); return toward(P, d.x, d.y); }
    // 빙판 → 제설함 → 뿌리기
    var icy = w.parts.filter(function (q) { return q.icy && !q.salted; })[0];
    if (icy && !G.toolOf(save).aura) {
      if (w.act.hand !== 'salt') {
        var box = S.PROPS.filter(function (p) { return p.id === 'saltbox'; }).sort(function (a, b) { return Math.hypot(a.ux - P.x, a.uy - P.y) - Math.hypot(b.ux - P.x, b.uy - P.y); })[0];
        return toward(P, box.ux, box.uy);
      }
      var iv = toward(P, icy.x + icy.w / 2, icy.y + icy.h / 2);
      if (iv.d < 6) return { x: 0, y: 0 };
      return iv;
    }
    // 장비: 행보관에게 요청 (살 수 있으면)
    var nt = A.nextTool(save);
    if (STRAT !== 'none' && nt && save.bank >= nt.cost * 1.1 && G.rankOf(save) >= (nt.rank || 0)) { var tv = toward(P, S.PADS.supply.x, S.PADS.supply.y); if (tv.d < 8) return { x: 0, y: 0 }; return tv; }
    // 지시서: 마감이 가장 빠른 미완료 구역의 눈
    bot.t -= DT;
    if (bot.t <= 0 || bot.idx < 0 || !w.depth[bot.idx]) {
      var cur = w.op.tasks.filter(function (q) { return q.done < 0; })[0], list = cur ? w.zoneCells[cur.zi] : w.cells, best = -1, bs = 1e9;
      for (var k = 0; k < 50; k++) { var idx = list[(rnd() * list.length) | 0]; if (!w.depth[idx]) continue; var p = cellXY(idx), s = Math.hypot(p.x - P.x, p.y - P.y) - w.depth[idx] * 10; if (s < bs) { bs = s; best = idx; } }
      bot.idx = best; bot.t = 1.2;
    }
    if (bot.idx < 0) { if (P.load > 0) { var d2 = G.nearestDump(w, P.x, P.y); return toward(P, d2.x, d2.y); } return { x: 0, y: 0 }; }
    var c = cellXY(bot.idx); return toward(P, c.x, c.y);
  }
  while (!w.opEnd && t < 400) {
    var inp = input();
    if (bot.side > 0) { bot.side -= DT; inp = { x: bot.sx, y: bot.sy }; }   // 막히면 옆으로 비켜 걷는다 (사람처럼 돌아간다)
    G.step(w, DT, inp); t += DT;
    if (inp.x || inp.y) {
      if (Math.hypot(w.player.x - (bot.px || 0), w.player.y - (bot.py || 0)) < DT * 8) { bot.stuck = (bot.stuck || 0) + DT; if (bot.stuck > 0.4) { var sg = rnd() < 0.5 ? 1 : -1; bot.stuck = 0; bot.sx = -inp.y * sg; bot.sy = inp.x * sg; bot.side = 0.9; } } else bot.stuck = 0;
    }
    bot.px = w.player.x; bot.py = w.player.y;
    if (w.recruits.length) G.autoPost(w);
    w.fx.length = 0; w.dirty.length = 0;
  }
  total += t;
  Object.keys(w.paySrc || {}).forEach(function (k) { paySum[k] = (paySum[k] || 0) + w.paySrc[k]; });
  Object.keys(w.diaSrc || {}).forEach(function (k) { diaSum[k] = (diaSum[k] || 0) + w.diaSrc[k]; });
  return { res: w.opEnd, t: t, w: w };
}

// 상병부터 브리핑에서 조원 배치: 구역 넓이·눈 값만큼 나눈다 (플레이어가 하는 그대로)
function plan() {
  if (G.rankOf(save) < 2) return;
  var zs = S.ZONES.filter(function (Z) { return save.zones[Z.id]; }), load = {};
  zs.forEach(function (Z) { load[Z.id] = 0; });
  var weight = function (Z) { return Z.w * Z.h * (Z.due < 480 ? 1.6 : 1) / (1 + load[Z.id]); };
  S.CREW.slice().reverse().forEach(function (C) {
    var posts = save.cpost[C.id] = save.cpost[C.id] || [];
    for (var i = 0; i < G.crewN(save, C.id); i++) {
      var best = zs.slice().sort(function (a, b) { return weight(b) - weight(a); })[0];
      posts[i] = best.id; load[best.id] += C.cap / 40;
    }
  });
}
function shop() {
  for (var sd = G.specDue(save); sd; sd = G.specDue(save)) { save.spec = save.spec || {}; save.spec[sd.rank] = sd.opts[SPECI].id; }
  plan();
  for (var guard = 0; guard < 30; guard++) {
    var o = G.offers(save), all = [].concat(o.tool, o.crew, o.factory, o.perk).filter(function (x) { return x.ok; });
    if (!all.length) return;
    function first(kinds) { for (var i = 0; i < kinds.length; i++) { var f = all.filter(function (x) { return x.kind === kinds[i]; }).sort(function (a, b) { return a.cost - b.cost; })[0]; if (f) return f; } return null; }
    var pick = null;
    if (STRAT === 'none') return;
    if (STRAT === 'default') pick = first(['tool', 'crew']);
    else if (STRAT === 'tool') pick = first(['tool', 'perk']);
    else if (STRAT === 'crew') pick = first(['crew', 'tool']);
    else if (STRAT === 'perk') pick = first(['perk', 'proc', 'tool']);
    else if (STRAT === 'cheap') { all.sort(function (a, b) { return a.cost - b.cost; }); pick = all[0]; }
    if (!pick && STRAT !== 'cheap') { all.sort(function (a, b) { return a.cost - b.cost; }); if (all[0].cost <= save.bank * 0.5) pick = all[0]; }
    if (!pick) return;
    G.buy(save, pick.kind, pick.id);
    if (!firsts[pick.kind + ':' + pick.id]) firsts[pick.kind + ':' + pick.id] = total;
  }
}

var rank0 = 0;
for (var n = 1; n <= OPS; n++) {
  var day = save.day, exam = save.exam, r = runOp(), res = r.res;
  stars[res.stars]++; scores.push(res.score); if (exam && !res.pass) examFail++;
  if (G.rankOf(save) > rank0) { rank0 = G.rankOf(save); firsts['rank:' + S.RANKS[rank0].name] = total; }
  res.zones.forEach(function (z) { firsts['zone:' + z] = total; });
  if (G.canDischarge(save) && !firsts.discharge) firsts.discharge = total;
  var line = ('#' + n).padEnd(4) + ('D' + day).padEnd(5) + S.RANKS[res.rank0].name + (exam ? '(심사' + (res.pass ? ' 합격)' : ' 불합격)') : '        ') +
    ' ' + '★★★'.slice(0, res.stars).padEnd(3, '☆') + ' ' + String(Math.round(res.score * 100)).padStart(3) + '% ' + G.clockText(G.clockOf(r.t)) + (res.why === 'report' ? ' 보고' : ' 시간') +
    '  구역 ' + res.lines.length + ' 완료 ' + res.lines.filter(function (l) { return l.done; }).length + (res.jigeok ? ' 지적' + res.jigeok : '') + (res.stuck ? ' 차빠짐' : '') + (res.icy ? ' 빙판' + res.icy : '') +
    '  ★' + save.merit + '  ' + S.TOOLS[save.tool].name + ' 분대' + G.crewCount(save) + '  초코 ' + Math.round(save.bank) + ' 상점 ' + save.dia + '  누적 ' + (total / 60).toFixed(1) + '분';
  log.push(line); if (VERBOSE) console.log(line);
  shop();
  if (G.canDischarge(save) && n > 3) { if (!VERBOSE) console.log(line); console.log('\n전역 가능 — 작전 ' + n + '번째'); break; }
}
if (JSONOUT) {
  var f = {}; Object.keys(firsts).forEach(function (k) { f[k] = +(firsts[k] / 60).toFixed(1); });
  console.log('SUMMARY ' + JSON.stringify({ strat: STRAT, spec: SPECI ? 'b' : 'a', ride: RIDE, eff: EFF, seed: SEED, ops: n > OPS ? OPS : n, min: +(total / 60).toFixed(1), stars: stars, examFail: examFail,
    score: +(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(3), bank: Math.round(save.bank), life: Math.round(save.life), dia: save.dia, diaLife: save.diaLife,
    tool: save.tool, crew: G.crewCount(save), perks: Object.keys(save.perks).reduce(function (a, k) { return a + save.perks[k]; }, 0), rank: G.rankOf(save), firsts: f,
    pay: Object.keys(paySum).reduce(function (o, k) { o[k] = Math.round(paySum[k]); return o; }, {}), diaSrc: diaSum }));
  process.exit(0);
}
if (!VERBOSE) log.slice(-6).forEach(function (l) { console.log(l); });
console.log('\n★ 분포 (0~3):', stars.join(' / '));
console.log('처음 시각 (분, 작전 시간만 합산):');
Object.keys(firsts).sort(function (a, b) { return firsts[a] - firsts[b]; }).forEach(function (k) { console.log('  ' + k.padEnd(24) + ' ' + (firsts[k] / 60).toFixed(1)); });
