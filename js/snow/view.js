/* 제설각 — 화면: 캔버스 그리기, 입력, 카메라, 효과 */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim, CELL = S.CELL, GW = S.GW, GH = S.GH;
  var K = 2;                       // 미리 그려 두는 층의 배율
  var MARGIN = 5;                  // 눈 덩어리가 칸 밖으로 삐져나오는 폭
  var CHUNK = 8;                   // 눈 다시 그리기 단위(칸)
  var VIS = [290, 310, 330, 360, 390, 430, 490, 560, 640]; // 도구 단계별로 보이는 세계 너비

  var cv, ctx, dpr = 1, vw = 0, vh = 0, zoom = 1.3, zoomT = 1.3, camX = 0, camY = 0, shake = 0;
  var ground = null, snowL = null, snowX = null, bImgs = {}, treeImg = null;
  var world = null, mode = 'idle', hooks = {}, raf = 0, last = 0, doneSent = false;
  var keys = {}, stick = null, moveTo = null, autopilot = false, bot = { idx: -1, t: 0 };
  var parts = [], floats = [], flakes = [], bubbles = [], dirtyChunks = new Set();
  var gainAcc = 0, gainT = 0, scrapeT = 0, crewScrapeT = 0;
  var FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  var focusT = null;
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
  function layer(w, h) { var c = document.createElement('canvas'); c.width = Math.ceil(w * K); c.height = Math.ceil(h * K); var x = c.getContext('2d'); x.scale(K, K); return [c, x]; }

  /* ── 땅 (한 번만 그린다) ── */
  function buildGround() {
    var L = layer(S.W, S.H), g = L[1], i, x, y;
    ground = L[0];
    g.fillStyle = '#e4ebf2'; g.fillRect(0, 0, S.W, S.H);
    for (i = 0; i < 900; i++) {
      x = hash(i, 1) * S.W; y = hash(i, 2) * S.H;
      g.fillStyle = hash(i, 3) < 0.5 ? 'rgba(255,255,255,.55)' : 'rgba(176,196,216,.16)';
      ell(g, x, y, 6 + hash(i, 4) * 26, 3 + hash(i, 5) * 9); g.fill();
    }
    g.strokeStyle = 'rgba(78,98,66,.45)'; g.lineWidth = 1;
    for (i = 0; i < 260; i++) {
      x = hash(i, 7) * S.W; y = hash(i, 8) * S.H;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1.5, y - 3); g.moveTo(x + 1.5, y); g.lineTo(x + 2.5, y - 3.5); g.stroke();
    }
    S.ZONES.forEach(function (Z) { zoneGround(g, Z); });
    // 연석
    S.ZONES.forEach(function (Z) {
      g.strokeStyle = 'rgba(150,160,170,.9)'; g.lineWidth = 3; g.strokeRect(Z.x - 1.5, Z.y - 1.5, Z.w + 3, Z.h + 3);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.strokeRect(Z.x - 3.5, Z.y - 3.5, Z.w + 7, Z.h + 7);
    });
    // 건물·나무 그림자
    g.fillStyle = 'rgba(70,95,125,.16)';
    S.BUILDINGS.forEach(function (b) { rr(g, b.x + 6, b.y + 8, b.w, b.h, 6); g.fill(); });
    S.TREES.forEach(function (t) { ell(g, t[0] + 6, t[1] + 2, 15, 6); g.fill(); });
  }

  function noiseFill(g, Z, base, n, dark, light) {
    g.fillStyle = base; g.fillRect(Z.x, Z.y, Z.w, Z.h);
    for (var i = 0; i < n; i++) {
      var x = Z.x + hash(i, Z.x + 11) * Z.w, y = Z.y + hash(i, Z.y + 13) * Z.h;
      g.fillStyle = hash(i, 17) < 0.5 ? dark : light;
      g.fillRect(x, y, 1 + hash(i, 19) * 2, 1 + hash(i, 23) * 2);
    }
  }

  function zoneGround(g, Z) {
    g.save(); g.beginPath(); g.rect(Z.x, Z.y, Z.w, Z.h); g.clip();
    var i, x, y;
    if (Z.ground === 'walk') {
      g.fillStyle = '#a49b8b'; g.fillRect(Z.x, Z.y, Z.w, Z.h);
      for (y = Z.y, i = 0; y < Z.y + Z.h; y += 10, i++) {
        for (x = Z.x - (i % 2) * 10; x < Z.x + Z.w; x += 20) {
          var t = hash(x, y) * 18 - 9;
          g.fillStyle = 'rgb(' + (164 + t | 0) + ',' + (155 + t | 0) + ',' + (139 + t | 0) + ')';
          g.fillRect(x + 0.6, y + 0.6, 18.8, 8.8);
        }
      }
      g.fillStyle = 'rgba(120,110,95,.35)';
      for (i = 0; i < 40; i++) { ell(g, Z.x + hash(i, 91) * Z.w, Z.y + hash(i, 92) * Z.h, 6, 3); g.fill(); }
    } else if (Z.ground === 'parade') {
      noiseFill(g, Z, '#a08766', 2600, 'rgba(90,70,50,.35)', 'rgba(200,180,150,.35)');
      g.strokeStyle = 'rgba(255,255,255,.82)'; g.lineWidth = 2.5;
      g.strokeRect(Z.x + 14, Z.y + 14, Z.w - 28, Z.h - 28);
      g.beginPath(); g.moveTo(Z.x + Z.w / 2, Z.y + 14); g.lineTo(Z.x + Z.w / 2, Z.y + Z.h - 14); g.stroke();
      for (x = Z.x + 60; x < Z.x + Z.w - 40; x += 60) for (y = Z.y + 50; y < Z.y + Z.h - 30; y += 50) {
        g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '700 64px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('충 성', Z.x + Z.w / 2, Z.y + Z.h / 2);
    } else if (Z.ground === 'road' || Z.ground === 'gate') {
      noiseFill(g, Z, '#4c5056', 3000, 'rgba(25,28,32,.45)', 'rgba(130,135,140,.35)');
      g.fillStyle = 'rgba(240,240,235,.85)';
      if (Z.ground === 'road') {
        g.fillRect(Z.x + 8, Z.y, 3, Z.h); g.fillRect(Z.x + Z.w - 11, Z.y, 3, Z.h);
        g.fillStyle = '#e2b33c';
        for (y = Z.y + 6; y < Z.y + Z.h; y += 34) { g.fillRect(Z.x + Z.w / 2 - 4, y, 3, 20); g.fillRect(Z.x + Z.w / 2 + 1, y, 3, 20); }
        g.fillStyle = 'rgba(240,240,235,.85)'; g.font = '700 30px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('서행', Z.x + Z.w / 4 + 6, Z.y + Z.h - 70); g.fillText('서행', Z.x + Z.w * 3 / 4 - 6, Z.y + 80);
      } else {
        for (x = Z.x + 130; x < Z.x + 270; x += 18) g.fillRect(x, Z.y + 20, 10, Z.h - 40);
        g.fillRect(Z.x + 20, Z.y + Z.h - 18, Z.w - 40, 4);
        g.font = '700 26px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('정지', Z.x + 330, Z.y + Z.h / 2); g.fillText('일단', Z.x + 70, Z.y + Z.h / 2);
      }
    } else if (Z.ground === 'court') {
      noiseFill(g, Z, '#4f8f5e', 900, 'rgba(30,70,40,.35)', 'rgba(140,200,150,.3)');
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(Z.x + 12, Z.y + 12, Z.w - 24, Z.h - 24);
      g.beginPath(); g.moveTo(Z.x + Z.w / 2, Z.y + 12); g.lineTo(Z.x + Z.w / 2, Z.y + Z.h - 12); g.stroke();
    } else if (Z.ground === 'yard' || Z.ground === 'tank') {
      noiseFill(g, Z, Z.ground === 'yard' ? '#a6a8a1' : '#9a9d95', 1400, 'rgba(70,72,66,.35)', 'rgba(215,215,205,.3)');
      if (Z.ground === 'tank') { g.strokeStyle = '#e2b33c'; g.lineWidth = 3; (S.TANKS || []).forEach(function (t) { g.strokeRect(t.x - 10, t.y - 10, t.w + 20, t.h + 20); }); }
    } else if (Z.ground === 'pad') {
      noiseFill(g, Z, '#a3a69f', 1600, 'rgba(80,85,80,.3)', 'rgba(220,222,215,.35)');
      g.strokeStyle = 'rgba(70,72,70,.35)'; g.lineWidth = 1;
      for (x = Z.x; x < Z.x + Z.w; x += 40) { g.beginPath(); g.moveTo(x, Z.y); g.lineTo(x, Z.y + Z.h); g.stroke(); }
      for (y = Z.y; y < Z.y + Z.h; y += 40) { g.beginPath(); g.moveTo(Z.x, y); g.lineTo(Z.x + Z.w, y); g.stroke(); }
      g.strokeStyle = '#e2b33c'; g.lineWidth = 7; circ(g, Z.x + Z.w / 2, Z.y + Z.h / 2, 66); g.stroke();
      g.fillStyle = '#f2f2ee'; g.font = '700 84px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('H', Z.x + Z.w / 2, Z.y + Z.h / 2 + 4);
    }
    g.restore();
  }

  /* ── 건물·나무 ── */
  function buildProps() {
    S.BUILDINGS.forEach(function (b) {
      var L = layer(b.w, b.h + 6), c = L[1], rh = b.h - b.wall, i;
      // 앞벽
      c.fillStyle = '#d8d0bf'; c.fillRect(0, rh, b.w, b.wall);
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, b.h - 4, b.w, 4);
      var n = Math.max(1, Math.floor(b.w / 46));
      for (i = 0; i < n; i++) {
        var wx = (i + 0.5) * b.w / n - 9;
        if (b.door && i === Math.floor(n / 2)) continue;
        c.fillStyle = '#ffffff'; c.fillRect(wx - 1.5, rh + 5, 21, b.wall - 11);
        c.fillStyle = b.id === 'barracks' ? '#f6d27a' : '#7d95ad'; c.fillRect(wx, rh + 6.5, 18, b.wall - 14);
        c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(wx + 8.5, rh + 6.5, 1, b.wall - 14);
      }
      if (b.door) {
        var dx = b.w / 2 - 10;
        c.fillStyle = '#4f5d3c'; c.fillRect(dx, rh + 4, 20, b.wall - 4);
        c.fillStyle = '#ffd36a'; circ(c, dx + 15, rh + b.wall / 2 + 2, 1.4); c.fill();
      }
      // 지붕 + 눈
      c.fillStyle = b.roof; rr(c, 0, 0, b.w, rh + 3, 4); c.fill();
      c.fillStyle = '#f7fafd'; rr(c, 2, 1, b.w - 4, rh - 3, 6); c.fill();
      c.fillStyle = 'rgba(160,185,210,.45)'; c.fillRect(4, rh - 5, b.w - 8, 3);
      c.fillStyle = 'rgba(255,255,255,.9)';
      for (i = 0; i < 14; i++) { ell(c, 10 + hash(i, b.x) * (b.w - 20), 6 + hash(i, b.y) * (rh - 14), 8 + hash(i, 3) * 14, 3); c.fill(); }
      // 고드름
      c.fillStyle = 'rgba(210,232,250,.95)';
      for (i = 6; i < b.w - 6; i += 9 + (hash(i, b.w) * 8 | 0)) { c.beginPath(); c.moveTo(i, rh); c.lineTo(i + 3, rh); c.lineTo(i + 1.5, rh + 4 + hash(i, 5) * 6); c.fill(); }
      // 간판
      c.font = '700 ' + (b.id === 'barracks' ? 13 : 10) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      var tw = c.measureText(b.name).width + 12;
      c.fillStyle = '#2f3a25'; rr(c, b.w / 2 - tw / 2, rh - 16, tw, 14, 3); c.fill();
      c.fillStyle = '#f2ecd8'; c.fillText(b.name, b.w / 2, rh - 8.5);
      bImgs[b.id] = L[0];
    });
    var T = layer(36, 50), t = T[1];
    t.fillStyle = '#6b4a32'; t.fillRect(16, 40, 4, 9);
    [[18, 24, 40], [13, 19, 28], [8, 14, 17]].forEach(function (lv, k) {
      var y = lv[2] + 6, hw = lv[1];
      t.fillStyle = '#2d4a35'; t.beginPath(); t.moveTo(18, y - 16); t.lineTo(18 + hw, y + 6); t.lineTo(18 - hw, y + 6); t.closePath(); t.fill();
      t.fillStyle = '#f5f9fc'; t.beginPath(); t.moveTo(18, y - 16); t.lineTo(18 + hw * 0.62, y - 1); t.quadraticCurveTo(18, y + 3 - k, 18 - hw * 0.62, y - 1); t.closePath(); t.fill();
    });
    treeImg = T[0];
  }

  /* ── 눈 층 ── */
  var BLOB = [null,
    { r: 0, c: 'rgba(238,244,250,.6)', s: 0 },
    { r: 7.6, c: '#e9eff6', s: 0.24 },
    { r: 8.2, c: '#f1f5f9', s: 0.3 },
    { r: 8.9, c: '#f9fbfd', s: 0.32 }];
  var snowTex = null;
  function buildSnowTex() {
    var L = layer(S.W, S.H), t = L[1], i;
    for (i = 0; i < 420; i++) { t.fillStyle = 'rgba(150,176,204,.07)'; ell(t, hash(i, 31) * S.W, hash(i, 32) * S.H, 14 + hash(i, 33) * 40, 6 + hash(i, 34) * 14); t.fill(); }
    for (i = 0; i < 5200; i++) { t.fillStyle = hash(i, 35) < 0.6 ? 'rgba(255,255,255,.95)' : 'rgba(120,145,175,.16)'; t.fillRect(hash(i, 36) * S.W, hash(i, 37) * S.H, 0.8, 0.8); }
    snowTex = L[0];
  }

  function redrawCells(gx0, gy0, gx1, gy1) {
    var x0 = gx0 * CELL - MARGIN, y0 = gy0 * CELL - MARGIN, x1 = (gx1 + 1) * CELL + MARGIN, y1 = (gy1 + 1) * CELL + MARGIN;
    var c = snowX, D = world.depth, Zm = world.zone, pass, gx, gy;
    c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.clearRect(x0, y0, x1 - x0, y1 - y0);
    var ax = Math.max(0, gx0 - 1), bx = Math.min(GW - 1, gx1 + 1), ay = Math.max(0, gy0 - 1), by = Math.min(GH - 1, gy1 + 1);
    for (pass = 0; pass < 2; pass++) {
      for (gy = ay; gy <= by; gy++) {
        for (gx = ax; gx <= bx; gx++) {
          var idx = gy * GW + gx, d = D[idx];
          if (!d || Zm[idx] < 0) continue;
          var B = BLOB[d];
          if (d === 1) { if (pass === 1) { c.fillStyle = B.c; rr(c, gx * CELL - 0.4, gy * CELL - 0.4, 10.8, 10.8, 2.5); c.fill(); } continue; }
          var jx = (hash(gx, gy) - 0.5) * 2.4, jy = (hash(gy, gx) - 0.5) * 2.4, r = B.r + (hash(gx + 7, gy) - 0.5) * 1.2;
          var cx = gx * CELL + 5 + jx, cy = gy * CELL + 5 + jy;
          if (pass === 0) { c.fillStyle = 'rgba(105,132,165,' + B.s + ')'; circ(c, cx + 1, cy + 2.4, r + 0.3); c.fill(); }
          else if (pass === 1) { c.fillStyle = B.c; circ(c, cx, cy, r); c.fill(); }
        }
      }
    }
    if (snowTex) { c.globalCompositeOperation = 'source-atop'; c.drawImage(snowTex, x0 * K, y0 * K, (x1 - x0) * K, (y1 - y0) * K, x0, y0, x1 - x0, y1 - y0); c.globalCompositeOperation = 'source-over'; }
    c.restore();
  }

  function buildSnow() {
    var L = layer(S.W, S.H); snowL = L[0]; snowX = L[1];
    for (var cy = 0; cy < GH; cy += CHUNK) for (var cx = 0; cx < GW; cx += CHUNK) redrawCells(cx, cy, Math.min(GW - 1, cx + CHUNK - 1), Math.min(GH - 1, cy + CHUNK - 1));
    dirtyChunks.clear();
  }

  function markDirty() {
    var d = world.dirty;
    for (var i = 0; i < d.length; i++) { var idx = d[i]; dirtyChunks.add(((((idx / GW) | 0) / CHUNK) | 0) * 1000 + (((idx % GW) / CHUNK) | 0)); }
    d.length = 0;
  }
  function flushDirty(max) {
    var n = 0;
    dirtyChunks.forEach(function (k) {
      if (n >= max) return;
      var cy = Math.floor(k / 1000) * CHUNK, cx = (k % 1000) * CHUNK;
      redrawCells(cx, cy, Math.min(GW - 1, cx + CHUNK - 1), Math.min(GH - 1, cy + CHUNK - 1));
      dirtyChunks.delete(k); n++;
    });
  }

  /* ── 사람·도구·차량 ── */
  var SKIN = ['#f1c7a1', '#e8b78f', '#f4cfae', '#dca983'];
  function drawTool(c, x, y, a, kind, r, swing) {
    var sw = Math.sin(swing * Math.PI) * 0.35;
    c.save(); c.translate(x, y - 10); c.rotate(a + sw);
    var L = 8 + Math.min(r, 30) * 0.55;
    c.strokeStyle = '#8a6a44'; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(2, 0); c.lineTo(L, 0); c.stroke();
    if (kind === 'broom') {
      c.strokeStyle = '#c9a66b'; c.lineWidth = 1.2;
      for (var i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(L - 1, 0); c.lineTo(L + 7, i * 1.6); c.stroke(); }
    } else if (kind === 'shovel') {
      c.fillStyle = '#8f979c'; c.beginPath(); c.moveTo(L, -4); c.lineTo(L + 8, -3); c.quadraticCurveTo(L + 12, 0, L + 8, 3); c.lineTo(L, 4); c.closePath(); c.fill();
    } else {
      var bw = Math.min(30, 8 + r * 0.9);
      c.fillStyle = '#e7ae2f'; rr(c, L - 1, -bw / 2, 4.5, bw, 1.5); c.fill();
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(L + 2.5, -bw / 2, 1, bw);
      if (kind === 'twin') { c.rotate(0.55); c.strokeStyle = '#8a6a44'; c.beginPath(); c.moveTo(2, 0); c.lineTo(L, 0); c.stroke(); c.fillStyle = '#e7ae2f'; rr(c, L - 1, -bw / 2, 4.5, bw, 1.5); c.fill(); }
    }
    c.restore();
  }

  function drawHat(c, x, y, hat, fx) {
    if (hat === 'helmet') {
      c.fillStyle = '#4e5a33'; circ(c, x, y - 1.5, 7.4); c.fill();
      c.fillStyle = '#3f4a28'; ell(c, x, y + 1.5, 8.2, 2.6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; circ(c, x - 2.4, y - 4, 2.2); c.fill();
    } else if (hat === 'cap') {
      c.fillStyle = '#4a5530'; c.beginPath(); c.arc(x, y - 1, 6.6, Math.PI, 0); c.fill();
      c.fillRect(x - 6.6, y - 1.5, 13.2, 2.5);
      c.fillStyle = '#3c4626'; ell(c, x + fx * 3, y + 1.8, 6, 1.8); c.fill();
    } else if (hat === 'chef') {
      c.fillStyle = '#ffffff'; rr(c, x - 6, y - 12, 12, 11, 4); c.fill(); circ(c, x - 3.5, y - 12, 3.5); c.fill(); circ(c, x + 3.5, y - 12, 3.5); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 0.8; c.strokeRect(x - 6, y - 3, 12, 2);
    } else if (hat === 'reserve') {
      c.fillStyle = '#6a6c4c'; c.beginPath(); c.arc(x, y - 1, 6.6, Math.PI, 0); c.fill(); c.fillRect(x - 6.6, y - 1.5, 13.2, 2);
      c.fillStyle = '#c9a43a'; c.fillRect(x - 1.5, y - 5, 3, 2.2);
    } else { // 방한모
      c.fillStyle = '#39422c'; c.beginPath(); c.arc(x, y - 0.5, 6.8, Math.PI * 1.02, -0.02); c.fill();
      rr(c, x - 7.4, y - 1, 3.2, 7, 1.6); c.fill(); rr(c, x + 4.2, y - 1, 3.2, 7, 1.6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x - 6, y - 3, 12, 1.2);
    }
  }

  function drawPerson(c, e, o) {
    var x = e.x, y = e.y, fx = e.dir.x, fy = e.dir.y, mv = e.moving, w = e.walk || 0;
    var bob = mv ? Math.abs(Math.sin(w * 2)) * -1.2 : 0, a = Math.atan2(fy, fx), seed = o.seed || 0;
    c.fillStyle = 'rgba(46,68,96,.24)'; ell(c, x, y + 1, 8.5, 3.6); c.fill();
    if (o.me) { c.strokeStyle = 'rgba(255,214,74,' + (0.55 + Math.sin(performance.now() / 200) * 0.25) + ')'; c.lineWidth = 1.6; ell(c, x, y + 1, 11, 5); c.stroke(); }
    if (o.salt) { c.fillStyle = '#3c6f9c'; rr(c, x - 6, y - 19, 12, 10, 3); c.fill(); }
    var toolBack = fy < -0.2 && o.tool;
    if (toolBack) drawTool(c, x, y, a, o.tool, o.r, e.swing || 0);
    var lp = mv ? Math.sin(w * 2) * 2.2 : 0;
    c.fillStyle = '#272b20'; rr(c, x - 5, y - 6 + lp * 0.5, 4, 6.5, 1.6); c.fill(); rr(c, x + 1, y - 6 - lp * 0.5, 4, 6.5, 1.6); c.fill();
    c.fillStyle = o.coat; rr(c, x - 7, y - 17 + bob, 14, 13, 4.5); c.fill();
    if (o.coat !== '#e9e6dc') {
      c.fillStyle = 'rgba(30,40,20,.35)';
      for (var i = 0; i < 4; i++) { ell(c, x - 4.5 + hash(seed, i) * 9, y - 14.5 + bob + hash(i, seed) * 8, 2.2, 1.4); c.fill(); }
      c.fillStyle = 'rgba(150,140,90,.35)'; ell(c, x + 2 - hash(seed, 9) * 5, y - 10 + bob, 2, 1.2); c.fill();
    } else { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x - 7, y - 11 + bob, 14, 1); }
    if (o.band) { c.fillStyle = '#f4c53d'; c.fillRect(x - 7, y - 14 + bob, 3, 4); }
    var hx = x + fx * 0.8, hy = y - 21 + bob;
    c.fillStyle = SKIN[seed % SKIN.length]; circ(c, hx, hy, 6.2); c.fill();
    if (fy > -0.35) {
      if (e.asleep) { c.strokeStyle = '#2a2a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx - 3.4 + fx * 2, hy + 1); c.lineTo(hx - 1.2 + fx * 2, hy + 1); c.moveTo(hx + 1.2 + fx * 2, hy + 1); c.lineTo(hx + 3.4 + fx * 2, hy + 1); c.stroke(); }
      else { c.fillStyle = '#1e1e1e'; circ(c, hx - 2.3 + fx * 2, hy + 0.8, 1.05); c.fill(); circ(c, hx + 2.3 + fx * 2, hy + 0.8, 1.05); c.fill(); }
      c.fillStyle = 'rgba(240,120,120,.45)'; circ(c, hx - 3.8 + fx * 2, hy + 2.6, 1.3); c.fill(); circ(c, hx + 3.8 + fx * 2, hy + 2.6, 1.3); c.fill();
      if (e.swing > 0.5) { c.fillStyle = '#7a3b2e'; circ(c, hx + fx * 2, hy + 3.4, 0.9); c.fill(); }
    }
    drawHat(c, hx, hy - 2, o.hat, fx);
    if (!toolBack && o.tool) drawTool(c, x, y, a, o.tool, o.r, e.swing || 0);
  }

  function drawVehicle(c, e, o) {
    var x = e.x, y = e.y, a = Math.atan2(e.dir.y, e.dir.x), s = o.scale || 1;
    c.fillStyle = 'rgba(46,68,96,.26)'; ell(c, x, y + 2, 20 * s, 9 * s); c.fill();
    c.save(); c.translate(x, y - 8 * s); c.rotate(a);
    if (o.kind === 'heli') {
      c.fillStyle = 'rgba(255,255,255,.25)'; circ(c, 0, 0, o.r * 0.9); c.fill();
      c.fillStyle = '#4c5a35'; ell(c, 0, 0, 16, 9); c.fill(); c.fillRect(-34, -2, 22, 4); c.fillRect(-36, -7, 3, 14);
      c.fillStyle = '#8fb4cc'; ell(c, 8, 0, 6, 6); c.fill();
      c.strokeStyle = 'rgba(40,45,40,.55)'; c.lineWidth = 3; var ra = performance.now() / 40;
      c.beginPath(); c.moveTo(Math.cos(ra) * 30, Math.sin(ra) * 30); c.lineTo(-Math.cos(ra) * 30, -Math.sin(ra) * 30); c.stroke();
      c.beginPath(); c.moveTo(Math.cos(ra + 1.57) * 30, Math.sin(ra + 1.57) * 30); c.lineTo(-Math.cos(ra + 1.57) * 30, -Math.sin(ra + 1.57) * 30); c.stroke();
    } else {
      var L = (o.kind === 'truck' ? 30 : o.kind === 'plow' ? 22 : 24) * s, Wd = (o.kind === 'truck' ? 18 : 14) * s;
      var body = o.kind === 'plow' ? '#d99a1f' : o.kind === 'truck' ? '#55603a' : '#3f7a3c';
      c.fillStyle = '#1f1f1f';
      [[-L * 0.35, -Wd / 2 - 2], [-L * 0.35, Wd / 2 - 1], [L * 0.25, -Wd / 2 - 2], [L * 0.25, Wd / 2 - 1]].forEach(function (p) { rr(c, p[0] - 4, p[1], 8, 3.2, 1); c.fill(); });
      c.fillStyle = body; rr(c, -L / 2, -Wd / 2, L, Wd, 3); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-L / 2 + 2, -Wd / 2 + 1.5, L - 4, 2);
      c.fillStyle = '#9cc3dc'; rr(c, L * 0.08, -Wd / 2 + 2.5, L * 0.22, Wd - 5, 2); c.fill();
      c.fillStyle = '#f1c7a1'; circ(c, -L * 0.02, 0, 3.2); c.fill();
      var bw = Math.min(o.r * 1.6, 70);
      c.fillStyle = '#f0b429'; rr(c, L / 2 + 2, -bw / 2, 5, bw, 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(L / 2 + 5.5, -bw / 2, 1.2, bw);
      if (o.kind !== 'tractor') { c.fillStyle = (performance.now() / 250 | 0) % 2 ? '#ff8a2a' : '#ffd36a'; circ(c, -L * 0.1, 0, 2); c.fill(); }
    }
    c.restore();
  }

  function toolKind(T) { return T.id === 'broom' ? 'broom' : T.id === 'twin' ? 'twin' : 'pusher'; }
  function drawPlayer(c, P) {
    var T = G.toolOf(world.save);
    if (T.vehicle) { drawVehicle(c, P, { kind: T.id, r: T.r, scale: T.id === 'truck' ? 1.25 : 1 }); return; }
    if (T.id === 'cart') {
      drawPerson(c, P, { me: true, coat: '#5b6a3a', hat: 'beanie', seed: 3, band: true });
      c.save(); c.translate(P.x + P.dir.x * 14, P.y - 6 + P.dir.y * 14); c.rotate(Math.atan2(P.dir.y, P.dir.x));
      c.fillStyle = '#5d6f86'; rr(c, -6, -9, 12, 18, 3); c.fill(); c.fillStyle = '#f0b429'; rr(c, 6, -15, 4, 30, 2); c.fill();
      c.fillStyle = '#222'; rr(c, -5, -11, 6, 3, 1); c.fill(); rr(c, -5, 8, 6, 3, 1); c.fill();
      c.restore(); return;
    }
    drawPerson(c, P, { me: true, coat: '#5b6a3a', hat: 'beanie', seed: 3, band: true, tool: T.aura ? null : toolKind(T), r: T.r, salt: T.id === 'salt' });
  }
  function drawCrew(c, e) {
    var C = e.def;
    if (C.vehicle) { drawVehicle(c, e, { kind: 'plow', r: e.r }); return; }
    drawPerson(c, e, { coat: C.coat, hat: C.hat, seed: e.seed, tool: C.id === 'cook' ? 'shovel' : C.id === 'hoobae' ? 'broom' : 'pusher', r: e.r });
  }
  function drawHaeng(c, H) {
    drawPerson(c, H, { coat: '#4b5733', hat: 'cap', seed: 1, tool: 'shovel', r: 10 });
    c.fillStyle = '#c0392b'; c.font = '700 8px ' + FONT; c.textAlign = 'center'; c.fillText('행보관', H.x, H.y - 33);
  }

  /* ── 효과 ── */
  function onFx() {
    var fx = world.fx, P = world.player;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      if (f.t === 'clear') {
        var mine = f.src === 'player', r = mine ? P.r : 10, n = Math.min(mine ? 7 : 2, 1 + (f.n / 3 | 0));
        for (var k = 0; k < n && parts.length < 420; k++) {
          var ang = Math.random() * Math.PI * 2, sp = rnd(18, 60);
          parts.push({ x: f.x + Math.cos(ang) * r * 0.6, y: f.y + Math.sin(ang) * r * 0.6, z: rnd(2, 6), vx: Math.cos(ang) * sp + (mine ? P.dir.x * 25 : 0), vy: Math.sin(ang) * sp * 0.6 + (mine ? P.dir.y * 25 : 0), vz: rnd(30, 70), life: rnd(0.45, 0.8), t: 0, s: rnd(1.2, 2.6), salt: mine && P.aura });
        }
        if (mine) {
          if (scrapeT <= 0 && JY.SnowSfx) { JY.SnowSfx.scrape(Math.min(1, f.n / 6)); scrapeT = 0.085; }
        } else if (crewScrapeT <= 0 && JY.SnowSfx) { JY.SnowSfx.scrape(0.25); crewScrapeT = 0.22; }
      } else if (f.t === 'zzz') {
        floats.push({ x: f.e.x + 6, y: f.e.y - 30, text: 'Zzz', t: 0, life: 2.2, color: '#5a6fa0', size: 9, follow: f.e });
      } else if (f.t === 'wake') {
        floats.push({ x: f.e.x, y: f.e.y - 34, text: '!!', t: 0, life: 1, color: '#d33', size: 12 });
        shake = Math.max(shake, 2);
      } else if (f.t === 'chat') {
        if (bubbles.length < 3) { var L = f.e.def.lines; bubbles.push({ e: f.e, text: L[(Math.random() * L.length) | 0], t: 0, life: 2.6 }); }
      } else if (f.t === 'say') {
        if (hooks.say && mode === 'play') hooks.say(f.key);
      } else if (f.t === 'part') {
        floats.push({ x: f.x, y: f.y, text: f.name + ' 완료! 띵!', t: 0, life: 2, color: '#ffd84a', size: 12 });
        if (JY.SnowSfx && mode === 'play') JY.SnowSfx.ding();
      } else if (f.t === 'deer') {
        floats.push({ x: 0, y: 0, text: '꾸에에엑!!', t: 0, life: 1.6, color: '#ff6a55', size: 11, follow: f.e });
        if (JY.SnowSfx && mode === 'play') JY.SnowSfx.deer();
      } else if (f.t === 'deerHit') {
        floats.push({ x: f.x, y: f.y - 30, text: '의무병!!', t: 0, life: 1.6, color: '#ff6a55', size: 11 }); shake = Math.max(shake, 2);
      } else if (f.t === 'meHit') {
        if (f.lose) floats.push({ x: f.x, y: f.y - 36, text: '-' + f.lose, t: 0, life: 1.4, color: '#ff6a55', size: 12, pie: true });
        shake = Math.max(shake, 4);
      }
      if (f.t === 'dump' && (f.src === 'player' || Math.random() < 0.3)) { floats.push({ x: f.x, y: f.y - 30, text: '+' + Math.floor(f.pay), t: 0, life: 1.2, color: '#ffd84a', size: 13, pie: true }); if (JY.SnowSfx && f.src === 'player' && mode === 'play') { JY.SnowSfx.pour(1); JY.SnowSfx.coin(); } }
      if (f.t === 'full') floats.push({ x: 0, y: 0, text: '가득!', t: 0, life: 1.4, color: '#ff6a55', size: 12, follow: world.player });
      if (f.t === 'inspect') floats.push({ x: f.x, y: f.y, text: '검열 통과! +' + Math.floor(f.bonus), t: 0, life: 2.4, color: '#ffd84a', size: 14 });
      if (f.t === 'bubble' && f.e && bubbles.length < 5) bubbles.push({ e: f.e, text: f.text, t: 0, life: 2.8 });
      if ((f.t === 'splat' || f.t === 'smash') && parts.length < 420) for (var q = 0; q < 8; q++) parts.push({ x: f.x, y: f.y, z: rnd(2, 8), vx: rnd(-40, 40), vy: rnd(-30, 30), vz: rnd(20, 60), life: rnd(0.3, 0.6), t: 0, s: rnd(1, 2.2) });
      if (hooks.event && mode === 'play' && /^(deer|meHit|snowball|car|heli|part|full|inspect|day|dump|me|heat|buff|buffEnd|mission|gift|sleep|ride|caught|gong|dia|found|combo|comboEnd|zonePerfect|allClear|locked|ach|officer|slack|recruit|assigned|req|hand|quest|call|vend|pullup|goal|warm|task|taskLate|opReady|opEnd|icy|salted|slip|carStuck|carFree|carPass|push|roofWarn|jigeok|nag|prep|toolGet|bonus|help|fever|surge|support|surprise)$/.test(f.t) && (f.t !== 'dump' || f.src === 'player')) hooks.event(f);
    }
    fx.length = 0;
  }

  function stepFx(dt) {
    scrapeT -= dt; crewScrapeT -= dt; gainT -= dt;
    if (gainAcc >= 1 && gainT <= 0 && world) {
      var P = world.player;
      floats.push({ x: P.x + rnd(-6, 6), y: P.y - 34, text: '+' + Math.floor(gainAcc), t: 0, life: 0.9, color: '#ffd84a', size: 11, pie: true });
      gainAcc -= Math.floor(gainAcc); gainT = 0.32;
      if (JY.SnowSfx) JY.SnowSfx.tick();
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.t += dt;
      if (p.t > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 220 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.2; p.vx *= 0.6; p.vy *= 0.6; }
    }
    for (i = floats.length - 1; i >= 0; i--) { var fl = floats[i]; fl.t += dt; if (fl.t > fl.life) floats.splice(i, 1); }
    for (i = bubbles.length - 1; i >= 0; i--) { var b = bubbles[i]; b.t += dt; if (b.t > b.life) bubbles.splice(i, 1); }
    shake = Math.max(0, shake - dt * 10);
  }

  function setFlakes() {
    var n = world ? world.wx.flakes : 60;
    n = Math.round(n * Math.min(1.6, (vw * vh) / (390 * 844)));
    while (flakes.length < n) flakes.push({ x: Math.random() * vw, y: Math.random() * vh, z: Math.random(), ph: Math.random() * 6 });
    flakes.length = n;
  }

  /* ── 카메라·그리기 ── */
  function resize() {
    vw = cv.clientWidth; vh = cv.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(2.6e6 / Math.max(1, vw * vh)));
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    zoomFor(true); setFlakes();
  }
  function zoomFor(snap) {
    var vis = VIS[world ? world.save.tool : 0];
    zoomT = Math.min(vw / vis, vh / (vis * 1.5));
    if (snap) zoom = zoomT;
  }
  function camera(dt, snap) {
    if (!world) return;
    var P = world.player, ww = vw / zoom, wh = vh / zoom;
    var tx = ww >= S.W ? (S.W - ww) / 2 : Math.max(0, Math.min(S.W - ww, P.x - ww / 2));
    var ty = wh >= S.H ? (S.H - wh) / 2 : Math.max(0, Math.min(S.H - wh, P.y - wh * 0.48));
    var k = snap ? 1 : Math.min(1, dt * 6);
    camX += (tx - camX) * k; camY += (ty - camY) * k;
    zoom += (zoomT - zoom) * Math.min(1, dt * 2);
  }

  function render() {
    var c = ctx, now = performance.now();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#cfdbe6'; c.fillRect(0, 0, cv.width, cv.height);
    if (!world || !ground) return;
    var sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) : 0;
    var z = zoom * dpr;
    c.setTransform(z, 0, 0, z, (-camX + sx) * z, (-camY + sy) * z);
    var ww = vw / zoom, wh = vh / zoom;
    var x0 = Math.max(0, camX - 20), y0 = Math.max(0, camY - 20), x1 = Math.min(S.W, camX + ww + 20), y1 = Math.min(S.H, camY + wh + 20);
    if (x1 > x0 && y1 > y0) {
      c.imageSmoothingEnabled = true;
      c.drawImage(ground, x0 * K, y0 * K, (x1 - x0) * K, (y1 - y0) * K, x0, y0, x1 - x0, y1 - y0);
      c.drawImage(snowL, x0 * K, y0 * K, (x1 - x0) * K, (y1 - y0) * K, x0, y0, x1 - x0, y1 - y0);
    }
    // 잠긴 구역
    S.ZONES.forEach(function (Z, zi) {
      if (world.zoneOpen[zi]) return;
      var ww = vw / zoom, wh = vh / zoom;
      c.save(); c.lineWidth = 4; c.setLineDash([10, 10]); c.strokeStyle = '#2b2b2b'; c.strokeRect(Z.x + 2, Z.y + 2, Z.w - 4, Z.h - 4);
      c.lineDashOffset = 10; c.strokeStyle = '#f2c230'; c.strokeRect(Z.x + 2, Z.y + 2, Z.w - 4, Z.h - 4); c.restore();
      var a = Z.name + '  ', b = '★' + (Z.need || 0);
      c.font = '700 13px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'middle';
      var wa = c.measureText(a).width, wb = c.measureText(b).width, tw = wa + 14 + wb + 24;
      var vx0 = Math.max(Z.x, camX), vx1 = Math.min(Z.x + Z.w, camX + ww), vy0 = Math.max(Z.y, camY + 90 / zoom), vy1 = Math.min(Z.y + Z.h, camY + wh);
      if (vx1 - vx0 < tw + 10 || vy1 - vy0 < 40) return;
      var lx = Math.max(vx0 + tw / 2 + 8, Math.min(vx1 - tw / 2 - 8, Z.x + Z.w / 2)), ly = Math.max(vy0 + 24, Math.min(vy1 - 24, Z.y + Z.h / 2));
      c.fillStyle = 'rgba(30,40,30,.8)'; rr(c, lx - tw / 2, ly - 13, tw, 26, 13); c.fill();
      c.fillStyle = '#fff'; c.fillText(a, lx - tw / 2 + 12, ly + 0.5);
      c.fillStyle = '#ffd84a'; c.fillText(b, lx - tw / 2 + 12 + wa + 14, ly + 0.5);
      c.font = '700 10px ' + FONT; c.textAlign = 'center'; c.fillStyle = 'rgba(40,50,40,.75)'; c.fillText('출입 통제 · ★이 쌓이면 맡는다', lx, ly + 22);
    });
    // 땅 위 눈 조각
    for (var i = 0; i < parts.length; i++) { var p = parts[i]; if (p.z < 1) { c.fillStyle = 'rgba(255,255,255,.8)'; circ(c, p.x, p.y, p.s); c.fill(); } }
    // 세워진 것들 (y 순서)
    var list = [];
    S.BUILDINGS.forEach(function (b) { list.push({ y: b.y + b.h, f: function () { c.drawImage(bImgs[b.id], b.x, b.y, b.w, b.h + 6); } }); });
    S.TREES.forEach(function (t) { if (t[0] > x0 - 30 && t[0] < x1 + 30 && t[1] > y0 - 10 && t[1] < y1 + 60) list.push({ y: t[1], f: function () { c.drawImage(treeImg, t[0] - 18, t[1] - 46, 36, 50); } }); });
    LAMPS.forEach(function (l) { list.push({ y: l[1], f: function () { drawLamp(c, l[0], l[1]); } }); });
    list.push({ y: 296, f: function () { drawSnowman(c, 600, 296); } });
    world.crew.forEach(function (e) { if (e.x > x0 - 40 && e.x < x1 + 40 && e.y > y0 - 20 && e.y < y1 + 60) list.push({ y: e.y, f: function () { drawCrew(c, e); } }); });
    list.push({ y: world.haeng.y, f: function () { drawHaeng(c, world.haeng); } });
    (S.TANKS || []).forEach(function (tk) { list.push({ y: tk.y + tk.h, f: function () {
      c.fillStyle = '#2c2e29'; rr(c, tk.x - 2, tk.y - 2, tk.w + 4, tk.h + 4, 5); c.fill();
      c.fillStyle = '#5d6c3a'; rr(c, tk.x + 4, tk.y + 6, tk.w - 8, tk.h - 12, 4); c.fill();
      c.fillStyle = '#667744'; rr(c, tk.x + tk.w * 0.25, tk.y + tk.h * 0.25, tk.w * 0.45, tk.h * 0.5, 6); c.fill(); c.fillRect(tk.x + tk.w * 0.6, tk.y + tk.h / 2 - 2, tk.w * 0.55, 4);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(tk.x + tk.w * 0.38, tk.y + tk.h * 0.45, 4, 0, 7); c.arc(tk.x + tk.w * 0.55, tk.y + tk.h * 0.45, 3.4, 0, 7); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(tk.x + tk.w * 0.39, tk.y + tk.h * 0.47, 1.8, 0, 7); c.arc(tk.x + tk.w * 0.56, tk.y + tk.h * 0.42, 1.5, 0, 7); c.fill(); } }); });
    world.deer.forEach(function (d) { list.push({ y: d.y, f: function () {
      c.save(); c.translate(d.x, d.y - 8); c.rotate(Math.atan2(d.dir.y, d.dir.x));
      c.fillStyle = '#9b7653'; c.beginPath(); c.ellipse(0, 0, 11, 6, 0, 0, 7); c.fill(); c.beginPath(); c.arc(11, 0, 4.5, 0, 7); c.fill();
      c.fillStyle = '#fffdf0'; c.fillRect(13, 1.5, 1.2, 3); c.fillStyle = '#111'; c.beginPath(); c.arc(13, -1.5, 1.2, 0, 7); c.fill(); c.restore(); } }); });
    world.cats.forEach(function (k) { list.push({ y: k.y, f: function () { c.fillStyle = '#e8913a'; c.beginPath(); c.arc(k.x, k.y - 5, 5, 0, 7); c.fill(); c.beginPath(); c.arc(k.x + 4, k.y - 10, 3.5, 0, 7); c.fill(); } }); });
    if (world.car) { var cr = world.car; list.push({ y: cr.y + 12, f: function () { if (cr.stuck) { c.fillStyle = '#c8402e'; c.font = '700 10px ' + FONT; c.textAlign = 'center'; c.fillText('빠졌다! 밀어!', cr.x, cr.y - 22); } c.fillStyle = '#4f5d36'; rr(c, cr.x - 9, cr.y - 16, 18, 30, 4); c.fill(); c.fillStyle = '#9cc3dc'; c.fillRect(cr.x - 7, cr.y - (cr.dir.y < 0 ? 12 : -4), 14, 6); } }); }
    if (world.heli) { var hl = world.heli; list.push({ y: hl.y + 20, f: function () { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(hl.x, hl.y, 60, 0, 7); c.fill(); c.fillStyle = '#4c5a35'; c.beginPath(); c.ellipse(hl.x, hl.y - 10, 16, 10, 0, 0, 7); c.fill(); c.fillRect(hl.x - 36, hl.y - 12, 22, 4); } }); }
    list.push({ y: world.player.y + 0.1, f: function () { drawPlayer(c, world.player); var P = world.player; if (P.load > 0) { var k = Math.min(1, P.load / P.cap); c.fillStyle = '#9a8a5c'; c.beginPath(); c.arc(P.x - P.dir.x * 6, P.y - 14, 3 + k * 5, 0, 7); c.fill(); c.fillStyle = '#fbfdff'; c.beginPath(); c.arc(P.x - P.dir.x * 6, P.y - 17 - k * 3, 2 + k * 3, 0, 7); c.fill(); } } });
    world.dumps.forEach(function (d) { list.push({ y: d.y - d.r, f: function () {
      c.fillStyle = 'rgba(138,106,68,.35)'; c.beginPath(); c.arc(d.x, d.y, d.r, 0, 7); c.fill();
      c.strokeStyle = '#8a6a44'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#f7fafd'; c.beginPath(); c.ellipse(d.x, d.y - 4, d.r * 0.55, d.r * 0.38, 0, 0, 7); c.fill();
      c.fillStyle = '#2f3a25'; c.font = '700 9px ' + FONT; c.textAlign = 'center'; c.fillText(d.main ? '눈 집하장' : '릴레이', d.x, d.y - d.r - 4); } }); });
    if (world.player.load >= world.player.cap * 0.6) { var Pp = world.player, nd = G.nearestDump(world, Pp.x, Pp.y), an = Math.atan2(nd.y - Pp.y, nd.x - Pp.x);
      if (Math.hypot(nd.x - Pp.x, nd.y - Pp.y) > 40) list.push({ y: 1e9, f: function () { c.save(); c.translate(Pp.x + Math.cos(an) * 30, Pp.y - 10 + Math.sin(an) * 30); c.rotate(an); c.fillStyle = '#ff6a55'; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -7); c.lineTo(-6, 7); c.closePath(); c.fill(); c.restore(); } }); }
    // 상호작용 물건: 내 눈사람, 족구공, 트랙터, 눈덩이, 고른 것
    (world.save.snowmen || []).forEach(function (m) { list.push({ y: m.y, f: function () { drawSnowman(c, m.x, m.y); } }); });
    var TR = JY.SnowAct && JY.SnowAct.TRACTOR, ac = world.act;
    if (TR && !(ac && ac.ride && ac.ride.kind === 'tractor')) list.push({ y: TR.y + 10, f: function () { drawVehicle(c, { x: TR.x, y: TR.y, dir: { x: 1, y: 0 } }, { kind: 'tractor', r: 30 }); } });
    (S.PROPS || []).forEach(function (pr) { list.push({ y: pr.y, f: function () {
      var col = pr.id === 'phone' ? '#c8402e' : pr.id === 'vend' ? '#2b5fd1' : pr.id === 'stove' ? '#4a4d52' : pr.id === 'saltbox' ? '#3f7a3c' : '#6b4a32';
      c.fillStyle = col; if (pr.id === 'bar') { c.fillRect(pr.x - 9, pr.y - 22, 2, 22); c.fillRect(pr.x + 7, pr.y - 22, 2, 22); c.fillRect(pr.x - 9, pr.y - 23, 18, 2); } else rr(c, pr.x - 5, pr.y - 16, 10, 16, 2), c.fill();
      if (pr.id === 'stove') { c.fillStyle = 'rgba(255,140,40,' + (0.6 + Math.sin(performance.now() / 90) * 0.3) + ')'; circ(c, pr.x, pr.y - 19, 3.5); c.fill(); }
      c.fillStyle = '#2f3a25'; c.font = '700 7px ' + FONT; c.textAlign = 'center'; c.fillText(pr.name, pr.x, pr.y - 26); } }); });
    (world.parts || []).forEach(function (pt) { if (!pt.icy || pt.salted) return; list.push({ y: -1e5, f: function () { c.fillStyle = 'rgba(120,190,255,.3)'; c.fillRect(pt.x, pt.y, pt.w, pt.h); c.fillStyle = '#2b6fd1'; c.font = '700 10px ' + FONT; c.textAlign = 'center'; c.fillText('빙판 · 염화칼슘', pt.x + pt.w / 2, pt.y + pt.h / 2); } }); });
    (world.recruits || []).forEach(function (r) { list.push({ y: r.y, f: function () { drawPerson(c, r, { coat: r.def.coat, hat: 'helmet', seed: 3, tool: null, r: 10 }); c.fillStyle = '#2f8f4e'; c.font = '700 8px ' + FONT; c.textAlign = 'center'; c.fillText(r.state === 'follow' ? '따라오는 중' : '신병', r.x, r.y - 33); } }); });
    if (ac) {
      (ac.reqs || []).forEach(function (q) { var wo = q.who; list.push({ y: 4e5, f: function () { c.fillStyle = '#ff9f43'; c.font = '700 10px ' + FONT; c.textAlign = 'center'; c.fillText((JY.SnowAct.ITEM[q.item] || {}).want + '?', wo.x, wo.y - 44); } }); });
      (ac.off || []).forEach(function (o) { list.push({ y: o.y, f: function () { drawPerson(c, o, { coat: '#3d4a2b', hat: 'cap', seed: 7, tool: o.helpT > 0 ? 'shovel' : null, r: 10 }); c.fillStyle = '#2b5fd1'; c.font = '700 8px ' + FONT; c.textAlign = 'center'; c.fillText(o.id === 'lt' ? '소대장' : o.id === 'cpt' ? '중대장' : '사단장', o.x, o.y - 33);
        if (!o.saluted && !o.missed && o.warned) { c.fillStyle = '#c8402e'; c.font = '700 11px ' + FONT; c.fillText('경례!', o.x, o.y - 44); } } }); });
      var Pq = world.player, iq = G.cellIndex(Pq.x, Pq.y), pq = iq >= 0 ? world.partOf[iq] : -1, PT = pq >= 0 ? world.parts[pq] : null;
      if (PT && !PT.done && PT.clear / PT.total >= S.ALMOST) list.push({ y: 3e5, f: function () {
        c.fillStyle = 'rgba(255,200,60,' + (0.55 + Math.sin(performance.now() / 120) * 0.35) + ')';
        for (var gy = Math.floor(PT.y / CELL); gy < Math.ceil((PT.y + PT.h) / CELL); gy++) for (var gx = Math.floor(PT.x / CELL); gx < Math.ceil((PT.x + PT.w) / CELL); gx++) { var kk = gy * GW + gx; if (world.partOf[kk] === pq && world.depth[kk] > 0) { circ(c, gx * CELL + 5, gy * CELL + 5, 2.2); c.fill(); } }
      } });
      if (JY.SnowAct && mode === 'play') {
        JY.SnowAct.pads(world).forEach(function (p) { list.push({ y: -9e4, f: function () {
          var pr = ac.padT && ac.padT[p.id] > 0 ? Math.min(1, ac.padT[p.id] / p.dwell) : 0;
          c.fillStyle = p.ok ? (p.kind === 'report' ? 'rgba(79,207,116,.4)' : 'rgba(255,210,74,.45)') : 'rgba(150,160,170,.3)'; circ(c, p.x, p.y, p.r); c.fill();
          c.strokeStyle = p.ok ? '#fff' : 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.stroke();
          if (pr) { c.fillStyle = 'rgba(255,255,255,.65)'; circ(c, p.x, p.y, p.r * pr); c.fill(); }
          c.fillStyle = '#16233a'; c.font = '700 8px ' + FONT; c.textAlign = 'center'; c.fillText(p.title, p.x, p.y - 2); c.fillText(p.lock || (p.cost ? fmt(p.cost) : p.name), p.x, p.y + 8); } }); });
        var gq = JY.SnowAct.objective(world), Pg = world.player;
        if (gq && !gq.here && gq.kind !== 'salute' && Math.hypot(gq.x - Pg.x, gq.y - Pg.y) > 30) { var gv = gq.via || gq, ga = Math.atan2(gv.y - Pg.y, gv.x - Pg.x); list.push({ y: 1e9, f: function () {
          c.save(); c.translate(Pg.x + Math.cos(ga) * 26, Pg.y - 4 + Math.sin(ga) * 26); c.rotate(ga); c.fillStyle = '#ffd24a'; c.strokeStyle = '#16233a'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -9); c.lineTo(-2, 0); c.lineTo(-6, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
          c.fillStyle = '#ffd24a'; circ(c, gq.x, gq.y - 30 - Math.abs(Math.sin(performance.now() / 200)) * 6, 4.5); c.fill(); } }); }
      }
      var KB = ac.ball; list.push({ y: KB.y, f: function () { c.fillStyle = '#f4f1e6'; circ(c, KB.x, KB.y - 3 - KB.h, 3.4); c.fill(); c.strokeStyle = '#e2b33c'; c.lineWidth = 1.2; c.stroke(); } });
      ac.balls.forEach(function (b) { list.push({ y: b.y + 1e5, f: function () { c.fillStyle = 'rgba(40,60,90,.25)'; circ(c, b.x, b.y, 2.2); c.fill(); c.fillStyle = '#fff'; circ(c, b.x, b.y - b.h * 0.6, 2.6); c.fill(); } }); });
    }
    if (focusT && mode === 'play') { var ft = focusT; list.push({ y: 2e5, f: function () {
      c.strokeStyle = '#ffd84a'; c.lineWidth = 2; c.beginPath(); c.arc(ft.x, ft.y, 9, 0, 7); c.stroke();
      c.font = '700 9px ' + FONT; c.textAlign = 'center'; var tw = c.measureText(ft.verb).width + 10;
      c.fillStyle = 'rgba(22,35,58,.88)'; rr(c, ft.x - tw / 2, ft.y - 46, tw, 14, 6); c.fill(); c.fillStyle = '#ffd84a'; c.fillText(ft.verb, ft.x, ft.y - 36); } }); }
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });
    // 날리는 눈 조각
    for (i = 0; i < parts.length; i++) {
      p = parts[i]; if (p.z < 1) continue;
      var al = 1 - p.t / p.life;
      c.fillStyle = 'rgba(70,95,125,' + 0.18 * al + ')'; circ(c, p.x, p.y, p.s * 0.9); c.fill();
      c.fillStyle = p.salt ? 'rgba(200,230,255,' + al + ')' : 'rgba(255,255,255,' + Math.min(1, al + 0.2) + ')'; circ(c, p.x, p.y - p.z, p.s); c.fill();
    }
    // 말풍선·숫자
    bubbles.forEach(function (b) { drawBubble(c, b.e.x, b.e.y - 38, b.text, Math.min(1, (b.life - b.t) * 3, b.t * 6)); });
    floats.forEach(function (f) {
      var k = f.t / f.life, fy = (f.follow ? f.follow.y - 30 : f.y) - k * 16, fx0 = f.follow ? f.follow.x + 6 : f.x;
      c.globalAlpha = Math.min(1, (1 - k) * 2.2);
      c.font = '700 ' + f.size + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = 'rgba(40,40,40,.7)'; c.strokeText(f.text, fx0, fy); c.fillStyle = f.color; c.fillText(f.text, fx0, fy);
      if (f.pie) { var tw = c.measureText(f.text).width; drawPie(c, fx0 + tw / 2 + 7, fy, 4.5); }
      c.globalAlpha = 1;
    });
    // 화면 효과: 새벽 → 아침
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var day = world.dayLen ? Math.min(1, world.time / world.dayLen) : 0;
    var gr = c.createLinearGradient(0, 0, 0, vh);
    gr.addColorStop(0, 'rgba(28,48,92,' + (0.26 - day * 0.18) + ')'); gr.addColorStop(0.5, 'rgba(28,48,92,0)');
    gr.addColorStop(1, 'rgba(255,190,120,' + day * 0.1 + ')');
    c.fillStyle = gr; c.fillRect(0, 0, vw, vh);
    var vg = c.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vg.addColorStop(0, 'rgba(10,20,40,0)'); vg.addColorStop(1, 'rgba(10,20,40,.28)');
    c.fillStyle = vg; c.fillRect(0, 0, vw, vh);
    var t = now / 1000;
    for (i = 0; i < flakes.length; i++) {
      var fl = flakes[i];
      c.fillStyle = 'rgba(255,255,255,' + (0.45 + fl.z * 0.5) + ')';
      circ(c, fl.x + Math.sin(t * 1.3 + fl.ph) * 6 * fl.z, fl.y, 0.7 + fl.z * 2); c.fill();
    }
    if (stick && stick.active) {
      c.fillStyle = 'rgba(255,255,255,.16)'; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
      circ(c, stick.ox, stick.oy, 46); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; circ(c, stick.ox + stick.vx * 46, stick.oy + stick.vy * 46, 20); c.fill();
    }
  }

  var LAMPS = [[222, 660], [222, 780], [222, 900], [418, 660], [418, 780], [418, 900], [56, 300], [584, 300]];
  function drawLamp(c, x, y) {
    c.fillStyle = 'rgba(46,68,96,.2)'; ell(c, x + 3, y + 1, 5, 2); c.fill();
    c.fillStyle = '#3b4148'; c.fillRect(x - 1.2, y - 30, 2.4, 30);
    c.fillStyle = '#ffe7a3'; circ(c, x, y - 31, 3.2); c.fill();
    c.fillStyle = 'rgba(255,220,140,.18)'; circ(c, x, y - 31, 12); c.fill();
    c.fillStyle = '#f7fafd'; ell(c, x, y - 34.5, 3.6, 1.6); c.fill();
  }
  function drawSnowman(c, x, y) {
    c.fillStyle = 'rgba(46,68,96,.2)'; ell(c, x + 3, y + 1, 10, 4); c.fill();
    c.fillStyle = '#fbfdff'; circ(c, x, y - 8, 9); c.fill(); circ(c, x, y - 21, 6.5); c.fill();
    c.fillStyle = '#39422c'; c.beginPath(); c.arc(x, y - 22.5, 6.6, Math.PI, 0); c.fill();
    c.fillStyle = '#1e1e1e'; circ(c, x - 2.2, y - 21, 0.9); c.fill(); circ(c, x + 2.2, y - 21, 0.9); c.fill();
    c.fillStyle = '#e98a2c'; c.beginPath(); c.moveTo(x, y - 19.5); c.lineTo(x + 5, y - 18.8); c.lineTo(x, y - 18); c.fill();
    c.strokeStyle = '#6b4a32'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 8, y - 11); c.lineTo(x - 15, y - 17); c.moveTo(x + 8, y - 11); c.lineTo(x + 14, y - 15); c.stroke();
  }
  function drawPie(c, x, y, r) {
    c.fillStyle = '#5a3420'; circ(c, x, y, r); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, x - r * 0.35, y - r * 0.35, r * 0.35); c.fill();
  }
  function drawBubble(c, x, y, text, a) {
    c.globalAlpha = Math.max(0, Math.min(1, a));
    c.font = '700 9px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    var tw = c.measureText(text).width + 12;
    c.fillStyle = 'rgba(255,255,255,.95)'; rr(c, x - tw / 2, y - 9, tw, 16, 8); c.fill();
    c.beginPath(); c.moveTo(x - 3, y + 6); c.lineTo(x, y + 11); c.lineTo(x + 3, y + 6); c.fill();
    c.fillStyle = '#2a2f25'; c.fillText(text, x, y - 0.5);
    c.globalAlpha = 1;
  }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }

  /* ── 입력 ── */
  function readInput() {
    var x = 0, y = 0;
    if (keys.ArrowLeft || keys.a) x -= 1; if (keys.ArrowRight || keys.d) x += 1;
    if (keys.ArrowUp || keys.w) y -= 1; if (keys.ArrowDown || keys.s) y += 1;
    if (x || y) { moveTo = null; return { x: x, y: y }; }
    if (stick && stick.active && (stick.vx || stick.vy)) return { x: stick.vx, y: stick.vy };
    if (moveTo && world) {
      var P = world.player, dx = moveTo.x - P.x, dy = moveTo.y - P.y, d = Math.hypot(dx, dy);
      if (d < 6) { moveTo = null; return { x: 0, y: 0 }; }
      return { x: dx / d, y: dy / d };
    }
    return { x: 0, y: 0 };
  }
  function botInput() {
    var P = world.player;
    if (P.load >= P.cap * 0.95 || (P.load > 0 && bot.idx < 0)) { var dp = G.nearestDump(world, P.x, P.y), ddx = dp.x - P.x, ddy = dp.y - P.y, dl = Math.hypot(ddx, ddy) || 1; return { x: ddx / dl, y: ddy / dl }; }
    bot.t -= 1 / 60;
    if (bot.t <= 0 || bot.idx < 0 || !world.depth[bot.idx]) {
      var best = -1, bs = 1e9;
      for (var k = 0; k < 30; k++) {
        var idx = world.cells[(Math.random() * world.cells.length) | 0];
        if (idx === undefined || !world.depth[idx]) continue;
        var x = (idx % GW) * CELL + 5, y = ((idx / GW) | 0) * CELL + 5, s = Math.hypot(x - P.x, y - P.y) - world.depth[idx] * 10;
        if (s < bs) { bs = s; best = idx; }
      }
      bot.idx = best; bot.t = 1.2;
    }
    if (bot.idx < 0) return { x: 0, y: 0 };
    var tx = (bot.idx % GW) * CELL + 5, ty = ((bot.idx / GW) | 0) * CELL + 5, dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  function bindInput() {
    cv.addEventListener('pointerdown', function (e) {
      if (mode !== 'play') return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
      stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, vx: 0, vy: 0, active: true, t: performance.now(), moved: false };
      if (JY.SnowSfx) JY.SnowSfx.unlock();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!stick || e.pointerId !== stick.id) return;
      var dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, d = Math.hypot(dx, dy);
      if (d > 8) stick.moved = true;
      if (d < 5) { stick.vx = stick.vy = 0; return; }
      var m = Math.min(1, d / 46); stick.vx = dx / d * m; stick.vy = dy / d * m;
      if (d > 70) { stick.ox = e.clientX - dx / d * 70; stick.oy = e.clientY - dy / d * 70; }
      moveTo = null;
    });
    function up(e) {
      if (!stick || e.pointerId !== stick.id) return;
      if (!stick.moved && performance.now() - stick.t < 280) {
        var r = cv.getBoundingClientRect();
        moveTo = { x: camX + (e.clientX - r.left) / zoom, y: camY + (e.clientY - r.top) / zoom };
      }
      stick = null;
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    window.addEventListener('keydown', function (e) { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; if (e.key.indexOf('Arrow') === 0 && mode === 'play') e.preventDefault(); });
    window.addEventListener('keyup', function (e) { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
    window.addEventListener('blur', function () { keys = {}; stick = null; });
    window.addEventListener('resize', resize);
  }

  /* ── 루프 ── */
  var speed = 1;   // 병장 말년 특권: 작전 2배속
  function frame(t) {
    raf = requestAnimationFrame(frame);
    var raw = last ? Math.min(0.25, (t - last) / 1000) : 0.016, dt = Math.min(0.05, raw); last = t;
    if (world && (mode === 'play' || mode === 'demo')) {
      var span = raw * (mode === 'play' ? speed : 1), n = Math.ceil(span / 0.05);
      for (var sn = 0; sn < n && !world.done; sn++) G.step(world, span / n, mode === 'demo' || autopilot ? botInput() : readInput());
      onFx(); markDirty();
      if (mode === 'demo' && world.done) { world = G.createWorld(world.save, { demo: true, salt: (Math.random() * 1e6) | 0 }); buildSnow(); }
      if (mode === 'play' && world.done && !doneSent) { doneSent = true; mode = 'end'; if (hooks.done) hooks.done(world); }
      if (hooks.tick && mode === 'play') hooks.tick(world);
    }
    if (world) { stepFx(dt); camera(dt); for (var i = 0; i < flakes.length; i++) { var f = flakes[i]; f.y += (16 + f.z * 46) * dt; if (f.y > vh + 4) { f.y = -4; f.x = Math.random() * vw; } } }
    if (world) flushDirty(mode === 'demo' ? 4 : 6);
    render();
  }

  function begin(save, m) {
    world = G.createWorld(save, { demo: m === 'demo', salt: m === 'demo' ? (Math.random() * 1e6) | 0 : 0 });
    mode = m; doneSent = false; parts.length = 0; floats.length = 0; bubbles.length = 0; gainAcc = 0; moveTo = null; stick = null;
    buildSnow(); zoomFor(true); camera(0, true); setFlakes();
    return world;
  }

  JY.SnowView = {
    init: function (canvas, h) {
      cv = canvas; ctx = cv.getContext('2d'); hooks = h || {};
      buildGround(); buildProps(); buildSnowTex(); bindInput(); resize();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    rebuildArt: function () { buildGround(); buildProps(); if (world) buildSnow(); },
    demo: function (save) { return begin(save, 'demo'); },
    play: function (save) { return begin(save, 'play'); },
    pause: function (b) { if (mode === 'play' && b) mode = 'paused'; else if (mode === 'paused' && !b) { mode = 'play'; last = 0; } },
    world: function () { return world; },
    mode: function () { return mode; },
    setAutopilot: function (b) { autopilot = !!b; },
    setSpeed: function (n) { speed = Math.max(1, Math.min(3, n || 1)); }, speed: function () { return speed; },
    screenOf: function (x, y) { return { x: (x - camX) * zoom, y: (y - camY) * zoom, on: true }; },
    shake: function (n) { shake = Math.max(shake, n); },
    look: function () { if (!world) return null; var d = world.player.dir; return { x: d.x, y: d.y, pitch: 0.12, fp: false }; },
    setFocus: function (t) { focusT = t || null; },
    isFP: function () { return false; },
    _screenToWorld: function (x, y) { var r = cv.getBoundingClientRect(); return { x: camX + (x - r.left) / zoom, y: camY + (y - r.top) / zoom }; },
    _teleport: function (x, y) { if (world) { world.player.x = x; world.player.y = y; camera(0, true); } },
    _drawPerson: drawPerson, _drawVehicle: drawVehicle, _drawPie: drawPie, _toolKind: toolKind, FONT: FONT
  };
})(window.JY = window.JY || {});
