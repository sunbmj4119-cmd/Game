/* 제설각 — 게임 규칙 (DOM 없음, Node에서도 돈다) */
(function (JY) {
  'use strict';
  var S = JY.SNOW, CELL = S.CELL, GW = S.GW, GH = S.GH;

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
    return { v: 1, bank: 0, life: 0, day: 1, tool: 0, crew: {}, perks: {}, zones: { A: true }, medals: 0, discharges: 0,
      last: 0, best: 0, total: 0, crewRate: 0, seed: (Math.random() * 1e9) | 0, seen: {} };
  }
  function migrate(s) {
    var d = newSave();
    if (!s || typeof s !== 'object') return d;
    Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; });
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
  function medalGain(save) { return Math.floor(Math.sqrt(save.life / 40000)); }

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
      out.zone.push({ kind: 'zone', id: Z.id, name: Z.name, desc: '눈 한 칸에 초코파이 ' + Z.value + '개', cost: Z.cost, state: ready ? 'buy' : 'lock',
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
    else if (kind === 'zone') save.zones[id] = true;
    return { ok: true, cost: o.cost, item: o };
  }

  function discharge(save) {
    if (!canDischarge(save)) return null;
    var gain = medalGain(save);
    var keep = { medals: save.medals + gain, discharges: save.discharges + 1, best: save.best, total: save.total, seed: (Math.random() * 1e9) | 0, seen: save.seen };
    var fresh = newSave();
    Object.keys(fresh).forEach(function (k) { save[k] = fresh[k]; });
    Object.keys(keep).forEach(function (k) { save[k] = keep[k]; });
    save.last = Date.now();
    return { medals: gain, total: save.medals };
  }

  /* ── 충돌 ── */
  function blocked(x, y, r) {
    if (x < r || y < r || x > S.W - r || y > S.H - r) return true;
    for (var i = 0; i < S.BUILDINGS.length; i++) {
      var b = S.BUILDINGS[i];
      if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
    }
    for (var j = 0; j < S.TREES.length; j++) {
      var t = S.TREES[j], dx = x - t[0], dy = y - t[1];
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

  /* ── 하루 ── */
  function createWorld(save, opts) {
    opts = opts || {};
    var wxi = weatherFor(save), wx = S.WEATHER[wxi.id];
    var w = {
      save: save, rand: mulberry(save.seed + save.day * 101 + (opts.salt || 0)),
      depth: new Uint8Array(GW * GH), zone: new Int8Array(GW * GH).fill(-1),
      cells: [], zoneOpen: [], zoneTotal: [], zoneClear: [], total: 0, clear: 0,
      time: 0, dayLen: dayLength(save), weather: wxi.id, wx: wx, inspect: wxi.inspect,
      goal: wxi.inspect ? S.INSPECT_GOAL : S.GOAL, mult: incomeMult(save) * wx.mult,
      earned: 0, crewEarned: 0, units: 0, fx: [], dirty: [], fallAcc: 0, done: false, flags: {}, demo: !!opts.demo,
      player: null, crew: [], haeng: null, sayT: 0, rank0: rankOf(save)
    };
    var R = w.rand;
    S.ZONES.forEach(function (Z, zi) {
      var open = !!save.zones[Z.id];
      w.zoneOpen[zi] = open; w.zoneTotal[zi] = 0; w.zoneClear[zi] = 0;
      for (var gy = Z.y / CELL; gy < (Z.y + Z.h) / CELL; gy++) {
        for (var gx = Z.x / CELL; gx < (Z.x + Z.w) / CELL; gx++) {
          var idx = gy * GW + gx;
          w.zone[idx] = zi;
          if (open) {
            w.depth[idx] = wx.depth[0] + Math.floor(R() * (wx.depth[1] - wx.depth[0] + 1));
            w.cells.push(idx); w.zoneTotal[zi]++;
          } else w.depth[idx] = 3;
        }
      }
    });
    w.total = w.cells.length;
    var tool = toolOf(save);
    w.player = { x: S.SPAWN.x, y: S.SPAWN.y, dir: { x: 0, y: 1 }, hitT: 0, walk: 0, moving: false, idleT: 0, swing: 0, r: tool.r, p: tool.p, aura: !!tool.aura };
    var song = lvl(save, 'song'), gear = lvl(save, 'gear');
    S.CREW.forEach(function (C) {
      for (var i = 0; i < crewN(save, C.id); i++) {
        w.crew.push({ def: C, x: S.DOOR.x + (R() - 0.5) * 200, y: S.DOOR.y + 14 + R() * 30, dir: { x: 0, y: 1 }, tidx: -1, tx: 0, ty: 0,
          hitT: R() * C.hit, retarget: 0, stuck: 0, walk: R() * 10, asleep: false, sleepT: 2 + R() * 4, swing: 0, moving: false,
          speed: C.speed * (1 + 0.12 * song), hit: C.hit / (1 + 0.06 * song), r: C.r * (1 + 0.15 * gear), p: C.p, seed: (R() * 1e6) | 0 });
      }
    });
    w.haeng = { x: 330, y: 280, dir: { x: 0, y: 1 }, tx: 330, ty: 280, wait: 2, walk: 0, moving: false, shoutT: 0 };
    return w;
  }

  function cellIndex(x, y) {
    var gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return -1;
    return gy * GW + gx;
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
        w.depth[idx] = d - take;
        removed += take; val += take * S.ZONES[zi].value;
        w.dirty.push(idx);
        if (d === take) { w.clear++; w.zoneClear[zi]++; }
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

  function say(w, key, who) {
    if (w.sayT > 0 && key !== 'late') return;
    w.fx.push({ t: 'say', key: key, who: who || 'haeng' });
    w.sayT = 6;
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

  function step(w, dt, input) {
    if (w.done) return;
    var save = w.save, R = w.rand, P = w.player;
    w.time += dt; w.sayT -= dt;
    // 나
    var ix = input ? input.x : 0, iy = input ? input.y : 0, mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; mag = 1; }
    var tool = toolOf(save), speed = S.SPEED * (1 + 0.12 * lvl(save, 'eisen')) * (tool.vehicle ? 1.15 : 1);
    if (mag > 0.08) {
      var moved = moveEnt(P, ix * speed * dt, iy * speed * dt, 6);
      P.dir.x += (ix / mag - P.dir.x) * Math.min(1, dt * 14); P.dir.y += (iy / mag - P.dir.y) * Math.min(1, dt * 14);
      var m = Math.hypot(P.dir.x, P.dir.y) || 1; P.dir.x /= m; P.dir.y /= m;
      P.moving = moved > 0.01; P.walk += moved * 0.18; P.idleT = 0;
    } else { P.moving = false; P.idleT += dt; }
    P.swing = Math.max(0, P.swing - dt * 6);
    P.hitT -= dt;
    if (P.hitT <= 0) {
      P.hitT += S.HIT / (1 + 0.1 * lvl(save, 'matsta'));
      if (P.hitT < 0) P.hitT = 0;
      var cx = P.aura ? P.x : P.x + P.dir.x * P.r * 0.6, cy = P.aura ? P.y : P.y + P.dir.y * P.r * 0.6 + 2;
      if (clearAt(w, cx, cy, P.r, P.p, 'player')) P.swing = 1;
    }
    if (P.idleT > 4 && !w.flags.idleSaid) { say(w, 'idle'); w.flags.idleSaid = true; }
    if (P.idleT === 0) w.flags.idleSaid = false;

    // 인력
    for (var i = 0; i < w.crew.length; i++) {
      var e = w.crew[i], C = e.def;
      e.swing = Math.max(0, e.swing - dt * 5);
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
    if (Hh.wait <= 0 && w.cells.length) {
      var idx = w.cells[(R() * w.cells.length) | 0];
      Hh.tx = (idx % GW) * CELL + 5; Hh.ty = ((idx / GW) | 0) * CELL + 5; Hh.wait = 5 + R() * 4;
    }
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
      if (dd < 3) { if (!dd) { w.clear--; w.zoneClear[w.zone[k]]--; } w.depth[k] = dd + 1; w.dirty.push(k); }
    }

    // 행보관 잔소리
    var pc = pct(w);
    if (pc >= 0.5 && !w.flags.half) { w.flags.half = true; say(w, 'half'); }
    if (pc >= w.goal - 0.08 && !w.flags.near) { w.flags.near = true; say(w, 'near'); }
    if (w.dayLen - w.time <= 10 && !w.flags.late) { w.flags.late = true; say(w, 'late'); }
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
    // 일찍 끝내면 남은 시간만큼 보너스 (빨리 치우는 장비가 끝까지 쓸모 있게)
    var left = Math.max(0, w.dayLen - w.time), timeBonus = w.early && w.time > 0 ? Math.round(w.earned / w.time * left * 0.6) : 0;
    bonus += timeBonus;
    var r0 = w.rank0;
    save.bank += bonus; save.life += bonus;
    save.day++; save.total += w.units;
    save.best = Math.max(save.best, Math.round(w.earned + bonus));
    save.crewRate = w.time > 0 ? w.crewEarned / w.time : 0;
    save.last = Date.now();
    var r1 = rankOf(save);
    return { day: save.day - 1, pct: p, grade: g, earned: Math.floor(w.earned), bonus: bonus, units: w.units, weather: w.weather, inspect: w.inspect,
      rankUp: r1 > r0 ? r1 : 0, goal: w.goal, early: !!w.early, left: left, timeBonus: timeBonus };
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
    cellIndex: cellIndex, clearAt: clearAt, pickTarget: pickTarget
  };
})(window.JY = window.JY || {});
