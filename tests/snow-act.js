#!/usr/bin/env node
/* 제설각 상호작용 테스트 (DOM 없이) — v10: 실제 제설 작전에 있을 법한 것만
 * 행보관(경례·장비 요청·작업 완료 보고), 간부(경례·칼경례·보고·지적), 분대원(깨우기·짐 맡기기·재촉·초코파이·따라와/배치),
 * 신병 인솔, 제설함 염화칼슘 → 빙판, 빠진 출근 차량 밀기, 정비고 기름, 고라니, 짬타이거, 난로, 구령대(상병부터),
 * 생활관(PX 준비물·상점 지원·체력단련), 점호·상자·훈장, 스토리·꾸미기, 할 일 */
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
function away(w) { w.haeng.x = 780; w.haeng.y = 1180; w.haeng.hold = 999; }
function clearZone(w, id, upto) {
  var Z = G.zoneById(id), zi = G.zoneIndex(id), bag = { cap: 1e9, load: 0, val: 0 };
  for (var y = Z.y; y < Z.y + Z.h; y += 10) for (var x = Z.x; x < Z.x + Z.w; x += 10) { if (upto && w.zoneClear[zi] / w.zoneTotal[zi] >= upto) return; G.clearAt(w, x + 5, y + 5, 3, 9, 'player', bag); }
}

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
var back = { x: -look.x, y: -look.y };
ok(!A.best(w, back, true) || A.best(w, back, true).k !== 'haeng', '1인칭에서 등 뒤의 행보관은 안 고른다');

// ── 행보관에게 장비 요청 (작전 중 보급): 초코파이·계급이 되면 바로 받는다 ──
w = fresh(function (s) { s.bank = 100; }); H = w.haeng; H.x = 200; H.y = 200; H.hold = 99; look = near(w, H);
t = A.best(w, look, true);
ok(t.verb2 === '넉가래 요청' && /150/.test(t.ask), '행보관 두 번째 행동: 넉가래 요청 (값 표시)', [t.verb2, t.ask]);
var rq0 = A.act(w, t, look, true);
ok(!rq0.ok && rq0.why === 'money' && w.save.tool === 0, '초코파이가 모자라면 못 받는다');
w.save.bank = 200; var rq1 = A.act(w, A.best(w, look, true), look, true);
ok(rq1.ok && rq1.ui === 'tool' && w.save.tool === 1 && w.save.bank === 50 && w.player.cap === 110 && fxs(w, 'toolGet').length === 1, '넉가래 요청 → 바로 지급, 적재 110');
w.save.tool = 2; w.save.bank = 1e9;
t = A.best(w, look, true);
ok(!t.verb2, '이병: 2인용 넉가래는 아직 요청 목록에 없다 (일병부터)', t.verb2);
w.save.rank = 1; t = A.best(w, look, true);
ok(t.verb2 === '2인용 넉가래 요청', '일병이 되면 요청할 수 있다', t.verb2);

// ── 작업 완료 보고: 지시서를 다 하면 행보관이 다가오고, 보고하면 작전 끝 ──
w = fresh(); H = w.haeng; H.x = 430; H.y = 190; w.player.x = 150; w.player.y = 200;
clearZone(w, 'A', 0.86); G.checkTasks(w);
ok(w.op.ready && fxs(w, 'opReady').length === 1, '지시서 완료 → "보고하러 와라"');
var dh0 = Math.hypot(H.x - w.player.x, H.y - w.player.y); run(w, 3);
ok(Math.hypot(H.x - w.player.x, H.y - w.player.y) < dh0 - 60, '행보관이 보고 받으러 다가온다', [dh0, Math.hypot(H.x - w.player.x, H.y - w.player.y)]);
look = near(w, H); t = A.best(w, { x: -look.x, y: -look.y }, true);
ok(t && t.k === 'haeng' && t.verb === '작업 완료 보고' && t.urgent, '등 뒤에 있어도 "작업 완료 보고"', t && [t.k, t.verb]);
var rp = A.act(w, t, look);
ok(rp.ok && rp.ui === 'report' && rp.res && rp.res.report && w.opEnd && w.save.day === 2, '보고 → 작전 끝 (검열 결과)', rp.res && [rp.res.stars, rp.res.why]);
ok(!A.act(w, t, look).ok, '끝난 작전에선 아무것도 못 한다');

