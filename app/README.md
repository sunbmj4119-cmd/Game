# 제설각 안드로이드 앱 만들기 (Capacitor)

게임은 HTML 한 파일(`dist/jeseol.html`)이라, [Capacitor](https://capacitorjs.com/)로 감싸서 안드로이드 앱(AAB)으로 만든다. 인터넷 없이도 돌아간다(파일이 앱 안에 들어간다).

이 폴더에서 확인한 것 (클라우드 개발 환경, 2026-11):
- `npm install` → `node copy-web.js` → `npx cap add android` 까지 됨 (AdMob 플러그인 인식, compileSdk/targetSdk **36**)
- **AAB 빌드는 못 해 봤다** — 여기엔 Android SDK가 없다. 아래 4번부터는 내 PC(Android Studio)에서 한다.

## 준비물 (내 PC)
- Node.js 20 이상
- [Android Studio](https://developer.android.com/studio) 최신판 (Capacitor 8은 Android Studio Otter 2025.2.1 이상)
- 구글 플레이 개발자 계정 · AdMob 계정 (→ `docs/PLAYSTORE.md`)

## 1. 게임 빌드 (저장소 루트에서)
```bash
node tools/build.js --page snow.html      # dist/jeseol.html
```

## 2. 앱 프로젝트 만들기 (처음 한 번, app 폴더에서)
```bash
cd app
npm install
node copy-web.js            # dist/jeseol.html → www/index.html
npx cap add android         # android/ 폴더가 생긴다
```
- `capacitor.config.json`의 `appId`(`com.example.jeseol`)를 **내 것으로 바꾼다** (예: `kr.내이름.jeseol`). 한 번 올리면 못 바꾼다.

## 3. AdMob 설정
1. AdMob에서 앱을 만들고 **앱 ID**(`ca-app-pub-…~…`)와 광고 단위 2개(보상형 · 전면)를 만든다
2. `android/app/src/main/AndroidManifest.xml`의 `<application>` 안에:
   ```xml
   <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />
   ```
   `android/app/src/main/res/values/strings.xml`에:
   ```xml
   <string name="admob_app_id">ca-app-pub-내앱ID~xxxx</string>
   ```
   (개발 중엔 구글 공식 테스트 앱 ID `ca-app-pub-3940256099942544~3347511713`)
3. `js/snow/ads.js`의 `unit.rewarded` / `unit.interstitial`을 내 광고 단위 ID로 바꾸고, 출시 전 `testing: false`
4. 다시 1번(빌드) → `npm run sync`

게임 코드는 `window.Capacitor.Plugins.AdMob`이 있으면 진짜 광고를, 없으면(웹) '광고 자리' 화면을 띄운다. 개인정보 동의 창(UMP)은 필요한 지역에서만 자동으로 뜬다.

## 4. 실행 · 서명 · AAB
```bash
npm run sync      # 웹 파일 복사 + 플러그인 동기화 (게임을 고칠 때마다)
npm run open      # Android Studio로 열기
```
- Android Studio: 실제 폰 연결 → ▶ 실행으로 확인
- **Build → Generate Signed App Bundle** → 업로드 키(.jks)를 새로 만든다 → `release` → `.aab`
- 업로드 키 파일과 비밀번호는 **잃어버리면 안 된다** (안전한 곳에 백업)
- Play Console에 올리면 Play App Signing(앱 서명 키는 구글이 보관)이 기본

## 5. 아직 앱에 없는 것 (출시 전에 필요)
- 앱 아이콘 · 스플래시 (`npx @capacitor/assets generate` 등)
- **광고 제거 결제**(인앱 결제 · Play Billing 8 이상을 쓰는 플러그인) — 지금은 설정에 '출시판' 자리만 있다
- 클라우드 저장 (지금은 폰 안(localStorage)에만 저장 → 앱을 지우면 기록이 사라진다)
- 개인정보처리방침 웹페이지 (AdMob을 쓰면 필수)
