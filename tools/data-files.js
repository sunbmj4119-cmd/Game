/* 브라우저 없이 돌리는 도구·테스트가 읽을 파일 목록: index.html의 <script> 순서 그대로,
 * 화면(DOM)이 필요한 ui·audio·minigames·rank는 뺀다. 새 카드 파일은 index.html에만 추가하면 된다. */
'use strict';
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
module.exports = function (opts) {
  opts = opts || {};
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), out = [];
  html.replace(/<script src="([^"]+)"><\/script>/g, function (m, src) {
    if (/js\/(ui|audio|minigames|rank)\.js$/.test(src)) return m;
    if (opts.noMeta && /js\/meta\.js$/.test(src)) return m;
    if (opts.noArt && /js\/art\.js$/.test(src)) return m;
    out.push(src);
    return m;
  });
  return out;
};
module.exports.root = root;
module.exports.load = function (opts) {
  var vm = require('vm');
  module.exports(opts).forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); });
};
