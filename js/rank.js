/* 랭킹: 내 기기 기록 + (Claude 아티팩트에서 열면) 전군 랭킹 공유 저장소
 * 저장 구조: rank/<사용자 id> 문서 하나에 본인 최고 기록과 오늘의 작전 기록
 * 규칙(게시할 때 선언): 모두 읽기 · 각자 자기 문서만 쓰기 · 주인은 정리 가능 */
(function (JY) {
  'use strict';

  var R = { online: false, canWrite: false, uid: null, reason: '' };
  var db = null;
  var readyP = null;

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'timeout' }); }, ms); })]);
  }

  function init() {
    if (readyP) return readyP;
    readyP = (function () {
      var c = window.claude;
      if (!c || typeof c.use !== 'function') {
        R.reason = '전군 랭킹은 Claude 아티팩트 링크로 열었을 때만 열린다. 지금은 내 기기 기록만 볼 수 있다.';
        return Promise.resolve(R);
      }
      return Promise.all([c.use('db'), c.use('user')]).then(function (r) {
        db = r[0];
        var user = r[1];
        if (!db) { R.reason = '전군 랭킹에 연결할 수 없다(로그인이 필요할 수 있다).'; return R; }
        R.online = true;
        if (!user) { R.reason = '랭킹은 볼 수 있지만, 기록을 올리려면 로그인이 필요하다.'; return R; }
        return Promise.all([user.id(), user.can ? user.can('data.write') : Promise.resolve(null)]).then(function (x) {
          R.uid = x[0];
          R.canWrite = !!R.uid && x[1] !== false;
          if (!R.uid) R.reason = '랭킹은 볼 수 있지만, 기록을 올리려면 로그인이 필요하다.';
          else if (!R.canWrite) R.reason = '보기 전용 권한이라 기록을 올릴 수 없다. 공유받을 때 참여(Contributor) 권한이 필요하다.';
          return R;
        });
      }).catch(function () { R.reason = '전군 랭킹 연결에 실패했다.'; return R; });
    })();
    return readyP;
  }

  function clean(d, id) {
    var n = function (v, max) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0; };
    var str = function (v, len) { return String(v || '').slice(0, len); };
    return {
      id: id, name: str(d.name, 8) || '무명', score: n(d.score, 200000), title: str(d.title, 12), ending: str(d.ending, 12),
      unit: str(d.unit, 12), mos: str(d.mos, 12), cos: str(d.cos, 16), days: n(d.days, 600),
      dDate: str(d.dDate, 10), dScore: n(d.dScore, 200000), dName: str(d.dName, 8), dEnding: str(d.dEnding, 12), at: n(d.at, 9e15)
    };
  }

  // 한 판 끝날 때: 내 최고 기록 / 오늘의 작전 기록이 갱신되면 올린다
  function submit(rec) {
    return init().then(function () {
      if (!R.online || !R.canWrite) return { ok: false, reason: R.reason };
      var ref = db.doc('rank/' + R.uid);
      return withTimeout(ref.get(), 10000).then(function (snap) {
        var cur = snap.exists ? clean(snap.data(), R.uid) : clean({}, R.uid);
        var t = JY.Game.todayStr();
        var changed = false;
        var next = {
          name: cur.name, score: cur.score, title: cur.title, ending: cur.ending, unit: cur.unit, mos: cur.mos, cos: cur.cos, days: cur.days,
          dDate: cur.dDate, dScore: cur.dScore, dName: cur.dName, dEnding: cur.dEnding, at: Date.now()
        };
        if (!snap.exists || rec.score > cur.score) {
          next.name = rec.name; next.score = rec.score; next.title = rec.title; next.ending = rec.ending;
          next.unit = rec.unit; next.mos = rec.mos; next.cos = rec.cos; next.days = rec.days;
          changed = true;
        }
        if (rec.daily === t && (cur.dDate !== t || rec.score > cur.dScore)) {
          next.dDate = t; next.dScore = rec.score; next.dName = rec.name; next.dEnding = rec.ending;
          changed = true;
        }
        if (!changed) return { ok: true, changed: false };
        return withTimeout(ref.set(next), 10000).then(function () { return { ok: true, changed: true }; });
      });
    }).catch(function (e) {
      if (e && e.code === 'invalid_argument') { R.canWrite = false; R.reason = '이 화면에서는 기록을 올릴 권한이 없다.'; }
      return { ok: false, reason: (e && e.code === 'timeout') ? '랭킹 서버 응답이 늦다. 다음에 다시 올라간다.' : R.reason || '기록을 올리지 못했다.' };
    });
  }

  function top(kind) {
    return init().then(function () {
      if (!R.online) return { ok: false, reason: R.reason, list: [] };
      var col = db.collection('rank');
      var q = kind === 'daily'
        ? col.where('dDate', '==', JY.Game.todayStr()).orderBy('dScore', 'desc').limit(50)
        : col.orderBy('score', 'desc').limit(50);
      return withTimeout(q.get(), 10000).then(function (snap) {
        var list = snap.docs.map(function (d) { return clean(d.data() || {}, d.id); })
          .filter(function (x) { return kind === 'daily' ? x.dScore > 0 : x.score > 0; });
        return { ok: true, list: list, me: R.uid, fromCache: snap.metadata && snap.metadata.fromCache };
      });
    }).catch(function (e) {
      return { ok: false, list: [], reason: e && e.code === 'timeout' ? '전군 랭킹을 아직 불러오지 못했다. 잠시 후 새로고침.' : '전군 랭킹을 불러오지 못했다.' };
    });
  }

  JY.Rank = { init: init, submit: submit, top: top, status: function () { return R; } };
})(window.JY = window.JY || {});
