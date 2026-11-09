#!/usr/bin/env node
/* 한 파일 빌드: node tools/build.js [출력경로] [--fragment]
 * CSS와 JS를 모두 index.html 안에 넣어 파일 하나로 만든다.
 * 기본 출력: dist/jeonyeok.html (휴대폰에 파일만 보내도 열린다)
 * --fragment: <html>/<head>/<body> 없이 본문만 (Claude 아티팩트 게시용) */
'use strict';
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var out = process.argv[2] && process.argv[2].indexOf('--') !== 0 ? process.argv[2] : path.join(root, 'dist/jeonyeok.html');
var fragment = process.argv.indexOf('--fragment') >= 0;

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
var scripts = [];
html.replace(/<script src="([^"]+)"><\/script>/g, function (m, src) { scripts.push(src); return m; });
var js = scripts.map(function (src) { return '/* ' + src + ' */\n' + fs.readFileSync(path.join(root, src), 'utf8'); }).join('\n');
js = js.replace(/<\/script/gi, '<\\/script');

var body = html.slice(html.indexOf('<!-- build:body -->') + '<!-- build:body -->'.length, html.indexOf('<!-- /build:body -->'));
var title = (html.match(/<title>[^<]*<\/title>/) || ['<title>전역각</title>'])[0];
var fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&display=swap">';
var icon = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'icons/icon.svg')).toString('base64');

var doc;
if (fragment) {
  doc = title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + fonts + '\n<style>\n' + css + '\n</style>\n' + body + '\n<script>\n' + js + '\n</script>\n';
} else {
  var head = html.slice(0, html.indexOf('</head>'))
    .replace(/<link rel="manifest"[^>]*>\n?/, '')
    .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="' + icon + '">')
    .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
    .replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>');
  doc = head + '</head>\n<body>' + body + '<script>\n' + js + '\n</script>\n</body>\n</html>\n';
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, doc);
console.log('wrote ' + path.relative(process.cwd(), out) + ' (' + Math.round(doc.length / 1024) + ' KB)');