// ── 분대원: 깨우기 / 짐 맡기기 / 재촉하기 ──
w = fresh(function (s) { s.crew = { hoobae: 1, malnyeon: 1 }; s.rank = 2; });
var hb = w.crew.filter(function (e) { return e.def.id === 'hoobae'; })[0], mn = w.crew.filter(function (e) { return e.def.id === 'malnyeon'; })[0];
mn.x = 200; mn.y = 200; mn.asleep = true; mn.sleepT = 99; away(w);
look = near(w, mn); t = A.best(w, look, true);
ok(t.k === 'crew' && t.verb === '깨우기', '자는 말년 병장: 깨우기', [t.k, t.verb]);
A.act(w, t, look); ok(!mn.asleep && w.save.stats.wake === 1, '깨우면 일어난다');
hb.x = 300; hb.y = 200; hb.load = 0; hb.state = 'work';
look = near(w, hb); w.player.load = 30; w.player.val = 30; t = A.best(w, look, true);
ok(t.verb === '짐 맡기기', '짐이 있으면 분대원에게 맡긴다', t.verb);
A.act(w, t, look);
ok(w.player.load === 30 - hb.load && hb.load > 0 && hb.state === 'haul', '맡긴 만큼 분대원이 지고 집하장으로 간다', [w.player.load, hb.load, hb.state]);
w.player.load = 0; w.player.val = 0; hb.load = 0; hb.val = 0; hb.state = 'work';
t = A.best(w, look, true); ok(t.verb === '재촉하기', '빈손이면 재촉하기', t.verb);
A.act(w, t, look); ok(hb.boost > 0, '재촉하면 잠깐 빨라진다');
var bx = hb.x, by = hb.y; hb.tx = hb.x + 200; hb.ty = hb.y; hb.tidx = -1; hb.retarget = 9;
G.step(w, 0.1, null);
ok(Math.hypot(hb.x - bx, hb.y - by) > hb.speed * 0.1 * 1.2 || hb.state !== 'work', '재촉한 분대원은 빨리 걷는다');

// ── 예전의 이상한 행동은 없다 ──
w = fresh(function (s) { s.zones.B = true; s.fresh.B = true; s.zones.E = true; s.fresh.E = true; s.crew = { plow: 1 }; s.rank = 3; });
var kinds = {}; A.candidates(w).forEach(function (c) { kinds[c.k] = 1; });
['tank', 'flag', 'decorman', 'snowman', 'ball', 'phone', 'vend', 'bar', 'px', 'mess', 'guard', 'barracks', 'office', 'tractor', 'build'].forEach(function (k) { ok(!kinds[k], '작전 중엔 "' + k + '" 상호작용이 없다'); });
ok(!A.canThrow(w) && !A.throwBall(w).ok, '눈덩이는 던지지 않는다');
G.spawn(w, 'car'); ok(!A.candidates(w).some(function (c) { return c.k === 'car'; }), '지나가는 중대장님 차는 탈취 못 한다 (빠졌을 때만 "차 밀기")');
ok(A.state(w).heat === 0 && !A.state(w).ride, '행보관 분노·운전 없음');

