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
    { id: 'B', name: '족구장', x: 480, y: 130, w: 300, h: 150, value: 1, cost: 300, relay: [630, 300], ground: 'court',
      parts: [['족구장 왼쪽 코트', 0, 0, 0.5, 1], ['족구장 오른쪽 코트', 0.5, 0, 1, 1]],
      reveal: '눈 치우자마자 족구가 시작된다. 지는 쪽이 내일 제설이다.' },
    { id: 'C', name: '연병장', x: 40, y: 320, w: 460, h: 280, value: 2, cost: 1200, relay: [200, 618], ground: 'parade',
      parts: [['1소대 자리', 0, 0, 0.5, 0.5], ['2소대 자리', 0.5, 0, 1, 0.5], ['3소대 자리', 0, 0.5, 0.5, 1], ['4소대 자리', 0.5, 0.5, 1, 1]],
      reveal: '구령대 앞 바닥에 "충성". 사열 때 얼어 죽을 뻔한 그곳.' },
    { id: 'D', name: '취사장 앞', x: 540, y: 320, w: 230, h: 240, value: 3, cost: 7000, relay: [520, 440], ground: 'yard',
      parts: [['배식구 가는 길', 0, 0, 1, 0.5], ['짬통 가는 길', 0, 0.5, 1, 1]],
      reveal: '짬통 옆엔 짬타이거가 산다. 고양이는 눈을 안 치운다. 구경만 한다.' },
    { id: 'E', name: '부대 진입로', x: 340, y: 620, w: 120, h: 450, value: 4, cost: 22000, relay: [482, 780], ground: 'road',
      parts: [['진입로 위쪽', 0, 0, 1, 0.34], ['진입로 가운데', 0, 0.34, 1, 0.67], ['진입로 아래쪽', 0, 0.67, 1, 1]],
      reveal: '간부 차량이 다니는 길. 다 치워 놓으면 꼭 차가 지나가며 진흙눈을 튀긴다.' },
    { id: 'F', name: '전차 주차장', x: 40, y: 640, w: 270, h: 280, value: 6, cost: 65000, relay: [325, 760], ground: 'tank',
      parts: [['1호 전차 주변', 0, 0, 1, 0.5], ['2호 전차 주변', 0, 0.5, 1, 1]],
      holes: [[80, 690, 70, 50], [200, 800, 70, 50]],
      reveal: 'K-전차 두 대가 눈을 맞고 있다. 포탑에 눈사람 만들면 영창(농담).' },
    { id: 'G', name: '위병소 앞', x: 120, y: 1090, w: 500, h: 90, value: 8, cost: 180000, relay: [100, 1135], ground: 'gate',
      parts: [['위병소 왼쪽', 0, 0, 0.5, 1], ['위병소 오른쪽', 0.5, 0, 1, 1]],
      reveal: '부대의 얼굴. 사단장님 차가 여기로 들어온다. 한 톨도 남기면 안 된다.' },
    { id: 'H', name: '헬기장', x: 500, y: 720, w: 270, h: 280, value: 12, cost: 450000, relay: [635, 1030], ground: 'pad',
      parts: [['헬기장 북쪽', 0, 0, 1, 0.5], ['헬기장 남쪽', 0, 0.5, 1, 1]],
      reveal: '가끔 헬기가 내려앉는다. 하강풍이 눈을 날려 준다. 처음으로 고마운 존재.' }
  ];

  // 건물 (못 지나간다). wall = 앞벽 높이, sign = 간판 아래 한마디
  var BUILDINGS = [
    { id: 'barracks', name: '생활관', x: 60, y: 16, w: 400, h: 96, wall: 30, roof: '#7d8a5a', wallc: '#e7dcc4', door: true, sign: '조용히' },
    { id: 'office', name: '행정반', x: 490, y: 24, w: 150, h: 88, wall: 26, roof: '#6f7f8f', wallc: '#dde3e6', door: true, sign: '노크 필수' },
    { id: 'px', name: 'PX', x: 660, y: 30, w: 120, h: 82, wall: 24, roof: '#c0563f', wallc: '#f2e6c9', door: true, sign: '냉동 있음' },
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
    { id: 'broom', name: '싸리비', r: 11, p: 1, cost: 0, cap: 60, desc: '훈련소에서 받은 그 빗자루. 한 번에 한 뼘.' },
    { id: 'pusher', name: '넉가래', r: 15, p: 1, cost: 150, cap: 110, desc: '군대 제설의 상징. 밀면 밀린다.' },
    { id: 'pusher2', name: '대형 넉가래', r: 20, p: 1, cost: 800, cap: 200, desc: '보급창고 구석에서 찾은 왕넉가래.' },
    { id: 'twin', name: '쌍넉가래', r: 25, p: 2, cost: 5000, cap: 380, desc: '양손에 하나씩. 팔은 내 것이 아니다.' },
    { id: 'cart', name: '손수레 제설기', r: 32, p: 2, cost: 50000, cap: 700, desc: '바퀴 달린 넉가래. 문명의 시작.' },
    { id: 'salt', name: '염화칼슘 살포기', r: 40, p: 2, cost: 150000, cap: 1200, aura: true, desc: '내 주변이 전부 녹는다. 군화는 녹슨다.' },
    { id: 'tractor', name: '트랙터 제설기', r: 52, p: 3, cost: 500000, cap: 3000, vehicle: true, desc: '옆 부대에서 빌려 왔다. 반납은 안 했다.' },
    { id: 'truck', name: '군용 제설차', r: 70, p: 3, cost: 1500000, cap: 8000, vehicle: true, desc: '사단에 딱 한 대 있다는 그 차.' },
    { id: 'heli', name: '제설 헬기', r: 110, p: 4, cost: 5000000, cap: 20000, vehicle: true, aura: true, desc: '하강풍으로 눈을 날려 버린다. 예산은 묻지 마라.' }
  ];

  // 인력. rank = 채용 가능한 계급(0 이병 ~ 3 병장), face = 전역각 등장인물 얼굴
  var CREW = [
    { id: 'hoobae', cap: 30, name: '후임', tag: '이병', rank: 0, cost: 250, grow: 1.6, dia: 0, max: 4, r: 10, p: 1, hit: 0.24, speed: 46, hat: 'helmet', coat: '#5b6a3a', face: 'hoobae',
      desc: '초코파이 하나면 영혼까지 갈아 넣는다.', lines: ['넵!', '알겠습니다!', '이거 언제 끝납니까…', '손이 안 느껴집니다…', '초코파이 감사합니다!'] },
    { id: 'donggi', cap: 48, name: '동기', tag: '일병', rank: 1, cost: 3500, grow: 1.65, dia: 0, max: 3, r: 15, p: 1, hit: 0.2, speed: 56, hat: 'beanie', coat: '#566436', face: 'dumb',
      desc: '같이 고생하는 사이. 투덜대지만 손은 빠르다.', lines: ['야 이거 끝나긴 하냐', 'PX 가고 싶다', '눈 그만 와라 제발', '너 때문에 나도 나왔잖아'] },
    { id: 'cook', cap: 60, name: '취사병', tag: '일병', rank: 1, cost: 15000, grow: 1.7, dia: 1, max: 2, r: 14, p: 2, hit: 0.26, speed: 50, hat: 'chef', coat: '#e9e6dc', face: 'cook',
      desc: '아침 배식 끝나고 바로 끌려왔다. 국자 대신 삽.', lines: ['점심 준비해야 하는데…', '국자가 그립다', '오늘 점심 짜장이다'] },
    { id: 'malnyeon', cap: 100, name: '말년 병장', tag: '병장', rank: 2, cost: 60000, grow: 1.75, dia: 1, max: 2, r: 24, p: 2, hit: 0.2, speed: 40, sleep: 0.4, hat: 'beanie', coat: '#4f5c31', face: 'malnyeon',
      desc: '작업 시간의 40%는 잔다. 깨어 있으면 제일 잘 민다.', lines: ['나 전역 며칠 남았지?', '후임아 여기도', '라떼는 눈이 허리까지 왔어'] },
    { id: 'admin', cap: 70, name: '행정병', tag: '상병', rank: 2, cost: 160000, grow: 1.75, dia: 2, max: 2, r: 18, p: 2, hit: 0.17, speed: 64, hat: 'cap', coat: '#5d6b3b', face: 'clerk',
      desc: '키보드만 치던 손이 넉가래를 잡았다. 의외로 빠르다.', lines: ['엑셀로 치우면 안 되나', '결재 올려야 하는데', '이것도 보고서 써야 합니까?'] },
    { id: 'reserve', cap: 90, name: '예비군 아저씨', tag: '예비군', rank: 3, cost: 500000, grow: 1.8, dia: 2, max: 2, r: 20, p: 2, hit: 0.28, speed: 36, hat: 'reserve', coat: '#6b6f4a', face: 'reserve',
      desc: '동원훈련 왔다가 끌려왔다. 느리지만 요령이 있다.', lines: ['내가 이걸 또 하네', '요즘 애들은 말이야~', '집에 가고 싶다', '우리 땐 삽 하나로 다 했어'] },
    { id: 'plow', cap: 700, name: '제설차', tag: '운전병', rank: 3, cost: 2500000, grow: 2, dia: 5, max: 1, r: 36, p: 3, hit: 0.15, speed: 72, vehicle: true, coat: '#e0a526', face: 'driver',
      desc: '운전병과 함께 지원 나온 제설차. 빵빵거리며 다 민다.', lines: ['빵빵!', '비켜, 비켜!', '후진합니다~ 후진합니다~'] }
  ];

  // 보급 (레벨 업그레이드)
  var PERKS = [
    { id: 'eisen', name: '아이젠', max: 5, cost: 300, grow: 2.3, desc: '군화에 아이젠. 걷는 속도 +12%' },
    { id: 'back', name: '튼튼한 등짝', max: 5, cost: 400, grow: 2.4, desc: '한 번에 지는 눈 +30% (인력 +20%)' },
    { id: 'matsta', name: '맛스타', max: 5, cost: 900, grow: 2.6, desc: '당 충전. 내 손이 10% 더 빠르다' },
    { id: 'praise', name: '행보관 칭찬', max: 10, cost: 2000, grow: 2.5, desc: '초코파이 보상 +15%' },
    { id: 'gong', name: '꽹과리', max: 3, cost: 2500, grow: 3, desc: '고라니가 덜 온다 (하루 고라니 -25%)' },
    { id: 'medic', name: '의무병 대기', max: 5, cost: 4000, grow: 2.6, desc: '다친 인력이 15% 빨리 일어난다' },
    { id: 'song', name: '군가 스피커', max: 5, cost: 6000, grow: 2.7, desc: '인력 전원 이동 +12%, 손 +6%' },
    { id: 'gear', name: '인력 장비 보급', max: 5, cost: 15000, grow: 2.9, desc: '인력 전원의 미는 범위 +15%' }
  ];

  // 공장: 집하장에 부은 눈을 가공해서 값을 올린다
  var PROC = [
    { id: 'press', name: '눈 압축기', max: 5, cost: 1500, grow: 2.6, add: 0.3, desc: '부은 눈을 눈벽돌로 꾹. 보상 +30%' },
    { id: 'sculpt', name: '눈조각 작업장', max: 5, cost: 25000, grow: 2.8, add: 0.6, need: ['press', 3], desc: '사단장님 환영 눈사람을 만든다. 보상 +60%' }
  ];

  // 눈 집하장 (처음부터 있다). 구역마다 '양동이 릴레이'를 사면 그 자리도 집하장이 된다
  var DUMP = { x: 135, y: 285, r: 26 };

  // 얼굴 (전역각 등장인물을 그대로 쓰거나 비슷하게)
  var FACES = {
    me: { seed: 'me-snow', eyes: 'derp', brows: 'worried', mouth: 'wavy', hat: 'beanie', extras: ['snot', 'blush'], head: 'round' },
    reserve: { seed: 'reserve', eyes: 'smug', brows: 'thick', mouth: 'smirk', hat: 'cap', extras: ['stubble', 'mustache'], head: 'wide' }
  };

  var RANKS = [
    { name: '이병', life: 0 },
    { name: '일병', life: 2000 },
    { name: '상병', life: 25000 },
    { name: '병장', life: 150000 }
  ];
  var DISCHARGE_LIFE = 1500000; // 전역 신고 가능
  // 계급별 인력 정원 (이병 1명 → 병장 16명). 인력은 '전입 요청' → 다음 날 아침 생활관 앞 신병 → 인솔해서 구역에 배치
  var CREW_CAP = [1, 3, 7, 16];

  // 날씨. depth = 밤사이 쌓인 깊이 범위, fall = 낮에 내리는 양, mult = 보상 배수
  var WEATHER = {
    light: { name: '잔설', depth: [1, 2], fall: 0.45, dump: 0, night: 0.2, night2: 0, flakes: 25 },
    normal: { name: '눈', depth: [1, 3], fall: 1, dump: 0, night: 0.35, night2: 0.04, flakes: 70 },
    heavy: { name: '함박눈', depth: [2, 4], fall: 1.7, dump: 0.2, night: 0.5, night2: 0.15, flakes: 150 },
    blizzard: { name: '폭설 경보', depth: [3, 4], fall: 2.4, dump: 0.35, night: 0.65, night2: 0.3, flakes: 260 }
  };

  // 방해꾼과 사건
  var HAZ = {
    deer: { from: 2, speed: 96, life: [9, 13], hitR: 11, injure: 7, stun: 1.6, kick: 0.35 },
    snowball: { from: 3, p: 0.6, stun: 0.5 },
    car: { zone: 'E', trips: [1, 2], speed: 70, r: 12, slush: 0.55 },
    roof: { every: 45, stun: 1.2, injure: 3 },
    heli: { zone: 'H', p: 0.45, r: 60, life: 7 },
    cats: { zone: 'D', n: 2 }
  };

  var LINES = {
    start: ['자, 제설 작전 개시!', '눈은 하늘에서 내리는 쓰레기다. 치워!', '점호 전까지 싹 다 치운다.', '제설도 전투다. 전투!', '오늘도 하늘이 우리를 시험한다.'],
    heavy: ['함박눈이다… 오늘 다 죽었다.', '하늘이 우리 중대를 미워한다.', '폭설이다. 정신 차려!'],
    idle: ['어이, 거기 서서 뭐 하나?', '쉬는 거 아니지?', '넉가래가 혼자 움직이나?'],
    half: ['반 했다. 이제 시작이다.', '오, 좀 하는데?'],
    near: ['거의 다 왔다! 마무리 깔끔하게!', '조금만 더! 점호 전에 끝낸다!'],
    regrow: ['치운 데 또 쌓였다! 다시!', '하늘을 탓하지 마라. 삽을 들어라.'],
    sleep: ['병장! 자냐?!', '말년이라고 봐줄 줄 알았나!'],
    full: ['가득 찼다! 집하장 가서 부어!', '더 못 담는다. 비우고 와!'],
    spill: ['짊어진 눈 다 쏟았잖아!', '고라니 때문에 처음부터다!'],
    inspect: ['검열 통과! 이 구역은 합격이다.', '깨끗하군. 계속 이렇게 유지해.'],
    dayEnd: ['오늘 수고했다. 내일도 눈 온다.', '하루 끝! …근데 눈은 계속 온다.'],
    relay: ['양동이 릴레이 개시! 줄 서라!', '인간 컨베이어 가동!'],
    proc: ['기계 들어왔다. 눈도 이제 돈이다.', '사단장님 오시면 눈사람 보여 드린다.'],
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
    perfect: ['완벽하다! 이게 군대 제설이다!', '한 톨도 없군. 칭찬한다.', '이 정도면 사단장님도 울고 가신다.'],
    zonePerfect: ['구역 완벽 제설! 오늘 너 포상이다!', '반짝반짝하군. 다이아 줘라!'],
    allClear: ['전 구역 완벽! 오늘은 조기 퇴근이다!!', '부대 전체가 반짝인다. 일찍 쉬어라!'],
    slack: ['농땡이냐?! 일어나!', '거기 짱박힌 놈 누구야!'],
    locked: ['거긴 출입 통제 구역이다! 확장부터 해!'],
    tool: ['장비가 좋아졌으니 핑계는 없다.', '이제 좀 군대 같군.'],
    zone: ['구역 확장! 치울 곳이 늘었다. 기쁘지?', '여기도 이제 우리 중대 담당이다.']
  };

  // 눈 밑에 묻힌 분실물 (매일 새로 묻힌다). r: c 흔함, u 드묾, r 희귀, l 전설
  var TREASURE = [
    { id: 'tag', name: '누군가의 군번줄', r: 'c', pie: 20, line: '이거 누구 거야… 주인 찾아 줘야겠다' },
    { id: 'coupon', name: 'PX 상품권', r: 'c', pie: 40, line: 'PX 상품권 5천 원! (유효기간 지남)' },
    { id: 'boot', name: '선임 전투화 한 짝', r: 'c', pie: 15, line: '왜 한 짝만 여기에…' },
    { id: 'letter', name: '부치지 못한 편지', r: 'u', pie: 60, line: '"엄마 보고 싶어요" …눈물 난다' },
    { id: 'toy', name: '짬타이거 장난감', r: 'u', pie: 50, line: '짬타이거가 좋아하겠다' },
    { id: 'shell', name: '잃어버린 탄피', r: 'r', pie: 100, dia: 1, line: '탄피 찾았다!!! 전 부대 수색 종료!!!' },
    { id: 'rankdia', name: '소위 계급장 (다이아)', r: 'r', pie: 0, dia: 2, line: '소대장님이 잃어버린 다이아다!' },
    { id: 'watch', name: '사단장님 손목시계', r: 'l', pie: 300, dia: 5, line: '…이건 큰일이다. 아니 큰 상이다!' }
  ];
  var RARITY = { c: { name: '흔함', w: 55, color: '#c9d6e6' }, u: { name: '드묾', w: 28, color: '#7cd38a' }, r: { name: '희귀', w: 14, color: '#6fb7ff' }, l: { name: '전설', w: 3, color: '#ffbf3a' } };

  // 훈장 (업적): 달면 다이아와 보급 상자
  var ACH = [
    { id: 'salute10', name: '경례 머신', desc: '경례 10번', stat: 'salute', goal: 10, dia: 2 },
    { id: 'kal5', name: '칼경례', desc: '간부에게 1초 안에 경례 5번', stat: 'kal', goal: 5, dia: 3 },
    { id: 'perfect10', name: '완벽주의자', desc: '조각 100% 완벽 제설 10번', stat: 'perfect', goal: 10, dia: 3, box: 'rare' },
    { id: 'perfect50', name: '한 땀 한 땀', desc: '조각 100% 완벽 제설 50번', stat: 'perfect', goal: 50, dia: 6, box: 'legend' },
    { id: 'zone5', name: '구역 깔끔이', desc: '구역 하나를 통째로 100% 5번', stat: 'zonePerfect', goal: 5, dia: 4 },
    { id: 'early3', name: '조기 퇴근러', desc: '전 구역 완벽으로 조기 퇴근 3번', stat: 'allClear', goal: 3, dia: 5, box: 'rare' },
    { id: 'combo100', name: '콤보 100', desc: '쉬지 않고 100번 연속 제설', stat: 'bestCombo', goal: 100, dia: 3 },
    { id: 'combo300', name: '제설의 신', desc: '쉬지 않고 300번 연속 제설', stat: 'bestCombo', goal: 300, dia: 6, box: 'rare' },
    { id: 'found5', name: '보물 사냥꾼', desc: '눈 밑 분실물 5개', stat: 'found', goal: 5, dia: 2 },
    { id: 'foundAll', name: '분실물 도감 완성', desc: '분실물 8종 모두', stat: 'foundKinds', goal: 8, dia: 10, box: 'legend' },
    { id: 'shoo10', name: '고라니 사냥꾼', desc: '고라니 10마리 쫓아내기', stat: 'shoo', goal: 10, dia: 3 },
    { id: 'pet10', name: '짬타이거 집사', desc: '짬타이거 10번 쓰다듬기', stat: 'pet', goal: 10, dia: 2 },
    { id: 'snowman5', name: '눈사람 작가', desc: '눈사람 5개', stat: 'snowman', goal: 5, dia: 2 },
    { id: 'missions10', name: '행정반 에이스', desc: '임무 10개 완수', stat: 'missions', goal: 10, dia: 4, box: 'rare' },
    { id: 'report5', name: '보고의 달인', desc: '간부 보고 칭찬 5번', stat: 'goodReport', goal: 5, dia: 4 },
    { id: 'crew16', name: '인력 사무소', desc: '인력 정원 16명 꽉 채우기', stat: 'crew', goal: 16, dia: 4 },
    { id: 'favor10', name: '심부름 달인', desc: '부탁 10번 들어주기', stat: 'favor', goal: 10, dia: 3, box: 'rare' },
    { id: 'escort5', name: '신병 교육대', desc: '신병 5명 인솔해서 배치', stat: 'assign', goal: 5, dia: 2 },
    { id: 'hijack', name: '탈주범', desc: '중대장님 차 탈취', stat: 'hijack', goal: 1, dia: 1 },
    { id: 'caught3', name: '얼차려 장인', desc: '행보관한테 3번 잡히기', stat: 'caught', goal: 3, dia: 1 }
  ];

  // 다이아 쓰는 곳 (군대 간부 계급장 다이아)
  var DIA = {
    star: [3, 5, 8, 12, 18],     // 도구 강화 ★ (범위 +10%씩)
    support: 2,                  // 대대 지원 요청: 인력 전원 두 배 60초
    morale: 1                    // 전원 초코파이: 사기 100
  };

  // ── 스토리: 이정표마다 짧은 장면 (얼굴 + 대사). {name}=내 이름, {rank}=내 계급 ──
  // who: narr(내레이션) · me · haeng · malnyeon · lt · captain · hoobae · general · cook · driver
  var STORY = [
    { id: 'prologue', when: 'start', title: '전입 첫날', lines: [
      ['narr', '강원도 산골, ○○사단 제설중대. 밤새 눈이 허리까지 왔다.'],
      ['haeng', '어이, 신병. 거기 멍하니 서 있는 너.'],
      ['haeng', '이름이 뭐냐?', 'name'],
      ['haeng', '{name}이라… 좋아. 잘 들어라.'],
      ['haeng', '눈은 하늘에서 내리는 쓰레기다. 그리고 넌 오늘부터 환경미화원이다.'],
      ['me', '(…싸리비 하나로 이 부대를 다 치우라고?)'],
      ['haeng', '퍼 담고, 집하장에 붓고, 초코파이 받고. 그게 다다. 시작!']] },
    { id: 'firstDump', when: 'dump1', title: '첫 초코파이', lines: [
      ['haeng', '오, 집하장에 부을 줄은 아는구만. 옛다, 초코파이.'],
      ['me', '(초코파이가… 화폐라고?)'],
      ['haeng', '모으면 장비도 사고, 사람도 부린다. 그게 군대 경제다.']], reward: { dia: 1 } },
    { id: 'firstPerfect', when: 'perfect1', title: '한 톨도 없이', lines: [
      ['haeng', '…이 자리, 네가 치웠냐?'],
      ['me', '넵! 이병 {name}! 제가 치웠습니다!'],
      ['haeng', '눈 한 톨이 없군. 이런 놈은 처음 보는데.'],
      ['narr', '행보관의 입꼬리가 아주, 아주 조금 올라갔다.']], reward: { dia: 2 } },
    { id: 'malnyeon', when: 'zone:B', title: '족구장의 주인', lines: [
      ['malnyeon', '야, 신병. 족구장 눈은 아무나 치우는 게 아니다.'],
      ['me', '넵! 그럼 누가 치웁니까?'],
      ['malnyeon', '…너. 나는 전역이 41일 남았거든.'],
      ['narr', '김말년 병장. 이 부대의 전설이자, 최강의 농땡이.']], reward: { dia: 2 } },
    { id: 'lt', when: 'rank:1', title: '소대장이 왔다', lines: [
      ['lt', '안녕! 새로 온 소대장 이신입이다!'],
      ['lt', '제설… 이거 어떻게 하는 거지? 넉가래는 앞으로 미는 거야?'],
      ['me', '(…큰일이다)'],
      ['haeng', '소대장님, 그냥 {name} 따라다니시면 됩니다.']], reward: { dia: 2 } },
    { id: 'parade', when: 'zone:C', title: '연병장의 비밀', lines: [
      ['captain', '연병장 눈 밑에 뭐가 있는지 아나?'],
      ['me', '…아스팔트 아닙니까?'],
      ['captain', '"충성". 선배들이 새긴 두 글자다. 오늘 꼭 다시 보고 싶군.']], reward: { box: 'rare' } },
    { id: 'hoobae', when: 'crew1', title: '첫 후임', lines: [
      ['hoobae', '이병 오순둥! 잘 부탁드립니다!'],
      ['me', '(나에게도… 후임이…)'],
      ['malnyeon', '축하한다. 이제 네가 갈구는 쪽이다. 초코파이는 꼭 챙겨 줘라.']], reward: { dia: 1 } },
    { id: 'general', when: 'inspect', title: '사단장님이 오신다', lines: [
      ['haeng', '비상! 비상! 오늘 사단장님 순시다!'],
      ['captain', '전원 제설! 사단장님 눈에 눈 한 톨이라도 보이면…'],
      ['me', '(…눈에 눈?)'],
      ['haeng', '웃냐? 경례 연습이나 해 둬라. 1초 안에!']] },
    { id: 'sangbyeong', when: 'rank:2', title: '상병 {name}', lines: [
      ['cook', '상병 축하한다! 오늘 짬밥은 특식이다.'],
      ['me', '진짜입니까?!'],
      ['cook', '…짜장이다. 어제도 짜장이었지만.']], reward: { unlock: 'hat:headband' } },
    { id: 'farewell', when: 'rank:3', title: '말년의 넉가래', lines: [
      ['malnyeon', '나 내일 전역한다.'],
      ['me', '…병장님.'],
      ['malnyeon', '이거 받아라. 내 넉가래다. 손잡이에 내 이름 새겨 놨다.'],
      ['malnyeon', '눈은 쓰레기라지만… 같이 치운 건 꽤 괜찮았다.'],
      ['narr', '말년의 넉가래를 받았다. (보급·인력 → 꾸미기)']], reward: { unlock: 'tool:malnyeon' } },
    { id: 'discharge', when: 'canDischarge', title: '전역 신고', lines: [
      ['captain', '{rank} {name}. 그동안 수고 많았다.'],
      ['haeng', '…눈은 쓰레기다. 근데 네가 치운 눈은 좀 아깝구만.'],
      ['general', '이 부대 제설은 전군 최고다. 자네 덕이야.'],
      ['me', '충성!!!'],
      ['narr', '전역 신고를 할 수 있다. (보급·인력 → 전역) 베레모를 받았다.']], reward: { unlock: 'hat:beret' } }
  ];

  // ── 꾸미기: [값, 이름, 다이아 값(없으면 공짜), 잠금 키(스토리로 열림)] ──
  var LOOK = {
    eyes: [['derp', '멍'], ['happy', '방긋'], ['sleepy', '졸림'], ['smug', '건방'], ['dot', '점눈'], ['wide', '왕눈'], ['worried', '울상'], ['sparkle', '반짝', 3], ['sunglasses', '선글라스', 5]],
    mouth: [['wavy', '삐뚤'], ['grin', '씨익'], ['smirk', '피식'], ['open', '헤벌레'], ['cat', '고양이'], ['o', '오!'], ['teeth', '이 빠짐', 2]],
    brows: [['worried', '걱정'], ['thick', '송충이'], ['up', '올라감'], ['angry', '화남'], ['none', '없음']],
    head: [['round', '동글'], ['egg', '달걀'], ['square', '각'], ['wide', '넙대대'], ['potato', '감자']],
    skin: [['#ffd9b5', '하얀'], ['#f6c79c', '보통'], ['#eab386', '구릿빛'], ['#d9a06b', '까무잡잡'], ['#9a6440', '진한']],
    extras: [['snot', '콧물'], ['blush', '홍조'], ['stubble', '수염 자국'], ['glasses', '안경'], ['bandage', '반창고'], ['sweat', '땀'], ['mustache', '콧수염', 3]],
    hat: [['beanie', '방한모'], ['helmet', '철모'], ['cap', '전투모'], ['none', '맨머리'], ['headband', '머리띠', 4, 'hat:headband'], ['cateears', '고양이 귀', 6], ['beret', '베레모', 0, 'hat:beret'], ['crown', '왕관', 15]],
    coat: [['olive', '디지털 군복', 0, '', '#5b6a3a'], ['pink', '핑크 군복', 8, '', '#e57aa3'], ['gold', '황금 군복', 15, '', '#d4a73a']],
    glove: [['olive', '군용 장갑', 0, '', '#2b3020'], ['black', '검정 장갑', 0, '', '#151515'], ['red', '빨간 장갑', 1, '', '#c8402e'], ['pink', '핑크 장갑', 2, '', '#f08cb4'], ['white', '하얀 장갑', 2, '', '#f2f2f2']],
    tool: [['yellow', '노랑', 0, '', '#e7ae2f'], ['red', '빨강', 1, '', '#d23a2a'], ['blue', '파랑', 1, '', '#2b6fd1'], ['pink', '핑크', 2, '', '#f08cb4'], ['gold', '황금', 10, '', '#f5c542'], ['malnyeon', '말년의 넉가래', 0, 'tool:malnyeon', '#8a6a44']]
  };
  var LOOK_NAMES = { eyes: '눈', mouth: '입', brows: '눈썹', head: '얼굴형', skin: '피부', extras: '얼굴 소품', hat: '모자', coat: '군복', glove: '장갑', tool: '넉가래 색' };

  // ── 할 일: 처음 30분을 이끄는 안내. 하나씩 하면 바로 보상 ──
  // stat: 저장의 기록 / life / tool / rank / zone / crew / pend / load
  var QUESTS = [
    { id: 'scoop', text: '눈 퍼 담기', how: '걸으면 빗자루가 알아서 퍼 담는다', stat: 'load', goal: 20, pie: 20 },
    { id: 'dump', text: '집하장에 붓기', how: '노란 동그라미(눈 집하장)로 가져가라', stat: 'dumps', goal: 1, pie: 40 },
    { id: 'pusher', text: '넉가래 사기', how: '오른쪽 아래 보급·인력 → 도구', stat: 'tool', goal: 1, dia: 1 },
    { id: 'salute', text: '행보관에게 경례', how: '행보관 앞에서 노란 버튼', stat: 'salute', goal: 1, pie: 50 },
    { id: 'perfect', text: '조각 하나 완벽!', how: '위 막대가 금색이면 남은 칸이 반짝인다', stat: 'perfect', goal: 1, dia: 2 },
    { id: 'zoneB', text: '족구장 열기', how: '보급·인력 → 구역', stat: 'zone', key: 'B', goal: 1, pie: 80 },
    { id: 'call', text: '공중전화로 집에 전화', how: '생활관 오른쪽 끝 빨간 전화 부스', stat: 'call', goal: 1, dia: 1 },
    { id: 'hire', text: '후임 전입 요청', how: '보급·인력 → 인력', stat: 'pend', goal: 1, pie: 80 },
    { id: 'assign', text: '신병 인솔해서 배치', how: '다음 날 아침 생활관 앞 신병', stat: 'crew', goal: 1, dia: 2 },
    { id: 'pull', text: '철봉 턱걸이 10개', how: '집하장 옆 철봉 — 버튼 연타!', stat: 'pullBest', goal: 10, pie: 150 },
    { id: 'mission', text: '행정반 임무 완수', how: '행정반 문 앞에서 임무 받기', stat: 'missions', goal: 1, pie: 200 },
    { id: 'vend', text: '자판기 뽑기', how: 'PX 옆 자판기', stat: 'vend', goal: 1, pie: 60 },
    { id: 'goal', text: '족구공 넘기기', how: '족구장 공을 네트 너머로 차라', stat: 'goal', goal: 1, dia: 1 },
    { id: 'rank1', text: '일병 진급', how: '초코파이를 모으면 진급한다', stat: 'rank', goal: 1, dia: 3 }
  ];
  // 새 소품 (지나갈 수 있다, 앞에 서면 상호작용)
  var PROPS = [
    { id: 'phone', name: '공중전화', x: 474, y: 104, ux: 474, uy: 120 },
    { id: 'bar', name: '철봉', x: 56, y: 272, ux: 70, uy: 280 },
    { id: 'vend', name: '자판기', x: 650, y: 96, ux: 650, uy: 118 },
    { id: 'stove', name: '드럼통 난로', x: 92, y: 296, ux: 104, uy: 290 }
  ];
  // 공중전화: 누가 받느냐 (who는 전역각 얼굴)
  var CALLS = [
    { who: 'mom', lines: ['아이고 우리 아들! 밥은 잘 먹고 다니니?', '눈 치운다고? 장갑 꼭 끼고! 엄마가 택배 보냈다.'], reward: { pie: 60, mor: 30 } },
    { who: 'gf', lines: ['오빠! 보고 싶었어…', '휴가 언제 나와? 나 기다리고 있을게. 화이팅!'], reward: { buff: 'love', sec: 90 } },
    { who: 'malnyeon', lines: ['(통화 연결음)', '…여보세요? 나 전역한 김말년인데. 거기 아직도 눈 와? 크크크크'], reward: { pie: 20 } },
    { who: 'mom', lines: ['할머니가 너 주라고 용돈 보내셨다.', '초코파이 사 먹어라, 응?'], reward: { pie: 120 } },
    { who: 'gf', lines: ['…', '(통화 중 신호만 간다)'], reward: {} }
  ];
  var VEND = [
    { id: 'matsta', name: '맛스타', w: 30, buff: 'matsta', sec: 45 },
    { id: 'hot6', name: '핫식스', w: 25, buff: 'hotbar', sec: 45 },
    { id: 'coffee', name: '따뜻한 캔커피', w: 20, buff: 'hotpack', sec: 90 },
    { id: 'none', name: '꽝 — 동전만 먹었다', w: 20 },
    { id: 'dia', name: '자판기 밑에서 다이아 발견!', w: 5, dia: 1 }
  ];

  JY.SNOW = {
    CELL: CELL, W: W, H: H, GW: W / CELL, GH: H / CELL,
    ZONES: ZONES, BUILDINGS: BUILDINGS, TANKS: TANKS, TREES: TREES, DECOR: DECOR, TOOLS: TOOLS, CREW: CREW, PERKS: PERKS, FACES: FACES,
    RANKS: RANKS, DISCHARGE_LIFE: DISCHARGE_LIFE, CREW_CAP: CREW_CAP, STORY: STORY, LOOK: LOOK, LOOK_NAMES: LOOK_NAMES, QUESTS: QUESTS, PROPS: PROPS, CALLS: CALLS, VEND: VEND, WEATHER: WEATHER, HAZ: HAZ, LINES: LINES, PROC: PROC, DUMP: DUMP, TREASURE: TREASURE, RARITY: RARITY, ACH: ACH, DIA: DIA,
    SPAWN: { x: 200, y: 180 }, DOOR: { x: 260, y: 114 },
    DAY_LEN: 180, FALL: 0.003, HIT: 0.1, SPEED: 90, PART_DONE: 1, PART_RESET: 0.7, INSPECT: 0.95, ALMOST: 0.85
  };
})(window.JY = window.JY || {});
