#!/usr/bin/env node
/* 제설각 상호작용 테스트 (DOM 없이) — v10: 실제 제설 작전에 있을 법한 것만 · v11: 빛나는 원 위에 서기 / 지나가면 저절로 / '지금 할 일'
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

// ── v11 보급 원: 초코파이·계급이 되면 원 위에 1초 서 있기만 하면 다음 장비 ──
function padOf(w, id) { return A.pads(w).filter(function (p) { return p.id === id; })[0]; }
w = fresh(function (s) { s.bank = 100; }); away(w);
var sp0 = padOf(w, 'supply');
ok(sp0 && sp0.name === '넉가래' && sp0.cost === 150 && !sp0.ok && !sp0.lock, '보급 원: 다음 장비 넉가래 150 (아직 모자람)', sp0 && [sp0.name, sp0.cost, sp0.ok, sp0.lock]);
ok(!A.candidates(w).some(function (c) { return c.k === 'haeng' && c.verb2; }), '행보관에게 작은 버튼으로 요청하지 않는다 (원으로 바뀜)');
w.player.x = sp0.x; w.player.y = sp0.y; run(w, 1.5);
ok(w.save.tool === 0 && w.save.bank === 100, '초코파이가 모자라면 서 있어도 못 받는다');
w.save.bank = 200; w.fx.length = 0; run(w, 0.5);
ok(w.save.tool === 0 && A.state(w).pads.filter(function (p) { return p.id === 'supply'; })[0].prog > 0.3, '서 있으면 원이 차오른다 (1초)');
run(w, 0.7);
ok(w.save.tool === 1 && w.save.bank === 50 && w.player.cap === 110 && fxs(w, 'toolGet').length === 1, '원 위에 1초 → 넉가래 지급, 적재 110', [w.save.tool, w.save.bank, w.player.cap]);
w.save.tool = 2; w.save.bank = 1e9; sp0 = padOf(w, 'supply');
ok(sp0.lock === '일병부터' && !sp0.ok, '이병: 2인용 넉가래 원은 "일병부터" (잠김)', sp0.lock);
w.save.rank = 1; sp0 = padOf(w, 'supply');
ok(sp0.ok && sp0.name === '2인용 넉가래', '일병이 되면 2인용 넉가래 원이 켜진다', [sp0.ok, sp0.name]);
w.player.x = 150; w.player.y = 200; ok(A.objective(w).kind === 'supply', '받을 수 있으면 "지금 할 일"이 보급 원을 가리킨다', A.objective(w).kind);

// ── 작업 완료 보고: 지시서를 다 하면 행보관이 보고 원으로 나오고, 원 위에 서면 작전 끝 ──
w = fresh(); H = w.haeng; H.x = 430; H.y = 190; w.player.x = 150; w.player.y = 200;
var rpd = S.PADS.report;
ok(!padOf(w, 'report').ok, '지시서 전엔 보고 원이 꺼져 있다');
clearZone(w, 'A', 0.86); G.checkTasks(w);
ok(w.op.ready && fxs(w, 'opReady').length === 1, '지시서 완료 → "보고하러 와라"');
ok(padOf(w, 'report').ok && A.objective(w).kind === 'report', '보고 원이 켜지고 "지금 할 일" = 작업 완료 보고', A.objective(w).kind);
var dh0 = Math.hypot(H.x - rpd.x, H.y - rpd.y); run(w, 3);
ok(Math.hypot(H.x - rpd.x, H.y - rpd.y) < Math.max(40, dh0 - 40), '행보관이 보고 원 옆으로 나와 기다린다', [dh0, Math.hypot(H.x - rpd.x, H.y - rpd.y)]);
look = near(w, H); t = A.best(w, { x: -look.x, y: -look.y }, true);
ok(t && t.k === 'haeng' && t.verb === '작업 완료 보고' && t.urgent, '행보관 앞에서 버튼으로도 보고할 수 있다', t && [t.k, t.verb]);
w.player.x = rpd.x; w.player.y = rpd.y; w.fx.length = 0; run(w, 1);
var oe = fxs(w, 'opEnd')[0];
ok(w.opEnd && w.save.day === 2 && oe && oe.res.report, '보고 원 위에 서 있으면 → 작전 끝 (검열 결과)', oe && [oe.res.stars, oe.res.why]);
ok(!A.act(w, t, look).ok, '끝난 작전에선 아무것도 못 한다');

// ── 분대원: 깨우기 / 짐 맡기기 / 재촉하기 ──
w = fresh(function (s) { s.crew = { hoobae: 1, malnyeon: 1 }; s.rank = 2; });
var hb = w.crew.filter(function (e) { return e.def.id === 'hoobae'; })[0], mn = w.crew.filter(function (e) { return e.def.id === 'malnyeon'; })[0];
mn.x = 200; mn.y = 200; mn.asleep = true; mn.sleepT = 99; mn.speed = 0; away(w);
w.player.x = 120; w.player.y = 200;
ok(!A.candidates(w).some(function (c) { return c.ref === mn; }), '자는 사람은 버튼이 아니다 (지나가면 깨운다)');
look = near(w, mn); G.step(w, 1 / 30, null);
ok(!mn.asleep && w.save.stats.wake === 1, '자는 말년 병장 옆을 지나가면 저절로 깨운다');
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

// ── 빠진 출근 차량: 옆에 붙어 있으면 저절로 민다 (분대원도 와서 민다) ──
w = fresh(function (s) { s.merit = 22; s.rank = 2; G.assignZones(s); s.crew = { hoobae: 1 }; }); away(w);
w.player.x = 30; w.player.y = 300; G.spawn(w, 'car'); run(w, 8);
var car = w.car;
ok(car && car.stuck && w.op.stuck, '눈 쌓인 진입로 → 차가 빠졌다');
ok(A.objective(w).kind === 'car', '"지금 할 일" = 빠진 차 밀기', A.objective(w).kind);
w.crew[0].x = 30; w.crew[0].y = 300; w.crew[0].speed = 0; w.fx.length = 0;
near(w, car, 0, 24); run(w, 1);
ok(car.stuck && car.push > 0.3 && fxs(w, 'push').length >= 2, '차 옆에 붙어 있으면 "영차!" 하며 민다', car.push);
run(w, 2.5);
ok(!car.stuck && car.freed && w.save.stats.carPush === 1 && w.fx.some(function (f) { return f.t === 'carFree'; }), '다 밀면 빠져나온다 + 기록');
run(w, 12);
ok(!w.car && A.init(w).off.some(function (o) { return o.id === 'cpt'; }), '차가 서면 중대장님이 내려서 순찰한다');
var wP2 = fresh(function (s) { s.merit = 22; s.rank = 2; G.assignZones(s); }); away(wP2); wP2.player.x = 30; wP2.player.y = 300; G.spawn(wP2, 'car'); run(wP2, 8);
var push0 = wP2.car.push;
ok(wP2.car.stuck && push0 === 0, '혼자면 아무도 안 민다');

// ── 제설함 → 염화칼슘 포대 → 빙판 (지나가면 줍고, 들어가면 뿌린다) — v13: 일병부터 ──
w = fresh(function (s) { s.rank = 1; }); away(w);
var ip = w.parts.filter(function (p) { return p.ice; })[0];
for (var iy = ip.y; iy < ip.y + ip.h; iy += 10) for (var ix = ip.x; ix < ip.x + ip.w; ix += 10) G.clearAt(w, ix + 5, iy + 5, 3, 9, 'player', { cap: 1e9, load: 0, val: 0 });
ok(ip.icy && !ip.salted, '그늘 구간이 얼었다');
w.player.x = 200; w.player.y = 160;
ok(A.objective(w).kind === 'salt', '"지금 할 일" = 제설함에서 염화칼슘', A.objective(w).kind);
var box = S.PROPS.filter(function (p) { return p.id === 'saltbox'; })[0];
w.player.x = box.ux; w.player.y = box.uy + 10; G.step(w, 1 / 30, null);
ok(A.state(w).hand && A.state(w).hand.id === 'salt', '제설함 옆을 지나가면 포대를 든다');
ok(A.objective(w).kind === 'spread', '"지금 할 일" = 빙판에 뿌리기', A.objective(w).kind);
w.player.x = 200; w.player.y = 160; run(w, 1);
ok(!ip.salted && A.state(w).hand, '언 구간 밖에선 안 뿌린다');
w.player.x = ip.x + ip.w / 2; w.player.y = ip.y + ip.h / 2; run(w, 0.6);
ok(ip.salted && !A.state(w).hand && w.save.stats.salt === 1 && fxs(w, 'salted').length === 1 && w.save.op.salted.length === 1, '언 구간에 들어가면 저절로 뿌린다 + 손이 빈다 + 저장');
ok(G.gradeOp(w).icy === 0, '처리한 빙판은 감점 없음');

// ── 정비고 기름통 → 제설차 ──
w = fresh(function (s) { s.crew = { plow: 1 }; s.rank = 3; }); away(w);
var a7 = A.init(w); a7.fuelT = 0; G.step(w, 1 / 30, null);
var pl7 = w.crew[0];
ok(pl7.noFuel && a7.reqs.some(function (q) { return q.item === 'fuel'; }), '제설차 기름이 떨어지면 멈춘다');
var dG7 = A.door('garage'); w.player.x = dG7.x; w.player.y = dG7.y + 10; G.step(w, 1 / 30, null);
ok(A.state(w).hand && A.state(w).hand.id === 'fuel', '정비고 앞을 지나가면 기름통을 든다', A.state(w).hand);
pl7.x = 300; pl7.y = 300; pl7.speed = 0; look = near(w, pl7, 0, -24); G.step(w, 1 / 30, null);
ok(!pl7.noFuel && pl7.boost > 0 && !A.state(w).hand, '기름통 들고 제설차 옆에 가면 저절로 넣는다');
t = A.best(w, look, true); ok(t.k === 'plow' && t.verb === '따라와', '제설차는 운전병이 몬다: "따라와"로 데려간다', t.verb);
var wNo = fresh(); ok(!A.candidates(wNo).some(function (c) { return c.k === 'garage'; }), '제설차가 없으면 정비고에 볼일 없다');

// ── 고라니 쫓기 · 짬타이거 · 난로 · 구령대(상병부터) ──
w = fresh(function (s) { s.day = 5; }); away(w); G.spawn(w, 'deer');
var dr = w.deer[0]; dr.x = w.player.x + 20; dr.y = w.player.y; dr.turnT = 9; dr.hitT = 9; var bD = w.save.bank;
G.step(w, 1 / 30, null);
ok(dr.leaving && w.save.bank > bD && w.save.stats.shoo === 1, '고라니에게 다가가면 "훠이!" 도망가고 초코파이', [dr.leaving, w.save.bank - bD]);
var stv = S.PROPS.filter(function (p) { return p.id === 'stove'; })[0]; w.player.x = stv.ux; w.player.y = stv.uy + 12; run(w, 1);
ok(A.state(w).buffs.some(function (b) { return b.id === 'warm'; }) && w.mod.hit < 1, '드럼통 난로 옆에 서 있으면 몸 녹이기 → 손이 빨라진다');
w = fresh(function (s) { s.zones.D = true; s.fresh.D = true; }); away(w);
var cat = w.cats[0]; look = near(w, cat, 0, -10); t = A.best(w, look, true);
A.act(w, t, look); ok(t.k === 'cat' && t.verb === '쓰다듬기' && w.save.stats.pet === 1 && !A.state(w).buffs.length, '짬타이거: 쓰다듬기 (버프 없이 힐링만)');
var wS = fresh(function (s) { s.crew = { hoobae: 2 }; s.rank = 1; }); away(wS);
var stB = S.BUILDINGS.filter(function (b) { return b.id === 'stand'; })[0];
wS.player.x = stB.x + stB.w / 2; wS.player.y = stB.y + stB.h + 6; run(wS, 1.2);
ok(!(wS.mod.crew >= 1.25), '일병까지는 구령대 앞에 서 있어도 구령 못 한다');
wS.save.rank = 2; run(wS, 1.2);
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
look = near(w, c1); G.step(w, 1 / 30, null);
ok(!c1.slack && c1.mor >= 39, '짱박힌 분대원 옆을 지나가면 일으켜 세운다', c1.mor);
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
var rc = w.recruits[0];
ok(A.objective(w).kind === 'recruit', '"지금 할 일" = 신병 데려오기', A.objective(w).kind);
look = near(w, rc, 0, -16); G.step(w, 1 / 30, null);
ok(rc.state === 'follow', '신병에게 다가가면 따라온다');
ok(A.objective(w).kind === 'assign', '"지금 할 일" = 배치할 구역에서 멈춰 서기', A.objective(w).kind);
w.player.x = 30; w.player.y = 270; rc.x = 40; rc.y = 250; run(w, 1.5);
ok(rc.state === 'follow' && !w.crew.length, '구역 밖에선 서 있어도 배치 안 된다');
w.player.x = 600; w.player.y = 200; rc.x = 590; rc.y = 190; run(w, 1.3);
ok(w.crew.length === 1 && w.crew[0].post === 'B' && w.save.crew.hoobae === 1, '족구장 담당 후임이 됐다');
var ce = w.crew[0]; ce.x = 600; ce.y = 230; ce.speed = 0; look = near(w, ce); t = A.best(w, look, true);
ok(/따라와/.test(t.verb2), '분대원의 두 번째 행동: 따라와', t.verb2);
A.act(w, t, look, true); ok(ce.state === 'follow', '따라와 → 따라온다');
w.player.x = 200; w.player.y = 200; ce.x = 210; ce.y = 190; run(w, 1.3);
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

// ── v12: 노란 화살표만 따라 걸어도 도착한다 (구령대·테이프·건물을 돌아서) ──
function followArrow(w, sec, until) {
  for (var t = 0; t < sec; t += 1 / 30) {
    var o = A.objective(w); if (!o || until(o)) return true;
    var g = o.via || o, P = w.player, dx = g.x - P.x, dy = g.y - P.y, d = Math.hypot(dx, dy) || 1;
    G.step(w, 1 / 30, d > 4 ? { x: dx / d, y: dy / d } : null); w.fx.length = 0;
  }
  return false;
}
w = fresh(function (s) { s.bank = 1000; }); away(w); w.act.offPlan = []; w.act.off = [];
w.player.x = S.DUMP.x; w.player.y = S.DUMP.y + 14;
var oS = A.objective(w);
ok(oS && oS.kind === 'supply' && oS.via, '보급 원이 구령대 너머 → 화살표는 돌아가는 길목을 가리킨다', oS && [oS.kind, oS.via]);
ok(followArrow(w, 25, function () { return w.save.tool >= 1; }) && w.save.tool === 1, '화살표만 따라 걸어도 보급 원에 도착 → 넉가래', [Math.round(w.player.x), Math.round(w.player.y), w.save.tool]);
w = fresh(function (s) { s.merit = 3; s.zones.B = true; s.fresh.B = true; }); away(w); w.act.offPlan = []; w.act.off = [];
w.op.tasks[0].done = 1; w.player.x = 100; w.player.y = 300;
ok(followArrow(w, 25, function () { var z = G.zoneAt(w, w.player.x, w.player.y); return !!z && z.id === 'B'; }), '집하장 → 족구장도 화살표만 따라서', [Math.round(w.player.x), Math.round(w.player.y)]);
var wV2 = fresh(); away(wV2); wV2.player.x = 200; wV2.player.y = 200; var oV = A.objective(wV2);
ok(!oV || !oV.via, '곧장 갈 수 있으면 돌아가지 않는다');


// ── v14 재미: 눈덩이 · 고라니 벌러덩 · 눈싸움 · 족구 · 눈천사 · 탈것 · 발견 ──
function v14(fn) { return fresh(function (s) { s.day = 8; s.rank = 1; s.merit = 14; s.stats.ops = 7; G.assignZones(s); if (fn) fn(s); }); }
function deerAt(w, x, y) { var d = { x: x, y: y, dir: { x: 1, y: 0 }, heading: 0, turnT: 9, life: 40, t: 0, walk: 0, moving: true, kickT: 0, hitT: 0, leaving: false }; w.deer.push(d); return d; }
var w14 = fresh(function (s) { s.stats.ops = 3; }); away(w14); w14.act.offPlan = []; w14.act.off = [];
w14.player.x = 270; w14.player.y = 470; deerAt(w14, 360, 470);
ok(!A.throwTarget(w14), 'v14 눈덩이는 족구장(구역 B)부터 — 처음엔 버튼이 없다');
w14 = v14(); away(w14); w14.act.offPlan = []; w14.act.off = [];
w14.player.x = 270; w14.player.y = 470; var dr = deerAt(w14, 370, 470);
w14.crew = [];
var tg = A.throwTarget(w14);
ok(tg && tg.k === 'deer', 'v14 고라니가 150 안이면 눈덩이 버튼 (조준은 알아서)', tg && tg.k);
var thrown = 0;
for (var ti = 0; ti < 12 && !(dr.down > 0); ti++) {
  if (w14.deer.indexOf(dr) < 0) break;
  w14.player.x = Math.max(20, dr.x - 90); w14.player.y = dr.y;   // 쫓아가서 던진다
  if (A.throwBall(w14).ok) thrown++;
  run(w14, 0.5);
}
ok(dr.down > 0 && thrown === 2, 'v14 고라니는 두 방이면 벌러덩 (한 방 맞으면 비틀거려서 두 번째도 맞힐 수 있다)', [dr.down, dr.hp, thrown]);
ok(w14.save.fun.deerDown && w14.save.fun.throw && w14.save.stats.deerDown === 1, 'v14 발견: 첫 눈덩이 · 고라니 벌러덩 (수첩)', w14.save.fun);
var dX = dr.x; run(w14, 1); ok(Math.abs(dr.x - dX) < 0.5, 'v14 벌러덩한 고라니는 누워 있다 (안 움직인다)');
w14.player.x = dr.x - 20; w14.player.y = dr.y; run(w14, 0.2);
ok(w14.save.fun.deerPet && dr.petted, 'v14 누운 고라니 옆에 가면 쓰담쓰담 (도망 보상 대신)');
run(w14, 4); ok(!(dr.down > 0) && dr.leaving, 'v14 3.5초 뒤 일어나 비틀비틀 도망간다');
var dia0 = w14.save.dia; ok(A.fun(w14, 'throw') === false && w14.save.dia === dia0, 'v14 발견 보상은 한 번만');
// 행보관 맞히기 / 분대원 눈싸움
var wh = v14(); wh.act.offPlan = []; wh.act.off = []; wh.crew = []; wh.deer = []; wh.haeng.x = 330; wh.haeng.y = 470; wh.haeng.hold = 99; wh.player.x = 270; wh.player.y = 470;
A.applyStats(wh); wh.act.buffs.praise = 30;
ok(A.throwTarget(wh) && A.throwTarget(wh).k === 'haeng', 'v14 행보관도 맞힐 수 있다 (아무도 없을 때만 고른다)');
A.throwBall(wh); run(wh, 0.6);
ok(wh.save.fun.haeng && !wh.act.buffs.praise, 'v14 행보관 명중 → "간 큰 놈" 발견, 칭찬 버프는 날아간다');
var wc = v14(function (s) { s.crew = { hoobae: 1 }; }); wc.act.offPlan = []; wc.act.off = []; away(wc);
run(wc, 0.1); var cm = wc.crew[0]; cm.x = 320; cm.y = 470; cm.retarget = 99; cm.speed = 0; wc.player.x = 250; wc.player.y = 470; wc.deer = [];
ok(A.prank(wc) && wc.act.balls.length === 1 && cm.fought, 'v14 선임 장난: 근처 분대원이 보이게 던진다');
run(wc, 0.8); A.throwBall(wc); run(wc, 0.8);
ok(wc.save.fun.fight, 'v14 받아치면 눈싸움 발견', wc.save.fun);
// 족구: 공을 몸으로 밀어 네트를 넘기면 한 골
var wk = v14(); away(wk); wk.act.offPlan = []; wk.act.off = []; wk.deer = []; var ZB = G.zoneById('B'), B = wk.act.ball;
B.x = ZB.x + ZB.w / 2 - 30; B.y = ZB.y + ZB.h / 2; B.vx = 0; B.vy = 0; B.side = -1;
wk.player.x = B.x - 14; wk.player.y = B.y;
run(wk, 1.2, { x: 1, y: 0 });
ok(wk.save.fun.goal && (wk.save.stats.goal || 0) >= 1, 'v14 족구공을 밀고 가서 네트 너머로 → 한 골', [Math.round(B.x), wk.save.stats.goal]);
// 눈천사: 깊은 눈 위에서 가만히 4초 (한 작전에 한 번, 움직이면 바로 일어난다)
var wa = v14(); away(wa); wa.act.offPlan = []; wa.act.off = []; wa.deer = []; wa.crew = [];
var ci = -1, ZC = G.zoneById('C'); for (var yy = ZC.y + 40; ci < 0 && yy < ZC.y + ZC.h - 40; yy += S.CELL) for (var xx = ZC.x + 40; xx < ZC.x + ZC.w - 40; xx += S.CELL) { var ii = G.cellIndex(xx, yy); if (wa.depth[ii] >= 2 && !G.blocked(xx, yy, 6)) { ci = ii; break; } }
wa.player.x = (ci % S.GW) * S.CELL + S.CELL / 2; wa.player.y = Math.floor(ci / S.GW) * S.CELL + S.CELL / 2; wa.player.load = 0;
run(wa, 5.5);
ok(wa.save.fun.angel && wa.player.angel > 0 && wa.player.stun <= 0, 'v14 눈천사: 5초 가만히 → 누운 모습만 (기절 아님)');
run(wa, 0.2, { x: 1, y: 0 }); ok(!(wa.player.angel > 0), 'v14 끌면 바로 일어난다');
// 탈것: 크기·간섭
var wr = v14(function (s) { s.zones.D = true; }); away(wr); wr.act.offPlan = []; wr.act.off = []; wr.deer = [];
var cart = wr.act.rides[0], atv = wr.act.rides[1], trac = wr.act.rides[2];
wr.player.x = cart.x + 12; wr.player.y = cart.y;
var rc = A.candidates(wr).filter(function (q) { return q.k === 'ride'; }).map(function (q) { return q.ref.id; });
ok(rc.indexOf('cart') >= 0 && rc.indexOf('tractor') < 0, 'v14 일병: 리어카·사륜바이크는 탈 수 있고 트랙터는 상병부터', rc);
A.applyStats(wr); var cap0 = wr.player.cap, sp0 = wr.mod.speed;
ok(A.act(wr, { k: 'ride', ref: cart }, wr.player.dir).ok && wr.act.ride === cart, 'v14 리어카 타기');
A.applyStats(wr);
ok(wr.player.cap === cap0 * 3 && wr.mod.speed < sp0 && wr.player.body === 11, 'v14 리어카: 세 배 싣고, 느리고, 덩치가 크다', [cap0, wr.player.cap, wr.mod.speed, wr.player.body]);
var ex = A.best(wr, wr.player.dir, false); ok(ex && ex.k === 'exit', 'v14 타고 있으면 행동 버튼이 "내리기"', ex && ex.k);
A.act(wr, ex, wr.player.dir); A.applyStats(wr);
ok(!wr.act.ride && wr.player.cap === cap0 && wr.player.body === 6 && Math.hypot(cart.x - wr.player.x, cart.y - wr.player.y) > 10, 'v14 내리면 원래대로, 리어카는 그 자리에 남는다');
// 덩치: 걸어서는 지나가는 틈을 트랙터는 못 지나간다
var foot = { x: 180, y: 284 }, big = { x: 180, y: 284 };
G.moveEnt(foot, 12, 0, 6); G.moveEnt(big, 12, 0, 16);
ok(foot.x > 190 && big.x < 185, 'v14 몸집: 구령대 옆 틈은 걸어서는 지나가고 트랙터는 못 지나간다', [foot.x, big.x]);
// 사륜바이크: 빠르고 넓게, 기름 떨어지면 내린다, 정비고 앞에 세우면 가득
wr.player.x = atv.x + 10; wr.player.y = atv.y; A.startRide(wr, atv); A.applyStats(wr);
ok(wr.mod.speed > 1.5 && wr.player.r >= 24, 'v14 사륜바이크: 1.6배 빠르고 앞날 폭 24', [wr.mod.speed, wr.player.r]);
atv.fuel = 0.2; run(wr, 0.5, { x: -1, y: 0 });
ok(!wr.act.ride && atv.fuel === 0 && fxs(wr, 'ride').some(function (f) { return !f.on && !f.hand; }), 'v14 기름이 떨어지면 저절로 내린다');
ok(A.startRide(wr, atv).ok === false, 'v14 기름 없으면 못 탄다');
var gd = A.door('garage'); atv.x = gd.x + 20; atv.y = gd.y + 10; run(wr, 0.1);
ok(atv.fuel === atv.max, 'v14 정비고 앞에 세워 두면 기름이 찬다');
// 고라니가 탈것에 부딪히면 튕겨 나간다 (나는 안 넘어진다)
var wd = v14(function (s) { s.zones.D = true; }); away(wd); wd.act.offPlan = []; wd.act.off = []; wd.crew = [];
var a2 = wd.act.rides[1]; wd.player.x = a2.x; wd.player.y = a2.y; A.startRide(wd, a2); A.applyStats(wd);
var dd = deerAt(wd, wd.player.x + 6, wd.player.y); dd.turnT = 9; run(wd, 0.2);
ok(wd.player.stun <= 0, 'v14 탈것에 타면 고라니에 받혀도 안 넘어진다');

console.log(fail ? '실패 ' + fail + '개 / 통과 ' + pass + '개' : '상호작용 ' + pass + '개 통과');
process.exit(fail ? 1 : 0);
