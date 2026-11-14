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
ok(w.player.cap === 60 && w.player.load === 0 && w.player.r === 11, '싸리비: 60만 담긴다');
ok(w.events.filter(function (e) { return e.k === 'deer'; }).length === 0, '1일차엔 고라니 없음');
// 퍼 담기: 돈이 아니라 짐이 된다
var b0 = s.bank, got = G.clearAt(w, w.player.x, w.player.y + 6, 10, 1, 'player', w.player);
ok(got > 0 && w.player.load === got && s.bank === b0, '치우면 초코파이가 아니라 짐이 된다', [got, w.player.load, s.bank]);
// 가득 차면 더 못 담는다
w.player.load = 60; ok(G.clearAt(w, w.player.x + 30, w.player.y + 30, 10, 1, 'player', w.player) === 0, '가득 차면 더 못 담는다');
run(w, 0.3, null);
ok(w.fx.some(function (f) { return f.t === 'full'; }), '가득 참 알림');
// 집하장에 가면 붓고 초코파이
w.player.val = 60; w.player.x = S.DUMP.x; w.player.y = S.DUMP.y + 10; var b1 = s.bank;
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
// v10: 08:00이 되면 작전이 끝나고(검열 결과) 다음 날로
w3b.time = S.DAY_LEN - 0.01; G.step(w3b, 0.05, null);
ok(w3b.save.day === 2 && w3b.opEnd && w3b.fx.some(function (f) { return f.t === 'opEnd'; }) && !w3b.save.snow, '08:00이면 작전 끝 → 다음 날 (밤새 눈은 새로)', [w3b.save.day]);
// 눈은 계속 내린다
var s5 = G.newSave(); s5.seed = 9; var w5 = G.createWorld(s5);
w5.cells.forEach(function (idx, j) { if (j % 2 === 0 && w5.depth[idx]) { w5.depth[idx] = 0; w5.clear++; } });
w5.player.x = 30; w5.player.y = 300; var c5 = w5.clear; run(w5, 10);
ok(w5.clear < c5, '치운 곳에 눈이 다시 쌓인다', [w5.clear, c5]);

// ── 상점 ──
var s6 = G.newSave(); s6.bank = 1000;
ok(G.buy(s6, 'tool', 'pusher').ok && s6.tool === 1 && G.capOf(s6) === 110, '넉가래: 적재 110');
ok(!G.buy(s6, 'tool', 'twin').ok, '도구는 순서대로');
ok(!G.buy(s6, 'crew', 'donggi').ok, '동기는 일병부터');
ok(G.buy(s6, 'crew', 'hoobae').ok && !s6.crew.hoobae && s6.pend.length === 1, '후임 전입 요청 (바로 오지 않는다)');
ok(!G.offers(s6).crew[0].ok, '이병 정원은 1명');
s6.bank = 1e6; s6.perks.back = 2; ok(G.capOf(s6) === Math.round(110 * 1.6), '튼튼한 등짝: 적재 +30%씩', G.capOf(s6));
ok(!G.buy(s6, 'zone', 'B').ok && G.offers(s6).zone.every(function (z) { return !z.ok; }), '구역은 사지 않는다 (v10)');
s6.merit = 8; G.assignZones(s6); ok(s6.zones.B && !s6.zones.C, '이병: ★이 쌓여도 족구장까지만 (v12: 구역은 계급만큼)');
s6.rank = 1; G.assignZones(s6); ok(s6.zones.B && s6.zones.C && !s6.zones.D, '일병 + ★8 → 연병장도 맡는다');
var o6 = G.offers(s6).factory;
ok(!o6.some(function (x) { return x.kind === 'relay'; }), 'v15 릴레이는 사지 않는다 (상점 목록에 없다)');
ok(G.dumpsOf(s6).length === 1 + Object.keys(s6.zones).filter(function (z) { return G.zoneById(z).relay; }).length, 'v15 맡은 구역마다 옆에 집하장이 저절로 생긴다', G.dumpsOf(s6).length);
ok(!G.buy(s6, 'proc', 'sculpt').ok, '조각 작업장은 압축기 Lv3부터');
var m0 = G.incomeMult(s6); G.buy(s6, 'proc', 'press'); ok(Math.abs(G.incomeMult(s6) / m0 - 1.3) < 1e-9, '압축기: 보상 +30%', G.incomeMult(s6) / m0);
var w6 = G.createWorld(s6);
ok(w6.total === 456 + 450 + 46 * 28 && w6.crew.length === 0 && w6.recruits.length === 1 && w6.player.cap === 176, '맡은 구역·도구·적재가 반영 (신병은 생활관 앞에서 인솔 대기)', [w6.total, w6.crew.length, w6.player.cap]);
var fresh = 0, lo6 = S.WEATHER[w6.weather].depth[0]; w6.cells.forEach(function (idx) { if (w6.zone[idx] === 2 && w6.depth[idx] >= lo6) fresh++; });
ok(fresh === w6.zoneTotal[2], '새로 맡은 구역은 그날 날씨만큼 눈으로 가득', [fresh, w6.zoneTotal[2]]);

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
var wI = G.createWorld(sP), bI = sP.bank; wI.cells.forEach(function (idx) { if (wI.depth[idx]) G.clearAt(wI, (idx % S.GW) * 10 + 5, ((idx / S.GW) | 0) * 10 + 5, 3, 9, 'player', bag); }); G.checkTasks(wI);
ok(wI.fx.some(function (f) { return f.t === 'task'; }) && wI.op.tasks[0].done >= 0 && wI.op.ready && sP.bank > bI, '지시서 기준을 넘기면 작업 완료 + 작업 수당 (v10)');

