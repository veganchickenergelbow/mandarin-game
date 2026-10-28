# Tone 3 fix plan

Problem: tone 3 rarely registers, for Lucas and for his native-speaker colleagues.

## Diagnosis
1. Native speakers mostly say a "half third" tone: low and level or low-falling, with no rise (always when it isn't final, and often in isolation too). The textbook dip-and-rise is the exception. The classifier only looks at shape relative to the syllable's own median, so it throws away the one cue that really defines tone 3: its pitch is LOW for that speaker.
2. The bottom of tone 3 is often creaky (vocal fry). YIN either marks those frames as aperiodic, so they are dropped, or returns octave/subharmonic errors that are then filtered out. The low part disappears, and what is left looks like a short fall (tone 4) or a rise (tone 2).
3. With no speaker reference, a low flat tone 3 looks the same as a high flat tone 1.

## Fix
- **A. Speaker profile (js/core/voice.js, pure + tested).**
  - Keep `save.voice = {p10, p50, p90, n, calibrated}`, measured in semitones relative to 100 Hz.
  - Update it after every warm-up recording from all voiced frames, as an exponential moving average over recordings.
  - Add a one-time Calibration screen: "Count from 一 to 十 at your normal speaking voice". It takes the 10th, 50th and 90th percentiles of voiced F0. Home offers it if the profile isn't calibrated, and it is also in Settings.
  - Add a Settings button "Recalibrate (someone else is playing)".
  - Until calibrated, fall back to profile-free behaviour with the relaxed tone-3 rules.
- **B. Height-aware features.**
  - analyse() also returns absolute semitone values (relative to 100 Hz) and a normalised height h = (st - p10)/(p90 - p10).
  - It computes hStart, hEnd, hMin, hMean and the shape features (slope, dip position, range).
- **C. Creak as evidence.**
  - Creaky frames have energy (rms at or above the voicing gate) but are aperiodic, or give an F0 below p10 - 5 semitones, and sit inside or right after the voiced run.
  - Return creakRatio = creaky frames / (voiced + creaky frames).
  - When creakRatio > 0.15, treat the segment as reaching the bottom of the range (hMin = 0).
- **D. Scoring instead of an if-chain.** Each tone 1-4 gets a score from 0 to 1, the highest wins, and the scores are returned.
  - T1: high and flat.
  - T2: rising. End minus start is at least +2 st, and a dip near the start is allowed.
  - T3: LOW. hMin <= 0.25 and hMean <= 0.45. Low-level, low-falling and dip-rise shapes all count, with a bonus for creak.
  - T4: high fall. hStart >= 0.55 and a fall of at least 4 st; a short duration is fine.
  - Without calibration, a default profile uses -3/+2/+7 st around the take's own median.
- **E. Lenient pass for learning.** A syllable passes if the target tone scores highest. It also passes if the target is within 0.1 of the top score and the top tone is its usual confusion (T3 with T2/T4, or T1 with T4). The app then shows "close: sounded a bit like tone X".
- **F. Real-voice data.**
  - A Settings toggle "Keep my last 20 recordings" (off by default) stores them as 16 kHz PCM in IndexedDB, labelled with the word, the expected tones and the detected result.
  - An "Export recordings" button shares the .wav files via navigator.share({files}), falling back to a download link.
- **G. Tests.**
  - Synthetic cases: half-third, dip-rise with a creak gap, low flat, high flat, high steep fall, and mid fall.
  - Each case runs for a male (110 Hz) and a female (220 Hz) profile, with and without calibration.
  - Sandhi words after syllable splitting: 你好 (2-3), 老板 (2-3) and 买卖 (3-4).
  - All existing tests keep passing, including the staccato tone-4 cases.
- **H. Tone test page.** tone-test.html uses the new classifier and shows the four tone scores.
