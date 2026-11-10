# 생존 게임 분석과 전역각 방향 재검토 (2026-11)

> 계기: v7(2D 자대) 이후 "퀄리티가 너무 낮다"는 평가. 인기 생존 게임들이 어떤 형태로 진행되고 무엇 때문에 인기가 많은지 다시 넓게 조사하고, 지금 전역각과 냉정하게 비교했다.
> 수치는 공개 보도와 추적 사이트 기준이며 시점이 서로 다르다. '추정'이라고 적은 것은 개발사 공식 수치가 아니다.

## 1. 냉정한 진단: 지금 전역각이 싸 보이는 이유

1. **핵심 동작이 여전히 '고르기'다.** 2D로 걸어 다니지만, 걷기는 메뉴 버튼까지 가는 이동 시간일 뿐이다. 버튼을 누르면 숫자가 바뀌는 구조는 카드 고르기와 똑같다. 실력·타이밍·손맛이 끼어들 틈이 없다.
2. **목표가 '버티기'뿐이다.** 4개 수치를 가운데에 유지하는 것은 Reigns의 장치다. 5분짜리 카드 게임에선 통하지만, 자유롭게 돌아다니는 게임에선 모든 행동이 관리 잡무가 된다. 점점 강해지는 맛이 없다.
3. **한 판이 너무 길고 끝이 멀다.** 18개월, 자대만 약 37턴. 모바일 인기작은 5~30분짜리 판을 반복하며 판 밖에 성장이 쌓인다.
4. **시스템은 많은데 전부 얕다.** 특기·득템·조합·부탁·줍기·악조건·다이아·꾸미기·랭킹·일일 미션·도감… 대부분 한 번 누르면 끝이다.
5. **보이는 품질이 낮다.** 게임 화면이 전체의 1/3이고 나머지는 상단 정보와 패널이다. 단색 상자에 이모지 아이콘, 캐릭터 머리가 건물만 해서 축척이 깨진다. 화면 흔들림·파티클·효과음 같은 타격감이 거의 없다.
6. **위협이 숫자다.** 행보관 시야는 있지만 들키면 수치가 조금 줄 뿐이라 무섭지 않다. 인기작의 위협은 눈앞에서 쫓아온다.
7. **남에게 보여줄 장면이 없다.** 한국에서 군대는 최고의 밈 소재인데, 캡처해서 친구에게 보낼 웃긴 순간이 안 생긴다.

**지킬 것**: 한국 군대라는 소재(경쟁작이 거의 없다. 검색으로 찾은 건 '군인 생활 시뮬레이터' 정도), 캐릭터들, 831개 장면과 레전드 썰, 훈련소 카드(프롤로그로서).

## 2. 인기 생존 게임의 9가지 형태

