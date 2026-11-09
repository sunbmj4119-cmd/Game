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
      ach: {}, stats: { emer: 0, miniGreat: 0, units: {}, mosOut: {} },
      records: [], daily: {}, login: { last: null, streak: 0 }, lastName: '',
      jjam: 0, jjamTotal: 0, up: {}, missions: null, scenes: {}, collectClaimed: {}, freeBoxes: 0, v3gift: false
    };
  }

  function load() {
    var m = lsGet(KEY) || {};
    var b = blank();
    for (var k in b) if (m[k] === undefined) m[k] = b[k];
    m.cos.owned = m.cos.owned || {}; m.cos.eq = m.cos.eq || {};
    ['hat', 'face', 'fx', 'body', 'prop'].forEach(function (k) { if (m.cos.eq[k] === undefined) m.cos.eq[k] = null; });
    m.stats.units = m.stats.units || {}; m.stats.mosOut = m.stats.mosOut || {};
    m.up = m.up || {}; m.scenes = m.scenes || {}; m.collectClaimed = m.collectClaimed || {};
    if (!m.welcome) { m.welcome = true; m.gems += 50; m.gemsTotal += 50; m.pendingWelcome = true; m.v3gift = true; }
    if (!m.v3gift) { // 업데이트 선물: 그동안 플레이한 만큼 짬
      m.v3gift = true;
      var g = Math.min(600, 80 + (m.runs || 0) * 60);
      m.jjam += g; m.jjamTotal += g; m.gems += 30; m.gemsTotal += 30;
      m.pendingUpdateGift = { jjam: g, gem: 30 };
    }
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
    if (!c || c.gacha || c.unlock || ownsCos(id) || !spend(c.price)) return false;
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
    (JY.SLOT_ORDER || ['hat', 'face', 'fx']).forEach(function (s) { if (eq[s] && JY.COSMETICS[eq[s]] && get().cos.owned[eq[s]]) list.push(eq[s]); });
    return list;
  }
  // 캐릭터 스펙에 꾸미기 적용
  function dress(spec) {
    equipped().forEach(function (id) {
      var c = JY.COSMETICS[id];
      if (c.hat) spec.hat = c.hat;
      if (c.eyes) spec.eyes = c.eyes;
      if (c.extras) spec.extras = (spec.extras || []).concat(c.extras);
      if (c.body) spec.body = c.body;
      if (c.prop && !spec.prop) spec.prop = c.prop;
    });
    return spec;
  }
  function badge() { return equipped().map(function (id) { return JY.COSMETICS[id].icon; }).join(''); }

  /* 보급 상자 */
  function openBox(free) {
    var B = JY.BOX;
    if (free) { if (!(get().freeBoxes > 0)) return null; get().freeBoxes -= 1; }
    else if (!spend(B.price)) return null;
    var r = Math.random(), acc = 0, tier = B.tiers[0];
    for (var i = 0; i < B.tiers.length; i++) { acc += B.tiers[i].p; if (r < acc) { tier = B.tiers[i]; break; } }
    var m = get(), out = { tier: tier, items: [], cos: null, gems: 0 };
    function giveItem(id) { m.stash[id] = (m.stash[id] || 0) + 1; out.items.push(id); }
    if (tier.id === 'legend') {
      if (!m.cos.owned[tier.legendCos]) { m.cos.owned[tier.legendCos] = true; out.cos = tier.legendCos; }
      else { out.gems = tier.gems; addGems(tier.gems); }
    } else if (tier.cosmetic) {
      var cands = JY.COSMETIC_ORDER.filter(function (id) { var c = JY.COSMETICS[id]; return !m.cos.owned[id] && !c.unlock && (!c.gacha || c.gacha === 'epic'); });
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
    if (o.good) { m.discharges += 1; m.stats.units[s.unit] = (m.stats.units[s.unit] || 0) + 1; m.stats.mosOut[s.mos] = (m.stats.mosOut[s.mos] || 0) + 1; } else m.fails += 1;
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
    // 짬: 버틴 날 + 점수 + 전역 보너스
    var served = o.good ? s.total + 1 : o.day;
    var jj = Math.floor(served / 4) + Math.floor(sc.total / 150) + (o.good ? 30 : 0);
    if (s.daily) jj = Math.round(jj * 1.2);
    var jr = addJjam(jj);
    save();
    return { reward: reward, newEndings: newEndings, ach: ach, place: place, record: rec, dailyFirst: dailyFirst, runGems: s.gems, jjam: jj, levelUps: jr.ups, unlocked: jr.unlocked };
  }


  /* ── 짬 · 레벨 ─────────────────────────── */
  function lvInfo(total) {
    var L = JY.LEVELS, lv = 1;
    while (L.need(lv + 1) <= total) lv++;
    var base = L.need(lv), next = L.need(lv + 1);
    var title = L.titles[0][1];
    L.titles.forEach(function (t) { if (lv >= t[0]) title = t[1]; });
    return { lv: lv, cur: total - base, need: next - base, title: title, total: total };
  }
  function level() { return lvInfo(get().jjamTotal || 0); }
  function addJjam(n) {
    var m = get();
    n = Math.max(0, Math.round(n || 0));
    var before = lvInfo(m.jjamTotal).lv;
    m.jjam += n; m.jjamTotal += n;
    var after = lvInfo(m.jjamTotal).lv, ups = [];
    for (var L = before + 1; L <= after; L++) {
      var rw = { lv: L, gem: 20, box: 0 };
      var extra = JY.LEVELS.rewards[L];
      if (extra) { rw.gem += extra.gem || 0; rw.box += extra.box || 0; }
      addGems(rw.gem);
      m.freeBoxes = (m.freeBoxes || 0) + rw.box;
      ups.push(rw);
    }
    var unlocked = checkUnlocks();
    save();
    return { n: n, ups: ups, unlocked: unlocked };
  }

  /* ── 꾸미기 해금 조건 ─────────────────── */
  function unlockText(c) {
    var u = c.unlock || {};
    if (u.level) return '짬 레벨 ' + u.level;
    if (u.ach) { var a = JY.ACHIEVEMENTS.filter(function (x) { return x.id === u.ach; })[0]; return '훈장: ' + (a ? a.name : u.ach); }
    if (u.mosOut) return JY.Game.MOS[u.mosOut].name + '(으)로 전역';
    if (u.unitOut) return JY.UNITS[u.unitOut].short + ' 부대에서 전역';
    if (u.collect) return '사건 수첩 ' + Math.round(u.collect * 100) + '%';
    return '';
  }
  function unlockOk(c) {
    var u = c.unlock, m = get();
    if (!u) return false;
    if (u.level) return level().lv >= u.level;
    if (u.ach) return !!m.ach[u.ach];
    if (u.mosOut) return !!m.stats.mosOut[u.mosOut];
    if (u.unitOut) return !!m.stats.units[u.unitOut];
    if (u.collect) return collectProgress().frac >= u.collect;
    return false;
  }
  function checkUnlocks() {
    var m = get(), got = [];
    JY.COSMETIC_ORDER.forEach(function (id) {
      var c = JY.COSMETICS[id];
      if (c.unlock && !m.cos.owned[id] && unlockOk(c)) { m.cos.owned[id] = true; got.push(id); }
    });
    if (got.length) save();
    return got;
  }

  /* ── 장비 강화 ─────────────────────────── */
  function upLevel(id) { return get().up[id] || 0; }
  function upgrade(id) {
    var m = get(), lv = upLevel(id);
    if (lv >= 5) return { ok: false, reason: '이미 최대 강화(+5)다.' };
    var cost = JY.UPGRADE_COST[lv];
    if (m.jjam < cost) return { ok: false, reason: '짬이 부족하다. (' + cost + ' 필요)' };
    m.jjam -= cost;
    var rate = JY.UPGRADE_RATE[lv];
    var success = Math.random() < rate;
    var refund = 0;
    if (success) m.up[id] = lv + 1;
    else { refund = Math.floor(cost / 2); m.jjam += refund; }
    save();
    return { ok: true, success: success, lv: m.up[id] || lv, cost: cost, refund: refund, rate: rate };
  }

  /* ── 오늘의 임무 ───────────────────────── */
  function missionDef(id) { return JY.MISSIONS.filter(function (x) { return x.id === id; })[0]; }
  function missions() {
    var m = get(), t = today();
    if (!m.missions || m.missions.date !== t) {
      var r = JY.art.mulberry(JY.art.hash('mission-' + t));
      var pool = JY.MISSIONS.slice(), list = [], types = {};
      while (list.length < 3 && pool.length) {
        var d = pool.splice(Math.floor(r() * pool.length), 1)[0];
        if (types[d.type]) continue;
        types[d.type] = 1;
        list.push({ id: d.id, prog: 0, done: false, claimed: false });
      }
      m.missions = { date: t, list: list, bonus: false };
      save();
    }
    return m.missions;
  }
  function track(type, n, isMax) {
    var ms = missions(), done = [], changed = false;
    ms.list.forEach(function (x) {
      var d = missionDef(x.id);
      if (!d || d.type !== type || x.done) return;
      if (d.max || isMax) x.prog = Math.max(x.prog, n || 0);
      else x.prog += (n === undefined ? 1 : n);
      changed = true;
      if (x.prog >= d.goal) { x.prog = d.goal; x.done = true; done.push(d); }
    });
    if (changed) save();
    return done;
  }
  function claimMission(i) {
    var ms = missions(), x = ms.list[i];
    if (!x || !x.done || x.claimed) return null;
    var d = missionDef(x.id);
    x.claimed = true;
    addGems(d.gem);
    var jr = addJjam(d.jjam);
    var bonus = false;
    if (!ms.bonus && ms.list.every(function (y) { return y.claimed; })) { ms.bonus = true; get().freeBoxes = (get().freeBoxes || 0) + 1; bonus = true; }
    save();
    return { d: d, bonus: bonus, ups: jr.ups, unlocked: jr.unlocked };
  }
  function missionAlert() { var ms = missions(); return ms.list.filter(function (x) { return x.done && !x.claimed; }).length; }

  /* ── 사건 수첩 (본 장면 모으기) ──────────── */
  var SCENE_TOTAL = 0;
  function sceneTotal() {
    if (SCENE_TOTAL) return SCENE_TOTAL;
    var idx = JY.Game._index(), n = 0;
    for (var id in idx) { var c = idx[id]; if (c.text && c.l) n++; n += (c.variants || []).length; }
    SCENE_TOTAL = n;
    return n;
  }
  function see(key) {
    var m = get();
    if (!key || m.scenes[key]) return false;
    m.scenes[key] = 1; save();
    return true;
  }
  function collectProgress() {
    var n = Object.keys(get().scenes).length, t = sceneTotal();
    return { n: n, total: t, frac: t ? Math.min(1, n / t) : 0 };
  }
  function claimCollect(i) {
    var m = get(), ms = JY.COLLECT_MILESTONES[i];
    if (!ms || m.collectClaimed[i] || collectProgress().frac < ms.at) return null;
    m.collectClaimed[i] = true;
    addGems(ms.gem);
    var jr = addJjam(ms.jjam);
    if (ms.cos) { m.cos.owned[ms.cos] = true; }
    save();
    return { ms: ms, ups: jr.ups };
  }
  function collectAlert() {
    var m = get(), f = collectProgress().frac;
    return JY.COLLECT_MILESTONES.filter(function (ms, i) { return f >= ms.at && !m.collectClaimed[i]; }).length;
  }

  JY.Meta = {
    load: load, save: save, get: get, addGems: addGems, spend: spend, attendance: attendance,
    stash: stash, buyPremium: buyPremium, useStash: useStash,
    ownsCos: ownsCos, buyCos: buyCos, equip: equip, equipped: equipped, dress: dress, badge: badge,
    openBox: openBox, unlock: unlock, finishRun: finishRun,
    level: level, lvInfo: lvInfo, addJjam: addJjam, unlockText: unlockText, checkUnlocks: checkUnlocks,
    upLevel: upLevel, upgrade: upgrade, missions: missions, missionDef: missionDef, track: track, claimMission: claimMission, missionAlert: missionAlert,
    see: see, collectProgress: collectProgress, claimCollect: claimCollect, collectAlert: collectAlert, sceneTotal: sceneTotal
  };
})(window.JY = window.JY || {});
