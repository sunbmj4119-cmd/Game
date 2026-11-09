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
var JY = global.JY, G = JY.Game, Meta = JY.Meta;

var fails = [], passes = 0;
function ok(cond, name, detail) { if (cond) passes++; else fails.push(name + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); }
function fresh(opts) {
  var s = G.newState(Object.assign({ start: '2026-03-02', mos: 'infantry', name: '점검병', unit: 'coast' }, opts || {}));
  s.rank = 1; s.day = 60; s.queue = []; s.current = 'quiet'; s.cv = null;
  s.promo = [0, 35, 9999, 9999, 9999]; // 점검 중엔 진급이 끼어들지 않게
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
  s.current = 'mess_day'; s.cv = null;
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
  s.current = 'quiet'; s.cv = null; s.stats.hp = 1; s.stats.tr = 1;
  var r = G.choose(s, 'l'); // 누워서 쉰다: tr -2 → 0
  ok(!s.over && s.stats.tr === 50 && r.events.some(function (e) { return e.type === 'insurance'; }), '보험이 게임오버를 막음', { over: s.over, tr: s.stats.tr });
  s.current = 'quiet'; s.cv = null; s.stats.tr = 1;
  G.choose(s, 'l');
  ok(!!s.over && s.over.id === 'tr0', '보험은 한 번만', s.over && s.over.id);
})();

/* 4. 특수 대답 */
(function () {
  var s = fresh(); s.items = { chocopie: 2 };
  s.current = 'dumb_letter'; s.cv = null;
  var c = G.currentCard(s);
  ok(!!c.x && /초코파이/.test(c.x.t), '박덤벙 카드에 초코파이 특수 대답', c.x);
  var bd0 = s.stats.bd;
  var r = G.choose(s, 'x');
  ok(r && r.special && s.items.chocopie === 1 && s.stats.bd > bd0, '특수 대답: 아이템 소모 + 효과', { items: s.items, bd: s.stats.bd });
  var s2 = fresh(); s2.items = {};
  s2.current = 'dumb_letter'; s2.cv = null;
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
    ok(st.queue.length === 10, '시작 카드 11장', st.queue.length + 1);
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
  b.current = n.current = 'quiet'; b.cv = n.cv = null;
  // 체력 감소가 큰 카드로 비교
  b.current = n.current = 'march40'; b.cv = n.cv = null; b.rank = n.rank = 2; b.stats.hp = n.stats.hp = 45;
  var rb = G.choose(b, 'l'), rn = G.choose(n, 'l');
  ok(rb.deltas.hp > rn.deltas.hp, '전투화 강화: 체력이 낮을 때 소모 감소', [rb.deltas.hp, rn.deltas.hp]);
  // 체력이 높을 때는 더 오르는 쪽(100 쪽)을 줄인다
  var b2 = fresh({ up: { boots: 4 } }), n2 = fresh();
  b2.stats.hp = n2.stats.hp = 70; b2.rank = n2.rank = 2; b2.current = n2.current = 'march40'; b2.cv = n2.cv = null;
  var dB = G.choose(b2, 'l').deltas.hp, dN = G.choose(n2, 'l').deltas.hp;
  ok(dB === dN, '전투화 강화: 체력이 높을 때 소모는 그대로 (100 쪽 쏠림 방지)', [dB, dN]);
  // 부적/행운: 운이 좋으면 지금 상태에서 더 안전한 결과 (뱀 잡기: 전우애 +12 vs 체력 -10, 전우애가 90이면 체력 -10이 안전)
  function snake(luck) {
    var safe = 0;
    for (var i = 0; i < 300; i++) {
      var t = fresh(); t.stats.bd = 90; t.stats.hp = 90; t.luck = luck; t.current = 'em_snake'; t.cv = null;
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
  all.current = base.current = 'mess_day'; all.cv = base.cv = null;
  var cb = G.currentCard(base), ca = G.currentCard(all);
  ok(Object.keys(cb.l.preview).length > 0 && !ca.l.preview.hp && !ca.l.preview.mt && !ca.l.preview.tr && !ca.l.preview.bd, '눈치 제로: 미리보기 점 없음', ca.l.preview);
  ok(G.pxPrice(all, 'mandu') === G.pxPrice(base, 'mandu') * 2, 'PX 폐점 위기: 가격 2배', [G.pxPrice(all, 'mandu'), G.pxPrice(base, 'mandu')]);
  ok(G.usePremium(all, 'leave3') === null, '보험 금지: 특급 보급품 사용 불가');
  var ins = G.newState({ start: '2026-03-02', insurance: true, up: { watch: 5 }, heat: ['noinsure'] });
  ok(ins.insurance === 0 && ins.undo === 0, '보험 금지: 보험·되돌리기 0');
  all.current = base.current = 'em_snake'; all.cv = base.cv = null;
  ok(G.currentCard(all).urgent === G.currentCard(base).urgent - 1.5, '돌발 지옥: 제한 시간 단축', [G.currentCard(all).urgent, G.currentCard(base).urgent]);
  var c1 = fresh({ heat: ['chaos'] }), c0 = fresh();
  c1.current = c0.current = 'em_snake'; c1.cv = c0.cv = null; c1.stats.mt = c0.stats.mt = 60;
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
  h1.current = h0.current = 'march40'; h1.cv = h0.cv = null; h1.rank = h0.rank = 2;
  ok(G.choose(h1, 'l').deltas.hp < G.choose(h0, 'l').deltas.hp, '롤러코스터: 체력이 더 크게 내려간다');
  var sA = fresh({ heat: ['haeng', 'blind'] }); sA.over = { good: true, list: ['normal'], day: sA.total };
  var sB = fresh(); sB.over = { good: true, list: ['normal'], day: sB.total };
  var hb = JY.HEAT.haeng.bonus + JY.HEAT.blind.bonus;
  ok(Math.abs(G.score(sA).total / G.score(sB).total - (1 + hb)) < 0.01, '악조건 점수 배수 (행보관 + 눈치 제로)', [G.score(sA).total, G.score(sB).total, hb]);
})();

console.log('통과 ' + passes + '개' + (fails.length ? ', 실패 ' + fails.length + '개' : ''));
if (fails.length) { console.log(fails.map(function (f) { return ' ✗ ' + f; }).join('\n')); process.exit(1); }