| 형태 | 대표작과 규모 | 어떻게 진행되나 | 왜 빠지나 | 전역각에 줄 교훈 |
|---|---|---|---|---|
| **샌드박스 제작 생존** | Valheim 1,200만+, Rust 약 2,000만, The Forest 530만+, 로블록스 99 Nights in the Forest 동시접속 1,420만(2025) | 탐험 → 채집 → 제작 → 건설 → 보스·새 지역. 도구 등급이 다음 지역의 문을 연다 | 내 손으로 만든 기지, 친구와 함께 | '밤 n일차' 카운트다운과 갈수록 세지는 밤 |
| **이야기 생성기** | Frostpunk 500만+, Project Zomboid 2026 동시접속 최고 12만, RimWorld | 시뮬레이션이 사건을 만들고 플레이어가 대응. 스토리텔러가 긴장→휴식→긴장 곡선을 조절. Frostpunk는 법전으로 도덕적 거래 | 매 판 다른 '내 이야기' | 사건 조절자로 리듬 만들기 |
| **규칙 속 생존 (루틴·탈출)** | The Escapists 400만+, Papers, Please 500만, Schedule I 동시접속 45.9만(추정 600만+) | 정해진 일과표(점호·식사·작업) 안에서 몰래 준비 → 큰 한 방(탈옥, 제국) | 규칙을 비트는 쾌감, 들킬 듯 말 듯한 실행 | **군대와 구조가 거의 같다.** 판의 목표는 '버티기'가 아니라 '작전 성공'이어야 |
| **서바이버라이크** | Vampire Survivors 500만+(2023), Brotato 200만+(2023), Megabonk 2주 만에 100만(2025), Survivor.io 누적 결제 5억 달러+ | 이동만 조작, 공격은 자동. 몰려오는 적. 레벨업마다 3개 중 1개 선택. 15~30분 한 판, 죽으면 영구 강화 | 마찰 0, 1분 안에 성공 경험, 점점 강해지는 권력 판타지, 슬롯머신식 보상 | 한 손 조작 + 짧은 판 + 강해지는 맛 |
| **두 개의 루프 (낮/밤)** | Dave the Diver 1,000만(2026), 60 Seconds! 시리즈 650만 | 성격이 다른 두 모드가 서로를 먹여 살린다(잡은 물고기 → 초밥집 매출 → 장비 → 더 깊이) | 질릴 때쯤 모드가 바뀌고, 한쪽 성과가 다른 쪽을 키운다 | 낮 작업이 밤 활동의 재료가 되게 |
| **협동 혼돈 ('friendslop')** | Lethal Company 동시접속 11.5만, Peak 1,000만+(2025), R.E.P.O. | 짧은 원정, 물리 사고, 근접 음성 채팅 | 친구와 웃긴 실패, 방송각 | 웃긴 실패 장면을 만들고 공유하게 (멀티는 나중) |
| **모바일 매출형 생존 (4X)** | Whiteout Survival 2025년 14억 달러+, Last War 15.7억 달러, Last Day on Earth 1.3억 다운로드 | 생존 테마 + 기지 건설. '용광로 레벨'이 모든 성장의 중심축. 대기 시간을 돈으로 | 하나의 분명한 중심 목표, 동맹 | 성장의 중심축 하나 (예: 짬) |
| **한국 방치형 키우기** | 메이플 키우기 45일 만에 1억 달러, 갓깨비 키우기 | 자동 전투, 숫자 상승, 접속 보상 | 짧은 접속, 출퇴근길 플레이 | 앱을 안 켜도 쌓이는 보상 |
| **이야기형 로그라이트·선택형** | Hades, Darkest Dungeon 200만+, BitLife 약 1.3억 설치(추정) | 죽어도 허브로 돌아와 이야기가 이어진다("모든 판이 의미 있다"). DD는 스트레스가 쌓이면 발작·각성 | 실패해도 진전, 캐릭터가 나를 기억 | 실패해도 이야기 진전, 멘탈은 '터지면 사건'으로 |

한국 시장 맥락(센서타워): 2025년 모바일 매출 약 53억 달러, RPG가 48%(MMORPG 30%). 방치형이 RPG 하위 장르 2위로 올라섰고 4X·머지가 성장.
리텐션 기준(GameAnalytics 2025): 1일차 중앙값 약 22%, 상위 10% 약 40% / 7일차 중앙값 약 4%, 상위 10% 약 12%.

## 3. 흥행작의 공통 패턴과 전역각 v7 점수

| 패턴 | 예 | 전역각 v7 |
|---|---|---|
| 30초 안에 손맛 (조작 자체가 재미) | VS의 이동·회피, Peak의 등반, Dave의 잠수 | ✗ 없음 |
| 분명한 큰 목표 + 중간 문턱 | 탈옥, 정상, 용광로 레벨, 99일 | △ 전역은 너무 멀다 |
| 점점 강해지는 맛 | 서바이버라이크, 키우기 | ✗ 수치를 가운데 유지할 뿐 |
| 짧은 판 + 다음 판에 남는 것 | VS, Hades, Megabonk | △ 한 판이 길다 |
| 두 모드가 서로를 먹인다 | Dave, 60 Seconds | △ 연결이 약하다 |
| 눈앞의 위협 | Lethal Company, 99 Nights | ✗ 위협이 숫자 |
| 시스템이 만드는 이야기 | RimWorld, Zomboid | △ 미리 쓴 카드 |
| 공유할 장면 | friendslop | ✗ |
| 한 손·저마찰 | Survivor.io | △ |
| 독창적 소재 | — | ✓ 한국 군대 |
| 콘텐츠 양 | — | ✓ 장면 831개 |

## 4. 방향 제안

### A안. 작업 서바이버
일과 작업(제설·제초·낙엽 쓸기·삽질)을 서바이버라이크로. 화면 가득 눈이 쏟아지고, 한 손으로 움직이면 넉가래가 자동으로 밀어낸다. 행보관의 "다시!"가 웨이브. 레벨업 3택 1(넓은 넉가래, 후임 소환, 맛스타 버프…). 5분 = 하루 작업. 훈련소에서 정해진 특기가 시작 도구를 바꾼다.
- 장점: 손맛, 짧은 판, 모바일에서 검증된 형태, 한국 사람이면 바로 웃는 소재
- 단점: 사람·이야기가 약해진다. 흔한 장르로 보일 위험

