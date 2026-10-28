# Core API contract (v0.1)

Shared between the core modules (js/core/*) and the screens (js/screens/*). All core modules are pure ES modules with no DOM, so they can be tested in node.

## js/core/pitch.js
- `yin(buf, sr, fmin=70, fmax=450, thr=0.2, gate=0.01) -> {f, rms}`: same as in tone-test.html.
- `track(samples, sr) -> [{t, f, rms}]`: 5 ms frames. Unlike tone-test.html, it also returns UNVOICED frames, with `f: 0`, so syllables.js can see gaps. `voiced(frames)` filters to `f > 0`.
- `voiced(frames) -> frames with f > 0`
- `analyse(voicedFrames) -> {ok, why?, st:[12], ref, dur, n, tone}`: same as in tone-test.html.
- `classify(st) -> 1|2|3|4`
- `TEMPLATES`: `{1..4: t => semitones}` for drawing.
- `toSt(f, ref)`, `median(a)`

## js/core/pinyin.js
- `syllables(py) -> string[]`: splits on spaces and drops punctuation tokens.
- `toneOf(syl) -> 1..5`: reads the tone mark; 5 means no mark (neutral).
- `tonesOf(py) -> number[]`
- `hanziChars(zh) -> string[]`: the CJK characters only, with punctuation and spaces removed.

## js/core/sandhi.js
- `surfaceTones(zh, tones) -> number[]`: applies the 3-3, 不 and 一 rules to the same-length CJK chars. A 5 stays 5.

## js/core/syllables.js
- `splitSyllables(frames, n) -> [{t0, t1, frames}]`: `frames` is the full output of `track()`, voiced and unvoiced. It returns exactly n segments. Each segment's `frames` holds only its voiced frames.
- `scoreWord(samples, sr, zh, py) -> {ok, why?, items:[{syl, expected, heard|null, ok|null, res}]}`
  - `expected` is the surface tone. `ok` is null for neutral tone 5.
  - `res` is the `analyse()` result for that segment, used for drawing.
  - The whole result is ok:false when the recording has no usable voice.

## js/core/match.js
- `normalize(s) -> string`: CJK and alphanumerics only, lowercased.
- `similarity(heard, target) -> 0..1`: LCS length / target length, after normalize.
- `intentCheck(heard, groups) -> {allHit, hit:number[], missed:number[]}`: a group is hit when any of its alternatives is a substring of normalize(heard).

## js/core/progress.js (pure: every function takes the save and returns or mutates it, with no storage access)
- `newSave() -> save`
- `migrate(obj) -> save`: fills missing fields.
- `todayKey(date=new Date()) -> "YYYY-MM-DD"`: local time.
- `addFish(save, n)`
- `markStep(save, day, step)`: step is 'warmup'|'work'|'life'. It also updates the streak.
- `stepsDone(save, day) -> {warmup, work, life}` (booleans)
- `streak(save, day) -> number`: consecutive days with at least one step done, ending today or yesterday.
- `rung(save, sceneId) -> 1|2|3`: the highest rung unlocked.
- `recordRung(save, sceneId, rungNo, passRatio)`: unlocks the next rung when passRatio >= 0.8.
- `reviewMiss(save, item)`: item is `{key, zh, py, en}`. It adds the item or resets its streak to 0.
- `reviewHit(save, key)`: increments the item's streak; at 2 the item is removed.
- `reviewPick(save, n) -> items[]`
- Save shape: `{v:1, fish:0, days:{[day]:{warmup,work,life}}, rungs:{[sceneId]:n}, review:[{key,zh,py,en,streak}], settings:{music:false, pinyin:true}}`

## data
- `data/scenes/index.json`: `["work_huang_price", "life_hawker_chicken_rice"]`
- `data/scenes/<id>.json`: the schema in build-spec-v0.1.md. Option `type` is one of fit|generic|off|blunt|cave. Twist: `{id, en, turn2: {zh,py,en}, prompt: "en hidden objection for the rung-3 prompt", group: ["alt", ...]}`, where `group` is the extra intent group added to turn 2.
