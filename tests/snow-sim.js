#!/usr/bin/env node
/* 제설각 페이싱 시뮬레이션: 가상 플레이어가 N일 동안 일하고 사면서 언제 무엇을 여는지 본다.
 * node tests/snow-sim.js [일수] [시드] */
'use strict';
global.window = {};
require('../js/snow/data.js');
require('../js/snow/sim.js');
var JY = window.JY, S = JY.SNOW, G = JY.SnowSim;

var DAYS = +process.argv[2] || 40, SEED = +process.argv[3] || 7;
var save = G.newSave(); save.seed = SEED;

function botInput(w, bot) {
  var P = w.player;
  bot.t -= 1 / 30;
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
  if (bot.idx < 0) return { x: 0, y: 0 };
  var tx = (bot.idx % S.GW) * S.CELL + 5, ty = ((bot.idx / S.GW) | 0) * S.CELL + 5;
  var dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1;
  // 사람은 완벽하지 않다: 80% 효율
  return Math.random() < 0.2 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d };
}

function shop(save, log) {
  for (var guard = 0; guard < 50; guard++) {
    var o = G.offers(save), all = [].concat(o.zone, o.tool, o.crew, o.perk).filter(function (x) { return x.ok; });
    if (!all.length) break;
    var z = all.filter(function (x) { return x.kind === 'zone'; })[0];
    var t = all.filter(function (x) { return x.kind === 'tool'; })[0];
    var pick = z || t;
    if (!pick) {
      all.sort(function (a, b) { return a.cost - b.cost; });
      if (all[0].cost <= save.bank * 0.5) pick = all[0];
    }
    if (!pick) break;
    G.buy(save, pick.kind, pick.id);
    log.push(pick.kind + ':' + pick.id);
  }
}

var firsts = {};
for (var day = 1; day <= DAYS; day++) {
  var w = G.createWorld(save), bot = { idx: -1, t: 0 };
  while (!w.done) { G.step(w, 1 / 30, botInput(w, bot)); w.fx.length = 0; w.dirty.length = 0; }
  var r = G.finishDay(w), log = [];
  shop(save, log);
  log.forEach(function (k) { if (!firsts[k]) firsts[k] = r.day; });
  if (r.rankUp) firsts['rank:' + S.RANKS[r.rankUp].name] = r.day;
  if (G.canDischarge(save) && !firsts.discharge) firsts.discharge = r.day;
  console.log(('D' + r.day).padEnd(4), r.weather.padEnd(8), (r.inspect ? '순시' : '  ').padEnd(3),
    ('pct ' + Math.round(r.pct * 100) + '%').padEnd(9), r.grade, ('earn ' + r.earned).padEnd(12), ('+' + r.bonus).padEnd(9),
    ('life ' + Math.round(save.life)).padEnd(13), S.RANKS[G.rankOf(save)].name, S.TOOLS[save.tool].name.padEnd(8),
    'crew ' + G.crewCount(save), 'zones ' + Object.keys(save.zones).join(''), log.length ? '| ' + log.join(' ') : '');
}
console.log('\n처음 산 날:');
Object.keys(firsts).forEach(function (k) { console.log('  ' + k.padEnd(18) + ' D' + firsts[k]); });