### B안. 몰래 작전 (Escapists식)
하루 일과표(기상 → 점호 → 일과 → 식사 → 개인정비 → 22:00 점호) 위에서 '작전'을 수행한다. 예: 치킨 몰래 받아 먹기 — 담 너머로 치킨을 받고, 당직사관 순찰을 피해 생활관까지, 냄새 게이지까지 관리. 작전마다 준비물(조합)과 정보(동료 부탁)가 필요하다.
- 장점: 소재와 가장 잘 맞고, 자유도와 이야기가 풍부하다
- 단점: 맵·순찰 AI·레벨 디자인 공수가 크다. 루틴 반복이 지루해질 위험(Escapists의 대표적 비판)

### C안 (추천). 낮엔 작업, 밤엔 작전
Dave the Diver식 두 루프. **낮** = A안 작업 서바이버(약 5분), **밤** = B안 짧은 잠입 작전(약 3분), **사이** = 생활관 허브에서 동료 대사(Hades식, 기존 장면 재활용). 낮에 번 짬·보급품이 밤 작전 도구가 되고, 밤 작전 성공(치킨, 휴대폰)이 다음 날 버프가 된다. 한 판 = 1주(약 10분), 진급이 챕터(이병 → 일병 → 상병 → 병장), 전역이 엔딩. 훈련소 카드는 프롤로그로 유지.

**진행 순서**: 넓게 만들지 말고 한 판을 깊게.
1. 낮 작업 '제설' 한 판을 고퀄로(전체 화면, 타격감, 소리) 만들고 재미를 확인한다
2. 밤 잠입 작전 1종
3. 허브·메타·작업 종류 확장

**덜어낼 것**: 수치 4개 → 체력·멘탈 2개(멘탈은 Darkest Dungeon처럼 터지면 사건), 얕은 시스템 정리.

## 5. '고퀄'의 구체적 기준
- 화면의 80% 이상이 게임. 정보는 게임 위에 얇게
- 아트 스타일 하나로 통일(외곽선 있는 플랫 벡터), 캐릭터와 건물의 축척을 맞춘다
- 타격감 4종: 화면 흔들림, 파티클, 히트스톱, 숫자 팝업 + 효과음
- 폰에서 60fps
- 설명 없이 첫 30초 안에 재미

