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

## 4-1. 복무 중(현역 군인)이면? (2026-11-21 추가 조사)

> 법령 원문 사이트(law.go.kr)는 이 환경에서 직접 열리지 않아 법령 정리 사이트·보도·법률 칼럼을 근거로 했다. **소속 부대 인사·법무 담당에게 서면으로 확인**하는 게 가장 정확하다.

**법 구조**
- 「군인의 지위 및 복무에 관한 기본법」 **제30조**: 군인은 군무 외에 영리 목적 업무에 종사하지 못하고, 다른 직무를 겸하려면 허가가 필요하다. 여기서 '군인'은 장교·부사관뿐 아니라 **병(현역병)도 포함** ([LBOX 법령](https://lbox.kr/v2/statute/%EA%B5%B0%EC%9D%B8%EC%9D%98%EC%A7%80%EC%9C%84%EB%B0%8F%EB%B3%B5%EB%AC%B4%EC%97%90%EA%B4%80%ED%95%9C%EA%B8%B0%EB%B3%B8%EB%B2%95), [U-LEX](https://www.ulex.co.kr/%EB%B2%95%EB%A5%A0/178235-012438-%EA%B5%B0%EC%9D%B8%EC%9D%98%EC%A7%80%EC%9C%84%EB%B0%8F%EB%B3%B5%EB%AC%B4%EC%97%90%EA%B4%80%ED%95%9C))
- 시행령 **제19조**: 금지되는 영리 업무의 대표 예가 "상업·공업·금융업 등 **스스로 경영하여 영리를 추구함이 뚜렷한 업무**". **제20조**: 영리 업무가 아닌 겸직은 사전 허가(각 군 참모총장 위임) ([위키문헌 시행령](https://ko.wikisource.org/wiki/%EA%B5%B0%EC%9D%B8%EC%9D%98_%EC%A7%80%EC%9C%84_%EB%B0%8F_%EB%B3%B5%EB%AC%B4%EC%97%90_%EA%B4%80%ED%95%9C_%EA%B8%B0%EB%B3%B8%EB%B2%95_%EC%8B%9C%ED%96%89%EB%A0%B9))
- 부대관리훈령: 별지 서식으로 지휘계통을 거쳐 사전 허가 신청 ([U-LEX 부대관리훈령](https://www.ulex.co.kr/%EB%B2%95%EB%A5%A0/2100000219007-34739-%EB%B6%80%EB%8C%80%EA%B4%80%EB%A6%AC%ED%9B%88))
- **사업자등록 자체를 막는 세법 조항은 없다** (등록은 사업 시작 20일 안에 해야 하는 세법 의무 · [국세청](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2444&cntntsId=7777)). 군 법령이 막는 건 '등록'이라는 서류보다 **실제로 영리 사업을 하는 것**이다. 다만 등록하면 사업을 하겠다는 증거가 된다

**현역병(이병~병장)**
- 2019년 헌법재판소는 "현역병은 영리 목적 겸직이 사실상 어렵다"고 봤다 ([2017헌마374 요약](https://bigcase.ai/cases/%ED%97%8C%EB%B2%95%EC%9E%AC%ED%8C%90%EC%86%8C/2017%ED%97%8C%EB%A7%88374,976,2018%ED%97%8C%EB%A7%88821(%EB%B3%91%ED%95%A9)))
- 2020년 국방부는 유튜브를 수익과 상관없이 겸직으로 보고, 허가는 '생계 곤란'에 한정했다 ([이데일리](https://m.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=01243126625772528), [세계일보](https://www.segye.com/newsView/20200525510447)). 같은 해 완화된 건 **사회복무요원의 비영리** 유튜브뿐이었다
- 현역병이 사업자등록·앱 수익화로 허가받은 공개 사례는 찾지 못했다
- **결론: 복무 중 내 이름으로 게임 사업자를 내고 AdMob·결제로 돈을 버는 건 사실상 어렵다.** 광고·결제가 들어간 게임 운영은 '스스로 경영하는 영리 업무'로 볼 가능성이 크다. 어기면 징계(강등·군기교육·감봉·휴가단축·근신·견책) 대상 ([대륜](https://www.daeryunlaw.com/field/275))

**직업군인(장교·부사관)**: 허가 제도는 같지만, 직접 경영하는 영리 사업은 허가가 어렵다. 무허가 부업으로 감봉 처분 사례가 있다 ([로톡 사례](https://www.lawtalk.co.kr/posts/118677))

**사회복무요원**: 생계유지 등 사유로 겸직 허가 가능. 무허가 겸직·영리 행위는 경고 1회당 복무 5일 연장 ([복무관리규정 서식](https://www.law.go.kr/LSW/flDownload.do?flSeq=153856107&flNm=%5B%EB%B3%84%EC%A7%80+8%EC%9D%982%5D+%EA%B2%B8%EC%A7%81%ED%97%88%EA%B0%80%28%EC%B7%A8%EC%86%8C%C2%B7%EB%B3%80%EA%B2%BD%29+%ED%86%B5%EB%B3%B4%EC%84%9C&bylClsCd=200203))

**가족 명의로 내면? → 하지 말 것**: 남의 명의로 사업자등록하면 조세범 처벌법 제11조(명의 사용자 2년 이하 징역/2천만 원 이하 벌금, 빌려준 사람도 처벌) 위험 ([로톡](https://www.lawtalk.co.kr/posts/172529)). 겸직 판단은 실질로 하므로 아내 명의 가게를 실제로 운영한 공무원 징계가 유지된 판결도 있다 ([세계일보 2025](https://www.segye.com/newsView/20250414515864)) — 명의를 빌려도 군 징계 위험은 그대로

**복무 중이라면 추천 순서**
1. 소속 부대 인사과·법무 담당에게 **서면 질의**: "수익 없는 앱 개발·무료 배포가 가능한지", "수익화 겸직 허가가 가능한지"
2. 복무 중엔 **개발만** (이 저장소처럼). 광고 SDK·결제·수익 설정은 하지 않는다. 무료 배포도 부대 답변을 받은 뒤에 (수익이 없으면 겸직 아니라는 의견도, 수익과 상관없이 겸직으로 본 2020년 국방부 입장도 있다)
3. **전역 직후**: 홈택스 사업자등록(업종은 홈택스 조회로 확인, 모바일 게임 소프트웨어 개발 계열 · 본가를 사업장으로 쓰면 무상사용승낙서) → 등록증 보통 2일 ([부가세법 시행령 제11조](https://www.law.go.kr/lsLinkCommonInfo.do?lspttninfSeq=112739)) → 구청 **게임제작업 등록** (미등록 시 2년 이하 징역/2천만 원 이하 벌금) → D-U-N-S → 조직 계정 → AdMob·Play 결제 프로필을 **본인 명의 계좌**로 (예금주명 일치 · [AdMob 지급](https://support.google.com/admob/answer/3372975?hl=ko)) → 부가세(1월·7월)·종합소득세(5월) 일정 관리

## 5. 추천 경로

1. **지금**: `app/`으로 AAB를 만들어 내 폰에서 테스트 광고까지 확인 (구글 공식 테스트 ID가 이미 들어 있다)
2. **돈을 벌 생각이면 사업자부터**: 어차피 사업소득 신고와 게임제작업 등록이 필요하다
   - 사업자등록 → 게임제작업 등록(구청) → D-U-N-S(무료, 영문 상호 일치) → **조직 계정** → 12명/14일 없이 출시 신청
   - 조직 계정도 사업장 주소가 공개되니, 주소를 무엇으로 할지 미리 정한다
3. **일단 빨리 올려 보고 싶으면 개인 계정**: 지인 12명을 2주 동안 비공개 테스트에 모을 수 있다면 D-U-N-S 기다리는 시간과 비슷하다. 대신 수익화하면 집 주소가 공개된다
4. 첫 부가세·종합소득세 신고 전에 세무사 확인 (영세율 · 과세자 유형 · 통신판매업)
