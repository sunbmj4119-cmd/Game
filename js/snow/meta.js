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
    var r = G.rankOf(save);
    if (r > (save.rankDia || 0)) { var n = 3 * (r - (save.rankDia || 0)) + r; save.rankDia = r; G.gainDia(w, n, 'rank'); }
    return got;
  }

  JY.SnowMeta = { TIER: TIER, rollCall: rollCall, openBox: openBox, achList: achList, check: check, statOf: statOf, dateStr: dateStr };
})(window.JY = window.JY || {});