// ── 빠진 출근 차량: 차 밀기 (분대원도 와서 민다) ──
w = fresh(function (s) { s.merit = 18; G.assignZones(s); s.crew = { hoobae: 1 }; s.rank = 1; }); away(w);
w.player.x = 30; w.player.y = 300; G.spawn(w, 'car'); run(w, 8);
var car = w.car;
ok(car && car.stuck && w.op.stuck, '눈 쌓인 진입로 → 차가 빠졌다');
w.crew[0].x = 30; w.crew[0].y = 300; w.crew[0].speed = 0;
look = near(w, car, 0, 24); t = A.best(w, look, true);
ok(t && t.k === 'car' && t.verb === '차 밀기', '빠진 차 앞에서: 차 밀기', t && [t.k, t.verb]);
for (var pu = 0; pu < 3; pu++) A.act(w, t, look);
ok(car.stuck && Math.abs(car.push - 0.75) < 1e-9 && fxs(w, 'push').length === 3, '한 번 밀 때마다 25%', car.push);
A.act(w, t, look); run(w, 0.1);
ok(!car.stuck && car.freed && w.save.stats.carPush === 1 && w.fx.some(function (f) { return f.t === 'carFree'; }), '네 번 밀면 빠져나온다 + 기록');
run(w, 12);
ok(!w.car && A.init(w).off.some(function (o) { return o.id === 'cpt'; }), '차가 서면 중대장님이 내려서 순찰한다');
var wP2 = fresh(function (s) { s.merit = 18; G.assignZones(s); }); away(wP2); wP2.player.x = 30; wP2.player.y = 300; G.spawn(wP2, 'car'); run(wP2, 8);
var cr2 = wP2.crew; var push0 = wP2.car.push;
ok(wP2.car.stuck && push0 === 0, '혼자면 아무도 안 민다');

// ── 제설함 → 염화칼슘 포대 → 빙판에 뿌리기 ──
w = fresh(); away(w);
var ip = w.parts.filter(function (p) { return p.ice; })[0];
for (var iy = ip.y; iy < ip.y + ip.h; iy += 10) for (var ix = ip.x; ix < ip.x + ip.w; ix += 10) G.clearAt(w, ix + 5, iy + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 });
ok(ip.icy && !ip.salted, '그늘 구간이 얼었다');
var box = S.PROPS.filter(function (p) { return p.id === 'saltbox'; })[0];
w.player.x = box.ux; w.player.y = box.uy + 10; look = face(w, box.ux, box.uy - 6); t = A.best(w, look, true);
ok(t && t.k === 'saltbox' && t.verb === '염화칼슘 들기' && t.ask === '빙판 있다!', '제설함: 염화칼슘 들기 (빙판 있다!)', t && [t.k, t.verb, t.ask]);
A.act(w, t, look);
ok(A.state(w).hand && A.state(w).hand.id === 'salt', '염화칼슘 포대를 들었다');
w.player.x = 200; w.player.y = 160; G.step(w, 1 / 30, null);
ok(!A.candidates(w).some(function (c) { return c.k === 'spread'; }), '언 구간 밖에선 못 뿌린다');
w.player.x = ip.x + ip.w / 2; w.player.y = ip.y + ip.h / 2; t = A.best(w, { x: 0, y: -1 }, true);
ok(t && t.k === 'spread' && t.verb === '염화칼슘 뿌리기' && t.name === ip.name, '언 구간 안: 염화칼슘 뿌리기 (어느 쪽을 봐도)', t && [t.k, t.verb]);
A.act(w, t, { x: 0, y: -1 });
ok(ip.salted && !A.state(w).hand && w.save.stats.salt === 1 && fxs(w, 'salted').length === 1 && w.save.op.salted.length === 1, '뿌리면 빙판 처리 + 손이 빈다 + 저장');
ok(G.gradeOp(w).icy === 0, '처리한 빙판은 감점 없음');

// ── 정비고 기름통 → 제설차 ──
w = fresh(function (s) { s.crew = { plow: 1 }; s.rank = 3; }); away(w);
var a7 = A.init(w); a7.fuelT = 0; G.step(w, 1 / 30, null);
var pl7 = w.crew[0];
ok(pl7.noFuel && a7.reqs.some(function (q) { return q.item === 'fuel'; }), '제설차 기름이 떨어지면 멈춘다');
var dG7 = A.door('garage'); w.player.x = dG7.x; w.player.y = dG7.y + 10; look = face(w, dG7.x, dG7.y - 10);
t = A.best(w, look, true); ok(t.k === 'garage' && t.verb === '기름통 받기', '정비고: 기름통 받기', t.verb);
A.act(w, t, look); pl7.x = 300; pl7.y = 300; look = near(w, pl7, 0, -24); t = A.best(w, look, true);
ok(t.verb === '기름 넣기', '기름통 들고 제설차: 기름 넣기', t.verb);
A.act(w, t, look); ok(!pl7.noFuel && pl7.boost > 0 && !A.state(w).hand, '기름 넣으면 다시 달린다');
t = A.best(w, look, true); ok(t.k === 'plow' && t.verb === '따라와', '제설차는 운전병이 몬다: "따라와"로 데려간다', t.verb);
var wNo = fresh(); ok(!A.candidates(wNo).some(function (c) { return c.k === 'garage'; }), '제설차가 없으면 정비고에 볼일 없다');

