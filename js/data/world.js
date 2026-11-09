/* 판마다 달라지는 요소: 자대(부대), 성격 특성, 주간 상황, 동료 호감도 */
(function (JY) {
  'use strict';

  /* ── 자대: 훈련소 수료 때 무작위 배치 ── */
  JY.UNITS = {
    gop: {
      name: '강원도 GOP 사단', short: 'GOP', emoji: '🏔️', place: '강원도 인제',
      desc: '최전방 철책 경계. 겨울이 길고 춥다. 대신 휴가가 넉넉하다.',
      perk: '진급할 때 휴가 +2일 · 겨울 이벤트 2배 · 돌발 상황 조금 더',
      leaveBonus: 2, seasonW: { winter: 2 }, emerMult: 1.2, start: { hp: -3 }
    },
    mech: {
      name: '수도권 기계화 사단', short: '기계화', emoji: '🚜', place: '경기도 양주',
      desc: '전차와 장갑차의 굉음. 사단장님이 자주 오신다.',
      perk: 'PX 20% 할인 · 간부 신뢰 변화 1.15배',
      pxDiscount: 0.2, mods: { tr: { pos: 1.15, neg: 1.15 } }
    },
    coast: {
      name: '해안 경계 부대', short: '해안', emoji: '🌊', place: '충남 태안',
      desc: '바다를 보며 근무한다. 낭만과 습기가 공존한다.',
      perk: '멘탈 회복 1.2배 · 여름 이벤트 1.5배',
      mods: { mt: { pos: 1.2 } }, seasonW: { summer: 1.5 }
    },
    recruit: {
      name: '신병교육대 (조교)', short: '신교대', emoji: '📣', place: '경기도 연천',
      desc: '이번엔 내가 조교다. 훈련병들이 나를 무서워(?)한다.',
      perk: '전우애 변화 1.2배 · 훈련병 전용 이벤트',
      mods: { bd: { pos: 1.2, neg: 1.2 } }
    },
    commando: {
      name: '특공 연대', short: '특공', emoji: '🪂', place: '강원도 화천',
      desc: '체력이 곧 계급. 천리행군의 전설이 숨 쉬는 곳.',
      perk: '체력 증가 1.25배 · 체력 소모 1.15배 · 포상휴가 +1일',
      mods: { hp: { pos: 1.25, neg: 1.15 } }, leaveReward: 1
    }
  };
  JY.UNIT_ORDER = ['gop', 'mech', 'coast', 'recruit', 'commando'];

  /* ── 성격 특성: 입대할 때 3장 중 1장 ── */
  JY.TRAITS = {
    glutton: { name: '먹보', emoji: '🍗', desc: 'PX 음식 효과 1.5배', itemMult: 1.5 },
    sleepy: { name: '잠꾸러기', emoji: '😴', desc: '체력 소모 0.8배 · 대신 불침번이 더 어렵다', mods: { hp: { neg: 0.8 } }, watchHard: true },
    insider: { name: '인싸', emoji: '🎤', desc: '전우애 증가 1.3배 · 간부 신뢰 증가 0.85배', mods: { bd: { pos: 1.3 }, tr: { pos: 0.85 } } },
    fm: { name: '원칙주의자', emoji: '📏', desc: '간부 신뢰 증가 1.3배 · 멘탈 소모 1.2배', mods: { tr: { pos: 1.3 }, mt: { neg: 1.2 } } },
    glass: { name: '유리멘탈', emoji: '🥲', desc: '멘탈 소모 1.3배 · 대신 점수와 다이아 1.3배', mods: { mt: { neg: 1.3 } }, scoreMult: 1.3, gemMult: 1.3 },
    steel: { name: '강철멘탈', emoji: '🗿', desc: '멘탈 소모 0.75배 · 전우애 증가 0.85배', mods: { mt: { neg: 0.75 }, bd: { pos: 0.85 } } },
    athlete: { name: '운동광', emoji: '💪', desc: '체력 증가 1.3배 · 시작 체력 +8', mods: { hp: { pos: 1.3 } }, start: { hp: 8 } },
    rich: { name: '금수저', emoji: '💳', desc: '시작 현금 50만 원 · 시작 전우애 -8', money: 500000, start: { bd: -8 } },
    lucky: { name: '행운아', emoji: '🍀', desc: '운에 맡기는 선택이 절반 확률로 유리하게 굴러간다', luck: 0.5 },
    nunchi: { name: '눈치백단', emoji: '👀', desc: '미리보기에서 간부 신뢰가 오를지 내릴지 보인다', insightStat: 'tr' },
    catlover: { name: '고양이 집사', emoji: '🐈', desc: '짬타이거 이벤트 3배 · 짬타이거 호감도 2배', catW: 3 },
    romantic: { name: '연애 고수', emoji: '💌', desc: '여자친구가 있는 채로 입대 · 곰신 호감도 +2', flags: ['gf'], vars: { gf: 2 } },
    clumsy: { name: '덜렁이', emoji: '🙃', desc: '돌발 상황이 두 배 · 대신 다이아 1.5배', emerMult: 2, gemMult: 1.5 }
  };
  JY.TRAIT_ORDER = Object.keys(JY.TRAITS);

  /* ── 주간 상황: 매달 1일에 확률로 시작, 몇 장 동안 지속 ── */
  JY.CONDITIONS = {
    flu: { name: '독감 유행', emoji: '🤧', cards: 4, tick: { hp: -2 }, desc: '카드마다 체력 -2' },
    heat: { name: '폭염 주의보', emoji: '🥵', cards: 4, tick: { hp: -2, mt: -1 }, season: 'summer', desc: '카드마다 체력 -2, 멘탈 -1' },
    cold: { name: '한파 특보', emoji: '🥶', cards: 4, tick: { hp: -2 }, season: 'winter', desc: '카드마다 체력 -2' },
    feast: { name: '짬밥 개선 주간', emoji: '🍖', cards: 4, tick: { mt: 2, hp: 1 }, desc: '새 취사병 부임! 카드마다 멘탈 +2, 체력 +1' },
    inspect: { name: '행보관 특별 점검', emoji: '🔍', cards: 4, mods: { tr: { neg: 1.5 } }, desc: '간부 신뢰 소모 1.5배' },
    captainOff: { name: '중대장 휴가 중', emoji: '🏝️', cards: 4, mods: { tr: { pos: 0.5, neg: 0.5 } }, tick: { mt: 1 }, desc: '간부 신뢰 변화 절반 · 멘탈 +1' },
    sale: { name: 'PX 반값 세일', emoji: '🏷️', cards: 5, pxDiscount: 0.5, pxOpen: true, desc: 'PX 50% 할인, 언제든 이용 가능' },
    gifts: { name: '위문품 대량 도착', emoji: '🎁', cards: 3, tick: { bd: 1 }, onStart: { chocopie: 2, banana: 1 }, desc: '초코파이 2개 + 카드마다 전우애 +1' },
    drill: { name: '훈련 주간', emoji: '🎯', cards: 4, tick: { hp: -2, tr: 1 }, blockLeave: true, desc: '카드마다 체력 -2, 신뢰 +1 · 휴가 통제' },
    wifi: { name: '사지방 와이파이 고장', emoji: '📵', cards: 3, tick: { mt: -1 }, desc: '카드마다 멘탈 -1' },
    alert: { name: '경계태세 강화', emoji: '🚨', cards: 4, tick: { tr: 1, mt: -1 }, blockLeave: true, desc: '카드마다 신뢰 +1, 멘탈 -1 · 휴가 통제' },
    love: { name: '생활관 연애 상담소', emoji: '💘', cards: 3, tick: { bd: 1, mt: 1 }, desc: '카드마다 전우애 +1, 멘탈 +1' }
  };

  /* ── 동료 호감도: 선물·수다·카드 선택으로 쌓인다. 70 이상이면 절친 효과 ── */
  JY.NPCS = {
    dumb: {
      stat: 'bd', fav: 'chocopie', start: 40,
      perk: { name: '동기 사랑', desc: '전우애 증가 1.15배', mods: { bd: { pos: 1.15 } } },
      lines: ['야 나 또 뭐 잃어버렸다…', '초코파이 있냐? 하나만…', '우리 전역하면 뭐 하냐 ㅋㅋ', '나 오늘 이발병 했다! 봐봐!', '안녕하세오', '너밖에 없다 진짜…']
    },
    malnyeon: {
      stat: 'bd', fav: 'buldak', start: 32, avail: { noflag: 'malGone' },
      perk: { name: '왕고의 비호', desc: '체력·멘탈 소모 0.9배', mods: { hp: { neg: 0.9 }, mt: { neg: 0.9 } } },
      lines: ['아 몰라~ 나 말년이야~', '야… 전역하면 뭐 하냐…', '내 깔깔이 냄새 맡지 마라', '짬찌가 어디서 눈을… 농담이야', 'Zzz… 충성… Zzz', '라떼는 말이야… 아니다']
    },
    fm: {
      stat: 'tr', fav: 'polish', start: 30,
      perk: { name: '분대장의 인정', desc: '간부 신뢰 증가 1.15배', mods: { tr: { pos: 1.15 } } },
      lines: ['규정상 안 됩니다.', '관물대 각 다시.', '…잘했다. 이번만.', '전투화 광택 상태 양호.', 'FM이 답이다.', '분대원 이상 무!']
    },
    ppaen: {
      stat: 'bd', fav: 'banana', start: 30,
      perk: { name: 'PX 인맥', desc: 'PX 30% 할인', pxDiscount: 0.3 },
      lines: ['아 귀찮아~', '이거 비밀인데…', 'PX 같이 갈래? 네가 사~', '코인 얘기 들었어?', '청소? 그게 뭔데', '나 오늘 근무 바꿔줄 사람~']
    },
    hoobae: {
      stat: 'bd', fav: 'mandu', start: 35, avail: { flag: 'hoobae' },
      perk: { name: '충성스러운 후임', desc: '체력 소모 0.85배', mods: { hp: { neg: 0.85 } } },
      lines: ['이, 이병 오순둥!', '선임님 최고십니다!', '저 잘하고 있습니까…?', '헬멧이 또 눈을…', '집에 가고 싶… 아닙니다!', '선임님 전역하지 마십쇼…']
    },
    haeng: {
      stat: 'tr', fav: 'hot6', start: 20,
      perk: { name: '행보관의 총애', desc: '간부 신뢰 소모 0.85배', mods: { tr: { neg: 0.85 } } },
      lines: ['삽 들어.', '풀 보이냐? 뽑아.', '눈은 하늘에서 내리는 쓰레기다.', '…고생했다.', '내 삽돌이 못 봤냐?', '말년? 그게 뭔데.']
    },
    cat: {
      stat: 'mt', fav: 'tuna', start: 20, avail: { vars: { cat: [1, 99] } },
      perk: { name: '고양이의 축복', desc: '멘탈 증가 1.2배', mods: { mt: { pos: 1.2 } } },
      lines: ['냥.', '(골골골골골)', '(짬통을 응시한다)', '(전투화에 들어간다)', '냐아앙~', '(꾹꾹이를 한다)']
    }
  };
  JY.NPC_ORDER = ['dumb', 'malnyeon', 'fm', 'ppaen', 'hoobae', 'haeng', 'cat'];
})(window.JY = window.JY || {});
