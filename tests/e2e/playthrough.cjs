/* eslint-disable */
/**
 * End-to-end playthrough of the whole game (Parts 1–3) in a headless browser.
 *   npm run dev            (in another terminal)
 *   npm run test:e2e       (BASE_URL and SHOTS env vars are optional)
 * Requires Playwright with Chromium available to Node.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  const S = (fn, arg) => page.evaluate(fn, arg);
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`) });
  const wait = (ms) => page.waitForTimeout(ms);
  const st = () => S(() => window.__store.getState());
  const advance = async (max = 80) => {
    for (let i = 0; i < max; i++) {
      const d = await S(() => { const d = window.__store.getState().dialogue; return d ? { choices: !!d.choices, last: d.index === d.lines.length - 1 } : null; });
      if (!d) return;
      if (d.choices && d.last) return;
      await page.keyboard.press('KeyE');
      await wait(240);
      await page.keyboard.press('KeyE');
      await wait(240);
    }
  };
  const walkTo = async (x) => {
    await S((x) => { window.__game.current.player.targetX = x; }, x);
    for (let i = 0; i < 60; i++) {
      await wait(200);
      const px = await S(() => window.__game.current.player.x);
      if (Math.abs(px - x) < 12) return;
    }
  };
  const travel = async (area, spawn) => {
    await S(([a, s]) => window.__store.getState().travel(a, 'fade', s), [area, spawn]);
    await wait(1600);
  };

  /** Plays whichever console mini-game is running, by reading the screen state. */
  const playConsoleGame = async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      const info = await S(() => {
        const sc = window.__game.scenes.hq;
        const mg = sc.minigame;
        if (!mg) return null;
        const g = window.__game;
        const cam = sc.camera;
        const toClient = (u, v) => { const s = cam.worldToScreen(1330 + u * 740, 96 + v * 372); return g.stageToClient(s.x, s.y); };
        const o = { emotion: mg.emotion, finished: mg.finishing >= 0 };
        if (mg.emotion === 'fear') o.targets = mg.beat.fear.hazards.map((h, i) => ({ c: toClient(h.x, h.y), f: mg.found[i] }));
        if (mg.emotion === 'disgust') o.items = mg.items.slice(0, mg.spawned).map((it) => ({ u: it.u, bad: it.bad, st: it.state }));
        if (mg.emotion === 'anger') { o.needle = mg.needle; o.locked = mg.locked; }
        return o;
      });
      if (!info) return;
      if (info.finished) { await wait(120); continue; }
      if (info.emotion === 'fear') { const t = info.targets.find((x) => x.f < 1); if (t) { await page.mouse.move(t.c.x, t.c.y, { steps: 4 }); await wait(650); } }
      else if (info.emotion === 'disgust') { const it = info.items.find((i) => i.st === 'moving' && i.u > 0.36 && i.u < 0.66); if (it && it.bad) await page.keyboard.press('Space'); await wait(80); }
      else if (info.emotion === 'anger') { if (info.locked < 0 && info.needle > 0.6 && info.needle < 0.75) await page.keyboard.press('Space'); await wait(16); }
      else if (info.emotion === 'sadness') { await page.keyboard.down('Space'); await wait(4200); await page.keyboard.up('Space'); }
      else if (info.emotion === 'joy') { await page.keyboard.press('Space'); await wait(350); }
    }
  };

  /** Runs one full day at the console with the given mixes (keys 1-5, repeated for more points). */
  const playDay = async (mixes, label) => {
    await walkTo(1640);
    await page.keyboard.press('KeyE');
    await wait(1800);
    await shot(`${label}-1-opening`);
    check(`${label}: opening scene plays`, (await st()).consoleStage === 'cinematic');
    await page.keyboard.press('Space');
    await wait(500);
    for (let m = 0; m < mixes.length; m++) {
      await advance();
      check(`${label}: moment ${m + 1} reaches the mixer`, (await st()).consoleStage === 'mix');
      for (const k of mixes[m]) { await page.keyboard.press('Digit' + k); await wait(120); }
      await wait(300);
      if (m === 0) await shot(`${label}-2-mixer`);
      await page.keyboard.press('Enter');
      await wait(500);
      if (m === 0) await shot(`${label}-3-minigame`);
      await playConsoleGame();
      await wait(800);
      if (m === 0) await shot(`${label}-4-outcome`);
    }
    await advance();
    await wait(3000);
    await advance();
    await wait(800);
  };

  const sleep = async (label) => {
    await walkTo(1640);
    await page.keyboard.press('KeyE');
    await wait(500);
    await advance();
    await page.click('.dialogue button:has-text("Let Riley sleep")');
    await wait(700);
    await shot(`${label}-night`);
    const night = (await st()).nightReport;
    await page.click('.night .primary');
    await wait(500);
    return night;
  };


  /** Switches emotion, walks over, uses the ability and clears any dialogue. */
  const useAbilityAt = async (emo, x) => {
    await S((e) => window.__store.getState().setActive(e), emo);
    await wait(250);
    if (x !== undefined) await walkTo(x);
    await page.keyboard.press('KeyQ');
    await wait(900);
    await advance();
  };
  const interactAt = async (x) => {
    await walkTo(x);
    await page.keyboard.press('KeyE');
    await wait(600);
  };
  /** Plays a hosted activity in Imagination Land / Dream Productions by reading its state. */
  const playHosted = async (ms = 60000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const a = await S(() => {
        const ac = window.__game.current.activity;
        if (!ac) return null;
        return { title: ac.title, target: ac.target, opts: ac.options ? ac.options.map((o) => o.shape) : null, cue: ac.cues ? ac.cues.filter((c) => c.hit === 'none')[0] : null, t: ac.t };
      });
      if (!a) return true;
      if (a.opts) {
        const k = a.opts.indexOf(a.target);
        if (k >= 0) await page.keyboard.press('Digit' + (k + 1));
        await wait(450);
      } else if (a.cue) {
        if (Math.abs(a.cue.t - a.t) < 0.1) await page.keyboard.press('Digit' + (a.cue.lane + 1));
        await wait(25);
      } else await wait(100);
    }
    return false;
  };
  /** Builds the bridge in Imagination Land (if needed) and shoots tonight's dream. */
  const shootDream = async (label) => {
    await travel('imagination', 300);
    check(`${label}: Imagination Land loads`, (await st()).area === 'imagination');
    if (!(await st()).flags.imagBridge) {
      await interactAt(2200);
      check(`${label}: the Gap of Nothing starts the bridge challenge`, (await st()).activity === 'imagination-bridge');
      await shot('p3-bridge');
      await playHosted();
      await advance();
      check(`${label}: the imagined bridge is built`, !!(await st()).flags.imagBridge);
    }
    await interactAt(4150);
    await wait(1800);
    await advance();
    check(`${label}: the studio gate leads to Dream Productions`, (await st()).area === 'dreams');
    await interactAt(880);
    await page.click('.dialogue button >> nth=0');
    await wait(400);
    await advance();
    await useAbilityAt('joy', 1220);
    await interactAt(1220);
    await advance();
    await interactAt(3300);
    check(`${label}: Stage 1 starts the dream shoot`, (await st()).activity === 'dream-take');
    await shot('p3-dream-take');
    await playHosted();
    await wait(800);
    const now = await st();
    const d = now.progress.dreams;
    check(`${label}: tonight's dream is recorded`, d.some((x) => x.day === now.mind.day), JSON.stringify(d));
    await shot('p3-dream-premiere');
    await travel('hq', 1600);
  };

  // ───────── start fresh, skip the intro, mark Part 1 as played ─────────
  await page.goto(BASE);
  await S(() => localStorage.clear());
  await page.reload();
  await wait(600);
  await page.click('.title__start');
  await wait(300);
  await page.keyboard.press('Escape');
  await wait(1200);
  await S(() => {
    const s = window.__store.getState();
    const shelf = [...s.coreShelf];
    shelf[2] = { id: 'core-artclub', title: 'Cloud cat with Priya', emotion: 'joy', text: '', hidden: '', core: true, swirl: ['fear', 'anger'] };
    window.__store.setState({
      flags: { introDone: true, scenarioIntro: true, scenarioDone: true, doorOpen: true, friendshipCelebrated: true, islandsVisited: true, memoryVisited: true, boulder: true },
      objective: 'free',
      beat: 4,
      results: [{ beatId: 'a', emotion: 'fear', tone: 'great', score: 1 }, { beatId: 'b', emotion: 'joy', tone: 'great', score: 1 }],
      coreShelf: shelf,
      islands: { ...s.islands, friendship: true },
    });
  });
  await wait(2500);

  // ───────── end of day 1 ─────────
  const n1 = await sleep('d1');
  check('first sleep starts Part 2 on day 2', (await st()).mind?.day === 2, `night report day ${n1?.day}`);

  // ───────── day 2: missing home, with mixed feelings ─────────
  await playDay([[2, 1], [2, 1]], 'd2');
  let s = await st();
  check('day 2 makes a memory of the scenario', !!s.mind.memories['sc-move'], JSON.stringify(s.mind.memories['sc-move'] || {}));
  check('mixed feelings set lasting flags', !!(s.flags.keptInTouch && s.flags.toldParentsTruth), Object.keys(s.flags).join(','));
  check('a delayed consequence is waiting', s.mind.pending.length > 0, s.mind.pending.map((p) => p.id).join(','));

  // ───────── journal, replay, lenses, recolour ─────────
  await page.keyboard.press('KeyJ');
  await wait(400);
  await shot('j1-journal');
  await page.click('.jar[aria-label^="Dinner in the new house"]');
  await wait(800);
  await shot('j2-theatre');
  const tid = (await st()).theatre;
  await page.click('.lens >> text=Sadness');
  await wait(600);
  await shot('j3-theatre-sadness');
  await page.click('.lens >> text=Anger');
  await wait(400);
  const before = (await st()).mind.memories[tid];
  const balanceBefore = (await st()).mind.stats.balance;
  await page.click('.theatre__recolor .chip >> text=Anger');
  await wait(400);
  const after = (await st()).mind.memories[tid];
  check('lenses are recorded on the memory', after.lenses.includes('sadness') && after.lenses.includes('anger'), `${tid}: ${after.lenses}`);
  check('Riley can remember it in a new colour, with consequences', after.emotion === 'anger' && before.emotion !== 'anger' && after.recolors === 1, `${before.emotion} -> ${after.emotion}, balance ${balanceBefore} -> ${(await st()).mind.stats.balance}`);
  await shot('j4-recoloured');
  // core memories keep their colour
  await page.keyboard.press('Escape');
  await wait(300);
  await page.click('.jar[aria-label^="Pancake tower"]');
  await wait(600);
  check('core memories cannot be recoloured', (await page.$$('.theatre__recolor')).length === 0);
  await page.keyboard.press('Escape');
  await wait(300);
  await page.keyboard.press('Escape');
  await wait(300);
  await page.keyboard.press('KeyR');
  await wait(400);
  await shot('r1-report');
  await page.keyboard.press('Escape');
  await wait(300);

  // ───────── Long-Term Memory ─────────
  await travel('memory', 260);
  await shot('m1-memory');
  check('Long-Term Memory loads', (await st()).area === 'memory');
  await walkTo(600);
  await page.keyboard.press('KeyE');
  await wait(800);
  check('replaying a shelf memory opens the projector', !!(await st()).theatre);
  await shot('m2-replay');
  const sid = (await st()).theatre;
  check('replaying marks it discovered', (await st()).mind.memories[sid].discovered);
  await page.keyboard.press('Escape');
  await wait(300);

  // ───────── The Fading ─────────
  await travel('fading', 220);
  await shot('f1-fading');
  check('The Fading loads', (await st()).area === 'fading');
  await walkTo(520);
  await page.keyboard.press('KeyE');
  await wait(800);
  const fid = (await st()).theatre;
  await shot('f2-forgotten');
  await page.click('text=Bring it back to Long-Term Memory');
  await wait(300);
  check('a forgotten memory can be brought back', (await st()).mind.memories[fid]?.status === 'long-term', fid);
  await page.keyboard.press('Escape');
  await wait(300);

  // ───────── the four islands and their activities ─────────
  const islandRuns = [
    ['isle-family', 1570, 'family-pancakes'],
    ['isle-friendship', 700, 'friendship-bracelet'],
    ['isle-hockey', 1250, 'hockey-shots'],
    ['isle-goofball', 1000, 'goofball-bounce'],
  ];
  for (const [area, x, act] of islandRuns) {
    await travel(area, 320);
    await wait(600);
    await shot(`i-${area}`);
    check(`${area} loads`, (await st()).area === area);
    await walkTo(x);
    await page.keyboard.press('KeyE');
    await wait(700);
    check(`${area}: activity starts`, (await st()).activity === act);
    await shot(`i-${area}-activity`);
    const t0 = Date.now();
    while (Date.now() - t0 < 40000 && (await st()).activity) {
      const a = await S(() => {
        const sc = window.__game.current;
        const ac = sc.activity;
        if (!ac) return null;
        return { title: ac.title, cook: ac.cook, flip: ac.flipT, phase: ac.phase, seq: ac.seq, input: ac.input, aim: ac.aim, goalie: ac.goalie, puck: !!ac.puck, x: ac.x, y: ac.y, gig: (ac.giggles || []).map((g) => [g.x, g.y]), end: ac.endT };
      });
      if (!a || a.end >= 0) { await wait(200); continue; }
      if (a.title === 'Sunday pancakes') { if (a.flip < 0 && a.cook > 0.62 && a.cook < 0.78) await page.keyboard.press('Space'); await wait(30); }
      else if (a.title === 'Friendship bracelet') {
        if (a.phase === 'input') { const k = a.seq[a.input.length]; await page.keyboard.press(['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'][k]); await wait(200); }
        else await wait(150);
      } else if (a.title === 'Penalty shots') { if (!a.puck && Math.abs(a.aim - a.goalie) > 0.3) await page.keyboard.press('Space'); await wait(30); }
      else {
        const g = a.gig.sort((p, q) => Math.abs(p[0] - a.x) - Math.abs(q[0] - a.x))[0];
        const dir = g ? (g[0] > a.x + 0.03 ? 'ArrowRight' : g[0] < a.x - 0.03 ? 'ArrowLeft' : null) : null;
        if (dir) { await page.keyboard.down(dir); await wait(120); await page.keyboard.up(dir); }
        await page.keyboard.down('Space'); await wait(g && g[1] < 0.4 ? 650 : 250); await page.keyboard.up('Space'); await wait(250);
      }
    }
    await wait(800);
    s = await st();
    check(`${area}: activity pays out once today`, s.mind.activityDay[act] === s.mind.day, `score feeds ${area}`);
    await shot(`i-${area}-done`);
  }

  // ───────── islands hub ─────────
  await travel('islands', 1000);
  await wait(800);
  await shot('h1-hub');

  // ───────── day 3: let anger take over, then watch the consequences arrive ─────────
  await travel('hq', 1600);
  await wait(500);
  const n2 = await sleep('d2');
  check('night 2 reports what happened', !!n2 && n2.day === 3, `fired: ${(n2?.fired || []).map((f) => f.text.slice(0, 40)).join(' | ')}`);
  const famBefore = (await st()).mind.islands.family;
  await playDay([[3, 3, 3], [5, 5, 5]], 'd3');
  s = await st();
  check('anger taking over slams the door', !!s.flags.slammedDoor);
  check('it shakes Family Island straight away', s.mind.islands.family < famBefore, `${famBefore} -> ${s.mind.islands.family}`);
  const n3 = await sleep('d3');
  check('the consequence catches up the next night', (n3?.fired || []).some((f) => /frame|quiet/i.test(f.text)), (n3?.fired || []).map((f) => f.text).join(' | '));
  await travel('isle-family', 320);
  await wait(1500);
  await shot('i-family-after-argument');

  // ───────── persistence ─────────
  const day = (await st()).mind.day;
  await page.reload();
  await wait(800);
  await shot('p1-title-continue');
  await page.click('text=Continue');
  await wait(2000);
  s = await st();
  check('progress survives a reload', s.mind?.day === day && s.phase === 'playing', `day ${s.mind?.day}, area ${s.area}`);

  // ───────── days 4 to 6: the rest of the week, with different blends ─────────
  await travel('hq', 1600);
  await wait(800);
  const week = [
    [4, [[4, 1], [2, 5]], 'sc-lunch'],
    [5, [[2, 1], [2, 5]], 'sc-game'],
    [6, [[2, 1], [5, 1]], 'sc-excluded'],
  ];
  for (const [d, mixes, mem] of week) {
    check(`day ${d} is waiting at the console`, (await st()).objective === 'p2-day' && (await st()).mind.day === d);
    await playDay(mixes, `d${d}`);
    check(`day ${d} makes its memory`, !!(await st()).mind.memories[mem]);
    if (d === 5) {
      await shootDream('d5');
      const nd = await sleep('d5');
      check('tonight’s dream shows up in the night report', (nd?.notes || []).some((n) => /dreamed/.test(n.text)), (nd?.notes || []).map((n) => n.text).join(' | '));
      continue;
    }
    await sleep(`d${d}`);
  }
  s = await st();
  check('the week ends, the report opens and Day 7 is next', s.objective === 'p3-final' && s.reportOpen, `objective ${s.objective}`);
  await shot('end-report');
  check('five scenarios are recorded', s.mind.scenariosDone.length === 5, s.mind.scenariosDone.join(','));


  // ═════════════════════════ PART 3: THE COMPLETE MIND ═════════════════════════
  if ((await st()).reportOpen) await page.keyboard.press('Escape');
  await wait(400);
  check('nothing is left open before exploring', !(await st()).reportOpen && !(await st()).menuOpen);

  // ───────── Imagination Land: hidden discoveries for each emotion ─────────
  await travel('islands', 3300);
  await walkTo(3500);
  await shot('p3-ribbon');
  await page.keyboard.press('KeyE');
  await wait(2200);
  await advance();
  check('the daydream ribbon on the cliffs leads to Imagination Land', (await st()).area === 'imagination');
  await useAbilityAt('joy', 950);
  await useAbilityAt('sadness', 2030);
  await useAbilityAt('anger', 2820);
  await useAbilityAt('fear', 3180);
  await interactAt(3180);
  await wait(2500);
  await advance();
  await useAbilityAt('disgust', 3560);
  await shot('p3-imagination');
  s = await st();
  const imag = s.progress.insights.filter((i) => i.startsWith('imag'));
  check('every emotion finds its own secret in Imagination Land', imag.length === 5, imag.join(','));
  await interactAt(1320);
  await wait(400);
  check('the Kaleidoscope Tower rearranges the land', (await S(() => window.__game.current.whim)) !== 'daydream');
  await shot('p3-whim');

  // ───────── Dream Productions: every station reacts to its emotion ─────────
  await interactAt(4150);
  await wait(1800);
  await advance();
  for (const [e, x] of [['sadness', 1560], ['anger', 1900], ['fear', 2240], ['disgust', 2580]]) await useAbilityAt(e, x);
  s = await st();
  check('each production station teaches its emotion something', s.progress.insights.filter((i) => i.startsWith('dream')).length === 5, s.progress.insights.join(','));
  await interactAt(560);
  await shot('p3-lumen');
  await advance();

  // ───────── The Subconscious: the mission to open the Closed Door ─────────
  await travel('fading', 2800);
  await walkTo(2960);
  await shot('p3-stairwell');
  await page.keyboard.press('KeyE');
  await wait(2000);
  await advance();
  check('the stairwell in The Fading leads down to the Subconscious', (await st()).area === 'subconscious');
  await shot('p3-sub-dark');
  await interactAt(3350);
  await advance();
  check('the Closed Door stays shut without its keys', !(await st()).flags.vaultOpened);
  await useAbilityAt('joy', 1300);
  await useAbilityAt('fear', 1080);
  await useAbilityAt('sadness', 1650);
  await useAbilityAt('fear', 1980);
  await interactAt(2250);
  await advance();
  await useAbilityAt('disgust', 2560);
  await useAbilityAt('sadness', 2840);
  await useAbilityAt('anger', 3060);
  await shot('p3-sub-lit');
  s = await st();
  check('all five hidden fears are found', s.progress.fears.length === 5, s.progress.fears.join(','));
  check('all three keys are earned', !!(s.flags.subKeySad && s.flags.subKeyFear && s.flags.subChain));
  await interactAt(3350);
  await advance();
  await wait(2200);
  s = await st();
  check('the vault opens and the avoided memory returns', s.flags.vaultOpened && s.mind.memories['sealed-house'].status === 'long-term', s.mind.memories['sealed-house'].status);
  check('the avoided memory opens in the projector', s.theatre === 'sealed-house');
  await shot('p3-vault-memory');
  await page.keyboard.press('Escape');
  await wait(300);

  // ───────── Mind Atlas ─────────
  await page.keyboard.press('KeyM');
  await wait(600);
  await shot('p3-atlas');
  check('the Mind Atlas opens in-world', !!(await page.$('.atlas')));
  check('every visited place can be reached from the atlas', (await page.$$('.atlas__spot:not(.is-locked)')).length >= 10, `${(await page.$$('.atlas__spot:not(.is-locked)')).length} reachable`);
  await page.click('.atlas__spot[aria-label^="Headquarters"]');
  await page.click('.atlas__card .primary');
  await wait(1800);
  check('travelling by atlas works', (await st()).area === 'hq');

  // ───────── journal sections ─────────
  await page.keyboard.press('KeyJ');
  await wait(400);
  for (const tab of ['Riley’s week', 'Emotions', 'Discoveries']) {
    await page.click(`.tabs--big button:has-text("${tab}")`);
    await wait(250);
    await shot(`p3-journal-${tab.slice(0, 4).toLowerCase()}`);
  }
  check('the journal shows dreams, fears and levels', (await page.$$('.disc__list li[data-got]')).length >= 5);
  await page.keyboard.press('Escape');
  await wait(300);

  // ───────── pause menu, volumes, saving ─────────
  await page.keyboard.press('Escape');
  await wait(300);
  await shot('p3-pause');
  await page.fill('.sliders input >> nth=0', '0.3');
  await page.click('.menu-list button:has-text("Save now")');
  await wait(300);
  s = await st();
  check('volume settings change from the pause menu', Math.abs(s.musicVolume - 0.3) < 0.01, String(s.musicVolume));
  check('saving stamps the time', s.lastSaved > 0);
  await page.keyboard.press('Escape');
  await wait(300);
  const saved = (await st()).progress;
  await page.reload();
  await wait(800);
  await page.click('text=Continue');
  await wait(2200);
  s = await st();
  check('Part 3 progress survives a reload', s.progress.insights.length === saved.insights.length && s.flags.vaultOpened && s.objective === 'p3-final', `${s.progress.insights.length} insights, objective ${s.objective}`);
  check('volume survives a reload', Math.abs(s.musicVolume - 0.3) < 0.01);

  // ───────── Day 7: the turning point ─────────
  await travel('hq', 1600);
  await walkTo(1640);
  await page.keyboard.press('KeyE');
  await wait(500);
  await advance();
  await page.click('.dialogue button:has-text("Begin the turning point")');
  await wait(1800);
  check('the turning point opens with its own scene', (await st()).consoleStage === 'cinematic');
  await shot('p3-final-1');
  await page.keyboard.press('Space');
  await wait(600);
  const finMixes = [[2, 1, 4], [2, 4, 1], [1, 2, 3, 4, 5, 2]];
  let mi = 0;
  let reflected = false;
  for (let step = 0; step < 8; step++) {
    await advance();
    const stage = (await st()).consoleStage;
    if (stage === 'mix') {
      for (const k of finMixes[mi]) { await page.keyboard.press('Digit' + k); await wait(100); }
      if (mi === 2) {
        await shot('p3-final-meeting');
        check('the family meeting has a bigger influence budget', (await st()).mixInfo?.budget === 6);
      }
      mi++;
      await page.keyboard.press('Enter');
      await wait(500);
      await playConsoleGame();
      await wait(900);
    } else if (stage === 'reflect') {
      await shot('p3-final-reflect');
      const opts = await page.$$eval('.reflect__mem', (b) => b.map((x) => x.getAttribute('aria-label')));
      check('the reflection offers the memory found in the Subconscious', opts.some((o) => o.startsWith('The empty old house')), opts.join(' | '));
      await page.click('.reflect__mem[aria-label^="The empty old house"]');
      const others = await page.$$('.reflect__mem[aria-pressed="false"]');
      for (const b of others.slice(0, 2)) await b.click();
      await page.click('.reflect .primary');
      reflected = true;
      await wait(500);
    } else if (stage === 'off' || stage === 'ending') break;
    else await wait(500);
  }
  await advance();
  await wait(1000);
  s = await st();
  check('the reflection step ran', reflected && (s.finale?.reflection.length ?? 0) === 3);
  check('the turning point reaches an ending', !!s.ending && s.objective === 'complete', JSON.stringify(s.ending));
  check('the ending screen opens', s.endingOpen && !!(await page.$('.ending')));
  check('a balanced, honest night is not an avoidance or isolation ending', s.ending && !['avoidance', 'isolation'].includes(s.ending.id), s.ending?.id);
  check('the ending explains every emotion’s purpose', (await page.$$('.ending__voices li')).length === 5);
  await shot('p3-ending');
  await page.click('.ending button:has-text("Try the turning point again")');
  await wait(500);
  s = await st();
  check('the turning point can be replayed', s.objective === 'p3-final' && !s.endingOpen);

  // ───────── performance ─────────
  const fps = await S(() => window.__game.fps);
  check('the game keeps a smooth frame rate', fps > 40, `${Math.round(fps)} fps`);

  // ───────── phones: the same save, played by touch ─────────
  const save = await S(() => localStorage.getItem('riley-mind-save-v2'));
  for (const [name, device] of [['phone-landscape', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }], ['phone-portrait', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }]]) {
    const ctx = await browser.newContext(device);
    await ctx.addInitScript((raw) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('riley-mind-save-v2', raw); sessionStorage.setItem('seeded', '1'); } }, save);
    const m = await ctx.newPage();
    m.on('pageerror', (e) => errors.push(`${name} pageerror: ` + e.message));
    const MS = (fn, arg) => m.evaluate(fn, arg);
    await m.goto(BASE);
    await m.waitForTimeout(1200);
    await m.tap('text=Continue');
    await m.waitForTimeout(2200);
    check(`${name}: the save continues on a phone`, (await MS(() => window.__store.getState().phase)) === 'playing');
    check(`${name}: touch walk pad is shown`, await m.isVisible('.movepad'));
    const x0 = await MS(() => window.__game.current.player.x);
    const pad = await m.$('.movepad button[aria-label="Walk right"]');
    const box = await pad.boundingBox();
    await m.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await MS(() => window.__game.input.setVirtual('right', true));
    await m.waitForTimeout(700);
    await MS(() => window.__game.input.setVirtual('right', false));
    const x1 = await MS(() => window.__game.current.player.x);
    check(`${name}: holding the pad walks`, x1 > x0 + 20, `${Math.round(x0)} -> ${Math.round(x1)}`);
    const overflow = await MS(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${name}: nothing overflows the screen`, !overflow);
    for (const area of ['imagination', 'dreams', 'subconscious']) {
      await MS((a) => window.__store.getState().travel(a, 'fade', 600), area);
      await m.waitForTimeout(1700);
      await m.screenshot({ path: path.join(SHOTS, `${name}-${area}.png`) });
    }
    await MS(() => window.__store.getState().setMap(true));
    await m.waitForTimeout(500);
    await m.screenshot({ path: path.join(SHOTS, `${name}-atlas.png`) });
    const cardFits = await m.$eval('.atlas__card', (el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1; });
    check(`${name}: the atlas card fits on screen`, cardFits);
    await MS(() => window.__store.getState().setMap(false));
    await MS(() => window.__store.getState().setJournal(true));
    await m.waitForTimeout(400);
    await m.screenshot({ path: path.join(SHOTS, `${name}-journal.png`) });
    await MS(() => window.__store.getState().setJournal(false));
    await ctx.close();
  }

  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed. Screenshots in ${SHOTS}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
