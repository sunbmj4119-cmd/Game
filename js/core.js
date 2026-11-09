/* 전역각 — 게임 규칙 엔진 (DOM 없음: 브라우저와 Node 시뮬레이션 공용) */
(function (JY) {
  'use strict';

  var DAY = 86400000;
  var STATS = ['hp', 'mt', 'tr', 'bd'];
  var STAT_NAMES = { hp: '체력', mt: '멘탈', tr: '간부 신뢰', bd: '전우애' };
  var RANKS = ['훈련병', '이병', '일병', '상병', '병장'];
  // 2026년 병 봉급(기본급) — 이병 75만 / 일병 90만 / 상병 120만 / 병장 150만
  var PAY = [750000, 750000, 900000, 1200000, 1500000];
  var SAVE_MONTHLY = 550000; // 장병내일준비적금 월 최대 납입액, 전역 시 1:1 매칭
  var TRAIN_DAYS = 35; // 육군훈련소 5주
  var LEAVE_ON_PROMO = [0, 4, 8, 8, 8]; // 이병(신병위로) 4 + 연가 24일을 진급마다 나눠 지급
  var LEAVE_GAP = 20; // 휴가 사이 최소 간격(일)
  var LEAVE_MAX = 15; // 한 번에 쓸 수 있는 최대 휴가
  var EMER_BASE = 0.08; // 카드마다 돌발 상황이 터질 기본 확률
  var COND_CHANCE = 0.4; // 매달 1일 주간 상황이 시작될 확률
  var BFF = 70; // 절친 기준 호감도
  // 복무 방식별 흔들림: 카드가 적은 속성 복무는 한 장 한 장이 더 크게, 긴 정상 복무는 덜 크게
  // (tools/retention-sim.js로 초보 첫 판 전역률이 두 방식 모두 비슷해지도록 맞춘 값)
  var PACE_SWING = { 1: 0.72, 3: 1.3 };

  var MOS = {
    infantry: { name: '소총수', emoji: '🎯', start: { hp: 58, mt: 50, tr: 45, bd: 50 }, boost: null,
      perk: '사격이 쉽고, 포상휴가를 1.5배로 받는다.', desc: '보병의 기본. 훈련도 근무도 제일 많다.' },
    cook: { name: '취사병', emoji: '🍳', start: { hp: 55, mt: 50, tr: 45, bd: 55 }, boost: 'bd',
      perk: '전우애가 오를 때 25% 더 오른다.', desc: '새벽 4시 기상. 대신 모두가 너를 사랑한다.' },
    clerk: { name: '행정병', emoji: '📋', start: { hp: 60, mt: 45, tr: 52, bd: 45 }, boost: 'tr',
      perk: '간부 신뢰가 오를 때 25% 더 오른다.', desc: '엑셀과 한글의 지배자. 야근은 덤.' },
    driver: { name: '운전병', emoji: '🚚', start: { hp: 55, mt: 55, tr: 48, bd: 45 }, boost: 'mt',
      perk: '멘탈이 오를 때 25% 더 오른다.', desc: '간부들의 발. 라디오 선곡이 생존 기술.' },
    medic: { name: '의무병', emoji: '💊', start: { hp: 60, mt: 50, tr: 48, bd: 45 }, boost: 'hp',
      perk: '체력이 오를 때 25% 더 오른다.', desc: '타이레놀 수호자. 꾀병 감별사.' }
  };

  var MINI = {
    dressup: { name: '비상 소집', great: { fx: { tr: 12, mt: 3 }, say: '1등으로 집결 완료! 당직사관이 놀랐다.' },
      good: { fx: { tr: 4 }, say: '무난하게 집결했다. 양말 짝은 안 맞는다.' },
      bad: { fx: { tr: -12, mt: -5 }, say: '방탄모를 거꾸로 쓰고 꼴찌로 나갔다…' } },
    snow: { name: '제설 작업', great: { fx: { tr: 10, hp: -6 }, say: '연병장이 깨끗하다! 행보관이 엄지를 들었다.' },
      good: { fx: { hp: -8, tr: 3 }, say: '얼추 치웠다. 허리가 끊어질 것 같다.' },
      bad: { fx: { tr: -10, hp: -10 }, say: '치운 자리에 다시 눈이 쌓였다. 행보관 한숨.' } },
    watch: { name: '불침번', great: { fx: { tr: 6, hp: -3 }, say: '완벽한 불침번! 당직사관이 칭찬했다.' },
      good: { fx: { hp: -5 }, say: '졸 뻔했지만 버텼다.' },
      bad: { fx: { tr: -15, hp: 2 }, say: '서서 코를 골다가 당직사관에게 걸렸다.' } },
    shoot: { name: '사격', great: { fx: { tr: 10, mt: 8 }, leave: 3, set: ['sharp'], say: '특등사수!! 포상휴가 3일!' },
      good: { fx: { tr: 3, mt: 2 }, say: '합격. 무난한 사수다.' },
      bad: { fx: { tr: -8, mt: -6 }, say: '불합격… 재사격 명단에 올랐다.' } },
    shell: { name: '탄피 찾기', great: { fx: { bd: 10, tr: 5 }, say: '탄피 발견! 중대의 영웅이 되었다.' },
      good: { fx: { hp: -5, bd: 3 }, say: '겨우 찾았다. 모두 녹초가 됐다.' },
      bad: { fx: { hp: -10, mt: -10, bd: -8 }, say: '못 찾았다. 전 중대가 밤새 수색했다…' } },
    memory: { name: '선임 이름 외우기', great: { fx: { bd: 12, tr: 3 }, say: '선임 이름 올킬! 왕고가 감탄했다.' },
      good: { fx: { bd: 4 }, say: '몇 명 헷갈렸지만 무난했다.' },
      bad: { fx: { bd: -10, mt: -5 }, say: '분대장을 "정뺀질 상병님"이라 불렀다. 정적.' } }
  };

  // 특별 카드 (시스템이 직접 넣는 카드)
  function o(t, fx, say, x) { var r = { t: t, fx: fx || {}, say: say || '' }; if (x) for (var k in x) r[k] = x[k]; return r; }
  var SPECIAL = [
    {
      id: 'shell_lost', who: 'fm', bg: 'training', days: 1, repeat: true, cd: 0,
      text: '사격 후 탄피 회수. 한 개가 부족하다! 전 중대가 사로에 엎드렸다.',
      l: o('내가 찾는다!', {}, '', { mini: 'shell' }),
      r: o('조용히 기도한다', {}, '', {
        roll: [
          { p: 0.5, fx: { mt: 3, bd: -3 }, say: '박덤벙이 찾았다. 탄피는 박덤벙 전투화 끈에 걸려 있었다.' },
          { p: 0.5, fx: { hp: -10, mt: -8 }, say: '해가 질 때까지 수색. 결국 탄피받이 안에 있었다.' }
        ]
      })
    },
    {
      id: 'quiet', who: 'me', bg: 'barracks', repeat: true, cd: 0,
      text: '아무 일도 없는 평범한 하루. 군대에서는 이게 제일 좋은 날이다.',
      l: o('누워서 쉰다', { hp: 4, tr: -2 }, '천장의 얼룩 개수를 셌다. 37개.'),
      r: o('운동한다', { hp: 3, mt: -2 }, '팔굽혀펴기 50개. 내일은 근육통.')
    }
  ];

  /* ── 날짜 ───────────────────────────────── */
  function parseDate(s) {
    var p = String(s).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function ymd(ms) {
    var d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(ms) { var x = ymd(ms); return x.y + '.' + pad(x.m) + '.' + pad(x.d); }
  function addMonths(ms, n) { var d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()); }
  function firstOfMonthOffset(startMs, k) {
    var d = new Date(startMs);
    return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1) - startMs) / DAY);
  }
  function seasonOf(m) { return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'; }
  var SEASON_NAMES = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
  var SEASON_MSG = {
    spring: '봄이 왔다. 진지공사와 꽃가루의 계절.',
    summer: '여름이다. 유격, 장마, 그리고 모기.',
    autumn: '가을이다. 낙엽은 군인의 적이다.',
    winter: '겨울이 왔다. 하늘에서 쓰레기(눈)가 내린다.'
  };

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ── 난수: 오늘의 작전은 시드 고정 ─────────── */
  var CUR = null;
  function rand() {
    if (CUR && typeof CUR.rng === 'number') {
      CUR.rng = (CUR.rng + 0x6D2B79F5) | 0;
      var t = Math.imul(CUR.rng ^ (CUR.rng >>> 15), 1 | CUR.rng);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return (JY.rand || Math.random)();
  }
  function randInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function asArr(x) { return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]; }
  function seedFrom(str) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }

  /* 밸런스 조정표: 카드에 적힌 수치를 불러올 때 한 번 보정한다.
   * 카드 전체 평균이 체력·멘탈은 살짝 마이너스(시간이 갈수록 지친다 → 아이템·휴가로 회복),
   * 신뢰·전우애는 0 근처가 되도록 맞춘 값. tools/simulate.js로 검증. */
  var BALANCE = {
    pos: { hp: 1.0, mt: 0.62, tr: 0.8, bd: 0.55 },
    neg: { hp: 0.72, mt: 1.3, tr: 1.15, bd: 1.6 }
  };
  function tuneFx(fx) {
    if (!fx) return;
    for (var k in fx) {
      var v = fx[k];
      if (!v || !BALANCE.pos[k]) continue;
      var t = Math.round(v * (v > 0 ? BALANCE.pos[k] : BALANCE.neg[k]));
      fx[k] = t === 0 ? (v > 0 ? 1 : -1) : t;
    }
  }
  function tuneOpt(op) {
    if (!op || op.tuned) return;
    op.tuned = true;
    tuneFx(op.fx);
    asArr(op.roll).forEach(function (r) { tuneFx(r.fx); });
    asArr(op.cases).forEach(function (r) { tuneFx(r.fx); });
  }
  function tuneCard(c) {
    if (c.tuned || (c.req && c.req.stat)) return; // 위기 경고 카드는 원래 수치 그대로
    c.tuned = true;
    [c.l, c.r, c.t, c.x].forEach(tuneOpt);
    asArr(c.variants).forEach(function (v) { [v.l, v.r, v.t, v.x].forEach(tuneOpt); });
  }

  var INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    INDEX = {};
    var groups = [JY.CARDS.training, JY.CARDS.arrival, JY.CARDS.returns, JY.CARDS.pool, JY.CARDS.emergency || [], SPECIAL];
    if (JY.SPECIALS) for (var sw in JY.SPECIALS) JY.SPECIALS[sw].forEach(tuneOpt);
    for (var g = 0; g < groups.length; g++) for (var i = 0; i < groups[g].length; i++) {
      tuneCard(groups[g][i]);
      INDEX[groups[g][i].id] = groups[g][i];
    }
    return INDEX;
  }
  function getCardDef(id) { return index()[id]; }

  function unitOf(s) { return (JY.UNITS && JY.UNITS[s.unit]) || {}; }
  // 악조건(선택 난이도): 켜진 것들의 정의 목록
  function heatDefs(s) { return asArr(s.heat).map(function (id) { return JY.HEAT && JY.HEAT[id]; }).filter(Boolean); }
  function heatHas(s, key) { return heatDefs(s).some(function (h) { return h[key]; }); }
  function heatBonus(s) { return heatDefs(s).reduce(function (a, h) { return a + h.bonus; }, 0); }
  function traitOf(s) { return (JY.TRAITS && JY.TRAITS[s.trait]) || {}; }
  function condDef(id) { return (JY.CONDITIONS && JY.CONDITIONS[id]) || {}; }

  /* ── 새 게임 ─────────────────────────────── */
  function newState(opts) {
    opts = opts || {};
    var mos = MOS[opts.mos] ? opts.mos : 'infantry';
    var start = parseDate(opts.start || todayStr());
    var end = addMonths(start, 18) - DAY; // 전역일 = 입대일 + 18개월 - 1일
    var st = MOS[mos].start;
    var state = {
      v: 3,
      name: (opts.name || '나띨빵').slice(0, 8),
      face: opts.face || null,
      mos: mos,
      pace: opts.pace === 3 ? 3 : 1,
      daily: opts.daily || null,
      rng: typeof opts.seed === 'number' ? (opts.seed | 0) : null,
      start: start,
      end: end,
      total: Math.round((end - start) / DAY),
      day: 0,
      rank: 0,
      promo: [0, TRAIN_DAYS, firstOfMonthOffset(start, 2), firstOfMonthOffset(start, 8), firstOfMonthOffset(start, 14)],
      delays: [0, 0, 0, 0, 0],
      stats: { hp: st.hp, mt: st.mt, tr: st.tr, bd: st.bd },
      money: 0,
      savings: 0,
      items: { chocopie: 1 },
      leave: 0,
      leaveUsed: 0,
      lastLeaveEnd: -999,
      blockUntil: 0,
      pxDay: 0,
      flags: {},
      vars: {},
      seen: {},
      queue: [],
      current: null,
      lastWho: null,
      season: seasonOf(ymd(start).m),
      cards: 0,
      minis: { played: 0, great: 0 },
      emer: { count: 0, ok: 0, since: 0 },
      conds: [],
      aff: {},
      talkDay: {},
      bffs: {},
      insurance: opts.insurance ? 1 : 0,
      heat: (opts.heat || []).filter(function (id) { return JY.HEAT && JY.HEAT[id]; }),
      up: opts.up || {},
      undo: 0,
      cv: null,
      vlast: {},
      specials: 0,
      insight: 0,
      luck: 0,
      gems: 0,
      log: [],
      pendingMini: null,
      over: null
    };
    CUR = state;
    var unitIds = JY.UNIT_ORDER || [];
    state.unit = opts.unit && JY.UNITS && JY.UNITS[opts.unit] ? opts.unit : (unitIds.length ? unitIds[randInt(0, unitIds.length - 1)] : null);
    state.trait = opts.trait && JY.TRAITS && JY.TRAITS[opts.trait] ? opts.trait : null;
    var tr = traitOf(state), un = unitOf(state);
    [tr.start, un.start].forEach(function (d) { if (d) for (var k in d) state.stats[k] = clamp(state.stats[k] + d[k], 10, 90); });
    if (tr.money) state.money += tr.money;
    asArr(tr.flags).forEach(function (f) { state.flags[f] = true; });
    if (tr.vars) for (var v in tr.vars) state.vars[v] = (state.vars[v] || 0) + tr.vars[v];
    if (JY.NPCS) for (var n in JY.NPCS) state.aff[n] = JY.NPCS[n].start;
    if (heatHas(state, 'halfUp')) { var hu = {}; for (var u in state.up) hu[u] = Math.floor(state.up[u] / 2); state.up = hu; }
    heatDefs(state).forEach(function (h) { if (h.extend) state.total += h.extend; });
    var up = state.up;
    state.insight += 3 * (up.notebook || 0);
    state.undo = [0, 1, 1, 2, 2, 3][up.watch || 0] || 0;
    if (heatHas(state, 'noPremium')) { state.undo = 0; state.insurance = 0; }
    state.queue = openingQueue();
    nextCard(state);
    return state;
  }

  // 매판 다른 시작: 슬롯마다 후보 중 하나(또는 n장)
  function openingQueue() {
    var slots = JY.CARDS.openingSlots;
    if (!slots) return JY.CARDS.training.concat(JY.CARDS.arrival).map(function (c) { return c.id; });
    var q = [];
    slots.forEach(function (sl) {
      if (sl.pick) q.push(sl.pick[randInt(0, sl.pick.length - 1)]);
      else if (sl.pool) {
        var bag = sl.pool.slice();
        for (var i = 0; i < sl.n && bag.length; i++) q.push(bag.splice(randInt(0, bag.length - 1), 1)[0]);
      }
    });
    return q;
  }

  /* ── 조건 검사 ───────────────────────────── */
  function daysLeft(s) { return Math.max(0, s.total - s.day); }
  function monthOf(s) { return ymd(s.start + s.day * DAY).m; }

  function checkReq(s, req) {
    if (!req) return true;
    if (req.rank && (s.rank < req.rank[0] || s.rank > req.rank[1])) return false;
    if (req.season && asArr(req.season).indexOf(s.season) < 0) return false;
    if (req.mos && asArr(req.mos).indexOf(s.mos) < 0) return false;
    if (req.unit && asArr(req.unit).indexOf(s.unit) < 0) return false;
    if (req.trait && asArr(req.trait).indexOf(s.trait) < 0) return false;
    if (req.month) { var m = monthOf(s); if (m < req.month[0] || m > req.month[1]) return false; }
    var f = asArr(req.flag);
    for (var i = 0; i < f.length; i++) if (!s.flags[f[i]]) return false;
    var nf = asArr(req.noflag);
    for (var j = 0; j < nf.length; j++) if (s.flags[nf[j]]) return false;
    if (req.vars) for (var k in req.vars) { var v = s.vars[k] || 0; if (v < req.vars[k][0] || v > req.vars[k][1]) return false; }
    if (req.stat) for (var q in req.stat) { var sv = s.stats[q]; if (sv < req.stat[q][0] || sv > req.stat[q][1]) return false; }
    if (req.aff) for (var a in req.aff) { var av = s.aff[a] || 0; if (av < req.aff[a][0] || av > req.aff[a][1]) return false; }
    if (req.left) { var l = daysLeft(s); if (l < req.left[0] || l > req.left[1]) return false; }
    if (req.minDay && s.day < req.minDay) return false;
    if (req.leaveGte === 'left' && !(s.leave > 0 && s.leave >= daysLeft(s) - 2)) return false;
    return true;
  }

  function eligible(s, c) {
    if (s.seen[c.id] !== undefined) {
      if (!c.repeat) return false;
      var cd = (c.cd === undefined ? 40 : c.cd) * s.pace;
      if (s.day - s.seen[c.id] < cd) return false;
    }
    if (s.rank < 1 && !(c.req && c.req.rank && c.req.rank[0] === 0)) return false; // 훈련소 중엔 랜덤 카드 없음
    return checkReq(s, c.req);
  }

  function cardWeight(s, c) {
    var w = c.w || 1;
    if (c.who === s.lastWho) w *= 0.35;
    var un = unitOf(s), tr = traitOf(s);
    if (un.seasonW && c.req && c.req.season) {
      asArr(c.req.season).forEach(function (se) { if (un.seasonW[se] && se === s.season) w *= un.seasonW[se]; });
    }
    if (c.req && c.req.unit) w *= 1.4; // 자대 전용 카드는 조금 더 자주
    if (tr.catW && c.who === 'cat') w *= tr.catW;
    heatDefs(s).forEach(function (h) { if (h.whoW && (c.who === h.whoW.who || (h.whoW.ids && h.whoW.ids.indexOf(c.id) >= 0))) w *= h.whoW.mult; });
    return w;
  }

  function pickRandom(s) {
    var pool = JY.CARDS.pool, list = [], total = 0;
    for (var i = 0; i < pool.length; i++) {
      var c = pool[i];
      if (!eligible(s, c)) continue;
      var w = cardWeight(s, c);
      list.push([c, w]); total += w;
    }
    if (!list.length) return 'quiet';
    var r = rand() * total;
    for (var j = 0; j < list.length; j++) { r -= list[j][1]; if (r <= 0) return list[j][0].id; }
    return list[list.length - 1][0].id;
  }

  function pickEmergency(s) {
    var em = JY.CARDS.emergency || [];
    if (s.rank < 1 || s.emer.since < 3 || !em.length) return null;
    var chance = EMER_BASE * (unitOf(s).emerMult || 1) * (traitOf(s).emerMult || 1);
    heatDefs(s).forEach(function (h) { if (h.emerMult) chance *= h.emerMult; });
    if (rand() >= chance) return null;
    var list = em.filter(function (c) {
      if (s.seen[c.id] !== undefined && s.day - s.seen[c.id] < 150 * s.pace) return false;
      return checkReq(s, c.req);
    });
    if (!list.length) return null;
    return list[randInt(0, list.length - 1)].id;
  }

  function nextCard(s) {
    var id = null;
    while (s.queue.length && !id) {
      var q = s.queue.shift();
      if (getCardDef(q)) id = q;
    }
    if (!id) {
      id = pickEmergency(s);
      if (id) s.emer.since = 0;
    }
    if (!id) id = pickRandom(s);
    s.current = id;
    pickVariant(s, getCardDef(id));
    return id;
  }

  /* ── 장면 변형: 한 카드 안의 여러 장면, 여러 말투 ─── */
  function variantOk(s, v) {
    if (!v) return true;
    var req = v.req || {};
    if (v.flag) req = { flag: v.flag, noflag: req.noflag };
    if (v.noflag) req = { flag: req.flag, noflag: v.noflag };
    return checkReq(s, req);
  }
  function pickVariant(s, c) {
    s.cv = { id: c ? c.id : null, v: 0, k: randInt(0, 1 << 20) };
    if (!c || !c.variants || !c.variants.length) return;
    var opts = [];
    if (c.text && c.l && variantOk(s, c)) opts.push(0);
    c.variants.forEach(function (v, i) { if (variantOk(s, v)) opts.push(i + 1); });
    if (!opts.length) return;
    var last = s.vlast[c.id];
    var pool = opts.length > 1 ? opts.filter(function (i) { return i !== last; }) : opts;
    s.cv.v = pool[randInt(0, pool.length - 1)];
    s.vlast[c.id] = s.cv.v;
  }
  function pickStr(x, k) { return Array.isArray(x) ? x[k % x.length] : x; }
  // 지금 카드의 실제 모습 (변형 적용)
  function view(s) {
    var c = getCardDef(s.current);
    if (!c) { s.current = 'quiet'; c = getCardDef('quiet'); }
    if (!s.cv || s.cv.id !== c.id) pickVariant(s, c);
    var v = s.cv.v ? c.variants[s.cv.v - 1] : null;
    var b = v || c;
    return {
      c: c, v: v, key: c.id + (s.cv.v ? '#' + s.cv.v : ''),
      who: b.who || c.who, bg: b.bg || c.bg,
      text: pickStr(b.text || c.text, s.cv.k),
      l: b.l || c.l, r: b.r || c.r, t: b.t || c.t, x: b.x || (v ? null : c.x)
    };
  }

  /* ── 특수 대답: 조건이 맞으면 열리는 세 번째 선택지 ─── */
  function needOk(s, need) {
    if (!need) return true;
    if (need.item && !(s.items[need.item] > 0)) return false;
    if (need.money && s.money < need.money) return false;
    if (need.flag && !s.flags[need.flag]) return false;
    if (need.trait && s.trait !== need.trait) return false;
    if (need.aff) for (var a in need.aff) { var av = s.aff[a] || 0; if (av < need.aff[a][0] || av > need.aff[a][1]) return false; }
    return true;
  }
  function needLabel(need) {
    if (!need) return '';
    if (need.item && JY.ITEMS[need.item]) return JY.ITEMS[need.item].icon + ' ' + JY.ITEMS[need.item].name + ' 1개 사용';
    if (need.money) return '💸 ' + need.money.toLocaleString('ko-KR') + '원';
    if (need.trait && JY.TRAITS[need.trait]) return JY.TRAITS[need.trait].emoji + ' ' + JY.TRAITS[need.trait].name + ' 성격';
    if (need.aff) { var w = Object.keys(need.aff)[0]; return '💗 ' + (JY.CHARS[w] ? JY.CHARS[w].name : w) + ' 호감도 ' + need.aff[w][0] + '+'; }
    if (need.flag) return '✦ 특별 조건';
    return '';
  }
  function specialFor(s, vw) {
    if (s.rank < 0) return null;
    if (vw.x && needOk(s, vw.x.need)) return vw.x;
    var list = JY.SPECIALS && JY.SPECIALS[vw.who];
    if (!list || vw.c.id === 'quiet') return null;
    for (var i = 0; i < list.length; i++) {
      var sp = list[i];
      if (!needOk(s, sp.need)) continue;
      // 아이템을 쓰지 않는 특수 대답은 절반 확률로만 열린다 (매번 쉬운 길이 있으면 재미없다)
      if (!(sp.need && sp.need.item) && (s.cv.k >> 16) % 2) continue;
      return sp;
    }
    return null;
  }

  /* ── 텍스트 치환 ─────────────────────────── */
  function fill(s, text) {
    var un = unitOf(s);
    return String(text || '')
      .replace(/\{name\}/g, s.name)
      .replace(/\{rank\}/g, RANKS[s.rank])
      .replace(/\{left\}/g, daysLeft(s))
      .replace(/\{leave\}/g, s.leave)
      .replace(/\{unit\}/g, un.name || '○○사단')
      .replace(/\{place\}/g, un.place || '강원도');
  }

  function currentCard(s) {
    var vw = view(s), c = vw.c, k = s.cv.k;
    var res = {
      id: c.id, key: vw.key, who: vw.who, bg: vw.bg, extras: c.extras, meSpec: c.meSpec, meMood: c.meMood, meProp: c.meProp,
      catFish: c.catFish, catCap: c.catCap, urgent: c.urgent ? Math.max(3, c.urgent - heatDefs(s).reduce(function (a, h) { return a + (h.urgentMinus || 0); }, 0)) : 0,
      text: fill(s, vw.text),
      l: { t: fill(s, pickStr(vw.l.t, k >> 4)), preview: preview(vw.l, s) },
      r: { t: fill(s, pickStr(vw.r.t, k >> 8)), preview: preview(vw.r, s) }
    };
    if (vw.t) res.t = { t: fill(s, pickStr(vw.t.t, k >> 12)) };
    var sp = specialFor(s, vw);
    if (sp) res.x = { t: fill(s, pickStr(sp.t, k >> 14)), preview: preview(sp, s), need: needLabel(sp.need) };
    return res;
  }

  // 선택지가 건드리는 스탯 (Reigns처럼 방향은 숨기고 크기만 보여준다. 투시경·눈치백단이면 방향도)
  function preview(opt, s) {
    var p = {}, ev = {};
    function add(fx, w) { for (var k in fx) { var a = Math.abs(fx[k]); if (a && (!p[k] || a > p[k])) p[k] = a; ev[k] = (ev[k] || 0) + fx[k] * w; } }
    add(opt.fx || {}, 1);
    asArr(opt.roll).forEach(function (r) { add(r.fx || {}, r.p); });
    asArr(opt.cases).forEach(function (r, i, arr) { add(r.fx || {}, 1 / arr.length); });
    var out = {};
    if (opt.mini) out.mini = true;
    if (s && heatHas(s, 'blind')) return out; // 눈치 제로: 점 없음
    for (var k in p) out[k] = p[k] >= 10 ? 'big' : 'small';
    if (s) {
      var see = s.insight > 0 ? STATS : (traitOf(s).insightStat ? [traitOf(s).insightStat] : []);
      if (see.length) {
        out.dir = {};
        see.forEach(function (k) { if (out[k] && ev[k]) out.dir[k] = ev[k] > 0 ? 1 : -1; });
      }
    }
    return out;
  }

  /* ── 결과 적용 ───────────────────────────── */
  // 운: 지금 상태에서 더 안전한 결과(스탯이 가운데에 가까운 쪽)를 '좋은 결과'로 본다
  function rollScore(s, r) {
    var t = (r.gem || 0) * 2 + (r.leave || 0) * 4 + (r.end ? -999 : 0) + (r.money || 0) / 20000;
    STATS.forEach(function (k) {
      var v = s.stats[k] + ((r.fx && r.fx[k]) || 0);
      t -= (v - 50) * (v - 50) / 100;
      if (v <= 0 || v >= 100) t -= 500;
    });
    return t;
  }

  function resolveOutcome(s, opt) {
    var out = {};
    var k;
    for (k in opt) out[k] = opt[k];
    out.fx = {};
    for (k in (opt.fx || {})) out.fx[k] = opt.fx[k];
    var extra = null;
    function roll() {
      var r = rand(), acc = 0;
      for (var i = 0; i < opt.roll.length; i++) { acc += opt.roll[i].p; if (r < acc || i === opt.roll.length - 1) return opt.roll[i]; }
      return opt.roll[opt.roll.length - 1];
    }
    if (opt.roll) {
      extra = roll();
      var luckP = (traitOf(s).luck || 0) + 0.08 * (s.up.charm || 0);
      var lucky = s.luck > 0 || (luckP > 0 && rand() < luckP);
      if (lucky) {
        var second = roll();
        if (rollScore(s, second) > rollScore(s, extra)) extra = second;
      }
    } else if (opt.cases) {
      for (var j = 0; j < opt.cases.length; j++) { if (!opt.cases[j].if || checkReq(s, opt.cases[j].if)) { extra = opt.cases[j]; break; } }
    }
    if (Array.isArray(out.say)) out.say = out.say[randInt(0, out.say.length - 1)];
    if (extra && Array.isArray(extra.say)) extra = Object.assign({}, extra, { say: extra.say[randInt(0, extra.say.length - 1)] });
    if (extra) {
      for (k in extra) {
        if (k === 'fx') { for (var f in extra.fx) out.fx[f] = (out.fx[f] || 0) + extra.fx[f]; }
        else if (k === 'say') { out.say = (out.say ? out.say + ' ' : '') + extra.say; }
        else if (k === 'item') { out.item = out.item || {}; for (var it in extra.item) out.item[it] = (out.item[it] || 0) + extra.item[it]; }
        else if (k === 'money') { out.money = (out.money || 0) + extra.money; }
        else if (k !== 'p' && k !== 'if') out[k] = extra[k];
      }
    }
    return out;
  }

  // 특성·부대·보직·주간 상황·절친 효과를 모아 스탯 변화 배수를 만든다
  function statMult(s, k, v) {
    var m = 1;
    var key = v > 0 ? 'pos' : 'neg';
    if (v > 0 && MOS[s.mos].boost === k) m *= 1.25;
    var srcs = [traitOf(s).mods, unitOf(s).mods];
    heatDefs(s).forEach(function (h) { srcs.push(h.mods); });
    s.conds.forEach(function (c) { srcs.push(condDef(c.id).mods); });
    if (JY.NPCS) for (var n in s.bffs) if (s.bffs[n] && JY.NPCS[n]) srcs.push(JY.NPCS[n].perk.mods);
    srcs.forEach(function (md) { if (md && md[k] && md[k][key]) m *= md[k][key]; });
    var up = s.up || {};
    // 전투화: 체력이 끝(0·100) 쪽으로 쏠리는 변화를 줄인다
    if (k === 'hp' && up.boots && ((v < 0 && s.stats.hp <= 50) || (v > 0 && s.stats.hp >= 50))) m *= 1 - 0.06 * up.boots;
    // 방탄모: 위험 구간에서 더 위험해지는 쪽 변화 완화
    if (up.helmet && ((s.stats[k] <= 20 && v < 0) || (s.stats[k] >= 80 && v > 0))) m *= 1 - 0.08 * up.helmet;
    return m;
  }

  function applyStats(s, fx, res, soft, lo, hi) {
    for (var k in fx) {
      if (STATS.indexOf(k) < 0) continue;
      var v = fx[k];
      if (!soft && v) v = Math.round(v * statMult(s, k, v) * (PACE_SWING[s.pace] || 1));
      var before = s.stats[k];
      var after = clamp(before + v, 0, 100);
      if (soft) { // 아이템/휴가/주간 상황: 경계 바깥으로는 밀지 않는다
        var a = lo === undefined ? 5 : lo, b = hi === undefined ? 95 : hi;
        if (v > 0) after = Math.max(before, Math.min(after, b));
        else after = Math.min(before, Math.max(after, a));
      }
      s.stats[k] = after;
      res.deltas[k] = (res.deltas[k] || 0) + (after - before);
    }
  }

  function gainLeave(s, n, res, why, raw) {
    if (!n) return;
    if (n > 0 && !raw) {
      if (s.mos === 'infantry') n = Math.ceil(n * 1.5);
      if (unitOf(s).leaveReward) n += unitOf(s).leaveReward;
      heatDefs(s).forEach(function (h) { if (h.leaveGain) n = Math.max(1, Math.floor(n * h.leaveGain)); });
    }
    s.leave = Math.max(0, s.leave + n);
    if (n > 0) res.events.push({ type: 'leave', n: n, text: (why || '포상휴가') + ' +' + n + '일' });
  }

  function gainGem(s, n, res) {
    if (!n) return;
    n = Math.round(n * (traitOf(s).gemMult || 1));
    s.gems += n;
    res.events.push({ type: 'gem', n: n });
  }

  function startCond(s, id, res) {
    var d = condDef(id);
    if (!d.name) return;
    var ex = s.conds.filter(function (c) { return c.id === id; })[0];
    if (ex) { ex.left = Math.max(ex.left, d.cards); return; }
    if (s.conds.length >= 2) s.conds.shift();
    s.conds.push({ id: id, left: d.cards });
    if (d.onStart) for (var it in d.onStart) s.items[it] = clamp((s.items[it] || 0) + d.onStart[it], 0, 9);
    res.events.push({ type: 'cond', id: id, text: d.emoji + ' ' + d.name + ' 시작! (' + d.desc + ')' });
  }

  function changeAff(s, who, n, res) {
    if (!JY.NPCS || !JY.NPCS[who] || !n) return;
    if (who === 'cat' && traitOf(s).catW) n *= 2;
    if (n > 0 && s.up && s.up.tag) n *= 1 + 0.12 * s.up.tag;
    var before = s.aff[who] || 0;
    var after = clamp(Math.round(before + n), 0, 100);
    s.aff[who] = after;
    if (after !== before) res.events.push({ type: 'aff', who: who, n: after - before });
    if (after >= BFF && !s.bffs[who]) {
      s.bffs[who] = true;
      res.events.push({ type: 'bff', who: who, text: JY.NPCS[who].perk.name + ' — ' + JY.NPCS[who].perk.desc });
      addLog(s, (JY.CHARS[who] ? JY.CHARS[who].name : who) + '와(과) 절친');
    } else if (after < BFF - 10 && s.bffs[who]) {
      s.bffs[who] = false;
    }
  }

  function applyOutcome(s, out, res) {
    applyStats(s, out.fx || {}, res);
    if (out.money) {
      var m = out.money;
      if (m < 0 && -m > s.money) m = -s.money;
      s.money += m;
      if (m) res.events.push({ type: 'money', n: m });
    }
    if (out.save) {
      var amt = Math.min(out.save, s.money);
      s.money -= amt; s.savings += amt;
      if (amt > 0) res.events.push({ type: 'save', n: amt });
    }
    if (out.item) for (var it in out.item) {
      s.items[it] = clamp((s.items[it] || 0) + out.item[it], 0, 9);
      res.events.push({ type: 'item', id: it, n: out.item[it] });
    }
    if (out.leave) gainLeave(s, out.leave, res);
    if (out.gem) gainGem(s, out.gem, res);
    if (out.cond) startCond(s, out.cond, res);
    if (out.aff) for (var w in out.aff) changeAff(s, w, out.aff[w], res);
    asArr(out.set).forEach(function (f) { s.flags[f] = true; logFlag(s, f); });
    asArr(out.unset).forEach(function (f) { delete s.flags[f]; });
    if (out.add) for (var v in out.add) s.vars[v] = (s.vars[v] || 0) + out.add[v];
    if (out.block) {
      s.blockUntil = Math.max(s.blockUntil, s.day + out.block);
      res.events.push({ type: 'block', n: out.block });
    }
    if (out.next) s.queue.unshift(out.next);
    if (out.say) res.say = out.say;
    if (out.end) res.ending = out.end;
  }

  var FLAG_LOG = {
    special: '특급전사 달성', sharp: '특등사수 달성', catMascot: '짬타이거 마스코트 임명', catAdopt: '짬타이거 입양 결심',
    gfStay: '곰신의 약속', gfBreak: '고무신 거꾸로…', hotwater: '사단장님께 온수 건의', squadLeader: '분대장 임명',
    hoobae: '첫 후임 오순둥', coinWin: '코인 떡상', cast: '말년 축구 부상', cert: '자격증 공부 시작', malGone: '왕고 김말년 전역'
  };
  function logFlag(s, f) { if (FLAG_LOG[f]) addLog(s, FLAG_LOG[f]); }
  function addLog(s, text) { s.log.push({ day: s.day, text: text }); if (s.log.length > 30) s.log.shift(); }

  function edgeEnding(s, res) {
    for (var i = 0; i < STATS.length; i++) {
      var k = STATS[i];
      var hit = s.stats[k] <= 0 ? k + '0' : s.stats[k] >= 100 ? k + '100' : null;
      if (!hit) continue;
      if (s.insurance > 0) { // 전역 보험: 한 번 살려준다
        s.insurance = 0;
        var before = s.stats[k];
        s.stats[k] = 50;
        res.deltas[k] = (res.deltas[k] || 0) + (50 - before);
        res.events.push({ type: 'insurance', stat: k, text: '🛡️ 전역 보험 발동! "…꿈이었다!" ' + STAT_NAMES[k] + '이(가) 50으로 돌아왔다.' });
        addLog(s, '전역 보험 발동');
        continue;
      }
      return hit;
    }
    return null;
  }

  /* ── 시간 흐름 ───────────────────────────── */
  function advance(s, n, res) {
    for (var i = 0; i < n; i++) {
      if (s.day >= s.total) break;
      s.day += 1;
      var date = ymd(s.start + s.day * DAY);
      if (date.d === 10 && s.day > 0) payday(s, res);
      if (date.d === 1 && s.rank >= 1 && rand() < COND_CHANCE) monthlyCond(s, res);
      while (s.rank < 4 && s.day >= s.promo[s.rank + 1]) promote(s, res);
      var se = seasonOf(date.m);
      if (se !== s.season) { s.season = se; res.events.push({ type: 'season', season: se, text: SEASON_MSG[se] }); }
    }
  }

  function monthlyCond(s, res) {
    if (!JY.CONDITIONS) return;
    var ids = Object.keys(JY.CONDITIONS).filter(function (id) {
      var d = JY.CONDITIONS[id];
      if (d.season && d.season !== s.season) return false;
      return !s.conds.some(function (c) { return c.id === id; });
    });
    if (ids.length) startCond(s, ids[randInt(0, ids.length - 1)], res);
  }

  function tickConds(s, res) {
    var keep = [];
    s.conds.forEach(function (c) {
      var d = condDef(c.id);
      if (d.tick) applyStats(s, d.tick, res, true, 3, 97);
      c.left -= 1;
      if (c.left > 0) keep.push(c);
      else res.events.push({ type: 'condEnd', id: c.id, text: (d.emoji || '') + ' ' + (d.name || '') + ' 끝' });
    });
    s.conds = keep;
  }

  function payday(s, res) {
    var pay = PAY[s.rank];
    var save = Math.min(SAVE_MONTHLY, pay);
    s.savings += save;
    s.money += Math.round((pay - save) * (1 + 0.05 * ((s.up && s.up.wallet) || 0)));
    res.events.push({ type: 'pay', n: pay, cash: pay - save, save: save });
  }

  function promote(s, res) {
    var next = s.rank + 1;
    if (next >= 2 && s.stats.tr < 20 && s.delays[next] < 2) {
      // 2026년부터 자동 진급 폐지 — 심사에서 떨어지면 한 달 누락
      s.delays[next] += 1;
      s.promo[next] = firstOfMonthOffset(s.start + s.promo[next] * DAY, 1);
      for (var k = next + 1; k <= 4; k++) s.promo[k] = Math.max(s.promo[k], firstOfMonthOffset(s.start + s.promo[k] * DAY, 1));
      applyStats(s, { mt: -8 }, res, true, 3, 97);
      res.events.push({ type: 'promoFail', rank: next, text: RANKS[next] + ' 진급 누락! 간부 신뢰가 너무 낮다. 한 달 뒤 재심사.' });
      addLog(s, RANKS[next] + ' 진급 누락');
      return;
    }
    s.rank = next;
    var add = LEAVE_ON_PROMO[next] + (next >= 2 ? (unitOf(s).leaveBonus || 0) : 0);
    if (heatHas(s, 'leaveNone')) add = 0;
    s.leave += add;
    res.events.push({ type: 'promo', rank: next, leave: add, text: RANKS[next] + ' 진급!' + (add ? ' 휴가 +' + add + '일' : '') });
    addLog(s, RANKS[next] + ' 진급');
  }

  function cardDays(s, c, out) {
    if (out && out.days) return out.days;
    if (c.days === 'fill') return Math.max(1, TRAIN_DAYS - s.day);
    if (c.days) return c.days;
    return randInt(3, 6) * s.pace;
  }

  function finishTurn(s, res, days) {
    var e = edgeEnding(s, res);
    if (e) { end(s, e, res); return res; }
    tickConds(s, res);
    if (s.insight > 0) s.insight -= 1;
    if (s.luck > 0) s.luck -= 1;
    var before = s.rank;
    advance(s, days, res);
    if (before < 1 && s.rank >= 1) addLog(s, '훈련소 수료, ' + (unitOf(s).name || '자대') + ' 배치');
    if (s.day >= s.total) { discharge(s, res); return res; }
    e = edgeEnding(s, res); // 진급 누락 등으로 바뀐 경우
    if (e) { end(s, e, res); return res; }
    s.cards += 1;
    s.emer.since += 1;
    nextCard(s);
    return res;
  }

  function newRes() { return { say: '', deltas: {}, events: [], mini: null, ending: null }; }

  /* ── 플레이어 행동 ───────────────────────── */
  function choose(s, side) {
    if (s.over || s.pendingMini) return null;
    CUR = s;
    var vw = view(s), c = vw.c;
    var opt;
    if (side === 'x') {
      opt = specialFor(s, vw);
      if (!opt) return null;
      if (opt.need && opt.need.item) s.items[opt.need.item] -= 1;
      s.specials += 1;
    } else opt = side === 'l' || side === 'left' ? vw.l : side === 't' && vw.t ? vw.t : vw.r;
    var out = resolveOutcome(s, opt);
    // 돌발 지옥: 돌발 상황의 결과가 커진다
    var uf = c.urgent ? heatDefs(s).reduce(function (a, h) { return a * ((side === 't' ? h.timeoutFx : h.urgentFx) || 1); }, 1) : 1;
    if (uf !== 1) for (var fk in out.fx) if (STATS.indexOf(fk) >= 0) out.fx[fk] = Math.round(out.fx[fk] * uf);
    var res = newRes();
    res.scene = vw.key;
    res.special = side === 'x';
    applyOutcome(s, out, res);
    s.seen[c.id] = s.day;
    s.lastWho = vw.who;
    c = { id: c.id, who: vw.who, urgent: c.urgent };
    if (c.urgent) {
      s.emer.count += 1;
      if (side !== 't') s.emer.ok += 1;
      res.emergency = true;
      res.timeout = side === 't';
    }
    // 카드 속 동료와의 호감도: 그 동료가 신경 쓰는 스탯이 오르면 좋아한다
    if (JY.NPCS && JY.NPCS[c.who] && !(out.aff && out.aff[c.who])) {
      var npc = JY.NPCS[c.who];
      var d = res.deltas[npc.stat] || 0;
      if (d) changeAff(s, c.who, d * 0.6, res);
    }
    if (res.ending) { end(s, res.ending, res); return res; }
    var def = getCardDef(c.id);
    if (out.mini) {
      s.pendingMini = { id: out.mini, days: cardDays(s, def, out) };
      res.mini = out.mini;
      return res;
    }
    return finishTurn(s, res, cardDays(s, def, out));
  }

  function finishMini(s, tier) {
    var pm = s.pendingMini;
    if (!pm) return null;
    CUR = s;
    s.pendingMini = null;
    var def = MINI[pm.id];
    var r = def[tier] || def.good;
    var res = newRes();
    s.minis.played += 1;
    if (tier === 'great') s.minis.great += 1;
    applyOutcome(s, { fx: r.fx, say: r.say, set: r.set }, res);
    if (r.leave) gainLeave(s, r.leave, res);
    if (tier === 'great') gainGem(s, 3, res);
    if (pm.id === 'shoot' && rand() < 0.3) s.queue.unshift('shell_lost');
    res.tier = tier;
    return finishTurn(s, res, pm.days);
  }

  /* ── 동료와 상호작용 ─────────────────────── */
  function npcAvailable(s, who) {
    var n = JY.NPCS && JY.NPCS[who];
    if (!n || s.rank < 1) return false;
    return checkReq(s, n.avail);
  }

  function talk(s, who) {
    CUR = s;
    if (!npcAvailable(s, who)) return null;
    var res = newRes();
    var last = s.talkDay[who];
    var lines = JY.NPCS[who].lines;
    res.line = lines[randInt(0, lines.length - 1)];
    if (last !== undefined && s.day - last < 6) { res.cooldown = 6 - (s.day - last); return res; }
    s.talkDay[who] = s.day;
    changeAff(s, who, 4, res);
    applyStats(s, { mt: 3 }, res, true);
    return res;
  }

  // 카드 속 동료를 톡 건드리면 호감도 +1 (카드당 한 번)
  function poke(s, who) {
    if (!JY.NPCS || !JY.NPCS[who] || s.poked === s.current) return null;
    s.poked = s.current;
    var res = newRes();
    changeAff(s, who, 1, res);
    return res;
  }

  function gift(s, who, item) {
    CUR = s;
    if (!npcAvailable(s, who) || !(s.items[item] > 0)) return null;
    var res = newRes();
    s.items[item] -= 1;
    var fav = JY.NPCS[who].fav === item;
    if (who === 'cat' && item !== 'tuna' && item !== 'homefood') {
      res.say = '짬타이거가 냄새만 맡고 고개를 돌렸다. 고양이는 참치를 원한다.';
      changeAff(s, who, 2, res);
      return res;
    }
    changeAff(s, who, fav ? 18 : 8, res);
    applyStats(s, { bd: fav ? 4 : 2 }, res, true);
    res.fav = fav;
    return res;
  }

  /* ── 휴가 ───────────────────────────────── */
  function leaveStatus(s) {
    if (s.over) return { ok: false, reason: '게임이 끝났다.' };
    if (s.rank < 1) return { ok: false, reason: '훈련병은 휴가가 없다. 수료부터 하자.' };
    if (s.pendingMini) return { ok: false, reason: '지금은 바쁘다!' };
    if (getCardDef(s.current) && getCardDef(s.current).urgent) return { ok: false, reason: '돌발 상황 중이다!' };
    if (s.leave < 1) return { ok: false, reason: '남은 휴가가 없다. 포상휴가를 노려보자.' };
    var blockCond = s.conds.filter(function (c) { return condDef(c.id).blockLeave; })[0];
    if (blockCond) return { ok: false, reason: condDef(blockCond.id).name + ' 중에는 휴가 통제다. 카드 ' + blockCond.left + '장 뒤 해제.' };
    if (s.day < s.blockUntil) return { ok: false, reason: '휴가 통제 중이다. ' + (s.blockUntil - s.day) + '일 뒤 해제.' };
    var gap = s.lastLeaveEnd + LEAVE_GAP - s.day;
    if (gap > 0) return { ok: false, reason: '복귀한 지 얼마 안 됐다. ' + gap + '일 뒤 신청 가능.' };
    return { ok: true, max: Math.min(s.leave, LEAVE_MAX, Math.max(daysLeft(s), 1)), malchulAt: daysLeft(s) };
  }

  var LEAVE_STORIES = [
    ['치킨 {a}마리 섭취', '엄마 잔소리 {b}회', '늦잠 {c}시간'],
    ['친구들의 "벌써 휴가야?" {b}회', 'PC방 {c}시간', '삼겹살 {a}인분'],
    ['편의점 신상 {a}개 정복', '노래방 {b}시간', '침대와 혼연일체 {c}시간'],
    ['아빠의 군대 이야기 {b}회', '고양이 영상 {c}시간', '떡볶이 {a}접시']
  ];

  function takeLeave(s, n) {
    CUR = s;
    var st = leaveStatus(s);
    if (!st.ok) return null;
    n = clamp(Math.round(n), 1, Math.min(s.leave, LEAVE_MAX));
    var res = newRes();
    s.leave -= n;
    s.leaveUsed += n;
    var left = daysLeft(s);
    if (n >= left) {
      s.flags.malchul = true;
      addLog(s, '말년휴가 출발 (' + n + '일)');
      advance(s, left, res);
      s.day = s.total;
      discharge(s, res);
      return res;
    }
    applyStats(s, { mt: Math.min(30, 6 + n * 3), hp: Math.min(20, 4 + n * 2), bd: -2 }, res, true);
    advance(s, n, res);
    s.lastLeaveEnd = s.day;
    addLog(s, n + '일 휴가');
    var lines = LEAVE_STORIES[randInt(0, LEAVE_STORIES.length - 1)].map(function (t) {
      return t.replace('{a}', randInt(2, n + 3)).replace('{b}', randInt(3, 9 + n)).replace('{c}', randInt(n * 3, n * 9));
    });
    res.story = lines;
    if (s.day >= s.total) { discharge(s, res); return res; }
    // 복귀 카드: 미복귀 유혹은 군생활 중 한 번만
    var rets = ['ret_mom', 'ret_bus'];
    if (!s.flags.lateTempted) rets.push('ret_late');
    var pick = rets[randInt(0, rets.length - 1)];
    if (pick === 'ret_late') s.flags.lateTempted = true;
    if (s.current) s.queue.unshift(s.current);
    s.current = pick;
    return res;
  }

  /* ── PX & 아이템 ─────────────────────────── */
  function pxDiscount(s) {
    var keep = 1;
    if (unitOf(s).pxDiscount) keep *= 1 - unitOf(s).pxDiscount;
    if (s.up && s.up.wallet) keep *= 1 - 0.04 * s.up.wallet;
    if (s.bffs.ppaen && JY.NPCS) keep *= 1 - (JY.NPCS.ppaen.perk.pxDiscount || 0);
    s.conds.forEach(function (c) { if (condDef(c.id).pxDiscount) keep *= 1 - condDef(c.id).pxDiscount; });
    return 1 - keep;
  }
  function pxPrice(s, id) {
    var it = JY.ITEMS[id];
    var hm = heatDefs(s).reduce(function (a, h) { return a * (h.pxMult || 1); }, 1);
    return Math.max(100, Math.round(it.price * hm * (1 - pxDiscount(s)) / 100) * 100);
  }

  function pxStatus(s) {
    if (s.over) return { ok: false, reason: '' };
    if (s.rank < 1) return { ok: false, reason: '훈련소에는 PX가 없다(있어도 못 간다).' };
    if (s.pendingMini) return { ok: false, reason: '지금은 바쁘다!' };
    if (s.conds.some(function (c) { return condDef(c.id).pxOpen; })) return { ok: true };
    if (s.day < s.pxDay) return { ok: false, reason: 'PX는 개인정비 시간에만! ' + (s.pxDay - s.day) + '일 뒤 이용 가능.' };
    return { ok: true };
  }

  function buy(s, id) {
    var it = JY.ITEMS[id];
    if (!it || it.px === false) return false;
    var price = pxPrice(s, id);
    if (s.money < price) return false;
    if ((s.items[id] || 0) >= 9) return false;
    s.money -= price;
    s.items[id] = (s.items[id] || 0) + 1;
    return true;
  }

  function closePX(s, bought) { if (bought) s.pxDay = s.day + Math.round(4 * s.pace * heatDefs(s).reduce(function (a, h) { return a * (h.pxCd || 1); }, 1)); }

  function useItem(s, id) {
    if (s.over || !(s.items[id] > 0)) return null;
    CUR = s;
    var it = JY.ITEMS[id];
    var res = newRes();
    s.items[id] -= 1;
    var fx = {};
    var mult = JY.FOOD && JY.FOOD[id] && traitOf(s).itemMult ? traitOf(s).itemMult : 1;
    mult *= 1 + 0.1 * ((s.up && s.up.pack) || 0); // 군용 배낭 강화
    for (var k in it.fx) fx[k] = Math.round(it.fx[k] * (it.fx[k] > 0 ? mult : 1));
    applyStats(s, fx, res, true);
    return res;
  }

  /* ── 특급 보급품 (다이아) ─────────────────── */
  function usePremium(s, id) {
    if (s.over || s.pendingMini) return null;
    if (heatHas(s, 'noPremium')) return null;
    CUR = s;
    var res = newRes();
    switch (id) {
      case 'leave3': gainLeave(s, 3, res, '포상휴가증', true); res.say = '포상휴가증 사용! 휴가 +3일.'; return res;
      case 'insight': s.insight += 12; res.say = '투시경 장착! 카드 12장 동안 ▲▼ 방향이 보인다.'; return res;
      case 'clover': s.luck += 15; res.say = '네잎클로버를 전투모에 꽂았다. 카드 15장 동안 운이 따른다.'; return res;
      case 'feast': {
        var fx = {};
        STATS.forEach(function (k) { var d = 50 - s.stats[k]; fx[k] = clamp(d, -12, 12); });
        applyStats(s, fx, res, true, 0, 100);
        res.say = '중대 회식! 삼겹살과 함께 모든 게 제자리로 돌아왔다.';
        return res;
      }
      case 'pxpass': s.pxDay = s.day; s.money += 100000; res.say = 'PX 프리패스! 현금 10만 원과 함께 PX가 열렸다.'; res.events.push({ type: 'money', n: 100000 }); return res;
      case 'skip': {
        var c = getCardDef(s.current);
        if (c) s.seen[c.id] = s.day;
        res.say = '짬처리 완료. 아무 일도 없었던 걸로.';
        res.skipped = true;
        return finishTurn(s, res, 2 * s.pace);
      }
      default: return null;
    }
  }

  /* ── 엔딩 & 점수 ─────────────────────────── */
  function end(s, id, res) {
    s.over = { id: id, list: [id], good: !!(JY.ENDINGS[id] && JY.ENDINGS[id].good), day: s.day };
    s.over.score = score(s);
    res.ending = id;
    addLog(s, '엔딩: ' + (JY.ENDINGS[id] ? JY.ENDINGS[id].title : id));
  }

  function bffCount(s) { var n = 0; for (var k in s.bffs) if (s.bffs[k]) n++; return n; }

  function dischargeEndings(s) {
    var list = [];
    var st = s.stats;
    if (s.flags.catAdopt) list.push('cat');
    if (s.flags.gfStay) list.push('gf');
    if (s.flags.cast) list.push('cast');
    if (s.flags.special && s.flags.sharp) list.push('elite');
    if (s.flags.coinWin) list.push('rich');
    if (s.flags.hoobae && (st.bd >= 70 || (s.aff.hoobae || 0) >= BFF)) list.push('beloved');
    var balanced = true;
    for (var i = 0; i < STATS.length; i++) if (st[STATS[i]] < 30 || st[STATS[i]] > 75) balanced = false;
    if (balanced) list.push('model');
    if (s.flags.malchul) list.push('malchul');
    list.push('normal');
    return list;
  }

  function discharge(s, res) {
    var list = dischargeEndings(s);
    s.over = { id: list[0], list: list, good: true, day: s.total };
    s.over.score = score(s);
    res.ending = list[0];
    addLog(s, '전역!');
  }

  function bank(s) {
    var matched = s.over && s.over.good ? s.savings : 0;
    return { cash: s.money, savings: s.savings, matched: matched, total: s.money + s.savings + matched };
  }

  function score(s) {
    var o2 = s.over || { good: false, list: [], day: s.day };
    var served = o2.good ? s.total + 1 : s.day;
    var parts = [];
    function add(label, n) { if (n) parts.push({ label: label, n: Math.round(n) }); }
    add('복무 ' + served + '일 × 10', served * 10);
    if (o2.good) add('전역 성공', 3000);
    var eb = (JY.SCORE && JY.SCORE.endingBonus) || {};
    o2.list.forEach(function (id) { if (eb[id]) add((JY.ENDINGS[id] ? JY.ENDINGS[id].title : id) + ' 달성', eb[id]); });
    add('미니게임 대성공 ' + s.minis.great + '회', s.minis.great * 200);
    add('돌발 상황 대응 ' + s.emer.ok + '회', s.emer.ok * 150);
    add('절친 ' + bffCount(s) + '명', bffCount(s) * 300);
    if (o2.good) add('전역 통장', Math.floor(bank(s).total / 20000));
    var base = parts.reduce(function (a, p) { return a + p.n; }, 0);
    var mult = (s.pace === 3 ? 0.7 : 1) * (traitOf(s).scoreMult || 1) * (1 + heatBonus(s));
    var total = Math.round(base * mult);
    return { total: total, base: base, mult: mult, parts: parts, title: JY.scoreTitle ? JY.scoreTitle(total) : '' };
  }

  function progress(s) { return clamp(s.day / s.total, 0, 1); }
  function dateOf(s, offset) { return fmtDate(s.start + (offset === undefined ? s.day : offset) * DAY); }
  function nextPromo(s) {
    if (s.rank >= 4) return null;
    return { rank: RANKS[s.rank + 1], date: dateOf(s, s.promo[s.rank + 1]), inDays: Math.max(0, s.promo[s.rank + 1] - s.day) };
  }

  /* ── 오늘의 작전: 날짜로 정해지는 고정 조건 ─── */
  function dailyConfig(dateStr) {
    dateStr = dateStr || todayStr();
    var seed = seedFrom('jeonyeok-' + dateStr);
    var r = (seed >>> 0);
    function pickFrom(arr, salt) { return arr[((r ^ Math.imul(salt, 2654435761)) >>> 0) % arr.length]; }
    var mosIds = Object.keys(MOS);
    return {
      date: dateStr, seed: seed,
      unit: pickFrom(JY.UNIT_ORDER || ['gop'], 1),
      trait: pickFrom(JY.TRAIT_ORDER || ['lucky'], 7),
      mos: pickFrom(mosIds, 13),
      start: dateStr, pace: 3
    };
  }

  // 저장본 호환: 1판 저장(v1)에 새 필드 채우기
  function migrate(s) {
    if (!s) return s;
    if (!s.conds) s.conds = [];
    if (!s.aff) { s.aff = {}; if (JY.NPCS) for (var n in JY.NPCS) s.aff[n] = JY.NPCS[n].start; }
    if (!s.talkDay) s.talkDay = {};
    if (!s.bffs) s.bffs = {};
    if (!s.emer) s.emer = { count: 0, ok: 0, since: 0 };
    if (s.insight === undefined) s.insight = 0;
    if (s.luck === undefined) s.luck = 0;
    if (s.gems === undefined) s.gems = 0;
    if (s.insurance === undefined) s.insurance = 0;
    if (!s.unit) s.unit = 'gop';
    if (s.rng === undefined) s.rng = null;
    if (!s.up) s.up = {};
    if (!s.heat) s.heat = [];
    if (s.undo === undefined) s.undo = 0;
    if (!s.vlast) s.vlast = {};
    if (s.specials === undefined) s.specials = 0;
    s.v = 3;
    return s;
  }

  JY.Game = {
    STATS: STATS, STAT_NAMES: STAT_NAMES, RANKS: RANKS, MOS: MOS, MINI: MINI, PAY: PAY, BFF: BFF,
    SEASON_NAMES: SEASON_NAMES, LEAVE_MAX: LEAVE_MAX, TRAIN_DAYS: TRAIN_DAYS,
    newState: newState, currentCard: currentCard, choose: choose, finishMini: finishMini,
    leaveStatus: leaveStatus, takeLeave: takeLeave,
    pxStatus: pxStatus, pxPrice: pxPrice, buy: buy, closePX: closePX, useItem: useItem, usePremium: usePremium,
    talk: talk, gift: gift, poke: poke, npcAvailable: npcAvailable, bffCount: bffCount,
    daysLeft: daysLeft, progress: progress, dateOf: dateOf, nextPromo: nextPromo, bank: bank, score: score,
    dailyConfig: dailyConfig, migrate: migrate,
    fmtDate: fmtDate, todayStr: todayStr, getCardDef: getCardDef, preview: preview,
    unitOf: unitOf, traitOf: traitOf, condDef: condDef, heatBonus: heatBonus, heatHas: heatHas,
    _index: index, _eligible: eligible, _checkReq: checkReq, _view: view, _special: function (s) { return specialFor(s, view(s)); }, _setCur: function (s) { CUR = s; }
  };
})(window.JY = window.JY || {});