// ── 고라니 쫓기 · 짬타이거 · 난로 · 구령대(상병부터) ──
w = fresh(function (s) { s.day = 5; }); away(w); G.spawn(w, 'deer');
var dr = w.deer[0]; dr.x = w.player.x + 20; dr.y = w.player.y; dr.turnT = 9; dr.hitT = 9;
look = face(w, dr.x, dr.y); t = A.best(w, look, true); var bD = w.save.bank;
ok(t.k === 'deer' && t.verb === '쫓아내기', '고라니: 쫓아내기');
A.act(w, t, look); ok(dr.leaving && w.save.bank > bD && w.save.stats.shoo === 1, '쫓아내면 도망가고 초코파이');
var stv = S.PROPS.filter(function (p) { return p.id === 'stove'; })[0]; w.player.x = stv.ux; w.player.y = stv.uy + 12; look = face(w, stv.ux, stv.uy - 10);
t = A.best(w, look, true); A.act(w, t, look); G.step(w, 1 / 30, null);
ok(t.k === 'stove' && A.state(w).buffs.some(function (b) { return b.id === 'warm'; }) && w.mod.hit < 1, '드럼통 난로: 몸 녹이기 → 손이 빨라진다');
w = fresh(function (s) { s.zones.D = true; s.fresh.D = true; }); away(w);
var cat = w.cats[0]; look = near(w, cat, 0, -10); t = A.best(w, look, true);
A.act(w, t, look); ok(t.k === 'cat' && t.verb === '쓰다듬기' && w.save.stats.pet === 1 && !A.state(w).buffs.length, '짬타이거: 쓰다듬기 (버프 없이 힐링만)');
var wS = fresh(function (s) { s.crew = { hoobae: 2 }; s.rank = 1; }); away(wS);
ok(!A.candidates(wS).some(function (c) { return c.k === 'stand'; }), '일병까지는 구령대에서 구령 못 한다');
wS.save.rank = 2; ok(A.candidates(wS).some(function (c) { return c.k === 'stand'; }), '상병(조장)부터 구령대: 구령하기');
var stc = A.candidates(wS).filter(function (c) { return c.k === 'stand'; })[0];
A.act(wS, stc, face(wS, stc.x, stc.y)); G.step(wS, 1 / 30, null);
ok(wS.mod.crew >= 1.25 && wS.crew.every(function (c) { return c.mor >= 80; }), '구령하면 분대원 +25%, 사기 +25');

// ── 1인칭 입력: 보는 쪽이 앞, 옆걸음 ──
w = fresh(); w.player.x = 200; w.player.y = 190;
run(w, 0.5, { x: 1, y: 0, face: { x: 0, y: 1 } });
ok(w.player.x > 225 && Math.abs(w.player.dir.y - 1) < 1e-6, '1인칭: 옆으로 걸어도 앞(보는 쪽)은 그대로', [w.player.x, w.player.dir]);
w.player.load = 0; var cl0 = w.clear; w.player.reach = 0;
run(w, 0.4, { x: 0, y: 0, face: { x: 0, y: 1 }, reach: 10 });
ok(w.clear > cl0, '1인칭: 앞쪽 눈을 퍼 담는다');
var wd = G.createWorld(G.newSave(), { demo: true }); run(wd, 1);
ok(!wd.act, '데모에선 상호작용 없음');

