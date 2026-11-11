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
    cat: { name: '고양이 힐링', desc: '덜 넘어진다' }
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
      ball: null, scrap: false, deerT: 0, n: { shoo: 0, pet: 0, hit: 0, wake: 0, flag: 0, snowman: 0 } };
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
    var H = w.haeng;
    add('haeng', H, H.x, H.y, 36, '행보관', a.heat > 0 ? '경례로 무마' : '경례');
    w.crew.forEach(function (e) {
      if (e.off) return;
      var C = e.def;
      if (C.vehicle) { add('plow', e, e.x, e.y, 40, '제설차 (운전병)', '운전 교대'); return; }
      var verb = e.asleep ? '깨우기' : e.injured > 0.8 ? '부축하기' : P.load >= 10 && e.cap - e.load >= 5 ? '짐 떠넘기기' : '갈구기';
      add('crew', e, e.x, e.y, 36, C.name, verb);
    });
    if (w.car) add('car', w.car, w.car.x, w.car.y, 42, '중대장님 차', '탈취하기');
    add('tractor', TRACTOR, TRACTOR.x, TRACTOR.y, 40, '정비고 트랙터', rank(w) < 1 ? '몰기 (일병부터)' : save.daily.tractor === save.day ? '몰기 (기름 없음)' : '몰기');
    w.deer.forEach(function (d) { if (!d.leaving) add('deer', d, d.x, d.y, 42, '고라니', '쫓아내기'); });
    w.cats.forEach(function (c) { add('cat', c, c.x, c.y, 30, '짬타이거', a.scrap ? '짬 주기' : '쓰다듬기'); });
    var dB = door('barracks'), late = w.time >= w.dayLen * 0.45;
    add('barracks', null, dB.x, dB.y, 34, '생활관', a.heat > 0 ? '숨기' : late ? '취침 (다음 날로)' : '들어가기');
    var dO = door('office'); add('office', null, dO.x, dO.y, 34, '행정반', a.mission ? '임무 확인' : '임무 받기');
    var dP = door('px'); add('px', null, dP.x, dP.y, 34, 'PX', '들어가기');
    var dM = door('mess'); add('mess', null, dM.x, dM.y, 34, '취사장', save.daily.mess === save.day ? '배식 끝' : '짬밥 먹기');
    var dG = door('garage'); add('garage', null, dG.x, dG.y, 30, '정비고', '기웃거리기');
    var dW = door('guard'); add('guard', null, dW.x, dW.y, 34, '위병소', save.daily.gate === save.day ? '면회 (내일)' : '면회 확인');
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
      if (fp && cos < 0.25 && d > 9 && c.k !== 'exit') return;
      var s = c.k === 'exit' ? -1 : d * (1.6 - cos);
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
  function act(w, t, look) {
    var a = init(w), P = w.player, save = w.save, H = w.haeng, R = w.rand, e, r;
    if (!t) return { ok: false };
    look = look || P.dir;
    if (P.stun > 0.3 && t.k !== 'exit') return { ok: false, why: 'stun' };
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
        if (e.injured > 0.8) { e.injured *= 0.35; bubble(w, e, pick(L.help)); me(w, '괜찮으십니까?'); return { ok: true }; }
        if (P.load >= 10 && e.cap - e.load >= 5) {
          var n = Math.min(P.load, e.cap - e.load), v = P.val * n / P.load;
          e.load += n; e.val += v; P.load -= n; P.val -= v; e.state = 'haul';
          me(w, '이것 좀 갖다 놔.'); bubble(w, e, pick(L.hand)); stat(w, 'hand');
          return { ok: true, moved: n };
        }
        if (e.naggedT > 0) { bubble(w, e, pick(L.nagAgain)); return { ok: true }; }
        e.boost = 20; e.naggedT = 25; me(w, pick(L.nag)); bubble(w, e, pick(L.nagReply)); stat(w, 'nag');
        return { ok: true };
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
      case 'garage': me(w, pick(L.gag.garage)); return { ok: true };
      case 'guard':
        if (save.daily.gate === save.day) { bubble(w, door('guard'), '위병: 오늘 면회는 끝났다.'); return { ok: false }; }
        save.daily.gate = save.day;
        r = R();
        if (r < 0.4) { buff(w, 'chicken', 90); say(w, '면회: 어머니가 치킨을 보내셨다! 후임들 눈이 반짝인다.'); fx(w, { t: 'gift', kind: 'chicken' }); }
        else if (r < 0.7) { var g = give(w, (50 + save.day * 15) * (1 + rank(w)) * w.mult, 'gift'); say(w, '편지가 왔다. "보고 싶어" …초코파이도 같이 왔다! +' + g); fx(w, { t: 'gift', kind: 'letter', pay: g }); }
        else { me(w, '…아무도 안 왔다.'); bubble(w, door('guard'), '위병: 눈이나 치워라.'); fx(w, { t: 'gift', kind: 'none' }); }
        return { ok: true };
      case 'stand':
        me(w, '제설 작전 개시!!');
        if (!w.crew.length) { bubble(w, t, '(아무도 없다. 메아리만 돌아온다)'); return { ok: true }; }
        if (a.cool.stand > 0) { bubble(w, w.crew[0], '아까 했잖아요…'); return { ok: true }; }
        a.cool.stand = 90; buff(w, 'rally', 30);
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
    P.r = rd ? (rd.noClear ? T.r : Math.max(T.r, rd.r)) : T.r;
    P.p = rd && !rd.noClear ? Math.max(T.p, rd.p) : T.p;
    P.aura = rd ? false : !!T.aura;
    P.noClear = !!(rd && rd.noClear);
    P.cap = rd && rd.cap ? Math.max(base, rd.cap) : base;
    var m = w.mod;
    m.speed = (b.matsta > 0 ? 1.25 : 1) * (rd ? rd.speed : 1);
    m.hit = b.hotbar > 0 ? 0.7 : 1;
    m.crew = (b.choco > 0 ? 1.4 : 1) * (b.chicken > 0 ? 1.5 : 1) * (b.rally > 0 ? 1.25 : 1);
    m.stun = b.cat > 0 || b.hotpack > 0 ? 0.5 : 1;
    w.mult = G.incomeMult(save) * (1 + 0.01 * Math.min(SNOWMAN_MAX, save.snowmen.length)) * (b.praise > 0 ? 1.2 : 1);
  }

  /* ── 눈덩이 ── */
  function canThrow(w) {
    var a = init(w), P = w.player;
    if (a.ride || a.ballCd > 0 || P.stun > 0) return false;
    if (P.load >= 1) return true;
    // 발밑이나 바로 옆(두 칸 안)에 눈이 있으면 뭉칠 수 있다. 구역 밖은 늘 눈밭
    for (var dy = -20; dy <= 20; dy += S.CELL) for (var dx = -20; dx <= 20; dx += S.CELL) {
      var idx = G.cellIndex(P.x + dx, P.y + dy);
      if (idx < 0 || w.zone[idx] < 0 || w.depth[idx] > 0 || !w.zoneOpen[w.zone[idx]]) return true;
    }
    return false;
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
    stepBalls(w, dt); stepBall(w, dt); stepMission(w, dt); stepHeat(w, dt);
    applyStats(w);
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
    return { ok: true, cost: it.cost, item: it };
  }

  function state(w) {
    var a = init(w), list = [];
    Object.keys(a.buffs).forEach(function (k) { list.push({ id: k, name: BUFF[k].name, desc: BUFF[k].desc, t: a.buffs[k] }); });
    return { heat: a.heat, buffs: list, mission: a.mission, ride: a.ride ? { kind: a.ride.kind, name: RIDE[a.ride.kind].name, t: a.ride.t, max: a.ride.max } : null };
  }

  JY.SnowAct = {
    init: init, step: step, candidates: candidates, best: best, act: act, throwBall: throwBall, canThrow: canThrow, canBuild: canBuild,
    pxItems: pxItems, pxBuy: pxBuy, state: state, newMission: newMission, applyStats: applyStats, endRide: endRide,
    RIDE: RIDE, BUFF: BUFF, PX: PX, TRACTOR: TRACTOR, FLAG: FLAG, DECOR_MAN: DECOR_MAN, SNOWMAN_COST: SNOWMAN_COST, door: door
  };
})(window.JY = window.JY || {});
