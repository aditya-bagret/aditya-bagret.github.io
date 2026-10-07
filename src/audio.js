// Generated ambience (no audio files): filtered-noise wind with slow gusts
// over a low two-note drone. Starts only when the visitor turns sound on.
export class Ambience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.on = false;
  }

  build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // wind: brown noise → band-pass whose centre drifts with an LFO
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 420;
    band.Q.value = 0.7;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.07;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 260;
    gust.connect(gustDepth).connect(band.frequency);
    const windGain = ctx.createGain();
    windGain.gain.value = 0.55;
    noise.connect(band).connect(windGain).connect(master);

    // drone
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 380;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.06;
    low.connect(droneGain).connect(master);
    for (const [f, d] of [[55, 0], [82.4, 4], [110.2, -3]]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(low);
      o.start();
    }
    noise.start();
    gust.start();
    this.ctx = ctx;
    this.master = master;
  }

  toggle() {
    if (!this.ctx) this.build();
    this.on = !this.on;
    if (this.on) this.ctx.resume();
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(this.on ? 0.5 : 0, this.ctx.currentTime, 0.6);
    return this.on;
  }
}
