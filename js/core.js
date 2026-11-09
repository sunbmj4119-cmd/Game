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

  /* ── 유틸 ───────────────────────────────── */
  function rand() { return (JY.rand || Math.random)(); }
  function randInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function asArr(x) { return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]; }

  /* 밸런스 조정표: 카드에 적힌 수치를 불러올 때 한 번 보정한다.
   * 카드 전체 평균이 체력·멘탈은 살짝 마이너스(시간이 갈수록 지친다 → 아이템·휴가로 회복),
   * 신뢰·전우애는 0 근처가 되도록 맞춘 값. tools/simulate.js로 검증. */
  var BALANCE = {
    pos: { hp: 1.0, mt: 0.75, tr: 0.85, bd: 0.6 },
    neg: { hp: 0.72, mt: 1.25, tr: 1.14, bd: 1.6 }
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
  function tuneCard(c) {
    if (c.tuned || (c.req && c.req.stat)) return; // 위기 경고 카드는 원래 수치 그대로
    c.tuned = true;
    [c.l, c.r].forEach(function (o) {
      tuneFx(o.fx);
      asArr(o.roll).forEach(function (r) { tuneFx(r.fx); });
      asArr(o.cases).forEach(function (r) { tuneFx(r.fx); });
    });
  }

  var INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    INDEX = {};
    var groups = [JY.CARDS.training, JY.CARDS.arrival, JY.CARDS.returns, JY.CARDS.pool, SPECIAL];
    for (var g = 0; g < groups.length; g++) for (var i = 0; i < groups[g].length; i++) {
      tuneCard(groups[g][i]);
      INDEX[groups[g][i].id] = groups[g][i];
    }
    return INDEX;
  }
  function getCardDef(id) { return index()[id]; }

  /* ── 새 게임 ─────────────────────────────── */
  function newState(opts) {
    opts = opts || {};
    var mos = MOS[opts.mos] ? opts.mos : 'infantry';
    var start = parseDate(opts.start || todayStr());
    var end = addMonths(start, 18) - DAY; // 전역일 = 입대일 + 18개월 - 1일
    var st = MOS[mos].start;
    var state = {
      v: 1,
      name: (opts.name || '나띨빵').slice(0, 8),
      face: opts.face || null,
      mos: mos,
      pace: opts.pace === 3 ? 3 : 1,
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
      log: [],
      pendingMini: null,
      over: null
    };
    var seq = JY.CARDS.training.concat(JY.CARDS.arrival);
    for (var i = 0; i < seq.length; i++) state.queue.push(seq[i].id);
    nextCard(state);
    return state;
  }

  /* ── 조건 검사 ───────────────────────────── */
  function daysLeft(s) { return Math.max(0, s.total - s.day); }

  function checkReq(s, req) {
    if (!req) return true;
    if (req.rank && (s.rank < req.rank[0] || s.rank > req.rank[1])) return false;
    if (req.season && asArr(req.season).indexOf(s.season) < 0) return false;
    if (req.mos && asArr(req.mos).indexOf(s.mos) < 0) return false;
    var f = asArr(req.flag);
    for (var i = 0; i < f.length; i++) if (!s.flags[f[i]]) return false;
    var nf = asArr(req.noflag);
    for (var j = 0; j < nf.length; j++) if (s.flags[nf[j]]) return false;
    if (req.vars) for (var k in req.vars) { var v = s.vars[k] || 0; if (v < req.vars[k][0] || v > req.vars[k][1]) return false; }
    if (req.stat) for (var q in req.stat) { var sv = s.stats[q]; if (sv < req.stat[q][0] || sv > req.stat[q][1]) return false; }
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

  function pickRandom(s) {
    var pool = JY.CARDS.pool, list = [], total = 0;
    for (var i = 0; i < pool.length; i++) {
      var c = pool[i];
      if (!eligible(s, c)) continue;
      var w = c.w || 1;
      if (c.who === s.lastWho) w *= 0.35;
      list.push([c, w]); total += w;
    }
    if (!list.length) return 'quiet';
    var r = rand() * total;
    for (var j = 0; j < list.length; j++) { r -= list[j][1]; if (r <= 0) return list[j][0].id; }
    return list[list.length - 1][0].id;
  }

  function nextCard(s) {
    var id = null;
    while (s.queue.length && !id) {
      var q = s.queue.shift();
      if (getCardDef(q)) id = q;
    }
    if (!id) id = pickRandom(s);
    s.current = id;
    return id;
  }

  /* ── 텍스트 치환 ─────────────────────────── */
  function fill(s, text) {
    return String(text || '')
      .replace(/\{name\}/g, s.name)
      .replace(/\{rank\}/g, RANKS[s.rank])
      .replace(/\{left\}/g, daysLeft(s))
      .replace(/\{leave\}/g, s.leave);
  }

  function currentCard(s) {
    var c = getCardDef(s.current);
    if (!c) { s.current = 'quiet'; c = getCardDef('quiet'); }
    return {
      id: c.id, who: c.who, bg: c.bg, extras: c.extras, meSpec: c.meSpec, meMood: c.meMood, meProp: c.meProp,
      catFish: c.catFish, catCap: c.catCap,
      text: fill(s, c.text),
      l: { t: fill(s, c.l.t), preview: preview(c.l) },
      r: { t: fill(s, c.r.t), preview: preview(c.r) }
    };
  }

  // 선택지가 건드리는 스탯 (Reigns처럼 방향은 숨기고 크기만 보여준다)
  function preview(opt) {
    var p = {};
    function add(fx) { for (var k in fx) { var a = Math.abs(fx[k]); if (a && (!p[k] || a > p[k])) p[k] = a; } }
    add(opt.fx || {});
    asArr(opt.roll).forEach(function (r) { add(r.fx || {}); });
    asArr(opt.cases).forEach(function (r) { add(r.fx || {}); });
    var out = {};
    for (var k in p) out[k] = p[k] >= 10 ? 'big' : 'small';
    if (opt.mini) out.mini = true;
    return out;
  }

  /* ── 결과 적용 ───────────────────────────── */
  function resolveOutcome(s, opt) {
    var out = {};
    var k;
    for (k in opt) out[k] = opt[k];
    out.fx = {};
    for (k in (opt.fx || {})) out.fx[k] = opt.fx[k];
    var extra = null;
    if (opt.roll) {
      var r = rand(), acc = 0;
      for (var i = 0; i < opt.roll.length; i++) { acc += opt.roll[i].p; if (r < acc || i === opt.roll.length - 1) { extra = opt.roll[i]; break; } }
    } else if (opt.cases) {
      for (var j = 0; j < opt.cases.length; j++) { if (!opt.cases[j].if || checkReq(s, opt.cases[j].if)) { extra = opt.cases[j]; break; } }
    }
    if (extra) {
      for (k in extra) {
        if (k === 'fx') { for (var f in extra.fx) out.fx[f] = (out.fx[f] || 0) + extra.fx[f]; }
        else if (k === 'say') { out.say = (out.say ? out.say + ' ' : '') + extra.say; }
        else if (k !== 'p' && k !== 'if') out[k] = extra[k];
      }
    }
    return out;
  }

  function applyStats(s, fx, res, soft) {
    var mos = MOS[s.mos];
    for (var k in fx) {
      if (STATS.indexOf(k) < 0) continue;
      var v = fx[k];
      if (v > 0 && mos.boost === k) v = Math.round(v * 1.25);
      var before = s.stats[k];
      var after = clamp(before + v, 0, 100);
      if (soft) { // 아이템/휴가: 5~95 바깥으로는 밀지 않는다
        if (v > 0) after = Math.max(before, Math.min(after, 95));
        else after = Math.min(before, Math.max(after, 5));
      }
      s.stats[k] = after;
      res.deltas[k] = (res.deltas[k] || 0) + (after - before);
    }
  }

  function gainLeave(s, n, res, why) {
    if (!n) return;
    if (n > 0 && s.mos === 'infantry') n = Math.ceil(n * 1.5);
    s.leave = Math.max(0, s.leave + n);
    if (n > 0) res.events.push({ type: 'leave', n: n, text: (why || '포상휴가') + ' +' + n + '일' });
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

  function edgeEnding(s) {
    for (var i = 0; i < STATS.length; i++) {
      var k = STATS[i];
      if (s.stats[k] <= 0) return k + '0';
      if (s.stats[k] >= 100) return k + '100';
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
      while (s.rank < 4 && s.day >= s.promo[s.rank + 1]) promote(s, res);
      var se = seasonOf(date.m);
      if (se !== s.season) { s.season = se; res.events.push({ type: 'season', season: se, text: SEASON_MSG[se] }); }
    }
  }

  function payday(s, res) {
    var pay = PAY[s.rank];
    var save = Math.min(SAVE_MONTHLY, pay);
    s.savings += save;
    s.money += pay - save;
    res.events.push({ type: 'pay', n: pay, cash: pay - save, save: save });
  }

  function promote(s, res) {
    var next = s.rank + 1;
    if (next >= 2 && s.stats.tr < 20 && s.delays[next] < 2) {
      // 2026년부터 자동 진급 폐지 — 심사에서 떨어지면 한 달 누락
      s.delays[next] += 1;
      s.promo[next] = firstOfMonthOffset(s.start + s.promo[next] * DAY, 1);
      for (var k = next + 1; k <= 4; k++) s.promo[k] = Math.max(s.promo[k], firstOfMonthOffset(s.start + s.promo[k] * DAY, 1));
      applyStats(s, { mt: -8 }, res);
      res.events.push({ type: 'promoFail', rank: next, text: RANKS[next] + ' 진급 누락! 간부 신뢰가 너무 낮다. 한 달 뒤 재심사.' });
      addLog(s, RANKS[next] + ' 진급 누락');
      // 무한 루프 방지: promo가 미래로 갔으니 while 탈출
      return;
    }
    s.rank = next;
    var add = LEAVE_ON_PROMO[next];
    s.leave += add;
    res.events.push({ type: 'promo', rank: next, leave: add, text: RANKS[next] + ' 진급!' + (add ? ' 휴가 +' + add + '일' : '') });
    addLog(s, RANKS[next] + ' 진급');
  }

  function cardDays(s, c, out) {
    if (out && out.days) return out.days;
    if (c.days) return c.days;
    return randInt(3, 6) * s.pace;
  }

  function finishTurn(s, res, days) {
    var e = edgeEnding(s);
    if (e) { end(s, e, res); return res; }
    var before = s.rank;
    advance(s, days, res);
    if (before < 1 && s.rank >= 1) addLog(s, '훈련소 수료, 자대 배치');
    if (s.day >= s.total) { discharge(s, res); return res; }
    e = edgeEnding(s); // 진급 누락 등으로 바뀐 경우
    if (e) { end(s, e, res); return res; }
    s.cards += 1;
    nextCard(s);
    return res;
  }

  function newRes() { return { say: '', deltas: {}, events: [], mini: null, ending: null }; }

  /* ── 플레이어 행동 ───────────────────────── */
  function choose(s, side) {
    if (s.over || s.pendingMini) return null;
    var c = getCardDef(s.current);
    var opt = side === 'l' || side === 'left' ? c.l : c.r;
    var out = resolveOutcome(s, opt);
    var res = newRes();
    applyOutcome(s, out, res);
    s.seen[c.id] = s.day;
    s.lastWho = c.who;
    if (res.ending) { end(s, res.ending, res); return res; }
    if (out.mini) {
      s.pendingMini = { id: out.mini, days: cardDays(s, c, out) };
      res.mini = out.mini;
      return res;
    }
    return finishTurn(s, res, cardDays(s, c, out));
  }

  function finishMini(s, tier) {
    var pm = s.pendingMini;
    if (!pm) return null;
    s.pendingMini = null;
    var def = MINI[pm.id];
    var r = def[tier] || def.good;
    var res = newRes();
    s.minis.played += 1;
    if (tier === 'great') s.minis.great += 1;
    applyOutcome(s, { fx: r.fx, say: r.say, set: r.set }, res);
    if (r.leave) gainLeave(s, r.leave, res);
    if (pm.id === 'shoot' && rand() < 0.3) s.queue.unshift('shell_lost');
    res.tier = tier;
    return finishTurn(s, res, pm.days);
  }

  /* ── 휴가 ───────────────────────────────── */
  function leaveStatus(s) {
    if (s.over) return { ok: false, reason: '게임이 끝났다.' };
    if (s.rank < 1) return { ok: false, reason: '훈련병은 휴가가 없다. 수료부터 하자.' };
    if (s.pendingMini) return { ok: false, reason: '지금은 바쁘다!' };
    if (s.leave < 1) return { ok: false, reason: '남은 휴가가 없다. 포상휴가를 노려보자.' };
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
  function pxStatus(s) {
    if (s.over) return { ok: false, reason: '' };
    if (s.rank < 1) return { ok: false, reason: '훈련소에는 PX가 없다(있어도 못 간다).' };
    if (s.pendingMini) return { ok: false, reason: '지금은 바쁘다!' };
    if (s.day < s.pxDay) return { ok: false, reason: 'PX는 개인정비 시간에만! ' + (s.pxDay - s.day) + '일 뒤 이용 가능.' };
    return { ok: true };
  }

  function buy(s, id) {
    var it = JY.ITEMS[id];
    if (!it || it.px === false) return false;
    if (s.money < it.price) return false;
    if ((s.items[id] || 0) >= 9) return false;
    s.money -= it.price;
    s.items[id] = (s.items[id] || 0) + 1;
    return true;
  }

  function closePX(s, bought) { if (bought) s.pxDay = s.day + 4 * s.pace; }

  function useItem(s, id) {
    if (s.over || !(s.items[id] > 0)) return null;
    var it = JY.ITEMS[id];
    var res = newRes();
    s.items[id] -= 1;
    applyStats(s, it.fx, res, true);
    return res;
  }

  /* ── 엔딩 ───────────────────────────────── */
  function end(s, id, res) {
    s.over = { id: id, list: [id], good: !!(JY.ENDINGS[id] && JY.ENDINGS[id].good), day: s.day };
    res.ending = id;
    addLog(s, '엔딩: ' + (JY.ENDINGS[id] ? JY.ENDINGS[id].title : id));
  }

  function dischargeEndings(s) {
    var list = [];
    var st = s.stats;
    if (s.flags.catAdopt) list.push('cat');
    if (s.flags.gfStay) list.push('gf');
    if (s.flags.cast) list.push('cast');
    if (s.flags.special && s.flags.sharp) list.push('elite');
    if (s.flags.coinWin) list.push('rich');
    if (s.flags.hoobae && st.bd >= 70) list.push('beloved');
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
    res.ending = list[0];
    addLog(s, '전역!');
  }

  function bank(s) {
    var matched = s.over && s.over.good ? s.savings : 0;
    return { cash: s.money, savings: s.savings, matched: matched, total: s.money + s.savings + matched };
  }

  function progress(s) { return clamp(s.day / s.total, 0, 1); }
  function dateOf(s, offset) { return fmtDate(s.start + (offset === undefined ? s.day : offset) * DAY); }
  function nextPromo(s) {
    if (s.rank >= 4) return null;
    return { rank: RANKS[s.rank + 1], date: dateOf(s, s.promo[s.rank + 1]), inDays: Math.max(0, s.promo[s.rank + 1] - s.day) };
  }

  JY.Game = {
    STATS: STATS, STAT_NAMES: STAT_NAMES, RANKS: RANKS, MOS: MOS, MINI: MINI, PAY: PAY,
    SEASON_NAMES: SEASON_NAMES, LEAVE_MAX: LEAVE_MAX, TRAIN_DAYS: TRAIN_DAYS,
    newState: newState, currentCard: currentCard, choose: choose, finishMini: finishMini,
    leaveStatus: leaveStatus, takeLeave: takeLeave,
    pxStatus: pxStatus, buy: buy, closePX: closePX, useItem: useItem,
    daysLeft: daysLeft, progress: progress, dateOf: dateOf, nextPromo: nextPromo, bank: bank,
    fmtDate: fmtDate, todayStr: todayStr, getCardDef: getCardDef, preview: preview,
    _index: index, _eligible: eligible, _checkReq: checkReq
  };
})(window.JY = window.JY || {});