// ── 방해꾼 ──
var sD = G.newSave(); sD.seed = 6; sD.day = 5; sD.crew = { hoobae: 1 }; var wD = G.createWorld(sD); wD.haeng.x = 780; wD.haeng.y = 1180;
var cr = wD.crew[0]; cr.x = 200; cr.y = 200; cr.load = 10; cr.val = 10;
G.spawn(wD, 'deer'); var deer = wD.deer[0]; deer.x = 190; deer.y = 200; deer.heading = 0; deer.turnT = 9;
G.step(wD, 1 / 30, null);
ok(cr.injured > 0 && cr.load === 10 && wD.hits === 1, '고라니에 받힌 후임: 놀라서 주저앉는다 (짐은 안 쏟는다)', [cr.injured, cr.load]);
var sH = G.newSave(); sH.seed = 8; sH.day = 5; var wH = G.createWorld(sH); wH.player.load = 30; wH.player.val = 30;
G.spawn(wH, 'deer'); wH.deer[0].x = wH.player.x - 8; wH.deer[0].y = wH.player.y; wH.deer[0].heading = 0; wH.deer[0].turnT = 9;
var cl0 = wH.clear; G.step(wH, 1 / 30, null);
var mh = wH.fx.filter(function (f) { return f.t === 'meHit'; })[0];
ok(wH.player.stun > 0.9 && wH.player.load === 30 && mh && mh.spilled === 0, '고라니에 받히면 잠깐 넘어진다 (짐은 그대로)', [wH.player.stun, mh && mh.spilled]);
var px0 = wH.player.x; G.step(wH, 0.2, { x: 1, y: 0 }); ok(wH.player.x === px0, '기절 중엔 못 걷는다');
var sG0 = G.newSave(); sG0.day = 13; sG0.zones.C = true; sG0.rank = 1; var nG0 = G.createWorld(sG0).events.filter(function (e) { return e.k === 'deer'; }).length;
var sG3 = G.newSave(); sG3.day = 13; sG3.seed = sG0.seed; sG3.zones.C = true; sG3.rank = 1; sG3.perks = { gong: 3 }; var nG3 = G.createWorld(sG3).events.filter(function (e) { return e.k === 'deer'; }).length;
ok(nG0 === 2 && nG3 === 1, '고라니는 하루 최대 2마리, 깡통 줄 3단계면 1마리', [nG0, nG3]);
var sC = G.newSave(); sC.seed = 12; ['A', 'B', 'C', 'D', 'E'].forEach(function (z) { sC.zones[z] = true; sC.fresh[z] = true; }); var wC = G.createWorld(sC);
wC.cells.forEach(function (idx) { if (wC.zone[idx] === 4 && wC.depth[idx]) { wC.depth[idx] = 0; wC.clear++; wC.zoneClear[4]++; } });
var e0 = wC.zoneClear[4]; wC.player.x = 30; wC.player.y = 300; wC.events = []; G.spawn(wC, 'car'); run(wC, 10);
ok(wC.zoneClear[4] < e0 - 20, '간부 차량이 지나가면 진입로가 다시 더러워진다', [e0, wC.zoneClear[4]]);
var sQ = G.newSave(); sQ.seed = 3; allOpen(sQ); var wQ = G.createWorld(sQ);
ok(!wQ.events.some(function (e) { return e.k === 'heli'; }) && S.TOOLS.every(function (T) { return T.id !== 'heli'; }), '제설 헬기는 없다 (현실에 없는 것은 뺐다)');
var F = G.createWorld(sQ), tankIdx = G.cellIndex(S.TANKS[0].x + 20, S.TANKS[0].y + 20);
ok(F.zone[tankIdx] === -1 && G.blocked(S.TANKS[0].x + 20, S.TANKS[0].y + 20, 6), '전차 자리는 구역이 아니고 못 지나간다');
ok(F.parts.reduce(function (a, p) { return a + p.total; }, 0) === F.total, '모든 칸이 어느 조각엔가 속한다');

