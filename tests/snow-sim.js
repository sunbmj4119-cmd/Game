#!/usr/bin/env node
/* 제설각 페이싱: 가상 플레이어가 퍼 담고 → 집하장에 붓고 → 사면서 몇 분 만에 무엇을 여는지 본다.
 * node tests/snow-sim.js [분] [시드] [효율 0~1] */
'use strict';
global.window = {};
require('../js/snow/data.js');
require('../js/snow/sim.js');
var JY = window.JY, S = JY.SNOW, G = JY.SnowSim;

var MIN = +process.argv[2] || 120, SEED = +process.argv[3] || 7, EFF = process.argv[4] ? +process.argv[4] : 0.8;
var save = G.newSave(); save.seed = SEED;
var w = G.createWorld(save), bot = { idx: -1, t: 0 }, DT = 0.05;

function botInput() {
  var P = w.player;
  if (P.stun > 0) return { x: 0, y: 0 };
  if (P.load >= P.cap * 0.95) {
    var d = G.nearestDump(w, P.x, P.y), dx = d.x - P.x, dy = d.y - P.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }
  bot.t -= DT;
  if (bot.t <= 0 || bot.idx < 0 || !w.depth[bot.idx]) {
    var best = -1, bs = 1e9;
    for (var k = 0; k < 40; k++) {
      var idx = w.cells[(Math.random() * w.cells.length) | 0];
      if (!w.depth[idx]) continue;
      var x = (idx % S.GW) * S.CELL + 5, y = ((idx / S.GW) | 0) * S.CELL + 5;
      var s = Math.hypot(x - P.x, y - P.y) - w.depth[idx] * 10;
      if (s < bs) { bs = s; best = idx; }
    }
    bot.idx = best; bot.t = 1.2;
  }
  if (bot.idx < 0) {
    if (P.load > 0) { var d2 = G.nearestDump(w, P.x, P.y); return { x: Math.sign(d2.x - P.x), y: Math.sign(d2.y - P.y) }; }
    return { x: 0, y: 0 };
  }
  var tx = (bot.idx % S.GW) * S.CELL + 5, ty = ((bot.idx / S.GW) | 0) * S.CELL + 5, ddx = tx - P.x, ddy = ty - P.y, dd = Math.hypot(ddx, ddy) || 1;
  return Math.random() > EFF ? { x: 0, y: 0 } : { x: ddx / dd, y: ddy / dd };
}

function shop(log) {
  var bought = false;
  for (var guard = 0; guard < 40; guard++) {
    var o = G.offers(save), all = [].concat(o.zone, o.tool, o.factory, o.crew, o.perk).filter(function (x) { return x.ok; });
    if (!all.length) break;
    var pick = all.filter(function (x) { return x.kind === 'zone'; })[0] || all.filter(function (x) { return x.kind === 'tool'; })[0] ||
      all.filter(function (x) { return x.kind === 'relay'; })[0];
    if (!pick) { all.sort(function (a, b) { return a.cost - b.cost; }); if (all[0].cost <= save.bank * 0.5) pick = all[0]; }
    if (!pick) break;
    G.buy(save, pick.kind, pick.id); log.push(pick.kind + ':' + pick.id); bought = true;
  }
  return bought;
}

var firsts = {}, t = 0, lastShop = 0, lastLog = 0, rank0 = 0, hits = 0;
while (t < MIN * 60) {
  G.step(w, DT, botInput()); t += DT;
  if (w.recruits.length) G.autoPost(w);   // 가상 플레이어는 신병을 바로 배치
  w.fx.forEach(function (f) { if (f.t === 'meHit' || f.t === 'deerHit') hits++; }); w.fx.length = 0; w.dirty.length = 0;
  var r = G.rankOf(save);
  if (r > rank0) { rank0 = r; firsts['rank:' + S.RANKS[r].name] = t; }
  if (G.canDischarge(save) && !firsts.discharge) firsts.discharge = t;
  if (t - lastShop > 5) {
    lastShop = t; var log = [];
    if (shop(log)) { G.serialize(w); w = G.createWorld(save); log.forEach(function (k) { if (!firsts[k]) firsts[k] = t; }); }
  }
  if (t - lastLog >= (t < 1200 ? 120 : 600)) {
    lastLog = t;
    console.log(('' + Math.round(t / 60) + '분').padEnd(6), ('D' + save.day).padEnd(5), ('bank ' + Math.round(save.bank)).padEnd(14), ('life ' + Math.round(save.life)).padEnd(15),
      S.RANKS[G.rankOf(save)].name, S.TOOLS[save.tool].name.padEnd(9), 'crew ' + G.crewCount(save), 'zones ' + Object.keys(save.zones).join(''),
      'relay ' + Object.keys(save.relays).join(''), 'proc ' + JSON.stringify(save.proc), 'clean ' + Math.round(G.pct(w) * 100) + '%', '다이아 ' + save.dia + '/' + save.diaLife, '상자 ' + save.boxes.length, '★' + save.toolStar, '사기 ' + Math.round(w.crew.reduce(function (a, e) { return a + e.mor; }, 0) / Math.max(1, w.crew.length)));
  }
}
console.log('\n처음 산 시각 (분):');
Object.keys(firsts).sort(function (a, b) { return firsts[a] - firsts[b]; }).forEach(function (k) { console.log('  ' + k.padEnd(20) + ' ' + (firsts[k] / 60).toFixed(1)); });
console.log('고라니·지붕에 당한 횟수', hits);
