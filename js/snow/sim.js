/* 제설각 — 게임 규칙 (DOM 없음, Node에서도 돈다)
 * 퍼 담고 → 집하장까지 나르고 → 부으면 초코파이. 치운 곳은 그대로 남고, 눈은 계속 내린다. */
(function (JY) {
  'use strict';
  var S = JY.SNOW, CELL = S.CELL, GW = S.GW, GH = S.GH, HAZ = S.HAZ;

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── 저장 데이터 ── */
  function newSave() {
    return { v: 3, bank: 0, life: 0, day: 1, dayT: 0, tool: 0, crew: {}, perks: {}, proc: {}, relays: {}, zones: { A: true }, fresh: { A: true },
      medals: 0, discharges: 0, last: 0, best: 0, total: 0, crewRate: 0, seed: (Math.random() * 1e9) | 0, seen: {}, deerHits: 0,
      snow: null, px: S.SPAWN.x, py: S.SPAWN.y, load: 0, loadVal: 0, today: 0, made: { brick: 0, snowman: 0 } };
  }
  function migrate(s) {
    var d = newSave();
    if (!s || typeof s !== 'object') return d;
    if ((s.v || 1) < 3) { s.snow = null; s.dayT = 0; s.px = d.px; s.py = d.py; s.load = 0; s.loadVal = 0; s.fresh = {}; Object.keys(s.zones || {}).forEach(function (k) { s.fresh[k] = true; }); s.v = 3; }
    Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; });
    Object.keys(s.zones).forEach(function (k) { if (!S.ZONES.some(function (Z) { return Z.id === k; })) delete s.zones[k]; });
    s.zones.A = true;
    if (s.tool >= S.TOOLS.length) s.tool = S.TOOLS.length - 1;
    if (s.snow && s.snow.length !== Math.ceil(GW * GH / 3) * 4) s.snow = null;
    if (!s.snow) Object.keys(s.zones).forEach(function (k) { s.fresh[k] = true; });
    return s;
  }

  function lvl(save, id) { return save.perks[id] || 0; }
  function crewN(save, id) { return save.crew[id] || 0; }
  function procLvl(save, id) { return save.proc[id] || 0; }
  function rankOf(save) { var r = 0; S.RANKS.forEach(function (R, i) { if (save.life >= R.life) r = i; }); return r; }
  function nextRank(save) { return S.RANKS[rankOf(save) + 1] || null; }
  function crewCost(C, n) { return Math.round(C.cost * Math.pow(C.grow, n)); }
  function perkCost(P, l) { return Math.round(P.cost * Math.pow(P.grow, l)); }
  function procMult(save) { return S.PROC.reduce(function (a, P) { return a + P.add * procLvl(save, P.id); }, 1); }
  function incomeMult(save) { return (1 + 0.15 * lvl(save, 'praise')) * (1 + 0.1 * save.medals) * procMult(save); }
  function toolOf(save) { return S.TOOLS[save.tool]; }
  function capOf(save) { return Math.round(toolOf(save).cap * (1 + 0.3 * lvl(save, 'back'))); }
  function crewCount(save) { return S.CREW.reduce(function (a, C) { return a + crewN(save, C.id); }, 0); }
  function canDischarge(save) { return rankOf(save) >= 3 && save.life >= S.DISCHARGE_LIFE; }
  function medalGain(save) { return Math.floor(Math.sqrt(save.life / 50000)); }
  function zoneById(id) { for (var i = 0; i < S.ZONES.length; i++) if (S.ZONES[i].id === id) return S.ZONES[i]; return null; }
  function relayCost(Z) { return Math.round(Z.cost * 0.6); }

  function weatherFor(save) {
    var d = save.day;
    if (d === 1) return { id: 'light', inspect: false };
    if (d <= 3) return { id: 'normal', inspect: false };
    var r = mulberry(save.seed + d * 7919)();
    return { id: r < 0.2 ? 'light' : r < 0.62 ? 'normal' : r < 0.88 ? 'heavy' : 'blizzard', inspect: d % 7 === 0 };
  }

  /* ── 상점 ── */
  function offers(save) {
    var rank = rankOf(save), out = { tool: [], crew: [], perk: [], zone: [], factory: [] };
    S.TOOLS.forEach(function (T, i) {
      if (i < save.tool - 1 || i > save.tool + 2) return;
      var st = i <= save.tool ? 'own' : i === save.tool + 1 ? 'buy' : 'later';
      out.tool.push({ kind: 'tool', id: T.id, i: i, name: T.name, desc: T.desc, cost: T.cost, state: st, cur: i === save.tool,
        stat: '범위 ' + T.r + ' · 적재 ' + T.cap + (T.p > 1 ? ' · 힘 ×' + T.p : '') + (T.aura ? ' · 사방' : ''), ok: st === 'buy' && save.bank >= T.cost });
    });
    S.CREW.forEach(function (C) {
      var n = crewN(save, C.id), cost = crewCost(C, n), lock = rank < C.rank;
      out.crew.push({ kind: 'crew', id: C.id, name: C.name, tag: C.tag, desc: C.desc, cost: cost, n: n, max: C.max,
        state: lock ? 'lock' : n >= C.max ? 'max' : 'buy', lockText: S.RANKS[C.rank].name + '부터', ok: !lock && n < C.max && save.bank >= cost });
    });
    S.PERKS.forEach(function (P) {
      var l = lvl(save, P.id), cost = perkCost(P, l);
      out.perk.push({ kind: 'perk', id: P.id, name: P.name, desc: P.desc, cost: cost, n: l, max: P.max, state: l >= P.max ? 'max' : 'buy', ok: l < P.max && save.bank >= cost });
    });
    S.PROC.forEach(function (P) {
      var l = procLvl(save, P.id), cost = perkCost(P, l), need = P.need && procLvl(save, P.need[0]) < P.need[1];
      out.factory.push({ kind: 'proc', id: P.id, name: P.name, desc: P.desc, cost: cost, n: l, max: P.max,
        state: need ? 'lock' : l >= P.max ? 'max' : 'buy', lockText: need ? '압축기 Lv' + P.need[1] + '부터' : '', ok: !need && l < P.max && save.bank >= cost });
    });
    S.ZONES.forEach(function (Z) {
      if (!Z.relay || !save.zones[Z.id]) return;
      var has = !!save.relays[Z.id], cost = relayCost(Z);
      out.factory.push({ kind: 'relay', id: Z.id, name: '양동이 릴레이 · ' + Z.name, desc: '후임들이 줄 서서 집하장까지 나른다. 이 구역 옆에 붓는 곳이 생긴다', cost: cost, n: has ? 1 : 0, max: 1,
        state: has ? 'max' : 'buy', ok: !has && save.bank >= cost });
    });
    S.ZONES.forEach(function (Z, i) {
      if (save.zones[Z.id]) return;
      var prev = S.ZONES[i - 1], ready = !prev || save.zones[prev.id];
      out.zone.push({ kind: 'zone', id: Z.id, name: Z.name, desc: Z.reveal, value: Z.value, cost: Z.cost, state: ready ? 'buy' : 'lock',
        lockText: (prev ? prev.name : '') + ' 먼저', ok: ready && save.bank >= Z.cost });
    });
    return out;
  }

  function buy(save, kind, id) {
    var list = offers(save)[kind === 'proc' || kind === 'relay' ? 'factory' : kind] || [], o = null;
    list.forEach(function (x) { if (x.id === id && x.kind === kind) o = x; });
    if (!o || !o.ok) return { ok: false };
    save.bank -= o.cost;
    if (kind === 'tool') save.tool = o.i;
    else if (kind === 'crew') save.crew[id] = crewN(save, id) + 1;
    else if (kind === 'perk') save.perks[id] = lvl(save, id) + 1;
    else if (kind === 'proc') save.proc[id] = procLvl(save, id) + 1;
    else if (kind === 'relay') save.relays[id] = true;
    else if (kind === 'zone') { save.zones[id] = true; save.fresh[id] = true; save.seen['new' + id] = true; }
    return { ok: true, cost: o.cost, item: o };
  }

  function discharge(save) {
    if (!canDischarge(save)) return null;
    var gain = medalGain(save);
    var keep = { medals: save.medals + gain, discharges: save.discharges + 1, best: save.best, total: save.total, seed: (Math.random() * 1e9) | 0, seen: { tut: true }, deerHits: save.deerHits };
    var fresh = newSave();
    Object.keys(fresh).forEach(function (k) { save[k] = fresh[k]; });
    Object.keys(keep).forEach(function (k) { save[k] = keep[k]; });
    save.last = Date.now();
    return { medals: gain, total: save.medals };
  }

  /* ── 충돌 ── */
  function blockedRect(x, y, r, b) { return x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r; }
  function blocked(x, y, r) {
    if (x < r || y < r || x > S.W - r || y > S.H - r) return true;
    var i;
    for (i = 0; i < S.BUILDINGS.length; i++) if (blockedRect(x, y, r, S.BUILDINGS[i])) return true;
    for (i = 0; i < S.TANKS.length; i++) if (blockedRect(x, y, r, S.TANKS[i])) return true;
    for (i = 0; i < S.TREES.length; i++) {
      var t = S.TREES[i], dx = x - t[0], dy = y - t[1];
      if (dx * dx + dy * dy < (r + 7) * (r + 7)) return true;
    }
    return false;
  }
  function moveEnt(e, dx, dy, r) {
    var moved = 0;
    if (!blocked(e.x + dx, e.y, r)) { e.x += dx; moved += Math.abs(dx); }
    if (!blocked(e.x, e.y + dy, r)) { e.y += dy; moved += Math.abs(dy); }
    return moved;
  }
  function inHole(Z, x, y) {
    if (!Z.holes) return false;
    for (var i = 0; i < Z.holes.length; i++) { var h = Z.holes[i]; if (x >= h[0] && x < h[0] + h[2] && y >= h[1] && y < h[1] + h[3]) return true; }
    return false;
  }

  /* ── 눈 저장 (base64) ── */
  function enc(u8) {
    if (typeof btoa === 'function') { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
    return Buffer.from(u8).toString('base64');
  }
  function dec(str, n) {
    var out = new Uint8Array(n), i;
    if (typeof atob === 'function') { var s = atob(str); for (i = 0; i < n && i < s.length; i++) out[i] = s.charCodeAt(i); }
    else { var b = Buffer.from(str, 'base64'); for (i = 0; i < n && i < b.length; i++) out[i] = b[i]; }
    return out;
  }

  // 오래 쌓인 눈: 칸마다 제각각이 아니라 바람에 쌓인 언덕처럼 (값 노이즈)
  function lattice(seed, x, y) { var h = (x * 374761393 + y * 668265263 + seed * 2246822519) ^ 0x5bf03635; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function drift(seed, gx, gy) {
    var v = 0, amp = 0.65, f = 1 / 7, tot = 0;
    for (var o = 0; o < 2; o++) {
      var x = gx * f, y = gy * f, x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = lattice(seed + o, x0, y0), b = lattice(seed + o, x0 + 1, y0), c = lattice(seed + o, x0, y0 + 1), d = lattice(seed + o, x0 + 1, y0 + 1);
      v += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty); tot += amp; amp *= 0.5; f *= 2.3;
    }
    return Math.min(0.999, Math.max(0, v / tot));
  }

  /* ── 하루 일정 (방해꾼) ── */
  function schedule(w, save, from) {
    var R = w.rand, dl = S.DAY_LEN, ev = [], day = save.day, i;
    function at(t, k) { if (t >= from) ev.push({ t: t, k: k }); }
    if (day >= HAZ.deer.from) {
      var n = Math.round(Math.min(4, 1 + (day - 1) / 4) * (1 - 0.25 * lvl(save, 'gong')));
      for (i = 0; i < n; i++) at(10 + R() * (dl - 20), 'deer');
    }
    if (day >= HAZ.snowball.from && R() < HAZ.snowball.p) at(15 + R() * (dl - 30), 'snowball');
    if (save.zones[HAZ.car.zone]) { var trips = HAZ.car.trips[0] + (R() < 0.5 ? 1 : 0); for (i = 0; i < trips; i++) at(10 + R() * (dl - 30), 'car'); }
    if (day >= 2) for (var t = 20 + R() * 20; t < dl - 5; t += HAZ.roof.every * (0.7 + R() * 0.6)) at(t, 'roof');
    if (save.zones[HAZ.heli.zone] && R() < HAZ.heli.p) at(20 + R() * (dl - 40), 'heli');
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  function dumpsOf(save) {
    var list = [{ x: S.DUMP.x, y: S.DUMP.y, r: S.DUMP.r, main: true, zone: 'A' }];
    S.ZONES.forEach(function (Z) { if (Z.relay && save.zones[Z.id] && save.relays[Z.id]) list.push({ x: Z.relay[0], y: Z.relay[1], r: 20, main: false, zone: Z.id }); });
    return list;
  }

  function createWorld(save, opts) {
    opts = opts || {};
    var wxi = weatherFor(save), wx = S.WEATHER[wxi.id];
    var w = {
      save: save, rand: mulberry(save.seed + save.day * 101 + (opts.salt || 0) + Math.floor(save.dayT)),
      depth: new Uint8Array(GW * GH), zone: new Int8Array(GW * GH).fill(-1), partOf: new Int16Array(GW * GH).fill(-1),
      cells: [], zoneOpen: [], zoneTotal: [], zoneClear: [], parts: [], total: 0, clear: 0, inspected: {},
      time: save.dayT || 0, dayLen: S.DAY_LEN, weather: wxi.id, wx: wx, inspect: wxi.inspect, mult: incomeMult(save),
      earned: 0, crewEarned: 0, crewT: 0, units: 0, hits: 0, fx: [], dirty: [], fallAcc: 0, done: false, flags: {}, demo: !!opts.demo,
      player: null, crew: [], haeng: null, sayT: 0, rank0: rankOf(save), dumps: dumpsOf(save),
      events: [], deer: [], car: null, heli: null, cats: []
    };
    var R = w.rand, stored = save.snow && !opts.fresh ? dec(save.snow, GW * GH) : null;
    S.ZONES.forEach(function (Z, zi) {
      var open = !!save.zones[Z.id], isNew = !!save.fresh[Z.id] || !stored;
      w.zoneOpen[zi] = open; w.zoneTotal[zi] = 0; w.zoneClear[zi] = 0;
      var pBase = w.parts.length;
      if (open) Z.parts.forEach(function (p) { w.parts.push({ zi: zi, name: p[0], x: Z.x + p[1] * Z.w, y: Z.y + p[2] * Z.h, w: (p[3] - p[1]) * Z.w, h: (p[4] - p[2]) * Z.h, total: 0, clear: 0, done: false }); });
      for (var gy = Z.y / CELL; gy < (Z.y + Z.h) / CELL; gy++) {
        for (var gx = Z.x / CELL; gx < (Z.x + Z.w) / CELL; gx++) {
          var cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
          if (inHole(Z, cx, cy)) continue;
          var idx = gy * GW + gx;
          w.zone[idx] = zi;
          if (!open) { w.depth[idx] = 3; continue; }
          var lo = Z.id === 'A' && !save.discharges && save.day <= 1 ? 1 : 2, hi = Z.id === 'A' && !save.discharges && save.day <= 1 ? 3 : 4;
          w.depth[idx] = isNew ? Math.min(hi, lo + Math.floor(drift(save.seed + zi * 13, gx, gy) * (hi - lo + 1))) : stored[idx];
          w.cells.push(idx); w.zoneTotal[zi]++;
          if (!w.depth[idx]) { w.clear++; w.zoneClear[zi]++; }
          for (var k = pBase; k < w.parts.length; k++) {
            var P = w.parts[k];
            if (cx >= P.x && cx < P.x + P.w && cy >= P.y && cy < P.y + P.h) { w.partOf[idx] = k; P.total++; if (!w.depth[idx]) P.clear++; break; }
          }
        }
      }
      if (!opts.demo) delete save.fresh[Z.id];
    });
    w.parts.forEach(function (P) { P.done = P.total > 0 && P.clear / P.total >= S.PART_DONE; });
    w.total = w.cells.length;
    var tool = toolOf(save), px = save.px, py = save.py;
    if (opts.demo || blocked(px, py, 6)) { px = S.SPAWN.x; py = S.SPAWN.y; }
    w.player = { x: px, y: py, dir: { x: 0, y: 1 }, hitT: 0, walk: 0, moving: false, idleT: 0, swing: 0, stun: 0, r: tool.r, p: tool.p, aura: !!tool.aura,
      cap: capOf(save), load: opts.demo ? 0 : Math.min(save.load, capOf(save)), val: opts.demo ? 0 : save.loadVal, fullSaid: false };
    var song = lvl(save, 'song'), gear = lvl(save, 'gear'), back = lvl(save, 'back');
    S.CREW.forEach(function (C) {
      for (var i = 0; i < crewN(save, C.id); i++) {
        w.crew.push({ def: C, n: i, x: S.DUMP.x + 40 + (R() - 0.5) * 200, y: S.DUMP.y - 20 - R() * 40, dir: { x: 0, y: 1 }, tidx: -1, tx: 0, ty: 0,
          hitT: R() * C.hit, retarget: 0, stuck: 0, walk: R() * 10, asleep: false, sleepT: 2 + R() * 4, swing: 0, moving: false, injured: 0,
          speed: C.speed * (1 + 0.12 * song), hit: C.hit / (1 + 0.06 * song), r: C.r * (1 + 0.15 * gear), p: C.p, seed: (R() * 1e6) | 0,
          cap: Math.round(C.cap * (1 + 0.2 * back)), load: 0, val: 0, state: 'work', home: null });
        var e = w.crew[w.crew.length - 1]; if (blocked(e.x, e.y, 6)) { e.x = S.DUMP.x + 30; e.y = S.DUMP.y; }
      }
    });
    w.haeng = { x: 330, y: 290, dir: { x: 0, y: 1 }, tx: 330, ty: 290, wait: 2, walk: 0, moving: false, shoutT: 0 };
    if (save.zones[HAZ.cats.zone]) {
      var D = zoneById(HAZ.cats.zone);
      for (var c = 0; c < HAZ.cats.n; c++) w.cats.push({ x: D.x + 30 + R() * (D.w - 60), y: D.y + D.h - 20 - R() * 60, dir: { x: 1, y: 0 }, tx: 0, ty: 0, wait: R() * 3, walk: 0, moving: false });
    }
    w.events = schedule(w, save, w.time);
    return w;
  }

  // 지금 세계를 저장 데이터에 적는다 (눈, 내 위치, 짊어진 눈, 하루 시각)
  function serialize(w) {
    if (w.demo) return;
    var s = w.save;
    s.snow = enc(w.depth); s.px = Math.round(w.player.x); s.py = Math.round(w.player.y);
    s.load = w.player.load; s.loadVal = w.player.val; s.dayT = w.time;
    if (w.crewT > 20) s.crewRate = w.crewEarned / w.crewT;
    s.last = Date.now();
  }

  function cellIndex(x, y) {
    var gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return -1;
    return gy * GW + gx;
  }

  function setDepth(w, idx, d) {
    var old = w.depth[idx];
    if (old === d) return;
    w.depth[idx] = d; w.dirty.push(idx);
    var p = w.partOf[idx];
    if (!old && d) { w.clear--; w.zoneClear[w.zone[idx]]--; if (p >= 0) { var P = w.parts[p]; P.clear--; if (P.done && P.clear / P.total < S.PART_RESET) P.done = false; } }
    else if (old && !d) { w.clear++; w.zoneClear[w.zone[idx]]++; if (p >= 0) partClear(w, p); inspectZone(w, w.zone[idx]); }
  }
  function pay(w, amount, src) {
    if (w.demo || amount <= 0) return;
    w.save.bank += amount; w.save.life += amount; w.save.today += amount;
    if (src === 'crew') w.crewEarned += amount;
  }
  function partClear(w, p) {
    var P = w.parts[p];
    P.clear++;
    if (!P.done && P.total && P.clear / P.total >= S.PART_DONE) {
      P.done = true;
      var bonus = Math.round(P.total * S.ZONES[P.zi].value * 0.25 * w.mult);
      w.earned += bonus; pay(w, bonus, 'part');
      w.fx.push({ t: 'part', name: P.name, x: P.x + P.w / 2, y: P.y + P.h / 2, bonus: bonus, p: p });
    }
  }
  function inspectZone(w, zi) {
    if (w.inspected[zi] || !w.zoneTotal[zi] || w.zoneClear[zi] / w.zoneTotal[zi] < S.INSPECT) return;
    w.inspected[zi] = true;
    var Z = S.ZONES[zi], bonus = Math.round(w.zoneTotal[zi] * Z.value * 0.6 * w.mult * (w.inspect ? 2 : 1));
    w.earned += bonus; pay(w, bonus, 'inspect');
    w.fx.push({ t: 'inspect', zone: Z.id, name: Z.name, x: Z.x + Z.w / 2, y: Z.y + Z.h / 2, bonus: bonus });
    say(w, 'inspect', true);
  }

  // who: 눈을 담는 사람(load/cap/val). 없으면(헬기) 바로 돈
  function clearAt(w, cx, cy, r, p, src, who) {
    var room = who ? who.cap - who.load : 1e9;
    if (room <= 0) return 0;
    var x0 = Math.max(0, Math.floor((cx - r) / CELL)), x1 = Math.min(GW - 1, Math.floor((cx + r) / CELL));
    var y0 = Math.max(0, Math.floor((cy - r) / CELL)), y1 = Math.min(GH - 1, Math.floor((cy + r) / CELL));
    var rr = (r + 3) * (r + 3), removed = 0, val = 0;
    for (var gy = y0; gy <= y1 && room > 0; gy++) {
      for (var gx = x0; gx <= x1 && room > 0; gx++) {
        var ccx = gx * CELL + CELL / 2 - cx, ccy = gy * CELL + CELL / 2 - cy;
        if (ccx * ccx + ccy * ccy > rr) continue;
        var idx = gy * GW + gx, zi = w.zone[idx];
        if (zi < 0 || !w.zoneOpen[zi]) continue;
        var d = w.depth[idx];
        if (!d) continue;
        var take = Math.min(d, p, room);
        removed += take; val += take * S.ZONES[zi].value; room -= take;
        setDepth(w, idx, d - take);
      }
    }
    if (removed) {
      w.units += removed;
      if (who) { who.load += removed; who.val += val; }
      else { var g = val * w.mult * 0.5; w.earned += g; pay(w, g, src); }
      w.fx.push({ t: 'clear', x: cx, y: cy, n: removed, src: src });
    }
    return removed;
  }

  // 집하장에 붓기
  function deposit(w, who, src, dump) {
    if (!who.load) return 0;
    var amount = who.val * w.mult;
    w.earned += amount; pay(w, amount, src);
    var mk = w.save.made;
    if (!w.demo && procLvl(w.save, 'press')) mk.brick += who.load / 40;
    if (!w.demo && procLvl(w.save, 'sculpt')) mk.snowman += who.load / 400;
    w.fx.push({ t: 'dump', x: dump.x, y: dump.y, units: who.load, pay: amount, src: src, main: dump.main, fromX: who.x, fromY: who.y });
    who.load = 0; who.val = 0;
    return amount;
  }
  function nearestDump(w, x, y) {
    var best = null, bd = 1e9;
    w.dumps.forEach(function (d) { var k = Math.hypot(d.x - x, d.y - y); if (k < bd) { bd = k; best = d; } });
    return best;
  }

  // 눈을 다시 쌓는다 (고라니 발길질, 차 진흙눈, 지붕 눈, 쏟은 눈)
  function dumpAt(w, cx, cy, r, add, prob, max) {
    var x0 = Math.max(0, Math.floor((cx - r) / CELL)), x1 = Math.min(GW - 1, Math.floor((cx + r) / CELL));
    var y0 = Math.max(0, Math.floor((cy - r) / CELL)), y1 = Math.min(GH - 1, Math.floor((cy + r) / CELL));
    var n = 0;
    for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
      var idx = gy * GW + gx, zi = w.zone[idx];
      if (zi < 0 || !w.zoneOpen[zi] || w.depth[idx] >= max || w.rand() > prob) continue;
      var before = w.depth[idx], after = Math.min(max, before + add);
      setDepth(w, idx, after); n += after - before;
    }
    return n;
  }
  // 짊어진 눈을 쏟는다
  function spill(w, who) {
    if (!who.load) return 0;
    var left = who.load, r = 8;
    while (left > 0 && r < 60) { left -= dumpAt(w, who.x, who.y, r, 1, 0.7, 3); r += 6; }
    var lost = who.load; who.load = 0; who.val = 0;
    return lost;
  }

  function say(w, key, force) {
    if (w.sayT > 0 && !force) return;
    w.fx.push({ t: 'say', key: key });
    w.sayT = 6;
  }

  function randomOpenPoint(w) {
    var idx = w.cells[(w.rand() * w.cells.length) | 0];
    return { x: (idx % GW) * CELL + 5, y: ((idx / GW) | 0) * CELL + 5 };
  }

  function pickTarget(w, e) {
    var R = w.rand, best = -1, bs = 1e9, n = w.cells.length;
    if (!n) return;
    var home = e.home;
    for (var k = 0; k < 16; k++) {
      var idx = w.cells[(R() * n) | 0], d = w.depth[idx];
      if (!d) continue;
      var x = (idx % GW) * CELL + 5, y = ((idx / GW) | 0) * CELL + 5;
      var dump = nearestDump(w, x, y), s = Math.hypot(x - e.x, y - e.y) * 0.7 + (dump ? Math.hypot(dump.x - x, dump.y - y) * 0.5 : 0) - d * 18;
      if (s < bs) { bs = s; best = idx; }
    }
    if (best < 0) { e.tidx = -1; e.tx = w.player.x + (R() - 0.5) * 120; e.ty = w.player.y + (R() - 0.5) * 120; e.retarget = 2; return; }
    e.tidx = best; e.tx = (best % GW) * CELL + 5; e.ty = ((best / GW) | 0) * CELL + 5; e.retarget = 6;
  }

  function steer(e, tx, ty, speed, dt, r) {
    var dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d < 2) { e.moving = false; return 0; }
    var ux = dx / d, uy = dy / d, step = Math.min(d, speed * dt);
    e.dir.x += (ux - e.dir.x) * Math.min(1, dt * 10); e.dir.y += (uy - e.dir.y) * Math.min(1, dt * 10);
    var m = Math.hypot(e.dir.x, e.dir.y) || 1; e.dir.x /= m; e.dir.y /= m;
    var moved = moveEnt(e, ux * step, uy * step, r);
    e.moving = moved > 0.01; e.walk += moved * 0.18;
    return moved;
  }

  /* ── 방해꾼 ── */
  function spawn(w, k) {
    var R = w.rand, save = w.save, medic = lvl(save, 'medic');
    if (k === 'deer') {
      var left = R() < 0.5, y = 150 + R() * (S.H - 300), tgt = randomOpenPoint(w);
      w.deer.push({ x: left ? 8 : S.W - 8, y: y, dir: { x: left ? 1 : -1, y: 0 }, heading: Math.atan2(tgt.y - y, tgt.x - (left ? 8 : S.W - 8)),
        turnT: 0.6, life: HAZ.deer.life[0] + R() * (HAZ.deer.life[1] - HAZ.deer.life[0]), t: 0, walk: 0, moving: true, kickT: 0, hitT: 0, leaving: false });
      say(w, 'deer', true);
      w.fx.push({ t: 'deer', e: w.deer[w.deer.length - 1] });
    } else if (k === 'snowball') {
      w.player.stun = Math.max(w.player.stun, HAZ.snowball.stun);
      w.fx.push({ t: 'snowball' }); say(w, 'snowball', true);
    } else if (k === 'car') {
      if (w.car) return;
      var E = zoneById(HAZ.car.zone);
      w.car = { x: E.x + E.w / 2, y: S.H - 4, dir: { x: 0, y: -1 }, leg: 0, top: E.y - 10, walk: 0, moving: true, seen: {} };
      say(w, 'car', true); w.fx.push({ t: 'car' });
    } else if (k === 'roof') {
      var cand = S.BUILDINGS.filter(function (b) {
        var fy = b.y + b.h + 22;
        return b.id !== 'stand' && S.ZONES.some(function (Z, zi) { return w.zoneOpen[zi] && fy >= Z.y && fy < Z.y + Z.h && b.x < Z.x + Z.w && b.x + b.w > Z.x; });
      });
      if (!cand.length) return;
      var b = cand[(R() * cand.length) | 0], segW = 60 + R() * 70, sx = b.x + R() * Math.max(1, b.w - segW), sy = b.y + b.h + 18;
      for (var x = sx; x < sx + segW; x += CELL) for (var yy = sy; yy < sy + 30; yy += CELL) dumpAt(w, x, yy, 5, 3, 1, 3);
      var hit = function (e) { return e.x > sx - 6 && e.x < sx + segW + 6 && e.y > b.y + b.h && e.y < sy + 34; };
      if (hit(w.player)) w.player.stun = Math.max(w.player.stun, HAZ.roof.stun * (1 - 0.1 * medic));
      w.crew.forEach(function (c) { if (hit(c)) { c.injured = Math.max(c.injured, HAZ.roof.injure * (1 - 0.15 * medic)); w.hits++; } });
      w.fx.push({ t: 'roof', x: sx, y: b.y + b.h, w: segW, b: b.id }); say(w, 'roof', true);
    } else if (k === 'heli') {
      var Hz = zoneById(HAZ.heli.zone);
      w.heli = { x: Hz.x + Hz.w / 2, y: Hz.y + Hz.h / 2, t: 0, life: HAZ.heli.life, tick: 0 };
      say(w, 'heli', true); w.fx.push({ t: 'heli' });
    }
  }

  function stepHazards(w, dt) {
    var R = w.rand, save = w.save, P = w.player, medic = lvl(save, 'medic'), i;
    while (w.events.length && w.events[0].t <= w.time) spawn(w, w.events.shift().k);
    for (i = w.deer.length - 1; i >= 0; i--) {
      var d = w.deer[i];
      d.t += dt; d.turnT -= dt; d.hitT -= dt; d.kickT -= dt;
      if (d.t > d.life && !d.leaving) { d.leaving = true; d.heading = d.x < S.W / 2 ? Math.PI : 0; }
      if (d.turnT <= 0 && !d.leaving) {
        d.turnT = 0.5 + R() * 0.6;
        var pd = Math.hypot(P.x - d.x, P.y - d.y);
        if (pd < 50 && R() < 0.6) d.heading = Math.atan2(d.y - P.y, d.x - P.x) + (R() - 0.5) * 0.6;
        else if (R() < 0.45) { var tg = randomOpenPoint(w); d.heading = Math.atan2(tg.y - d.y, tg.x - d.x); }
        else d.heading += (R() - 0.5) * 2.2;
      }
      var sp = HAZ.deer.speed * (d.leaving ? 1.3 : 1), vx = Math.cos(d.heading) * sp * dt, vy = Math.sin(d.heading) * sp * dt;
      if (d.leaving) { d.x += vx; d.y += vy; }
      else if (moveEnt(d, vx, vy, 5) < Math.abs(vx) * 0.3 + Math.abs(vy) * 0.3) d.heading += Math.PI * (0.6 + R() * 0.8);
      d.dir.x = Math.cos(d.heading); d.dir.y = Math.sin(d.heading); d.walk += sp * dt * 0.25;
      if (d.x < -20 || d.x > S.W + 20 || d.y < -20 || d.y > S.H + 20 || d.t > d.life + 12) { w.deer.splice(i, 1); continue; }
      if (d.kickT <= 0) { d.kickT = 0.12; dumpAt(w, d.x, d.y, 6, 1, HAZ.deer.kick, 2); }
      if (d.hitT > 0) continue;
      var hr = HAZ.deer.hitR + 5;
      for (var j = 0; j < w.crew.length; j++) {
        var c = w.crew[j];
        if (c.injured > 0 || c.def.vehicle) continue;
        if (Math.abs(c.x - d.x) < hr && Math.abs(c.y - d.y) < hr) {
          c.injured = HAZ.deer.injure * (1 - 0.15 * medic); c.asleep = false; d.hitT = 0.8; d.heading += Math.PI * 0.8; w.hits++;
          spill(w, c); c.state = 'work';
          w.fx.push({ t: 'deerHit', e: c, x: c.x, y: c.y }); say(w, 'deerHit', true); break;
        }
      }
      if (d.hitT <= 0 && P.stun <= 0 && Math.abs(P.x - d.x) < hr && Math.abs(P.y - d.y) < hr) {
        P.stun = HAZ.deer.stun * (1 - 0.1 * medic); d.hitT = 1; d.heading += Math.PI * 0.8; w.hits++;
        var lost = spill(w, P);
        w.fx.push({ t: 'meHit', x: P.x, y: P.y, spilled: lost }); say(w, lost ? 'spill' : 'meHit', true);
      }
    }
    var car = w.car;
    if (car) {
      var cs = HAZ.car.speed * dt;
      if (car.leg === 0) { car.y -= cs; car.dir.y = -1; if (car.y <= car.top) { car.leg = 1; car.seen = {}; } }
      else { car.y += cs; car.dir.y = 1; if (car.y > S.H + 30) w.car = null; }
      car.walk += cs * 0.2;
      var ci = cellIndex(car.x, car.y);
      if (ci >= 0 && !car.seen[ci]) { car.seen[ci] = 1; dumpAt(w, car.x, car.y, HAZ.car.r, 1, HAZ.car.slush, 3); }
      w.crew.forEach(function (c) { if (Math.abs(c.x - car.x) < 18 && Math.abs(c.y - car.y) < 22) { c.x += c.x < car.x ? -26 : 26; c.retarget = 0; } });
      if (P.stun <= 0 && Math.abs(P.x - car.x) < 16 && Math.abs(P.y - car.y) < 20) { P.stun = 0.8; P.x += P.x < car.x ? -24 : 24; w.fx.push({ t: 'carHit', x: P.x, y: P.y }); }
    }
    var hl = w.heli;
    if (hl) {
      hl.t += dt; hl.tick -= dt;
      if (hl.t > 1.5 && hl.t < hl.life - 1.2 && hl.tick <= 0) { hl.tick = 0.15; clearAt(w, hl.x + (R() - 0.5) * 30, hl.y + (R() - 0.5) * 30, HAZ.heli.r, 2, 'heli', null); }
      if (hl.t > hl.life) w.heli = null;
    }
    w.cats.forEach(function (c) {
      c.wait -= dt;
      var pd = Math.hypot(P.x - c.x, P.y - c.y);
      if (pd < 34) { c.tx = c.x + (c.x - P.x) * 2; c.ty = c.y + (c.y - P.y) * 2; c.wait = 3; }
      else if (c.wait <= 0) { var D = zoneById(HAZ.cats.zone); c.tx = D.x + 20 + R() * (D.w - 40); c.ty = D.y + 20 + R() * (D.h - 40); c.wait = 4 + R() * 6; }
      if (Math.hypot(c.tx - c.x, c.ty - c.y) > 3) steer(c, c.tx, c.ty, pd < 34 ? 90 : 22, dt, 4); else c.moving = false;
    });
  }

  function newDay(w) {
    var save = w.save, R = w.rand, earned = save.today;
    save.day++; save.today = 0; w.time = 0;
    var wxi = weatherFor(save); w.weather = wxi.id; w.wx = S.WEATHER[wxi.id]; w.inspect = wxi.inspect; w.inspected = {};
    w.events = schedule(w, save, 0);
    var n = 0;
    if (w.wx.dump) w.cells.forEach(function (idx) { if (R() < w.wx.dump && w.depth[idx] < 3) { setDepth(w, idx, w.depth[idx] + 1); n++; } });
    w.fx.push({ t: 'day', day: save.day, weather: w.weather, earned: earned, dumped: n, inspect: w.inspect });
  }

  function step(w, dt, input) {
    var save = w.save, R = w.rand, P = w.player;
    w.time += dt; w.sayT -= dt;
    if (w.time >= w.dayLen) newDay(w);
    stepHazards(w, dt);
    // 나
    var ix = input ? input.x : 0, iy = input ? input.y : 0, mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; mag = 1; }
    if (P.stun > 0) { P.stun -= dt; mag = 0; }
    var tool = toolOf(save), speed = S.SPEED * (1 + 0.12 * lvl(save, 'eisen')) * (tool.vehicle ? 1.15 : 1);
    if (mag > 0.08) {
      var moved = moveEnt(P, ix * speed * dt, iy * speed * dt, 6);
      P.dir.x += (ix / mag - P.dir.x) * Math.min(1, dt * 14); P.dir.y += (iy / mag - P.dir.y) * Math.min(1, dt * 14);
      var m = Math.hypot(P.dir.x, P.dir.y) || 1; P.dir.x /= m; P.dir.y /= m;
      P.moving = moved > 0.01; P.walk += moved * 0.18; P.idleT = 0;
    } else { P.moving = false; if (P.stun <= 0) P.idleT += dt; }
    P.swing = Math.max(0, P.swing - dt * 6);
    P.hitT -= dt;
    if (P.hitT <= 0) {
      P.hitT += S.HIT / (1 + 0.1 * lvl(save, 'matsta'));
      if (P.hitT < 0) P.hitT = 0;
      if (P.stun <= 0 && P.load < P.cap) {
        var cx = P.aura ? P.x : P.x + P.dir.x * P.r * 0.6, cy = P.aura ? P.y : P.y + P.dir.y * P.r * 0.6 + 2;
        if (clearAt(w, cx, cy, P.r, P.p, 'player', P)) P.swing = 1;
      }
    }
    if (P.load >= P.cap) { if (!P.fullSaid) { P.fullSaid = true; w.fx.push({ t: 'full' }); say(w, 'full', true); } } else P.fullSaid = false;
    var dp = nearestDump(w, P.x, P.y);
    if (P.load > 0 && dp && Math.hypot(dp.x - P.x, dp.y - P.y) < dp.r) deposit(w, P, 'player', dp);
    if (P.idleT > 6 && !w.flags.idleSaid) { say(w, 'idle'); w.flags.idleSaid = true; }
    if (P.idleT === 0) w.flags.idleSaid = false;

    // 인력: 담고 → 꽉 차면 가까운 집하장(릴레이)으로 → 붓고 → 다시
    if (w.crew.length) w.crewT += dt;
    for (var i = 0; i < w.crew.length; i++) {
      var e = w.crew[i], C = e.def;
      e.swing = Math.max(0, e.swing - dt * 5);
      if (e.injured > 0) { e.injured -= dt; e.moving = false; if (e.injured <= 0) w.fx.push({ t: 'up', e: e }); continue; }
      if (C.sleep) {
        e.sleepT -= dt;
        if (e.sleepT <= 0) { e.asleep = R() < C.sleep; e.sleepT = 3 + R() * 4; if (e.asleep) w.fx.push({ t: 'zzz', e: e }); }
        if (e.asleep) { e.moving = false; continue; }
      }
      if (e.state === 'haul') {
        var dd = nearestDump(w, e.x, e.y);
        if (Math.hypot(dd.x - e.x, dd.y - e.y) < dd.r * 0.8) { deposit(w, e, 'crew', dd); e.state = 'work'; e.tidx = -1; continue; }
        var mv0 = steer(e, dd.x, dd.y, e.speed, dt, 6);
        if (mv0 < e.speed * dt * 0.25) { e.stuck += dt; if (e.stuck > 1.2) { e.stuck = 0; e.x += (R() - 0.5) * 16; e.y += (R() - 0.5) * 16; if (blocked(e.x, e.y, 6)) { e.x = dd.x; e.y = dd.y; } } } else e.stuck = 0;
        continue;
      }
      e.retarget -= dt;
      if (e.tidx < 0 || e.retarget <= 0 || !w.depth[e.tidx]) pickTarget(w, e);
      if (e.tidx < 0 && e.load > 0) { e.state = 'haul'; continue; }
      var dist = Math.hypot(e.tx - e.x, e.ty - e.y), near = e.r * 0.5;
      if (dist > near) {
        var mv = steer(e, e.tx, e.ty, e.speed, dt, 6);
        if (mv < e.speed * dt * 0.25) { e.stuck += dt; if (e.stuck > 0.8) { e.stuck = 0; e.tidx = -1; e.retarget = 0; } } else e.stuck = 0;
      } else e.moving = false;
      e.hitT -= dt;
      if (e.hitT <= 0) {
        e.hitT += e.hit; if (e.hitT < 0) e.hitT = 0;
        if (clearAt(w, e.x + e.dir.x * e.r * 0.6, e.y + e.dir.y * e.r * 0.6 + 2, e.r, e.p, 'crew', e)) e.swing = 1;
        if (e.load >= e.cap) e.state = 'haul';
      }
      if (R() < dt * 0.02) w.fx.push({ t: 'chat', e: e });
    }

    // 행보관: 돌아다니며 감시, 조는 병장 깨우기
    var Hh = w.haeng;
    Hh.wait -= dt; Hh.shoutT -= dt;
    if (Hh.wait <= 0 && w.cells.length) { var pt = randomOpenPoint(w); Hh.tx = pt.x; Hh.ty = pt.y; Hh.wait = 5 + R() * 4; }
    if (Math.hypot(Hh.tx - Hh.x, Hh.ty - Hh.y) > 4) { if (steer(Hh, Hh.tx, Hh.ty, 40, dt, 6) < 0.01) Hh.wait = 0; } else Hh.moving = false;
    if (Hh.shoutT <= 0) {
      for (var j = 0; j < w.crew.length; j++) {
        var c = w.crew[j];
        if (c.asleep && Math.hypot(c.x - Hh.x, c.y - Hh.y) < 70) { c.asleep = false; c.sleepT = 6; Hh.shoutT = 12; say(w, 'sleep'); w.fx.push({ t: 'wake', e: c }); break; }
      }
    }

    // 눈은 계속 내린다
    w.fallAcc += w.cells.length * S.FALL * w.wx.fall * dt;
    while (w.fallAcc >= 1) {
      w.fallAcc -= 1;
      var k = w.cells[(R() * w.cells.length) | 0], d0 = w.depth[k];
      if (d0 < 3) setDepth(w, k, d0 + 1);
    }
  }

  function pct(w) { return w.total ? w.clear / w.total : 0; }

  // 앱을 꺼 둔 동안: 인력 수입 × 시간 × 10% (최대 8시간)
  function offline(save, now) {
    if (!save.last || !save.crewRate) return 0;
    var sec = Math.min((now - save.last) / 1000, 8 * 3600);
    if (sec < 300) return 0;
    return Math.floor(save.crewRate * sec * 0.1);
  }

  JY.SnowSim = {
    mulberry: mulberry, newSave: newSave, migrate: migrate, lvl: lvl, crewN: crewN, procLvl: procLvl, rankOf: rankOf, nextRank: nextRank,
    crewCost: crewCost, perkCost: perkCost, incomeMult: incomeMult, procMult: procMult, toolOf: toolOf, capOf: capOf, crewCount: crewCount,
    canDischarge: canDischarge, medalGain: medalGain, discharge: discharge, weatherFor: weatherFor, offers: offers, buy: buy, relayCost: relayCost,
    blocked: blocked, createWorld: createWorld, serialize: serialize, step: step, pct: pct, offline: offline, dumpsOf: dumpsOf, nearestDump: nearestDump,
    cellIndex: cellIndex, clearAt: clearAt, dumpAt: dumpAt, deposit: deposit, spill: spill, pickTarget: pickTarget, spawn: spawn, zoneById: zoneById, newDay: newDay
  };
})(window.JY = window.JY || {});