// ── 간부 순찰 — 다가오면 3.5초 안에 경례, 1.2초 안이면 칼경례. 안 하면 지적(감점) ──
w = fresh(function (s) { s.day = 3; }); away(w);
var o = A.spawnOfficer(w, 'cpt'); o.x = w.player.x; o.y = w.player.y + 40; o.phase = 'stay'; o.stayT = 99;
G.step(w, 1 / 30, null);
look = face(w, o.x, o.y); t = A.best(w, { x: -look.x, y: -look.y }, true);
ok(t && t.k === 'officer' && t.verb === '경례' && t.urgent, '중대장이 오면 등 뒤에 있어도 버튼은 "경례"', t && [t.k, t.verb]);
ok(A.state(w).salute && A.state(w).salute.title === '중대장님', '경례 알림(남은 시간)');
var d1 = w.save.dia; A.act(w, t, look);
ok(o.saluted && w.save.stats.kal === 1 && w.save.dia === d1 + 1, '1초 안에 경례 → 칼경례 + 상점', [w.save.stats.kal, w.save.dia - d1]);
t = A.best(w, look, true); ok(t.verb === '보고하기', '경례 다음엔 "보고하기"', t.verb);
var rr = A.act(w, t, look); ok(rr.res === 'bad', '지시서 진행이 낮으면 혼난다', rr);
var w7 = fresh(function (s) { s.day = 3; }); away(w7);
var o7 = A.spawnOfficer(w7, 'cpt'); o7.x = w7.player.x + 30; o7.y = w7.player.y; o7.phase = 'stay'; o7.stayT = 99;
run(w7, 4);
ok(o7.missed && w7.op.jigeok === 1 && A.state(w7).heat === 0 && w7.fx.some(function (f) { return f.t === 'jigeok'; }), '경례 안 하면 지적 1건 (쫓아오지는 않는다)', [o7.missed, w7.op.jigeok]);
clearZone(w7, 'A', 0.86); G.checkTasks(w7); var gj1 = G.gradeOp(w7).score; w7.op.jigeok = 0; var gj0 = G.gradeOp(w7).score; w7.op.jigeok = 1;
ok(Math.abs(gj0 - gj1 - 0.05) < 1e-9, '지적 1건 = 등급 -5%', [gj0, gj1]);
var w8 = fresh(function (s) { s.day = 7; }); away(w8); clearZone(w8, 'A', 0.86); G.checkTasks(w8);
var o8 = A.spawnOfficer(w8, 'gen'); o8.x = w8.player.x; o8.y = w8.player.y + 30; o8.phase = 'stay'; o8.stayT = 99; o8.saluted = true; o8.salT = 9;
var d8 = w8.save.dia, b8 = w8.save.boxes.length; look = face(w8, o8.x, o8.y);
rr = A.act(w8, A.best(w8, look, true), look);
ok(rr.res === 'good' && w8.save.dia >= d8 + 3 && w8.save.boxes.length === b8 + 1, '지시서를 다 하고 사단장님께 보고 → 상점 3 + 희귀 상자', [rr, w8.save.dia - d8]);
var w9 = fresh(); away(w9);
var o9 = A.spawnOfficer(w9, 'lt'); o9.x = w9.player.x; o9.y = w9.player.y + 30; o9.saluted = true; o9.phase = 'stay'; o9.stayT = 99;
look = face(w9, o9.x, o9.y); t = A.best(w9, look, true);
ok(t.verb === '같이 하시죠', '소대장: 같이 하시죠', t.verb);
A.act(w9, t, look); var cl9 = w9.clear; run(w9, 6);
ok(o9.helpT > 0 && w9.clear > cl9 + 5, '소대장이 같이 눈을 치운다', [w9.clear - cl9]);
var w10 = fresh(); var lt10 = A.spawnOfficer(w10, 'lt'); lt10.x = w10.player.x + 30; lt10.y = w10.player.y; lt10.phase = 'stay'; lt10.stayT = 99; run(w10, 4);
ok(lt10.missed && w10.op.jigeok === 0, '소대장은 서운해할 뿐 지적은 없다');

