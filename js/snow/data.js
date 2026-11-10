/* 제설각 — 데이터: 지도, 도구, 인력, 보급, 계급, 날씨, 대사 */
(function (JY) {
  'use strict';

  var CELL = 10, W = 640, H = 1120;

  // 제설 구역 (눈이 쌓이고 치울 수 있는 곳). value = 눈 한 칸(깊이 1)당 초코파이
  var ZONES = [
    { id: 'A', name: '생활관 앞 길', x: 60, y: 120, w: 260, h: 140, value: 1, cost: 0, ground: 'walk' },
    { id: 'B', name: '생활관 앞 마당', x: 320, y: 120, w: 260, h: 140, value: 1, cost: 600, ground: 'walk' },
    { id: 'C', name: '연병장', x: 40, y: 320, w: 560, h: 290, value: 2, cost: 4000, ground: 'parade' },
    { id: 'D', name: '부대 진입로', x: 230, y: 620, w: 180, h: 320, value: 3, cost: 30000, ground: 'road' },
    { id: 'E', name: '위병소 앞', x: 100, y: 950, w: 400, h: 130, value: 5, cost: 100000, ground: 'gate' },
    { id: 'F', name: '헬기장', x: 440, y: 650, w: 160, h: 220, value: 8, cost: 400000, ground: 'pad' }
  ];

  // 건물 (못 지나간다). wall = 앞면 높이
  var BUILDINGS = [
    { id: 'barracks', name: '생활관', x: 40, y: 14, w: 560, h: 94, wall: 30, roof: '#7d8a5a', door: true },
    { id: 'stand', name: '구령대', x: 270, y: 272, w: 100, h: 38, wall: 14, roof: '#9a8a70' },
    { id: 'office', name: '행정반', x: 50, y: 640, w: 160, h: 110, wall: 26, roof: '#6f7f8f', door: true },
    { id: 'store', name: '보급창고', x: 50, y: 790, w: 160, h: 110, wall: 26, roof: '#8b6f54', door: true },
    { id: 'guard', name: '위병소', x: 524, y: 958, w: 80, h: 70, wall: 22, roof: '#5f6f4f', door: true }
  ];

  // 나무 (장식 + 충돌)
  var TREES = [];
  (function () {
    var i;
    for (i = 0; i < 11; i++) { TREES.push([20, 140 + i * 88]); TREES.push([622, 140 + i * 88 + 30]); }
    [[230, 290], [410, 290], [440, 905], [600, 905], [70, 1050], [60, 930], [604, 1080]].forEach(function (p) { TREES.push(p); });
  })();

  // 플레이어 도구. r = 미는 범위(px), p = 한 번에 치우는 깊이, aura = 몸 주변 전체
  var TOOLS = [
    { id: 'broom', name: '싸리비', r: 10, p: 1, cost: 0, desc: '훈련소에서 받은 그 빗자루. 한 번에 한 뼘.' },
    { id: 'pusher', name: '넉가래', r: 15, p: 1, cost: 300, desc: '군대 제설의 상징. 밀면 밀린다.' },
    { id: 'pusher2', name: '대형 넉가래', r: 20, p: 1, cost: 3000, desc: '보급창고 구석에서 찾은 왕넉가래.' },
    { id: 'twin', name: '쌍넉가래', r: 25, p: 2, cost: 20000, desc: '양손에 하나씩. 팔은 내 것이 아니다.' },
    { id: 'cart', name: '손수레 제설기', r: 32, p: 2, cost: 90000, desc: '바퀴 달린 넉가래. 문명의 시작.' },
    { id: 'salt', name: '염화칼슘 살포기', r: 40, p: 2, cost: 350000, aura: true, desc: '내 주변이 전부 녹는다. 군화는 녹슨다.' },
    { id: 'tractor', name: '트랙터 제설기', r: 52, p: 3, cost: 1500000, vehicle: true, desc: '옆 부대에서 빌려 왔다. 반납은 안 했다.' },
    { id: 'truck', name: '군용 제설차', r: 70, p: 3, cost: 6000000, vehicle: true, desc: '사단에 딱 한 대 있다는 그 차.' },
    { id: 'heli', name: '제설 헬기', r: 110, p: 4, cost: 30000000, vehicle: true, aura: true, desc: '하강풍으로 눈을 날려 버린다. 예산은 묻지 마라.' }
  ];

  // 인력. rank = 채용 가능한 계급(0 이병 ~ 3 병장)
  var CREW = [
    { id: 'hoobae', name: '후임', tag: '이병', rank: 0, cost: 150, grow: 1.32, max: 12, r: 9, p: 1, hit: 0.24, speed: 46, hat: 'helmet', coat: '#5b6a3a',
      desc: '초코파이 하나면 영혼까지 갈아 넣는다.', lines: ['넵!', '알겠습니다!', '이거 언제 끝납니까…', '손이 안 느껴집니다…', '초코파이 감사합니다!'] },
    { id: 'donggi', name: '동기', tag: '일병', rank: 1, cost: 1500, grow: 1.34, max: 10, r: 13, p: 1, hit: 0.2, speed: 56, hat: 'beanie', coat: '#566436',
      desc: '같이 고생하는 사이. 투덜대지만 손은 빠르다.', lines: ['야 이거 끝나긴 하냐', 'PX 가고 싶다', '눈 그만 와라 제발', '너 때문에 나도 나왔잖아'] },
    { id: 'cook', name: '취사병', tag: '일병', rank: 1, cost: 6000, grow: 1.35, max: 8, r: 12, p: 2, hit: 0.26, speed: 50, hat: 'chef', coat: '#e9e6dc',
      desc: '아침 배식 끝나고 바로 끌려왔다. 국자 대신 삽.', lines: ['점심 준비해야 하는데…', '국자가 그립다', '오늘 점심 짜장이다'] },
    { id: 'malnyeon', name: '말년 병장', tag: '병장', rank: 2, cost: 25000, grow: 1.38, max: 6, r: 22, p: 2, hit: 0.2, speed: 40, sleep: 0.4, hat: 'beanie', coat: '#4f5c31',
      desc: '작업 시간의 40%는 잔다. 깨어 있으면 제일 잘 민다.', lines: ['나 전역 며칠 남았지?', '후임아 여기도', '라떼는 눈이 허리까지 왔어'] },
    { id: 'admin', name: '행정병', tag: '상병', rank: 2, cost: 70000, grow: 1.38, max: 6, r: 16, p: 2, hit: 0.17, speed: 64, hat: 'cap', coat: '#5d6b3b',
      desc: '키보드만 치던 손이 넉가래를 잡았다. 의외로 빠르다.', lines: ['엑셀로 치우면 안 되나', '결재 올려야 하는데', '이것도 보고서 써야 합니까?'] },
    { id: 'reserve', name: '예비군 아저씨', tag: '예비군', rank: 3, cost: 250000, grow: 1.4, max: 8, r: 18, p: 2, hit: 0.28, speed: 36, hat: 'reserve', coat: '#6b6f4a',
      desc: '동원훈련 왔다가 끌려왔다. 느리지만 요령이 있다.', lines: ['내가 이걸 또 하네', '요즘 애들은 말이야~', '집에 가고 싶다', '우리 땐 삽 하나로 다 했어'] },
    { id: 'plow', name: '제설차', tag: '운전병', rank: 3, cost: 1200000, grow: 1.6, max: 3, r: 34, p: 3, hit: 0.15, speed: 72, vehicle: true, coat: '#e0a526',
      desc: '운전병과 함께 지원 나온 제설차. 빵빵거리며 다 민다.', lines: ['빵빵!', '비켜, 비켜!', '후진합니다~ 후진합니다~'] }
  ];

  // 보급 (레벨 업그레이드)
  var PERKS = [
    { id: 'eisen', name: '아이젠', max: 5, cost: 300, grow: 2.3, desc: '군화에 아이젠. 걷는 속도 +12%' },
    { id: 'hotpack', name: '핫팩', max: 5, cost: 500, grow: 2.5, desc: '하루 작업 시간 +8초' },
    { id: 'matsta', name: '맛스타', max: 5, cost: 900, grow: 2.6, desc: '당 충전. 내 손이 10% 더 빠르다' },
    { id: 'praise', name: '행보관 칭찬', max: 10, cost: 1500, grow: 2.4, desc: '초코파이 보상 +15%' },
    { id: 'song', name: '군가 스피커', max: 5, cost: 6000, grow: 2.7, desc: '인력 전원 이동 +12%, 손 +6%' },
    { id: 'gear', name: '인력 장비 보급', max: 5, cost: 15000, grow: 2.9, desc: '인력 전원의 미는 범위 +15%' }
  ];

  // 계급: life = 지금까지 번 초코파이
  var RANKS = [
    { name: '이병', life: 0 },
    { name: '일병', life: 3000 },
    { name: '상병', life: 40000 },
    { name: '병장', life: 200000 }
  ];
  var DISCHARGE_LIFE = 800000; // 전역 신고 가능

  // 날씨. depth = 밤사이 쌓인 깊이 범위, fall = 낮에 내리는 양, mult = 보상 배수
  var WEATHER = {
    light: { name: '잔설', depth: [1, 2], fall: 0.45, mult: 0.9, flakes: 25 },
    normal: { name: '눈', depth: [1, 3], fall: 1, mult: 1, flakes: 70 },
    heavy: { name: '함박눈', depth: [2, 4], fall: 1.8, mult: 1.25, flakes: 150 },
    blizzard: { name: '폭설 경보', depth: [3, 4], fall: 2.6, mult: 1.6, flakes: 260 }
  };

  var LINES = {
    start: ['자, 제설 작전 개시!', '눈은 하늘에서 내리는 쓰레기다. 치워!', '점호 전까지 싹 다 치운다.', '제설도 전투다. 전투!', '오늘도 하늘이 우리를 시험한다.'],
    inspect: ['오늘 대대장님 순시다. 90% 못 넘기면 다 죽는다!'],
    heavy: ['함박눈이다… 오늘 다 죽었다.', '하늘이 우리 중대를 미워한다.', '폭설이다. 정신 차려!'],
    idle: ['어이, 거기 서서 뭐 하나?', '쉬는 거 아니지?', '넉가래가 혼자 움직이나?'],
    half: ['반 했다. 이제 시작이다.', '오, 좀 하는데?'],
    near: ['거의 다 왔다! 마무리 깔끔하게!', '조금만 더! 점호 전에 끝낸다!'],
    regrow: ['치운 데 또 쌓였다! 다시!', '하늘을 탓하지 마라. 삽을 들어라.'],
    sleep: ['병장! 자냐?!', '말년이라고 봐줄 줄 알았나!'],
    late: ['10초 남았다!', '시간 없다! 뛰어!'],
    grade: {
      S: ['특급 제설이다! 오늘은 초코파이 파티다.', '이 정도면 사단장님 오셔도 된다.'],
      A: ['양호. 내일도 이렇게만 해.', '음, 쓸 만하군.'],
      B: ['미흡하다. 여기저기 눈이 남았잖아.', '내일 새벽 5시 기상이다.'],
      C: ['재작업이다! 점심 먹고 다시 나온다.', '이걸 치웠다고 하는 건가?']
    },
    hire: ['새 인력 투입! 초코파이 값은 해라.', '한 명 더 끌고 왔다.'],
    tool: ['장비가 좋아졌으니 핑계는 없다.', '이제 좀 군대 같군.'],
    zone: ['구역 확장! 치울 곳이 늘었다. 기쁘지?', '여기도 이제 우리 중대 담당이다.']
  };

  JY.SNOW = {
    CELL: CELL, W: W, H: H, GW: W / CELL, GH: H / CELL,
    ZONES: ZONES, BUILDINGS: BUILDINGS, TREES: TREES, TOOLS: TOOLS, CREW: CREW, PERKS: PERKS,
    RANKS: RANKS, DISCHARGE_LIFE: DISCHARGE_LIFE, WEATHER: WEATHER, LINES: LINES,
    SPAWN: { x: 190, y: 150 }, DOOR: { x: 320, y: 112 },
    BASE_DAY: 60, GOAL: 0.8, INSPECT_GOAL: 0.9, FALL: 0.005, HIT: 0.12, SPEED: 78
  };
})(window.JY = window.JY || {});
