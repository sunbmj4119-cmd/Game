#!/usr/bin/env node
/* 화면 점검: 여러 휴대폰 크기에서 화면·모달·최악의 카드 상태를 띄우고
 *  - 화면 밖으로 나간 요소 / 잘린 글자 / 카드가 너무 작아지는 경우
 *  - 캐릭터 그림이 자기 틀(viewBox) 밖으로 삐져나가 잘리는 경우
 *  - 버튼을 눌렀을 때 실제로 상태가 바뀌는지
 * 를 찾는다.  node tests/ui-audit.js [스크린샷 폴더] */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path');
var { chromium } = require('playwright');
var root = path.join(__dirname, '..');
var shots = process.argv[2] || null;
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
var server = http.createServer(function (req, res) {
  var p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  var f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 }
];

/* 페이지 안에서 실행: 잘림 검사 */
function lint(opts) {
  var vw = document.documentElement.clientWidth, vh = window.innerHeight, out = [];
  var SKIP = '.gauge-bar,.lv-bar,.urgent-bar,.confetti,.mg-stage,.flash';
  document.querySelectorAll('body *').forEach(function (el) {
    if (el.closest('svg') || el.closest('[hidden]') || el.closest(SKIP)) return;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    var name = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    var txt = (el.textContent || '').trim().slice(0, 24);
    if (r.right > vw + 1 || r.left < -1) out.push({ t: 'offscreen-x', el: name, txt: txt, l: Math.round(r.left), r: Math.round(r.right) });
    var inScroller = false;
    for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) { var oy = getComputedStyle(a).overflowY; if (oy === 'auto' || oy === 'scroll') { inScroller = true; break; } }
    if (opts.fixed && !inScroller && el.closest('#scr-game') && (r.bottom > vh + 1)) out.push({ t: 'below-screen', el: name, txt: txt, bottom: Math.round(r.bottom), vh: vh });
    if (cs.textOverflow === 'ellipsis') return;
    var clipX = /hidden|clip/.test(cs.overflowX), clipY = /hidden|clip/.test(cs.overflowY);
    if (clipX && el.scrollWidth - el.clientWidth > 2 && el.id !== 'app') out.push({ t: 'clipped-x', el: name, txt: txt, by: el.scrollWidth - el.clientWidth });
    if (clipY && el.scrollHeight - el.clientHeight > 2) out.push({ t: 'clipped-y', el: name, txt: txt, by: el.scrollHeight - el.clientHeight });
    // 글자가 버튼·칩 밖으로 넘침 (overflow: visible인데 내용이 더 넓음)
    if (!clipX && /^(button|span|b|em|small|p)$/.test(el.tagName.toLowerCase()) && el.scrollWidth - el.clientWidth > 3 && el.clientWidth > 0 && cs.display !== 'inline') {
      out.push({ t: 'text-spill', el: name, txt: txt, by: el.scrollWidth - el.clientWidth });
    }
  });
  // 결과 쪽지·모달이 화면 안에 들어오는지
  ['#modal-box', '#result .note'].forEach(function (sel) {
    var el = document.querySelector(sel); if (!el || el.closest('[hidden]')) return;
    var r = el.getBoundingClientRect();
    if (r.top < -1 || r.bottom > vh + 1) out.push({ t: 'box-off-screen', el: sel, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: vh });
  });
  return out;
}

/* 페이지 안에서 실행: 글자가 다른 것에 가려지거나 서로 겹치는지, 알아보기 쉬운지
 * - covered: 글자 위에 불투명한 다른 요소(그림·막대·배지…)가 덮여 있음 (모달·결과 쪽지 같은 '위에 뜨는 창'은 의도라 제외)
 * - text-overlap: 서로 다른 글자끼리 겹침 (배지 숫자와 라벨 등)
 * - small-font: 12px 미만 글씨
 * - low-contrast: 글자색과 실제 배경색 대비가 낮음 (WCAG 4.5:1, 큰 글씨 3:1)
 * - ellipsis: 말줄임(…)으로 글이 잘림 */
