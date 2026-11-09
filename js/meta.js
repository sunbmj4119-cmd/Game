/* 판을 넘어 쌓이는 것들: 다이아, 상점, 보급 상자, 훈장, 출석, 기록 (DOM 없음) */
(function (JY) {
  'use strict';

  var KEY = 'jy.meta.v1';
  var M = null;

  function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }
  function today() { return JY.Game.todayStr(); }
  function dayDiff(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }

  function blank() {
    return {
      v: 2, endings: {}, runs: 0, discharges: 0, fails: 0, best: 0,
      gems: 0, gemsTotal: 0, welcome: false,
      stash: {}, cos: { owned: {}, eq: { hat: null, face: null, fx: null } },
      ach: {}, stats: { emer: 0, miniGreat: 0, units: {} },
      records: [], daily: {}, login: { last: null, streak: 0 }, lastName: ''
    };
  }

  function load() {
    var m = lsGet(KEY) || {};
    var b = blank();
    for (var k in b) if (m[k] === undefined) m[k] = b[k];
    m.cos.owned = m.cos.owned || {}; m.cos.eq = m.cos.eq || { hat: null, face: null, fx: null };
    m.stats.units = m.stats.units || {};
    if (!m.welcome) { m.welcome = true; m.gems += 50; m.gemsTotal += 50; m.pendingWelcome = true; }
    M = m;
    save();
    return M;
  }
  function save() { if (M) lsSet(KEY, M); }
  function get() { return M || load(); }

  function addGems(n) {
    var m = get();
    n = Math.max(0, Math.round(n));
    m.gems += n; m.gemsTotal += n;
    save();
    return n;
  }
  function spend(n) {
    var m = get();
    if (m.gems < n) return false;
    m.gems -= n; save();
    return true;
  }

  /* 출석 체크 */
  function attendance() {
    var m = get(), t = today();
    if (m.login.last === t) return null;
    var streak = m.login.last && dayDiff(m.login.last, t) === 1 ? m.login.streak + 1 : 1;
    m.login = { last: t, streak: streak };
    var reward = 10 + Math.min(streak - 1, 6) * 3;
    addGems(reward);
    var ach = [];
    if (streak >= 7) ach = unlock(['streak7']);
    save();
    return { reward: reward, streak: streak, ach: ach };
  }

  /* 상점 */
  function stash(id) { return get().stash[id] || 0; }
  function buyPremium(id) {
    var p = JY.PREMIUM[id];
    if (!p || !spend(p.price)) return false;
    get().stash[id] = stash(id) + 1; save();
    return true;
  }
  function useStash(id) {
    var m = get();
    if (!(m.stash[id] > 0)) return false;
    m.stash[id] -= 1; save();
    return true;
  }
  function ownsCos(id) { return !!get().cos.owned[id]; }
  function buyCos(id) {
    var c = JY.COSMETICS[id];
    if (!c || c.gacha || ownsCos(id) || !spend(c.price)) return false;
    get().cos.owned[id] = true;
    equip(id);
    return true;
  }
  function equip(id) {
    var m = get(), c = JY.COSMETICS[id];
    if (!c || !m.cos.owned[id]) return;
    m.cos.eq[c.slot] = m.cos.eq[c.slot] === id ? null : id;
    save();
  }
  function equipped() {
    var eq = get().cos.eq, list = [];
    ['hat', 'face', 'fx'].forEach(function (s) { if (eq[s] && JY.COSMETICS[eq[s]]) list.push(eq[s]); });
    return list;
  }
  // 캐릭터 스펙에 꾸미기 적용
  function dress(spec) {
    equipped().forEach(function (id) {
      var c = JY.COSMETICS[id];
      if (c.hat) spec.hat = c.hat;
      if (c.eyes) spec.eyes = c.eyes;
      if (c.extras) spec.extras = (spec.extras || []).concat(c.extras);
    });
    return spec;
  }
  function badge() { return equipped().map(function (id) { return JY.COSMETICS[id].icon; }).join(''); }

  /* 보급 상자 */
  function openBox() {
    var B = JY.BOX;
    if (!spend(B.price)) return null;
    var r = Math.random(), acc = 0, tier = B.tiers[0];
    for (var i = 0; i < B.tiers.length; i++) { acc += B.tiers[i].p; if (r < acc) { tier = B.tiers[i]; break; } }
    var m = get(), out = { tier: tier, items: [], cos: null, gems: 0 };
    function giveItem(id) { m.stash[id] = (m.stash[id] || 0) + 1; out.items.push(id); }
    if (tier.id === 'legend') {
      if (!m.cos.owned[tier.legendCos]) { m.cos.owned[tier.legendCos] = true; out.cos = tier.legendCos; }
      else { out.gems = tier.gems; addGems(tier.gems); }
    } else if (tier.cosmetic) {
      var cands = JY.COSMETIC_ORDER.filter(function (id) { var c = JY.COSMETICS[id]; return !m.cos.owned[id] && (!c.gacha || c.gacha === 'epic'); });
      if (cands.length && Math.random() < 0.6) { var pick = cands[Math.floor(Math.random() * cands.length)]; m.cos.owned[pick] = true; out.cos = pick; }
      else tier.pool.forEach(giveItem);
    } else {
      for (var k = 0; k < tier.count; k++) giveItem(tier.pool[Math.floor(Math.random() * tier.pool.length)]);
    }
    save();
    return out;
  }

  /* 훈장 */
  function unlock(ids) {
    var m = get(), got = [];
    ids.forEach(function (id) {
      if (m.ach[id]) return;
      var a = JY.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
      if (!a) return;
      m.ach[id] = today();
      addGems(a.gem);
      got.push(a);
    });
    save();
    return got;
  }

  /* 한 판이 끝났을 때: 기록, 보상, 훈장 */
  function finishRun(s) {
    var m = get(), o = s.over, sc = o.score || JY.Game.score(s);
    var newEndings = o.list.filter(function (id) { return !m.endings[id]; });
    o.list.forEach(function (id) { m.endings[id] = (m.endings[id] || 0) + 1; });
    m.best = Math.max(m.best || 0, o.day);
    if (o.good) { m.discharges += 1; m.stats.units[s.unit] = (m.stats.units[s.unit] || 0) + 1; } else m.fails += 1;
    m.stats.emer += s.emer.count;
    m.stats.miniGreat += s.minis.great;

    // 다이아 보상
    var tr = JY.Game.traitOf(s);
    var reward = o.good ? 20 + (o.list.length - 1) * 10 : 3 + Math.floor(JY.Game.progress(s) * 12);
    reward += newEndings.length * 15 + Math.floor(sc.total / 2000);
    var dailyFirst = false;
    if (s.daily) {
      var prev = m.daily[s.daily];
      if (!prev) { reward += 10; dailyFirst = true; }
      if (!prev || sc.total > prev.score) m.daily[s.daily] = { score: sc.total, ending: o.id, name: s.name };
      var dkeys = Object.keys(m.daily).sort();
      while (dkeys.length > 30) delete m.daily[dkeys.shift()];
    }
    reward = Math.round(reward * (tr.gemMult || 1));
    addGems(reward);

    // 기록 (상위 10)
    var rec = { score: sc.total, title: sc.title, name: s.name, ending: o.id, good: o.good, mos: s.mos, unit: s.unit, trait: s.trait, days: o.good ? s.total + 1 : o.day, daily: s.daily || null, date: today(), cos: badge() };
    m.records.push(rec);
    m.records.sort(function (a, b) { return b.score - a.score; });
    m.records = m.records.slice(0, 10);
    var place = m.records.indexOf(rec);

    // 훈장
    var ids = ['first_run'];
    if (o.good) ids.push('first_out');
    var nEnd = Object.keys(m.endings).length;
    if (nEnd >= 5) ids.push('end5');
    if (nEnd >= 10) ids.push('end10');
    if (nEnd >= JY.ENDING_ORDER.length) ids.push('end19');
    if (s.flags.sharp) ids.push('sharp');
    if (s.flags.special) ids.push('special');
    if (o.list.indexOf('cat') >= 0) ids.push('cat');
    if (o.list.indexOf('gf') >= 0) ids.push('gf');
    if (o.list.indexOf('malchul') >= 0) ids.push('malchul');
    if (o.good && JY.Game.bank(s).total >= 35000000) ids.push('rich');
    if (o.good && s.leaveUsed === 0) ids.push('noleave');
    if (m.stats.emer >= 10) ids.push('emer10');
    if (m.stats.miniGreat >= 10) ids.push('mini10');
    if (JY.Game.bffCount(s) >= 3) ids.push('bff3');
    if (JY.UNIT_ORDER.every(function (u) { return m.stats.units[u]; })) ids.push('allunits');
    if (s.daily) ids.push('daily');
    if (sc.total >= 20000) ids.push('score20k');
    if (m.fails >= 10) ids.push('fail10');
    var ach = unlock(ids);
    save();
    return { reward: reward, newEndings: newEndings, ach: ach, place: place, record: rec, dailyFirst: dailyFirst, runGems: s.gems };
  }

  JY.Meta = {
    load: load, save: save, get: get, addGems: addGems, spend: spend, attendance: attendance,
    stash: stash, buyPremium: buyPremium, useStash: useStash,
    ownsCos: ownsCos, buyCos: buyCos, equip: equip, equipped: equipped, dress: dress, badge: badge,
    openBox: openBox, unlock: unlock, finishRun: finishRun
  };
})(window.JY = window.JY || {});
