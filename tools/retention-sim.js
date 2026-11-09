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
var PLAYERS = +process.argv[2] || 60, RUNS = +process.argv[3] || 40, PACE = +process.argv[4] || 3;
var HEAT = process.env.HEAT ? process.env.HEAT.split(',') : null;

function exp(o) { var fx = {}; function add(s, w) { for (var k in s) fx[k] = (fx[k] || 0) + s[k] * w; } add(o.fx || {}, 1); (o.roll || []).forEach(function (r) { add(r.fx || {}, r.p); }); return fx; }
function sc(s, fx) { var t = 0; G.STATS.forEach(function (k) { var v = s.stats[k] + (fx[k] || 0); t -= (v - 50) * (v - 50); if (v <= 4 || v >= 96) t -= 1e5; }); return t; }

var byRun = [];
for (var r = 0; r < RUNS; r++) byRun.push({ ok: 0, days: 0, cards: 0, lv: 0, upg: 0, collect: 0, n: 0, quitRisk: 0 });
var firstMax = [], runsToLv5 = [], runsToLv10 = [];

for (var p = 0; p < PLAYERS; p++) {
  store = {};
  Meta.load();
  var skill = 0.6;
  var lv5 = null, lv10 = null, maxed = null;
  for (var run = 0; run < RUNS; run++) {
    var s = G.newState({ start: '2026-03-02', pace: PACE, mos: ['infantry', 'cook', 'clerk', 'driver', 'medic'][run % 5], trait: JY.TRAIT_ORDER[(p + run) % JY.TRAIT_ORDER.length], up: Meta.get().up, heat: HEAT });
    var g = 0;
    while (!s.over && g++ < 600) {
      // 위험하면 가끔 아이템 사용, PX에서 사두기
      if (Math.random() < skill) G.STATS.forEach(function (k) {
        var v = s.stats[k]; if (v > 22 && v < 78) return;
        for (var id in s.items) {
        if (!(s.items[id] > 0)) continue;
        var fx = JY.ITEMS[id].fx, f = fx[k] || 0;
        if (!((v <= 22 && f > 0) || (v >= 78 && f < 0))) continue;
        // 다른 스탯을 위험 구간으로 밀어 넣는 아이템은 안 쓴다
        if (G.STATS.some(function (o) { return o !== k && fx[o] && (s.stats[o] + fx[o] <= 15 || s.stats[o] + fx[o] >= 85); })) continue;
        G.useItem(s, id); break;
      }
      });
      if (G.pxStatus(s).ok && s.money > 20000 && Math.random() < 0.5) { ['mandu', 'hot6', 'earplug', 'comic', 'polish', 'chocopie'].forEach(function (id) { G.buy(s, id); }); G.closePX(s, true); }
      var ls = G.leaveStatus(s);
      if (ls.ok && (s.leave >= G.daysLeft(s) || (s.stats.mt < 25 && s.stats.hp < 70 && s.leave > 6))) G.takeLeave(s, Math.min(s.leave, ls.max));
      if (s.over) break;
      var v = G._view(s);
      var best = sc(s, exp(v.l)) >= sc(s, exp(v.r)) ? 'l' : 'r';
      var side = Math.random() < skill ? best : (best === 'l' ? 'r' : 'l');
      var sp = G._special(s);
      if (sp && Math.random() < 0.5) side = 'x';
      if (G.getCardDef(s.current).urgent && Math.random() < 0.15) side = 't';
      var cc = G.currentCard(s); Meta.see(cc.key);
      var res = G.choose(s, side);
      if (res && res.mini) G.finishMini(s, Math.random() < 0.3 ? 'great' : Math.random() < 0.7 ? 'good' : 'bad');
    }
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
