#!/usr/bin/env node
/* 악조건 보정: 강화가 어느 정도 된 숙련 플레이어가 악조건마다 전역률이 얼마나 떨어지는지 본다.
 * node tools/heat-sim.js [판 수] [pace] [실력 0~1] [강화 단계]
 * 사람만 겪는 어려움은 근사한다: 돌발 지옥 = 시간 초과 확률↑, 눈치 제로 = 고르는 실력↓ */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
var store = {};
global.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
var root = path.join(__dirname, '..');
require('./data-files').load({ noMeta: true });
var JY = global.JY, G = JY.Game;
var N = +process.argv[2] || 300, PACE = +process.argv[3] || 3, SKILL = +process.argv[4] || 0.8, UPLV = process.argv[5] != null ? +process.argv[5] : 3;

function exp(o) { var fx = {}; function add(s, w) { for (var k in s) fx[k] = (fx[k] || 0) + s[k] * w; } add(o.fx || {}, 1); (o.roll || []).forEach(function (r) { add(r.fx || {}, r.p); }); return fx; }
function sc(s, fx) { var t = 0; G.STATS.forEach(function (k) { var v = s.stats[k] + (fx[k] || 0); t -= (v - 50) * (v - 50); if (v <= 4 || v >= 96) t -= 1e5; }); return t; }

function play(heat, seed) {
  var up = {}; JY.UPGRADES.forEach(function (u) { up[u.id] = UPLV; });
  var s = G.newState({ start: '2026-03-02', pace: PACE, mos: ['infantry', 'cook', 'clerk', 'driver', 'medic'][seed % 5], trait: JY.TRAIT_ORDER[seed % JY.TRAIT_ORDER.length], up: up, heat: heat });
  var chaos = heat.indexOf('chaos') >= 0, blind = heat.indexOf('blind') >= 0;
  var skill = SKILL - (blind ? 0.12 : 0), tmo = 0.1 + (chaos ? 0.2 : 0);
  var g = 0;
  while (!s.over && g++ < 700) {
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
    if (G.getCardDef(s.current).urgent && Math.random() < tmo) side = 't';
    var res = G.choose(s, side);
    if (res && res.mini) G.finishMini(s, Math.random() < 0.3 ? 'great' : Math.random() < 0.7 ? 'good' : 'bad');
  }
  return s;
}
function run(heat) {
  var ok = 0, early = 0, score = 0;
  for (var i = 0; i < N; i++) { var s = play(heat, i); if (s.over.good) ok++; else if (s.over.day < 150) early++; score += G.score ? 0 : 0; }
  return { ok: ok / N, early: early / N };
}
var base = run([]);
console.log('판 ' + N + ', pace ' + PACE + ', 실력 ' + SKILL + ', 강화 +' + UPLV);
console.log('악조건\t보너스\t전역률\t차이\t150일 전 탈락');
console.log('없음\t-\t' + (base.ok * 100).toFixed(0) + '%\t-\t' + (base.early * 100).toFixed(0) + '%');
var sets = JY.HEAT_ORDER.map(function (id) { return [id]; }).concat([['haeng', 'fragile', 'chaos'], JY.HEAT_ORDER.slice()]);
sets.forEach(function (h) {
  var r = run(h), b = h.reduce(function (a, id) { return a + JY.HEAT[id].bonus; }, 0);
  console.log(h.join('+') + '\t+' + Math.round(b * 100) + '%\t' + (r.ok * 100).toFixed(0) + '%\t' + ((r.ok - base.ok) * 100).toFixed(0) + 'p\t' + (r.early * 100).toFixed(0) + '%');
});
