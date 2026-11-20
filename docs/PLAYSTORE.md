# 제설각 플레이스토어 출시 가이드 (2026-11 조사)

> 질문: "이거 만들고 플레이스토어 올리고 싶은데 어떻게 해야 하며, 무슨 사업자등록증을 등록하면 바로 올라가진다는데 그건 또 뭔지 알아봐 줘"
>
> 아래는 2026년 11월 20일 기준으로 찾은 내용이다. 구글 고객센터(support.google.com) 일부는 이 환경에서 직접 열리지 않아 검색 결과 요약으로 인용했다. 블로그·상담글은 **(2차)**로 표시했다. 세금·법률은 첫 신고 전에 세무사·관할 구청에 꼭 확인할 것.

## 한눈에

| 단계 | 할 일 | 비용 · 기간 |
|---|---|---|
| 1 | 게임을 안드로이드 앱(AAB)으로 감싸기 — `app/` 폴더 (Capacitor) | 무료 · 하루 |
| 2 | 구글 플레이 개발자 계정 | **US$25 한 번** |
| 3a | **개인 계정**이면: 테스터 **12명이 14일 연속** 참여하는 비공개 테스트를 거쳐야 정식 출시 신청 가능 | 2주+ |
| 3b | **조직 계정**이면: 사업자등록 → **D-U-N-S 번호** → 조직 인증. 12명/14일 테스트 없이 바로 정식 출시 신청 | D-U-N-S 무료 · 최대 약 4주 |
| 4 | AdMob 계정 · 광고 단위 · 개인정보처리방침 페이지 | 무료 |
| 5 | 스토어 등록정보 · 콘텐츠 등급(IARC 설문) · 광고 포함 · 데이터 보안 양식 | 하루 |
| 6 | 심사 | 며칠 ~ 7일 이상 |

**"사업자등록증을 등록하면 바로 올라간다"의 정체**: 사업자등록증만 내면 되는 게 아니라, 사업자 정보로 **D-U-N-S 번호**(Dun & Bradstreet의 기업 식별번호)를 받아 **조직 계정**으로 가입하면, 2023년 11월 이후 새 **개인** 계정에 붙은 "테스터 12명 × 14일" 조건을 건너뛸 수 있다는 뜻이다. 심사는 똑같이 받는다.

## 1. 앱으로 감싸기: Capacitor 추천

