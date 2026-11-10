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
ok(w.total === 26 * 14 && w.weather === 'light', '1일차: 생활관 앞 길만, 잔설', [w.total, w.weather]);
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
ok(w6.total === 364 * 2 + 56 * 29 && w6.crew.length === 1 && w6.player.r === 15, '열린 구역·인력·도구가 하루에 반영', [w6.total, w6.crew.length]);
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
var s9 = G.newSave(); s9.life = 900000; s9.bank = 5000; s9.tool = 4; s9.crew = { hoobae: 3 }; s9.zones = { A: true, B: true, C: true };
ok(G.canDischarge(s9), '병장 + 80만이면 전역 가능');
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

console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '통과 ' + pass + '개');
process.exit(fail ? 1 : 0);