function readCheck() {
  var vw = document.documentElement.clientWidth, vh = window.innerHeight, out = [];
  var LAYERS = '#modal,#result,#alert,#coach,#toast,#flash,.confetti,#mini,#talk-bubble';
  var force = document.createElement('style');
  force.textContent = '*{pointer-events:auto !important}';
  document.head.appendChild(force);
  function nm(el) {
    var c = el.getAttribute && el.getAttribute('class');
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + String(c).trim().split(/\s+/).slice(0, 2).join('.') : '');
  }
  function eff(el) { // 실제 불투명도 (조상까지 곱)
    var o = 1;
    for (var a = el; a && a.nodeType === 1; a = a.parentElement) {
      var cs = getComputedStyle(a);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= parseFloat(cs.opacity);
      if (a.tagName.toLowerCase() !== 'svg' && a.namespaceURI === 'http://www.w3.org/2000/svg') {
        var fo = parseFloat(a.getAttribute('opacity') || '1'); o *= isNaN(fo) ? 1 : fo;
      }
    }
    return o;
  }
  function rgba(s) { var m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; var p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  function hex(s) { var m = String(s).match(/^#([0-9a-f]{3,8})$/i); if (!m) return null; var h = m[1]; if (h.length === 3) h = h.replace(/./g, '$&$&'); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]; }
  function paint(el) { // 이 요소가 이 자리에 칠하는 색 (없으면 null)
    var cs = getComputedStyle(el), o = eff(el);
    if (o < 0.05) return null;
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
      if (!/^(path|rect|circle|ellipse|polygon|polyline)$/.test(el.tagName)) return null;
      var f = cs.fill; if (!f || f === 'none' || /url\(/.test(f)) return /url\(/.test(f) ? [128, 128, 128, o] : null;
      var c = rgba(f) || hex(f); if (!c) return null;
      var fo = parseFloat(cs.fillOpacity); c[3] *= (isNaN(fo) ? 1 : fo) * o; return c[3] > 0.02 ? c : null;
    }
    if (/^(img|canvas|video)$/i.test(el.tagName)) return [128, 128, 128, o];
    var b = rgba(cs.backgroundColor);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      var cols = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(rgba);
      if (cols.length) { var avg = [0, 0, 0, 0]; cols.forEach(function (c) { for (var i = 0; i < 4; i++) avg[i] += c[i] / cols.length; }); if (!b || b[3] < avg[3]) b = avg; }
    }
    if (b && b[3] > 0.02) { b[3] *= o; return b; }
    return null;
  }
  function lum(c) { return [c[0], c[1], c[2]].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function over(top, bot) { var a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; }
  function clippedFrac(el, r) { // 스크롤이 아닌 '잘라 내는' 상자(overflow hidden·SVG 화면)에 글자가 얼마나 잘렸나
    var x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (var a = el; a && a !== document.body; a = a.parentElement) {
      if (a.namespaceURI === 'http://www.w3.org/2000/svg' && a.tagName.toLowerCase() !== 'svg') continue;
      var cs = getComputedStyle(a);
      if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) break; // 스크롤해서 보는 곳: 그 바깥 잘림은 의미 없음
      if (/hidden|clip/.test(cs.overflowX + cs.overflowY) && cs.textOverflow !== 'ellipsis') {
        var q = a.getBoundingClientRect(); x1 = Math.max(x1, q.left); y1 = Math.max(y1, q.top); x2 = Math.min(x2, q.right); y2 = Math.min(y2, q.bottom);
      }
    }
    var full = (r.right - r.left) * (r.bottom - r.top), vis = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return full > 0 ? 1 - vis / full : 0;
  }
  function visibleRect(el, r) { // 스크롤 상자·화면 밖으로 잘린 부분 빼기
    var x1 = Math.max(r.left, 0), y1 = Math.max(r.top, 0), x2 = Math.min(r.right, vw), y2 = Math.min(r.bottom, vh);
    for (var a = el; a && a !== document.body; a = a.parentElement) {
      if (a.namespaceURI === 'http://www.w3.org/2000/svg' && a.tagName.toLowerCase() !== 'svg') continue;
      var cs = getComputedStyle(a);
      if (/hidden|clip|auto|scroll/.test(cs.overflowX + cs.overflowY)) { var q = a.getBoundingClientRect(); x1 = Math.max(x1, q.left); y1 = Math.max(y1, q.top); x2 = Math.min(x2, q.right); y2 = Math.min(y2, q.bottom); }
    }
    return x2 - x1 > 2 && y2 - y1 > 2 ? { left: x1, top: y1, right: x2, bottom: y2 } : null;
  }
  // 1) 보이는 글자 조각 모으기
  var texts = [], clipped = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    var tn = walker.currentNode, s = tn.nodeValue.trim();
    if (!s) continue;
    var host = tn.parentElement;
    if (!host || host.closest('[hidden],script,style,defs,title')) continue;
    if (eff(host) < 0.1) continue;
    var deco = !!host.closest('[aria-hidden="true"]'); // 장식(직인 등): 대비·크기 검사는 빼고 겹침만
    var rects;
    if (host.namespaceURI === 'http://www.w3.org/2000/svg') rects = [host.getBoundingClientRect()]; // 그림 속 글자(간판 등)
    else { var rg = document.createRange(); rg.selectNodeContents(tn); rects = rg.getClientRects(); }
    Array.prototype.forEach.call(rects, function (r) {
      if (r.width < 2 || r.height < 2) return;
      var cf = clippedFrac(host, r);
      if (cf > 0.12 && cf < 0.98 && /[가-힣A-Za-z0-9]/.test(s)) clipped.push({ t: 'text-clipped', el: nm(host), txt: s.slice(0, 20), cut: Math.round(cf * 100) + '%' });
      var v = visibleRect(host, r); if (!v) return;
      texts.push({ host: host, r: v, s: s.slice(0, 20), deco: deco });
    });
  }
  var seen = {};
  function add(o) { var k = o.t + '|' + o.el + '|' + o.txt; if (seen[k]) return; seen[k] = 1; out.push(o); }
  // 2) 가려짐 + 대비
  texts.forEach(function (T) {
    var host = T.host, r = T.r, cs = getComputedStyle(host), fs = parseFloat(cs.fontSize);
    var pts = [[(r.left + r.right) / 2, (r.top + r.bottom) / 2], [r.left + (r.right - r.left) * 0.15, (r.top + r.bottom) / 2], [r.right - (r.right - r.left) * 0.15, (r.top + r.bottom) / 2]];
    var myLayer = host.closest(LAYERS);
    pts.forEach(function (p, pi) {
      var stack = document.elementsFromPoint(p[0], p[1]), below = null;
      for (var i = 0; i < stack.length; i++) {
        var e = stack[i];
        if (e === force) continue;
        if (e === host || host.contains(e) || e.contains(host)) { below = stack.slice(i); break; }
        var L = e.closest(LAYERS);
        if (L && L !== myLayer) return; // 위에 뜬 창(의도)
        var c = paint(e);
        if (c && c[3] >= 0.35) { add({ t: 'covered', el: nm(host), txt: T.s, by: nm(e) }); return; }
      }
      if (pi || !below || T.deco) return;
      // 대비: 글자 아래 실제로 칠해진 색을 아래에서부터 합성
      var layers = [];
      for (var j = 0; j < below.length; j++) { var c2 = paint(below[j]); if (c2) { layers.push(c2); if (c2[3] >= 0.99) break; } }
      var bg = [255, 255, 255, 1];
      for (var k = layers.length - 1; k >= 0; k--) bg = over(layers[k], bg);
      var fg = host.namespaceURI === 'http://www.w3.org/2000/svg' ? (rgba(cs.fill) || hex(cs.fill)) : rgba(cs.color);
      if (!fg) return;
      fg = fg.slice(); fg[3] *= eff(host);
      var f2 = over(fg, bg), L1 = lum(f2), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      var bold = parseInt(cs.fontWeight, 10) >= 700 || /Black Han Sans|Jua/.test(cs.fontFamily);
      var large = fs >= 24 || (fs >= 18.5 && bold);
      if (ratio < (large ? 3 : 4.5) && /[가-힣A-Za-z0-9]/.test(T.s)) add({ t: 'low-contrast', el: nm(host), txt: T.s, ratio: Math.round(ratio * 100) / 100, fs: fs });
    });
    if (T.deco) return;
    if (fs < 12 && /[가-힣A-Za-z]/.test(T.s)) add({ t: 'small-font', el: nm(host), txt: T.s, fs: fs });
    if (cs.textOverflow === 'ellipsis' && host.scrollWidth > host.clientWidth + 1) add({ t: 'ellipsis', el: nm(host), txt: T.s });
  });
  // 3) 글자끼리 겹침
  for (var a = 0; a < texts.length; a++) for (var b = a + 1; b < texts.length; b++) {
    var A = texts[a], B = texts[b];
    if (A.host === B.host || A.host.contains(B.host) || B.host.contains(A.host)) continue;
    var la = A.host.closest(LAYERS), lb = B.host.closest(LAYERS);
    if (la !== lb) continue;
    var w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left), h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
    if (w <= 1 || h <= 1) continue;
    var sa = (A.r.right - A.r.left) * (A.r.bottom - A.r.top), sb = (B.r.right - B.r.left) * (B.r.bottom - B.r.top);
    if (w * h > 0.12 * Math.min(sa, sb)) add({ t: 'text-overlap', el: nm(A.host) + ' × ' + nm(B.host), txt: A.s + ' × ' + B.s });
  }
  clipped.forEach(add);
  // 글자가 다른 버튼·입력칸 상자(그림자 포함 3px)에 걸침
  var controls = Array.prototype.filter.call(document.querySelectorAll('button, input, select, textarea, .btn'), function (c) { return !c.closest('[hidden]') && eff(c) > 0.1; })
    .map(function (c) { var r = c.getBoundingClientRect(); return { c: c, r: { left: r.left, top: r.top, right: r.right, bottom: r.bottom + 3 } }; });
  texts.forEach(function (T) {
    if (T.deco || T.host.closest('button, .btn, input, select, textarea, label')) return;
    var myLayer = T.host.closest(LAYERS);
    controls.forEach(function (C) {
      if (C.c.contains(T.host) || T.host.contains(C.c) || C.c.closest(LAYERS) !== myLayer) return;
      var w = Math.min(T.r.right, C.r.right) - Math.max(T.r.left, C.r.left), h = Math.min(T.r.bottom, C.r.bottom) - Math.max(T.r.top, C.r.top);
      if (w > 2 && h > 1.5) add({ t: 'text-on-control', el: nm(T.host) + ' × ' + nm(C.c), txt: T.s });
    });
  });
  // 작은 그림(스탯 아이콘·계급장 등)이 자기 틀 밖으로 나가 잘리는지 (배경·인물 그림은 따로 검사)
  document.querySelectorAll('svg').forEach(function (sv) {
    if (sv.closest('[hidden]') || eff(sv) < 0.1) return;
    var cls = sv.getAttribute('class') || '';
    if (/\b(scene|char)\b/.test(cls) || sv.closest('.char-wrap, .face-preview, #me-big, #shop-me')) return;
    var box = sv.getBoundingClientRect(); if (box.width < 4 || box.height < 4) return;
    var worst = 0, what = '';
    sv.querySelectorAll('path, circle, ellipse, rect, polygon, line, text').forEach(function (n) {
      if (n.closest('defs, clipPath, mask, pattern, [clip-path]')) return;
      var r = n.getBoundingClientRect(); if (!r.width && !r.height) return;
      var o = Math.max(box.left - r.left, box.top - r.top, r.right - box.right, r.bottom - box.bottom);
      if (o > worst) { worst = o; what = n.tagName; }
    });
    if (worst > 1.5) add({ t: 'icon-clipped', el: nm(sv) + (sv.parentElement ? ' in ' + nm(sv.parentElement.closest('[class],[id]') || sv.parentElement) : ''), txt: what + ' ' + Math.round(worst) + 'px 밖' });
  });
  // 장식 도장(직인)이 버튼·입력칸에 닿는지
  document.querySelectorAll('.stamp, .seal').forEach(function (d) {
    if (d.closest('[hidden]') || eff(d) < 0.1) return;
    var q = d.getBoundingClientRect();
    document.querySelectorAll('button, input, select, textarea, a').forEach(function (c) {
      if (c.closest('[hidden]') || eff(c) < 0.1) return;
      var r = c.getBoundingClientRect(); if (!r.width) return;
      var w = Math.min(q.right, r.right) - Math.max(q.left, r.left), h = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top);
      if (w > 2 && h > 2) add({ t: 'deco-overlap', el: nm(d) + ' × ' + nm(c), txt: (c.textContent || c.value || '').trim().slice(0, 16) });
    });
  });
  force.remove();
  return out;
}

