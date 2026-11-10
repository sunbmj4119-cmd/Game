#!/usr/bin/env node
/* 기능 점검: 아이템·기능을 실제로 써 보고 상태가 바뀌는지 확인한다 (브라우저 없이 Node에서)
 * node tests/logic.js */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
var root = path.join(__dirname, '..');
require('../tools/data-files').load();
// 카드의 원래 장면으로 고정 (새 장면이 추가돼도 검사가 흔들리지 않게)
function pin(id) { var c = JY.Game._index()[id]; return { id: id, v: c && c.l ? 0 : 1, k: 0 }; }
var JY = global.JY, G = JY.Game, Meta = JY.Meta;

var fails = [], passes = 0;
function ok(cond, name, detail) { if (cond) passes++; else fails.push(name + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
function fresh(opts) {
  var s = G.newState(Object.assign({ start: '2026-03-02', mos: 'infantry', name: '점검병', unit: 'coast' }, opts || {}));
  s.rank = 1; s.day = 60; s.queue = []; s.current = 'quiet'; s.cv = pin('quiet');
  s.promo = [0, 35, 9999, 9999, 9999]; // 점검 중엔 진급이 끼어들지 않게
  s.assigned = true; s.cardsOnly = true;   // 카드 규칙만 본다 (v6 자대 지도는 13번에서)
  G.STATS.forEach(function (k) { s.stats[k] = 50; });
  return s;
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* 1. PX 아이템: 사기 → 쓰기 */
JY.ITEM_ORDER.forEach(function (id) {
  var it = JY.ITEMS[id];
  var s = fresh();
  s.money = 1000000; s.items = {};
  var price = G.pxPrice(s, id);
  var bought = G.buy(s, id);
  if (it.px === false) { ok(!bought, 'PX에서 안 파는 ' + id + '는 살 수 없어야 함'); s.items[id] = 1; }
  else {
    ok(bought && s.money === 1000000 - price && s.items[id] === 1, 'PX 구매 ' + id, { money: s.money, price: price, items: s.items[id] });
  }
  var before = clone(s.stats);
  var r = G.useItem(s, id);
  ok(r && s.items[id] === 0, '아이템 사용 후 개수 감소 ' + id);
  for (var k in it.fx) ok(s.stats[k] - before[k] === it.fx[k], '아이템 효과 ' + id + ' ' + k, { got: s.stats[k] - before[k], want: it.fx[k] });
});
// 소프트 한계: 95를 넘기지 않는다
(function () {
  var s = fresh(); s.items = { mandu: 1 }; s.stats.mt = 93;
  G.useItem(s, 'mandu');
  ok(s.stats.mt === 95, '아이템은 95를 넘기지 않음', s.stats.mt);
  var s2 = fresh(); s2.items = { hot6: 1 }; s2.stats.mt = 6;
  G.useItem(s2, 'hot6');
  ok(s2.stats.mt === 5, '아이템은 5 밑으로 내리지 않음', s2.stats.mt);
  var s3 = fresh(); s3.items = {};
  ok(G.useItem(s3, 'mandu') === null, '없는 아이템은 쓸 수 없음');
})();
// 먹보 성격 + 배낭 강화
(function () {
  var s = fresh({ trait: 'glutton', up: { pack: 2 } }); s.items = { mandu: 1 };
  G.STATS.forEach(function (k) { s.stats[k] = 50; });
  G.useItem(s, 'mandu');
  ok(s.stats.mt === 50 + Math.round(6 * 1.5 * 1.2), '먹보+배낭 아이템 배수', s.stats.mt);
})();
// PX 쿨다운
(function () {
  var s = fresh(); s.money = 100000; s.pxDay = 0;
  ok(G.pxStatus(s).ok, 'PX 열림');
  G.closePX(s, true);
  ok(!G.pxStatus(s).ok, 'PX 다녀오면 잠김');
  s.day += 4;
  ok(G.pxStatus(s).ok, '4일 뒤 PX 다시 열림');
})();

/* 2. 특급 보급품 */
(function () {
  var s = fresh(); s.leave = 0;
  G.usePremium(s, 'leave3'); ok(s.leave === 3, '포상휴가증 +3', s.leave);
  G.usePremium(s, 'insight'); ok(s.insight === 12, '투시경 12장', s.insight);
  s.current = 'mess_day'; s.cv = pin('mess_day');
  var c = G.currentCard(s);
  ok(c.l.preview.dir && Object.keys(c.l.preview.dir).length > 0, '투시경: 미리보기에 방향 표시', c.l.preview);
  G.usePremium(s, 'clover'); ok(s.luck === 15, '네잎클로버 15장', s.luck);
  s.stats = { hp: 90, mt: 10, tr: 55, bd: 44 };
  G.usePremium(s, 'feast');
  ok(s.stats.hp === 78 && s.stats.mt === 22 && s.stats.tr === 50 && s.stats.bd === 50, '회식권: 50 쪽으로 최대 12', s.stats);
  s.money = 0; s.pxDay = 999;
  G.usePremium(s, 'pxpass'); ok(s.money === 100000 && G.pxStatus(s).ok, 'PX 프리패스', { money: s.money });
  var d0 = s.day, cur0 = s.current;
  var r = G.usePremium(s, 'skip');
  ok(r && r.skipped && s.day >= d0 + 2 && s.seen[cur0] !== undefined, '짬처리권: 카드 넘김 + 이틀', { day: s.day });
})();

/* 3. 전역 보험 */
(function () {
  var s = fresh({ insurance: true }); s.insurance = 1;
  s.current = 'quiet'; s.cv = pin('quiet'); s.stats.hp = 1; s.stats.tr = 1;
  var r = G.choose(s, 'l'); // 누워서 쉰다: tr -2 → 0
  ok(!s.over && s.stats.tr === 50 && r.events.some(function (e) { return e.type === 'insurance'; }), '보험이 게임오버를 막음', { over: s.over, tr: s.stats.tr });
  s.current = 'quiet'; s.cv = pin('quiet'); s.stats.tr = 1;
  G.choose(s, 'l');
  ok(!!s.over && s.over.id === 'tr0', '보험은 한 번만', s.over && s.over.id);
})();

/* 4. 특수 대답 */
(function () {
  var s = fresh(); s.items = { chocopie: 2 };
  s.current = 'dumb_letter'; s.cv = pin('dumb_letter');
  var c = G.currentCard(s);
  ok(!!c.x && /초코파이/.test(c.x.t), '박덤벙 카드에 초코파이 특수 대답', c.x);
  var bd0 = s.stats.bd;
  var r = G.choose(s, 'x');
  ok(r && r.special && s.items.chocopie === 1 && s.stats.bd > bd0, '특수 대답: 아이템 소모 + 효과', { items: s.items, bd: s.stats.bd });
  var s2 = fresh(); s2.items = {};
  s2.current = 'dumb_letter'; s2.cv = pin('dumb_letter');
  ok(!G.currentCard(s2).x, '아이템 없으면 특수 대답 없음');
  ok(G.choose(s2, 'x') === null, '조건 없이 x 선택 불가');
})();

/* 5. 장면 변형 · 시작 슬롯 */
(function () {
  var seen = {};
  for (var i = 0; i < 6; i++) {
    var s = fresh(); s.current = 'q_senior'; s.cv = null; s.vlast = { q_senior: i % 3 };
    var c = G.currentCard(s);
    ok(!!c.text && !!c.l.t && !!c.r.t, '질문 은행 카드 렌더', c.key);
    seen[c.key] = 1;
  }
  ok(Object.keys(seen).length >= 2, '질문 은행에서 여러 장면이 나옴', Object.keys(seen));
  var s1 = fresh(); s1.current = 'q_senior'; s1.cv = null; var k1 = G.currentCard(s1).key;
  s1.cv = null; var k2 = G.currentCard(s1).key;
  ok(k1 !== k2, '같은 카드 연속 등장 시 직전과 다른 장면', [k1, k2]);
  var starts = {};
  for (var j = 0; j < 30; j++) {
    var st = G.newState({ start: '2026-03-02' });
    starts[[st.current].concat(st.queue).join(',')] = 1;
    ok(st.queue.length === 16, '시작 카드 17장 (훈련소 13 + 배치 + 자대 도착 3)', st.queue.length + 1);
    var g = 0; while (st.rank < 1 && g++ < 20) G.choose(st, 'r');
    ok(st.day === 35, '훈련소는 정확히 35일', st.day);
  }
  ok(Object.keys(starts).length > 20, '시작 구성이 매번 다름', Object.keys(starts).length);
})();

/* 6. 휴가 */
(function () {
  var s = fresh(); s.leave = 10; s.stats.mt = 40; s.stats.hp = 40;
  var d0 = s.day;
  var st = G.leaveStatus(s);
  ok(st.ok, '휴가 신청 가능', st);
  var r = G.takeLeave(s, 5);
  ok(r && s.day === d0 + 5 && s.leave === 5 && s.stats.mt > 40 && s.stats.hp > 40 && s.leaveUsed === 5, '휴가 5일', { day: s.day, leave: s.leave, mt: s.stats.mt });
  ok(!G.leaveStatus(s).ok, '복귀 직후엔 다시 못 나감');
  ok(['ret_mom', 'ret_bus', 'ret_late'].indexOf(s.current) >= 0, '복귀 카드가 나옴', s.current);
  var m = fresh(); m.day = m.total - 4; m.leave = 6;
  G.takeLeave(m, 6);
  ok(m.over && m.over.good && m.over.list.indexOf('malchul') >= 0, '말출 전역', m.over && m.over.list);
  var b = fresh(); b.leave = 10; b.conds = [{ id: 'drill', left: 3 }];
  ok(!G.leaveStatus(b).ok, '훈련 주간엔 휴가 통제');
})();

/* 7. 동료: 수다 · 선물 · 절친 */
(function () {
  var s = fresh(); s.items = { chocopie: 3, mandu: 1 };
  var a0 = s.aff.dumb;
  var t = G.talk(s, 'dumb');
  ok(t && s.aff.dumb === a0 + 4, '수다 호감도 +4', s.aff.dumb);
  var t2 = G.talk(s, 'dumb');
  ok(t2 && t2.cooldown, '수다는 6일 쿨다운', t2 && t2.cooldown);
  var a1 = s.aff.dumb;
  var g = G.gift(s, 'dumb', 'chocopie');
  ok(g && g.fav && s.aff.dumb === a1 + 18 && s.items.chocopie === 2, '좋아하는 선물 +18', s.aff.dumb);
  var a2 = s.aff.dumb;
  G.gift(s, 'dumb', 'mandu');
  ok(s.aff.dumb === a2 + 8, '일반 선물 +8', s.aff.dumb);
  s.aff.dumb = 65; s.bffs = {}; s.items.chocopie = 1;
  var g2 = G.gift(s, 'dumb', 'chocopie');
  ok(s.bffs.dumb && g2.events.some(function (e) { return e.type === 'bff'; }), '호감도 70 넘으면 절친', s.bffs);
  ok(!G.npcAvailable(s, 'hoobae'), '후임은 오기 전엔 없음');
  s.flags.hoobae = true;
  ok(G.npcAvailable(s, 'hoobae'), '후임 도착 후 등장');
  var c = fresh(); c.vars.cat = 1; c.items = { mandu: 1, tuna: 1 };
  var gc = G.gift(c, 'cat', 'mandu');
  ok(/참치/.test(gc.say), '짬타이거는 만두를 거절', gc.say);
  var p = fresh(); p.bffs.ppaen = true; p.aff.ppaen = 80;
  var p0 = fresh();
  ok(G.pxPrice(p, 'mandu') < G.pxPrice(p0, 'mandu'), '정뺀질 절친 PX 할인', [G.pxPrice(p, 'mandu'), G.pxPrice(p0, 'mandu')]);
})();

/* 8. 장비 강화 효과 */
(function () {
  var s = G.newState({ start: '2026-03-02', up: { notebook: 2, watch: 3, wallet: 2, boots: 4 } });
  ok(s.insight === 6, '수양록 +2 → 시작 투시 6장', s.insight);
  ok(s.undo === 2, '국방부 시계 +3 → 되돌리기 2회', s.undo);
  var plain = fresh(), rich = fresh({ up: { wallet: 2 } });
  ok(G.pxPrice(rich, 'mandu') < G.pxPrice(plain, 'mandu'), '지갑 강화 PX 할인');
  var b = fresh({ up: { boots: 4 } }), n = fresh();
  b.current = n.current = 'quiet'; b.cv = pin('quiet'); n.cv = pin('quiet');
  // 체력 감소가 큰 카드로 비교
  b.current = n.current = 'march40'; b.cv = pin('march40'); n.cv = pin('march40'); b.rank = n.rank = 2; b.stats.hp = n.stats.hp = 45;
  var rb = G.choose(b, 'l'), rn = G.choose(n, 'l');
  ok(rb.deltas.hp > rn.deltas.hp, '전투화 강화: 체력이 낮을 때 소모 감소', [rb.deltas.hp, rn.deltas.hp]);
  // 체력이 높을 때는 더 오르는 쪽(100 쪽)을 줄인다
  var b2 = fresh({ up: { boots: 4 } }), n2 = fresh();
  b2.stats.hp = n2.stats.hp = 70; b2.rank = n2.rank = 2; b2.current = n2.current = 'march40'; b2.cv = pin('march40'); n2.cv = pin('march40');
  var dB = G.choose(b2, 'l').deltas.hp, dN = G.choose(n2, 'l').deltas.hp;
  ok(dB === dN, '전투화 강화: 체력이 높을 때 소모는 그대로 (100 쪽 쏠림 방지)', [dB, dN]);
  // 부적/행운: 운이 좋으면 지금 상태에서 더 안전한 결과 (뱀 잡기: 전우애 +12 vs 체력 -10, 전우애가 90이면 체력 -10이 안전)
  function snake(luck) {
    var safe = 0;
    for (var i = 0; i < 300; i++) {
      var t = fresh(); t.stats.bd = 90; t.stats.hp = 90; t.luck = luck; t.current = 'em_snake'; t.cv = pin('em_snake');
      var r = G.choose(t, 'l'); if (r.deltas.hp < 0) safe++;
    }
    return safe / 300;
  }
  var sl = snake(5), su = snake(0);
  ok(sl > su + 0.12, '행운: 위험한 결과를 피한다', [sl, su]);
})();

/* 9. 되돌리기 (UI가 하는 방식 그대로) */
(function () {
  var s = fresh({ up: { watch: 1 } }); s.undo = 1;
  var snap = JSON.stringify(s);
  G.choose(s, 'r');
  var back = G.migrate(JSON.parse(snap)); back.undo -= 1;
  ok(back.day === 60 && back.current === 'quiet' && back.undo === 0, '되돌리기: 이전 상태로', { day: back.day, undo: back.undo });
})();

/* 10. 메타: 다이아 · 상점 · 상자 · 강화 · 임무 · 수집 · 레벨 */
(function () {
  store = {};
  var m = Meta.load();
  ok(m.gems === 50, '입대 환영 50 다이아', m.gems);
  var att = Meta.attendance();
  ok(att && att.reward === 10 && Meta.get().gems === 60, '출석 +10', att);
  ok(Meta.attendance() === null, '출석은 하루 한 번');
  ok(Meta.stash('insurance') === 1, '신병 보급: 전역 보험 1개 무료');
  ok(Meta.buyPremium('insurance') && Meta.stash('insurance') === 2 && Meta.get().gems === 20, '전역 보험 구매');
  ok(!Meta.buyPremium('leave3'), '다이아 부족하면 구매 실패');
  Meta.addGems(500);
  ok(Meta.buyCos('sunglasses') && Meta.ownsCos('sunglasses'), '꾸미기 구매');
  ok(Meta.get().cos.eq.face === 'sunglasses', '사면 바로 착용');
  var spec = Meta.dress({ eyes: 'normal', extras: [] });
  ok(spec.eyes === 'sunglasses', '착용한 꾸미기가 캐릭터에 반영', spec.eyes);
  Meta.equip('sunglasses');
  ok(Meta.get().cos.eq.face === null, '다시 누르면 벗음');
  ok(!Meta.buyCos('pinkcamo'), '레벨 해금 꾸미기는 살 수 없음');
  ok(!Meta.buyCos('crown'), '상자 전용 꾸미기는 살 수 없음');
  var g0 = Meta.get().gems;
  var box = Meta.openBox(false);
  ok(box && Meta.get().gems <= g0 - 30 + (box.gems || 0) && (box.items.length || box.cos || box.gems), '보급 상자 열기', box && box.tier.id);
  Meta.get().freeBoxes = 1; var g1 = Meta.get().gems;
  var fb = Meta.openBox(true);
  ok(fb && Meta.get().freeBoxes === 0 && Meta.get().gems >= g1, '무료 상자는 다이아 안 씀');
  ok(Meta.openBox(true) === null, '무료 상자 없으면 못 엶');
  // 짬 · 레벨 · 해금
  var lv0 = Meta.level().lv;
  var jr = Meta.addJjam(320);
  ok(Meta.level().lv === 3 && jr.ups.length === 2 && jr.unlocked.indexOf('beanie') >= 0 && jr.unlocked.indexOf('pt') >= 0, '짬 320 → Lv.3, 털모자·체육복 해금', { lv: Meta.level().lv, from: lv0, unlocked: jr.unlocked });
  var up = Meta.upgrade('boots');
  ok(up.ok && up.success && Meta.upLevel('boots') === 1 && Meta.get().jjam === 240, '강화 +1 (80 짬)', up);
  Meta.get().jjam = 0;
  ok(!Meta.upgrade('boots').ok, '짬 부족하면 강화 실패');
  // 임무
  var ms = Meta.missions();
  ok(ms.list.length === 3, '오늘의 임무 3개');
  var d = Meta.missionDef(ms.list[0].id);
  var done = d.max ? Meta.track(d.type, d.goal, true) : (function () { var x = []; for (var i = 0; i < d.goal; i++) x = x.concat(Meta.track(d.type)); return x; })();
  ok(done.length === 1 && ms.list[0].done, '임무 진행 → 완료', ms.list[0]);
  var gb = Meta.get().gems;
  var cl = Meta.claimMission(0);
  ok(cl && Meta.get().gems === gb + d.gem && ms.list[0].claimed, '임무 보상 받기');
  ok(Meta.claimMission(0) === null, '보상은 한 번만');
  // 수집
  var total = Meta.sceneTotal();
  ok(total > 250, '사건 수첩 장면 수', total);
  for (var i = 0; i < Math.ceil(total * 0.25); i++) Meta.see('t' + i);
  ok(Meta.collectAlert() === 1, '25% 달성 알림');
  ok(Meta.claimCollect(0) && Meta.collectAlert() === 0, '수집 보상 받기');
  // 한 판 끝
  var s = G.newState({ start: '2026-03-02', unit: 'recruit', mos: 'cook' });
  s.day = s.total; s.over = { id: 'normal', list: ['normal'], good: true, day: s.total };
  s.over.score = G.score(s);
  var fr = Meta.finishRun(s);
  ok(fr.jjam > 100 && fr.reward > 0 && Meta.get().records.length === 1, '전역 정산: 짬·다이아·기록', { jjam: fr.jjam, reward: fr.reward });
  ok(Meta.ownsCos('chefhat') && Meta.ownsCos('jogyohat'), '취사병·신교대 전역으로 모자 해금');
})();

/* 11. 오늘의 작전: 같은 날이면 같은 조건 */
(function () {
  var a = G.dailyConfig('2026-11-09'), b = G.dailyConfig('2026-11-09'), c = G.dailyConfig('2026-11-10');
  ok(JSON.stringify(a) === JSON.stringify(b), '오늘의 작전 조건 고정');
  ok(JSON.stringify(a) !== JSON.stringify(c), '날짜가 바뀌면 조건도 바뀜');
  var s1 = G.newState({ start: a.start, seed: a.seed, unit: a.unit, trait: a.trait, mos: a.mos, pace: 3 });
  var s2 = G.newState({ start: a.start, seed: a.seed, unit: a.unit, trait: a.trait, mos: a.mos, pace: 3 });
  var seq1 = [], seq2 = [];
  for (var i = 0; i < 25; i++) { seq1.push(s1.current); seq2.push(s2.current); G.choose(s1, 'l'); G.choose(s2, 'l'); if (s1.pendingMini) G.finishMini(s1, 'good'); if (s2.pendingMini) G.finishMini(s2, 'good'); }
  ok(seq1.join() === seq2.join(), '같은 선택이면 같은 카드 순서(시드 고정)');
})();

/* 12. 악조건 */
(function () {
  var base = fresh(), all = fresh({ heat: JY.HEAT_ORDER.slice() });
  all.current = base.current = 'mess_day'; all.cv = pin('mess_day'); base.cv = pin('mess_day');
  var cb = G.currentCard(base), ca = G.currentCard(all);
  ok(Object.keys(cb.l.preview).length > 0 && !ca.l.preview.hp && !ca.l.preview.mt && !ca.l.preview.tr && !ca.l.preview.bd, '눈치 제로: 미리보기 점 없음', ca.l.preview);
  ok(G.pxPrice(all, 'mandu') === G.pxPrice(base, 'mandu') * 2, 'PX 폐점 위기: 가격 2배', [G.pxPrice(all, 'mandu'), G.pxPrice(base, 'mandu')]);
  ok(G.usePremium(all, 'leave3') === null, '보험 금지: 특급 보급품 사용 불가');
  var ins = G.newState({ start: '2026-03-02', insurance: true, up: { watch: 5 }, heat: ['noinsure'] });
  ok(ins.insurance === 0 && ins.undo === 0, '보험 금지: 보험·되돌리기 0');
  all.current = base.current = 'em_snake'; all.cv = pin('em_snake'); base.cv = pin('em_snake');
  ok(G.currentCard(all).urgent === G.currentCard(base).urgent - 1.5, '돌발 지옥: 제한 시간 단축', [G.currentCard(all).urgent, G.currentCard(base).urgent]);
  var c1 = fresh({ heat: ['chaos'] }), c0 = fresh();
  c1.current = c0.current = 'em_snake'; c1.cv = pin('em_snake'); c0.cv = pin('em_snake'); c1.stats.mt = c0.stats.mt = 60;
  var t1 = G.choose(c1, 't').deltas.mt, t0 = G.choose(c0, 't').deltas.mt;
  ok(t0 < 0 && Math.abs(t1 - 2 * t0) <= 1, '돌발 지옥: 놓치면 피해 2배', [t1, t0]);
  var p1 = fresh(), p2 = fresh({ heat: ['noleave'] });
  ok(p2.total === p1.total + 60, '휴가 반납: 전역일 60일 연기', [p2.total, p1.total]);
  p1.promo = p2.promo = [0, 35, 61, 9999, 9999]; p1.leave = p2.leave = 0;
  G.choose(p1, 'l'); G.choose(p2, 'l');
  ok(p2.leave === 0 && p1.leave > 0, '휴가 반납: 진급 휴가 없음', [p1.leave, p2.leave]);
  var x1 = fresh(), x2 = fresh({ heat: ['pxclose'] }); x1.day = x2.day = 100;
  G.closePX(x1, true); G.closePX(x2, true);
  ok(x2.pxDay - 100 === 3 * (x1.pxDay - 100), 'PX 폐점 위기: 3배 오래 닫힘', [x1.pxDay, x2.pxDay]);
  var m1 = fresh({ up: { boots: 4, helmet: 5, watch: 3 }, heat: ['noinsure'] });
  ok(m1.up.boots === 2 && m1.up.helmet === 2 && m1.undo === 0, '맨몸 복무: 강화 절반 · 되돌리기 없음', m1.up);
  var h1 = fresh({ heat: ['fragile'] }), h0 = fresh();
  h1.current = h0.current = 'march40'; h1.cv = pin('march40'); h0.cv = pin('march40'); h1.rank = h0.rank = 2;
  ok(G.choose(h1, 'l').deltas.hp < G.choose(h0, 'l').deltas.hp, '롤러코스터: 체력이 더 크게 내려간다');
  var sA = fresh({ heat: ['haeng', 'blind'] }); sA.over = { good: true, list: ['normal'], day: sA.total };
  var sB = fresh(); sB.over = { good: true, list: ['normal'], day: sB.total };
  var hb = JY.HEAT.haeng.bonus + JY.HEAT.blind.bonus;
  ok(Math.abs(G.score(sA).total / G.score(sB).total - (1 + hb)) < 0.01, '악조건 점수 배수 (행보관 + 눈치 제로)', [G.score(sA).total, G.score(sB).total, hb]);
})();


/* 13. v6: 훈련소 소질 → 배치 → 자대 지도 */
(function () {
  // 훈련소: 카드마다 이틀, 선택하면 소질이 쌓인다
  var s = G.newState({ start: '2026-03-02', seed: 7 });
  ok(s.phase === 'train' && !s.assigned, '시작은 훈련소');
  s.current = 'apt_record'; s.cv = { id: 'apt_record', v: 0, k: 0 };
  var r = G.choose(s, 'l');
  ok(s.tags.shoot === 3 && r.events.some(function (e) { return e.type === 'tag' && e.spec === 'shoot'; }), '적성 카드: 사격 소질 +3', s.tags);
  ok(s.day === 2, '훈련소 카드는 이틀', s.day);
  s.current = 'tr_zero'; s.cv = { id: 'tr_zero', v: 0, k: 0 };
  G.choose(s, 'l');
  ok(s.tags.shoot === 6, '기존 훈련 카드도 소질 (영점사격 +3)', s.tags);
  // 배치 발표 카드가 나올 때 특기·보직·자대
  s.queue = ['tr_assign', 'ja_arrive']; s.current = 'quiet'; s.cv = pin('quiet');
  G.choose(s, 'l');
  ok(s.current === 'tr_assign' && s.assigned, '배치 발표 때 배치 결정');
  ok(s.spec && s.spec.id === 'shoot' && s.spec.lv === 2 && s.mos === 'infantry', '가장 큰 소질 → 특기 사격 Lv2 · 소총수', s.spec);
  ok(!!s.unit && s.assignInfo && s.assignInfo.why.length >= 1 && /숨/.test(s.assignInfo.why[0].txt), '배치 이유에 고른 선택지', s.assignInfo && s.assignInfo.why);
  var t2 = G.newState({ start: '2026-03-02', seed: 3 });
  t2.tags = { cook: 9, admin: 2 }; t2.queue = ['tr_assign']; t2.current = 'quiet'; t2.cv = pin('quiet'); G.choose(t2, 'r');
  ok(t2.spec.id === 'cook' && t2.mos === 'cook' && t2.spec.lv === 3, '요리 소질 → 취사병 · 요리 Lv3', t2.spec);
  // 배치 → 자대 도착 카드 → 부대 지도
  G.choose(s, 'r');
  ok(s.rank === 1 && s.phase === 'train', '수료: 이병, 아직 자대 도착 카드', [s.rank, s.phase, s.current]);
  G.choose(s, 'l');
  ok(s.phase === 'unit' && s.turn === 1, '자대 도착 카드가 끝나면 자대 생활 1턴', [s.phase, s.turn]);
  var guard = 0;
  while ((s.current || s.pendingMini) && guard++ < 5) { if (s.pendingMini) G.finishMini(s, 'good'); else G.choose(s, 'l'); }
  ok(s.step === 'free' && s.ap === G.apMax(s) && s.ap === 2, '일과 끝 → 개인정비 (이병 ⏱2)', [s.step, s.ap]);

  function unit(opts) {
    var u = G.newState(Object.assign({ start: '2026-03-02', unit: 'coast', mos: 'infantry', seed: 11 }, opts || {}));
    u.rank = 2; u.day = 120; u.queue = []; u.current = null; u.assigned = true; u.phase = 'unit'; u.turn = 3; u.step = 'free'; u.ap = 3; u.pendingMini = null;
    u.spec = { id: (opts && opts.spec) || 'social', lv: 2, xp: 0 }; u.emer.since = 0;
    G.STATS.forEach(function (k) { u.stats[k] = 50; });
    return u;
  }
  // 행동: 시간·효과·미리보기
  var a = unit(), locs = G.locations(a), bar = locs.filter(function (l) { return l.id === 'barracks'; })[0];
  var chat = bar.acts.filter(function (x) { return x.id === 'chat'; })[0];
  ok(chat.ok && chat.fx.bd > 0 && chat.cost === 1, '지도: 생활관 수다 미리보기', chat);
  var bd0 = a.stats.bd, r1 = G.doAction(a, 'barracks', 'chat');
  ok(r1 && a.ap === 2 && (r1.caught || a.stats.bd - bd0 === chat.fx.bd), '수다: 시간 1 쓰고 미리보기만큼 전우애', [a.ap, a.stats.bd - bd0, chat.fx.bd, r1.caught]);
  // 특기 전용 행동은 다른 특기에게 잠김
  var lock = G.actionStatus(a, 'range', 'sharp');
  ok(!lock.ok && lock.lock, '특등사수 도전은 사격 특기 전용', lock);
  // 필요 물건·돈
  ok(!G.actionStatus(a, 'office', 'coffee').ok, '커피 없으면 커피 타기 불가');
  a.items.coffee = 1; var tr0 = a.stats.tr; G.doAction(a, 'office', 'coffee');
  ok(!(a.items.coffee > 0) && a.stats.tr > tr0, '커피 타 드리기: 커피 1개 쓰고 신뢰 상승', a.stats.tr - tr0);
  a.money = 0; ok(!G.actionStatus(a, 'px', 'freezer').ok, '돈 없으면 냉동고 뽑기 불가');
  // 시간이 다 떨어지면 행동 불가
  a.ap = 0; ok(!G.actionStatus(a, 'barracks', 'nap').ok, '개인정비 시간 0이면 행동 불가');
  // 득템
  var gotLoot = 0, legend = 0;
  for (var i = 0; i < 60; i++) { var u = unit({ seed: 100 + i }); var lr = G.doAction(u, 'supply', 'scavenge'); if (lr && lr.loot) { gotLoot += lr.loot.length; lr.loot.forEach(function (l) { if (!(u.items[l.id] > 0)) legend = -999; }); } }
  ok(gotLoot > 40 && legend === 0, '보급창고 파밍: 득템이 가방에 들어간다', gotLoot);
  // 행보관에게 걸림: 위험한 곳일수록, 눈치 특기는 덜
  function caughtRate(spec) { var n = 0; for (var i = 0; i < 300; i++) { var u = unit({ seed: 500 + i, spec: spec }); var cr = G.doAction(u, 'hill', 'hide'); if (cr && cr.caught) n++; } return n / 300; }
  var cOther = caughtRate('shoot'), cSocial = caughtRate('social');
  ok(cOther > 0.07 && cOther < 0.22 && cSocial < cOther, '뒷산 몰래 꿀잠: 가끔 걸리고 눈치 특기는 덜 걸림', [cOther, cSocial]);
  // 특기 행동 → 미니게임 → 등급별 결과, 경험치·레벨
  var sh = unit({ spec: 'shoot' }); sh.spec.lv = 2; sh.spec.xp = 5;
  var mr = G.doAction(sh, 'range', 'sharp');
  ok(mr && mr.mini === 'shoot' && sh.pendingMini && sh.cd['range.sharp'] === sh.turn + 4, '특등사수 도전: 사격 미니게임 + 4턴 쉬기', mr);
  var leave0 = sh.leave, fr = G.finishMini(sh, 'great');
  ok(sh.leave - leave0 === 3 && sh.spec.lv === 3, '대성공: 포상휴가 3일 + 특기 레벨 업', [sh.leave - leave0, sh.spec]);
  ok(fr.events.some(function (e) { return e.type === 'speclv'; }), '특기 레벨 업 알림');
  // 조합
  var c = unit();
  ok(!G.craft(c, 'bbog'), '라면 없으면 뽀글이 불가');
  c.items.ramen = 1; var cr2 = G.craft(c, 'bbog');
  ok(cr2 && c.items.bbog === 1 && !(c.items.ramen > 0) && cr2.crafted.first && c.recipes.bbog === 1, '뽀글이 조합: 라면 → 뽀글이 (새 레시피)', cr2 && cr2.crafted);
  var mt0 = c.stats.mt; G.useItem(c, 'bbog'); ok(c.stats.mt > mt0, '뽀글이 먹으면 멘탈 상승');
  var ck = unit({ spec: 'cook' }); ck.spec.lv = 3; ck.items.chocopie = 3; G.craft(ck, 'cake');
  ok(ck.items.cake === 2, '요리 특기 Lv3: 하나 더', ck.items.cake);
  c.items.tuna = 1; c.items.hotbar = 1; G.craft(c, 'catsnack'); var cat0 = c.aff.cat; G.useItem(c, 'catsnack');
  ok(c.aff.cat > cat0, '짬타이거 특식: 고양이 호감도', [cat0, c.aff.cat]);
  // 턴 끝: 밤 → 날짜가 흐르고 다음 턴
  var e = unit({ pace: 3 }); var day0 = e.day, turn0 = e.turn;
  var er = G.endFree(e);
  var g2 = 0;
  while ((e.current || e.pendingMini) && e.step === 'night' && g2++ < 5) G.choose(e, 'l');
  ok(e.day - day0 === G.TURN_DAYS[3] && e.turn === turn0 + 1, '취침 → 4주 흐르고 다음 턴 (속성 복무)', [e.day - day0, e.turn]);
  // 휴가는 개인정비 때만, 쓰면 그 턴은 끝
  var lv = unit(); lv.leave = 5; lv.lastLeaveEnd = -999;
  lv.step = 'duty'; ok(!G.leaveStatus(lv).ok, '일과 중엔 휴가 신청 불가');
  lv.step = 'free'; ok(G.leaveStatus(lv).ok, '개인정비 때 휴가 신청 가능');
  G.takeLeave(lv, 3); ok(lv.ap === 0 && lv.step === 'night' && !!lv.current, '휴가 다녀오면 그 턴은 복귀 카드로 끝', [lv.ap, lv.step, lv.current]);
  // PX: 자대에선 다녀오면 시간 1
  var px = unit(); px.money = 100000; G.buy(px, 'ramen'); G.closePX(px, true);
  ok(px.ap === 2 && px.items.ramen === 1, 'PX 장보기: 개인정비 시간 1', px.ap);
  // 위험 경고: 끝에 닿는 행동은 표시
  var d = unit(); d.stats.hp = 95;
  var nap = G.locations(d).filter(function (l) { return l.id === 'barracks'; })[0].acts.filter(function (x) { return x.id === 'nap'; })[0];
  ok(nap.danger, '체력 95에서 꿀잠: 위험 표시', nap);
  // 예전 저장(단계 없음)도 열린다
  var old = clone(fresh()); delete old.phase; delete old.tags; delete old.assigned; delete old.cardsOnly;
  var mg = G.migrate(old);
  ok(mg.phase === 'train' && mg.assigned === true && mg.spec, '예전 저장 불러오기: 수료한 판은 자대 지도로 이어진다', [mg.phase, mg.assigned]);
})();


/* 14. v7: 2D 월드 규칙 (걷기 시간 · 점호 · 줍기 · 부탁 · 이야기 · 시야) */
(function () {
  function unit(opts) {
    var u = G.newState(Object.assign({ start: '2026-03-02', unit: 'coast', mos: 'infantry', seed: 31 }, opts || {}));
    u.rank = 2; u.day = 120; u.queue = []; u.current = null; u.assigned = true; u.phase = 'unit'; u.turn = 3; u.step = 'free'; u.ap = 3; u.walkMin = 0; u.pick = 0;
    u.spec = { id: 'shoot', lv: 2, xp: 0 }; u.emer.since = 0;
    G.STATS.forEach(function (k) { u.stats[k] = 50; });
    return u;
  }
  var w = unit();
  ok(G.minutesLeft(w) === 180, '개인정비 3시간 = 180분', G.minutesLeft(w));
  G.walk(w, 70);
  ok(w.ap === 2 && w.walkMin === 10 && G.minutesLeft(w) === 110, '70분 걸으면 시간 1 + 10분', [w.ap, w.walkMin]);
  // 점호: 생활관에 있으면 그냥 취침, 없으면 지각
  var r1 = unit(), tr0 = r1.stats.tr; var rr = G.rollcall(r1, false);
  ok(rr && rr.late && r1.lates === 1 && (r1.turn === 4 || (r1.step === 'night' && !!r1.current)), '점호 지각: 벌점 + 밤 사건 또는 다음 턴', [rr && rr.late, r1.lates, r1.step, r1.turn]);
  ok(rr.events.some(function (e) { return e.type === 'late'; }), '점호 지각 알림');
  var r2 = unit(); var ok2 = G.rollcall(r2, true);
  ok(ok2 && !ok2.late && !r2.lates, '생활관에서 점호: 벌점 없음');
  // 줍기: 한 턴에 6번까지
  var pk = unit(), got = 0;
  for (var i = 0; i < 9; i++) { var pr = G.pickup(pk, 'forest'); if (pr) got += (pr.loot || []).length; }
  ok(pk.pick === 6 && got === 6, '반짝이 줍기: 턴당 6개까지', [pk.pick, got]);
  ok(G.pickup(unit(), 'nope') === null, '정해진 득템표만 줍기');
  // 부탁: 물건을 건네면 보상
  var q = unit(); q.quest = { who: 'dumb', item: 'chocopie', ask: '?', thanks: '고마워', reward: { aff: { dumb: 10 }, fx: { mt: 4 }, gem: 2 }, done: false };
  q.items.chocopie = 0; ok(G.completeQuest(q) === null, '물건 없으면 부탁 못 들어줌');
  q.items.chocopie = 1; var a0 = q.aff.dumb, qr = G.completeQuest(q);
  ok(qr && q.quest.done && q.aff.dumb > a0 && !(q.items.chocopie > 0) && q.gems >= 2, '부탁 완료: 물건 주고 호감도·다이아', [a0, q.aff.dumb, q.gems]);
  ok(G.completeQuest(q) === null, '같은 부탁은 한 번만');
  var t = unit(); t.step = 'night'; t.turn = 3; t.current = 'quiet'; t.cv = pin('quiet'); G.choose(t, 'l');
  ok(t.turn === 4 && (t.quest === null || (t.quest && JY.NPCS[t.quest.who])), '새 턴마다 부탁이 새로 (또는 없음)', t.quest);
  // 이야기 듣기: 그 사람이 나오는 장면, 턴당 한 번
  var st = unit(), id = G.npcStory(st, 'dumb');
  var c = id && G.currentCard(st);
  ok(id && c && c.who === 'dumb', '박덤벙에게 이야기 듣기: 박덤벙 장면', [id, c && c.who]);
  G.choose(st, 'l');
  ok(st.step === 'free' && !st.current, '이야기 끝나면 다시 개인정비 (시간 안 씀)', [st.step, st.ap]);
  ok(G.npcStory(st, 'dumb') === null, '같은 사람 이야기는 턴당 한 번');
  // 행보관 시야: 2D에선 보이면 걸리고, 안 보이면 안 걸림 (노는 행동만)
  var s1 = unit(), r3 = G.doAction(s1, 'hill', 'hide', { world: true, seen: true });
  ok(r3 && r3.caught, '보이는 데서 몰래 꿀잠 → 걸림');
  var n = 0; for (var j = 0; j < 40; j++) { var s2 = unit({ seed: 900 + j }); var r4 = G.doAction(s2, 'hill', 'hide', { world: true, seen: false }); if (r4 && r4.caught) n++; }
  ok(n === 0, '안 보이면 안 걸림', n);
  var s3 = unit(), r5 = G.doAction(s3, 'office', 'paper', { world: true, seen: true });
  ok(r5 && !r5.caught, '일하는 행동은 보여도 괜찮다 (서류 정리)');
})();

console.log('통과 ' + passes + '개' + (fails.length ? ', 실패 ' + fails.length + '개' : ''));
if (fails.length) { console.log(fails.map(function (f) { return ' ✗ ' + f; }).join('\n')); process.exit(1); }