// ── 분대원 사기 — 짱박힌 분대원 일으키기, 초코파이 ──
w = fresh(function (s) { s.crew = { hoobae: 2 }; s.bank = 500; }); away(w);
var c1 = w.crew[0]; c1.x = 200; c1.y = 200; c1.slack = true; c1.mor = 5; c1.speed = 0;
look = near(w, c1); t = A.best(w, look, true);
ok(t.verb === '일으켜 세우기', '짱박힌 분대원: 일으켜 세우기', t.verb);
A.act(w, t, look); ok(!c1.slack && c1.mor >= 40, '일어나서 다시 일한다');
c1.mor = 30; t = A.best(w, look, true); ok(/초코파이 주기/.test(t.verb), '사기가 낮으면: 초코파이 주기', t.verb);
var bk2 = w.save.bank; A.act(w, t, look); ok(c1.mor >= 75 && w.save.bank < bk2, '초코파이 주면 사기 +45 (초코파이 든다)', [c1.mor, bk2 - w.save.bank]);

// ── 생활관: PX 준비물 · 상점으로 지원 · 체력단련 → 다음 작전 시작부터 ──
var sp = G.newSave(); sp.bank = 1000; sp.crew = { hoobae: 1 };
var pi = A.prepItems(sp); ok(pi.length === S.PREP.length && pi.every(function (x) { return x.cost > 0; }), 'PX 준비물 목록');
ok(A.prepBuy(sp, 'hotpack').ok && sp.prep.hotpack && !A.prepBuy(sp, 'hotpack').ok, '핫팩 챙기기 (하나만)');
ok(A.prepBuy(sp, 'ramen').ok, '컵라면 한 박스');
sp.dia = 0; ok(!A.useDia(sp, 'support').ok, '상점이 없으면 대대 지원 요청 못 한다');
sp.dia = 3; ok(A.useDia(sp, 'support').ok && sp.dia === 1 && sp.prep.support && !A.useDia(sp, 'support').ok, '상점 2: 다음 작전 대대 지원 (한 번만)');
var pd = A.pullDone(sp, 17); ok(pd.n === 17 && pd.best && pd.dia === 1 && sp.prep.power === 17 && sp.stats.pullBest === 17, '턱걸이 17개: 최고 기록 + 상점 + 내일 적재 버프');
sp.mor = 10; var wPr = G.createWorld(sp); wPr.events = []; G.step(wPr, 1 / 30, null);
var bIds = A.state(wPr).buffs.map(function (b) { return b.id; });
ok(bIds.indexOf('hotpack') >= 0 && bIds.indexOf('support') >= 0 && bIds.indexOf('power') >= 0 && wPr.crew[0].mor >= 99 && wPr.mod.stun === 0.5 && wPr.player.cap > G.capOf(sp) && !Object.keys(sp.prep).length, '작전 시작: 핫팩·대대 지원·체력단련·컵라면(사기 100) 적용, 준비물은 다 썼다', bIds);
ok(wPr.fx.some(function (f) { return f.t === 'prep'; }), '준비물 알림');
var wPr2 = G.createWorld(sp); G.step(wPr2, 1 / 30, null); ok(!A.state(wPr2).buffs.some(function (b) { return b.id === 'hotpack'; }), '준비물은 한 번만');

// ── 아침 점호 · 보급 상자 · 훈장 ──
var sR = G.newSave(), day0 = Date.UTC(2026, 10, 1, 3);
var r1 = M.rollCall(sR, day0); ok(r1 && r1.streak === 1 && sR.boxes.length === 1, '첫 점호: 출석 1일 + 상자');
ok(M.rollCall(sR, day0 + 3600 * 1000) === null, '같은 날 두 번은 없다');
M.rollCall(sR, day0 + 86400000); var r3 = M.rollCall(sR, day0 + 2 * 86400000);
ok(r3.streak === 3 && r3.tier === 'rare', '3일 연속 → 희귀 상자', r3);
var r4 = M.rollCall(sR, day0 + 5 * 86400000); ok(r4.streak === 1, '빠지면 연속이 끊긴다');
sR.boxes = ['legend']; var bb = M.openBox(sR);
ok(bb.tier === 'legend' && bb.dia >= 5 && bb.pie > 0 && bb.item && sR.dia >= 5, '전설 상자: 상점 5↑ + 분실물', bb);
var wA = fresh(function (s) { s.rank = 1; }); wA.save.stats.salute = 10; G.step(wA, 1.1, null);
ok(wA.save.ach.salute10 && wA.fx.some(function (f) { return f.t === 'ach'; }) && wA.save.dia >= 2 + 4, '훈장: 경례 머신 + 진급 상점', [wA.save.dia, wA.save.ach]);
ok(M.achList(wA.save).length === S.ACH.length && !S.ACH.some(function (a) { return /hijack|caught|snowman5|missions/.test(a.id); }), '훈장 목록 (차 탈취·얼차려는 없다)');

