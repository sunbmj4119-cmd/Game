/* 제설각 — 3D 화면 (three.js)
 * 눈은 높이장(파이는 만큼 땅이 드러남), 부대는 띨빵한 장난감 같은 블록, 군인은 작은 몸 + 전역각 얼굴(큰 머리 판때기) */
(function (JY) {
  'use strict';
  var T = window.THREE;
  if (!T) return;
  var S = JY.SNOW, G = JY.SnowSim, CELL = S.CELL, GW = S.GW, GH = S.GH, U = 1 / CELL;
  var NX = GW * 2 + 1, NZ = GH * 2 + 1;
  var DH = [-0.08, 0.22, 0.48, 0.74, 1.0];          // 눈 깊이 → 높이
  var OUT = 0.8;                                    // 구역 밖 눈 높이
  var VIS = [21, 23, 25, 28, 31, 35, 41, 49, 62];  // 도구 단계별로 플레이어 위치에서 보이는 너비
  var PITCH = 0.9, FOV = 34;
  var FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  var TITLE = '"Black Han Sans", "Apple SD Gothic Neo", sans-serif';

  var cv, renderer, scene, camera, hemi, sun, raf = 0, last = 0, ready = false;
  var vw = 1, vh = 1, pr = 1, visW = 30, visT = 30, camT = new T.Vector3(40, 0, 20), shake = 0, focus = null;
  var world = null, mode = 'idle', hooks = {}, doneSent = false, autopilot = false, bot = { idx: -1, t: 0 };
  var keys = {}, stick = null, moveTo = null;
  var snowGeo = null, snowMesh = null, baseH, hgt, shade, scanT = 0, dirtyRows = null;
  var lockGroup = null, dynGroup = null, crewObjs = [], deerObjs = [], catObjs = [], carObj = null, heliObj = null, playerObj = null, haengObj = null, playerKind = '';
  var pts, pPos, pCol, pVel, pLife, pN = 0, MAXP = 900, flakes, fPos, NF = 1400;
  var ov, stickEl, knobEl, overlays = [], zoneLabels = [];
  var mats = {}, geos = {}, matV, blobMat, barrierArm = null, flagMesh = null;
  var A = function () { return JY.SnowAct; }, fpYaw = 0, fpPitch = -0.2, lookPtr = null, stunK = 0, curFocus = null, markEl = null, lastCamMode = '';
  var vmScene, vmCam, vmRoot = null, vmKind = '', vmTool = null, vmArm = null, vmGlove = null, vmBallM = null, vmBoot = null, vmAnim = { k: '', t: 0, d: 1 }, vmHemi, vmSun;
  var actBalls = [], manObjs = [], manKey = '', kickBall = null, tractorObj = null;
  var lowFx = false, slowAvg = 0.016, slowN = 0, gainAcc = 0, gainT = 0, scrapeT = 0, crewScrapeT = 0, ray = new T.Raycaster(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function canvasTex(w, h, draw, repeat) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.anisotropy = 4; t.encoding = T.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── 모양 합치기 (정점 색) ── */
  function P(g, o) {
    o = o || {};
    if (o.s) g.scale(o.s[0], o.s[1], o.s[2]);
    if (o.rx) g.rotateX(o.rx); if (o.rz) g.rotateZ(o.rz); if (o.ry) g.rotateY(o.ry);
    g.translate(o.x || 0, o.y || 0, o.z || 0);
    return g;
  }
  function merge(list) {
    var pos = [], nor = [], col = [];
    list.forEach(function (it) {
      var g = it[0].index ? it[0].toNonIndexed() : it[0], c = new T.Color(it[1]);
      var p = g.attributes.position.array, n = g.attributes.normal.array;
      for (var i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); }
    });
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  }
  function prism(w, h, d, o) {
    var x0 = -w / 2, x1 = w / 2, zf = d / 2, zb = -d / 2, A = [x0, 0, zf], B = [x1, 0, zf], C = [x1, h, 0], D = [x0, h, 0], E = [x0, 0, zb], F = [x1, 0, zb];
    var tri = [A, B, C, A, C, D, F, E, D, F, D, C, A, D, E, B, F, C], pos = [];
    tri.forEach(function (v) { pos.push(v[0], v[1], v[2]); });
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return P(g, o);
  }
  function box(w, h, d, o) { return P(new T.BoxGeometry(w, h, d), o); }
  function cyl(rt, rb, h, o, seg) { return P(new T.CylinderGeometry(rt, rb, h, seg || 10), o); }
  function sph(r, o, a, b) { return P(new T.SphereGeometry(r, a || 12, b || 8), o); }
  function cone(r, h, o, seg) { return P(new T.ConeGeometry(r, h, seg || 10), o); }
  function mesh(geo, mat) { return new T.Mesh(geo, mat || matV); }

  /* ── 땅 그림 (구역 바닥: 치우면 드러난다) ── */
  function paintGround() {
    var K = 2;
    return canvasTex(S.W * K, S.H * K, function (g) {
      g.scale(K, K);
      g.fillStyle = '#cfd9e2'; g.fillRect(0, 0, S.W, S.H);
      S.ZONES.forEach(function (Z) { zoneGround(g, Z); });
      S.ZONES.forEach(function (Z) { g.strokeStyle = '#8e969d'; g.lineWidth = 3; g.strokeRect(Z.x - 1.5, Z.y - 1.5, Z.w + 3, Z.h + 3); });
    });
  }
  function speckle(g, Z, base, n, a, b) {
    g.fillStyle = base; g.fillRect(Z.x, Z.y, Z.w, Z.h);
    for (var i = 0; i < n; i++) { g.fillStyle = hash(i, Z.x + 3) < 0.5 ? a : b; g.fillRect(Z.x + hash(i, Z.y + 5) * Z.w, Z.y + hash(i, Z.x + 9) * Z.h, 1 + hash(i, 7) * 2, 1 + hash(i, 11) * 2); }
  }
  function paintText(g, text, x, y, size, color) { g.fillStyle = color; g.font = size + 'px ' + TITLE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y); }
  function zoneGround(g, Z) {
    g.save(); g.beginPath(); g.rect(Z.x, Z.y, Z.w, Z.h); g.clip();
    var x, y, i;
    if (Z.ground === 'walk') {
      for (y = Z.y, i = 0; y < Z.y + Z.h; y += 10, i++) for (x = Z.x - (i % 2) * 10; x < Z.x + Z.w; x += 20) {
        var t = hash(x, y) * 20 - 10; g.fillStyle = 'rgb(' + (170 + t | 0) + ',' + (160 + t | 0) + ',' + (142 + t | 0) + ')'; g.fillRect(x + 0.6, y + 0.6, 18.8, 8.8);
      }
      g.fillStyle = '#8e8676'; for (y = Z.y; y < Z.y + Z.h; y += 10) g.fillRect(Z.x, y, Z.w, 0.6);
    } else if (Z.ground === 'court') {
      speckle(g, Z, '#4f8f5e', 900, 'rgba(30,70,40,.35)', 'rgba(140,200,150,.3)');
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(Z.x + 12, Z.y + 12, Z.w - 24, Z.h - 24);
      g.beginPath(); g.moveTo(Z.x + Z.w / 2, Z.y + 12); g.lineTo(Z.x + Z.w / 2, Z.y + Z.h - 12); g.stroke();
      g.strokeRect(Z.x + 50, Z.y + 40, Z.w / 2 - 50, Z.h - 80); g.strokeRect(Z.x + Z.w / 2, Z.y + 40, Z.w / 2 - 50, Z.h - 80);
      paintText(g, '족구 한판?', Z.x + Z.w * 0.25, Z.y + Z.h - 26, 18, 'rgba(255,255,255,.55)');
    } else if (Z.ground === 'parade') {
      speckle(g, Z, '#a2865f', 2600, 'rgba(90,65,40,.35)', 'rgba(210,185,150,.35)');
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5; g.strokeRect(Z.x + 14, Z.y + 14, Z.w - 28, Z.h - 28);
      g.beginPath(); g.moveTo(Z.x + Z.w / 2, Z.y + 14); g.lineTo(Z.x + Z.w / 2, Z.y + Z.h - 14); g.moveTo(Z.x + 14, Z.y + Z.h / 2); g.lineTo(Z.x + Z.w - 14, Z.y + Z.h / 2); g.stroke();
      for (x = Z.x + 50; x < Z.x + Z.w - 30; x += 50) for (y = Z.y + 45; y < Z.y + Z.h - 30; y += 45) { g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke(); }
      paintText(g, '충 성', Z.x + Z.w / 2, Z.y + Z.h / 2 + 4, 92, 'rgba(255,255,255,.62)');
    } else if (Z.ground === 'yard') {
      speckle(g, Z, '#a6a8a1', 1200, 'rgba(80,80,75,.3)', 'rgba(220,220,212,.35)');
      g.strokeStyle = 'rgba(60,60,55,.35)'; g.lineWidth = 1;
      for (x = Z.x; x < Z.x + Z.w; x += 30) { g.beginPath(); g.moveTo(x, Z.y); g.lineTo(x, Z.y + Z.h); g.stroke(); }
      for (y = Z.y; y < Z.y + Z.h; y += 30) { g.beginPath(); g.moveTo(Z.x, y); g.lineTo(Z.x + Z.w, y); g.stroke(); }
      g.fillStyle = 'rgba(120,80,40,.35)'; for (i = 0; i < 9; i++) { g.beginPath(); g.ellipse(Z.x + hash(i, 41) * Z.w, Z.y + Z.h * 0.5 + hash(i, 42) * Z.h * 0.5, 8 + hash(i, 43) * 10, 4 + hash(i, 44) * 5, 0, 0, 7); g.fill(); }
      paintText(g, '배식구 →', Z.x + Z.w / 2, Z.y + 40, 22, 'rgba(255,255,255,.7)');
    } else if (Z.ground === 'road' || Z.ground === 'gate') {
      speckle(g, Z, '#4b4f55', 3200, 'rgba(25,28,32,.45)', 'rgba(130,135,140,.35)');
      g.fillStyle = 'rgba(240,240,235,.88)';
      if (Z.ground === 'road') {
        g.fillRect(Z.x + 8, Z.y, 3, Z.h); g.fillRect(Z.x + Z.w - 11, Z.y, 3, Z.h);
        g.fillStyle = '#e2b33c'; for (y = Z.y + 6; y < Z.y + Z.h; y += 34) { g.fillRect(Z.x + Z.w / 2 - 4, y, 3, 20); g.fillRect(Z.x + Z.w / 2 + 1, y, 3, 20); }
        paintText(g, '서행', Z.x + Z.w / 4 + 4, Z.y + Z.h - 80, 30, 'rgba(240,240,235,.88)'); paintText(g, '서행', Z.x + Z.w * 3 / 4 - 4, Z.y + 90, 30, 'rgba(240,240,235,.88)');
      } else {
        for (x = Z.x + 180; x < Z.x + 330; x += 18) g.fillRect(x, Z.y + 14, 10, Z.h - 28);
        paintText(g, '정지', Z.x + 400, Z.y + Z.h / 2, 26, 'rgba(240,240,235,.88)'); paintText(g, '일단', Z.x + 90, Z.y + Z.h / 2, 26, 'rgba(240,240,235,.88)');
      }
    } else if (Z.ground === 'tank') {
      speckle(g, Z, '#9a9d95', 1800, 'rgba(70,72,66,.35)', 'rgba(215,215,205,.3)');
      g.strokeStyle = '#e2b33c'; g.lineWidth = 3;
      S.TANKS.forEach(function (t, k) { g.strokeRect(t.x - 10, t.y - 10, t.w + 20, t.h + 20); paintText(g, t.name, t.x + t.w / 2, t.y + t.h + 22, 18, '#e2b33c'); });
      g.strokeStyle = 'rgba(40,40,35,.35)'; g.lineWidth = 6;
      for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(Z.x + 40 + i * 60, Z.y); g.bezierCurveTo(Z.x + 80 + i * 50, Z.y + 120, Z.x + 20 + i * 60, Z.y + 200, Z.x + 60 + i * 50, Z.y + Z.h); g.stroke(); }
    } else if (Z.ground === 'pad') {
      speckle(g, Z, '#a3a69f', 1600, 'rgba(80,85,80,.3)', 'rgba(220,222,215,.35)');
      g.strokeStyle = '#e2b33c'; g.lineWidth = 8; g.beginPath(); g.arc(Z.x + Z.w / 2, Z.y + Z.h / 2, 92, 0, 7); g.stroke();
      paintText(g, 'H', Z.x + Z.w / 2, Z.y + Z.h / 2 + 6, 120, '#f4f4ef');
    }
    g.restore();
  }

  /* ── 눈 높이장 ── */
  function buildBase() {
    baseH = new Float32Array(GW * GH).fill(OUT);
    S.BUILDINGS.concat(S.TANKS).forEach(function (b) {
      for (var gy = Math.floor(b.y / CELL); gy < Math.ceil((b.y + b.h) / CELL); gy++) for (var gx = Math.floor(b.x / CELL); gx < Math.ceil((b.x + b.w) / CELL); gx++) if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) baseH[gy * GW + gx] = -0.1;
    });
    for (var i = 0; i < GW * GH; i++) if (baseH[i] > 0) baseH[i] = OUT + (hash(i % GW, (i / GW) | 0) - 0.5) * 0.12;
    shade = new Float32Array(NX * NZ);
    for (var j = 0; j < NZ; j++) for (var k = 0; k < NX; k++) {
      var x = k * 5, y = j * 5, s = 0;
      S.BUILDINGS.forEach(function (b) { if (x > b.x + 6 && x < b.x + b.w + 16 && y > b.y && y < b.y + b.h + 18) s = Math.max(s, Math.min(1, (b.y + b.h + 18 - y) / 10)); });
      S.TREES.forEach(function (t) { var d = Math.hypot(x - t[0] - 5, y - t[1] - 3); if (d < 15) s = Math.max(s, 0.8 * (1 - d / 15)); });
      shade[j * NX + k] = s;
    }
  }
  function cellH(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return OUT;
    var idx = gy * GW + gx;
    return world.zone[idx] >= 0 ? DH[world.depth[idx]] : baseH[idx];
  }
  function vertH(i, j) {
    var oi = i & 1, oj = j & 1;
    if (oi && oj) return cellH((i - 1) / 2, (j - 1) / 2);
    if (oi) { var gx = (i - 1) / 2; return (cellH(gx, j / 2 - 1) + cellH(gx, j / 2)) / 2; }
    if (oj) { var gy = (j - 1) / 2; return (cellH(i / 2 - 1, gy) + cellH(i / 2, gy)) / 2; }
    return (cellH(i / 2 - 1, j / 2 - 1) + cellH(i / 2, j / 2 - 1) + cellH(i / 2 - 1, j / 2) + cellH(i / 2, j / 2)) / 4;
  }
  function remaining(i, j) {
    var gx = Math.min(GW - 1, i >> 1), gy = Math.min(GH - 1, j >> 1), idx = gy * GW + gx, z = world.zone[idx];
    return z >= 0 && world.zoneOpen[z] && world.depth[idx] > 0;
  }
  function setVert(i, j) {
    var v = j * NX + i, h = vertH(i, j);
    hgt[v] = h; snowGeo.attributes.position.array[v * 3 + 1] = h;
  }
  function setNormCol(i, j) {
    var v = j * NX + i, n = snowGeo.attributes.normal.array, c = snowGeo.attributes.color.array;
    var hl = hgt[j * NX + Math.max(0, i - 1)], hr = hgt[j * NX + Math.min(NX - 1, i + 1)], hu = hgt[Math.max(0, j - 1) * NX + i], hd = hgt[Math.min(NZ - 1, j + 1) * NX + i];
    var nx = (hl - hr) * 1.3, nz = (hu - hd) * 1.3, l = Math.sqrt(nx * nx + 1 + nz * nz);
    n[v * 3] = nx / l; n[v * 3 + 1] = 1 / l; n[v * 3 + 2] = nz / l;
    var h = hgt[v], b = 0.93 + hash(i, j) * 0.07, r = b, g = b + 0.012, bl = b + 0.045, s = shade[v];
    if (h < 0.3) { var k = Math.min(1, (0.3 - h) / 0.38); r -= 0.16 * k; g -= 0.12 * k; bl -= 0.05 * k; }
    var cav = (hl + hr + hu + hd) / 4 - h; if (cav > 0.03) { r -= cav * 0.3; g -= cav * 0.22; bl -= cav * 0.07; }
    if (s) { r -= 0.2 * s; g -= 0.15 * s; bl -= 0.06 * s; }
    if (scanT > 0 && remaining(i, j)) { r = 1; g = 0.62; bl = 0.25; }
    c[v * 3] = r; c[v * 3 + 1] = g; c[v * 3 + 2] = bl;
  }
  function buildSnow() {
    var n = NX * NZ, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array((NX - 1) * (NZ - 1) * 6), k = 0;
    hgt = new Float32Array(n);
    for (var j = 0; j < NZ; j++) for (var i = 0; i < NX; i++) { var v = j * NX + i; pos[v * 3] = i * 0.5; pos[v * 3 + 2] = j * 0.5; uv[v * 2] = i * 0.5 / 5; uv[v * 2 + 1] = j * 0.5 / 5; }
    for (j = 0; j < NZ - 1; j++) for (i = 0; i < NX - 1; i++) { var a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
    if (snowMesh) { scene.remove(snowMesh); snowGeo.dispose(); }
    snowGeo = new T.BufferGeometry();
    snowGeo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    snowGeo.setAttribute('normal', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage));
    snowGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage));
    snowGeo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    snowGeo.setIndex(new T.BufferAttribute(idx, 1));
    for (j = 0; j < NZ; j++) for (i = 0; i < NX; i++) setVert(i, j);
    for (j = 0; j < NZ; j++) for (i = 0; i < NX; i++) setNormCol(i, j);
    snowMesh = new T.Mesh(snowGeo, mats.snow); snowMesh.receiveShadow = true;
    scene.add(snowMesh);
  }
  function recolorAll() {
    for (var j = 0; j < NZ; j++) for (var i = 0; i < NX; i++) setNormCol(i, j);
    snowGeo.attributes.color.updateRange = { offset: 0, count: -1 }; snowGeo.attributes.color.needsUpdate = true;
  }
  function flushSnow() {
    var d = world.dirty;
    if (!d.length) return;
    var j0 = NZ, j1 = 0, seen = {};
    for (var q = 0; q < d.length; q++) {
      var idx = d[q]; if (seen[idx]) continue; seen[idx] = 1;
      var gx = idx % GW, gy = (idx / GW) | 0;
      for (var j = 2 * gy; j <= 2 * gy + 2; j++) for (var i = 2 * gx; i <= 2 * gx + 2; i++) setVert(i, j);
      j0 = Math.min(j0, 2 * gy - 1); j1 = Math.max(j1, 2 * gy + 3);
    }
    j0 = Math.max(0, j0); j1 = Math.min(NZ - 1, j1);
    for (q in seen) {
      var id = +q, cx = id % GW, cy = (id / GW) | 0;
      for (var jj = Math.max(0, 2 * cy - 1); jj <= Math.min(NZ - 1, 2 * cy + 3); jj++) for (var ii = Math.max(0, 2 * cx - 1); ii <= Math.min(NX - 1, 2 * cx + 3); ii++) setNormCol(ii, jj);
    }
    d.length = 0;
    var o = j0 * NX, c = (j1 - j0 + 1) * NX;
    ['position', 'normal', 'color'].forEach(function (k) { var a = snowGeo.attributes[k]; a.updateRange = { offset: o * 3, count: c * 3 }; a.needsUpdate = true; });
  }
  function snowAt(x, y) { var i = Math.round(x / 5), j = Math.round(y / 5); if (i < 0 || j < 0 || i >= NX || j >= NZ) return 0; return Math.max(0, hgt[j * NX + i]); }

  /* ── 건물·소품 ── */
  var BH = { barracks: 5.2, office: 4.4, px: 4.0, stand: 1.1, mess: 4.6, garage: 5.0, guard: 3.8 };  // 1인칭 눈높이(2.3)에 맞춘 벽 높이
  function wallTex(b, w, h, front) {
    var ppu = 36;
    return canvasTex(Math.ceil(w * ppu), Math.ceil(h * ppu), function (c, cw, ch) {
      c.fillStyle = b.wallc; c.fillRect(0, 0, cw, ch);
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, ch - 8, cw, 8);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 0, cw, 4);
      if (b.id === 'stand') { c.fillStyle = '#8c7f68'; for (var s = 0; s < 3; s++) c.fillRect(cw / 2 - 60 + s * 10, ch - 10 - s * 9, 120 - s * 20, 9); return; }
      var n = Math.max(1, Math.floor(w / 3.2)), wy = ch * (front ? 0.36 : 0.28), wh = ch * 0.4;
      for (var i = 0; i < n; i++) {
        var wx = (i + 0.5) * cw / n - 22;
        if (front && b.door && i === Math.floor(n / 2)) continue;
        c.fillStyle = '#fff'; c.fillRect(wx - 3, wy - 3, 50, wh + 6);
        c.fillStyle = b.id === 'barracks' || b.id === 'mess' ? '#f6d27a' : '#86a0b8'; c.fillRect(wx, wy, 44, wh);
        c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(wx + 21, wy, 2, wh); c.fillRect(wx, wy + wh / 2, 44, 2);
        if (b.id === 'barracks' && i % 3 === 1) { c.fillStyle = '#f1c7a1'; c.beginPath(); c.arc(wx + 12, wy + wh - 6, 8, Math.PI, 0); c.fill(); c.fillStyle = '#222'; c.fillRect(wx + 8, wy + wh - 11, 2, 2); c.fillRect(wx + 14, wy + wh - 11, 2, 2); }
      }
      if (!front) return;
      if (b.door) {
        var dx = cw / 2 - 26;
        c.fillStyle = '#4f5d3c'; c.fillRect(dx, ch * 0.3, 52, ch * 0.7 - 8);
        c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(dx + 42, ch * 0.66, 3.5, 0, 7); c.fill();
      }
      c.font = (b.id === 'barracks' ? 30 : 24) + 'px ' + TITLE; c.textAlign = 'center'; c.textBaseline = 'middle';
      var tw = c.measureText(b.name).width + 26, sh = ch * 0.2, sy = ch * 0.06 + 10;
      c.fillStyle = '#2f3a25'; rr(c, cw / 2 - tw / 2, sy, tw, sh, 6); c.fill();
      c.fillStyle = '#f2ecd8'; c.fillText(b.name, cw / 2, sy + sh / 2 + 1);
      if (b.sign) {
        c.font = '18px ' + FONT; var sw = c.measureText(b.sign).width + 16, sx = cw / 2 + tw / 2 + 8;
        c.fillStyle = '#fff6c9'; rr(c, sx, sy + 4, sw, sh - 8, 4); c.fill(); c.strokeStyle = '#8a7a3a'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#4a3f1a'; c.fillText(b.sign, sx + sw / 2, sy + sh / 2 + 1);
      }
    });
  }
  function buildBuilding(b) {
    var w = b.w * U, d = b.h * U, h = BH[b.id] || 2.6, g = new T.Group();
    var side = new T.MeshLambertMaterial({ map: wallTex(b, d, h, false) }), plain = new T.MeshLambertMaterial({ color: b.wallc }), front = new T.MeshLambertMaterial({ map: wallTex(b, w, h, true) }), roofMat = matV.clone();
    var walls = new T.Mesh(new T.BoxGeometry(w, h, d), [side, side, plain, plain, front, plain]);
    bld3.push({ b: b, mats: [side, plain, front, roofMat], op: 1 });
    walls.position.y = h / 2; g.add(walls);
    var parts, x;
    if (b.id === 'stand') {
      parts = [[box(w + 0.3, 0.18, d + 0.3, { y: h + 0.09 }), '#f6f9fc'], [box(1.6, 1.1, 0.8, { y: h + 0.55, z: -0.4 }), '#7a6a52'], [box(1.7, 0.14, 0.9, { y: h + 1.15, z: -0.4 }), '#f6f9fc']];
      for (x = -w / 2 + 0.3; x <= w / 2; x += 1.2) parts.push([cyl(0.05, 0.05, 0.8, { x: x, y: h + 0.4, z: d / 2 - 0.15 }, 5), '#d0d0c8']);
      parts.push([box(w, 0.06, 0.06, { y: h + 0.8, z: d / 2 - 0.15 }), '#d0d0c8']);
    } else {
      var ridge = Math.min(d * 0.34, 2.8);
      var k = 0.66;
      parts = [[box(w + 0.5, 0.18, d + 0.5, { y: h + 0.05 }), '#5d564b'], [prism(w + 0.8, ridge, d + 1.1, { y: h + 0.1 }), b.roof],
        [prism(w + 0.5, ridge * k, (d + 1.1) * k, { y: h + 0.1 + ridge * (1 - k) + 0.07 }), '#f5f8fc'], [box(w + 0.86, 0.14, 0.16, { y: h + 0.1 + ridge, z: 0 }), '#4a4438']];
      for (var i = 0; i < 6; i++) parts.push([sph(0.32 + hash(i, b.x) * 0.3, { s: [1.9, 0.5, 1], x: (hash(i, 3) - 0.5) * (w - 1.5), y: h + 0.1 + ridge * (1 - k) + 0.12, z: (d + 1.1) * k / 2 - 0.1 }), '#fbfdff']);
      var tile = new T.Color(b.roof).multiplyScalar(0.78).getStyle();
      for (x = -w / 2; x < w / 2; x += 0.9) parts.push([box(0.06, 0.05, (d + 1.1) * (1 - k) / 2 * 1.25, { rx: -Math.atan(ridge / ((d + 1.1) / 2)), x: x, y: h + 0.1 + ridge * (1 - k) * 0.5 + 0.03, z: (d + 1.1) / 2 - (d + 1.1) * (1 - k) / 4 }), tile]);
      for (x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.45 + hash(x * 10 | 0, 5) * 0.5) parts.push([cone(0.07, 0.3 + hash(x * 10 | 0, 6) * 0.45, { rx: Math.PI, x: x, y: h + 0.02, z: d / 2 + 0.42 }, 5), '#dcefff']);
    }
    g.add(mesh(merge(parts), roofMat));
    g.position.set(b.x * U + w / 2, 0, b.y * U + d / 2);
    return g;
  }
  function buildTank(t, k) {
    var w = t.w * U, d = t.h * U, parts = [
      [box(w, 0.9, d * 0.62, { y: 0.75 }), '#5d6c3a'], [box(w + 0.3, 0.75, 0.9, { y: 0.4, z: d / 2 - 0.45 }), '#2c2e29'], [box(w + 0.3, 0.75, 0.9, { y: 0.4, z: -d / 2 + 0.45 }), '#2c2e29'],
      [box(w * 0.48, 0.8, d * 0.5, { y: 1.55, x: -0.3 }), '#667744'], [cyl(0.15, 0.17, 4.2, { rz: Math.PI / 2, x: w * 0.25 + 1.6, y: 1.65 }), '#4d5a30'],
      [sph(0.9, { s: [1.3, 0.3, 1], y: 1.98, x: -0.6 }), '#f7fafd'], [box(0.9, 0.5, 0.5, { y: 1.3, x: -w / 2 + 0.8, z: d * 0.25 }), '#3f4a28'],
      [box(w * 0.92, 0.06, 0.12, { y: 1.22, z: d * 0.31 }), '#e2b33c']
    ];
    for (var i = -2; i <= 2; i++) parts.push([cyl(0.36, 0.36, 0.95, { rx: Math.PI / 2, x: i * w / 5.5, y: 0.38, z: d / 2 - 0.45 }), '#1d1e1b'], [cyl(0.36, 0.36, 0.95, { rx: Math.PI / 2, x: i * w / 5.5, y: 0.38, z: -d / 2 + 0.45 }), '#1d1e1b']);
    // 띨빵한 눈
    var ex = -0.3, ez = d * 0.25 + 0.02;
    parts.push([sph(0.42, { x: ex - 0.55, y: 1.6, z: ez }), '#ffffff'], [sph(0.34, { x: ex + 0.55, y: 1.62, z: ez }), '#ffffff'],
      [sph(0.2, { x: ex - 0.5 + (k ? 0.12 : -0.05), y: 1.5, z: ez + 0.3 }), '#111'], [sph(0.16, { x: ex + 0.62, y: 1.7, z: ez + 0.26 }), '#111']);
    var m = mesh(merge(parts)); m.position.set(t.x * U + w / 2, 0, t.y * U + d / 2); return m;
  }
  function treeGeo() {
    return merge([[cyl(0.18, 0.24, 1.1, { y: 0.55 }), '#6b4a32'],
      [cone(1.5, 1.6, { y: 1.6 }, 8), '#2d4a35'], [cone(1.15, 1.4, { y: 2.45 }, 8), '#335a3e'], [cone(0.8, 1.2, { y: 3.25 }, 8), '#3a6545'],
      [cone(1.05, 0.7, { y: 2.05 }, 8), '#f4f8fc'], [cone(0.8, 0.6, { y: 2.85 }, 8), '#f4f8fc'], [cone(0.5, 0.6, { y: 3.65 }, 8), '#f8fbfe']]);
  }
  function buildTrees() {
    var list = S.TREES.map(function (t, k) { return [t[0] * U, t[1] * U, 1.35 + hash(k, 21) * 0.35]; });
    for (var i = 0; i < 130; i++) {
      var side = i % 4, x, z;
      if (side === 0) { x = -2 - hash(i, 1) * 16; z = hash(i, 2) * 128 - 4; } else if (side === 1) { x = 82 + hash(i, 1) * 16; z = hash(i, 2) * 128 - 4; }
      else if (side === 2) { x = hash(i, 1) * 96 - 8; z = -2 - hash(i, 2) * 12; } else { x = hash(i, 1) * 96 - 8; z = 122 + hash(i, 2) * 12; }
      list.push([x, z, 1.1 + hash(i, 3) * 0.9]);
    }
    var im = new T.InstancedMesh(treeGeo(), matV, list.length), m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    list.forEach(function (t, k) { e.set(0, hash(k, 9) * 6, 0); q.setFromEuler(e); m.compose(new T.Vector3(t[0], 0, t[1]), q, new T.Vector3(t[2], t[2], t[2])); im.setMatrixAt(k, m); });
    return im;
  }
  function flagTex() {
    return canvasTex(150, 100, function (c) {
      c.fillStyle = '#fff'; c.fillRect(0, 0, 150, 100);
      c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(75, 50, 25, Math.PI, 0); c.fill();
      c.fillStyle = '#0047a0'; c.beginPath(); c.arc(75, 50, 25, 0, Math.PI); c.fill();
      c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(62.5, 50, 12.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0047a0'; c.beginPath(); c.arc(87.5, 50, 12.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111';
      [[22, 18, -0.6], [128, 18, 0.6], [22, 82, 0.6], [128, 82, -0.6]].forEach(function (p) { c.save(); c.translate(p[0], p[1]); c.rotate(p[2]); for (var i = -1; i <= 1; i++) c.fillRect(-10, i * 6 - 2, 20, 4); c.restore(); });
    });
  }
  function textTex(text, opt) {
    opt = opt || {};
    var size = opt.size || 40, pad = 14;
    var c0 = document.createElement('canvas').getContext('2d'); c0.font = size + 'px ' + (opt.font || FONT);
    var w = Math.ceil(c0.measureText(text).width) + pad * 2, h = size + pad * 2;
    return canvasTex(w, h, function (c) {
      c.fillStyle = opt.bg || '#fff6c9'; rr(c, 2, 2, w - 4, h - 4, 8); c.fill(); c.strokeStyle = opt.border || '#6b5a2a'; c.lineWidth = 4; c.stroke();
      c.font = size + 'px ' + (opt.font || FONT); c.fillStyle = opt.color || '#3a3018'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2);
    });
  }
  function buildDecor() {
    var g = new T.Group(), parts = [];
    S.DECOR.forEach(function (o) {
      var x = o.x * U, z = (o.y || 0) * U;
      if (o.t === 'lamp') {
        parts.push([cyl(0.07, 0.09, 3.2, { x: x, y: 1.6, z: z }), '#3b4148'], [sph(0.24, { x: x, y: 3.25, z: z }), '#fff0b8'], [sph(0.22, { s: [1, 0.4, 1], x: x, y: 3.5, z: z }), '#f7fafd']);
      } else if (o.t === 'flag') {
        parts.push([cyl(0.06, 0.08, 5.5, { x: x, y: 2.75, z: z }), '#d9dde0'], [sph(0.13, { x: x, y: 5.55, z: z }), '#e2b33c'], [cyl(0.4, 0.5, 0.3, { x: x, y: 0.15, z: z }), '#9aa0a5']);
        var fm = new T.Mesh(new T.PlaneGeometry(2.1, 1.4, 8, 1), new T.MeshLambertMaterial({ map: flagTex(), side: T.DoubleSide }));
        fm.position.set(x + 1.07, 4.75, z); g.add(fm); flagMesh = fm;
      } else if (o.t === 'snowman') {
        parts.push([sph(0.9, { x: x, y: 0.8, z: z }), '#fbfdff'], [sph(0.62, { x: x, y: 1.95, z: z }), '#fbfdff'], [sph(0.64, { s: [1, 0.55, 1], x: x, y: 2.3, z: z }), '#39422c'],
          [sph(0.15, { x: x - 0.22, y: 2.05, z: z + 0.55 }), '#fff'], [sph(0.1, { x: x - 0.2, y: 2.03, z: z + 0.68 }), '#111'], [sph(0.11, { x: x + 0.24, y: 2.08, z: z + 0.55 }), '#fff'], [sph(0.07, { x: x + 0.25, y: 2.09, z: z + 0.65 }), '#111'],
          [cone(0.1, 0.55, { rx: Math.PI / 2, x: x, y: 1.9, z: z + 0.85 }, 6), '#e98a2c'], [cyl(0.03, 0.03, 1.1, { rz: 1.1, x: x - 0.95, y: 1.6, z: z }), '#6b4a32'], [cyl(0.03, 0.03, 1.1, { rz: -1.2, x: x + 0.95, y: 1.7, z: z }), '#6b4a32']);
      } else if (o.t === 'net') {
        var y1 = o.y1 * U, y2 = o.y2 * U;
        parts.push([cyl(0.06, 0.06, 1.3, { x: x, y: 0.65, z: y1 }), '#ddd'], [cyl(0.06, 0.06, 1.3, { x: x, y: 0.65, z: y2 }), '#ddd'], [box(0.04, 0.06, y2 - y1, { x: x, y: 1.25, z: (y1 + y2) / 2 }), '#f2f2f2']);
        var nt = canvasTex(64, 32, function (c) { c.strokeStyle = 'rgba(30,30,30,.8)'; c.lineWidth = 2; for (var i = 0; i < 64; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 32); c.stroke(); } for (var j = 0; j < 32; j += 8) { c.beginPath(); c.moveTo(0, j); c.lineTo(64, j); c.stroke(); } }, true);
        nt.repeat.set((y2 - y1) / 1.2, 1);
        var nm = new T.Mesh(new T.PlaneGeometry(y2 - y1, 0.6), new T.MeshBasicMaterial({ map: nt, transparent: true, side: T.DoubleSide, depthWrite: false }));
        nm.rotation.y = Math.PI / 2; nm.position.set(x, 0.92, (y1 + y2) / 2); g.add(nm);
      } else if (o.t === 'bins') {
        for (var b = 0; b < 3; b++) parts.push([cyl(0.42, 0.38, 0.95, { x: x + b * 1.0, y: 0.48, z: z }), '#3f7a4a'], [cyl(0.46, 0.46, 0.12, { x: x + b * 1.0, y: 1.0, z: z }), '#2f5f3a'], [sph(0.3, { s: [1, 0.4, 1], x: x + b * 1.0, y: 1.1, z: z }), '#f7fafd']);
      } else if (o.t === 'barrier') {
        parts.push([box(0.4, 1.1, 0.4, { x: x - 2.6, y: 0.55, z: z }), '#c8c8c0']);
        var arm = new T.Group(), ap = [];
        for (var s = 0; s < 6; s++) ap.push([box(0.85, 0.16, 0.16, { x: 0.45 + s * 0.85, y: 0, z: 0 }), s % 2 ? '#ffffff' : '#d23a2a']);
        arm.add(mesh(merge(ap))); arm.position.set(x - 2.6, 1.0, z); g.add(arm); barrierArm = arm;
      } else if (o.t === 'sign') {
        parts.push([cyl(0.06, 0.06, 1.6, { x: x, y: 0.8, z: z }), '#6b4a32']);
        var tt = textTex(o.text, { size: 34 }), sw = tt.image.width / 60, sh = tt.image.height / 60;
        var sm = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshLambertMaterial({ map: tt })); sm.position.set(x, 1.6 + sh / 2, z + 0.06); g.add(sm);
      }
    });
    g.add(mesh(merge(parts)));
    return g;
  }
  function buildLocks() {
    if (lockGroup) scene.remove(lockGroup);
    lockGroup = new T.Group();
    zoneLabels.forEach(function (l) { l.el.remove(); }); zoneLabels = [];
    S.ZONES.forEach(function (Z, zi) {
      if (world.zoneOpen[zi]) return;
      var x0 = Z.x * U, z0 = Z.y * U, x1 = (Z.x + Z.w) * U, z1 = (Z.y + Z.h) * U, parts = [], tape = [];
      var posts = [];
      for (var x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 5))) { posts.push([x, z0]); posts.push([x, z1]); }
      for (var z = z0; z <= z1 + 0.01; z += (z1 - z0) / Math.max(1, Math.round((z1 - z0) / 5))) { posts.push([x0, z]); posts.push([x1, z]); }
      posts.forEach(function (p) { parts.push([cyl(0.08, 0.1, 1.2, { x: p[0], y: 0.6, z: p[1] }, 6), '#e98a2c'], [cyl(0.11, 0.11, 0.18, { x: p[0], y: 1.0, z: p[1] }, 6), '#fff']); });
      [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]].forEach(function (s) {
        var len = Math.hypot(s[2] - s[0], s[3] - s[1]), n = Math.floor(len / 0.8);
        for (var k = 0; k < n; k++) {
          var t0 = (k + 0.5) / n, horiz = s[1] === s[3];
          tape.push([box(horiz ? len / n : 0.05, 0.16, horiz ? 0.05 : len / n, { x: s[0] + (s[2] - s[0]) * t0, y: 0.95, z: s[1] + (s[3] - s[1]) * t0 }), k % 2 ? '#222' : '#f2c230']);
        }
      });
      lockGroup.add(mesh(merge(parts.concat(tape))));
      var el = document.createElement('div'); el.className = 'ov-zone';
      el.innerHTML = '<b>' + Z.name + '</b><span><i class="pie"></i>' + fmt(Z.cost) + '</span><small>출입 통제 · 보급·인력에서 확장</small>';
      ov.appendChild(el);
      zoneLabels.push({ el: el, x: (Z.x + Z.w / 2), y: Z.y + Z.h / 2 });
    });
    scene.add(lockGroup);
  }

  /* ── 눈 집하장·공장·릴레이 ── */
  var dumpGroup = null, piles = {}, pileLevel = { main: 0.6, relay: 0.4 }, relayCrew = [], arrowEl = null, dumpRings = [];
  // 집하장 자리는 눈을 치워 둔 마당
  function carveDumps() {
    world.dumps.forEach(function (d) {
      for (var gy = Math.floor((d.y - d.r - 10) / CELL); gy <= Math.ceil((d.y + d.r + 10) / CELL); gy++) for (var gx = Math.floor((d.x - d.r - 10) / CELL); gx <= Math.ceil((d.x + d.r + 10) / CELL); gx++) {
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        var cx = gx * CELL + 5, cy = gy * CELL + 5, k = Math.hypot(cx - d.x, cy - d.y);
        if (k < d.r + 6 && world.zone[gy * GW + gx] < 0) baseH[gy * GW + gx] = k < d.r ? -0.1 : 0.15;
      }
    });
  }
  function buildDumps() {
    if (dumpGroup) scene.remove(dumpGroup);
    dumpGroup = new T.Group(); piles = {}; relayCrew = []; dumpRings = [];
    var save = world.save;
    world.dumps.forEach(function (d) {
      var x = d.x * U, z = d.y * U, r = d.r * U, parts = [];
      // 바닥 테두리(나무 판자)와 표지판
      for (var a = 0; a < 16; a++) { var an = a / 16 * Math.PI * 2; parts.push([box(0.7, 0.35, 0.18, { ry: -an, x: x + Math.cos(an) * r, y: 0.17, z: z + Math.sin(an) * r }), a % 2 ? '#8a6a44' : '#a07c50']); }
      parts.push([cyl(0.07, 0.07, 2.2, { x: x - r - 0.3, y: 1.1, z: z + r * 0.4 }), '#6b4a32']);
      dumpGroup.add(mesh(merge(parts)));
      var ring = new T.Mesh(new T.RingGeometry(r * 0.92, r * 1.05, 40), new T.MeshBasicMaterial({ color: d.main ? '#ffd24a' : '#9fd3ff', transparent: true, opacity: 0.7, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.05, z); dumpGroup.add(ring); dumpRings.push(ring);
      var tt = textTex(d.main ? '눈 집하장' : '양동이 릴레이', { size: 40, bg: d.main ? '#2f3a25' : '#fff6c9', color: d.main ? '#f2ecd8' : '#3a3018', border: d.main ? '#1a2214' : '#6b5a2a' });
      var sm = new T.Mesh(new T.PlaneGeometry(tt.image.width / 52, tt.image.height / 52), new T.MeshLambertMaterial({ map: tt })); sm.position.set(x - r - 0.3, 2.3, z + r * 0.4 + 0.06); dumpGroup.add(sm);
      var pile = new T.Mesh(geos.pile || (geos.pile = merge([[sph(1, { s: [1, 0.55, 1] }), '#f7fafd'], [sph(0.6, { s: [1, 0.6, 1], x: 0.5, y: 0.2, z: -0.3 }), '#ffffff'], [sph(0.5, { s: [1, 0.6, 1], x: -0.5, y: 0.15, z: 0.35 }), '#eef3f8']])), matV);
      pile.position.set(x, 0, z); dumpGroup.add(pile); piles[d.main ? 'main' : d.zone] = { m: pile, r: r, main: d.main };
      if (!d.main) {
        for (var c = 0; c < 3; c++) {
          var o = makePerson({ coat: '#5b6a3a', face: 'hoobae', tool: null, scale: 1.1 });
          o.g.position.set(x + r + 0.6 + c * 1.1, 0, z - 0.4 + c * 0.6); o.body.rotation.y = -0.6; scene.remove(o.g); dumpGroup.add(o.g); relayCrew.push(o);
        }
      }
    });
    // 공장: 압축기와 눈조각 작업장 (집하장 옆)
    var mx = S.DUMP.x * U, mz = S.DUMP.y * U, press = G.procLvl(save, 'press'), sculpt = G.procLvl(save, 'sculpt'), fp = [];
    if (press) {
      fp.push([box(2.2, 1.4, 1.6, { x: mx + 4, y: 0.7, z: mz - 1 }), '#6b7a8a'], [box(0.9, 1.6, 0.9, { x: mx + 4, y: 2.1, z: mz - 1 }), '#8a98a6'], [box(2.6, 0.12, 1.9, { x: mx + 4, y: 1.45, z: mz - 1 }), '#e2b33c']);
      var bricks = Math.min(14, 2 + press * 2 + Math.floor((save.made.brick || 0) / 50));
      for (var b = 0; b < bricks; b++) fp.push([box(0.7, 0.35, 0.4, { x: mx + 3 + (b % 4) * 0.75, y: 0.18 + Math.floor(b / 8) * 0.36, z: mz + 1.0 + (Math.floor(b / 4) % 2) * 0.45 }), '#f2f6fa']);
    }
    if (sculpt) {
      var men = Math.min(5, sculpt + Math.floor((save.made.snowman || 0) / 20));
      for (var sIdx = 0; sIdx < men; sIdx++) {
        var sx = mx - 3.5 - sIdx * 1.6, sz = mz + 2.6;
        fp.push([sph(0.75, { x: sx, y: 0.7, z: sz }), '#fbfdff'], [sph(0.5, { x: sx, y: 1.6, z: sz }), '#fbfdff']);
        var gsc = 0.5 / HR, gen = new T.Mesh(faceGeo(), faceMat('general', 'normal')); gen.scale.setScalar(gsc); gen.position.set(sx, 1.6 - HY * gsc, sz); dumpGroup.add(gen);
      }
      var st = textTex('사단장님 환영', { size: 34 }); var sp2 = new T.Mesh(new T.PlaneGeometry(st.image.width / 60, st.image.height / 60), new T.MeshLambertMaterial({ map: st })); sp2.position.set(mx - 4.5, 2.7, mz + 2.2); dumpGroup.add(sp2);
    }
    if (fp.length) dumpGroup.add(mesh(merge(fp)));
    scene.add(dumpGroup);
  }
  function stepDumps(dt) {
    var t = performance.now() / 1000;
    pileLevel.main = Math.max(0.6, Math.min(2.4, pileLevel.main - dt * 0.03)); pileLevel.relay = Math.max(0.4, Math.min(1.5, pileLevel.relay - dt * 0.05));
    Object.keys(piles).forEach(function (k) { var p = piles[k], lv = p.main ? pileLevel.main : pileLevel.relay, s = p.r * 0.55 * (0.7 + lv * 0.35); p.m.scale.set(s, s * (0.6 + lv * 0.25), s); });
    relayCrew.forEach(function (o, i) { o.body.rotation.z = Math.sin(t * 6 + i * 2) * 0.35; o.body.position.y = Math.abs(Math.sin(t * 6 + i * 2)) * 0.15; });
    var hot = world && world.player.load > 0;
    dumpRings.forEach(function (r) { r.material.opacity = hot ? 0.55 + Math.sin(t * 6) * 0.35 : 0.35; r.scale.setScalar(hot ? 1 + Math.sin(t * 6) * 0.04 : 1); });
  }
  // 짐이 많으면 가장 가까운 집하장 쪽 화살표
  function stepArrow() {
    if (!arrowEl) { arrowEl = document.createElement('div'); arrowEl.id = 'arrow3d'; arrowEl.innerHTML = '<svg viewBox="0 0 40 40"><path d="M6 20h20M20 10l10 10-10 10" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 20h20M20 10l10 10-10 10" stroke="#ff6a55" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; ov.appendChild(arrowEl); }
    var P = world.player, show = mode === 'play' && P.load >= P.cap * 0.6;
    arrowEl.style.display = show ? '' : 'none';
    if (!show) return;
    var d = G.nearestDump(world, P.x, P.y);
    if (isFP()) {
      var vx = d.x - P.x, vy = d.y - P.y, fwd = vx * Math.sin(fpYaw) + vy * Math.cos(fpYaw), rt = -vx * Math.cos(fpYaw) + vy * Math.sin(fpYaw);
      if (Math.hypot(vx, vy) < d.r + 4) { arrowEl.style.display = 'none'; return; }
      var an = Math.atan2(-fwd, rt), rad = 78 + Math.sin(performance.now() / 160) * 5;
      arrowEl.style.transform = 'translate(' + (vw / 2 + Math.cos(an) * rad).toFixed(1) + 'px,' + (vh / 2 + Math.sin(an) * rad).toFixed(1) + 'px) rotate(' + an.toFixed(3) + 'rad)';
      return;
    }
    var a = project(P.x, P.y, 2.2), b = project(d.x, d.y, 0.5), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    var dist = Math.hypot(b[0] - a[0], b[1] - a[1]); if (dist < 50) { arrowEl.style.display = 'none'; return; }
    var rr2 = 64 + Math.sin(performance.now() / 160) * 6;
    arrowEl.style.transform = 'translate(' + (a[0] + Math.cos(ang) * rr2).toFixed(1) + 'px,' + (a[1] + Math.sin(ang) * rr2).toFixed(1) + 'px) rotate(' + ang.toFixed(3) + 'rad)';
  }

  /* ── 사람·차·고라니 ── */
  var SKINS = ['#ffd9b5', '#f6c79c', '#eab386', '#f9d2a8'], HY = 1.98, HR = 0.56;
  function faceBase(key) { return S.FACES[key] || (JY.CHARS && JY.CHARS[key] && JY.CHARS[key].spec) || S.FACES.me; }
  function skinOf(key) { var sp = faceBase(key); return sp.skin || SKINS[JY.art ? JY.art.hash(sp.seed || sp.name || key) % SKINS.length : 0]; }
  function hatParts(hat, coat) {
    var y = HY, parts = [];
    if (hat === 'helmet') parts.push([P(new T.SphereGeometry(HR + 0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { s: [1.05, 0.82, 1.05], y: y + 0.06 }), '#4e5a33'], [cyl(HR + 0.16, HR + 0.16, 0.08, { y: y + 0.05 }, 18), '#3f4a28'], [box(0.5, 0.06, 0.02, { y: y + 0.42, z: HR + 0.02, rx: -0.5 }), '#d6cf9a']);
    else if (hat === 'beanie') parts.push([P(new T.SphereGeometry(HR + 0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { y: y + 0.02 }), '#39422c'], [box(0.2, 0.42, 0.34, { x: -HR - 0.02, y: y - 0.16 }), '#39422c'], [box(0.2, 0.42, 0.34, { x: HR + 0.02, y: y - 0.16 }), '#39422c'], [box(0.62, 0.08, 0.2, { y: y + 0.1, z: HR - 0.02, rx: 0.25 }), '#2c3322']);
    else if (hat === 'cap' || hat === 'reserve') { var cc = hat === 'cap' ? '#4a5530' : '#6a6c4c'; parts.push([P(new T.SphereGeometry(HR + 0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { s: [1, 0.62, 1], y: y + 0.14 }), cc], [cyl(HR + 0.06, HR + 0.06, 0.16, { y: y + 0.14 }, 18), cc], [box(0.62, 0.05, 0.38, { y: y + 0.1, z: HR + 0.12 }), cc]); if (hat === 'reserve') parts.push([box(0.16, 0.12, 0.04, { y: y + 0.32, z: HR + 0.04 }), '#c9a43a']); else parts.push([box(0.12, 0.12, 0.04, { y: y + 0.32, z: HR + 0.05 }), '#d0b45a']); }
    else if (hat === 'chef') parts.push([cyl(0.44, 0.42, 0.5, { y: y + 0.55 }, 16), '#ffffff'], [sph(0.52, { s: [1, 0.7, 1], y: y + 0.88 }, 14, 8), '#ffffff'], [cyl(0.47, 0.47, 0.1, { y: y + 0.32 }, 16), '#e7e2d6']);
    else parts.push([P(new T.SphereGeometry(HR + 0.01, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), { y: y + 0.01 }), '#3b3128']);
    return parts;
  }
  function bodyGeo(coat, hat, skin) {
    var k = 'body:' + coat + ':' + hat + ':' + skin; if (geos[k]) return geos[k];
    var dark = new T.Color(coat).multiplyScalar(0.72).getStyle(), light = new T.Color(coat).lerp(new T.Color('#b5a978'), 0.4).getStyle(), parts = [
      [box(0.26, 0.2, 0.42, { x: -0.17, y: 0.1, z: 0.05 }), '#26291f'], [box(0.26, 0.2, 0.42, { x: 0.17, y: 0.1, z: 0.05 }), '#26291f'],
      [P(new T.CapsuleGeometry(0.14, 0.32, 4, 8), { x: -0.17, y: 0.42 }), '#3d4628'], [P(new T.CapsuleGeometry(0.14, 0.32, 4, 8), { x: 0.17, y: 0.42 }), '#3d4628'],
      [P(new T.CapsuleGeometry(0.38, 0.4, 6, 12), { s: [1.05, 1, 0.88], y: 1.0 }), coat], [cyl(0.4, 0.4, 0.09, { y: 0.74 }, 14), '#3a3a2a'], [box(0.12, 0.1, 0.04, { y: 0.74, z: 0.36 }), '#c9a43a'],
      [P(new T.CapsuleGeometry(0.11, 0.36, 4, 8), { rx: -1.05, x: -0.42, y: 1.12, z: 0.22 }), coat], [P(new T.CapsuleGeometry(0.11, 0.36, 4, 8), { rx: -1.05, x: 0.42, y: 1.12, z: 0.22 }), coat],
      [sph(0.13, { x: -0.36, y: 0.92, z: 0.52 }), skin], [sph(0.13, { x: 0.36, y: 0.92, z: 0.52 }), skin],
      [sph(HR, { y: HY }, 20, 14), skin], [sph(0.12, { s: [0.6, 1, 1], x: -HR, y: HY - 0.04 }), skin], [sph(0.12, { s: [0.6, 1, 1], x: HR, y: HY - 0.04 }), skin]];
    if (coat !== '#e9e6dc') for (var i = 0; i < 9; i++) { var a = hash(i, coat.length) * 6.28; parts.push([sph(0.12 + hash(i, 2) * 0.07, { s: [1, 0.6, 0.3], x: Math.cos(a) * 0.4, y: 0.82 + hash(i, 5) * 0.5, z: Math.sin(a) * 0.36 }), i % 2 ? dark : light]); }
    parts = parts.concat(hatParts(hat, coat));
    return (geos[k] = merge(parts));
  }
  function toolGeo(kind, r) {
    var k = 'tool:' + kind + ':' + Math.round(r); if (geos[k]) return geos[k];
    var bw = Math.min(3.4, 0.8 + r * U * 1.7), handle = [cyl(0.04, 0.04, 1.35, { rx: 1.15, y: 0.62, z: 1.0 }, 6), '#8a6a44'], parts;
    if (kind === 'broom') parts = [handle, [cone(0.32, 0.55, { rx: -1.9, y: 0.2, z: 1.66 }, 8), '#c9a66b']];
    else if (kind === 'shovel') parts = [handle, [box(0.42, 0.06, 0.5, { rx: 0.3, y: 0.16, z: 1.66 }), '#8f979c']];
    else if (kind === 'twin') parts = [[cyl(0.04, 0.04, 1.35, { rx: 1.15, ry: 0.45, y: 0.62, z: 1.0 }, 6), '#8a6a44'], [box(bw * 0.7, 0.42, 0.08, { ry: 0.45, y: 0.24, z: 1.58, x: 0.65 }), '#e7ae2f'],
      [cyl(0.04, 0.04, 1.35, { rx: 1.15, ry: -0.45, y: 0.62, z: 1.0 }, 6), '#8a6a44'], [box(bw * 0.7, 0.42, 0.08, { ry: -0.45, y: 0.24, z: 1.58, x: -0.65 }), '#e7ae2f']];
    else if (kind === 'cart') parts = [[box(1.0, 0.6, 0.9, { y: 0.45, z: 1.1 }), '#5d6f86'], [box(bw, 0.5, 0.1, { y: 0.25, z: 1.65 }), '#f0b429'], [cyl(0.2, 0.2, 0.1, { rz: Math.PI / 2, x: -0.55, y: 0.2, z: 0.85 }), '#222'], [cyl(0.2, 0.2, 0.1, { rz: Math.PI / 2, x: 0.55, y: 0.2, z: 0.85 }), '#222']];
    else if (kind === 'salt') parts = [[cyl(0.3, 0.3, 0.75, { y: 1.1, z: -0.5 }), '#3c6f9c'], [cyl(0.03, 0.03, 0.8, { rx: 1.3, x: 0.45, y: 0.95, z: 0.35 }, 6), '#555'], [sph(0.1, { x: 0.45, y: 0.75, z: 0.8 }), '#9fd0ff']];
    else parts = [handle, [box(bw, 0.42, 0.08, { y: 0.24, z: 1.66 }), '#e7ae2f'], [box(bw, 0.06, 0.1, { y: 0.05, z: 1.68 }), '#555']];
    return (geos[k] = merge(parts));
  }
  function vehicleGeo(kind) {
    var k = 'veh:' + kind; if (geos[k]) return geos[k];
    var parts;
    if (kind === 'heli') {
      parts = [[sph(1.3, { s: [1, 0.75, 1.5], y: 1.3 }), '#4c5a35'], [sph(0.85, { s: [1, 0.8, 1], y: 1.5, z: 1.0 }), '#9cc3dc'], [cyl(0.18, 0.12, 3.2, { rx: Math.PI / 2, y: 1.6, z: -2.6 }), '#4c5a35'],
        [box(0.1, 0.9, 0.6, { y: 1.9, z: -4.1 }), '#4c5a35'], [box(0.12, 0.08, 3.2, { x: -0.9, y: 0.2 }), '#333'], [box(0.12, 0.08, 3.2, { x: 0.9, y: 0.2 }), '#333'],
        [cyl(0.05, 0.05, 0.7, { x: -0.9, y: 0.55 }), '#333'], [cyl(0.05, 0.05, 0.7, { x: 0.9, y: 0.55 }), '#333'], [cyl(0.08, 0.08, 0.5, { y: 2.45 }), '#222'], [box(6.5, 0.05, 0.28, { y: 2.7 }), '#2a2a2a'], [box(0.28, 0.05, 6.5, { y: 2.72 }), '#2a2a2a']];
    } else {
      var L = kind === 'truck' ? 4.6 : kind === 'car' ? 3.6 : 3.4, Wd = kind === 'truck' ? 2.3 : 1.9, body = kind === 'plow' ? '#e0a526' : kind === 'truck' ? '#55603a' : kind === 'car' ? '#4f5d36' : '#3f7a3c', cz = kind === 'tractor' ? -0.4 : 0.35;
      parts = [[box(Wd, 0.9, L, { y: 0.85 }), body], [box(Wd * 0.92, 0.2, L * 0.38, { y: 2.2, z: cz }), body], [box(0.1, 0.85, 0.1, { x: -Wd * 0.44, y: 1.72, z: cz + L * 0.18 }), body], [box(0.1, 0.85, 0.1, { x: Wd * 0.44, y: 1.72, z: cz + L * 0.18 }), body],
        [box(0.1, 0.85, 0.1, { x: -Wd * 0.44, y: 1.72, z: cz - L * 0.18 }), body], [box(0.1, 0.85, 0.1, { x: Wd * 0.44, y: 1.72, z: cz - L * 0.18 }), body], [box(Wd * 0.9, 0.08, L * 0.36, { y: 1.32, z: cz }), '#2b2f24'],
        [sph(0.2, { x: -Wd * 0.3, y: 0.95, z: L / 2 + 0.02 }), '#fff6c0'], [sph(0.2, { x: Wd * 0.3, y: 0.95, z: L / 2 + 0.02 }), '#fff6c0'], [box(Wd * 0.7, 0.06, 0.04, { y: 1.15, z: L / 2 + 0.01 }), '#333']];
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) { var big = kind === 'tractor' && p[1] < 0, rr2 = big ? 0.72 : 0.45; parts.push([cyl(rr2, rr2, 0.4, { rz: Math.PI / 2, x: p[0] * (Wd / 2 + 0.05), y: rr2, z: p[1] * L * 0.32 }, 14), '#1d1d1b'], [cyl(rr2 * 0.5, rr2 * 0.5, 0.42, { rz: Math.PI / 2, x: p[0] * (Wd / 2 + 0.06), y: rr2, z: p[1] * L * 0.32 }, 10), '#8a8f94']); });
      if (kind !== 'car') parts.push([box(Math.min(5.5, Wd + 1.6 + (kind === 'truck' ? 1.4 : 0)), 0.75, 0.15, { y: 0.45, z: L / 2 + 0.5, rx: -0.15 }), '#f0b429'], [box(0.2, 0.2, 0.6, { y: 0.6, z: L / 2 + 0.2 }), '#333']);
      if (kind !== 'tractor') parts.push([box(0.5, 0.18, 0.3, { y: 2.38, z: cz }), (kind === 'car' ? '#2b5fd1' : '#ff8a2a')]);
      if (kind === 'car') parts.push([box(Wd + 0.02, 0.3, 0.5, { y: 0.9, z: -L / 2 + 0.6 }), '#f2e6c9']);
    }
    return (geos[k] = merge(parts));
  }
  function deerGeo() {
    if (geos.deer) return geos.deer;
    return (geos.deer = merge([
      [sph(0.7, { s: [0.8, 0.75, 1.5], y: 1.3 }), '#9b7653'], [sph(0.55, { s: [0.7, 0.5, 1.1], y: 1.1 }), '#c9a882'],
      [cyl(0.2, 0.26, 0.9, { rx: -0.6, y: 1.85, z: 0.8 }), '#9b7653'], [sph(0.36, { s: [0.9, 0.9, 1.15], y: 2.25, z: 1.15 }), '#a07a56'], [sph(0.2, { s: [0.9, 0.8, 1.1], y: 2.12, z: 1.48 }), '#5a4130'],
      [cone(0.17, 0.5, { rz: 0.9, x: -0.38, y: 2.6, z: 1.0 }, 6), '#8a6545'], [cone(0.17, 0.5, { rz: -0.9, x: 0.38, y: 2.6, z: 1.0 }, 6), '#8a6545'],
      [cone(0.05, 0.32, { rx: Math.PI, x: -0.1, y: 1.92, z: 1.48 }, 5), '#fffdf0'], [cone(0.05, 0.32, { rx: Math.PI, x: 0.1, y: 1.92, z: 1.48 }, 5), '#fffdf0'],
      [sph(0.15, { x: -0.22, y: 2.38, z: 1.38 }), '#fff'], [sph(0.12, { x: 0.22, y: 2.42, z: 1.38 }), '#fff'], [sph(0.08, { x: -0.2, y: 2.36, z: 1.5 }), '#111'], [sph(0.06, { x: 0.25, y: 2.44, z: 1.48 }), '#111'],
      [sph(0.18, { y: 1.5, z: -1.0 }), '#f4efe6']]));
  }
  function legGeo() { if (geos.leg) return geos.leg; return (geos.leg = merge([[cyl(0.07, 0.06, 1.0, { y: -0.5 }, 5), '#7a5a3e'], [cyl(0.075, 0.075, 0.12, { y: -1.0 }, 5), '#2a1f17']])); }
  function catGeo() {
    if (geos.cat) return geos.cat;
    return (geos.cat = merge([[sph(0.42, { s: [0.8, 0.75, 1.25], y: 0.42 }), '#e8913a'], [sph(0.34, { y: 0.88, z: 0.38 }), '#e8913a'], [sph(0.2, { s: [1.2, 0.8, 0.8], y: 0.8, z: 0.62 }), '#fff3e2'],
      [cone(0.12, 0.26, { x: -0.18, y: 1.2, z: 0.36 }, 5), '#c8762a'], [cone(0.12, 0.26, { x: 0.18, y: 1.2, z: 0.36 }, 5), '#c8762a'], [cyl(0.06, 0.04, 0.7, { rx: -0.6, y: 0.75, z: -0.65 }, 6), '#e8913a'],
      [sph(0.11, { x: -0.13, y: 0.95, z: 0.66 }), '#d9f27a'], [sph(0.09, { x: 0.14, y: 0.97, z: 0.66 }), '#d9f27a'], [box(0.03, 0.14, 0.03, { x: -0.13, y: 0.95, z: 0.76 }), '#111'], [box(0.03, 0.12, 0.03, { x: 0.14, y: 0.97, z: 0.74 }), '#111'],
      [sph(0.05, { y: 0.84, z: 0.8 }), '#e07a7a']]));
  }

  // 전역각 얼굴 → 머리 앞에 붙이는 얼굴 (구면 조각)
  function faceSpec(key, expr) {
    var base = faceBase(key), s = {}, o = {};
    Object.keys(base).forEach(function (k) { if (k !== 'prop') s[k] = base[k]; });
    s.hat = 'none'; s.hair = 'none';
    if (expr === 'hurt') { o.eyes = 'spiral'; o.mouth = 'o'; }
    else if (expr === 'sleep') { o.eyes = 'sleepy'; o.mouth = 'drool'; }
    else if (expr === 'stun') { o.eyes = 'cross'; o.mouth = 'wavy'; }
    else if (expr === 'shout') { o.brows = 'angry'; o.mouth = 'shout'; }
    return JY.art.character(s, o);
  }
  function faceGeo() {
    if (geos.face) return geos.face;
    var span = 1.9, g = new T.SphereGeometry(HR * 1.012, 24, 16, Math.PI / 2 - span / 2, span, 0.82, 1.32);
    g.translate(0, HY, 0);
    return (geos.face = g);
  }
  function faceMat(key, expr) {
    var k = 'face:' + key + ':' + expr; if (mats[k]) return mats[k];
    var c = document.createElement('canvas'); c.width = 256; c.height = 192;
    var tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
    var mat = new T.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.03 });
    mats[k] = mat;
    if (JY.art) {
      var svg = faceSpec(key, expr).replace('viewBox="0 0 200 232"', 'width="400" height="464" viewBox="0 0 200 232"');
      var img = new Image();
      img.onload = function () {
        var x = c.getContext('2d');
        x.drawImage(img, 70, 110, 260, 196, 0, 0, 256, 192);
        x.globalCompositeOperation = 'destination-in';
        var gr = x.createRadialGradient(128, 96, 40, 128, 96, 128); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.72, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.save(); x.scale(1, 0.75); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); x.restore();
        tex.needsUpdate = true;
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    return mat;
  }
  function headGroup(face, hat, scale) {
    var g = new T.Group(), skin = skinOf(face);
    var m = new T.Mesh(geos['head:' + hat + ':' + skin] || (geos['head:' + hat + ':' + skin] = merge([[sph(HR, { y: HY }, 20, 14), skin], [sph(0.12, { s: [0.6, 1, 1], x: -HR, y: HY - 0.04 }), skin], [sph(0.12, { s: [0.6, 1, 1], x: HR, y: HY - 0.04 }), skin]].concat(hatParts(hat)))), matV);
    var f = new T.Mesh(faceGeo(), faceMat(face, 'normal'));
    g.add(m); g.add(f); g.scale.setScalar(scale || 1);
    return { g: g, face: f };
  }

  function makePerson(o) {
    var g = new T.Group(), body = new T.Group();
    body.rotation.order = 'YXZ';
    var sh = new T.Mesh(geos.blob, blobMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.scale.setScalar(o.big ? 2.2 : 1); g.add(sh);
    var hat = o.hat || 'beanie', faceMesh, bm;
    if (o.vehicle) {
      bm = new T.Mesh(vehicleGeo(o.vehicle), matV); body.add(bm);
      var hd = headGroup(o.face, 'cap', 0.62); hd.g.position.set(0, o.vehicle === 'heli' ? 0.15 : 0.18, o.vehicle === 'heli' ? 1.0 : o.vehicle === 'tractor' ? -0.4 : 0.35); body.add(hd.g); faceMesh = hd.face;
    } else {
      bm = new T.Mesh(bodyGeo(o.coat, hat, skinOf(o.face)), matV); body.add(bm);
      faceMesh = new T.Mesh(faceGeo(), faceMat(o.face, 'normal')); body.add(faceMesh);
    }
    if (o.shadow && !lowFx) { bm.castShadow = true; sh.visible = false; }
    var tool = null;
    if (o.tool) { tool = new T.Mesh(toolGeo(o.tool, o.r || 10), matV); if (o.shadow) tool.castShadow = true; body.add(tool); }
    g.add(body);
    if (!o.vehicle) g.scale.setScalar(o.scale || 1.25);
    scene.add(g);
    return { g: g, body: body, tool: tool, head: faceMesh, shadow: sh, face: o.face, expr: 'normal', vehicle: o.vehicle, lie: 0 };
  }
  function setExpr(obj, expr) { if (obj.expr === expr) return; obj.expr = expr; obj.head.material = faceMat(obj.face, expr); }
  function placePerson(obj, e, opt) {
    opt = opt || {};
    var x = e.x * U, z = e.y * U, sink = snowAt(e.x, e.y) * (obj.vehicle ? 0.3 : 0.45);
    var mv = e.moving, w = e.walk || 0;
    obj.g.position.set(x, sink, z);
    obj.body.rotation.y = Math.atan2(e.dir.x, e.dir.y);
    var lie = opt.lie ? 1 : 0;
    obj.lie += (lie - obj.lie) * 0.2;
    obj.body.rotation.x = -obj.lie * 1.45;
    obj.body.position.y = obj.vehicle ? (mv ? Math.abs(Math.sin(w * 3)) * 0.05 : 0) : (mv ? Math.abs(Math.sin(w * 2)) * 0.12 : 0) + obj.lie * 0.3;
    obj.body.rotation.z = !obj.vehicle && mv ? Math.sin(w * 2) * 0.14 : 0;
    if (obj.tool) obj.tool.rotation.y = Math.sin((e.swing || 0) * Math.PI) * 0.35;
  }
  function removeObj(o) { if (o) scene.remove(o.g || o); }
  // 등에 진 마대: 짊어진 만큼 커진다
  function sack(o, k) {
    if (o.vehicle) return;
    if (!o.sack) { o.sack = new T.Mesh(geos.sack || (geos.sack = merge([[sph(0.42, { s: [1, 1.1, 0.8], y: 0 }), '#9a8a5c'], [sph(0.36, { s: [1, 0.5, 0.75], y: 0.34 }), '#fbfdff'], [cyl(0.08, 0.12, 0.15, { y: 0.5 }), '#6b5a34']])), matV); o.sack.position.set(0, 1.15, -0.5); o.body.add(o.sack); }
    o.sack.visible = k > 0.02;
    var sc = 0.45 + Math.min(1, k) * 0.85; o.sack.scale.setScalar(sc);
  }

  function playerKey() { var rd = world.act && world.act.ride, Tl = G.toolOf(world.save); return rd ? 'ride:' + rd.kind : Tl.id; }
  function buildPlayer() {
    removeObj(playerObj);
    var Tl = G.toolOf(world.save), rd = world.act && world.act.ride, veh = rd ? rd.kind : Tl.vehicle ? Tl.id : null;
    playerKind = playerKey();
    playerObj = makePerson({ coat: '#5b6a3a', face: 'me', hat: 'beanie', tool: veh ? null : Tl.aura ? 'salt' : Tl.id === 'broom' ? 'broom' : Tl.id === 'twin' ? 'twin' : Tl.id === 'cart' ? 'cart' : 'pusher', r: Tl.r, vehicle: veh, big: !!veh, shadow: true });
    var ring = new T.Mesh(new T.RingGeometry(0.75, 0.95, 24), new T.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; playerObj.g.add(ring); playerObj.ring = ring;
  }
  function buildActors() {
    [haengObj, carObj, heliObj].forEach(removeObj);
    crewObjs.forEach(removeObj); deerObjs.forEach(removeObj); catObjs.forEach(removeObj);
    crewObjs = []; deerObjs = []; catObjs = []; carObj = null; heliObj = null;
    buildPlayer();
    haengObj = makePerson({ coat: '#4b5733', face: 'haeng', hat: 'cap', tool: 'shovel', r: 10, shadow: true });
    faceMat('me', 'stun'); faceMat('haeng', 'shout');
    S.CREW.forEach(function (C) { if (world.save.crew[C.id]) { faceMat(C.face, 'hurt'); faceMat(C.face, 'sleep'); } });
    var many = world.crew.length > 24;
    world.crew.forEach(function (e) { var C = e.def; crewObjs.push(makePerson({ coat: C.coat, face: C.face, hat: C.hat, tool: C.vehicle ? null : C.id === 'cook' ? 'shovel' : C.id === 'hoobae' ? 'broom' : 'pusher', r: e.r, vehicle: C.vehicle ? 'plow' : null, big: C.vehicle, shadow: !many || C.vehicle })); });
    world.cats.forEach(function () {
      var g = new T.Group(), m = new T.Mesh(catGeo(), matV); m.castShadow = true; g.add(m); g.scale.setScalar(1.3); scene.add(g); catObjs.push(g);
    });
  }
  function makeDeer() {
    var g = new T.Group(), body = new T.Group();
    var dm = new T.Mesh(deerGeo(), matV); dm.castShadow = true; body.add(dm);
    var legs = [];
    [[-0.3, 0.75], [0.3, 0.75], [-0.3, -0.7], [0.3, -0.7]].forEach(function (p) { var l = new T.Mesh(legGeo(), matV); l.castShadow = true; l.position.set(p[0], 1.05, p[1]); body.add(l); legs.push(l); });
    g.add(body); g.scale.setScalar(1.4); scene.add(g);
    return { g: g, body: body, legs: legs };
  }

  /* ── 입자 (눈 튀김, 반짝이) ── */
  function buildParticles() {
    pPos = new Float32Array(MAXP * 3); pCol = new Float32Array(MAXP * 3); pVel = new Float32Array(MAXP * 3); pLife = new Float32Array(MAXP * 2);
    for (var i = 0; i < MAXP; i++) pPos[i * 3 + 1] = -50;
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pPos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('color', new T.BufferAttribute(pCol, 3).setUsage(T.DynamicDrawUsage));
    pts = new T.Points(geo, new T.PointsMaterial({ size: 0.42, vertexColors: true, map: mats.dot, transparent: true, depthWrite: false, alphaTest: 0.05 }));
    pts.frustumCulled = false; scene.add(pts);
    fPos = new Float32Array(NF * 3);
    for (i = 0; i < NF; i++) { fPos[i * 3] = rnd(-45, 45); fPos[i * 3 + 1] = rnd(0, 40); fPos[i * 3 + 2] = rnd(-45, 45); }
    var fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(fPos, 3).setUsage(T.DynamicDrawUsage));
    flakes = new T.Points(fg, new T.PointsMaterial({ size: 0.2, color: '#ffffff', map: mats.dot, transparent: true, depthWrite: false, opacity: 0.9 }));
    flakes.frustumCulled = false; scene.add(flakes);
  }
  function emit(x, y, z, vx, vy, vz, life, col) {
    var i = pN; pN = (pN + 1) % MAXP;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    pLife[i * 2] = 0; pLife[i * 2 + 1] = life;
    var c = col || [1, 1, 1]; pCol[i * 3] = c[0]; pCol[i * 3 + 1] = c[1]; pCol[i * 3 + 2] = c[2];
  }
  function stepParticles(dt) {
    for (var i = 0; i < MAXP; i++) {
      if (pPos[i * 3 + 1] < -40) continue;
      pLife[i * 2] += dt;
      if (pLife[i * 2] > pLife[i * 2 + 1]) { pPos[i * 3 + 1] = -50; continue; }
      pVel[i * 3 + 1] -= 14 * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pPos[i * 3 + 1] < 0.05) { pPos[i * 3 + 1] = 0.05; pVel[i * 3] *= 0.5; pVel[i * 3 + 2] *= 0.5; pVel[i * 3 + 1] = 0; }
    }
    pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true;
    var fall = world ? 2.5 + world.wx.flakes / 40 : 3, n = world ? Math.min(NF, Math.round(world.wx.flakes * 5.5)) : 300, t = performance.now() / 1000;
    for (i = 0; i < NF; i++) {
      if (i >= n) { fPos[i * 3 + 1] = -60; continue; }
      if (fPos[i * 3 + 1] < -50) fPos[i * 3 + 1] = rnd(0, 40);
      fPos[i * 3 + 1] -= fall * dt * (0.7 + (i % 7) * 0.08); fPos[i * 3] += Math.sin(t + i) * dt * 0.6;
      if (fPos[i * 3 + 1] < 0) { fPos[i * 3 + 1] = 38; fPos[i * 3] = rnd(-45, 45); fPos[i * 3 + 2] = rnd(-45, 45); }
    }
    flakes.position.set(camT.x, 0, camT.z);
    flakes.geometry.attributes.position.needsUpdate = true;
  }

  /* ── 화면 위 글자 (DOM) ── */
  function addOv(html, cls, x, y, h, life, follow) {
    if (overlays.length > 40) { var o0 = overlays.shift(); o0.el.remove(); }
    var el = document.createElement('div'); el.className = 'ov ' + (cls || ''); el.innerHTML = html; ov.appendChild(el);
    var o = { el: el, x: x, y: y, h: h || 2.5, t: 0, life: life || 1, follow: follow || null };
    var p0 = project(follow ? follow.x : x, follow ? follow.y : y, o.h);
    el.style.transform = 'translate(' + p0[0].toFixed(1) + 'px,' + p0[1].toFixed(1) + 'px) translate(-50%,-100%)'; el.style.opacity = '0';
    overlays.push(o); return o;
  }
  function project(x, y, h) { tmp.set(x * U, h, y * U).project(camera); return [(tmp.x + 1) / 2 * vw, (1 - tmp.y) / 2 * vh, tmp.z]; }
  var tmp = new T.Vector3();
  function stepOverlays(dt) {
    for (var i = overlays.length - 1; i >= 0; i--) {
      var o = overlays[i]; o.t += dt;
      if (o.t > o.life) { o.el.remove(); overlays.splice(i, 1); continue; }
      var x = o.follow ? o.follow.x : o.x, y = o.follow ? o.follow.y : o.y, p = project(x, y, o.h + o.t * (o.rise || 0));
      var a = p[2] > 1 ? 0 : Math.min(1, (o.life - o.t) * 3, o.t * 8);
      o.el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px) translate(-50%,-100%)';
      o.el.style.opacity = a.toFixed(2);
    }
    zoneLabels.forEach(function (l) {
      var p = project(l.x, l.y, 1.5), on = p[2] < 1 && (!isFP() || Math.hypot(l.x - world.player.x, l.y - world.player.y) < 230) && p[0] > 40 && p[0] < vw - 40 && p[1] > 150 && p[1] < vh - 40;
      l.el.style.display = on ? '' : 'none';
      if (on) l.el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px) translate(-50%,-50%)';
    });
  }

  /* ── 효과 처리 ── */
  var X = function () { return JY.SnowSfx; };
  function onFx() {
    var fx = world.fx, P = world.player;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i], sfx = X();
      if (f.t === 'clear') {
        var mine = f.src === 'player', heli = f.src === 'heli', n = Math.min(mine ? 9 : heli ? 6 : 3, 1 + (f.n / 2 | 0));
        for (var k = 0; k < n; k++) {
          var side = Math.random() < 0.5 ? -1 : 1, dx = mine ? P.dir.x : 0, dz = mine ? P.dir.y : 0;
          emit(f.x * U + rnd(-0.6, 0.6), 0.4, f.y * U + rnd(-0.6, 0.6), (dx * 3 + -dz * side * 4 + rnd(-1.5, 1.5)) * (heli ? 2 : 1), rnd(3, 6.5), (dz * 3 + dx * side * 4 + rnd(-1.5, 1.5)) * (heli ? 2 : 1), rnd(0.5, 0.9), mine && P.aura ? [0.75, 0.9, 1] : null);
        }
        if (mine) { if (scrapeT <= 0 && sfx) { sfx.scrape(Math.min(1, f.n / 6)); scrapeT = 0.085; } }
        else if (crewScrapeT <= 0 && sfx) { sfx.scrape(0.22); crewScrapeT = 0.22; }
      } else if (f.t === 'part') {
        var big = f.mine && f.first;
        for (k = 0; k < (big ? 90 : 40); k++) emit(f.x * U + rnd(-3, 3), 0.6, f.y * U + rnd(-3, 3), rnd(-3, 3), rnd(5, big ? 13 : 10), rnd(-3, 3), rnd(0.8, 1.6), Math.random() < 0.5 ? [1, 0.84, 0.3] : Math.random() < 0.5 ? [0.6, 0.9, 1] : [1, 1, 1]);
        var o = big ? addOv('완벽!<span>' + esc(f.name) + ' · <i class="pie"></i>+' + fmt(f.bonus) + ' · <i class="dia"></i>+1</span>', 'ov-perfect', f.x, f.y, 2.4, 2.6)
          : addOv('<b>' + esc(f.name) + ' 완료!</b><span>띵! <i class="pie"></i>+' + fmt(f.bonus) + '</span>', 'ov-part', f.x, f.y, 2, 2.2);
        o.rise = 0.6; if (big) shake = Math.max(shake, 0.25);
        if (hooks.event) hooks.event(f);
      } else if (f.t === 'zzz') {
        addOv('Zzz', 'ov-zzz', 0, 0, 3.9, 2.4, f.e);
      } else if (f.t === 'wake') {
        addOv('!!', 'ov-bang', 0, 0, 4.2, 1, f.e); shake = Math.max(shake, 0.3);
      } else if (f.t === 'chat') {
        if (overlays.filter(function (x) { return x.el.classList.contains('ov-chat'); }).length < 3) { var L = f.tired ? ['헥헥…', '힘들어요…', '초코파이 먹고 싶다…', '손이 안 움직여요'] : f.e.def.lines; addOv(L[(Math.random() * L.length) | 0], 'ov-chat', 0, 0, 4.3, 2.6, f.e); }
      } else if (f.t === 'say') {
        if (hooks.say && mode === 'play') hooks.say(f.key);
      } else if (f.t === 'deer') {
        addOv('꾸에에엑!!', 'ov-deer', 0, 0, 4.4, 1.8, f.e);
        if (sfx && mode === 'play') sfx.deer();
        if (hooks.event && mode === 'play') hooks.event(f);
      } else if (f.t === 'deerHit') {
        addOv('의무병!!', 'ov-hurt', 0, 0, 2.8, 2, f.e);
        for (k = 0; k < 14; k++) emit(f.x * U, 1.2, f.y * U, rnd(-3, 3), rnd(3, 7), rnd(-3, 3), 0.7);
        if (sfx && mode === 'play') sfx.thud();
        shake = Math.max(shake, 0.25);
      } else if (f.t === 'meHit') {
        if (f.lose) addOv('<i class="pie"></i>-' + fmt(f.lose), 'ov-lose', f.x, f.y, 3, 1.6).rise = 0.8;
        shake = Math.max(shake, 0.6);
        if (sfx && mode === 'play') { sfx.thud(); sfx.deer(); }
        if (hooks.event && mode === 'play') hooks.event(f);
      } else if (f.t === 'roof') {
        for (k = 0; k < 60; k++) emit((f.x + Math.random() * f.w) * U, rnd(2, 3.5), (f.y + rnd(0, 6)) * U, rnd(-0.5, 0.5), rnd(-1, 1), rnd(1, 3), rnd(0.8, 1.2));
        if (sfx && mode === 'play') sfx.rumble();
        shake = Math.max(shake, 0.35);
      } else if (f.t === 'car') {
        if (sfx && mode === 'play') sfx.honk();
        if (hooks.event && mode === 'play') hooks.event(f);
      } else if (f.t === 'carHit') {
        addOv('치일 뻔!', 'ov-hurt', f.x, f.y, 3, 1.2);
      } else if (f.t === 'heli') {
        if (hooks.event && mode === 'play') hooks.event(f);
      } else if (f.t === 'snowball') {
        if (hooks.event && mode === 'play') hooks.event(f);
        if (sfx && mode === 'play') sfx.splat();
      } else if (f.t === 'dump') {
        var dm = f.src === 'player', fromX = f.fromX * U, fromZ = f.fromY * U, tx = f.x * U, tz = f.y * U, nn = Math.min(dm ? 40 : 8, 4 + (f.units / 4 | 0));
        for (k = 0; k < nn; k++) { var tt = rnd(0.45, 0.75); emit(fromX + rnd(-0.4, 0.4), 2.2, fromZ + rnd(-0.4, 0.4), (tx - fromX) / tt + rnd(-1, 1), 7 * tt + rnd(0, 2), (tz - fromZ) / tt + rnd(-1, 1), tt + 0.05); }
        pileLevel[f.main ? 'main' : 'relay'] += f.units / 300;
        if (dm || Math.random() < 0.35) { var od = addOv('+' + fmt(f.pay) + '<i class="pie"></i>', 'ov-dump', f.x, f.y, 4, dm ? 1.4 : 0.9); od.rise = 1.6; }
        if (sfx && (dm || crewScrapeT <= 0)) { sfx.pour(dm ? 1 : 0.35); if (dm) sfx.coin(); }
        if (dm && hooks.event) hooks.event(f);
      } else if (f.t === 'full') {
        addOv('가득!', 'ov-full', 0, 0, 4.4, 1.6, world.player);
        if (sfx) sfx.deny();
        if (hooks.event) hooks.event(f);
      } else if (f.t === 'inspect') {
        var oi = addOv('검열 통과!<span>' + f.name + ' · +' + fmt(f.bonus) + '</span>', 'ov-inspect', f.x, f.y, 2, 2.6); oi.rise = 0.4;
        for (k = 0; k < 60; k++) emit(f.x * U + rnd(-6, 6), 0.6, f.y * U + rnd(-6, 6), rnd(-3, 3), rnd(6, 11), rnd(-3, 3), rnd(0.9, 1.5), [1, 0.84, 0.3]);
        if (hooks.event && mode === 'play') hooks.event(f);
      } else if (f.t === 'day') {
        if (hooks.event && mode === 'play') hooks.event(f);
      } else if (f.t === 'up') {
        addOv('다시 일어났다', 'ov-chat', 0, 0, 4.3, 1.2, f.e);
      } else if (f.t === 'bubble') {
        var e2 = f.e, hb = e2 === world.haeng || world.crew.indexOf(e2) >= 0 ? 4.3 : world.deer.indexOf(e2) >= 0 ? 4.2 : world.cats.indexOf(e2) >= 0 ? 2.4 : 3.6;
        addOv(esc(f.text), 'ov-chat ov-talk', 0, 0, hb, 2.8, e2);
      } else if (f.t === 'throw') {
        if (!f.npc) vmPlay('throw', 0.45);
        if (sfx) sfx.whoosh();
      } else if (f.t === 'splat') {
        for (k = 0; k < (f.hit ? 16 : 7); k++) emit(f.x * U, Math.max(0.2, f.h * U), f.y * U, rnd(-2.5, 2.5), rnd(1, 4), rnd(-2.5, 2.5), rnd(0.35, 0.6));
        if (f.hit && sfx && !f.me) sfx.splat();
      } else if (f.t === 'snowman') {
        for (k = 0; k < 30; k++) emit(f.m.x * U + rnd(-0.6, 0.6), rnd(0.3, 2.4), f.m.y * U + rnd(-0.6, 0.6), rnd(-2, 2), rnd(2, 5), rnd(-2, 2), rnd(0.5, 1), [1, 0.95, 0.75]);
        vmPlay('act', 0.7); if (sfx) sfx.ding();
      } else if (f.t === 'smash') {
        for (k = 0; k < 40; k++) emit(f.x * U + rnd(-0.5, 0.5), rnd(0.4, 2.6), f.y * U + rnd(-0.5, 0.5), rnd(-4, 4), rnd(2, 6), rnd(-4, 4), rnd(0.5, 1));
        if (sfx) sfx.thud();
        if (!f.deer && !f.old) vmPlay('act', 0.5);
      } else if (f.t === 'kick') { vmPlay('kick', 0.5); if (sfx) sfx.kick(); }
      else if (f.t === 'salute') { vmPlay('salute', 1.0); if (sfx) sfx.salute(); }
      else if (f.t === 'pet') { vmPlay('pet', 1.1); if (sfx) sfx.meow(); }
      else if (f.t === 'shoo') { var os = addOv('+' + fmt(f.pay) + '<i class="pie"></i>', 'ov-dump', f.x, f.y, 3.5, 1.2); os.rise = 1.2; vmPlay('act', 0.5); }
      else if (f.t === 'ride') { if (sfx && f.on) sfx.vroom(); }
      else if (f.t === 'caught') { shake = Math.max(shake, 0.8); if (sfx) sfx.thud(); }
      else if (f.t === 'heat') { if (sfx && f.heat > 0) sfx.siren(); }
      else if (f.t === 'zonePerfect') {
        for (k = 0; k < 160; k++) emit(f.x * U + rnd(-10, 10), 0.6, f.y * U + rnd(-10, 10), rnd(-4, 4), rnd(7, 15), rnd(-4, 4), rnd(1, 2), [[1, 0.84, 0.3], [0.6, 0.9, 1], [1, 0.5, 0.5], [1, 1, 1]][k % 4]);
        var oz = addOv('구역 완벽!<span>' + esc(f.name) + ' 100%</span>', 'ov-perfect', f.x, f.y, 3, 3); oz.rise = 0.5; shake = Math.max(shake, 0.4);
      } else if (f.t === 'allClear') {
        for (var fw = 0; fw < 6; fw++) { var ax = P.x * U + rnd(-14, 14), az = P.y * U + rnd(-14, 6) - 6; for (k = 0; k < 40; k++) { var th = Math.random() * 6.28, ph = Math.random() * 3.14, sp2 = rnd(6, 10); emit(ax, rnd(8, 12), az, Math.cos(th) * Math.sin(ph) * sp2, Math.cos(ph) * sp2 + 4, Math.sin(th) * Math.sin(ph) * sp2, rnd(1, 1.8), [[1, 0.84, 0.3], [0.6, 0.9, 1], [1, 0.5, 0.5], [0.7, 1, 0.6]][fw % 4]); } }
        shake = Math.max(shake, 0.5);
      } else if (f.t === 'found') {
        var rcc = new T.Color(S.RARITY[f.item.r].color);
        for (k = 0; k < (f.item.r === 'c' ? 24 : 70); k++) emit(f.x * U + rnd(-0.4, 0.4), 0.5, f.y * U + rnd(-0.4, 0.4), rnd(-2.5, 2.5), rnd(5, 10), rnd(-2.5, 2.5), rnd(0.8, 1.4), [rcc.r, rcc.g, rcc.b]);
        var of = addOv('<b>' + esc(f.item.name) + '</b><small>' + (f.pie ? '+' + fmt(f.pie) + ' 초코파이' : '') + (f.item.dia ? ' · 다이아 +' + f.item.dia : '') + '</small>', 'ov-found', f.x, f.y, 2.2, 2.8);
        of.el.style.setProperty('--rc', S.RARITY[f.item.r].color); of.rise = 0.5;
      } else if (f.t === 'dia') { if (!isFP() && f.why !== 'rank') { var od2 = addOv('<i class="dia"></i>+' + f.n, 'ov-dia', 0, 0, 4.6, 1.6, world.player); od2.rise = 0.8; } }
      else if (f.t === 'locked') { addOv('출입 통제', 'ov-lock', f.x, f.y, 1.6, 1.4); }
      else if (f.t === 'hand') { vmPlay('act', 0.5); if (sfx) sfx.pop(); }
      else if (f.t === 'assigned') { addOv('담당: ' + esc((G.zoneById(f.zone) || {}).name || ''), 'ov-new', 0, 0, 4.4, 2, f.e); if (sfx) sfx.salute(); }
      else if (f.t === 'slack') { addOv('(짱박힘…)', 'ov-slack', 0, 0, 3.6, 3, f.e); }
      else if (f.t === 'unslack') { addOv('…다시 일한다', 'ov-chat', 0, 0, 4.3, 1.4, f.e); }
      else if (f.t === 'choco') { if (f.e) { for (k = 0; k < 14; k++) emit(f.e.x * U, 2.6, f.e.y * U, rnd(-1.5, 1.5), rnd(2, 4), rnd(-1.5, 1.5), 0.6, [0.45, 0.27, 0.15]); addOv('냠냠', 'ov-bang', 0, 0, 4.6, 1, f.e); } vmPlay('act', 0.6); if (sfx) sfx.coin(); }
      if (hooks.event && mode === 'play' && /^(me|heat|buff|buffEnd|mission|gift|sleep|ride|caught|gong|dia|found|combo|comboEnd|zonePerfect|allClear|locked|ach|officer|slack|recruit|assigned|req|hand)$/.test(f.t)) hooks.event(f);
    }
    fx.length = 0;
  }

  /* ── 갱신 ── */
  function syncActors(dt) {
    var w = world, P = w.player, t = performance.now() / 1000;
    if (playerKey() !== playerKind) buildPlayer();
    playerObj.g.visible = !isFP();
    setExpr(playerObj, P.stun > 0 ? 'stun' : 'normal');
    placePerson(playerObj, P, { lie: P.stun > 0.6 && !playerObj.vehicle });
    playerObj.ring.material.opacity = 0.55 + Math.sin(t * 5) * 0.25;
    sack(playerObj, P.load / P.cap);
    if (playerObj.vehicle === 'heli') playerObj.body.position.y = 2.2 + Math.sin(t * 2) * 0.15;
    placePerson(haengObj, w.haeng);
    setExpr(haengObj, w.haeng.chasing ? 'shout' : 'normal');
    w.crew.forEach(function (e, i) {
      var o = crewObjs[i]; if (!o) return;
      o.g.visible = !e.off;
      setExpr(o, e.injured > 0 ? 'hurt' : e.asleep || e.slack ? 'sleep' : 'normal');
      placePerson(o, e, { lie: e.injured > 0 || e.asleep || e.slack });
      sack(o, e.load / e.cap);
    });
    // 고라니
    while (deerObjs.length < w.deer.length) deerObjs.push(makeDeer());
    while (deerObjs.length > w.deer.length) removeObj(deerObjs.pop());
    w.deer.forEach(function (d, i) {
      var o = deerObjs[i];
      o.g.position.set(d.x * U, snowAt(d.x, d.y) * 0.4, d.y * U);
      o.body.rotation.y = Math.atan2(d.dir.x, d.dir.y);
      o.body.position.y = Math.abs(Math.sin(d.walk * 1.6)) * 0.35;
      o.body.rotation.x = Math.sin(d.walk * 1.6) * 0.12;
      o.legs.forEach(function (l, k) { l.rotation.x = Math.sin(d.walk * 1.6 + (k < 2 ? 0 : Math.PI)) * 0.7; });
    });
    // 간부 차량
    if (w.car && !carObj) carObj = makePerson({ coat: '#4f5d36', face: 'captain', vehicle: 'car', big: true });
    if (!w.car && carObj) { removeObj(carObj); carObj = null; }
    if (carObj) placePerson(carObj, w.car);
    if (barrierArm) { var open = w.car && w.car.y > 1000; barrierArm.rotation.z += ((open ? 1.35 : 0) - barrierArm.rotation.z) * Math.min(1, dt * 4); }
    // 헬기
    if (w.heli && !heliObj) heliObj = makePerson({ coat: '#4c5a35', face: 'driver', vehicle: 'heli', big: true });
    if (!w.heli && heliObj) { removeObj(heliObj); heliObj = null; }
    if (heliObj) {
      var hl = w.heli, k2 = hl.t < 1.5 ? 1 - hl.t / 1.5 : hl.t > hl.life - 1.2 ? (hl.t - (hl.life - 1.2)) / 1.2 : 0;
      heliObj.g.position.set(hl.x * U, 1 + k2 * 22, hl.y * U); heliObj.body.rotation.y = t * 0.2;
      heliObj.shadow.position.y = -heliObj.g.position.y + 0.06; heliObj.shadow.scale.setScalar(2.6 + (1 - k2) * 1.5);
      if (Math.random() < 0.6 && k2 < 0.5) for (var q = 0; q < 3; q++) { var a = Math.random() * 6.28; emit(hl.x * U + Math.cos(a) * 3, 0.4, hl.y * U + Math.sin(a) * 3, Math.cos(a) * 12, rnd(1, 3), Math.sin(a) * 12, 0.7); }
    }
    // 짬타이거
    w.cats.forEach(function (c, i) { var g = catObjs[i]; if (g) { g.position.set(c.x * U, snowAt(c.x, c.y) * 0.4 + (c.moving ? Math.abs(Math.sin(t * 12)) * 0.1 : 0), c.y * U); g.rotation.y = Math.atan2(c.dir.x, c.dir.y); } });
    if (flagMesh) { var fp = flagMesh.geometry.attributes.position; for (var v = 0; v < fp.count; v++) { var fx = fp.getX(v); fp.setZ(v, Math.sin(fx * 2.4 + t * 4) * 0.12 * (fx + 1.05)); } fp.needsUpdate = true; }
  }

  /* ── 카메라 ── */
  function resize() {
    vw = Math.max(1, cv.clientWidth); vh = Math.max(1, cv.clientHeight);
    pr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(2.4e6 / (vw * vh)));
    renderer.setPixelRatio(pr); renderer.setSize(vw, vh, false);
    fitCam();
  }
  var CAMS = ['fp', 'near', 'far'], camMode = 'fp', WIDN = [15, 16, 17.5, 19, 21, 24, 28, 33, 42], PITCHN = 0.43, FOVN = 62, sunDir = new T.Vector3(0.3, 0.6, 0.7).normalize(), bobK = 0;
  try { var cm0 = localStorage.getItem('jeseol-cam2'); if (CAMS.indexOf(cm0) >= 0) camMode = cm0; } catch (e) { /* 저장소 없음 */ }
  // 타이틀(데모)은 늘 3인칭, 작업 중엔 고른 시점
  function cm() { return mode === 'demo' || mode === 'idle' ? 'near' : camMode; }
  function isFP() { return cm() === 'fp'; }
  function fitCam() {
    var c = cm(); camera.aspect = vw / vh;
    camera.fov = c === 'fp' ? (vw < vh ? 84 : 66) : c === 'near' ? FOVN : FOV;
    camera.near = c === 'fp' ? 0.12 : 0.5;
    camera.updateProjectionMatrix();
    if (vmCam) { vmCam.aspect = vw / vh; vmCam.fov = vw < vh ? 66 : 54; vmCam.updateProjectionMatrix(); }
  }
  function camDist() { var a = vw / vh, t = Math.tan(FOV * Math.PI / 360); return a < 1 ? (visW / 2) / (t * a) : (visW * 0.62 / 2) / t; }
  function camera3(dt, snap) {
    if (!world) return;
    var P = world.player, tx = P.x * U, tz = P.y * U - 1.5, c = cm(), now = performance.now() / 1000;
    if (c !== lastCamMode) { lastCamMode = c; fitCam(); if (c === 'fp') { fpYaw = Math.atan2(P.dir.x, P.dir.y); fpPitch = -0.2; } }
    if (focus) { focus.t += dt; if (focus.t > focus.life) focus = null; else { var k = Math.min(1, focus.t / 0.6, (focus.life - focus.t) / 0.6); tx += (focus.x - tx) * k; tz += (focus.z - tz) * k; } }
    var halfW = visW / 2;
    if (c === 'near') { tz = P.y * U - 1.2; if (focus) { var kf = Math.min(1, focus.t / 0.6, (focus.life - focus.t) / 0.6); tz += (focus.z - tz) * kf; tx = P.x * U + (focus.x - P.x * U) * kf; } }
    else if (c === 'far') { if (halfW * 2 < 84) tx = Math.max(halfW - 3, Math.min(83 - halfW, tx)); else tx = 40; tz = Math.max(2, Math.min(122, tz)); }
    var k2 = snap ? 1 : Math.min(1, dt * 5);
    if (c === 'fp') { camT.x = P.x * U; camT.z = P.y * U; } else { camT.x += (tx - camT.x) * k2; camT.z += (tz - camT.z) * k2; }
    visT = VIS[world.save.tool] || 30;
    if (Math.abs(visT - visW) > 0.01) { visW += (visT - visW) * (snap ? 1 : Math.min(1, dt * 2)); if (c === 'far') fitCam(); }
    var sx = shake ? rnd(-shake, shake) : 0, sz = shake ? rnd(-shake, shake) : 0, sr, fx0 = Math.sin(fpYaw), fz0 = Math.cos(fpYaw);
    if (c === 'fp') {
      // 1인칭: 눈높이에서 본다. 걸으면 흔들리고, 넘어지면 하늘을 본다
      var ac = world.act, rd = ac && ac.ride, Tl = G.toolOf(world.save), veh = !!(rd || Tl.vehicle), heli = !rd && Tl.id === 'heli';
      var eye = heli ? 5.6 : veh ? 3.3 : 2.3, sink = snowAt(P.x, P.y) * (veh ? 0.3 : 0.45), wk = P.walk || 0;
      bobK += ((P.moving && !veh ? 1 : 0) - bobK) * Math.min(1, dt * 8);
      stunK += ((P.stun > 0.5 ? 1 : 0) - stunK) * Math.min(1, dt * (P.stun > 0.5 ? 7 : 3));
      var bob = Math.sin(wk * 2) * 0.075 * bobK, sway = Math.cos(wk) * 0.05 * bobK;
      var ex = P.x * U - fz0 * sway, ez = P.y * U + fx0 * sway, ey = eye + sink + bob - stunK * (eye - 0.75) + (heli ? Math.sin(now * 2) * 0.15 : 0);
      var pitch = fpPitch * (1 - stunK) + stunK * 0.9;
      camera.position.set(ex, ey, ez); camera.up.set(0, 1, 0);
      camera.lookAt(ex + fx0 * Math.cos(pitch), ey + Math.sin(pitch), ez + fz0 * Math.cos(pitch));
      if (stunK > 0.01) camera.rotateZ(stunK * 0.45 * Math.sin(now * 2.6));
      if (shake) { camera.rotateX(rnd(-shake, shake) * 0.04); camera.rotateY(rnd(-shake, shake) * 0.04); }
      scene.fog.near = 26; scene.fog.far = 300;
      sr = 30; sun.target.position.set(ex + fx0 * 13, 0, ez + fz0 * 13);
    } else if (c === 'near') {
      var a0 = vw / vh, tn = Math.tan(FOVN * Math.PI / 360), wn = WIDN[world.save.tool] || 16, dn = a0 < 1 ? (wn / 2) / (tn * a0) : (wn * 0.6 / 2) / tn, ly = 1.3;
      camDn += (dn - camDn) * (snap ? 1 : Math.min(1, dt * 2));
      var ahead = camDn * 0.22;
      camera.up.set(0, 1, 0);
      camera.position.set(camT.x + sx, ly + Math.sin(PITCHN) * camDn, camT.z + Math.cos(PITCHN) * camDn + sz);
      camera.lookAt(camT.x + sx, ly, camT.z - ahead + sz);
      scene.fog.near = camDn * 2.2; scene.fog.far = 420;
      sr = 14 + (WIDN[world.save.tool] || 16) * 0.9; sun.target.position.set(camT.x, 0, camT.z - 4);
    } else {
      var dist = camDist();
      camera.up.set(0, 1, 0);
      camera.position.set(camT.x + sx, Math.sin(PITCH) * dist, camT.z + Math.cos(PITCH) * dist + sz);
      camera.lookAt(camT.x + sx, 0, camT.z + sz);
      scene.fog.near = dist * 1.3; scene.fog.far = dist * 4 + 150;
      sr = visW * 0.75; sun.target.position.set(camT.x, 0, camT.z);
    }
    // 그림자 상자는 플레이어를 따라간다
    var sc = sun.shadow.camera;
    if (Math.abs(sc.right - sr) > 0.5) { sc.left = -sr; sc.right = sr; sc.top = sr; sc.bottom = -sr; sc.updateProjectionMatrix(); }
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 90);
    sky.position.copy(camera.position); sunSprite.position.copy(camera.position).addScaledVector(sunDir, 520);
  }
  var camDn = 12, skyT = -1, cZen = new T.Color(), cHor = new T.Color(), tmpC = new T.Color();
  var Z_DAWN = new T.Color('#5468a8'), Z_NOON = new T.Color('#3f7bd0'), H_DAWN = new T.Color('#f6c3a6'), H_NOON = new T.Color('#cfe0f2');
  function lighting() {
    var f = world && world.dayLen ? Math.min(1, world.time / world.dayLen) : 0.35, k = Math.sin(f * Math.PI);
    sunDir.set((1 - 2 * f) * 0.85, 0.28 + 0.55 * k, 0.75).normalize();
    hemi.intensity = 0.42 + k * 0.18;
    sun.intensity = 1.25 + k * 0.55;
    sun.color.setRGB(1, 0.78 + k * 0.18, 0.62 + k * 0.32);
    cZen.copy(Z_DAWN).lerp(Z_NOON, k); cHor.copy(H_DAWN).lerp(H_NOON, Math.min(1, k * 1.4));
    scene.fog.color.copy(cHor); scene.background = scene.fog.color;
    if (Math.abs(skyT - k) > 0.02) {
      skyT = k;
      var col = sky.geometry.attributes.color, pos = sky.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) { var y = pos.getY(i) / 600; tmpC.copy(cHor).lerp(cZen, Math.max(0, Math.min(1, Math.pow(Math.max(0, y), 0.55)))); col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b); }
      col.needsUpdate = true;
    }
    sunSprite.material.opacity = 0.75 + k * 0.25;
  }
  // 앞을 가리는 건물은 반투명
  var bld3 = [], fadeN = 0;
  function fadeBuildings() {
    if (++fadeN % 4 || !world) return;
    var P = world.player;
    bld3.forEach(function (o) {
      var b = o.b, block = cm() === 'near' && P.y < b.y + 4 && P.y > b.y - 170 && P.x > b.x - 30 && P.x < b.x + b.w + 30;
      var target = block ? 0.28 : 1;
      if (Math.abs(o.op - target) < 0.01) return;
      o.op += (target - o.op) * 0.5; if (Math.abs(o.op - target) < 0.03) o.op = target;
      o.mats.forEach(function (m) { var tr = o.op < 0.99; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = o.op; m.depthWrite = !tr; });
    });
  }
  // 하늘: 그러데이션 돔 + 해 + 먼 산 + 구름
  var sky, sunSprite, clouds = [];
  function buildSky() {
    var g = new T.SphereGeometry(600, 32, 16), n = g.attributes.position.count;
    g.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(n * 3), 3));
    sky = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; scene.add(sky);
    var st = canvasTex(128, 128, function (c) { var gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.16, 'rgba(255,246,220,1)'); gr.addColorStop(0.35, 'rgba(255,220,170,.45)'); gr.addColorStop(1, 'rgba(255,210,160,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); });
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: st, transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
    sunSprite.scale.set(150, 150, 1); scene.add(sunSprite);
    var parts = [];
    for (var i = 0; i < 46; i++) {
      var a = i / 46 * Math.PI * 2 + hash(i, 1) * 0.12, r = 230 + hash(i, 2) * 60, h = 38 + hash(i, 3) * 70, w = 34 + hash(i, 4) * 40;
      var x = 40 + Math.cos(a) * r, z = 60 + Math.sin(a) * r;
      parts.push([cone(w, h, { x: x, y: h / 2 - 2, z: z, ry: hash(i, 5) * 3 }, 5), i % 3 ? '#8193a8' : '#73869c'], [cone(w * 0.42, h * 0.42, { x: x, y: h - h * 0.21 - 1.5, z: z, ry: hash(i, 5) * 3 }, 5), '#f1f5fa']);
    }
    var mt = new T.Mesh(merge(parts), new T.MeshLambertMaterial({ vertexColors: true })); scene.add(mt);
    var ct = canvasTex(256, 128, function (c) { for (var k = 0; k < 9; k++) { var gr = c.createRadialGradient(40 + k * 22, 70 - (k % 3) * 8, 0, 40 + k * 22, 70 - (k % 3) * 8, 40); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 256, 128); } });
    for (i = 0; i < 9; i++) { var cl = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.75 })); cl.scale.set(140 + hash(i, 7) * 90, 55 + hash(i, 8) * 25, 1); cl.position.set(40 + (hash(i, 9) - 0.5) * 700, 110 + hash(i, 10) * 80, 60 - 120 - hash(i, 11) * 300); scene.add(cl); clouds.push(cl); }
  }

  /* ── 1인칭 손과 도구 (따로 그려서 벽에 안 박힌다) ── */
  function V3(x, y, z) { return new T.Vector3(x, y, z); }
  function limbGeo(a, b, r) {
    var d = new T.Vector3().subVectors(b, a), len = d.length(), g = new T.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 8);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
    var m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
    return g;
  }
  function orientGeo(g, dir, at) { g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize())); g.translate(at.x, at.y, at.z); return g; }
  var SLEEVE = '#55633a', GLOVE = '#2b3020', SH_R = V3(0.52, -0.82, 0.2), SH_L = V3(-0.52, -0.84, 0.15);
  function vmHandGeo(kind, r) {
    var parts = [], bw = 0.35 + r * 0.035;
    function arms(hr, hl) {
      parts.push([limbGeo(SH_R, hr, 0.088), SLEEVE], [sph(0.078, { x: hr.x, y: hr.y, z: hr.z }), GLOVE]);
      if (hl) parts.push([limbGeo(SH_L, hl, 0.088), SLEEVE], [sph(0.078, { x: hl.x, y: hl.y, z: hl.z }), GLOVE]);
    }
    function pole(a, b, head) {
      var d = b.clone().sub(a), dn = d.clone().normalize();
      parts.push([limbGeo(a, b, 0.03), '#8a6a44']);
      if (head === 'broom') parts.push([orientGeo(new T.ConeGeometry(0.22, 0.6, 10), dn.clone().negate(), b.clone().addScaledVector(dn, 0.22)), '#c9a66b']);
      else parts.push([P(new T.BoxGeometry(head, 0.38, 0.06), { rx: -0.3, x: b.x, y: b.y - 0.05, z: b.z - 0.04 }), '#e7ae2f'], [P(new T.BoxGeometry(head, 0.06, 0.08), { x: b.x, y: b.y - 0.24, z: b.z }), '#555']);
      return d;
    }
    if (kind === 'salt') {
      parts.push([cyl(0.2, 0.2, 0.42, { x: -0.3, y: -0.6, z: -0.72 }, 14), '#3c6f9c'], [cyl(0.21, 0.21, 0.05, { x: -0.3, y: -0.38, z: -0.72 }, 14), '#d8dde2'],
        [limbGeo(V3(0.12, -0.42, -0.5), V3(0.05, -0.64, -1.25), 0.026), '#555'], [sph(0.055, { x: 0.05, y: -0.64, z: -1.25 }), '#9fd0ff']);
      arms(V3(0.12, -0.42, -0.5), V3(-0.3, -0.46, -0.64));
    } else if (kind === 'cart') {
      parts.push([limbGeo(V3(-0.32, -0.44, -0.46), V3(0.32, -0.44, -0.46), 0.03), '#333'], [limbGeo(V3(-0.3, -0.44, -0.46), V3(-0.34, -0.82, -1.2), 0.025), '#555'], [limbGeo(V3(0.3, -0.44, -0.46), V3(0.34, -0.82, -1.2), 0.025), '#555'],
        [box(0.95, 0.42, 0.7, { y: -0.98, z: -1.55 }), '#5d6f86'], [box(1.6, 0.36, 0.08, { y: -1.1, z: -2.0 }), '#f0b429']);
      arms(V3(0.22, -0.44, -0.46), V3(-0.22, -0.44, -0.46));
    } else if (kind === 'twin') {
      pole(V3(0.12, -0.32, -0.34), V3(0.5, -0.86, -1.75), bw * 0.62); pole(V3(-0.12, -0.32, -0.34), V3(-0.5, -0.86, -1.75), bw * 0.62);
      arms(V3(0.14, -0.4, -0.42), V3(-0.15, -0.46, -0.6));
    } else {
      var a = V3(0.08, -0.3, -0.3), b = V3(0, -0.84, -1.75), d = pole(a, b, kind === 'broom' ? 'broom' : bw);
      arms(a.clone().addScaledVector(d, 0.07), a.clone().addScaledVector(d, 0.37).add(V3(-0.03, 0, 0)));
    }
    return merge(parts);
  }
  function vmVehGeo(kind) {
    var col = kind === 'plow' ? '#e0a526' : kind === 'truck' ? '#55603a' : kind === 'car' ? '#4f5d36' : kind === 'heli' ? '#4c5a35' : '#3f7a3c', parts = [], i;
    var hr = V3(0.27, -0.5, -0.6), hl = V3(-0.27, -0.5, -0.6);
    parts.push([limbGeo(SH_R, hr, 0.088), SLEEVE], [sph(0.078, { x: hr.x, y: hr.y, z: hr.z }), GLOVE], [limbGeo(SH_L, hl, 0.088), SLEEVE], [sph(0.078, { x: hl.x, y: hl.y, z: hl.z }), GLOVE]);
    if (kind === 'heli') {
      parts.push([box(2.6, 0.5, 0.7, { y: -0.98, z: -0.95 }), '#2a2e26'], [box(2.2, 0.06, 0.5, { y: -0.7, z: -1.0 }), '#1a1c18'],
        [limbGeo(V3(-1.2, -0.7, -1.2), V3(-0.85, 1.3, -1.7), 0.05), col], [limbGeo(V3(1.2, -0.7, -1.2), V3(0.85, 1.3, -1.7), 0.05), col],
        [limbGeo(V3(-0.85, 1.3, -1.7), V3(0.85, 1.3, -1.7), 0.05), col], [limbGeo(V3(0, -0.72, -1.35), V3(0, 1.2, -1.8), 0.03), col]);
      for (i = 0; i < 4; i++) parts.push([cyl(0.075, 0.075, 0.02, { rx: Math.PI / 2 - 0.4, x: -0.6 + i * 0.4, y: -0.68, z: -0.76 }, 12), '#e8eef2']);
      return merge(parts);
    }
    parts.push([box(2.7, 0.45, 0.8, { y: -0.95, z: -0.98 }), '#2b2f24'], [box(2.0, 0.3, 2.8, { y: -1.28, z: -2.6 }), col], [box(1.5, 0.08, 0.5, { y: -1.1, z: -1.45 }), '#1d1f1a'],
      [limbGeo(V3(-1.2, -0.7, -1.3), V3(-0.98, 1.3, -1.55), 0.06), col], [limbGeo(V3(1.2, -0.7, -1.3), V3(0.98, 1.3, -1.55), 0.06), col], [box(2.2, 0.1, 0.1, { y: 1.3, z: -1.55 }), col]);
    if (kind !== 'car') parts.push([box(3.8, 0.6, 0.16, { y: -1.35, z: -4.2, rx: -0.2 }), '#f0b429'], [box(0.3, 0.2, 1.1, { y: -1.3, z: -3.7 }), '#333']);
    if (kind === 'car') parts.push([box(0.5, 0.12, 0.3, { x: 0.75, y: -0.69, z: -0.98 }), '#d9c27a']);
    if (kind !== 'tractor') parts.push([box(0.42, 0.14, 0.2, { y: 1.36, z: -1.5 }), kind === 'car' ? '#2b5fd1' : '#ff8a2a']);
    for (i = 0; i < 3; i++) parts.push([cyl(0.08, 0.08, 0.02, { rx: Math.PI / 2 - 0.5, x: -0.78 + i * 0.26, y: -0.7, z: -0.66 }, 12), '#e8eef2']);
    return merge(parts);
  }
  function buildVM() {
    vmScene = new T.Scene();
    vmCam = new T.PerspectiveCamera(60, 1, 0.03, 30);
    vmHemi = new T.HemisphereLight('#e6eeff', '#6d7a8c', 0.8); vmScene.add(vmHemi);
    vmSun = new T.DirectionalLight('#fff1dd', 1.2); vmSun.position.set(0.6, 1, 0.5); vmScene.add(vmSun);
    vmRoot = new T.Group(); vmScene.add(vmRoot);
    vmArm = new T.Mesh(new T.CapsuleGeometry(0.088, 1, 4, 8), new T.MeshLambertMaterial({ color: SLEEVE })); vmArm.visible = false; vmRoot.add(vmArm);
    vmGlove = new T.Mesh(new T.SphereGeometry(0.08, 12, 8), new T.MeshLambertMaterial({ color: GLOVE })); vmGlove.visible = false; vmRoot.add(vmGlove);
    vmBallM = new T.Mesh(new T.SphereGeometry(0.11, 12, 8), new T.MeshLambertMaterial({ color: '#ffffff' })); vmBallM.visible = false; vmRoot.add(vmBallM);
    vmBoot = new T.Mesh(merge([[box(0.32, 0.28, 0.5, { z: -0.08 }), '#26291f'], [box(0.34, 0.08, 0.56, { y: -0.16, z: -0.08 }), '#111'], [cyl(0.13, 0.15, 0.5, { y: 0.35 }), '#3d4628']]), matV); vmBoot.visible = false; vmRoot.add(vmBoot);
  }
  function vmWheel() { return new T.Mesh(new T.TorusGeometry(0.3, 0.035, 8, 26), new T.MeshLambertMaterial({ color: '#1d1f1a' })); }
  function vmKey() {
    var a = world.act, rd = a && a.ride, Tl = G.toolOf(world.save);
    var k = rd ? rd.kind : Tl.vehicle ? Tl.id : Tl.aura ? 'salt' : Tl.id === 'broom' ? 'broom' : Tl.id === 'twin' ? 'twin' : Tl.id === 'cart' ? 'cart' : 'pusher';
    return { kind: k, veh: !!(rd || Tl.vehicle), r: Tl.r, key: k + ':' + Tl.r };
  }
  var lastYaw = 0, wheelSpin = 0;
  function syncVM(dt) {
    var P = world.player, k = vmKey(), now = performance.now() / 1000;
    if (k.key !== vmKind) {
      vmKind = k.key; if (vmTool) { vmRoot.remove(vmTool); }
      vmTool = new T.Group();
      vmTool.add(new T.Mesh(k.veh ? vmVehGeo(k.kind) : vmHandGeo(k.kind, k.r), matV));
      if (k.veh && k.kind !== 'heli') { var wh = vmWheel(); wh.position.set(0, -0.52, -0.62); wh.rotation.x = -0.95; vmTool.add(wh); vmTool.wheel = wh; }
      vmRoot.add(vmTool);
    }
    // 핸들은 도는 만큼 돌아간다
    var dy = fpYaw - lastYaw; lastYaw = fpYaw;
    wheelSpin += (Math.max(-1, Math.min(1, dy * 18)) - wheelSpin) * Math.min(1, dt * 8);
    if (vmTool.wheel) vmTool.wheel.rotation.z = wheelSpin * 1.2;
    var sw = P.swing || 0;
    vmRoot.position.set(Math.cos(P.walk || 0) * 0.025 * bobK, Math.sin((P.walk || 0) * 2) * 0.03 * bobK - stunK * 0.9 + (k.veh && P.moving ? Math.sin(now * 30) * 0.006 : 0), 0);
    // 동작: 경례·던지기·쓰다듬기·차기
    var an = vmAnim, wgt = 0;
    if (an.k) { an.t += dt; if (an.t > an.d) an.k = ''; else wgt = Math.sin(Math.PI * Math.min(1, an.t / an.d)); }
    vmTool.position.set(0, (k.veh ? 0.34 : 0) - wgt * 0.55, k.veh ? 0 : -sw * 0.14);
    vmTool.rotation.x = k.veh ? 0 : sw * 0.05;
    var hand = null, ball = false, boot = null;
    if (an.k === 'salute') { var q = Math.min(1, an.t / 0.15, (an.d - an.t) / 0.2); hand = V3(0.45 - 0.27 * q, -0.78 + 0.96 * q, -0.2 - 0.18 * q); }
    else if (an.k === 'throw') { var u = an.t / an.d; hand = u < 0.35 ? V3(0.42, -0.4 + u * 1.2, 0.0) : V3(0.42 - (u - 0.35) * 0.5, 0.02 - (u - 0.35) * 0.5, -(u - 0.35) * 1.5); ball = u < 0.42; }
    else if (an.k === 'pet' || an.k === 'act') { hand = V3(0.08 + Math.sin(an.t * 18) * 0.05 * (an.k === 'pet' ? 1 : 0), -0.6 + wgt * 0.05, -0.55 - wgt * 0.3); }
    else if (an.k === 'kick') boot = V3(0.12, -1.55 + wgt * 0.75, -0.35 - wgt * 0.55);
    vmArm.visible = vmGlove.visible = !!hand; vmBallM.visible = ball; vmBoot.visible = !!boot;
    if (hand) {
      var d = hand.clone().sub(SH_R), len = d.length();
      vmArm.position.copy(SH_R).add(hand).multiplyScalar(0.5); vmArm.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); vmArm.scale.set(1, len / 1.18, 1);
      vmGlove.position.copy(hand); vmGlove.scale.set(an.k === 'salute' ? 1.5 : 1, an.k === 'salute' ? 0.45 : 1, 1.1);
      if (ball) vmBallM.position.copy(hand).add(V3(0, 0.09, -0.04));
    }
    if (boot) { vmBoot.position.copy(boot); vmBoot.rotation.x = -0.4 * wgt; }
    syncVMItem(); if (vmItem) vmItem.position.set(0, Math.sin((P.walk || 0) * 2) * 0.012 * bobK - wgt * 0.2, 0);
    vmSun.color.copy(sun.color); vmSun.intensity = sun.intensity * 0.75; vmHemi.intensity = hemi.intensity * 1.4;
  }
  function vmPlay(k, d) { vmAnim.k = k; vmAnim.t = 0; vmAnim.d = d; }
  // 손에 든 물건 (식판·간식 봉지·편지·기름통)
  var vmItem = null, vmItemK = '';
  function vmItemGeo(k) {
    var gk = 'vmi:' + k; if (geos[gk]) return geos[gk];
    var parts, hl = V3(-0.26, -0.5, -0.62);
    var arm = [[limbGeo(SH_L, hl, 0.088), SLEEVE], [sph(0.078, { x: hl.x, y: hl.y, z: hl.z }), GLOVE]];
    if (k === 'meal') parts = [[box(0.5, 0.04, 0.36, { x: -0.18, y: -0.46, z: -0.72, rx: 0.25 }), '#b8c0c6'], [cyl(0.07, 0.06, 0.06, { x: -0.3, y: -0.42, z: -0.72 }, 10), '#f4f1e6'], [cyl(0.06, 0.05, 0.05, { x: -0.1, y: -0.42, z: -0.66 }, 10), '#3b2a1c'], [box(0.14, 0.05, 0.12, { x: -0.12, y: -0.42, z: -0.8 }), '#c8402e'], [sph(0.05, { x: -0.3, y: -0.38, z: -0.72 }), '#fff']];
    else if (k === 'snack') parts = [[box(0.26, 0.34, 0.14, { x: -0.22, y: -0.36, z: -0.66, ry: 0.3 }), '#f2e6c9'], [box(0.27, 0.1, 0.15, { x: -0.22, y: -0.3, z: -0.66, ry: 0.3 }), '#c0563f'], [cyl(0.05, 0.05, 0.18, { x: -0.1, y: -0.18, z: -0.68 }, 8), '#2f8f5b']];
    else if (k === 'letter') parts = [[box(0.3, 0.2, 0.02, { x: -0.2, y: -0.38, z: -0.62, rx: -0.5, rz: 0.2 }), '#fdfbf2'], [box(0.08, 0.08, 0.025, { x: -0.12, y: -0.33, z: -0.6, rx: -0.5 }), '#d23a2a']];
    else parts = [[box(0.26, 0.34, 0.16, { x: -0.22, y: -0.5, z: -0.66 }), '#c8402e'], [cyl(0.03, 0.03, 0.12, { x: -0.14, y: -0.3, z: -0.66, rz: -0.6 }, 8), '#333'], [box(0.12, 0.04, 0.05, { x: -0.25, y: -0.31, z: -0.66 }), '#222']];
    return (geos[gk] = merge(parts.concat(arm)));
  }
  function syncVMItem() {
    var h = world.act && world.act.hand;
    if ((h || '') === vmItemK) return;
    vmItemK = h || '';
    if (vmItem) { vmRoot.remove(vmItem); vmItem = null; }
    if (h) { vmItem = new T.Mesh(vmItemGeo(h), matV); vmRoot.add(vmItem); }
  }

  /* ── 상호작용 물건: 눈덩이, 족구공, 눈사람, 정비고 트랙터, 지금 고른 것 표시 ── */
  var focusRing = null;
  function snowmanGeo(v) {
    var k = 'sman:' + v; if (geos[k]) return geos[k];
    var parts = [[sph(0.8, { y: 0.72 }), '#fbfdff'], [sph(0.56, { y: 1.75 }), '#fbfdff'], [sph(0.42, { y: 2.5 }), '#fbfdff'],
      [sph(0.07, { x: -0.15, y: 2.58, z: 0.37 }), '#111'], [sph(0.07, { x: 0.15, y: 2.58, z: 0.37 }), '#111'], [cone(0.07, 0.4, { rx: Math.PI / 2, y: 2.48, z: 0.55 }, 6), '#e98a2c'],
      [sph(0.06, { y: 1.95, z: 0.52 }), '#222'], [sph(0.06, { y: 1.68, z: 0.55 }), '#222'], [cyl(0.03, 0.03, 1.0, { rz: 1.1, x: -0.9, y: 1.85 }), '#6b4a32'], [cyl(0.03, 0.03, 1.0, { rz: v === 1 ? -0.4 : -1.2, x: 0.9, y: v === 1 ? 2.1 : 1.9 }), '#6b4a32'],
      [box(0.24, 0.14, 0.04, { y: 2.0, x: 0.28, z: 0.48, ry: 0.4 }), '#2f3a25'], [box(0.16, 0.03, 0.05, { y: 2.0, x: 0.28, z: 0.5, ry: 0.4 }), '#e2b33c']];
    if (v === 0) parts.push([P(new T.SphereGeometry(0.47, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { s: [1.05, 0.82, 1.05], y: 2.56 }), '#4e5a33'], [cyl(0.52, 0.52, 0.06, { y: 2.56 }, 16), '#3f4a28']);
    else if (v === 1) parts.push([P(new T.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { y: 2.58 }), '#39422c']);
    else parts.push([cyl(0.34, 0.32, 0.44, { y: 3.0 }, 14), '#ffffff'], [sph(0.4, { s: [1, 0.6, 1], y: 3.25 }), '#ffffff']);
    return (geos[k] = merge(parts));
  }
  var offObjs = [], salEl = null, spk = null, spkPos, spkCol, spkT = 0, SPK = 300;
  var OFFACE = { lt: 'lt', cpt: 'captain', gen: 'general' };
  function syncOfficers(a) {
    var offs = (a && a.off) || [];
    offObjs = offObjs.filter(function (ob) { if (offs.indexOf(ob.ref) < 0) { removeObj(ob); return false; } return true; });
    var urgent = null;
    offs.forEach(function (o) {
      var ob = null; for (var i = 0; i < offObjs.length; i++) if (offObjs[i].ref === o) ob = offObjs[i];
      if (!ob) { ob = makePerson({ coat: o.id === 'gen' ? '#2f3a22' : '#3d4a2b', face: OFFACE[o.id], hat: 'cap', tool: o.id === 'lt' ? 'shovel' : null, r: 10, shadow: true, scale: o.id === 'gen' ? 1.4 : 1.25 }); ob.ref = o; offObjs.push(ob); }
      placePerson(ob, o); if (ob.tool) ob.tool.visible = o.helpT > 0;
      if (!o.saluted && !o.missed && o.warned) urgent = o;
    });
    if (!salEl) { salEl = document.createElement('div'); salEl.className = 'ov ov-sal'; salEl.textContent = '경례!'; ov.appendChild(salEl); }
    var pp = urgent ? project(urgent.x, urgent.y, 4.6) : null, on = pp && pp[2] < 1 && mode === 'play';
    salEl.style.display = on ? '' : 'none';
    if (on) salEl.style.transform = 'translate(' + pp[0].toFixed(1) + 'px,' + pp[1].toFixed(1) + 'px) translate(-50%,-100%)';
  }
  // 거의 다 치운 조각: 남은 칸마다 금빛 반짝이. 가까이 묻힌 분실물은 하얗게 반짝
  function buildSparkles() {
    spkPos = new Float32Array(SPK * 3); spkCol = new Float32Array(SPK * 3);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(spkPos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('color', new T.BufferAttribute(spkCol, 3).setUsage(T.DynamicDrawUsage));
    var tex = canvasTex(64, 64, function (c) { var gr = c.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(32, 0); c.lineTo(38, 26); c.lineTo(64, 32); c.lineTo(38, 38); c.lineTo(32, 64); c.lineTo(26, 38); c.lineTo(0, 32); c.lineTo(26, 26); c.closePath(); c.fill(); c.fillRect(22, 22, 20, 20); });
    spk = new T.Points(g, new T.PointsMaterial({ size: 1.1, map: tex, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.04 }));
    spk.frustumCulled = false; spk.renderOrder = 4; g.setDrawRange(0, 0); scene.add(spk);
  }
  function stepSparkles(dt) {
    if (!spk || !world) return;
    var t = performance.now() / 1000;
    spk.material.size = 0.95 + Math.sin(t * 7) * 0.35;
    spkT -= dt; if (spkT > 0) return; spkT = 0.3;
    var P = world.player, n = 0, idx = G.cellIndex(P.x, P.y), pi = idx >= 0 ? world.partOf[idx] : -1, Pt = pi >= 0 ? world.parts[pi] : null;
    function put(x, y, c) { if (n >= SPK) return; spkPos[n * 3] = x * U; spkPos[n * 3 + 1] = snowAt(x, y) + 0.35; spkPos[n * 3 + 2] = y * U; spkCol[n * 3] = c[0]; spkCol[n * 3 + 1] = c[1]; spkCol[n * 3 + 2] = c[2]; n++; }
    if (mode === 'play' && Pt && !Pt.done && Pt.total && Pt.clear / Pt.total >= S.ALMOST) {
      for (var gy = Math.floor(Pt.y / CELL); gy < Math.ceil((Pt.y + Pt.h) / CELL) && n < SPK - 20; gy++) for (var gx = Math.floor(Pt.x / CELL); gx < Math.ceil((Pt.x + Pt.w) / CELL); gx++) {
        var k = gy * GW + gx; if (world.partOf[k] === pi && world.depth[k] > 0) put(gx * CELL + 5, gy * CELL + 5, [1, 0.62, 0.02]);
      }
    }
    if (mode === 'play') (world.treas || []).forEach(function (tr) { if (Math.hypot(tr.x - P.x, tr.y - P.y) < 90 && Math.random() < 0.7) put(tr.x + rnd(-3, 3), tr.y + rnd(-3, 3), [0.2, 0.75, 1]); });
    spk.geometry.setDrawRange(0, n);
    spk.geometry.attributes.position.needsUpdate = true; spk.geometry.attributes.color.needsUpdate = true;
  }
  var recObjs = [], reqEls = [];
  function syncRecruits() {
    var rs = world.recruits || [];
    recObjs = recObjs.filter(function (ob) { if (rs.indexOf(ob.ref) < 0) { removeObj(ob); if (ob.tag) ob.tag.remove(); return false; } return true; });
    rs.forEach(function (r) {
      var ob = null; for (var i = 0; i < recObjs.length; i++) if (recObjs[i].ref === r) ob = recObjs[i];
      if (!ob) {
        var C = r.def; ob = makePerson({ coat: C.coat, face: C.face, hat: 'helmet', tool: null, vehicle: C.vehicle ? 'plow' : null, big: C.vehicle, shadow: true }); ob.ref = r;
        ob.tag = document.createElement('div'); ob.tag.className = 'ov ov-new'; ob.tag.textContent = '신병'; ov.appendChild(ob.tag); recObjs.push(ob);
      }
      placePerson(ob, r);
      var pp = project(r.x, r.y, 4.2), on = pp[2] < 1 && mode === 'play';
      ob.tag.style.display = on ? '' : 'none'; ob.tag.textContent = r.state === 'follow' ? '따라오는 중' : '신병 · 인솔 대기';
      if (on) ob.tag.style.transform = 'translate(' + pp[0].toFixed(1) + 'px,' + pp[1].toFixed(1) + 'px) translate(-50%,-100%)';
    });
  }
  function syncReqs(a) {
    var qs = (a && a.reqs) || [];
    while (reqEls.length < qs.length) { var el = document.createElement('div'); el.className = 'ov ov-req'; ov.appendChild(el); reqEls.push(el); }
    reqEls.forEach(function (el, i) {
      var q = qs[i]; if (!q || mode !== 'play') { el.style.display = 'none'; return; }
      var who = q.who, pp = project(who.x, who.y, who === world.haeng ? 4.9 : 4.7);
      if (pp[2] > 1) { el.style.display = 'none'; return; }
      el.style.display = ''; var txt = (JY.SnowAct.ITEM[q.item] || {}).want + '?';
      if (el._t !== txt) { el._t = txt; el.textContent = txt; }
      el.style.transform = 'translate(' + pp[0].toFixed(1) + 'px,' + pp[1].toFixed(1) + 'px) translate(-50%,-100%)';
    });
  }
  function syncAct(dt) {
    var a = world.act, t = performance.now() / 1000;
    if (tractorObj) tractorObj.visible = !(a && a.ride && a.ride.kind === 'tractor');
    syncOfficers(a); stepSparkles(dt); syncRecruits(); syncReqs(a);
    if (!a) { if (kickBall) kickBall.visible = false; return; }
    while (actBalls.length < a.balls.length) {
      var bm = new T.Mesh(geos.sball || (geos.sball = new T.SphereGeometry(0.2, 10, 8)), mats.sball || (mats.sball = new T.MeshLambertMaterial({ color: '#ffffff' })));
      bm.castShadow = true; scene.add(bm); actBalls.push(bm);
    }
    actBalls.forEach(function (m, i) { var b = a.balls[i]; m.visible = !!b; if (b) m.position.set(b.x * U, Math.max(0.2, b.h * U), b.y * U); });
    if (!kickBall) {
      kickBall = new T.Mesh(merge([[sph(0.3, {}, 14, 10), '#f4f1e6'], [cyl(0.305, 0.305, 0.1, {}, 16), '#e2b33c'], [cyl(0.305, 0.305, 0.1, { rx: Math.PI / 2 }, 16), '#2b5fd1']]), matV);
      kickBall.castShadow = true; scene.add(kickBall);
    }
    var B = a.ball; kickBall.visible = true;
    kickBall.position.set(B.x * U, 0.3 + B.h * U + snowAt(B.x, B.y) * 0.35, B.y * U);
    if (B.vx || B.vy) { kickBall.rotation.y = Math.atan2(B.vx, B.vy); kickBall.rotation.x = B.roll || 0; }
    var sm = world.save.snowmen, key = sm.map(function (m) { return m.x + ',' + m.y; }).join(';');
    if (key !== manKey) {
      manKey = key; manObjs.forEach(removeObj); manObjs = [];
      sm.forEach(function (m) { var o = new T.Mesh(snowmanGeo(m.s % 3), matV); o.castShadow = true; o.position.set(m.x * U, snowAt(m.x, m.y) * 0.3, m.y * U); o.rotation.y = (m.s % 628) / 100; o.scale.setScalar(1.05); scene.add(o); manObjs.push(o); });
    }
    // 지금 고른 것 아래 노란 고리
    if (!focusRing) { focusRing = new T.Mesh(new T.RingGeometry(0.75, 0.95, 32), new T.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false })); focusRing.rotation.x = -Math.PI / 2; focusRing.renderOrder = 5; scene.add(focusRing); }
    var f = curFocus;
    focusRing.visible = !!(f && f.k !== 'exit' && f.k !== 'build' && mode === 'play');
    if (focusRing.visible) {
      var big = f.k === 'car' || f.k === 'plow' || f.k === 'tractor' || f.k === 'stand' ? 2.4 : f.k === 'deer' ? 1.7 : f.k === 'cat' || f.k === 'ball' ? 0.8 : 1.2;
      focusRing.position.set(f.x * U, 0.12 + snowAt(f.x, f.y) * 0.5, f.y * U); focusRing.scale.setScalar(big * (1 + Math.sin(t * 6) * 0.06));
    }
    if (markEl) {
      var show = f && f.k !== 'exit' && f.k !== 'build' && !isFP() && mode === 'play';
      markEl.style.display = show ? '' : 'none';
      if (show) {
        if (markEl._t !== f.verb + f.name) { markEl._t = f.verb + f.name; markEl.innerHTML = '<b>' + f.verb + '</b><small>' + f.name + '</small>'; }
        var hh = f.k === 'cat' || f.k === 'ball' ? 1.6 : f.k === 'car' || f.k === 'plow' || f.k === 'tractor' ? 4 : 3.6, pp = project(f.x, f.y, hh);
        markEl.style.transform = 'translate(' + pp[0].toFixed(1) + 'px,' + pp[1].toFixed(1) + 'px) translate(-50%,-100%)';
      }
    }
  }
  function buildTractor() {
    var TR = JY.SnowAct ? JY.SnowAct.TRACTOR : { x: 252, y: 1062 };
    tractorObj = new T.Group();
    var tm = new T.Mesh(vehicleGeo('tractor'), matV); tm.castShadow = true; tm.rotation.y = -Math.PI / 2; tractorObj.add(tm);
    var tt = textTex('정비고 트랙터 · 일병부터', { size: 28 }), sm = new T.Mesh(new T.PlaneGeometry(tt.image.width / 60, tt.image.height / 60), new T.MeshLambertMaterial({ map: tt }));
    sm.position.set(0, 3.3, 1.2); tractorObj.add(sm);
    tractorObj.position.set(TR.x * U, 0, TR.y * U); scene.add(tractorObj);
  }

  /* ── 입력 ── */
  function fpForward() { return { x: Math.sin(fpYaw), y: Math.cos(fpYaw) }; }
  function readInput(dt) {
    if (isFP()) {
      // 1인칭: 왼쪽 조이스틱(또는 WASD)은 보는 방향 기준으로 앞·뒤·옆걸음, ←/→는 돌기
      var mx = 0, my = 0;
      if (keys.w || keys.ArrowUp) my += 1; if (keys.s || keys.ArrowDown) my -= 1;
      if (keys.a) mx -= 1; if (keys.d) mx += 1;
      if (keys.ArrowLeft) fpYaw += 2.1 * dt; if (keys.ArrowRight) fpYaw -= 2.1 * dt;
      if (stick && (stick.vx || stick.vy)) { mx += stick.vx; my -= stick.vy; }
      var f = fpForward();
      return { x: f.x * my - f.y * mx, y: f.y * my + f.x * mx, face: f, reach: 10 };
    }
    var x = 0, y = 0;
    if (keys.ArrowLeft || keys.a) x -= 1; if (keys.ArrowRight || keys.d) x += 1;
    if (keys.ArrowUp || keys.w) y -= 1; if (keys.ArrowDown || keys.s) y += 1;
    if (x || y) { moveTo = null; return { x: x, y: y }; }
    if (stick && (stick.vx || stick.vy)) return { x: stick.vx, y: stick.vy };
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
  function screenToWorld(cx, cy) {
    var r = cv.getBoundingClientRect(), v = new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), out = new T.Vector3();
    camera.updateMatrixWorld(); ray.setFromCamera(v, camera);
    if (!ray.ray.intersectPlane(groundPlane, out)) return null;
    return { x: out.x / U, y: out.z / U };
  }
  function bindInput() {
    cv.addEventListener('pointerdown', function (e) {
      if (mode !== 'play') return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
      if (JY.SnowSfx) JY.SnowSfx.unlock();
      // 1인칭: 오른쪽(또는 마우스)으로 끌면 둘러보기, 왼쪽은 걷기 조이스틱. 두 손가락 동시에 된다
      if (isFP() && (e.pointerType === 'mouse' || e.clientX > vw * 0.42 || stick)) { if (!lookPtr) lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
      if (stick) return;
      stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, vx: 0, vy: 0, t: performance.now(), moved: false };
    });
    cv.addEventListener('pointermove', function (e) {
      if (lookPtr && e.pointerId === lookPtr.id) {
        var lx = e.clientX - lookPtr.x, ly = e.clientY - lookPtr.y; lookPtr.x = e.clientX; lookPtr.y = e.clientY;
        fpYaw -= lx * 0.0068; fpPitch = Math.max(-1.2, Math.min(0.75, fpPitch - ly * 0.0058));
        return;
      }
      if (!stick || e.pointerId !== stick.id) return;
      var dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, d = Math.hypot(dx, dy);
      if (d > 8) stick.moved = true;
      if (d < 5) { stick.vx = stick.vy = 0; return; }
      var m = Math.min(1, d / 46); stick.vx = dx / d * m; stick.vy = dy / d * m;
      if (d > 70) { stick.ox = e.clientX - dx / d * 70; stick.oy = e.clientY - dy / d * 70; }
      moveTo = null;
      stickEl.hidden = false;
      stickEl.style.transform = 'translate(' + stick.ox + 'px,' + stick.oy + 'px)';
      knobEl.style.transform = 'translate(' + (stick.vx * 46) + 'px,' + (stick.vy * 46) + 'px)';
    });
    function up(e) {
      if (lookPtr && e.pointerId === lookPtr.id) { lookPtr = null; return; }
      if (!stick || e.pointerId !== stick.id) return;
      if (!stick.moved && performance.now() - stick.t < 280 && !isFP()) moveTo = screenToWorld(e.clientX, e.clientY);
      stick = null; stickEl.hidden = true;
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    window.addEventListener('keydown', function (e) { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; if (e.key.indexOf('Arrow') === 0 && mode === 'play') e.preventDefault(); });
    window.addEventListener('keyup', function (e) { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
    window.addEventListener('blur', function () { keys = {}; stick = null; lookPtr = null; stickEl.hidden = true; });
    window.addEventListener('resize', resize);
  }

  /* ── 루프 ── */
  function frame(t) {
    raf = requestAnimationFrame(frame);
    var raw = last ? (t - last) / 1000 : 0.016, dt = Math.min(0.05, raw); last = t;
    if (!ready) return;
    // 느린 기기: 해상도 → 실시간 그림자 순서로 낮춘다
    slowAvg = slowAvg * 0.95 + Math.min(0.5, raw) * 0.05;
    if (mode === 'play' && slowAvg > 0.034) {
      if (++slowN > 45) {
        slowN = 0; slowAvg = 0.02;
        if (pr > 1) { pr = Math.max(1, pr - 0.5); renderer.setPixelRatio(pr); renderer.setSize(vw, vh, false); }
        else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; lowFx = true; scene.traverse(function (m) { if (m.material) [].concat(m.material).forEach(function (x) { x.needsUpdate = true; }); }); }
      }
    } else if (slowN > 0) slowN--;
    if (world && (mode === 'play' || mode === 'demo')) {
      var inp = mode === 'demo' || autopilot ? botInput() : readInput(Math.min(0.1, raw)), span = Math.min(0.35, raw), n = Math.ceil(span / 0.05);
      if (autopilot && isFP() && mode === 'play') { inp.face = { x: inp.x || Math.sin(fpYaw), y: inp.y || Math.cos(fpYaw) }; fpYaw = Math.atan2(inp.face.x, inp.face.y); inp.reach = 10; }
      for (var sn = 0; sn < n; sn++) G.step(world, span / n, inp);
      onFx();
      if (hooks.tick && mode === 'play') hooks.tick(world);
    }
    if (world) {
      flushSnow();
      if (scanT > 0) { scanT -= dt; if (scanT <= 0) recolorAll(); }
      syncActors(dt); stepParticles(dt); lighting(); camera3(dt); stepOverlays(dt); fadeBuildings();
      clouds.forEach(function (cl, i) { cl.position.x += dt * (1.5 + i % 3); if (cl.position.x > 420) cl.position.x = -340; });
      scrapeT -= dt; crewScrapeT -= dt; shake = Math.max(0, shake - dt * 2);
      stepDumps(dt); stepArrow(); syncAct(dt);
    }
    renderer.clear();
    renderer.render(scene, camera);
    if (world && isFP() && vmScene) { syncVM(dt); renderer.clearDepth(); renderer.render(vmScene, vmCam); }
  }

  function begin(save, m) {
    world = G.createWorld(save, { demo: m === 'demo', salt: m === 'demo' ? (Math.random() * 1e6) | 0 : 0 });
    mode = m; doneSent = false; moveTo = null; stick = null; lookPtr = null; scanT = 0; focus = null; curFocus = null; vmAnim.k = ''; lastCamMode = ''; stunK = 0; manKey = '#';
    overlays.forEach(function (o) { o.el.remove(); }); overlays = [];
    for (var i = 0; i < MAXP; i++) pPos[i * 3 + 1] = -50;
    offObjs.forEach(removeObj); offObjs = []; spkT = 0;
    recObjs.forEach(function (ob) { removeObj(ob); if (ob.tag) ob.tag.remove(); }); recObjs = [];
    carveDumps(); buildSnow(); buildLocks(); buildActors(); buildDumps();
    visW = VIS[save.tool] || 30; fitCam(); camera3(0, true);
    return world;
  }

  function init(canvas, h) {
    cv = canvas; hooks = h || {};
    if (T.ColorManagement) T.ColorManagement.legacyMode = false;
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.autoClear = false;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color('#dfe9f4');
    scene.fog = new T.Fog('#dfe9f4', 60, 420);
    camera = new T.PerspectiveCamera(FOVN, 1, 0.5, 1400);
    hemi = new T.HemisphereLight('#dfe9ff', '#7d8ca0', 0.55); scene.add(hemi);
    sun = new T.DirectionalLight('#fff1dd', 1.6); sun.position.set(-40, 38, 26);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
    scene.add(sun); scene.add(sun.target);
    matV = new T.MeshLambertMaterial({ vertexColors: true });
    mats.dot = canvasTex(32, 32, function (c) { var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); });
    mats.snow = new T.MeshPhongMaterial({ vertexColors: true, shininess: 22, specular: new T.Color('#3a4656'), map: canvasTex(128, 128, function (c) {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 128);
      for (var i = 0; i < 900; i++) { c.fillStyle = hash(i, 1) < 0.7 ? 'rgba(200,215,232,.35)' : 'rgba(255,255,255,1)'; c.fillRect(hash(i, 2) * 128, hash(i, 3) * 128, 1.2, 1.2); }
      for (i = 0; i < 14; i++) { c.fillStyle = 'rgba(214,226,240,.12)'; c.beginPath(); c.ellipse(hash(i, 4) * 128, hash(i, 5) * 128, 8 + hash(i, 6) * 18, 4 + hash(i, 7) * 8, 0, 0, 7); c.fill(); }
    }, true) });
    blobMat = new T.MeshBasicMaterial({ map: canvasTex(64, 64, function (c) { var g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(40,60,90,.38)'); g.addColorStop(1, 'rgba(40,60,90,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false });
    geos.blob = new T.CircleGeometry(0.85, 20);
    var ground = new T.Mesh(new T.PlaneGeometry(80, 120), new T.MeshLambertMaterial({ map: paintGround() }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(40, 0, 60); ground.receiveShadow = true; scene.add(ground);
    var outside = new T.Mesh(new T.PlaneGeometry(2400, 2400), new T.MeshLambertMaterial({ color: '#eef3f8' }));
    outside.rotation.x = -Math.PI / 2; outside.position.set(40, -0.3, 60); outside.receiveShadow = true; scene.add(outside);
    buildSky();
    S.BUILDINGS.forEach(function (b) { var bg = buildBuilding(b); bg.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(bg); });
    S.TANKS.forEach(function (t, k) { var tk = buildTank(t, k); tk.castShadow = true; tk.receiveShadow = true; scene.add(tk); });
    var trees = buildTrees(); trees.castShadow = true; scene.add(trees);
    var dec = buildDecor(); dec.traverse(function (m) { if (m.isMesh) m.castShadow = true; }); scene.add(dec);
    buildBase(); buildParticles(); buildVM(); buildTractor(); buildSparkles();
    ov = document.createElement('div'); ov.id = 'ov3d'; cv.parentNode.insertBefore(ov, cv.nextSibling);
    markEl = document.createElement('div'); markEl.className = 'ov ov-act'; markEl.style.display = 'none'; ov.appendChild(markEl);
    stickEl = document.createElement('div'); stickEl.id = 'stick3d'; stickEl.hidden = true; knobEl = document.createElement('i'); stickEl.appendChild(knobEl); cv.parentNode.appendChild(stickEl);
    bindInput(); resize();
    ready = true;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  JY.SnowView3D = {
    is3D: true,
    supported: function () { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } },
    init: init,
    rebuildArt: function () { /* 글꼴이 늦게 와도 3D 글씨는 다시 안 그린다 */ },
    demo: function (save) { return begin(save, 'demo'); },
    play: function (save) { return begin(save, 'play'); },
    pause: function (b) { if (mode === 'play' && b) mode = 'paused'; else if (mode === 'paused' && !b) { mode = 'play'; last = 0; } },
    world: function () { return world; },
    mode: function () { return mode; },
    setAutopilot: function (b) { autopilot = !!b; },
    shake: function (n) { shake = Math.max(shake, n * 0.2); },
    scan: function () { if (!world) return false; scanT = 3; recolorAll(); return true; },
    toggleCam: function (to) {
      camMode = CAMS.indexOf(to) >= 0 ? to : CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length];
      try { localStorage.setItem('jeseol-cam2', camMode); } catch (e) { /* 무시 */ }
      stick = null; lookPtr = null; stickEl.hidden = true; moveTo = null;
      fitCam(); if (world) camera3(0, true); return camMode;
    },
    camMode: function () { return camMode; },
    isFP: function () { return isFP(); },
    // 지금 보는 방향 (1인칭이면 고개 방향, 아니면 몸 방향)
    look: function () { if (!world) return null; if (isFP()) return { x: Math.sin(fpYaw), y: Math.cos(fpYaw), pitch: fpPitch, fp: true }; var d = world.player.dir; return { x: d.x, y: d.y, pitch: 0.12, fp: false }; },
    setFocus: function (t) { curFocus = t || null; },
    _setLook: function (yaw, pitch) { fpYaw = yaw; if (pitch !== undefined) fpPitch = pitch; },
    _screenToWorld: function (x, y) { return screenToWorld(x, y); },
    focusZone: function (id, sec) { var Z = G.zoneById(id); if (!Z) return; focus = { x: (Z.x + Z.w / 2) * U, z: (Z.y + Z.h / 2) * U - 3, t: 0, life: sec || 2.6 }; },
    _teleport: function (x, y) { if (world) { world.player.x = x; world.player.y = y; camera3(0, true); } },
    _stats: function () { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; }
  };
})(window.JY = window.JY || {});
