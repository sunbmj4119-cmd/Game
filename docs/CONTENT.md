# 장면 쓰는 법 (전역각 카드 작성 가이드)

새 장면은 `js/data/cards4.js` 같은 **데이터 파일 하나**에만 넣는다. 화면 코드(ui.js 등)는 건드리지 않는다.
다 쓰면 반드시 검사기를 돌린다: `node tools/lint-cards.js js/data/cards4.js` → "오류 없음"이 나와야 한다.

## 1. 파일 뼈대
```js
/* v5 장면 추가: 생활관 일상 */
(function (JY) {
  'use strict';
  function o(t, fx, say, x) {            // 선택지 하나: (버튼 글, 스탯 변화, 결과 문장, 추가 필드)
    var r = { t: t, fx: fx || {}, say: say || '' };
    if (x) for (var k in x) r[k] = x[k];
    return r;
  }

  var NEW = [ /* 새 카드들 */ ];
  JY.CARDS.pool = JY.CARDS.pool.concat(NEW);          // 자대 생활 중 무작위로 나오는 카드

  // 기존 카드에 장면 더하기 (그 카드가 다시 나올 때 다른 장면)
  var PATCH = { mess_day: [ /* 장면들 */ ] };
  var all = {};
  ['training', 'arrival', 'returns', 'pool', 'emergency'].forEach(function (g) { (JY.CARDS[g] || []).forEach(function (c) { all[c.id] = c; }); });
  for (var id in PATCH) if (all[id]) all[id].variants = (all[id].variants || []).concat(PATCH[id]);
})(window.JY = window.JY || {});
```
돌발 카드는 `JY.CARDS.emergency = JY.CARDS.emergency.concat([...])`, 훈련소 후보는 `JY.CARDS.training`.

## 2. 카드
```js
{
  id: 'v5a_laundry',               // 파일마다 정해진 접두어 + 영어 소문자·숫자·_
  who: 'ppaen', bg: 'barracks',    // 카드 속 인물, 배경
  req: { rank: [1, 4], season: 'winter' },   // 나오는 조건 (없으면 언제나)
  repeat: true, cd: 30, w: 1.5,    // 장면 은행: 여러 번 나옴(cd일 간격), w 가중치(기본 1, 최대 2)
  text: '정뺀질: "내 전투복 같이 돌려 줄 수 있냐? 딱 한 벌이야."',   // 또는 ['버전1', '버전2']
  l: o('"네, 넣어 드리겠습니다"', { bd: 5, mt: -3 }, '세탁기를 열자 전투복이 다섯 벌 나왔다.'),
  r: o(['"제 것만 돌립니다"', '못 들은 척한다'], { mt: 3, bd: -4 }, '정뺀질: "…요즘 이병 무섭네."'),
  x: o('🍌 바나나우유로 거래', { bd: 6 }, '거래 성립. 세탁은 정뺀질이 했다.', { need: { item: 'banana' } })  // 선택
}
```
- **장면 하나 = 본문 + 왼쪽(l) + 오른쪽(r)**. 한 카드에 `variants: [장면, 장면, …]`을 넣으면 나올 때마다 다른 장면(직전과 다르게)이 나온다. 장면 수는 `본문이 있는 카드 1 + variants 개수`로 센다.
- variants 안의 장면: `{ who, text, l, r, x }` (who 생략하면 카드의 who). 장면마다 `flag`/`noflag`로 조건을 걸 수 있다 (예: `noflag: 'malGone'` 김말년이 아직 있을 때만).
- 문자열 자리에 배열을 쓰면 그중 하나가 무작위로 나온다 (같은 장면, 다른 말투).

## 3. 선택지에 쓸 수 있는 것
| 필드 | 뜻 | 예 |
|---|---|---|
| `fx` | 스탯 변화 `hp` 체력 · `mt` 멘탈 · `tr` 간부 신뢰 · `bd` 전우애 | `{ hp: -5, bd: 4 }` |
| `roll` | 운에 맡기기: 확률 합이 1 | `roll: [{ p: 0.6, fx: {...}, say: '...' }, { p: 0.4, fx: {...}, say: '...' }]` (이때 say는 `''`) |
| `aff` | 동료 호감도 (dumb malnyeon fm ppaen hoobae haeng cat) | `{ aff: { dumb: 5 } }` |
| `gem` | 다이아 (가끔, 3~5) | `{ gem: 3 }` |
| `leave` | 포상휴가 일수 (드물게, 1~2) | `{ leave: 1 }` |
| `money` | 돈 (원) | `{ money: -5000 }` |
| `need` | x(특수 대답)를 여는 조건: `item` / `trait` / `aff` / `flag` / `money` | `{ need: { item: 'tuna' } }` |

카드나 장면에 `legend: true`를 붙이면 '📜 레전드 썰'로 표시되고 레전드 수집에 들어간다 (커뮤니티에서 유명한 군대썰을 새로 쓴 장면).