// ── 신병 인솔 → 배치, 따라와 → 다른 구역 ──
w = fresh(function (s) { s.zones.B = true; s.fresh.B = true; s.bank = 9999; }); away(w);
G.buy(w.save, 'crew', 'hoobae'); G.newDay(w); w.events = []; A.init(w).fuelT = 999;
var rc = w.recruits[0]; look = near(w, rc, 0, -16); t = A.best(w, look, true);
ok(t && t.k === 'recruit' && t.verb === '인솔하기', '생활관 앞 신병: 인솔하기', t && [t.k, t.verb]);
A.act(w, t, look); ok(rc.state === 'follow', '인솔하면 따라온다');
w.player.x = 30; w.player.y = 270; rc.x = 40; rc.y = 250; G.step(w, 1 / 30, null);
t = A.best(w, { x: 0, y: 1 }, true); ok(t.k === 'recruit' && /따라오는 중/.test(t.verb), '구역 밖에선 배치 못 한다', t.verb);
w.player.x = 600; w.player.y = 200; rc.x = 590; rc.y = 190; G.step(w, 1 / 30, null);
t = A.best(w, { x: 0, y: 1 }, true);
ok(t.k === 'recruit' && t.verb === '여기 배치' && t.ask === '족구장', '구역 안에선 등 뒤 신병도: 여기 배치 (족구장)', [t.verb, t.ask]);
A.act(w, t, { x: 0, y: 1 });
ok(w.crew.length === 1 && w.crew[0].post === 'B' && w.save.crew.hoobae === 1, '족구장 담당 후임이 됐다');
var ce = w.crew[0]; ce.x = 600; ce.y = 230; look = near(w, ce); t = A.best(w, look, true);
ok(/따라와/.test(t.verb2), '분대원의 두 번째 행동: 따라와', t.verb2);
A.act(w, t, look, true); ok(ce.state === 'follow', '따라와 → 따라온다');
w.player.x = 200; w.player.y = 200; ce.x = 210; ce.y = 190; G.step(w, 1 / 30, null);
t = A.best(w, { x: 0, y: 1 }, true); A.act(w, t, { x: 0, y: 1 });
ok(ce.post === 'A' && ce.state === 'work' && w.save.cpost.hoobae[0] === 'A', '생활관 앞 길로 옮겼다');

// ── 이병 때는 선임 잔소리, 상병부터는 없다 ──
var wn = fresh(function (s) { s.day = 3; }); A.init(wn).nagT = 0; G.step(wn, 1 / 30, null);
ok(wn.fx.some(function (f) { return f.t === 'nag'; }), '이병: 선임 잔소리');
var wn2 = fresh(function (s) { s.day = 3; s.rank = 2; }); A.init(wn2).nagT = 0; G.step(wn2, 1 / 30, null);
ok(!wn2.fx.some(function (f) { return f.t === 'nag'; }), '상병: 잔소리 없음 (짬이 찼다)');

