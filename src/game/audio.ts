import {
  loadBgmMutedSetting,
  loadSfxMutedSetting,
  saveBgmMutedSetting,
  saveSfxMutedSetting,
} from './storage';

export type BgmTrackKind = 'none' | 'intro' | 'main' | 'ending';

// MIDI note helper -> Hz
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 16-bar (256 sixteenth-note steps) original playful Ninja Night-Sprint BGM at 146 BPM
 * Key: D minor / F major pentatonic (D=62, F=65, G=67, A=69, C=72, D=74, F=77, G=79, A=81)
 * 0 = rest, -1 = sustain previous note
 */
const MAIN_MELODY_256: readonly number[] = [
  // Phrase A1 (Bars 1-4): Brisk Sunheon-gwan rooftop dash motif
  74, 0, 77, 0, 79, 0, 81, 0, 79, 0, 77, 74, 0, 72, 74, 0,
  74, 0, 77, 0, 81, 0, 84, 0, 81, 0, 79, 77, 0, 74, 0, 0,
  72, 0, 74, 0, 77, 0, 79, 0, 77, 0, 74, 72, 0, 69, 72, 0,
  74, 0, 69, 0, 72, 74, 0, 77, 74, 0, 0, 0, 69, 0, 72, 0,

  // Phrase A2 (Bars 5-8): Playful variation leaping higher
  74, 0, 77, 0, 79, 0, 81, 0, 84, 0, 81, 79, 0, 77, 74, 0,
  77, 0, 79, 0, 81, 0, 86, 0, 84, 0, 81, 79, 0, 81, 0, 0,
  84, 0, 81, 0, 79, 0, 77, 0, 79, 0, 77, 74, 0, 72, 69, 0,
  72, 0, 74, 0, 77, 79, 0, 77, 74, 0, 0, 0, 0, 0, 0, 0,

  // Phrase B (Bars 9-12): Moonlit wire-glide bridge (F -> C -> Bb -> A feel)
  77, 0, 81, 0, 84, 0, 81, 0, 77, 0, 72, 0, 77, 0, 81, 0,
  76, 0, 79, 0, 84, 0, 79, 0, 76, 0, 72, 0, 76, 0, 79, 0,
  74, 0, 77, 0, 82, 0, 77, 0, 74, 0, 70, 0, 74, 0, 77, 0,
  76, 0, 79, 0, 81, 0, 84, 0, 81, 0, 79, 0, 76, 0, 72, 0,

  // Phrase A3 (Bars 13-16): Energetic sprint climax & clean turnaround
  74, 0, 77, 74, 79, 0, 81, 79, 84, 0, 81, 0, 79, 0, 77, 0,
  79, 0, 81, 79, 84, 0, 86, 0, 84, 0, 81, 0, 79, 0, 77, 0,
  74, 0, 72, 0, 74, 0, 77, 0, 79, 0, 81, 0, 79, 77, 74, 72,
  74, 0, 74, 0, 81, 0, 79, 0, 74, 0, 0, 0, 69, 0, 72, 0,
];

// Root bass MIDI per bar (16 bars: Dm - Bb - F - C / Dm - Bb - C - Dm / F - C - Gm - A / Dm - Bb - C - Dm)
const MAIN_BAR_BASS_ROOTS: readonly number[] = [
  50, 46, 53, 48,
  50, 46, 48, 50,
  53, 48, 43, 45,
  50, 46, 48, 50,
];

/**
 * 8-bar (64 eighth-note steps) calm Snowflower Plaza Ending Lullaby at 84 BPM
 * Key: F major pentatonic (F5=77, G5=79, A5=81, C6=84, D6=86)
 */
const ENDING_MELODY_64: readonly number[] = [
  81, 0, 84, 0, 86, 0, 84, 0,
  81, 0, 79, 0, 77, 0, 0, 0,
  79, 0, 81, 0, 84, 0, 81, 0,
  79, 0, 77, 0, 74, 0, 0, 0,
  77, 0, 81, 0, 84, 0, 88, 0,
  86, 0, 84, 0, 81, 0, 79, 0,
  81, 0, 79, 0, 77, 0, 72, 0,
  77, 0, 81, 0, 77, 0, 0, 0,
];

