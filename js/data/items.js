/* PX 물품 & 엔딩 데이터 */
(function (JY) {
  'use strict';

  // 아이템 효과는 5~95 사이로만 움직인다 (아이템으로 게임오버 되지 않도록)
  JY.ITEMS = {
    buldak: { name: '불닭볶음면', icon: '🍜', price: 1500, fx: { mt: 8, hp: -3 }, desc: '매운맛으로 스트레스 해소. 위장은 울고 있다.' },
    mandu: { name: '냉동 만두', icon: '🥟', price: 4500, fx: { mt: 6, hp: 4 }, desc: 'PX 냉동식품의 왕. 전자레인지 2분 30초.' },
    chocopie: { name: '초코파이', icon: '🍫', price: 4000, fx: { bd: 8 }, desc: '생활관에 돌리면 정(情)이 쌓인다.' },
    banana: { name: '바나나우유', icon: '🍌', price: 1300, fx: { mt: 3, hp: 3 }, desc: '단지 모양 그 우유. 작은 행복.' },
    hot6: { name: '에너지 드링크', icon: '⚡', price: 1200, fx: { hp: 8, mt: -3 }, desc: '심장이 빨라진다. 잠은 안 온다.' },
    polish: { name: '구두약', icon: '🥾', price: 3000, fx: { tr: 6, hp: -2 }, desc: '전투화를 거울처럼. 간부들의 눈빛이 달라진다.' },
    cream: { name: '달팽이 크림', icon: '🐌', price: 9900, fx: { mt: 4, tr: 2 }, desc: '군대 화장품의 전설. 피부가 촉촉해졌다.' },
    matdasi: { name: '맛다시', icon: '🌶️', price: 1000, fx: { mt: 4, bd: 2 }, desc: '짬밥에 뿌리면 마법이 일어난다.' },
    earplug: { name: '귀마개', icon: '🎧', price: 2000, fx: { hp: 6, bd: -4 }, desc: '코골이 차단. 선임이 부르는 소리도 차단.' },
    comic: { name: '만화책', icon: '📚', price: 6000, fx: { mt: 6, tr: -4 }, desc: '개인정비 시간의 친구. 근무 중에 보면 큰일.' },
    homefood: { name: '엄마 반찬', icon: '🍱', price: 0, px: false, fx: { mt: 12, hp: 6 }, desc: '엄마 손맛. PX에선 안 판다.' }
  };

  JY.ITEM_ORDER = ['buldak', 'mandu', 'chocopie', 'banana', 'hot6', 'polish', 'cream', 'matdasi', 'earplug', 'comic', 'homefood'];

  /* 엔딩 — good: 전역 성공 / 나머지는 전역 실패 */
  JY.ENDINGS = {
    // ── 전역 성공 ──
    normal: {
      good: true, title: '민간인 등극', who: 'me', mood: 'happy', bg: 'gate',
      text: '위병소를 나서는 순간, 공기 맛이 다르다. 오늘부터 너는 민간인이다. 예비군 통지서가 오기 전까지는.'
    },
    model: {
      good: true, title: '모범 전역', who: 'captain', bg: 'field',
      text: '체력, 멘탈, 신뢰, 전우애 어느 하나 넘치거나 모자라지 않았다. 중대장이 표창장을 건네며 말했다. "자네 같은 병사만 있으면 좋겠어."'
    },
    malchul: {
      good: true, title: '말출 전역', who: 'me', mood: 'happy', bg: 'home',
      text: '말년휴가를 나와 그대로 전역했다. 부대에는 짐 가지러 한 번 들렀을 뿐. 아껴둔 휴가는 배신하지 않는다.'
    },
    cat: {
      good: true, title: '짬타이거 입양 전역', who: 'cat', bg: 'home',
      text: '전역 가방 위에 짬타이거가 앉아 있었다. 중대장이 웃으며 입양 서류에 사인해 줬다. 짬 9년차 고양이, 드디어 민간냥 등극.'
    },
    gf: {
      good: true, title: '꽃신 전역', who: 'gf', bg: 'gate',
      text: '위병소 앞에 꽃다발을 든 여자친구가 서 있었다. 고무신은 끝까지 거꾸로 뒤집히지 않았다. 생활관 단톡방이 폭발했다.'
    },
    cast: {
      good: true, title: '깁스 전역', who: 'me', bg: 'hospital', mood: 'cast',
      text: '말년에 떨어지는 낙엽을 조심하지 않은 대가. 목발을 짚고 전역 신고를 했다. 그래도 전역은 전역이다!'
    },
    elite: {
      good: true, title: '특급전사 · 특등사수 전역', who: 'me', bg: 'field', mood: 'proud',
      text: '특급전사 배지와 특등사수 기록을 들고 전역했다. 중대장이 마지막까지 부사관 서류를 흔들었지만 뒤도 안 돌아봤다.'
    },
    rich: {
      good: true, title: '코인 부자 전역', who: 'ppaen', bg: 'gate',
      text: '정뺀질이 추천한 코인이 진짜 올랐다. 전역하는 날 중고차를 타고 나갔다. 정뺀질은 아직 그 코인을 안 판 걸 후회 중이다.'
    },
    beloved: {
      good: true, title: '눈물의 전역식', who: 'hoobae', bg: 'gate',
      text: '후임들이 롤링페이퍼와 손수 만든 전역모를 건넸다. 오순둥은 끝내 오열했다. 생활관의 전설로 남았다.'
    },

    // ── 전역 실패 ──
    hp0: {
      title: '국군병원 VIP', who: 'doc', bg: 'hospital',
      text: '체력이 바닥났다. 구급차에 실려 국군병원으로. 군의관이 말한다. "물 많이 마시고, 타이레놀."'
    },
    hp100: {
      title: '특급전사의 함정', who: 'captain', bg: 'field',
      text: '체력이 넘쳐흘렀다. 중대장이 내민 부사관 지원서에 "멋있어 보여서" 사인해 버렸다. 전역? 4년 뒤에 보자.'
    },
    mt0: {
      title: '멘탈 가루', who: 'counselor', bg: 'office',
      text: '멘탈이 가루가 됐다. 상담관 선생님과 한참 이야기를 나눴다. 괜찮아, 힘들면 말해도 된다. 다시 해보자.'
    },
    mt100: {
      title: '생활관 부처', who: 'me', mood: 'zen', bg: 'field',
      text: '모든 것을 내려놓았다. 짬밥도, 제설도, 전역도. 해탈해버린 나머지 전역 날짜를 잊고 군종병이 되겠다며 법당에 눌러앉았다.'
    },
    tr0: {
      title: '군기교육대 입소', who: 'duty', bg: 'office',
      text: '간부들의 신뢰가 바닥났다. 군기교육대 입소! 영창은 2020년에 없어졌지만 군기교육대는 있다. 그 기간만큼 전역도 밀린다.'
    },
    tr100: {
      title: '말뚝 엔딩', who: 'captain', bg: 'office',
      text: '중대장이 너를 너무 아낀 나머지 장기복무 지원서에 같이 사인하자고 손을 잡았다. 정신 차려 보니 하사 계급장이 달려 있었다.'
    },
    bd0: {
      title: '생활관 투명인간', who: 'me', mood: 'sad', bg: 'barracks',
      text: '아무도 나에게 말을 걸지 않는다. 전역 신고 날에도 아무도 몰라서… 사실 아직 생활관에 있다.'
    },
    bd100: {
      title: '생활관 대통령', who: 'ppaen', bg: 'night',
      text: '생활관 전원이 너를 따랐다. 그리고 너의 한마디에 치킨 12마리가 위병소에 도착했다. 주동자는 군기교육대로.'
    },
    desert: {
      title: '2시간 탈영', who: 'duty', bg: 'night',
      text: '담을 넘었다. 2시간 뒤 읍내 PC방에서 헌병… 아니, 군사경찰에게 잡혔다. 라면은 다 먹고 잡혔다.'
    },
    awol: {
      title: '휴가 미복귀', who: 'phone', bg: 'gate',
      text: '"한 시간만 더"가 하루가 됐다. 미복귀 처리. 군기교육대에서 휴가의 소중함을 다시 배우게 된다.'
    }
  };

  JY.ENDING_ORDER = ['normal', 'model', 'malchul', 'cat', 'gf', 'cast', 'elite', 'rich', 'beloved',
    'hp0', 'hp100', 'mt0', 'mt100', 'tr0', 'tr100', 'bd0', 'bd100', 'desert', 'awol'];
})(window.JY = window.JY || {});
