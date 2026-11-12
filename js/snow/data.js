/* 제설각 — 데이터: 지도(8구역), 건물·소품, 도구, 인력, 보급, 계급, 날씨, 방해꾼, 대사 */
(function (JY) {
  'use strict';

  var CELL = 10, W = 800, H = 1200;

  // 제설 구역. value = 눈 한 칸(깊이 1)당 초코파이. parts = 다 치우면 "띵!" 하는 작은 구역 (6번째 칸 true = 빙판 구간: 다 치우면 얼어서 염화칼슘을 뿌려야 한다)
  // reveal = 구역을 맡을 때 드러나는 군대 요소, holes = 구역 안의 못 치우는 자리(전차 등)
  // v10: 구역은 사는 게 아니라 '맡는' 것. need = 근무평정(★)이 이만큼 쌓이면 중대에서 이 구역도 맡긴다
  //      due = 마감 시각(분, 05:30 = 330). why = 왜 그때까지인지 (작업 지시서에 그대로 나온다)
  var ZONES = [
    { id: 'A', name: '생활관 앞 길', x: 80, y: 130, w: 380, h: 120, value: 1, cost: 0, need: 0, due: 420, why: '아침 식사 이동로', ground: 'walk',
      parts: [['생활관 앞 왼쪽', 0, 0, 0.5, 1], ['생활관 앞 오른쪽', 0.5, 0, 1, 1, true]],
      reveal: '이병의 첫 전장. 생활관 창문으로 선임들이 구경한다.' },
    { id: 'B', name: '족구장', x: 480, y: 130, w: 300, h: 150, value: 1, cost: 300, need: 3, due: 480, why: '오후 체육 시간', relay: [630, 300], ground: 'court',
      parts: [['족구장 왼쪽 코트', 0, 0, 0.5, 1], ['족구장 오른쪽 코트', 0.5, 0, 1, 1]],
      reveal: '눈 치우자마자 족구가 시작된다. 지는 쪽이 내일 제설이다.' },
    { id: 'C', name: '연병장', x: 40, y: 320, w: 460, h: 280, value: 2, cost: 1200, need: 7, due: 480, why: '일과 시작 집합', relay: [200, 618], ground: 'parade',
      parts: [['1소대 자리', 0, 0, 0.5, 0.5], ['2소대 자리', 0.5, 0, 1, 0.5], ['3소대 자리', 0, 0.5, 0.5, 1], ['4소대 자리', 0.5, 0.5, 1, 1]],
      reveal: '구령대 앞 바닥에 "충성". 사열 때 얼어 죽을 뻔한 그곳.' },
    { id: 'D', name: '취사장 앞', x: 540, y: 320, w: 230, h: 240, value: 3, cost: 7000, need: 12, due: 420, why: '아침 배식', relay: [520, 440], ground: 'yard',
      parts: [['배식구 가는 길', 0, 0, 1, 0.5, true], ['짬통 가는 길', 0, 0.5, 1, 1]],
      reveal: '배식구 앞은 설거지 물이 흘러서 꼭 언다. 짬통 옆엔 짬타이거가 산다.' },
    { id: 'E', name: '부대 진입로', x: 340, y: 620, w: 120, h: 450, value: 4, cost: 22000, need: 18, due: 450, why: '간부 출근 차량', relay: [482, 780], ground: 'road',
      parts: [['진입로 위쪽', 0, 0, 1, 0.34], ['진입로 가운데', 0, 0.34, 1, 0.67], ['진입로 아래쪽', 0, 0.67, 1, 1, true]],
      reveal: '07:30에 중대장님 차가 올라온다. 못 치워 두면 차가 빠진다. 아래쪽은 비탈이라 얼기 쉽다.' },
    { id: 'F', name: '전차 주차장', x: 40, y: 640, w: 270, h: 280, value: 6, cost: 65000, need: 26, due: 480, why: '전투 장비 점검', relay: [325, 760], ground: 'tank',
      parts: [['1호 전차 주변', 0, 0, 1, 0.5], ['2호 전차 주변', 0, 0.5, 1, 1]],
      holes: [[80, 690, 70, 50], [200, 800, 70, 50]],
      reveal: 'K-전차 두 대가 눈을 맞고 있다. 장비 점검 전에 주변을 비워야 한다.' },
    { id: 'G', name: '위병소 앞', x: 120, y: 1090, w: 500, h: 90, value: 8, cost: 180000, need: 36, due: 450, why: '출근 차량 통과', relay: [100, 1135], ground: 'gate',
      parts: [['위병소 왼쪽', 0, 0, 0.5, 1, true], ['위병소 오른쪽', 0.5, 0, 1, 1]],
      reveal: '부대의 얼굴. 사단장님 차가 여기로 들어온다. 한 톨도 남기면 안 된다.' },
    { id: 'H', name: '헬기장', x: 500, y: 720, w: 270, h: 280, value: 12, cost: 450000, need: 50, due: 480, why: '응급 후송 대비', relay: [635, 1030], ground: 'pad',
      parts: [['헬기장 북쪽', 0, 0, 1, 0.5], ['헬기장 남쪽', 0, 0.5, 1, 1]],
      reveal: '응급 환자가 생기면 의무후송 헬기가 내린다. 언제든 내릴 수 있게 비워 둔다.' }
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
  // v10: 장비는 행보관이 '보급'해 준다. rank = 그 계급부터 받을 수 있다 (짬이 차야 좋은 장비를 맡긴다)
  var TOOLS = [
    { id: 'broom', name: '싸리비', r: 11, p: 1, cost: 0, cap: 60, rank: 0, desc: '훈련소에서 받은 그 빗자루. 한 번에 한 뼘.' },
    { id: 'pusher', name: '넉가래', r: 15, p: 1, cost: 150, cap: 110, rank: 0, desc: '군대 제설의 상징. 밀면 밀린다.' },
    { id: 'pusher2', name: '대형 넉가래', r: 20, p: 1, cost: 800, cap: 200, rank: 0, desc: '창고 구석에 있던 알루미늄 왕넉가래.' },
    { id: 'twin', name: '2인용 넉가래', r: 25, p: 2, cost: 6000, cap: 380, rank: 1, desc: '손잡이가 두 개. 후임이랑 같이 밀면 반은 내 힘.' },
    { id: 'cart', name: '보행식 제설기', r: 32, p: 2, cost: 50000, cap: 700, rank: 2, desc: '부르릉. 밀고 가면 눈을 퍼 올린다. 장비 교육 이수자만.' },
    { id: 'salt', name: '염화칼슘 살포기', r: 40, p: 2, cost: 150000, cap: 1200, rank: 2, aura: true, desc: '밀고 다니면 주변이 녹는다. 빙판도 안 생긴다. 군화는 녹슨다.' },
    { id: 'tractor', name: '트랙터 제설기', r: 52, p: 3, cost: 500000, cap: 3000, rank: 3, vehicle: true, desc: '부대 트랙터에 삽날을 달았다. 병장쯤 돼야 키를 준다.' },
    { id: 'truck', name: '군용 제설차', r: 70, p: 3, cost: 1500000, cap: 8000, rank: 3, vehicle: true, desc: '사단에 딱 한 대 있다는 그 차. 수송부에서 지원 나왔다.' }
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

  // 개인·분대 장비 (레벨 업그레이드)
  var PERKS = [
    { id: 'eisen', name: '아이젠', max: 5, cost: 300, grow: 2.3, desc: '군화에 아이젠. 걷는 속도 +12%, 빙판에서 덜 미끄러진다' },
    { id: 'back', name: '큰 마대 자루', max: 5, cost: 400, grow: 2.4, desc: '한 번에 나르는 눈 +30% (분대원 +20%)' },
    { id: 'matsta', name: '사제 방한 장갑', max: 5, cost: 900, grow: 2.6, desc: '손이 덜 얼어서 10% 더 빨리 퍼 담는다' },
    { id: 'praise', name: '제설 요령', max: 10, cost: 2000, grow: 2.5, desc: '선임한테 배운 요령. 같은 눈도 깔끔하게 (초코파이 +15%)' },
    { id: 'gong', name: '고라니 깡통 줄', max: 3, cost: 2500, grow: 3, desc: '철책에 깡통을 단다. 고라니가 덜 들어온다 (-25%)' },
    { id: 'medic', name: '의무병 대기', max: 5, cost: 4000, grow: 2.6, desc: '넘어진 분대원이 15% 빨리 일어난다' },
    { id: 'song', name: '군가 스피커', max: 5, cost: 6000, grow: 2.7, desc: '군가 틀고 작업. 분대원 이동 +12%, 손 +6%' },
    { id: 'gear', name: '분대 장비 보급', max: 5, cost: 15000, grow: 2.9, desc: '분대원 전원의 넉가래가 넓어진다 (+15%)' }
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

  // v10: 계급은 초코파이가 아니라 근무평정(작전마다 받은 ★)으로 오른다. 기준을 넘으면 다음 작전이 '진급 심사'
  // role = 이 계급에서 내가 하는 일, easy = 편해지는 것, more = 새로 할 수 있는 것 (진급 화면에 그대로 나온다)
  var RANKS = [
    { name: '이병', merit: 0, role: '막내 — 시키는 구역을 직접 치운다',
      easy: [], more: ['싸리비·넉가래 보급', '간부 경례·관등성명'] },
    { name: '일병', merit: 6, role: '일꾼 — 맡은 구역을 알아서 끝낸다',
      easy: ['선임 눈덩이 장난이 줄어든다', '분대원 정원 1 → 3명'], more: ['2인용 넉가래', '동기·취사병 전입', '염화칼슘 살포'] },
    { name: '상병', merit: 20, role: '조장 — 작업 분담을 정하고 조원을 굴린다',
      easy: ['눈덩이 장난 끝', '작전 전에 조원 배치(걸어가서 안 데려와도 된다)', '분대원 정원 7명'], more: ['보행식 제설기·염화칼슘 살포기', '말년 병장·행정병 전입'] },
    { name: '병장', merit: 42, role: '분대장 — 지휘만 한다. 몸은 난로 옆에',
      easy: ['작업 2배속(말년 특권)', '분대원 정원 16명'], more: ['트랙터·군용 제설차', '예비군·제설차 지원', '전역 신고'] }
  ];
  var DISCHARGE_MERIT = 75; // 병장 + 근무평정 75 → 전역 신고 가능
  var DISCHARGE_LIFE = 1500000; // (예전 기준, 메달 계산에만 쓴다)
  // 계급별 분대원 정원 (이병 1명 → 병장 16명). 분대원은 '전입 요청' → 다음 작전 아침 생활관 앞 신병 → 인솔해서 구역에 배치
  var CREW_CAP = [1, 3, 7, 16];

  // ── v10: 제설 작전 (하루 = 작전 한 번) ──
  // 05:30 제설 비상 → 08:00 아침 식사. 시계 1분 = 실제 1.6초 (작전 4분)
  var OP = { start: 330, end: 480, goal: [0.85, 0.88, 0.9, 0.9], examGoal: 0.95, pay: 0.35, star: [0.5, 0.8, 0.97] };
  // 작전 끝 상점(merit 외 보상)과 포상휴가
  var LEAVE = { cost: 10 };   // 상점 10개 = 포상휴가 1일
  // PX: 저녁에 사 두면 다음 작전 시작부터 효과 (sec = 작전 시작 후 몇 초)
  var PREP = [
    { id: 'hotpack', name: '핫팩', base: 40, sec: 240, desc: '주머니에 넣고 출동. 작전 내내 덜 넘어진다' },
    { id: 'matsta', name: '맛스타 한 캔', base: 30, sec: 90, desc: '출동 전에 원샷. 처음 90초 이동 +25%' },
    { id: 'hotbar', name: '냉동 핫바', base: 50, sec: 90, desc: '전자레인지 30초. 처음 90초 손 +30%' },
    { id: 'choco', name: '초코파이 한 상자', base: 80, sec: 90, crew: true, desc: '분대원들한테 돌린다. 사기 +50, 처음 90초 분대원 +40%' },
    { id: 'ramen', name: '컵라면 한 박스', base: 120, crew: true, desc: '작전 끝나고 다 같이. 분대원 사기가 꽉 찬 채로 시작' }
  ];

  // 날씨. depth = 밤사이 쌓인 깊이 범위, fall = 낮에 내리는 양, mult = 보상 배수
  var WEATHER = {
    light: { name: '잔설', depth: [1, 2], fall: 0.45, dump: 0, night: 0.2, night2: 0, flakes: 25 },
    normal: { name: '눈', depth: [1, 3], fall: 1, dump: 0, night: 0.35, night2: 0.04, flakes: 70 },
    heavy: { name: '함박눈', depth: [2, 4], fall: 1.7, dump: 0.2, night: 0.5, night2: 0.15, flakes: 150 },
    blizzard: { name: '폭설 경보', depth: [3, 4], fall: 2.4, dump: 0.35, night: 0.65, night2: 0.3, flakes: 260 }
  };

  // 방해꾼과 사건 (v10: 현실에 있을 법한 것만)
  // deer: 산골 부대엔 진짜 고라니가 들어온다 / snowball: 선임들 장난 (이병·일병만 당한다)
  // car: 07:30 중대장님 출근 차량 — 진입로를 못 치웠으면 빠진다 / roof: 처마 눈 — 먼저 '우두둑' 소리가 난다
  var HAZ = {
    deer: { from: 3, max: 2, speed: 96, life: [9, 13], hitR: 11, injure: 3, stun: 1.0, kick: 0.2 },
    snowball: { from: 2, p: [0.6, 0.3, 0, 0], stun: 0.5 },
    car: { zone: 'E', at: 450, speed: 62, r: 12, slush: 0.3, stuckDepth: 2, push: 0.25, crewPush: 0.18 },
    roof: { every: 55, warn: 1.6, stun: 1.2, injure: 3 },
    heli: { zone: 'H', p: 0, r: 60, life: 7 },
    slip: { p: 0.5, cool: 5, stun: 0.7 },
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
    zone: ['구역 확장! 치울 곳이 늘었다. 기쁘지?', '여기도 이제 우리 중대 담당이다.'],
    // v10: 작전
    task: ['좋아, 거긴 됐다. 다음!', '그 구역 끝! 다음 거 가자.', '오케이. 지시서 한 줄 지운다.'],
    taskLate: ['늦었잖아! 벌써 시간 지났다!', '시간 넘겼다. 그래도 끝까지 해!'],
    ready: ['다 했으면 와서 보고해!', '작업 끝났나? 보고하러 와라.'],
    report: ['수고했다. 들어가서 밥 먹어라.', '보고 받았다. 오늘은 여기까지.'],
    carStuck: ['중대장님 차 빠졌다!! 다 와서 밀어!!', '아이고… 진입로 덜 치웠지?! 밀어!'],
    carFree: ['영차! 빠졌다! 휴…', '됐다! 중대장님 올라가신다!'],
    carPass: ['중대장님 차 지나가신다. 길 잘 뚫어 놨군.', '오, 차가 안 미끄러졌다. 잘했다.'],
    icy: ['거기 얼었다! 염화칼슘 뿌려!', '빙판 됐다. 제설함에서 염화칼슘 가져와!'],
    roofWarn: ['처마 밑에서 떨어져! 눈 떨어진다!', '우두둑… 지붕 소리 들리지? 피해!'],
    nag: ['야 막내, 거기 덜 됐잖아.', '이병이 제일 열심히 해야지?', '넉가래 각도가 그게 뭐냐.', '막내야, 손 놀지 마라.'],
    exam: ['오늘 진급 심사다. 행보관이 보고 있다.', '심사 날이다. 실수하면 한 달 더 그 계급이다.']
  };
  // 작전 시작 브리핑: 누가 지시하나 (계급마다 다르다 — 짬이 차면 내가 지시한다)
  var BRIEF = [
    { who: 'malnyeon', lines: ['야 막내. 넌 {zone}. 끝나면 보고하고.', '막내는 {zone}부터. 넉가래는 창고에 있다.'] },
    { who: 'haeng', lines: ['{name}, 오늘 {zone} 맡아. 시간 안에 끝내라.', '일병이면 이제 혼자 할 줄 알지? {zone}.'] },
    { who: 'haeng', lines: ['{name} 상병, 조원 데리고 {zone}. 배치는 네가 알아서.', '조장이 알아서 나눠. 07:30 전에 진입로는 무조건.'] },
    { who: 'captain', lines: ['분대장, 오늘 작전 지휘는 자네가 한다.', '{name} 병장, 오늘도 부탁한다. 다치는 사람 없게.'] }
  ];

  // 눈 밑에 묻힌 분실물 (매일 새로 묻힌다). r: c 흔함, u 드묾, r 희귀, l 전설
  var TREASURE = [
    { id: 'tag', name: '누군가의 군번줄', r: 'c', pie: 20, line: '이거 누구 거야… 주인 찾아 줘야겠다' },
    { id: 'coupon', name: 'PX 상품권', r: 'c', pie: 40, line: 'PX 상품권 5천 원! (유효기간 지남)' },
    { id: 'boot', name: '선임 전투화 한 짝', r: 'c', pie: 15, line: '왜 한 짝만 여기에…' },
    { id: 'letter', name: '부치지 못한 편지', r: 'u', pie: 60, line: '"엄마 보고 싶어요" …눈물 난다' },
    { id: 'toy', name: '짬타이거 장난감', r: 'u', pie: 50, line: '짬타이거가 좋아하겠다' },
    { id: 'shell', name: '잃어버린 탄피', r: 'r', pie: 100, dia: 1, line: '탄피 찾았다!!! 전 부대 수색 종료!!!' },
    { id: 'rankdia', name: '소대장님 계급장', r: 'r', pie: 0, dia: 2, line: '소대장님이 잃어버린 계급장이다! 상점 받았다' },
    { id: 'watch', name: '중대장님 차 키', r: 'l', pie: 300, dia: 5, line: '어제부터 찾던 그 차 키다!! 포상감이다' }
  ];
  var RARITY = { c: { name: '흔함', w: 55, color: '#c9d6e6' }, u: { name: '드묾', w: 28, color: '#7cd38a' }, r: { name: '희귀', w: 14, color: '#6fb7ff' }, l: { name: '전설', w: 3, color: '#ffbf3a' } };

  // 훈장 (업적): 달면 상점과 보급 상자
  var ACH = [
    { id: 'op1', name: '첫 출동', desc: '제설 작전 1번 마치기', stat: 'ops', goal: 1, dia: 1 },
    { id: 'op20', name: '제설 베테랑', desc: '제설 작전 20번', stat: 'ops', goal: 20, dia: 5, box: 'rare' },
    { id: 'star3', name: '특급 제설', desc: '작전 ★★★ 받기', stat: 'star3', goal: 1, dia: 2 },
    { id: 'star3x10', name: '특급 전사', desc: '작전 ★★★ 10번', stat: 'star3', goal: 10, dia: 6, box: 'legend' },
    { id: 'exam3', name: '진급 심사 프리패스', desc: '진급 심사 3번 합격', stat: 'exams', goal: 3, dia: 5, box: 'rare' },
    { id: 'salute10', name: '경례 머신', desc: '경례 10번', stat: 'salute', goal: 10, dia: 2 },
    { id: 'kal5', name: '칼경례', desc: '간부에게 1초 안에 경례 5번', stat: 'kal', goal: 5, dia: 3 },
    { id: 'report5', name: '보고의 달인', desc: '간부 보고 칭찬 5번', stat: 'goodReport', goal: 5, dia: 4 },
    { id: 'opReport5', name: '빠른 보고', desc: '시간 안에 작업 완료 보고 5번', stat: 'opReport', goal: 5, dia: 3 },
    { id: 'carPass5', name: '출근길 사수', desc: '중대장님 차가 한 번에 올라가기 5번', stat: 'carPass', goal: 5, dia: 4 },
    { id: 'carPush', name: '영차영차', desc: '빠진 차 밀어서 빼기', stat: 'carPush', goal: 1, dia: 1 },
    { id: 'salt10', name: '염화칼슘 장인', desc: '빙판에 염화칼슘 10번', stat: 'salt', goal: 10, dia: 3 },
    { id: 'perfect10', name: '완벽주의자', desc: '조각 100% 완벽 제설 10번', stat: 'perfect', goal: 10, dia: 3, box: 'rare' },
    { id: 'perfect50', name: '한 땀 한 땀', desc: '조각 100% 완벽 제설 50번', stat: 'perfect', goal: 50, dia: 6, box: 'legend' },
    { id: 'zone5', name: '구역 깔끔이', desc: '구역 하나를 통째로 100% 5번', stat: 'zonePerfect', goal: 5, dia: 4 },
    { id: 'early3', name: '눈 한 톨 없는 부대', desc: '맡은 구역 전부 100% 3번', stat: 'allClear', goal: 3, dia: 5, box: 'rare' },
    { id: 'combo100', name: '콤보 100', desc: '쉬지 않고 100번 연속 제설', stat: 'bestCombo', goal: 100, dia: 3 },
    { id: 'combo300', name: '제설의 신', desc: '쉬지 않고 300번 연속 제설', stat: 'bestCombo', goal: 300, dia: 6, box: 'rare' },
    { id: 'found5', name: '보물 사냥꾼', desc: '눈 밑 분실물 5개', stat: 'found', goal: 5, dia: 2 },
    { id: 'foundAll', name: '분실물 도감 완성', desc: '분실물 8종 모두', stat: 'foundKinds', goal: 8, dia: 10, box: 'legend' },
    { id: 'shoo10', name: '고라니 몰이꾼', desc: '고라니 10마리 쫓아내기', stat: 'shoo', goal: 10, dia: 3 },
    { id: 'pet10', name: '짬타이거 집사', desc: '짬타이거 10번 쓰다듬기', stat: 'pet', goal: 10, dia: 2 },
    { id: 'crew16', name: '분대 완편', desc: '분대원 정원 16명 꽉 채우기', stat: 'crew', goal: 16, dia: 4 },
    { id: 'escort5', name: '신병 인솔', desc: '신병 5명 인솔해서 배치', stat: 'assign', goal: 5, dia: 2 },
    { id: 'leave1', name: '포상휴가', desc: '상점 모아서 포상휴가 다녀오기', stat: 'leave', goal: 1, dia: 2 }
  ];

  // 상점 쓰는 곳 (v10: 다이아 → 상점. 잘하면 받는 점수. 모아서 포상휴가로 바꾸거나 특별 보급에 쓴다)
  var DIA = {
    star: [3, 5, 8, 12, 18],     // 장비 정비 ★ (범위 +10%씩)
    support: 2,                  // 대대 지원 요청: 다음 작전 처음 60초 분대원 두 배
    morale: 1                    // 전원 초코파이: 다음 작전 사기 100
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
      ['haeng', '눈 오는 날은 05:30 제설 비상이다. 08:00 아침 먹기 전까지 지시서대로 치운다.'],
      ['haeng', '퍼 담고, 집하장에 붓고, 다 하면 나한테 보고. 잘하면 근무평정 ★. ★이 쌓이면 진급이다. 시작!']] },
    { id: 'firstDump', when: 'dump1', title: '첫 초코파이', lines: [
      ['haeng', '오, 집하장에 부을 줄은 아는구만. 옛다, 초코파이.'],
      ['me', '(초코파이가… 화폐라고?)'],
      ['haeng', '모아 오면 내가 넉가래 내준다. 나중엔 사람도 붙여 주고. 그게 군대 보급이다.']], reward: { dia: 1 } },
    { id: 'firstOp', when: 'op1', title: '첫 작전 끝', lines: [
      ['haeng', '첫 작전 치고는 나쁘지 않군.'],
      ['haeng', '★이 쌓이면 진급 심사를 본다. 상점이 쌓이면 포상휴가고.'],
      ['me', '(휴가…! 휴가라고 했다!)'],
      ['malnyeon', '막내야, 짬이 차면 편해진다. 그때까지 버텨라.']], reward: { dia: 1 } },
    { id: 'exam1', when: 'exam', title: '진급 심사', lines: [
      ['haeng', '{name}. 오늘 작전은 진급 심사다.'],
      ['haeng', '지시서 기준이 평소보다 높다. ★★ 이상이면 합격.'],
      ['me', '(…떨린다)'],
      ['malnyeon', '떨지 마라. 하던 대로만 해.']] },
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
      ['narr', '전역 신고를 할 수 있다. (생활관 → 전역 신고) 베레모를 받았다.']], reward: { unlock: 'hat:beret' } }
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
  // v10: 작전 흐름을 그대로 따라가는 안내
  var QUESTS = [
    { id: 'scoop', text: '눈 퍼 담기', how: '걸으면 빗자루가 알아서 퍼 담는다', stat: 'load', goal: 20, pie: 20 },
    { id: 'dump', text: '집하장에 붓기', how: '노란 동그라미(눈 집하장)로 가져가라', stat: 'dumps', goal: 1, pie: 40 },
    { id: 'pusher', text: '행보관에게 넉가래 받기', how: '행보관 앞에서 위쪽 작은 버튼 "넉가래 요청"', stat: 'tool', goal: 1, dia: 1 },
    { id: 'task', text: '지시서 한 줄 끝내기', how: '작업 지시서의 구역을 기준(%)까지 치워라', stat: 'tasks', goal: 1, pie: 60 },
    { id: 'salute', text: '간부에게 경례', how: '간부가 오면 "경례!" 막대가 줄기 전에 노란 버튼', stat: 'salute', goal: 1, pie: 50 },
    { id: 'report', text: '작업 완료 보고', how: '지시서를 다 끝내면 행보관에게 가서 보고', stat: 'opReport', goal: 1, dia: 1 },
    { id: 'salt', text: '빙판에 염화칼슘', how: '얼음 구간이 생기면 제설함(초록 상자)에서 포대를 들고 가서 뿌려라', stat: 'salt', goal: 1, pie: 80 },
    { id: 'perfect', text: '조각 하나 완벽!', how: '위 막대가 금색이면 남은 칸이 반짝인다', stat: 'perfect', goal: 1, dia: 2 },
    { id: 'hire', text: '후임 전입 요청', how: '생활관 → 보급·인원 → 인원', stat: 'pend', goal: 1, pie: 80 },
    { id: 'assign', text: '신병 인솔해서 배치', how: '다음 작전 아침, 생활관 앞 신병에게 "인솔"', stat: 'crew', goal: 1, dia: 2 },
    { id: 'rank1', text: '일병 진급', how: '★ 6개를 모으면 다음 작전이 진급 심사', stat: 'rank', goal: 1, dia: 3 },
    { id: 'star3', text: '★★★ 받기', how: '마감 전에 다 끝내고, 경례 빠짐없이, 빙판 없이', stat: 'star3', goal: 1, dia: 2 }
  ];
  // 소품 (지나갈 수 있다). use: 작전 중 상호작용 (전화·철봉·자판기는 생활관 저녁 시간에)
  var PROPS = [
    { id: 'phone', name: '공중전화', x: 474, y: 104, ux: 474, uy: 120 },
    { id: 'bar', name: '철봉', x: 56, y: 272, ux: 70, uy: 280 },
    { id: 'vend', name: '자판기', x: 650, y: 96, ux: 650, uy: 118 },
    { id: 'stove', name: '드럼통 난로', x: 92, y: 296, ux: 104, uy: 290, use: true },
    { id: 'saltbox', name: '제설함', x: 174, y: 298, ux: 174, uy: 308, use: true },
    { id: 'saltbox', name: '제설함', x: 488, y: 642, ux: 478, uy: 650, use: true }
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
    RANKS: RANKS, DISCHARGE_LIFE: DISCHARGE_LIFE, DISCHARGE_MERIT: DISCHARGE_MERIT, CREW_CAP: CREW_CAP, OP: OP, LEAVE: LEAVE, PREP: PREP, BRIEF: BRIEF, STORY: STORY, LOOK: LOOK, LOOK_NAMES: LOOK_NAMES, QUESTS: QUESTS, PROPS: PROPS, CALLS: CALLS, VEND: VEND, WEATHER: WEATHER, HAZ: HAZ, LINES: LINES, PROC: PROC, DUMP: DUMP, TREASURE: TREASURE, RARITY: RARITY, ACH: ACH, DIA: DIA,
    SPAWN: { x: 200, y: 180 }, DOOR: { x: 260, y: 114 },
    DAY_LEN: 240, FALL: 0.003, HIT: 0.1, SPEED: 90, PART_DONE: 1, PART_RESET: 0.7, INSPECT: 0.95, ALMOST: 0.85
  };
})(window.JY = window.JY || {});
