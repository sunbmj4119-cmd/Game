/* 제설각 — 데이터: 지도(8구역), 건물·소품, 도구, 인력, 보급, 계급, 날씨, 방해꾼, 대사 */
(function (JY) {
  'use strict';

  var CELL = 10, W = 800, H = 1200;

  // 제설 구역. value = 눈 한 칸(깊이 1)당 초코파이. parts = 다 치우면 "띵!" 하는 작은 구역
  // reveal = 구역을 열 때 드러나는 군대 요소, holes = 구역 안의 못 치우는 자리(전차 등)
  var ZONES = [
    { id: 'A', name: '생활관 앞 길', x: 80, y: 130, w: 380, h: 120, value: 1, cost: 0, ground: 'walk',
      parts: [['생활관 앞 왼쪽', 0, 0, 0.5, 1], ['생활관 앞 오른쪽', 0.5, 0, 1, 1]],
      reveal: '이병의 첫 전장. 생활관 창문으로 선임들이 구경한다.' },
    { id: 'B', name: '족구장', x: 480, y: 130, w: 300, h: 150, value: 1, cost: 600, ground: 'court',
      parts: [['족구장 왼쪽 코트', 0, 0, 0.5, 1], ['족구장 오른쪽 코트', 0.5, 0, 1, 1]],
      reveal: '눈 치우자마자 족구가 시작된다. 지는 쪽이 내일 제설이다.' },
    { id: 'C', name: '연병장', x: 40, y: 320, w: 460, h: 280, value: 2, cost: 4000, ground: 'parade',
      parts: [['1소대 자리', 0, 0, 0.5, 0.5], ['2소대 자리', 0.5, 0, 1, 0.5], ['3소대 자리', 0, 0.5, 0.5, 1], ['4소대 자리', 0.5, 0.5, 1, 1]],
      reveal: '구령대 앞 바닥에 "충성". 사열 때 얼어 죽을 뻔한 그곳.' },
    { id: 'D', name: '취사장 앞', x: 540, y: 320, w: 230, h: 240, value: 3, cost: 15000, ground: 'yard',
      parts: [['배식구 가는 길', 0, 0, 1, 0.5], ['짬통 가는 길', 0, 0.5, 1, 1]],
      reveal: '짬통 옆엔 짬타이거가 산다. 고양이는 눈을 안 치운다. 구경만 한다.' },
    { id: 'E', name: '부대 진입로', x: 340, y: 620, w: 120, h: 450, value: 4, cost: 40000, ground: 'road',
      parts: [['진입로 위쪽', 0, 0, 1, 0.34], ['진입로 가운데', 0, 0.34, 1, 0.67], ['진입로 아래쪽', 0, 0.67, 1, 1]],
      reveal: '간부 차량이 다니는 길. 다 치워 놓으면 꼭 차가 지나가며 진흙눈을 튀긴다.' },
    { id: 'F', name: '전차 주차장', x: 40, y: 640, w: 270, h: 280, value: 6, cost: 120000, ground: 'tank',
      parts: [['1호 전차 주변', 0, 0, 1, 0.5], ['2호 전차 주변', 0, 0.5, 1, 1]],
      holes: [[80, 690, 70, 50], [200, 800, 70, 50]],
      reveal: 'K-전차 두 대가 눈을 맞고 있다. 포탑에 눈사람 만들면 영창(농담).' },
    { id: 'G', name: '위병소 앞', x: 120, y: 1090, w: 500, h: 90, value: 8, cost: 300000, ground: 'gate',
      parts: [['위병소 왼쪽', 0, 0, 0.5, 1], ['위병소 오른쪽', 0.5, 0, 1, 1]],
      reveal: '부대의 얼굴. 사단장님 차가 여기로 들어온다. 한 톨도 남기면 안 된다.' },
    { id: 'H', name: '헬기장', x: 500, y: 720, w: 270, h: 280, value: 12, cost: 700000, ground: 'pad',
      parts: [['헬기장 북쪽', 0, 0, 1, 0.5], ['헬기장 남쪽', 0, 0.5, 1, 1]],
      reveal: '가끔 헬기가 내려앉는다. 하강풍이 눈을 날려 준다. 처음으로 고마운 존재.' }
  ];

  // 건물 (못 지나간다). wall = 앞벽 높이, sign = 간판 아래 한마디
  var BUILDINGS = [
    { id: 'barracks', name: '생활관', x: 60, y: 16, w: 400, h: 96, wall: 30, roof: '#7d8a5a', wallc: '#e7dcc4', door: true, sign: '조용히' },
    { id: 'office', name: '행정반', x: 490, y: 24, w: 150, h: 88, wall: 26, roof: '#6f7f8f', wallc: '#dde3e6', door: true, sign: '노크 필수' },
    { id: 'px', name: 'PX', x: 660, y: 30, w: 120, h: 82, wall: 24, roof: '#c0563f', wallc: '#f2e6c9', door: true, sign: '오늘 휴무' },
    { id: 'stand', name: '구령대', x: 200, y: 266, w: 110, h: 36, wall: 14, roof: '#9a8a70', wallc: '#cfc5b0' },
    { id: 'mess', name: '취사장', x: 560, y: 580, w: 210, h: 100, wall: 28, roof: '#8b6f54', wallc: '#efe3cf', door: true, sign: '오늘 짜장' },
    { id: 'garage', name: '정비고', x: 40, y: 940, w: 260, h: 90, wall: 30, roof: '#5f6f4f', wallc: '#d4d0c4', door: true, sign: '기름 냄새' },
    { id: 'guard', name: '위병소', x: 640, y: 1080, w: 100, h: 80, wall: 24, roof: '#4f5d3c', wallc: '#e2dccb', door: true, sign: '충성!' }
  ];

  // 전차 (구역 안의 구멍 자리에 서 있다. 못 지나간다)
  var TANKS = [{ x: 80, y: 690, w: 70, h: 50, name: '1호' }, { x: 200, y: 800, w: 70, h: 50, name: '2호' }];

  // 나무 (장식 + 충돌)
  var TREES = [];
  (function () {
    for (var i = 0; i < 12; i++) { TREES.push([16, 150 + i * 88]); TREES.push([794, 140 + i * 88 + 40]); }
    [[480, 700], [480, 860], [480, 1030], [320, 960], [770, 1060], [24, 1100], [330, 300], [24, 70], [776, 300]].forEach(function (p) { TREES.push(p); });
  })();

  // 장식 (지나갈 수 있다)
  var DECOR = [
    { t: 'flag', x: 520, y: 298 },
    { t: 'snowman', x: 470, y: 120 },
    { t: 'net', x: 630, y1: 132, y2: 278 },
    { t: 'bins', x: 532, y: 572 },
    { t: 'barrier', x: 400, y: 1084 },
    { t: 'sign', x: 470, y: 262, text: '제설은 전투다!' },
    { t: 'sign', x: 476, y: 1078, text: '고라니 출몰 주의' },
    { t: 'sign', x: 30, y: 300, text: '흡연장 → (금연)' },
    { t: 'sign', x: 322, y: 612, text: '서행 · 10km' },
    { t: 'sign', x: 30, y: 628, text: '전차 만지지 마시오' },
    { t: 'lamp', x: 328, y: 660 }, { t: 'lamp', x: 328, y: 800 }, { t: 'lamp', x: 328, y: 940 },
    { t: 'lamp', x: 472, y: 760 }, { t: 'lamp', x: 472, y: 920 }, { t: 'lamp', x: 30, y: 200 }
  ];

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

  // 인력. rank = 채용 가능한 계급(0 이병 ~ 3 병장), face = 전역각 등장인물 얼굴
  var CREW = [
    { id: 'hoobae', name: '후임', tag: '이병', rank: 0, cost: 150, grow: 1.32, max: 12, r: 9, p: 1, hit: 0.24, speed: 46, hat: 'helmet', coat: '#5b6a3a', face: 'hoobae',
      desc: '초코파이 하나면 영혼까지 갈아 넣는다.', lines: ['넵!', '알겠습니다!', '이거 언제 끝납니까…', '손이 안 느껴집니다…', '초코파이 감사합니다!'] },
    { id: 'donggi', name: '동기', tag: '일병', rank: 1, cost: 1500, grow: 1.34, max: 10, r: 13, p: 1, hit: 0.2, speed: 56, hat: 'beanie', coat: '#566436', face: 'dumb',
      desc: '같이 고생하는 사이. 투덜대지만 손은 빠르다.', lines: ['야 이거 끝나긴 하냐', 'PX 가고 싶다', '눈 그만 와라 제발', '너 때문에 나도 나왔잖아'] },
    { id: 'cook', name: '취사병', tag: '일병', rank: 1, cost: 6000, grow: 1.35, max: 8, r: 12, p: 2, hit: 0.26, speed: 50, hat: 'chef', coat: '#e9e6dc', face: 'cook',
      desc: '아침 배식 끝나고 바로 끌려왔다. 국자 대신 삽.', lines: ['점심 준비해야 하는데…', '국자가 그립다', '오늘 점심 짜장이다'] },
    { id: 'malnyeon', name: '말년 병장', tag: '병장', rank: 2, cost: 25000, grow: 1.38, max: 6, r: 22, p: 2, hit: 0.2, speed: 40, sleep: 0.4, hat: 'beanie', coat: '#4f5c31', face: 'malnyeon',
      desc: '작업 시간의 40%는 잔다. 깨어 있으면 제일 잘 민다.', lines: ['나 전역 며칠 남았지?', '후임아 여기도', '라떼는 눈이 허리까지 왔어'] },
    { id: 'admin', name: '행정병', tag: '상병', rank: 2, cost: 70000, grow: 1.38, max: 6, r: 16, p: 2, hit: 0.17, speed: 64, hat: 'cap', coat: '#5d6b3b', face: 'clerk',
      desc: '키보드만 치던 손이 넉가래를 잡았다. 의외로 빠르다.', lines: ['엑셀로 치우면 안 되나', '결재 올려야 하는데', '이것도 보고서 써야 합니까?'] },
    { id: 'reserve', name: '예비군 아저씨', tag: '예비군', rank: 3, cost: 250000, grow: 1.4, max: 8, r: 18, p: 2, hit: 0.28, speed: 36, hat: 'reserve', coat: '#6b6f4a', face: 'reserve',
      desc: '동원훈련 왔다가 끌려왔다. 느리지만 요령이 있다.', lines: ['내가 이걸 또 하네', '요즘 애들은 말이야~', '집에 가고 싶다', '우리 땐 삽 하나로 다 했어'] },
    { id: 'plow', name: '제설차', tag: '운전병', rank: 3, cost: 1200000, grow: 1.6, max: 3, r: 34, p: 3, hit: 0.15, speed: 72, vehicle: true, coat: '#e0a526', face: 'driver',
      desc: '운전병과 함께 지원 나온 제설차. 빵빵거리며 다 민다.', lines: ['빵빵!', '비켜, 비켜!', '후진합니다~ 후진합니다~'] }
  ];

  // 보급 (레벨 업그레이드)
  var PERKS = [
    { id: 'eisen', name: '아이젠', max: 5, cost: 300, grow: 2.3, desc: '군화에 아이젠. 걷는 속도 +12%' },
    { id: 'hotpack', name: '핫팩', max: 5, cost: 500, grow: 2.5, desc: '하루 작업 시간 +8초' },
    { id: 'matsta', name: '맛스타', max: 5, cost: 900, grow: 2.6, desc: '당 충전. 내 손이 10% 더 빠르다' },
    { id: 'praise', name: '행보관 칭찬', max: 10, cost: 1500, grow: 2.4, desc: '초코파이 보상 +15%' },
    { id: 'gong', name: '꽹과리', max: 3, cost: 2500, grow: 3, desc: '고라니가 덜 온다 (하루 고라니 -25%)' },
    { id: 'medic', name: '의무병 대기', max: 5, cost: 4000, grow: 2.6, desc: '다친 인력이 15% 빨리 일어난다' },
    { id: 'song', name: '군가 스피커', max: 5, cost: 6000, grow: 2.7, desc: '인력 전원 이동 +12%, 손 +6%' },
    { id: 'gear', name: '인력 장비 보급', max: 5, cost: 15000, grow: 2.9, desc: '인력 전원의 미는 범위 +15%' }
  ];

  // 얼굴 (전역각 등장인물을 그대로 쓰거나 비슷하게)
  var FACES = {
    me: { seed: 'me-snow', eyes: 'derp', brows: 'worried', mouth: 'wavy', hat: 'beanie', extras: ['snot', 'blush'], head: 'round' },
    reserve: { seed: 'reserve', eyes: 'smug', brows: 'thick', mouth: 'smirk', hat: 'cap', extras: ['stubble', 'mustache'], head: 'wide' }
  };

  var RANKS = [
    { name: '이병', life: 0 },
    { name: '일병', life: 3000 },
    { name: '상병', life: 40000 },
    { name: '병장', life: 200000 }
  ];
  var DISCHARGE_LIFE = 1000000; // 전역 신고 가능

  // 날씨. depth = 밤사이 쌓인 깊이 범위, fall = 낮에 내리는 양, mult = 보상 배수
  var WEATHER = {
    light: { name: '잔설', depth: [1, 2], fall: 0.45, mult: 0.9, flakes: 25 },
    normal: { name: '눈', depth: [1, 3], fall: 1, mult: 1, flakes: 70 },
    heavy: { name: '함박눈', depth: [2, 4], fall: 1.8, mult: 1.25, flakes: 150 },
    blizzard: { name: '폭설 경보', depth: [3, 4], fall: 2.6, mult: 1.6, flakes: 260 }
  };

  // 방해꾼과 사건
  var HAZ = {
    deer: { from: 2, speed: 96, life: [9, 13], hitR: 11, injure: 7, stun: 1.6, kick: 0.35 },
    snowball: { from: 4, p: 0.6, stun: 0.5 },
    car: { zone: 'E', trips: [1, 2], speed: 70, r: 12, slush: 0.55 },
    roof: { every: 22, stun: 1.2, injure: 3 },
    heli: { zone: 'H', p: 0.45, r: 60, life: 7 },
    cats: { zone: 'D', n: 2 }
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
    deer: ['고라니다!! 피해!', '야 고라니! 고라니 들어왔다!', '저 고라니 또 왔네…', '고라니 잡지 마! 쫓기만 해!'],
    deerHit: ['의무병! 의무병!', '고라니한테 받혔다!', '괜찮나?! …괜찮네. 다시 치워.'],
    meHit: ['야! 초코파이 떨어뜨렸잖아!', '고라니한테 진 거냐?'],
    snowball: ['누가 던졌어!!', '선임들 눈싸움 중이다. 못 본 척해.'],
    car: ['중대장님 차 지나가신다! 길 비켜!', '아… 방금 치운 길인데.'],
    roof: ['지붕 눈 떨어진다! 조심!', '우르르… 다시 치워.'],
    heli: ['헬기다! 하강풍에 눈 날아간다!', '사단에서 헬기 보내 줬다! (훈련 중)'],
    part: ['깔끔하다!', '좋아, 거긴 끝!', '이게 군대 제설이다.'],
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
    ZONES: ZONES, BUILDINGS: BUILDINGS, TANKS: TANKS, TREES: TREES, DECOR: DECOR, TOOLS: TOOLS, CREW: CREW, PERKS: PERKS, FACES: FACES,
    RANKS: RANKS, DISCHARGE_LIFE: DISCHARGE_LIFE, WEATHER: WEATHER, HAZ: HAZ, LINES: LINES,
    SPAWN: { x: 200, y: 180 }, DOOR: { x: 260, y: 114 },
    BASE_DAY: 60, GOAL: 0.8, INSPECT_GOAL: 0.9, FALL: 0.005, HIT: 0.12, SPEED: 78, PART_DONE: 0.97
  };
})(window.JY = window.JY || {});
