#!/usr/bin/env node
/* 제설각 v18 오래 하는 성장 테스트 (DOM 없이): 장구류 · 보급 상자 · 출동 체력 · 일일 임무 · 복무 패스 */
'use strict';
global.window = {};
['data', 'sim', 'act', 'meta', 'gear'].forEach(function (f) { require('../js/snow/' + f + '.js'); });
var S = window.JY.SNOW, G = window.JY.SnowSim, Q = window.JY.SnowGear, pass = 0, fail = 0;
function ok(c, name, d) { if (c) pass++; else { fail++; console.log('✗ ' + name + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } }
function seq(vals) { var i = 0; return function () { return vals[i++ % vals.length]; }; }
var T0 = Date.UTC(2026, 10, 15, 3, 0, 0), H = 3600 * 1000;

// ── 장구류 ──
var s = G.newSave(); Q.init(s);
var g1 = Q.addItem(s, 'blade', 'c');
ok(s.gear.eq.blade === g1.id && Math.abs(Q.bonus(s).range - 0.05) < 1e-9, '처음 얻은 장구는 바로 낀다 (넉가래 날 보통: 범위 +5%)', Q.bonus(s));
var r0 = (function () { var t = G.newSave(); return G.toolR(t); })();
ok(G.toolR(s) === Math.round(r0 * 1.05), '낀 장구가 실제 능력에 들어간다 (범위)', [r0, G.toolR(s)]);
Q.addItem(s, 'blade', 'c'); Q.addItem(s, 'blade', 'c');
ok(Q.mergeable(s).length === 1 && Q.mergeable(s)[0].rar === 'c', '같은 칸·같은 등급 3개면 합칠 수 있다');
g1.lv = 7; var m1 = Q.merge(s, 'blade', 'c');
ok(m1 && m1.rar === 'u' && m1.lv === 7 && s.gear.eq.blade === m1.id && s.gear.items.length === 1, '합성: 보통 3 → 고급 1 (레벨은 높은 쪽을 이어받고, 끼고 있던 칸에 그대로)', m1);
for (var i = 0; i < 8; i++) Q.addItem(s, 'pack', 'c');
s.gear.items.push({ id: ++s.gear.seq, slot: 'pack', rar: 'c', lv: 1 });
var made = Q.mergeAll(s), packs = s.gear.items.filter(function (it) { return it.slot === 'pack'; });
ok(packs.length === 1 && packs[0].rar === 'r' && made.length === 4, '한 번에 합성: 보통 9 → 고급 3 → 희귀 1', packs.map(function (p) { return p.rar; }));
ok(Q.bonus(s).cap > 0.2 && G.capOf(s) > G.capOf(G.newSave()) * 1.2, '희귀 군장: 적재 +21%', Q.bonus(s).cap);
s.bank = 1e9; s.parts = 0; var up0 = Q.upgrade(s, m1.id);
ok(!up0, '정비 부품이 없으면 강화 못 한다');
s.parts = 100; var lv0 = m1.lv, c0 = Q.upCost(m1), up1 = Q.upgrade(s, m1.id);
ok(up1 && m1.lv === lv0 + 1 && s.parts === 100 - c0.parts && s.stats.gearUp === 1, '강화: 초코파이 + 정비 부품 → 레벨 +1');
m1.lv = Q.rarDef('u').maxLv; ok(!Q.upgrade(s, m1.id), '등급마다 최대 레벨 (고급 20)');
var leg = { id: 999, slot: 'patch', rar: 'l', lv: 50 }; ok(Math.abs(Q.itemStat(leg) - 0.04 * 8 * (1 + 0.012 * 49)) < 1e-9 && Q.itemStat(leg) < 0.55, '전설 부대 마크 50레벨: 초코파이 +51% (끝까지 키워도 두 배는 안 된다)', Q.itemStat(leg));

// ── 보급 상자 ──
var c = G.newSave(); Q.init(c); c.dia = 1000;
var f1 = Q.open(c, 'basic', 'free', T0, seq([0.1, 0.5, 0.2]));
ok(f1 && f1.got.length === 1 && c.dia === 1000 && c.gear.items.length === 1, '일반 상자: 무료로 하나');
ok(!Q.open(c, 'basic', 'free', T0 + 2 * H) && Q.freeIn(c, 'basic', T0 + 2 * H) === 2 * 3600, '무료는 4시간마다 (2시간 뒤엔 2시간 남음)');
ok(!!Q.open(c, 'basic', 'free', T0 + 4 * H + 1000, seq([0.3])), '4시간 지나면 또 무료');
var low = seq([0.01, 0.5, 0.5]);   // 늘 가장 흔한 등급이 나오게
for (var k = 0; k < 9; k++) Q.open(c, 'good', 'dia', T0, low);
var tenth = Q.open(c, 'good', 'dia', T0, low);
ok(tenth.got[0].item.rar === 'e' && tenth.got[0].pity && c.pity.good === 0, '고급 상자: 영웅이 안 나와도 10번째엔 영웅 확정', [tenth.got[0].item.rar, c.pity.good]);
ok(Q.pityLeft(c, 'good') === 10, '확정 카운트는 다시 10부터');
var d0 = c.dia; Q.open(c, 'elite', 'dia', T0 + 1000, low); var p1 = d0 - c.dia; d0 = c.dia; Q.open(c, 'elite', 'dia', T0 + 2000, low); var p2 = d0 - c.dia; d0 = c.dia; Q.open(c, 'elite', 'dia', T0 + 3000, low); var p3 = d0 - c.dia; d0 = c.dia; Q.open(c, 'elite', 'dia', T0 + 4000, low); var p4 = d0 - c.dia;
ok(p1 === 90 && p2 === 85 && p3 === 80 && p4 === 80, '특급 상자: 그날 살수록 싸진다 (90 → 85 → 80)', [p1, p2, p3, p4]);
d0 = c.dia; Q.open(c, 'elite', 'dia', T0 + 30 * H, low); ok(d0 - c.dia === 90, '다음 날엔 다시 90');
var c2 = G.newSave(); Q.init(c2); c2.dia = 5000; var lg = 0;
for (k = 0; k < 15; k++) { var o = Q.open(c2, 'elite', 'dia', T0, low); if (o.got[0].item.rar === 'l') lg++; }
ok(lg === 1, '특급 상자: 15번째엔 전설 확정', lg);
var c3 = G.newSave(); Q.init(c3); c3.dia = 270; var ten = Q.open(c3, 'good', 'ten', T0, Math.random);
ok(ten && ten.got.length === 10 && c3.dia === 0 && c3.gear.items.length === 10, '고급 10연: 270 (한 번에 300 → 10% 싸다)');
ok(!Q.open(c3, 'good', 'dia', T0), '상점이 모자라면 못 연다');
var b = G.newSave(); Q.init(b); b.boxes = ['legend']; var ob = window.JY.SnowMeta.openBox(b);
ok(ob.gear && ['r', 'e', 'l'].indexOf(ob.gear.rar) >= 0 && ob.parts >= 10, '예전 보급 상자(전설)에도 장구가 하나 (희귀 이상) + 부품', ob.gear);

// ── 출동 체력 ──
var e = G.newSave(); Q.init(e);
ok(Q.spend(e, T0) && Q.spend(e, T0) && Q.energy(e, T0).v === S.ENERGY.max, '이병(신병 기간)은 체력이 안 든다');
e.rank = 1;
for (k = 0; k < 5; k++) Q.spend(e, T0);
ok(Q.energy(e, T0).v === 0 && !Q.spend(e, T0) && !Q.energy(e, T0).ok, '일병부터: 작전 1번 5, 다섯 번이면 바닥');
ok(Q.energy(e, T0 + 10 * 60 * 1000).v === 1 && Q.energy(e, T0 + 50 * 60 * 1000).v === 5 && Q.spend(e, T0 + 50 * 60 * 1000), '10분에 1씩 찬다 (50분이면 한 번 더)');
ok(Q.energy(e, T0 + 30 * H).v === S.ENERGY.max, '오래 두면 최대(25)까지만');
e.dia = 200; Q.spend(e, T0 + 30 * H);
var rf1 = Q.refill(e, T0 + 30 * H), rf2 = Q.refill(e, T0 + 30 * H), rf3 = Q.refill(e, T0 + 30 * H), rf4 = Q.refill(e, T0 + 30 * H);
ok(rf1.cost === 20 && rf2.cost === 30 && rf3.cost === 50 && rf4.cost === 50 && e.energy.v > S.ENERGY.max, '상점으로 채우기: 그날 20 → 30 → 50 (넘쳐도 된다)', [rf1.cost, rf2.cost, rf3.cost, e.energy.v]);
ok(Q.refillPrice(e, T0 + 60 * H) === 20, '다음 날 채우기 값은 다시 20');
var e2 = G.newSave(); e2.rank = 1; Q.init(e2); e2.energy.v = 3; e2.energy.t = T0; Q.onRollCall(e2, T0);
ok(e2.energy.v === S.ENERGY.max, '아침 점호: 체력 가득');

// ── 일일 임무 ──
var ms = G.newSave(); ms.seed = 3; ms.rank = 1; ms.merit = 14; G.assignZones(ms); ms.stats.ops = 9; Q.init(ms);
var mi = Q.missions(ms, T0);
ok(mi.list.length === 5 && mi.pts === 0 && mi.list.every(function (q) { var d = S.MISSIONS.filter(function (x) { return x.id === q.id; })[0]; return !d.need || G.feat(ms, d.need); }), '날마다 임무 5개 (열린 기능 것만)', mi.list.map(function (q) { return q.id; }));
mi.list.forEach(function (q) { var d = S.MISSIONS.filter(function (x) { return x.id === q.id; })[0]; ms.stats[d.stat] = (ms.stats[d.stat] || 0) + d.goal; });
var mi2 = Q.missions(ms, T0 + 1000);
ok(mi2.pts === 100 && mi2.claim === 3 && Q.pass(ms, T0).xp === 5 * S.PASS.mission, '다 하면 100점 · 보상 3단계 · 패스 경험치 +10씩');
var parts0 = ms.parts, cl = Q.claimStep(ms, T0, 0);
ok(cl && ms.parts === parts0 + 6 && !Q.claimStep(ms, T0, 0), '40점 보상: 정비 부품 6 (한 번만)');
var dia0 = ms.dia; Q.claimStep(ms, T0, 2); ok(ms.dia === dia0 + 10, '100점 보상: 상점 10 + 부품 10');
var mi3 = Q.missions(ms, T0 + 26 * H); ok(mi3.pts === 0 && mi3.list.length === 5, '다음 날 새 임무');

// ── 복무 패스 ──
var ps = G.newSave(); Q.init(ps); ps.dia = 200;
Q.passXp(ps, T0, 250); var pp = Q.pass(ps, T0);
ok(pp.tier === 2 && pp.claim === 2 && !pp.prem, '100점마다 한 단계 (250점 → 2단계)', pp);
var got = Q.claimPass(ps, T0); ok(got.length === 2 && ps.boxes.length === 1 && ps.parts === 5, '무료 보상: 1단계 일반 상자, 2단계 부품 5', got);
ok(Q.buyPremium(ps, T0) && ps.dia === 50 && Q.pass(ps, T0).claim === 2, '프리미엄(상점 150): 지난 단계 보상도 받는다');
Q.claimPass(ps, T0); ok(ps.dia === 50 + 4 + 4, '프리미엄 보상: 단계마다 상점 4');
Q.passXp(ps, T0, 1e6); ok(Q.pass(ps, T0).tier === S.PASS.tiers, '패스는 30단계까지');
var later = T0 + S.PASS.season * 86400000; ok(Q.pass(ps, later).tier === 0 && !Q.pass(ps, later).prem, '28일마다 새 시즌 (단계·프리미엄 초기화)');
Q.onOpEnd(ps, later, 3); ok(Q.pass(ps, later).xp === 15, '작전 ★3 → 패스 15점');

// ── 신화: 전설 3개를 합쳐야만 (상자에서 안 나온다) ──
var my = G.newSave(); Q.init(my); my.gear.items = []; ['l', 'l', 'l'].forEach(function (r) { Q.addItem(my, 'pack', r); }); my.gear.items[1].lv = 42;
var mm = Q.merge(my, 'pack', 'l');
ok(mm && mm.rar === 'm' && mm.lv === 42 && Q.rarDef('m').maxLv === 60, '전설 3 → 신화 (레벨 이어받음, 최대 60)', mm);
['m', 'm'].forEach(function (r) { Q.addItem(my, 'pack', r); });
ok(!Q.merge(my, 'pack', 'm') && !Q.mergeable(my).length, '신화는 더 합칠 수 없다');
ok(S.CHESTS.every(function (c) { return !c.odds.m; }), '신화는 어떤 상자에서도 안 나온다');

// ── 전역해도 남는다 ──
var dz = G.newSave(); Q.init(dz); Q.addItem(dz, 'boots', 'e'); dz.parts = 33; dz.rank = 3; dz.merit = S.DISCHARGE_MERIT; dz.life = 5e6; dz.pity.good = 4;
G.discharge(dz);
ok(G.rankOf(dz) === 0 && dz.gear.items.length === 1 && dz.gear.items[0].rar === 'e' && dz.parts === 33 && dz.pity.good === 4, '전역해도 장구·부품·확정 카운트는 남는다 (복무를 돌수록 강해진다)');

console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '성장 ' + pass + '개 통과');
process.exit(fail ? 1 : 0);
