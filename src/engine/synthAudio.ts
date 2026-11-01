// Web Audio synthesizer for AKA Turbo 3D Grand Prix (Engine RPM, Kerbs, Pit Wrench, Impacts & 6 Chiptune Themes)

export type SfxKind =
  | 'beep_low'
  | 'beep_high'
  | 'nitro'
  | 'crash'
  | 'bump'
  | 'pit_wrench'
  | 'pit_done'
  | 'lap'
  | 'menu';

const SONG_NOTES: Record<string, number> = {
  G4: 392.0, 'G#4': 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, 'C#5': 554.37, D5: 587.33, 'D#5': 622.25, E5: 659.25, F5: 698.46, 'F#5': 739.99, G5: 783.99, A5: 880.0, Bb5: 932.33, B5: 987.77,
  C6: 1046.5, 'C#6': 1108.73, D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98,
};

const TRACK_MELODIES: Array<{ bpm: number; notes: string[] }> = [
  // 0: Sunset Drive (112 BPM)
  { bpm: 112, notes: ['E5', '-', 'D5', 'C5', 'A4', '-', '-', '.', 'C5', '-', 'D5', 'E5', 'F5', '-', 'E5', 'D5'] },
  // 1: Summit Rush (138 BPM)
  { bpm: 138, notes: ['F#5', 'A5', 'D6', 'A5', 'F#5', 'E5', 'D5', 'E5', 'E5', '-', 'C#5', 'E5', 'A5', '-', 'G5', 'F#5'] },
  // 2: Neon Nights (124 BPM)
  { bpm: 124, notes: ['E5', '.', 'G5', '.', 'B5', '-', 'A5', 'G5', 'E5', '-', '.', 'D5', 'E5', 'G5', '-', '.'] },
  // 3: Sea Breeze (128 BPM)
  { bpm: 128, notes: ['B5', 'D6', 'B5', 'G5', 'A5', 'B5', '-', '.', 'G5', 'E5', 'G5', 'B5', 'A5', 'G5', 'E5', '.'] },
  // 4: Polar Lights (96 BPM)
  { bpm: 96, notes: ['A5', '-', '-', 'F5', '-', 'D5', '-', '.', 'D6', '-', '-', 'C6', '-', 'A5', '-', '.'] },
  // 5: Dock Runner (118 BPM)
  { bpm: 118, notes: ['F#5', '.', 'F#5', 'A5', 'F#5', '.', 'E5', '.', 'D5', '.', 'D5', 'F#5', 'D5', '.', 'C#5', '.'] },
];

class AkaSynthAudio {
  private ctx: AudioContext | null = null;
  private engOsc: OscillatorNode | null = null;
  private engGain: GainNode | null = null;
  private enabled = false;
  private musicEnabled = true;
  private currentTrack = 0;
  private stepIdx = 0;
  private musicTimer: number | null = null;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
  }

  public toggleAudio(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.ensureContext();
    } else if (this.engGain && this.ctx) {
      this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    }
    return this.enabled;
  }

  public setTrackSong(trackId: number) {
    if (this.currentTrack !== trackId) {
      this.currentTrack = trackId;
      this.stepIdx = 0;
    }
  }

  private ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 65;
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    this.engOsc = osc;
    this.engGain = gain;

    this.startMusicSequencer();
  }

  private startMusicSequencer() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = window.setInterval(() => {
      if (!this.enabled || !this.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const song = TRACK_MELODIES[this.currentTrack % TRACK_MELODIES.length];
      const tok = song.notes[this.stepIdx % song.notes.length];
      this.stepIdx++;
      if (tok === '.' || tok === '-') return;
      const freq = SONG_NOTES[tok];
      if (!freq) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq * 0.5, now);
      g.gain.setValueAtTime(0.024, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    }, 145);
  }

  public updateEngine(rpm: number, nitroOn: boolean, damage: number, sputter: boolean, active: boolean) {
    if (!this.enabled || !this.ctx || !this.engOsc || !this.engGain) return;
    const now = this.ctx.currentTime;
    if (!active) {
      this.engGain.gain.setTargetAtTime(0, now, 0.04);
      return;
    }
    const baseFreq = 52 + rpm * 145 * (1 - damage * 0.2) + (nitroOn ? 34 : 0);
    const vol = sputter ? 0.006 : 0.045 * (nitroOn ? 1.25 : 0.85);
    this.engOsc.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engGain.gain.setTargetAtTime(vol, now, 0.03);
  }

  public playSfx(kind: SfxKind) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.connect(g);
    g.connect(this.ctx.destination);

    switch (kind) {
      case 'beep_low':
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        g.gain.setValueAtTime(0.07, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
        break;
      case 'beep_high':
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        g.gain.setValueAtTime(0.09, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        osc.start(now);
        osc.stop(now + 0.35);
        break;
      case 'nitro':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.25);
        g.gain.setValueAtTime(0.07, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.29);
        break;
      case 'pit_wrench':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(470, now + 0.05);
        osc.frequency.setValueAtTime(340, now + 0.1);
        g.gain.setValueAtTime(0.065, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
        break;
      case 'pit_done':
      case 'lap':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.07);
        osc.frequency.setValueAtTime(783.99, now + 0.14);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.33);
        break;
      case 'crash':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);
        g.gain.setValueAtTime(0.11, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.31);
        break;
      case 'bump':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.12);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      case 'menu':
        osc.type = 'square';
        osc.frequency.setValueAtTime(640, now);
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
    }
  }
}

export const synthAudio = new AkaSynthAudio();
