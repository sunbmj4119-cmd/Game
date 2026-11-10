/* 시뮬레이션용 가상 플레이어 (DOM 없이 JY.Game만 쓴다)
 * step(s, skill, opts) 를 게임이 끝날 때까지 부르면 한 판을 둔다.
 *  - 카드: 기대 효과로 스탯을 가운데(50)에 가깝게 하는 쪽을 skill 확률로 고른다
 *  - 위험하면 가방 아이템·요리를 쓴다, PX에서 재료를 사 둔다
 *  - 자대 지도: 행동마다 (스탯이 가운데로 가는 정도 + 득템·휴가·특기 보너스 - 걸릴 위험)을 따져 고르고,
 *    좋은 행동이 없으면 쉬고 취침. 재료가 모이면 조합한다.
 *  - 미니게임 등급은 실력에 따라 */
'use strict';
module.exports = function (JY) {
  var G = JY.Game;
  function exp(o) { var fx = {}; function add(s, w) { for (var k in s) fx[k] = (fx[k] || 0) + s[k] * w; } add(o.fx || {}, 1); (o.roll || []).forEach(function (r) { add(r.fx || {}, r.p); }); return fx; }
  function sc(s, fx) { var t = 0; G.STATS.forEach(function (k) { var v = s.stats[k] + (fx[k] || 0); t -= (v - 50) * (v - 50); if (v <= 4 || v >= 96) t -= 1e5; }); return t; }
  function tier(skill) { var r = Math.random(); return r < 0.15 + 0.35 * skill ? 'great' : r < 0.55 + 0.35 * skill ? 'good' : 'bad'; }

  function useItems(s, skill) {
    if (Math.random() >= skill) return;
    G.STATS.forEach(function (k) {
      var v = s.stats[k]; if (v > 22 && v < 78) return;
      for (var id in s.items) {
        if (!(s.items[id] > 0)) continue;
        var fx = JY.ITEMS[id].fx || {}, f = fx[k] || 0;
        if (!((v <= 22 && f > 0) || (v >= 78 && f < 0))) continue;
        if (G.STATS.some(function (o) { return o !== k && fx[o] && (s.stats[o] + fx[o] <= 15 || s.stats[o] + fx[o] >= 85); })) continue;
        G.useItem(s, id); break;
      }
    });
  }
  function shop(s) {
    if (!G.pxStatus(s).ok || s.money < 20000 || Math.random() >= 0.5) return;
    if (s.phase === 'unit' && s.ap < 1) return;
    ['ramen', 'mandu', 'hotbar', 'chocopie', 'coffee', 'milk', 'tuna', 'hot6', 'comic'].forEach(function (id) { if ((s.items[id] || 0) < 2) G.buy(s, id); });
    G.closePX(s, true);
  }
  function crafts(s) {
    (JY.BASE.recipes || []).forEach(function (R) { var g = 0; while (G.recipeStatus(s, R).ok && g++ < 3) G.craft(s, R.id); });
  }
  function card(s, skill, see) {
    var v = G._view(s);
    var best = sc(s, exp(v.l)) >= sc(s, exp(v.r)) ? 'l' : 'r';
    var side = Math.random() < skill ? best : (best === 'l' ? 'r' : 'l');
    if (G._special(s) && Math.random() < 0.5) side = 'x';
    if (G.getCardDef(s.current).urgent && Math.random() < 0.15) side = 't';
    if (see) see(G.currentCard(s).key);
    var res = G.choose(s, side);
    if (res && res.mini) G.finishMini(s, tier(skill));
  }
  function free(s, skill, stats) {
    var ls = G.leaveStatus(s);
    if (ls.ok && (s.leave >= G.daysLeft(s) || (s.stats.mt < 25 && s.stats.hp < 70 && s.leave > 6))) { G.takeLeave(s, Math.min(s.leave, ls.max)); return; }
    if (s.ap <= 0) { G.endFree(s); return; }
    var opts = [];
    G.locations(s).forEach(function (L) {
      L.acts.forEach(function (A) {
        if (!A.ok || A.special) return;
        var fx = A.fx || {};
        var v = sc(s, fx) - sc(s, {});
        if (A.danger) v -= 1e5;
        v += (A.loot ? 40 : 0) + (A.leave ? 60 : 0) + (A.spec ? 30 : 0) + (A.mini ? 15 : 0) - A.risk * 300;
        opts.push({ l: L.id, a: A.id, v: v });
      });
    });
    if (!opts.length) { G.endFree(s); return; }
    opts.sort(function (a, b) { return b.v - a.v; });
    var pick = Math.random() < skill ? opts[0] : opts[Math.floor(Math.random() * opts.length)];
    if (pick.v < -150 && Math.random() < skill) { G.endFree(s); return; } // 할 만한 게 없으면 쉰다
    var r = G.doAction(s, pick.l, pick.a);
    if (stats && r) { stats.acts++; if (r.loot) stats.loot += r.loot.length; if (r.caught) stats.caught++; }
    if (r && r.mini) G.finishMini(s, tier(skill));
  }
  // 한 걸음
  function step(s, skill, opts) {
    opts = opts || {};
    if (s.over) return;
    if (s.pendingMini) { G.finishMini(s, tier(skill)); return; }
    useItems(s, skill);
    if (s.phase === 'unit') { crafts(s); if (!s.current && s.step === 'free') shop(s); }
    else shop(s);
    if (s.over) return;
    if (s.current) { card(s, skill, opts.see); return; }
    if (s.phase === 'unit' && s.step === 'free') { free(s, skill, opts.stats); return; }
    G.endFree(s);
  }
  function play(s, skill, opts) {
    var g = 0;
    while (!s.over && g++ < 2000) step(s, skill, opts);
    return s;
  }
  return { step: step, play: play, sc: sc, exp: exp };
};
