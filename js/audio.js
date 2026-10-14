(function(global){
'use strict';
global.createFSRAudio = function(dayPhase){
var Audio2 = {
  ctx:null, enabled:true,
  init:function(){
    if(this.ctx){ if(this.ctx.state==='suspended') this.ctx.resume(); return; }
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if(AC) this.ctx = new AC();
    }catch(e){ this.enabled=false; }
  },
  tone:function(freq,dur,type,vol,slideTo,delay){
    if(!this.enabled||!this.ctx) return;
    var t0 = this.ctx.currentTime + (delay||0);
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = type||'sine';
    osc.frequency.setValueAtTime(freq,t0);
    if(slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40,slideTo), t0+dur);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(vol||0.18,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t0); osc.stop(t0+dur+0.02);
  },
  noise:function(dur,vol,sweep){
    if(!this.enabled||!this.ctx) return;
    var rate=this.ctx.sampleRate, len=Math.floor(rate*dur);
    var buf=this.ctx.createBuffer(1,len,rate), d=buf.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    var src=this.ctx.createBufferSource(); src.buffer=buf;
    var f=this.ctx.createBiquadFilter();
    f.type='bandpass'; f.frequency.value=sweep||900; f.Q.value=1.1;
    var g=this.ctx.createGain(); g.gain.value=vol||0.15;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start();
  },
  jump:function(){ this.tone(430,0.16,'square',0.11,720); },
  doubleJump:function(){ this.tone(620,0.14,'triangle',0.10,980); },
  collect:function(){ this.tone(880,0.09,'sine',0.14,1320); this.tone(1320,0.10,'sine',0.10,1760,0.06); },
  book:function(){ this.tone(660,0.09,'triangle',0.13,990); this.tone(990,0.11,'triangle',0.10,1480,0.07); },
  hit:function(){ this.tone(220,0.26,'sawtooth',0.16,70); this.noise(0.18,0.13,420); },
  powerup:function(){
    var self=this;
    [523,659,880,1175].forEach(function(f,i){ self.tone(f,0.13,'triangle',0.13,f,i*0.055); });
  },
  shieldBreak:function(){ this.tone(900,0.22,'square',0.14,240); this.noise(0.24,0.14,2200); },
  dash:function(){ this.noise(0.28,0.16,1600); this.tone(300,0.24,'sawtooth',0.10,900); },
  glide:function(){ this.noise(0.18,0.07,1100); this.tone(520,0.20,'sine',0.08,740); },
  click:function(){ this.tone(760,0.06,'square',0.09,980); },
  /* 难度切换音：C5 → D♯5 → F♯5 → A5（增三和弦上行），档位越高听感越"紧"，
     与配色（绿→蓝→橙→紫红）的紧张度递进一致，让"变难"可被听出来 */
  diffStep:function(i){
    var f = [523.25, 622.25, 739.99, 880.00][i] || 622.25;
    this.tone(f, 0.07, 'square', 0.10, f * 1.35);
    this.tone(f * 2, 0.05, 'triangle', 0.05, f * 2.6, 0.05);
  },
  over:function(){
    var self=this;
    [523,466,392,311].forEach(function(f,i){ self.tone(f,0.30,'triangle',0.14,f*0.94,i*0.16); });
  },
  start:function(){
    var self=this;
    [523,659,784,1046].forEach(function(f,i){ self.tone(f,0.16,'square',0.11,f,i*0.09); });
  },

  /* ---- 轻量循环 BGM：贝斯 + 主旋律 + 轻打击，随昼夜自动变化 ---- */
  musicOn:true, musicCtx:null, musicGain:null, hatBuf:null,
  /* 32 步主旋律：C 大调五声音阶（C D E G A，无半音，更清新自然）
     A 句 16 步中音区陈述 → B 句 16 步高音区扬起，循环 13.4 秒 */
  MUSIC_MEL:[
    /* A 句 · 陈述 */
    392.00, 440.00, 523.25, 587.33,
    659.25, 587.33, 523.25, 440.00,
    392.00, 440.00, 523.25, 659.25,
    587.33, 523.25, 440.00, 392.00,
    /* B 句 · 扬起 */
    523.25, 659.25, 783.99, 659.25,
    587.33, 659.25, 523.25, 440.00,
    523.25, 587.33, 659.25, 783.99,
    880.00, 783.99, 659.25, 587.33
  ],
  /* 16 步贝斯根音（每 2 个旋律步换一次）
     A 句：C - Am - Fmaj7 - G   ／   B 句：C - Fmaj7 - G - G（末尾持续属和声，回环到 A 句有解决感） */
  MUSIC_BASS:[
    65.41, 65.41, 55.00, 55.00, 43.65, 43.65, 49.00, 49.00,
    65.41, 65.41, 43.65, 43.65, 49.00, 49.00, 49.00, 49.00
  ],

  startMusic:function(){
    if(!this.enabled || !this.musicOn || this.musicCtx) return;
    this.init();
    if(!this.ctx) return;
    if(!this.musicGain){
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0001;
      this.musicGain.connect(this.ctx.destination);
    }
    var now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(Math.max(0.0002, this.musicGain.gain.value), now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.85, now + 0.7);
    this.musicCtx = { startTime:now + 0.15, beat:0.42, next:0 };
    this._schedMusic();
  },

  _schedMusic:function(){
    if(!this.musicCtx || !this.ctx) return;
    var self=this, m=this.musicCtx, now=this.ctx.currentTime;
    var lookahead = 1.0;                 /* 预排程 1 秒，保证昼夜变化能及时反映 */
    while(m.startTime + m.next * m.beat < now + lookahead){
      var i = m.next;
      var t = m.startTime + i * m.beat;
      var nAmt = 0;
      try{ nAmt = Math.min(1, dayPhase().night / 0.52); }catch(e){ nAmt = 0; }
      var vol = 1 - nAmt * 0.45;         /* 夜晚整体更轻 */

      /* 主旋律：夜里降八度 */
      var f = this.MUSIC_MEL[i % 32] * (nAmt > 0.5 ? 0.5 : 1);
      this._musicNote(f, t, m.beat * 0.92, 0.050 * vol, 'triangle');

      /* 贝斯：每 2 步一个根音 */
      if(i % 2 === 0){
        this._musicNote(this.MUSIC_BASS[(i / 2) % 16], t, m.beat * 1.7, 0.080 * vol, 'sine');
      }
      /* 轻打击：正拍稍重、弱拍很轻 */
      this._musicHat(t, (i % 2 === 0 ? 0.030 : 0.014) * vol * (1 - nAmt * 0.45));

      m.next++;
    }
    m.timer = setTimeout(function(){ self._schedMusic(); }, 200);
  },

  _musicNote:function(freq, t, dur, vol, type){
    if(!this.ctx) return;
    var osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.musicGain || this.ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  },

  _musicHat:function(t, vol){
    if(!this.ctx || !(vol > 0.002)) return;
    if(!this.hatBuf){
      var rate = this.ctx.sampleRate, len = Math.floor(rate * 0.05);
      this.hatBuf = this.ctx.createBuffer(1, len, rate);
      var d = this.hatBuf.getChannelData(0);
      for(var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    var src = this.ctx.createBufferSource(); src.buffer = this.hatBuf;
    var f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    var g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicGain || this.ctx.destination);
    src.start(t);
  },

  stopMusic:function(){
    var m = this.musicCtx;
    if(m && m.timer) clearTimeout(m.timer);
    this.musicCtx = null;
    if(this.musicGain && this.ctx){
      var g = this.musicGain, now = this.ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    }
  },
  toggleMusic:function(){
    this.musicOn = !this.musicOn;
    try{ localStorage.setItem('fsr_music', this.musicOn ? '1' : '0'); }catch(e){}
    if(this.musicOn){ this.startMusic(); Audio2.click(); }
    else { this.stopMusic(); Audio2.click(); }
  },
  /* 首次用户手势唤醒：浏览器自动播放策略要求 AudioContext 必须在真实手势后
     才会进入 running。菜单页/结算页也要有 BGM，所以在任何 pointerdown/keydown
     时调它。startMusic() 自带幂等守卫，重复调用安全。 */
  kick:function(){
    this.init();
    if(!this.ctx) return;
    if(this.ctx.state === 'suspended'){
      try{ this.ctx.resume(); }catch(e){}
    }
    if(this.musicOn && !this.musicCtx) this.startMusic();
  }
};

return Audio2;
};
})(window);