/* 페이지 안에서 실행: 꾸미기·소품·효과가 눈·입을 가리는지 (얼굴 꾸미기는 의도라 제외) */
function faceCheck() {
  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:232px;z-index:99999;background:#fff';
  document.body.appendChild(host);
  var out = [];
  function area(r) { return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top); }
  function inter(a, b) { return area({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) }); }
  function check(label, svg, withExtras) {
    host.innerHTML = svg;
    var s = host.querySelector('svg'); if (!s) return;
    s.style.width = '200px'; s.style.height = '232px';
    s.querySelectorAll('*').forEach(function (n) { n.style.animation = 'none'; });
    // 눈·입이 실제로 칠해진 점들 중, 위에 그려진 모자·소품(·효과)이 덮는 비율
    var SH = 'path,rect,circle,ellipse,polygon,line,polyline';
    function hit(n, x, y) {
      var m = n.getScreenCTM(); if (!m) return false;
      var p = new DOMPoint(x, y).matrixTransform(m.inverse());
      var cs = getComputedStyle(n);
      var inFill = cs.fill !== 'none' && cs.fillOpacity !== '0' && n.isPointInFill && n.isPointInFill(p);
      var inStroke = cs.stroke !== 'none' && n.isPointInStroke && n.isPointInStroke(p);
      return inFill || inStroke;
    }
    ['eyes', 'mouth'].forEach(function (part) {
      var g = s.querySelector('.' + part); if (!g) return;
      var pr = g.getBoundingClientRect(); if (!pr.width) return;
      var mine = g.querySelectorAll(SH), pts = [];
      for (var i = 0; i <= 10; i++) for (var j = 0; j <= 6; j++) {
        var x = pr.left + pr.width * i / 10, y = pr.top + pr.height * j / 6;
        if (Array.prototype.some.call(mine, function (n) { return hit(n, x, y); })) pts.push([x, y]);
      }
      if (!pts.length) return;
      var groups = [['hat', 0.1], ['prop', 0.1]].concat(withExtras ? [['extras', 0.25]] : []);
      groups.forEach(function (gg) {
        var shapes = s.querySelectorAll('.' + gg[0] + ' ' + SH.split(',').join(', .' + gg[0] + ' '));
        var n = pts.filter(function (p) { return Array.prototype.some.call(shapes, function (sh) { return hit(sh, p[0], p[1]); }); }).length;
        var cov = n / pts.length;
        if (cov > gg[1]) out.push({ who: label, part: part, by: gg[0], cover: Math.round(cov * 100) + '%' });
      });
    });
  }
  Object.keys(JY.CHARS).forEach(function (w) { check(w, JY.UI.charSVG(w), false); });
  var m = JY.Meta.get(), eq0 = JSON.stringify(m.cos.eq), own0 = JSON.stringify(m.cos.owned), face0 = m.face;
  var base = Object.assign({ skin: '#f5c9a0', mouth: 'smile', brows: 'normal', head: 'round', extras: [] }, face0 || {}, { extras: [] });
  var none = { hat: null, face: null, fx: null, body: null, prop: null };
  // 내 얼굴은 직접 꾸미니까: 눈 모양 전부 × (훈련소 방탄모 + 모자 꾸미기 전부), 입 모양 전부 × (소품·효과 꾸미기 전부)
  JY.FACE_OPTIONS.eyes.forEach(function (e) {
    m.face = Object.assign({}, base, { eyes: e });
    m.cos.eq = Object.assign({}, none);
    check('me(눈 ' + e + ')+훈련소 방탄모', JY.UI.charSVG('me', { rank: 0 }), false);
    JY.COSMETIC_ORDER.forEach(function (id) {
      var c = JY.COSMETICS[id]; if (c.slot !== 'hat') return;
      m.cos.owned[id] = true; m.cos.eq = Object.assign({}, none, { hat: id });
      check('me(눈 ' + e + ')+' + id, JY.UI.charSVG('me', { rank: 4 }), false);
    });
  });
  JY.FACE_OPTIONS.mouth.forEach(function (mo) {
    m.face = Object.assign({}, base, { eyes: 'normal', mouth: mo });
    JY.COSMETIC_ORDER.forEach(function (id) {
      var c = JY.COSMETICS[id]; if (c.slot !== 'prop' && c.slot !== 'fx' && c.slot !== 'body') return;
      m.cos.owned[id] = true; m.cos.eq = Object.assign({}, none); m.cos.eq[c.slot] = id;
      check('me(입 ' + mo + ')+' + id, JY.UI.charSVG('me', { rank: 4 }), true);
    });
  });
  m.face = face0; m.cos.eq = JSON.parse(eq0); m.cos.owned = JSON.parse(own0);
  host.remove();
  return out;
}

/* 페이지 안에서 실행: 캐릭터 그림이 viewBox 밖으로 나가는지 */
function svgBounds() {
  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:232px;opacity:0;pointer-events:none';
  document.body.appendChild(host);
  var out = [];
  function check(label, svg) {
    host.innerHTML = svg;
    var s = host.querySelector('svg'); if (!s) return;
    s.style.width = '200px'; s.style.height = '232px'; s.style.animation = 'none';
    s.querySelectorAll('*').forEach(function (n) { n.style.animation = 'none'; });
    var box = s.getBoundingClientRect(), sx = box.width / 200, sy = box.height / 232;
    var over = { l: 0, t: 0, r: 0, b: 0 };
    s.querySelectorAll('path,circle,ellipse,rect,text,polygon').forEach(function (n) {
      if (n.closest('defs,clipPath,pattern,[clip-path]')) return;      // 클립으로 잘라 둔 장식은 제외
      var r = n.getBoundingClientRect();
      if (!r.width && !r.height) return;
      over.l = Math.max(over.l, (box.left - r.left) / sx);
      over.t = Math.max(over.t, (box.top - r.top) / sy);
      over.r = Math.max(over.r, (r.right - box.right) / sx);
      over.b = Math.max(over.b, (r.bottom - box.bottom) / sy);
    });
    // 아래쪽은 상반신 구도라 몸통이 조금 잘리는 게 의도 (12까지 허용)
    var bad = (over.l > 3 || over.t > 3 || over.r > 3 || over.b > 12);
    if (bad) out.push({ who: label, over: { l: Math.round(over.l), t: Math.round(over.t), r: Math.round(over.r), b: Math.round(over.b) } });
  }
  Object.keys(JY.CHARS).forEach(function (w) { check(w, JY.UI.charSVG(w)); });
  // 꾸미기 전부 하나씩 입혀 보기 (모자·소품·옷)
  var m = JY.Meta.get(), eq0 = JSON.stringify(m.cos.eq), own0 = JSON.stringify(m.cos.owned);
  JY.COSMETIC_ORDER.forEach(function (id) {
    var c = JY.COSMETICS[id];
    m.cos.owned[id] = true; m.cos.eq = { hat: null, face: null, fx: null, body: null, prop: null }; m.cos.eq[c.slot] = id;
    check('me+' + id, JY.UI.charSVG('me', { rank: 4 }));
  });
  m.cos.eq = JSON.parse(eq0); m.cos.owned = JSON.parse(own0);
  host.remove();
  return out;
}

