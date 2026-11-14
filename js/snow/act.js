/* 제설각 — 상호작용 (DOM 없음, Node에서도 돈다)
 * v10: 실제 제설 작전에서 있을 법한 것만 남겼다.
 *   행보관: 경례 · 장비 요청(보급) · 작업 완료 보고      간부: 경례(칼경례) · 보고 · 소대장과 같이 하기
 *   분대원: 깨우기 · 일으켜 세우기 · 부축 · 짐 맡기기 · 초코파이 · 재촉 · 따라와/여기 배치 · 신병 인솔
 *   제설함: 염화칼슘 포대 → 빙판에 뿌리기      정비고: 기름통 → 제설차      출근 차량이 빠지면: 다 같이 밀기
 *   고라니 쫓기 · 짬타이거 · 드럼통 난로 · 구령대(조장부터)
 * (예전의 차 탈취·행보관 추격·엎드려 뻗쳐·전차 만지기·눈싸움·자판기 뽑기는 뺐다)
 * sim.step()이 매 틱 A.step()을 부른다. */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim;

  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function bld(id) { for (var i = 0; i < S.BUILDINGS.length; i++) if (S.BUILDINGS[i].id === id) return S.BUILDINGS[i]; return null; }
  function door(id) { var b = bld(id); return { x: b.x + b.w / 2, y: b.y + b.h + 4 }; }

  var TRACTOR = { x: 252, y: 1062 };     // 정비고 앞에 세워 둔 트랙터 (장식)
  var FLAG = { x: 520, y: 298 };
  var DECOR_MAN = { x: 470, y: 120 };
  var SNOWMAN_COST = 25;
  var RIDE = {};                          // 직접 모는 차는 없다 (운전은 운전병이)

  var BUFF = {
    praise: { name: '칭찬', desc: '초코파이 +20%' },
    matsta: { name: '맛스타', desc: '이동 +25%' },
    hotbar: { name: '냉동 핫바', desc: '손 +30%' },
    hotpack: { name: '핫팩', desc: '덜 넘어진다' },
    choco: { name: '초코파이', desc: '분대원 +40%' },
    rally: { name: '구령', desc: '분대원 +25%' },
    support: { name: '대대 지원', desc: '분대원 ×2' },
    power: { name: '체력단련', desc: '적재 +25%' },
    warm: { name: '난로 온기', desc: '손 +20% · 이동 +10%' }
  };

  // 간부: 하루에 한 번씩 순찰 온다. 다가오면 3.5초 안에 경례! (1.2초 안이면 칼경례). 안 하면 '지적' (등급 감점)
  var OFF = {
    lt: { name: '소대장', title: '소대장님', face: 'lt', speed: 44, stay: 24 },
    cpt: { name: '중대장', title: '중대장님', face: 'captain', speed: 38, stay: 20 },
    gen: { name: '사단장', title: '사단장님', face: 'general', speed: 32, stay: 30 }
  };

  // 손에 드는 물건 (한 번에 하나)
  var ITEM = {
    salt: { name: '염화칼슘 포대', from: '제설함', want: '염화칼슘' },
    fuel: { name: '기름통', from: '정비고', want: '기름' }
  };
  var REQ = { fuel: { ask: ['기름 떨어졌습니다! 정비고에서 기름통 좀!'], thanks: ['부릉부릉! 다시 갑니다!'] } };

  var L = {
    salute: ['오냐, 수고한다.', '음. 경례 각이 좋군.', '그래, 그렇게만 해라.'],
    saluteAgain: ['됐고, 눈이나 치워.', '경례는 아까 했잖아.', '손 내리고 넉가래 들어.'],
    nag: ['속도 좀 내자!', '저기 아직 남았다!', '빨리 끝내고 밥 먹자!', '넉가래 각 세워서!'],
    choco: ['초코파이 감사합니다!! (눈물)', '이 은혜 잊지 않겠습니다!', '힘이 납니다!'],
    unslack: ['…네, 일어납니다.', '아 들켰다', '5분만 쉬려고 했는데…'],
    offNear: { lt: ['어, 수고가 많네!', '나도 소대장이다!'], cpt: ['다들 고생 많다!', '어디 보자…'], gen: ['…….', '이 부대는 어떤가 보자.'] },
    offMiss: { lt: ['어… 경례는…?', '(서운한 표정)'], cpt: ['경례 안 하나?! 지적이다.', '군기가 빠졌구만!'], gen: ['이 부대 군기가 왜 이래!!', '행보관 어디 있나!'] },
    offKal: ['오, 칼경례! 좋아!', '그래, 바로 그거다!'],
    nagReply: ['넵!! 알겠습니다!', '…넵.', '아 네네네', '(속으로 욕하는 중)'],
    nagAgain: ['아 지금 하고 있잖아요!', '방금 말씀하셨잖아요…'],
    wake: ['아 알았어 알았어…', '5분만…', '나 전역 며칠 남았는지 알아?'],
    help: ['고맙다… 넌 좋은 후임이야', '살았다…'],
    hand: ['이걸 저보고…?', '넵… 갖다 붓겠습니다', '아 진짜…'],
    tool: ['옛다. 아껴 써라. 부러뜨리면 네 돈이다.', '창고에서 꺼내 왔다. 이제 핑계 없다.', '좋은 장비는 짬 순서다. 받았으면 해내라.'],
    noTool: ['초코파이도 없이 장비를 달라고?', '아직 그 장비는 이르다. 짬 좀 더 먹고 와.']
  };

  /* ── 상태 ── */
  function init(w) {
    if (w.act) return w.act;
    var save = w.save;
    save.snowmen = save.snowmen || []; save.daily = save.daily || {}; save.stats = save.stats || {}; save.prep = save.prep || {};
    var a = w.act = { buffs: {}, heat: 0, shoutT: 0, balls: [], ride: null, mission: null, cool: {}, ball: ballHome(w), n: { shoo: 0, pet: 0, wake: 0 },
      hand: null, reqs: [], fuelT: 80, pickCd: 0, off: [], offPlan: [], offDay: -1, nagT: 40 };
    if (!w.demo) applyPrep(w);
    return a;
  }
  function ballHome(w) {
    var B = w.save.zones.B ? G.zoneById('B') : null;
    return B ? { x: B.x + B.w * 0.3, y: B.y + B.h / 2, vx: 0, vy: 0, h: 0 } : { x: 420, y: 205, vx: 0, vy: 0, h: 0 };
  }
  function stat(w, k, n) { var st = w.save.stats; st[k] = (st[k] || 0) + (n || 1); if (w.act && w.act.n[k] !== undefined) w.act.n[k] += n || 1; }
  function fx(w, o) { w.fx.push(o); return o; }
  function me(w, text) { fx(w, { t: 'me', text: text }); }
  function bubble(w, e, text) { fx(w, { t: 'bubble', e: e, text: text }); }
  function say(w, text) { fx(w, { t: 'say', key: text }); }
  function give(w, n, src) { n = Math.round(n); if (n <= 0) return 0; w.earned += n; G.pay(w, n, src || 'act'); return n; }
  function buff(w, id, sec) { w.act.buffs[id] = Math.max(w.act.buffs[id] || 0, sec); fx(w, { t: 'buff', id: id, name: BUFF[id].name, desc: BUFF[id].desc, sec: sec }); }
  function rank(w) { return G.rankOf(w.save); }
  function jigeok(w, why) { if (!w.op) return; w.op.jigeok++; G.syncOpSave(w); fx(w, { t: 'jigeok', n: w.op.jigeok, why: why }); }

  // 저녁에 PX에서 사 둔 것: 작전 시작하자마자 효과 (한 번 쓰면 없어진다)
  function applyPrep(w) {
    var save = w.save, pr = save.prep || {}, used = [];
    if (w.time > 5 || !Object.keys(pr).length) return used;
    S.PREP.forEach(function (it) { if (pr[it.id] && it.sec && BUFF[it.id]) { buff(w, it.id, it.sec); used.push(it.name); } });
    if (pr.choco) w.crew.forEach(function (c) { c.mor = Math.min(100, c.mor + 50); });
    if (pr.ramen || pr.morale) { w.crew.forEach(function (c) { c.mor = 100; c.slack = false; }); used.push(pr.ramen ? '컵라면' : '전원 초코파이'); }
    if (pr.support) { buff(w, 'support', 60); used.push('대대 지원'); }
    if (pr.power) { buff(w, 'power', 40 + pr.power * 4); used.push('체력단련'); }
    save.prep = {};
    if (used.length) fx(w, { t: 'prep', used: used });
    return used;
  }

  function nextTool(save) { var T = S.TOOLS[save.tool + 1]; return T || null; }
  function icyPartHere(w) {
    var P = w.player, i = G.cellIndex(P.x, P.y), k = i >= 0 ? w.partOf[i] : -1, Pt = k >= 0 ? w.parts[k] : null;
    return Pt && Pt.icy && !Pt.salted ? { k: k, part: Pt } : null;
  }

  /* ── 주변에서 할 수 있는 것 (v11: 버튼은 사람에게만. 나머지는 다가가면 저절로 — auto()) ── */
  function candidates(w) {
    var a = init(w), P = w.player, out = [], op = w.op || {};
    function add(k, ref, x, y, r, name, verb, extra) { var o = { k: k, ref: ref, x: x, y: y, r: r, name: name, verb: verb }; if (extra) Object.keys(extra).forEach(function (q) { o[q] = extra[q]; }); out.push(o); }
    (a.off || []).forEach(function (o) {
      var verb = !o.saluted ? '경례' : !o.done.report && o.id !== 'lt' ? '보고하기' : o.id === 'lt' && !o.done.help ? '같이 하시죠' : '경례';
      add('officer', o, o.x, o.y, o.saluted ? 40 : 60, OFF[o.id].title, verb, { urgent: !o.saluted && !o.missed });
    });
    var H = w.haeng, hand = a.hand;
    add('haeng', H, H.x, H.y, op.ready ? 60 : 36, '행보관', op.ready ? '작업 완료 보고' : '경례', { urgent: !!op.ready });
    w.crew.forEach(function (e) {
      if (e.off || e.state === 'follow') return;
      var C = e.def, nm = C.vehicle ? '제설차' : C.name, ask = '담당 ' + (G.zoneById(e.post) || { name: '?' }).name;
      if (C.vehicle) { add('plow', e, e.x, e.y, 40, nm, hand === 'fuel' ? '기름 넣기' : e.noFuel ? '기름 없음' : '따라와', { ask: e.noFuel ? '정비고에 가면 기름통' : ask }); return; }
      if (e.asleep || e.slack) return;   // 지나가면 저절로 깨운다
      var choco = e.mor < 50 && !(e.injured > 0.8 || (P.load >= 10 && e.cap - e.load >= 5));
      var verb = e.injured > 0.8 ? '부축하기' : P.load >= 10 && e.cap - e.load >= 5 ? '짐 맡기기' : choco ? '초코파이 주기' : '재촉하기';
      add('crew', e, e.x, e.y, 36, nm, verb, { verb2: '따라와', ask: choco ? '초코파이 ' + chocoCost(w) + '개' : ask });
    });
    w.cats.forEach(function (c) { add('cat', c, c.x, c.y, 30, '짬타이거', '쓰다듬기'); });
    return out;
  }

  /* ── v11: 다가가면 저절로 (아케이드 아이들식) ── */
  // 바닥 원: 보급(다음 장비, 서 있으면 초코파이가 빨려 들어가며 지급), 작업 완료 보고
  function pads(w) {
    var save = w.save, nt = nextTool(save), op = w.op || {}, out = [], PD = S.PADS;
    if (nt) {
      var rk = rank(w) >= (nt.rank || 0);
      out.push({ id: 'supply', kind: 'supply', x: PD.supply.x, y: PD.supply.y, r: PD.supply.r, dwell: PD.supply.dwell, title: '장비 보급', name: nt.name, cost: nt.cost,
        lock: rk ? '' : S.RANKS[nt.rank || 0].name + '부터', ok: rk && save.bank >= nt.cost });
    }
    out.push({ id: 'report', kind: 'report', x: PD.report.x, y: PD.report.y, r: PD.report.r, dwell: PD.report.dwell, title: '작업 완료 보고', name: op.ready ? '행보관에게 보고' : '지시서를 끝내면', cost: 0, lock: op.ready ? '' : '아직', ok: !!op.ready && !w.opEnd });
    return out;
  }
  function auto(w, dt) {
    var a = w.act, P = w.player, save = w.save;
    a.padT = a.padT || {};
    // 바닥 원
    pads(w).forEach(function (pd) {
      var on = Math.hypot(P.x - pd.x, P.y - pd.y) < pd.r;
      if (!on || !pd.ok) { a.padT[pd.id] = 0; return; }
      a.padT[pd.id] = (a.padT[pd.id] || 0) + dt;
      if (a.padT[pd.id] < pd.dwell) return;
      a.padT[pd.id] = -1.5;   // 끝나면 잠깐 쉰다
      if (pd.kind === 'supply') {
        var nt = nextTool(save), r = G.buy(save, 'tool', nt.id);
        if (r.ok) { me(w, '행보관님! ' + nt.name + ' 하나 주십시오!'); bubble(w, w.haeng, pick(L.tool)); applyStats(w); fx(w, { t: 'toolGet', name: nt.name, cost: r.cost, x: pd.x, y: pd.y }); }
      } else if (pd.kind === 'report') {
        me(w, '충성! 제설 작업 완료했습니다!'); bubble(w, w.haeng, '수고했다. 들어가서 밥 먹어라.');
        G.endOp(w, 'report');
      }
    });
    if (w.opEnd) return;
    // 제설함: 빙판이 있고 빈손이면 지나가며 포대를 든다
    var icyAny = w.parts.some(function (q) { return q.icy && !q.salted; });
    if (!a.hand && icyAny) S.PROPS.forEach(function (pr) { if (pr.id === 'saltbox' && Math.hypot(P.x - pr.ux, P.y - pr.uy) < 22) { hold(w, 'salt'); me(w, '염화칼슘 한 포대. 무겁다…'); } });
    // 빙판: 포대를 들고 언 구간에 들어가면 0.4초 뒤 뿌린다
    var ic = a.hand === 'salt' ? icyPartHere(w) : null;
    if (ic) { a.spreadT = (a.spreadT || 0) + dt; if (a.spreadT > 0.4) { a.spreadT = 0; act(w, { k: 'spread', ref: ic }, P.dir); } } else a.spreadT = 0;
    // 정비고: 기름 떨어진 제설차가 있으면 지나가며 기름통, 들고 제설차 옆에 가면 넣는다
    if (!a.hand && w.crew.some(function (e) { return e.noFuel; })) { var dG = door('garage'); if (Math.hypot(P.x - dG.x, P.y - dG.y) < 30) act(w, { k: 'garage' }, P.dir); }
    if (a.hand === 'fuel') w.crew.forEach(function (e) { if (e.def.vehicle && e.noFuel && Math.hypot(P.x - e.x, P.y - e.y) < 40) act(w, { k: 'plow', ref: e }, P.dir); });
    // 빠진 출근 차량: 옆에 붙어 있으면 민다
    var car = w.car;
    if (car && car.stuck && Math.hypot(P.x - car.x, P.y - car.y) < 42) {
      car.push += 0.45 * dt; car.mine = true; a.pushT = (a.pushT || 0) - dt;
      if (a.pushT <= 0) { a.pushT = 0.45; me(w, pick(['영차!', '하나 둘 셋, 영차!', '밀어!!'])); fx(w, { t: 'push', x: car.x, y: car.y, push: car.push }); }
    }
    // 고라니: 가까이 가면 도망간다
    w.deer.forEach(function (d) { if (!d.leaving && Math.hypot(d.x - P.x, d.y - P.y) < 34) { shoo(w, d, true); me(w, '훠이! 훠이!'); } });
    // 자거나 짱박힌 분대원: 지나가면 깨운다
    w.crew.forEach(function (e) {
      if (e.off || !(e.asleep || e.slack) || Math.hypot(e.x - P.x, e.y - P.y) > 28) return;
      act(w, { k: 'crew', ref: e }, P.dir);
    });
    // 신병: 다가가면 따라온다
    (w.recruits || []).forEach(function (r) {
      if (r.state === 'wait' && Math.hypot(r.x - P.x, r.y - P.y) < 40) act(w, { k: 'recruit', ref: r }, P.dir);
    });
    // 따라오는 사람(신병·분대원): 구역 안에서 1초 멈춰 서면 거기 배치
    var fol = (w.recruits || []).filter(function (r) { return r.state === 'follow'; }).concat(w.crew.filter(function (e) { return e.state === 'follow'; }));
    var here = fol.length ? G.zoneAt(w, P.x, P.y) : null;
    if (here && !P.moving) {
      a.assignT = (a.assignT || 0) + dt;
      if (a.assignT > 1) { a.assignT = 0; fol.forEach(function (e) { act(w, { k: w.crew.indexOf(e) >= 0 ? (e.def.vehicle ? 'plow' : 'crew') : 'recruit', ref: e }, P.dir); }); }
    } else a.assignT = 0;
    // 난로: 옆에 서 있으면 몸을 녹인다
    S.PROPS.forEach(function (pr) {
      if (pr.id !== 'stove' || a.cool.stove > 0 || Math.hypot(P.x - pr.ux, P.y - pr.uy) > 22) return;
      a.stoveT = (a.stoveT || 0) + dt; if (a.stoveT > 0.8) { a.stoveT = 0; act(w, { k: 'stove', ref: pr }, P.dir); }
    });
    // 구령대 (상병부터): 앞에 서 있으면 구령
    if (rank(w) >= 2 && w.crew.length && !(a.cool.stand > 0)) {
      var st = bld('stand');
      if (Math.hypot(P.x - (st.x + st.w / 2), P.y - (st.y + st.h + 6)) < 22) { a.standT = (a.standT || 0) + dt; if (a.standT > 0.8) { a.standT = 0; act(w, { k: 'stand' }, P.dir); } } else a.standT = 0;
    }
  }
  // 지금 할 일 하나 (화면 위 큰 글씨 + 땅 위 화살표가 가리키는 곳)
  // v12: 길찾기 — 노란 화살표가 건물·나무·출입 통제 테이프를 피해 돌아가는 길을 가리킨다 (예전엔 일직선이라 구령대·테이프에 막혔다)
  function navGrid(w) {
    if (w.nav) return w.nav;
    var GW = S.GW, GH = S.GH, g = new Uint8Array(GW * GH);
    for (var gy = 0; gy < GH; gy++) for (var gx = 0; gx < GW; gx++) g[gy * GW + gx] = G.blocked(gx * S.CELL + 5, gy * S.CELL + 5, 6) ? 1 : 0;
    w.nav = g; return g;
  }
  function cellOf(x, y) { var gx = Math.max(0, Math.min(S.GW - 1, Math.floor(x / S.CELL))), gy = Math.max(0, Math.min(S.GH - 1, Math.floor(y / S.CELL))); return gy * S.GW + gx; }
  function clearLine(g, x0, y0, x1, y1) {
    var d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 4);
    for (var i = 1; i < n; i++) { if (g[cellOf(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)]) return false; }
    return true;
  }
  function viaPoint(w, tx, ty) {
    var a = w.act, P = w.player, c = a.nav;
    if (c && Math.abs(c.tx - tx) < 15 && Math.abs(c.ty - ty) < 15 && Math.hypot(c.px - P.x, c.py - P.y) < 12 && w.time - c.t < 0.5) return c.via;
    var g = navGrid(w), via = null;
    if (!clearLine(g, P.x, P.y, tx, ty)) {
      var N = S.GW * S.GH, prev = new Int32Array(N).fill(-1), q = new Int32Array(N), s0 = cellOf(P.x, P.y), goal = cellOf(tx, ty), qh = 0, qt = 0, found = -1;
      prev[s0] = s0; q[qt++] = s0;
      var gx0 = goal % S.GW, gy0 = (goal / S.GW) | 0;
      while (qh < qt) {
        var cur = q[qh++], cx = cur % S.GW, cy = (cur / S.GW) | 0;
        if (Math.abs(cx - gx0) <= 1 && Math.abs(cy - gy0) <= 1) { found = cur; break; }
        var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var k = 0; k < 4; k++) {
          var nx = cx + nb[k][0], ny = cy + nb[k][1]; if (nx < 0 || ny < 0 || nx >= S.GW || ny >= S.GH) continue;
          var ni = ny * S.GW + nx; if (prev[ni] >= 0 || (g[ni] && ni !== goal)) continue;
          prev[ni] = cur; q[qt++] = ni;
        }
      }
      if (found >= 0) {
        var path = [], p = found; while (p !== s0 && path.length < 2000) { path.push(p); p = prev[p]; }
        path.reverse();
        // 지금 자리에서 곧장 보이는 가장 먼 길목
        for (var j = path.length - 1; j >= 0; j--) { var px = (path[j] % S.GW) * S.CELL + 5, py = ((path[j] / S.GW) | 0) * S.CELL + 5; if (clearLine(g, P.x, P.y, px, py)) { via = { x: px, y: py }; break; } }
        if (!via && path.length) via = { x: (path[0] % S.GW) * S.CELL + 5, y: ((path[0] / S.GW) | 0) * S.CELL + 5 };
      }
    }
    a.nav = { tx: tx, ty: ty, px: P.x, py: P.y, t: w.time, via: via };
    return via;
  }
  function objective(w) {
    var o = objective0(w);
    if (o && !o.here && o.kind !== 'salute' && w.player && Math.hypot(o.x - w.player.x, o.y - w.player.y) > 30) o.via = viaPoint(w, o.x, o.y);
    return o;
  }
  function objective0(w) {
    var a = init(w), P = w.player, op = w.op || {}, save = w.save;
    function near(list) { var b = null, bd = 1e9; list.forEach(function (o) { var d = Math.hypot(o.x - P.x, o.y - P.y); if (d < bd) { bd = d; b = o; } }); return b; }
    var urgent = (a.off || []).filter(function (o) { return !o.saluted && !o.missed && o.warned; })[0];
    if (urgent) return { kind: 'salute', x: urgent.x, y: urgent.y, text: OFF[urgent.id].title + '께 경례!', sub: '아래 큰 버튼', tone: 'red' };
    if (w.car && w.car.stuck) return { kind: 'car', x: w.car.x, y: w.car.y + 16, text: '빠진 차 밀기', sub: Math.round(w.car.push * 100) + '% · 차 뒤에 붙어 있으면 민다', pct: w.car.push, tone: 'red' };
    if (P.load >= P.cap * 0.95) { var d = G.nearestDump(w, P.x, P.y); return { kind: 'dump', x: d.x, y: d.y, text: '가득 찼다! 집하장에 붓기', sub: '노란 원으로', tone: 'gold' }; }
    var icy = w.parts.filter(function (q) { return q.icy && !q.salted; });
    if (icy.length && a.hand === 'salt') { var ip = near(icy.map(function (q) { return { x: q.x + q.w / 2, y: q.y + q.h / 2, q: q }; })); return { kind: 'spread', x: ip.x, y: ip.y, text: '빙판에 염화칼슘', sub: ip.q.name + '에 들어가면 뿌린다', tone: 'blue' }; }
    if (icy.length && !a.hand) { var sb = near(S.PROPS.filter(function (p) { return p.id === 'saltbox'; }).map(function (p) { return { x: p.ux, y: p.uy }; })); return { kind: 'salt', x: sb.x, y: sb.y, text: '빙판! 제설함에서 염화칼슘', sub: icy[0].name + ' · 초록 상자로', tone: 'blue' }; }
    if (op.ready) return { kind: 'report', x: S.PADS.report.x, y: S.PADS.report.y, text: '작업 완료 보고', sub: '보고 원 위에 서 있기 · 일찍 할수록 수당', tone: 'green' };
    var waiting = (w.recruits || []).filter(function (r) { return r.state === 'wait'; });
    if (waiting.length) { var rc = near(waiting); return { kind: 'recruit', x: rc.x, y: rc.y, text: '신병 데려오기', sub: '다가가면 따라온다 · 구역에서 멈추면 배치', tone: 'green' }; }
    var fol = (w.recruits || []).some(function (r) { return r.state === 'follow'; }) || w.crew.some(function (e) { return e.state === 'follow'; });
    if (fol) return { kind: 'assign', x: P.x, y: P.y, text: '배치할 구역에서 멈춰 서기', sub: '1초 서 있으면 그 구역 담당', tone: 'green', here: true };
    var nt = nextTool(save);
    if (nt && rank(w) >= (nt.rank || 0) && save.bank >= nt.cost && !op.ready) return { kind: 'supply', x: S.PADS.supply.x, y: S.PADS.supply.y, text: nt.name + ' 받을 수 있다!', sub: '보급 원 위에 서 있기', tone: 'gold', soft: true };
    var t = (op.tasks || []).filter(function (q) { return q.done < 0; })[0];
    if (t) {
      var pct = G.taskPct(w, t), Z = S.ZONES[t.zi], inZone = P.x > Z.x && P.x < Z.x + Z.w && P.y > Z.y && P.y < Z.y + Z.h, tx = Z.x + Z.w / 2, ty = Z.y + Z.h / 2;
      if (inZone) {
        // 구역 안: 제일 가까운 남은 눈 쪽으로
        var cells = w.zoneCells[t.zi] || [], best = -1, bd2 = 1e9;
        for (var k = 0; k < cells.length; k += 3) { var idx = cells[k]; if (!w.depth[idx]) continue; var cx = (idx % S.GW) * S.CELL + 5, cy = ((idx / S.GW) | 0) * S.CELL + 5, dd = Math.hypot(cx - P.x, cy - P.y); if (dd < bd2) { bd2 = dd; best = idx; } }
        if (best >= 0) { tx = (best % S.GW) * S.CELL + 5; ty = ((best / S.GW) | 0) * S.CELL + 5; }
      }
      return { kind: 'task', x: tx, y: ty, text: Z.name + ' 치우기', sub: Math.floor(pct * 100) + '% / ' + Math.round(t.goal * 100) + '% · ' + G.clockText(t.due) + '까지', pct: Math.min(1, pct / t.goal), tone: t.lateSaid ? 'red' : 'navy', inZone: inZone };
    }
    return { kind: 'free', x: P.x, y: P.y, text: '남은 눈 마저 치우기', sub: '다 하면 보고', tone: 'navy', here: true };
  }

  // 지금 할 행동 하나. look = 보는 방향(단위벡터), fp = 1인칭이면 앞에 있는 것만
  function best(w, look, fp) {
    var P = w.player, list = candidates(w), b = null, bs = 1e9;
    look = look || P.dir;
    list.forEach(function (c) {
      var dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx, dy);
      if (d > c.r) return;
      var cos = d > 0.01 ? (dx * look.x + dy * look.y) / d : 1;
      if (fp && cos < 0.25 && d > 9 && !c.urgent && !c.behind) return;
      var s = c.urgent ? -0.5 + d * 0.001 : c.behind ? (c.soft ? 60 : 0.2) + d * 0.001 : d * (1.6 - cos);
      if (s < bs) { bs = s; b = c; }
    });
    return b;
  }
  function canBuild() { return false; }

  /* ── 행동 ── */
  function act(w, t, look, alt) {
    var a = init(w), P = w.player, save = w.save, H = w.haeng, R = w.rand, e;
    if (!t || w.opEnd) return { ok: false };
    if (P.stun > 0.3) return { ok: false, why: 'stun' };
    var v = actMove(w, t, alt);
    if (v) return v;
    switch (t.k) {
      case 'haeng':
        H.hold = 2.2; H.dir.x = P.x - H.x; H.dir.y = P.y - H.y; var hm = Math.hypot(H.dir.x, H.dir.y) || 1; H.dir.x /= hm; H.dir.y /= hm;
        if (alt) {
          // 장비 요청: 다음 장비 (계급이 되고 초코파이가 있으면)
          var nt = nextTool(save);
          if (!nt) return { ok: false };
          if (rank(w) < (nt.rank || 0)) { bubble(w, H, L.noTool[1]); return { ok: false, why: 'rank' }; }
          var r = G.buy(save, 'tool', nt.id);
          if (!r.ok) { bubble(w, H, L.noTool[0]); return { ok: false, why: 'money' }; }
          me(w, '행보관님! ' + nt.name + ' 하나 주십시오!'); bubble(w, H, pick(L.tool)); applyStats(w);
          fx(w, { t: 'toolGet', name: nt.name, cost: r.cost });
          return { ok: true, ui: 'tool', tool: nt };
        }
        if (w.op && w.op.ready) {
          me(w, '충성! 제설 작업 완료했습니다!'); bubble(w, H, '수고했다. 들어가서 밥 먹어라.');
          var res = G.endOp(w, 'report');
          return { ok: true, ui: 'report', res: res };
        }
        me(w, '충성!'); fx(w, { t: 'salute' }); stat(w, 'salute');
        if (a.cool.haeng > 0) { bubble(w, H, pick(L.saluteAgain)); return { ok: true }; }
        a.cool.haeng = 40; bubble(w, H, pick(L.salute)); buff(w, 'praise', 45);
        return { ok: true };
      case 'crew':
        e = t.ref;
        if (e.asleep) { e.asleep = false; e.sleepT = 10; bubble(w, e, pick(L.wake)); me(w, '병장님! 일어나십시오!'); fx(w, { t: 'wake', e: e }); stat(w, 'wake'); return { ok: true }; }
        if (e.slack) { e.slack = false; e.mor = 40; bubble(w, e, pick(L.unslack)); me(w, '야! 거기서 뭐 해!'); fx(w, { t: 'wake', e: e }); stat(w, 'unslack'); return { ok: true }; }
        if (e.injured > 0.8) { e.injured *= 0.35; bubble(w, e, pick(L.help)); me(w, '괜찮아? 일어나 봐.'); return { ok: true }; }
        if (P.load >= 10 && e.cap - e.load >= 5) {
          var n = Math.min(P.load, e.cap - e.load), vv = P.val * n / P.load;
          e.load += n; e.val += vv; P.load -= n; P.val -= vv; e.state = 'haul';
          me(w, '이거 집하장에 붓고 와.'); bubble(w, e, pick(L.hand)); stat(w, 'hand');
          return { ok: true, moved: n };
        }
        if (e.mor < 50) {
          var cc = chocoCost(w);
          if (save.bank < cc) { bubble(w, e, '…초코파이도 없으면서'); return { ok: false, why: 'money' }; }
          save.bank -= cc; e.mor = Math.min(100, e.mor + 45); fx(w, { t: 'choco', e: e }); me(w, '이거 먹고 힘내라.'); bubble(w, e, pick(L.choco)); stat(w, 'choco');
          return { ok: true };
        }
        if (e.naggedT > 0) { bubble(w, e, pick(L.nagAgain)); return { ok: true }; }
        e.boost = 20; e.naggedT = 25; e.mor = Math.min(100, e.mor + 10); me(w, pick(L.nag)); bubble(w, e, pick(L.nagReply)); stat(w, 'nag');
        return { ok: true };
      case 'officer': return actOfficer(w, t.ref);
      case 'car':
        var car = t.ref; if (!car.stuck) return { ok: false };
        car.push += S.HAZ.car.push; car.mine = true; me(w, pick(['영차!', '하나 둘 셋, 영차!', '밀어!!']));
        fx(w, { t: 'push', x: car.x, y: car.y, push: car.push });
        return { ok: true };
      case 'spread':
        var pt = t.ref.part; if (!pt || pt.salted) return { ok: false };
        pt.salted = true; hold(w, null); stat(w, 'salt'); G.syncOpSave(w);
        me(w, pick(['염화칼슘 촥촥!', '이제 안 미끄러진다.', '군화 녹는 소리 들린다…']));
        fx(w, { t: 'salted', p: t.ref.k, name: pt.name, x: P.x, y: P.y });
        return { ok: true };
      case 'saltbox':
        if (a.hand) { me(w, '(손이 꽉 찼다)'); return { ok: false }; }
        hold(w, 'salt'); me(w, '염화칼슘 한 포대. 무겁다…');
        return { ok: true };
      case 'deer':
        shoo(w, t.ref, true); me(w, '훠이! 훠이!');
        return { ok: true };
      case 'cat':
        e = t.ref; e.pet = 3; e.moving = false; stat(w, 'pet'); fx(w, { t: 'pet' });
        bubble(w, e, pick(['냐앙~', '그르릉…', '(배를 보여 준다)', '(눈 위에 발자국 콕콕)']));
        return { ok: true };
      case 'garage':
        if (a.hand) return { ok: false };
        hold(w, 'fuel'); bubble(w, door('garage'), '정비병: 쏟지 마라. 비싸다.');
        return { ok: true };
      case 'stand':
        me(w, '제설 작전, 속도 낸다!!');
        if (a.cool.stand > 0) { bubble(w, w.crew[0], '아까 했잖아요…'); return { ok: true }; }
        a.cool.stand = 90; buff(w, 'rally', 30); w.crew.forEach(function (c) { c.mor = Math.min(100, c.mor + 25); c.slack = false; });
        w.crew.slice(0, 5).forEach(function (c) { bubble(w, c, '넵!!'); });
        return { ok: true };
      case 'stove':
        if (a.cool.stove > 0) { me(w, '(아직 손이 따뜻하다)'); return { ok: false }; }
        a.cool.stove = 45; buff(w, 'warm', 60); stat(w, 'warm'); fx(w, { t: 'warm', x: t.ref.x, y: t.ref.y });
        me(w, pick(['아… 살 것 같다.', '손가락이 돌아왔다!', '딱 1분만…']));
        return { ok: true };
    }
    return { ok: false };
  }

  function shoo(w, d, reward) {
    var P = w.player;
    d.leaving = true; d.t = Math.max(d.t, d.life); d.heading = Math.atan2(d.y - P.y, d.x - P.x); d.hitT = 2;
    bubble(w, d, '꾸엑?!'); stat(w, 'shoo');
    if (reward) { var g = give(w, (10 + 6 * rank(w)) * w.mult, 'shoo'); fx(w, { t: 'shoo', x: d.x, y: d.y, pay: g }); }
  }

  // 도구·버프로 지금 능력치를 다시 계산
  function applyStats(w) {
    var a = w.act, P = w.player, save = w.save, T = G.toolOf(save), b = a.buffs;
    P.r = G.toolR(save); P.p = T.p; P.aura = !!T.aura; P.noClear = false;
    P.cap = Math.round(G.capOf(save) * (b.power > 0 ? 1.25 : 1));
    var m = w.mod;
    m.speed = (b.matsta > 0 ? 1.25 : 1) * (b.warm > 0 ? 1.1 : 1);
    m.hit = (b.hotbar > 0 ? 0.7 : 1) * (b.warm > 0 ? 0.8 : 1);
    m.crew = (b.choco > 0 ? 1.4 : 1) * (b.rally > 0 ? 1.25 : 1) * (b.support > 0 ? 2 : 1);
    m.stun = b.hotpack > 0 ? 0.5 : 1;
    w.mult = G.incomeMult(save) * (b.praise > 0 ? 1.2 : 1);
  }
  function endRide() { /* 직접 모는 차는 없다 */ }

  /* ── 매 틱 ── */
  function step(w, dt) {
    var a = init(w), P = w.player, H = w.haeng;
    Object.keys(a.buffs).forEach(function (k) { a.buffs[k] -= dt; if (a.buffs[k] <= 0) { delete a.buffs[k]; fx(w, { t: 'buffEnd', id: k, name: BUFF[k].name }); } });
    Object.keys(a.cool).forEach(function (k) { a.cool[k] -= dt; });
    a.pickCd -= dt;
    w.crew.forEach(function (e) { if (e.naggedT > 0) e.naggedT -= dt; });
    // 다 끝냈으면 행보관이 보고 원(작전 지휘소)에 가서 기다린다
    if (w.op && w.op.ready && !(H.hold > 0)) { H.tx = S.PADS.report.x + 14; H.ty = S.PADS.report.y - 22; H.wait = 1; }
    if (!w.demo) auto(w, dt);
    if (w.opEnd) return;
    // 이병 때는 선임이 가끔 잔소리 (상병부터는 내가 하는 쪽)
    a.nagT -= dt;
    if (a.nagT <= 0) { a.nagT = 50 + w.rand() * 40; if (rank(w) === 0 && w.save.day >= 2 && !(w.op && w.op.ready)) { say(w, 'nag'); fx(w, { t: 'nag' }); } }
    stepOfficers(w, dt); stepReqs(w, dt);
    a.metaT = (a.metaT || 0) - dt;
    if (a.metaT <= 0 && JY.SnowMeta) { a.metaT = 1; JY.SnowMeta.check(w); }
    applyStats(w);
  }

  /* ── 손에 든 물건 · 신병 인솔 · 따라와/여기 배치 ── */
  function reqOf(a, who) { for (var i = 0; i < a.reqs.length; i++) if (a.reqs[i].who === who) return a.reqs[i]; return null; }
  function hold(w, item) { var a = w.act; a.hand = item; a.pickCd = 1; fx(w, { t: 'hand', item: item, name: item ? ITEM[item].name : '' }); }
  function actMove(w, t, alt) {
    var a = w.act, P = w.player, hand = a.hand, e = t.ref, q, zid;
    if (alt) {
      if ((t.k === 'crew' || t.k === 'plow') && e && e.state !== 'follow') { e.state = 'follow'; e.tidx = -1; me(w, '야, 따라와.'); bubble(w, e, e.def.vehicle ? '어디로 모실까요?' : pick(['넵! 어디로 갑니까?', '또 어디 가요…', '넵!'])); return { ok: true }; }
      return null;
    }
    if (t.k === 'recruit') {
      if (e.state === 'wait') { e.state = 'follow'; stat(w, 'escort'); me(w, '신병! 따라와라.'); bubble(w, e, pick(['이병 ' + e.def.name + '! 잘 부탁드립니다!', '넵!! (얼어 있다)', '여, 여기가 제설장입니까?'])); return { ok: true }; }
      zid = G.zoneAt(w, P.x, P.y);
      if (!zid) { bubble(w, e, '어디로 갑니까…?'); return { ok: false, why: 'zone' }; }
      var ne = G.assignRecruit(w, e, zid.id);
      if (ne) { me(w, zid.name + ' 여기 맡아라.'); bubble(w, ne, pick(['넵! 열심히 하겠습니다!', '여기를 제가요?! …넵!'])); stat(w, 'assign'); }
      return { ok: !!ne };
    }
    if ((t.k === 'crew' || t.k === 'plow') && e && e.state === 'follow') {
      zid = G.zoneAt(w, P.x, P.y);
      if (!zid) { bubble(w, e, '여기는 구역 밖인데요?'); return { ok: false, why: 'zone' }; }
      G.setPost(w, e, zid.id); me(w, '여기 치워라.'); bubble(w, e, zid.name + ', 알겠습니다!'); fx(w, { t: 'assigned', e: e, zone: zid.id, moved: true });
      return { ok: true };
    }
    if (t.k === 'plow' && e) {
      if (hand === 'fuel') {
        hold(w, null); e.noFuel = false; e.boost = 60; e.mor = Math.min(100, e.mor + 40); bubble(w, e, pick(REQ.fuel.thanks)); me(w, '기름 가득!');
        q = reqOf(a, e); if (q) favorDone(w, q, e); else stat(w, 'favor');
        return { ok: true };
      }
      if (e.noFuel) { bubble(w, e, '정비고에서 기름통 좀 갖다주십쇼!'); return { ok: false }; }
      e.state = 'follow'; e.tidx = -1; me(w, '제설차, 따라와!'); bubble(w, e, '어디로 모실까요?');
      return { ok: true };
    }
    return null;
  }
  function favorDone(w, q, e) {
    var a = w.act, save = w.save; a.reqs.splice(a.reqs.indexOf(q), 1);
    var g = give(w, (30 + 15 * save.day) * (1 + rank(w)) * w.mult, 'favor'); stat(w, 'favor');
    fx(w, { t: 'req', state: 'done', item: q.item, who: e.def.name, pay: g });
    return g;
  }
  // 제설차는 가끔 기름이 떨어진다 → 정비고 기름통 (현실: 유류는 정비고에서 수령)
  function stepReqs(w, dt) {
    var a = w.act, R = w.rand;
    a.fuelT -= dt;
    if (a.fuelT <= 0) {
      a.fuelT = 90 + R() * 60;
      var pl = w.crew.filter(function (e) { return e.def.vehicle && !e.off && !e.noFuel && !reqOf(a, e); })[0];
      if (pl) { pl.noFuel = true; a.reqs.push({ who: pl, item: 'fuel', t: 120, max: 120 }); bubble(w, pl, pick(REQ.fuel.ask)); fx(w, { t: 'req', state: 'new', item: 'fuel', who: '제설차', where: ITEM.fuel.from }); }
    }
    for (var i = a.reqs.length - 1; i >= 0; i--) {
      var q = a.reqs[i]; q.t -= dt;
      if (w.crew.indexOf(q.who) < 0) { a.reqs.splice(i, 1); continue; }
      if (q.t > 0) continue;
      a.reqs.splice(i, 1); q.who.noFuel = false; bubble(w, q.who, '…결국 제가 다녀왔습니다.');
      fx(w, { t: 'req', state: 'fail', item: q.item, who: '제설차' });
    }
  }

  function chocoCost(w) { return Math.round(8 * (1 + rank(w)) * (1 + w.save.day * 0.1)); }

  /* ── 간부 순찰 (시계 기준) ── */
  function planOfficers(w) {
    var a = w.act, save = w.save, R = G.mulberry(save.seed * 7 + save.day * 131), plan = [];
    a.offDay = save.day; a.off = [];
    plan.push({ t: G.timeAt(350 + R() * 30), id: 'lt' });                                   // 05:50~06:20 소대장
    if (save.day >= 2 && !save.zones[S.HAZ.car.zone]) plan.push({ t: G.timeAt(420 + R() * 40), id: 'cpt' });   // 07:00~07:40 (진입로를 맡으면 차로 온다)
    if (w.inspect) plan.push({ t: G.timeAt(400 + R() * 20), id: 'gen' });                  // 06:40~07:00 사단장님 순시
    a.offPlan = plan.filter(function (p) { return p.t > w.time; }).sort(function (x, y) { return x.t - y.t; });
  }
  function spawnOfficer(w, id, at) {
    var a = w.act, P = w.player, home = at || (id === 'gen' ? { x: 400, y: 1190 } : (function () { var d = door('office'); return { x: d.x, y: d.y + 8 }; })());
    var o = { id: id, x: home.x, y: home.y, home: home, dir: { x: 0, y: 1 }, walk: 0, moving: false, phase: 'come', t: 0, stayT: OFF[id].stay, tx: P.x, ty: P.y,
      saluted: false, salT: 0, missed: false, warned: false, done: {}, helpT: 0, hitT: 0, tidx: -1, retarget: 0 };
    a.off.push(o);
    fx(w, { t: 'officer', state: 'arrive', id: id, title: OFF[id].title });
    return o;
  }
  function stepOfficers(w, dt) {
    var a = w.act, P = w.player;
    if (a.offDay !== w.save.day) planOfficers(w);
    while (a.offPlan.length && a.offPlan[0].t <= w.time) { var pl = a.offPlan.shift(); if (!a.off.some(function (o) { return o.id === pl.id; })) spawnOfficer(w, pl.id); }
    // 출근 차량이 행정반 앞에 서면 중대장님이 내린다
    if (w.carArrived) { var ca = w.carArrived; w.carArrived = null; if (!a.off.some(function (o) { return o.id === 'cpt'; })) spawnOfficer(w, 'cpt', { x: ca.x, y: ca.y + 10 }); }
    for (var i = a.off.length - 1; i >= 0; i--) {
      var o = a.off[i], def = OFF[o.id], d = dist(o, P);
      o.t += dt;
      if (o.helpT > 0) {
        // 소대장이 같이 치운다
        o.helpT -= dt; o.retarget -= dt;
        if (o.tidx < 0 || o.retarget <= 0 || !w.depth[o.tidx]) { G.pickTarget(w, o); }
        if (Math.hypot(o.tx - o.x, o.ty - o.y) > 6) G.steer(o, o.tx, o.ty, 60, dt, 6); else o.moving = false;
        o.hitT -= dt; if (o.hitT <= 0) { o.hitT = 0.18; G.clearAt(w, o.x + o.dir.x * 9, o.y + o.dir.y * 9, 16, 1, 'crew', null); }
        if (o.helpT <= 0) { bubble(w, o, '손 시려… 난 들어간다!'); o.phase = 'go'; }
        continue;
      }
      if (o.phase === 'come') {
        if (o.t % 1 < dt) { o.tx = P.x; o.ty = P.y; }
        G.steer(o, o.tx, o.ty, def.speed, dt, 6);
        if (d < 28 || o.t > 45) { o.phase = 'stay'; o.moving = false; }
      } else if (o.phase === 'stay') {
        o.stayT -= dt; o.moving = false;
        var fx0 = P.x - o.x, fy0 = P.y - o.y, fm = Math.hypot(fx0, fy0) || 1; o.dir.x = fx0 / fm; o.dir.y = fy0 / fm;
        if (d > 60) G.steer(o, P.x, P.y, def.speed, dt, 6);
        if (o.stayT <= 0) o.phase = 'go';
      } else {
        G.steer(o, o.home.x, o.home.y, def.speed * 1.2, dt, 6);
        if (Math.hypot(o.home.x - o.x, o.home.y - o.y) < 10 || o.t > 150) { a.off.splice(i, 1); fx(w, { t: 'officer', state: 'leave', id: o.id }); continue; }
      }
      // 다가오면 3.5초 안에 경례. 안 하면 지적 (등급 감점)
      if (!o.saluted && !o.missed && o.phase !== 'go' && d < 55) {
        if (!o.warned) { o.warned = true; bubble(w, o, pick(L.offNear[o.id])); fx(w, { t: 'officer', state: 'near', id: o.id, title: def.title, o: o }); }
        o.salT += dt;
        if (o.salT > 3.5) {
          o.missed = true; bubble(w, o, pick(L.offMiss[o.id])); fx(w, { t: 'officer', state: 'miss', id: o.id, title: def.title });
          if (o.id !== 'lt') jigeok(w, 'salute');
        }
      }
    }
  }
  // 간부 보고: 지시서가 얼마나 됐는지 (기준 대비)
  function opDone(w) {
    if (!w.op || !w.op.tasks.length) return G.pct(w);
    var s = 0; w.op.tasks.forEach(function (t) { s += t.done >= 0 ? 1 : Math.min(1, G.taskPct(w, t) / t.goal); });
    return s / w.op.tasks.length;
  }
  function actOfficer(w, o) {
    var save = w.save, def = OFF[o.id], r = rank(w), base = (40 + 20 * save.day) * (1 + r) * w.mult;
    if (!o.saluted) {
      o.saluted = true; var quick = o.salT < 1.2 && !o.missed;
      me(w, '충성!!'); fx(w, { t: 'salute' }); stat(w, 'salute'); if (quick) stat(w, 'kal');
      bubble(w, o, quick ? pick(L.offKal) : o.missed ? '…늦었다. 다음엔 빨리.' : '그래, 수고한다.');
      var pie = o.missed ? 0 : give(w, base * (o.id === 'lt' ? 0.5 : o.id === 'cpt' ? 1 : 2) * (quick ? 1.5 : 1), 'salute');
      var dia = o.missed ? 0 : (o.id === 'gen' ? 2 : 0) + (quick && o.id !== 'lt' ? 1 : 0);
      if (dia) G.gainDia(w, dia, 'salute');
      if (o.id === 'lt') w.crew.forEach(function (c) { c.mor = Math.min(100, c.mor + 10); });
      fx(w, { t: 'officer', state: 'saluted', id: o.id, title: def.title, quick: quick, pie: pie, dia: dia });
      return { ok: true, quick: quick };
    }
    if (o.id === 'lt' && !o.done.help) {
      o.done.help = true; o.helpT = 40; o.tidx = -1; me(w, '소대장님, 같이 하시죠!'); bubble(w, o, '그래! 나도 해 볼까? …이거 재밌네?');
      fx(w, { t: 'officer', state: 'help', id: o.id, title: def.title }); stat(w, 'ltHelp');
      return { ok: true };
    }
    if (!o.done.report && o.id !== 'lt') {
      o.done.report = true; var pc = opDone(w), res, done = w.op ? w.op.tasks.filter(function (t) { return t.done >= 0; }).length : 0, tot = w.op ? w.op.tasks.length : 0;
      me(w, def.title + '! 지시받은 ' + tot + '개 구역 중 ' + done + '개 완료, 나머지 진행 중입니다!');
      if (pc >= 0.9) {
        res = 'good'; var g = give(w, base * (o.id === 'gen' ? 4 : 2), 'report'); G.gainDia(w, o.id === 'gen' ? 3 : 1, 'report'); stat(w, 'goodReport');
        if (o.id === 'gen') save.boxes.push('rare');
        bubble(w, o, o.id === 'gen' ? '훌륭하다! 이 부대 포상이다!!' : '아주 좋아! 다들 고생했다!'); fx(w, { t: 'officer', state: 'report', res: res, id: o.id, title: def.title, pie: g });
      } else if (pc >= 0.6) {
        res = 'ok'; var g2 = give(w, base * 0.6, 'report');
        bubble(w, o, '수고한다. 조금만 더 하자.'); fx(w, { t: 'officer', state: 'report', res: res, id: o.id, title: def.title, pie: g2 });
      } else {
        res = 'bad'; w.crew.forEach(function (c) { c.mor = Math.max(0, c.mor - 10); });
        bubble(w, o, '이게 다 한 거야?! 시간 얼마 안 남았다!');
        fx(w, { t: 'officer', state: 'report', res: res, id: o.id, title: def.title });
      }
      return { ok: true, res: res };
    }
    me(w, '충성!'); fx(w, { t: 'salute' }); bubble(w, o, '그래 그래, 일 봐라.');
    return { ok: true };
  }

  /* ── 생활관 (작전 밖): PX 준비물 · 상점 쓰기 · 체력단련 ── */
  function prepCost(save, it) { return Math.round(it.base * (1 + G.rankOf(save) * 1.5) + (it.crew ? (save.crewRate || 0) * 12 : 0)); }
  function prepItems(save) {
    save.prep = save.prep || {};
    var n = G.crewCount(save);
    return S.PREP.map(function (it) {
      var cost = prepCost(save, it), need = it.crew && !n ? '분대원이 없다' : '';
      return { id: it.id, name: it.name, desc: it.desc, cost: cost, need: need, on: !!save.prep[it.id], ok: !need && !save.prep[it.id] && save.bank >= cost };
    });
  }
  function prepBuy(save, id) {
    var it = prepItems(save).filter(function (x) { return x.id === id; })[0];
    if (!it || !it.ok) return { ok: false };
    save.bank -= it.cost; save.prep[id] = 1; save.stats.px = (save.stats.px || 0) + 1;
    return { ok: true, cost: it.cost, item: it };
  }
  // 상점으로: 다음 작전 지원 (전원 초코파이 = 사기 100, 대대 지원 = 처음 60초 분대원 두 배)
  function useDia(save, what) {
    if (save && save.save) save = save.save;   // 예전처럼 세계를 넘겨도 된다
    var cost = S.DIA[what];
    if (typeof cost !== 'number' || save.dia < cost) return { ok: false };
    if (!G.crewCount(save)) return { ok: false, why: 'crew' };
    save.prep = save.prep || {};
    if (save.prep[what]) return { ok: false, why: 'have' };
    save.dia -= cost; save.prep[what] = 1;
    return { ok: true, cost: cost };
  }
  // 저녁 체력단련(턱걸이): 개수만큼 다음 작전 적재 +25%, 15개 넘으면 하루 한 번 상점
  function pullDone(save, n) {
    if (save && save.save) save = save.save;
    save.stats = save.stats || {}; save.daily = save.daily || {}; save.prep = save.prep || {};
    var best = save.stats.pullBest || 0, extra = 0;
    n = Math.max(0, Math.min(40, n | 0));
    if (n > best) save.stats.pullBest = n;
    save.stats.pull = (save.stats.pull || 0) + 1;
    if (n >= 3) save.prep.power = Math.max(save.prep.power || 0, n);
    if (n >= 15 && save.daily.pullDia !== save.day) { save.daily.pullDia = save.day; save.dia += 1; save.diaLife += 1; extra = 1; }
    return { n: n, best: n > best, dia: extra };
  }

  function state(w) {
    var a = init(w), list = [];
    Object.keys(a.buffs).forEach(function (k) { list.push({ id: k, name: BUFF[k].name, desc: BUFF[k].desc, t: a.buffs[k] }); });
    var urgent = (a.off || []).filter(function (o) { return !o.saluted && !o.missed && o.warned; })[0];
    var mor = w.crew.length ? w.crew.reduce(function (q, e) { return q + e.mor; }, 0) / w.crew.length : 0, slack = w.crew.filter(function (e) { return e.slack; }).length;
    var reqs = a.reqs.map(function (q) { return { who: '제설차', item: q.item, want: ITEM[q.item].want, from: ITEM[q.item].from, t: q.t, max: q.max, ref: q.who }; });
    return { hand: a.hand ? { id: a.hand, name: ITEM[a.hand].name } : null, reqs: reqs, recruits: (w.recruits || []).length, heat: 0, buffs: list, mission: null,
      salute: urgent ? { title: OFF[urgent.id].title, left: Math.max(0, 3.5 - urgent.salT) } : null, mor: mor, slack: slack, ride: null,
      op: G.opStatus(w), car: w.car && w.car.stuck ? { push: w.car.push } : null,
      pads: pads(w).map(function (p) { var t = a.padT && a.padT[p.id] > 0 ? a.padT[p.id] : 0; p.prog = Math.min(1, t / p.dwell); return p; }),
      goal: objective(w), assign: Math.min(1, (a.assignT || 0) / 1), fever: w.fever || 0, surge: w.surge || 0 };
  }

  JY.SnowAct = {
    init: init, step: step, candidates: candidates, best: best, act: act, canBuild: canBuild,
    canThrow: function () { return false; }, throwBall: function () { return { ok: false }; },
    prepItems: prepItems, prepBuy: prepBuy, pullDone: pullDone, useDia: useDia, applyPrep: applyPrep, nextTool: nextTool, pads: pads, objective: objective, auto: auto,
    drop: function (w) { init(w); if (w.act.hand) { me(w, '(' + ITEM[w.act.hand].name + '을/를 내려놨다)'); hold(w, null); return true; } return false; },
    ITEM: ITEM, state: state, applyStats: applyStats, endRide: endRide, spawnOfficer: spawnOfficer, OFF: OFF, chocoCost: chocoCost, opDone: opDone,
    RIDE: RIDE, BUFF: BUFF, PX: S.PREP, TRACTOR: TRACTOR, FLAG: FLAG, DECOR_MAN: DECOR_MAN, SNOWMAN_COST: SNOWMAN_COST, door: door
  };
})(window.JY = window.JY || {});