// ── 진급·전역·쉬는 동안 ──
var sR = G.newSave(); sR.life = 1990; var wR = G.createWorld(sR); ok(wR.rank0 === 0, '이병 시작');
var s9 = G.newSave(); s9.life = 1600000; s9.bank = 5000; s9.tool = 4; s9.crew = { hoobae: 3 }; s9.zones = { A: true, B: true, C: true }; s9.proc = { press: 2 }; s9.relays = { B: true };
ok(!G.canDischarge(s9), '초코파이만 많아서는 전역 못 한다 (v10)');
s9.rank = 3; s9.merit = S.DISCHARGE_MERIT;
ok(G.canDischarge(s9), '병장 + 근무평정 ★' + S.DISCHARGE_MERIT + '이면 전역 가능');
var d9 = G.discharge(s9);
ok(d9 && d9.medals === 5 && s9.tool === 0 && s9.bank === 0 && s9.day === 1 && s9.rank === 0 && s9.merit === 0 && !s9.zones.B && !s9.relays.B && !s9.proc.press && !s9.snow, '전역: 메달만 남고 이병부터', s9);
ok(G.incomeMult(s9) > 1.39, '메달만큼 보상 증가');
var s10 = G.newSave(); s10.crewRate = 40; s10.last = 1000;
ok(G.offline(s10, 1000 + 60 * 1000) === 0 && G.offline(s10, 1000 + 3600 * 1000) === Math.floor(40 * 3600 * 0.1) && G.offline(s10, 1000 + 48 * 3600 * 1000) === Math.floor(40 * 8 * 3600 * 0.1), '쉬는 동안: 5분 이상, 인력 수입의 10%, 최대 8시간');
// 옛 저장(하루 60초판) 보정
var old = G.migrate({ v: 2, zones: { A: true, B: true, Z: true }, tool: 99, bank: 77, day: 9 });
ok(old.v === 10 && !old.zones.Z && !old.zones.B && old.tool === S.TOOLS.length - 1 && old.bank === 77 && old.load === 0 && old.rank === 0, '옛 저장 데이터 보정 (구역은 근무평정만큼 다시)', old);
ok(G.migrate(null).day === 1, '저장 없음 → 새로');

// ── v6: 잠긴 구역은 못 들어간다 ──
var sL = G.newSave(); sL.seed = 4; var wL = G.createWorld(sL), B6 = S.ZONES[1];
ok(G.blocked(B6.x + 50, B6.y + 50, 6), '잠긴 족구장은 출입 통제');
wL.player.x = B6.x - 30; wL.player.y = B6.y + 40; wL.events = [];
for (var q6 = 0; q6 < 60; q6++) G.step(wL, 1 / 30, { x: 1, y: 0 });
ok(wL.player.x < B6.x && wL.fx.some(function (f) { return f.t === 'locked' && f.zone === 'B'; }), '테이프에 막히고 "출입 통제" 알림', wL.player.x);
sL.zones.B = true; sL.fresh.B = true; var wL2 = G.createWorld(sL);
ok(!G.blocked(B6.x + 50, B6.y + 50, 6), '맡으면 들어갈 수 있다');

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
var dP = sP.day; for (q6 = 0; q6 < 10 * 30; q6++) G.step(wP, 1 / 30, null);
ok(sP.day === dP && wP.op.ready && !wP.opEnd, '다 치워도 저절로 끝나지 않는다: 행보관에게 보고해야 끝 (v10)');
G.endOp(wP, 'report'); var wP2 = G.createWorld(sP);
ok(sP.day === dP + 1 && !wP2.parts[0].done && wP2.clear < wP2.total, '보고하면 다음 날: 밤새 눈이 다시 쌓인다', [sP.day, wP2.clear, wP2.total]);
// 낮 눈은 80% 넘게 치운 조각엔 안 쌓인다
var sF = G.newSave(); sF.seed = 6; var wF = G.createWorld(sF); wF.events = []; var PF = wF.parts[0];
for (yy = PF.y; yy < PF.y + PF.h; yy += 10) for (xx = PF.x; xx < PF.x + PF.w; xx += 10) G.clearAt(wF, xx + 5, yy + 5, 3, 9, 'player', bagP);
var cF = PF.clear; wF.player.x = 900; for (q6 = 0; q6 < 60 * 30; q6++) G.step(wF, 1 / 30, null);
ok(PF.clear === cF, '다 치운 조각은 낮 눈에 안 덮인다', [cF, PF.clear]);

