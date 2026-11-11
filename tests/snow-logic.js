#!/usr/bin/env node
/* 제설각 규칙 테스트 (DOM 없이): 퍼 담기 → 나르기 → 붓기, 이어지는 부대, 공장, 릴레이, 방해꾼 */
'use strict';
global.window = {};
require('../js/snow/data.js');
require('../js/snow/sim.js');
var S = window.JY.SNOW, G = window.JY.SnowSim, pass = 0, fail = 0;
function ok(c, name, d) { if (c) pass++; else { fail++; console.log('✗ ' + name + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } }
function run(w, sec, inp) { for (var t = 0; t < sec; t += 1 / 30) G.step(w, 1 / 30, inp || null); }
function allOpen(s) { S.ZONES.forEach(function (Z) { s.zones[Z.id] = true; s.fresh[Z.id] = true; }); }

// ── 데이터 ──
ok(S.ZONES.every(function (Z) { return Z.x % S.CELL === 0 && Z.y % S.CELL === 0 && Z.w % S.CELL === 0 && Z.h % S.CELL === 0; }), '구역이 칸에 맞는다');
ok(S.TREES.every(function (t) { return !S.ZONES.some(function (Z) { return t[0] > Z.x - 4 && t[0] < Z.x + Z.w + 4 && t[1] > Z.y - 4 && t[1] < Z.y + Z.h + 4; }); }), '나무가 구역 안에 없다');
ok(S.BUILDINGS.every(function (b) { return !S.ZONES.some(function (Z) { return b.x < Z.x + Z.w && b.x + b.w > Z.x && b.y < Z.y + Z.h && b.y + b.h > Z.y; }); }), '건물이 구역과 겹치지 않는다');
ok(!G.blocked(S.SPAWN.x, S.SPAWN.y, 6) && !G.blocked(S.DUMP.x, S.DUMP.y, 6), '시작 위치·집하장이 막혀 있지 않다');
ok(S.ZONES.every(function (Z) { return !Z.relay || !G.blocked(Z.relay[0], Z.relay[1], 6); }), '릴레이 자리가 막혀 있지 않다');
for (var i = 1; i < S.TOOLS.length; i++) ok(S.TOOLS[i].cost > S.TOOLS[i - 1].cost && S.TOOLS[i].r > S.TOOLS[i - 1].r && S.TOOLS[i].cap > S.TOOLS[i - 1].cap, '도구는 비쌀수록 넓고 많이 담는다 ' + S.TOOLS[i].id);

// ── 첫날 ──
var s = G.newSave(); s.seed = 3;
var w = G.createWorld(s);
ok(w.total === 38 * 12 && w.weather === 'light' && w.dumps.length === 1, '처음: 생활관 앞 길 + 집하장 하나', [w.total, w.dumps.length]);
ok(w.player.cap === 40 && w.player.load === 0 && w.player.r === 10, '싸리비: 40만 담긴다');
ok(w.events.filter(function (e) { return e.k === 'deer'; }).length === 0, '1일차엔 고라니 없음');
// 퍼 담기: 돈이 아니라 짐이 된다
var b0 = s.bank, got = G.clearAt(w, w.player.x, w.player.y + 6, 10, 1, 'player', w.player);
ok(got > 0 && w.player.load === got && s.bank === b0, '치우면 초코파이가 아니라 짐이 된다', [got, w.player.load, s.bank]);
// 가득 차면 더 못 담는다
w.player.load = 40; ok(G.clearAt(w, w.player.x + 30, w.player.y + 30, 10, 1, 'player', w.player) === 0, '가득 차면 더 못 담는다');
run(w, 0.3, null);
ok(w.fx.some(function (f) { return f.t === 'full'; }), '가득 참 알림');
// 집하장에 가면 붓고 초코파이
w.player.val = 40; w.player.x = S.DUMP.x; w.player.y = S.DUMP.y + 10; var b1 = s.bank;
G.step(w, 1 / 30, null);
ok(w.player.load === 0 && s.bank > b1 && w.fx.some(function (f) { return f.t === 'dump'; }), '집하장에 부으면 초코파이', [s.bank - b1]);
// 잠긴 구역은 안 치워진다
var Cz = S.ZONES[2]; var w2 = G.createWorld(s);
ok(G.clearAt(w2, Cz.x + 50, Cz.y + 50, 30, 3, 'player', w2.player) === 0, '잠긴 구역은 못 치운다');
// 건물은 못 지나간다
w2.player.x = 260; w2.player.y = 130; for (var k = 0; k < 90; k++) G.step(w2, 1 / 30, { x: 0, y: -1 });
ok(w2.player.y > 108, '생활관 벽을 못 뚫는다', w2.player.y);

// ── 이어지는 부대: 저장하고 다시 열어도 치운 곳이 남는다 ──
var s3 = G.newSave(); s3.seed = 9; var w3 = G.createWorld(s3);
for (var q = 0; q < 200; q++) G.clearAt(w3, 90 + (q % 36) * 10, 135 + Math.floor(q / 36) * 10, 4, 9, 'player', { cap: 1e9, load: 0, val: 0 });
var c3 = w3.clear; w3.player.x = 300; w3.player.y = 200; w3.player.load = 12; w3.player.val = 12; G.serialize(w3);
var json = JSON.parse(JSON.stringify(s3)), w3b = G.createWorld(G.migrate(json));
ok(w3b.clear === c3 && w3b.player.x === 300 && w3b.player.load === 12, '저장 → 다시 열기: 치운 곳·위치·짐 그대로', [c3, w3b.clear, w3b.player.x, w3b.player.load]);
// 하루가 지나도 끝나지 않는다: 날짜·날씨만 바뀐다
w3b.time = S.DAY_LEN - 0.01; G.step(w3b, 0.05, null);
ok(w3b.save.day === 2 && !w3b.done && w3b.fx.some(function (f) { return f.t === 'day'; }), '하루가 지나면 2일차 (게임은 계속)', [w3b.save.day]);
// 눈은 계속 내린다
var s5 = G.newSave(); s5.seed = 9; var w5 = G.createWorld(s5);
w5.cells.forEach(function (idx, j) { if (j % 2 === 0 && w5.depth[idx]) { w5.depth[idx] = 0; w5.clear++; } });
w5.player.x = 30; w5.player.y = 300; var c5 = w5.clear; run(w5, 10);
ok(w5.clear < c5, '치운 곳에 눈이 다시 쌓인다', [w5.clear, c5]);

// ── 상점 ──
var s6 = G.newSave(); s6.bank = 1000;
ok(G.buy(s6, 'tool', 'pusher').ok && s6.tool === 1 && G.capOf(s6) === 80, '넉가래: 적재 80');
ok(!G.buy(s6, 'tool', 'twin').ok, '도구는 순서대로');
ok(!G.buy(s6, 'crew', 'donggi').ok, '동기는 일병부터');
ok(G.buy(s6, 'crew', 'hoobae').ok && !s6.crew.hoobae && s6.pend.length === 1, '후임 전입 요청 (바로 오지 않는다)');
ok(!G.offers(s6).crew[0].ok, '이병 정원은 1명');
s6.bank = 1e6; s6.perks.back = 2; ok(G.capOf(s6) === Math.round(80 * 1.6), '튼튼한 등짝: 적재 +30%씩', G.capOf(s6));
ok(!G.buy(s6, 'zone', 'C').ok && G.buy(s6, 'zone', 'B').ok && G.buy(s6, 'zone', 'C').ok, '구역은 순서대로 연다');
var o6 = G.offers(s6).factory;
ok(o6.some(function (x) { return x.kind === 'relay' && x.id === 'B'; }) && !o6.some(function (x) { return x.kind === 'relay' && x.id === 'D'; }), '릴레이는 연 구역에만');
ok(G.buy(s6, 'relay', 'B').ok && G.dumpsOf(s6).length === 2, '양동이 릴레이: 붓는 곳이 하나 더');
ok(!G.buy(s6, 'proc', 'sculpt').ok, '조각 작업장은 압축기 Lv3부터');
var m0 = G.incomeMult(s6); G.buy(s6, 'proc', 'press'); ok(Math.abs(G.incomeMult(s6) / m0 - 1.3) < 1e-9, '압축기: 보상 +30%', G.incomeMult(s6) / m0);
var w6 = G.createWorld(s6);
ok(w6.total === 456 + 450 + 46 * 28 && w6.crew.length === 0 && w6.recruits.length === 0 && w6.player.cap === 128, '열린 구역·도구·적재가 반영 (신병은 아직)', [w6.total, w6.crew.length, w6.player.cap]);
var fresh = 0; w6.cells.forEach(function (idx) { if (w6.zone[idx] === 2 && w6.depth[idx] >= 2) fresh++; });
ok(fresh === w6.zoneTotal[2], '새로 연 구역은 묵은 눈(깊이 2~4)으로 가득', [fresh, w6.zoneTotal[2]]);

// ── 인력: 담고 → 꽉 차면 집하장 → 붓고 → 다시 ──
var s7 = G.newSave(); s7.seed = 2; s7.crew = { hoobae: 2 }; var w7 = G.createWorld(s7); w7.player.x = 30; w7.player.y = 300;
var dumped = 0; for (q = 0; q < 2400; q++) { G.step(w7, 1 / 30, null); w7.fx.forEach(function (f) { if (f.t === 'dump' && f.src === 'crew') dumped++; }); w7.fx.length = 0; }
ok(dumped >= 2 && s7.bank > 0 && w7.crewEarned > 0, '후임이 담아서 집하장에 붓는다', [dumped, s7.bank]);
// 말년 병장은 졸다가 행보관에게 걸린다
var s8 = G.newSave(); s8.seed = 2; s8.crew = { malnyeon: 3 }; s8.life = 50000; var w8 = G.createWorld(s8), slept = 0;
for (q = 0; q < 1800; q++) { G.step(w8, 1 / 30, null); w8.fx.forEach(function (f) { if (f.t === 'zzz') slept++; }); w8.fx.length = 0; }
ok(slept > 0, '말년 병장은 존다', slept);

// ── 띵! 과 검열 ──
var sP = G.newSave(); sP.seed = 4; var wP = G.createWorld(sP), part0 = wP.parts[0], bank0 = sP.bank, bag = { cap: 1e9, load: 0, val: 0 };
for (var gy = part0.y; gy < part0.y + part0.h; gy += 10) for (var gx = part0.x; gx < part0.x + part0.w; gx += 10) G.clearAt(wP, gx + 5, gy + 5, 3, 9, 'player', bag);
var pf = wP.fx.filter(function (f) { return f.t === 'part'; });
ok(part0.done && pf.length === 1 && sP.bank - bank0 === pf[0].bonus, '조각 완료 → 띵! 보너스는 바로', [pf.length, sP.bank - bank0]);
// 다시 더러워지면 다시 띵할 수 있다
for (gy = part0.y; gy < part0.y + part0.h; gy += 10) for (gx = part0.x; gx < part0.x + part0.w; gx += 10) G.dumpAt(wP, gx + 5, gy + 5, 3, 1, 1, 3);
ok(!part0.done, '조각이 다시 덮이면 띵 초기화');
// 구역 95% → 검열 통과
var wI = G.createWorld(sP); wI.cells.forEach(function (idx) { if (wI.depth[idx]) G.clearAt(wI, (idx % S.GW) * 10 + 5, ((idx / S.GW) | 0) * 10 + 5, 3, 9, 'player', bag); });
ok(wI.fx.some(function (f) { return f.t === 'inspect'; }) && wI.inspected[0], '구역을 거의 다 치우면 행보관 검열 통과');

// ── 방해꾼 ──
var sD = G.newSave(); sD.seed = 6; sD.day = 5; sD.crew = { hoobae: 1 }; var wD = G.createWorld(sD);
var cr = wD.crew[0]; cr.x = 200; cr.y = 200; cr.load = 10; cr.val = 10;
G.spawn(wD, 'deer'); var deer = wD.deer[0]; deer.x = 190; deer.y = 200; deer.heading = 0; deer.turnT = 9;
G.step(wD, 1 / 30, null);
ok(cr.injured > 0 && cr.load === 0 && wD.hits === 1, '고라니에 받힌 후임: 쓰러지고 짐을 쏟는다', [cr.injured, cr.load]);
var sH = G.newSave(); sH.seed = 8; sH.day = 5; var wH = G.createWorld(sH); wH.player.load = 30; wH.player.val = 30;
G.spawn(wH, 'deer'); wH.deer[0].x = wH.player.x - 8; wH.deer[0].y = wH.player.y; wH.deer[0].heading = 0; wH.deer[0].turnT = 9;
var cl0 = wH.clear; G.step(wH, 1 / 30, null);
var mh = wH.fx.filter(function (f) { return f.t === 'meHit'; })[0];
ok(wH.player.stun > 1 && wH.player.load === 0 && mh && mh.spilled === 30, '고라니에 받히면 기절 + 짊어진 눈을 다 쏟는다', [wH.player.stun, mh && mh.spilled]);
var px0 = wH.player.x; G.step(wH, 0.2, { x: 1, y: 0 }); ok(wH.player.x === px0, '기절 중엔 못 걷는다');
var sG0 = G.newSave(); sG0.day = 13; var nG0 = G.createWorld(sG0).events.filter(function (e) { return e.k === 'deer'; }).length;
var sG3 = G.newSave(); sG3.day = 13; sG3.seed = sG0.seed; sG3.perks = { gong: 3 }; var nG3 = G.createWorld(sG3).events.filter(function (e) { return e.k === 'deer'; }).length;
ok(nG0 === 4 && nG3 === 1, '꽹과리 3단계: 고라니 4 → 1', [nG0, nG3]);
var sC = G.newSave(); sC.seed = 12; ['A', 'B', 'C', 'D', 'E'].forEach(function (z) { sC.zones[z] = true; sC.fresh[z] = true; }); var wC = G.createWorld(sC);
wC.cells.forEach(function (idx) { if (wC.zone[idx] === 4 && wC.depth[idx]) { wC.depth[idx] = 0; wC.clear++; wC.zoneClear[4]++; } });
var e0 = wC.zoneClear[4]; wC.player.x = 30; wC.player.y = 300; wC.events = []; G.spawn(wC, 'car'); run(wC, 10);
ok(wC.zoneClear[4] < e0 - 20, '간부 차량이 지나가면 진입로가 다시 더러워진다', [e0, wC.zoneClear[4]]);
var sQ = G.newSave(); sQ.seed = 3; allOpen(sQ); var wQ = G.createWorld(sQ);
var h0 = wQ.zoneClear[7], bq = sQ.bank; wQ.player.x = 30; wQ.player.y = 300; wQ.events = []; G.spawn(wQ, 'heli'); run(wQ, 5);
ok(wQ.zoneClear[7] > h0 + 50 && sQ.bank > bq, '헬기 하강풍: 헬기장 눈을 날려 주고 초코파이까지', [h0, wQ.zoneClear[7]]);
var F = G.createWorld(sQ), tankIdx = G.cellIndex(S.TANKS[0].x + 20, S.TANKS[0].y + 20);
ok(F.zone[tankIdx] === -1 && G.blocked(S.TANKS[0].x + 20, S.TANKS[0].y + 20, 6), '전차 자리는 구역이 아니고 못 지나간다');
ok(F.parts.reduce(function (a, p) { return a + p.total; }, 0) === F.total, '모든 칸이 어느 조각엔가 속한다');

// ── 진급·전역·쉬는 동안 ──
var sR = G.newSave(); sR.life = 1990; var wR = G.createWorld(sR); ok(wR.rank0 === 0, '이병 시작');
var s9 = G.newSave(); s9.life = 1600000; s9.bank = 5000; s9.tool = 4; s9.crew = { hoobae: 3 }; s9.zones = { A: true, B: true, C: true }; s9.proc = { press: 2 }; s9.relays = { B: true };
ok(G.canDischarge(s9), '병장 + 150만이면 전역 가능');
var d9 = G.discharge(s9);
ok(d9 && d9.medals === 5 && s9.tool === 0 && s9.bank === 0 && s9.day === 1 && !s9.zones.B && !s9.relays.B && !s9.proc.press && !s9.snow, '전역: 메달만 남고 처음부터', s9);
ok(G.incomeMult(s9) > 1.39, '메달만큼 보상 증가');
var s10 = G.newSave(); s10.crewRate = 40; s10.last = 1000;
ok(G.offline(s10, 1000 + 60 * 1000) === 0 && G.offline(s10, 1000 + 3600 * 1000) === Math.floor(40 * 3600 * 0.1) && G.offline(s10, 1000 + 48 * 3600 * 1000) === Math.floor(40 * 8 * 3600 * 0.1), '쉬는 동안: 5분 이상, 인력 수입의 10%, 최대 8시간');
// 옛 저장(하루 60초판) 보정
var old = G.migrate({ v: 2, zones: { A: true, B: true, Z: true }, tool: 99, bank: 77, day: 9 });
ok(old.v === 4 && !old.zones.Z && old.tool === S.TOOLS.length - 1 && old.bank === 77 && old.fresh.B && old.load === 0, '옛 저장 데이터 보정', old);
ok(G.migrate(null).day === 1, '저장 없음 → 새로');

// ── v6: 잠긴 구역은 못 들어간다 ──
var sL = G.newSave(); sL.seed = 4; var wL = G.createWorld(sL), B6 = S.ZONES[1];
ok(G.blocked(B6.x + 50, B6.y + 50, 6), '잠긴 족구장은 출입 통제');
wL.player.x = B6.x - 30; wL.player.y = B6.y + 40; wL.events = [];
for (var q6 = 0; q6 < 60; q6++) G.step(wL, 1 / 30, { x: 1, y: 0 });
ok(wL.player.x < B6.x && wL.fx.some(function (f) { return f.t === 'locked' && f.zone === 'B'; }), '테이프에 막히고 "출입 통제" 알림', wL.player.x);
sL.zones.B = true; sL.fresh.B = true; var wL2 = G.createWorld(sL);
ok(!G.blocked(B6.x + 50, B6.y + 50, 6), '확장하면 들어갈 수 있다');

// ── v6: 조각 100% 완벽 → 띵 + 다이아 (하루 한 번), 구역 100% → 다이아 2 ──
var sP = G.newSave(); sP.seed = 5; var wP = G.createWorld(sP); wP.events = [];
var bagP = { cap: 1e9, load: 0, val: 0 }, P0 = wP.parts[0];
for (var yy = P0.y; yy < P0.y + P0.h; yy += 10) for (var xx = P0.x; xx < P0.x + P0.w; xx += 10) { if (P0.clear >= P0.total - 1) break; G.clearAt(wP, xx + 5, yy + 5, 3, 9, 'player', bagP); }
var dia0 = sP.dia;
ok(!P0.done && P0.clear === P0.total - 1, '99%는 아직 완벽이 아니다', [P0.clear, P0.total]);
for (yy = P0.y; yy < P0.y + P0.h; yy += 10) for (xx = P0.x; xx < P0.x + P0.w; xx += 10) G.clearAt(wP, xx + 5, yy + 5, 3, 9, 'player', bagP);
ok(P0.done && sP.dia === dia0 + 1 && wP.fx.some(function (f) { return f.t === 'part' && f.perfect && f.first; }), '마지막 한 칸까지 → 완벽! 다이아 +1', [P0.done, sP.dia]);
ok(wP.fx.some(function (f) { return f.t === 'almost'; }), '85% 넘으면 "거의 다" 신호(남은 칸 반짝이)');
var P1 = wP.parts[1];
for (yy = P1.y; yy < P1.y + P1.h; yy += 10) for (xx = P1.x; xx < P1.x + P1.w; xx += 10) G.clearAt(wP, xx + 5, yy + 5, 3, 9, 'player', bagP);
ok(wP.fx.some(function (f) { return f.t === 'zonePerfect'; }) && sP.dia === dia0 + 2 + 2 + 2, '구역 100% → 구역 완벽 +2, 부대 전체 → 조기 퇴근 +2', sP.dia - dia0);
ok(wP.early && wP.fx.some(function (f) { return f.t === 'allClear'; }) && sP.boxes.length === 1, '전 구역 완벽 → 조기 퇴근 + 보급 상자');
var dP = sP.day; for (q6 = 0; q6 < 52 * 30; q6++) G.step(wP, 1 / 30, null);
ok(sP.day === dP + 1 && !wP.parts[0].done, '조기 퇴근하면 곧 다음 날 (밤새 눈이 다시 쌓인다)', [sP.day, wP.parts[0].clear, wP.parts[0].total]);
// 낮 눈은 80% 넘게 치운 조각엔 안 쌓인다
var sF = G.newSave(); sF.seed = 6; var wF = G.createWorld(sF); wF.events = []; var PF = wF.parts[0];
for (yy = PF.y; yy < PF.y + PF.h; yy += 10) for (xx = PF.x; xx < PF.x + PF.w; xx += 10) G.clearAt(wF, xx + 5, yy + 5, 3, 9, 'player', bagP);
var cF = PF.clear; wF.player.x = 900; for (q6 = 0; q6 < 60 * 30; q6++) G.step(wF, 1 / 30, null);
ok(PF.clear === cF, '다 치운 조각은 낮 눈에 안 덮인다', [cF, PF.clear]);

// ── v6: 콤보 → 값 최대 +50% ──
var sC = G.newSave(); sC.seed = 8; var wC = G.createWorld(sC); wC.events = []; wC.player.x = 100; wC.player.y = 140; wC.player.cap = 1e6;
for (q6 = 0; q6 < 4 * 30; q6++) G.step(wC, 1 / 30, { x: 1, y: 0.05 });
ok(wC.combo > 20 && G.comboMult(wC) > 1.06 && sC.bestCombo >= wC.combo, '쉬지 않고 치우면 콤보가 쌓인다', wC.combo);
for (q6 = 0; q6 < 2 * 30; q6++) G.step(wC, 1 / 30, null);
ok(wC.combo === 0, '멈추면 콤보가 끊긴다');

// ── v6: 눈 밑 분실물 ──
var sT = G.newSave(); sT.seed = 12; var wT = G.createWorld(sT);
ok(wT.treas.length >= 2 && wT.treas.every(function (t) { return wT.depth[t.idx] > 0; }), '분실물이 눈 밑에 묻혀 있다', wT.treas.length);
var t0 = wT.treas[0], bT = sT.bank; G.clearAt(wT, t0.x, t0.y, 2, 9, 'player', { cap: 1e9, load: 0, val: 0 });
ok(wT.fx.some(function (f) { return f.t === 'found'; }) && sT.found[t0.item.id] === 1 && (sT.bank > bT || sT.dia > 0), '파내면 분실물 + 보상', t0.item);
ok(G.createWorld(sT).treas.every(function (t) { return t.idx !== t0.idx; }), '찾은 건 다시 안 나온다');

// ── v6: 인력 사기 → 바닥나면 짱박힘, 배치 ──
var sM = G.newSave(); sM.seed = 3; sM.crew = { hoobae: 1 }; sM.mor = 2; var wM = G.createWorld(sM); wM.events = []; wM.haeng.x = 780; wM.haeng.y = 1180; wM.haeng.hold = 999;
for (q6 = 0; q6 < 30 * 30; q6++) G.step(wM, 1 / 30, null);
ok(wM.fx.some(function (f) { return f.t === 'slack'; }) || wM.crew[0].slack, '사기가 바닥나면 짱박힌다', wM.crew[0].mor);
var sQ = G.newSave(); sQ.seed = 3; sQ.crew = { hoobae: 2 }; sQ.zones.B = true; sQ.fresh.B = true; sQ.cpost = { hoobae: ['B', 'A'] };
var wQ = G.createWorld(sQ); wQ.events = []; wQ.crew.forEach(function (e) { G.pickTarget(wQ, e); });
ok(wQ.zone[wQ.crew[0].tidx] === 1 && wQ.zone[wQ.crew[1].tidx] === 0, '인력마다 담당 구역만 치운다', wQ.crew.map(function (e) { return e.post; }));

// ── v7: 전입 요청 → 다음 날 아침 생활관 앞 신병 → 인솔 → 구역 배치 ──
var sN = G.newSave(); sN.seed = 21; sN.bank = 5000; sN.zones.B = true; sN.fresh.B = true;
ok(G.buy(sN, 'crew', 'hoobae').ok, '전입 요청');
var wN = G.createWorld(sN); wN.events = [];
ok(wN.recruits.length === 0, '오늘은 아직 안 온다');
G.newDay(wN);
ok(wN.recruits.length === 1 && wN.fx.some(function (f) { return f.t === 'recruit'; }), '다음 날 아침 신병 도착', wN.recruits.length);
var rN = wN.recruits[0]; ok(Math.hypot(rN.x - S.DOOR.x, rN.y - S.DOOR.y) < 60, '생활관 문 앞에 서 있다');
rN.state = 'follow'; wN.player.x = 600; wN.player.y = 200; for (q6 = 0; q6 < 10 * 30; q6++) G.step(wN, 1 / 30, null);
ok(Math.hypot(rN.x - 600, rN.y - 200) < 40, '인솔하면 따라온다', [rN.x, rN.y]);
var eN = G.assignRecruit(wN, rN, 'B');
ok(eN && sN.crew.hoobae === 1 && !sN.pend.length && wN.crew.length === 1 && eN.post === 'B' && sN.cpost.hoobae[0] === 'B', '족구장에 배치 → 인력이 된다');
G.serialize(wN); var wN2 = G.createWorld(sN);
ok(wN2.crew.length === 1 && wN2.crew[0].post === 'B', '담당 구역은 저장된다');
// 정원
var sK = G.newSave(); sK.bank = 1e9; sK.life = 3000; G.buy(sK, 'crew', 'hoobae'); G.buy(sK, 'crew', 'hoobae'); G.buy(sK, 'crew', 'donggi');
ok(sK.pend.length === 3 && !G.buy(sK, 'crew', 'hoobae').ok, '일병 정원 3명 (대기 중인 신병 포함)');
// 옛 저장: 인력이 넘치면 전출 + 환불
var oldC = G.migrate({ v: 3, zones: { A: true }, crew: { hoobae: 10, plow: 2 }, bank: 0 });
ok(oldC.crew.hoobae === 4 && oldC.crew.plow === 1 && oldC.bank > 0 && oldC.v === 4, '넘치는 인력은 전출, 절반 환불', [oldC.crew, oldC.bank]);

// ── v6: 다이아 상점 ──
var sD = G.newSave(); sD.bank = 1e9; sD.life = 1e6; sD.dia = 0;
ok(!G.buy(sD, 'crew', 'cook').ok, '취사병은 다이아가 있어야 뽑는다');
sD.dia = 3; ok(G.buy(sD, 'crew', 'cook').ok && sD.dia === 2, '다이아 1 + 초코파이로 취사병');
ok(!G.buy(sD, 'star', 'star').ok && sD.toolStar === 0, '도구 강화는 다이아 3부터 (2개로는 못 한다)');
sD.dia = 50; G.buy(sD, 'star', 'star'); ok(G.toolR(sD) > S.TOOLS[0].r, '강화하면 범위가 넓어진다', G.toolR(sD));

console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '통과 ' + pass + '개');
process.exit(fail ? 1 : 0);
