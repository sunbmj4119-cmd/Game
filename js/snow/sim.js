/* 제설각 — 게임 규칙 (DOM 없음, Node에서도 돈다) */
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
    return { v: 2, bank: 0, life: 0, day: 1, tool: 0, crew: {}, perks: {}, zones: { A: true }, medals: 0, discharges: 0,
      last: 0, best: 0, total: 0, crewRate: 0, seed: (Math.random() * 1e9) | 0, seen: {}, deerHits: 0 };
  }
  function migrate(s) {
    var d = newSave();
    if (!s || typeof s !== 'object') return d;
    Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; });
    Object.keys(s.zones).forEach(function (k) { if (!S.ZONES.some(function (Z) { return Z.id === k; })) delete s.zones[k]; });
    s.zones.A = true;
    if (s.tool >= S.TOOLS.length) s.tool = S.TOOLS.length - 1;
    return s;
  }

  function lvl(save, id) { return save.perks[id] || 0; }
  function crewN(save, id) { return save.crew[id] || 0; }
  function rankOf(save) { var r = 0; S.RANKS.forEach(function (R, i) { if (save.life >= R.life) r = i; }); return r; }
  function nextRank(save) { return S.RANKS[rankOf(save) + 1] || null; }
  function crewCost(C, n) { return Math.round(C.cost * Math.pow(C.grow, n)); }
  function perkCost(P, l) { return Math.round(P.cost * Math.pow(P.grow, l)); }
  function incomeMult(save) { return (1 + 0.15 * lvl(save, 'praise')) * (1 + 0.1 * save.medals); }
  function dayLength(save) { return S.BASE_DAY + 8 * lvl(save, 'hotpack'); }
  function toolOf(save) { return S.TOOLS[save.tool]; }
  function crewCount(save) { return S.CREW.reduce(function (a, C) { return a + crewN(save, C.id); }, 0); }
  function canDischarge(save) { return rankOf(save) >= 3 && save.life >= S.DISCHARGE_LIFE; }
  function medalGain(save) { return Math.floor(Math.sqrt(save.life / 50000)); }
  function zoneById(id) { for (var i = 0; i < S.ZONES.length; i++) if (S.ZONES[i].id === id) return S.ZONES[i]; return null; }

  function weatherFor(save) {
    var d = save.day;
    if (d === 1) return { id: 'light', inspect: false };
    if (d <= 3) return { id: 'normal', inspect: false };
    var r = mulberry(save.seed + d * 7919)();
    var inspect = d % 7 === 0;
    var id = r < 0.2 ? 'light' : r < 0.65 ? 'normal' : r < 0.9 ? 'heavy' : 'blizzard';
    if (inspect && id === 'blizzard') id = 'heavy';
    return { id: id, inspect: inspect };
  }

  /* ── 상점 ── */
  function offers(save) {
    var rank = rankOf(save), out = { tool: [], crew: [], perk: [], zone: [] };
    S.TOOLS.forEach(function (T, i) {
      if (i < save.tool - 1 || i > save.tool + 2) return;
      var st = i <= save.tool ? 'own' : i === save.tool + 1 ? 'buy' : 'later';
      out.tool.push({ kind: 'tool', id: T.id, i: i, name: T.name, desc: T.desc, cost: T.cost, state: st, cur: i === save.tool,
        stat: '범위 ' + T.r + (T.p > 1 ? ' · 힘 ×' + T.p : '') + (T.aura ? ' · 사방' : ''), ok: st === 'buy' && save.bank >= T.cost });
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
    S.ZONES.forEach(function (Z, i) {
      if (save.zones[Z.id]) return;
      var prev = S.ZONES[i - 1], ready = !prev || save.zones[prev.id];
      out.zone.push({ kind: 'zone', id: Z.id, name: Z.name, desc: Z.reveal, value: Z.value, cost: Z.cost, state: ready ? 'buy' : 'lock',
        lockText: (prev ? prev.name : '') + ' 먼저', ok: ready && save.bank >= Z.cost });
    });
    return out;
  }

  function buy(save, kind, id) {
    var list = offers(save)[kind] || [], o = null;
    list.forEach(function (x) { if (x.id === id) o = x; });
    if (!o || !o.ok) return { ok: false };
    save.bank -= o.cost;
    if (kind === 'tool') save.tool = o.i;
    else if (kind === 'crew') save.crew[id] = crewN(save, id) + 1;
    else if (kind === 'perk') save.perks[id] = lvl(save, id) + 1;
    else if (kind === 'zone') { save.zones[id] = true; save.seen['new' + id] = true; }
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

  /* ── 하루 ── */
  // 밤사이 쌓인 눈: 칸마다 제각각이 아니라 바람에 쌓인 언덕처럼 (값 노이즈)
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
  function schedule(w, save) {
    var R = w.rand, dl = w.dayLen, ev = [], day = save.day, i;
    if (day >= HAZ.deer.from) {
      var n = Math.round(Math.min(4, 1 + (day - 1) / 4) * (1 - 0.25 * lvl(save, 'gong')));
      for (i = 0; i < n; i++) ev.push({ t: 6 + R() * (dl - 18), k: 'deer' });
    }
    if (day >= HAZ.snowball.from && R() < HAZ.snowball.p) ev.push({ t: 10 + R() * (dl - 20), k: 'snowball' });
    if (save.zones[HAZ.car.zone]) { var trips = HAZ.car.trips[0] + (R() < 0.5 ? 1 : 0); for (i = 0; i < trips; i++) ev.push({ t: 8 + R() * (dl - 28), k: 'car' }); }
    if (day >= 3) for (var t = 14 + R() * 10; t < dl - 6; t += HAZ.roof.every * (0.7 + R() * 0.6)) ev.push({ t: t, k: 'roof' });
    if (save.zones[HAZ.heli.zone] && R() < HAZ.heli.p) ev.push({ t: 12 + R() * (dl - 26), k: 'heli' });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  function createWorld(save, opts) {
    opts = opts || {};
    var wxi = weatherFor(save), wx = S.WEATHER[wxi.id];
    var w = {
      save: save, rand: mulberry(save.seed + save.day * 101 + (opts.salt || 0)),
      depth: new Uint8Array(GW * GH), zone: new Int8Array(GW * GH).fill(-1), partOf: new Int16Array(GW * GH).fill(-1),
      cells: [], zoneOpen: [], zoneTotal: [], zoneClear: [], parts: [], total: 0, clear: 0,
      time: 0, dayLen: dayLength(save), weather: wxi.id, wx: wx, inspect: wxi.inspect,
      goal: wxi.inspect ? S.INSPECT_GOAL : S.GOAL, mult: incomeMult(save) * wx.mult,
      earned: 0, crewEarned: 0, units: 0, partBonus: 0, lost: 0, hits: 0, fx: [], dirty: [], fallAcc: 0, done: false, flags: {}, demo: !!opts.demo,
      player: null, crew: [], haeng: null, sayT: 0, rank0: rankOf(save),
      events: [], deer: [], car: null, heli: null, cats: []
    };
    var R = w.rand;
    S.ZONES.forEach(function (Z, zi) {
      var open = !!save.zones[Z.id];
      w.zoneOpen[zi] = open; w.zoneTotal[zi] = 0; w.zoneClear[zi] = 0;
      var pBase = w.parts.length;
      if (open) Z.parts.forEach(function (p) { w.parts.push({ zi: zi, name: p[0], x: Z.x + p[1] * Z.w, y: Z.y + p[2] * Z.h, w: (p[3] - p[1]) * Z.w, h: (p[4] - p[2]) * Z.h, total: 0, clear: 0, done: false }); });
      for (var gy = Z.y / CELL; gy < (Z.y + Z.h) / CELL; gy++) {
        for (var gx = Z.x / CELL; gx < (Z.x + Z.w) / CELL; gx++) {
          var cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
          if (inHole(Z, cx, cy)) continue;
          var idx = gy * GW + gx;
          w.zone[idx] = zi;
          if (open) {
            w.depth[idx] = Math.min(wx.depth[1], wx.depth[0] + Math.floor(drift(save.seed + save.day, gx, gy) * (wx.depth[1] - wx.depth[0] + 1)));
            w.cells.push(idx); w.zoneTotal[zi]++;
            for (var k = pBase; k < w.parts.length; k++) {
              var P = w.parts[k];
              if (cx >= P.x && cx < P.x + P.w && cy >= P.y && cy < P.y + P.h) { w.partOf[idx] = k; P.total++; break; }
            }
          } else w.depth[idx] = 3;
        }
      }
    });
    w.total = w.cells.length;
    var tool = toolOf(save);
    w.player = { x: S.SPAWN.x, y: S.SPAWN.y, dir: { x: 0, y: 1 }, hitT: 0, walk: 0, moving: false, idleT: 0, swing: 0, stun: 0, r: tool.r, p: tool.p, aura: !!tool.aura };
    var song = lvl(save, 'song'), gear = lvl(save, 'gear');
    S.CREW.forEach(function (C) {
      for (var i = 0; i < crewN(save, C.id); i++) {
        w.crew.push({ def: C, n: i, x: S.DOOR.x + (R() - 0.5) * 220, y: S.DOOR.y + 14 + R() * 30, dir: { x: 0, y: 1 }, tidx: -1, tx: 0, ty: 0,
          hitT: R() * C.hit, retarget: 0, stuck: 0, walk: R() * 10, asleep: false, sleepT: 2 + R() * 4, swing: 0, moving: false, injured: 0,
          speed: C.speed * (1 + 0.12 * song), hit: C.hit / (1 + 0.06 * song), r: C.r * (1 + 0.15 * gear), p: C.p, seed: (R() * 1e6) | 0 });
      }
    });
    w.haeng = { x: 330, y: 290, dir: { x: 0, y: 1 }, tx: 330, ty: 290, wait: 2, walk: 0, moving: false, shoutT: 0 };
    if (save.zones[HAZ.cats.zone]) {
      var D = zoneById(HAZ.cats.zone);
      for (var c = 0; c < HAZ.cats.n; c++) w.cats.push({ x: D.x + 30 + R() * (D.w - 60), y: D.y + D.h - 20 - R() * 60, dir: { x: 1, y: 0 }, tx: 0, ty: 0, wait: R() * 3, walk: 0, moving: false });
    }
    w.events = schedule(w, save);
    return w;
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
    if (!old && d) { w.clear--; w.zoneClear[w.zone[idx]]--; if (p >= 0) w.parts[p].clear--; }
    else if (old && !d) { w.clear++; w.zoneClear[w.zone[idx]]++; if (p >= 0) partClear(w, p); }
  }
  function partClear(w, p) {
    var P = w.parts[p];
    P.clear++;
    if (!P.done && P.total && P.clear / P.total >= S.PART_DONE) {
      P.done = true;
      var bonus = Math.round(P.total * S.ZONES[P.zi].value * 0.25 * w.mult);
      w.partBonus += bonus;
      if (!w.demo) { w.save.bank += bonus; w.save.life += bonus; }
      w.fx.push({ t: 'part', name: P.name, x: P.x + P.w / 2, y: P.y + P.h / 2, bonus: bonus, p: p });
    }
  }

  function clearAt(w, cx, cy, r, p, src) {
    var x0 = Math.max(0, Math.floor((cx - r) / CELL)), x1 = Math.min(GW - 1, Math.floor((cx + r) / CELL));
    var y0 = Math.max(0, Math.floor((cy - r) / CELL)), y1 = Math.min(GH - 1, Math.floor((cy + r) / CELL));
    var rr = (r + 3) * (r + 3), removed = 0, val = 0;
    for (var gy = y0; gy <= y1; gy++) {
      for (var gx = x0; gx <= x1; gx++) {
        var ccx = gx * CELL + CELL / 2 - cx, ccy = gy * CELL + CELL / 2 - cy;
        if (ccx * ccx + ccy * ccy > rr) continue;
        var idx = gy * GW + gx, zi = w.zone[idx];
        if (zi < 0 || !w.zoneOpen[zi]) continue;
        var d = w.depth[idx];
        if (!d) continue;
        var take = d < p ? d : p;
        removed += take; val += take * S.ZONES[zi].value;
        setDepth(w, idx, d - take);
      }
    }
    if (removed) {
      var gain = val * w.mult;
      w.earned += gain; w.units += removed;
      if (src !== 'player') w.crewEarned += gain;
      if (!w.demo) { w.save.bank += gain; w.save.life += gain; }
      w.fx.push({ t: 'clear', x: cx, y: cy, n: removed, gain: gain, src: src });
    }
    return removed;
  }

  // 눈을 다시 쌓는다 (고라니 발길질, 차 진흙눈, 지붕 눈)
  function dumpAt(w, cx, cy, r, add, prob, max) {
    var x0 = Math.max(0, Math.floor((cx - r) / CELL)), x1 = Math.min(GW - 1, Math.floor((cx + r) / CELL));
    var y0 = Math.max(0, Math.floor((cy - r) / CELL)), y1 = Math.min(GH - 1, Math.floor((cy + r) / CELL));
    var n = 0;
    for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
      var idx = gy * GW + gx, zi = w.zone[idx];
      if (zi < 0 || !w.zoneOpen[zi] || w.depth[idx] >= max || w.rand() > prob) continue;
      setDepth(w, idx, Math.min(max, w.depth[idx] + add)); n++;
    }
    return n;
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
    for (var k = 0; k < 16; k++) {
      var idx = w.cells[(R() * n) | 0], d = w.depth[idx];
      if (!d) continue;
      var x = (idx % GW) * CELL + 5, y = ((idx / GW) | 0) * CELL + 5;
      var s = Math.hypot(x - e.x, y - e.y) - d * 18;
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
    // 고라니
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
          w.fx.push({ t: 'deerHit', e: c, x: c.x, y: c.y }); say(w, 'deerHit', true); break;
        }
      }
      if (d.hitT <= 0 && P.stun <= 0 && Math.abs(P.x - d.x) < hr && Math.abs(P.y - d.y) < hr) {
        P.stun = HAZ.deer.stun * (1 - 0.1 * medic); d.hitT = 1; d.heading += Math.PI * 0.8; w.hits++;
        var lose = w.demo ? 0 : Math.min(Math.floor(save.bank), Math.floor(w.earned * 0.03) + 5);
        if (lose > 0) { save.bank -= lose; w.lost += lose; }
        w.fx.push({ t: 'meHit', x: P.x, y: P.y, lose: lose }); say(w, 'meHit', true);
      }
    }
    // 간부 차량: 진입로를 올라갔다가 내려간다
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
    // 헬기: 하강풍으로 눈을 날려 준다
    var hl = w.heli;
    if (hl) {
      hl.t += dt; hl.tick -= dt;
      if (hl.t > 1.5 && hl.t < hl.life - 1.2 && hl.tick <= 0) { hl.tick = 0.15; clearAt(w, hl.x + (R() - 0.5) * 30, hl.y + (R() - 0.5) * 30, HAZ.heli.r, 2, 'heli'); }
      if (hl.t > hl.life) w.heli = null;
    }
    // 짬타이거
    w.cats.forEach(function (c) {
      c.wait -= dt;
      var pd = Math.hypot(P.x - c.x, P.y - c.y);
      if (pd < 34) { c.tx = c.x + (c.x - P.x) * 2; c.ty = c.y + (c.y - P.y) * 2; c.wait = 3; }
      else if (c.wait <= 0) { var D = zoneById(HAZ.cats.zone); c.tx = D.x + 20 + R() * (D.w - 40); c.ty = D.y + 20 + R() * (D.h - 40); c.wait = 4 + R() * 6; }
      if (Math.hypot(c.tx - c.x, c.ty - c.y) > 3) steer(c, c.tx, c.ty, pd < 34 ? 90 : 22, dt, 4); else c.moving = false;
    });
  }

  function step(w, dt, input) {
    if (w.done) return;
    var save = w.save, R = w.rand, P = w.player;
    w.time += dt; w.sayT -= dt;
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
      if (P.stun <= 0) {
        var cx = P.aura ? P.x : P.x + P.dir.x * P.r * 0.6, cy = P.aura ? P.y : P.y + P.dir.y * P.r * 0.6 + 2;
        if (clearAt(w, cx, cy, P.r, P.p, 'player')) P.swing = 1;
      }
    }
    if (P.idleT > 4 && !w.flags.idleSaid) { say(w, 'idle'); w.flags.idleSaid = true; }
    if (P.idleT === 0) w.flags.idleSaid = false;

    // 인력
    for (var i = 0; i < w.crew.length; i++) {
      var e = w.crew[i], C = e.def;
      e.swing = Math.max(0, e.swing - dt * 5);
      if (e.injured > 0) { e.injured -= dt; e.moving = false; if (e.injured <= 0) w.fx.push({ t: 'up', e: e }); continue; }
      if (C.sleep) {
        e.sleepT -= dt;
        if (e.sleepT <= 0) { e.asleep = R() < C.sleep; e.sleepT = 3 + R() * 4; if (e.asleep) w.fx.push({ t: 'zzz', e: e }); }
        if (e.asleep) { e.moving = false; continue; }
      }
      e.retarget -= dt;
      if (e.tidx < 0 || e.retarget <= 0 || !w.depth[e.tidx]) pickTarget(w, e);
      var dist = Math.hypot(e.tx - e.x, e.ty - e.y), near = e.r * 0.5;
      if (dist > near) {
        var mv = steer(e, e.tx, e.ty, e.speed, dt, 6);
        if (mv < e.speed * dt * 0.25) { e.stuck += dt; if (e.stuck > 0.8) { e.stuck = 0; e.tidx = -1; e.retarget = 0; } } else e.stuck = 0;
      } else e.moving = false;
      e.hitT -= dt;
      if (e.hitT <= 0) {
        e.hitT += e.hit; if (e.hitT < 0) e.hitT = 0;
        if (clearAt(w, e.x + e.dir.x * e.r * 0.6, e.y + e.dir.y * e.r * 0.6 + 2, e.r, e.p, 'crew')) e.swing = 1;
      }
      if (R() < dt * 0.02) w.fx.push({ t: 'chat', e: e });
    }

    // 행보관: 돌아다니며 감시
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

    // 눈이 계속 내린다
    w.fallAcc += w.cells.length * S.FALL * w.wx.fall * dt;
    while (w.fallAcc >= 1) {
      w.fallAcc -= 1;
      var k = w.cells[(R() * w.cells.length) | 0], dd = w.depth[k];
      if (dd < 3) setDepth(w, k, dd + 1);
    }

    var pc = pct(w);
    if (pc >= 0.5 && !w.flags.half) { w.flags.half = true; say(w, 'half'); }
    if (pc >= w.goal - 0.08 && !w.flags.near) { w.flags.near = true; say(w, 'near'); }
    if (w.dayLen - w.time <= 10 && !w.flags.late) { w.flags.late = true; say(w, 'late', true); }
    if (pc >= 0.98) { w.done = true; w.early = true; }
    if (w.time >= w.dayLen) w.done = true;
  }

  function pct(w) { return w.total ? w.clear / w.total : 0; }

  function gradeOf(w) {
    var p = pct(w);
    return p >= 0.95 ? 'S' : p >= w.goal ? 'A' : p >= 0.5 ? 'B' : 'C';
  }

  function finishDay(w) {
    var save = w.save, p = pct(w), g = gradeOf(w);
    var rate = { S: 0.4, A: 0.2, B: 0, C: 0 }[g] * (w.inspect ? 2 : 1);
    var bonus = Math.round(w.earned * rate);
    var left = Math.max(0, w.dayLen - w.time), timeBonus = w.early && w.time > 0 ? Math.round(w.earned / w.time * left * 0.6) : 0;
    bonus += timeBonus;
    save.bank += bonus; save.life += bonus;
    save.day++; save.total += w.units; save.deerHits += w.hits;
    save.best = Math.max(save.best, Math.round(w.earned + bonus));
    save.crewRate = w.time > 0 ? w.crewEarned / w.time : 0;
    save.last = Date.now();
    var r1 = rankOf(save);
    return { day: save.day - 1, pct: p, grade: g, earned: Math.floor(w.earned), bonus: bonus, units: w.units, weather: w.weather, inspect: w.inspect,
      rankUp: r1 > w.rank0 ? r1 : 0, goal: w.goal, early: !!w.early, left: left, timeBonus: timeBonus,
      partBonus: w.partBonus, parts: w.parts.filter(function (x) { return x.done; }).length, partsTotal: w.parts.length, lost: w.lost, hits: w.hits };
  }

  // 앱을 꺼 둔 동안: 지난 작업의 인력 수입 × 시간 × 10% (최대 8시간)
  function offline(save, now) {
    if (!save.last || !save.crewRate) return 0;
    var sec = Math.min((now - save.last) / 1000, 8 * 3600);
    if (sec < 300) return 0;
    return Math.floor(save.crewRate * sec * 0.1);
  }

  JY.SnowSim = {
    mulberry: mulberry, newSave: newSave, migrate: migrate, lvl: lvl, crewN: crewN, rankOf: rankOf, nextRank: nextRank,
    crewCost: crewCost, perkCost: perkCost, incomeMult: incomeMult, dayLength: dayLength, toolOf: toolOf, crewCount: crewCount,
    canDischarge: canDischarge, medalGain: medalGain, discharge: discharge, weatherFor: weatherFor, offers: offers, buy: buy,
    blocked: blocked, createWorld: createWorld, step: step, pct: pct, gradeOf: gradeOf, finishDay: finishDay, offline: offline,
    cellIndex: cellIndex, clearAt: clearAt, dumpAt: dumpAt, pickTarget: pickTarget, spawn: spawn, zoneById: zoneById
  };
})(window.JY = window.JY || {});
