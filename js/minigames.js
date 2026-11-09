/* 돌발 미니게임 6종 — 비상 소집, 제설, 불침번, 사격, 탄피 찾기, 선임 이름 외우기
 * JY.Mini.start(id, opts, done(tier))  tier: 'great' | 'good' | 'bad' */
(function (JY) {
  'use strict';

  var root = null;
  var raf = 0;
  var timers = [];
  var cleanups = [];

  function S() { return JY.Sound || {}; }
  function snd(name) { var s = S(); if (s[name]) s[name](); }
  function $(sel) { return root.querySelector(sel); }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearAll() {
    cancelAnimationFrame(raf); raf = 0;
    timers.forEach(clearTimeout); timers = [];
    cleanups.forEach(function (f) { try { f(); } catch (e) { /* 무시 */ } }); cleanups = [];
  }
  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); cleanups.push(function () { el.removeEventListener(ev, fn, opt); }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function frame(title, howto) {
    root = document.getElementById('mini');
    root.hidden = false;
    root.innerHTML =
      '<header class="mg-head"><h2>' + title + '</h2><p>' + howto + '</p>' +
      '<div class="mg-hud"><span id="mg-left">준비…</span><span id="mg-right"></span></div>' +
      '<div class="mg-time"><i id="mg-time"></i></div></header>' +
      '<div class="mg-stage" id="mg-stage"><div class="mg-count" id="mg-count"></div></div>';
    return { stage: $('#mg-stage'), left: $('#mg-left'), right: $('#mg-right'), time: $('#mg-time'), count: $('#mg-count') };
  }

  function countdown(ui, cb) {
    var n = 3;
    function step() {
      ui.count.classList.remove('pop'); void ui.count.offsetWidth; ui.count.classList.add('pop');
      if (n > 0) { ui.count.textContent = n; snd('tick'); n -= 1; later(step, 560); }
      else { ui.count.textContent = '시작!'; snd('coin'); later(function () { ui.count.textContent = ''; cb(); }, 420); }
    }
    step();
  }

  function timer(ui, total, getPenalty, onTick, onEnd) {
    var t0 = performance.now();
    function loop(now) {
      var el = (now - t0) / 1000;
      var left = Math.max(0, total - el - (getPenalty ? getPenalty() : 0));
      ui.time.style.width = (left / total * 100).toFixed(1) + '%';
      ui.left.textContent = left.toFixed(1) + '초';
      if (onTick && onTick(el, left) === false) return;
      if (left <= 0) { onEnd(); return; }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  function finish(ui, tier, title, sub, done) {
    clearAll();
    var b = document.createElement('div');
    b.className = 'mg-banner';
    b.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    ui.stage.appendChild(b);
    snd(tier === 'bad' ? 'bad' : 'good');
    if (JY.buzz) JY.buzz(tier === 'bad' ? [60, 40, 60] : 30);
    later(function () { clearAll(); root.hidden = true; root.innerHTML = ''; done(tier); }, 1500);
  }

  function canvas(stage) {
    var c = document.createElement('canvas');
    stage.insertBefore(c, stage.firstChild);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(200, stage.clientWidth), h = Math.max(200, stage.clientHeight);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, g: g, w: w, h: h, dpr: dpr };
  }
  function pt(e, el) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  var GAMES = {};

  /* ── 1. 비상 소집: 순서대로 장비 챙기기 ── */
  GAMES.dressup = function (o, done) {
    var ui = frame('비상 소집!', '순서대로 장비를 챙겨라. 틀리면 1초 감점!');
    var ORDER = [['전투복', '👕'], ['전투화', '🥾'], ['탄띠', '🎗️'], ['방탄헬멧', '⛑️'], ['방독면', '😷'], ['개인화기', '🎯']];
    var items = ORDER.map(function (g, i) { return { n: g[0], e: g[1], i: i }; });
    var order = '<div class="gear-order" id="gear-order">' + items.map(function (it) { return '<span data-i="' + it.i + '">' + (it.i + 1) + '. ' + it.n + '</span>'; }).join('') + '</div>';
    var grid = '<div class="gear-grid">' + shuffle(items.slice()).map(function (it) {
      return '<button class="gear" data-i="' + it.i + '" disabled><i>' + it.e + '</i>' + it.n + '</button>';
    }).join('') + '</div>';
    ui.stage.insertAdjacentHTML('afterbegin', '<div class="gear-wrap">' + order + grid + '</div>');
    var next = 0, penalty = 0, over = false, TOTAL = 9;
    function mark() {
      root.querySelectorAll('#gear-order span').forEach(function (s) {
        var i = +s.dataset.i;
        s.className = i < next ? 'done' : i === next ? 'next' : '';
      });
    }
    mark();
    ui.right.textContent = '0/6';
    countdown(ui, function () {
      root.querySelectorAll('.gear').forEach(function (b) {
        b.disabled = false;
        on(b, 'click', function () {
          if (over) return;
          var i = +b.dataset.i;
          if (i === next) {
            b.classList.add('done'); b.disabled = true; next += 1; snd('tick'); mark();
            ui.right.textContent = next + '/6';
            if (next === 6) {
              over = true;
              var left = parseFloat(ui.left.textContent) || 0;
              var tier = left >= 3.5 ? 'great' : 'good';
              finish(ui, tier, tier === 'great' ? '1등 집결!' : '집결 완료', '남은 시간 ' + left.toFixed(1) + '초', done);
            }
          } else {
            penalty += 1; snd('miss');
            b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
            later(function () { b.classList.remove('wrong'); }, 360);
            if (JY.buzz) JY.buzz(40);
          }
        });
      });
      timer(ui, TOTAL, function () { return penalty; }, function () { return !over; }, function () {
        if (over) return; over = true;
        finish(ui, 'bad', '시간 초과!', '방탄모를 거꾸로 쓰고 나갔다', done);
      });
    });
  };

  /* ── 2. 제설: 문질러서 눈 치우기 ── */
  GAMES.snow = function (o, done) {
    var ui = frame('제설 작업', '화면을 문질러 눈을 치워라! 눈은 계속 내린다…');
    var cv = canvas(ui.stage), g = cv.g, w = cv.w, h = cv.h;
    var cols = 9, cell = w / cols, rows = Math.ceil(h / cell);
    var grid = []; for (var i = 0; i < cols * rows; i++) grid.push(1);
    var flakes = []; for (var f = 0; f < 50; f++) flakes.push({ x: rnd(0, w), y: rnd(0, h), s: rnd(1.5, 3.5), v: rnd(30, 70) });
    var started = false, over = false, down = false, last = null, ptr = null, cleared = 0;
    var TOTAL = 10;
    function count() { var c = 0; for (var i = 0; i < grid.length; i++) if (!grid[i]) c++; return c; }
    function clearAt(x, y) {
      var R = cell * 0.85;
      var c0 = Math.max(0, Math.floor((x - R) / cell)), c1 = Math.min(cols - 1, Math.floor((x + R) / cell));
      var r0 = Math.max(0, Math.floor((y - R) / cell)), r1 = Math.min(rows - 1, Math.floor((y + R) / cell));
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
        var cx = (c + 0.5) * cell, cy = (r + 0.5) * cell;
        if ((cx - x) * (cx - x) + (cy - y) * (cy - y) <= R * R && grid[r * cols + c]) { grid[r * cols + c] = 0; if (Math.random() < 0.25) snd('shovel'); }
      }
    }
    function stroke(p) {
      if (!started || over) return;
      if (last) {
        var dx = p.x - last.x, dy = p.y - last.y, d = Math.sqrt(dx * dx + dy * dy), n = Math.max(1, Math.ceil(d / (cell / 3)));
        for (var k = 1; k <= n; k++) clearAt(last.x + dx * k / n, last.y + dy * k / n);
      } else clearAt(p.x, p.y);
      last = p;
    }
    on(cv.c, 'pointerdown', function (e) { down = true; last = null; ptr = pt(e, cv.c); stroke(ptr); try { cv.c.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } });
    on(cv.c, 'pointermove', function (e) { ptr = pt(e, cv.c); if (down) stroke(ptr); });
    on(cv.c, 'pointerup', function () { down = false; last = null; });
    on(cv.c, 'pointercancel', function () { down = false; last = null; });
    var regrow = 0, prev = performance.now();
    function draw(now) {
      var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      g.fillStyle = '#8f7a5c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2;
      for (var y = 20; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 8); g.stroke(); }
      g.fillStyle = '#fbfdff';
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        if (!grid[r * cols + c]) continue;
        var x = c * cell, yy = r * cell;
        g.beginPath(); g.arc(x + cell / 2, yy + cell / 2, cell * 0.72, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.9)';
      flakes.forEach(function (fl) { fl.y += fl.v * dt; if (fl.y > h) { fl.y = -5; fl.x = rnd(0, w); } g.beginPath(); g.arc(fl.x, fl.y, fl.s, 0, Math.PI * 2); g.fill(); });
      if (ptr && down) {
        g.save(); g.translate(ptr.x, ptr.y); g.rotate(-0.5);
        g.fillStyle = '#a0763e'; g.fillRect(-3, 0, 6, 60);
        g.fillStyle = '#b5bcc2'; g.strokeStyle = '#2a2620'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-22, -6); g.lineTo(22, -6); g.lineTo(18, 8); g.lineTo(-18, 8); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      if (started && !over) {
        regrow += dt;
        while (regrow > 0.24) {
          regrow -= 0.24;
          var idx = Math.floor(Math.random() * grid.length);
          if (!grid[idx]) grid[idx] = 1;
        }
      }
      cleared = count() / grid.length;
      ui.right.textContent = '치운 면적 ' + Math.round(cleared * 100) + '%';
      if (!over) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    countdown(ui, function () {
      started = true;
      var t0 = performance.now();
      (function tick() {
        if (over) return;
        var left = Math.max(0, TOTAL - (performance.now() - t0) / 1000);
        ui.time.style.width = (left / TOTAL * 100) + '%';
        ui.left.textContent = left.toFixed(1) + '초';
        if (left <= 0) {
          over = true;
          var tier = cleared >= 0.8 ? 'great' : cleared >= 0.5 ? 'good' : 'bad';
          finish(ui, tier, tier === 'great' ? '연병장 반짝!' : tier === 'good' ? '얼추 치웠다' : '눈이 이겼다…', '치운 면적 ' + Math.round(cleared * 100) + '%', done);
          return;
        }
        later(tick, 50);
      })();
    });
  };

  /* ── 3. 불침번: 연타해서 눈 뜨고 있기 ── */
  GAMES.watch = function (o, done) {
    var ui = frame('불침번', '화면을 연타해서 눈을 떠라! 당직사관 순찰 때 졸면 끝장.');
    var cv = canvas(ui.stage), g = cv.g, w = cv.w, h = cv.h;
    var hp = (o.stats && o.stats.hp) || 50;
    var open = 100, started = false, over = false, el = 0, prev = 0;
    var patrols = [3.6, 7.4, 10.8], checks = [], warn = null;
    var TOTAL = 12.5;
    on(cv.c, 'pointerdown', function () {
      if (!started || over) return;
      open = Math.min(100, open + 10); snd('tap');
    });
    function scene() {
      g.fillStyle = '#1b2240'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#26305a'; g.fillRect(0, h * 0.62, w, h * 0.38);
      g.fillStyle = '#3a4570';
      for (var i = 0; i < 4; i++) g.fillRect(w * 0.06 + i * w * 0.24, h * 0.66, w * 0.18, h * 0.12);
      g.fillStyle = '#c7cfe6';
      for (var j = 0; j < 4; j++) { g.beginPath(); g.arc(w * 0.1 + j * w * 0.24, h * 0.68, 7, 0, 7); g.fill(); }
      g.fillStyle = '#2f3a66'; g.fillRect(w * 0.62, h * 0.12, w * 0.26, h * 0.26);
      g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(w * 0.75, h * 0.22, 14, 0, 7); g.fill();
      g.fillStyle = '#e8ecf7'; g.font = 'bold 15px sans-serif'; g.fillText('🕒 03:12', 14, 26);
    }
    function loop(now) {
      if (!prev) prev = now;
      var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      scene();
      if (started && !over) {
        el += dt;
        var rate = (10 + el * 0.7) * (1 + Math.max(0, 55 - hp) / 100) * (o.hard ? 1.25 : 1);
        open = Math.max(0, open - rate * dt);
        var left = Math.max(0, TOTAL - el);
        ui.time.style.width = (left / TOTAL * 100) + '%';
        ui.left.textContent = left.toFixed(1) + '초';
        ui.right.textContent = '눈 뜸 ' + Math.round(open) + '%';
        var np = patrols[checks.length];
        warn = np !== undefined && el > np - 1.2 && el < np ? np : null;
        if (np !== undefined && el >= np) {
          checks.push(open);
          if (open < 40) { over = true; finish(ui, 'bad', '걸렸다!', '당직사관 손전등이 얼굴을 비췄다', done); }
        }
        if (!over && open <= 0) { over = true; finish(ui, 'bad', '잠들었다…', '서서 코를 골았다', done); }
        if (!over && left <= 0) {
          over = true;
          var good = checks.every(function (v) { return v >= 65; });
          finish(ui, good ? 'great' : 'good', good ? '완벽한 불침번!' : '겨우 버텼다', '순찰 ' + checks.length + '회 통과', done);
        }
      }
      if (warn !== null) {
        var p = 1 - (warn - el) / 1.2;
        g.fillStyle = 'rgba(255,246,168,' + (0.15 + p * 0.35) + ')';
        g.beginPath(); g.moveTo(-20, h * 0.3); g.lineTo(w * p, h * 0.45); g.lineTo(-20, h * 0.75); g.closePath(); g.fill();
        g.fillStyle = '#ffd34d'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center';
        g.fillText('⚠ 당직사관 순찰 중…', w / 2, h * 0.5); g.textAlign = 'left';
      }
      var lid = (100 - open) / 100 * (h / 2);
      g.fillStyle = '#0b0b0b';
      g.fillRect(0, 0, w, lid); g.fillRect(0, h - lid, w, lid);
      if (open < 45) { g.fillStyle = '#9aa7d6'; g.font = 'bold 34px sans-serif'; g.fillText('Z z z', w * 0.6, h * 0.42); }
      if (!over) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    countdown(ui, function () { started = true; });
  };

  /* ── 4. 사격: 튀어나오는 표적 맞히기 ── */
  GAMES.shoot = function (o, done) {
    var ui = frame('사격', '표적이 뜨면 재빨리 터치! 10발 중 9발이면 특등사수.');
    var cv = canvas(ui.stage), g = cv.g, w = cv.w, h = cv.h;
    var st = o.stats || { hp: 50, mt: 50 };
    var sway = 4 + Math.max(0, 60 - st.hp) * 0.25 + Math.max(0, 50 - st.mt) * 0.15;
    var bonus = o.mos === 'infantry' ? 1.25 : 1;
    var ROUNDS = 10, round = 0, hits = 0, tgt = null, marks = [], started = false, over = false, shots = 0;
    var DIST = [
      { m: 100, y: 0.82, r: 0.12 }, { m: 200, y: 0.64, r: 0.09 }, { m: 250, y: 0.52, r: 0.07 }
    ];
    function spawn() {
      if (round >= ROUNDS) return end();
      var d = DIST[Math.floor(Math.random() * 3)];
      var r = Math.max(16, w * d.r);
      tgt = { x: rnd(r + 10, w - r - 10), y: h * d.y, r: r, m: d.m, born: performance.now(), ttl: Math.max(1150, 1650 - round * 45), down: false, hit: false };
      round += 1; shots = 0;
      ui.right.textContent = '명중 ' + hits + '/' + ROUNDS + ' · ' + round + '번째';
    }
    function end() {
      if (over) return; over = true;
      var tier = hits >= 9 ? 'great' : hits >= 6 ? 'good' : 'bad';
      finish(ui, tier, tier === 'great' ? '특등사수!!' : tier === 'good' ? '합격' : '불합격…', '명중 ' + hits + '/' + ROUNDS, done);
    }
    on(cv.c, 'pointerdown', function (e) {
      if (!started || over || !tgt || tgt.down) return;
      if (shots >= 2) return;
      shots += 1;
      var p = pt(e, cv.c);
      var a = Math.random() * Math.PI * 2, m = Math.random() * sway;
      var hx = p.x + Math.cos(a) * m, hy = p.y + Math.sin(a) * m;
      marks.push({ x: hx, y: hy, t: performance.now() });
      var cx = tgt.x, cy = tgt.y - tgt.r * 0.6;
      var dx = (hx - cx) / (tgt.r * bonus), dy = (hy - cy) / (tgt.r * 1.25 * bonus);
      if (dx * dx + dy * dy <= 1) {
        tgt.hit = true; tgt.down = true; tgt.downAt = performance.now(); hits += 1; snd('hit');
        if (JY.buzz) JY.buzz(15);
        later(spawn, 380);
      } else snd('miss');
      ui.right.textContent = '명중 ' + hits + '/' + ROUNDS + ' · ' + round + '번째';
    });
    function drawTarget(t, now) {
      var rise = Math.min(1, (now - t.born) / 120);
      if (t.down) rise = Math.max(0, 1 - (now - t.downAt) / 160);
      if (rise <= 0) return;
      g.save(); g.translate(t.x, t.y); g.scale(1, rise);
      g.fillStyle = '#2f3a20'; g.strokeStyle = '#f4f0dc'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-t.r, 0); g.lineTo(-t.r * 0.9, -t.r * 0.8); g.quadraticCurveTo(-t.r * 0.55, -t.r * 1.05, -t.r * 0.32, -t.r * 1.05);
      g.arc(0, -t.r * 1.3, t.r * 0.4, Math.PI * 0.85, Math.PI * 0.15, false);
      g.lineTo(t.r * 0.32, -t.r * 1.05); g.quadraticCurveTo(t.r * 0.55, -t.r * 1.05, t.r * 0.9, -t.r * 0.8); g.lineTo(t.r, 0);
      g.closePath(); g.fill(); g.stroke();
      g.restore();
      g.fillStyle = '#f4f0dc'; g.font = '11px monospace'; g.textAlign = 'center';
      g.fillText(t.m + 'm', t.x, t.y + 14); g.textAlign = 'left';
    }
    function loop(now) {
      var sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#9fd0ee'); sky.addColorStop(0.45, '#d9eef6'); sky.addColorStop(0.46, '#7d955a'); sky.addColorStop(1, '#5e7444');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6f8a4f';
      g.beginPath(); g.moveTo(0, h * 0.46); g.quadraticCurveTo(w * 0.3, h * 0.3, w * 0.6, h * 0.42); g.quadraticCurveTo(w * 0.85, h * 0.33, w, h * 0.44); g.lineTo(w, h * 0.47); g.lineTo(0, h * 0.47); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
      [0.5, 0.62, 0.8].forEach(function (yy) { g.beginPath(); g.moveTo(0, h * yy); g.lineTo(w, h * yy); g.stroke(); });
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 26, w, 26);
      g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('흔들림 ±' + Math.round(sway) + 'px (체력·멘탈이 낮을수록 흔들린다)', 10, h - 9);
      if (tgt) {
        drawTarget(tgt, now);
        if (!tgt.down && started && now - tgt.born > tgt.ttl) { tgt.down = true; tgt.downAt = now; snd('miss'); later(spawn, 300); }
      }
      marks = marks.filter(function (mk) { return now - mk.t < 500; });
      marks.forEach(function (mk) {
        g.fillStyle = 'rgba(20,20,20,' + (1 - (now - mk.t) / 500) + ')';
        g.beginPath(); g.arc(mk.x, mk.y, 4, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,240,180,' + (1 - (now - mk.t) / 500) + ')'; g.beginPath(); g.arc(mk.x, mk.y, 9, 0, 7); g.stroke();
      });
      if (!over) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    ui.time.style.width = '100%';
    countdown(ui, function () { started = true; ui.left.textContent = '사격 개시'; spawn(); });
  };

  /* ── 5. 탄피 찾기: 풀숲 속 숨은 그림 찾기 ── */
  GAMES.shell = function (o, done) {
    var ui = frame('탄피 찾기', '풀숲 어딘가에 탄피 3개! 반짝이는 걸 찾아 터치.');
    var cv = canvas(ui.stage), g = cv.g, w = cv.w, h = cv.h;
    var bg = document.createElement('canvas');
    bg.width = cv.c.width; bg.height = cv.c.height;
    var b = bg.getContext('2d'); b.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    var shells = [], decoys = [];
    for (var i = 0; i < 3; i++) shells.push({ x: rnd(30, w - 30), y: rnd(40, h - 30), a: rnd(0, Math.PI), found: false });
    for (var d = 0; d < 12; d++) decoys.push({ x: rnd(20, w - 20), y: rnd(30, h - 20), k: d % 3 });
    var grad = b.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#5c7a34'); grad.addColorStop(1, '#3f5a22');
    b.fillStyle = grad; b.fillRect(0, 0, w, h);
    decoys.forEach(function (dc) {
      if (dc.k === 0) { b.fillStyle = '#9a9a92'; b.beginPath(); b.ellipse(dc.x, dc.y, 7, 5, 0.4, 0, 7); b.fill(); }
      else if (dc.k === 1) { b.fillStyle = '#c0392b'; b.beginPath(); b.arc(dc.x, dc.y, 5, 0, 7); b.fill(); }
      else { b.fillStyle = '#b08d57'; b.beginPath(); b.ellipse(dc.x, dc.y, 8, 3.5, 1.1, 0, 7); b.fill(); }
    });
    shells.forEach(function (s) {
      b.save(); b.translate(s.x, s.y); b.rotate(s.a);
      b.fillStyle = '#d9a93a'; b.strokeStyle = '#7a5a10'; b.lineWidth = 1;
      b.beginPath(); b.rect(-8, -2.6, 16, 5.2); b.fill(); b.stroke();
      b.fillStyle = '#f3d27a'; b.fillRect(-8, -2.6, 16, 1.6);
      b.restore();
    });
    var blades = Math.round(w * h / 220);
    for (var k = 0; k < blades; k++) {
      var x = rnd(0, w), y = rnd(0, h + 10), len = rnd(8, 22);
      b.strokeStyle = Math.random() < 0.5 ? '#6f9440' : '#4d6d28'; b.lineWidth = rnd(1, 2.2);
      b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo(x + rnd(-4, 4), y - len / 2, x + rnd(-7, 7), y - len); b.stroke();
    }
    var started = false, over = false, found = 0, glint = null, nextGlint = 0, pops = [];
    var TOTAL = 15;
    on(cv.c, 'pointerdown', function (e) {
      if (!started || over) return;
      var p = pt(e, cv.c), best = null, bd = 30;
      shells.forEach(function (s) { if (s.found) return; var dd = Math.hypot(s.x - p.x, s.y - p.y); if (dd < bd) { bd = dd; best = s; } });
      if (best) {
        best.found = true; found += 1; snd('coin'); pops.push({ x: best.x, y: best.y, t: performance.now(), txt: '찾았다!' });
        ui.right.textContent = '탄피 ' + found + '/3';
        if (found === 3) {
          over = true;
          var left = parseFloat(ui.left.textContent) || 0;
          finish(ui, left >= 5 ? 'great' : 'good', left >= 5 ? '중대의 영웅!' : '겨우 찾았다', '남은 시간 ' + left.toFixed(1) + '초', done);
        }
      } else {
        var dec = decoys.some(function (dc) { return Math.hypot(dc.x - p.x, dc.y - p.y) < 18; });
        pops.push({ x: p.x, y: p.y, t: performance.now(), txt: dec ? '돌멩이…' : '없다' });
        snd('miss');
      }
    });
    function loop(now) {
      g.drawImage(bg, 0, 0, w, h);
      if (started && now > nextGlint) {
        var rest = shells.filter(function (s) { return !s.found; });
        if (rest.length) glint = { s: rest[Math.floor(Math.random() * rest.length)], t: now };
        nextGlint = now + 2200;
      }
      if (glint && now - glint.t < 380) {
        var a = 1 - (now - glint.t) / 380;
        g.save(); g.translate(glint.s.x, glint.s.y); g.fillStyle = 'rgba(255,250,200,' + a + ')';
        g.beginPath(); for (var i = 0; i < 8; i++) { var ang = i * Math.PI / 4, rr = i % 2 ? 3 : 12; g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } g.closePath(); g.fill(); g.restore();
      }
      shells.forEach(function (s) {
        if (!s.found) return;
        g.strokeStyle = '#ffd34d'; g.lineWidth = 3; g.beginPath(); g.arc(s.x, s.y, 16, 0, 7); g.stroke();
      });
      pops = pops.filter(function (p) { return now - p.t < 700; });
      pops.forEach(function (p) {
        g.fillStyle = 'rgba(255,255,255,' + (1 - (now - p.t) / 700) + ')'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
        g.fillText(p.txt, p.x, p.y - 18 - (now - p.t) / 30); g.textAlign = 'left';
      });
      if (!over) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    ui.right.textContent = '탄피 0/3';
    countdown(ui, function () {
      started = true;
      timer(ui, TOTAL, null, function () { return !over; }, function () {
        if (over) return; over = true;
        finish(ui, 'bad', '못 찾았다…', '탄피 ' + found + '/3 · 전 중대 밤샘 수색', done);
      });
    });
  };

  /* ── 6. 선임 이름 외우기: 기억력 퀴즈 ── */
  GAMES.memory = function (o, done) {
    var ui = frame('선임 이름 외우기', '얼굴과 이름을 외워라! 5초 뒤에 시험 본다.');
    var face = o.face || function () { return ''; };
    var POOL = [
      { who: 'malnyeon', n: '김말년 병장' }, { who: 'fm', n: '최원칙 상병' }, { who: 'ppaen', n: '정뺀질 일병' },
      { who: 'clerk', n: '문서준 상병' }, { who: 'driver', n: '한운전 병장' }, { who: 'cook', n: '오짬밥 상병' }
    ];
    var people = shuffle(POOL.slice()).slice(0, 4);
    var score = 0, q = 0, quiz = shuffle(people.slice());
    countdown(ui, function () {
      ui.stage.insertAdjacentHTML('afterbegin', '<div class="memo-grid" id="memo-grid">' + people.map(function (p) {
        return '<div class="memo-face">' + face(p.who) + '<b>' + p.n + '</b></div>';
      }).join('') + '</div>');
      timer(ui, 5, null, null, function () {
        var gEl = root.querySelector('#memo-grid'); if (gEl) gEl.remove();
        ask();
      });
    });
    function ask() {
      if (q >= quiz.length) {
        var tier = score >= 4 ? 'great' : score >= 3 ? 'good' : 'bad';
        finish(ui, tier, tier === 'great' ? '올킬!' : tier === 'good' ? '거의 다 맞혔다' : '누구세요…?', score + '/4 정답', done);
        return;
      }
      var p = quiz[q];
      ui.left.textContent = '문제 ' + (q + 1) + '/4';
      ui.right.textContent = '정답 ' + score;
      ui.time.style.width = ((4 - q) / 4 * 100) + '%';
      var opts = shuffle(people.map(function (x) { return x.n; }));
      var old = root.querySelector('#memo-quiz'); if (old) old.remove();
      ui.stage.insertAdjacentHTML('afterbegin', '<div class="memo-quiz" id="memo-quiz"><div class="face">' + face(p.who) + '</div><div class="memo-opts">' +
        opts.map(function (n) { return '<button data-n="' + n + '">' + n + '</button>'; }).join('') + '</div></div>');
      var answered = false;
      root.querySelectorAll('.memo-opts button').forEach(function (bt) {
        on(bt, 'click', function () {
          if (answered) return; answered = true;
          var ok = bt.dataset.n === p.n;
          bt.classList.add(ok ? 'ok' : 'no');
          if (!ok) root.querySelectorAll('.memo-opts button').forEach(function (x) { if (x.dataset.n === p.n) x.classList.add('ok'); });
          if (ok) { score += 1; snd('coin'); } else snd('miss');
          q += 1;
          later(ask, 650);
        });
      });
    }
  };

  JY.Mini = {
    start: function (id, opts, done) {
      clearAll();
      var fn = GAMES[id] || GAMES.dressup;
      try { fn(opts || {}, done); }
      catch (e) { clearAll(); if (root) { root.hidden = true; root.innerHTML = ''; } done('good'); }
    },
    names: { dressup: '비상 소집', snow: '제설 작업', watch: '불침번', shoot: '사격', shell: '탄피 찾기', memory: '선임 이름 외우기' }
  };
})(window.JY = window.JY || {});
