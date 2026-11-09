#!/usr/bin/env node
/* 밸런스 시뮬레이터: node tools/simulate.js [판수] [pace]
 * 무작위 플레이어 vs 생각하는 플레이어의 전역 성공률, 평균 카드 수, 엔딩 분포를 본다. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

global.window = global;
var root = path.join(__dirname, '..');
['js/data/chars.js', 'js/data/cards.js', 'js/data/items.js', 'js/core.js'].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
});
var JY = global.JY;
var G = JY.Game;

var N = +process.argv[2] || 2000;
var PACE = +process.argv[3] || 1;

function miniTier() { var r = Math.random(); return r < 0.3 ? 'great' : r < 0.75 ? 'good' : 'bad'; }

function expected(s, opt) {
  var fx = {};
  function add(src, w) { for (var k in src) fx[k] = (fx[k] || 0) + src[k] * w; }
  add(opt.fx || {}, 1);
  (opt.roll || []).forEach(function (r) { add(r.fx || {}, r.p); });
  if (opt.cases) add(opt.cases[opt.cases.length - 1].fx || {}, 1);
  return fx;
}

function score(s, fx, opt) {
  var sc = 0;
  G.STATS.forEach(function (k) {
    var v = s.stats[k] + (fx[k] || 0);
    var d = Math.abs(v - 50);
    sc -= d * d;
    if (v <= 4 || v >= 96) sc -= 100000;
  });
  if (opt.end) sc -= 1e7;
  if (opt.leave) sc += 300;
  return sc;
}

function smartChoose(s) {
  var c = G.getCardDef(s.current);
  var a = score(s, expected(s, c.l), c.l), b = score(s, expected(s, c.r), c.r);
  return a >= b ? 'l' : 'r';
}

function smartUpkeep(s) {
  // 아이템: 위험한 스탯을 중앙으로
  G.STATS.forEach(function (k) {
    for (var guard = 0; guard < 3; guard++) {
      var v = s.stats[k];
      if (v > 25 && v < 75) break;
      var best = null;
      for (var id in s.items) {
        if (!(s.items[id] > 0)) continue;
        var f = JY.ITEMS[id].fx[k] || 0;
        if ((v <= 25 && f > 0) || (v >= 75 && f < 0)) { best = id; break; }
      }
      if (!best) break;
      G.useItem(s, best);
    }
  });
  // PX: 돈 있으면 몇 개 사두기
  if (G.pxStatus(s).ok && s.money > 30000) {
    var bought = false;
    ['mandu', 'chocopie', 'hot6', 'polish', 'earplug', 'comic', 'buldak'].forEach(function (id) {
      if ((s.items[id] || 0) < 2 && G.buy(s, id)) bought = true;
    });
    G.closePX(s, bought);
  }
  // 휴가: 말출 노리고 아끼다가, 멘탈 낮으면 쓴다
  var ls = G.leaveStatus(s);
  if (ls.ok) {
    var left = G.daysLeft(s);
    if (s.leave >= left) G.takeLeave(s, left);
    else if (s.stats.mt < 30 && s.leave > 8) G.takeLeave(s, 5);
  }
}

function play(policy) {
  var s = G.newState({ mos: ['infantry', 'cook', 'clerk', 'driver', 'medic'][Math.floor(Math.random() * 5)], start: '2026-03-02', pace: PACE });
  var guard = 0;
  var seen = {};
  while (!s.over && guard++ < 2000) {
    if (policy === 'smart') smartUpkeep(s);
    if (s.over) break;
    seen[s.current] = 1;
    var res = G.choose(s, policy === 'smart' ? smartChoose(s) : (Math.random() < 0.5 ? 'l' : 'r'));
    if (res && res.mini) G.finishMini(s, miniTier());
  }
  return { s: s, seen: seen };
}

function run(policy) {
  var endings = {}, good = 0, cards = 0, days = 0, uniq = {}, uniqPerRun = 0, bankTotal = 0, leaveUsed = 0;
  for (var i = 0; i < N; i++) {
    var r = play(policy);
    var s = r.s;
    endings[s.over.id] = (endings[s.over.id] || 0) + 1;
    if (s.over.good) { good++; bankTotal += G.bank(s).total; }
    cards += s.cards; days += s.day; leaveUsed += s.leaveUsed;
    var n = 0; for (var k in r.seen) { uniq[k] = 1; n++; } uniqPerRun += n;
  }
  console.log('\n== ' + policy + ' (' + N + '판, pace ' + PACE + ') ==');
  console.log('전역 성공률: ' + (good / N * 100).toFixed(1) + '%');
  console.log('평균 카드 수: ' + (cards / N).toFixed(1) + ' / 평균 복무일: ' + (days / N).toFixed(0) + ' / 평균 휴가 사용: ' + (leaveUsed / N).toFixed(1));
  console.log('판당 고유 카드: ' + (uniqPerRun / N).toFixed(1) + ' / 전체에서 등장한 카드: ' + Object.keys(uniq).length + ' / 전체 카드: ' + Object.keys(G._index()).length);
  if (good) console.log('전역 시 평균 통장: ' + Math.round(bankTotal / good / 10000) + '만원');
  var list = Object.keys(endings).sort(function (a, b) { return endings[b] - endings[a]; });
  console.log('엔딩: ' + list.map(function (k) { return k + ' ' + (endings[k] / N * 100).toFixed(1) + '%'; }).join(', '));
  return uniq;
}

run('random');
var u = run('smart');
var never = Object.keys(G._index()).filter(function (k) { return !u[k]; });
if (never.length) console.log('\n스마트 플레이에서 한 번도 안 나온 카드: ' + never.join(', '));
