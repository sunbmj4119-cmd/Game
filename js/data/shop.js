/* 다이아(💎) 상점 · 꾸미기 · 보급 상자 · 훈장 · 점수 */
(function (JY) {
  'use strict';

  /* 특급 보급품: 다이아로 사서 창고에 쌓아두고, 게임 중 가방에서 꺼내 쓴다 */
  JY.PREMIUM = {
    insurance: { name: '전역 보험', icon: '🛡️', price: 40, auto: true, desc: '스탯이 0이나 100에 닿는 순간 50으로 되돌린다. "…꿈이었다!" 한 판에 한 번 자동 발동.' },
    leave3: { name: '포상휴가증', icon: '🎟️', price: 25, desc: '휴가 +3일.' },
    insight: { name: '투시경', icon: '🔭', price: 20, desc: '다음 카드 12장 동안 스탯이 오를지(▲) 내릴지(▼) 보인다.' },
    clover: { name: '네잎클로버', icon: '🍀', price: 20, desc: '다음 카드 15장 동안 운에 맡기는 선택이 유리하게 굴러간다.' },
    feast: { name: '회식권', icon: '🍖', price: 15, desc: '네 가지 스탯이 모두 50 쪽으로 최대 12씩 돌아온다.' },
    skip: { name: '짬처리권', icon: '⏭️', price: 10, desc: '지금 카드를 아무 일 없이 넘긴다(이틀이 지난다).' },
    pxpass: { name: 'PX 프리패스', icon: '💳', price: 10, desc: 'PX를 바로 이용할 수 있고 현금 10만 원을 받는다.' }
  };
  JY.PREMIUM_ORDER = ['insurance', 'leave3', 'insight', 'clover', 'feast', 'skip', 'pxpass'];

  /* 꾸미기: 능력치는 없지만 카드·엔딩·랭킹에 내 모습으로 나온다 */
  JY.COSMETICS = {
    blush: { slot: 'fx', name: '볼터치', icon: '😊', price: 10, extras: ['blush'] },
    mustache: { slot: 'face', name: '콧수염', icon: '🥸', price: 20, extras: ['mustache'] },
    headband: { slot: 'hat', name: '전역 머리띠', icon: '🎌', price: 25, hat: 'headband' },
    sunglasses: { slot: 'face', name: '선글라스', icon: '😎', price: 30, eyes: 'sunglasses' },
    sparkle: { slot: 'fx', name: '반짝이 오라', icon: '✨', price: 35, extras: ['sparkles'] },
    beret: { slot: 'hat', name: '검은 베레모', icon: '🎖️', price: 40, hat: 'beret' },
    cateears: { slot: 'hat', name: '고양이 귀', icon: '🐱', price: 50, hat: 'cateears' },
    gold: { slot: 'hat', name: '황금 헬멧', icon: '🪖', price: 80, hat: 'gold' },
    afro: { slot: 'hat', name: '무지개 아프로', icon: '🌈', price: 0, gacha: 'epic', hat: 'afro' },
    crown: { slot: 'hat', name: '전역 왕관', icon: '👑', price: 0, gacha: 'legend', hat: 'crown' },
    // v3: 레벨·업적·수집으로 여는 꾸미기 + 옷·소품 슬롯
    beanie: { slot: 'hat', name: '털모자', icon: '🧶', price: 0, unlock: { level: 2 }, hat: 'beanie' },
    chefhat: { slot: 'hat', name: '취사병 모자', icon: '👨‍🍳', price: 0, unlock: { mosOut: 'cook' }, hat: 'chef' },
    jogyohat: { slot: 'hat', name: '조교 모자', icon: '📣', price: 0, unlock: { unitOut: 'recruit' }, hat: 'jogyo' },
    kkal: { slot: 'body', name: '전설의 깔깔이', icon: '🧥', price: 30, body: 'kkal' },
    pt: { slot: 'body', name: '군 체육복', icon: '🏃', price: 0, unlock: { level: 3 }, body: 'pt' },
    pinkcamo: { slot: 'body', name: '핑크 전투복', icon: '🎀', price: 0, unlock: { level: 6 }, body: 'pinkcamo' },
    dress: { slot: 'body', name: '전역 정복', icon: '🎖️', price: 0, unlock: { level: 10 }, body: 'dress' },
    goldcamo: { slot: 'body', name: '황금 전투복', icon: '🏆', price: 0, unlock: { collect: 1 }, body: 'goldcamo' },
    shovel: { slot: 'prop', name: '삽돌이', icon: '⛏️', price: 25, prop: 'shovel' },
    chocopie: { slot: 'prop', name: '초코파이', icon: '🍫', price: 15, prop: 'chocopie' },
    phoneprop: { slot: 'prop', name: '휴대폰', icon: '📱', price: 0, unlock: { level: 4 }, prop: 'phone' },
    megaphone: { slot: 'prop', name: '확성기', icon: '📢', price: 0, unlock: { level: 8 }, prop: 'megaphone' },
    flower: { slot: 'prop', name: '꽃다발', icon: '💐', price: 0, unlock: { ach: 'gf' }, prop: 'flower' },
    mic: { slot: 'prop', name: '노래자랑 마이크', icon: '🎤', price: 0, unlock: { collect: 0.5 }, prop: 'mic' }
  };
  JY.COSMETIC_ORDER = ['blush', 'mustache', 'headband', 'sunglasses', 'sparkle', 'beret', 'cateears', 'gold', 'afro', 'crown',
    'beanie', 'chefhat', 'jogyohat', 'kkal', 'pt', 'pinkcamo', 'dress', 'goldcamo', 'shovel', 'chocopie', 'phoneprop', 'megaphone', 'flower', 'mic'];
  JY.SLOT_NAMES = { hat: '모자', face: '얼굴', fx: '효과', body: '옷', prop: '소품' };
  JY.SLOT_ORDER = ['hat', 'face', 'fx', 'body', 'prop'];

  /* ── 짬(경험치) · 레벨 ─────────────────── */
  JY.LEVELS = {
    need: function (lv) { return 100 * (lv - 1) * lv / 2; }, // lv 레벨이 되기 위한 누적 짬
    titles: [[1, '짬찌'], [3, '짬 좀 먹은'], [5, '짬밥 전문가'], [8, '짬장'], [12, '짬신'], [16, '짬의 전설'], [20, '국방부 시계']],
    rewards: { 5: { box: 1 }, 10: { box: 1, gem: 50 }, 15: { box: 2, gem: 100 }, 20: { box: 3, gem: 200 } }
  };

  /* ── 장비 강화: 짬으로 영구 강화 (+4, +5는 확률) ── */
  JY.UPGRADES = [
    { id: 'boots', icon: '🥾', name: '전투화', desc: '체력이 0이나 100 쪽으로 쏠리는 변화 -6% / 강', per: function (l) { return '체력 쏠림 -' + l * 6 + '%'; } },
    { id: 'helmet', icon: '🪖', name: '방탄모', desc: '위험 구간(20 이하·80 이상)에서 더 위험해지는 변화 -8% / 강', per: function (l) { return '위험 완충 ' + l * 8 + '%'; } },
    { id: 'notebook', icon: '📓', name: '수양록', desc: '판 시작 때 투시경 카드 3장 / 강', per: function (l) { return '시작 투시 ' + l * 3 + '장'; } },
    { id: 'wallet', icon: '👛', name: '지갑', desc: '월급 현금 +5%, PX 할인 4% / 강', per: function (l) { return '월급 +' + l * 5 + '% · PX -' + l * 4 + '%'; } },
    { id: 'pack', icon: '🎒', name: '군용 배낭', desc: '아이템 회복량 +10% / 강', per: function (l) { return '아이템 +' + l * 10 + '%'; } },
    { id: 'tag', icon: '🏷️', name: '명찰', desc: '동료 호감도 상승 +12% / 강', per: function (l) { return '호감도 +' + l * 12 + '%'; } },
    { id: 'watch', icon: '⌚', name: '국방부 시계', desc: '방금 선택을 되돌리는 횟수 (+1: 1회, +3: 2회, +5: 3회)', per: function (l) { return '되돌리기 ' + ([0, 1, 1, 2, 2, 3][l] || 0) + '회'; } },
    { id: 'charm', icon: '🧿', name: '부적', desc: '운에 맡기는 선택에서 더 안전한 결과가 나올 확률 +8% / 강', per: function (l) { return '행운 +' + l * 8 + '%'; } }
  ];
  JY.UPGRADE_COST = [80, 160, 300, 500, 800];  // +1 ~ +5
  JY.UPGRADE_RATE = [1, 1, 1, 0.8, 0.6];       // 성공 확률 (실패하면 짬 절반 돌려받음)

  /* ── 오늘의 임무: 날짜마다 3개 ─────────── */
  JY.MISSIONS = [
    { id: 'cards30', type: 'card', goal: 30, text: '카드 30장 넘기기', gem: 10, jjam: 30 },
    { id: 'cards80', type: 'card', goal: 80, text: '카드 80장 넘기기', gem: 15, jjam: 50 },
    { id: 'special2', type: 'special', goal: 2, text: '특수 대답 2번 쓰기', gem: 12, jjam: 30 },
    { id: 'emer2', type: 'emer_ok', goal: 2, text: '돌발 상황 2번 제한 시간 안에 대응', gem: 12, jjam: 40 },
    { id: 'mini1', type: 'mini_great', goal: 1, text: '미니게임 대성공 1번', gem: 10, jjam: 30 },
    { id: 'gift2', type: 'gift', goal: 2, text: '동료에게 선물 2번', gem: 10, jjam: 30 },
    { id: 'talk3', type: 'talk', goal: 3, text: '동료와 수다 3번', gem: 8, jjam: 25 },
    { id: 'px5', type: 'px_buy', goal: 5, text: 'PX에서 물건 5개 사기', gem: 8, jjam: 25 },
    { id: 'item3', type: 'item_use', goal: 3, text: '아이템 3개 사용', gem: 8, jjam: 25 },
    { id: 'leave1', type: 'leave', goal: 1, text: '휴가 1번 다녀오기', gem: 10, jjam: 30 },
    { id: 'promo2', type: 'promo', goal: 2, text: '진급 2번 하기', gem: 10, jjam: 30 },
    { id: 'days300', type: 'days', goal: 300, max: true, text: '한 판에서 300일 이상 버티기', gem: 15, jjam: 50 },
    { id: 'out1', type: 'discharge', goal: 1, text: '전역하기', gem: 20, jjam: 60 },
    { id: 'daily1', type: 'daily', goal: 1, text: '오늘의 작전 끝까지 하기', gem: 15, jjam: 40 },
    { id: 'bff1', type: 'bff', goal: 1, text: '절친 1명 만들기', gem: 15, jjam: 40 }
  ];

  /* ── 사건 수첩: 본 장면 수집 보상 ─────── */
  JY.COLLECT_MILESTONES = [
    { at: 0.25, gem: 30, jjam: 50 },
    { at: 0.5, gem: 60, jjam: 100, cos: 'mic' },
    { at: 0.75, gem: 100, jjam: 150 },
    { at: 1, gem: 200, jjam: 300, cos: 'goldcamo' }
  ];

  /* 보급 상자: 30💎 */
  JY.BOX = {
    price: 30,
    tiers: [
      { id: 'common', name: '일반', color: '#8a8a7a', p: 0.55, pool: ['skip', 'pxpass', 'feast'], count: 2 },
      { id: 'rare', name: '희귀', color: '#3a86ff', p: 0.28, pool: ['insight', 'clover', 'leave3'], count: 2 },
      { id: 'epic', name: '영웅', color: '#9b5de5', p: 0.13, pool: ['insurance'], cosmetic: true },
      { id: 'legend', name: '전설', color: '#f2a516', p: 0.04, legendCos: 'crown', gems: 100 }
    ]
  };

  /* 훈장: 처음 달성하면 다이아 보상 */
  JY.ACHIEVEMENTS = [
    { id: 'legend20', icon: '📜', name: '썰 제조기', desc: '레전드 썰 20개를 직접 겪었다', gem: 30 },
    { id: 'first_run', icon: '🪖', name: '첫 입대', desc: '처음으로 입대했다', gem: 10 },
    { id: 'first_out', icon: '🎓', name: '민간인', desc: '처음으로 전역했다', gem: 30 },
    { id: 'end5', icon: '📗', name: '엔딩 수집가', desc: '엔딩 5종 달성', gem: 30 },
    { id: 'end10', icon: '📘', name: '엔딩 마니아', desc: '엔딩 10종 달성', gem: 50 },
    { id: 'end19', icon: '📕', name: '엔딩 마스터', desc: '엔딩 19종 전부 달성', gem: 150 },
    { id: 'sharp', icon: '🎯', name: '특등사수', desc: '사격 9/10 이상', gem: 20 },
    { id: 'special', icon: '🏃', name: '특급전사', desc: '체력측정 특급 달성', gem: 20 },
    { id: 'cat', icon: '🐈', name: '집사 등극', desc: '짬타이거 입양 전역', gem: 40 },
    { id: 'gf', icon: '💐', name: '꽃신', desc: '곰신과 함께 전역', gem: 40 },
    { id: 'malchul', icon: '🏖️', name: '말출의 달인', desc: '말년휴가 나가서 그대로 전역', gem: 30 },
    { id: 'rich', icon: '💰', name: '전역 부자', desc: '전역 통장 3,500만 원 이상', gem: 30 },
    { id: 'noleave', icon: '🫡', name: '휴가 반납', desc: '휴가를 하루도 안 쓰고 전역', gem: 50 },
    { id: 'emer10', icon: '🚨', name: '돌발 상황 전문가', desc: '돌발 상황 누적 10회 대응', gem: 30 },
    { id: 'mini10', icon: '🎮', name: '미니게임 고수', desc: '미니게임 대성공 누적 10회', gem: 30 },
    { id: 'bff3', icon: '🤝', name: '인싸 오브 인싸', desc: '한 판에 절친 3명', gem: 40 },
    { id: 'allunits', icon: '🗺️', name: '전군 순회', desc: '5개 부대 모두에서 전역', gem: 80 },
    { id: 'daily', icon: '📅', name: '오늘의 작전', desc: '오늘의 작전에 참가', gem: 10 },
    { id: 'streak7', icon: '🗓️', name: '개근상', desc: '7일 연속 출석', gem: 50 },
    { id: 'score20k', icon: '🏆', name: '전설의 예비역', desc: '한 판 20,000점 이상', gem: 60 },
    { id: 'fail10', icon: '😵', name: '재입대 장인', desc: '전역 실패 누적 10회', gem: 20 },
    { id: 'heat3', icon: '🔥', name: '악조건 돌파', desc: '악조건 3개 이상 켜고 전역', gem: 50 },
    { id: 'heatall', icon: '🌋', name: '지옥에서 온 예비역', desc: '악조건 7개 전부 켜고 전역', gem: 200 }
  ];

  /* 점수 */
  JY.SCORE = {
    endingBonus: { cat: 2000, gf: 1500, elite: 2000, rich: 1000, beloved: 1500, model: 1500, malchul: 800, cast: 500 },
    titles: [
      [0, '훈련병급'], [3000, '이병급'], [6000, '일병급'], [9000, '상병급'],
      [12000, '병장급'], [16000, '모범 예비역'], [20000, '전설의 예비역']
    ]
  };
  JY.scoreTitle = function (score) {
    var t = JY.SCORE.titles[0][1];
    JY.SCORE.titles.forEach(function (x) { if (score >= x[0]) t = x[1]; });
    return t;
  };
})(window.JY = window.JY || {});
