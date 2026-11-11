/* 제설각 — 상호작용 (DOM 없음, Node에서도 돈다)
 * 다가가서 보면 뭐든 할 수 있다: 경례, 갈구기, 깨우기, 짐 떠넘기기, 제설차·트랙터·중대장님 차 몰기,
 * 고라니 쫓기, 짬타이거 쓰다듬기, 눈덩이, 눈사람, 족구공, PX, 짬밥, 면회, 취침, 행정반 임무,
 * 그리고 사고 치면 행보관이 쫓아온다(분노 ★). sim.step()이 매 틱 A.step()을 부른다. */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim;

  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function bld(id) { for (var i = 0; i < S.BUILDINGS.length; i++) if (S.BUILDINGS[i].id === id) return S.BUILDINGS[i]; return null; }
  function door(id) { var b = bld(id); return { x: b.x + b.w / 2, y: b.y + b.h + 4 }; }

  var TRACTOR = { x: 252, y: 1062 };     // 정비고 앞에 세워 둔 트랙터
  var FLAG = { x: 520, y: 298 };
  var DECOR_MAN = { x: 470, y: 120 };
  var SNOWMAN_COST = 25, SNOWMAN_MAX = 10, BALL_CD = 0.45;

  // 탈 것: 타는 동안 범위·힘·적재·속도가 바뀐다
  var RIDE = {
    plow: { name: '제설차', r: 34, p: 3, cap: 500, speed: 1.25, t: 30 },
    tractor: { name: '정비고 트랙터', r: 46, p: 3, cap: 900, speed: 1.3, t: 35 },
    car: { name: '중대장님 차', r: 0, p: 0, cap: 0, speed: 2.1, t: 20, noClear: true }
  };

  var BUFF = {
    praise: { name: '행보관 칭찬', desc: '초코파이 +20%' },
    matsta: { name: '맛스타', desc: '이동 +25%' },
    hotbar: { name: '냉동 핫바', desc: '손 +30%' },
    hotpack: { name: '핫팩', desc: '덜 넘어진다' },
    meal: { name: '짬밥', desc: '적재 +40%' },
    choco: { name: '초코파이 상자', desc: '인력 +40%' },
    chicken: { name: '면회 치킨', desc: '인력 +50%' },
    rally: { name: '구령', desc: '인력 +25%' },
    cat: { name: '고양이 힐링', desc: '덜 넘어진다' },
    support: { name: '대대 지원', desc: '인력 ×2' }
  };

  // 간부: 하루에 한 번씩 순찰 온다. 다가오면 3초 안에 경례! (1초 안이면 칼경례)
  var OFF = {
    lt: { name: '소대장', title: '소대장님', face: 'lt', speed: 44, stay: 24 },
    cpt: { name: '중대장', title: '중대장님', face: 'captain', speed: 38, stay: 20 },
    gen: { name: '사단장', title: '사단장님', face: 'general', speed: 32, stay: 30 }
  };

  // 손에 드는 물건 (한 번에 하나): 가져와서 → 건네준다
  var ITEM = {
    meal: { name: '짬밥 식판', from: '취사장', want: '짬밥' },
    snack: { name: '맛스타·냉동 봉지', from: 'PX', want: '간식' },
    letter: { name: '편지', from: '위병소', want: '편지' },
    fuel: { name: '기름통', from: '정비고', want: '기름' }
  };
  // 부탁(심부름): 인력·행보관이 가끔 뭘 갖다 달라고 한다
  var REQ = {
    meal: { ask: ['배고파요… 짬밥 좀 갖다 주시면 안 됩니까', '취사장 가서 식판 하나만…', '밥 먹고 하면 안 됩니까…'], thanks: ['살았다!! 짬밥 최고!', '오늘 짜장이다!!'] },
    snack: { ask: ['PX에서 맛스타 하나만 사다 주십쇼…', '냉동 먹고 싶다…', '초코파이… 아니 냉동…'], thanks: ['이 은혜 잊지 않겠습니다!', '형이 최고입니다!'] },
    letter: { ask: ['혹시 저 편지 왔는지 위병소에 좀…', '여자친구 편지 기다리는데…'], thanks: ['편지다!!! (눈물)', '…헤어지자는 거 아니지? 휴!'] },
    fuel: { ask: ['기름 떨어졌습니다! 정비고에서 기름통 좀!'], thanks: ['부릉부릉! 다시 갑니다!'] }
  };
  var PX = [
    { id: 'matsta', name: '맛스타', base: 30, sec: 60, desc: '탄산이 아니다. 근데 빨라진다. 이동 +25% (60초)' },
    { id: 'hotbar', name: '냉동 핫바', base: 50, sec: 60, desc: '전자레인지 30초. 손이 빨라진다 +30% (60초)' },
    { id: 'hotpack', name: '핫팩', base: 40, sec: 120, desc: '고라니·눈덩이에 덜 넘어진다 (120초)' },
    { id: 'choco', name: '초코파이 한 상자', base: 80, sec: 60, crew: true, desc: '후임들한테 돌린다. 인력 전원 +40% (60초)' },
    { id: 'gong', name: '꽹과리 대여', base: 60, desc: '지금 들어온 고라니를 전부 쫓아낸다' }
  ];

  var L = {
    salute: ['오냐, 수고한다.', '음. 경례 각이 좋군.', '그래, 그렇게만 해라.', '충성은 좋은데 삽은 어디 갔나?'],
    saluteAgain: ['됐고, 눈이나 치워.', '경례는 아까 했잖아.', '손 내리고 삽 들어.'],
    forgive: ['…이번 한 번만 봐준다.', '경례 하나는 기가 막히는군. 가 봐.'],
    noForgive: ['경례로 넘어가려고?! 거기 서!', '어딜 웃으면서 경례야!'],
    chase: ['거기 서!!', '야 이 녀석아!', '안 서?!', '너 이름 뭐야!!'],
    nag: ['똑바로 안 해?', '그게 미는 거냐?', '빠릿빠릿하게!', '눈 오는 속도보다 느리잖아!'],
    choco: ['초코파이 감사합니다!! (눈물)', '형이 최고입니다!', '이 은혜 잊지 않겠습니다!'],
    unslack: ['…네, 일어납니다.', '아 들켰다', '5분만 쉬려고 했는데…'],
    tiredNag: ['더는 못 해요…', '손가락이 안 움직여요…'],
    offNear: { lt: ['어, 수고가 많네!', '나도 소대장이다!'], cpt: ['다들 고생 많다!', '어디 보자…'], gen: ['…….', '이 부대는 어떤가 보자.'] },
    offMiss: { lt: ['어… 경례는…?', '(서운한 표정)'], cpt: ['경례 안 하나?!', '군기가 빠졌구만!'], gen: ['이 부대 군기가 왜 이래!!', '행보관 어디 있나!'] },
    offKal: ['오, 칼경례! 좋아!', '그래, 바로 그거다!'],
    nagReply: ['넵!! 알겠습니다!', '…넵.', '아 네네네', '(속으로 욕하는 중)'],
    nagAgain: ['아 지금 하고 있잖아요!', '방금 갈궜잖아요…'],
    wake: ['아 알았어 알았어…', '5분만…', '나 전역 며칠 남았는지 알아?'],
    help: ['고맙다… 넌 좋은 후임이야', '살았다…'],
    hand: ['이걸 저보고…?', '넵… 갖다 놓겠습니다', '아 진짜…'],
    hit: ['악! 누구야!', '야!! 눈 들어갔잖아!', '이 X… 아 아닙니다'],
    throwback: ['받아라!', '복수다!', '이병 주제에!'],
    driver: ['어어? 제 차입니다!!', '운전병 없이 몰면 안 되는데…', '긁기만 해 봐요…'],
    mess: ['오늘 짜장!', '밥은 많이 줬다. 많이 치워라.', '짬 남은 거 고양이 줘라.'],
    gag: { garage: ['…기름 냄새 좋다.', '정비병: 뭘 봐. 트랙터는 앞에 있다.'], snowman: ['…눈사람은 대답이 없다.', '(눈사람이 째려보는 것 같다)'],
      flag: ['애국심이 차오른다. (효과 없음)', '충성!!! …아무도 안 봤다.'], tank: ['…반짝반짝하네.', '포탑에 눈 쌓였다.'] }
  };

  /* ── 상태 ── */
  function init(w) {
    if (w.act) return w.act;
    var save = w.save;
    save.snowmen = save.snowmen || []; save.daily = save.daily || {}; save.stats = save.stats || {};
    var a = w.act = { buffs: {}, heat: 0, heatT: 0, shoutT: 0, balls: [], ride: null, mission: null, missionCool: 0, cool: {}, ballCd: 0,
      ball: null, scrap: false, deerT: 0, n: { shoo: 0, pet: 0, hit: 0, wake: 0, flag: 0, snowman: 0 }, hand: null, reqs: [], reqT: 25, fuelT: 80, pickCd: 0 };
    a.ball = ballHome(w);
    return a;
  }
  function ballHome(w) {
    var B = w.save.zones.B ? G.zoneById('B') : null;
    return B ? { x: B.x + B.w * 0.3, y: B.y + B.h / 2, vx: 0, vy: 0, h: 0 } : { x: 420, y: 205, vx: 0, vy: 0, h: 0 };
  }
  function stat(w, k, n) { var st = w.save.stats; st[k] = (st[k] || 0) + (n || 1); if (w.act.n[k] !== undefined) w.act.n[k] += n || 1; }
  function fx(w, o) { w.fx.push(o); return o; }
  function me(w, text) { fx(w, { t: 'me', text: text }); }
  function bubble(w, e, text) { fx(w, { t: 'bubble', e: e, text: text }); }
  function say(w, text) { fx(w, { t: 'say', key: text }); }
  function give(w, n, src) { n = Math.round(n); if (n <= 0) return 0; w.earned += n; G.pay(w, n, src || 'act'); return n; }
  function buff(w, id, sec) { w.act.buffs[id] = Math.max(w.act.buffs[id] || 0, sec); fx(w, { t: 'buff', id: id, name: BUFF[id].name, desc: BUFF[id].desc, sec: sec }); }
  function heat(w, n, why) {
    var a = w.act, h0 = a.heat;
    a.heat = Math.max(0, Math.min(3, a.heat + n)); a.heatT = 0;
    if (a.heat !== h0) fx(w, { t: 'heat', heat: a.heat, why: why || '' });
  }
  function rank(w) { return G.rankOf(w.save); }

  /* ── 주변에서 할 수 있는 것 ── */
  function candidates(w) {
    var a = init(w), P = w.player, save = w.save, out = [];
    function add(k, ref, x, y, r, name, verb, extra) { var o = { k: k, ref: ref, x: x, y: y, r: r, name: name, verb: verb }; if (extra) Object.keys(extra).forEach(function (q) { o[q] = extra[q]; }); out.push(o); }
    if (a.ride) { add('exit', null, P.x, P.y, 999, RIDE[a.ride.kind].name, '내리기'); return out; }
    (a.off || []).forEach(function (o) {
      var verb = !o.saluted ? '경례' : !o.done.report && o.id !== 'lt' ? '보고하기' : o.id === 'lt' && !o.done.help ? '같이 하시죠' : '경례';
      add('officer', o, o.x, o.y, o.saluted ? 40 : 60, OFF[o.id].title, verb, { urgent: !o.saluted && !o.missed });
    });
    var H = w.haeng, hand = a.hand, here = G.zoneAt(w, P.x, P.y), hereV = here ? '여기 배치 (' + here.name + ')' : '따라오는 중';
    var hReq = reqOf(a, H);
    add('haeng', H, H.x, H.y, 36, '행보관' + (hReq ? ' · ' + ITEM[hReq.item].want + ' 부탁' : ''), hand === 'snack' ? '간식 드리기' : a.heat > 0 ? '경례로 무마' : '경례');
    // 신병: 인솔 → 따라와서 → 구역에서 배치
    (w.recruits || []).forEach(function (r) {
      if (r.state === 'wait') add('recruit', r, r.x, r.y, 36, '신병 ' + r.def.name, '인솔하기');
      else add('recruit', r, r.x, r.y, 70, '신병 ' + r.def.name, hereV, { behind: true, soft: !here });
    });
    w.crew.forEach(function (e) {
      if (e.off) return;
      var C = e.def, rq = reqOf(a, e), nm = C.vehicle ? '제설차 (운전병)' : C.name;
      if (rq) nm += ' · ' + ITEM[rq.item].want + ' 부탁';
      if (e.state === 'follow') { add(C.vehicle ? 'plow' : 'crew', e, e.x, e.y, 70, nm, hereV, { behind: true, soft: !here, follow: true }); return; }
      var v2 = '따라와 (담당: ' + (G.zoneById(e.post) || { name: '?' }).name + ')';
      if (C.vehicle) { add('plow', e, e.x, e.y, 40, nm, hand === 'fuel' ? '기름 넣기' : e.noFuel ? '기름 없음 (정비고)' : '운전 교대', { verb2: v2 }); return; }
      var verb = hand && (rq && rq.item === hand) ? ITEM[hand].want + ' 전달' : hand === 'meal' || hand === 'snack' ? '나눠 주기' : hand === 'letter' ? '편지 주기' :
        e.asleep ? '깨우기' : e.slack ? '일으켜 세우기' : e.injured > 0.8 ? '부축하기' : P.load >= 10 && e.cap - e.load >= 5 ? '짐 떠넘기기' : e.mor < 50 ? '초코파이 주기 (' + chocoCost(w) + ')' : '갈구기';
      add('crew', e, e.x, e.y, 36, nm, verb, { verb2: v2 });
    });
    if (w.car) add('car', w.car, w.car.x, w.car.y, 42, '중대장님 차', '탈취하기');
    add('tractor', TRACTOR, TRACTOR.x, TRACTOR.y, 40, '정비고 트랙터', hand === 'fuel' && save.daily.tractor === save.day ? '기름 넣기' : rank(w) < 1 ? '몰기 (일병부터)' : save.daily.tractor === save.day ? '몰기 (기름 없음)' : '몰기');
    w.deer.forEach(function (d) { if (!d.leaving) add('deer', d, d.x, d.y, 42, '고라니', '쫓아내기'); });
    w.cats.forEach(function (c) { add('cat', c, c.x, c.y, 30, '짬타이거', a.scrap || hand === 'meal' ? '짬 주기' : '쓰다듬기'); });
    var dB = door('barracks'), late = w.time >= w.dayLen * 0.45;
    add('barracks', null, dB.x, dB.y, 34, '생활관', a.heat > 0 ? '숨기' : late ? '취침 (다음 날로)' : '들어가기');
    var dO = door('office'); add('office', null, dO.x, dO.y, 34, '행정반', a.mission ? '임무 확인' : '임무 받기');
    var dP = door('px'); add('px', null, dP.x, dP.y, 34, 'PX', hand ? '들어가기' : '들어가기', { verb2: null });
    var dM = door('mess'), ate = save.daily.mess === save.day;
    add('mess', null, dM.x, dM.y, 34, '취사장', ate ? (hand ? '배식 끝' : '식판 받아 가기') : '짬밥 먹기', { verb2: !ate && !hand ? '식판 받아 가기' : null });
    var dG = door('garage'); add('garage', null, dG.x, dG.y, 34, '정비고', hand ? '기웃거리기' : '기름통 받기');
    var dW = door('guard'), letter = a.reqs.some(function (q) { return q.item === 'letter'; });
    add('guard', null, dW.x, dW.y, 34, '위병소', save.daily.gate === save.day ? (letter && !hand ? '우편 받기' : '면회 (내일)') : '면회 확인', { verb2: letter && !hand && save.daily.gate !== save.day ? '우편 받기' : null });
    if (!hand) out.forEach(function (c) { if (c.k === 'px') c.verb2 = '간식 사 가기 (' + snackCost(w) + ')'; });
    var st = bld('stand'); add('stand', null, st.x + st.w / 2, st.y + st.h + 6, 40, '구령대', '구령하기');
    add('flag', FLAG, FLAG.x, FLAG.y, 30, '태극기', '경례');
    S.TANKS.forEach(function (t) {
      var nx = Math.max(t.x, Math.min(t.x + t.w, P.x)), ny = Math.max(t.y, Math.min(t.y + t.h, P.y));
      add('tank', t, nx, ny, 22, t.name + ' 전차', '만지기');
    });
    add('decorman', DECOR_MAN, DECOR_MAN.x, DECOR_MAN.y, 28, '눈사람', '경례');
    save.snowmen.forEach(function (m) { add('snowman', m, m.x, m.y, 24, '내 눈사람', '부수기'); });
    add('ball', a.ball, a.ball.x, a.ball.y, 24, '족구공', '차기');
    return out;
  }

  // 지금 할 행동 하나. look = 보는 방향(단위벡터), fp = 1인칭이면 앞에 있는 것만
  function best(w, look, fp) {
    var P = w.player, list = candidates(w), b = null, bs = 1e9;
    look = look || P.dir;
    list.forEach(function (c) {
      var dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx, dy);
      if (d > c.r) return;
      var cos = d > 0.01 ? (dx * look.x + dy * look.y) / d : 1;
      if (fp && cos < 0.25 && d > 9 && c.k !== 'exit' && !c.urgent && !c.behind) return;
      var s = c.k === 'exit' ? -1 : c.urgent ? -0.5 + d * 0.001 : c.behind ? (c.soft ? 60 : 0.2) + d * 0.001 : d * (1.6 - cos);
      if (c.urgent) { if (s < bs) { bs = s; b = c; } return; }
      if (s < bs) { bs = s; b = c; }
    });
    if (!b && canBuild(w, look)) b = { k: 'build', ref: null, x: P.x + look.x * 18, y: P.y + look.y * 18, r: 0, name: '눈사람', verb: '만들기 (눈 ' + SNOWMAN_COST + ')' };
    return b;
  }
  function canBuild(w, look) {
    var P = w.player;
    if (w.act && w.act.ride) return false;
    if (P.load < SNOWMAN_COST || P.moving || P.idleT < 0.35) return false;   // 멈춰 서야 만든다
    var x = P.x + look.x * 18, y = P.y + look.y * 18;
    if (G.blocked(x, y, 8)) return false;
    if (w.save.snowmen.some(function (m) { return Math.hypot(m.x - x, m.y - y) < 18; })) return false;
    if (w.dumps.some(function (d) { return Math.hypot(d.x - x, d.y - y) < d.r + 10; })) return false;
    return true;
  }

  /* ── 행동 ── */
  function act(w, t, look, alt) {
    var a = init(w), P = w.player, save = w.save, H = w.haeng, R = w.rand, e, r;
    if (!t) return { ok: false };
    look = look || P.dir;
    if (P.stun > 0.3 && t.k !== 'exit') return { ok: false, why: 'stun' };
    var v7 = actV7(w, t, alt);
    if (v7) return v7;
    switch (t.k) {
      case 'exit': endRide(w, true); return { ok: true };
      case 'haeng':
        H.hold = 2.2; H.dir.x = P.x - H.x; H.dir.y = P.y - H.y; var hm = Math.hypot(H.dir.x, H.dir.y) || 1; H.dir.x /= hm; H.dir.y /= hm;
        me(w, '충성!'); fx(w, { t: 'salute' }); stat(w, 'salute');
        if (a.heat > 0) {
          if (R() < 0.5) { a.heat = 0; fx(w, { t: 'heat', heat: 0, why: 'forgive' }); bubble(w, H, pick(L.forgive)); }
          else { bubble(w, H, pick(L.noForgive)); heat(w, 1, 'salute'); H.hold = 0.6; }
          return { ok: true };
        }
        if (a.cool.haeng > 0) { bubble(w, H, pick(L.saluteAgain)); return { ok: true }; }
        a.cool.haeng = 40; bubble(w, H, pick(L.salute)); buff(w, 'praise', 45);
        return { ok: true };
      case 'crew':
        e = t.ref;
        if (e.asleep) { e.asleep = false; e.sleepT = 10; bubble(w, e, pick(L.wake)); me(w, '병장님! 일어나십시오!'); fx(w, { t: 'wake', e: e }); stat(w, 'wake'); return { ok: true }; }
        if (e.slack) { e.slack = false; e.mor = 40; bubble(w, e, pick(L.unslack)); me(w, '야! 거기서 뭐 해!'); fx(w, { t: 'wake', e: e }); stat(w, 'unslack'); return { ok: true }; }
        if (e.injured > 0.8) { e.injured *= 0.35; bubble(w, e, pick(L.help)); me(w, '괜찮으십니까?'); return { ok: true }; }
        if (P.load >= 10 && e.cap - e.load >= 5) {
          var n = Math.min(P.load, e.cap - e.load), v = P.val * n / P.load;
          e.load += n; e.val += v; P.load -= n; P.val -= v; e.state = 'haul';
          me(w, '이것 좀 갖다 놔.'); bubble(w, e, pick(L.hand)); stat(w, 'hand');
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
      case 'plow':
        e = t.ref;
        if (e.rideCd > 0) { bubble(w, e, '방금 탔잖아요. 좀 쉬었다 타요.'); return { ok: false }; }
        e.off = true; e.rideCd = 60;
        bubble(w, e, pick(L.driver)); startRide(w, 'plow', e);
        return { ok: true };
      case 'car':
        w.car = null; startRide(w, 'car', null); stat(w, 'hijack');
        heat(w, 2, 'car'); say(w, '중대장님 차를 왜 몰아!!! 거기 서!');
        return { ok: true };
      case 'tractor':
        if (rank(w) < 1) { bubble(w, TRACTOR, '정비병: 이병은 운전 못 해. 일병 달고 와.'); return { ok: false }; }
        if (save.daily.tractor === save.day) { bubble(w, TRACTOR, '정비병: 기름 다 썼다. 내일 와.'); return { ok: false }; }
        save.daily.tractor = save.day; startRide(w, 'tractor', null);
        return { ok: true };
      case 'deer':
        shoo(w, t.ref, true); me(w, '훠이! 훠이!');
        return { ok: true };
      case 'cat':
        e = t.ref; e.pet = 3; e.moving = false; stat(w, 'pet'); fx(w, { t: 'pet' });
        if (a.scrap) { a.scrap = false; e.follow = 40; bubble(w, e, '냐아앙~♡ (따라온다)'); buff(w, 'cat', 120); }
        else { bubble(w, e, pick(['냐앙~', '그르릉…', '(배를 보여 준다)'])); buff(w, 'cat', 60); }
        return { ok: true };
      case 'barracks':
        if (a.heat > 0) { a.heat = 0; a.heatT = 0; fx(w, { t: 'heat', heat: 0, why: 'hide' }); me(w, '(생활관 관물대 뒤에 숨었다…)'); say(w, '어디 갔어 이 녀석! …다음엔 안 봐준다.'); return { ok: true, ui: 'hide' }; }
        if (w.time < w.dayLen * 0.45) { say(w, pick(['아직 해가 중천이다. 어딜 들어가!', '취침은 점호 끝나고! 나가서 치워!'])); return { ok: false }; }
        var rest = w.dayLen - w.time, bonus = give(w, (save.crewRate || 0) * rest * 0.6, 'crew');
        G.newDay(w); if (a.ride) endRide(w, false);
        fx(w, { t: 'sleep', bonus: bonus });
        return { ok: true, ui: 'sleep', bonus: bonus };
      case 'office':
        if (a.mission) { say(w, '아직 임무 중이다: ' + a.mission.text); return { ok: false }; }
        if (a.missionCool > 0) { say(w, '임무는 조금 있다가. 숨 좀 돌려라.'); return { ok: false }; }
        a.mission = newMission(w); say(w, a.mission.text + '!'); fx(w, { t: 'mission', state: 'new', m: a.mission });
        return { ok: true };
      case 'px': return { ok: true, ui: 'px' };
      case 'mess':
        if (save.daily.mess === save.day) { bubble(w, door('mess'), '취사병: 배식 끝났다. 내일 와.'); return { ok: false }; }
        save.daily.mess = save.day; a.scrap = w.cats.length > 0; me(w, '잘 먹겠습니다!');
        bubble(w, door('mess'), '취사병: ' + pick(L.mess)); buff(w, 'meal', 120);
        return { ok: true };
      case 'garage': me(w, pick(L.gag.garage)); return { ok: true };   // (빈손이면 actV7이 기름통을 준다)
      case 'guard':
        if (save.daily.gate === save.day) { bubble(w, door('guard'), '위병: 오늘 면회는 끝났다.'); return { ok: false }; }
        save.daily.gate = save.day;
        r = R();
        if (r < 0.4) { buff(w, 'chicken', 90); w.crew.forEach(function (c) { c.mor = Math.min(100, c.mor + 60); c.slack = false; }); say(w, '면회: 어머니가 치킨을 보내셨다! 후임들 눈이 반짝인다.'); fx(w, { t: 'gift', kind: 'chicken' }); }
        else if (r < 0.7) { var g = give(w, (50 + save.day * 15) * (1 + rank(w)) * w.mult, 'gift'); say(w, '편지가 왔다. "보고 싶어" …초코파이도 같이 왔다! +' + g); fx(w, { t: 'gift', kind: 'letter', pay: g }); }
        else { me(w, '…아무도 안 왔다.'); bubble(w, door('guard'), '위병: 눈이나 치워라.'); fx(w, { t: 'gift', kind: 'none' }); }
        return { ok: true };
      case 'stand':
        me(w, '제설 작전 개시!!');
        if (!w.crew.length) { bubble(w, t, '(아무도 없다. 메아리만 돌아온다)'); return { ok: true }; }
        if (a.cool.stand > 0) { bubble(w, w.crew[0], '아까 했잖아요…'); return { ok: true }; }
        a.cool.stand = 90; buff(w, 'rally', 30); w.crew.forEach(function (c) { c.mor = Math.min(100, c.mor + 25); c.slack = false; });
        w.crew.slice(0, 5).forEach(function (c) { bubble(w, c, '충성!'); });
        return { ok: true };
      case 'flag': me(w, '충성!'); fx(w, { t: 'salute' }); bubble(w, FLAG, pick(L.gag.flag)); stat(w, 'flag'); return { ok: true };
      case 'tank': me(w, pick(L.gag.tank)); heat(w, 1, 'tank'); say(w, '전차 만지지 말랬지!!! 거기 서!'); return { ok: true };
      case 'decorman': me(w, '충성!'); fx(w, { t: 'salute' }); bubble(w, DECOR_MAN, pick(L.gag.snowman)); return { ok: true };
      case 'snowman':
        var i = save.snowmen.indexOf(t.ref); if (i >= 0) save.snowmen.splice(i, 1);
        fx(w, { t: 'smash', x: t.ref.x, y: t.ref.y }); me(w, '…미안하다.');
        P.load = Math.min(P.cap, P.load + 10);
        return { ok: true };
      case 'ball':
        var B = a.ball; B.vx = look.x * 260; B.vy = look.y * 260; B.h = 6;
        fx(w, { t: 'kick', x: B.x, y: B.y }); stat(w, 'kick');
        return { ok: true };
      case 'build': return buildSnowman(w, look);
    }
    return { ok: false };
  }

  function shoo(w, d, reward) {
    var P = w.player;
    d.leaving = true; d.t = Math.max(d.t, d.life); d.heading = Math.atan2(d.y - P.y, d.x - P.x); d.hitT = 2;
    bubble(w, d, '꾸엑?!'); stat(w, 'shoo');
    if (reward) { var g = give(w, (10 + 6 * rank(w)) * w.mult, 'shoo'); fx(w, { t: 'shoo', x: d.x, y: d.y, pay: g }); }
  }

  function buildSnowman(w, look) {
    var P = w.player, save = w.save;
    if (!canBuild(w, look)) return { ok: false };
    var k = SNOWMAN_COST / P.load;
    P.val -= P.val * k; P.load -= SNOWMAN_COST;
    var m = { x: Math.round(P.x + look.x * 18), y: Math.round(P.y + look.y * 18), s: (w.rand() * 1e6) | 0, d: save.day };
    save.snowmen.push(m);
    if (save.snowmen.length > SNOWMAN_MAX) fx(w, { t: 'smash', x: save.snowmen[0].x, y: save.snowmen[0].y, old: true }), save.snowmen.shift();
    stat(w, 'snowman'); fx(w, { t: 'snowman', m: m });
    me(w, pick(['사단장님 환영 눈사람 완성!', '…잘생겼다.', '이게 바로 군대 예술이다.']));
    return { ok: true, m: m };
  }

  /* ── 탈 것 ── */
  function startRide(w, kind, e) {
    var a = w.act, P = w.player, Rd = RIDE[kind];
    a.ride = { kind: kind, t: Rd.t, max: Rd.t, e: e };
    applyStats(w);
    fx(w, { t: 'ride', kind: kind, name: Rd.name, on: true });
    if (kind !== 'car') me(w, pick(['부릉부릉~', '이게 바로 문명이다!', '비켜, 비켜!']));
    else me(w, '…한 바퀴만 돌고 갖다 놓겠습니다.');
    P.stun = 0;
  }
  function endRide(w, byHand) {
    var a = w.act, P = w.player, rd = a.ride;
    if (!rd) return;
    a.ride = null;
    if (rd.e) {
      var e = rd.e; e.off = false; e.x = P.x; e.y = P.y;
      var spots = [[18, 0], [-18, 0], [0, 18], [0, -18], [0, 0]];
      for (var i = 0; i < spots.length; i++) if (!G.blocked(P.x + spots[i][0], P.y + spots[i][1], 6)) { e.x = P.x + spots[i][0]; e.y = P.y + spots[i][1]; break; }
      e.tidx = -1; e.retarget = 0;
      bubble(w, e, '다음엔 말하고 타요!');
    }
    applyStats(w);
    fx(w, { t: 'ride', kind: rd.kind, name: RIDE[rd.kind].name, on: false, hand: !!byHand });
    if (!byHand) me(w, rd.kind === 'car' ? '…기름이 떨어졌다. 여기 두고 가자.' : '기름 떨어졌다!');
  }
  // 도구·탈 것·버프로 지금 능력치를 다시 계산
  function applyStats(w) {
    var a = w.act, P = w.player, save = w.save, T = G.toolOf(save), b = a.buffs, rd = a.ride ? RIDE[a.ride.kind] : null;
    var base = Math.round(G.capOf(save) * (b.meal > 0 ? 1.4 : 1));
    var tr = G.toolR(save);
    P.r = rd ? (rd.noClear ? tr : Math.max(tr, rd.r)) : tr;
    P.p = rd && !rd.noClear ? Math.max(T.p, rd.p) : T.p;
    P.aura = rd ? false : !!T.aura;
    P.noClear = !!(rd && rd.noClear);
    P.cap = rd && rd.cap ? Math.max(base, rd.cap) : base;
    var m = w.mod;
    m.speed = (b.matsta > 0 ? 1.25 : 1) * (rd ? rd.speed : 1);
    m.hit = b.hotbar > 0 ? 0.7 : 1;
    m.crew = (b.choco > 0 ? 1.4 : 1) * (b.chicken > 0 ? 1.5 : 1) * (b.rally > 0 ? 1.25 : 1) * (b.support > 0 ? 2 : 1);
    m.stun = b.cat > 0 || b.hotpack > 0 ? 0.5 : 1;
    w.mult = G.incomeMult(save) * (1 + 0.01 * Math.min(SNOWMAN_MAX, save.snowmen.length)) * (b.praise > 0 ? 1.2 : 1);
  }

  /* ── 눈덩이 ── */
  function canThrow(w) {
    var a = init(w), P = w.player;
    if (a.ride || a.ballCd > 0 || P.stun > 0) return false;
    return true;   // 눈은 어디든 있다 (군화에 묻은 것까지)
  }
  function throwBall(w, look, pitch) {
    var a = init(w), P = w.player;
    if (!canThrow(w)) return { ok: false };
    look = look || P.dir;
    if (P.load >= 1) { P.val -= P.val / P.load; P.load -= 1; }
    var up = Math.max(-0.4, Math.min(0.9, pitch || 0));
    var sp = 300, h = Math.cos(up), b = { x: P.x + look.x * 6, y: P.y + look.y * 6, h: 22, vx: look.x * sp * h, vy: look.y * sp * h, vh: 110 + sp * Math.sin(up), from: 'me', t: 0 };
    a.balls.push(b); a.ballCd = BALL_CD; stat(w, 'throw');
    fx(w, { t: 'throw', b: b });
    return { ok: true, b: b };
  }
  function throwAt(w, from, to) {
    var a = w.act, dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, tf = d / 240;
    a.balls.push({ x: from.x, y: from.y, h: 20, vx: dx / tf, vy: dy / tf, vh: 260 * tf, from: 'crew', t: 0, src: from });
    fx(w, { t: 'throw', b: a.balls[a.balls.length - 1], npc: true });
  }
  function stepBalls(w, dt) {
    var a = w.act, P = w.player, H = w.haeng;
    for (var i = a.balls.length - 1; i >= 0; i--) {
      var b = a.balls[i], hit = null;
      b.t += dt; b.vh -= 520 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.h += b.vh * dt;
      if (b.h <= 0 || b.t > 4) { fx(w, { t: 'splat', x: b.x, y: b.y, h: 0 }); a.balls.splice(i, 1); continue; }
      if (b.h < 30 && G.blocked(b.x, b.y, 1)) { fx(w, { t: 'splat', x: b.x, y: b.y, h: b.h }); a.balls.splice(i, 1); continue; }
      if (b.h > 36) continue;
      if (b.from === 'me') {
        if (Math.hypot(H.x - b.x, H.y - b.y) < 12) hit = 'haeng';
        for (var j = 0; !hit && j < w.crew.length; j++) { var e = w.crew[j]; if (!e.off && Math.hypot(e.x - b.x, e.y - b.y) < (e.def.vehicle ? 22 : 11)) hit = e; }
        for (j = 0; !hit && j < w.deer.length; j++) if (Math.hypot(w.deer[j].x - b.x, w.deer[j].y - b.y) < 16) hit = w.deer[j];
        for (j = 0; !hit && j < w.cats.length; j++) if (Math.hypot(w.cats[j].x - b.x, w.cats[j].y - b.y) < 10) hit = w.cats[j];
        if (!hit && w.car && Math.abs(w.car.x - b.x) < 14 && Math.abs(w.car.y - b.y) < 22) hit = 'car';
        if (!hit) continue;
        fx(w, { t: 'splat', x: b.x, y: b.y, h: b.h, hit: true });
        a.balls.splice(i, 1);
        if (hit === 'haeng') { bubble(w, H, pick(['어떤 놈이야!!', '눈덩이를 던져?!', '너 이리 와!'])); heat(w, 1, 'snowball'); H.hold = 1.5; fx(w, { t: 'wake', e: H }); }
        else if (hit === 'car') { say(w, '중대장님 차에 눈을 던져?! 거기 서!'); heat(w, 1, 'car'); }
        else if (w.deer.indexOf(hit) >= 0) shoo(w, hit, false);
        else if (w.cats.indexOf(hit) >= 0) { hit.tx = hit.x + (hit.x - P.x) * 3; hit.ty = hit.y + (hit.y - P.y) * 3; hit.wait = 4; hit.fleeT = 3; hit.follow = 0; bubble(w, hit, '캬악!!'); }
        else {
          stat(w, 'hit');
          if (hit.asleep) { hit.asleep = false; hit.sleepT = 10; stat(w, 'wake'); bubble(w, hit, '으악! 누구야!! …아 깼다'); fx(w, { t: 'wake', e: hit }); }
          else { if (!hit.def.vehicle) hit.injured = Math.max(hit.injured, 0.6); bubble(w, hit, pick(L.hit)); }
          if (!hit.def.vehicle && w.rand() < 0.45) { hit.throwT = 0.7; }
        }
      } else if (Math.hypot(P.x - b.x, P.y - b.y) < 10 && b.h < 32) {
        a.balls.splice(i, 1);
        P.stun = Math.max(P.stun, 0.35 * w.mod.stun);
        fx(w, { t: 'snowball', from: 'crew' }); fx(w, { t: 'splat', x: b.x, y: b.y, h: b.h, hit: true, me: true });
      }
    }
    w.crew.forEach(function (e) {
      if (!(e.throwT > 0)) return;
      e.throwT -= dt;
      if (e.throwT <= 0 && e.injured <= 0.3) { bubble(w, e, pick(L.throwback)); throwAt(w, e, P); }
      else if (e.throwT <= 0) e.throwT = 0.2;
    });
  }

  /* ── 족구공 ── */
  function stepBall(w, dt) {
    var B = w.act.ball, sp = Math.hypot(B.vx, B.vy);
    if (sp < 2) { B.vx = B.vy = 0; B.h = 0; return; }
    var nx = B.x + B.vx * dt, ny = B.y + B.vy * dt;
    if (G.blocked(nx, B.y, 5)) { B.vx = -B.vx * 0.6; nx = B.x; }
    if (G.blocked(B.x, ny, 5)) { B.vy = -B.vy * 0.6; ny = B.y; }
    B.x = nx; B.y = ny;
    var k = Math.exp(-1.5 * dt); B.vx *= k; B.vy *= k; B.h = Math.max(0, B.h - dt * 20);
    B.roll = (B.roll || 0) + sp * dt * 0.12;
    if (sp > 90) {
      var H = w.haeng;
      if (Math.hypot(H.x - B.x, H.y - B.y) < 10) { B.vx = -B.vx * 0.4; B.vy = -B.vy * 0.4; bubble(w, H, '누가 공을 차!!'); heat(w, 1, 'ball'); }
      w.crew.forEach(function (e) { if (!e.off && !e.def.vehicle && Math.hypot(e.x - B.x, e.y - B.y) < 9) { B.vx *= -0.5; B.vy *= -0.5; bubble(w, e, '아 누구야! …족구 한판?'); } });
    }
  }

  /* ── 행정반 임무 ── */
  function newMission(w) {
    var a = w.act, save = w.save, R = w.rand, P = w.player, pool = ['haul', 'snowman', 'flag', 'ball'];
    if (save.day >= 2 || w.deer.length) pool.push('shoo');
    if (w.cats.length) pool.push('pet');
    if (w.crew.some(function (e) { return e.def.id === 'malnyeon'; })) pool.push('wake');
    if (w.crew.some(function (e) { return !e.def.vehicle; })) pool.push('hitcrew');
    var zs = [];
    S.ZONES.forEach(function (Z, zi) { if (w.zoneOpen[zi] && w.zoneTotal[zi] && w.zoneClear[zi] / w.zoneTotal[zi] < 0.82) zs.push(zi); });
    if (zs.length) pool.push('clear', 'clear');
    pool = pool.filter(function (k) { return k !== a.lastKind; });
    var kind = pool[(R() * pool.length) | 0], m = { kind: kind, t: 150, prog: 0, goal: 1, fac: 1 };
    var base = (60 + 25 * save.day) * (1 + rank(w)) * G.incomeMult(save) + (save.crewRate || 0) * 15;
    if (kind === 'haul') { m.goal = Math.max(40, Math.round(P.cap * 1.5)); m.start = w.dumpedP; m.text = '집하장에 눈 ' + m.goal + ' 갖다 부어라'; m.t = 150; }
    else if (kind === 'snowman') { m.start = a.n.snowman; m.text = '사단장님 오신다. 눈사람 하나 만들어 놔'; m.fac = 0.9; }
    else if (kind === 'flag') { m.start = a.n.flag; m.text = '태극기에 경례하고 와라 (연병장 옆)'; m.fac = 0.4; m.t = 90; }
    else if (kind === 'ball') { a.ball = ballHome(w); m.text = '족구공을 행정반 앞까지 차서 가져와'; m.fac = 1.1; }
    else if (kind === 'shoo') { m.goal = 2; m.start = a.n.shoo; m.text = '고라니 2마리 쫓아내라'; m.fac = 1.2; if (!w.deer.some(function (d) { return !d.leaving; })) G.spawn(w, 'deer'); a.deerT = 25; }
    else if (kind === 'pet') { m.goal = 2; m.start = a.n.pet; m.text = '짬타이거 2번 쓰다듬어 줘라 (취사장 앞)'; m.fac = 0.7; }
    else if (kind === 'wake') {
      m.start = a.n.wake; m.text = '자는 말년 병장 깨워 와!'; m.fac = 0.8;
      var mn = w.crew.filter(function (e) { return e.def.id === 'malnyeon'; })[0]; if (mn) { mn.asleep = true; mn.sleepT = 40; fx(w, { t: 'zzz', e: mn }); }
    } else if (kind === 'hitcrew') { m.goal = 3; m.start = a.n.hit; m.text = '눈싸움 한 판! 인력한테 눈덩이 3번 맞혀라'; m.fac = 1; }
    else if (kind === 'clear') {
      var zi = zs[(R() * zs.length) | 0], Z = S.ZONES[zi], now = w.zoneClear[zi] / w.zoneTotal[zi];
      m.zi = zi; m.goal = Math.min(0.95, Math.round((now + 0.2) * 20) / 20); m.text = Z.name + ' ' + Math.round(m.goal * 100) + '%까지 치워라'; m.fac = 1.5; m.t = 180;
    }
    m.max = m.t; m.reward = Math.round(base * m.fac);
    a.lastKind = kind;
    return m;
  }
  function missionProg(w, m) {
    var a = w.act;
    if (m.kind === 'haul') return w.dumpedP - m.start;
    if (m.kind === 'ball') { var d = door('office'); return Math.hypot(a.ball.x - d.x, a.ball.y - d.y - 10) < 44 ? 1 : 0; }
    if (m.kind === 'clear') return w.zoneClear[m.zi] / w.zoneTotal[m.zi];
    return a.n[{ snowman: 'snowman', flag: 'flag', shoo: 'shoo', pet: 'pet', wake: 'wake', hitcrew: 'hit' }[m.kind]] - m.start;
  }
  function stepMission(w, dt) {
    var a = w.act, m = a.mission;
    a.missionCool -= dt;
    if (a.deerT > 0) { a.deerT -= dt; if (a.deerT <= 0 && m && m.kind === 'shoo' && !w.deer.some(function (d) { return !d.leaving; })) G.spawn(w, 'deer'); }
    if (!m) return;
    m.t -= dt; m.prog = missionProg(w, m);
    if (m.prog >= m.goal) {
      a.mission = null; a.missionCool = 12;
      var g = give(w, m.reward, 'mission');
      if (m.fac >= 1.1) G.gainDia(w, 1, 'mission');
      fx(w, { t: 'mission', state: 'done', m: m, pay: g }); say(w, pick(['임무 완수! 쓸 만하군.', '잘했다. 초코파이 받아라.', '오, 빠른데?']) + ' +' + g);
      w.save.stats.missions = (w.save.stats.missions || 0) + 1;
    } else if (m.t <= 0) {
      a.mission = null; a.missionCool = 12;
      fx(w, { t: 'mission', state: 'fail', m: m }); say(w, '그것도 못 하나? …됐다. 눈이나 치워.');
    }
  }

  /* ── 행보관 분노 (★) ── */
  function stepHeat(w, dt) {
    var a = w.act, H = w.haeng, P = w.player, save = w.save;
    if (a.heat <= 0) { if (H.chasing) { H.chasing = false; H.speed = 40; H.wait = 0; } return; }
    H.chasing = true; H.speed = 60 + a.heat * 5; H.tx = P.x; H.ty = P.y; H.wait = 1;
    var d = dist(H, P);
    a.shoutT -= dt;
    if (a.shoutT <= 0) { a.shoutT = 4; bubble(w, H, pick(L.chase)); }
    if (d < 13 && !(H.hold > 0) && !a.ride) {
      var fine = Math.round(Math.min(save.bank * 0.08, (40 + 20 * save.day) * a.heat * (1 + rank(w))));
      if (!w.demo) save.bank = Math.max(0, save.bank - fine);
      P.stun = 3.2; H.hold = 3.4; a.heat = 0; a.heatT = 0;
      var ux = (H.x - P.x) / (d || 1), uy = (H.y - P.y) / (d || 1); if (!G.blocked(P.x + ux * 20, P.y + uy * 20, 6)) { H.x = P.x + ux * 20; H.y = P.y + uy * 20; }
      if (a.ride) endRide(w, true);
      fx(w, { t: 'caught', fine: fine }); fx(w, { t: 'heat', heat: 0, why: 'caught' }); say(w, '엎드려 뻗쳐!!! …초코파이 ' + fine + '개 압수다.');
      stat(w, 'caught');
      return;
    }
    if (d > 200) { a.heatT += dt; if (a.heatT > 14) { a.heatT = 0; a.heat--; fx(w, { t: 'heat', heat: a.heat, why: 'lost' }); if (!a.heat) say(w, '…어디 갔어. 다음에 걸리면 죽었다.'); } }
    else a.heatT = Math.max(0, a.heatT - dt * 0.5);
  }

  /* ── 매 틱 ── */
  function step(w, dt, input) {
    var a = init(w), P = w.player;
    Object.keys(a.buffs).forEach(function (k) { a.buffs[k] -= dt; if (a.buffs[k] <= 0) { delete a.buffs[k]; fx(w, { t: 'buffEnd', id: k, name: BUFF[k].name }); } });
    Object.keys(a.cool).forEach(function (k) { a.cool[k] -= dt; });
    a.ballCd -= dt;
    w.crew.forEach(function (e) { if (e.naggedT > 0) e.naggedT -= dt; if (e.rideCd > 0) e.rideCd -= dt; });
    if (a.ride) {
      a.ride.t -= dt;
      if (a.ride.kind === 'car') {
        w.deer.forEach(function (d) { if (!d.leaving && dist(d, P) < 22) shoo(w, d, true); });
        w.crew.forEach(function (e) { if (!e.off && !e.def.vehicle && e.injured <= 0 && dist(e, P) < 14) { e.injured = 1; e.x += (e.x - P.x) * 0.8; e.y += (e.y - P.y) * 0.8; if (G.blocked(e.x, e.y, 6)) { e.x = P.x; e.y = P.y; } bubble(w, e, '으악! 비켜요!!'); } });
      }
      if (a.ride.t <= 0) endRide(w, false);
    }
    // 짬 준 고양이는 따라온다
    w.cats.forEach(function (c) { if (c.follow > 0) { c.follow -= dt; c.tx = P.x - P.dir.x * 16; c.ty = P.y - P.dir.y * 16; c.wait = 1; } });
    // 고라니가 눈사람을 박살 낸다
    var sm = w.save.snowmen;
    for (var i = sm.length - 1; i >= 0; i--) {
      for (var j = 0; j < w.deer.length; j++) if (Math.hypot(w.deer[j].x - sm[i].x, w.deer[j].y - sm[i].y) < 12) {
        fx(w, { t: 'smash', x: sm[i].x, y: sm[i].y, deer: true }); sm.splice(i, 1); say(w, '고라니가 눈사람을 박살 냈다!!'); break;
      }
    }
    stepBalls(w, dt); stepBall(w, dt); stepMission(w, dt); stepHeat(w, dt); stepOfficers(w, dt); stepReqs(w, dt);
    a.metaT = (a.metaT || 0) - dt;
    if (a.metaT <= 0 && JY.SnowMeta) { a.metaT = 1; JY.SnowMeta.check(w); }
    applyStats(w);
  }

  /* ── v7: 손에 든 물건 · 심부름 · 신병 인솔 · 따라와/여기 배치 ── */
  function reqOf(a, who) { for (var i = 0; i < a.reqs.length; i++) if (a.reqs[i].who === who) return a.reqs[i]; return null; }
  function snackCost(w) { return Math.round(15 * (1 + rank(w)) * (1 + w.save.day * 0.08)); }
  function hold(w, item) { var a = w.act; a.hand = item; a.pickCd = 1; fx(w, { t: 'hand', item: item, name: item ? ITEM[item].name : '' }); }
  function favorDone(w, q, e) {
    var a = w.act, save = w.save; a.reqs.splice(a.reqs.indexOf(q), 1);
    var g = give(w, (30 + 15 * save.day) * (1 + rank(w)) * w.mult, 'favor'); stat(w, 'favor');
    if (w.rand() < 0.25) G.gainDia(w, 1, 'favor');
    fx(w, { t: 'req', state: 'done', item: q.item, who: e === w.haeng ? '행보관' : e.def.name, pay: g });
    return g;
  }
  function actV7(w, t, alt) {
    var a = w.act, P = w.player, save = w.save, hand = a.hand, e = t.ref, q, zid;
    // 두 번째 행동
    if (alt) {
      if ((t.k === 'crew' || t.k === 'plow') && e && e.state !== 'follow') { e.state = 'follow'; e.tidx = -1; me(w, '야, 따라와.'); bubble(w, e, e.def.vehicle ? '어디로 모실까요?' : pick(['넵! 어디로 갑니까?', '또 어디 가요…', '넵!'])); return { ok: true }; }
      if (t.k === 'mess' && !hand) { hold(w, 'meal'); bubble(w, door('mess'), '취사병: 흘리지 마라.'); return { ok: true }; }
      if (t.k === 'px' && !hand) { var sc = snackCost(w); if (save.bank < sc) return { ok: false, why: 'money' }; save.bank -= sc; hold(w, 'snack'); me(w, '맛스타랑 냉동 하나요.'); return { ok: true }; }
      if (t.k === 'guard' && !hand) { hold(w, 'letter'); bubble(w, door('guard'), '위병: 이거 너네 후임 거다.'); return { ok: true }; }
      return { ok: false };
    }
    // 신병 인솔 · 배치
    if (t.k === 'recruit') {
      if (e.state === 'wait') { e.state = 'follow'; stat(w, 'escort'); me(w, '신병! 따라와라.'); bubble(w, e, pick(['이병 ' + e.def.name + '! 잘 부탁드립니다!', '넵!! (얼어 있다)', '여, 여기가 제설장입니까?'])); return { ok: true }; }
      zid = G.zoneAt(w, P.x, P.y);
      if (!zid) { bubble(w, e, '어디로 갑니까…?'); return { ok: false, why: 'zone' }; }
      var ne = G.assignRecruit(w, e, zid.id);
      if (ne) { me(w, zid.name + ' 여기 맡아라. 초코파이 값은 해라.'); bubble(w, ne, pick(['넵! 열심히 하겠습니다!', '여기를 제가요?! …넵!'])); stat(w, 'assign'); }
      return { ok: !!ne };
    }
    if ((t.k === 'crew' || t.k === 'plow') && e && e.state === 'follow') {
      zid = G.zoneAt(w, P.x, P.y);
      if (!zid) { bubble(w, e, '여기는 구역 밖인데요?'); return { ok: false, why: 'zone' }; }
      G.setPost(w, e, zid.id); me(w, '여기 치워라.'); bubble(w, e, zid.name + ', 알겠습니다!'); fx(w, { t: 'assigned', e: e, zone: zid.id, moved: true });
      return { ok: true };
    }
    // 물건 받기
    if (t.k === 'garage' && !hand) { hold(w, 'fuel'); bubble(w, door('garage'), '정비병: 쏟지 마라. 비싸다.'); return { ok: true }; }
    if (t.k === 'mess' && !hand && save.daily.mess === save.day) { hold(w, 'meal'); bubble(w, door('mess'), '취사병: 흘리지 마라.'); return { ok: true }; }
    if (t.k === 'guard' && !hand && save.daily.gate === save.day && a.reqs.some(function (x) { return x.item === 'letter'; })) { hold(w, 'letter'); return { ok: true }; }
    if (!hand) return null;
    // 건네주기
    if (t.k === 'crew') {
      q = reqOf(a, e);
      if (q && q.item === hand) {
        hold(w, null); e.mor = Math.min(100, e.mor + 50); e.slack = false; bubble(w, e, pick(REQ[q.item].thanks)); me(w, '옛다, 부탁한 거.');
        return { ok: true, pay: favorDone(w, q, e) };
      }
      if (hand === 'meal' || hand === 'snack' || hand === 'letter') {
        hold(w, null); e.mor = Math.min(100, e.mor + (hand === 'letter' ? 50 : 35)); e.slack = false;
        bubble(w, e, hand === 'letter' ? '저한테요?! …감사합니다!!' : pick(L.choco)); me(w, '먹고 해라.'); stat(w, 'share');
        return { ok: true };
      }
      return null;
    }
    if (t.k === 'plow' && hand === 'fuel') {
      hold(w, null); e.noFuel = false; e.boost = 60; e.mor = Math.min(100, e.mor + 40); bubble(w, e, pick(REQ.fuel.thanks)); me(w, '기름 가득!');
      q = reqOf(a, e); if (q) favorDone(w, q, e); else stat(w, 'favor');
      return { ok: true };
    }
    if (t.k === 'tractor' && hand === 'fuel' && save.daily.tractor === save.day) { hold(w, null); save.daily.tractor = 0; bubble(w, TRACTOR, '정비병: 기름 넣었으면 또 타도 된다.'); return { ok: true }; }
    if (t.k === 'cat' && hand === 'meal') { hold(w, null); a.scrap = true; return null; }   // 짬 주기 → 아래 고양이 처리
    if (t.k === 'haeng' && hand === 'snack') {
      hold(w, null); var H = w.haeng; H.hold = 2; q = reqOf(a, H);
      me(w, '행보관님, 이거 드십시오!'); bubble(w, H, q ? '오, 기억했구나. 기특하네.' : '…뇌물이냐? 고맙다.');
      buff(w, 'praise', 90); if (a.heat) { a.heat = 0; fx(w, { t: 'heat', heat: 0, why: 'forgive' }); }
      if (q) { favorDone(w, q, H); G.gainDia(w, 1, 'favor'); }
      return { ok: true };
    }
    return null;
  }
  function stepReqs(w, dt) {
    var a = w.act, R = w.rand;
    a.pickCd -= dt;
    // 제설차는 가끔 기름이 떨어진다 → 기름통 가져다줘야 다시 움직인다
    a.fuelT -= dt;
    if (a.fuelT <= 0) {
      a.fuelT = 90 + R() * 60;
      var pl = w.crew.filter(function (e) { return e.def.vehicle && !e.off && !e.noFuel && !reqOf(a, e); })[0];
      if (pl) { pl.noFuel = true; a.reqs.push({ who: pl, item: 'fuel', t: 120, max: 120 }); bubble(w, pl, pick(REQ.fuel.ask)); fx(w, { t: 'req', state: 'new', item: 'fuel', who: '제설차', where: ITEM.fuel.from }); }
    }
    a.reqT -= dt;
    if (a.reqT <= 0) {
      a.reqT = 35 + R() * 30;
      if (a.reqs.length < 2) {
        var pool = w.crew.filter(function (e) { return !e.def.vehicle && !e.off && !e.slack && e.state !== 'follow' && !reqOf(a, e); });
        var who = !reqOf(a, w.haeng) && (R() < 0.18 || !pool.length) && w.save.day >= 2 ? w.haeng : pool[(R() * pool.length) | 0];
        if (who) {
          var item = who === w.haeng ? 'snack' : ['meal', 'snack', 'letter'][(R() * 3) | 0];
          a.reqs.push({ who: who, item: item, t: 100, max: 100 });
          bubble(w, who, who === w.haeng ? '야, PX 가서 냉동 하나 사 와라.' : pick(REQ[item].ask));
          fx(w, { t: 'req', state: 'new', item: item, who: who === w.haeng ? '행보관' : who.def.name, where: ITEM[item].from });
        }
      }
    }
    for (var i = a.reqs.length - 1; i >= 0; i--) {
      var q = a.reqs[i]; q.t -= dt;
      if (q.who !== w.haeng && w.crew.indexOf(q.who) < 0) { a.reqs.splice(i, 1); continue; }
      if (q.t > 0) continue;
      a.reqs.splice(i, 1);
      if (q.item === 'fuel') { q.who.noFuel = false; bubble(w, q.who, '…결국 제가 다녀왔습니다.'); }
      else if (q.who === w.haeng) bubble(w, q.who, '됐다. 내가 갔다 왔다.');
      else { q.who.mor = Math.max(0, q.who.mor - 15); bubble(w, q.who, '됐어요… 기대도 안 했어요'); }
      fx(w, { t: 'req', state: 'fail', item: q.item, who: q.who === w.haeng ? '행보관' : q.who.def.name });
    }
  }

  function chocoCost(w) { return Math.round(8 * (1 + rank(w)) * (1 + w.save.day * 0.1)); }

  /* ── 간부 순찰 ── */
  function planOfficers(w) {
    var a = w.act, save = w.save, R = G.mulberry(save.seed * 7 + save.day * 131), plan = [];
    a.offDay = save.day; a.off = [];
    plan.push({ t: 20 + R() * 40, id: 'lt' });
    if (save.day >= 2) plan.push({ t: 70 + R() * 60, id: 'cpt' });
    if (w.inspect) plan.push({ t: 35 + R() * 20, id: 'gen' });
    a.offPlan = plan.filter(function (p) { return p.t > w.time; });
  }
  function spawnOfficer(w, id) {
    var a = w.act, P = w.player, home = id === 'gen' ? { x: 400, y: 1190 } : (function () { var d = door('office'); return { x: d.x, y: d.y + 8 }; })();
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
      // 다가오면 3초 안에 경례
      if (!o.saluted && !o.missed && o.phase !== 'go' && d < 55) {
        if (!o.warned) { o.warned = true; bubble(w, o, pick(L.offNear[o.id])); fx(w, { t: 'officer', state: 'near', id: o.id, title: def.title, o: o }); }
        o.salT += dt;
        if (o.salT > 3.5) {
          o.missed = true; bubble(w, o, pick(L.offMiss[o.id])); fx(w, { t: 'officer', state: 'miss', id: o.id, title: def.title });
          if (o.id === 'cpt') heat(w, 1, 'nosalute'); else if (o.id === 'gen') heat(w, 2, 'nosalute');
        }
      }
    }
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
      o.done.report = true; var pc = G.pct(w), res;
      me(w, def.title + '! 제설 작업 ' + Math.round(pc * 100) + '% 진행 중입니다!');
      if (pc >= 0.9) {
        res = 'good'; var g = give(w, base * (o.id === 'gen' ? 4 : 2), 'report'); G.gainDia(w, o.id === 'gen' ? 3 : 1, 'report'); stat(w, 'goodReport');
        if (o.id === 'gen') save.boxes.push('rare');
        bubble(w, o, o.id === 'gen' ? '훌륭하다! 이 부대 포상이다!!' : '아주 좋아! 다들 고생했다!'); fx(w, { t: 'officer', state: 'report', res: res, id: o.id, title: def.title, pie: g });
      } else if (pc >= 0.6) {
        res = 'ok'; var g2 = give(w, base * 0.6, 'report');
        bubble(w, o, '수고한다. 조금만 더 하자.'); fx(w, { t: 'officer', state: 'report', res: res, id: o.id, title: def.title, pie: g2 });
      } else {
        res = 'bad'; w.crew.forEach(function (c) { c.mor = Math.max(0, c.mor - 10); });
        bubble(w, o, '이게 다 한 거야?! 정신 안 차려?!'); if (o.id === 'gen') heat(w, 1, 'report');
        fx(w, { t: 'officer', state: 'report', res: res, id: o.id, title: def.title });
      }
      return { ok: true, res: res };
    }
    me(w, '충성!'); fx(w, { t: 'salute' }); bubble(w, o, '그래 그래, 일 봐라.');
    return { ok: true };
  }

  /* ── 다이아 쓰기 ── */
  function useDia(w, what) {
    init(w);
    var save = w.save, cost = S.DIA[what];
    if (typeof cost !== 'number' || save.dia < cost) return { ok: false };
    if (what === 'morale' && !w.crew.length) return { ok: false, why: 'crew' };
    save.dia -= cost;
    if (what === 'support') { buff(w, 'support', 60); say(w, '대대에서 지원 왔다! 인력 전원 두 배로 움직여!'); }
    else if (what === 'morale') { w.crew.forEach(function (c) { c.mor = 100; c.slack = false; }); say(w, '전원 초코파이 지급! 사기 충전 완료!'); fx(w, { t: 'choco', all: true }); }
    return { ok: true, cost: cost };
  }

  /* ── PX ── */
  function pxItems(w) {
    init(w);
    var save = w.save, r = rank(w);
    return PX.map(function (it) {
      var cost = Math.round(it.base * (1 + r * 1.5) + (it.crew ? (save.crewRate || 0) * 12 : 0));
      var need = it.crew && !w.crew.length ? '인력이 없다' : it.id === 'gong' && !w.deer.length ? '고라니가 없다' : '';
      return { id: it.id, name: it.name, desc: it.desc, cost: cost, need: need, ok: !need && save.bank >= cost, on: (w.act.buffs[it.id] || 0) > 0 };
    });
  }
  function pxBuy(w, id) {
    var it = pxItems(w).filter(function (x) { return x.id === id; })[0], def = PX.filter(function (x) { return x.id === id; })[0];
    if (!it || !it.ok) return { ok: false };
    w.save.bank -= it.cost; stat(w, 'px');
    if (id === 'gong') { w.deer.forEach(function (d) { if (!d.leaving) shoo(w, d, false); }); fx(w, { t: 'gong' }); say(w, '꽹과리 소리에 고라니가 줄행랑친다!'); }
    else buff(w, id, def.sec);
    if (id === 'choco') w.crew.forEach(function (c) { c.mor = Math.min(100, c.mor + 50); c.slack = false; });
    return { ok: true, cost: it.cost, item: it };
  }

  function state(w) {
    var a = init(w), list = [];
    Object.keys(a.buffs).forEach(function (k) { list.push({ id: k, name: BUFF[k].name, desc: BUFF[k].desc, t: a.buffs[k] }); });
    var urgent = (a.off || []).filter(function (o) { return !o.saluted && !o.missed && o.warned; })[0];
    var mor = w.crew.length ? w.crew.reduce(function (q, e) { return q + e.mor; }, 0) / w.crew.length : 0, slack = w.crew.filter(function (e) { return e.slack; }).length;
    var reqs = a.reqs.map(function (q) { return { who: q.who === w.haeng ? '행보관' : q.who.def.name, item: q.item, want: ITEM[q.item].want, from: ITEM[q.item].from, t: q.t, max: q.max, ref: q.who }; });
    return { hand: a.hand ? { id: a.hand, name: ITEM[a.hand].name } : null, reqs: reqs, recruits: (w.recruits || []).length, heat: a.heat, buffs: list, mission: a.mission, salute: urgent ? { title: OFF[urgent.id].title, left: Math.max(0, 3.5 - urgent.salT) } : null, mor: mor, slack: slack, ride: a.ride ? { kind: a.ride.kind, name: RIDE[a.ride.kind].name, t: a.ride.t, max: a.ride.max } : null };
  }

  JY.SnowAct = {
    init: init, step: step, candidates: candidates, best: best, act: act, throwBall: throwBall, canThrow: canThrow, canBuild: canBuild,
    pxItems: pxItems, pxBuy: pxBuy, drop: function (w) { init(w); if (w.act.hand) { me(w, '(' + ITEM[w.act.hand].name + '을/를 내려놨다)'); hold(w, null); return true; } return false; }, ITEM: ITEM, state: state, newMission: newMission, applyStats: applyStats, endRide: endRide, useDia: useDia, spawnOfficer: spawnOfficer, OFF: OFF, chocoCost: chocoCost,
    RIDE: RIDE, BUFF: BUFF, PX: PX, TRACTOR: TRACTOR, FLAG: FLAG, DECOR_MAN: DECOR_MAN, SNOWMAN_COST: SNOWMAN_COST, door: door
  };
})(window.JY = window.JY || {});
