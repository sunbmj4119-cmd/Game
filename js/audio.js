/* 효과음 — 전부 Web Audio로 합성 (음원 파일 없음) */
(function (JY) {
  'use strict';
  var ctx = null;
  var enabled = true;

  function ac() {
    if (!enabled) return null;
    try {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, when) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (when || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 0.8;
    var g = c.createGain(); g.gain.value = vol || 0.15;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // 나팔 느낌의 짧은 선율 (톱니파 + 약한 비브라토)
  function bugle(notes, step) {
    var c = ac(); if (!c) return;
    step = step || 0.16;
    notes.forEach(function (n, i) {
      if (!n) return;
      var t = c.currentTime + i * step;
      var o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = n;
      lfo.frequency.value = 6; lg.gain.value = 4; lfo.connect(lg); lg.connect(o.frequency);
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
      g.gain.setValueAtTime(0.09, t + step * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.98);
      o.connect(f); f.connect(g); g.connect(c.destination);
      o.start(t); lfo.start(t); o.stop(t + step); lfo.stop(t + step);
    });
  }

  var G4 = 392, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

  JY.Sound = {
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    unlock: function () { ac(); },
    tap: function () { tone(660, 0.05, 'square', 0.05); },
    swipe: function () { noise(0.18, 0.12, 900); },
    good: function () { tone(C5, 0.09, 'square', 0.07); tone(E5, 0.12, 'square', 0.07, 0.08); },
    bad: function () { tone(220, 0.18, 'sawtooth', 0.07, 0, 150); },
    coin: function () { tone(E5, 0.07, 'square', 0.06); tone(C6, 0.16, 'square', 0.06, 0.07); },
    tick: function () { tone(880, 0.04, 'square', 0.04); },
    hit: function () { noise(0.12, 0.22, 2400); tone(160, 0.08, 'square', 0.05); },
    miss: function () { tone(300, 0.1, 'triangle', 0.05, 0, 200); },
    shovel: function () { noise(0.07, 0.08, 3000); },
    promo: function () { bugle([C5, E5, G5, 0, E5, G5, C6, C6], 0.14); },
    start: function () { bugle([G4, C5, E5, G5, 0, E5, C5, E5, G5, G5], 0.13); },
    fail: function () { tone(392, 0.32, 'sawtooth', 0.08, 0, 370); tone(370, 0.32, 'sawtooth', 0.08, 0.34, 349); tone(349, 0.32, 'sawtooth', 0.08, 0.68, 330); tone(330, 0.8, 'sawtooth', 0.08, 1.02, 260); },
    win: function () { bugle([C5, C5, C5, G5, 0, E5, G5, C6, C6, C6], 0.15); }
  };

  JY.buzz = function (pattern) {
    try { if (JY.settings && JY.settings.vibe === false) return; if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 무시 */ }
  };
})(window.JY = window.JY || {});