- 백엔드 없는 한 파일 게임이라 **Capacitor**가 맞다. 웹 파일을 앱 안에 복사해서 오프라인으로도 돌고, AdMob·결제 플러그인이 있다 ([Capacitor 광고 가이드](https://capacitorjs.com/docs/guides/ads), [cap copy](https://capacitorjs.com/docs/cli/commands/copy))
- TWA(Trusted Web Activity)는 HTTPS 호스팅 + 첫 실행 때 인터넷이 필요하고, AdMob을 웹 화면 위에 띄우기 어렵다 ([Offline-first TWA](https://developer.chrome.com/docs/android/trusted-web-activity/offline-first))
- **타깃 API**: 2026-08-31부터 새 앱·업데이트는 **API 36(Android 16)** 이상 ([developer.android.com](https://developer.android.com/google/play/requirements/target-sdk)) → `app/`에서 만든 프로젝트가 36으로 나오는 것을 확인했다
- **AAB + Play App Signing** 필수: 업로드 키로 서명해 올리고, 앱 서명 키는 구글이 보관 ([앱 서명](https://developer.android.com/studio/publish/app-signing))
- 결제(광고 제거 등)를 넣으려면 **Play 결제 라이브러리 8 이상**을 쓰는 플러그인 ([지원 중단 FAQ](https://developer.android.com/google/play/billing/deprecation-faq))
- 만드는 순서는 `app/README.md`

## 2. 개발자 계정

- 등록비 **US$25**(한 번), 신분증 · 결제 카드 확인 ([Play 고객센터](https://support.google.com/googleplay/android-developer/answer/6112435))
- 개인 계정과 조직 계정 모두 수익화 가능 ([계정 유형](https://support.google.com/googleplay/android-developer/answer/13634885))

**개인 계정**
- 2023-11-13 이후 만든 개인 계정은 **테스터 12명이 14일 연속 참여한 비공개 테스트**를 거쳐야 프로덕션 신청 가능 ([Play 고객센터](https://support.google.com/googleplay/android-developer/answer/14151465)). 2024년 12월에 20명 → 12명으로 줄었다 ([Android Authority](https://www.androidauthority.com/google-play-app-testing-requirement-3510580)). 2026년에 공식적으로 또 바뀌었다는 발표는 못 찾았다
- 실제 안드로이드 기기 인증 필요 ([고객센터](https://support.google.com/googleplay/android-developer/answer/10841920))
- **수익화(광고·결제)를 하면 주소가 스토어에 공개된다** ([고객센터](https://support.google.com/googleplay/android-developer/answer/13628312)) — 개인 계정이면 집 주소

**조직 계정**
- **D-U-N-S 번호 필수**, 결제 프로필 인증에 D-U-N-S · 대표자 신분증 · 조직 서류 ([Google 블로그 2023](https://android-developers.googleblog.com/2023/07/boosting-trust-and-transparency-in-google-play.html), [고객센터](https://support.google.com/googleplay/android-developer/answer/10841920))
- 12명/14일 조건은 공식 문서가 "개인 계정"에 적용한다고 쓰고, 2차 자료들도 조직 계정은 면제라고 본다 ([예](https://www.choicely.com/blog/google-play-12-tester-rule)). "조직 계정은 면제"라고 못 박은 공식 문장은 찾지 못했다
- D-U-N-S: 구글 안내 기준 **무료 · 최대 28일** ([Android 개발자 인증 FAQ](https://developer.android.com/developer-verification/guides/faq)). 한국에선 나이스디앤비가 등록을 대행하며 **개인사업자도 신청 가능**하다는 안내가 많다 (2차: [Wing's Note](https://wingsnote.com/279), [swing2app](https://documentation.swing2app.co.kr/developer/duns)). 대행 수수료·기간은 출처마다 달라(2~3영업일이라는 안내도 있음) 직접 확인할 것
- **영문 상호를 Play 계정 · 사업자등록증 · D-U-N-S에서 똑같이** 맞추라는 조언이 많다 (홈택스 영문 사업자등록증명) (2차: [퍼스트몰](https://docs.channel.io/firstmall/ko/articles/D-U-N-S-Number-%EC%8B%A0%EC%B2%AD-%EB%B0%A9%EB%B2%95-411c2c78))

**Android 개발자 인증 (2026~2027)**: 플레이스토어로만 배포하면 대부분 따로 할 일이 없다 ([Play Console 가이드](https://developer.android.com/developer-verification/guides/google-play-console)). 서명 키는 잃어버리지 말 것.

## 3. 한국에서 필요한 것 (광고·결제로 돈을 벌면)

| 항목 | 내용 |
|---|---|
| **사업자등록** | 홈택스. 표준산업분류 **58212 (모바일 게임 소프트웨어 개발 및 공급업)**. 국세청 6자리 업종코드는 출처마다 달라 **홈택스 업종코드 조회로 직접 확인** ([세무사닷컴 상담](https://www.findsemusa.com/service/consult/consultView.do?qidx=36653)). 간이과세 기준은 연 1억 400만 원 미만 ([토스플레이스](https://tossplace.com/story/simplified_taxpayer)). 해외(구글) 광고 수익이 대부분이면 영세율이라 일반과세자가 유리할 수 있다는 설명 (2차, 세무사 확인) |
| **게임제작업 등록** | 게임산업진흥법 제25조. 상업적 목적이면 **1인 개발자도 관할 시·군·구에 등록**해야 하고, 안 하면 처벌 대상 ([조문](https://casenote.kr/%EB%B2%95%EB%A0%B9/%EA%B2%8C%EC%9E%84%EC%82%B0%EC%97%85%EC%A7%84%ED%9D%A5%EC%97%90_%EA%B4%80%ED%95%9C_%EB%B2%95%EB%A5%A0/%EC%A0%9C25%EC%A1%B0), [앱인토스 안내](https://toss.im/apps-in-toss/blog/game-developer-registration-guide)). 수수료·기간은 관할 구청에 문의 |
| **게임물 등급** | 구글 플레이는 게임물관리위원회(GRAC)가 지정한 자체등급분류사업자 → **Play Console의 IARC 설문으로 받은 등급이 한국에서도 통한다** ([GRAC IARC](https://www.grac.or.kr/Institution/IARC.aspx)). 청소년이용불가만 따로 GRAC 등급 필요 |
| **통신판매업 신고** | 광고 수익만이면 대상이 아니라는 해석, 인앱결제는 대상일 수 있다는 해석이 있다 (2차, [bznav](https://ai.bznav.com/contents/2684347)). 간이과세자 · 연 거래 50회 미만은 면제 ([정리](https://thecheck.co.kr/mail-order-business-report-exemption/)). 결제를 넣기 전에 확인 |
| **확률 공개** | 2024-03-22부터 확률형 아이템 확률 공개 의무 (연매출 1억 원 이하 영세 사업자 제외) ([세계일보](https://www.segye.com/newsView/20231113512094)). 제설각 보급 상자는 **이미 화면에 등급별 확률을 표시**하고 있다 |
| **세금** | AdMob 외화 수익 = 사업소득, 부가세 영세율 대상(신고는 해야 함), 5월 종합소득세 (2차, [위키독스](https://wikidocs.net/blog/@Insight_Lab/29318/)). Play 결제 수수료는 연 첫 100만 달러까지 15% ([고객센터](https://support.google.com/googleplay/android-developer/answer/112622)) |

## 4. 광고 정책과 제설각에 맞춘 것

| 정책 | 제설각 v25 |
|---|---|
| 보상형: 사용자가 직접 골라야 하고, 보상을 미리 알리고, 약속한 보상은 꼭 지급 ([AdMob](https://support.google.com/admob/answer/7313578)) | 버튼에 보상을 써 둔다("광고 보고 초코파이 ×2 (+1,879)"), 끝까지 보면 바로 지급, 중간에 닫으면 "보상 없음" |
| 전면 광고는 레벨 끝 같은 자연스러운 쉬는 지점에만. 앱을 켜거나 끌 때 갑자기 뜨면 안 됨 ([AdMob](https://support.google.com/admob/answer/6201362), [Play 광고 정책](https://support.google.com/googleplay/android-developer/answer/12271244)) | **결과 화면 → 생활관**으로 넘어갈 때만. 작전 중·앱 시작·진급 연출 때는 없음 |
| 빈도: 공식 수치는 없고, 구글 자료가 최소 2분 간격을 제안 ([PDF](https://services.google.com/fh/files/emails/interstitial_best_practices.pdf)) | 6판째부터 · 3판마다 · **3분 간격** · 하루 8번까지 · 최근 2판 안에 보상형을 봤으면 건너뜀 |
| 광고 포함 선언 · 데이터 보안 양식(광고 ID 수집) ([Play](https://support.google.com/googleplay/android-developer/answer/9859455), [AdMob 공개 가이드](https://developers.google.com/admob/android/privacy/play-data-disclosure)) | 출시 때 Play Console에서 "광고 포함: 예", 데이터 보안 양식에 기기 식별자(광고 ID) 수집 표기 |
| 아동 대상이면 Families 인증 광고 SDK만 | 제설각은 군대 풍자 · 성인/청소년 대상으로 등록 (아동 대상 아님) |

## 5. 추천 경로

1. **지금**: `app/`으로 AAB를 만들어 내 폰에서 테스트 광고까지 확인 (구글 공식 테스트 ID가 이미 들어 있다)
2. **돈을 벌 생각이면 사업자부터**: 어차피 사업소득 신고와 게임제작업 등록이 필요하다
   - 사업자등록 → 게임제작업 등록(구청) → D-U-N-S(무료, 영문 상호 일치) → **조직 계정** → 12명/14일 없이 출시 신청
   - 조직 계정도 사업장 주소가 공개되니, 주소를 무엇으로 할지 미리 정한다
3. **일단 빨리 올려 보고 싶으면 개인 계정**: 지인 12명을 2주 동안 비공개 테스트에 모을 수 있다면 D-U-N-S 기다리는 시간과 비슷하다. 대신 수익화하면 집 주소가 공개된다
4. 첫 부가세·종합소득세 신고 전에 세무사 확인 (영세율 · 과세자 유형 · 통신판매업)
