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
    crown: { slot: 'hat', name: '전역 왕관', icon: '👑', price: 0, gacha: 'legend', hat: 'crown' }
  };
  JY.COSMETIC_ORDER = ['blush', 'mustache', 'headband', 'sunglasses', 'sparkle', 'beret', 'cateears', 'gold', 'afro', 'crown'];
  JY.SLOT_NAMES = { hat: '모자', face: '얼굴', fx: '효과' };

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
    { id: 'fail10', icon: '😵', name: '재입대 장인', desc: '전역 실패 누적 10회', gem: 20 }
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
