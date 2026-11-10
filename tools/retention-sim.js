#!/usr/bin/env node
/* 지속성 시뮬레이션: 가상의 플레이어 집단이 여러 판을 하며 실력이 늘고, 짬으로 강화하고, 장면을 모으는 과정을 본다.
 * node tools/retention-sim.js [플레이어 수] [판 수] [pace]
 * 실력 모델: 더 나은 쪽을 고를 확률이 0.6에서 시작해 판마다 오른다(최대 0.85). 위험하면 아이템을 가끔 쓴다. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
var store = {};
global.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
var root = path.join(__dirname, '..');
require('./data-files').load({ noMeta: false });
var JY = global.JY, G = JY.Game, Meta = JY.Meta;
var AP = require('./autoplay')(JY), ST = { acts: 0, loot: 0, caught: 0 };
var PLAYERS = +process.argv[2] || 60, RUNS = +process.argv[3] || 40, PACE = +process.argv[4] || 3;
var HEAT = process.env.HEAT ? process.env.HEAT.split(',') : null;


var byRun = [];
for (var r = 0; r < RUNS; r++) byRun.push({ ok: 0, days: 0, cards: 0, lv: 0, upg: 0, collect: 0, n: 0, quitRisk: 0 });
var firstMax = [], runsToLv5 = [], runsToLv10 = [];

for (var p = 0; p < PLAYERS; p++) {
  store = {};
  Meta.load();
  var skill = 0.6;
  var lv5 = null, lv10 = null, maxed = null;
  for (var run = 0; run < RUNS; run++) {
    var s = G.newState({ start: '2026-03-02', pace: PACE, trait: JY.TRAIT_ORDER[(p + run) % JY.TRAIT_ORDER.length], up: Meta.get().up, heat: HEAT });
    AP.play(s, skill, { see: Meta.see, stats: ST });
    var fr = Meta.finishRun(s);
    // 짬으로 가장 싼 강화부터
    for (var guard = 0; guard < 20; guard++) {
      var cand = JY.UPGRADES.map(function (u) { return { id: u.id, lv: Meta.upLevel(u.id) }; }).filter(function (x) { return x.lv < 5; }).sort(function (a, b) { return a.lv - b.lv; })[0];
      if (!cand || Meta.get().jjam < JY.UPGRADE_COST[cand.lv]) break;
      Meta.upgrade(cand.id);
    }
    var upSum = JY.UPGRADES.reduce(function (a, u) { return a + Meta.upLevel(u.id); }, 0);
    var b = byRun[run];
    b.n++; b.ok += s.over.good ? 1 : 0; b.days += s.over.good ? s.total : s.over.day; b.cards += s.cards; b.lv += Meta.level().lv; b.upg += upSum; b.collect += Meta.collectProgress().frac;
    if (!s.over.good && s.over.day < 150) b.quitRisk++;
    if (lv5 === null && Meta.level().lv >= 5) lv5 = run + 1;
    if (lv10 === null && Meta.level().lv >= 10) lv10 = run + 1;
    if (maxed === null && upSum >= 40) maxed = run + 1;
    skill = Math.min(0.85, skill + 0.01);
  }
  if (lv5) runsToLv5.push(lv5); if (lv10) runsToLv10.push(lv10); if (maxed) firstMax.push(maxed);
}
function avg(a) { return a.length ? (a.reduce(function (x, y) { return x + y; }, 0) / a.length).toFixed(1) : '-'; }
console.log('플레이어 ' + PLAYERS + '명 × ' + RUNS + '판, pace ' + PACE + (HEAT ? ', 악조건 ' + HEAT.join('+') : ''));
console.log('판\t전역률\t평균일수\t카드\t레벨\t강화합(40)\t수집률\t150일 전 탈락');
[0, 1, 2, 4, 9, 14, 19, 29, 39].filter(function (i) { return i < RUNS; }).forEach(function (i) {
  var b = byRun[i];
  console.log((i + 1) + '\t' + (b.ok / b.n * 100).toFixed(0) + '%\t' + Math.round(b.days / b.n) + '\t' + Math.round(b.cards / b.n) + '\t' + (b.lv / b.n).toFixed(1) + '\t' + (b.upg / b.n).toFixed(1) + '\t' + (b.collect / b.n * 100).toFixed(0) + '%\t' + (b.quitRisk / b.n * 100).toFixed(0) + '%');
});
console.log('Lv5 도달 평균 ' + avg(runsToLv5) + '판, Lv10 ' + avg(runsToLv10) + '판 (' + runsToLv10.length + '/' + PLAYERS + '명), 강화 전부 +5 ' + avg(firstMax) + '판 (' + firstMax.length + '/' + PLAYERS + '명)');
