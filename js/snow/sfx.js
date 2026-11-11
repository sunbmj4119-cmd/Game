/* 제설각 — 효과음 (Web Audio로 합성, 음원 파일 없음) */
(function (JY) {
  'use strict';
  var ac = null, master = null, noiseBuf = null, windSrc = null, windGain = null, muted = false;
  try { muted = localStorage.getItem('jeseol-mute') === '1'; } catch (e) { /* 저장소 없음 */ }

  function ctx() {
    try {
      if (!ac) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ac = new C();
        master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(freq, dur, type, vol, when, slide) {
    var c = ctx(); if (!c) return;
    var t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    env(g, t, 0.01, vol || 0.1, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, type, freq, q, when) {
    var c = ctx(); if (!c) return;
    var t = c.currentTime + (when || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    env(g, t, 0.008, vol, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.8, dur + 0.05);
  }

  JY.SnowSfx = {
    unlock: function () { ctx(); },
    scrape: function (k) { noise(0.07 + k * 0.05, 0.05 + k * 0.08, 'bandpass', 1500 + Math.random() * 1800, 0.9); },
    tick: function () { tone(1250 + Math.random() * 180, 0.06, 'sine', 0.045); },
    whistle: function (long) {
      var c = ctx(); if (!c) return;
      var t = c.currentTime, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), dur = long ? 0.9 : 0.4;
      o.type = 'sine'; o.frequency.value = 2300; lfo.frequency.value = 28; lg.gain.value = 120;
      lfo.connect(lg); lg.connect(o.frequency);
      env(g, t, 0.02, 0.09, dur);
      o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    },
    buy: function () { tone(660, 0.09, 'triangle', 0.12); tone(990, 0.16, 'triangle', 0.12, 0.08); },
    deny: function () { tone(220, 0.15, 'square', 0.05); },
    rank: function () { [392, 523, 659, 784].forEach(function (f, i) { tone(f, i === 3 ? 0.5 : 0.14, 'triangle', 0.13, i * 0.13); }); },
    stamp: function () { noise(0.14, 0.25, 'lowpass', 260, 0.7); tone(90, 0.18, 'sine', 0.22, 0, 50); },
    pop: function () { tone(520, 0.08, 'sine', 0.08, 0, 880); },
    ding: function () { tone(1568, 0.5, 'sine', 0.12); tone(2093, 0.6, 'sine', 0.08, 0.06); tone(3136, 0.3, 'sine', 0.04, 0.1); },
    deer: function () {
      // 고라니 비명: 높고 거친 소리가 꺾인다
      var c = ctx(); if (!c) return;
      var t = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2;
      o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1500, t + 0.12); o.frequency.linearRampToValueAtTime(700, t + 0.5);
      o2.frequency.setValueAtTime(905, t); o2.frequency.linearRampToValueAtTime(1490, t + 0.12); o2.frequency.linearRampToValueAtTime(690, t + 0.5);
      env(g, t, 0.02, 0.12, 0.55);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + 0.6); o2.stop(t + 0.6);
      noise(0.4, 0.05, 'highpass', 2500, 0.7);
    },
    thud: function () { tone(110, 0.2, 'sine', 0.25, 0, 55); noise(0.12, 0.15, 'lowpass', 400, 0.8); },
    rumble: function () { noise(0.9, 0.18, 'lowpass', 180, 0.7); tone(60, 0.8, 'sine', 0.12, 0, 40); },
    honk: function () { tone(392, 0.18, 'square', 0.06); tone(466, 0.18, 'square', 0.05); tone(392, 0.25, 'square', 0.06, 0.24); tone(466, 0.25, 'square', 0.05, 0.24); },
    splat: function () { noise(0.25, 0.25, 'lowpass', 900, 0.8); tone(180, 0.12, 'sine', 0.1, 0, 90); },
    wind: function (level) {
      var c = ctx(); if (!c) return;
      if (!windSrc) {
        windSrc = c.createBufferSource(); windSrc.buffer = noiseBuf; windSrc.loop = true;
        var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        windGain = c.createGain(); windGain.gain.value = 0;
        windSrc.connect(f); f.connect(windGain); windGain.connect(master); windSrc.start();
      }
      windGain.gain.setTargetAtTime(0.012 + level * 0.05, c.currentTime, 0.8);
    },
    muted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('jeseol-mute', muted ? '1' : '0'); } catch (e) { /* 저장소 없음 */ }
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.05);
    }
  };
})(window.JY = window.JY || {});
