#!/usr/bin/env node
/* 제설각 규칙 테스트 (DOM 없이) */
'use strict';
global.window = {};
require('../js/snow/data.js');
require('../js/snow/sim.js');
var S = window.JY.SNOW, G = window.JY.SnowSim, pass = 0, fail = 0;
function ok(c, name, d) { if (c) pass++; else { fail++; console.log('✗ ' + name + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } }

// 데이터
ok(S.ZONES.every(function (Z) { return Z.x % S.CELL === 0 && Z.y % S.CELL === 0 && Z.w % S.CELL === 0 && Z.h % S.CELL === 0; }), '구역이 칸에 맞는다');
ok(S.TREES.every(function (t) { return !S.ZONES.some(function (Z) { return t[0] > Z.x - 4 && t[0] < Z.x + Z.w + 4 && t[1] > Z.y - 4 && t[1] < Z.y + Z.h + 4; }); }), '나무가 구역 안에 없다');
ok(S.BUILDINGS.every(function (b) { return !S.ZONES.some(function (Z) { return b.x < Z.x + Z.w && b.x + b.w > Z.x && b.y < Z.y + Z.h && b.y + b.h > Z.y; }); }), '건물이 구역과 겹치지 않는다');
ok(!G.blocked(S.SPAWN.x, S.SPAWN.y, 6), '시작 위치가 막혀 있지 않다');
for (var i = 1; i < S.TOOLS.length; i++) ok(S.TOOLS[i].cost > S.TOOLS[i - 1].cost && S.TOOLS[i].r > S.TOOLS[i - 1].r, '도구는 비쌀수록 넓다 ' + S.TOOLS[i].id);

// 첫날
var s = G.newSave(); s.seed = 3;
var w = G.createWorld(s);
ok(w.total === 38 * 12 && w.weather === 'light', '1일차: 생활관 앞 길만, 잔설', [w.total, w.weather]);
ok(w.events.filter(function (e) { return e.k === 'deer'; }).length === 0, '1일차엔 고라니 없음');
ok(w.player.r === 10 && w.crew.length === 0, '싸리비 하나로 시작');
var b0 = s.bank, d0 = w.clear;
var got = G.clearAt(w, w.player.x, w.player.y + 6, 10, 1, 'player');
ok(got > 0 && s.bank > b0 && w.dirty.length > 0, '치우면 초코파이와 다시 그릴 칸', [got, s.bank]);
// 잠긴 구역은 안 치워진다
var Cz = S.ZONES[2], before = s.bank;
ok(G.clearAt(w, Cz.x + 50, Cz.y + 50, 30, 3, 'player') === 0 && s.bank === before, '잠긴 구역은 못 치운다');
// 걷기 + 자동 치우기
for (var k = 0; k < 60; k++) G.step(w, 1 / 30, { x: 1, y: 0 });
ok(w.player.x > S.SPAWN.x + 40 && w.clear > d0, '걸으면서 치운다', [w.player.x, w.clear]);
// 건물은 못 지나간다
var w2 = G.createWorld(s); w2.player.x = 320; w2.player.y = 130;
for (k = 0; k < 90; k++) G.step(w2, 1 / 30, { x: 0, y: -1 });
ok(w2.player.y > 108, '생활관 벽을 못 뚫는다', w2.player.y);
// 시간이 다 되면 끝
var w3 = G.createWorld(s); w3.time = w3.dayLen - 0.01; G.step(w3, 0.05, null);
ok(w3.done && !w3.early, '시간이 다 되면 하루 끝');
// 거의 다 치우면 조기 퇴근 + 보너스
var s4 = G.newSave(); s4.seed = 5; var w4 = G.createWorld(s4);
w4.cells.forEach(function (idx) { w4.depth[idx] = 0; }); w4.clear = w4.total; w4.earned = 600; w4.time = 20;
G.step(w4, 0.01, null);
var r4 = G.finishDay(w4);
ok(w4.early && r4.grade === 'S' && r4.timeBonus > 0 && r4.early, '조기 퇴근 보너스', r4);
ok(s4.day === 2, '다음 날로', s4.day);
// 눈은 계속 내린다
var s5 = G.newSave(); s5.seed = 9; s5.day = 6; var w5 = G.createWorld(s5);
w5.cells.forEach(function (idx, j) { if (j % 2 === 0 && w5.depth[idx]) { w5.depth[idx] = 0; w5.clear++; } });
w5.player.x = 30; w5.player.y = 300; var c5 = w5.clear;
for (k = 0; k < 300; k++) G.step(w5, 1 / 30, null);
ok(w5.clear < c5, '치운 곳에 눈이 다시 쌓인다', [w5.clear, c5]);

// 상점
var s6 = G.newSave(); s6.bank = 1000;
ok(G.buy(s6, 'tool', 'pusher').ok && s6.tool === 1 && s6.bank === 700, '넉가래 구매');
ok(!G.buy(s6, 'tool', 'twin').ok, '도구는 순서대로');
ok(!G.buy(s6, 'crew', 'donggi').ok, '동기는 일병부터');
ok(G.buy(s6, 'crew', 'hoobae').ok && s6.crew.hoobae === 1 && G.crewCost(S.CREW[0], 1) > S.CREW[0].cost, '후임 채용, 다음은 더 비싸다');
ok(!G.buy(s6, 'zone', 'C').ok, '구역은 순서대로');
s6.bank = 100000; ok(G.buy(s6, 'zone', 'B').ok && G.buy(s6, 'zone', 'C').ok, '구역 확장');
var w6 = G.createWorld(s6);
ok(w6.total === 456 + 450 + 46 * 28 && w6.crew.length === 1 && w6.player.r === 15, '열린 구역·인력·도구가 하루에 반영', [w6.total, w6.crew.length]);
s6.perks.gear = 2; s6.perks.song = 1; var w7 = G.createWorld(s6);
ok(Math.abs(w7.crew[0].r - 9 * 1.3) < 0.01 && w7.crew[0].speed > S.CREW[0].speed, '보급이 인력에 반영');
for (k = 0; k < 20; k++) { s6.bank = 1e9; G.buy(s6, 'crew', 'hoobae'); }
ok(s6.crew.hoobae === S.CREW[0].max, '인력은 최대 인원까지', s6.crew.hoobae);

// 진급: 하루 중에 넘어도 결과에서 알려 준다
var s7 = G.newSave(); s7.life = 2990; var w8 = G.createWorld(s7);
s7.life = 3050; var r8 = G.finishDay(w8);
ok(r8.rankUp === 1, '하루 중 진급도 알린다', r8.rankUp);

// 말년 병장은 자다가 행보관에게 걸린다
var s8 = G.newSave(); s8.seed = 2; s8.crew = { malnyeon: 3 }; s8.life = 50000; var w9 = G.createWorld(s8);
var slept = 0, woke = 0;
for (k = 0; k < 1800; k++) { G.step(w9, 1 / 30, null); w9.fx.forEach(function (f) { if (f.t === 'zzz') slept++; if (f.t === 'wake') woke++; }); w9.fx.length = 0; if (w9.done) break; }
ok(slept > 0, '말년 병장은 존다', slept);

// 전역
var s9 = G.newSave(); s9.life = 1000000; s9.bank = 5000; s9.tool = 4; s9.crew = { hoobae: 3 }; s9.zones = { A: true, B: true, C: true };
ok(G.canDischarge(s9), '병장 + 100만이면 전역 가능');
var d9 = G.discharge(s9);
ok(d9 && d9.medals === 4 && s9.medals === 4 && s9.tool === 0 && s9.bank === 0 && s9.day === 1 && !s9.zones.B && s9.discharges === 1, '전역: 메달 남고 처음부터', s9);
ok(G.incomeMult(s9) > 1.39, '메달만큼 보상 증가', G.incomeMult(s9));

// 쉬는 동안
var s10 = G.newSave(); s10.crewRate = 40; s10.last = 1000;
ok(G.offline(s10, 1000 + 60 * 1000) === 0, '5분 안에 다시 오면 없음');
ok(G.offline(s10, 1000 + 3600 * 1000) === Math.floor(40 * 3600 * 0.1), '1시간 쉬면 인력 수입의 10%');
ok(G.offline(s10, 1000 + 48 * 3600 * 1000) === Math.floor(40 * 8 * 3600 * 0.1), '최대 8시간');
// 날씨·순시
var s11 = G.newSave(); s11.day = 7; ok(G.weatherFor(s11).inspect && G.createWorld(s11).goal === S.INSPECT_GOAL, '7일마다 대대장 순시 (목표 90%)');
// 저장 데이터 복구
var m = G.migrate({ bank: 5 }); ok(m.bank === 5 && m.day === 1 && m.zones.A && m.seen, '옛 저장 데이터 보정');
ok(G.migrate(null).day === 1, '저장 없음 → 새로');


// ── 3D판: 구역 조각, 전차 자리, 방해꾼 ──
var F = G.zoneById('F'), sF = G.newSave(); sF.zones = { A: true, B: true, C: true, D: true, E: true, F: true };
var wF = G.createWorld(sF), tankIdx = G.cellIndex(S.TANKS[0].x + 20, S.TANKS[0].y + 20);
ok(wF.zone[tankIdx] === -1 && G.blocked(S.TANKS[0].x + 20, S.TANKS[0].y + 20, 6), '전차 자리는 구역이 아니고 못 지나간다');
ok(wF.parts.length === 2 + 2 + 4 + 2 + 3 + 2 && wF.parts.every(function (p) { return p.total > 0; }), '열린 구역마다 조각', wF.parts.length);
ok(wF.parts.reduce(function (a, p) { return a + p.total; }, 0) === wF.total, '모든 칸이 어느 조각엔가 속한다');
// 조각을 다 치우면 띵 + 보너스
var sP = G.newSave(); sP.seed = 4; var wP = G.createWorld(sP), part0 = wP.parts[0], bank0 = sP.bank;
for (var gy = part0.y; gy < part0.y + part0.h; gy += 10) for (var gx = part0.x; gx < part0.x + part0.w; gx += 10) G.clearAt(wP, gx + 5, gy + 5, 3, 9, 'player');
var pf = wP.fx.filter(function (f) { return f.t === 'part'; });
ok(part0.done && pf.length === 1 && pf[0].bonus > 0 && wP.partBonus === pf[0].bonus, '조각 완료 → 띵! 보너스', [part0.clear, part0.total, pf.length]);
ok(sP.bank - bank0 >= pf[0].bonus, '조각 보너스는 바로 초코파이로');
// 고라니: 인력과 부딪히면 다친다
var sD = G.newSave(); sD.seed = 6; sD.day = 5; sD.crew = { hoobae: 1 }; var wD = G.createWorld(sD);
var cr = wD.crew[0]; cr.x = 200; cr.y = 200;
G.spawn(wD, 'deer'); var deer = wD.deer[0]; deer.x = 190; deer.y = 200; deer.heading = 0; deer.turnT = 9;
G.step(wD, 1 / 30, null);
ok(cr.injured > 0 && wD.hits === 1 && wD.fx.some(function (f) { return f.t === 'deerHit'; }), '고라니에 받힌 후임은 쓰러진다', cr.injured);
var cx0 = cr.x; for (var q = 0; q < 30; q++) G.step(wD, 1 / 30, null);
ok(cr.x === cx0, '쓰러진 동안은 일을 못 한다');
// 의무병 대기는 회복을 빠르게
var sM = G.newSave(); sM.seed = 6; sM.day = 5; sM.crew = { hoobae: 1 }; sM.perks = { medic: 2 }; var wM = G.createWorld(sM);
wM.crew[0].x = 200; wM.crew[0].y = 200; G.spawn(wM, 'deer'); wM.deer[0].x = 190; wM.deer[0].y = 200; wM.deer[0].heading = 0; wM.deer[0].turnT = 9;
G.step(wM, 1 / 30, null);
ok(wM.crew[0].injured > 0 && wM.crew[0].injured < cr.injured + 1 / 30 * 31 - 0.5, '의무병 대기: 덜 다친다', [wM.crew[0].injured, cr.injured]);
// 고라니가 나를 받으면 초코파이를 떨어뜨린다
var sH = G.newSave(); sH.seed = 8; sH.day = 5; sH.bank = 1000; var wH = G.createWorld(sH); wH.earned = 2000;
G.spawn(wH, 'deer'); wH.deer[0].x = wH.player.x - 8; wH.deer[0].y = wH.player.y; wH.deer[0].heading = 0; wH.deer[0].turnT = 9;
G.step(wH, 1 / 30, null);
ok(wH.player.stun > 1 && sH.bank < 1000 && wH.lost === 1000 - sH.bank + 0 || (wH.player.stun > 1 && wH.lost > 0), '고라니에 받히면 기절 + 초코파이 떨어뜨림', [wH.player.stun, wH.lost]);
var px0 = wH.player.x; G.step(wH, 0.2, { x: 1, y: 0 }); ok(wH.player.x === px0, '기절 중엔 못 걷는다');
// 꽹과리: 고라니가 덜 온다
var sG0 = G.newSave(); sG0.day = 13; var nG0 = G.createWorld(sG0).events.filter(function (e) { return e.k === 'deer'; }).length;
var sG3 = G.newSave(); sG3.day = 13; sG3.seed = sG0.seed; sG3.perks = { gong: 3 }; var nG3 = G.createWorld(sG3).events.filter(function (e) { return e.k === 'deer'; }).length;
ok(nG0 === 4 && nG3 === 1, '꽹과리 3단계: 고라니 4 → 1', [nG0, nG3]);
// 간부 차량은 치운 진입로에 진흙눈을 뿌린다
var sC = G.newSave(); sC.seed = 12; sC.zones = { A: true, B: true, C: true, D: true, E: true }; var wC = G.createWorld(sC);
wC.cells.forEach(function (idx) { if (wC.zone[idx] === 4 && wC.depth[idx]) { wC.depth[idx] = 0; wC.clear++; wC.zoneClear[4]++; } });
var e0 = wC.zoneClear[4]; wC.player.x = 30; wC.player.y = 300; wC.events = []; G.spawn(wC, 'car');
for (q = 0; q < 300; q++) G.step(wC, 1 / 30, null);
ok(wC.zoneClear[4] < e0 - 20, '차가 지나가면 진입로가 다시 더러워진다', [e0, wC.zoneClear[4]]);
// 지붕 눈이 생활관 앞에 쏟아진다
var sR = G.newSave(); sR.seed = 2; var wR = G.createWorld(sR); wR.cells.forEach(function (idx) { if (wR.depth[idx]) { wR.depth[idx] = 0; wR.clear++; } });
var c0r = wR.clear; G.spawn(wR, 'roof');
ok(wR.clear < c0r && wR.fx.some(function (f) { return f.t === 'roof'; }), '지붕 눈 낙하', [c0r, wR.clear]);
// 헬기 하강풍은 헬기장 눈을 날려 준다
var sQ = G.newSave(); sQ.seed = 3; ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (z) { sQ.zones[z] = true; }); var wQ = G.createWorld(sQ);
var h0 = wQ.zoneClear[7]; wQ.player.x = 30; wQ.player.y = 300; wQ.events = []; G.spawn(wQ, 'heli');
for (q = 0; q < 150; q++) G.step(wQ, 1 / 30, null);
ok(wQ.zoneClear[7] > h0 + 50, '헬기 하강풍', [h0, wQ.zoneClear[7]]);
// 옛 저장(2D판 구역) 보정
var old = G.migrate({ zones: { A: true, B: true, C: true, Z: true }, tool: 99 });
ok(!old.zones.Z && old.tool === S.TOOLS.length - 1, '없는 구역·도구 정리');

console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '통과 ' + pass + '개');
process.exit(fail ? 1 : 0);
