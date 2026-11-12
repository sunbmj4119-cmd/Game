/* 제설각 — 바깥 보상 (DOM 없음): 보급 상자(일반·희귀·전설), 아침 점호 출석, 훈장, 진급 다이아 */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim;

  var TIER = {
    common: { name: '일반 보급 상자', color: '#c9d6e6' },
    rare: { name: '희귀 보급 상자', color: '#6fb7ff' },
    legend: { name: '전설 보급 상자', color: '#ffbf3a' }
  };

  function dateStr(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  // 하루 첫 접속 = 아침 점호. 연속 출석: 3일마다 희귀, 7일마다 전설
  function rollCall(save, now) {
    var today = dateStr(now), yest = dateStr(now - 86400000), r = save.roll || (save.roll = { date: '', streak: 0 });
    if (r.date === today) return null;
    r.streak = r.date === yest ? r.streak + 1 : 1; r.date = today;
    var tier = r.streak % 7 === 0 ? 'legend' : r.streak % 3 === 0 ? 'rare' : 'common';
    save.boxes.push(tier);
    return { streak: r.streak, tier: tier };
  }

  function pickItem(rars) {
    var pool = S.TREASURE.filter(function (t) { return rars.indexOf(t.r) >= 0; });
    return pool[(Math.random() * pool.length) | 0];
  }
  // 상자 하나 열기 → 보상 바로 지급
  function openBox(save) {
    if (!save.boxes || !save.boxes.length) return null;
    var tier = save.boxes.shift(), R = Math.random, rank = G.rankOf(save), base = (100 + 40 * save.day) * (1 + rank) * G.incomeMult(save);
    var out = { tier: tier, name: TIER[tier].name, pie: 0, dia: 0, item: null };
    if (tier === 'common') { out.pie = base * (1 + R()); out.dia = R() < 0.35 ? 1 : 0; }
    else if (tier === 'rare') { out.pie = base * 3 * (1 + R() * 0.5); out.dia = 2 + (R() < 0.5 ? 1 : 0); out.item = pickItem(['c', 'u']); }
    else { out.pie = base * 8; out.dia = 5 + ((R() * 4) | 0); out.item = pickItem(['r', 'l']); }
    out.pie = Math.round(out.pie);
    save.bank += out.pie; save.life += out.pie; save.dia += out.dia; save.diaLife += out.dia;
    if (out.item) { save.found[out.item.id] = (save.found[out.item.id] || 0) + 1; save.stats.found = (save.stats.found || 0) + 1; }
    return out;
  }

  function statOf(save, k) {
    if (k === 'bestCombo') return save.bestCombo || 0;
    if (k === 'foundKinds') return Object.keys(save.found || {}).length;
    if (k === 'crew') return G.crewCount(save);
    return (save.stats || {})[k] || 0;
  }
  function achList(save) {
    return S.ACH.map(function (A) { var v = statOf(save, A.stat); return { id: A.id, name: A.name, desc: A.desc, goal: A.goal, prog: Math.min(v, A.goal), have: !!save.ach[A.id], dia: A.dia, box: A.box || null }; });
  }
  // 1초마다: 새로 단 훈장, 진급 다이아
  function check(w) {
    var save = w.save, got = [];
    if (w.demo) return got;
    S.ACH.forEach(function (A) {
      if (save.ach[A.id] || statOf(save, A.stat) < A.goal) return;
      save.ach[A.id] = true; got.push(A);
      G.gainDia(w, A.dia, 'ach');
      if (A.box) save.boxes.push(A.box);
      w.fx.push({ t: 'ach', ach: A });
    });
    questCheck(w);
    var r = G.rankOf(save);
    if (r > (save.rankDia || 0)) { var n = 3 * (r - (save.rankDia || 0)) + r; save.rankDia = r; G.gainDia(w, n, 'rank'); }
    return got;
  }

  /* ── 할 일 (안내) ── */
  function questNow(save) { return S.QUESTS[save.quest || 0] || null; }
  function questProg(save, w, q) {
    if (!q) return 0;
    switch (q.stat) {
      case 'load': return w ? Math.floor(w.player.load) + ((save.stats.dumps || 0) > 0 ? q.goal : 0) : 0;
      case 'life': return save.life > 0 ? 1 : 0;
      case 'tool': return save.tool;
      case 'rank': return G.rankOf(save);
      case 'zone': return save.zones[q.key] ? 1 : 0;
      case 'crew': return G.crewCount(save);
      case 'pend': return G.crewCount(save) + (save.pend || []).length;
      default: return (save.stats || {})[q.stat] || 0;
    }
  }
  function questCheck(w) {
    var save = w.save, q = questNow(save), guard = 0;
    while (q && questProg(save, w, q) >= q.goal && guard++ < 3) {
      save.quest = (save.quest || 0) + 1;
      var pie = q.pie ? Math.round(q.pie * G.incomeMult(save)) : 0;
      if (pie) { save.bank += pie; save.life += pie; }
      if (q.dia) G.gainDia(w, q.dia, 'quest');
      w.fx.push({ t: 'quest', q: q, pie: pie, dia: q.dia || 0, next: questNow(save), n: save.quest, total: S.QUESTS.length });
      q = questNow(save);
    }
  }

  /* ── 스토리 ── */
  function storyMet(save, w, when) {
    if (when === 'start') return true;
    if (when === 'dump1') return (save.stats.dumps || 0) >= 1;
    if (when === 'perfect1') return (save.stats.perfect || 0) >= 1;
    if (when === 'crew1') return G.crewCount(save) >= 1;
    if (when === 'inspect') return !!(w && w.inspect);
    if (when === 'op1') return (save.stats.ops || 0) >= 1;
    if (when === 'exam') return !!(w && w.op && w.op.exam);
    if (when === 'canDischarge') return G.canDischarge(save);
    if (when.indexOf('zone:') === 0) return !!save.zones[when.slice(5)];
    if (when.indexOf('rank:') === 0) return G.rankOf(save) >= +when.slice(5);
    return false;
  }
  // 다음에 보여 줄 장면 (조건이 맞은 것 중 순서대로)
  function storyNext(save, w) {
    save.story = save.story || {};
    for (var i = 0; i < S.STORY.length; i++) { var c = S.STORY[i]; if (!save.story[c.id] && storyMet(save, w, c.when)) return c; }
    return null;
  }
  function storyDone(save, ch) {
    if (save.story[ch.id]) return null;
    save.story[ch.id] = true;
    var r = ch.reward || {}, out = {};
    if (r.dia) { save.dia += r.dia; save.diaLife += r.dia; out.dia = r.dia; }
    if (r.box) { save.boxes.push(r.box); out.box = r.box; }
    if (r.unlock) { save.unlocked[r.unlock] = true; out.unlock = lookName(r.unlock); }
    return out;
  }
  function fill(text, save) {
    var L = save.look || {}, nm = L.name || '김제설';
    return String(text).replace(/\{name\}/g, nm).replace(/\{rank\}/g, S.RANKS[G.rankOf(save)].name);
  }

  /* ── 꾸미기 ── */
  function lookEntry(cat, id) { return (S.LOOK[cat] || []).filter(function (e) { return e[0] === id; })[0] || null; }
  function lookName(key) { var p = key.split(':'), e = lookEntry(p[0], p[1]); return e ? S.LOOK_NAMES[p[0]] + ' · ' + e[1] : key; }
  function owns(save, cat, e) { return (!e[2] && !e[3]) || !!save.unlocked[cat + ':' + e[0]] || (e[3] && !!save.unlocked[e[3]]); }
  function lookOptions(save) {
    var out = {};
    Object.keys(S.LOOK).forEach(function (cat) {
      var cur = save.look[cat];
      out[cat] = S.LOOK[cat].map(function (e) {
        var own = owns(save, cat, e), on = cat === 'extras' ? (cur || []).indexOf(e[0]) >= 0 : cur === e[0];
        return { cat: cat, id: e[0], name: e[1], dia: e[2] || 0, lockKey: e[3] || '', color: e[4] || (cat === 'skin' ? e[0] : ''), own: own, on: on,
          state: own ? 'own' : e[2] ? 'buy' : 'lock', ok: !own && e[2] && save.dia >= e[2] };
      });
    });
    return out;
  }
  // 고르기: 가진 것만. 얼굴 소품은 최대 3개까지 켜고 끈다
  function setLook(save, cat, id) {
    var e = lookEntry(cat, id); if (!e || !owns(save, cat, e)) return false;
    if (cat === 'extras') {
      var list = (save.look.extras || []).slice(), i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1); else { list.push(id); if (list.length > 3) list.shift(); }
      save.look.extras = list;
    } else save.look[cat] = id;
    return true;
  }
  function buyLook(save, cat, id) {
    var e = lookEntry(cat, id); if (!e || owns(save, cat, e) || !e[2] || save.dia < e[2]) return false;
    save.dia -= e[2]; save.unlocked[cat + ':' + id] = true; setLook(save, cat, id);
    return true;
  }
  var ART_HAT = { beanie: 'beanie', helmet: 'helmet', cap: 'cap', none: 'none', headband: 'headband', cateears: 'cateears', beret: 'beret', crown: 'crown' };
  function lookSpec(save) {
    var L = save.look || {};
    return { seed: 'me-snow', name: L.name, eyes: L.eyes, brows: L.brows, mouth: L.mouth, head: L.head, skin: L.skin, extras: (L.extras || []).slice(),
      hat: ART_HAT[L.hat] || 'beanie', body: L.coat === 'pink' ? 'pinkcamo' : L.coat === 'gold' ? 'goldcamo' : 'camo' };
  }
  function lookColor(save, cat) { var e = lookEntry(cat, (save.look || {})[cat]); return e && e[4] ? e[4] : (lookEntry(cat, S.LOOK[cat][0][0]) || [])[4]; }
  function lookKey(save) { var L = save.look || {}; return [L.eyes, L.mouth, L.brows, L.head, L.skin, (L.extras || []).join('+'), L.hat, L.coat, L.glove, L.tool].join('|'); }

  JY.SnowMeta = { questNow: questNow, questProg: questProg, questCheck: questCheck, storyNext: storyNext, storyDone: storyDone, storyMet: storyMet, fill: fill, lookOptions: lookOptions, setLook: setLook, buyLook: buyLook, lookSpec: lookSpec, lookColor: lookColor, lookKey: lookKey, lookName: lookName,
    TIER: TIER, rollCall: rollCall, openBox: openBox, achList: achList, check: check, statOf: statOf, dateStr: dateStr };
})(window.JY = window.JY || {});