## 출처
- [Valheim 1,200만 장 — Game Developer](https://gamedeveloper.com/business/-i-valheim-i-has-crafted-12-million-sold-copies), [Best-selling PC games (Rust, The Forest)](https://wikiwand.com/en/articles/Best-selling_PC_games)
- [99 Nights in the Forest 1,420만 동시접속 — PC Gamer](https://www.pcgamer.com/games/survival-crafting/with-a-peak-player-count-of-14-2-million-99-nights-in-the-forest-has-an-audience-other-multiplayer-games-would-kill-for-to-find-these-behemoth-playerbases-you-need-to-be-on-a-platform-like-roblox/)
- [Frostpunk 500만 — Game Developer](https://gamedeveloper.com/business/frostpunk-has-topped-5-million-sales-in-six-years), [Frostpunk 법전 — PC Gamer](https://www.pcgamer.com/frostpunk-developers-on-hope-misery-and-the-ultimately-terrifying-book-of-laws)
- [Project Zomboid 동시접속 기록 — Niche Gamer](https://nichegamer.com/project-zomboid-breaks-its-steam-record-again-with-over-121000-players/), [RimWorld 리뷰(수치는 2차 자료)](https://gamegeeker.com/pt/games/rimworld-294100/review)
- [The Escapists 400만 — MCV](https://mcvuk.com/business-news/retail/the-escapists-2-to-break-into-retail-this-summer-thanks-to-sold-out-and-team17), [The Escapists 리뷰(루틴 비판) — PCGamesN](https://www.pcgamesn.com/the-escapists/the-escapists-early-access-review), [GamesBeat](https://gamesbeat.com/the-escapists-review/)
- [Papers, Please 500만 — Game Developer](https://gamedeveloper.com/business/papers-please-has-sold-5-million-copies-in-a-decade)
- [Schedule I 45.9만 동시접속 — TweakTown](https://www.tweaktown.com/news/104474/schedule-hits-459k-peak-players-the-most-by-solo-developer-in-steam-history/index.html), [Schedule I 판매 추정 — Raijin](https://raijin.gg/app/3164500/Schedule_I), [Stream Hatchet 분석](https://streamhatchet.com/?p=21942)
- [Vampire Survivors 설계 분석 — Portsmouth 대학](https://researchportal.port.ac.uk/en/publications/vampire-survivors-how-developers-used-gambling-psychology-to-crea/), [저마찰 사례 연구](https://birdor-blog.pages.dev/vampire-survivors-low-friction-success-case-study/), [Brotato 200만 — Game Developer](https://www.gamedeveloper.com/press-release/brotato-10-release), [Megabonk 100만 — PC Gamer](https://www.pcgamer.com/games/roguelike/vampire-survivors-like-megabonk-makes-megabucks-selling-a-million-copies-in-2-weeks-and-currently-has-more-daily-players-than-borderlands-4-on-steam-ill-be-eating-spaghetti-with-extra-sauce-tonight)
- [Survivor.io 2개월 7,500만 달러 — mobilegamer.biz](https://mobilegamer.biz/two-months-in-survivor-io-passes-75m-from-37m-downloads/), [Survivor.io 5억 달러 — wnhub](https://wnhub.io/news/finance/item-43301), [Habby 설계 — Naavik](https://naavik.co/deep-dives/survivorio-archeros-footsteps/)
- [Dave the Diver 1,000만 — Gematsu](https://www.gematsu.com/2026/09/dave-the-diver-sales-top-10-million), [Dave the Diver 리뷰 — RPGamer](https://rpgamer.com/review/dave-the-diver-review/)
- [60 Seconds! 650만 — GoNintendo](https://www.gonintendo.com/contents/56730-60-seconds-series-reaches-6-5-million-sold-on-its-10th-anniversary)
- [Lethal Company 인기 분석 — Prima Games](https://primagames.com/gaming/what-led-to-lethal-company-exploding-in-popularity-how-developers-can-learn-from-its-success), [Peak 1,000만 — GamesRadar](https://www.gamesradar.com/games/survival/peak-put-friendslop-on-the-map-in-2025-but-neither-of-its-2-studios-expected-it-to-blow-up-we-were-ready-to-hit-the-launch-button-and-go-into-vacation-mode)
- [2025 최고 매출 모바일 게임 — mobilegamer.biz](https://mobilegamer.biz/the-top-grossing-mobile-games-of-2025/), [Whiteout Survival 10억 달러 — GamesBeat](https://gamesbeat.com/?p=236236), [Last Day on Earth — wnhub](https://wnhub.io/news/marketing/item-15996)
- [센서타워 2025 한국 게임 시장](https://sensortower.com/ko/blog/state-of-gaming-in-korea-2025-report-KR), [메이플 키우기 1억 달러 — 센서타워](https://sensortower.com/ko/blog/maplestory-idle-rpg-surpasses-100-million-in-cumulative-revenue), [갓깨비 키우기 — 센서타워](https://sensortower.com/ko/blog/God-Goblin-Raising-ranks-No-1-in-idle-RPG-revenue)
- [Hades 'every run counts' — Tom's Guide](https://www.tomsguide.com/features/hades-exclusive-interview-supergiant), [VICE](https://www.vice.com/en/article/how-hades-made-a-genre-known-for-being-impossibly-hard-accessible), [Darkest Dungeon 스트레스 — Killscreen](https://killscreen.com/darkest-dungeon-explores-psychological-horror-dungeon-crawl), [Darkest Dungeon — Wikipedia](https://wikipedia.com/wiki/Darkest_Dungeon)
- [BitLife 설치 추정 — AppGoblin](https://appgoblin.info/apps/com.candywriter.bitlife), [Stardew Valley 4,100만 — PocketGamer.biz](https://www.pocketgamer.biz/stardew-valley-sells-over-41-million-copies)
- [GameAnalytics 2025 모바일 벤치마크](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)
- [군인 생활 시뮬레이터 (App Store)](https://apps.apple.com/us/app/%EA%B5%B0%EC%9D%B8-%EC%83%9D%ED%99%9C-%EC%8B%9C%EB%AE%AC%EB%A0%88%EC%9D%B4%ED%84%B0-%EA%B2%8C%EC%9E%84/id1528920611?l=ko)