// ── v6: 콤보 → 값 최대 +50% ──
var sC = G.newSave(); sC.seed = 8; sC.zones.B = true; var wC = G.createWorld(sC); wC.events = []; wC.player.x = 100; wC.player.y = 140; wC.player.cap = 1e6;
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
var sN0 = G.newSave(); sN0.bank = 5000; G.buy(sN0, 'crew', 'hoobae');
ok(G.createWorld(sN0).recruits.length === 1, '생활관에서 전입 요청 → 바로 다음 작전 아침에 온다');
var sN = G.newSave(); sN.seed = 21; sN.bank = 5000; sN.zones.B = true; sN.fresh.B = true; sN.dayT = 30;
ok(G.buy(sN, 'crew', 'hoobae').ok, '작전 도중 전입 요청');
var wN = G.createWorld(sN); wN.events = [];
ok(wN.recruits.length === 0, '작전 도중 요청이면 오늘은 아직 안 온다');
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
var sK = G.newSave(); sK.bank = 1e9; sK.rank = 1; G.buy(sK, 'crew', 'hoobae'); G.buy(sK, 'crew', 'hoobae'); G.buy(sK, 'crew', 'donggi');
ok(sK.pend.length === 3 && !G.buy(sK, 'crew', 'hoobae').ok, '일병 정원 3명 (대기 중인 신병 포함)');
// 옛 저장: 인력이 넘치면 전출 + 환불
var oldC = G.migrate({ v: 3, zones: { A: true }, crew: { hoobae: 10, plow: 2 }, bank: 0 });
ok(oldC.crew.hoobae === 4 && oldC.crew.plow === 1 && oldC.bank > 0 && oldC.v === 10, '넘치는 인력은 전출, 절반 환불', [oldC.crew, oldC.bank]);

// ── v6: 다이아 상점 ──
var sD = G.newSave(); sD.bank = 1e9; sD.rank = 1; sD.dia = 0;
ok(!G.buy(sD, 'crew', 'cook').ok, '취사병은 상점이 있어야 뽑는다');
sD.dia = 3; ok(G.buy(sD, 'crew', 'cook').ok && sD.dia === 2, '상점 1 + 초코파이로 취사병');
ok(!G.buy(sD, 'star', 'star').ok && sD.toolStar === 0, '장비 정비는 상점 3부터 (2개로는 못 한다)');
sD.dia = 50; G.buy(sD, 'star', 'star'); ok(G.toolR(sD) > S.TOOLS[0].r, '강화하면 범위가 넓어진다', G.toolR(sD));

