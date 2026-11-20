/* 제설각 v25 광고: 보상형(필요할 때 내가 골라서) + 전면(일정 판수가 지난 뒤, 쉬는 틈에만)
 * - 앱(안드로이드)에서는 Capacitor AdMob 플러그인이 있으면 실제 광고를 띄운다 (아래 ID는 구글 공식 테스트 광고 ID — 출시 전 내 광고 단위 ID로 바꾼다)
 * - 웹(지금 링크)에서는 "광고 자리" 화면을 몇 초 보여 주고 끝난다 (실제 광고 아님)
 * 규칙(빈도·하루 한도)은 여기 한곳에 모아 두고 테스트한다 */
(function (JY) {
  'use strict';
  var S = JY.SNOW, G = JY.SnowSim;

  var ADS = S.ADS = {
    unit: {   // 구글 AdMob 공식 테스트 광고 단위 (출시 때 내 것으로 교체)
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
      interstitial: 'ca-app-pub-3940256099942544/1033173712'
    },
    // 전면 광고: 처음 6판은 없다 → 그 뒤 3판마다, 결과 화면에서 생활관으로 넘어갈 때만. 3분 간격 · 하루 8번까지
    // 방금(최근 2판 안) 보상형 광고를 봤으면 이번 전면 광고는 건너뛴다 (보상형을 고른 사람에게 덜 귀찮게)
    inter: { fromOps: 6, every: 3, gapSec: 180, perDay: 8, skipAfterRewarded: 2 },
    // 보상형 광고: 필요할 때 내가 누른다. 하루 한도
    rewarded: {
      double: { name: '결과 2배', perDay: 10 },
      extend: { name: '30초 더', perDay: 5, sec: 30 },
      energy: { name: '출동 체력 +15', perDay: 3, amount: 15 },
      box: { name: '무료 상자 바로 열기', perDay: 2 },
      dia: { name: '상점 +2', perDay: 3, amount: 2 }
    },
    mockSec: { rewarded: 4, interstitial: 3 },
    testing: true   // 출시 전에 false로 (테스트 기기 등록용)
  };

  function dayKey(now) { var d = new Date(now); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function st(save, now) {
    var a = save.ads = save.ads || { day: '', n: {}, inter: 0, lastInter: 0, sinceInter: 0, lastRew: -99, ops: 0, noAds: false, watched: 0 };
    var dk = dayKey(now || Date.now()); if (a.day !== dk) { a.day = dk; a.n = {}; a.inter = 0; }
    return a;
  }
  // 보상형: 오늘 몇 번 남았나
  function left(save, id, now) { var a = st(save, now), R = ADS.rewarded[id]; return R ? Math.max(0, R.perDay - (a.n[id] || 0)) : 0; }
  function can(save, id, now) { return left(save, id, now) > 0; }
  function used(save, id, now) { var a = st(save, now); a.n[id] = (a.n[id] || 0) + 1; a.lastRew = a.ops; a.watched++; }
  // 작전이 하나 끝날 때마다
  function onOpEnd(save, now) { var a = st(save, now); a.ops++; a.sinceInter++; }
  // 전면 광고를 지금 보여 줄 차례인가 (결과 → 생활관 넘어갈 때 부른다)
  function interDue(save, now) {
    var a = st(save, now), I = ADS.inter; now = now || Date.now();
    if (a.noAds) return false;
    if (a.ops < I.fromOps) return false;
    if (a.sinceInter < I.every) return false;
    if (a.inter >= I.perDay) return false;
    if (now - (a.lastInter || 0) < I.gapSec * 1000) return false;
    if (a.ops - a.lastRew <= I.skipAfterRewarded) return false;
    return true;
  }
  function interShown(save, now) { var a = st(save, now); a.inter++; a.lastInter = now || Date.now(); a.sinceInter = 0; }
  // 광고 보상 지급 (UI가 광고를 끝까지 본 뒤 부른다)
  function grant(save, id, now, ctx) {
    var R = ADS.rewarded[id], out = {};
    if (id === 'energy' && JY.SnowGear) { JY.SnowGear.energy(save, now); save.energy.v += R.amount; out.energy = R.amount; }
    else if (id === 'dia') { save.dia += R.amount; save.diaLife = (save.diaLife || 0) + R.amount; out.dia = R.amount; }
    else if (id === 'box' && JY.SnowGear) { var ch = JY.SnowGear.chestDef('basic'); JY.SnowGear.init(save); save.chestT.basic = (now || Date.now()) - ch.free * 1000 - 1000; out.open = JY.SnowGear.open(save, 'basic', 'free', now || Date.now()); }
    else if (id === 'double' && ctx) { var add = Math.round(ctx.pie || 0); save.bank += add; save.life = (save.life || 0) + add; out.pie = add; }
    used(save, id, now);
    return out;
  }

  /* ── 광고를 실제로 띄우는 쪽 ── */
  function native() { var C = window.Capacitor; return C && C.Plugins && C.Plugins.AdMob ? C.Plugins.AdMob : null; }
  // 웹: '광고 자리' 화면 (몇 초 뒤 닫기). 보상형은 끝까지 봐야 보상, 중간에 닫으면 없음
  function mock(kind, done) {
    var sec = ADS.mockSec[kind], el = document.createElement('div'), ok = false;
    el.className = 'ad-mock'; el.setAttribute('role', 'dialog');
    el.innerHTML = '<div class="ad-box"><small class="ad-tag">광고</small><div class="ad-art"><b>광고 자리</b><span>출시판(앱)에서는 여기에 ' + (kind === 'rewarded' ? '보상형 동영상' : '전면') + ' 광고가 나온다</span></div>' +
      '<p class="ad-left" id="ad-left">' + sec + '초</p><button class="btn ghost ad-x" id="ad-x" hidden>' + (kind === 'rewarded' ? '보상 받고 닫기' : '닫기') + '</button>' +
      (kind === 'rewarded' ? '<button class="ad-skip" id="ad-skip">그만 보기 (보상 없음)</button>' : '') + '</div>';
    document.body.appendChild(el);
    var t = sec, iv = setInterval(function () {
      t--; var l = document.getElementById('ad-left'); if (l) l.textContent = t > 0 ? t + '초' : '끝!';
      if (t <= 0) { clearInterval(iv); ok = true; var x = document.getElementById('ad-x'); if (x) x.hidden = false; var sk = document.getElementById('ad-skip'); if (sk) sk.hidden = true; }
    }, 1000);
    function close(got) { clearInterval(iv); if (el.parentNode) el.parentNode.removeChild(el); done(got); }
    el.querySelector('#ad-x').onclick = function () { close(ok); };
    var sk = el.querySelector('#ad-skip'); if (sk) sk.onclick = function () { close(false); };
  }
  // 앱: 처음 한 번 — 개인정보 동의(UMP, 필요한 지역에서만 창이 뜬다) → AdMob 시작
  var ready = null;
  function initNative(A) {
    if (ready) return ready;
    ready = Promise.resolve().then(function () { return A.requestConsentInfo(); })
      .then(function (ci) { return ci && ci.isConsentFormAvailable && ci.status === 'REQUIRED' ? A.showConsentForm() : ci; })
      .catch(function () { return null; })
      .then(function () { return A.initialize({ initializeForTesting: !!ADS.testing }); });
    return ready;
  }
  function off(list) { list.forEach(function (h) { Promise.resolve(h).then(function (x) { if (x && x.remove) x.remove(); }).catch(function () {}); }); }
  function showRewarded(done) {
    var A = native();
    if (!A) return mock('rewarded', done);
    var got = false, fin = false, subs = [];
    function end(v) { if (fin) return; fin = true; off(subs); done(v); }
    try {
      subs.push(A.addListener('onRewardedVideoAdReward', function () { got = true; }));
      subs.push(A.addListener('onRewardedVideoAdDismissed', function () { end(got); }));
      subs.push(A.addListener('onRewardedVideoAdFailedToShow', function () { end(false); }));
      initNative(A).then(function () { return A.prepareRewardVideoAd({ adId: ADS.unit.rewarded }); }).then(function () { return A.showRewardVideoAd(); }).catch(function () { end(false); });
    } catch (e) { end(false); }
  }
  function showInterstitial(done) {
    var A = native();
    if (!A) return mock('interstitial', function () { done(true); });
    var fin = false, subs = [];
    function end(v) { if (fin) return; fin = true; off(subs); done(v); }
    try {
      subs.push(A.addListener('interstitialAdDismissed', function () { end(true); }));
      initNative(A).then(function () { return A.prepareInterstitial({ adId: ADS.unit.interstitial }); }).then(function () { return A.showInterstitial(); }).catch(function () { end(false); });
      setTimeout(function () { end(false); }, 60000);   // 광고가 안 닫히는 일이 있어도 게임은 이어진다
    } catch (e) { end(false); }
  }

  JY.SnowAds = { ADS: ADS, state: st, left: left, can: can, used: used, onOpEnd: onOpEnd, interDue: interDue, interShown: interShown, grant: grant, showRewarded: showRewarded, showInterstitial: showInterstitial, isNative: function () { return !!native(); } };
})(window.JY = window.JY || {});
