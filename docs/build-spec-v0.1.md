# Mandarin Game v0.1: build spec (vertical slice)

Repo: C:\Dev\Mandarin Game (GitHub veganchickenergelbow/mandarin-game, Pages from main root). Live: https://veganchickenergelbow.github.io/mandarin-game/
Player: Lucas, Singapore O-level Chinese B4 (about HSK 3-4), plays on an iPhone in Safari. The career track (B2B sales) is the main focus; daily life in Singapore is the second track.

## Stack (copy Cosy Trivia's approach, C:\Dev\Cosy Trivia, READ ONLY: do not modify that repo)
- Vanilla JS ES modules, no build step, PWA (manifest + sw.js with a VERSION constant to bump on every deploy), mobile-first.
- Look: Cosy Trivia's style (flat, chunky, Duolingo-like but cuter; ui-rounded font; 3D-press buttons; cream background). Reuse its CSS tokens and button styles. Chinese text uses PingFang SC / Noto Sans SC.
- Reuse Cosy Trivia's js/audio.js (music optional and off by default) and its save pattern (localStorage key mg.save, a migrate() that fills new fields, falling back to memory with a toast).
- Tests: npm test = node --test tests/*.test.mjs.
- Layout: index.html, style.css, js/main.js, js/core/*.js (pure logic, tested), js/screens/*.js, data/*.json, tone-test.html (move the current index.html here unchanged so it still works).

## Core modules (pure, tested)
- js/core/pitch.js: move yin / downsample / pitchTrack / analyse / classify out of the current page. Keep its tests and its behaviour (the tone-4 fix works on Lucas's phone).
- js/core/syllables.js: split one recording into N syllables (N is known from the target pinyin). Find energy valleys or voicing gaps in the 5 ms frames, and choose the N-1 deepest valleys that are at least 60 ms apart. If there are too few valleys, split the voiced span equally. Classify each segment's tone.
- js/core/sandhi.js: expected surface tones from the dictionary tones. A 3-3 sequence becomes 2-3. 不 before a tone 4 becomes 2. 一 before a tone 4 becomes 2, and before tones 1-3 becomes 4. Neutral tones (5) are not scored.
- js/core/match.js: (a) similarity(heard, target) is the character-level overlap of the Chinese text after stripping punctuation and spaces (an LCS ratio). (b) intentCheck(heard, groups), where groups is an array of arrays of accepted alternatives: every group must have at least one alternative present. It returns which groups were hit and which were missed.
- js/core/progress.js: the save, fish, per-scene rung reached, review deck (weak words and syllables, removed after 2 correct in a row), daily streak.

## Speech
- TTS: speechSynthesis with a zh-CN voice (prefer an iOS "Tingting"/zh-CN voice), rate 0.9 normally and 1.05 for the "hurried" mood.
- Speech to text: webkitSpeechRecognition with lang zh-CN, interim results shown live. Do NOT run it at the same time as the raw mic recording. Sentences use speech to text only; tone scoring is done on words and short phrases (the warm-up).
- If speech to text is unavailable or errors: offer "Type it instead" (a text input checked by the same matcher) and an "I said it" self-check button that awards half fish.

## Daily loop (Home screen)
Home shows the date, fish total, streak and a "Today" card with 3 steps: Warm-up -> Work scene -> Life scene. Each step shows a tick when done. The cosy room and cats are out of scope for v0.1. A simple illustrated header is enough (no new art).

1. Warm-up (tone drill): 6 key words or short phrases taken from today's two scenes (e.g. 顾虑, 确实, 不过, 总成本, 打包, 少辣). For each: show the characters and pinyin, a play button to hear it, then Record/Stop. Score each syllable with syllables.js + sandhi.js + classify. Show a per-syllable tick/cross under the pinyin, plus the pitch curve against the target (reuse the tone-test drawing). 1 fish per correct syllable. Missed items go into the review deck and come back in later warm-ups.
2. Scene (shared engine for work and life): a character card (name, role, mood), then turns. Each turn: the NPC line is spoken by TTS and shown with a pinyin toggle and English on tap.
   - Rung 1 "Pick, then say": choose from 4 replies. Feedback says why, in the 成交 style, with verdict types fit / generic / off / blunt / cave. Then "Now say it": you speak the best reply (always the fit one, even if you picked wrong). Pass when similarity >= 0.7, with one retry. Fish: fit pick +2, said it +2.
   - Rung 2 "Say it your way": only the English intent is shown. You speak, then intentCheck is run against the keyword groups. Show the hit and missed groups, then an example answer to hear. Fish +3 when all groups are hit.
   - Rung 3 "Free talk": a "Practise with ChatGPT voice" button copies a role-play prompt to the clipboard and shows it as selectable text if copying fails. The prompt is built from the scene card: the character, persona, Lucas's goal, the NPC's hidden objection or twist, "speak only Mandarin at HSK 3-4 level, short sentences, Singapore context", and "at the end, give 3 corrections in English". Afterwards, a self-rating (went well / OK / struggled) gives fish and notes.
   - A scene's rung 2 unlocks after rung 1 is passed with >= 80% of turns fit and said. Rung 3 unlocks after rung 2 is passed with >= 80% intents hit.
3. Debrief: a per-turn list (your pick, its verdict, the better reply, whether it was said OK), fish earned, words added to the review deck, and Next.

## Variety dials (per play, random unless the scene is locked)
- mood: patient | hurried, which changes TTS rate and swaps alternate NPC lines where a scene provides them (line.hurried).
- twist: each scene has 2 twists. The twist sets which variant of turn 2 is used, the rung-3 prompt, and one extra intent group.

## Content (data/scenes/*.json): write it carefully, natural Mandarin, Singapore-appropriate
Schema per scene: {id, track: "work"|"life", title{zh,en}, character{name, role, en}, goal (en), twists:[{id,en,turn2:{...line}}], turns:[{npc:{zh,py,en, hurried?:{zh,py,en}}, options:[4 x {zh,py,en,type,why}], intent:{en, groups:[[...],...], example:{zh,py,en}}}], warmup:[{zh,py,en}]}
Exactly one option of type "fit" per turn. Pinyin uses tone marks and is space-separated per syllable, matching the characters 1:1 (validated by tests).
- work_huang_price (黄总, finance director, Lion City Logistics; you sell a cloud data platform). 5 turns: (1) "你们的报价太贵了" -> acknowledge (理解您的顾虑, 确实…不过); (2) twist A "另一家便宜百分之二十" / twist B "今年的预算已经冻结到第三季度" -> ask what their quote includes / offer phasing; (3) "为什么要按用量计费？" -> explain usage billing (按用量计费, 不用就不收费); (4) "总成本真的更低吗？" -> total cost argument (总成本, 反而, 算一下); (5) "我还要跟老板商量" -> secure a next step (试点, 下周, 约个时间).
- life_hawker_chicken_rice (鸡饭阿姨 at a hawker centre). 4 turns: what to order (一份鸡饭，打包), chilli (少辣 / 不要辣), drinks (冰的，少糖, 咖啡乌), paying (刷卡可以吗 / 一共多少钱). Twists: roasted chicken sold out / cash only.
- Add 2-3 tests that validate all scene files against the schema.

## Done means
- npm test passes (pitch tests ported, plus syllables, sandhi, match, schema).
- Loads cleanly in Chromium at 390x844 with no console errors and no horizontal scroll. Check Home, Warm-up, Scene rung 1 and Debrief.
- The tone test still works at /tone-test.html.
- Bump the sw.js VERSION, commit with a clear message, and push to main. Confirm the live URL serves the new Home.