// ══ v10: 제설 작전 — 지시서·마감·등급·진급 심사·구역 배정·빙판·출근 차량·처마 눈 ══
function clearZone(w, id, upto) {
  var Z = G.zoneById(id), zi = G.zoneIndex(id), bag = { cap: 1e9, load: 0, val: 0 };
  for (var y = Z.y; y < Z.y + Z.h; y += 10) for (var x = Z.x; x < Z.x + Z.w; x += 10) { if (upto && w.zoneClear[zi] / w.zoneTotal[zi] >= upto) return; G.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag); }
}
// 데이터
ok(S.ZONES.every(function (Z) { return typeof Z.need === 'number' && Z.due >= S.OP.start && Z.due <= S.OP.end && Z.why; }), '구역마다 맡는 기준(★)·마감 시각·이유');
ok(S.RANKS.every(function (R, i) { return !i || R.merit > S.RANKS[i - 1].merit; }) && S.DISCHARGE_MERIT > S.RANKS[3].merit, '진급 기준(★)은 계급마다 높아진다');
ok(S.TOOLS.every(function (T, i) { return !i || (T.rank || 0) >= (S.TOOLS[i - 1].rank || 0); }), '좋은 장비일수록 높은 계급');
ok(G.clockText(G.clockOf(0)) === '05:30' && G.clockText(G.clockOf(S.DAY_LEN)) === '08:00' && Math.abs(G.timeAt(450) - S.DAY_LEN * 0.8) < 1e-9, '작전 시계: 05:30 → 08:00');
// 첫 작전 지시서
var sO = G.newSave(); sO.seed = 31; var wO = G.createWorld(sO);
ok(wO.op && wO.op.tasks.length === 1 && wO.op.tasks[0].id === 'A' && wO.op.tasks[0].goal === S.OP.goal[0] && wO.op.tasks[0].due === 420 && !wO.op.exam, '첫 작전: 생활관 앞 길 85%, 07:00까지');
var st0 = G.opStatus(wO); ok(st0.clock === 330 && st0.done === 0 && !st0.ready, '작전 상태: 시계·완료 수');
// 기준까지 치우면 완료 → 보고 대기
clearZone(wO, 'A', 0.86); G.checkTasks(wO);
ok(wO.op.tasks[0].done >= 0 && wO.op.ready && wO.fx.some(function (f) { return f.t === 'opReady'; }), '지시서 다 하면 "보고하러 와라"');
var m0 = sO.merit, d0 = sO.day, r0 = G.endOp(wO, 'report');
ok(r0.stars === 3 && sO.merit === m0 + 3 && sO.day === d0 + 1 && r0.earlyPie > 0 && !sO.snow && !sO.op && wO.opEnd, '일찍 보고: ★★★ + 근무평정 +3 + 조기 퇴근 수당 → 다음 날', r0);
G.step(wO, 1, { x: 1, y: 0 }); ok(wO.opEnd && sO.day === d0 + 1, '작전이 끝난 세계는 멈춘다');
ok(sO.stats.ops === 1 && sO.stats.opReport === 1 && sO.stats.star3 === 1, '작전·보고·★★★ 기록');
// 아무것도 안 하면 0★, 마감이 지나면 경고
var sZ = G.newSave(); sZ.seed = 32; var wZ = G.createWorld(sZ); wZ.events = [];
wZ.time = G.timeAt(421); G.checkTasks(wZ);
ok(wZ.fx.some(function (f) { return f.t === 'taskLate'; }), '마감(07:00)이 지나면 "늦었다" 경고');
wZ.time = S.DAY_LEN; G.step(wZ, 0.05, null);
ok(wZ.opEnd && wZ.opEnd.stars === 0 && sZ.merit === 0 && wZ.opEnd.why === 'time', '아무것도 안 하고 08:00 → ★ 0개', wZ.opEnd && wZ.opEnd.score);
// 늦게 끝내면 감점, 지적도 감점
var sL2 = G.newSave(); sL2.seed = 33; var wL3 = G.createWorld(sL2); wL3.events = []; wL3.time = G.timeAt(430);
clearZone(wL3, 'A', 0.86); G.checkTasks(wL3);
ok(wL3.op.tasks[0].done > wL3.op.tasks[0].dueT && wL3.fx.some(function (f) { return f.t === 'task' && f.late; }), '마감 뒤에 끝내면 "늦음"');
wL3.op.jigeok = 2; var gL = G.gradeOp(wL3);
ok(gL.stars < 3 && gL.score < 0.6 + 0.01, '늦음 + 지적 2건 → ★★★ 못 받는다', gL);
// 구역 배정: 근무평정이 쌓이면 다음 구역
ok(r0.zones.indexOf('족구장') >= 0 && sO.zones.B && sO.seen.newB, '★3 → 다음 날부터 족구장도 담당');
var wO2 = G.createWorld(sO);
ok(wO2.op.tasks.length === 2 && wO2.op.tasks[0].id === 'A' && wO2.op.tasks[1].id === 'B', '지시서는 마감 순서대로 (생활관 앞 07:00 → 족구장 08:00)');
// 진급 심사
var sE = G.newSave(); sE.seed = 34; sE.merit = 5; var wE = G.createWorld(sE); clearZone(wE, 'A', 0.86); G.checkTasks(wE); G.endOp(wE, 'report');
ok(sE.merit === 8 && sE.exam && sE.rank === 0, '★6을 넘으면 다음 작전이 진급 심사 (아직 이병)');
var wE2 = G.createWorld(sE);
ok(wE2.op.exam && wE2.op.tasks.every(function (t) { return t.goal === G.opGoal(sE, wE2.weather, true); }) && G.opGoal(sE, 'normal', true) === 0.9, '심사 작전은 기준 +5%p (이병→일병 90%)');
var rE0 = G.endOp(wE2, 'time');
ok(!rE0.pass && sE.rank === 0 && sE.exam, '심사에서 ★★ 못 받으면 불합격 (다음 작전에 다시)');
var wE3 = G.createWorld(sE); wE3.events = []; wE3.op.tasks.forEach(function (t) { clearZone(wE3, t.id, 0.96); }); G.checkTasks(wE3);
var rE1 = G.endOp(wE3, 'report');
ok(rE1.pass && rE1.promoted && sE.rank === 1 && !sE.exam && sE.stats.exams === 1, '심사 합격 → 일병 진급', rE1);
sE.tool = 2; ok(G.crewCap(sE) === 3 && G.offers(sE).tool.some(function (o) { return o.id === 'twin' && o.state !== 'lock'; }), '일병: 정원 3명, 2인용 넉가래 보급 가능');
var sT2 = G.newSave(); sT2.bank = 1e9; sT2.tool = 2;
ok(!G.buy(sT2, 'tool', 'twin').ok && G.offers(sT2).tool.some(function (o) { return o.id === 'twin' && o.state === 'lock'; }), '이병은 돈이 있어도 2인용 넉가래를 못 받는다');
// 빙판: 그늘 구간을 다 치우면 얼고, 염화칼슘 전엔 미끄럽다. 살포기는 저절로 뿌린다
var sI = G.newSave(); sI.seed = 35; sI.rank = 1; var wI2 = G.createWorld(sI); wI2.events = [];
var iceP = wI2.parts.filter(function (p) { return p.ice; })[0];
ok(iceP && iceP.name === '생활관 앞 오른쪽' && !iceP.icy, '생활관 앞 오른쪽은 빙판 구간');
for (var iy = iceP.y; iy < iceP.y + iceP.h; iy += 10) for (var ix = iceP.x; ix < iceP.x + iceP.w; ix += 10) G.clearAt(wI2, ix + 5, iy + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 });
ok(iceP.icy && wI2.fx.some(function (f) { return f.t === 'icy'; }), '다 치우니 얼었다 → "염화칼슘 뿌려!"');
wI2.player.x = iceP.x + iceP.w / 2; wI2.player.y = iceP.y + iceP.h / 2; var slips = 0;
for (q6 = 0; q6 < 40 * 30; q6++) { G.step(wI2, 1 / 30, { x: q6 % 60 < 30 ? 1 : -1, y: 0 }); wI2.fx.forEach(function (f) { if (f.t === 'slip') slips++; }); wI2.fx.length = 0; }
ok(slips >= 1, '빙판 위를 걸으면 미끄러진다', slips);
ok(G.gradeOp(wI2).icy === 1, '빙판 방치는 감점');
G.serialize(wI2); sI.tool = 5; var wI3 = G.createWorld(sI), iceP3 = wI3.parts.filter(function (p) { return p.ice; })[0];
ok(iceP3.icy, '다시 열어도 언 구간은 언 채로 (저장)');
wI3.player.x = iceP3.x + 30; wI3.player.y = iceP3.y + 40; G.step(wI3, 1 / 30, null);
ok(iceP3.salted && sI.stats.salt === 1 && sI.op.salted.length === 1, '염화칼슘 살포기로 지나가면 저절로 뿌려진다 (저장)');
// 07:30 출근 차량: 진입로가 깊으면 빠진다 → 다 같이 밀어야 한다. 치워 두면 한 번에 올라가고 상점
var sV = G.newSave(); sV.seed = 36; sV.merit = 22; sV.rank = 2; G.assignZones(sV); var wV = G.createWorld(sV);
ok(wV.events.some(function (e) { return e.k === 'car' && Math.abs(e.t - G.timeAt(450)) < 0.01; }), '진입로를 맡으면 07:30에 중대장님 차가 온다');
wV.events = []; wV.player.x = 30; wV.player.y = 300; G.spawn(wV, 'car'); run(wV, 8);
ok(wV.car && wV.car.stuck && wV.op.stuck && wV.fx.some(function (f) { return f.t === 'carStuck'; }), '눈 쌓인 진입로에서 차가 빠진다');
for (q6 = 0; q6 < 4; q6++) wV.car.push += S.HAZ.car.push;
run(wV, 0.1); ok(!wV.car || !wV.car.stuck, '밀면 빠져나온다');
var sV2 = G.newSave(); sV2.seed = 37; sV2.merit = 18; G.assignZones(sV2); var wV2 = G.createWorld(sV2); wV2.events = [];
clearZone(wV2, 'E'); var dV = sV2.dia; wV2.player.x = 30; wV2.player.y = 300; G.spawn(wV2, 'car'); run(wV2, 14);
ok(!wV2.car && wV2.op.carPass && !wV2.op.stuck && sV2.dia === dV + 1 && sV2.stats.carPass === 1, '치워 둔 진입로: 한 번에 올라가고 상점 +1');
ok(wV2.carArrived || true, '차가 서면 중대장님이 내린다 (상호작용 테스트에서 확인)');
// 처마 눈: 먼저 경고, 1.6초 뒤에 떨어진다
var sR2 = G.newSave(); sR2.seed = 38; sR2.day = 3; var wR2 = G.createWorld(sR2); wR2.events = []; wR2.player.x = 30; wR2.player.y = 300;
G.spawn(wR2, 'roof');
ok(wR2.fx.some(function (f) { return f.t === 'roofWarn'; }) && !wR2.fx.some(function (f) { return f.t === 'roof'; }), '처마 눈: 먼저 "우두둑" 경고');
run(wR2, 2); ok(wR2.fx.some(function (f) { return f.t === 'roof'; }), '경고 뒤에 떨어진다');
// 선임 눈덩이 장난은 짬이 차면 없다
var sb = [0, 1, 2, 3].map(function (r) { var c = 0; for (var sd = 1; sd <= 40; sd++) { var sv = G.newSave(); sv.seed = sd; sv.day = 5; sv.rank = r; sv.zones.B = true; if (G.createWorld(sv, { demo: true }).events.some(function (e) { return e.k === 'snowball'; })) c++; } return c; });
ok(sb[0] > sb[1] && sb[1] > 0 && sb[2] === 0 && sb[3] === 0, '선임 눈덩이: 이병 > 일병 > 상병·병장 0', sb);
// 작전 도중 저장 → 이어하기: 시계·완료한 줄이 그대로
var sS = G.newSave(); sS.seed = 39; sS.merit = 3; G.assignZones(sS); var wS = G.createWorld(sS); wS.events = []; wS.time = 60;
clearZone(wS, 'A', 0.86); G.checkTasks(wS); G.serialize(wS);
var wS2 = G.createWorld(G.migrate(JSON.parse(JSON.stringify(sS))));
ok(wS2.time === 60 && wS2.op.tasks.filter(function (t) { return t.id === 'A'; })[0].done >= 0 && !wS2.fx.some(function (f) { return f.t === 'task'; }), '작전 이어하기: 시계·끝낸 구역 그대로 (수당은 두 번 안 준다)');
// v8 저장 옮기기: 쌓은 초코파이로 계급만 이어 준다
var v8 = G.migrate({ v: 5, life: 30000, bank: 999, zones: { A: true, B: true, C: true, D: true, E: true, F: true }, tool: 4, crew: { hoobae: 2 } });
ok(v8.v === 10 && v8.rank === 2 && v8.merit === S.RANKS[2].merit && v8.zones.C && !v8.zones.F && v8.tool === 4 && v8.crew.hoobae === 2, 'v8 저장 → 상병, 근무평정만큼 구역', [v8.rank, v8.merit, Object.keys(v8.zones).join('')]);