(async function () {
  await new Promise(function (r) { server.listen(0, r); });
  var url = 'http://127.0.0.1:' + server.address().port + '/';
  var browser = await chromium.launch();
  var report = { layout: {}, read: {}, svg: null, face: null, cardSize: {}, functional: [], errors: [] };

  // AUDIT_VIEWS=360x640,390x844 로 일부 크기만 (빠른 확인용)
  if (process.env.AUDIT_VIEWS) VIEWPORTS = VIEWPORTS.filter(function (v) { return process.env.AUDIT_VIEWS.split(',').indexOf(v.name) >= 0; });
  for (var vi = 0; vi < VIEWPORTS.length; vi++) {
    var V = VIEWPORTS[vi];
    var ctx = await browser.newContext({ viewport: { width: V.width, height: V.height }, deviceScaleFactor: shots && (V.name === '360x640' || V.name === '390x844') ? 2 : 1, isMobile: V.width < 700, hasTouch: true });
    var page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', function (e) { report.errors.push(V.name + ' ' + e.message); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { r.abort(); });
    await page.goto(url);
    await sleep(300);
    var issues = [], readIssues = [];
    async function snap(label, fixed) {
      await sleep(120);
      var r = await page.evaluate(lint, { fixed: !!fixed });
      r.forEach(function (x) { x.where = label; });
      issues = issues.concat(r);
      var rr = await page.evaluate(readCheck);
      rr.forEach(function (x) { x.where = label; });
      readIssues = readIssues.concat(rr);
      if (shots && (V.name === '360x640')) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, V.name + '-' + label + '.png') }); }
    }
    async function T(fn, arg) { await page.evaluate(function (a) { var t = JY.UI._t; return (new Function('t', 'a', 'return (' + a.fn + ')(t, a.arg)'))(t, a); }, { fn: fn.toString(), arg: arg }); await sleep(150); }

    // 준비: 메타 꽉 채우기 (꾸미기·보급품·레벨)
    await page.evaluate(function () {
      var m = JY.Meta.get();
      m.gems = 999; m.jjam = 2000; m.jjamTotal = 1600; m.freeBoxes = 2; m.discharges = 3; m.tutorialDone = true;
      JY.PREMIUM_ORDER.forEach(function (id) { m.stash[id] = 2; });
      JY.COSMETIC_ORDER.forEach(function (id) { m.cos.owned[id] = true; });
      m.cos.eq = { hat: 'gold', face: 'sunglasses', fx: 'sparkle', body: 'dress', prop: 'shovel' };
      m.records = [];
      for (var i = 0; i < 10; i++) m.records.push({ score: 20000 - i * 1500, title: JY.scoreTitle(20000 - i * 1500), name: '아주긴이름병' + i, ending: JY.ENDING_ORDER[i], good: true, mos: 'clerk', unit: JY.UNIT_ORDER[i % 5], days: 547, daily: null, date: '2026-11-09', cos: '🪖😎✨🎖️⛏️' });
      JY.Meta.save();
      document.getElementById('modal').hidden = true;
    });

    // 타이틀 · 설정
    await T(function (t) { t.closeModal(); t.renderTitle(); });
    await snap('title', true);
    await T(function (t) { t.renderSetup(); });
    await snap('setup');

    // 게임: 최악의 카드 (긴 글 + 특수 대답 + 상태칩 4개 + 돌발 막대)
    await page.evaluate(function () {
      var s = JY.Game.newState({ start: '2026-03-02', name: '아주긴이름', mos: 'clerk', trait: 'glass', up: { watch: 3 }, insurance: true });
      s.rank = 3; s.day = 300; s.queue = []; s.insight = 9; s.luck = 9; s.insurance = 1;
      s.conds = [{ id: 'captainOff', left: 3 }, { id: 'inspect', left: 2 }];
      s.items = { chocopie: 9, buldak: 9, mandu: 9, banana: 9, tuna: 9, hot6: 9, polish: 9, cream: 9, matdasi: 9, earplug: 9, comic: 9, homefood: 9 };
      s.flags.hoobae = true; s.vars.cat = 2; s.money = 1234567;
      s.current = 'hol_birthday'; s.cv = null;
      JY.UI._t.setState(s);
      JY.UI._t.showScreen('scr-game');
    });
    await T(function (t) { t.renderHUD(); t.renderCard(false); });
    await snap('game-special', true);
    await page.evaluate(function () { var s = JY.UI._state(); s.current = 'v5e_captain_kim'; s.cv = null; JY.UI._t.renderCard(false); });
    await snap('game-legend', true);
    // 효과: 스탯 변화 숫자, 미리보기 점(투시경 화살표), 말풍선, 알림
    await page.evaluate(function () { JY.UI._t.showPreview('l'); });
    await snap('game-preview', true);
    await page.evaluate(function () {
      var t = JY.UI._t; t.showPreview(null); t.animateDeltas({ hp: -12, mt: 15, tr: -8, bd: 11 });
      t.talkBubble(JY.UI._state().current ? JY.Game.currentCard(JY.UI._state()).who : 'captain'); t.toast('🎯 임무 완료! 카드 30장 넘기기 💎 +5 · 짬 +20', 3000);
    });
    await sleep(350);
    await snap('game-fx', true);
    // 배경 12종 × 덩치 큰 인물들: 그림 속 간판·칠판 글씨가 인물에 가리지 않는지 (스크린샷 없이 검사만)
    var sweep = await page.evaluate(function (fnSrc) {
      var check = new Function('return (' + fnSrc + ')')();
      var m = JY.Meta.get(), eq0 = JSON.stringify(m.cos.eq);
      m.cos.eq = { hat: 'gold', face: 'sunglasses', fx: 'sparkle', body: 'dress', prop: 'shovel' };
      var card = document.getElementById('card'), res = [];
      ['barracks', 'night', 'training', 'field', 'gate', 'rain', 'mess', 'office', 'home', 'px', 'hospital', 'beach'].forEach(function (bg) {
        var hats = JY.COSMETIC_ORDER.filter(function (id) { return JY.COSMETICS[id].slot === 'hat'; });
        var who = ['haeng', 'general', 'cat', 'boar', 'captain', 'jogyo', 'hoobae'].concat(hats.map(function (h) { return 'me+' + h; }));
        who.forEach(function (w) {
          if (w.indexOf('me+') === 0) m.cos.eq.hat = w.slice(3);
          card.innerHTML = JY.art.scene(bg, 'summer') + '<div class="char-wrap">' + JY.UI.charSVG(w.indexOf('me+') === 0 ? 'me' : w) + '</div><div class="nametape"><b>이름</b><span>역할</span></div>';
          check().forEach(function (x) { if (x.t === 'covered' || x.t === 'text-overlap' || x.t === 'text-clipped') { x.where = 'scene-' + bg + '+' + w; res.push(x); } });
        });
      });
      m.cos.eq = JSON.parse(eq0);
      return res;
    }, readCheck.toString());
    readIssues = readIssues.concat(sweep);
    await page.evaluate(function () { JY.UI._t.showPreview(null); var b = document.getElementById('talk-bubble'); if (b) b.hidden = true; var t = document.getElementById('toast'); if (t) t.hidden = true; });
    await page.evaluate(function () { var s = JY.UI._state(); s.current = 'hol_birthday'; s.cv = null; JY.UI._t.renderCard(false); });
    await T(function (t) { t.startCoach(); });
    await snap('coach-1', true);
    await page.evaluate(function () { document.querySelector('#coach-box [data-c="next"]').click(); document.querySelector('#coach-box [data-c="next"]').click(); document.querySelector('#coach-box [data-c="next"]').click(); });
    await snap('coach-4', true);
    await T(function (t) { t.endCoach(); });
    var cs = await page.evaluate(function () { var c = document.getElementById('card').getBoundingClientRect(), w = document.querySelector('#card .char-wrap').getBoundingClientRect(); return { card: [Math.round(c.width), Math.round(c.height)], char: Math.round(w.height), x: !document.getElementById('choice-x-btn').hidden }; });
    report.cardSize[V.name] = cs;
    await page.evaluate(function () { var s = JY.UI._state(); s.current = 'em_snake'; s.cv = null; });
    await T(function (t) { t.renderCard(false); });
    await snap('game-alert', true);
    await page.evaluate(function () { document.getElementById('alert').click(); });
    await sleep(250);
    await snap('game-urgent', true);
    var cs2 = await page.evaluate(function () { var c = document.getElementById('card').getBoundingClientRect(); return [Math.round(c.width), Math.round(c.height)]; });
    report.cardSize[V.name].urgent = cs2;
    await T(function (t) { t.stopUrgent(); });
    // 결과 쪽지: 이벤트 잔뜩
    await T(function (t) {
      t.showResult({ say: '김말년이 누운 채로 짜장이냐 짬뽕이냐를 물었다. 생활관이 반으로 갈렸고 토론은 새벽 두 시까지 이어졌다. 결국 짬짜면으로 합의했다.', deltas: { hp: -12, mt: 15, tr: -8, bd: 11 },
        events: [{ type: 'cond', id: 'gifts', text: '' }, { type: 'pay', n: 1200000, save: 550000 }, { type: 'promo', text: '병장 진급! 휴가 +10일' }, { type: 'season', text: '겨울이 왔다. 하늘에서 쓰레기(눈)가 내린다.' }, { type: 'leave', text: '포상휴가 +3일' },
          { type: 'item', id: 'chocopie', n: 2 }, { type: 'money', n: -30000 }, { type: 'cond', text: '🤧 독감 유행 시작! (카드마다 체력 -2)' }, { type: 'aff', who: 'dumb', n: 6 }, { type: 'bff', who: 'dumb', text: '동기 사랑 — 전우애 증가 1.15배' }, { type: 'insurance', text: '🛡️ 전역 보험 발동! "…꿈이었다!" 멘탈이(가) 50으로 돌아왔다.' }] }, function () {});
    });
    await snap('result-many', true);
    await page.evaluate(function () { document.getElementById('result').hidden = true; });

    // 모달들
    var modals = [
      ['bag', function (t) { t.openBag(); }], ['bag-premium', function (t) { t.openBag('premium'); }], ['px', function (t) { var s = JY.UI._state(); s.pxDay = 0; t.openPX(); }],
      ['mates', function (t) { t.openMates(); var b = document.querySelector('[data-giftto="dumb"]'); if (b) b.click(); }],
      ['leave', function (t) { var s = JY.UI._state(); s.leave = 12; s.lastLeaveEnd = -99; s.conds = []; t.openLeave(); }], ['menu', function (t) { t.openMenu(); }], ['help', function (t) { t.openHelp(); }],
      ['promo', function (t) { t.showPromo({ rank: 1, leave: 4 }, function () {}); }],
      ['levelup', function (t) { t.showLevelUp([{ lv: 10, gem: 70, box: 1 }], ['beanie', 'chefhat', 'jogyohat', 'pinkcamo']); }],
      ['daily', function (t) { t.openDaily(); }]
    ];
    for (var mi = 0; mi < modals.length; mi++) {
      await T(modals[mi][1]);
      await snap('modal-' + modals[mi][0], true);
      await T(function (t) { var m = document.getElementById('modal'); m.hidden = true; document.getElementById('modal-box').innerHTML = ''; });
    }
    // 화면들
    var screens = [
      ['barracks-face', function (t) { t.renderBarracks('face'); }], ['barracks-wardrobe', function (t) { t.renderBarracks('wardrobe'); }],
      ['barracks-gear', function (t) { t.renderBarracks('gear'); }], ['barracks-mission', function (t) { t.renderBarracks('mission'); }],
      ['shop-items', function (t) { t.renderShop('items'); }], ['shop-cos', function (t) { t.renderShop('cos'); }], ['shop-box', function (t) { t.renderShop('box'); }],
      ['album-endings', function (t) { t.renderAlbum('endings'); }], ['album-scenes', function (t) { t.renderAlbum('scenes'); }], ['album-medals', function (t) { t.renderAlbum('medals'); }],
      ['rank-mine', function (t) { t.renderRank('mine'); }]
    ];
    for (var si = 0; si < screens.length; si++) { await T(screens[si][1]); await snap(screens[si][0]); }
    // 엔딩 화면
    await page.evaluate(function () {
      var s = JY.Game.newState({ start: '2026-03-02', name: '아주긴이름', mos: 'clerk', trait: 'glass' });
      s.rank = 4; s.day = s.total; s.flags.catAdopt = s.flags.gfStay = s.flags.special = s.flags.sharp = s.flags.malchul = true;
      s.over = { id: 'cat', list: ['cat', 'gf', 'elite', 'model', 'malchul', 'normal'], good: true, day: s.total }; s.over.score = JY.Game.score(s);
      JY.UI._t.setState(s); JY.UI._t.showEnding();
      document.getElementById('modal').hidden = true;
    });
    await sleep(1000); // 도장 애니메이션이 끝난 뒤 잰다
    await snap('ending');
    await page.evaluate(function () { document.getElementById('score-panel').scrollIntoView(); });
    await sleep(300);
    await snap('ending-score');

    // v6 자대 지도: 지도 · 장소 11곳 · 조합 · 득템 결과 · 배치 명령
    await page.evaluate(function () {
      var s = JY.Game.newState({ start: '2026-03-02', name: '아주긴이름', unit: 'mech', trait: 'glass', seed: 5 });
      s.rank = 3; s.day = 300; s.queue = []; s.current = null; s.assigned = true; s.phase = 'unit'; s.turn = 9; s.step = 'free'; s.ap = 3;
      s.spec = { id: 'drive', lv: 3, xp: 2 }; s.money = 500000; s.leave = 6; s.lastLeaveEnd = -99; s.pxDay = 0;
      s.dutyNote = { text: '오늘 일과: 보급품 하역. 박스 200개를 옮겼다.', deltas: { hp: -5, bd: 3 } };
      s.items = { ramen: 2, tuna: 1, coffee: 1, milk: 1, gunbbang: 1, star: 1, chocopie: 3, mandu: 1, hotbar: 1, buldak: 1, ration: 1, matdasi: 1, kkal: 1, bosscoffee: 1 };
      s.recipes = { bbog: 1, party: 1 };
      JY.Meta.get().mapTutorial = true;
      JY.UI._t.setState(s); JY.UI._t.showScreen('scr-game'); JY.UI._t.renderHUD(); JY.UI._t.renderCard(false);
    });
    await snap('map', true);
    for (var li of ['barracks', 'px', 'mess', 'gym', 'range', 'office', 'cyber', 'supply', 'hill', 'clinic', 'garage']) {
      await T(function (t, id) { t.openLoc(id); }, li);
      await snap('loc-' + li, true);
      await T(function (t) { t.closeModal(); });
    }
    await T(function (t) { t.openBag('craft'); });
    await snap('bag-craft', true);
    await T(function (t) { t.closeModal(); });
    await T(function (t) {
      t.showResult({ say: '선반 맨 위 상자를 열었다. 행보관 서랍 깊은 곳에 무언가가 있었다.', deltas: { hp: -2, tr: 3 },
        events: [{ type: 'speclv', text: '🚚 특기 운전 Lv4!' }, { type: 'tag', spec: 'drive', n: 2 }],
        loot: [{ id: 'kkal', rarity: 'e' }, { id: 'bosscoffee', rarity: 'l' }, { id: 'gunbbang', rarity: 'c' }, { id: 'ration', rarity: 'r' }], tier: 'great' }, function () {});
    });
    await snap('result-loot', true);
    await page.evaluate(function () { document.getElementById('result').hidden = true; });
    await T(function (t) {
      var s = JY.UI._state();
      s.assignInfo = { spec: 'drive', lv: 3, mos: 'driver', unit: 'mech', tags: { shoot: 3, fit: 4, cook: 1, admin: 2, drive: 9, medic: 1, social: 5 },
        why: [{ txt: '번쩍 든다', n: 3 }, { txt: '나사를 풀어 본다', n: 2 }, { txt: '엉덩이 들고 빨리', n: 1 }], shown: false };
      t.showAssign();
    });
    await snap('modal-assign', true);
    await T(function (t) { t.closeModal(); });
    // 미니게임 화면
    for (var mg of ['dressup', 'memory', 'cook']) {
      await page.evaluate(function (id) { JY.Mini.start(id, { stats: { hp: 50, mt: 50 }, mos: 'clerk', face: function (w) { return JY.UI.charSVG(w); } }, function () {}); }, mg);
      await sleep(2300);
      await snap('mini-' + mg, true);
      await page.evaluate(function () { document.getElementById('mini').hidden = true; });
    }
    if (vi === 0) { report.svg = await page.evaluate(svgBounds); report.face = await page.evaluate(faceCheck); }
    report.layout[V.name] = issues;
    report.read[V.name] = readIssues;
    await ctx.close();
  }

  /* 버튼을 눌렀을 때 실제로 바뀌는지 (390x844, 실제 탭) */
  var ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  var p = await ctx2.newPage(); p.setDefaultTimeout(5000);
  p.on('pageerror', function (e) { report.errors.push('func ' + e.message); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, function (r) { r.abort(); });
  await p.goto(url); await sleep(300);
  function F(name, okv, detail) { report.functional.push({ name: name, ok: !!okv, detail: detail }); }
  async function tapSel(sel) { await p.click(sel); await sleep(250); }
  await p.evaluate(function () {
    var m = JY.Meta.get(); m.gems = 500; m.jjam = 500; JY.PREMIUM_ORDER.forEach(function (id) { m.stash[id] = 1; }); JY.Meta.save();
    document.getElementById('modal').hidden = true;
    var s = JY.Game.newState({ start: '2026-03-02', name: '점검병', mos: 'clerk' });
    s.rank = 2; s.day = 120; s.queue = []; s.money = 200000; s.pxDay = 0; s.leave = 9; s.lastLeaveEnd = -99;
    s.items = { mandu: 2, chocopie: 2 }; s.current = 'hol_birthday'; s.cv = null; s.promo = [0, 35, 60, 9999, 9999];
    s.assigned = true; s.cardsOnly = true; // 카드 규칙 검사 (자대 지도는 아래에서 따로)
    JY.Game.STATS.forEach(function (k) { s.stats[k] = 50; });
    JY.UI._t.setState(s); JY.UI._t.showScreen('scr-game'); JY.UI._t.renderHUD(); JY.UI._t.renderCard(false);
  });
  await sleep(300);
  var st = function () { return p.evaluate(function () { var s = JY.UI._state(); return { items: Object.assign({}, s.items), stats: Object.assign({}, s.stats), money: s.money, leave: s.leave, insight: s.insight, aff: Object.assign({}, s.aff), cur: s.current, day: s.day, specials: s.specials, gifts: (s.conds || []).filter(function (c) { return c.id === 'gifts'; }).length }; }); };
  var a = await st();
  // 가방 → 만두 사용
  await tapSel('#dock-bag'); await tapSel('#modal-box .item[data-id="mandu"]'); await tapSel('#modal-box [data-act="use"]');
  var b = await st();
  F('가방: 만두 사용', b.items.mandu === a.items.mandu - 1 && b.stats.mt > a.stats.mt && b.stats.hp > a.stats.hp, { before: a.items.mandu, after: b.items.mandu, mt: [a.stats.mt, b.stats.mt] });
  var hudV = await p.evaluate(function () { return document.querySelector('.stat[data-k="mt"]').style.getPropertyValue('--v'); });
  F('HUD 멘탈 게이지 갱신', +hudV === b.stats.mt, hudV);
  // 특급 보급품: 포상휴가증
  await tapSel('#modal-box [data-tab="premium"]'); await tapSel('#modal-box .item[data-id="leave3"]'); await tapSel('#modal-box [data-act="usep"]');
  var c = await st();
  F('특급: 포상휴가증 +3', c.leave === b.leave + 3, [b.leave, c.leave]);
  var badge = await p.textContent('#leave-badge');
  F('휴가 배지 갱신', badge === String(c.leave), badge);
  await tapSel('#modal-box .item[data-id="insight"]'); await tapSel('#modal-box [data-act="usep"]');
  var d = await st();
  F('특급: 투시경 사용', d.insight === c.insight + 12, [c.insight, d.insight]);
  await tapSel('#modal-box [data-act="close"]');
  // 투시경 → 카드 끌면 ▲▼ 표시
  var cb = await (await p.$('#card')).boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.mouse.down(); await p.mouse.move(cb.x + cb.width / 2 - 50, cb.y + cb.height / 2, { steps: 4 });
  var arrows = await p.evaluate(function () { return Array.prototype.map.call(document.querySelectorAll('.stat .dot.dir'), function (x) { return x.textContent; }).join(''); });
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 3 }); await p.mouse.up(); await sleep(300);
  F('투시경: 미리보기 화살표', /[▲▼]/.test(arrows), arrows);
  // PX 구매
  await tapSel('#dock-px');
  var w0 = await p.textContent('#modal-box .wallet span');
  await tapSel('#modal-box .item[data-id="tuna"]');
  var w1 = await p.textContent('#modal-box .wallet span');
  var e = await st();
  F('PX: 참치캔 구매', e.items.tuna === 1 && e.money < d.money && w0 !== w1, { money: [d.money, e.money], wallet: [w0, w1] });
  await tapSel('#modal-box [data-act="close"]');
  F('PX 나가면 쿨다운', await p.evaluate(function () { return document.getElementById('dock-px').classList.contains('off'); }));
  // 동료: 박덤벙에게 초코파이
  await tapSel('#dock-mates'); await tapSel('#modal-box [data-giftto="dumb"]'); await tapSel('#modal-box [data-gift="chocopie"]');
  var f = await st();
  F('동료: 초코파이 선물', f.items.chocopie === e.items.chocopie - 1 && f.aff.dumb >= e.aff.dumb + 18, { aff: [e.aff.dumb, f.aff.dumb] });
  await tapSel('#modal-box [data-act="close"]');
  // 특수 대답 버튼 (박덤벙 카드 + 초코파이)
  var xVisible = await p.evaluate(function () { return !document.getElementById('choice-x-btn').hidden; });
  F('특수 대답 버튼 표시', xVisible);
  if (xVisible) {
    await tapSel('#choice-x-btn'); await tapSel('#choice-x-btn'); await sleep(400);
    var g = await st();
    // 같은 턴에 '위문품 대량 도착'(초코파이 +2)이 시작될 수 있다
    var chocoWant = f.items.chocopie - 1 + (g.gifts > f.gifts ? 2 : 0);
    F('특수 대답: 초코파이 소모 + 카드 진행', g.specials === f.specials + 1 && g.items.chocopie === chocoWant && g.cur !== 'hol_birthday', { choco: [f.items.chocopie, g.items.chocopie, chocoWant], specials: [f.specials, g.specials], cur: g.cur });
    if (await p.evaluate(function () { return !document.getElementById('result').hidden; })) { await sleep(400); await tapSel('#result'); }
  }
  // 돌발 상황: 경보 → (경보 중엔 선택 안 됨) → 탭하면 시간 시작 → 시간 초과 결과
  await p.evaluate(function () { var s = JY.UI._state(); s.current = 'em_snake'; s.cv = null; JY.UI._t.renderCard(false); });
  var al = await p.evaluate(function () { return { alert: !document.getElementById('alert').hidden, bar: !document.getElementById('urgent-bar').hidden, text: document.getElementById('alert').textContent }; });
  F('돌발: 경보 화면 먼저', al.alert && !al.bar && /돌발 상황/.test(al.text) && /놓치면/.test(al.text), al);
  await p.evaluate(function () { var b = document.querySelector('.choice[data-side="l"]'); b.click(); b.click(); });
  var e1 = await st();
  F('돌발: 경보 중엔 선택 안 됨', e1.cur === 'em_snake');
  await tapSel('#alert');
  var al2 = await p.evaluate(function () { return { alert: !document.getElementById('alert').hidden, bar: !document.getElementById('urgent-bar').hidden, hint: document.getElementById('timeout-hint').textContent, hintOn: !document.getElementById('timeout-hint').hidden }; });
  F('돌발: 탭하면 제한 시간 시작 + 놓치면 안내', !al2.alert && al2.bar && al2.hintOn && /못 고르면/.test(al2.hint), al2);
  var urgSec = await p.evaluate(function () { return JY.Game.currentCard(JY.UI._state()).urgent; });
  await sleep(urgSec * 1000 + 700);
  var e2 = await p.evaluate(function () { var r = document.getElementById('result'); return { result: !r.hidden, head: (r.querySelector('.note-head') || {}).textContent || '', cur: JY.UI._state().current }; });
  F('돌발: 시간 초과 결과 표시', e2.result && /시간 초과/.test(e2.head) && e2.cur !== 'em_snake', e2);
  if (e2.result) { await sleep(400); await tapSel('#result'); }
  // 도크: 훈련소에선 동료·PX·휴가 버튼이 안 보인다
  var dk = await p.evaluate(function () {
    var keep = JY.UI._state(), t = JY.Game.newState({ start: '2026-03-02' });
    JY.UI._t.setState(t); JY.UI._t.renderHUD();
    var r = ['dock-mates', 'dock-px', 'dock-leave', 'dock-bag'].map(function (id) { return document.getElementById(id).hidden; });
    JY.UI._t.setState(keep); JY.UI._t.renderHUD();
    return r;
  });
  F('도크: 훈련소에선 쓸 수 없는 버튼 숨김', dk[0] && dk[1] && dk[2] && !dk[3], dk);


  // 휴가 출발
  await p.evaluate(function () { var s = JY.UI._state(); s.lastLeaveEnd = -99; s.conds = []; s.blockUntil = 0; JY.UI._t.renderHUD(); });
  var h0 = await st();
  await tapSel('#dock-leave'); await tapSel('#modal-box [data-act="go"]');
  var h1 = await st();
  F('휴가 출발: 날짜·휴가일 변화', h1.day > h0.day && h1.leave < h0.leave, { day: [h0.day, h1.day], leave: [h0.leave, h1.leave] });
  if (await p.evaluate(function () { return !document.getElementById('modal').hidden; })) await tapSel('#modal-box .btn-primary');
  if (await p.evaluate(function () { return !document.getElementById('modal').hidden; })) await tapSel('#modal-box .btn-primary');
  // 상점: 꾸미기 사면 내 캐릭터에 반영
  await p.evaluate(function () { JY.UI._t.renderShop('cos'); });
  await sleep(200);
  var svg0 = await p.innerHTML('#shop-me');
  await tapSel('[data-cos="gold"]');
  var svg1 = await p.innerHTML('#shop-me');
  F('상점: 황금 헬멧 구매 → 캐릭터에 표시', svg1.indexOf('#f2c335') >= 0 && svg0 !== svg1);
  // 막사: 외모 바꾸기, 강화
  await p.evaluate(function () { JY.UI._t.renderBarracks('face'); });
  await sleep(200);
  var f0 = await p.innerHTML('#me-big');
  await tapSel('[data-face="mouth"][data-d="1"]');
  var f1 = await p.innerHTML('#me-big');
  F('막사: 입 모양 변경 반영', f0 !== f1);
  await tapSel('#barracks-tabs [data-tab="gear"]');
  var j0 = await p.evaluate(function () { return JY.Meta.get().jjam; });
  await tapSel('[data-up="wallet"]'); await sleep(900);
  var up = await p.evaluate(function () { return { lv: JY.Meta.upLevel('wallet'), jjam: JY.Meta.get().jjam }; });
  F('막사: 지갑 강화', up.lv === 1 && up.jjam === j0 - 80, up);
  var txt = await p.textContent('.gear-row:nth-child(4) b');
  F('강화 수치 화면 반영', /\+1/.test(txt), txt);

  // v6: 부대 지도에서 행동 → 결과 → 시간 감소, 조합, 장소 PX, 취침
  await p.evaluate(function () {
    var s = JY.Game.newState({ start: '2026-03-02', name: '점검병', unit: 'coast', seed: 21 });
    s.rank = 2; s.day = 150; s.queue = []; s.current = null; s.assigned = true; s.phase = 'unit'; s.turn = 4; s.step = 'free'; s.ap = 3;
    s.spec = { id: 'cook', lv: 3, xp: 0 }; s.money = 100000; s.pxDay = 0; s.emer.since = 0;
    s.items = { ramen: 1, chocopie: 3 };
    JY.Game.STATS.forEach(function (k) { s.stats[k] = 50; });
    JY.Meta.get().mapTutorial = true;
    JY.UI._t.setState(s); JY.UI._t.renderHUD(); JY.UI._t.renderCard(false);
  });
  await sleep(200);
  var m0 = await p.evaluate(function () { return { base: !document.getElementById('base').hidden, tiles: document.querySelectorAll('#base .loc').length, card: !document.getElementById('card-zone').hidden }; });
  F('자대: 부대 지도 표시 (장소 10곳 이상)', m0.base && m0.tiles >= 10 && !m0.card, m0);
  await tapSel('.loc[data-loc="barracks"]');
  var bd0 = await p.evaluate(function () { return JY.UI._state().stats.bd; });
  await tapSel('#modal-box .act[data-a="chat"]'); await sleep(400);
  var m1 = await p.evaluate(function () { var s = JY.UI._state(); return { ap: s.ap, bd: s.stats.bd, result: !document.getElementById('result').hidden }; });
  F('자대: 수다 → 결과 쪽지 + 시간 1 + 전우애', m1.result && m1.ap === 2 && m1.bd !== bd0, m1);
  if (m1.result) { await sleep(400); await tapSel('#result'); }
  // 조합: 뽀글이, 초코파이 케이크 (요리 Lv3 → 2개)
  await tapSel('#dock-bag'); await tapSel('#modal-box [data-tab="craft"]');
  await tapSel('#modal-box [data-craft="bbog"]'); await tapSel('#modal-box [data-craft="cake"]');
  var m2 = await p.evaluate(function () { var s = JY.UI._state(); return { bbog: s.items.bbog, cake: s.items.cake, ramen: s.items.ramen || 0, recipes: Object.keys(JY.Meta.get().recipes || {}) }; });
  F('조합: 뽀글이·케이크 (요리 특기 하나 더) + 레시피 기록', m2.bbog === 2 && m2.cake === 2 && m2.ramen === 0 && m2.recipes.indexOf('bbog') >= 0, m2);
  await tapSel('#modal-box [data-act="close"]');
  // 장소 PX: 장보기 → 시간 1
  await tapSel('.loc[data-loc="px"]'); await tapSel('#modal-box .act[data-a="shop"]');
  await tapSel('#modal-box .item[data-id="ramen"]');
  await tapSel('#modal-box [data-act="close"]');
  var m3 = await p.evaluate(function () { var s = JY.UI._state(); return { ap: s.ap, ramen: s.items.ramen }; });
  F('지도 PX 장보기: 라면 구매 + 시간 1', m3.ramen === 1 && m3.ap === 1, m3);
  // 특기 미니게임: 특식 만들기 → 결과
  await tapSel('.loc[data-loc="mess"]'); await tapSel('#modal-box .act[data-a="feast"]'); await sleep(2600);
  var mg = await p.evaluate(function () { return !document.getElementById('mini').hidden && !!document.getElementById('tm-btn'); });
  F('특기 행동: 특식 만들기 미니게임 시작', mg);
  for (var k = 0; k < 10 && mg; k++) { await p.evaluate(function () { var b = document.getElementById('tm-btn'); if (b && !b.disabled) b.click(); }); await sleep(700); if (!(await p.evaluate(function () { return !document.getElementById('mini').hidden; }))) break; }
  await sleep(1900);
  var m4 = await p.evaluate(function () { var s = JY.UI._state(); return { result: !document.getElementById('result').hidden, ap: s.ap, cd: s.cd['mess.feast'] }; });
  F('특식 만들기 결과 + 2턴 쉬기', m4.result && m4.ap === 0 && m4.cd === 6, m4);
  if (m4.result) { await sleep(400); await tapSel('#result'); }
  // 취침 → 밤 사건 또는 다음 턴
  var day0 = await p.evaluate(function () { return JY.UI._state().day; });
  await tapSel('#btn-sleep'); await sleep(500);
  for (var g = 0; g < 8; g++) {
    var q = await p.evaluate(function () { var s = JY.UI._state(); return { r: !document.getElementById('result').hidden, card: !!s.current && !document.getElementById('card-zone').hidden, mini: !document.getElementById('mini').hidden, alert: !document.getElementById('alert').hidden, base: !document.getElementById('base').hidden, turn: s.turn }; });
    if (q.base && q.turn > 4) break;
    if (q.alert) { await tapSel('#alert'); continue; }
    if (q.r) { await sleep(400); await tapSel('#result'); continue; }
    if (q.mini) { await p.evaluate(function () { document.getElementById('mini').hidden = true; JY.Game.finishMini(JY.UI._state(), 'good'); JY.UI._t.renderCard(false); }); continue; }
    if (q.card) { await p.evaluate(function () { var b = document.querySelector('.choice[data-side="l"]'); b.click(); b.click(); }); await sleep(600); continue; }
    await sleep(300);
  }
  var m5 = await p.evaluate(function () { var s = JY.UI._state(); return { turn: s.turn, day: s.day, step: s.step }; });
  F('취침 → 2주 흐르고 다음 턴', m5.turn === 5 && m5.day - day0 === 14, [m5, day0]);

  await ctx2.close();
  await browser.close(); server.close();

  // 보고
  var total = 0;
  Object.keys(report.layout).forEach(function (vn) {
    var list = report.layout[vn];
    var uniq = {};
    list.forEach(function (x) { var k = x.t + ' ' + x.el + ' @' + x.where; if (!uniq[k]) uniq[k] = x; });
    var keys = Object.keys(uniq);
    total += keys.length;
    console.log('\n[' + vn + '] 레이아웃 문제 ' + keys.length + '개');
    keys.slice(0, 40).forEach(function (k) { var x = uniq[k]; console.log('  - ' + k + ' ' + JSON.stringify(Object.assign({}, x, { where: undefined, el: undefined, t: undefined }))); });
  });
  // 읽기 쉬움·겹침
  var readTotal = 0;
  Object.keys(report.read).forEach(function (vn) {
    var list = report.read[vn], uniq = {};
    list.forEach(function (x) { var k = x.t + ' ' + x.el + ' "' + x.txt + '"'; if (!uniq[k]) uniq[k] = { x: x, at: [] }; if (uniq[k].at.indexOf(x.where) < 0) uniq[k].at.push(x.where); });
    var keys = Object.keys(uniq).sort();
    readTotal += keys.length;
    console.log('\n[' + vn + '] 겹침·가독성 문제 ' + keys.length + '개');
    keys.forEach(function (k) { var u = uniq[k], x = u.x; console.log('  - ' + k + (x.by ? ' ← ' + x.by : '') + (x.ratio ? ' 대비 ' + x.ratio : '') + (x.fs ? ' ' + x.fs + 'px' : '') + ' @' + u.at.slice(0, 4).join(',') + (u.at.length > 4 ? '…' : '')); });
  });
  total += readTotal;
  console.log('\n꾸미기·소품이 눈·입을 가림:', report.face.length ? '' : '없음');
  report.face.forEach(function (x) { console.log('  - ' + x.who + ' ' + x.part + ' ← ' + x.by); });
  total += report.face.length;
  if (process.env.AUDIT_JSON) fs.writeFileSync(process.env.AUDIT_JSON, JSON.stringify(report, null, 1));
  console.log('\n카드 크기:', JSON.stringify(report.cardSize));
  console.log('\n캐릭터 그림이 틀 밖으로:', report.svg.length ? '' : '없음');
  report.svg.forEach(function (x) { console.log('  - ' + x.who + ' ' + JSON.stringify(x.over)); });
  console.log('\n기능:');
  report.functional.forEach(function (x) { console.log('  ' + (x.ok ? '✓' : '✗') + ' ' + x.name + (x.ok ? '' : ' ' + JSON.stringify(x.detail))); });
  if (report.errors.length) console.log('\n에러:\n  ' + report.errors.join('\n  '));
  var bad = total + report.svg.length + report.functional.filter(function (x) { return !x.ok; }).length + report.errors.length;
  console.log('\n문제 합계: ' + bad);
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); server.close(); process.exit(1); });