const ENDING_BAR_CHORDS: ReadonlyArray<readonly number[]> = [
  [65, 69, 72], // F
  [62, 65, 69], // Dm
  [58, 62, 65], // Bb
  [60, 64, 67], // C
  [65, 69, 72], // F
  [62, 69, 74], // Dm9
  [58, 62, 69], // Bbmaj7
  [65, 69, 72], // F
];

/**
 * 8-bar (64 eighth-note steps) quiet, curious Intro BGM at 104 BPM
 * Mood: Meokbabi tapping at the night window with a snowflower letter —
 * delicate celesta/bell questions & light tiptoe pizzicato bass.
 */
const INTRO_MELODY_64: readonly number[] = [
  // Bars 1-2: Curious window knock & rising question (D5 - F5 - A5 - G5)
  74, 0, 77, 0, 81, 0, 79, 0,
  77, 0, 72, 0, 74, 0, 0, 0,
  // Bars 3-4: Peeking at the glowing snowflower letter
  74, 0, 77, 0, 81, 0, 84, 0,
  81, 0, 79, 0, 77, 0, 0, 0,
  // Bars 5-6: Meokbabi beckoning toward Snowflower Plaza
  79, 0, 81, 0, 84, 0, 86, 0,
  84, 0, 81, 0, 79, 0, 76, 0,
  // Bars 7-8: Playful resolve & gentle loop turnaround
  77, 0, 79, 0, 81, 0, 77, 0,
  74, 0, 72, 0, 69, 0, 0, 0,
];

const INTRO_BASS_BARS: readonly number[] = [
  50, 48, 46, 53,
  55, 45, 46, 48,
];

