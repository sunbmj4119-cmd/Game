/* 전역각 — 화면, 스와이프, 모달, 상점, 랭킹, 저장 */
(function (JY) {
  'use strict';

  var G = JY.Game, A = JY.art, Meta = JY.Meta;
  var KEYS = { save: 'jy.save.v1', settings: 'jy.settings.v1' };
  var NAMES = ['나띨빵', '김어리', '박허당', '최멍청', '이덤덤', '정어벙', '강감자', '조뚝딱', '윤헐랭', '한삽질'];
  var ICON = { hp: '체력', mt: '멘탈', tr: '간부 신뢰', bd: '전우애' };
  var SHORT = { hp: '체력', mt: '멘탈', tr: '신뢰', bd: '전우애' };
  var HINTS = {
    normal: '그냥 끝까지 버텨라', model: '네 가지 스탯을 고르게 유지', malchul: '휴가를 아꼈다가 마지막에',
    cat: '짬통 앞 고양이와 친해져라', gf: '여자친구를 끝까지 챙겨라', cast: '말년에 낙엽을 조심하지 마라',
    elite: '특급전사와 특등사수를 둘 다', rich: '맞선임의 수상한 투자 권유', beloved: '후임에게 사랑받는 선임',
    hp0: '체력이 바닥나면', hp100: '체력이 넘쳐흐르면', mt0: '멘탈이 바닥나면', mt100: '멘탈이 넘쳐흐르면',
    tr0: '간부 신뢰가 바닥나면', tr100: '간부 신뢰가 넘쳐흐르면', bd0: '전우애가 바닥나면', bd100: '전우애가 넘쳐흐르면',
    desert: '멘탈이 바닥일 때의 유혹', awol: '휴가 복귀 시간을 어기면'
  };
  var PROMO_TEXT = {
    1: '훈련소 수료! 이제 진짜 자대 생활이다.',
    2: '작대기 두 개! 이제 막내는 아니다(아마도).',
    3: '상병 꺾였다! 짬이 차오르는 소리가 들린다.',
    4: '병장 진급! 말년의 시작. 떨어지는 낙엽을 조심하라.'
  };
  var LINES = {
    captain: ['열정!', '우리 중대가 최고다!', '나도… 집에 가고 싶다…', '대대장님 오신다! 아 아니구나'],
    lt: ['저… 이거 맞나요?', '병장님 도와주세요…', '국가란… 국가입니다.'],
    cook: ['오늘 메뉴는 비밀!', '간은… 안 봤다!', '군대리아 수요일 사수!'],
    doc: ['타이레놀.', '물 많이 마시고.', '다음.'],
    general: ['허허허.', '불편한 점 없나?', '기백이 좋구먼!'],
    mom: ['밥은 먹었니?', '엄마 바빠~', '아들 사랑해!'],
    gf: ['보고 싶어!', '휴가 언제 나와?', '오빠 군복 멋있다 ㅎㅎ'],
    jogyo: ['동작 봐라!', '목소리 작다!', '하나 더!'],
    barber: ['어떻게 잘라드릴까요~', '투블럭? 없습니다~'],
    counselor: ['괜찮아요.', '천천히 말해요.', '오늘 하루 어땠어요?'],
    duty: ['취침 시간이다.', '휴대폰 반납!', '이상 무?'],
    medic: ['어디 아파요?', '빨간약 발라줄까요?'],
    driver: ['라디오 틀까?', '안전벨트!'],
    clerk: ['수정4…', '엑셀이 또 멈췄다…'],
    trainee: ['조교님…', '집에 가고 싶습니다…'],
    idol: ['반짝반짝!', '팬 사인회는 개인정비 시간에!'],
    boar: ['꿀꿀!!!', '(콧김)'],
    speaker: ['아아, 마이크 테스트.', '(지지직)'],
    me: ['…전역하고 싶다.', '나는 누구 여긴 어디', '오늘 짬밥 뭐임?'],
    letter: ['(바스락)'], phone: ['(지이잉)'], box: ['(엄마 냄새)']
  };

  var state = null;
  var settings = null;
  var busy = false;
  var armed = null;
  var drag = null;
  var setup = { face: null, mos: 'infantry', traits: [], trait: null, rerolled: false };
  var urgentTimer = null;
  var lastEnd = null;

  /* ── 저장소 ───────────────────────────── */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  function save() { if (state && !state.over) lsSet(KEYS.save, state); }
  function loadSave() {
    var s = lsGet(KEYS.save, null);
    if (!s || !s.stats || s.over) return null;
    s = G.migrate(s);
    if (!G.getCardDef(s.current)) s.current = 'quiet';
    return s;
  }

  /* ── 도우미 ───────────────────────────── */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function won(n) {
    var abs = Math.abs(n), sign = n < 0 ? '-' : '';
    if (abs >= 10000) {
      var man = Math.floor(abs / 10000), rest = abs % 10000;
      return sign + man.toLocaleString('ko-KR') + '만' + (rest ? ' ' + rest.toLocaleString('ko-KR') : '') + '원';
    }
    return sign + abs.toLocaleString('ko-KR') + '원';
  }
  function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function snd(name) { if (JY.Sound && JY.Sound[name]) JY.Sound[name](); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  var toastTimer = 0;
  function toast(text, ms) {
    var t = $('#toast');
    t.textContent = text; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2200);
  }

  var SCREENS = ['scr-title', 'scr-setup', 'scr-game', 'scr-end', 'scr-album', 'scr-rank', 'scr-shop', 'scr-barracks'];
  function showScreen(id) {
    SCREENS.forEach(function (s) { document.getElementById(s).hidden = s !== id; });
    if (id === 'scr-game') requestAnimationFrame(fitCard);
    var el = document.getElementById(id); if (el) el.scrollTop = 0;
  }

  // 게임 엔진 결과 중 판 밖으로 나가는 것(다이아, 보험 사용)을 저장소에 반영
  function credit(res) {
    if (!res) return res;
    (res.events || []).forEach(function (e) {
      if (e.type === 'gem') { Meta.addGems(e.n); snd('gem'); }
      if (e.type === 'insurance') Meta.useStash('insurance');
    });
    return res;
  }

  /* ── 캐릭터 ───────────────────────────── */
  function randomFace() {
    var F = JY.FACE_OPTIONS;
    return {
      eyes: pick(F.eyes), mouth: pick(F.mouth), brows: pick(F.brows), head: pick(F.head), extras: pick(F.extras).slice(),
      skin: pick(['#ffd9b5', '#f6c79c', '#eab386', '#f9d2a8'])
    };
  }

  function moodOpts(m) {
    switch (m) {
      case 'happy': return { eyes: 'happy', mouth: 'grin' };
      case 'sad': return { eyes: 'teary', mouth: 'frown' };
      case 'zen': return { eyes: 'happy', mouth: 'smile', extras: ['sparkles'] };
      case 'cast': return { mouth: 'wavy', extras: ['bandage', 'sweat'] };
      case 'proud': return { eyes: 'sparkle', mouth: 'grin', extras: ['sparkles'] };
      default: return {};
    }
  }

  function playerSpec(o) {
    o = o || {};
    var f = (state && state.face) || setup.face || Meta.get().face || randomFace();
    var rank = state ? state.rank : (o.rank !== undefined ? o.rank : 0);
    var name = state ? state.name : (($('#in-name') && $('#in-name').value) || Meta.get().lastName || '나띨빵');
    var spec = {
      seed: 'me-' + name, skin: f.skin, eyes: f.eyes, mouth: f.mouth, brows: f.brows, head: f.head,
      extras: (f.extras || []).slice(), hat: rank === 0 ? 'helmet' : 'none', rank: 'e' + rank, tag: name.slice(0, 3), body: 'camo'
    };
    if (o.meSpec) for (var k in o.meSpec) spec[k] = o.meSpec[k];
    if (o.meProp) spec.prop = o.meProp;
    if (state && state.flags.cast) spec.extras.push('bandage');
    if (!o.noCos) Meta.dress(spec);
    return spec;
  }

  function charSVG(who, o) {
    o = o || {};
    var ch = JY.CHARS[who] || JY.CHARS.me;
    switch (ch.special) {
      case 'cat': return A.cat({ fish: o.catFish, cap: o.catCap || (state && state.flags.catMascot), mood: o.mood === 'happy' ? 'happy' : 'derp' });
      case 'boar': return A.boar();
      case 'speaker': return A.speaker();
      case 'letter': return A.letter();
      case 'phone': return A.phone();
      case 'box': return A.box();
    }
    var spec;
    if (who === 'me') spec = playerSpec(o);
    else { spec = {}; for (var k in ch.spec) spec[k] = ch.spec[k]; spec.extras = (ch.spec.extras || []).slice(); }
    if (o.extras) spec.extras = (spec.extras || []).concat(o.extras);
    var mood = moodOpts(o.mood || (who === 'me' ? o.meMood : null));
    return A.character(spec, mood);
  }

  function charName(who) {
    var ch = JY.CHARS[who] || JY.CHARS.me;
    if (who === 'me') return { name: state ? state.name : '나', role: (state ? G.RANKS[state.rank] : '') + ' · 나' };
    return { name: ch.name, role: ch.role };
  }

  /* ── 타이틀 ───────────────────────────── */
  function renderGems() {
    var g = Meta.get().gems;
    ['#title-gems', '#shop-gems', '#barracks-gems'].forEach(function (s) { var el = $(s); if (el) el.textContent = '💎 ' + num(g); });
  }

  function renderTitle() {
    var m = Meta.get();
    var crowd = $('#title-crowd');
    var lines = ['전역… 할 수 있겠지?', '국방부 시계는 돈다…', '오늘 짬밥 뭐임?', '행보관님이 찾으십니다', '말년엔 낙엽도 조심해', '오늘의 작전 1등 누구냐?'];
    crowd.innerHTML = '<p class="title-bubble">' + pick(lines) + '</p>' + ['malnyeon', 'dumb', 'haeng'].map(function (w) { return '<div class="peek">' + charSVG(w) + '</div>'; }).join('');
    var s = loadSave();
    $('#btn-continue').hidden = !s;
    $('#save-info').hidden = !s;
    if (s) $('#save-info').textContent = (s.daily ? '⭐ 오늘의 작전 · ' : '') + G.RANKS[s.rank] + ' ' + s.name + ' · 전역까지 D-' + G.daysLeft(s);
    $('#album-count').textContent = Object.keys(m.endings).length + '/' + JY.ENDING_ORDER.length;
    var d = m.daily[G.todayStr()];
    $('#daily-best').textContent = d ? '내 최고 ' + num(d.score) + '점' : '오늘 아직 미참가';
    $('#title-streak').hidden = !m.login.streak;
    $('#title-streak').textContent = '🗓️ 연속 출석 ' + m.login.streak + '일';
    var lv = Meta.level();
    $('#title-lvnum').textContent = 'Lv.' + lv.lv;
    $('#title-lvtitle').textContent = lv.title;
    $('#title-lvbar').style.width = Math.round(lv.cur / lv.need * 100) + '%';
    var ms = Meta.missions();
    var done = ms.list.filter(function (x) { return x.claimed; }).length;
    $('#mission-sum').textContent = done + '/3' + (Meta.missionAlert() ? ' · 보상 받기!' : '') + (ms.bonus ? ' ✓' : '');
    $('#mission-strip').classList.toggle('alert', !!Meta.missionAlert());
    $('#barracks-badge').hidden = !Meta.missionAlert();
    $('#shop-badge').hidden = !(m.freeBoxes > 0);
    $('#album-badge').hidden = !Meta.collectAlert();
    renderGems();
    showScreen('scr-title');
  }

  /* ── 입영 통지서 ─────────────────────── */
  function drawTraits() {
    var ids = shuffle(JY.TRAIT_ORDER.slice()).slice(0, 3);
    setup.traits = ids;
    setup.trait = ids[0];
    renderTraits();
  }
  function renderTraits() {
    $('#trait-grid').innerHTML = setup.traits.map(function (id) {
      var t = JY.TRAITS[id];
      return '<button type="button" class="trait" data-trait="' + id + '" aria-pressed="' + (setup.trait === id) + '"><i>' + t.emoji + '</i><b>' + t.name + '</b><small>' + t.desc + '</small></button>';
    }).join('');
    $('#btn-reroll').disabled = setup.rerolled;
    $('#btn-reroll').textContent = setup.rerolled ? '다시 뽑기 완료' : '다시 뽑기 (1회 무료)';
  }

  function renderSetup() {
    var m = Meta.get();
    setup.face = m.face || randomFace();
    setup.mos = 'infantry';
    setup.rerolled = false;
    $('#in-name').value = m.lastName || pick(NAMES);
    $('#in-date').value = G.todayStr();
    $('#notice-no').textContent = '제 ' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900000) + 100000) + ' 호';
    $('#mos-grid').innerHTML = Object.keys(G.MOS).map(function (k) {
      var mo = G.MOS[k];
      return '<button type="button" class="mos" data-mos="' + k + '" aria-pressed="' + (k === setup.mos) + '"><b>' + mo.emoji + ' ' + mo.name + '</b><small>' + mo.desc + '</small><small>✦ ' + mo.perk + '</small></button>';
    }).join('');
    drawTraits();
    var ins = Meta.stash('insurance');
    $('#row-insurance').hidden = !ins;
    $('#insurance-count').textContent = '(보유 ' + ins + '개 · 한 판에 1개)';
    var cos = Meta.equipped().map(function (id) { return JY.COSMETICS[id].icon + ' ' + JY.COSMETICS[id].name; });
    $('#cos-note').textContent = cos.length ? '착용 중: ' + cos.join(', ') : '상점에서 꾸미기를 사면 여기서 입는다.';
    updateSetupPreview();
    updateDateNote();
    showScreen('scr-setup');
  }

  function updateSetupPreview() { $('#face-preview').innerHTML = charSVG('me'); }

  function updateDateNote() {
    var v = $('#in-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { $('#date-note').textContent = '전역 예정일: -'; return; }
    var y = +v.slice(0, 4), mo = +v.slice(5, 7), d = +v.slice(8, 10);
    var end = Date.UTC(y, mo - 1 + 18, d) - 86400000, start = Date.UTC(y, mo - 1, d);
    $('#date-note').textContent = '전역 예정일: ' + G.fmtDate(end) + ' (' + (Math.round((end - start) / 86400000) + 1) + '일)';
  }

  function beginRun(opts) {
    var m = Meta.get();
    m.lastName = opts.name; m.face = opts.face; Meta.save();
    var useIns = opts.insurance && Meta.stash('insurance') > 0;
    state = G.newState({
      name: opts.name, start: opts.start, mos: opts.mos, face: opts.face, pace: opts.pace,
      trait: opts.trait, unit: opts.unit, seed: opts.seed, daily: opts.daily, insurance: useIns, up: Meta.get().up
    });
    m.runs = (m.runs || 0) + 1; Meta.save();
    save();
    busy = false;
    showScreen('scr-game');
    renderHUD();
    renderCard(true);
    snd('start');
    var t = G.traitOf(state);
    toast((opts.daily ? '⭐ 오늘의 작전 출격! ' : '입영을 환영한다! ') + (t.name ? t.emoji + ' ' + t.name : ''), 2600);
  }

  function startGame() {
    var name = ($('#in-name').value || '').trim() || '나띨빵';
    var paceEl = document.querySelector('input[name="pace"]:checked');
    beginRun({
      name: name, start: $('#in-date').value || G.todayStr(), mos: setup.mos, face: setup.face,
      pace: paceEl && paceEl.value === '3' ? 3 : 1, trait: setup.trait,
      insurance: !$('#row-insurance').hidden && $('#in-insurance').checked
    });
  }

  function openDaily() {
    var cfg = G.dailyConfig();
    var m = Meta.get(), best = m.daily[cfg.date];
    var U = JY.UNITS[cfg.unit], T = JY.TRAITS[cfg.trait], M = G.MOS[cfg.mos];
    var ins = Meta.stash('insurance');
    openModal('<h3>⭐ 오늘의 작전</h3><p class="sub">' + G.fmtDate(Date.parse(cfg.date + 'T00:00:00Z')) + ' · 모든 사람이 같은 부대, 같은 성격, 같은 운으로 시작한다. 점수로 겨룬다.</p>' +
      '<div class="daily-cfg">' +
      '<div><i>' + U.emoji + '</i><b>' + U.name + '</b><small>' + U.perk + '</small></div>' +
      '<div><i>' + T.emoji + '</i><b>' + T.name + '</b><small>' + T.desc + '</small></div>' +
      '<div><i>' + M.emoji + '</i><b>' + M.name + '</b><small>' + M.perk + '</small></div>' +
      '<div><i>⏩</i><b>속성 복무</b><small>카드 약 45장 · 10분 내외</small></div>' +
      '</div>' +
      '<label class="field"><span>성명</span><input id="daily-name" maxlength="6" value="' + esc(m.lastName || pick(NAMES)) + '"></label>' +
      (ins ? '<label class="check-row"><input type="checkbox" id="daily-ins" checked><span>🛡️ 전역 보험 챙기기 <small>(보유 ' + ins + '개)</small></span></label>' : '') +
      '<p class="sub">' + (best ? '오늘 내 최고: ' + num(best.score) + '점 (' + esc(JY.ENDINGS[best.ending] ? JY.ENDINGS[best.ending].title : '') + ')' : '첫 참가 보너스 💎 +10') + '</p>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">취소</button><button class="btn btn-primary" data-act="go">출격!</button></div>',
    function (box) {
      box.querySelector('[data-act="close"]').onclick = closeModal;
      box.querySelector('[data-act="go"]').onclick = function () {
        var name = (box.querySelector('#daily-name').value || '').trim() || '나띨빵';
        var insEl = box.querySelector('#daily-ins');
        if (JY.Sound) JY.Sound.unlock();
        closeModal();
        beginRun({ name: name, start: cfg.start, mos: cfg.mos, face: Meta.get().face || randomFace(), pace: 3, trait: cfg.trait, unit: cfg.unit, seed: cfg.seed, daily: cfg.date, insurance: insEl ? insEl.checked : false });
      };
    });
  }

  /* ── HUD ─────────────────────────────── */
  function buildStats() {
    $('#stats').innerHTML = G.STATS.map(function (k) {
      var svg = A.statIcon(k);
      return '<div class="stat" data-k="' + k + '" title="' + ICON[k] + '"><i class="dot"></i>' +
        '<div class="stat-ic"><div class="ic-back">' + svg + '</div><div class="ic-front">' + svg + '</div></div>' +
        '<span class="stat-name">' + SHORT[k] + '</span></div>';
    }).join('');
  }

  function renderHUD() {
    if (!state) return;
    var U = G.unitOf(state);
    $('#hud-rank').innerHTML = A.rankInsignia(state.rank);
    $('#hud-name').textContent = G.RANKS[state.rank] + ' ' + state.name + (state.daily ? ' ⭐' : '');
    $('#hud-date').textContent = G.dateOf(state) + ' · ' + G.SEASON_NAMES[state.season] + ' · ' + (state.rank >= 1 && U.short ? U.emoji + U.short + ' · ' : '') + G.MOS[state.mos].name;
    $('#hud-dday').textContent = 'D-' + G.daysLeft(state);
    var pct = G.progress(state) * 100;
    $('#gauge-fill').style.width = pct.toFixed(2) + '%';
    $('#gauge-pct').textContent = pct.toFixed(1) + '%';
    G.STATS.forEach(function (k) {
      var el = document.querySelector('.stat[data-k="' + k + '"]');
      if (!el) return;
      var v = state.stats[k];
      el.style.setProperty('--v', v);
      el.classList.toggle('danger', v <= 15 || v >= 85);
      el.setAttribute('aria-label', ICON[k] + ' ' + v);
    });
    var chips = state.conds.map(function (c) {
      var d = G.condDef(c.id);
      return '<button class="cond" data-cond="' + c.id + '">' + d.emoji + ' ' + d.name + ' <em>' + c.left + '</em></button>';
    });
    if (state.insight > 0) chips.push('<button class="cond buff" data-buff="insight">🔭 투시경 <em>' + state.insight + '</em></button>');
    if (state.luck > 0) chips.push('<button class="cond buff" data-buff="clover">🍀 행운 <em>' + state.luck + '</em></button>');
    if (state.insurance > 0) chips.push('<button class="cond buff" data-buff="insurance">🛡️ 보험</button>');
    $('#conds').innerHTML = chips.join('');
    $('#conds').hidden = !chips.length;
    var bagN = 0; for (var id in state.items) bagN += state.items[id] || 0;
    $('#bag-badge').textContent = bagN;
    $('#leave-badge').textContent = state.leave + '일';
    var px = G.pxStatus(state);
    $('#px-badge').hidden = !px.ok;
    $('#dock-px').classList.toggle('off', !px.ok);
    $('#dock-leave').classList.toggle('off', !G.leaveStatus(state).ok);
    var bff = G.bffCount(state);
    $('#mates-badge').hidden = !bff;
    $('#mates-badge').textContent = '♥' + bff;
    $('#dock-mates').classList.toggle('off', state.rank < 1);
  }

  function showPreview(side) {
    $$('.stat .dot').forEach(function (d) { d.className = 'dot'; d.textContent = ''; });
    if (!side || !state) return;
    var c = G.currentCard(state);
    var opt = c[side];
    if (!opt) return;
    var p = opt.preview;
    G.STATS.forEach(function (k) {
      if (!p[k]) return;
      var d = document.querySelector('.stat[data-k="' + k + '"] .dot');
      d.classList.add('on'); if (p[k] === 'big') d.classList.add('big');
      if (p.dir && p.dir[k]) { d.classList.add('dir', p.dir[k] > 0 ? 'up' : 'down'); d.textContent = p.dir[k] > 0 ? '▲' : '▼'; }
    });
  }

  function animateDeltas(deltas) {
    for (var k in deltas) {
      var v = deltas[k];
      if (!v) continue;
      var el = document.querySelector('.stat[data-k="' + k + '"]');
      if (!el) continue;
      var d = document.createElement('span');
      d.className = 'delta ' + (v > 0 ? 'up' : 'down');
      d.textContent = (v > 0 ? '+' : '') + v;
      el.appendChild(d);
      setTimeout(function (n) { return function () { n.remove(); }; }(d), 1150);
    }
  }

  /* ── 카드 ───────────────────────────── */
  function fitCard() {
    var zone = $('#card-zone'), card = $('#card');
    if (!zone || !card) return;
    var r = zone.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var ratio = 0.82;
    var w = Math.min(r.width, r.height * ratio, 400);
    var h = w / ratio;
    if (h > r.height) { h = r.height; w = h * ratio; }
    card.style.width = Math.floor(w) + 'px';
    card.style.height = Math.floor(h) + 'px';
  }

  function renderCard(enter) {
    if (!state || state.over) return;
    stopUrgent();
    var c = G.currentCard(state);
    var nm = charName(c.who);
    $('#prompt').className = 'prompt' + (c.urgent ? ' urgent' : '');
    $('#prompt').innerHTML = (c.urgent ? '<span class="who alarm">⚠ 돌발 상황!</span> ' : '') + '<span class="who">' + esc(nm.name) + '</span><br>' + esc(c.text);
    var card = $('#card');
    card.className = 'card' + (c.urgent ? ' urgent' : '');
    card.style.transform = '';
    card.style.opacity = '';
    card.innerHTML = A.scene(c.bg || 'barracks', state.season) +
      '<div class="char-wrap">' + charSVG(c.who, c) + '</div>' +
      '<div class="card-label l' + (c.l.preview.mini ? ' mini' : '') + '">' + esc(c.l.t) + '</div>' +
      '<div class="card-label r' + (c.r.preview.mini ? ' mini' : '') + '">' + esc(c.r.t) + '</div>' +
      '<div class="nametape"><b>' + esc(nm.name) + '</b><span>' + esc(nm.role) + '</span></div>';
    $('#choice-l').textContent = c.l.t;
    $('#choice-r').textContent = c.r.t;
    var xb = $('#choice-x-btn');
    xb.hidden = !c.x;
    if (c.x) {
      $('#choice-x').textContent = c.x.t;
      $('#choice-x-need').textContent = c.x.need || '';
      card.insertAdjacentHTML('beforeend', '<div class="card-label x">⭐ ' + esc(c.x.t) + '</div>');
    }
    $('#choices').classList.toggle('three', !!c.x);
    if (Meta.see(c.key)) card.insertAdjacentHTML('beforeend', '<span class="new-scene">NEW</span>');
    $$('.choice').forEach(function (b) { b.classList.remove('armed'); b.disabled = false; });
    $('#talk-bubble').hidden = true;
    armed = null;
    showPreview(null);
    if (enter) { void card.offsetWidth; card.classList.add('enter'); }
    fitCard();
    if (c.urgent) startUrgent(c.urgent);
  }

  /* 돌발 상황: 사이렌 + 제한 시간 */
  function startUrgent(sec) {
    var bar = $('#urgent-bar'), fill = $('#urgent-fill'), label = $('#urgent-sec');
    bar.hidden = false;
    var flash = $('#flash');
    flash.hidden = false; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    setTimeout(function () { flash.hidden = true; }, 1300);
    snd('siren');
    if (JY.buzz) JY.buzz([200, 80, 200, 80, 200]);
    var total = sec * 1000, t0 = performance.now();
    function tick(now) {
      var left = Math.max(0, total - (now - t0));
      fill.style.width = (left / total * 100) + '%';
      label.textContent = (left / 1000).toFixed(1) + '초';
      if (left <= 0) { urgentTimer = null; bar.hidden = true; if (!busy && state && !state.over) commit('t'); return; }
      urgentTimer = requestAnimationFrame(tick);
    }
    urgentTimer = requestAnimationFrame(tick);
  }
  function stopUrgent() {
    if (urgentTimer) cancelAnimationFrame(urgentTimer);
    urgentTimer = null;
    var bar = $('#urgent-bar'); if (bar) bar.hidden = true;
  }

  function setCardPose(dx, dy) {
    var card = $('#card');
    card.style.transform = 'translate(' + dx + 'px,' + (dy || 0) + 'px) rotate(' + (dx * 0.06) + 'deg)';
    var lx = card.querySelector('.card-label.x');
    var up = lx && dy < -24 && Math.abs(dx) < Math.abs(dy);
    var side = up ? 'x' : dx < -14 ? 'l' : dx > 14 ? 'r' : null;
    var amt = up ? Math.min(1, -dy / 70) : Math.min(1, Math.abs(dx) / 70);
    var ll = card.querySelector('.card-label.l'), lr = card.querySelector('.card-label.r');
    if (ll) ll.style.opacity = side === 'l' ? amt : 0;
    if (lr) lr.style.opacity = side === 'r' ? amt : 0;
    if (lx) lx.style.opacity = side === 'x' ? amt : 0;
    return side;
  }

  function arm(side) {
    if (busy || !state || state.over) return;
    if (armed === side) { commit(side); return; }
    armed = side;
    $$('.choice').forEach(function (b) { b.classList.toggle('armed', b.dataset.side === side); });
    var card = $('#card');
    card.classList.remove('enter'); card.classList.add('back');
    if (side === 'x') setCardPose(0, -40); else setCardPose(side === 'l' ? -46 : 46, 0);
    showPreview(side);
    snd('tap');
    toast('한 번 더 누르면 결정!', 1200);
  }

  function disarm() {
    armed = null;
    $$('.choice').forEach(function (b) { b.classList.remove('armed'); });
  }

  function talkBubble(who) {
    var b = $('#talk-bubble');
    var pool = (JY.NPCS[who] && JY.NPCS[who].lines) || LINES[who] || LINES.me;
    b.textContent = pick(pool);
    b.hidden = false;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(talkBubble.t);
    talkBubble.t = setTimeout(function () { b.hidden = true; }, 1800);
    snd('tap');
    var r = credit(G.poke(state, who));
    if (r && r.events.length) { save(); renderHUD(); }
  }

  function bindSwipe() {
    var card = $('#card');
    card.addEventListener('pointerdown', function (e) {
      if (busy || !state || state.over || drag) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (JY.Sound) JY.Sound.unlock();
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, side: null, t0: Date.now(), onChar: !!(e.target.closest && e.target.closest('.char-wrap')) };
      card.classList.remove('back', 'enter');
      disarm();
      try { card.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
    });
    card.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x0;
      drag.dy = e.clientY - drag.y0;
      var hasX = !!$('#card .card-label.x');
      var side = setCardPose(drag.dx, hasX && drag.dy < 0 ? drag.dy * 0.8 : drag.dy * 0.15);
      if (side !== drag.side) { drag.side = side; showPreview(side); }
    });
    function endDrag(e, cancel) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null;
      var th = Math.min(110, card.offsetWidth * 0.3);
      if (!cancel && d.side === 'x' && d.dy < -90) { commit('x'); return; }
      if (!cancel && Math.abs(d.dx) > th) { commit(d.dx < 0 ? 'l' : 'r'); return; }
      card.classList.add('back');
      setCardPose(0, 0);
      showPreview(null);
      if (!cancel && Math.abs(d.dx) < 6 && Date.now() - d.t0 < 400 && d.onChar) talkBubble(G.currentCard(state).who);
    }
    card.addEventListener('pointerup', function (e) { endDrag(e, false); });
    card.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); arm('l'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); arm('r'); }
    });
    $$('.choice').forEach(function (b) { b.addEventListener('click', function () { arm(b.dataset.side); }); });
    document.addEventListener('keydown', function (e) {
      if ($('#scr-game').hidden || !$('#modal').hidden || !$('#mini').hidden) return;
      if (!$('#result').hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#result').click(); return; }
      if (document.activeElement === card) return;
      if (e.key === 'ArrowLeft') arm('l');
      if (e.key === 'ArrowRight') arm('r');
      if (e.key === 'ArrowUp' && !$('#choice-x-btn').hidden) arm('x');
    });
  }

  function commit(side) {
    if (busy || !state || state.over) return;
    busy = true;
    stopUrgent();
    disarm();
    showPreview(null);
    snd(side === 't' ? 'bad' : 'swipe');
    if (JY.buzz) JY.buzz(side === 't' ? [60, 40, 60] : 8);
    var card = $('#card');
    var w = window.innerWidth;
    card.classList.remove('back', 'enter');
    card.classList.add('fly');
    card.style.transform = side === 't' ? 'translate(0, 120%) rotate(8deg)' : side === 'x' ? 'translate(0, -130%) scale(.9)' : 'translate(' + (side === 'l' ? -1.2 * w : 1.2 * w) + 'px, 60px) rotate(' + (side === 'l' ? -28 : 28) + 'deg)';
    card.style.opacity = '0';
    undoSnap = state.undo > 0 ? JSON.stringify(state) : null;
    var res = credit(G.choose(state, side));
    save();
    if (res) {
      var done = Meta.track('card');
      if (res.special) { done = done.concat(Meta.track('special')); snd('gem'); }
      if (res.emergency && !res.timeout) done = done.concat(Meta.track('emer_ok'));
      missionToast(done);
    }
    setTimeout(function () {
      if (!res) { busy = false; renderCard(true); return; }
      if (res.timeout) res.say = '⏰ 시간 초과! ' + (res.say || '');
      if (res.mini) runMini(res);
      else afterChoice(res);
    }, 280);
  }

  function runMini(res) {
    var opts = { stats: state.stats, mos: state.mos, hard: !!G.traitOf(state).watchHard, face: function (w) { return charSVG(w); } };
    JY.Mini.start(res.mini, opts, function (tier) {
      if (tier === 'great') missionToast(Meta.track('mini_great'));
      var r2 = credit(G.finishMini(state, tier));
      save();
      if (!r2) { busy = false; renderCard(true); return; }
      var merged = {
        say: [res.say, r2.say].filter(Boolean).join(' '),
        deltas: {}, events: (res.events || []).concat(r2.events || []), ending: r2.ending || res.ending
      };
      [res.deltas, r2.deltas].forEach(function (d) { for (var k in d) merged.deltas[k] = (merged.deltas[k] || 0) + d[k]; });
      afterChoice(merged);
    });
  }

  function missionToast(done) {
    if (!done || !done.length) return;
    var d = done[done.length - 1];
    setTimeout(function () { toast('🎯 임무 완료: ' + d.text + ' — 막사에서 보상 받기', 2800); snd('coin'); }, 600);
  }

  function trackEvents(res) {
    var done = [];
    (res.events || []).forEach(function (e) {
      if (e.type === 'promo') done = done.concat(Meta.track('promo'));
      if (e.type === 'bff') done = done.concat(Meta.track('bff'));
    });
    if (state) done = done.concat(Meta.track('days', state.day, true));
    missionToast(done);
  }

  function afterChoice(res) {
    trackEvents(res);
    renderHUD();
    renderGems();
    animateDeltas(res.deltas || {});
    var sum = 0, any = false;
    for (var k in res.deltas) { if (res.deltas[k]) any = true; sum += res.deltas[k]; }
    if (res.ending && !(JY.ENDINGS[res.ending] && JY.ENDINGS[res.ending].good)) snd('bad');
    else if (any) snd(sum >= 0 ? 'good' : 'bad');
    var has = res.say || any || (res.events && res.events.length);
    if (!has) { nextAfterResult(res); return; }
    showResult(res, function () { nextAfterResult(res); });
  }

  function npcName(who) { return JY.CHARS[who] ? JY.CHARS[who].name : who; }

  function eventLine(e) {
    switch (e.type) {
      case 'pay': return '💰 월급날! ' + won(e.n) + ' (적금 ' + won(e.save) + ' 자동 납입)';
      case 'promo': return '🎖️ ' + e.text;
      case 'promoFail': return '📉 ' + e.text;
      case 'season': return '🗓️ ' + e.text;
      case 'leave': return '🏖️ ' + e.text;
      case 'item': return '🎁 ' + (JY.ITEMS[e.id] ? JY.ITEMS[e.id].name : e.id) + ' ' + (e.n > 0 ? '+' : '') + e.n;
      case 'money': return (e.n > 0 ? '💰 ' : '💸 ') + (e.n > 0 ? '+' : '') + won(e.n);
      case 'save': return '🏦 적금 +' + won(e.n);
      case 'block': return '⛔ 휴가 통제 ' + e.n + '일';
      case 'gem': return '💎 다이아 +' + e.n;
      case 'cond': return '📢 ' + e.text;
      case 'condEnd': return '✅ ' + e.text;
      case 'aff': return (e.n > 0 ? '💗 ' : '💔 ') + npcName(e.who) + ' 호감도 ' + (e.n > 0 ? '+' : '') + e.n;
      case 'bff': return '🤝 ' + npcName(e.who) + '와(과) 절친이 됐다! ' + e.text;
      case 'insurance': return e.text;
      default: return e.text || '';
    }
  }

  function showResult(res, cb) {
    var box = $('#result');
    var chips = '';
    G.STATS.forEach(function (k) {
      var v = res.deltas && res.deltas[k];
      if (!v) return;
      chips += '<span class="chip ' + (v > 0 ? 'up' : 'down') + '">' + ICON[k] + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    });
    var evs = (res.events || []).map(function (e) { return '<div>' + esc(eventLine(e)) + '</div>'; }).join('');
    box.innerHTML = '<div class="note' + (res.emergency ? ' urgent' : '') + '">' +
      (res.say ? '<p>' + esc(res.say) + '</p>' : '') +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      (evs ? '<div class="events">' + evs + '</div>' : '') +
      (canUndo(res) ? '<button class="undo-btn" id="undo-btn">⌚ 국방부 시계 되돌리기 <em>' + (JSON.parse(undoSnap).undo) + '회</em></button>' : '') +
      '<span class="tap-next">탭해서 계속 ▶</span></div>';
    box.hidden = false;
    var shownAt = Date.now();
    var ub = $('#undo-btn');
    if (ub) ub.onclick = function (e) { e.stopPropagation(); box.onclick = null; box.hidden = true; doUndo(); };
    box.onclick = function () {
      if (Date.now() - shownAt < 350) return;
      box.onclick = null;
      box.hidden = true;
      undoSnap = null;
      cb();
    };
  }

  var undoSnap = null;
  function canUndo(res) {
    if (!undoSnap) return false;
    return !(res.events || []).some(function (e) { return e.type === 'gem'; });
  }
  function doUndo() {
    var s2 = JSON.parse(undoSnap);
    undoSnap = null;
    s2.undo = Math.max(0, s2.undo - 1);
    state = G.migrate(s2);
    G._setCur(state);
    save();
    busy = false;
    snd('reveal');
    toast('⌚ 국방부 시계를 거꾸로 돌렸다! "…꿈이었나?"', 2400);
    renderHUD();
    renderCard(true);
  }

  function nextAfterResult(res) {
    var promos = (res.events || []).filter(function (e) { return e.type === 'promo'; });
    function go() {
      if (state.over) { showEnding(); return; }
      if (state.pendingMini) { runMini({ mini: state.pendingMini.id, say: '', deltas: {}, events: [] }); return; }
      renderHUD();
      renderCard(true);
      busy = false;
    }
    if (promos.length) showPromo(promos[promos.length - 1], go);
    else go();
  }

  /* ── 모달 ───────────────────────────── */
  var modalClose = null;
  function openModal(html, bind, onClose) {
    var m = $('#modal'), box = $('#modal-box');
    box.innerHTML = html;
    box.scrollTop = 0;
    m.hidden = false;
    modalClose = onClose || null;
    if (bind) bind(box);
  }
  function closeModal() {
    var m = $('#modal');
    if (m.hidden) return;
    m.hidden = true;
    $('#modal-box').innerHTML = '';
    var f = modalClose; modalClose = null;
    if (f) f();
  }

  function confetti() {
    var c = document.createElement('div');
    c.className = 'confetti';
    var cols = ['#e0b347', '#56662f', '#c4362b', '#f6f0dc', '#8fc6ea'];
    for (var i = 0; i < 40; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      p.style.animationDuration = (1.2 + Math.random() * 0.9) + 's';
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); }, 2600);
  }

  function showPromo(e, cb) {
    snd('promo');
    confetti();
    if (JY.buzz) JY.buzz([30, 40, 30]);
    var unitLine = e.rank === 1 && state ? '<p class="unit-line">' + G.unitOf(state).emoji + ' <b>' + esc(G.unitOf(state).name) + '</b> 배치<br><small>' + esc(G.unitOf(state).perk) + '</small></p>' : '';
    openModal('<div class="promo-box"><div class="rank-big">' + A.rankInsignia(e.rank) + '</div>' +
      '<h3>' + G.RANKS[e.rank] + ' 진급!</h3><p class="sub">' + PROMO_TEXT[e.rank] + '</p>' + unitLine +
      (e.leave ? '<p>🏖️ 휴가 +' + e.leave + '일 지급</p>' : '') +
      '<p class="sub">월급: ' + won(G.PAY[e.rank]) + '</p>' +
      '<div class="modal-actions"><button class="btn btn-primary" data-act="ok">충성!</button></div></div>',
    function (box) { box.querySelector('[data-act="ok"]').onclick = closeModal; }, cb);
  }

  function fxChips(fx, mult) {
    return Object.keys(fx).map(function (k) {
      var v = fx[k] > 0 && mult ? Math.round(fx[k] * mult) : fx[k];
      return '<span class="chip ' + (v > 0 ? 'up' : 'down') + '">' + ICON[k] + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    }).join('');
  }

  function dockBlocked() {
    if (!state || busy) return true;
    var c = G.getCardDef(state.current);
    if (c && c.urgent) { toast('⚠ 돌발 상황 중이다! 먼저 대응하자.'); return true; }
    return false;
  }

  /* 가방: 일반 아이템 + 특급 보급품 */
  function openBag(tab) {
    if (dockBlocked()) return;
    var sel = null;
    tab = tab || 'items';
    function html() {
      var tabs = '<div class="tabs small"><button data-tab="items" aria-selected="' + (tab === 'items') + '">일반 아이템</button><button data-tab="premium" aria-selected="' + (tab === 'premium') + '">특급 보급품 💎</button></div>';
      if (tab === 'premium') {
        var ids = JY.PREMIUM_ORDER.filter(function (id) { return Meta.stash(id) > 0; });
        var list = ids.length ? '<div class="item-grid">' + ids.map(function (id) {
          var p = JY.PREMIUM[id];
          return '<button class="item" data-id="' + id + '" aria-pressed="' + (sel === id) + '"><span class="count">×' + Meta.stash(id) + '</span><i>' + p.icon + '</i><b>' + p.name + '</b></button>';
        }).join('') + '</div>' : '<p class="sub">특급 보급품이 없다. 타이틀 화면의 상점에서 다이아로 살 수 있다.</p>';
        var det = '';
        if (sel && JY.PREMIUM[sel]) {
          var pd = JY.PREMIUM[sel];
          det = '<div class="item-detail"><p><b>' + pd.icon + ' ' + pd.name + '</b> — ' + pd.desc + '</p>' +
            (pd.auto ? '<p class="sub">' + (state.insurance ? '이번 판에 챙겨 왔다. 위기 때 자동으로 발동한다.' : '입대할 때 챙겨야 발동한다.') + '</p>' : '<button class="btn btn-primary btn-small" data-act="usep">사용하기</button>') + '</div>';
        }
        return '<h3>가방</h3>' + tabs + list + det + '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">닫기</button></div>';
      }
      var iids = JY.ITEM_ORDER.filter(function (id) { return state.items[id] > 0; });
      var grid = iids.length ? '<div class="item-grid">' + iids.map(function (id) {
        var it = JY.ITEMS[id];
        return '<button class="item" data-id="' + id + '" aria-pressed="' + (sel === id) + '"><span class="count">×' + state.items[id] + '</span><i>' + it.icon + '</i><b>' + it.name + '</b></button>';
      }).join('') + '</div>' : '<p class="sub">가방이 비었다. PX에서 사 오자.</p>';
      var detail = '';
      if (sel && JY.ITEMS[sel] && state.items[sel] > 0) {
        var it = JY.ITEMS[sel];
        var mult = JY.FOOD[sel] && G.traitOf(state).itemMult;
        detail = '<div class="item-detail"><p><b>' + it.icon + ' ' + it.name + '</b> — ' + it.desc + '</p><div class="chips">' + fxChips(it.fx, mult) + '</div>' +
          '<button class="btn btn-primary btn-small" data-act="use">사용하기</button></div>';
      }
      return '<h3>가방</h3>' + tabs + '<p class="sub">아이템은 스탯을 5~95 사이에서만 움직인다. 동료에게 선물할 수도 있다.</p>' + grid + detail +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">닫기</button></div>';
    }
    function rerender(box) { box.innerHTML = html(); bind(box); }
    function bind(box) {
      $$('[data-tab]', box).forEach(function (b) { b.onclick = function () { tab = b.dataset.tab; sel = null; rerender(box); }; });
      $$('.item', box).forEach(function (b) { b.onclick = function () { sel = b.dataset.id; snd('tap'); rerender(box); }; });
      var u = box.querySelector('[data-act="use"]');
      if (u) u.onclick = function () {
        var r = G.useItem(state, sel);
        if (r) {
          missionToast(Meta.track('item_use'));
          save(); renderHUD(); animateDeltas(r.deltas);
          var moved = Object.keys(r.deltas).some(function (k) { return r.deltas[k]; });
          snd(moved ? 'good' : 'tap');
          toast(moved ? JY.ITEMS[sel].name + ' 사용!' : '이미 충분하다. 효과가 없었다.');
        }
        if (!(state.items[sel] > 0)) sel = null;
        rerender(box);
      };
      var up = box.querySelector('[data-act="usep"]');
      if (up) up.onclick = function () {
        var id = sel;
        var r = G.usePremium(state, id);
        if (!r) { toast('지금은 쓸 수 없다.'); return; }
        Meta.useStash(id);
        credit(r);
        save(); renderHUD(); animateDeltas(r.deltas);
        snd('gem');
        if (r.skipped) {
          closeModal();
          busy = true;
          var card = $('#card'); card.classList.add('fly'); card.style.transform = 'translate(0,-120%)'; card.style.opacity = '0';
          setTimeout(function () { afterChoice(r); }, 260);
          return;
        }
        toast(r.say || '사용!', 2400);
        if (id === 'insight') showPreview(null);
        if (!(Meta.stash(id) > 0)) sel = null;
        rerender(box);
      };
      box.querySelector('[data-act="close"]').onclick = closeModal;
    }
    openModal(html(), bind);
  }

  function openPX() {
    if (dockBlocked()) return;
    var st = G.pxStatus(state);
    if (!st.ok) { toast(st.reason); return; }
    var bought = false;
    function html() {
      var list = JY.ITEM_ORDER.filter(function (id) { return JY.ITEMS[id].px !== false; });
      return '<h3>PX</h3><p class="sub">한 번 다녀오면 며칠 뒤에 다시 갈 수 있다.</p>' +
        '<div class="wallet"><span>현금 ' + won(state.money) + '</span><span>적금 ' + won(state.savings) + '</span></div>' +
        '<div class="item-grid">' + list.map(function (id) {
          var it = JY.ITEMS[id];
          var price = G.pxPrice(state, id);
          var cant = state.money < price || (state.items[id] || 0) >= 9;
          return '<button class="item" data-id="' + id + '"' + (cant ? ' disabled' : '') + '><span class="count">×' + (state.items[id] || 0) + '</span><i>' + it.icon + '</i><b>' + it.name + '</b><small>' +
            (price < it.price ? '<s>' + won(it.price) + '</s> ' : '') + won(price) + '</small><small>' + Object.keys(it.fx).map(function (k) { return SHORT[k] + (it.fx[k] > 0 ? '+' : '') + it.fx[k]; }).join(' ') + '</small></button>';
        }).join('') + '</div>' +
        '<div class="modal-actions"><button class="btn btn-primary" data-act="close">계산 끝, 나가기</button></div>';
    }
    function bind(box) {
      $$('.item', box).forEach(function (b) {
        b.onclick = function () {
          if (G.buy(state, b.dataset.id)) { bought = true; snd('coin'); missionToast(Meta.track('px_buy')); save(); renderHUD(); box.innerHTML = html(); bind(box); }
          else toast('돈이 부족하거나 가방이 꽉 찼다.');
        };
      });
      box.querySelector('[data-act="close"]').onclick = closeModal;
    }
    openModal(html(), bind, function () { G.closePX(state, bought); save(); renderHUD(); });
  }

  /* 동료: 호감도, 수다, 선물 */
  function openMates() {
    if (dockBlocked()) return;
    if (state.rank < 1) { toast('훈련소에서는 동료와 수다 떨 시간이 없다.'); return; }
    var giftFor = null;
    function hearts(v) { var n = Math.round(v / 20); return '♥'.repeat(n) + '♡'.repeat(5 - n); }
    function html() {
      var rows = JY.NPC_ORDER.filter(function (w) { return G.npcAvailable(state, w); }).map(function (w) {
        var n = JY.NPCS[w], nm = charName(w), v = state.aff[w] || 0, bff = !!state.bffs[w];
        var cd = state.talkDay[w] !== undefined ? Math.max(0, 6 - (state.day - state.talkDay[w])) : 0;
        var picker = '';
        if (giftFor === w) {
          var ids = JY.ITEM_ORDER.filter(function (id) { return state.items[id] > 0; });
          picker = '<div class="gift-pick">' + (ids.length ? ids.map(function (id) {
            return '<button data-gift="' + id + '" class="' + (n.fav === id ? 'fav' : '') + '">' + JY.ITEMS[id].icon + ' ' + JY.ITEMS[id].name + (n.fav === id ? ' ★' : '') + ' ×' + state.items[id] + '</button>';
          }).join('') : '<span class="sub">줄 게 없다. PX에 다녀오자.</span>') + '</div>';
        }
        return '<div class="mate' + (bff ? ' bff' : '') + '"><div class="mate-face">' + charSVG(w) + '</div>' +
          '<div class="mate-info"><b>' + esc(nm.name) + (bff ? ' <em>절친</em>' : '') + '</b><small>' + esc(nm.role) + '</small>' +
          '<span class="hearts" aria-label="호감도 ' + v + '">' + hearts(v) + ' <small>' + v + '</small></span>' +
          '<small class="perk' + (bff ? ' on' : '') + '">' + (bff ? '✦ ' : '70 이상: ') + n.perk.name + ' — ' + n.perk.desc + '</small></div>' +
          '<div class="mate-act"><button class="btn btn-small" data-talk="' + w + '"' + (cd ? ' disabled' : '') + '>' + (cd ? '수다 ' + cd + '일' : '수다') + '</button>' +
          '<button class="btn btn-small" data-giftto="' + w + '">선물</button></div>' + picker + '</div>';
      }).join('');
      return '<h3>동료</h3><p class="sub">수다를 떨거나 선물하면 호감도가 오른다. 좋아하는 선물(★)은 효과가 크다. 70 이상이면 절친 효과가 켜지고 전용 이벤트가 생긴다. 카드 속 인물을 톡 건드려도 말을 건다.</p>' +
        '<div class="mates">' + rows + '</div><p class="sub">게임을 진행하면 더 많은 동료를 만난다.</p>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">닫기</button></div>';
    }
    function bind(box) {
      $$('[data-talk]', box).forEach(function (b) {
        b.onclick = function () {
          var w = b.dataset.talk;
          var r = credit(G.talk(state, w));
          if (!r) return;
          if (r.cooldown) { toast(npcName(w) + ': "' + r.line + '" (수다는 ' + r.cooldown + '일 뒤에)'); return; }
          missionToast(Meta.track('talk'));
          trackEvents(r);
          save(); renderHUD(); animateDeltas(r.deltas); snd('tap');
          toast(npcName(w) + ': "' + r.line + '"', 2600);
          var bff = (r.events || []).filter(function (e) { return e.type === 'bff'; })[0];
          if (bff) { confetti(); snd('promo'); toast('🤝 ' + npcName(w) + '와(과) 절친! ' + bff.text, 3200); }
          box.innerHTML = html(); bind(box);
        };
      });
      $$('[data-giftto]', box).forEach(function (b) { b.onclick = function () { giftFor = giftFor === b.dataset.giftto ? null : b.dataset.giftto; box.innerHTML = html(); bind(box); }; });
      $$('[data-gift]', box).forEach(function (b) {
        b.onclick = function () {
          var w = giftFor, item = b.dataset.gift;
          var r = credit(G.gift(state, w, item));
          if (!r) return;
          missionToast(Meta.track('gift'));
          trackEvents(r);
          save(); renderHUD(); animateDeltas(r.deltas);
          snd(r.fav ? 'gem' : 'good');
          var msg = r.say || (r.fav ? npcName(w) + ': "이거 내가 제일 좋아하는 거잖아!!"' : npcName(w) + ': "오, 고맙다!"');
          var bff = (r.events || []).filter(function (e) { return e.type === 'bff'; })[0];
          if (bff) { confetti(); snd('promo'); msg += ' 🤝 절친이 됐다! ' + bff.text; }
          toast(msg, 3200);
          giftFor = null;
          box.innerHTML = html(); bind(box);
        };
      });
      box.querySelector('[data-act="close"]').onclick = closeModal;
    }
    openModal(html(), bind);
  }

  function openLeave() {
    if (dockBlocked()) return;
    var st = G.leaveStatus(state);
    var np = G.nextPromo(state);
    var head = '<h3>휴가 신청</h3><p class="sub">남은 휴가 ' + state.leave + '일 · 사용 ' + state.leaveUsed + '일' + (np ? ' · 다음 진급 ' + np.rank + ' (' + np.date + ')' : '') + '</p>';
    if (!st.ok) {
      openModal(head + '<p>' + esc(st.reason) + '</p><p class="sub">휴가는 진급할 때마다 지급되고, 특급전사·특등사수·대회 우승으로 포상휴가를 받을 수 있다. 남은 휴가가 전역까지 남은 날짜보다 많으면 말출(말년휴가) 후 그대로 전역!</p>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">닫기</button></div>',
      function (box) { box.querySelector('[data-act="close"]').onclick = closeModal; });
      return;
    }
    var n = Math.min(st.max, Math.max(1, Math.min(5, st.max)));
    function body() {
      var leaveEnd = G.dateOf(state, Math.min(state.total, state.day + n));
      var mal = n >= st.malchulAt;
      return head +
        '<div class="stepper"><button data-act="minus" aria-label="하루 줄이기">−</button><output id="leave-n">' + n + '일</output><button data-act="plus" aria-label="하루 늘리기">+</button></div>' +
        '<p class="leave-info">' + G.dateOf(state) + ' 출발 → ' + leaveEnd + (mal ? ' 전역' : ' 복귀') + '</p>' +
        (mal ? '<p class="malchul">🎉 말년휴가! 복귀 없이 그대로 전역한다!</p>' : '<p class="leave-info">휴가 중에는 멘탈·체력이 회복된다. 복귀 후 20일은 다시 못 나간다.</p>') +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="close">취소</button><button class="btn btn-primary" data-act="go">' + (mal ? '말출 나가기' : '휴가 출발') + '</button></div>';
    }
    function bind(box) {
      box.querySelector('[data-act="minus"]').onclick = function () { n = Math.max(1, n - 1); snd('tick'); box.innerHTML = body(); bind(box); };
      box.querySelector('[data-act="plus"]').onclick = function () { n = Math.min(st.max, n + 1); snd('tick'); box.innerHTML = body(); bind(box); };
      box.querySelector('[data-act="close"]').onclick = closeModal;
      box.querySelector('[data-act="go"]').onclick = function () {
        var res = credit(G.takeLeave(state, n));
        closeModal();
        if (!res) return;
        if (!state.over) missionToast(Meta.track('leave'));
        trackEvents(res);
        save();
        renderHUD();
        animateDeltas(res.deltas);
        showLeaveStory(res);
      };
    }
    openModal(body(), bind);
  }

  function showLeaveStory(res) {
    snd('win');
    var lines = (res.story || ['부대 밖 공기는 달았다.']).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    var evs = (res.events || []).map(function (e) { return '<li>' + esc(eventLine(e)) + '</li>'; }).join('');
    var malchul = state.over;
    openModal('<h3>' + (malchul ? '말년휴가 출발!' : '휴가 일기') + '</h3>' +
      (malchul ? '<p>부대 정문을 나선다. 다시 돌아올 일은… 짐 가지러 올 때뿐이다.</p>' : '<p class="sub">' + G.dateOf(state) + ' 복귀</p><ul class="story">' + lines + '</ul>') +
      (evs ? '<ul class="story">' + evs + '</ul>' : '') +
      '<div class="modal-actions"><button class="btn btn-primary" data-act="ok">' + (malchul ? '전역 신고하러 가기' : '부대 복귀…') + '</button></div>',
    function (box) { box.querySelector('[data-act="ok"]').onclick = closeModal; },
    function () {
      var promos = (res.events || []).filter(function (e) { return e.type === 'promo'; });
      function go() { if (state.over) showEnding(); else { renderHUD(); renderCard(true); } }
      if (promos.length && !state.over) showPromo(promos[promos.length - 1], go); else go();
    });
  }

  function openMenu() {
    if (!state) return;
    var np = G.nextPromo(state);
    var U = G.unitOf(state), T = G.traitOf(state);
    var confirmReset = false;
    function html() {
      return '<h3>메뉴</h3>' +
        '<div class="wallet"><span>현금 ' + won(state.money) + '</span><span>적금 ' + won(state.savings) + '</span><span>💎 ' + num(Meta.get().gems) + '</span></div>' +
        '<p class="sub">입대 ' + G.dateOf(state, 0) + ' · 전역 ' + G.fmtDate(state.end) + (np ? ' · 다음 진급 ' + np.rank + ' ' + np.date : '') + '</p>' +
        (state.rank >= 1 && U.name ? '<p class="info-line">' + U.emoji + ' <b>' + U.name + '</b> — ' + U.perk + '</p>' : '<p class="info-line">🎲 자대는 훈련소 수료 때 정해진다.</p>') +
        (T.name ? '<p class="info-line">' + T.emoji + ' <b>' + T.name + '</b> — ' + T.desc + '</p>' : '') +
        state.conds.map(function (c) { var d = G.condDef(c.id); return '<p class="info-line">' + d.emoji + ' <b>' + d.name + '</b> (카드 ' + c.left + '장 남음) — ' + d.desc + '</p>'; }).join('') +
        '<div class="toggle-row"><span>효과음</span><button class="btn btn-small" data-act="sound">' + (settings.sound ? '켜짐' : '꺼짐') + '</button></div>' +
        '<div class="toggle-row"><span>진동</span><button class="btn btn-small" data-act="vibe">' + (settings.vibe ? '켜짐' : '꺼짐') + '</button></div>' +
        '<div class="toggle-row"><span>게임 방법</span><button class="btn btn-small" data-act="help">보기</button></div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-ghost" data-act="reset">' + (confirmReset ? '정말? 한 번 더 누르면 이번 판 삭제' : '처음부터 다시 입대') + '</button>' +
        '<button class="btn btn-ghost" data-act="title">타이틀로 (자동 저장)</button>' +
        '<button class="btn btn-primary" data-act="close">계속하기</button></div>';
    }
    function bind(box) {
      box.querySelector('[data-act="sound"]').onclick = function () { settings.sound = !settings.sound; applySettings(); box.innerHTML = html(); bind(box); };
      box.querySelector('[data-act="vibe"]').onclick = function () { settings.vibe = !settings.vibe; applySettings(); box.innerHTML = html(); bind(box); };
      box.querySelector('[data-act="help"]').onclick = function () { closeModal(); openHelp(); };
      box.querySelector('[data-act="reset"]').onclick = function () {
        if (!confirmReset) { confirmReset = true; box.innerHTML = html(); bind(box); return; }
        lsDel(KEYS.save); state = null; stopUrgent(); closeModal(); renderSetup();
      };
      box.querySelector('[data-act="title"]').onclick = function () { save(); stopUrgent(); closeModal(); state = null; renderTitle(); };
      box.querySelector('[data-act="close"]').onclick = closeModal;
    }
    openModal(html(), bind);
  }

  function openHelp() {
    openModal('<h3>게임 방법</h3>' +
      '<ul class="story">' +
      '<li>카드를 왼쪽·오른쪽으로 넘기거나 아래 버튼을 두 번 눌러 선택한다.</li>' +
      '<li>카드를 끌면 위쪽 스탯에 점이 뜬다. 점이 클수록 크게 변한다(오를지 내릴지는 비밀, 투시경을 쓰면 보인다).</li>' +
      '<li>체력·멘탈·간부 신뢰·전우애 중 하나라도 0이나 100이 되면 전역 실패. 너무 잘해도 말뚝 박힌다.</li>' +
      '<li>⚠ 돌발 상황은 제한 시간 안에 골라야 한다. 얼어붙으면 대개 나쁜 결과.</li>' +
      '<li>매달 1일엔 독감·세일·훈련 주간 같은 주간 상황이 생길 수 있다.</li>' +
      '<li>동료에게 선물하고 수다를 떨면 호감도가 오르고, 절친이 되면 특별한 효과가 생긴다.</li>' +
      '<li>매월 10일은 월급날. PX 아이템으로 위험한 스탯을 조절하자.</li>' +
      '<li>남은 휴가가 전역까지 남은 날보다 많으면 말년휴가를 나가 그대로 전역할 수 있다.</li>' +
      '<li>다이아(💎)로 상점에서 전역 보험, 투시경, 꾸미기를 산다. 점수로 랭킹을 겨룬다.</li>' +
      '</ul><div class="modal-actions"><button class="btn btn-primary" data-act="close">알겠습니다!</button></div>',
    function (box) { box.querySelector('[data-act="close"]').onclick = closeModal; });
  }

  /* ── 엔딩 ───────────────────────────── */
  function shareText(s, rec) {
    var E = JY.ENDINGS[s.over.id];
    return '🪖 전역각 ' + (s.daily ? '⭐오늘의 작전 ' : '') + '| ' + G.RANKS[s.rank] + ' ' + s.name + ' · ' + G.unitOf(s).name + '\n' +
      (s.over.good ? '🎓 ' : '💥 ') + E.title + ' · ' + num(rec.score) + '점 (' + rec.title + ')\n#전역각 #국방부시계는돌아간다';
  }

  function showEnding() {
    busy = false;
    stopUrgent();
    var s = state;
    var o = s.over;
    var E = JY.ENDINGS[o.id] || JY.ENDINGS.normal;
    var sc = o.score || G.score(s);
    var served0 = o.day + (o.good ? 1 : 0);
    var mdone = Meta.track('days', served0, true);
    if (o.good) mdone = mdone.concat(Meta.track('discharge'));
    if (s.daily) mdone = mdone.concat(Meta.track('daily'));
    var r = Meta.finishRun(s);
    lsDel(KEYS.save);
    lastEnd = { s: s, r: r };
    var b = G.bank(s);
    var art = A.scene(E.bg, s.season) + charSVG(E.who, { mood: E.mood, meMood: E.mood, catCap: true });
    var also = o.list.slice(1).filter(function (id) { return id !== 'normal'; }).map(function (id) { return JY.ENDINGS[id].title; });
    var log = s.log.slice(-7).map(function (l) { return '<li>' + G.dateOf(s, l.day) + ' · ' + esc(l.text) + '</li>'; }).join('');
    var served = o.day + (o.good ? 1 : 0);
    $('#cert').className = 'cert ' + (o.good ? 'good' : 'bad');
    $('#cert').innerHTML =
      '<div class="cert-head"><small>' + (o.good ? '띨빵사단 인사과' : '띨빵사단 중대 행정반') + '</small><h2>' + (o.good ? '전 역 증' : '전역 보류 통지서') + '</h2></div>' +
      '<div class="cert-art">' + art + '</div>' +
      '<h3 class="ending-title">' + esc(E.title) + '</h3>' +
      '<p class="ending-text">' + esc(E.text) + '</p>' +
      (also.length ? '<p class="also">추가 달성: ' + also.map(esc).join(' · ') + '</p>' : '') +
      '<dl>' +
      '<dt>성명</dt><dd>' + G.RANKS[s.rank] + ' ' + esc(s.name) + '</dd>' +
      '<dt>부대 · 보직</dt><dd>' + esc(G.unitOf(s).name || '-') + ' · ' + G.MOS[s.mos].name + '</dd>' +
      (G.traitOf(s).name ? '<dt>성격</dt><dd>' + G.traitOf(s).emoji + ' ' + G.traitOf(s).name + '</dd>' : '') +
      '<dt>복무 기간</dt><dd>' + G.dateOf(s, 0) + ' ~ ' + (o.good ? G.fmtDate(s.end) : G.dateOf(s) + ' (중단)') + '</dd>' +
      '<dt>복무 일수</dt><dd>' + served + '일 / ' + (s.total + 1) + '일 (' + Math.round(served / (s.total + 1) * 100) + '%)</dd>' +
      '<dt>넘긴 카드</dt><dd>' + s.cards + '장 · 돌발 ' + s.emer.count + '회 · 미니게임 ' + s.minis.played + '회</dd>' +
      '<dt>사용한 휴가</dt><dd>' + s.leaveUsed + '일</dd>' +
      '<dt>' + (o.good ? '전역 통장' : '통장 잔고') + '</dt><dd>' + won(b.total) + (o.good ? ' (적금 매칭 포함)' : '') + '</dd>' +
      '</dl>' +
      (log ? '<ul class="log">' + log + '</ul>' : '') +
      '<div class="seal">' + (o.good ? '전역' : '보류') + '</div>';

    var parts = sc.parts.map(function (p) { return '<li><span>' + esc(p.label) + '</span><b>+' + num(p.n) + '</b></li>'; }).join('');
    var multLine = sc.mult !== 1 ? '<li><span>배수 (' + (s.pace === 3 ? '속성 ×0.7' : '') + (G.traitOf(s).scoreMult ? ' 성격 ×' + G.traitOf(s).scoreMult : '') + ')</span><b>×' + sc.mult.toFixed(2) + '</b></li>' : '';
    var ach = r.ach.map(function (a) { return '<span class="medal-chip">' + a.icon + ' ' + esc(a.name) + ' <em>+' + a.gem + '💎</em></span>'; }).join('');
    var newEnd = r.newEndings.map(function (id) { return '<span class="medal-chip new">📖 새 엔딩: ' + esc(JY.ENDINGS[id].title) + '</span>'; }).join('');
    var gemsTotal = r.reward + r.runGems + r.ach.reduce(function (a, x) { return a + x.gem; }, 0);
    $('#score-panel').innerHTML =
      '<div class="score-head"><small>' + (s.daily ? '⭐ 오늘의 작전 점수' : '전역각 점수') + '</small><b class="score-num">' + num(sc.total) + '</b><span class="score-title">' + esc(sc.title) + '</span></div>' +
      '<ul class="score-parts">' + parts + multLine + '</ul>' +
      '<p class="score-gems">💎 +' + num(gemsTotal) + ' <small>(이번 판 획득 ' + r.runGems + ' · 정산 ' + r.reward + (r.ach.length ? ' · 훈장 ' + (gemsTotal - r.reward - r.runGems) : '') + ')</small></p>' +
      (newEnd || ach ? '<div class="medal-row">' + newEnd + ach + '</div>' : '') +
      '<p class="score-rank">' + (r.place >= 0 ? '🏅 내 기록 ' + (r.place + 1) + '위' + (r.place === 0 ? ' — 신기록!' : '') : '내 기록 10위 밖') + ' <span id="rank-sync">· 전군 랭킹 확인 중…</span></p>' +
      jjamPanel(r, mdone);

    showScreen('scr-end');
    if (o.good) { snd('win'); confetti(); } else { snd('fail'); if (JY.buzz) JY.buzz([80, 60, 80, 60, 200]); }
    if (r.levelUps && r.levelUps.length) setTimeout(function () { showLevelUp(r.levelUps, r.unlocked); }, 1400);
    else if (r.unlocked && r.unlocked.length) setTimeout(function () { showLevelUp([], r.unlocked); }, 1400);
    JY.Rank.submit(r.record).then(function (x) {
      var el = $('#rank-sync'); if (!el) return;
      el.textContent = x.ok ? (x.changed ? '· 전군 랭킹에 반영됐다!' : '· 전군 랭킹 최고 기록 유지 중') : '· ' + (x.reason || '전군 랭킹 미반영');
    });
    state = null;
  }

  function shareResult() {
    if (!lastEnd) return;
    var text = shareText(lastEnd.s, lastEnd.r.record);
    function fallback() {
      openModal('<h3>기록 공유</h3><p class="sub">아래 글을 복사해서 친구에게 보내자.</p><textarea class="share-text" id="share-text" readonly>' + esc(text) + '</textarea>' +
        '<div class="modal-actions"><button class="btn btn-primary" data-act="close">닫기</button></div>',
      function (box) { var t = box.querySelector('#share-text'); t.focus(); t.select(); box.querySelector('[data-act="close"]').onclick = closeModal; });
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('기록을 복사했다! 단톡방에 붙여 넣자.'); snd('coin'); }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }

  /* ── 기록실: 도감 + 훈장 ─────────────── */
  var albumTab = 'endings';
  function renderAlbum(back) {
    var m = Meta.get();
    var got = m.endings || {};
    var ids = JY.ENDING_ORDER;
    var n = ids.filter(function (id) { return got[id]; }).length;
    var nm = JY.ACHIEVEMENTS.filter(function (a) { return m.ach[a.id]; }).length;
    $('#album-progress').textContent = albumTab === 'endings' ? n + '/' + ids.length : nm + '/' + JY.ACHIEVEMENTS.length;
    $('#medal-count').textContent = nm + '/' + JY.ACHIEVEMENTS.length;
    var cp = Meta.collectProgress();
    $('#scene-count').textContent = Math.round(cp.frac * 100) + '%';
    if (albumTab === 'scenes') $('#album-progress').textContent = cp.n + '/' + cp.total;
    $$('#album-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === albumTab)); });
    var grid = $('#album-grid');
    grid.className = 'album-grid' + (albumTab === 'medals' ? ' medals' : albumTab === 'scenes' ? ' scenes' : '');
    if (albumTab === 'scenes') {
      grid.innerHTML = '<div class="collect-head"><b>' + cp.n + ' / ' + cp.total + '</b> 장면 수집 <i class="lv-bar big"><i style="width:' + Math.round(cp.frac * 100) + '%"></i></i>' +
        '<small>카드는 같아도 장면·질문이 여러 버전이다. 새 장면을 처음 보면 카드에 NEW가 뜬다.</small></div>' +
        JY.COLLECT_MILESTONES.map(function (ms, i) {
          var reached = cp.frac >= ms.at, got = m.collectClaimed[i];
          var cos = ms.cos ? ' + ' + JY.COSMETICS[ms.cos].icon + ' ' + JY.COSMETICS[ms.cos].name : '';
          return '<div class="milestone' + (got ? ' got' : reached ? ' ready' : '') + '"><span>' + Math.round(ms.at * 100) + '%</span><b>💎' + ms.gem + ' · 🍚' + ms.jjam + cos + '</b>' +
            (got ? '<em>받음</em>' : reached ? '<button class="btn btn-small btn-primary" data-claimc="' + i + '">받기</button>' : '<em>' + Math.round(ms.at * cp.total) + '장 필요</em>') + '</div>';
        }).join('');
      $$('[data-claimc]', grid).forEach(function (b) {
        b.onclick = function () {
          var res = Meta.claimCollect(+b.dataset.claimc);
          if (!res) return;
          snd('reveal'); confetti(); toast('사건 수첩 보상! 💎 +' + res.ms.gem + ' · 짬 +' + res.ms.jjam);
          if (res.ups && res.ups.length) showLevelUp(res.ups, []);
          renderAlbum();
        };
      });
    } else if (albumTab === 'endings') {
      grid.innerHTML = ids.map(function (id) {
        var E = JY.ENDINGS[id];
        if (!got[id]) {
          return '<div class="album-card locked ' + (E.good ? 'good' : 'bad') + '"><div class="thumb">?</div><b>' + (E.good ? '전역 엔딩' : '실패 엔딩') + '</b><small>힌트: ' + HINTS[id] + '</small></div>';
        }
        return '<div class="album-card ' + (E.good ? 'good' : 'bad') + '"><div class="thumb">' + A.scene(E.bg, 'spring') + charSVG(E.who, { mood: E.mood, meMood: E.mood, catCap: true, rank: E.good ? 4 : 2 }) + '</div><b>' + esc(E.title) + '</b><small>' + got[id] + '회 달성</small></div>';
      }).join('');
    } else {
      grid.innerHTML = JY.ACHIEVEMENTS.map(function (a) {
        var on = !!m.ach[a.id];
        return '<div class="medal' + (on ? ' on' : '') + '"><i>' + (on ? a.icon : '🔒') + '</i><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + '</small><em>' + (on ? '획득 ' + m.ach[a.id] : '+' + a.gem + '💎') + '</em></div>';
      }).join('');
    }
    $('#album-stats').textContent = '입대 ' + (m.runs || 0) + '회 · 전역 ' + (m.discharges || 0) + '회 · 실패 ' + (m.fails || 0) + '회 · 최장 복무 ' + (m.best || 0) + '일 · 누적 💎 ' + num(m.gemsTotal);
    $('#btn-album-back').onclick = back || renderTitle;
    showScreen('scr-album');
  }

  /* ── 랭킹 ───────────────────────────── */
  var rankTab = 'global';
  var rankBack = null;
  function medal(i) { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + ''; }
  function unitShort(id) { return JY.UNITS[id] ? JY.UNITS[id].emoji + ' ' + JY.UNITS[id].short : ''; }
  function endTitle(id) { return JY.ENDINGS[id] ? JY.ENDINGS[id].title : ''; }

  function renderRank(back) {
    if (back) rankBack = back;
    $('#btn-rank-back').onclick = rankBack || renderTitle;
    $$('#rank-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === rankTab)); });
    var list = $('#rank-list'), status = $('#rank-status');
    showScreen('scr-rank');
    if (rankTab === 'mine') {
      var m = Meta.get();
      status.textContent = '이 기기에 저장된 내 최고 기록 10개.';
      list.innerHTML = m.records.length ? m.records.map(function (x, i) {
        return '<li class="rank-row' + (i < 3 ? ' top' : '') + '"><span class="rk">' + medal(i) + '</span><span class="rn"><b>' + esc(x.name) + ' ' + esc(x.cos || '') + '</b><small>' + (x.daily ? '⭐ ' : '') + esc(endTitle(x.ending)) + ' · ' + esc(unitShort(x.unit)) + ' · ' + esc(x.date || '') + '</small></span><span class="rs"><b>' + num(x.score) + '</b><small>' + esc(x.title || '') + '</small></span></li>';
      }).join('') : '<li class="rank-empty">아직 기록이 없다. 입대부터 하자!</li>';
      return;
    }
    status.textContent = '불러오는 중…';
    list.innerHTML = '';
    var kind = rankTab;
    JY.Rank.top(kind).then(function (r) {
      if (rankTab !== kind || $('#scr-rank').hidden) return;
      var st = JY.Rank.status();
      if (!r.ok) {
        status.textContent = r.reason || st.reason;
        var m2 = Meta.get();
        if (kind === 'daily') {
          var d = m2.daily[G.todayStr()];
          list.innerHTML = d ? '<li class="rank-row me"><span class="rk">나</span><span class="rn"><b>' + esc(d.name || '') + '</b><small>' + esc(endTitle(d.ending)) + '</small></span><span class="rs"><b>' + num(d.score) + '</b></span></li>' : '<li class="rank-empty">오늘의 작전에 아직 참가하지 않았다.</li>';
        }
        return;
      }
      status.textContent = (kind === 'daily' ? '⭐ ' + G.todayStr() + ' 오늘의 작전 · 모두 같은 조건' : '역대 최고 점수') + (st.canWrite ? '' : ' · ' + (st.reason || '')) + (r.fromCache ? ' · 오프라인 사본' : '');
      list.innerHTML = r.list.length ? r.list.map(function (x, i) {
        var sc = kind === 'daily' ? x.dScore : x.score;
        var nm = kind === 'daily' ? (x.dName || x.name) : x.name;
        var en = kind === 'daily' ? x.dEnding : x.ending;
        return '<li class="rank-row' + (i < 3 ? ' top' : '') + (x.id === r.me ? ' me' : '') + '"><span class="rk">' + medal(i) + '</span><span class="rn"><b>' + esc(nm) + ' ' + esc(x.cos || '') + (x.id === r.me ? ' <em>나</em>' : '') + '</b><small>' + esc(endTitle(en)) + (kind === 'daily' ? '' : ' · ' + esc(unitShort(x.unit))) + '</small></span><span class="rs"><b>' + num(sc) + '</b><small>' + esc(kind === 'daily' ? JY.scoreTitle(sc) : x.title) + '</small></span></li>';
      }).join('') : '<li class="rank-empty">' + (kind === 'daily' ? '오늘 1등이 비어 있다. 지금 출격하면 1등!' : '아직 아무도 없다. 첫 기록의 주인공이 되자!') + '</li>';
    });
  }

  /* ── 상점 ───────────────────────────── */
  var shopTab = 'items';
  var shopBack = null;
  var SHOP_TALK = ['어서 와라. 다이아만 있으면 뭐든 구해준다.', '전역 보험? 이거 하나면 꿈이었다 엔딩 가능.', '황금 헬멧은 사단장님도 없다. 쉿.', '보급 상자는 운이다. 행운을 빈다.', '현금은 안 받는다. 다이아만.'];
  function renderShop(back) {
    if (back) shopBack = back;
    $('#btn-shop-back').onclick = shopBack || renderTitle;
    if ($('#scr-shop').hidden) showScreen('scr-shop');
    renderGems();
    $('#shop-me').innerHTML = charSVG('me', { rank: 4 });
    $('#shop-talk').textContent = pick(SHOP_TALK);
    $$('#shop-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === shopTab)); });
    var body = $('#shop-body'), m = Meta.get();
    if (shopTab === 'items') {
      body.innerHTML = '<div class="shop-list">' + JY.PREMIUM_ORDER.map(function (id) {
        var p = JY.PREMIUM[id];
        return '<div class="shop-item"><i>' + p.icon + '</i><div><b>' + p.name + ' <small>보유 ' + Meta.stash(id) + '</small></b><small>' + p.desc + '</small></div>' +
          '<button class="btn btn-small btn-primary" data-buy="' + id + '"' + (m.gems < p.price ? ' disabled' : '') + '>💎 ' + p.price + '</button></div>';
      }).join('') + '</div>';
    } else if (shopTab === 'cos') {
      body.innerHTML = cosGrid(true);
    } else {
      var fb = m.freeBoxes || 0;
      body.innerHTML = '<div class="box-area">' + (fb ? '<button class="btn btn-daily" id="free-box">🎁 무료 보급 상자 열기 (' + fb + '개)</button>' : '') + '<button class="supply-box" id="supply-box" aria-label="보급 상자 열기"><span class="box-emoji">📦</span><b>보급 상자</b><small>💎 ' + JY.BOX.price + '</small></button>' +
        '<ul class="box-odds">' + JY.BOX.tiers.map(function (t) {
          var what = t.id === 'common' ? '짬처리권·PX 프리패스·회식권 2개' : t.id === 'rare' ? '투시경·네잎클로버·포상휴가증 2개' : t.id === 'epic' ? '전역 보험 또는 꾸미기(무지개 아프로 포함)' : '전역 왕관 (이미 있으면 💎 100)';
          return '<li><span class="tier" style="background:' + t.color + '">' + t.name + '</span> ' + Math.round(t.p * 100) + '% — ' + what + '</li>';
        }).join('') + '</ul></div>';
      var bx = $('#supply-box');
      if (m.gems < JY.BOX.price) bx.classList.add('poor');
      bx.onclick = function () { openBoxFlow(false); };
      var fbb = $('#free-box'); if (fbb) fbb.onclick = function () { openBoxFlow(true); };
    }
    $$('[data-buy]', body).forEach(function (b) {
      b.onclick = function () {
        if (Meta.buyPremium(b.dataset.buy)) { snd('gem'); toast(JY.PREMIUM[b.dataset.buy].name + ' 구매! 게임 중 가방에서 꺼내 쓴다.'); renderShop(); }
        else toast('다이아가 부족하다.');
      };
    });
    $$('[data-cos]', body).forEach(function (b) {
      b.onclick = function () {
        if (Meta.buyCos(b.dataset.cos)) { snd('reveal'); confetti(); toast(JY.COSMETICS[b.dataset.cos].name + ' 구매 & 착용!'); renderShop(); }
        else toast('다이아가 부족하다.');
      };
    });
    $$('[data-equip]', body).forEach(function (b) { b.onclick = function () { Meta.equip(b.dataset.equip); snd('tap'); renderShop(); }; });
  }

  function openBoxFlow(free) {
    var bx = $('#supply-box');
    if (!free && Meta.get().gems < JY.BOX.price) { toast('다이아가 부족하다. 전역하고 출석하면 모인다!'); return; }
    var out = Meta.openBox(free);
    if (!out) return;
    renderGems();
    bx.classList.add('shake');
    snd('box');
    setTimeout(function () {
      bx.classList.remove('shake');
      snd('reveal');
      if (out.tier.id === 'legend' || out.tier.id === 'epic') confetti();
      var got = out.cos ? '<div class="reveal-item"><i>' + JY.COSMETICS[out.cos].icon + '</i><b>' + JY.COSMETICS[out.cos].name + '</b><small>꾸미기 획득! 상점 꾸미기 탭에서 착용</small></div>' : '';
      got += out.items.map(function (id) { return '<div class="reveal-item"><i>' + JY.PREMIUM[id].icon + '</i><b>' + JY.PREMIUM[id].name + '</b><small>특급 보급품 창고로</small></div>'; }).join('');
      if (out.gems) got += '<div class="reveal-item"><i>💎</i><b>다이아 ' + out.gems + '</b><small>왕관은 이미 있다! 대신 다이아</small></div>';
      openModal('<div class="reveal" style="--tier:' + out.tier.color + '"><span class="tier big" style="background:' + out.tier.color + '">' + out.tier.name + '</span><h3>보급 상자 개봉!</h3><div class="reveal-items">' + got + '</div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-act="again">' + (Meta.get().freeBoxes > 0 ? '무료 상자 하나 더' : '하나 더 (💎' + JY.BOX.price + ')') + '</button><button class="btn btn-primary" data-act="close">좋다!</button></div></div>',
      function (box) {
        box.querySelector('[data-act="close"]').onclick = closeModal;
        box.querySelector('[data-act="again"]').onclick = function () { closeModal(); openBoxFlow(Meta.get().freeBoxes > 0); };
      }, function () { renderShop(); });
    }, 900);
  }

  /* ── 짬 · 레벨업 ─────────────────────── */
  function jjamPanel(r, mdone) {
    var lv = Meta.level();
    var m = (mdone || []).map(function (d) { return '<span class="medal-chip">🎯 ' + esc(d.text) + '</span>'; }).join('');
    return '<div class="jjam-panel"><p>🍚 짬 +' + num(r.jjam) + ' <small>(버틴 날 + 점수' + (r.record.good ? ' + 전역 보너스' : '') + ')</small></p>' +
      '<p class="lv-line"><em>Lv.' + lv.lv + '</em> ' + esc(lv.title) + ' <i class="lv-bar"><i style="width:' + Math.round(lv.cur / lv.need * 100) + '%"></i></i> <small>' + lv.cur + '/' + lv.need + '</small></p>' +
      (m ? '<div class="medal-row">' + m + '</div>' : '') +
      '<p class="sub-cream">짬으로 막사에서 장비를 강화하면 다음 판이 더 수월해진다.</p></div>';
  }

  function showLevelUp(ups, unlocked) {
    var last = ups[ups.length - 1];
    var lv = Meta.level();
    var gems = ups.reduce(function (a, u) { return a + u.gem; }, 0), boxes = ups.reduce(function (a, u) { return a + u.box; }, 0);
    var cos = (unlocked || []).map(function (id) { var c = JY.COSMETICS[id]; return '<div class="reveal-item"><i>' + c.icon + '</i><b>' + c.name + '</b><small>' + JY.SLOT_NAMES[c.slot] + ' 해금! 막사 옷장에서 입기</small></div>'; }).join('');
    snd('promo'); confetti();
    openModal('<div class="reveal">' + (last ? '<span class="tier big" style="background:#e0b347;color:#2a2620">짬 레벨 UP</span><h3>Lv.' + last.lv + ' ' + esc(lv.title) + '</h3>' +
      '<p>💎 +' + gems + (boxes ? ' · 🎁 무료 보급 상자 ' + boxes + '개' : '') + '</p>' : '<h3>새 꾸미기 해금!</h3>') +
      (cos ? '<div class="reveal-items">' + cos + '</div>' : '') +
      '<div class="modal-actions"><button class="btn btn-primary" data-act="close">충성!</button></div></div>',
    function (box) { box.querySelector('[data-act="close"]').onclick = closeModal; });
  }

  /* ── 옷장 그리드 (상점·막사 공용) ─────── */
  function cosGrid(shop) {
    var m = Meta.get();
    return JY.SLOT_ORDER.map(function (slot) {
      var items = JY.COSMETIC_ORDER.filter(function (id) { return JY.COSMETICS[id].slot === slot; });
      return '<h4 class="slot-head">' + JY.SLOT_NAMES[slot] + '</h4><div class="cos-grid">' + items.map(function (id) {
        var c = JY.COSMETICS[id], owned = Meta.ownsCos(id), on = m.cos.eq[c.slot] === id;
        var btn;
        if (owned) btn = '<button class="btn btn-small' + (on ? ' btn-primary' : '') + '" data-equip="' + id + '">' + (on ? '착용 중' : '착용') + '</button>';
        else if (c.gacha) btn = '<span class="gacha-only">보급 상자 ' + (c.gacha === 'legend' ? '전설' : '영웅') + '</span>';
        else if (c.unlock) btn = '<span class="gacha-only lock">🔒 ' + esc(Meta.unlockText(c)) + '</span>';
        else btn = shop ? '<button class="btn btn-small btn-primary" data-cos="' + id + '"' + (m.gems < c.price ? ' disabled' : '') + '>💎 ' + c.price + '</button>' : '<span class="gacha-only">상점 💎' + c.price + '</span>';
        return '<div class="cos' + (on ? ' on' : '') + (owned ? ' owned' : '') + '"><i>' + c.icon + '</i><b>' + c.name + '</b>' + btn + '</div>';
      }).join('') + '</div>';
    }).join('');
  }

  /* ── 막사: 외모 · 옷장 · 장비 강화 · 임무 ── */
  var barracksTab = 'face';
  var barracksBack = null;
  var FACE_CATS = [
    { k: 'eyes', name: '눈' }, { k: 'mouth', name: '입' }, { k: 'brows', name: '눈썹' },
    { k: 'head', name: '얼굴형' }, { k: 'skin', name: '피부' }, { k: 'extras', name: '특징' }
  ];
  var SKINS = ['#ffd9b5', '#f6c79c', '#eab386', '#f9d2a8', '#d9a07a'];
  var EXTRA_NAMES = ['없음', '볼터치', '왕귀', '콧물', '볼터치+왕귀'];

  function faceOpts(k) { return k === 'skin' ? SKINS : JY.FACE_OPTIONS[k]; }
  function faceIdx(face, k) {
    var opts = faceOpts(k);
    if (k === 'extras') { var j = JSON.stringify(face.extras || []); for (var i = 0; i < opts.length; i++) if (JSON.stringify(opts[i]) === j) return i; return 0; }
    var x = opts.indexOf(face[k]); return x < 0 ? 0 : x;
  }

  function renderBarracks(back) {
    if (back) barracksBack = back;
    $('#btn-barracks-back').onclick = barracksBack || renderTitle;
    if ($('#scr-barracks').hidden) showScreen('scr-barracks');
    var m = Meta.get();
    if (!m.face) { m.face = randomFace(); Meta.save(); }
    setup.face = m.face;
    renderGems();
    var lv = Meta.level();
    $('#me-big').innerHTML = charSVG('me', { rank: 4 });
    $('#me-name').textContent = (m.lastName || '나띨빵') + ' ' + Meta.badge();
    $('#me-lv').textContent = 'Lv.' + lv.lv;
    $('#me-title').textContent = lv.title;
    $('#me-lvbar').style.width = Math.round(lv.cur / lv.need * 100) + '%';
    $('#me-lvtext').textContent = lv.cur + ' / ' + lv.need + ' 짬 (다음 레벨 💎20' + (JY.LEVELS.rewards[lv.lv + 1] ? ' + 보너스' : '') + ')';
    $('#me-jjam').textContent = '🍚 짬 ' + num(m.jjam);
    $('#mission-badge').textContent = Meta.missionAlert() ? '!' : '';
    $$('#barracks-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === barracksTab)); });
    var body = $('#barracks-body');
    if (barracksTab === 'face') {
      body.innerHTML = '<div class="face-rows">' + FACE_CATS.map(function (fc) {
        var opts = faceOpts(fc.k), i = faceIdx(m.face, fc.k);
        var label = fc.k === 'skin' ? '<i class="skin-dot" style="background:' + opts[i] + '"></i>' : fc.k === 'extras' ? EXTRA_NAMES[i] || i : (i + 1) + '번';
        return '<div class="face-row"><span>' + fc.name + '</span><button class="btn btn-small" data-face="' + fc.k + '" data-d="-1" aria-label="' + fc.name + ' 이전">◀</button><b>' + label + ' <small>' + (i + 1) + '/' + opts.length + '</small></b><button class="btn btn-small" data-face="' + fc.k + '" data-d="1" aria-label="' + fc.name + ' 다음">▶</button></div>';
      }).join('') + '</div><div class="modal-actions"><button class="btn btn-ghost" id="face-random">🎲 무작위</button></div>' +
        '<p class="sub">외모는 무료다. 모자·옷·소품은 옷장에서.</p>';
      $$('[data-face]', body).forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.face, opts = faceOpts(k), i = faceIdx(m.face, k);
          var n = (i + (+b.dataset.d) + opts.length) % opts.length;
          m.face[k] = k === 'extras' ? opts[n].slice() : opts[n];
          Meta.save(); snd('tap'); renderBarracks();
        };
      });
      $('#face-random').onclick = function () { m.face = randomFace(); Meta.save(); snd('box'); renderBarracks(); };
    } else if (barracksTab === 'wardrobe') {
      body.innerHTML = '<p class="sub">레벨·훈장·수집으로 해금하거나 상점에서 산다. 슬롯마다 하나씩 입는다.</p>' + cosGrid(false);
      $$('[data-equip]', body).forEach(function (b) { b.onclick = function () { Meta.equip(b.dataset.equip); snd('tap'); renderBarracks(); }; });
    } else if (barracksTab === 'gear') {
      body.innerHTML = '<p class="sub">짬으로 장비를 강화하면 모든 판에 영구 적용된다. +4부터는 확률! 실패하면 짬 절반을 돌려받는다.</p><div class="gear-list">' +
        JY.UPGRADES.map(function (u) {
          var l = Meta.upLevel(u.id), max = l >= 5;
          var cost = max ? 0 : JY.UPGRADE_COST[l], rate = max ? 1 : JY.UPGRADE_RATE[l];
          return '<div class="gear-row' + (l ? ' lv' : '') + '"><i>' + u.icon + '</i><div><b>' + u.name + ' <em>+' + l + '</em></b><small>' + u.desc + '</small>' +
            '<small class="now">현재: ' + (l ? u.per(l) : '없음') + (max ? '' : ' → ' + u.per(l + 1)) + '</small></div>' +
            (max ? '<span class="gacha-only">MAX</span>' : '<button class="btn btn-small btn-primary" data-up="' + u.id + '"' + (m.jjam < cost ? ' disabled' : '') + '>🍚' + cost + (rate < 1 ? '<br><small>' + Math.round(rate * 100) + '%</small>' : '') + '</button>') + '</div>';
        }).join('') + '</div>';
      $$('[data-up]', body).forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.up, u = JY.UPGRADES.filter(function (x) { return x.id === id; })[0];
          b.disabled = true;
          body.querySelector('.gear-list').classList.add('forging');
          snd('box');
          setTimeout(function () {
            var r = Meta.upgrade(id);
            if (!r.ok) { toast(r.reason); renderBarracks(); return; }
            if (r.success) { snd('reveal'); confetti(); toast('🔨 강화 성공! ' + u.icon + ' ' + u.name + ' +' + r.lv, 2600); }
            else { snd('bad'); if (JY.buzz) JY.buzz([60, 40, 60]); toast('💥 강화 실패… 짬 ' + r.refund + ' 돌려받음. 다시 도전!', 2600); }
            renderBarracks();
          }, 700);
        };
      });
    } else {
      var ms = Meta.missions();
      body.innerHTML = '<p class="sub">매일 3개. 다 받으면 🎁 무료 보급 상자! (내일 새 임무)</p><div class="mission-list">' + ms.list.map(function (x, i) {
        var d = Meta.missionDef(x.id), pct = Math.round(x.prog / d.goal * 100);
        return '<div class="mission' + (x.claimed ? ' claimed' : x.done ? ' done' : '') + '"><div><b>' + esc(d.text) + '</b><i class="lv-bar"><i style="width:' + pct + '%"></i></i><small>' + num(x.prog) + ' / ' + num(d.goal) + ' · 보상 💎' + d.gem + ' 🍚' + d.jjam + '</small></div>' +
          (x.claimed ? '<em>완료</em>' : x.done ? '<button class="btn btn-small btn-primary" data-claim="' + i + '">받기</button>' : '<em>진행 중</em>') + '</div>';
      }).join('') + '</div><p class="mission-bonus' + (ms.bonus ? ' got' : '') + '">🎁 전부 완료 보너스: 무료 보급 상자 ' + (ms.bonus ? '— 받음! 상점에서 열기' : '') + '</p>';
      $$('[data-claim]', body).forEach(function (b) {
        b.onclick = function () {
          var res = Meta.claimMission(+b.dataset.claim);
          if (!res) return;
          snd('gem');
          toast('🎯 보상: 💎 +' + res.d.gem + ' · 🍚 짬 +' + res.d.jjam + (res.bonus ? ' · 🎁 무료 상자!' : ''), 2600);
          if (res.bonus) confetti();
          if (res.ups && res.ups.length) showLevelUp(res.ups, res.unlocked);
          renderBarracks();
        };
      });
    }
  }

  /* ── 설정 ───────────────────────────── */
  function applySettings() {
    lsSet(KEYS.settings, settings);
    JY.settings = settings;
    if (JY.Sound) JY.Sound.setEnabled(settings.sound);
  }

  /* ── 출석 · 환영 ─────────────────────── */
  function greet() {
    var m = Meta.get();
    var att = Meta.attendance();
    var welcome = m.pendingWelcome;
    var upd = m.pendingUpdateGift;
    if (welcome) { delete m.pendingWelcome; Meta.save(); }
    if (upd) { delete m.pendingUpdateGift; Meta.save(); }
    if (!att && !welcome && !upd) return;
    renderGems();
    var html = '<div class="greet">';
    if (welcome) html += '<h3>입대 환영 선물!</h3><p>💎 <b>50</b> 다이아를 받았다. 상점에서 전역 보험이나 꾸미기를 사 보자.</p>';
    if (upd) html += '<h3>막사 개방! 🪖</h3><p>새 업데이트: 짬 레벨 · 장비 강화 · 오늘의 임무 · 옷장 · 사건 수첩.<br>그동안의 복무를 인정해 🍚 짬 <b>' + upd.jjam + '</b>, 💎 <b>' + upd.gem + '</b>을 받았다. 막사에서 장비를 강화해 보자!</p>';
    if (att) {
      html += '<h3>출석 체크 🗓️</h3><p>연속 <b>' + att.streak + '일</b> 출석! 💎 <b>+' + att.reward + '</b></p>' +
        '<div class="streak">' + [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<span class="' + (d <= Math.min(att.streak, 7) ? 'on' : '') + '">' + d + '일</span>'; }).join('') + '</div>' +
        '<p class="sub">매일 들어오면 보상이 커진다(최대 💎 28). 오늘의 작전도 잊지 말자!</p>';
      att.ach.forEach(function (a) { html += '<p class="medal-chip">' + a.icon + ' ' + esc(a.name) + ' +' + a.gem + '💎</p>'; });
    }
    html += '<div class="modal-actions"><button class="btn btn-primary" data-act="close">충성!</button></div></div>';
    openModal(html, function (box) { box.querySelector('[data-act="close"]').onclick = function () { if (JY.Sound) JY.Sound.unlock(); snd('gem'); closeModal(); }; }, renderTitle);
  }

  /* ── 시작 ───────────────────────────── */
  function continueGame(s) {
    state = s;
    G._setCur(state);
    busy = false;
    showScreen('scr-game');
    renderHUD();
    if (state.pendingMini) { busy = true; runMini({ mini: state.pendingMini.id, say: '', deltas: {}, events: [] }); return; }
    renderCard(true);
  }

  function bindTabs(sel, fn) {
    $(sel).addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) { snd('tap'); fn(b.dataset.tab); } });
  }

  function init(data) {
    Meta.load();
    settings = lsGet(KEYS.settings, null) || { sound: true, vibe: true };
    applySettings();
    buildStats();
    bindSwipe();
    JY.Rank.init();

    $('#btn-new').onclick = function () { if (JY.Sound) JY.Sound.unlock(); snd('tap'); renderSetup(); };
    $('#btn-continue').onclick = function () { if (JY.Sound) JY.Sound.unlock(); var s = loadSave(); if (s) continueGame(s); };
    $('#btn-daily').onclick = function () { if (JY.Sound) JY.Sound.unlock(); snd('tap'); openDaily(); };
    $('#btn-album').onclick = function () { albumTab = 'endings'; renderAlbum(renderTitle); };
    $('#btn-rank').onclick = function () { rankTab = 'global'; renderRank(renderTitle); };
    $('#btn-shop').onclick = function () { shopTab = Meta.get().freeBoxes > 0 ? 'box' : 'items'; renderShop(renderTitle); };
    $('#btn-barracks').onclick = function () { barracksTab = Meta.missionAlert() ? 'mission' : 'face'; renderBarracks(renderTitle); };
    $('#title-lv').onclick = function () { barracksTab = 'gear'; renderBarracks(renderTitle); };
    $('#mission-strip').onclick = function () { barracksTab = 'mission'; renderBarracks(renderTitle); };
    $('#btn-face-edit').onclick = function () { Meta.get().face = setup.face; Meta.save(); barracksTab = 'face'; renderBarracks(function () { setup.face = Meta.get().face; updateSetupPreview(); showScreen('scr-setup'); }); };
    bindTabs('#barracks-tabs', function (t) { barracksTab = t; renderBarracks(); });
    $('#btn-face').onclick = function () { setup.face = randomFace(); snd('tap'); updateSetupPreview(); };
    $('#btn-reroll').onclick = function () { if (setup.rerolled) return; setup.rerolled = true; snd('box'); drawTraits(); };
    $('#trait-grid').addEventListener('click', function (e) {
      var b = e.target.closest('.trait'); if (!b) return;
      setup.trait = b.dataset.trait; snd('tap'); renderTraits();
    });
    $('#in-name').addEventListener('input', updateSetupPreview);
    $('#in-date').addEventListener('change', updateDateNote);
    $('#in-date').addEventListener('input', updateDateNote);
    $('#mos-grid').addEventListener('click', function (e) {
      var b = e.target.closest('.mos'); if (!b) return;
      setup.mos = b.dataset.mos; snd('tap');
      $$('.mos').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
    $('#btn-setup-back').onclick = renderTitle;
    $('#setup-form').addEventListener('submit', function (e) { e.preventDefault(); if (JY.Sound) JY.Sound.unlock(); startGame(); });

    $('#dock-bag').onclick = function () { openBag(); };
    $('#dock-px').onclick = openPX;
    $('#dock-mates').onclick = openMates;
    $('#dock-leave').onclick = openLeave;
    $('#dock-menu').onclick = openMenu;
    $('#conds').addEventListener('click', function (e) {
      var b = e.target.closest('.cond'); if (!b || !state) return;
      if (b.dataset.cond) { var d = G.condDef(b.dataset.cond); toast(d.emoji + ' ' + d.name + ': ' + d.desc, 2600); }
      else if (b.dataset.buff) { var p = JY.PREMIUM[b.dataset.buff]; toast(p.icon + ' ' + p.name + ': ' + p.desc, 2600); }
    });
    $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    $('#btn-reenlist').onclick = function () { renderSetup(); };
    $('#btn-end-rank').onclick = function () { rankTab = lastEnd && lastEnd.s.daily ? 'daily' : 'global'; renderRank(function () { showScreen('scr-end'); }); };
    $('#btn-end-share').onclick = shareResult;
    $('#btn-end-shop').onclick = function () { shopTab = 'items'; renderShop(function () { showScreen('scr-end'); }); };
    $('#btn-end-title').onclick = renderTitle;
    bindTabs('#album-tabs', function (t) { albumTab = t; renderAlbum(); });
    bindTabs('#rank-tabs', function (t) { rankTab = t; renderRank(); });
    bindTabs('#shop-tabs', function (t) { shopTab = t; renderShop(); });
    $('#btn-rank-refresh').onclick = function () { renderRank(); };

    window.addEventListener('resize', fitCard);
    window.addEventListener('orientationchange', function () { setTimeout(fitCard, 200); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

    var restored = data && data.save && data.save.stats && !data.save.over ? G.migrate(data.save) : null;
    if (restored) continueGame(restored);
    else { renderTitle(); greet(); }

    try {
      if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
        window.claude.hot.snapshot(function () { return { save: state && !state.over ? state : null }; });
      }
    } catch (e) { /* 뷰어 밖 */ }

    try {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname)) {
        navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 캐시 실패는 무시 */ });
      }
    } catch (e) { /* 무시 */ }
  }

  JY.UI = { init: init, charSVG: charSVG, _state: function () { return state; } };

  var hot = window.claude && window.claude.hot;
  function boot() {
    if (hot && hot.ready) hot.ready(init);
    else init((hot && hot.data) || {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.JY = window.JY || {});
