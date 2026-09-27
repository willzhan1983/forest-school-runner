// Short original loops, synthesized locally so the game needs no third-party music files.
export const MAP_MUSIC = {
  china: { bpm: 108, wave: 'triangle', lead: [72, null, 76, 79, 81, null, 79, 76, 74, null, 76, 79, 76, null, 74, 72], bass: [48, 53, 55, 48] },
  japan: { bpm: 96, wave: 'sine', lead: [69, null, 72, 76, 74, null, 72, 69, 67, null, 69, 72, 69, null, 67, 64], bass: [45, 41, 43, 40] },
  europe: { bpm: 120, wave: 'triangle', lead: [67, 70, 74, null, 79, 74, 70, null, 65, 69, 72, null, 77, 72, 69, null], bass: [43, 39, 41, 36] },
  amazon: { bpm: 132, wave: 'sine', lead: [72, null, 79, 76, null, 74, 79, null, 72, 76, null, 81, 79, null, 76, 74], bass: [48, 43, 45, 41] }
};

const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

export function createMapMusic() {
  let context = null, master = null, timer = null, mapId = null, step = 0, nextAt = 0;

  function tone(midi, at, duration, volume, wave) {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency(midi);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain); gain.connect(master);
    oscillator.start(at); oscillator.stop(at + duration + 0.02);
  }

  function schedule() {
    const theme = MAP_MUSIC[mapId], beat = 60 / theme.bpm / 2;
    while (nextAt < context.currentTime + 0.24) {
      const index = step % theme.lead.length, note = theme.lead[index];
      if (note !== null) tone(note, nextAt, beat * 0.82, 0.018, theme.wave);
      if (index % 4 === 0) tone(theme.bass[index / 4], nextAt, beat * 3.5, 0.012, 'sine');
      if (mapId === 'amazon' && [0, 3, 6, 10, 12, 15].includes(index)) tone(36, nextAt, 0.065, 0.009, 'triangle');
      step++; nextAt += beat;
    }
  }

  function stop() {
    if (timer !== null) clearInterval(timer);
    if (master) {
      const oldMaster = master, now = context.currentTime;
      oldMaster.gain.cancelScheduledValues(now);
      oldMaster.gain.setTargetAtTime(0, now, 0.04);
      setTimeout(() => oldMaster.disconnect(), 400);
    }
    context = null; master = null; timer = null; mapId = null;
  }

  function play(nextMapId, nextContext) {
    if (!MAP_MUSIC[nextMapId] || !nextContext) return;
    if (timer !== null && mapId === nextMapId && context === nextContext) return;
    stop();
    context = nextContext; mapId = nextMapId; step = 0; nextAt = context.currentTime + 0.04;
    const resumed = context.resume?.();
    if (resumed?.catch) resumed.catch(() => {});
    master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.linearRampToValueAtTime(1, context.currentTime + 0.18);
    master.connect(context.destination);
    schedule(); timer = setInterval(schedule, 80);
  }

  return { play, stop, state: () => ({ mapId, playing: timer !== null }) };
}
