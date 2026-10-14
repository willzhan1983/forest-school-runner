(function(global){
'use strict';
var tuning = global.FSRTuning;
var DIFF = {
  easy: {
    id:'easy', name:'简 单', short:'1× 速度，5 颗心',
    desc:'跑得慢一点、障碍离得远一点，5 颗心陪你慢慢跑。',
    color:'#4caf6d', colorDark:'#2f7a46', glow:'rgba(76,175,109,.45)',
    speedBase:4.4 * tuning.levels.easy.speed,  rampDiv:1500,
    speedStepMeters:1000, speedStep:0,
    gapBase:620, gapMin:380, gapDiv:24, gapJitter:120,
    dblFrom:1e9, dblProb:0, doubleGap:0, doubleGapJitter:0,
    maxLives:tuning.levels.easy.hearts, invulnHit:tuning.levels.easy.hitSeconds * 60, invulnShield:tuning.levels.easy.shieldSeconds * 60,
    pwInit:1300, pwBase:1150, pwJitter:1050,
    pkInit:340,  pkBase:380,  pkJitter:380,
    pfInit:620,  pfBase:520,  pfJitter:420
  },
  normal: {
    id:'normal', name:'普 通', short:'2× 起速，4 颗心',
    desc:'每跑 1000 米逐步提速，跑得越远越有挑战，4 颗心。',
    color:'#4a90d9', colorDark:'#2b6bb0', glow:'rgba(74,144,217,.45)',
    speedBase:4.4 * tuning.levels.normal.speed,  rampDiv:900,
    speedStepMeters:1000, speedStep:0.2,
    gapBase:700, gapMin:560, gapDiv:36, gapJitter:140, gapSpeedFactor:110,
    dblFrom:1e9, dblProb:0, doubleGap:0, doubleGapJitter:0,
    maxLives:tuning.levels.normal.hearts, invulnHit:tuning.levels.normal.hitSeconds * 60, invulnShield:tuning.levels.normal.shieldSeconds * 60,
    pwInit:2600, pwBase:2300, pwJitter:2100,
    pkInit:380,  pkBase:420,  pkJitter:420,
    pfInit:760,  pfBase:620,  pfJitter:520
  },
  hard: {
    id:'hard', name:'困 难', short:'3× 起速，3 颗心',
    desc:'每跑 1000 米逐步提速，跑得越远越有挑战，3 颗心。',
    color:'#f28c28', colorDark:'#c26a12', glow:'rgba(242,140,40,.45)',
    speedBase:4.4 * tuning.levels.hard.speed,  rampDiv:780,
    speedStepMeters:1000, speedStep:0.2,
    gapBase:740, gapMin:600, gapDiv:38, gapJitter:150, gapSpeedFactor:110,
    dblFrom:1e9, dblProb:0, doubleGap:0, doubleGapJitter:0,
    maxLives:tuning.levels.hard.hearts, invulnHit:tuning.levels.hard.hitSeconds * 60, invulnShield:tuning.levels.hard.shieldSeconds * 60,
    pwInit:3200, pwBase:2900, pwJitter:2600,
    pkInit:420,  pkBase:480,  pkJitter:460,
    pfInit:900,  pfBase:760,  pfJitter:600
  },
  nightmare: {
    id:'nightmare', name:'噩 梦', short:'3.5× 起速，2 颗心',
    desc:'每跑 1000 米逐步提速，跑得越远越有挑战，2 颗心。',
    color:'#c2185b', colorDark:'#8e0e42', glow:'rgba(194,24,91,.45)',
    speedBase:4.4 * tuning.levels.nightmare.speed,  rampDiv:700,
    speedStepMeters:1000, speedStep:0.2,
    gapBase:800, gapMin:660, gapDiv:45, gapJitter:160, gapSpeedFactor:110,
    dblFrom:1e9, dblProb:0, doubleGap:0, doubleGapJitter:0,
    maxLives:tuning.levels.nightmare.hearts, invulnHit:tuning.levels.nightmare.hitSeconds * 60, invulnShield:tuning.levels.nightmare.shieldSeconds * 60,
    pwInit:3600, pwBase:3000, pwJitter:2600,
    pkInit:460,  pkBase:520,  pkJitter:480,
    pfInit:1000, pfBase:860,  pfJitter:680
  }
};
var DIFF_ORDER = ['easy','normal','hard','nightmare'];

global.FSRConfig = { difficulties:DIFF, order:DIFF_ORDER };
})(window);