/**
 * Synthesized Web Audio sound & multi-track BGM engine for Runaway Ninja Songi.
 * - Unlocks AudioContext synchronously inside user click/key handlers (zero await)
 * - Runs a lookahead Web Audio scheduler for glitch-free looping BGM
 * - Separates BGM mute and SFX mute with localStorage persistence
 * - Prevents duplicate overlapping tracks across restarts, pauses, game overs, and endings
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterBgmGain: GainNode | null = null;
  private masterSfxGain: GainNode | null = null;
  private sessionBgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private bgmMuted: boolean = loadBgmMutedSetting();
  private sfxMuted: boolean = loadSfxMutedSetting();
  private unlocked = false;

  // BGM Scheduler state
  private activeTrack: BgmTrackKind = 'none';
  private bgmPlaying = false;
  private bgmPaused = false;
  private stepIndex = 0;
  private nextNoteTime = 0;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduledNotesCount = 0;

  constructor() {
    this.exposeDebugHandle();
  }

  isBgmMuted(): boolean {
    return this.bgmMuted;
  }

  isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  setBgmMuted(muted: boolean): void {
    this.bgmMuted = muted;
    saveBgmMutedSetting(muted);
    this.syncMasterGains();
  }

  setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
    saveSfxMutedSetting(muted);
    this.syncMasterGains();
  }

  toggleBgmMuted(): boolean {
    this.unlock();
    this.setBgmMuted(!this.bgmMuted);
    if (!this.bgmMuted) {
      this.playUiClick();
      // If a track is supposed to be active and not paused, ensure scheduler is running
      if (this.activeTrack !== 'none' && !this.bgmPaused && !this.bgmPlaying) {
        if (this.activeTrack === 'intro') this.startIntroBgm();
        else if (this.activeTrack === 'main') this.startMainBgm();
        else if (this.activeTrack === 'ending') this.startEndingBgm();
      }
    }
    return this.bgmMuted;
  }

  toggleSfxMuted(): boolean {
    this.unlock();
    this.setSfxMuted(!this.sfxMuted);
    if (!this.sfxMuted) {
      this.playUiClick();
    }
    return this.sfxMuted;
  }

  /**
   * Synchronously creates and resumes AudioContext inside a user gesture handler.
   * Never uses await before resume() so browser user-activation remains valid.
   */
  unlock(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.masterBgmGain = this.ctx.createGain();
        this.masterSfxGain = this.ctx.createGain();
        this.masterBgmGain.connect(this.ctx.destination);
        this.masterSfxGain.connect(this.ctx.destination);
        this.noiseBuffer = this.createWhiteNoiseBuffer(this.ctx);
        this.syncMasterGains();
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.unlocked = true;
    } catch {
      // Audio unavailable in restricted environments
    }
  }

  private syncMasterGains(): void {
    if (!this.ctx || !this.masterBgmGain || !this.masterSfxGain) return;
    const now = this.ctx.currentTime;
    this.masterBgmGain.gain.cancelScheduledValues(now);
    this.masterBgmGain.gain.setValueAtTime(this.bgmMuted ? 0 : 0.85, now);

    this.masterSfxGain.gain.cancelScheduledValues(now);
    this.masterSfxGain.gain.setValueAtTime(this.sfxMuted ? 0 : 0.95, now);
  }

  private createWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ===========================================================================
  // Multi-Track Lookahead BGM Sequencer
  // ===========================================================================

  startIntroBgm(): void {
    this.unlock();
    if (this.activeTrack === 'intro' && this.bgmPlaying && !this.bgmPaused) {
      return;
    }
    this.stopBgm();
    this.activeTrack = 'intro';
    this.bgmPaused = false;
    this.stepIndex = 0;
    this.startSchedulerSession(0.78);
  }

  startMainBgm(): void {
    this.unlock();
    // If already seamlessly playing main BGM (e.g. stage transition), keep playing uninterrupted!
    if (this.activeTrack === 'main' && this.bgmPlaying && !this.bgmPaused) {
      return;
    }
    this.stopBgm();
    this.activeTrack = 'main';
    this.bgmPaused = false;
    this.stepIndex = 0;
    this.startSchedulerSession(1.0);
  }

  startEndingBgm(): void {
    this.unlock();
    if (this.activeTrack === 'ending' && this.bgmPlaying && !this.bgmPaused) {
      return;
    }
    this.stopBgm();
    this.activeTrack = 'ending';
    this.bgmPaused = false;
    this.stepIndex = 0;
    this.startSchedulerSession(0.9);
  }

  pauseBgm(): void {
    if (!this.bgmPlaying || this.bgmPaused) return;
    this.bgmPaused = true;
    this.clearSchedulerInterval();
    if (this.ctx && this.sessionBgmGain) {
      const now = this.ctx.currentTime;
      this.sessionBgmGain.gain.cancelScheduledValues(now);
      this.sessionBgmGain.gain.setValueAtTime(this.sessionBgmGain.gain.value, now);
      this.sessionBgmGain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      const oldSession = this.sessionBgmGain;
      this.sessionBgmGain = null;
      setTimeout(() => {
        try {
          oldSession.disconnect();
        } catch {
          // Ignore disconnect error
        }
      }, 65);
    }
    this.bgmPlaying = false;
  }

  resumeBgm(): void {
    if (this.activeTrack === 'none' || !this.bgmPaused) return;
    this.unlock();
    this.bgmPaused = false;
    const vol =
      this.activeTrack === 'intro'
        ? 0.78
        : this.activeTrack === 'ending'
          ? 0.9
          : 1.0;
    this.startSchedulerSession(vol);
  }

  fadeOutBgm(durationSec = 0.36): void {
    this.clearSchedulerInterval();
    this.bgmPlaying = false;
    this.bgmPaused = false;
    this.activeTrack = 'none';

    if (this.ctx && this.sessionBgmGain) {
      const now = this.ctx.currentTime;
      const fadingGain = this.sessionBgmGain;
      this.sessionBgmGain = null;
      fadingGain.gain.cancelScheduledValues(now);
      fadingGain.gain.setValueAtTime(Math.max(0.001, fadingGain.gain.value), now);
      fadingGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      if (this.cleanupFadeTimer) clearTimeout(this.cleanupFadeTimer);
      this.cleanupFadeTimer = setTimeout(() => {
        try {
          fadingGain.disconnect();
        } catch {
          // Ignore
        }
      }, Math.ceil(durationSec * 1000) + 60);
    }
  }

  stopBgm(): void {
    this.clearSchedulerInterval();
    if (this.cleanupFadeTimer) {
      clearTimeout(this.cleanupFadeTimer);
      this.cleanupFadeTimer = null;
    }
    this.bgmPlaying = false;
    this.bgmPaused = false;
    this.activeTrack = 'none';

    if (this.sessionBgmGain) {
      try {
        this.sessionBgmGain.disconnect();
      } catch {
        // Ignore
      }
      this.sessionBgmGain = null;
    }
  }

  private clearSchedulerInterval(): void {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private startSchedulerSession(targetSessionVolume: number): void {
    if (!this.ctx || !this.masterBgmGain) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const sessionGain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    sessionGain.gain.setValueAtTime(0.001, now);
    sessionGain.gain.linearRampToValueAtTime(targetSessionVolume, now + 0.08);
    sessionGain.connect(this.masterBgmGain);
    this.sessionBgmGain = sessionGain;

    this.nextNoteTime = now + 0.03;
    this.bgmPlaying = true;

    this.clearSchedulerInterval();
    this.schedulerTick();
    this.schedulerTimer = setInterval(() => {
      this.schedulerTick();
    }, 25);
  }

  private schedulerTick(): void {
    if (!this.bgmPlaying || !this.ctx || !this.sessionBgmGain) return;
    if (this.ctx.state === 'suspended') return;

    const scheduleAheadSec = 0.13;
    const now = this.ctx.currentTime;

    // Guard against stale nextNoteTime after tab focus return
    if (this.nextNoteTime < now - 0.15) {
      this.nextNoteTime = now + 0.02;
    }

    while (this.nextNoteTime < now + scheduleAheadSec) {
      if (this.activeTrack === 'intro') {
        const stepDur = 60 / 104 / 2; // 104 BPM eighth note (~0.288s)
        this.scheduleIntroStep(this.stepIndex % 64, this.nextNoteTime, stepDur);
        this.nextNoteTime += stepDur;
        this.stepIndex = (this.stepIndex + 1) % 64;
      } else if (this.activeTrack === 'main') {
        const stepDur = 60 / 146 / 4; // 146 BPM sixteenth note (~0.1027s)
        this.scheduleMainStep(this.stepIndex % 256, this.nextNoteTime, stepDur);
        this.nextNoteTime += stepDur;
        this.stepIndex = (this.stepIndex + 1) % 256;
      } else if (this.activeTrack === 'ending') {
        const stepDur = 60 / 84 / 2; // 84 BPM eighth note (~0.357s)
        this.scheduleEndingStep(this.stepIndex % 64, this.nextNoteTime, stepDur);
        this.nextNoteTime += stepDur;
        this.stepIndex = (this.stepIndex + 1) % 64;
      } else {
        break;
      }
    }
  }

  private scheduleIntroStep(
    step: number,
    time: number,
    stepDur: number
  ): void {
    if (!this.ctx || !this.sessionBgmGain || this.bgmMuted) return;
    const dest = this.sessionBgmGain;
    const bar = Math.floor(step / 8);
    const inBar = step % 8;

    // Light tiptoe pizzicato bass on beats 1 and 3 (steps 0 and 4)
    if (inBar === 0 || inBar === 4) {
      const root = INTRO_BASS_BARS[bar % INTRO_BASS_BARS.length];
      const midi = inBar === 4 ? root + 7 : root;
      this.scheduleBassNote(
        this.ctx,
        dest,
        midiToFreq(midi),
        time,
        stepDur * 0.82,
        0.095
      );
    }

    // Subtle soft window-tap woodblock accent on bar 0/4 step 6
    if ((bar === 0 || bar === 4) && (inBar === 6 || inBar === 7)) {
      this.tone(
        this.ctx,
        dest,
        'triangle',
        inBar === 6 ? 520 : 620,
        340,
        time,
        0.038,
        0.036
      );
    }

    // Delicate curious celesta/music-box melody
    const melMidi = INTRO_MELODY_64[step];
    if (melMidi > 0) {
      this.scheduleBellSparkle(
        this.ctx,
        dest,
        midiToFreq(melMidi),
        time,
        stepDur * 1.85,
        0.088
      );
      this.scheduleWarmPad(
        this.ctx,
        dest,
        midiToFreq(melMidi - 12),
        time,
        stepDur * 1.35,
        0.028
      );
    }
  }

  private scheduleMainStep(
    step: number,
    time: number,
    stepDur: number
  ): void {
    if (!this.ctx || !this.sessionBgmGain || this.bgmMuted) return;
    const dest = this.sessionBgmGain;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;

    // 1. Lead Ninja Pluck/Chiptune Melody
    const midi = MAIN_MELODY_256[step];
    if (midi > 0) {
      const freq = midiToFreq(midi);
      // Look ahead for sustain steps or next rest to give phrasing natural breath
      const nextMidi = MAIN_MELODY_256[(step + 1) % 256];
      const dur = nextMidi === 0 ? stepDur * 1.65 : stepDur * 0.92;
      this.schedulePluckLead(this.ctx, dest, freq, time, dur, 0.125);
    }

    // 2. Driving Octave Ninja Bassline (triangle wave)
    const bassRoot = MAIN_BAR_BASS_ROOTS[bar % MAIN_BAR_BASS_ROOTS.length];
    const isOffbeatOctave = inBar % 4 === 2;
    const isDrivingPulse = inBar % 2 === 0;
    if (isDrivingPulse) {
      const bassMidi = isOffbeatOctave ? bassRoot + 12 : bassRoot;
      const bassFreq = midiToFreq(bassMidi);
      this.scheduleBassNote(
        this.ctx,
        dest,
        bassFreq,
        time,
        stepDur * 1.45,
        inBar % 4 === 0 ? 0.15 : 0.11
      );
    }

    // 3. Sparkle Counter-Harmony Chime on bar downbeats & mid-bar accents
    if (inBar === 0 || inBar === 6 || inBar === 12) {
      const arpInterval = inBar === 0 ? 19 : inBar === 6 ? 24 : 16;
      const arpFreq = midiToFreq(bassRoot + arpInterval);
      this.scheduleBellSparkle(this.ctx, dest, arpFreq, time, stepDur * 2.2, 0.042);
    }

    // 4. Light Crisp Percussion (Kick on 0, 8 + syncopated 10; Snare/Woodblock on 4, 12; Shaker on offbeats)
    if (inBar === 0 || inBar === 8 || (bar % 2 === 1 && inBar === 10)) {
      this.scheduleKick(this.ctx, dest, time, 0.13);
    }
    if (inBar === 4 || inBar === 12) {
      this.scheduleSnareRim(this.ctx, dest, time, 0.075);
    }
    if (inBar % 2 === 1) {
      this.scheduleHiHat(this.ctx, dest, time, inBar % 4 === 3 ? 0.038 : 0.022);
    }
  }

  private scheduleEndingStep(
    step: number,
    time: number,
    stepDur: number
  ): void {
    if (!this.ctx || !this.sessionBgmGain || this.bgmMuted) return;
    const dest = this.sessionBgmGain;
    const bar = Math.floor(step / 8);
    const inBar = step % 8;

    // Warm sustained chord pad at the start of each bar
    if (inBar === 0) {
      const chord = ENDING_BAR_CHORDS[bar % ENDING_BAR_CHORDS.length];
      chord.forEach((m) => {
        this.scheduleWarmPad(
          this.ctx!,
          dest,
          midiToFreq(m - 12),
          time,
          stepDur * 7.6,
          0.052
        );
      });
    }

    // Delicate music-box bell melody
    const melMidi = ENDING_MELODY_64[step];
    if (melMidi > 0) {
      this.scheduleBellSparkle(
        this.ctx,
        dest,
        midiToFreq(melMidi),
        time,
        stepDur * 2.4,
        0.095
      );
    }
  }

  private schedulePluckLead(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc2.frequency.setValueAtTime(freq, startTime);
    osc1.detune.setValueAtTime(4, startTime);

    // Plucky low-pass envelope so square wave sounds warm & musical, never harsh
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.2, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(420, freq * 1.5),
      startTime + duration
    );

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0.36;
    g2.gain.value = 0.75;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(filter);
    g2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration + 0.015);
    osc2.stop(startTime + duration + 0.015);
    this.scheduledNotesCount++;
  }

  private scheduleBassNote(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.015);
    this.scheduledNotesCount++;
  }

  private scheduleBellSparkle(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
    this.scheduledNotesCount++;
  }

  private scheduleWarmPad(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
    this.scheduledNotesCount++;
  }

  private scheduleKick(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(132, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.085);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.095);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.11);
  }

  private scheduleSnareRim(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    peakGain: number
  ): void {
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1850, startTime);
      filter.Q.setValueAtTime(1.4, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(peakGain, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.065);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(startTime);
      src.stop(startTime + 0.075);
    }

    // Crisp woody body snap
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, startTime);
    osc.frequency.exponentialRampToValueAtTime(150, startTime + 0.035);
    g.gain.setValueAtTime(peakGain * 0.65, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);
    osc.connect(g);
    g.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.05);
  }

  private scheduleHiHat(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    peakGain: number
  ): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.032);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(startTime);
    src.stop(startTime + 0.04);
  }

  // ===========================================================================
  // Sound Effects (SFX Bus — balanced so effects stay crisp above BGM)
  // ===========================================================================

  private getReadySfxContext(): { ctx: AudioContext; dest: AudioNode } | null {
    if (this.sfxMuted || !this.unlocked || !this.ctx || !this.masterSfxGain) {
      return null;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return { ctx: this.ctx, dest: this.masterSfxGain };
  }

  playUiClick(): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    this.tone(ready.ctx, ready.dest, 'sine', 680, 920, now, 0.055, 0.075);
  }

  playPageTurn(): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    this.tone(ready.ctx, ready.dest, 'sine', 587.33, 783.99, now, 0.08, 0.06);
    this.tone(
      ready.ctx,
      ready.dest,
      'triangle',
      880,
      1046.5,
      now + 0.03,
      0.09,
      0.042
    );
  }

  playFootstep(speedRatio = 1): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    const pitch = 175 + Math.random() * 28 + speedRatio * 22;
    this.tone(ready.ctx, ready.dest, 'triangle', pitch, pitch * 0.65, now, 0.032, 0.028);
  }

  playJump(): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    const jitter = 0.96 + Math.random() * 0.08;
    this.tone(ready.ctx, ready.dest, 'sine', 300 * jitter, 680 * jitter, now, 0.13, 0.11);
    this.tone(
      ready.ctx,
      ready.dest,
      'triangle',
      440 * jitter,
      820 * jitter,
      now + 0.015,
      0.09,
      0.055
    );
  }

  playLand(intensity = 0.5): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    const vol = Math.min(0.095, 0.035 + intensity * 0.055);
    this.tone(ready.ctx, ready.dest, 'triangle', 160, 72, now, 0.065, vol);
  }

  playWireAttach(): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    this.tone(ready.ctx, ready.dest, 'sine', 560, 1120, now, 0.08, 0.105);
    this.tone(ready.ctx, ready.dest, 'triangle', 920, 1420, now + 0.028, 0.09, 0.07);
  }

  playWireRelease(): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    this.tone(ready.ctx, ready.dest, 'sine', 650, 430, now, 0.075, 0.065);
  }

  playSnowflake(kind: 'normal' | 'golden'): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    if (kind === 'normal') {
      const base = 1046.5 * (0.98 + Math.random() * 0.04); // C6
      this.tone(ready.ctx, ready.dest, 'sine', base, base * 1.25, now, 0.11, 0.085);
    } else {
      // Sparkling golden triad chime (D6 -> F#6 -> A6 -> D7)
      const notes = [1174.66, 1479.98, 1760.0, 2349.32];
      notes.forEach((freq, i) => {
        this.tone(
          ready.ctx,
          ready.dest,
          'sine',
          freq,
          freq * 1.01,
          now + i * 0.045,
          0.18,
          0.085
        );
      });
    }
  }

  playStageTransition(): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    const notes = [587.33, 783.99, 880.0, 1174.66];
    notes.forEach((f, idx) => {
      this.tone(ready.ctx, ready.dest, 'sine', f, f, now + idx * 0.068, 0.26, 0.065);
    });
  }

  playGameOver(): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    const notes = [440, 392, 349.23, 293.66];
    notes.forEach((f, idx) => {
      this.tone(
        ready.ctx,
        ready.dest,
        'triangle',
        f,
        f * 0.96,
        now + idx * 0.1,
        0.22,
        0.095
      );
    });
  }

  playEndingLampLight(stepIndex: number): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
    const freq = pentatonic[stepIndex % pentatonic.length];
    this.tone(ready.ctx, ready.dest, 'sine', freq, freq * 1.005, now, 0.42, 0.065);
    this.tone(ready.ctx, ready.dest, 'triangle', freq * 2, freq * 2, now + 0.02, 0.24, 0.025);
  }

  playEndingChord(phase: 'arrive' | 'rest' | 'finale'): void {
    const ready = this.getReadySfxContext();
    if (!ready) return;
    const now = ready.ctx.currentTime;
    const chords: Record<'arrive' | 'rest' | 'finale', number[]> = {
      arrive: [392.0, 493.88, 587.33, 783.99],
      rest: [349.23, 440.0, 523.25, 659.25],
      finale: [523.25, 659.25, 783.99, 1046.5, 1318.5],
    };
    chords[phase].forEach((freq, idx) => {
      this.tone(ready.ctx, ready.dest, 'sine', freq, freq, now + idx * 0.09, 0.9, 0.048);
    });
  }

  private tone(
    ctx: AudioContext,
    dest: AudioNode,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, startFreq), startTime);
    if (Math.abs(endFreq - startFreq) > 1) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, endFreq),
        startTime + duration
      );
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(
      peakGain,
      startTime + Math.min(0.015, duration * 0.25)
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  getAudioDebugState(): {
    contextState: string;
    activeTrack: BgmTrackKind;
    bgmPlaying: boolean;
    bgmPaused: boolean;
    bgmMuted: boolean;
    sfxMuted: boolean;
    stepIndex: number;
    scheduledNotesCount: number;
  } {
    return {
      contextState: this.ctx?.state ?? 'uninitialized',
      activeTrack: this.activeTrack,
      bgmPlaying: this.bgmPlaying,
      bgmPaused: this.bgmPaused,
      bgmMuted: this.bgmMuted,
      sfxMuted: this.sfxMuted,
      stepIndex: this.stepIndex,
      scheduledNotesCount: this.scheduledNotesCount,
    };
  }

  private exposeDebugHandle(): void {
    if (typeof window !== 'undefined') {
      (
        window as unknown as {
          __SONGI_AUDIO__?: () => ReturnType<SoundManager['getAudioDebugState']>;
        }
      ).__SONGI_AUDIO__ = () => this.getAudioDebugState();
    }
  }

  destroy(): void {
    this.stopBgm();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterBgmGain = null;
    this.masterSfxGain = null;
  }
}
