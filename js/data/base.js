/* v6 자대 생활: 훈련소 선택 → 특기·보직·자대 결정, 자대에서는 부대 지도를 돌아다니며 행동·파밍·조합
 *  - JY.BASE.tags     훈련소 카드 선택지마다 붙는 소질 점수 (사격·체력·요리·행정·운전·의무·눈치)
 *  - JY.BASE.specs    특기 7종 (훈련소에서 가장 많이 쌓인 소질)
 *  - JY.BASE.locs     부대 지도의 장소와 행동 (행동력 소모, 행보관 위험, 파밍, 특기 전용 행동)
 *  - JY.BASE.loot     장소별 득템 표 (일반·희귀·영웅·전설)
 *  - JY.BASE.recipes  생활관 조합 (뽀글이 등)
 *  - JY.BASE.duty     턴마다 하는 일과 (카드·미니게임·자동)
 * 수치는 카드처럼 BALANCE 보정을 거치지 않고 그대로 쓴다 (행동은 효과가 미리 보이니까). */
(function (JY) {
  'use strict';

  function o(t, fx, say, x) {
    var r = { t: t, fx: fx || {}, say: say || '' };
    if (x) for (var k in x) r[k] = x[k];
    return r;
  }

  /* ───────── 특기 7종 ───────── */
  JY.BASE = {};
  JY.BASE.specs = {
    shoot: { name: '사격', emoji: '🎯', mos: 'infantry', desc: '사격장에서 특등사수 도전 → 포상휴가. 사격 연습 효과↑' },
    fit: { name: '체력', emoji: '💪', mos: 'infantry', desc: '체력단련장에서 특급전사 도전 → 포상휴가. 운동해도 덜 지친다' },
    cook: { name: '요리', emoji: '🍳', mos: 'cook', desc: '취사장에서 특식 만들기. 조합하면 하나 더 (Lv3)' },
    admin: { name: '행정', emoji: '📋', mos: 'clerk', desc: '행정반에서 휴가 일정 조율 → 휴가 +. 서류 일 효과↑' },
    drive: { name: '운전', emoji: '🚚', mos: 'driver', desc: '정비고에서 간부 수송 외출 → 바깥 음식 득템' },
    medic: { name: '의무', emoji: '🩹', mos: 'medic', desc: '의무실에서 동기 치료 → 전우애. 진료 효과↑' },
    social: { name: '눈치', emoji: '👀', mos: 'infantry', desc: '행보관에게 덜 걸린다. 동료 호감도↑' }
  };
  JY.BASE.specOrder = ['shoot', 'fit', 'cook', 'admin', 'drive', 'medic', 'social'];

  /* 자대: 소질 점수로 어디로 갈지 (점수가 같으면 운) */
  JY.BASE.unitWeights = {
    gop: { shoot: 1, fit: 0.6 },
    commando: { fit: 1.2, shoot: 0.3 },
    mech: { drive: 1.3, fit: 0.3 },
    coast: { shoot: 0.6, social: 0.6, medic: 0.3 },
    recruit: { social: 0.8, admin: 0.5, fit: 0.3 }
  };

  /* ───────── 훈련소 선택 → 소질 점수 ───────── */
  JY.BASE.tags = {
    tr_barber: { l: { social: 1 }, r: { fit: 1 } },
    tr_firstnight: { l: { social: 1, cook: 1 }, r: { medic: 1 } },
    tr_gas: { l: { medic: 1 }, r: { fit: 1 } },
    tr_religion: { l: { social: 1 }, r: { cook: 1 } },
    tr_grenade: { l: { fit: 2 }, r: { shoot: 1, admin: 1 } },
    tr_letter: { l: { admin: 2 }, r: { social: 1 } },
    tr_march: { l: { fit: 2 }, r: { medic: 1 } },
    tr_rainmarch: { l: { fit: 2 }, r: { medic: 1 } },
    tr_supply: { l: { social: 1 }, r: { fit: 1 } },
    tr_farewell: { l: { fit: 1 }, r: { social: 1 } },
    tr_snore: { l: { fit: 1 }, r: { social: 1 } },
    tr_ghost: { l: { social: 1 }, r: { admin: 1 } },
    tr_crawl: { l: { fit: 2 }, r: { drive: 1 } },
    tr_zero: { l: { shoot: 3 }, r: { shoot: 1, social: 1 } },
    tr_qna: { l: { admin: 2 }, r: { social: 1 } },
    tr_talent: { l: { social: 2 }, r: { cook: 1 } },
    tr_call: { l: { medic: 1 }, r: { social: 1 } },
    tr_parcel: { l: { admin: 1 }, r: { fit: 1 } },
    v5d_tr_milnum: { l: { social: 1 }, r: { admin: 1 } },
    v5d_tr_locker: { l: { admin: 2 }, r: { social: 1 } },
    v5d_tr_nametag: { l: { medic: 1, social: 1 }, r: { admin: 1 } },
    v5d_tr_mirror: { l: { shoot: 1 }, r: { social: 1 } },
    v5d_tr_sniff: { l: { social: 1 }, r: { medic: 1 } },
    v5d_tr_sauna: { l: { admin: 1 }, r: { fit: 1 } },
    v5d_tr_drill: { l: { social: 1 }, r: { fit: 1 } },
    v5d_tr_px: { l: { cook: 2 }, r: { admin: 1 } },
    v5d_tr_cpr: { l: { fit: 1 }, r: { medic: 2 } },
    v5d_tr_wash: { l: { fit: 1 }, r: { social: 1 } },
    v5d_tr_pushup: { l: { fit: 2 }, r: { social: 1 } },
    v5d_tr_stars: { l: { shoot: 2 }, r: { social: 1 } },
    v5d_tr_rifle: { l: { shoot: 2 }, r: { drive: 1 } },
    v5d_tr_age: { l: { social: 1 }, r: { admin: 1 } },
    v5e_tr_call: { l: { social: 1 }, r: { fit: 1 } },
    v5e_tr_goodnight: { l: { social: 1 }, r: { fit: 1 } },
    v5e_tr_white: { l: { social: 1 }, r: { admin: 1 } }
  };

  /* 훈련소 적성 카드: 특기가 확실히 갈리는 장면 (매판 3장) */
  var APT = [
    {
      id: 'apt_license', who: 'jogyo', bg: 'training', days: 2,
      text: '조교: "운전면허 있는 사람 손 들어!" 1종 보통이 지갑에서 반짝인다.',
      l: o('번쩍 든다', { tr: 3, mt: -2 }, '수송부 명단에 이름이 올라갔다. 옆 동기: "너 트럭 몰 줄 알아?"', { tag: { drive: 3 } }),
      r: o('가만히 있는다', { mt: 2 }, '"운전병은 새벽에 간부 태우러 간다더라." 손 안 들길 잘했…나?', { tag: { social: 1 } })
    },
    {
      id: 'apt_kitchen', who: 'cook', bg: 'mess', days: 2,
      text: '취사장 지원 2명 차출! 조교: "칼질 해 본 사람?" 감자 300개가 기다린다.',
      l: o('자원한다', { hp: -4, bd: 4 }, '감자를 깎다 깨달았다. 나는 요리에 재능이 있다. 300개째에.', { tag: { cook: 3 } }),
      r: o('눈을 피한다', { mt: 3, bd: -2 }, '박덤벙이 끌려갔다. 저녁 반찬이 감자조림이었다.', { tag: { social: 1 } })
    },
    {
      id: 'apt_paper', who: 'jogyo', bg: 'office', days: 2,
      text: '조교: "글씨 잘 쓰는 사람? 중대 행정 보조 한 명." 연필이 손에 쥐어져 있다.',
      l: o('"제가 하겠습니다"', { tr: 5, mt: -3 }, '명단 정리를 했다. 조교: "엑셀도 할 줄 아나?" 운명이 결정됐다.', { tag: { admin: 3 } }),
      r: o('악필인 척', { mt: 3, tr: -2 }, '일부러 삐뚤게 썼는데 원래 글씨였다.', { tag: { social: 1 } })
    },
    {
      id: 'apt_faint', who: 'trainee', bg: 'training', days: 2,
      text: '행군 중 옆 동기가 휘청이며 주저앉았다. 얼굴이 하얗다. 조교는 저 앞에 있다.',
      l: o('그늘로 옮기고 살핀다', { hp: -3, bd: 5 }, '물 먹이고 군장을 풀어 줬다. 의무병이 와서 말했다. "잘했어. 의무 쪽 체질이네."', { tag: { medic: 3 } }),
      r: o('조교를 부르러 뛴다', { hp: -4, tr: 3 }, '전력 질주로 조교를 데려왔다. 다리가 빨랐다.', { tag: { fit: 2 } })
    },
    {
      id: 'apt_record', who: 'jogyo', bg: 'training', days: 2,
      text: '기록사격 마지막 한 발. 지금까지 17발 명중. 이번에 맞히면 특등사수다.',
      l: o('숨을 멈추고 당긴다', { mt: 3, hp: -2 }, '"명중!" 사로 옆 조교가 처음으로 엄지를 들었다.', { tag: { shoot: 3 } }),
      r: o('빨리 쏘고 끝낸다', { mt: 2, tr: -2 }, '빗나갔다. 그래도 점심은 일찍 먹었다.', { tag: { social: 1 } })
    },
    {
      id: 'apt_run', who: 'jogyo', bg: 'field', days: 2,
      text: '체력측정 3km. 출발 총성. 앞에 아무도 없다. 내가 선두다.',
      l: o('끝까지 전력 질주', { hp: -6, tr: 5 }, '1등 골인. 토할 것 같지만 조교가 이름을 외웠다.', { tag: { fit: 3 } }),
      r: o('페이스 조절', { hp: -2, mt: 2 }, '중간 그룹으로 들어왔다. 계산된 평범함.', { tag: { admin: 1 } })
    },
    {
      id: 'apt_leader', who: 'jogyo', bg: 'barracks', days: 2,
      text: '조교: "훈련병 분대장 할 사람?" 생활관이 조용해진다. 다들 바닥을 본다.',
      l: o('손을 든다', { tr: 5, mt: -4 }, '24명의 인원 보고를 맡았다. 눈치가 늘었다. 흰머리도.', { tag: { social: 2, admin: 1 } }),
      r: o('박덤벙을 추천한다', { bd: 3, mt: 2 }, '박덤벙이 분대장이 됐다. 첫 인원 보고에서 자기를 빼먹었다.', { tag: { social: 1 } })
    },
    {
      id: 'apt_fix', who: 'trainee', bg: 'barracks', days: 2,
      text: '생활관 선풍기가 "끼익" 하고 멈췄다. 한여름이다. 모두의 눈이 선풍기에 꽂혀 있다.',
      l: o('나사를 풀어 본다', { bd: 5, tr: -2 }, '먼지를 털고 날개를 다시 끼웠다. 돌아간다! 별명: 정비병.', { tag: { drive: 2 } }),
      r: o('조교에게 보고', { tr: 3, mt: -2 }, '조교가 발로 한 번 찼다. 돌아간다. 군대식 정비.', { tag: { admin: 1 } })
    },
    {
      id: 'apt_ration', who: 'trainee', bg: 'field', days: 2,
      text: '야외 숙영. 전투식량에 물을 부었는데 동기들 것이 다 설익었다. 비결을 묻는다.',
      l: o('비법을 전수한다', { bd: 5, hp: -2 }, '"발열팩은 흔들고, 3분 더." 다들 감탄했다. 요리 소질 발견.', { tag: { cook: 2, social: 1 } }),
      r: o('내 것부터 먹는다', { hp: 4, bd: -3 }, '따끈했다. 동기들의 눈빛은 차가웠다.', { tag: { fit: 1 } })
    }
  ];
  JY.CARDS.training = JY.CARDS.training.concat(APT);
  // 훈련소를 더 길게: 일반 훈련 카드 7장 + 적성 카드 3장 (예전엔 4장)
  (function () {
    var slots = JY.CARDS.openingSlots;
    if (!slots) return;
    var pool = null;
    slots.forEach(function (s) { if (s.pool && s.pool.indexOf('tr_gas') >= 0) pool = s; });
    if (pool) pool.n = 7;
    var at = pool ? slots.indexOf(pool) + 1 : 3;
    slots.splice(at, 0, { pool: APT.map(function (c) { return c.id; }), n: 3 });
  })();

  /* ───────── 새 물건 (재료·득템·요리) ───────── */
  var NEW_ITEMS = {
    ramen: { name: '봉지라면', icon: '🍜', price: 1500, fx: { mt: 3 }, desc: '뽀글이의 재료. 그냥 부숴 먹어도 맛있다.' },
    coffee: { name: '커피믹스', icon: '☕', price: 500, fx: { mt: 2, hp: 1 }, desc: '행정반의 혈액. 우유와 섞으면…?' },
    milk: { name: '흰우유', icon: '🥛', price: 900, fx: { hp: 3 }, desc: '아침 배식 때 하나씩. 시리얼 재료.' },
    hotbar: { name: '핫바', icon: '🌭', price: 2000, fx: { hp: 3, mt: 2 }, desc: 'PX 전자레인지 40초. 냉동 파티 재료.' },
    gunbbang: { name: '건빵', icon: '🍘', px: false, fx: { hp: 2 }, desc: '보급창고 단골. 별사탕과 함께라면…' },
    star: { name: '별사탕', icon: '⭐', px: false, fx: { mt: 2 }, desc: '건빵 봉지 속 보물.' },
    ration: { name: '전투식량', icon: '🥫', px: false, fx: { hp: 6, mt: -1 }, desc: '발열팩으로 데워 먹는다. 맛다시를 부르는 맛.' },
    hotpack: { name: '핫팩', icon: '🔥', px: false, fx: { hp: 4, mt: 2 }, desc: '겨울 근무의 생명줄.' },
    kkal: { name: '깔깔이', icon: '🧥', px: false, fx: { hp: 8, mt: 5 }, desc: '희귀템. 입으면 세상이 따뜻해진다.' },
    clover: { name: '네잎클로버', icon: '🍀', px: false, fx: { mt: 4 }, luck: 6, desc: '뒷산에서 찾은 행운. 쓰면 한동안 운이 따른다.' },
    acorn: { name: '도토리', icon: '🌰', px: false, fx: { mt: 1 }, desc: '어디에 쓰는지는 다람쥐만 안다.' },
    chicken: { name: '바깥 치킨', icon: '🍗', px: false, fx: { mt: 14, hp: 4, bd: 4 }, desc: '전설. 부대 밖 냄새가 난다.' },
    bosscoffee: { name: '행보관의 비밀 커피', icon: '🫖', px: false, fx: { mt: 8, tr: 6 }, desc: '전설. 행보관 서랍 깊은 곳에 있던 원두.' },
    // 생활관 조합으로 만드는 요리
    bbog: { name: '뽀글이', icon: '🍲', px: false, dish: true, fx: { mt: 12, hp: -1 }, desc: '라면 봉지에 뜨거운 물. 군대의 맛 그 자체.' },
    tunabbog: { name: '참치 뽀글이', icon: '🥘', px: false, dish: true, fx: { mt: 14, hp: 4 }, desc: '뽀글이의 완성형.' },
    cereal: { name: '건빵 시리얼', icon: '🥣', px: false, dish: true, fx: { hp: 8, mt: 6 }, desc: '건빵 + 별사탕 + 우유. 아침의 사치.' },
    party: { name: '냉동 3종 파티', icon: '🎉', px: false, dish: true, fx: { bd: 14, mt: 6, hp: -2 }, desc: '생활관이 한마음이 되는 밤.' },
    latte: { name: '맥심 라떼', icon: '🧋', px: false, dish: true, fx: { mt: 7, hp: 3 }, desc: '커피믹스 + 우유. 행정병의 카페.' },
    cake: { name: '초코파이 케이크', icon: '🎂', px: false, dish: true, fx: { bd: 16, mt: 4 }, desc: '초코파이 3단. 누군가의 생일이다.' },
    bibim: { name: '전투식량 비빔밥', icon: '🍛', px: false, dish: true, fx: { hp: 10, mt: 6 }, desc: '전투식량 + 맛다시. 야전 미슐랭.' },
    catsnack: { name: '짬타이거 특식', icon: '🐟', px: false, dish: true, fx: { mt: 6 }, aff: { cat: 20 }, desc: '참치 + 핫바. 짬타이거가 평생 기억한다.' }
  };
  for (var id in NEW_ITEMS) { JY.ITEMS[id] = NEW_ITEMS[id]; JY.ITEM_ORDER.push(id); }

  JY.BASE.recipes = [
    { id: 'bbog', need: { ramen: 1 }, hint: '라면 봉지에 뜨거운 물' },
    { id: 'tunabbog', need: { ramen: 1, tuna: 1 }, hint: '뽀글이 + 바다의 맛' },
    { id: 'cereal', need: { gunbbang: 1, star: 1, milk: 1 }, hint: '건빵 봉지 속 보물 + 아침 배식' },
    { id: 'party', need: { mandu: 1, hotbar: 1, buldak: 1 }, hint: 'PX 냉동 코너 3대장' },
    { id: 'latte', need: { coffee: 1, milk: 1 }, hint: '행정반 커피 + 하얀 것' },
    { id: 'cake', need: { chocopie: 3 }, hint: '정(情)을 세 층으로' },
    { id: 'bibim', need: { ration: 1, matdasi: 1 }, hint: '야전 식량 + 빨간 양념' },
    { id: 'catsnack', need: { tuna: 1, hotbar: 1 }, hint: '고양이가 좋아하는 두 가지' }
  ];

  /* ───────── 득템 표 ───────── */
  // rarity: c 일반 · r 희귀 · e 영웅 · l 전설 (확률은 엔진에서: 일반 62 · 희귀 28 · 영웅 8 · 전설 2 %, 특기·행운이면 좋아짐)
  JY.BASE.loot = {
    px: { c: ['ramen', 'hotbar', 'coffee', 'milk', 'chocopie'], r: ['mandu', 'buldak', 'banana', 'tuna'], e: ['homefood', 'cream'], l: ['chicken'] },
    mess: { c: ['milk', 'chocopie', 'gunbbang'], r: ['tuna', 'matdasi', 'hotbar'], e: ['ration', 'homefood'], l: ['chicken'] },
    cat: { c: ['acorn'], r: ['tuna'], e: ['clover'], l: ['bosscoffee'] },
    supply: { c: ['gunbbang', 'star', 'polish', 'coffee'], r: ['ration', 'hotpack', 'earplug'], e: ['kkal', 'hot6'], l: ['bosscoffee'] },
    forest: { c: ['acorn', 'acorn', 'star'], r: ['clover', 'gunbbang'], e: ['kkal', 'hotpack'], l: ['clover'] },
    outside: { c: ['hotbar', 'banana', 'coffee'], r: ['mandu', 'buldak', 'homefood'], e: ['chicken', 'cream'], l: ['chicken'] },
    dish: { c: ['milk', 'gunbbang'], r: ['bbog', 'latte'], e: ['tunabbog', 'party'], l: ['cake'] }
  };

  /* ───────── 부대 지도: 장소와 행동 ─────────
   * risk 0~3: 행보관(간부)에게 걸릴 위험 (걸리면 작업 당첨) · npc: 그 장소에 있는 사람(말 걸기)
   * 행동: ap 행동력, fx 효과(미리 보여 줌), roll 운, loot 득템 표, xp 특기 경험치, spec 특기 전용, need 필요 조건, cd 쉬는 턴, mini 미니게임 */
  JY.BASE.locs = [
    {
      id: 'barracks', name: '생활관', emoji: '🛏️', bg: 'barracks', risk: 0, npc: ['dumb', 'malnyeon', 'ppaen', 'hoobae'],
      desc: '내 침상이 있는 곳. 쉬고, 수다 떨고, 뽀글이를 만든다.',
      acts: [
        { id: 'nap', emoji: '💤', name: '꿀잠 자기', fx: { hp: 7, mt: 3, tr: -3 }, say: ['침상에 누운 지 3초 만에 기절. 꿈에서도 점호를 했다.', '모포를 덮자 세상이 조용해졌다. 일어나니 저녁이다.', '"5분만…" 5분은 50분이 됐다.'] },
        { id: 'craft', emoji: '🍳', name: '조합 · 요리', special: 'craft', desc: '재료를 모아 뽀글이 등을 만든다' },
        { id: 'chat', emoji: '💬', name: '동기들과 수다', fx: { bd: 6, hp: -2, tr: -1 }, say: ['전역하면 뭐 할지 얘기하다 소등 시간이 됐다.', '박덤벙의 첫사랑 이야기 3부작이 완결됐다.', '누가 제일 군생활 꼬였나 대회. 내가 3등.'] },
        { id: 'diary', emoji: '📝', name: '수양록 쓰기', fx: { mt: -5, tr: 2 }, say: ['오늘 하루를 꾹꾹 눌러 적었다. 마음이 차분해졌다.', '"전역까지 ○○일." 숫자를 쓰니 정신이 번쩍 든다.', '분대장이 검사한다는 말에 세 장을 채웠다.'] },
        { id: 'alone', emoji: '🎧', name: '혼자만의 시간', fx: { bd: -5, mt: 3 }, say: ['이어폰을 끼고 창밖을 봤다. 아무도 말 걸지 않았다.', '구석 침상에서 책을 읽었다. 동기들이 서운해했다.'] },
        { id: 'tv', emoji: '📺', name: 'TV 채널 쟁탈전', cd: 1, roll: [{ p: 0.5, fx: { mt: 8, bd: -2 }, say: '걸그룹 채널 사수! 리모컨은 내 손에.' }, { p: 0.5, fx: { mt: -3, bd: 4 }, say: '병장님이 리모컨을 가져갔다. 같이 낚시 방송을 봤다.' }] }
      ]
    },
    {
      id: 'px', name: 'PX', emoji: '🏪', bg: 'px', risk: 1, npc: ['ppaen'],
      desc: '부대의 편의점. 냉동고 신상은 그날 운이다.',
      acts: [
        { id: 'shop', emoji: '🛒', name: '장보기', special: 'px', desc: '라면·커피·냉동식품을 산다' },
        { id: 'freezer', emoji: '🧊', name: '냉동고 신상 뽑기', money: 3000, fx: { mt: 2 }, loot: 'px', say: ['냉동고 맨 아래 칸을 뒤졌다.', '"이거 마지막 하나예요." PX병이 속삭였다.'] }
      ]
    },
    {
      id: 'mess', name: '식당 · 취사장', emoji: '🍚', bg: 'mess', risk: 1, npc: ['cat'],
      desc: '짬밥과 짬통, 그리고 짬타이거가 있는 곳.',
      acts: [
        { id: 'snack', emoji: '🍖', name: '간식 얻어먹기', fx: { hp: 3, tr: -1 }, loot: 'mess', say: ['취사병 오짬밥이 남은 반찬을 싸 줬다.', '배식 끝난 식판에 마지막 돈가스가 있었다.'] },
        { id: 'cat', emoji: '🐈', name: '짬통에서 짬타이거 만나기', cd: 1, fx: { mt: 5, hp: -1 }, aff: { cat: 8 }, loot: 'cat', lootP: 0.35, say: ['짬타이거가 다리에 몸을 비볐다. 오늘 하루 합격.', '짬타이거가 무언가를 물어다 놓고 갔다.'] },
        { id: 'feast', emoji: '👨‍🍳', name: '특식 만들기', spec: 'cook', mini: 'cook', xp: 2, cd: 2, tiers: { great: { fx: { bd: 12, mt: 6 }, loot: 'dish', say: '중대 전체가 줄을 섰다. 오늘의 셰프.' }, good: { fx: { bd: 6, mt: 3 }, say: '맛있다는 평. 간이 조금 셌다.' }, bad: { fx: { bd: -2, mt: -3 }, say: '냄비를 태웠다. 짬타이거만 먹었다.' } } }
      ]
    },
    {
      id: 'gym', name: '체력단련장', emoji: '🏋️', bg: 'field', risk: 0, npc: ['fm'],
      desc: '녹슨 철봉과 족구 코트. 몸짱은 여기서 태어난다.',
      acts: [
        { id: 'workout', emoji: '🏃', name: '근력 운동', fx: { hp: -4, mt: 5 }, xp: 1, xpSpec: 'fit', say: ['턱걸이 12개. 어제보다 하나 늘었다.', '거울 속 이두근이 인사했다.'] },
        { id: 'jokgu', emoji: '⚽', name: '족구 한 판', mini: 'jokgu', cd: 1, tiers: { great: { fx: { bd: 10, mt: 4 }, say: '결승 득점! 병장님이 업어 줬다.' }, good: { fx: { bd: 5, mt: 2 }, say: '아깝게 졌지만 분위기는 최고.' }, bad: { fx: { bd: 1, mt: -3 }, say: '헛발질 세 번. 오늘의 놀림감.' } } },
        { id: 'elite', emoji: '🏅', name: '특급전사 도전', spec: 'fit', mini: 'pushup', xp: 2, cd: 4, tiers: { great: { fx: { tr: 8, mt: 5 }, leave: 3, say: '특급전사 달성! 포상휴가 3일.' }, good: { fx: { tr: 4 }, say: '1급. 다음엔 특급.' }, bad: { fx: { mt: -5, hp: -3 }, say: '팔이 후들거린다. 다음 기회에.' } } }
      ]
    },
    {
      id: 'range', name: '사격장', emoji: '🎯', bg: 'training', risk: 1, npc: ['lt'],
      desc: '탄피 냄새와 표적지. 특등사수는 휴가를 받는다.',
      acts: [
        { id: 'practice', emoji: '🔫', name: '영점 사격 연습', fx: { tr: 4, hp: -3 }, xp: 1, xpSpec: 'shoot', say: ['탄착군이 동전만 해졌다.', '소대장: "오, 오늘 좀 하는데?"'] },
        { id: 'shells', emoji: '🧹', name: '탄피 줍기 봉사', mini: 'shell', cd: 1, tiers: { great: { fx: { tr: 8 }, say: '마지막 탄피까지 찾았다. 소대장 감동.' }, good: { fx: { tr: 4, hp: -2 }, say: '거의 다 찾았다. 하나는 영원히 미궁.' }, bad: { fx: { tr: -4, mt: -4 }, say: '탄피 하나가 없다. 다 같이 흙을 체로 걸렀다.' } } },
        { id: 'sharp', emoji: '🏆', name: '특등사수 도전', spec: 'shoot', mini: 'shoot', xp: 2, cd: 4, tiers: { great: { fx: { tr: 8, mt: 5 }, leave: 3, say: '20발 중 19발! 특등사수 포상휴가 3일.' }, good: { fx: { tr: 4 }, say: '1발 차이로 아쉽게 1급.' }, bad: { fx: { mt: -5 }, say: '바람이 불었다. 바람 탓이다.' } } }
      ]
    },
    {
      id: 'office', name: '행정반', emoji: '📋', bg: 'office', risk: 2, npc: ['haeng'],
      desc: '휴가 신청과 서류. 간부가 많아 쉬다 걸리기 쉽다.',
      acts: [
        { id: 'leave', emoji: '🏖️', name: '휴가 신청', special: 'leave', desc: '모아 둔 휴가를 쓴다 (이번 턴이 끝난다)' },
        { id: 'paper', emoji: '📑', name: '서류 정리 돕기', fx: { tr: 7, mt: -4 }, xp: 1, xpSpec: 'admin', say: ['엑셀 칸을 맞췄다. 간부들이 감동했다.', '결재판이 세 개에서 하나가 됐다.'] },
        { id: 'coffee', emoji: '☕', name: '커피 타 드리기', need: { item: 'coffee' }, fx: { tr: 8, mt: -1 }, aff: { haeng: 6 }, say: ['행보관: "…물 양이 딱이네." 최고의 칭찬.', '중대장이 한 모금 마시고 엄지를 들었다.'] },
        { id: 'schedule', emoji: '🗂️', name: '휴가 일정 조율', spec: 'admin', xp: 2, cd: 4, fx: { tr: 2, mt: 2 }, leave: 2, say: ['달력을 보다 빈칸을 찾았다. 휴가 +2일.', '서류 한 장 차이로 휴가가 생겼다. 행정의 힘.'] }
      ]
    },
    {
      id: 'cyber', name: '사지방', emoji: '💻', bg: 'office', risk: 1, npc: ['dumb'],
      desc: '사이버지식정보방. 바깥세상과 연결되는 창.',
      acts: [
        { id: 'surf', emoji: '🛍️', name: '인터넷 쇼핑 구경', fx: { mt: 6, tr: -3 }, say: ['장바구니에 담기만 40개. 결제는 전역 후.', '전역 선물로 살 신발을 정했다.'] },
        { id: 'study', emoji: '📚', name: '자격증 공부', fx: { mt: -3, tr: 4 }, xp: 1, xpSpec: 'admin', setChance: { flag: 'cert', p: 0.15, say: '자격증 합격! 이력서 한 줄이 생겼다.' }, say: ['기출문제 30개. 머리에서 김이 난다.', '옆자리 박덤벙은 게임 공략을 공부 중이다.'] },
        { id: 'phone', emoji: '📱', name: '휴대폰 시간 · 단톡방', fx: { mt: 5, bd: -3 }, say: ['친구 단톡방에 "ㅋㅋㅋ" 300개.', '엄마에게 사진을 보냈다. 답장: "살 빠졌네."'] }
      ]
    },
    {
      id: 'supply', name: '보급창고', emoji: '📦', bg: 'barracks', risk: 3, npc: ['haeng'],
      desc: '전설의 득템 장소. 대신 행보관의 영역이다.',
      acts: [
        { id: 'scavenge', emoji: '🔦', name: '창고 정리하며 파밍', fx: { hp: -2, tr: 2 }, loot: 'supply', lootN: 2, say: ['선반 맨 위 상자를 열었다.', '"정리 중입니다!" 손에는 건빵 봉지가.'] },
        { id: 'repair', emoji: '🔧', name: '장비 수리', spec: 'drive', xp: 2, cd: 2, fx: { tr: 6, hp: -2 }, say: ['고장 난 무전기를 살렸다. 행보관이 이름을 외웠다.', '삐걱이던 수레를 고쳤다. 작업이 반으로 줄었다.'] }
      ]
    },
    {
      id: 'hill', name: '뒷산', emoji: '🌲', bg: 'field', risk: 2, npc: [],
      desc: '부대 뒤 작은 산. 몰래 쉬기 좋고 가끔 귀한 게 떨어져 있다.',
      acts: [
        { id: 'hide', emoji: '😴', name: '몰래 꿀잠 스팟', fx: { mt: 8, hp: 4, tr: -6 }, say: ['나무 그늘 아래 20분. 인생 최고의 낮잠.', '바람 소리, 새소리… 그리고 멀리서 내 이름 부르는 소리.'] },
        { id: 'forage', emoji: '🍀', name: '산책하며 채집', fx: { mt: 3, hp: -1 }, loot: 'forest', say: ['풀숲을 헤쳤다.', '다람쥐와 눈이 마주쳤다. 다람쥐가 먼저 피했다.'] }
      ]
    },
    {
      id: 'clinic', name: '의무실', emoji: '🚑', bg: 'hospital', risk: 1, npc: [],
      desc: '타이레놀과 빨간약의 성지.',
      acts: [
        { id: 'treat', emoji: '🩹', name: '진료 받기', cd: 1, roll: [{ p: 0.7, fx: { hp: 9, tr: -2 }, say: '타이레놀 두 알. 신기하게 낫는다.' }, { p: 0.3, fx: { hp: 4, tr: -6 }, say: '군의관: "꾀병이지?" 들켰다. 반쯤.' }] },
        { id: 'heal', emoji: '💊', name: '동기 치료', spec: 'medic', xp: 2, cd: 1, fx: { bd: 8, hp: 2 }, say: ['박덤벙의 발 물집을 치료했다. 평생 은인이 됐다.', '감기 걸린 후임에게 쌍화탕을 데워 줬다.'] }
      ]
    },
    {
      id: 'garage', name: '정비고', emoji: '🚚', bg: 'field', risk: 1, npc: [], show: { spec: 'drive', unit: 'mech' },
      desc: '군용 트럭과 기름 냄새. 운전병의 왕국.',
      acts: [
        { id: 'maintain', emoji: '🛠️', name: '차량 정비', fx: { tr: 5, hp: -3 }, xp: 1, xpSpec: 'drive', say: ['엔진오일을 갈았다. 손톱 밑이 까매졌다.', '타이어 공기압을 맞췄다. 트럭이 웃는 것 같다.'] },
        { id: 'drive', emoji: '🚙', name: '간부 수송 외출', spec: 'drive', xp: 2, cd: 3, fx: { mt: 9 }, loot: 'outside', say: ['읍내 다녀오는 길, 소대장이 치킨을 사 줬다.', '라디오에서 좋아하는 노래가 나왔다. 창밖이 사회다.'] }
      ]
    }
  ];

  /* ───────── 동료의 부탁 (2D 월드에서 머리 위 ❗) ───────── */
  JY.BASE.quests = [
    { who: 'ppaen', item: 'banana', ask: '바나나우유 하나만… PX 가는 김에. 응? 응?', thanks: '정뺀질: "역시 넌 말이 통해~" 꿀팁을 하나 알려 줬다.', reward: { aff: { ppaen: 10 }, fx: { bd: 4 }, gem: 2 } },
    { who: 'dumb', item: 'chocopie', ask: '초코파이… 딱 하나만 있으면 오늘 버틸 수 있을 것 같아.', thanks: '박덤벙이 초코파이를 반으로 쪼개 줬다. 우정의 맛.', reward: { aff: { dumb: 10 }, fx: { mt: 4 }, gem: 2 } },
    { who: 'malnyeon', item: 'buldak', ask: '불닭 있냐? 말년엔 매운 게 당긴다.', thanks: '김말년: "넌 내 전역 선물 명단에 올랐다."', reward: { aff: { malnyeon: 10 }, fx: { bd: 5 }, gem: 3 } },
    { who: 'fm', item: 'polish', ask: '구두약 남는 거 있나. 규정상 내일 검열이다.', thanks: '분대장: "…고맙다. 규정엔 없지만 기억하겠다."', reward: { aff: { fm: 10 }, fx: { tr: 5 }, gem: 2 } },
    { who: 'hoobae', item: 'mandu', ask: '선임님… 냉동 만두가 너무 먹고 싶습니다.', thanks: '오순둥이 만두를 먹다 울었다. "선임님은 천사입니다."', reward: { aff: { hoobae: 12 }, fx: { bd: 5 }, gem: 2 } },
    { who: 'haeng', item: 'hot6', ask: '행보관: "너. 에너지 드링크 있나? …없으면 말고."', thanks: '행보관이 원샷했다. "이번 주 작업 명단에서 빼 주지."', reward: { aff: { haeng: 10 }, fx: { tr: 6 }, leave: 1 } },
    { who: 'cat', item: 'tuna', ask: '짬타이거가 빈 참치캔을 앞발로 툭툭 친다.', thanks: '짬타이거가 골골송을 불렀다. 오늘 하루 합격.', reward: { aff: { cat: 15 }, fx: { mt: 6 } } }
  ];

  /* ───────── 일과: 턴마다 하나 (카드 · 미니게임 · 자동) ───────── */
  JY.BASE.duty = {
    cards: ['work_day', 'nightwatch', 'cctv', 'amguho', 'snow_again', 'weeding', 'leaves', 'cleaning_zone', 'alert_5min', 'ammo_guard', 'haeng_call', 'shooting', 'pt_test', 'yugyeok', 'jindo',
      'v5b_guard_post', 'v5b_gate', 'v5b_work_detail', 'v5b_inspection', 'v5b_field_training', 'v5b_drill_turn', 'v5b_tent', 'v5b_heat_edu'],
    mos: { cook: ['v5b_cook_line', 'v5b_potato_kp'], clerk: ['v5b_clerk_desk'], driver: ['v5b_driver_seat'], medic: ['v5b_medic_room'], infantry: ['v5b_rifleman'] },
    minis: [{ id: 'dressup' }, { id: 'watch' }, { id: 'shell' }, { id: 'snow', season: 'winter' }, { id: 'shoot', mos: 'infantry' }, { id: 'memory', mos: 'clerk' }],
    autos: [
      { text: '오늘 일과: 제초 작업. 예초기 소리와 함께 하루가 갔다.', fx: { hp: -4, mt: -1 } },
      { text: '오늘 일과: 진지 보수. 삽질 4시간. 손바닥에 굳은살이 생겼다.', fx: { hp: -5, tr: 1 } },
      { text: '오늘 일과: 정신교육. 졸음과의 전쟁에서 이겼다.', fx: { mt: -3, tr: 1 } },
      { text: '오늘 일과: 내무 검사 대비 청소. 관물대가 반짝인다.', fx: { hp: -2, mt: -2 } },
      { text: '오늘 일과: 분대 전술 훈련. 엄폐물은 작은 소나무였다.', fx: { hp: -4, bd: 3 } },
      { text: '오늘 일과: 보급품 하역. 박스 200개를 옮겼다.', fx: { hp: -5, bd: 2 } }
    ]
  };
})(window.JY = window.JY || {});
