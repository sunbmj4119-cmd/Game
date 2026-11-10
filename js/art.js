/* 전역각 — 캐릭터/배경/아이콘 SVG 생성기
 * 외부 이미지 없이 전부 코드로 그린다. 컨셉: 머리 크고, 눈은 짝짝이, 어딘가 띨빵한 군인들.
 */
(function (JY) {
  'use strict';

  var uidCounter = 0;
  function uid() { uidCounter += 1; return 'jy' + uidCounter.toString(36); }

  function hash(str) {
    var h = 2166136261;
    str = String(str || 'x');
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var INK = '#2a2620';
  var SKINS = ['#ffd9b5', '#f6c79c', '#eab386', '#f9d2a8'];

  /* ── 디지털 무늬(화강암 패턴) ─────────────────────────── */
  function camoPattern(id, seed, colors) {
    var r = mulberry(seed);
    var c = colors || ['#6d7a48', '#4d5a32', '#8c7d57', '#353a25'];
    var s = '<pattern id="' + id + '" width="36" height="36" patternUnits="userSpaceOnUse">' +
      '<rect width="36" height="36" fill="' + c[0] + '"/>';
    for (var i = 0; i < 26; i++) {
      var x = Math.floor(r() * 9) * 4, y = Math.floor(r() * 9) * 4;
      var w = 4 * (1 + Math.floor(r() * 2)), h = 4 * (1 + Math.floor(r() * 2));
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c[1 + Math.floor(r() * 3)] + '"/>';
    }
    return s + '</pattern>';
  }

  /* ── 얼굴 부품 ─────────────────────────────────────── */
  var EL = 76, ER = 124, EY = 96;

  function eye(cx, cy, rx, ry, px, py, pr) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="' + (cx + px) + '" cy="' + (cy + py) + '" r="' + pr + '" fill="' + INK + '"/>' +
      '<circle cx="' + (cx + px - pr * 0.35) + '" cy="' + (cy + py - pr * 0.4) + '" r="' + Math.max(1.2, pr * 0.3) + '" fill="#fff"/>';
  }

  function drawEyes(type, skin) {
    var g = '';
    switch (type) {
      case 'derp':
        g = eye(EL, EY - 2, 15, 16, -5, -6, 6) + eye(ER, EY + 3, 9, 10, 3, 4, 4); break;
      case 'sleepy':
        g = eye(EL, EY, 12, 11, 0, 4, 5) + eye(ER, EY, 12, 11, 0, 4, 5) +
          '<path d="M62 92 Q76 82 90 92 L90 86 L62 86Z" fill="' + skin + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
          '<path d="M110 92 Q124 82 138 92 L138 86 L110 86Z" fill="' + skin + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
          '<rect x="60" y="78" width="32" height="12" fill="' + skin + '"/><rect x="108" y="78" width="32" height="12" fill="' + skin + '"/>' +
          '<path d="M63 93 Q76 99 89 93 M111 93 Q124 99 137 93" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
        break;
      case 'angry':
        g = eye(EL, EY, 11, 11, 2, 1, 5) + eye(ER, EY, 11, 11, -2, 1, 5); break;
      case 'dot':
        g = '<circle cx="' + EL + '" cy="' + EY + '" r="4.5" fill="' + INK + '"/><circle cx="' + ER + '" cy="' + EY + '" r="4.5" fill="' + INK + '"/>'; break;
      case 'wide':
        g = eye(EL, EY, 16, 17, 0, 0, 3.5) + eye(ER, EY, 16, 17, 0, 0, 3.5); break;
      case 'happy':
        g = '<path d="M64 99 Q76 84 88 99 M112 99 Q124 84 136 99" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>'; break;
      case 'sunglasses':
        g = '<rect x="56" y="84" width="38" height="24" rx="9" fill="#141414"/><rect x="106" y="84" width="38" height="24" rx="9" fill="#141414"/>' +
          '<path d="M94 92 L106 92" stroke="#141414" stroke-width="4"/><path d="M40 90 L56 90 M144 90 L160 90" stroke="#141414" stroke-width="3"/>' +
          '<path d="M62 90 L72 90 M112 90 L122 90" stroke="#7b8ea8" stroke-width="3" stroke-linecap="round"/>'; break;
      case 'sparkle':
        g = '<ellipse cx="' + EL + '" cy="' + EY + '" rx="13" ry="15" fill="' + INK + '"/><ellipse cx="' + ER + '" cy="' + EY + '" rx="13" ry="15" fill="' + INK + '"/>' +
          '<circle cx="71" cy="90" r="5" fill="#fff"/><circle cx="81" cy="102" r="2.5" fill="#fff"/><circle cx="119" cy="90" r="5" fill="#fff"/><circle cx="129" cy="102" r="2.5" fill="#fff"/>'; break;
      case 'smug':
        g = eye(EL, EY, 12, 10, 5, 2, 4.5) + eye(ER, EY, 12, 10, 5, 2, 4.5) +
          '<rect x="60" y="82" width="32" height="10" fill="' + skin + '"/><rect x="108" y="82" width="32" height="10" fill="' + skin + '"/>' +
          '<path d="M63 92 L89 92 M111 92 L137 92" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>'; break;
      case 'cross':
        g = '<path d="M66 86 L86 106 M86 86 L66 106 M114 86 L134 106 M134 86 L114 106" stroke="' + INK + '" stroke-width="4.5" stroke-linecap="round"/>'; break;
      case 'teary':
        g = eye(EL, EY, 13, 14, 0, -2, 6) + eye(ER, EY, 13, 14, 0, -2, 6) +
          '<path class="tear" d="M70 110 Q66 130 70 150 L76 150 Q78 130 78 110Z M122 110 Q120 130 124 150 L130 150 Q134 130 130 110Z" fill="#7cc4f2" opacity=".85"/>'; break;
      case 'spiral':
        g = '<circle cx="' + EL + '" cy="' + EY + '" r="14" fill="#fff" stroke="' + INK + '" stroke-width="3"/><circle cx="' + ER + '" cy="' + EY + '" r="14" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M76 96 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 1 1 5 5 a8 8 0 1 1 -8 -8" fill="none" stroke="' + INK + '" stroke-width="2.4"/>' +
          '<path d="M124 96 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 1 1 5 5 a8 8 0 1 1 -8 -8" fill="none" stroke="' + INK + '" stroke-width="2.4"/>'; break;
      default:
        g = eye(EL, EY, 11, 12, 0, 1, 5) + eye(ER, EY, 11, 12, 0, 1, 5);
    }
    return '<g class="eyes">' + g + '</g>';
  }

  function drawBrows(type) {
    var s = 'fill="none" stroke="' + INK + '" stroke-linecap="round"';
    switch (type) {
      case 'thick': return '<path d="M60 76 Q76 66 92 74 M108 74 Q124 66 140 76" ' + s + ' stroke-width="8"/>';
      case 'angry': return '<path d="M60 70 L90 80 M140 70 L110 80" ' + s + ' stroke-width="6"/>';
      case 'worried': return '<path d="M62 80 L90 70 M138 80 L110 70" ' + s + ' stroke-width="5"/>';
      case 'uni': return '<path d="M58 76 Q70 66 84 74 Q100 80 116 74 Q130 66 142 76" ' + s + ' stroke-width="8"/>';
      case 'up': return '<path d="M62 70 Q76 60 90 68 M110 68 Q124 60 138 70" ' + s + ' stroke-width="4"/>';
      case 'none': return '';
      default: return '<path d="M64 76 Q76 70 88 75 M112 75 Q124 70 136 76" ' + s + ' stroke-width="4"/>';
    }
  }

  function drawMouth(type) {
    var st = 'stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"';
    switch (type) {
      case 'grin':
        return '<path d="M78 130 Q100 158 122 130 Z" fill="#5c2020" ' + st + '/><path d="M82 132 L118 132 L116 138 L84 138Z" fill="#fff"/>';
      case 'open':
        return '<ellipse cx="100" cy="138" rx="9" ry="11" fill="#5c2020" ' + st + '/><ellipse cx="100" cy="143" rx="5" ry="4" fill="#e5767a"/>';
      case 'drool':
        return '<ellipse cx="98" cy="137" rx="10" ry="8" fill="#5c2020" ' + st + '/>' +
          '<path class="drool" d="M106 141 Q108 152 106 160 Q110 166 113 160 Q111 150 110 140Z" fill="#bfe6ff" stroke="#7fb8dc" stroke-width="1.5"/>';
      case 'teeth':
        return '<path d="M82 132 Q100 142 118 132" fill="none" ' + st + '/><rect x="93" y="134" width="7" height="10" rx="1.5" fill="#fff" stroke="' + INK + '" stroke-width="2"/><rect x="100" y="134" width="7" height="10" rx="1.5" fill="#fff" stroke="' + INK + '" stroke-width="2"/>';
      case 'wavy':
        return '<path d="M82 138 L88 133 L94 139 L100 133 L106 139 L112 133 L118 138" fill="none" ' + st + '/>';
      case 'flat':
        return '<path d="M86 138 L114 138" ' + st + '/>';
      case 'shout':
        return '<path d="M80 128 Q100 124 120 128 Q122 158 100 160 Q78 158 80 128Z" fill="#5c2020" ' + st + '/><path d="M88 150 Q100 142 112 150 Q106 158 100 158 Q94 158 88 150Z" fill="#e5767a"/><path d="M84 130 L116 130 L114 135 L86 135Z" fill="#fff"/>';
      case 'frown':
        return '<path d="M86 144 Q100 130 114 144" fill="none" ' + st + '/>';
      case 'smirk':
        return '<path d="M86 138 Q104 144 118 128" fill="none" ' + st + '/>';
      case 'cat':
        return '<path d="M86 134 Q93 143 100 134 Q107 143 114 134" fill="none" ' + st + '/>';
      case 'o':
        return '<circle cx="100" cy="138" r="5" fill="#5c2020" ' + st + '/>';
      default:
        return '<path d="M84 132 Q100 148 116 132" fill="none" ' + st + '/>';
    }
  }

  function drawNose(type) {
    if (type === 'big') return '<ellipse cx="100" cy="116" rx="9" ry="7" fill="rgba(0,0,0,.08)" stroke="' + INK + '" stroke-width="2.5"/>';
    if (type === 'red') return '<ellipse cx="100" cy="116" rx="9" ry="7" fill="#f08080" stroke="' + INK + '" stroke-width="2.5"/>';
    return '<path d="M97 112 Q100 120 104 116" fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>';
  }

  /* ── 머리/모자 ───────────────────────────────────── */
  function headPath(shape) {
    switch (shape) {
      case 'egg': return '<ellipse cx="100" cy="100" rx="56" ry="66"/>';
      case 'wide': return '<ellipse cx="100" cy="102" rx="72" ry="56"/>';
      case 'square': return '<rect x="40" y="40" width="120" height="118" rx="34"/>';
      case 'potato': return '<path d="M44 92 Q40 46 96 38 Q156 34 160 90 Q166 150 112 160 Q46 166 44 92Z"/>';
      default: return '<ellipse cx="100" cy="100" rx="63" ry="60"/>';
    }
  }

  function drawHairBack(type) {
    if (type === 'long') return '<path d="M34 100 Q30 40 100 34 Q170 40 166 100 L172 196 Q100 214 28 196Z" fill="#3a2a22"/>';
    if (type === 'perm') {
      var s = '';
      var pts = [[42, 70], [36, 96], [40, 122], [52, 52], [70, 38], [92, 32], [114, 32], [136, 40], [152, 54], [162, 76], [166, 100], [160, 124]];
      for (var i = 0; i < pts.length; i++) s += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="17" fill="#4a3426" stroke="#2c1e16" stroke-width="2"/>';
      return s;
    }
    return '';
  }

  function drawHairFront(type, clipId) {
    switch (type) {
      case 'buzz':
        return '<g clip-path="url(#' + clipId + ')"><path d="M20 74 Q100 46 180 74 L180 0 L20 0Z" fill="#3b3128" opacity=".42"/>' +
          '<path d="M20 74 Q100 46 180 74" fill="none" stroke="#3b3128" stroke-width="1.5" stroke-dasharray="1 4" opacity=".6"/></g>';
      case 'side':
        return '<g clip-path="url(#' + clipId + ')"><path d="M20 80 Q40 50 80 56 Q120 40 180 70 L180 0 L20 0Z" fill="#2c241e"/></g>';
      case 'long':
        return '<g clip-path="url(#' + clipId + ')"><path d="M20 86 Q60 40 100 58 Q140 40 180 86 L180 0 L20 0Z" fill="#3a2a22"/></g>';
      case 'perm':
        return '<g clip-path="url(#' + clipId + ')"><path d="M20 68 Q100 50 180 68 L180 0 L20 0Z" fill="#4a3426"/></g>';
      case 'bald':
        return '<ellipse cx="80" cy="56" rx="16" ry="8" fill="#fff" opacity=".45"/>';
      default: return '';
    }
  }

  function rankPatch(rank, x, y) {
    var s = '';
    if (!rank) return '';
    if (/^e[0-4]$/.test(rank)) {
      var n = +rank[1];
      s += '<rect x="' + x + '" y="' + y + '" width="22" height="16" rx="2" fill="#4a5130" stroke="' + INK + '" stroke-width="1.5"/>';
      if (n === 0) s += '<text x="' + (x + 11) + '" y="' + (y + 12) + '" font-size="9" text-anchor="middle" fill="#e8e2c4" font-weight="700">훈</text>';
      for (var i = 0; i < n; i++) s += '<rect x="' + (x + 3) + '" y="' + (y + 2.5 + i * 3.2) + '" width="16" height="2" fill="#111"/>';
    } else if (rank === 'o1' || rank === 'o3') {
      var k = rank === 'o1' ? 1 : 3;
      s += '<rect x="' + (x - 4) + '" y="' + y + '" width="30" height="16" rx="2" fill="#4a5130" stroke="' + INK + '" stroke-width="1.5"/>';
      for (var j = 0; j < k; j++) {
        var cx = x + 11 + (j - (k - 1) / 2) * 8;
        s += '<path d="M' + cx + ' ' + (y + 3) + ' L' + (cx + 3.5) + ' ' + (y + 8) + ' L' + cx + ' ' + (y + 13) + ' L' + (cx - 3.5) + ' ' + (y + 8) + 'Z" fill="#111"/>';
      }
    } else if (rank === 'nco') {
      s += '<rect x="' + x + '" y="' + y + '" width="22" height="16" rx="2" fill="#4a5130" stroke="' + INK + '" stroke-width="1.5"/>';
      for (var q = 0; q < 3; q++) s += '<path d="M' + (x + 4) + ' ' + (y + 4 + q * 3.5) + ' L' + (x + 11) + ' ' + (y + 7 + q * 3.5) + ' L' + (x + 18) + ' ' + (y + 4 + q * 3.5) + '" fill="none" stroke="#111" stroke-width="1.6"/>';
    } else if (rank === 'gen') {
      s += '<rect x="' + (x - 6) + '" y="' + y + '" width="34" height="16" rx="2" fill="#1d2414" stroke="' + INK + '" stroke-width="1.5"/>' +
        star(x + 4, y + 8, 5, '#ffd34d') + star(x + 18, y + 8, 5, '#ffd34d');
    }
    return s;
  }

  function star(cx, cy, r, fill) {
    var p = '';
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      p += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return '<path d="' + p + 'Z" fill="' + fill + '" stroke="#7a5a00" stroke-width="1"/>';
  }

  function drawHat(type, camoId, rank, dy) {
    dy = dy || 0;
    // 모자 챙이 눈(졸린 눈 눈꺼풀 포함)을 가리지 않게 조금씩 올린다
    if (type === 'helmet' || type === 'helmetBig' || type === 'gold') dy -= 11;
    if (type === 'cap' || type === 'general' || type === 'jogyo') dy -= 12;
    if (type === 'beanie') dy -= 6;
    var t = function (s) { return dy ? '<g transform="translate(0 ' + dy + ')">' + s + '</g>' : s; };
    switch (type) {
      case 'cap':
        return t('<path d="M40 70 Q38 24 100 22 Q162 24 160 70 Z" fill="url(#' + camoId + ')" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M36 70 Q100 80 164 70 L170 78 Q100 96 30 78 Z" fill="#4d5a32" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
          (rank ? rankPatch(rank, 89, 44) : ''));
      case 'general':
        return t('<path d="M40 70 Q38 24 100 22 Q162 24 160 70 Z" fill="url(#' + camoId + ')" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M36 70 Q100 80 164 70 L170 78 Q100 96 30 78 Z" fill="#2f3a1e" stroke="' + INK + '" stroke-width="3"/>' +
          star(84, 50, 9, '#ffd34d') + star(116, 50, 9, '#ffd34d'));
      case 'jogyo':
        return t('<path d="M40 70 Q38 24 100 22 Q162 24 160 70 Z" fill="url(#' + camoId + ')" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M36 70 Q100 80 164 70 L170 78 Q100 96 30 78 Z" fill="#4d5a32" stroke="' + INK + '" stroke-width="3"/>' +
          '<rect x="80" y="38" width="40" height="18" rx="3" fill="#ffcf3a" stroke="' + INK + '" stroke-width="2"/>' +
          '<text x="100" y="52" font-size="12" font-weight="800" text-anchor="middle" fill="#a8121b">조교</text>');
      case 'helmet':
      case 'helmetBig': {
        var big = type === 'helmetBig';
        var o = 0; // 큰 방탄모도 눈은 가리지 않게 (턱끈 없이 헐렁한 것만 다르다)
        return '<g transform="translate(0 ' + (o + dy) + ')">' +
          '<path d="M30 84 Q26 14 100 12 Q174 14 170 84 Q100 72 30 84Z" fill="url(#' + camoId + ')" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M28 84 Q100 70 172 84 L174 92 Q100 80 26 92Z" fill="#3e4a28" stroke="' + INK + '" stroke-width="2.5"/>' +
          '<path d="M44 40 L156 40 M40 58 L160 58 M70 16 L60 84 M100 12 L100 74 M130 16 L140 84" stroke="#2f3720" stroke-width="2" opacity=".55"/>' +
          '</g>' + (big ? '' : '<path d="M36 90 Q48 140 88 156 M164 90 Q152 140 112 156" fill="none" stroke="#2f3720" stroke-width="3"/>');
      }
      case 'chef':
        return '<g transform="translate(0 ' + (6 + dy) + ')">' + ('<circle cx="70" cy="30" r="20" fill="#fff" stroke="' + INK + '" stroke-width="3"/><circle cx="100" cy="20" r="24" fill="#fff" stroke="' + INK + '" stroke-width="3"/><circle cx="130" cy="30" r="20" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
          '<rect x="54" y="34" width="92" height="34" rx="6" fill="#fff" stroke="' + INK + '" stroke-width="3"/><path d="M60 56 L140 56" stroke="#ddd" stroke-width="3"/>') + '</g>';
      case 'beanie':
        return t('<path d="M40 74 Q40 22 100 20 Q160 22 160 74Z" fill="#5f6a3a" stroke="' + INK + '" stroke-width="3"/>' +
          '<rect x="36" y="62" width="128" height="18" rx="8" fill="#4d5730" stroke="' + INK + '" stroke-width="3"/>' +
          '<circle cx="100" cy="18" r="10" fill="#4d5730" stroke="' + INK + '" stroke-width="3"/>');
      case 'beret':
        return t('<path d="M34 70 Q30 30 96 26 Q168 24 166 62 Q140 74 34 70Z" fill="#26331f" stroke="' + INK + '" stroke-width="3"/>' +
          '<circle cx="66" cy="54" r="8" fill="#d6b54a" stroke="' + INK + '" stroke-width="2"/>');
      case 'gold':
        return t('<path d="M30 84 Q26 14 100 12 Q174 14 170 84 Q100 72 30 84Z" fill="#f2c335" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M28 84 Q100 70 172 84 L174 92 Q100 80 26 92Z" fill="#c9971d" stroke="' + INK + '" stroke-width="2.5"/>' +
          '<path d="M60 30 Q80 20 96 22" fill="none" stroke="#fff6c8" stroke-width="7" stroke-linecap="round"/>' +
          star(100, 48, 11, '#fff4a3'));
      case 'crown':
        return t('<path d="M46 66 L40 22 L70 44 L100 12 L130 44 L160 22 L154 66Z" fill="#ffd34d" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
          '<rect x="44" y="60" width="112" height="14" rx="4" fill="#e0a92a" stroke="' + INK + '" stroke-width="3"/>' +
          '<circle cx="100" cy="40" r="6" fill="#e3342f" stroke="' + INK + '" stroke-width="2"/><circle cx="68" cy="56" r="5" fill="#3a86ff" stroke="' + INK + '" stroke-width="2"/><circle cx="132" cy="56" r="5" fill="#2ec27e" stroke="' + INK + '" stroke-width="2"/>');
      case 'cateears':
        return t('<path d="M44 66 L50 18 L86 50Z M156 66 L150 18 L114 50Z" fill="#f4a261" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
          '<path d="M54 54 L56 32 L74 50Z M146 54 L144 32 L126 50Z" fill="#ffc8dd"/>' +
          '<path d="M44 62 Q100 44 156 62" fill="none" stroke="#e76f51" stroke-width="6" stroke-linecap="round"/>');
      case 'headband':
        return t('<path d="M38 62 Q100 44 162 62 L162 78 Q100 60 38 78Z" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
          '<circle cx="100" cy="64" r="9" fill="#e3342f"/>' +
          '<text x="70" y="72" font-size="11" font-weight="900" text-anchor="middle" fill="#e3342f">전</text><text x="130" y="72" font-size="11" font-weight="900" text-anchor="middle" fill="#e3342f">역</text>' +
          '<path d="M162 66 L186 58 L180 76Z M162 70 L184 86 L172 92Z" fill="#fff" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>');
      case 'afro': {
        var cols = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
        var a = '';
        var pts = [[38, 66], [34, 46], [48, 28], [72, 20], [100, 18], [128, 20], [152, 28], [166, 46], [162, 66], [64, 40], [100, 36], [136, 40]];
        for (var i = 0; i < pts.length; i++) a += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="18" fill="' + cols[i % cols.length] + '" stroke="' + INK + '" stroke-width="2"/>';
        return t(a);
      }
      default: return '';
    }
  }

  /* ── 몸통 ────────────────────────────────────────── */
  function drawBody(type, camoId, rank, nameTag) {
    var shoulders = 'M30 232 Q32 176 100 168 Q168 176 170 232 Z';
    var s = '';
    switch (type) {
      case 'kkal': {
        var q = '';
        for (var i = 0; i < 9; i++) q += '<path d="M' + (20 + i * 20) + ' 160 L' + (i * 20 - 40) + ' 240 M' + (i * 20 - 20) + ' 160 L' + (40 + i * 20) + ' 240" stroke="#5e5e2a" stroke-width="1.6"/>';
        s = '<path d="' + shoulders + '" fill="#a39b4f" stroke="' + INK + '" stroke-width="3"/>' +
          '<g clip-path="url(#' + camoId + 'b)">' + q + '</g>' +
          '<path d="M78 172 L100 196 L122 172" fill="none" stroke="#5e5e2a" stroke-width="5" stroke-linecap="round"/>';
        break;
      }
      case 'pt':
        s = '<path d="' + shoulders + '" fill="#3b3d42" stroke="' + INK + '" stroke-width="3"/>' +
          '<text x="100" y="214" font-size="20" font-weight="900" text-anchor="middle" fill="#e9e9e9" letter-spacing="2">ARMY</text>' +
          '<path d="M80 172 Q100 186 120 172" fill="none" stroke="#9aa0a8" stroke-width="4"/>';
        break;
      case 'chef':
        s = '<path d="' + shoulders + '" fill="#fbfbf7" stroke="' + INK + '" stroke-width="3"/>' +
          '<circle cx="90" cy="196" r="3" fill="' + INK + '"/><circle cx="110" cy="196" r="3" fill="' + INK + '"/><circle cx="90" cy="214" r="3" fill="' + INK + '"/><circle cx="110" cy="214" r="3" fill="' + INK + '"/>' +
          '<path d="M78 172 L100 186 L122 172" fill="none" stroke="#c9c9c0" stroke-width="4"/>';
        break;
      case 'white':
        s = '<path d="' + shoulders + '" fill="#f7f9f9" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M86 170 L100 232 L114 170" fill="url(#' + camoId + ')" stroke="' + INK + '" stroke-width="2"/>' +
          '<path d="M72 176 Q64 204 84 214" fill="none" stroke="#5c6b7a" stroke-width="3"/><circle cx="85" cy="215" r="5" fill="#5c6b7a"/>';
        break;
      case 'civil':
        s = '<path d="' + shoulders + '" fill="#f29bb3" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M84 170 L100 232 L116 170" fill="#fff4d6" stroke="' + INK + '" stroke-width="2"/>' +
          '<circle cx="100" cy="204" r="3" fill="#b8506d"/><circle cx="100" cy="220" r="3" fill="#b8506d"/>';
        break;
      case 'civil2':
        s = '<path d="' + shoulders + '" fill="#8fc6ea" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M84 174 L86 204 M116 174 L114 204" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
          '<rect x="80" y="214" width="40" height="16" rx="6" fill="#7ab4da" stroke="' + INK + '" stroke-width="2"/>';
        break;
      case 'dress': // 정복: 짙은 녹색 재킷, 흰 셔츠, 넥타이, 금단추, 약장
        s = '<path d="' + shoulders + '" fill="#2f4a2a" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M84 170 L100 214 L116 170Z" fill="#fff" stroke="' + INK + '" stroke-width="2"/>' +
          '<path d="M96 176 L104 176 L106 206 L100 214 L94 206Z" fill="#26331f"/>' +
          '<path d="M74 172 L100 232 M126 172 L100 232" stroke="#203520" stroke-width="3"/>' +
          '<circle cx="100" cy="220" r="3" fill="#e0b347"/>' +
          '<rect x="120" y="188" width="26" height="9" fill="#c4362b"/><rect x="120" y="188" width="9" height="9" fill="#3a86ff"/><rect x="137" y="188" width="9" height="9" fill="#e0b347"/>' +
          '<path d="M52 186 Q62 178 74 180" stroke="#e0b347" stroke-width="3" fill="none"/>';
        break;
      default: // camo 전투복
        s = '<path d="' + shoulders + '" fill="url(#' + camoId + ')" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M76 172 L100 194 L124 172" fill="none" stroke="#3e4a28" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
          (nameTag ? '<rect x="118" y="196" width="34" height="11" rx="1.5" fill="#3e4a28"/><text x="135" y="205" font-size="8.5" font-weight="700" text-anchor="middle" fill="#e6e2c8">' + escapeXml(nameTag) + '</text>' : '') +
          (rank ? rankPatch(rank, 89, 200) : '');
    }
    return s;
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; });
  }

  /* ── 소품 ───────────────────────────────────────── */
  function drawProp(type) {
    var hand = '<circle cx="158" cy="206" r="13" fill="{skin}" stroke="' + INK + '" stroke-width="3"/>';
    switch (type) {
      case 'shovel':
        return '<g class="prop"><path d="M150 230 L184 108" stroke="#8a5a2b" stroke-width="8" stroke-linecap="round"/>' +
          '<path d="M178 112 L170 84 Q178 60 196 70 L200 98Z" fill="#9aa3a8" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
          hand + '</g>';
      case 'flashlight':
        return '<g class="prop"><path d="M166 190 L200 120 L200 230Z" fill="#fff6a8" opacity=".55"/>' +
          '<rect x="150" y="186" width="30" height="14" rx="4" fill="#222" transform="rotate(-25 165 193)"/>' + hand + '</g>';
      case 'ladle':
        return '<g class="prop"><path d="M156 214 L176 120" stroke="#9aa3a8" stroke-width="6" stroke-linecap="round"/><ellipse cx="178" cy="112" rx="16" ry="11" fill="#c5ccd0" stroke="' + INK + '" stroke-width="3"/>' + hand + '</g>';
      case 'phone':
        return '<g class="prop"><rect x="150" y="160" width="26" height="44" rx="5" fill="#222" stroke="' + INK + '" stroke-width="2"/><rect x="153" y="165" width="20" height="32" rx="2" fill="#7fd1ff"/>' + hand + '</g>';
      case 'chocopie':
        return '<g class="prop"><circle cx="170" cy="182" r="20" fill="#d4282e" stroke="' + INK + '" stroke-width="3"/><circle cx="170" cy="182" r="13" fill="#5b3418"/><path d="M162 178 Q170 172 178 178" stroke="#fff" stroke-width="2" fill="none"/>' + hand + '</g>';
      case 'pill':
        return '<g class="prop"><rect x="152" y="160" width="34" height="16" rx="8" fill="#fff" stroke="' + INK + '" stroke-width="3" transform="rotate(-30 169 168)"/><path d="M162 176 L176 160" stroke="#e23b3b" stroke-width="8" stroke-linecap="round"/>' + hand + '</g>';
      case 'megaphone':
        return '<g class="prop" transform="translate(-8 0)"><path d="M150 196 L186 168 L196 204 Z" fill="#f2f2f2" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><ellipse cx="191" cy="186" rx="7" ry="18" fill="#e23b3b" stroke="' + INK + '" stroke-width="3" transform="rotate(-20 191 186)"/>' + hand + '</g>';
      case 'broom':
        return '<g class="prop"><path d="M154 226 L176 110" stroke="#a0763e" stroke-width="6" stroke-linecap="round"/><path d="M166 116 L170 70 M174 114 L184 72 M178 118 L196 82 M170 116 L160 74" stroke="#c9a24b" stroke-width="4" stroke-linecap="round"/>' + hand + '</g>';
      case 'clipboard':
        return '<g class="prop"><rect x="144" y="150" width="40" height="52" rx="4" fill="#b98a4e" stroke="' + INK + '" stroke-width="3"/><rect x="149" y="160" width="30" height="38" fill="#fff"/><path d="M153 168 L175 168 M153 176 L175 176 M153 184 L168 184" stroke="#999" stroke-width="2"/>' + hand + '</g>';
      case 'mic':
        return '<g class="prop"><path d="M160 200 L172 150" stroke="#333" stroke-width="5"/><circle cx="174" cy="144" r="10" fill="#555" stroke="' + INK + '" stroke-width="3"/>' + hand + '</g>';
      case 'spoon':
        return '<g class="prop"><path d="M156 214 L172 132" stroke="#c7cdd1" stroke-width="5" stroke-linecap="round"/><ellipse cx="173" cy="124" rx="7" ry="11" fill="#dfe4e7" stroke="' + INK + '" stroke-width="2.5"/>' + hand + '</g>';
      case 'flower':
        return '<g class="prop"><path d="M158 210 L166 150" stroke="#3d8a3d" stroke-width="4"/>' +
          '<circle cx="160" cy="144" r="9" fill="#ff7aa2" stroke="' + INK + '" stroke-width="2"/><circle cx="176" cy="140" r="9" fill="#ffd166" stroke="' + INK + '" stroke-width="2"/><circle cx="168" cy="130" r="9" fill="#9ad0f5" stroke="' + INK + '" stroke-width="2"/>' + hand + '</g>';
      default: return '';
    }
  }

  function drawExtras(list, skin) {
    var s = '';
    list = list || [];
    function has(k) { return list.indexOf(k) >= 0; }
    if (has('stubble')) {
      var d = '';
      var pts = [[78, 146], [86, 152], [94, 156], [102, 157], [110, 155], [118, 150], [124, 144], [72, 140], [128, 138], [90, 160], [106, 161]];
      for (var i = 0; i < pts.length; i++) d += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="1.6" fill="#3b3128" opacity=".7"/>';
      s += d;
    }
    if (has('blush')) s += '<ellipse cx="62" cy="120" rx="11" ry="6" fill="#ff8a8a" opacity=".5"/><ellipse cx="138" cy="120" rx="11" ry="6" fill="#ff8a8a" opacity=".5"/>';
    if (has('mustache')) s += '<path d="M78 128 Q88 118 100 126 Q112 118 122 128 Q112 134 100 129 Q88 134 78 128Z" fill="#2c241e"/>';
    if (has('glasses')) s += '<g fill="none" stroke="' + INK + '" stroke-width="3.5"><circle cx="76" cy="96" r="17"/><circle cx="124" cy="96" r="17"/><path d="M93 94 Q100 89 107 94 M59 92 L40 88 M141 92 L160 88"/></g><path d="M66 88 L72 84 M114 88 L120 84" stroke="#fff" stroke-width="3" stroke-linecap="round"/>';
    if (has('bandage')) s += '<g transform="rotate(-20 136 70)"><rect x="122" y="64" width="30" height="11" rx="3" fill="#f3d3a3" stroke="' + INK + '" stroke-width="2"/></g><g transform="rotate(70 136 70)"><rect x="122" y="64" width="30" height="11" rx="3" fill="#f3d3a3" stroke="' + INK + '" stroke-width="2"/></g>';
    if (has('mask')) s += '<path d="M66 118 Q100 112 134 118 L130 150 Q100 162 70 150Z" fill="#f4f7fb" stroke="' + INK + '" stroke-width="2.5"/><path d="M74 128 L126 128 M74 138 L126 138" stroke="#c8d2de" stroke-width="2"/><path d="M66 120 L42 108 M134 120 L158 108" stroke="' + INK + '" stroke-width="2"/>';
    if (has('anger')) s += '<g transform="translate(140 52)" stroke="#e3342f" stroke-width="4" stroke-linecap="round" fill="none"><path d="M-8 -2 Q-2 -2 -2 -8 M2 -8 Q2 -2 8 -2 M8 2 Q2 2 2 8 M-2 8 Q-2 2 -8 2"/></g>';
    if (has('sweat')) s += '<path class="sweat" d="M156 60 Q148 74 152 80 Q158 86 164 80 Q168 72 156 60Z" fill="#8fd3ff" stroke="#4a9fd0" stroke-width="2"/>';
    if (has('snot')) s += '<circle class="snot" cx="108" cy="124" r="9" fill="#cfefff" stroke="#8ccbe8" stroke-width="2" opacity=".85"/><circle cx="105" cy="121" r="2.5" fill="#fff"/>';
    if (has('zzz')) s += '<g class="zzz" fill="#5a6b8c" font-weight="900"><text x="150" y="44" font-size="22">Z</text><text x="168" y="26" font-size="15">z</text><text x="180" y="14" font-size="11">z</text></g>';
    if (has('sparkles')) s += '<g class="spark">' + star(30, 40, 8, '#fff4a3') + star(172, 52, 6, '#fff4a3') + star(160, 22, 5, '#fff4a3') + '</g>';
    if (has('tear')) s += '<path class="tear" d="M66 108 Q62 118 66 124 Q72 128 74 120 Q72 114 66 108Z" fill="#8fd3ff" stroke="#4a9fd0" stroke-width="1.5"/>';
    if (has('bruise')) s += '<ellipse cx="124" cy="96" rx="20" ry="18" fill="#7b5aa6" opacity=".35"/>';
    return s;
  }

  /* ── 캐릭터 조립 ───────────────────────────────────── */
  function character(spec, opts) {
    spec = spec || {};
    opts = opts || {};
    var id = uid();
    var seed = hash(spec.seed || spec.name || id);
    var skin = spec.skin || SKINS[seed % SKINS.length];
    var camoId = id + 'c';
    var clipId = id + 'h';
    var eyes = opts.eyes || spec.eyes || 'normal';
    var mouth = opts.mouth || spec.mouth || 'smile';
    var extras = (spec.extras || []).concat(opts.extras || []);
    var hat = spec.hat === undefined ? 'none' : spec.hat;
    var hair = spec.hair || (hat === 'none' || hat === 'chef' ? 'buzz' : 'none');
    var big = extras.indexOf('bigEars') >= 0;
    var shape = spec.head || 'round';
    var earX = shape === 'wide' ? 30 : shape === 'egg' ? 44 : 38;

    var bodyType = spec.body || 'camo';
    var BODY_CAMO = { pinkcamo: ['#f4a6c3', '#e57aa3', '#fbd3e1', '#c95583'], goldcamo: ['#e8c25a', '#c99a2e', '#f6e3a1', '#8a6a18'] };
    var bodyCamoId = BODY_CAMO[bodyType] ? id + 'bc' : camoId;
    var defs = '<defs>' + camoPattern(camoId, seed) + (BODY_CAMO[bodyType] ? camoPattern(bodyCamoId, seed + 7, BODY_CAMO[bodyType]) : '') +
      '<clipPath id="' + clipId + '">' + headPath(shape) + '</clipPath>' +
      '<clipPath id="' + camoId + 'b"><path d="M30 232 Q32 176 100 168 Q168 176 170 232 Z"/></clipPath></defs>';

    var svg = '<svg class="char" viewBox="0 0 200 232" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + defs +
      '<ellipse cx="100" cy="228" rx="70" ry="8" fill="rgba(0,0,0,.12)"/>' +
      '<g class="bob">' +
      drawBody(BODY_CAMO[bodyType] ? 'camo' : bodyType, bodyCamoId, spec.rank, spec.tag) +
      '<g class="head">' +
      drawHairBack(hair) +
      '<circle cx="' + (200 - earX) + '" cy="106" r="' + (big ? 20 : 13) + '" fill="' + skin + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="' + earX + '" cy="106" r="' + (big ? 20 : 13) + '" fill="' + skin + '" stroke="' + INK + '" stroke-width="3"/>' +
      headPath(shape).replace('/>', ' fill="' + skin + '" stroke="' + INK + '" stroke-width="3.5"/>') +
      drawHairFront(hair, clipId) +
      drawBrows(spec.brows) +
      drawEyes(eyes, skin) +
      drawNose(spec.nose) +
      '<g class="mouth">' + drawMouth(mouth) + '</g>' +
      '<g class="extras">' + drawExtras(extras, skin) + '</g>' +
      '<g class="hat">' + drawHat(hat, camoId, spec.hatRank, spec.hatDy) + '</g>' +
      '</g>' +
      drawProp(spec.prop).replace(/\{skin\}/g, skin) +
      '</g></svg>';
    return svg;
  }

  /* ── 동물 & 사물 ───────────────────────────────────── */
  function cat(opts) {
    opts = opts || {};
    var mood = opts.mood || 'derp';
    var eyes = mood === 'happy'
      ? '<path d="M68 104 Q78 94 88 104 M112 104 Q122 94 132 104" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>'
      : '<ellipse cx="78" cy="102" rx="11" ry="9" fill="#d9f27a" stroke="' + INK + '" stroke-width="3"/><rect x="76" y="94" width="4" height="16" rx="2" fill="' + INK + '"/>' +
        '<ellipse cx="122" cy="104" rx="8" ry="7" fill="#d9f27a" stroke="' + INK + '" stroke-width="3"/><rect x="121" y="98" width="3" height="12" rx="1.5" fill="' + INK + '"/>' +
        '<path d="M66 96 L90 98 M110 98 L132 98" stroke="#b46a1d" stroke-width="6"/>';
    return '<svg class="char" viewBox="0 0 200 232" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<ellipse cx="100" cy="228" rx="76" ry="8" fill="rgba(0,0,0,.12)"/>' +
      '<g class="bob">' +
      '<path class="tail" d="M156 210 Q196 190 184 150 Q178 136 170 146 Q182 176 150 196Z" fill="#e8913a" stroke="' + INK + '" stroke-width="3"/>' +
      '<ellipse cx="100" cy="196" rx="70" ry="44" fill="#e8913a" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<ellipse cx="100" cy="206" rx="40" ry="26" fill="#fff1dc"/>' +
      '<g class="head">' +
      '<path d="M44 82 L50 30 L84 62Z M156 82 L150 30 L116 62Z" fill="#e8913a" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M54 66 L56 44 L72 60Z M146 66 L144 44 L128 60Z" fill="#f7b7b7"/>' +
      '<ellipse cx="100" cy="108" rx="66" ry="54" fill="#e8913a" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M92 58 L94 76 M100 56 L100 78 M108 58 L106 76 M40 108 L58 106 M42 120 L60 116 M160 108 L142 106 M158 120 L140 116" stroke="#b46a1d" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M136 72 L148 92" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>' +
      eyes +
      '<path d="M94 118 L106 118 L100 125Z" fill="#f28fa1" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M86 128 Q93 137 100 128 Q107 137 114 128" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M60 124 L30 118 M60 130 L32 134 M140 124 L170 118 M140 130 L168 134" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>' +
      (opts.fish ? '<g transform="translate(118 132) rotate(20)"><path d="M0 0 L30 0 M6 -6 L6 6 M14 -7 L14 7 M22 -6 L22 6" stroke="#f2f2f2" stroke-width="3" stroke-linecap="round"/><path d="M30 0 L40 -8 L40 8Z" fill="#f2f2f2"/></g>' : '') +
      (opts.cap ? '<g transform="translate(0 -8)"><path d="M58 68 Q60 36 100 34 Q140 36 142 68 Z" fill="#6d7a48" stroke="' + INK + '" stroke-width="3"/><path d="M54 68 Q100 76 146 68 L150 74 Q100 88 50 74Z" fill="#4d5a32" stroke="' + INK + '" stroke-width="3"/>' + rankPatch('e1', 89, 46) + '</g>' : '') +
      '</g></g></svg>';
  }

  function boar() {
    return '<svg class="char" viewBox="0 0 200 232" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<ellipse cx="100" cy="228" rx="80" ry="8" fill="rgba(0,0,0,.14)"/>' +
      '<g class="bob shake">' +
      '<ellipse cx="100" cy="196" rx="84" ry="46" fill="#6b4a32" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M40 150 L46 132 L52 150 M60 144 L66 126 L72 144 M128 144 L134 126 L140 144 M148 150 L154 132 L160 150" fill="#4a3222" stroke="' + INK + '" stroke-width="2"/>' +
      '<g class="head">' +
      '<path d="M44 70 L36 34 L74 58Z M156 70 L164 34 L126 58Z" fill="#5a3d28" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<ellipse cx="100" cy="104" rx="64" ry="56" fill="#7a5638" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M66 86 L88 96 M134 86 L112 96" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/>' +
      '<circle cx="80" cy="100" r="6" fill="#ff4d3a" stroke="' + INK + '" stroke-width="2"/><circle cx="120" cy="100" r="6" fill="#ff4d3a" stroke="' + INK + '" stroke-width="2"/>' +
      '<ellipse cx="100" cy="134" rx="30" ry="22" fill="#d99a8a" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<ellipse cx="90" cy="134" rx="5" ry="7" fill="#5c2c22"/><ellipse cx="110" cy="134" rx="5" ry="7" fill="#5c2c22"/>' +
      '<path d="M70 140 Q60 128 64 112 M130 140 Q140 128 136 112" fill="none" stroke="#fffbe8" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M70 140 Q60 128 64 112 M130 140 Q140 128 136 112" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>' +
      '</g></g></svg>';
  }

  function speaker() {
    return '<svg class="char" viewBox="0 0 200 232" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="94" y="96" width="12" height="136" fill="#7b7f84" stroke="' + INK + '" stroke-width="3"/>' +
      '<g class="bob">' +
      '<path d="M100 92 L52 52 L40 96 Z" fill="#e9ecef" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M100 92 L148 52 L160 96 Z" fill="#e9ecef" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<ellipse cx="46" cy="74" rx="8" ry="23" fill="#c5cbd1" stroke="' + INK + '" stroke-width="3" transform="rotate(18 46 74)"/>' +
      '<ellipse cx="154" cy="74" rx="8" ry="23" fill="#c5cbd1" stroke="' + INK + '" stroke-width="3" transform="rotate(-18 154 74)"/>' +
      '<g class="wave" fill="none" stroke="#e3342f" stroke-width="4" stroke-linecap="round"><path d="M24 50 Q12 74 24 98"/><path d="M12 40 Q-4 74 12 108"/><path d="M176 50 Q188 74 176 98"/><path d="M188 40 Q204 74 188 108"/></g>' +
      '</g></svg>';
  }

  function letter(opts) {
    opts = opts || {};
    return '<svg class="char" viewBox="0 0 200 232" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<ellipse cx="100" cy="218" rx="70" ry="8" fill="rgba(0,0,0,.12)"/>' +
      '<g class="bob">' +
      '<rect x="24" y="70" width="152" height="110" rx="8" fill="#fffaf0" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<path d="M24 76 L100 136 L176 76" fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M100 120 Q86 104 92 98 Q100 92 100 104 Q100 92 108 98 Q114 104 100 120Z" fill="#ff5d73" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="140" y="84" width="26" height="30" fill="#ffd166" stroke="' + INK + '" stroke-width="2" stroke-dasharray="3 2"/>' +
      '<text x="64" y="168" font-size="13" font-weight="800" fill="#7a5a2b">' + escapeXml(opts.label || '군사우편') + '</text>' +
      '</g></svg>';
  }

  function phone() {
    return '<svg class="char" viewBox="0 0 200 232" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<ellipse cx="100" cy="224" rx="56" ry="7" fill="rgba(0,0,0,.12)"/>' +
      '<g class="bob shake">' +
      '<rect x="56" y="30" width="88" height="180" rx="16" fill="#1f2328" stroke="' + INK + '" stroke-width="3.5"/>' +
      '<rect x="64" y="46" width="72" height="140" rx="6" fill="#6fd08c"/>' +
      '<circle cx="100" cy="96" r="20" fill="#fff" opacity=".9"/><path d="M90 92 Q100 80 110 92 L108 106 L92 106Z" fill="#6fd08c"/>' +
      '<text x="100" y="146" font-size="13" font-weight="800" text-anchor="middle" fill="#fff">수신 중…</text>' +
      '<g class="wave" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"><path d="M40 70 Q30 90 40 110"/><path d="M160 70 Q170 90 160 110"/></g>' +
      '</g></svg>';
  }

  function box() {
    return '<svg class="char" viewBox="0 0 200 232" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<ellipse cx="100" cy="222" rx="74" ry="8" fill="rgba(0,0,0,.12)"/>' +
      '<g class="bob">' +
      '<path d="M30 100 L100 74 L170 100 L170 196 L100 220 L30 196Z" fill="#c9965a" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M30 100 L100 126 L170 100 M100 126 L100 220" fill="none" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M62 88 L132 114 L132 136" fill="none" stroke="#f2e2b1" stroke-width="10"/>' +
      '<text x="62" y="176" font-size="15" font-weight="900" fill="#6b4520" transform="rotate(20 62 176)">엄마♥</text>' +
      '</g></svg>';
  }

  /* ── 배경 ─────────────────────────────────────────── */
  function scene(name, season) {
    var id = uid();
    var b = '';
    var outdoor = true;
    switch (name) {
      case 'barracks':
        outdoor = false;
        b = '<rect width="400" height="300" fill="#efe4c8"/><rect y="210" width="400" height="90" fill="#b98d5e"/>' +
          '<path d="M0 210 L400 210" stroke="#8e6a43" stroke-width="4"/>';
        for (var i = 0; i < 6; i++) b += '<rect x="' + (14 + i * 66) + '" y="70" width="56" height="130" rx="3" fill="#a6b08a" stroke="#6f7a58" stroke-width="3"/><path d="M' + (14 + i * 66) + ' 110 L' + (70 + i * 66) + ' 110" stroke="#6f7a58" stroke-width="2"/><rect x="' + (22 + i * 66) + '" y="80" width="40" height="22" fill="#d9ddc7"/>';
        b += '<rect x="150" y="14" width="100" height="26" rx="4" fill="#fff" stroke="#999" stroke-width="2"/><text x="200" y="33" font-size="15" text-anchor="middle" fill="#444" font-weight="700">생활관</text>';
        break;
      case 'office':
        outdoor = false;
        b = '<rect width="400" height="300" fill="#e3e8ea"/><rect y="220" width="400" height="80" fill="#9aa5ab"/>' +
          '<rect x="112" y="12" width="176" height="96" rx="4" fill="#2f5d4a" stroke="#6b5435" stroke-width="6"/><text x="200" y="33" font-size="14" text-anchor="middle" fill="#e8f5e9" font-weight="700">행정반 근무 편성표</text><path d="M130 52 L270 52 M130 66 L250 66" stroke="#e8f5e9" stroke-width="2"/>' +
          '<circle cx="330" cy="62" r="26" fill="#fff" stroke="#555" stroke-width="5"/><path d="M330 62 L330 44 M330 62 L342 69" stroke="#333" stroke-width="4" stroke-linecap="round"/>' +
          '<rect x="210" y="180" width="180" height="16" fill="#7b5a3a"/>';
        break;
      case 'mess':
        outdoor = false;
        b = '<rect width="400" height="300" fill="#dfeef0"/>';
        for (var x = 0; x < 400; x += 40) for (var y = 0; y < 220; y += 40) b += '<rect x="' + x + '" y="' + y + '" width="38" height="38" fill="#eef7f8"/>';
        b += '<rect y="210" width="400" height="90" fill="#9fb6bb"/><rect x="0" y="190" width="400" height="22" fill="#c0c9cc"/>' +
          '<rect x="164" y="14" width="72" height="26" rx="4" fill="#fff" stroke="#9fb6bb" stroke-width="2"/><text x="200" y="33" font-size="15" text-anchor="middle" fill="#3f5960" font-weight="700">식당</text>';
        break;
      case 'px':
        outdoor = false;
        b = '<rect width="400" height="300" fill="#fff4e0"/><rect y="230" width="400" height="70" fill="#c9b59a"/>';
        var cols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8ecae6', '#ff70a6'];
        for (var r = 0; r < 3; r++) {
          b += '<rect x="10" y="' + (60 + r * 56) + '" width="380" height="6" fill="#8d7a63"/>';
          for (var k = 0; k < 12; k++) b += '<rect x="' + (16 + k * 31) + '" y="' + (34 + r * 56) + '" width="24" height="26" rx="3" fill="' + cols[(k + r) % cols.length] + '"/>';
        }
        b += '<rect x="140" y="14" width="120" height="26" rx="4" fill="#1b4332"/><text x="200" y="32" font-size="14" text-anchor="middle" fill="#fff" font-weight="800">PX (WA마트)</text>';
        break;
      case 'night':
        b = '<rect width="400" height="300" fill="#1d2546"/><circle cx="320" cy="60" r="26" fill="#fff3b0"/><circle cx="332" cy="52" r="24" fill="#1d2546"/>';
        var rr = mulberry(7);
        for (var s = 0; s < 30; s++) b += '<circle cx="' + Math.floor(rr() * 400) + '" cy="' + Math.floor(rr() * 160) + '" r="' + (rr() * 1.8 + 0.6).toFixed(1) + '" fill="#fff" opacity=".8"/>';
        b += '<path d="M0 230 Q100 190 200 220 Q300 250 400 210 L400 300 L0 300Z" fill="#141a33"/>' +
          '<rect x="40" y="150" width="60" height="80" fill="#2b3358"/><path d="M30 150 L70 120 L110 150Z" fill="#232a4a"/><rect x="56" y="170" width="28" height="18" fill="#ffe08a" opacity=".8"/>';
        break;
      case 'training':
        b = '<rect width="400" height="300" fill="#c9dbe6"/><path d="M0 170 Q100 120 200 160 Q300 120 400 150 L400 300 L0 300Z" fill="#8a9a5b"/>' +
          '<rect y="210" width="400" height="90" fill="#a68a64"/>';
        for (var n = 0; n < 7; n++) b += '<ellipse cx="' + (30 + n * 58) + '" cy="228" rx="30" ry="14" fill="#c2a878" stroke="#7e6748" stroke-width="2"/>';
        b += '<path d="M0 196 L400 196" stroke="#555" stroke-width="2" stroke-dasharray="6 4"/>';
        break;
      case 'gate':
        b = '<rect width="400" height="300" fill="#cfe3ee"/><path d="M0 200 L400 200 L400 300 L0 300Z" fill="#9c9c94"/>' +
          '<rect x="20" y="110" width="90" height="100" fill="#e6dccb" stroke="#7a6e5c" stroke-width="3"/><path d="M10 110 L65 80 L120 110Z" fill="#a33b3b"/>' +
          '<rect x="160" y="14" width="80" height="26" rx="4" fill="#7a2a24"/><text x="200" y="32" font-size="14" text-anchor="middle" fill="#fff" font-weight="800">위병소</text>' +
          '<rect x="120" y="170" width="260" height="12" fill="#fff" stroke="#444" stroke-width="2"/><path d="M140 170 L160 182 M180 170 L200 182 M220 170 L240 182 M260 170 L280 182 M300 170 L320 182 M340 170 L360 182" stroke="#e3342f" stroke-width="6"/>';
        break;
      case 'home':
        outdoor = false;
        b = '<rect width="400" height="300" fill="#ffe8d6"/><rect y="220" width="400" height="80" fill="#c08457"/>' +
          '<rect x="40" y="50" width="110" height="90" fill="#bfe3ff" stroke="#fff" stroke-width="8"/><path d="M95 50 L95 140 M40 95 L150 95" stroke="#fff" stroke-width="6"/>' +
          '<rect x="230" y="140" width="140" height="80" rx="16" fill="#ef8a6b"/><rect x="240" y="120" width="120" height="40" rx="14" fill="#f4a184"/>';
        break;
      case 'hospital':
        outdoor = false;
        b = '<rect width="400" height="300" fill="#e8f6f3"/><rect y="220" width="400" height="80" fill="#b9d3cd"/>' +
          '<rect x="170" y="30" width="60" height="60" rx="6" fill="#fff" stroke="#c9d9d5" stroke-width="3"/><path d="M200 42 L200 78 M182 60 L218 60" stroke="#e3342f" stroke-width="12"/>' +
          '<rect x="20" y="150" width="130" height="60" rx="8" fill="#fff" stroke="#9cb8b2" stroke-width="3"/>';
        break;
      case 'beach':
        b = '<rect width="400" height="300" fill="#bfe6f5"/><circle cx="80" cy="60" r="24" fill="#fff1a8"/>' +
          '<rect y="130" width="400" height="80" fill="#3d8fc4"/><path d="M0 150 Q50 140 100 150 T200 150 T300 150 T400 150" fill="none" stroke="#cfeaf7" stroke-width="3"/>' +
          '<path d="M0 205 Q100 190 200 205 Q300 220 400 200 L400 300 L0 300Z" fill="#ead9a8"/>' +
          '<rect x="300" y="120" width="60" height="70" fill="#d8cfb6" stroke="#7a6e5c" stroke-width="3"/><path d="M292 120 L330 96 L368 120Z" fill="#5b6b3a"/>' +
          '<path d="M0 200 L400 200" stroke="#8a8a80" stroke-width="2" stroke-dasharray="4 6"/>';
        break;
      case 'field':
      default:
        b = '<rect width="400" height="300" fill="#bfe1f5"/><circle cx="330" cy="54" r="26" fill="#fff1a8"/>' +
          '<path d="M0 170 L70 100 L140 160 L220 80 L300 150 L360 110 L400 140 L400 300 L0 300Z" fill="#7d9a5a"/>' +
          '<path d="M0 210 Q200 186 400 210 L400 300 L0 300Z" fill="#d7c08f"/>' +
          '<rect x="300" y="150" width="70" height="56" fill="#eadfc4" stroke="#8a7a5c" stroke-width="3"/><path d="M292 150 L335 124 L378 150Z" fill="#5b6b3a"/>';
    }
    var over = '';
    if (outdoor && season) {
      var rs = mulberry(hash(name + season));
      if (season === 'winter') {
        over += '<path d="M0 250 Q200 230 400 250 L400 300 L0 300Z" fill="#fbfdff"/>';
        for (var a = 0; a < 26; a++) over += '<circle class="flake" cx="' + Math.floor(rs() * 400) + '" cy="' + Math.floor(rs() * 260) + '" r="' + (rs() * 3 + 1.5).toFixed(1) + '" fill="#fff"/>';
      } else if (season === 'autumn') {
        for (var l = 0; l < 14; l++) over += '<ellipse class="leaf" cx="' + Math.floor(rs() * 400) + '" cy="' + Math.floor(rs() * 260) + '" rx="6" ry="3.5" fill="' + (l % 2 ? '#e76f51' : '#f4a261') + '" transform="rotate(' + Math.floor(rs() * 180) + ')"/>';
      } else if (season === 'spring') {
        for (var p = 0; p < 16; p++) over += '<circle class="petal" cx="' + Math.floor(rs() * 400) + '" cy="' + Math.floor(rs() * 260) + '" r="3" fill="#ffc8dd"/>';
      } else if (season === 'summer' && name !== 'night') {
        over += '<g opacity=".25">' + '<path d="M0 0 L400 0 L400 40 Q200 80 0 40Z" fill="#fff59d"/></g>';
      }
    }
    if (name === 'rain') {
      b = '<rect width="400" height="300" fill="#8796a3"/><path d="M0 200 L400 200 L400 300 L0 300Z" fill="#5e6b5a"/>';
      for (var w = 0; w < 40; w++) b += '<path class="rain" d="M' + (w * 11 % 400) + ' ' + (w * 37 % 260) + ' l-6 16" stroke="#dbe7f1" stroke-width="2"/>';
    }
    return '<svg class="scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g id="' + id + '">' + b + over + '</g></svg>';
  }

  /* ── 스탯 아이콘 ───────────────────────────────────── */
  var ICON_PATHS = {
    hp: 'M50 88 C20 66 6 50 8 32 C10 16 24 8 36 10 C44 11 48 18 50 22 C52 18 56 11 64 10 C76 8 90 16 92 32 C94 50 80 66 50 88Z',
    mt: 'M30 20 C38 6 62 6 70 20 C84 18 94 30 88 44 C96 54 90 70 76 72 C72 84 56 88 50 80 C44 88 28 84 24 72 C10 70 4 54 12 44 C6 30 16 18 30 20Z',
    tr: 'M50 6 L61 36 L93 37 L68 56 L77 87 L50 69 L23 87 L32 56 L7 37 L39 36Z',
    bd: 'M30 14 a14 14 0 1 1 0.1 0 Z M70 14 a14 14 0 1 1 0.1 0 Z M6 86 C6 60 18 46 30 46 C40 46 46 52 50 58 C54 52 60 46 70 46 C82 46 94 60 94 86Z'
  };

  function statIcon(key) {
    return '<svg viewBox="0 0 100 96" class="stat-svg" aria-hidden="true"><path d="' + ICON_PATHS[key] + '"/></svg>';
  }

  function rankInsignia(level) {
    // level: 0 훈련병, 1 이병 ~ 4 병장
    var s = '<svg viewBox="0 0 40 30" class="rank-svg" aria-hidden="true"><rect x="1" y="1" width="38" height="28" rx="4" fill="#3f4729" stroke="#20250f" stroke-width="2"/>';
    if (level === 0) s += '<text x="20" y="21" font-size="15" text-anchor="middle" fill="#e8e2c4" font-weight="800">훈</text>';
    for (var i = 0; i < level; i++) s += '<rect x="7" y="' + (5 + i * 5.2) + '" width="26" height="3.2" fill="#0d0d0d"/>';
    return s + '</svg>';
  }

  JY.art = {
    character: character,
    cat: cat,
    boar: boar,
    speaker: speaker,
    letter: letter,
    phone: phone,
    box: box,
    scene: scene,
    statIcon: statIcon,
    rankInsignia: rankInsignia,
    star: star,
    hash: hash,
    mulberry: mulberry
  };
})(window.JY = window.JY || {});