아이템 id: buldak 불닭, mandu 만두, chocopie 초코파이, banana 바나나우유, tuna 참치캔, hot6 에너지 드링크, polish 구두약, cream 달팽이 크림, matdasi 맛다시, earplug 귀마개, comic 만화책, homefood 엄마 반찬.
성격 id: glutton 먹보, sleepy 잠꾸러기, insider 인싸, fm 원칙주의자, glass 유리멘탈, steel 강철멘탈, athlete 운동광, rich 금수저, lucky 행운아, nunchi 눈치백단, catlover 고양이 집사, romantic 연애 고수, clumsy 덜렁이.
x에 아이템 need를 걸면 그 아이템 1개를 쓴다.

## 4. 조건(req)
| 키 | 값 |
|---|---|
| `rank` | `[최소, 최대]` 0 훈련병 · 1 이병 · 2 일병 · 3 상병 · 4 병장. **자대 카드는 `[1, 4]` 이내** (0이 들어가면 훈련소에도 나옴) |
| `season` | `'spring' 'summer' 'autumn' 'winter'` 또는 배열 |
| `month` | `[시작월, 끝월]` |
| `unit` | gop 강원도 GOP · mech 기계화 · coast 해안 · recruit 신교대 조교 · commando 특공 |
| `mos` | infantry 소총수 · cook 취사병 · clerk 행정병 · driver 운전병 · medic 의무병 |
| `trait` | 성격 id |
| `flag` / `noflag` | malGone 김말년 전역함 · hoobae 후임이 생김 · gf 여자친구 있음 · special 특급전사 |
| `left` | 전역까지 남은 날 `[최소, 최대]` (말년 장면: `[0, 120]`) |

## 5. 인물(who)과 배경(bg)
- 인물: me 나 · jogyo 호랑이 조교 · barber 이발병 · malnyeon 김말년(병장·왕고, 느긋) · fm 최원칙(상병·분대장, 규정 집착, 안경) · dumb 박덤벙(동기, 순수·덜렁) · ppaen 정뺀질(일병·맞선임, 꾀부림) · hoobae 오순둥(후임, 순둥) · haeng 강삽질(상사·행정보급관, 삽과 작업) · captain 한열정(대위·중대장, 열정) · lt 이신입(소위·소대장, 어리바리) · cook 오짬밥(취사병) · doc 정처방(군의관) · general 사단장님 · mom 엄마 · gf 여자친구 · counselor 상담관 선생님 · duty 당직사관 · medic 나빨간(의무병) · driver 한운전(운전병) · clerk 문서준(행정병) · trainee 김눈물(훈련병) · idol 차반짝(전직 아이돌) · cat 짬타이거(부대 고양이) · boar 멧돼지 · speaker 중대 방송 · letter 편지 · phone 휴대폰 · box 소포
- 배경: barracks 생활관 · night 밤 · training 훈련장 · field 연병장·야외 · gate 위병소 · rain 비 · mess 식당 · office 행정반 · home 집 · px PX · hospital 의무대 · beach 바닷가

## 6. 균형 (가장 중요)
- 스탯은 **0이 되어도, 100이 되어도 실패**다. 실패의 대부분은 100 초과(너무 잘 지냄)다. 그러니 **좋기만 한 선택지는 피한다**: 보통 한 스탯이 오르면 다른 스탯이 내린다.
- 한 선택지의 변화는 보통 **±3~±10**, 큰 사건만 ±12~15. 한 선택지에 스탯은 1~2개(가끔 3개).
- 두 선택지가 서로 다른 스탯을 건드리게 하면 고민이 생긴다 (예: 왼쪽 `{ tr: 6, mt: -4 }` / 오른쪽 `{ mt: 5, tr: -5 }`).
- 파일 전체 평균(원래 수치)이 기존과 비슷해야 한다: **hp 약 -2, mt 약 +1.5, tr 약 +1, bd 약 +3** (게임이 불러올 때 한 번 더 보정한다).
- 다이아·휴가 보상은 드물게. 엔딩(`end`)은 쓰지 않는다.

## 7. 길이 (작은 휴대폰에서 잘리지 않게)
- 본문 **62자 이하** (평균 40자 안팎). 선택지 글 **14자 이하** (평균 8자). 결과 문장 **46자 이하** (평균 25자).

## 8. 글맛
- 띨빵하고 웃기게. 실제 군생활 디테일(점호, 불침번, 암구호, 사지방, 전투복 각, 깔깔이, 짬밥, PX, 휴대폰 반납, 행보관 작업…)로 공감을 산다.
- 결과 문장은 짧은 반전·한마디로 끝낸다 ("…쥐였다. 아마도.").
- **쓰지 않는 것**: 구타·가혹행위·괴롭힘을 웃음 소재로, 실제 부대·실존 인물 이름, 정치, 성적 농담, 욕설, 특정 지역·집단 비하, 자해·자살 관련 표현.
- 같은 파일 안에서도, 기존 카드와도 겹치지 않는 새 상황을 쓴다 (`grep`으로 비슷한 장면이 있는지 확인).
