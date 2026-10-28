'use strict';
/* Native Web Speech API: Tamil voice search (SpeechRecognition) + spoken step-by-step guide (SpeechSynthesis). */
const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let voices = [];

  const loadVoices = () => { 
    if (!synth) return;
    voices = synth.getVoices() || []; 
  };

  if (synth) {
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
  }

  const norm = l => (l || '').replace('_', '-').toLowerCase();

  /** Bind to a real installed voice for the locale with robust Tamil detection. */
  function pickVoice(lang) {
    loadVoices();
    const L = norm(lang), base = L.split('-')[0];

    if (base === 'ta') {
      // 1. Check for ta-IN or ta
      let taVoice = voices.find(v => norm(v.lang) === 'ta-in' || norm(v.lang) === 'ta');
      if (taVoice) return taVoice;

      // 2. Check by voice name (Windows/Chrome: Valluvar, Tamil, etc.)
      taVoice = voices.find(v => /tamil|valluvar|தமிழ்/i.test(v.name));
      if (taVoice) return taVoice;
    }

    // English or standard fallbacks
    return voices.find(v => norm(v.lang) === L)
      || voices.find(v => norm(v.lang) === base || norm(v.lang).startsWith(base + '-'))
      || (base === 'en' ? voices.find(v => /india|indian/i.test(v.name)) : null)
      || null;
  }

  /* ---------- Voice search ---------- */
  let rec = null, listening = false, cfg = null, base = '';
  const search = {
    supported: !!SR,
    init(c) { 
      cfg = c; 
      if (c.button) {
        c.button.addEventListener('click', () => (listening ? search.stop() : search.start())); 
      }
    },
    start() {
      if (!SR) { if (cfg && cfg.onError) cfg.onError('unsupported'); return; }
      if (listening) return;

      try {
        rec = new SR();
      } catch (e) {
        if (cfg && cfg.onError) cfg.onError('unsupported');
        return;
      }

      rec.lang = cfg.getLang ? cfg.getLang() : 'ta-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      base = '';

      if (cfg.input) {
        cfg.input.value = '';
        cfg.input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      rec.onresult = e => {
        let t = '';
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        if (cfg.input) {
          cfg.input.value = (base + t).trim();
          cfg.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };

      rec.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          listening = false; 
          if (cfg.onState) cfg.onState(false); 
          if (cfg.onError) cfg.onError('denied');
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          if (cfg.onError) cfg.onError('error');
        }
      };

      rec.onend = () => {
        if (listening) {
          base = cfg.input && cfg.input.value ? cfg.input.value + ' ' : '';
          try { rec.start(); } catch (err) { listening = false; if (cfg.onState) cfg.onState(false); }
        } else {
          if (cfg.onState) cfg.onState(false);
        }
      };

      listening = true;
      try { 
        rec.start(); 
        if (cfg.onState) cfg.onState(true); 
      } catch (err) { 
        listening = false; 
        if (cfg.onState) cfg.onState(false); 
        if (cfg.onError) cfg.onError('error'); 
      }
    },
    stop() { 
      listening = false; 
      try { if (rec) rec.stop(); } catch (e) {} 
      if (cfg && cfg.onState) cfg.onState(false); 
    },
    isOn: () => listening
  };

  /* ---------- Spoken step-by-step guide ---------- */
  let activeUtterance = null; // Prevents Chrome GC bug from cutting speech

  const guide = {
    lines: [], i: -1, state: 'stop', tok: 0, lang: 'en-IN', cb: () => {},
    load(lines, lang, cb) { 
      guide.stop(); 
      guide.lines = lines || []; 
      guide.lang = lang || 'en-IN'; 
      guide.cb = cb || (() => {}); 
    },
    _say(i) {
      const tok = ++guide.tok;
      if (!synth) return;
      synth.cancel();

      if (i >= guide.lines.length) { guide.stop(); return; }
      guide.i = i; 
      guide.state = 'play';

      const u = new SpeechSynthesisUtterance(guide.lines[i]);
      activeUtterance = u;
      u.lang = guide.lang;

      const v = pickVoice(guide.lang);
      if (v) {
        u.voice = v;
      }

      u.rate = guide.lang.startsWith('ta') ? 0.9 : 0.95;
      u.pitch = 1.0;

      u.onend = () => { 
        activeUtterance = null;
        if (tok === guide.tok && guide.state === 'play') guide._say(i + 1); 
      };

      u.onerror = e => { 
        activeUtterance = null;
        if (e.error !== 'interrupted' && e.error !== 'canceled' && tok === guide.tok) {
          guide.stop(); 
        }
      };

      guide.cb(i, 'play');
      synth.speak(u);
    },
    play() {
      if (!synth) return { supported: false, voiceFound: false };
      loadVoices();
      const voiceFound = !!pickVoice(guide.lang);

      if (guide.state === 'pause') { 
        synth.resume(); 
        guide.state = 'play'; 
        guide.cb(guide.i, 'play'); 
      } else {
        guide._say(0);
      }
      return { supported: true, voiceFound };
    },
    pause() { 
      if (synth && guide.state === 'play') { 
        synth.pause(); 
        guide.state = 'pause'; 
        guide.cb(guide.i, 'pause'); 
      } 
    },
    // முந்தைய படிக்குச் செல்லும் Reverse / Previous வசதி
    prev() {
      if (!synth || guide.state === 'stop') return;
      const prevStep = Math.max(0, guide.i - 1);
      guide._say(prevStep);
    },
    next() { 
      if (!synth) return; 
      guide._say(guide.state === 'stop' ? 0 : guide.i + 1); 
    },
    stop() { 
      guide.tok++; 
      guide.state = 'stop'; 
      guide.i = -1; 
      activeUtterance = null;
      if (synth) synth.cancel(); 
      guide.cb(-1, 'stop'); 
    }
  };

  return { search, guide, pickVoice };
})();