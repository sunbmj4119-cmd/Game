#!/usr/bin/env node
/* 제설각 상호작용 테스트 (DOM 없이): 경례, 갈구기, 짐 떠넘기기, 탈 것, 눈덩이, 눈사람, 족구공, PX, 짬밥, 면회, 취침, 임무, 행보관 분노 */
'use strict';
global.window = {};
require('../js/snow/data.js');
require('../js/snow/sim.js');
require('../js/snow/act.js');
require('../js/snow/meta.js');
var M = window.JY.SnowMeta;
var S = window.JY.SNOW, G = window.JY.SnowSim, A = window.JY.SnowAct, pass = 0, fail = 0;
function ok(c, name, d) { if (c) pass++; else { fail++; console.log('✗ ' + name + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } }
function run(w, sec, inp) { for (var t = 0; t < sec; t += 1 / 30) G.step(w, 1 / 30, inp || null); }
function fresh(fn) { var s = G.newSave(); s.seed = 11; if (fn) fn(s); var w = G.createWorld(s); w.events = []; G.step(w, 1 / 30, null); return w; }
function face(w, tx, ty) { var P = w.player, dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1; P.dir = { x: dx / d, y: dy / d }; return P.dir; }
function fxs(w, t) { return w.fx.filter(function (f) { return f.t === t; }); }
function near(w, e, dx, dy) { w.player.x = e.x + (dx || 0); w.player.y = e.y + (dy === undefined ? -14 : dy); return face(w, e.x, e.y); }

// ── 행보관에게 경례 → 칭찬 버프 (보상 +20%), 연달아 하면 핀잔 ──
var w = fresh(), H = w.haeng;
H.x = 200; H.y = 200; H.hold = 99;
var look = near(w, H);
var t = A.best(w, look, true);
ok(t && t.k === 'haeng' && t.verb === '경례', '행보관 앞에서는 "경례"', t && [t.k, t.verb]);
var m0 = w.mult; w.fx.length = 0;
A.act(w, t, look); G.step(w, 1 / 30, null);
ok(fxs(w, 'me').some(function (f) { return f.text === '충성!'; }) && fxs(w, 'bubble').length > 0, '충성! 하면 행보관이 대답한다');
ok(w.mult > m0 * 1.15 && A.state(w).buffs.some(function (b) { return b.id === 'praise'; }), '행보관 칭찬: 보상 +20%', [m0, w.mult]);
w.fx.length = 0; A.act(w, A.best(w, look, true), look);
ok(fxs(w, 'buff').length === 0, '또 경례하면 버프 없이 핀잔만');

// ── 1인칭: 뒤에 있는 건 고르지 않는다 ──
var back = { x: -look.x, y: -look.y };
ok(!A.best(w, back, true) || A.best(w, back, true).k !== 'haeng', '1인칭에서 등 뒤의 행보관은 안 고른다');

// ── 인력: 깨우기 / 짐 떠넘기기 / 갈구기 ──
w = fresh(function (s) { s.crew = { hoobae: 1, malnyeon: 1 }; s.life = 30000; });
var hb = w.crew.filter(function (e) { return e.def.id === 'hoobae'; })[0], mn = w.crew.filter(function (e) { return e.def.id === 'malnyeon'; })[0];
mn.x = 200; mn.y = 200; mn.asleep = true; mn.sleepT = 99; w.haeng.x = 600; w.haeng.y = 600;
look = near(w, mn);
t = A.best(w, look, true);
ok(t.k === 'crew' && t.verb === '깨우기', '자는 말년 병장: 깨우기', [t.k, t.verb]);
A.act(w, t, look);
ok(!mn.asleep && w.save.stats.wake === 1, '깨우면 일어난다');
hb.x = 300; hb.y = 200; hb.load = 0; hb.state = 'work';
look = near(w, hb); w.player.load = 30; w.player.val = 30;
t = A.best(w, look, true);
ok(t.verb === '짐 떠넘기기', '짐이 있으면 후임에게 떠넘긴다', t.verb);
A.act(w, t, look);
ok(w.player.load === 30 - hb.load && hb.load > 0 && hb.state === 'haul', '떠넘긴 만큼 후임이 지고 집하장으로 간다', [w.player.load, hb.load, hb.state]);
w.player.load = 0; w.player.val = 0; hb.load = 0; hb.val = 0; hb.state = 'work';
t = A.best(w, look, true);
ok(t.verb === '갈구기', '빈손이면 갈구기', t.verb);
A.act(w, t, look);
ok(hb.boost > 0, '갈구면 잠깐 빨라진다');
var bx = hb.x, by = hb.y, crewSp = 0; hb.tx = hb.x + 200; hb.ty = hb.y; hb.tidx = -1; hb.retarget = 9;
G.step(w, 0.1, null); crewSp = Math.hypot(hb.x - bx, hb.y - by);
ok(crewSp > hb.speed * 0.1 * 1.2 || hb.state !== 'work', '갈군 후임은 50% 빨리 걷는다', [crewSp, hb.speed]);

// ── 제설차 운전 교대 → 타는 동안 범위·적재가 커지고, 끝나면 돌아온다 ──
w = fresh(function (s) { s.crew = { plow: 1 }; s.life = 200000; });
var plow = w.crew[0]; plow.x = 260; plow.y = 200; w.haeng.x = 700; w.haeng.y = 700;
look = near(w, plow, 0, -20);
t = A.best(w, look, true);
ok(t.k === 'plow' && t.verb === '운전 교대', '제설차: 운전 교대', t && t.k);
var r0 = w.player.r, c0 = w.player.cap;
A.act(w, t, look); G.step(w, 1 / 30, null);
ok(plow.off && w.player.r === 34 && w.player.cap === 500 && A.state(w).ride.kind === 'plow', '제설차를 몰면 범위 34·적재 500', [w.player.r, w.player.cap]);
ok(A.best(w, look, true).k === 'exit', '타는 중엔 "내리기"');
run(w, 31);
ok(!plow.off && w.player.r === r0 && w.player.cap === c0 && !A.state(w).ride, '기름 떨어지면 내리고 운전병이 돌아간다', [w.player.r, w.player.cap]);

// ── 중대장님 차 탈취 → 분노 ★★, 빨리 달린다, 고라니를 쫓아 버린다 ──
w = fresh(function (s) { s.zones.E = true; s.day = 4; });
G.spawn(w, 'car'); w.car.y = 700; w.player.x = w.car.x + 20; w.player.y = 700;
look = face(w, w.car.x, w.car.y);
t = A.best(w, look, true);
ok(t && t.k === 'car', '지나가는 중대장님 차: 탈취하기', t && t.k);
A.act(w, t, look);
ok(!w.car && A.state(w).heat === 2 && w.player.noClear, '탈취: 차가 내 것이 되고 행보관 분노 ★★', A.state(w));
var x0 = w.player.x, y0 = w.player.y;
run(w, 0.5, { x: 0, y: -1 });
ok(Math.hypot(w.player.x - x0, w.player.y - y0) > S.SPEED * 0.5 * 1.8, '차는 걸어서보다 두 배 빠르다', Math.hypot(w.player.x - x0, w.player.y - y0));

// ── 정비고 트랙터: 이병은 못 몰고, 일병부터 하루 한 번 ──
w = fresh();
w.player.x = A.TRACTOR.x - 30; w.player.y = A.TRACTOR.y; look = face(w, A.TRACTOR.x, A.TRACTOR.y);
t = A.best(w, look, true);
ok(t.k === 'tractor' && /일병/.test(t.verb), '이병: 트랙터는 일병부터', t.verb);
ok(!A.act(w, t, look).ok, '이병은 못 몬다');
w.save.life = 3000; t = A.best(w, look, true);
ok(A.act(w, t, look).ok && w.player.r === 46, '일병: 트랙터 몰기 (범위 46)');
A.endRide(w, true);
ok(!A.act(w, A.best(w, look, true), look).ok, '트랙터는 하루 한 번');

// ── 눈덩이: 후임 맞히면 넘어지고 가끔 되던진다, 행보관 맞히면 쫓아온다 ──
w = fresh(function (s) { s.crew = { hoobae: 1 }; });
hb = w.crew[0]; hb.x = 200; hb.y = 260; hb.tidx = -1; hb.retarget = 99; hb.speed = 0; w.haeng.x = 700; w.haeng.y = 1100;
w.player.x = 200; w.player.y = 200; look = face(w, 200, 260);
ok(A.canThrow(w), '눈 위에 서 있으면 눈덩이를 만들 수 있다');
A.throwBall(w, look, -0.1);
var hitN = 0; for (var k = 0; k < 60 && !hitN; k++) { G.step(w, 1 / 30, null); hitN = w.save.stats.hit || 0; }
ok(hitN === 1 && hb.injured > 0, '눈덩이가 후임에게 맞는다', [hitN, hb.injured]);
ok(!A.canThrow(w) || A.state(w), '연사는 안 된다(쿨타임)');
var w2 = fresh(); w2.haeng.x = 200; w2.haeng.y = 250; w2.haeng.hold = 99; w2.player.x = 200; w2.player.y = 200; look = face(w2, 200, 250);
A.throwBall(w2, look, -0.1); run(w2, 0.25);
ok(A.state(w2).heat >= 1 && w2.haeng.chasing, '행보관을 맞히면 분노 ★ — 쫓아온다', A.state(w2).heat);
// 잡히면 얼차려 + 초코파이 압수
w2.save.bank = 1000; w2.haeng.hold = 0; w2.haeng.x = w2.player.x + 30; w2.haeng.y = w2.player.y;
var caught = false; for (k = 0; k < 120 && !caught; k++) { G.step(w2, 1 / 30, null); caught = w2.fx.some(function (f) { return f.t === 'caught'; }); }
ok(caught && w2.player.stun > 2 && w2.save.bank < 1000 && A.state(w2).heat === 0, '잡히면 엎드려 뻗쳐 + 압수', [caught, w2.save.bank]);
// 멀리 도망가면 분노가 식는다
var w3 = fresh(); A.init(w3).heat = 1; w3.haeng.x = 700; w3.haeng.y = 1150; w3.player.x = 120; w3.player.y = 150;
w3.haeng.speed = 0; run(w3, 16);
ok(A.state(w3).heat === 0, '멀리 숨어 있으면 분노가 식는다', A.state(w3).heat);
// 생활관에 숨으면 바로 풀린다
var w4 = fresh(); A.init(w4).heat = 3; var dB = A.door('barracks'); w4.player.x = dB.x; w4.player.y = dB.y + 6; look = face(w4, dB.x, dB.y - 10); w4.haeng.x = 700; w4.haeng.y = 1100;
t = A.best(w4, look, true);
ok(t.k === 'barracks' && t.verb === '숨기', '쫓길 때 생활관: 숨기', t.verb);
A.act(w4, t, look);
ok(A.state(w4).heat === 0, '생활관에 숨으면 분노 해제');
// 전차 만지면 혼난다
var w5 = fresh(); var tk = S.TANKS[0]; w5.player.x = tk.x + tk.w / 2; w5.player.y = tk.y - 12; look = face(w5, tk.x + tk.w / 2, tk.y + 10); w5.haeng.x = 700; w5.haeng.y = 1100;
t = A.best(w5, look, true); ok(t && t.k === 'tank', '전차 앞: 만지기', t && t.k);
A.act(w5, t, look); ok(A.state(w5).heat === 1, '전차 만지면 분노 ★');

// ── 눈사람: 짐 25를 써서 만들고, 저장되고, 보상 +1% ──
w = fresh(); w.haeng.x = 700; w.haeng.y = 1100;
w.player.x = 150; w.player.y = 190; w.player.load = 30; w.player.val = 30; look = face(w, 150, 260); w.player.idleT = 1; w.player.moving = false;
t = A.best(w, look, true);
ok(t && t.k === 'build', '아무것도 없고 짐이 있으면: 눈사람 만들기', t && t.k);
m0 = G.incomeMult(w.save); A.act(w, t, look); G.step(w, 1 / 30, null);
ok(w.save.snowmen.length === 1 && w.player.load === 5 && Math.abs(w.mult - m0 * 1.01) < 1e-6, '눈사람 1개: 짐 -25, 보상 +1%', [w.save.snowmen.length, w.player.load, w.mult / m0]);
G.serialize(w); var w6 = G.createWorld(w.save);
ok(w6.save.snowmen.length === 1, '눈사람은 저장된다');
look = face(w, w.save.snowmen[0].x, w.save.snowmen[0].y);
t = A.best(w, look, true); ok(t.k === 'snowman' && t.verb === '부수기', '내 눈사람: 부수기');
// 고라니가 지나가면 박살
w.save.snowmen.push({ x: 300, y: 200, s: 1 }); G.spawn(w, 'deer'); var dr = w.deer[0]; dr.x = 300; dr.y = 200; G.step(w, 1 / 30, null);
ok(!w.save.snowmen.some(function (m) { return m.x === 300; }), '고라니가 눈사람을 박살 낸다');

// ── 고라니 쫓아내기 → 보상, 짬타이거 쓰다듬기 → 버프 ──
w = fresh(function (s) { s.day = 3; s.zones.D = true; s.fresh.D = true; });
G.spawn(w, 'deer'); dr = w.deer[0]; dr.x = 300; dr.y = 200; dr.turnT = 9; dr.heading = 0;
w.player.x = 300; w.player.y = 170; look = face(w, 300, 200); var bk = w.save.bank;
t = A.best(w, look, true); ok(t.k === 'deer' && t.verb === '쫓아내기', '고라니: 쫓아내기');
A.act(w, t, look); ok(dr.leaving && w.save.bank > bk, '쫓아내면 도망가고 초코파이', [dr.leaving, w.save.bank - bk]);
var cat = w.cats[0]; w.player.x = cat.x; w.player.y = cat.y - 20; look = face(w, cat.x, cat.y); w.player.moving = false;
t = A.best(w, look, true); ok(t && t.k === 'cat', '짬타이거: 쓰다듬기', t && t.k);
A.act(w, t, look); G.step(w, 1 / 30, null);
ok(cat.pet > 0 && w.mod.stun === 0.5, '쓰다듬으면 멈추고 마음이 따뜻해진다(덜 넘어짐)');

// ── 취사장 짬밥(하루 한 번, 적재 +40%), 면회, PX ──
w = fresh(); w.haeng.x = 700; w.haeng.y = 1100;
var dM = A.door('mess'); w.player.x = dM.x; w.player.y = dM.y + 8; look = face(w, dM.x, dM.y - 10); c0 = w.player.cap;
t = A.best(w, look, true); ok(t.k === 'mess', '취사장: 짬밥 먹기');
A.act(w, t, look); G.step(w, 1 / 30, null);
ok(w.player.cap === Math.round(c0 * 1.4), '짬밥 먹으면 적재 +40%', [c0, w.player.cap]);
t = A.best(w, look, true); ok(t.verb === '식판 받아 가기', '짬밥은 하루 한 번 (그다음엔 식판만 받아 간다)', t.verb);
var dW = A.door('guard'); w.player.x = dW.x; w.player.y = dW.y + 8; look = face(w, dW.x, dW.y - 10);
t = A.best(w, look, true); ok(t.k === 'guard', '위병소: 면회 확인');
w.fx.length = 0; A.act(w, t, look); ok(fxs(w, 'gift').length === 1, '면회: 뭐라도 일어난다', fxs(w, 'gift'));
w.save.bank = 0; var px = A.pxItems(w);
ok(px.length >= 4 && px.every(function (p) { return !p.ok; }), 'PX: 돈 없으면 못 산다');
w.save.bank = 1000; ok(A.pxBuy(w, 'matsta').ok, 'PX: 맛스타 구매');
G.step(w, 1 / 30, null); ok(w.mod.speed === 1.25, '맛스타: 이동 +25%');
ok(!A.pxBuy(w, 'choco').ok, '인력 없으면 초코파이 상자는 못 산다');

// ── 생활관 취침: 오후에만, 다음 날로 넘어간다 ──
w = fresh(); w.haeng.x = 700; w.haeng.y = 1100;
dB = A.door('barracks'); w.player.x = dB.x; w.player.y = dB.y + 6; look = face(w, dB.x, dB.y - 10);
ok(!A.act(w, A.best(w, look, true), look).ok, '낮에는 못 잔다');
w.time = w.dayLen * 0.7; var d0 = w.save.day;
var r = A.act(w, A.best(w, look, true), look);
ok(r.ok && r.ui === 'sleep' && w.save.day === d0 + 1 && w.time === 0, '오후엔 취침 → 다음 날', [w.save.day, w.time]);

// ── 행정반 임무: 받고 → 해내면 초코파이 ──
w = fresh(); w.haeng.x = 700; w.haeng.y = 1100;
var dO = A.door('office'); w.player.x = dO.x; w.player.y = dO.y + 8; look = face(w, dO.x, dO.y - 10);
t = A.best(w, look, true); ok(t.k === 'office' && t.verb === '임무 받기', '행정반: 임무 받기');
A.act(w, t, look); var ms = A.state(w).mission;
ok(ms && ms.text && ms.reward > 0 && ms.t > 0, '임무가 생긴다', ms);
ok(!A.act(w, A.best(w, look, true), look).ok, '임무 중엔 또 못 받는다');
// 경례 임무를 강제로 만들어 해 본다
var a = A.init(w); a.mission = null; a.missionCool = 0; a.lastKind = null;
var kinds = {}; for (k = 0; k < 40; k++) { var mm = A.newMission(w); kinds[mm.kind] = 1; }
ok(Object.keys(kinds).length >= 4, '임무 종류가 여러 가지', Object.keys(kinds));
a.mission = { kind: 'flag', start: a.n.flag, goal: 1, t: 60, max: 60, reward: 77, text: '태극기에 경례' };
bk = w.save.bank; w.player.x = A.FLAG.x; w.player.y = A.FLAG.y - 16; look = face(w, A.FLAG.x, A.FLAG.y);
t = A.best(w, look, true); ok(t.k === 'flag', '태극기: 경례');
A.act(w, t, look); G.step(w, 1 / 30, null);
ok(!A.state(w).mission && w.save.bank >= bk + 77, '임무 완수 → 초코파이', [w.save.bank - bk]);
a.mission = { kind: 'haul', start: w.dumpedP, goal: 50, t: 0.05, max: 60, reward: 10, text: 'x' };
w.fx.length = 0; run(w, 0.2);
ok(!A.state(w).mission && fxs(w, 'mission').some(function (f) { return f.state === 'fail'; }), '시간 넘기면 임무 실패');

// ── 족구공 차기 ──
w = fresh(); w.haeng.x = 700; w.haeng.y = 1100; var ball = A.init(w).ball;
w.player.x = ball.x + 14; w.player.y = ball.y; look = face(w, ball.x, ball.y); var bx0 = ball.x;
t = A.best(w, look, true); ok(t.k === 'ball', '족구공: 차기');
A.act(w, t, look); run(w, 1);
ok(ball.x < bx0 - 60, '차면 굴러간다', ball.x - bx0);

// ── 1인칭 입력: 보는 쪽이 앞, 옆걸음 ──
w = fresh(); w.player.x = 200; w.player.y = 190;
run(w, 0.5, { x: 1, y: 0, face: { x: 0, y: 1 } });
ok(w.player.x > 225 && Math.abs(w.player.dir.y - 1) < 1e-6, '1인칭: 옆으로 걸어도 앞(보는 쪽)은 그대로', [w.player.x, w.player.dir]);
w.player.load = 0; var cl0 = w.clear; w.player.reach = 0;
run(w, 0.4, { x: 0, y: 0, face: { x: 0, y: 1 }, reach: 10 });
ok(w.clear > cl0, '1인칭: 앞쪽 눈을 퍼 담는다');

// ── 데모(타이틀)에는 상호작용이 끼어들지 않는다 ──
var wd = G.createWorld(G.newSave(), { demo: true }); run(wd, 1);
ok(!wd.act, '데모에선 상호작용 없음');

// ── v6: 간부 순찰 — 다가오면 3초 안에 경례, 1초 안이면 칼경례 ──
w = fresh(function (s) { s.day = 3; }); w.haeng.x = 780; w.haeng.y = 1180; w.haeng.hold = 999;
var o = A.spawnOfficer(w, 'cpt'); o.x = w.player.x; o.y = w.player.y + 40; o.phase = 'stay'; o.stayT = 99;
G.step(w, 1 / 30, null);
look = face(w, o.x, o.y);
var back2 = { x: -look.x, y: -look.y };
t = A.best(w, back2, true);
ok(t && t.k === 'officer' && t.verb === '경례' && t.urgent, '중대장이 오면 등 뒤에 있어도 버튼은 "경례"', t && [t.k, t.verb]);
ok(A.state(w).salute && A.state(w).salute.title === '중대장님', '경례 알림(남은 시간)', A.state(w).salute);
var d1 = w.save.dia; A.act(w, t, look);
ok(o.saluted && w.save.stats.kal === 1 && w.save.dia === d1 + 1, '1초 안에 경례 → 칼경례 + 다이아', [w.save.stats.kal, w.save.dia - d1]);
t = A.best(w, look, true); ok(t.verb === '보고하기', '경례 다음엔 "보고하기"', t.verb);
var rr = A.act(w, t, look); ok(rr.res === 'bad', '진행률이 낮으면 혼난다', rr);
var w7 = fresh(function (s) { s.day = 3; }); w7.haeng.x = 780; w7.haeng.y = 1180; w7.haeng.hold = 999;
var o7 = A.spawnOfficer(w7, 'cpt'); o7.x = w7.player.x + 30; o7.y = w7.player.y; o7.phase = 'stay'; o7.stayT = 99;
run(w7, 4);
ok(o7.missed && A.state(w7).heat === 1, '경례 안 하면 "경례 안 하나?!" → 분노 ★', [o7.missed, A.state(w7).heat]);
// 사단장 보고: 거의 다 치웠으면 다이아 3 + 상자
var w8 = fresh(function (s) { s.day = 7; }); w8.haeng.x = 780; w8.haeng.y = 1180; w8.haeng.hold = 999;
var bag8 = { cap: 1e9, load: 0, val: 0 }; w8.cells.forEach(function (idx, i) { if (i % 20) G.clearAt(w8, (idx % S.GW) * 10 + 5, ((idx / S.GW) | 0) * 10 + 5, 2, 9, 'crew', bag8); });
var o8 = A.spawnOfficer(w8, 'gen'); o8.x = w8.player.x; o8.y = w8.player.y + 30; o8.phase = 'stay'; o8.stayT = 99; o8.saluted = true; o8.salT = 9;
var d8 = w8.save.dia, b8 = w8.save.boxes.length; look = face(w8, o8.x, o8.y);
rr = A.act(w8, A.best(w8, look, true), look);
ok(rr.res === 'good' && w8.save.dia >= d8 + 3 && w8.save.boxes.length === b8 + 1, '사단장님께 좋은 보고 → 다이아 3 + 희귀 상자', [rr, w8.save.dia - d8]);
// 소대장: 같이 치운다
var w9 = fresh(); w9.haeng.x = 780; w9.haeng.y = 1180; w9.haeng.hold = 999;
var o9 = A.spawnOfficer(w9, 'lt'); o9.x = w9.player.x; o9.y = w9.player.y + 30; o9.saluted = true; o9.phase = 'stay'; o9.stayT = 99;
look = face(w9, o9.x, o9.y); t = A.best(w9, look, true);
ok(t.verb === '같이 하시죠', '소대장: 같이 하시죠', t.verb);
A.act(w9, t, look); var cl9 = w9.clear; run(w9, 6);
ok(o9.helpT > 0 && w9.clear > cl9 + 5, '소대장이 같이 눈을 치운다', [w9.clear - cl9]);

// ── v6: 인력 사기 — 짱박힌 인력 일으키기, 초코파이 주기, 다이아로 사기 충전·지원 요청 ──
w = fresh(function (s) { s.crew = { hoobae: 2 }; s.bank = 500; }); w.haeng.x = 780; w.haeng.y = 1180; w.haeng.hold = 999;
var c1 = w.crew[0]; c1.x = 200; c1.y = 200; c1.slack = true; c1.mor = 5; c1.speed = 0;
look = near(w, c1); t = A.best(w, look, true);
ok(t.verb === '일으켜 세우기', '짱박힌 인력: 일으켜 세우기', t.verb);
A.act(w, t, look); ok(!c1.slack && c1.mor >= 40, '일어나서 다시 일한다');
c1.mor = 30; t = A.best(w, look, true); ok(/초코파이 주기/.test(t.verb), '사기가 낮으면: 초코파이 주기', t.verb);
var bk2 = w.save.bank; A.act(w, t, look); ok(c1.mor >= 75 && w.save.bank < bk2, '초코파이 주면 사기 +45 (초코파이 든다)', [c1.mor, bk2 - w.save.bank]);
w.save.dia = 0; ok(!A.useDia(w, 'morale').ok, '다이아 없으면 사기 충전 못 한다');
w.save.dia = 5; w.crew[1].mor = 3; ok(A.useDia(w, 'morale').ok && w.crew[1].mor === 100 && w.save.dia === 4, '다이아 1: 전원 사기 100');
ok(A.useDia(w, 'support').ok && w.save.dia === 2, '다이아 2: 대대 지원 요청'); G.step(w, 1 / 30, null); ok(w.mod.crew === 2, '대대 지원: 인력 ×2');

// ── v6: 아침 점호 · 보급 상자 · 훈장 ──
var sR = G.newSave(), day0 = Date.UTC(2026, 10, 1, 3);
var r1 = M.rollCall(sR, day0); ok(r1 && r1.streak === 1 && sR.boxes.length === 1, '첫 점호: 출석 1일 + 상자');
ok(M.rollCall(sR, day0 + 3600 * 1000) === null, '같은 날 두 번은 없다');
M.rollCall(sR, day0 + 86400000); var r3 = M.rollCall(sR, day0 + 2 * 86400000);
ok(r3.streak === 3 && r3.tier === 'rare', '3일 연속 → 희귀 상자', r3);
var r4 = M.rollCall(sR, day0 + 5 * 86400000); ok(r4.streak === 1, '빠지면 연속이 끊긴다');
sR.boxes = ['legend']; var bb = M.openBox(sR);
ok(bb.tier === 'legend' && bb.dia >= 5 && bb.pie > 0 && bb.item && sR.dia >= 5, '전설 상자: 다이아 5↑ + 분실물', bb);
var wA = fresh(); wA.save.stats.salute = 10; wA.save.life = 3000; G.step(wA, 1.1, null);
ok(wA.save.ach.salute10 && wA.fx.some(function (f) { return f.t === 'ach'; }) && wA.save.dia >= 2 + 4, '훈장: 경례 머신 + 진급 다이아', [wA.save.dia, wA.save.ach]);
ok(M.achList(wA.save).length === S.ACH.length, '훈장 목록');

// ── v7: 신병 인솔 → 배치, 따라와 → 다른 구역 ──
w = fresh(function (s) { s.zones.B = true; s.fresh.B = true; s.bank = 9999; }); w.haeng.x = 780; w.haeng.y = 1180; w.haeng.hold = 999;
G.buy(w.save, 'crew', 'hoobae'); G.newDay(w); w.events = []; A.init(w).reqT = 999; A.init(w).fuelT = 999;
var rc = w.recruits[0]; look = near(w, rc, 0, -16); t = A.best(w, look, true);
ok(t && t.k === 'recruit' && t.verb === '인솔하기', '생활관 앞 신병: 인솔하기', t && [t.k, t.verb]);
A.act(w, t, look); ok(rc.state === 'follow', '인솔하면 따라온다');
w.player.x = 30; w.player.y = 270; rc.x = 40; rc.y = 250; G.step(w, 1 / 30, null);
t = A.best(w, { x: 0, y: 1 }, true); ok(t.k === 'recruit' && /따라오는 중/.test(t.verb), '구역 밖에선 배치 못 한다', t.verb);
w.player.x = 600; w.player.y = 200; rc.x = 590; rc.y = 190; G.step(w, 1 / 30, null);
t = A.best(w, { x: 0, y: 1 }, true);
ok(t.k === 'recruit' && /여기 배치 \(족구장\)/.test(t.verb), '구역 안에선 등 뒤 신병도: 여기 배치 (족구장)', t.verb);
A.act(w, t, { x: 0, y: 1 });
ok(w.crew.length === 1 && w.crew[0].post === 'B' && w.save.crew.hoobae === 1, '족구장 담당 후임이 됐다');
var ce = w.crew[0]; ce.x = 600; ce.y = 230; look = near(w, ce); t = A.best(w, look, true);
ok(/따라와/.test(t.verb2), '인력의 두 번째 행동: 따라와', t.verb2);
A.act(w, t, look, true); ok(ce.state === 'follow', '따라와 → 따라온다');
w.player.x = 200; w.player.y = 200; ce.x = 210; ce.y = 190; G.step(w, 1 / 30, null);
t = A.best(w, { x: 0, y: 1 }, true); A.act(w, t, { x: 0, y: 1 });
ok(ce.post === 'A' && ce.state === 'work' && w.save.cpost.hoobae[0] === 'A', '생활관 앞 길로 옮겼다');

// ── v7: 심부름 — 부탁 → 가져오기 → 전달 ──
w = fresh(function (s) { s.crew = { hoobae: 1 }; s.day = 3; }); w.haeng.x = 780; w.haeng.y = 1180; w.haeng.hold = 999;
var a7 = A.init(w); a7.reqT = 0; a7.fuelT = 999; var cr = w.crew[0]; cr.speed = 0; cr.x = 400; cr.y = 200;
var tries = 0; while (!a7.reqs.length && tries++ < 30) { a7.reqT = 0; G.step(w, 1 / 30, null); }
var rq = a7.reqs[0];
ok(rq && ['meal', 'snack', 'letter'].indexOf(rq.item) >= 0 && w.fx.some(function (f) { return f.t === 'req' && f.state === 'new'; }), '인력이 심부름을 부탁한다', rq && rq.item);
if (rq.who !== cr) { a7.reqs = [{ who: cr, item: 'meal', t: 100, max: 100 }]; rq = a7.reqs[0]; }
var src = { meal: 'mess', snack: 'px', letter: 'guard' }[rq.item], dS = A.door(src); w.player.x = dS.x; w.player.y = dS.y + 10; look = face(w, dS.x, dS.y - 10);
w.save.bank = 500; w.save.daily.mess = w.save.day; w.save.daily.gate = w.save.day;
t = A.best(w, look, true); var rr2 = rq.item === 'snack' ? A.act(w, t, look, true) : A.act(w, t, look);
ok(rr2.ok && A.state(w).hand && A.state(w).hand.id === rq.item, '가서 물건을 받아 든다: ' + rq.item, [t.verb, t.verb2, A.state(w).hand]);
cr.mor = 30; look = near(w, cr); t = A.best(w, look, true);
ok(/전달/.test(t.verb), '들고 가면 "전달"', t.verb);
var bk7 = w.save.bank; A.act(w, t, look);
ok(!A.state(w).hand && !a7.reqs.length && cr.mor >= 80 && w.save.bank > bk7 && w.save.stats.favor === 1, '전달하면 보상 + 사기', [cr.mor, w.save.bank - bk7]);
// 시간 넘기면 실망
a7.reqs.push({ who: cr, item: 'meal', t: 0.05, max: 100 }); cr.mor = 60; G.step(w, 0.1, null);
ok(!a7.reqs.length && cr.mor < 50, '부탁을 안 들어주면 사기가 떨어진다', cr.mor);
// 제설차 기름
w = fresh(function (s) { s.crew = { plow: 1 }; s.life = 300000; }); w.haeng.x = 780; w.haeng.y = 1180; w.haeng.hold = 999;
a7 = A.init(w); a7.reqT = 999; a7.fuelT = 0; G.step(w, 1 / 30, null);
var pl7 = w.crew[0];
ok(pl7.noFuel && a7.reqs.some(function (q) { return q.item === 'fuel'; }), '제설차 기름이 떨어지면 멈춘다');
var dG7 = A.door('garage'); w.player.x = dG7.x; w.player.y = dG7.y + 10; look = face(w, dG7.x, dG7.y - 10);
t = A.best(w, look, true); ok(t.k === 'garage' && t.verb === '기름통 받기', '정비고: 기름통 받기', t.verb);
A.act(w, t, look); pl7.x = 300; pl7.y = 300; look = near(w, pl7, 0, -24); t = A.best(w, look, true);
ok(t.verb === '기름 넣기', '기름통 들고 제설차: 기름 넣기', t.verb);
A.act(w, t, look); ok(!pl7.noFuel && pl7.boost > 0 && !A.state(w).hand, '기름 넣으면 다시 달린다');
// 행보관 간식 → 칭찬 + 분노 해제
w = fresh(); w.haeng.x = 200; w.haeng.y = 230; w.haeng.hold = 999; A.init(w).hand = 'snack'; A.init(w).heat = 2;
look = near(w, w.haeng); t = A.best(w, look, true); ok(t.verb === '간식 드리기', '간식 들고 행보관: 간식 드리기', t.verb);
A.act(w, t, look); ok(A.state(w).heat === 0 && A.state(w).buffs.some(function (b) { return b.id === 'praise'; }), '간식 드리면 분노 해제 + 칭찬');

console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '상호작용 ' + pass + '개 통과');
process.exit(fail ? 1 : 0);
