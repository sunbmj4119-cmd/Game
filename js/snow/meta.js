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
    if (JY.SnowGear) { var gr = JY.SnowGear.boxGear(save, tier); out.gear = gr.item; out.parts = gr.parts; }   // v18: 상자마다 장구 하나 + 정비 부품
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
  // v24 등급 · 오늘의 특가 · 신상
  function tierOf(cat, id) { var e = lookEntry(cat, id); return !e || !e[2] ? '' : (S.LOOK_RAR[cat + ':' + id] || 'c'); }
  function dealOf(save, now) {
    var d = dateStr(now || Date.now()), pool = [], h = 0, i;
    Object.keys(S.LOOK).forEach(function (cat) { S.LOOK[cat].forEach(function (e) { if (e[2] >= 6 && !owns(save, cat, e)) pool.push(cat + ':' + e[0]); }); });
    if (!pool.length) return null;
    var key = d + ':' + (save.seed || 0); for (i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
  }
  function priceOf(save, cat, id, now) { var e = lookEntry(cat, id); if (!e || !e[2]) return 0; return dealOf(save, now) === cat + ':' + id ? Math.ceil(e[2] * (1 - S.STYLE.deal)) : e[2]; }
  function lookOptions(save, now) {
    var out = {}, deal = dealOf(save, now), seen = save.seen || {};
    Object.keys(S.LOOK).forEach(function (cat) {
      var cur = save.look[cat];
      out[cat] = S.LOOK[cat].map(function (e) {
        var own = owns(save, cat, e), on = cat === 'extras' ? (cur || []).indexOf(e[0]) >= 0 : cur === e[0], key = cat + ':' + e[0], price = priceOf(save, cat, e[0], now);
        return { cat: cat, id: e[0], name: e[1], dia: price, full: e[2] || 0, deal: deal === key, tier: tierOf(cat, e[0]), isNew: !own && S.LOOK_NEW.indexOf(key) >= 0 && !seen['lk24:' + cat],
          lockKey: e[3] || '', color: e[4] || (cat === 'skin' ? e[0] : ''), own: own, on: on, state: own ? 'own' : e[2] ? 'buy' : 'lock', ok: !own && e[2] && save.dia >= price };
      });
    });
    return out;
  }
  // 입어 보기 중이던 것 · 예전 저장의 잘못된 값: 가진 것으로 되돌린다
  function fixLook(save) {
    var L = save.look = save.look || {}, D = { eyes: 'derp', mouth: 'wavy', brows: 'worried', head: 'round', skin: '#f6c79c', hat: 'beanie', coat: 'olive', glove: 'olive', tool: 'yellow' };
    Object.keys(D).forEach(function (cat) { var e = lookEntry(cat, L[cat]); if (L[cat] !== undefined && (!e || !owns(save, cat, e))) L[cat] = D[cat]; });
    L.extras = (L.extras || []).filter(function (x) { var e = lookEntry('extras', x); return e && owns(save, 'extras', e); });
    return save;
  }
  function styleInfo(save) { var n = G.styleScore(save); return { pts: n, bonus: G.styleBonus(save), cap: S.STYLE.cap, capPts: Math.ceil(S.STYLE.cap / S.STYLE.per) }; }
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
  function buyLook(save, cat, id, now) {
    var e = lookEntry(cat, id), pr = priceOf(save, cat, id, now); if (!e || owns(save, cat, e) || !e[2] || save.dia < pr) return false;
    save.dia -= pr; save.unlocked[cat + ':' + id] = true; setLook(save, cat, id);
    return true;
  }
  var ART_HAT = { beanie: 'beanie', helmet: 'helmet', cap: 'cap', none: 'none', headband: 'headband', cateears: 'cateears', beret: 'beret', crown: 'crown',
    bobble: 'bobble', earmuff: 'earmuff', santa: 'santa', bear: 'bear', cone: 'cone', bantong: 'bantong', lamp: 'lamp', propeller: 'propeller', viking: 'viking', afro: 'afro', goldhelm: 'gold', fakestar: 'fakestar' };
  function lookSpec(save) {
    var L = save.look || {};
    return { seed: 'me-snow', name: L.name, eyes: L.eyes, brows: L.brows, mouth: L.mouth, head: L.head, skin: L.skin, extras: (L.extras || []).slice(),
      hat: ART_HAT[L.hat] || 'beanie', body: L.coat === 'pink' ? 'pinkcamo' : L.coat === 'gold' ? 'goldcamo' : 'camo' };
  }
  function lookColor(save, cat) { var e = lookEntry(cat, (save.look || {})[cat]); return e && e[4] ? e[4] : (lookEntry(cat, S.LOOK[cat][0][0]) || [])[4]; }
  function lookKey(save) { var L = save.look || {}; return [L.eyes, L.mouth, L.brows, L.head, L.skin, (L.extras || []).join('+'), L.hat, L.coat, L.glove, L.tool].join('|'); }

  /* ── v25 군생활 로드맵: 앞으로 무엇이 열리는지 (★ 순서) ── */
  function roadmap(save) {
    var m = save.merit || 0, items = [], rk = G.rankOf(save);
    function zoneAt(id) { var Z = G.zoneById(id); return Z ? Z.need : 0; }
    function rankAt(r) { return S.RANKS[r] ? S.RANKS[r].merit : 0; }
    S.ZONES.forEach(function (Z, i) { if (i) items.push({ at: Math.max(Z.need, rankAt(Z.rank || 0)), kind: 'zone', name: Z.name, line: '새 담당 구역 · ' + (Z.why || ''), done: !!(save.zones || {})[Z.id] }); });
    S.FEATURES.forEach(function (F) {
      if (!F.name) return; var c = F.when || {}, at = c.zone ? zoneAt(c.zone) : c.rank ? rankAt(c.rank) : 0;
      items.push({ at: at, kind: /^(cart|atv|tractor)$/.test(F.id) ? 'ride' : 'feat', name: F.name, line: F.line || '', done: G.feat(save, F.id) });
    });
    S.TOOLS.forEach(function (T0, i) { if (i) items.push({ at: rankAt(T0.rank || 0), kind: 'tool', name: T0.name, line: T0.desc, done: save.tool >= i, cost: T0.cost }); });
    S.CREW.forEach(function (C) { items.push({ at: rankAt(C.rank || 0), kind: 'crew', name: C.vehicle ? '제설차 운전병' : C.name, line: C.tag ? C.tag + ' · 같이 치운다' : '', done: ((save.crew || {})[C.id] || 0) > 0 }); });
    S.RANKS.forEach(function (R, i) { if (i) items.push({ at: R.merit, kind: 'rank', name: R.name + ' 진급', line: '진급 심사 (★★ 이상) · 월급이 오른다', done: rk >= i }); });
    items.push({ at: S.DISCHARGE_MERIT, kind: 'dis', name: '전역', line: '베레모 · 전역 메달 (초코파이 영구 +10%) → 재입대하면 더 빨리', done: !!save.discharges });
    items.forEach(function (it) { if (!it.done && m >= it.at && it.kind !== 'tool' && it.kind !== 'crew') it.ready = true; });
    items.sort(function (a, b) { return a.at - b.at || (a.kind === 'rank' ? -1 : b.kind === 'rank' ? 1 : 0); });
    var nxt = items.filter(function (it) { return !it.done && it.at > m; })[0], nextAt = nxt ? nxt.at : 0;
    items.forEach(function (it) { it.state = it.done ? 'done' : it.at <= m ? 'open' : it.at === nextAt ? 'next' : 'lock'; });
    var bands = S.RANKS.map(function (R, i) { return { i: i, name: R.name, from: R.merit, to: S.RANKS[i + 1] ? S.RANKS[i + 1].merit : S.DISCHARGE_MERIT, items: [] }; });
    items.forEach(function (it) { var b = bands.filter(function (B) { return it.at >= B.from && it.at < B.to; })[0] || bands[bands.length - 1]; if (it.kind === 'dis') return; b.items.push(it); });
    var tail = [
      { kind: 'dis', name: '전역 · 재입대', line: '★' + S.DISCHARGE_MERIT + ' · 전역 메달은 영원히 남는다 (메달마다 초코파이 +10%)', state: save.discharges ? 'done' : m >= S.DISCHARGE_MERIT ? 'open' : 'lock' },
      { kind: 'feat', name: '신화 장구', line: '같은 전설 장구 3개를 합성 · 장구는 전역해도 남는다', state: 'lock' },
      { kind: 'feat', name: '숙련 Lv30', line: '삽질·짐 나르기·체력·눈덩이 · 여러 번 전역해야 닿는다', state: 'lock' },
      { kind: 'look', name: '전설 꾸미기', line: '왕관 · 무지개 아프로 · 황금 철모 · 짝퉁 사단장 모자', state: 'lock' },
      { kind: 'feat', name: '발견 수첩 ' + (S.FUN || []).length + '칸', line: '아직 못 찾은 골때리는 일들', state: 'lock' }
    ];
    return { merit: m, rank: rk, bands: bands, tail: tail, next: nxt ? { at: nxt.at, left: nxt.at - m, names: items.filter(function (it) { return it.state === 'next'; }).map(function (it) { return it.name; }) } : null };
  }

  JY.SnowMeta = { roadmap: roadmap, questNow: questNow, questProg: questProg, questCheck: questCheck, storyNext: storyNext, storyDone: storyDone, storyMet: storyMet, fill: fill, lookOptions: lookOptions, setLook: setLook, buyLook: buyLook, tierOf: tierOf, dealOf: dealOf, priceOf: priceOf, fixLook: fixLook, styleInfo: styleInfo, lookEntry: lookEntry, owns: function (save, cat, id) { var e = lookEntry(cat, id); return !!e && owns(save, cat, e); }, lookSpec: lookSpec, lookColor: lookColor, lookKey: lookKey, lookName: lookName,
    TIER: TIER, rollCall: rollCall, openBox: openBox, achList: achList, check: check, statOf: statOf, dateStr: dateStr };
})(window.JY = window.JY || {});
