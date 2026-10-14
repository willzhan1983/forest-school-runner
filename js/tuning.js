(function(global){
  'use strict';
  // Timings are seconds; each renderer converts to its own coordinates/frame units.
  global.FSRTuning = {
    framesPerSecond:60, healEvery:3000, inputBufferSeconds:0.18, warningSeconds:1.25,
    levels:{
      easy:{ speed:1, hearts:5, hitSeconds:130/60, shieldSeconds:100/60 },
      normal:{ speed:2, hearts:4, hitSeconds:95/60, shieldSeconds:70/60 },
      hard:{ speed:3, hearts:3, hitSeconds:75/60, shieldSeconds:58/60 },
      nightmare:{ speed:3.5, hearts:2, hitSeconds:65/60, shieldSeconds:50/60 }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
