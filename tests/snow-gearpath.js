// 무과금 장구 진행 추정 (v18): 하루 작전 N번 · 작전당 상점 N · 무료 일반 상자 3번 · 임무 100점 · 점호 상자 · 패스. 상점은 전부 고급 상자에 쓴다고 가정
// node tests/snow-gearpath.js
global.window = global; global.JY = {};
var root = require('path').join(__dirname, '..', 'js', 'snow') + '/'; require(root + 'data.js'); require(root + 'sim.js'); require(root + 'meta.js'); require(root + 'gear.js');
var S = JY.SNOW, Q = JY.SnowGear, M = JY.SnowMeta;
function run(OPS, DIA, seed) {
  var r = seed; function R() { r = (r * 16807) % 2147483647; return r / 2147483647; }
  var save = { rank: 2, dia: 0, bank: 0, boxes: [], stats: {}, daily: {}, seed: 1 }; Q.init(save);
  var seasonDone = 1, t0 = Date.UTC(2026, 0, 1, 9), legendDay = {}, out = {};
  for (var d = 0; d < 365; d++) {
    var now = t0 + d * 86400000;
    Q.onRollCall(save, now); save.boxes.push(d % 7 === 6 ? 'legend' : d % 3 === 2 ? 'rare' : 'common');
    for (var o = 0; o < OPS; o++) { save.dia += DIA; Q.onOpEnd(save, now + o * 3600e3, 2.7 > R() * 3 ? 3 : 2); }
    for (var f = 0; f < 3; f++) Q.open(save, 'basic', 'free', now + f * 4 * 3600e3 + 1, R);
    save.dia += 10; save.parts += 16; save.boxes.push('common'); Q.passXp(save, now, 50);            // 임무 100점 보상 근사
    Q.claimPass(save, now);
    save.boxes.splice(0).forEach(function (tier) { var g = Q.boxGear(save, tier, R); });
    while (save.dia >= 30) { if (!Q.open(save, 'good', 'dia', now, R)) break; }
    Q.mergeAll(save);
    var eq = S.GEAR.slots.map(function (sl) { var it = Q.equipped(save, sl.id); return it ? Q.rarIdx(it.rar) : -1; });
    ['u', 'r', 'e', 'l', 'm'].forEach(function (k, i) { if (!out[k] && eq.every(function (x) { return x >= i + 1; })) out[k] = d + 1; });
    var sd = Math.floor(now / 86400000) % 28 + 1; if (sd === 1) seasonDone = 0; if (!seasonDone && Q.pass(save, now).tier >= S.PASS.tiers) { seasonDone = sd; (out.passList = out.passList || []).push(sd); }
  }
  out.pass = out.passList ? out.passList.slice(1).reduce(function (a, b) { return a + b; }, 0) / Math.max(1, out.passList.length - 1) : 0; out.partsDay = save.parts / 365; return out;
}
[[5, 5], [10, 5], [10, 10]].forEach(function (c) {
  var rs = [1, 2, 3, 4, 5].map(function (s) { return run(c[0], c[1], s * 7919); });
  var avg = function (k) { var v = rs.map(function (x) { return x[k]; }).filter(Boolean); return v.length === rs.length ? (v.reduce(function (a, b) { return a + b; }, 0) / v.length).toFixed(0) : '>365 (' + v.length + '/5)'; };
  console.log('작전 ' + c[0] + '/일 · 상점 ' + c[1] + '/작전 → 5칸 모두 고급 ' + avg('u') + '일 · 희귀 ' + avg('r') + '일 · 영웅 ' + avg('e') + '일 · 전설 ' + avg('l') + '일 · 신화 ' + avg('m') + '일 · 패스 30단계 시즌 ' + avg('pass') + '일째 · 부품 하루 ' + avg('partsDay'));
});
