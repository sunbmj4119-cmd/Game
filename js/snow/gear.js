/* 제설각 v18 — 오래 하는 성장 (DOM 없음). 궁수의 전설(Archero)식 구조를 군대 제설에 맞췄다:
 *  · 장구류: 5칸(장갑·전투화·넉가래 날·군장·부대 마크) × 5등급. 같은 칸·같은 등급 3개 → 한 등급 위. 초코파이 + 정비 부품으로 강화. 전역해도 남는다
 *  · 보급 상자: 일반(4시간마다 무료) · 고급(10번째 영웅 확정) · 특급(그날 살수록 싸지고 15번째 전설 확정)
 *  · 출동 체력: 작전 1번 5, 10분에 1, 최대 25. 이병은 안 든다. 아침 점호 때 가득, 상점으로 채우기(하루 갈수록 비싸진다)
 *  · 일일 임무: 날마다 5개 → 점수 단계 보상 · 복무 패스: 28일 시즌 30단계, 무료/프리미엄(상점) 두 줄 */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim;
  function M() { return JY.SnowMeta; }
  function dayKey(now) { var d = new Date(now); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hashStr(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function init(save) {
    save.gear = save.gear || { eq: {}, items: [], seq: 0 };
    if (typeof save.parts !== 'number') save.parts = 0;
    save.pity = save.pity || { good: 0, elite: 0 };
    save.chestT = save.chestT || {};
    save.energy = save.energy || { v: S.ENERGY.max, t: 0 };
    save.daily = save.daily || {};
    save.stats = save.stats || {};
    return save;
  }
  function stat(save, k, n) { save.stats[k] = (save.stats[k] || 0) + (n || 1); }

  /* ── 장구류 ── */
  function slotDef(id) { for (var i = 0; i < S.GEAR.slots.length; i++) if (S.GEAR.slots[i].id === id) return S.GEAR.slots[i]; return null; }
  function rarIdx(id) { for (var i = 0; i < S.GEAR.rar.length; i++) if (S.GEAR.rar[i].id === id) return i; return 0; }
  function rarDef(id) { return S.GEAR.rar[rarIdx(id)]; }
  function isTop(id) { return rarIdx(id) >= S.GEAR.rar.length - 1; }   // 신화: 더 합칠 수 없다
  function itemStat(it) { var sl = slotDef(it.slot); return sl ? sl.base * rarDef(it.rar).mul * (1 + S.GEAR.lvStep * (it.lv - 1)) : 0; }
  function findItem(save, id) { init(save); for (var i = 0; i < save.gear.items.length; i++) if (save.gear.items[i].id === id) return save.gear.items[i]; return null; }
  function equipped(save, slotId) { init(save); return findItem(save, save.gear.eq[slotId]); }
  function equip(save, id) { var it = findItem(save, id); if (!it) return false; save.gear.eq[it.slot] = it.id; return true; }
  function autoEquip(save, it) { var cur = equipped(save, it.slot); if (!cur || itemStat(it) > itemStat(cur)) save.gear.eq[it.slot] = it.id; }
  function addItem(save, slotId, rarId) {
    init(save); var it = { id: ++save.gear.seq, slot: slotId, rar: rarId, lv: 1 };
    save.gear.items.push(it); autoEquip(save, it); return it;
  }
  // 낀 장구의 효과 합 (손 빠르기·이동·범위·적재·초코파이)
  function bonus(save) {
    var out = { hand: 0, move: 0, range: 0, cap: 0, pay: 0 };
    if (!save || !save.gear) return out;
    S.GEAR.slots.forEach(function (sl) { var it = findItem(save, save.gear.eq[sl.id]); if (it) out[sl.stat] += itemStat(it); });
    return out;
  }
  function upCost(it) { var ri = rarIdx(it.rar) + 1; return { pie: Math.round(S.GEAR.upPie * ri * Math.pow(it.lv, 1.4)), parts: S.GEAR.upParts + Math.floor(it.lv / 5) }; }
  function canUp(save, it) { var c = upCost(it); return it.lv < rarDef(it.rar).maxLv && save.bank >= c.pie && save.parts >= c.parts; }
  function upgrade(save, id) {
    var it = findItem(save, id); if (!it || !canUp(save, it)) return null;
    var c = upCost(it); save.bank -= c.pie; save.parts -= c.parts; it.lv++; stat(save, 'gearUp');
    return { item: it, cost: c };
  }
  // 합칠 수 있는 묶음: 같은 칸·같은 등급 3개 이상 (전설은 끝)
  function mergeable(save) {
    init(save); var groups = {};
    save.gear.items.forEach(function (it) { if (isTop(it.rar)) return; var k = it.slot + ':' + it.rar; (groups[k] = groups[k] || []).push(it); });
    return Object.keys(groups).filter(function (k) { return groups[k].length >= S.GEAR.merge; }).map(function (k) { return { slot: groups[k][0].slot, rar: groups[k][0].rar, items: groups[k] }; });
  }
  function merge(save, slotId, rarId) {
    init(save);
    var list = save.gear.items.filter(function (it) { return it.slot === slotId && it.rar === rarId; });
    if (list.length < S.GEAR.merge || isTop(rarId)) return null;
    // 낀 것 · 레벨 높은 것부터 재료로 (결과가 그 레벨을 이어받는다)
    var eqId = save.gear.eq[slotId];
    list.sort(function (a, b) { return (b.id === eqId) - (a.id === eqId) || b.lv - a.lv; });
    var use = list.slice(0, S.GEAR.merge), next = S.GEAR.rar[rarIdx(rarId) + 1];
    var lv = Math.min(next.maxLv, Math.max.apply(null, use.map(function (u) { return u.lv; })));
    var wasEq = use.some(function (u) { return u.id === eqId; });
    save.gear.items = save.gear.items.filter(function (it) { return use.indexOf(it) < 0; });
    var it = { id: ++save.gear.seq, slot: slotId, rar: next.id, lv: lv };
    save.gear.items.push(it);
    if (wasEq || !equipped(save, slotId)) save.gear.eq[slotId] = it.id; else autoEquip(save, it);
    stat(save, 'merge');
    return it;
  }
  function mergeAll(save) {
    var made = [], g;
    for (var guard = 0; guard < 200 && (g = mergeable(save)[0]); guard++) made.push(merge(save, g.slot, g.rar));
    return made;
  }

  /* ── 보급 상자 ── */
  function chestDef(id) { for (var i = 0; i < S.CHESTS.length; i++) if (S.CHESTS[i].id === id) return S.CHESTS[i]; return null; }
  function rollRar(odds, R) {
    var tot = 0, k; for (k in odds) tot += odds[k];
    var x = R() * tot; for (k in odds) { x -= odds[k]; if (x < 0) return k; }
    return Object.keys(odds)[0];
  }
  // 특급 상자: 그날 산 만큼 싸진다 (90 → 85 → 80)
  function price(save, id, now) {
    var ch = chestDef(id); if (!Array.isArray(ch.dia)) return ch.dia;
    var b = save.daily.chestBuy && save.daily.chestBuy.d === dayKey(now) ? save.daily.chestBuy.n : 0;
    return ch.dia[Math.min(ch.dia.length - 1, b)];
  }
  function freeIn(save, id, now) { var ch = chestDef(id); if (!ch || !ch.free) return -1; init(save); var t = save.chestT[id] || 0; return Math.max(0, Math.ceil((t + ch.free * 1000 - now) / 1000)); }
  function pityLeft(save, id) { var ch = chestDef(id); if (!ch || !ch.pity) return 0; init(save); return ch.pity.n - (save.pity[id] || 0); }
  // 상자 하나 여는 알맹이 (값은 밖에서). 확정: n번째 안에 그 등급 이상이 안 나왔으면 그 등급
  function roll(save, ch, R, usePity) {
    var rar = rollRar(ch.odds, R);
    if (usePity && ch.pity) {
      save.pity[ch.id] = (save.pity[ch.id] || 0) + 1;
      if (rarIdx(rar) < rarIdx(ch.pity.rar) && save.pity[ch.id] >= ch.pity.n) rar = ch.pity.rar;
      if (rarIdx(rar) >= rarIdx(ch.pity.rar)) save.pity[ch.id] = 0;
    }
    var sl = S.GEAR.slots[(R() * S.GEAR.slots.length) | 0], it = addItem(save, sl.id, rar);
    var parts = ch.parts[0] + Math.floor(R() * (ch.parts[1] - ch.parts[0] + 1));
    save.parts += parts; stat(save, 'boxOpen');
    return { item: it, parts: parts, pity: !!(usePity && ch.pity && rar === ch.pity.rar) };
  }
  // how: 'free' | 'dia' | 'ten'
  function open(save, id, how, now, R) {
    init(save); R = R || Math.random; var ch = chestDef(id); if (!ch) return null;
    var n = how === 'ten' ? 10 : 1, cost = 0;
    if (how === 'free') { if (!ch.free || freeIn(save, id, now) > 0) return null; save.chestT[id] = now; }
    else {
      cost = how === 'ten' ? ch.ten : price(save, id, now);
      if (!cost || save.dia < cost) return null;
      save.dia -= cost;
      if (Array.isArray(ch.dia)) { var dk = dayKey(now); if (!save.daily.chestBuy || save.daily.chestBuy.d !== dk) save.daily.chestBuy = { d: dk, n: 0 }; save.daily.chestBuy.n++; }
    }
    var got = []; for (var i = 0; i < n; i++) got.push(roll(save, ch, R, true));
    return { chest: ch, cost: cost, got: got };
  }
  // 예전 보급 상자(점호·훈장·이야기)에도 장구가 하나씩 든다: 일반 → 일반 상자 확률, 희귀 → 고급, 전설 → 특급 (확정 카운트는 안 센다)
  function boxGear(save, tier, R) { init(save); var ch = chestDef(tier === 'legend' ? 'elite' : tier === 'rare' ? 'good' : 'basic'); return roll(save, ch, R || Math.random, false); }

  /* ── 출동 체력 ── */
  function needs(save) { return G.rankOf(save) >= S.ENERGY.fromRank; }
  function energy(save, now) {
    init(save); var E = S.ENERGY, e = save.energy;
    if (!e.t) e.t = now;
    if (e.v < E.max) { var gain = Math.floor((now - e.t) / 1000 / E.regen); if (gain > 0) { e.v = Math.min(E.max, e.v + gain); e.t += gain * E.regen * 1000; } }
    if (e.v >= E.max) e.t = now;
    return { v: e.v, max: E.max, cost: E.cost, next: e.v >= E.max ? 0 : Math.max(0, Math.ceil(E.regen - (now - e.t) / 1000)), need: needs(save), ok: !needs(save) || e.v >= E.cost };
  }
  function spend(save, now) {
    if (!needs(save)) return true;
    var e = energy(save, now); if (e.v < S.ENERGY.cost) return false;
    save.energy.v -= S.ENERGY.cost; return true;
  }
  function refillPrice(save, now) { var r = save.daily.refill && save.daily.refill.d === dayKey(now) ? save.daily.refill.n : 0; return S.ENERGY.refill[Math.min(S.ENERGY.refill.length - 1, r)]; }
  function refill(save, now) {
    init(save); var p = refillPrice(save, now); if (save.dia < p) return null;
    energy(save, now); save.dia -= p; save.energy.v += S.ENERGY.max;   // 넘쳐도 된다 (궁수의 전설처럼)
    var dk = dayKey(now); if (!save.daily.refill || save.daily.refill.d !== dk) save.daily.refill = { d: dk, n: 0 }; save.daily.refill.n++;
    return { cost: p, v: save.energy.v };
  }
  function fill(save, now) { energy(save, now); if (save.energy.v < S.ENERGY.max) save.energy.v = S.ENERGY.max; save.energy.t = now; }

  /* ── 복무 패스 ── */
  function seasonOf(now) { return Math.floor(Math.floor(now / 86400000) / S.PASS.season); }
  function pass(save, now) {
    init(save); var s = seasonOf(now);
    if (!save.pass || save.pass.season !== s) save.pass = { season: s, xp: 0, prem: false, got: {}, gotP: {} };
    var P = save.pass, tier = Math.min(S.PASS.tiers, Math.floor(P.xp / S.PASS.xp));
    var endsIn = (s + 1) * S.PASS.season * 86400000 - now;
    return { tier: tier, xp: P.xp, into: P.xp % S.PASS.xp, prem: P.prem, days: Math.max(1, Math.ceil(endsIn / 86400000)), claim: claimable(save, tier) };
  }
  function passReward(t, prem) {
    if (prem) return t === S.PASS.tiers ? { gear: 'l' } : t % 5 === 0 ? { box: 'legend' } : { dia: 4 };
    return t === S.PASS.tiers ? { box: 'legend', dia: 10 } : t % 5 === 0 ? { box: 'rare' } : t % 2 === 0 ? { parts: 5 } : { box: 'common' };
  }
  function claimable(save, tier) { var n = 0; for (var t = 1; t <= tier; t++) { if (!save.pass.got[t]) n++; if (save.pass.prem && !save.pass.gotP[t]) n++; } return n; }
  function passXp(save, now, n) { pass(save, now); save.pass.xp = Math.min(S.PASS.tiers * S.PASS.xp, save.pass.xp + n); return pass(save, now); }
  function giveReward(save, r, R) {
    var out = [];
    if (r.dia) { save.dia += r.dia; save.diaLife = (save.diaLife || 0) + r.dia; out.push('상점 +' + r.dia); }
    if (r.parts) { save.parts += r.parts; out.push('정비 부품 +' + r.parts); }
    if (r.box) { save.boxes = save.boxes || []; save.boxes.push(r.box); out.push((M() && M().TIER[r.box] ? M().TIER[r.box].name : '보급 상자')); }
    if (r.gear) { var sl = S.GEAR.slots[((R || Math.random)() * S.GEAR.slots.length) | 0], it = addItem(save, sl.id, r.gear); out.push(rarDef(r.gear).name + ' ' + sl.name); }
    if (r.pie) { var amt = Math.round(300 * (1 + G.rankOf(save)) * G.incomeMult(save)); save.bank += amt; save.life += amt; out.push('초코파이 +' + amt); }
    return out;
  }
  function claimPass(save, now) {
    var p = pass(save, now), got = [];
    for (var t = 1; t <= p.tier; t++) {
      if (!save.pass.got[t]) { save.pass.got[t] = 1; got = got.concat(giveReward(save, passReward(t, false))); }
      if (save.pass.prem && !save.pass.gotP[t]) { save.pass.gotP[t] = 1; got = got.concat(giveReward(save, passReward(t, true))); }
    }
    return got;
  }
  function buyPremium(save, now) { pass(save, now); if (save.pass.prem || save.dia < S.PASS.premium) return false; save.dia -= S.PASS.premium; save.pass.prem = true; return true; }

  /* ── 일일 임무 ── */
  function missions(save, now) {
    init(save); var dk = dayKey(now), D = save.daily.mis;
    if (!D || D.date !== dk) {
      var pool = S.MISSIONS.filter(function (q) { return !q.need || G.feat(save, q.need); }), R = G.mulberry(hashStr(dk) + (save.seed || 0));
      pool = pool.slice(); var pick = [];
      while (pick.length < S.MISSION_DAY.n && pool.length) pick.push(pool.splice((R() * pool.length) | 0, 1)[0]);
      D = save.daily.mis = { date: dk, list: pick.map(function (q) { return { id: q.id, base: save.stats[q.stat] || 0, xp: 0 }; }), got: {} };
    }
    var pts = 0, list = D.list.map(function (m) {
      var q = S.MISSIONS.filter(function (x) { return x.id === m.id; })[0]; if (!q) return null;
      var prog = Math.max(0, Math.min(q.goal, (save.stats[q.stat] || 0) - m.base)), done = prog >= q.goal;
      if (done) { pts += S.MISSION_DAY.pts; if (!m.xp) { m.xp = 1; passXp(save, now, S.PASS.mission); } }
      return { id: q.id, text: q.text, goal: q.goal, prog: prog, done: done };
    }).filter(Boolean);
    var steps = S.MISSION_DAY.steps.map(function (st, i) { return { at: st.at, reward: st, got: !!D.got[i], can: pts >= st.at && !D.got[i] }; });
    return { list: list, pts: pts, max: S.MISSION_DAY.n * S.MISSION_DAY.pts, steps: steps, claim: steps.filter(function (s) { return s.can; }).length };
  }
  function claimStep(save, now, i) {
    var m = missions(save, now), st = m.steps[i]; if (!st || !st.can) return null;
    save.daily.mis.got[i] = 1; return giveReward(save, S.MISSION_DAY.steps[i]);
  }
  // 아침 점호: 체력 가득 + 패스 경험치
  function onRollCall(save, now) { fill(save, now); passXp(save, now, S.PASS.roll); }
  // 작전 끝: ★ × 15 패스 경험치
  function onOpEnd(save, now, stars) { passXp(save, now, (stars || 0) * S.PASS.opStar); missions(save, now); }

  JY.SnowGear = {
    init: init, slotDef: slotDef, rarDef: rarDef, rarIdx: rarIdx, itemStat: itemStat, findItem: findItem, equipped: equipped, equip: equip, addItem: addItem, bonus: bonus,
    upCost: upCost, canUp: canUp, upgrade: upgrade, mergeable: mergeable, merge: merge, mergeAll: mergeAll,
    chestDef: chestDef, price: price, freeIn: freeIn, pityLeft: pityLeft, open: open, boxGear: boxGear,
    needs: needs, energy: energy, spend: spend, refillPrice: refillPrice, refill: refill, fill: fill,
    pass: pass, passReward: passReward, passXp: passXp, claimPass: claimPass, buyPremium: buyPremium, giveReward: giveReward,
    missions: missions, claimStep: claimStep, onRollCall: onRollCall, onOpEnd: onOpEnd, dayKey: dayKey
  };
})(window.JY = window.JY || {});
