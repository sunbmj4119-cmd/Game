// dist/jeseol.html(빌드한 게임 한 파일)을 앱의 www/index.html로 복사한다
var fs = require('fs'), path = require('path');
var src = path.join(__dirname, '..', 'dist', 'jeseol.html'), out = path.join(__dirname, 'www');
if (!fs.existsSync(src)) { console.error('먼저 저장소 루트에서 빌드: node tools/build.js --page snow.html'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(src, path.join(out, 'index.html'));
console.log('www/index.html <- dist/jeseol.html (' + Math.round(fs.statSync(src).size / 1024) + ' KB)');
