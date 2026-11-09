#!/usr/bin/env node
/* 아이콘 생성: node tools/make-icons.js  (icons/icon.svg + PNG 192/512) */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
var root = path.join(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(root, 'js/art.js'), 'utf8'));
var face = global.JY.art.character({ seed: 'icon', skin: '#ffd9b5', eyes: 'derp', mouth: 'teeth', brows: 'uni', hat: 'helmet', rank: 'e4', extras: ['blush', 'snot'] });
face = face.replace('<svg class="char" viewBox="0 0 200 232"', '<svg x="56" y="70" width="400" height="464" viewBox="0 0 200 232"');
var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<rect width="512" height="512" rx="112" fill="#3a4722"/>' +
  '<circle cx="256" cy="300" r="200" fill="#56662f"/>' +
  face +
  '<rect x="150" y="26" width="212" height="64" rx="14" fill="#e0b347" stroke="#2a2620" stroke-width="6"/>' +
  '<text x="256" y="76" font-size="46" font-weight="900" text-anchor="middle" fill="#2a2620" font-family="sans-serif">D-1</text>' +
  '</svg>';
fs.mkdirSync(path.join(root, 'icons'), { recursive: true });
fs.writeFileSync(path.join(root, 'icons/icon.svg'), svg);
var { chromium } = require('playwright');
(async function () {
  var b = await chromium.launch();
  for (var size of [192, 512]) {
    var p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ') + '</body></html>');
    await p.screenshot({ path: path.join(root, 'icons/icon-' + size + '.png'), omitBackground: true });
    await p.close();
  }
  await b.close();
  console.log('icons written');
})();
