#!/usr/bin/env node
/* 제설각 밸런스 점검: 가상 플레이어를 전략(보급 사는 순서) × 실력(효율) × 시드로 여러 번 돌려 표로 본다.
 * - 진급·전역까지 몇 분 (작전 시간만), ★ 분포, 심사 불합격, 남는 초코파이·상점, 어디서 벌었나
 * - 서로 다른 선택이 서로 다른 결과를 내는지 (한 전략만 압도적이면 선택이 의미 없다)
 * node tests/snow-balance.js [작전 수=45] [--quick]          (tests/snow-sim.js 를 STRAT/RIDE 환경 변수로 돌린다) */
'use strict';
var cp = require('child_process'), path = require('path');
var OPS = +process.argv[2] || 45, QUICK = process.argv.indexOf('--quick') > 0;
var STRATS = ['default', 'tool', 'crew', 'perk', 'cheap', 'none'], EFFS = QUICK ? [0.5] : [0.35, 0.5, 0.8], SEEDS = QUICK ? [7] : [7, 11, 23];
var jobs = [];
STRATS.forEach(function (st) { EFFS.forEach(function (e) { SEEDS.forEach(function (sd) { jobs.push({ strat: st, eff: e, seed: sd, ride: false }); }); }); });
EFFS.forEach(function (e) { SEEDS.forEach(function (sd) { jobs.push({ strat: 'default', eff: e, seed: sd, ride: true }); jobs.push({ strat: 'default', eff: e, seed: sd, ride: false, spec: 'b' }); }); });

function run(j) {
  return new Promise(function (res) {
    var env = Object.assign({}, process.env, { STRAT: j.strat, RIDE: j.ride ? '1' : '0', SPEC: j.spec || 'a' });
    cp.execFile('node', [path.join(__dirname, 'snow-sim.js'), String(OPS), String(j.seed), String(j.eff), '--json'], { env: env, maxBuffer: 1e7 }, function (err, out) {
      var line = (out || '').split('\n').filter(function (l) { return l.indexOf('SUMMARY ') === 0; })[0];
      res(line ? JSON.parse(line.slice(8)) : { strat: j.strat, eff: j.eff, seed: j.seed, ride: j.ride, error: String(err || 'no summary') });
    });
  });
}
(async function () {
  var out = [], i = 0, N = 4;
  async function worker() { while (i < jobs.length) { var j = jobs[i++]; out.push(await run(j)); } }
  await Promise.all(Array.from({ length: N }, worker));
  function avg(list, f) { var v = list.map(f).filter(function (x) { return x !== undefined && x !== null && !isNaN(x); }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : NaN; }
  function fmt(x, d) { return isNaN(x) ? '  -  ' : x.toFixed(d === undefined ? 1 : d); }
  var groups = {};
  out.forEach(function (r) { var k = (r.ride ? 'cart' : r.spec === 'b' ? '특기B' : r.strat) + '@' + r.eff; (groups[k] = groups[k] || []).push(r); });
  console.log('전략@효율       일병   상병   병장   전역   작전  ★3%  ★≤1%  불합격  남은초코(만) 상점(남음/누적)  분대  개인장비');
  Object.keys(groups).sort().forEach(function (k) {
    var g = groups[k], st = g.reduce(function (a, r) { return [0, 1, 2, 3].map(function (q) { return a[q] + (r.stars ? r.stars[q] : 0); }); }, [0, 0, 0, 0]), tot = st.reduce(function (a, b) { return a + b; }, 0) || 1;
    console.log(k.padEnd(14) + [fmt(avg(g, function (r) { return r.firsts && r.firsts['rank:일병']; })), fmt(avg(g, function (r) { return r.firsts && r.firsts['rank:상병']; })), fmt(avg(g, function (r) { return r.firsts && r.firsts['rank:병장']; })), fmt(avg(g, function (r) { return r.firsts && r.firsts.discharge; }))].map(function (s) { return s.padStart(6); }).join(' ') +
      fmt(avg(g, function (r) { return r.ops; }), 0).padStart(6) + fmt(st[3] / tot * 100, 0).padStart(6) + fmt((st[0] + st[1]) / tot * 100, 0).padStart(6) + fmt(avg(g, function (r) { return r.examFail; })).padStart(8) +
      fmt(avg(g, function (r) { return r.bank / 1e4; }), 0).padStart(12) + (fmt(avg(g, function (r) { return r.dia; }), 0) + '/' + fmt(avg(g, function (r) { return r.diaLife; }), 0)).padStart(14) +
      fmt(avg(g, function (r) { return r.crew; }), 0).padStart(6) + fmt(avg(g, function (r) { return r.perks; }), 0).padStart(8) + (g.some(function (r) { return r.error; }) ? '  (오류 있음)' : ''));
  });
  // 어디서 벌었나 (효율 0.5, 기본 전략)
  var base = out.filter(function (r) { return r.strat === 'default' && !r.ride && r.spec !== 'b' && r.eff === 0.5 && r.pay; });
  if (base.length) {
    var pay = {}, dia = {};
    base.forEach(function (r) { Object.keys(r.pay).forEach(function (k) { pay[k] = (pay[k] || 0) + r.pay[k]; }); Object.keys(r.diaSrc || {}).forEach(function (k) { dia[k] = (dia[k] || 0) + r.diaSrc[k]; }); });
    var pt = Object.keys(pay).reduce(function (a, k) { return a + pay[k]; }, 0) || 1;
    console.log('\n초코파이 출처 (기본·효율 0.5): ' + Object.keys(pay).sort(function (a, b) { return pay[b] - pay[a]; }).map(function (k) { return k + ' ' + Math.round(pay[k] / pt * 100) + '%'; }).join(' · '));
    console.log('상점 출처 (기본·효율 0.5): ' + Object.keys(dia).sort(function (a, b) { return dia[b] - dia[a]; }).map(function (k) { return k + ' ' + Math.round(dia[k] / base.length); }).join(' · '));
  }
  if (process.argv.indexOf('--raw') > 0) out.forEach(function (r) { console.log(JSON.stringify(r)); });
})();
