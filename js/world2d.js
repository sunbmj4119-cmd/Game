/* v7 자대 2D 월드: 위에서 내려다본 부대를 걸어 다니며 생활한다
 *  - 이동: 화면을 누른 채 끌기(가상 조이스틱) · 물건/사람을 톡 하면 거기까지 걸어감 · 키보드 방향키/WASD
 *  - 물건 가까이 = 장소 행동(꿀잠·뽀글이·사격·파밍…), 사람 가까이 = 수다·이야기·부탁(❗), 반짝이 = 줍기
 *  - 행보관은 순찰하며 앞을 본다(빨간 부채꼴). 보이는 데서 노는 행동을 하면 걸린다 → 숨어서 하기
 *  - 걸으면 시간이 간다. 22:00 점호 때 생활관에 없으면 지각
 * 게임 규칙은 전부 JY.Game(엔진)이 처리하고, 여기는 화면·이동·충돌만 맡는다. */
(function (JY) {
  'use strict';

  var W = 900, H = 1300;            // 월드 크기
  var SPEED = 150, MIN_PER_PX = 1 / 26; // 걷는 속도(px/초), 1px 걸을 때 흐르는 분
  var NEAR = 46, VIEW_R = 190, VIEW_HALF = 38 * Math.PI / 180;

  // 건물(안에 들어가면 지붕이 투명해짐)과 바깥 구역
  var ZONES = [
    { id: 'hill', name: '뒷산', x: 0, y: 0, w: 560, h: 250, out: true, ground: '#6f9a4b' },
    { id: 'range', name: '사격장', x: 600, y: 20, w: 280, h: 230, out: true, ground: '#c9b48a' },
    { id: 'barracks', name: '생활관', x: 40, y: 300, w: 360, h: 230, floor: '#efe3c2', roof: '#5d6b3a' },
    { id: 'office', name: '행정반', x: 470, y: 300, w: 390, h: 150, floor: '#e8e4da', roof: '#6b5a3a' },
    { id: 'cyber', name: '사지방', x: 470, y: 470, w: 180, h: 110, floor: '#dfe7ee', roof: '#4a5d7a' },
    { id: 'clinic', name: '의무실', x: 680, y: 470, w: 180, h: 110, floor: '#f4f1ee', roof: '#9a3b34' },
    { id: 'parade', name: '연병장', x: 60, y: 630, w: 500, h: 260, out: true, ground: '#d2be93' },
    { id: 'gym', name: '체력단련장', x: 590, y: 640, w: 280, h: 250, out: true, ground: '#b9a77c' },
    { id: 'mess', name: '식당·취사장', x: 40, y: 940, w: 360, h: 200, floor: '#eef0ea', roof: '#56662f' },
    { id: 'px', name: 'PX', x: 470, y: 940, w: 190, h: 140, floor: '#f2efe4', roof: '#1b4332' },
    { id: 'supply', name: '보급창고', x: 690, y: 940, w: 180, h: 200, floor: '#ddd3bd', roof: '#4d4436' },
    { id: 'garage', name: '정비고', x: 470, y: 1110, w: 190, h: 130, floor: '#cfcfc8', roof: '#3d4a52', need: 'garage' },
    { id: 'gate', name: '위병소', x: 380, y: 1225, w: 140, h: 60, floor: '#e6dccb', roof: '#a33b3b' }
  ];
  // 장소 행동이 놓인 자리 (loc.act)
  var POIS = {
    'barracks.nap': [110, 348, '🛏️'], 'barracks.diary': [300, 348, '📝'], 'barracks.alone': [372, 420, '🎧'], 'barracks.tv': [220, 500, '📺'],
    'barracks.craft': [74, 470, '🍳'], 'barracks.chat': [190, 430, '💬'],
    'office.leave': [520, 350, '🏖️'], 'office.paper': [640, 352, '📑'], 'office.coffee': [760, 346, '☕'], 'office.schedule': [826, 414, '🗂️'],
    'cyber.surf': [505, 515, '🛍️'], 'cyber.study': [560, 555, '📚'], 'cyber.phone': [622, 510, '📱'],
    'clinic.treat': [722, 520, '🩹'], 'clinic.heal': [812, 545, '💊'],
    'range.practice': [680, 92, '🎯'], 'range.shells': [760, 196, '🧹'], 'range.sharp': [842, 92, '🏆'],
    'hill.hide': [118, 92, '😴'], 'hill.forage': [400, 168, '🍀'],
    'gym.workout': [640, 700, '🏋️'], 'gym.jokgu': [760, 805, '⚽'], 'gym.elite': [842, 690, '🏅'],
    'mess.snack': [130, 992, '🍖'], 'mess.cat': [362, 1112, '🗑️'], 'mess.feast': [250, 992, '🔥'],
    'px.shop': [520, 992, '🛒'], 'px.freezer': [622, 1042, '🧊'],
    'supply.scavenge': [760, 1012, '📦'], 'supply.repair': [822, 1100, '🔧'],
    'garage.maintain': [520, 1172, '🛠️'], 'garage.drive': [612, 1204, '🚙']
  };
  // 행보관 순찰길: 연병장 → 행정반 → 체력단련장 → 보급창고 → 식당 앞
  var PATROL = [[250, 595], [650, 595], [650, 385], [650, 595], [880, 600], [880, 920], [780, 1035], [880, 920], [560, 920], [250, 920], [250, 595]];
  var TREES = [];
  (function () { var r = 7; for (var i = 0; i < 46; i++) { r = (r * 9301 + 49297) % 233280; var x = 10 + (r / 233280) * 540; r = (r * 9301 + 49297) % 233280; var y = 10 + (r / 233280) * 228; if (Math.abs(x - 118) < 40 && Math.abs(y - 92) < 36) continue; if (Math.abs(x - 400) < 30 && Math.abs(y - 168) < 30) continue; TREES.push([x, y, 14 + (i % 3) * 4]); } })();

  var cv = null, g = null, panel = null, hooks = null, host = null, raf = 0, last = 0, dpr = 1, k = 1;
  var me = { x: 220, y: 565, dir: 0, moving: false, bob: 0 };
  var cam = { x: 0, y: 0 }, keys = {}, joy = null, target = null;
  var npcs = [], haeng = null, pickups = [], pois = [], sprites = {}, floats = [];
  var seen = false, nearObj = null, panelKey = '', walkAcc = 0, roll = null, turnSeen = -1, msgT = 0, msg = '';
  var listeners = [];

  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); }
  function zoneAt(x, y) {
    for (var i = 0; i < ZONES.length; i++) { var z = ZONES[i]; if (!z.out && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; }
    return null;
  }
  function areaAt(x, y) { // 바깥 구역 포함 (어디에 있는지 보여 주기용)
    var z = zoneAt(x, y); if (z) return z;
    for (var i = 0; i < ZONES.length; i++) { var o = ZONES[i]; if (o.out && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o; }
    return null;
  }
  function inBarracks() { var z = zoneAt(me.x, me.y); return !!z && z.id === 'barracks'; }
  function sprite(who) {
    if (sprites[who]) return sprites[who];
    var svg = JY.UI.charSVG(who);
    if (svg.indexOf('xmlns=') < 0) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    var img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    sprites[who] = img;
    return img;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function heatOn(s, id) { return !!s && (s.heat || []).indexOf(id) >= 0; }
  function viewR(s) { return heatOn(s, 'haeng') ? VIEW_R * 1.25 : VIEW_R; } // 악조건 '악마 행보관': 더 멀리 본다
  function pointIn(z, pad) { pad = pad || 24; return [rnd(z.x + pad, z.x + z.w - pad), rnd(z.y + pad, z.y + z.h - pad)]; }
  function zoneById(id) { return ZONES.filter(function (z) { return z.id === id; })[0]; }
  function say(t, ms) { msg = t; msgT = ms || 2200; }

  /* ── 턴 준비: 사람·반짝이·택배 배치 ── */
  function setupTurn() {
    var s = hooks.state();
    turnSeen = s.turn;
    me.x = 220; me.y = 560; target = null; joy = null; roll = null; walkAcc = 0;
    var locs = hooks.locations();
    npcs = [];
    locs.forEach(function (L) {
      if (!L.npc || L.npc === 'haeng') return;
      var z = zoneById(L.id) || zoneById('parade');
      var p = pointIn(z, 30);
      npcs.push({ who: L.npc, x: p[0], y: p[1], tx: p[0], ty: p[1], zone: z, wait: rnd(0, 2) });
    });
    if (s.quest && !npcs.some(function (n) { return n.who === s.quest.who; }) && s.quest.who !== 'haeng') {
      var pz = zoneById('parade'), pp = pointIn(pz, 40);
      npcs.push({ who: s.quest.who, x: pp[0], y: pp[1], tx: pp[0], ty: pp[1], zone: pz, wait: 1 });
    }
    haeng = { who: 'haeng', x: PATROL[0][0], y: PATROL[0][1], i: 1, dir: 0, pause: 0 };
    pickups = [];
    var spots = [['hill', 'forest'], ['hill', 'forest'], ['parade', 'supply'], ['gym', 'supply'], ['range', 'supply']];
    spots.forEach(function (sp) {
      var p = pointIn(zoneById(sp[0]), 20);
      for (var k = 0; k < 12 && pickups.some(function (o) { return Math.hypot(o.x - p[0], o.y - p[1]) < 80; }); k++) p = pointIn(zoneById(sp[0]), 20);
      pickups.push({ x: p[0], y: p[1], table: sp[1], t: rnd(0, 6) });
    });
    if (Math.random() < 0.45) { pickups.push({ x: 450, y: 1256, table: 'outside', courier: true, t: 0 }); say('📦 택배가 위병소에 도착했다!', 2600); }
    buildPois();
  }
  function buildPois() {
    var locs = hooks.locations();
    pois = [];
    locs.forEach(function (L) {
      L.acts.forEach(function (A) {
        var p = POIS[L.id + '.' + A.id]; if (!p) return;
        pois.push({ loc: L, act: A, x: p[0], y: p[1], icon: p[2] });
      });
    });
  }

  /* ── 갱신 ── */
  function blocked() { return hooks.blocked() || !!roll && roll.done; }
  function update(dt) {
    var s = hooks.state();
    if (!s || s.phase !== 'unit') return;
    if (s.turn !== turnSeen) setupTurn();
    floats = floats.filter(function (f) { f.t -= dt; return f.t > 0; });
    if (msgT > 0) msgT -= dt * 1000;
    if (hooks.blocked()) return;
    // 이동
    var vx = 0, vy = 0;
    if (keys.ArrowLeft || keys.a) vx -= 1; if (keys.ArrowRight || keys.d) vx += 1;
    if (keys.ArrowUp || keys.w) vy -= 1; if (keys.ArrowDown || keys.s) vy += 1;
    if (joy && joy.active) { vx = joy.vx; vy = joy.vy; target = null; }
    if (!vx && !vy && target) {
      var dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy);
      if (d < 26) target = null; else { vx = dx / d; vy = dy / d; }
    }
    var len = Math.hypot(vx, vy);
    me.moving = len > 0.05;
    if (me.moving) {
      if (len > 1) { vx /= len; vy /= len; }
      var nx = Math.max(12, Math.min(W - 12, me.x + vx * SPEED * dt)), ny = Math.max(12, Math.min(H - 12, me.y + vy * SPEED * dt));
      var moved = Math.hypot(nx - me.x, ny - me.y);
      me.x = nx; me.y = ny; me.dir = Math.atan2(vy, vx); me.bob += dt * 10;
      walkAcc += moved * MIN_PER_PX;
      if (walkAcc >= 1 && !roll) { var m = Math.floor(walkAcc); walkAcc -= m; hooks.walk(m); }
    }
    // 반짝이 줍기
    pickups = pickups.filter(function (p) {
      p.t += dt;
      if (Math.hypot(p.x - me.x, p.y - me.y) > 24) return true;
      var r = hooks.pickup(p.table, p.courier);
      if (r) { (r.loot || []).forEach(function (l) { floats.push({ x: p.x, y: p.y - 20, text: JY.ITEMS[l.id].icon + ' ' + JY.ITEMS[l.id].name, t: 1.6, rar: l.rarity }); }); }
      return !r;
    });
    // 동료: 구역 안에서 어슬렁
    npcs.forEach(function (n) {
      n.wait -= dt;
      if (n.wait <= 0) { var p = pointIn(n.zone, 26); n.tx = p[0]; n.ty = p[1]; n.wait = rnd(2.5, 6); }
      var dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d > 2 && Math.hypot(me.x - n.x, me.y - n.y) > 40) { n.x += dx / d * 28 * dt; n.y += dy / d * 28 * dt; }
    });
    // 행보관 순찰
    if (haeng) {
      if (haeng.pause > 0) haeng.pause -= dt;
      else {
        var t = PATROL[haeng.i], dx2 = t[0] - haeng.x, dy2 = t[1] - haeng.y, d2 = Math.hypot(dx2, dy2);
        if (d2 < 3) { haeng.i = (haeng.i + 1) % PATROL.length; haeng.pause = rnd(0.6, 2.2); haeng.look = haeng.dir + rnd(-1.2, 1.2); }
        else { var hs = 58 * (heatOn(s, 'haeng') ? 1.4 : 1); haeng.x += dx2 / d2 * hs * dt; haeng.y += dy2 / d2 * hs * dt; haeng.dir = Math.atan2(dy2, dx2); }
      }
      var face = haeng.pause > 0 && haeng.look !== undefined ? haeng.look : haeng.dir;
      var ddx = me.x - haeng.x, ddy = me.y - haeng.y, dist = Math.hypot(ddx, ddy);
      var ang = Math.abs(((Math.atan2(ddy, ddx) - face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      var za = zoneAt(me.x, me.y), zb = zoneAt(haeng.x, haeng.y);
      seen = dist < viewR(s) && ang < VIEW_HALF && za === zb;
      haeng.face = face;
    }
    // 22:00 점호
    var left = hooks.minutesLeft();
    if (left <= 0 && !roll) { roll = { t: 8, done: false }; hooks.toast('🚨 22:00 점호! 생활관으로 뛰어라!'); if (JY.Sound && JY.Sound.siren) JY.Sound.siren(); }
    if (roll && !roll.done) {
      roll.t -= dt;
      if (inBarracks() || roll.t <= 0) { roll.done = true; hooks.rollcall(inBarracks()); }
    }
    // 가까운 물건, 가까운 사람 (둘 다 있으면 패널에 둘 다)
    var bp = null, dp = NEAR, bn = null, dn = NEAR + 6;
    pois.forEach(function (p) { var z = zoneAt(p.x, p.y); if (z && z !== zoneAt(me.x, me.y)) return; var d = Math.hypot(p.x - me.x, p.y - me.y); if (d < dp) { dp = d; bp = p; } });
    npcs.concat(haeng ? [haeng] : []).forEach(function (n) { var d = Math.hypot(n.x - me.x, n.y - me.y); if (d < dn) { dn = d; bn = n; } });
    nearObj = bp || bn ? { p: bp, n: bn } : null;
    renderPanel();
  }

  /* ── 그리기 ── */
  function draw() {
    var s = hooks.state();
    var cw = cv.width / dpr, ch = cv.height / dpr;
    cam.x = Math.max(0, Math.min(W - cw / k, me.x - cw / k / 2));
    cam.y = Math.max(0, Math.min(H - ch / k, me.y - ch / k / 2));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#8fae5b'; g.fillRect(0, 0, cw, ch);
    g.setTransform(dpr * k, 0, 0, dpr * k, -cam.x * dpr * k, -cam.y * dpr * k);
    // 길
    g.fillStyle = '#d9c9a0';
    [[0, 560, W, 70], [0, 900, W, 40], [420, 250, 50, H - 250], [200, 250, 40, 60]].forEach(function (r) { g.fillRect(r[0], r[1], r[2], r[3]); });
    var season = s && s.season;
    // 바깥 구역
    ZONES.forEach(function (z) {
      if (!z.out) return;
      g.fillStyle = season === 'winter' ? '#e8eef0' : z.ground; g.fillRect(z.x, z.y, z.w, z.h);
      g.strokeStyle = 'rgba(42,38,32,.35)'; g.lineWidth = 2; g.strokeRect(z.x, z.y, z.w, z.h);
    });
    // 연병장 선, 족구 코트, 사격장 표적
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.strokeRect(110, 680, 400, 160);
    g.beginPath(); g.moveTo(310, 680); g.lineTo(310, 840); g.stroke();
    g.strokeRect(700, 760, 130, 90); g.beginPath(); g.moveTo(765, 760); g.lineTo(765, 850); g.stroke();
    // 나무
    TREES.forEach(function (t) {
      g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(t[0] + 3, t[1] + t[2] * 0.7, t[2] * 0.8, t[2] * 0.35, 0, 0, 7); g.fill();
      g.fillStyle = season === 'autumn' ? '#c9822f' : season === 'winter' ? '#5b7a5e' : '#3f6d34'; g.beginPath(); g.arc(t[0], t[1], t[2], 0, 7); g.fill();
      if (season === 'winter') { g.fillStyle = '#f4f8f9'; g.beginPath(); g.arc(t[0] - t[2] * 0.15, t[1] - t[2] * 0.2, t[2] * 0.62, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(t[0] - t[2] * 0.3, t[1] - t[2] * 0.3, t[2] * 0.45, 0, 7); g.fill();
    });
    // 건물
    var zin = zoneAt(me.x, me.y), locShown = {};
    hooks.locations().forEach(function (L) { locShown[L.id] = 1; });
    ZONES.forEach(function (z) {
      if (z.out) return;
      if (z.need && !locShown[z.need]) return;
      g.fillStyle = z.floor; g.fillRect(z.x, z.y, z.w, z.h);
      g.strokeStyle = '#2a2620'; g.lineWidth = 5; g.strokeRect(z.x, z.y, z.w, z.h);
      // 문
      g.fillStyle = '#d9c9a0'; g.fillRect(z.x + z.w / 2 - 22, z.y + z.h - 4, 44, 8);
      if (zin !== z) { g.globalAlpha = 0.92; g.fillStyle = z.roof; g.fillRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6); g.globalAlpha = 1;
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; for (var yy = z.y + 14; yy < z.y + z.h; yy += 16) { g.beginPath(); g.moveTo(z.x + 6, yy); g.lineTo(z.x + z.w - 6, yy); g.stroke(); } }
    });
    // 물건
    pois.forEach(function (p) {
      var z = zoneAt(p.x, p.y);
      if (z && z !== zin) return; // 지붕 아래는 안 보인다
      var off = !p.act.ok;
      g.globalAlpha = off ? 0.45 : 1;
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(p.x, p.y, 17, 0, 7); g.fill();
      if (p.act.spec) { g.strokeStyle = '#a65f00'; g.lineWidth = 3; g.stroke(); }
      g.font = '22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(p.icon, p.x, p.y + 1);
      g.globalAlpha = 1;
    });
    // 건물 간판 (지붕 위)
    ZONES.forEach(function (z) {
      if (z.need && !locShown[z.need]) return;
      label(z.name, z.x + z.w / 2, z.out ? z.y + 14 : (zin === z ? z.y - 12 : z.y + z.h / 2), z.out ? 'rgba(42,38,32,.75)' : '#2a2620', 15);
    });
    // 반짝이
    pickups.forEach(function (p) {
      var a = 0.6 + 0.4 * Math.sin(p.t * 5);
      g.globalAlpha = a; g.font = (p.courier ? 24 : 18) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(p.courier ? '📦' : '✨', p.x, p.y + Math.sin(p.t * 3) * 3); g.globalAlpha = 1;
    });
    // 행보관 시야
    if (haeng && !heatOn(s, 'blind')) { // 악조건 '눈치 제로': 시야가 안 보인다
      var hz = zoneAt(haeng.x, haeng.y);
      if (!hz || hz === zin) {
        g.fillStyle = seen ? 'rgba(220,40,30,.28)' : 'rgba(220,40,30,.14)';
        g.beginPath(); g.moveTo(haeng.x, haeng.y); g.arc(haeng.x, haeng.y, viewR(s), haeng.face - VIEW_HALF, haeng.face + VIEW_HALF); g.closePath(); g.fill();
      }
    }
    // 사람들 (y 순서로)
    var people = npcs.map(function (n) { return n; });
    if (haeng) people.push(haeng);
    people.push({ who: 'me', x: me.x, y: me.y, me: true });
    people.sort(function (a, b) { return a.y - b.y; });
    var quest = s && s.quest && !s.quest.done ? s.quest.who : null;
    people.forEach(function (p) {
      var z = zoneAt(p.x, p.y);
      if (z && z !== zin && !p.me) return;
      var bob = p.me && me.moving ? Math.abs(Math.sin(me.bob)) * 3 : 0;
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(p.x, p.y + 2, 15, 6, 0, 0, 7); g.fill();
      var img = sprite(p.who);
      if (img.complete && img.naturalWidth) g.drawImage(img, p.x - 24, p.y - 56 - bob, 48, 56);
      if (!p.me) label(JY.UI.charName(p.who).name, p.x, p.y + 12, p.who === 'haeng' ? '#8e211a' : '#2a2620', 12);
      if (quest === p.who) { g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('❗', p.x, p.y - 64); }
    });
    if (seen) { g.font = '18px sans-serif'; g.textAlign = 'center'; g.fillText('👀', me.x, me.y - 66); }
    // 떠오르는 득템 글자
    floats.forEach(function (f) { label(f.text, f.x, f.y - (1.6 - f.t) * 26, f.rar === 'l' ? '#a65f00' : f.rar === 'e' ? '#7a3cc8' : '#2a2620', 13); });
    // 조이스틱 (화면 좌표)
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (joy && joy.active) {
      g.fillStyle = 'rgba(42,38,32,.18)'; g.beginPath(); g.arc(joy.ox, joy.oy, 44, 0, 7); g.fill();
      g.fillStyle = 'rgba(42,38,32,.45)'; g.beginPath(); g.arc(joy.ox + joy.vx * 34, joy.oy + joy.vy * 34, 20, 0, 7); g.fill();
    }
    // 위쪽 안내 (점호·메시지)
    var top = roll && !roll.done ? '🚨 점호! 생활관으로 ' + Math.ceil(roll.t) + '초' : msgT > 0 ? msg : '';
    if (top) {
      g.font = '15px sans-serif'; var tw = g.measureText(top).width + 24;
      g.fillStyle = roll && !roll.done ? '#a8231b' : 'rgba(42,38,32,.88)';
      roundRect(cw / 2 - tw / 2, 8, tw, 30, 15); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(top, cw / 2, 23);
    }
  }
  function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function label(t, x, y, color, size) {
    g.font = (size || 13) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var w = g.measureText(t).width + 10;
    g.fillStyle = 'rgba(255,255,255,.88)'; roundRect(x - w / 2, y - size * 0.75, w, size * 1.5, 6); g.fill();
    g.fillStyle = color || '#2a2620'; g.fillText(t, x, y + 0.5);
  }

  /* ── 아래 상호작용 패널 (DOM: 글씨를 또렷하게, 접근성) ── */
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function renderPanel() {
    var s = hooks.state(); if (!s) return;
    var key = '', html = '';
    var where = areaAt(me.x, me.y);
    var p = nearObj && nearObj.p, n = nearObj && nearObj.n;
    if (p) {
      var A = p.act;
      key += 'poi:' + p.loc.id + '.' + A.id + ':' + A.ok + ':' + seen + ':' + s.ap + ':' + (A.reason || '') + '|';
      var warn = !A.ok ? '<small class="why">' + esc(A.reason || '') + '</small>' : seen && A.risk > 0 ? '<small class="warn">👀 행보관이 보고 있다! 지금 하면 걸린다</small>' : A.danger ? '<small class="warn">⚠ 스탯이 끝에 닿는다</small>' : '';
      html += '<div class="wp-title">' + p.icon + ' <b>' + esc(A.name) + '</b> <span>' + esc(p.loc.name) + '</span></div>' +
        '<button class="act wp-act' + (A.ok ? '' : ' off') + (A.spec ? ' spec' : '') + '" data-w="act"><span class="act-main"><span class="act-fx">' + hooks.actLine(A) + '</span>' + warn + '</span><em class="cost">' + (A.cost ? '⏱' + A.cost + '시간' : '무료') + '</em></button>';
    }
    if (n) {
      var nm = JY.UI.charName(n.who).name, q = s.quest && !s.quest.done && s.quest.who === n.who ? s.quest : null;
      var told = s.storyTurn && s.storyTurn[n.who] === s.turn;
      key += 'npc:' + n.who + ':' + !!q + ':' + told + ':' + (q && s.items[q.item]);
      html += (p ? '' : '<div class="wp-title">' + (q ? '❗ ' : '💬 ') + '<b>' + esc(nm) + '</b>' + (q ? '<span>부탁: ' + esc(q.ask) + '</span>' : n.who === 'haeng' ? '<span>순찰 중. 눈에 띄면 작업 당첨.</span>' : '') + '</div>') +
        '<div class="wp-row">' + (p ? '<span class="wp-who">' + (q ? '❗' : '💬') + ' ' + esc(nm) + '</span>' : '') +
        (q ? '<button class="btn btn-small ' + (s.items[q.item] > 0 ? 'btn-primary' : 'btn-ghost') + '" data-w="quest"' + (s.items[q.item] > 0 ? '' : ' disabled') + '>' + JY.ITEMS[q.item].icon + ' ' + esc(JY.ITEMS[q.item].name) + ' 건네기</button>' : '') +
        '<button class="btn btn-small btn-ghost" data-w="talk">💬 수다</button>' +
        (n.who !== 'cat' ? '<button class="btn btn-small btn-ghost" data-w="story"' + (told ? ' disabled' : '') + '>📖 ' + (told ? '이번 주엔 들었다' : '이야기') + '</button>' : '') + '</div>';
    }
    if (!p && !n) {
      key = 'idle:' + (where ? where.id : '') + ':' + inBarracks();
      html = '<div class="wp-title">📍 <b>' + esc(where ? where.name : '부대 안 길') + '</b> <span>화면을 누른 채 끌어서 걷기 · 물건·사람을 톡 하면 그쪽으로</span></div>' +
        (inBarracks() ? '<div class="wp-row"><button class="btn btn-small btn-primary" data-w="sleep">🌙 일찍 취침 (남은 시간은 체력 회복)</button></div>' : '');
    }
    if (key === panelKey) return;
    panelKey = key;
    panel.innerHTML = html;
    var b;
    if ((b = panel.querySelector('[data-w="act"]'))) b.onclick = function () { var p2 = nearObj && nearObj.p; if (p2) hooks.act(p2.loc, p2.act, seen); };
    if ((b = panel.querySelector('[data-w="talk"]'))) b.onclick = function () { if (nearObj && nearObj.n) hooks.talk(nearObj.n.who); };
    if ((b = panel.querySelector('[data-w="story"]'))) b.onclick = function () { if (nearObj && nearObj.n) hooks.story(nearObj.n.who); };
    if ((b = panel.querySelector('[data-w="quest"]'))) b.onclick = function () { hooks.quest(); panelKey = ''; };
    if ((b = panel.querySelector('[data-w="sleep"]'))) b.onclick = function () { hooks.rollcall(true); };
  }

  /* ── 입력 ── */
  function toWorld(cx, cy) { var r = cv.getBoundingClientRect(); return { x: (cx - r.left) / k + cam.x, y: (cy - r.top) / k + cam.y, sx: cx - r.left, sy: cy - r.top }; }
  function hitObj(w) {
    var best = null, bd = 30;
    pois.forEach(function (p) { var z = zoneAt(p.x, p.y), zin = zoneAt(me.x, me.y); if (z && z !== zin && z) { /* 지붕 아래는 문까지 */ } var d = Math.hypot(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = p; } });
    npcs.concat(haeng ? [haeng] : []).forEach(function (n) { var d = Math.hypot(n.x - w.x, n.y - 25 - w.y); if (d < bd + 8) { bd = d; best = n; } });
    return best;
  }
  function onDown(e) {
    if (hooks.blocked()) return;
    e.preventDefault();
    var w = toWorld(e.clientX, e.clientY), hit = hitObj(w);
    if (hit) { target = { x: hit.x, y: hit.y + 4 }; joy = null; return; }
    target = null;
    joy = { id: e.pointerId, ox: w.sx, oy: w.sy, vx: 0, vy: 0, active: true, moved: false, start: { x: w.x, y: w.y } };
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
  }
  function onMove(e) {
    if (!joy || joy.id !== e.pointerId) return;
    var w = toWorld(e.clientX, e.clientY), dx = w.sx - joy.ox, dy = w.sy - joy.oy, d = Math.hypot(dx, dy);
    if (d > 6) joy.moved = true;
    var m = Math.min(1, d / 40);
    joy.vx = d ? dx / d * m : 0; joy.vy = d ? dy / d * m : 0;
  }
  function onUp(e) {
    if (!joy || joy.id !== e.pointerId) return;
    if (!joy.moved) target = { x: joy.start.x, y: joy.start.y }; // 톡: 그 자리로 걸어간다
    joy = null;
  }
  function onKey(e, down) {
    var t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return;
    var kk = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].indexOf(kk) < 0) {
      if (down && (kk === 'e' || kk === 'Enter') && !hooks.blocked()) { var b = panel.querySelector('button:not([disabled])'); if (b) { b.click(); e.preventDefault(); } }
      return;
    }
    if (hooks.blocked() && down) return;
    keys[kk] = down; e.preventDefault();
  }

  var lastW = 0, lastH = 0;
  function size() {
    var wrap = cv.parentElement; // 테두리 안쪽 크기 (캔버스는 절대 위치라 레이아웃에 영향 없음)
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(120, wrap.clientWidth), h = Math.max(120, wrap.clientHeight);
    lastW = wrap.clientWidth; lastH = wrap.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    k = Math.max(0.6, Math.min(1.4, w / 430));
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!host || host.hidden || !cv.isConnected) return;
    var wrap = cv.parentElement;
    if (wrap.clientWidth !== lastW || wrap.clientHeight !== lastH) size();
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    update(dt);
    draw();
  }

  JY.World = {
    mount: function (el, h) {
      if (host === el && cv && cv.isConnected) { hooks = h; JY.World.refresh(); return; }
      JY.World.unmount();
      host = el; hooks = h;
      el.innerHTML = '<div class="world-wrap"><canvas class="world" aria-label="자대 지도: 끌어서 걷기"></canvas></div><div class="world-panel" aria-live="polite"></div>';
      cv = el.querySelector('canvas'); g = cv.getContext('2d'); panel = el.querySelector('.world-panel');
      on(cv, 'pointerdown', onDown); on(cv, 'pointermove', onMove); on(cv, 'pointerup', onUp); on(cv, 'pointercancel', onUp);
      on(window, 'keydown', function (e) { onKey(e, true); }); on(window, 'keyup', function (e) { onKey(e, false); });
      on(window, 'resize', size);
      size(); turnSeen = -1; panelKey = '';
      last = 0; raf = requestAnimationFrame(loop);
    },
    refresh: function () { if (!cv) return; panelKey = ''; buildPois(); size(); },
    unmount: function () {
      cancelAnimationFrame(raf); raf = 0;
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = [];
      if (host) host.innerHTML = '';
      host = null; cv = null; g = null; panel = null; keys = {}; joy = null;
    },
    // 점검·테스트용
    _me: me, _teleport: function (x, y) { me.x = x; me.y = y; target = null; },
    _poi: function (key) { var p = POIS[key]; return p ? { x: p[0], y: p[1] } : null; },
    _seen: function () { return seen; }, _haeng: function () { return haeng; }, _npcs: function () { return npcs; }, _pickups: function () { return pickups; },
    _inBarracks: inBarracks, ZONES: ZONES
  };
})(window.JY = window.JY || {});