// ── 스토리 · 꾸미기 ──
var sS = G.newSave();
ok(M.storyNext(sS).id === 'prologue', '처음엔 전입 첫날');
M.storyDone(sS, M.storyNext(sS));
ok(M.storyNext(sS) === null, '아무것도 안 했으면 다음 장면 없음');
sS.stats.dumps = 1; ok(M.storyNext(sS).id === 'firstDump', '첫 초코파이 → 장면');
var rS = M.storyDone(sS, M.storyNext(sS)); ok(rS.dia === 1 && sS.dia === 1, '장면 보상: 상점');
ok(M.storyDone(sS, S.STORY[1]) === null, '같은 장면 보상은 한 번');
sS.stats.ops = 1; ok(M.storyNext(sS).id === 'firstOp', '첫 작전이 끝나면 "첫 작전 끝"');
M.storyDone(sS, M.storyNext(sS));
var wEx = G.createWorld((function () { var s = G.newSave(); s.exam = true; s.story = { prologue: 1, firstDump: 1, firstOp: 1 }; return s; })());
ok(M.storyNext(wEx.save, wEx).id === 'exam1', '첫 진급 심사 날 장면');
sS.rank = 3; sS.zones.B = true;
var order = []; for (var k8 = 0; k8 < 12; k8++) { var ch8 = M.storyNext(sS); if (!ch8) break; order.push(ch8.id); M.storyDone(sS, ch8); }
ok(order.indexOf('malnyeon') >= 0 && order.indexOf('farewell') > order.indexOf('lt') && sS.unlocked['tool:malnyeon'], '진급·구역에 따라 장면이 차례로 + 말년의 넉가래 해금', order);
sS.look.name = '홍길동'; ok(M.fill('{rank} {name}', sS) === '병장 홍길동', '대사에 이름·계급');
var sL = G.newSave(), oL = M.lookOptions(sL);
ok(oL.hat.filter(function (h) { return h.id === 'beret'; })[0].state === 'lock' && oL.hat.filter(function (h) { return h.id === 'crown'; })[0].state === 'buy', '베레모는 스토리, 왕관은 상점');
ok(!M.setLook(sL, 'hat', 'crown') && sL.look.hat === 'beanie', '안 가진 건 못 쓴다');
ok(!M.buyLook(sL, 'hat', 'crown'), '상점이 없으면 못 산다');
sL.dia = 20; ok(M.buyLook(sL, 'hat', 'crown') && sL.look.hat === 'crown' && sL.dia === 5, '상점 15로 왕관');
M.setLook(sL, 'extras', 'glasses'); M.setLook(sL, 'extras', 'sweat');
ok(sL.look.extras.length === 3 && sL.look.extras.indexOf('snot') < 0, '얼굴 소품은 3개까지 (오래된 것부터 빠짐)', sL.look.extras);
ok(M.lookSpec(sL).hat === 'crown' && M.lookColor(sL, 'tool') === '#e7ae2f', '모습 → 그림 스펙·색');
var dS = G.newSave(); dS.rank = 3; dS.merit = S.DISCHARGE_MERIT; dS.life = 2e6; dS.look.name = '전역자'; dS.unlocked['hat:beret'] = true; dS.story.prologue = true; dS.leave = 2; G.discharge(dS);
ok(dS.look.name === '전역자' && dS.unlocked['hat:beret'] && dS.story.prologue && dS.leave === 2 && dS.rank === 0, '전역해도 꾸미기·스토리·휴가 기록은 남는다');

// ── 할 일 (작전 흐름 안내) ──
w = fresh(); var q0 = M.questNow(w.save);
ok(q0 && q0.id === 'scoop', '할 일 1: 눈 퍼 담기');
w.player.load = 25; G.step(w, 1.1, null);
ok(M.questNow(w.save).id === 'dump' && w.fx.some(function (f) { return f.t === 'quest'; }), '퍼 담으면 다음 할 일로', M.questNow(w.save).id);
w.save.stats.dumps = 1; w.save.tool = 1; G.step(w, 1.1, null);
ok(M.questNow(w.save).id === 'task', '부었고 넉가래 받았으면 → 지시서 한 줄', M.questNow(w.save).id);
ok(S.QUESTS.every(function (q) { return !/자판기|족구공|철봉|행정반 임무/.test(q.text); }), '할 일에 작전과 상관없는 것은 없다');

// ── 사람 몸에 파고들지 않는다 ──
w = fresh(); w.haeng.x = 200; w.haeng.y = 200; w.haeng.hold = 999; w.player.x = 203; w.player.y = 200;
run(w, 0.4); ok(Math.hypot(w.player.x - 200, w.player.y - 200) >= 21, '사람에게 바짝 붙으면 살살 밀려난다', Math.hypot(w.player.x - 200, w.player.y - 200));

console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '상호작용 ' + pass + '개 통과');
process.exit(fail ? 1 : 0);
