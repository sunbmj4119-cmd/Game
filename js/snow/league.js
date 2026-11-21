/* 제설각 v26 대대 제설 경연: 일주일(월요일 0시 ~ 일요일 밤) 동안 작전 점수를 모아 다른 중대 병사 9명과 겨룬다
 * - 상대는 게임 속 인물(AI)이다. 성향(새벽형·주말 몰아치기·꾸준형…)대로 주중에 점수가 오른다 → 며칠 쉬면 따라잡힌다
 * - 주가 끝나면 3위 안 = 승급, 9·10위 = 강등 (분대 → 소대 → 중대 → 대대 → 연대 → 사단 리그), 순위만큼 상점
 * - 실제 사람끼리의 순위는 서버가 있어야 한다 → 앱 출시 때 구글 플레이 게임즈 순위표로 (docs/SNOW-V26.md) */
(function (JY) {
  'use strict';
  var S = JY.SNOW;
  var L = S.LEAGUE = {
    tiers: ['분대 리그', '소대 리그', '중대 리그', '대대 리그', '연대 리그', '사단 리그'],
    base: [6000, 14000, 26000, 42000, 62000, 88000],   // 상대 9명의 '보통' 주간 점수 (리그마다)
    spread: [0.3, 0.5, 0.65, 0.8, 0.95, 1.1, 1.3, 1.55, 1.9],
    up: 3, down: 2,
    reward: [12, 8, 6, 4, 3, 2, 2, 1, 1, 1],
    units: ['1중대', '2중대', '3중대', '본부중대', '공병중대', '수송부', '의무대', '취사반', '통신소대', '정비대'],
    names: ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'],
    given: ['민수', '지훈', '현우', '도윤', '준서', '태양', '성민', '건우', '재원', '동현', '우진', '시우', '승현', '진호', '대현', '경민'],
    styles: [
      { id: 'steady', name: '꾸준형', line: '매일 조금씩' },
      { id: 'early', name: '초반 질주', line: '월요일부터 달린다' },
      { id: 'late', name: '주말 몰아치기', line: '주말에 확 오른다' },
      { id: 'dawn', name: '새벽형', line: '새벽마다 쭉쭉' },
      { id: 'burst', name: '기분파', line: '몰아쳤다 쉬었다' }
    ]
  };

  function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function monday(now) { var d = new Date(now); var wd = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd).getTime(); }
  function weekKey(now) { var m = new Date(monday(now)); return m.getFullYear() + '-' + (m.getMonth() + 1) + '-' + m.getDate(); }
  function weekFrac(now) { return Math.max(0, Math.min(1, (now - monday(now)) / (7 * 86400000))); }
  function leftSec(now) { return Math.max(0, Math.round((monday(now) + 7 * 86400000 - now) / 1000)); }

  function st(save, now) {
    var g = save.league;
    if (!g) g = save.league = { week: weekKey(now), tier: 0, score: 0, ops: 0, best: 0, last: null, seen: '' };
    return g;
  }
  // 성향별 주간 진행 곡선 (0~1)
  function curve(style, f, R) {
    if (style === 'early') return Math.sqrt(f);
    if (style === 'late') return f * f;
    if (style === 'dawn') { var days = Math.floor(f * 7), part = f * 7 - days; return Math.min(1, (days + Math.min(1, part * 4)) / 7); }   // 하루의 처음 1/4에 몰아서
    if (style === 'burst') { var k = 0, t = 0; for (var i = 0; i < 7; i++) { var w = 0.3 + R() * 1.7; t += w; if (i < Math.floor(f * 7)) k += w; else if (i === Math.floor(f * 7)) k += w * (f * 7 - i); } return Math.min(1, k / t); }
    return f;
  }
  // 이번 주 상대 9명 (주 · 리그 · 내 시드로 정해진다)
  function rivals(save, now) {
    var g = st(save, now), key = g.week + ':' + g.tier + ':' + (save.seed || 0), R = mul(hashStr(key)), f = weekFrac(now);
    var sp = L.spread.slice().sort(function () { return R() - 0.5; });
    var out = [];
    for (var i = 0; i < 9; i++) {
      var style = L.styles[(R() * L.styles.length) | 0], target = L.base[g.tier] * sp[i] * (0.9 + R() * 0.2);
      var Rc = mul(hashStr(key + ':c' + i));
      var nm = L.names[(R() * L.names.length) | 0] + L.given[(R() * L.given.length) | 0], unit = L.units[(R() * L.units.length) | 0];
      var rk = ['이병', '일병', '상병', '병장'][Math.min(3, Math.floor(R() * 2 + g.tier * 0.6))];
      out.push({ id: 'r' + i, name: rk + ' ' + nm, unit: unit, style: style, score: Math.round(target * curve(style.id, f, Rc) / 10) * 10, seed: key + i, face: { eyes: ['derp', 'happy', 'sleepy', 'smug', 'dot', 'wide', 'worried', 'angry'][(R() * 8) | 0], mouth: ['wavy', 'grin', 'smirk', 'open', 'cat', 'o', 'flat'][(R() * 7) | 0] } });
    }
    return out;
  }
  // 순위표: 나 + 상대 9명, 점수 순
  function table(save, now) {
    var g = st(save, now), rows = rivals(save, now).concat([{ id: 'me', name: '나', me: true, score: g.score, unit: '' }]);
    rows.sort(function (a, b) { return b.score - a.score || (a.me ? -1 : b.me ? 1 : 0); });
    rows.forEach(function (r, i) { r.rank = i + 1; r.zone = i < L.up && g.tier < L.tiers.length - 1 ? 'up' : i >= rows.length - L.down && g.tier > 0 ? 'down' : ''; });
    return rows;
  }
  function myRank(save, now) { var t = table(save, now); for (var i = 0; i < t.length; i++) if (t[i].me) return t[i].rank; return 10; }
  // 작전 하나 점수: ★×100 + 치운 정도 + 콤보 + 일찍 보고 − 지적
  function opScore(res, comboMax) {
    if (!res || res.demo) return 0;
    var p = (res.stars || 0) * 100 + Math.round(Math.max(0, Math.min(1.2, res.score || 0)) * 100) + Math.min(80, Math.floor((comboMax || 0) / 5)) + (res.early ? 40 : 0) - (res.jigeok || 0) * 25;
    return Math.max(10, p);
  }
  // 주가 바뀌었으면 지난주를 마감한다 (보상 · 승강). 결과를 돌려준다 (생활관에서 한 번 보여 준다)
  function rollover(save, now) {
    var g = st(save, now), wk = weekKey(now);
    if (g.week === wk) return null;
    // 지난주 마지막 순간 기준으로 마감
    var endT = monday(now) - 1, fake = { seed: save.seed, league: { week: g.week, tier: g.tier, score: g.score } };
    var rank = g.ops ? myRank(fake, endT) : 10;
    var tier0 = g.tier, moved = 0;
    if (g.ops && rank <= L.up && g.tier < L.tiers.length - 1) { g.tier++; moved = 1; }
    else if (rank > 10 - L.down && g.tier > 0) { g.tier--; moved = -1; }
    var dia = g.ops ? L.reward[rank - 1] + tier0 : 0, box = g.ops && rank === 1 ? 'rare' : null;
    if (dia) { save.dia += dia; save.diaLife = (save.diaLife || 0) + dia; }
    if (box) { save.boxes = save.boxes || []; save.boxes.push(box); }
    g.last = { week: g.week, rank: rank, tier: tier0, newTier: g.tier, moved: moved, dia: dia, box: box, score: g.score, ops: g.ops };
    g.week = wk; g.score = 0; g.ops = 0; g.best = 0; g.seen = '';
    return g.last;
  }
  function addOp(save, pts, now) {
    rollover(save, now);
    var g = st(save, now), before = myRank(save, now);
    g.score += pts; g.ops++; g.best = Math.max(g.best || 0, pts);
    var after = myRank(save, now), t = table(save, now), meI = after - 1, ahead = meI > 0 ? t[meI - 1] : null;
    return { pts: pts, before: before, after: after, score: g.score, gap: ahead ? ahead.score - g.score + 10 : 0, ahead: ahead ? ahead.name : '', tier: g.tier };
  }

  JY.SnowLeague = { L: L, state: st, weekKey: weekKey, weekFrac: weekFrac, leftSec: leftSec, rivals: rivals, table: table, myRank: myRank, opScore: opScore, rollover: rollover, addOp: addOp };
})(window.JY = window.JY || {});