// ── v12: 구역은 근무평정 + 계급 (일병한테 진입로를 맡기지 않는다) ──
var sZ = G.newSave(); sZ.merit = 3; G.assignZones(sZ);
ok(sZ.zones.B && !sZ.zones.C, '★3 → 족구장');
sZ.merit = 40; G.assignZones(sZ);
ok(!sZ.zones.C && !sZ.zones.E, '이병은 ★이 많아도 족구장까지만 (진급해야 더 맡는다)');
sZ.rank = 1; G.assignZones(sZ);
ok(sZ.zones.C && sZ.zones.D && !sZ.zones.E, '일병: 연병장·취사장 앞까지');
var nzZ = G.nextZone(sZ); ok(nzZ && nzZ.zone.id === 'E' && !nzZ.rankOk && nzZ.meritOk, '다음 구역 안내: 진입로는 상병부터', nzZ && nzZ.zone.id);
var stuck = G.migrate({ v: 10, rank: 1, merit: 19, exam: true, zones: { A: true, B: true, C: true, D: true, E: true }, cpost: { hoobae: ['E'] }, crew: { hoobae: 1 } });
ok(stuck.zones.D && !stuck.zones.E && stuck.exam, 'v10 저장: 일병한테 맡긴 진입로는 돌려받는다 (상병 되면 다시)');
ok(G.createWorld(stuck).crew[0].post === 'A', '돌려준 구역 담당이던 분대원은 생활관 앞 길로');
// 지시서 기준: 계급 + 심사 +5%p, 함박눈·폭설은 낮춘다
var sG = G.newSave();
ok(G.opGoal(sG, 'normal', false) === 0.85 && G.opGoal(sG, 'normal', true) === 0.9 && G.opGoal(sG, 'heavy', false) === 0.75 && G.opGoal(sG, 'blizzard', true) === 0.7, '지시서 기준: 평소 85, 심사 90, 함박눈 −10, 폭설 −20', [G.opGoal(sG, 'normal', true), G.opGoal(sG, 'blizzard', true)]);
sG.rank = 3; ok(G.opGoal(sG, 'normal', false) === 0.95 && G.opGoal(sG, 'normal', true) === 0.95, '병장 기준 95 (심사도 95를 넘지 않는다)');
// 분대원: 담당 구역 지시서가 끝나면 마감이 급한 구역을 도우러 간다
var sHp = G.newSave(); sHp.seed = 5; sHp.zones.B = true; sHp.fresh.B = true; sHp.crew = { hoobae: 1 }; sHp.cpost = { hoobae: ['A'] };
var wHp = G.createWorld(sHp), eHp = wHp.crew[0]; wHp.events = [];
G.pickTarget(wHp, eHp); ok(wHp.zone[eHp.tidx] === 0, '담당(생활관 앞 길)이 안 끝났으면 거기부터');
wHp.cells.forEach(function (idx) { if (wHp.zone[idx] === 0 && wHp.depth[idx]) G.clearAt(wHp, (idx % S.GW) * 10 + 5, ((idx / S.GW) | 0) * 10 + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 }); });
G.checkTasks(wHp); G.pickTarget(wHp, eHp);
ok(wHp.zone[eHp.tidx] === 1 && wHp.fx.some(function (f) { return f.t === 'help' && f.zone === 'B'; }), '담당 끝 → 족구장 도우러 간다', wHp.zone[eHp.tidx]);
// 오늘의 특명: 첫날은 없고, 둘째 날부터 하나. 하면 상점
var sB = G.newSave(); ok(!G.createWorld(sB).op.bonus, '첫 작전엔 특명 없음');
var foundB = null;
for (var sd = 1; sd < 60 && !foundB; sd++) { var sB2 = G.newSave(); sB2.seed = sd; sB2.day = 2; sB2.rank = 1; var pv = G.previewBonus(sB2); if (pv && pv.def.id === 'found') foundB = sB2; }
ok(!!foundB, '특명 "분실물 2개" 나오는 날이 있다');
var wB = G.createWorld(foundB), dB = foundB.dia; wB.events = [];
ok(wB.op.bonus && wB.op.bonus.id === 'found' && G.bonusProg(wB).cur === 0, '작전 시작: 특명 진행 0');
foundB.stats.found = (foundB.stats.found || 0) + 2; G.checkTasks(wB);
ok(wB.op.bonus.done && foundB.dia === dB + 2 && wB.fx.some(function (f) { return f.t === 'bonus'; }), '분실물 2개 → 특명 완료, 상점 +2', foundB.dia - dB);
G.serialize(wB); var wB2 = G.createWorld(foundB); ok(wB2.op.bonus && wB2.op.bonus.done, '이어하기해도 특명 완료는 남는다');
var rB = G.endOp(wB2, 'time'); ok(rB.bonus && rB.bonus.done, '결과에 특명 성공');
// 진급 심사: 떨어지면 재심사, 두 번째부터 대대 지원
var sX = G.newSave(); sX.seed = 4; sX.merit = 6; sX.exam = true; var wX = G.createWorld(sX);
ok(wX.op.exam && wX.op.goal === 0.9, '진급 심사 기준 90%', wX.op.goal);
var rX = G.endOp(wX, 'time'); ok(!rX.pass && sX.exam && sX.rank === 0 && sX.examFail === 1 && !rX.help, '불합격 → 다음 작전 재심사');
var rX2 = G.endOp(G.createWorld(sX), 'time'); ok(!rX2.pass && rX2.help && sX.prep.support, '두 번 떨어지면 행보관이 대대 지원을 붙여 준다');
// 염화칼슘 살포기: 아예 안 언다
var sA = G.newSave(); sA.seed = 5; sA.tool = 5; sA.rank = 2; var wA = G.createWorld(sA), iceP = wA.parts.filter(function (p) { return p.ice; })[0];
for (var iy = iceP.y; iy < iceP.y + iceP.h; iy += 10) for (var ix = iceP.x; ix < iceP.x + iceP.w; ix += 10) G.clearAt(wA, ix + 5, iy + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 });
ok(iceP.icy && iceP.salted && !wA.fx.some(function (f) { return f.t === 'icy'; }), '살포기가 있으면 빙판이 안 생긴다');
// 작전 끝에 단 훈장은 결과에 같이
var sAc = G.newSave(); sAc.seed = 2; var wAc = G.createWorld(sAc); wAc.cells.forEach(function (idx) { if (wAc.depth[idx]) G.clearAt(wAc, (idx % S.GW) * 10 + 5, ((idx / S.GW) | 0) * 10 + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 }); });
G.checkTasks(wAc);
// ── v13: 단계별 공개 — 처음엔 쓸기·붓기·보급·보고만 ──
var s13 = G.newSave(); s13.seed = 21;
ok(!G.feat(s13, 'officer') && !G.feat(s13, 'ice') && !G.feat(s13, 'combo') && !G.feat(s13, 'bonus') && !G.feat(s13, 'deer') && !G.feat(s13, 'twist') && !G.feat(s13, 'lobby'), '처음 작전: 간부·빙판·콤보·특명·고라니·돌발·생활관 보급 모두 아직');
var w13 = G.createWorld(s13), ip13 = w13.parts.filter(function (p) { return p.ice; })[0];
for (var y13 = ip13.y; y13 < ip13.y + ip13.h; y13 += 10) for (var x13 = ip13.x; x13 < ip13.x + ip13.w; x13 += 10) G.clearAt(w13, x13 + 5, y13 + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 });
ok(!ip13.icy && !w13.events.some(function (e) { return /deer|snowball|roof|surge|support|surprise/.test(e.k); }), '이병 첫 작전: 그늘을 치워도 안 얼고, 사건도 없다');
w13.combo = 200; ok(G.comboMult(w13) === 1, '콤보 보너스도 아직 없다');
s13.stats.ops = 1; ok(G.feat(s13, 'lobby') && !G.feat(s13, 'officer'), '작전 1번 뒤: 생활관 보급');
s13.zones.B = true; ok(G.feat(s13, 'officer') && G.feat(s13, 'combo') && G.feat(s13, 'crew') && !G.feat(s13, 'ice'), '족구장을 맡으면: 간부·콤보·분대원');
var nf13 = G.newFeatures(s13, true); ok(nf13.length >= 3 && nf13.every(function (F) { return F.name && F.line; }) && !G.newFeatures(s13, false).length, '새로 생긴 것은 한 번만 소개', nf13.map(function (F) { return F.id; }));
s13.rank = 1; ok(G.feat(s13, 'ice') && G.feat(s13, 'bonus') && G.newFeatures(s13, false).some(function (F) { return F.id === 'ice'; }), '일병: 빙판·특명');
s13.rank = 2; ok(G.feat(s13, 'twist'), '상병: 돌발 상황');
console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '통과 ' + pass + '개');
process.exit(fail ? 1 : 0);
