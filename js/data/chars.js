/* 등장인물 — 어느 부대에나 한 명씩은 있을 법한 사람들 */
(function (JY) {
  'use strict';

  JY.CHARS = {
    me: { name: '{name}', role: '{rank} · 나', spec: null }, // 플레이어 스펙은 게임 상태에서 주입
    jogyo: {
      name: '호랑이 조교', role: '훈련소 조교',
      spec: { seed: 'jogyo', eyes: 'angry', brows: 'angry', mouth: 'shout', hat: 'jogyo', rank: 'e3', prop: 'megaphone', head: 'square' }
    },
    barber: {
      name: '이발병', role: '훈련소 이발병',
      spec: { seed: 'barber', eyes: 'happy', mouth: 'grin', hat: 'none', extras: ['blush'], rank: 'e3' }
    },
    malnyeon: {
      name: '김말년', role: '병장 · 왕고',
      spec: { seed: 'malnyeon', eyes: 'sleepy', brows: 'none', mouth: 'drool', body: 'kkal', hat: 'none', extras: ['snot'], head: 'potato' }
    },
    fm: {
      name: '최원칙', role: '상병 · 분대장',
      spec: { seed: 'fm', eyes: 'angry', brows: 'thick', mouth: 'flat', hat: 'cap', hatRank: 'e3', rank: 'e3', extras: ['glasses'], head: 'square', prop: 'clipboard' }
    },
    dumb: {
      name: '박덤벙', role: '이병 · 동기',
      spec: { seed: 'dumb', eyes: 'derp', brows: 'uni', mouth: 'teeth', hat: 'none', rank: 'e1', extras: ['blush', 'bigEars'], head: 'egg' }
    },
    ppaen: {
      name: '정뺀질', role: '일병 · 맞선임',
      spec: { seed: 'ppaen', eyes: 'smug', brows: 'up', mouth: 'smirk', hat: 'none', rank: 'e2', prop: 'phone', head: 'wide' }
    },
    hoobae: {
      name: '오순둥', role: '이병 · 후임',
      spec: { seed: 'hoobae', eyes: 'wide', brows: 'worried', mouth: 'wavy', hat: 'helmetBig', rank: 'e1', extras: ['sweat'] }
    },
    haeng: {
      name: '강삽질', role: '상사 · 행정보급관',
      spec: { seed: 'haeng', eyes: 'dot', brows: 'thick', mouth: 'frown', hat: 'cap', hatRank: 'nco', rank: 'nco', extras: ['stubble'], nose: 'big', prop: 'shovel', head: 'square' }
    },
    captain: {
      name: '한열정', role: '대위 · 중대장',
      spec: { seed: 'captain', eyes: 'sparkle', brows: 'up', mouth: 'grin', hat: 'cap', hatRank: 'o3', rank: 'o3', extras: ['sparkles'] }
    },
    lt: {
      name: '이신입', role: '소위 · 소대장',
      spec: { seed: 'lt', eyes: 'wide', brows: 'worried', mouth: 'o', hat: 'cap', hatRank: 'o1', rank: 'o1', extras: ['blush', 'sweat'], head: 'egg' }
    },
    cook: {
      name: '오짬밥', role: '상병 · 취사병',
      spec: { seed: 'cook', eyes: 'happy', mouth: 'grin', hat: 'chef', body: 'chef', prop: 'ladle', extras: ['blush'], head: 'wide' }
    },
    doc: {
      name: '정처방', role: '대위 · 군의관',
      spec: { seed: 'doc', eyes: 'dot', brows: 'normal', mouth: 'flat', hat: 'none', hair: 'side', body: 'white', extras: ['glasses'], prop: 'pill' }
    },
    general: {
      name: '사단장님', role: '소장 · ★★',
      spec: { seed: 'general', eyes: 'sunglasses', mouth: 'smile', hat: 'general', rank: 'gen', extras: ['mustache'], head: 'wide' }
    },
    mom: {
      name: '엄마', role: '우리 집 사령관',
      spec: { seed: 'mom', eyes: 'happy', mouth: 'smile', hat: 'none', hair: 'perm', body: 'civil', extras: ['blush'] }
    },
    gf: {
      name: '여자친구', role: '곰신',
      spec: { seed: 'gf2', skin: '#ffe0c2', eyes: 'normal', brows: 'normal', mouth: 'smile', hat: 'none', hair: 'long', body: 'civil2', extras: ['blush'] }
    },
    counselor: {
      name: '상담관 선생님', role: '병영생활 전문상담관',
      spec: { seed: 'counsel', eyes: 'happy', mouth: 'smile', hat: 'none', hair: 'side', body: 'civil2', extras: ['glasses'] }
    },
    duty: {
      name: '당직사관', role: '중사 · 오늘 당직',
      spec: { seed: 'duty', eyes: 'angry', brows: 'angry', mouth: 'flat', hat: 'cap', hatRank: 'nco', rank: 'nco', prop: 'flashlight' }
    },
    medic: {
      name: '의무병 나빨간', role: '상병 · 의무병',
      spec: { seed: 'medic', eyes: 'normal', mouth: 'smile', hat: 'none', rank: 'e3', prop: 'pill', extras: ['mask'] }
    },
    driver: {
      name: '한운전', role: '병장 · 운전병',
      spec: { seed: 'driver', eyes: 'sunglasses', mouth: 'smirk', hat: 'cap', hatRank: 'e4', rank: 'e4', head: 'wide' }
    },
    clerk: {
      name: '문서준', role: '상병 · 행정병',
      spec: { seed: 'clerk', eyes: 'spiral', mouth: 'wavy', hat: 'none', rank: 'e3', extras: ['glasses', 'sweat'], prop: 'clipboard' }
    },
    trainee: {
      name: '훈련병 김눈물', role: '훈련병 · 3주차',
      spec: { seed: 'trainee', eyes: 'teary', brows: 'worried', mouth: 'wavy', hat: 'helmetBig', rank: 'e0', extras: ['sweat'] }
    },
    idol: {
      name: '차반짝', role: '이병 · 전직 아이돌',
      spec: { seed: 'idol', skin: '#ffe3c8', eyes: 'sparkle', brows: 'normal', mouth: 'grin', hat: 'none', hair: 'side', rank: 'e1', extras: ['sparkles', 'blush'] }
    },
    cat: { name: '짬타이거', role: '부대 고양이 · 짬 9년차', special: 'cat' },
    boar: { name: '멧돼지', role: '불청객 · 산에서 옴', special: 'boar' },
    speaker: { name: '중대 방송', role: '스피커', special: 'speaker' },
    letter: { name: '편지', role: '군사우편', special: 'letter' },
    phone: { name: '휴대폰', role: '진동 중', special: 'phone' },
    box: { name: '소포', role: '택배 도착', special: 'box' }
  };

  // 플레이어 얼굴 커스터마이징 선택지
  JY.FACE_OPTIONS = {
    eyes: ['derp', 'normal', 'sleepy', 'dot', 'wide', 'smug', 'happy', 'sparkle'],
    mouth: ['teeth', 'smile', 'open', 'drool', 'wavy', 'grin', 'o', 'cat'],
    brows: ['normal', 'uni', 'thick', 'worried', 'up', 'none'],
    head: ['round', 'potato', 'egg', 'wide', 'square'],
    extras: [[], ['blush'], ['bigEars'], ['snot'], ['blush', 'bigEars']]
  };
})(window.JY = window.JY || {});
