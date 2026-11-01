import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  WORLD_COOKIE_KEY,
  GIRL_TEST_COPY,
  createDefaultWorldState,
  parseWorldState,
  serializeWorldState,
  mergeWorldStates,
  readWorldCookie,
  advanceEncounterState,
  applyPuzzleAction,
  stepSpring,
  resolveCookieDomain,
  mountLivingWorld,
} from "../public/p34-living.js";

test("normal blog route guard executes no DOM, storage, or audio side effects", () => {
  (globalThis as any).location = { search: "" };
  try {
    const cleanup = mountLivingWorld();
    assert.equal(typeof cleanup, "function");
    cleanup();
  } finally {
    delete (globalThis as any).location;
  }
});

test("cross-subdomain state validator and A -> B -> A puzzle state machine enforce dependencies", () => {
  assert.equal(WORLD_COOKIE_KEY, "p34_world_v1");
  assert.equal(parseWorldState("corrupted").valid, false);
  assert.equal(resolveCookieDomain("blog.sayori.org"), ".sayori.org");
  assert.equal(resolveCookieDomain("sayori.org"), ".sayori.org");

  const blogStart = advanceEncounterState(createDefaultWorldState(), "blog");
  assert.equal(blogStart.encounterType, "blog-first");
  assert.equal(blogStart.state.first, "blog");
  assert.equal(blogStart.state.bm, 1);

  // Cannot open Blog second door without Home rubbing
  const locked = applyPuzzleAction(blogStart.state, "try-blog-door");
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, "locked-from-back");
  assert.equal(locked.state.ba, 0);

  // Cross to Home, find rubbing, return to Blog and open door
  const homeCross = advanceEncounterState(locked.state, "home");
  assert.equal(homeCross.encounterType, "home-from-blog");
  const withRubbing = applyPuzzleAction(homeCross.state, "find-rubbing");
  assert.equal(withRubbing.ok, true);
  assert.equal(withRubbing.state.hk, 1);

  const token = serializeWorldState(withRubbing.state);
  const restoredOnBlog = parseWorldState(token);
  assert.equal(restoredOnBlog.valid, true);
  assert.equal(restoredOnBlog.state.hk, 1);

  const unlockedDoor = applyPuzzleAction(restoredOnBlog.state, "try-blog-door");
  assert.equal(unlockedDoor.ok, true);
  assert.equal(unlockedDoor.unlocked, "music-strip");
  assert.equal(unlockedDoor.state.ba, 1);

  const merged = mergeWorldStates(blogStart.state, unlockedDoor.state);
  assert.equal(merged.ba, 1);
  assert.equal(merged.hk, 1);
});

test("spring physics settles cleanly and rejected floating UI widgets are absent", () => {
  let pos = -18;
  let vel = 40;
  let settled = false;
  for (let i = 0; i < 240 && !settled; i++) {
    const step = stepSpring(pos, vel, 0, 240, 18, 1 / 60);
    pos = step.pos;
    vel = step.vel;
    settled = step.settled;
  }
  assert.equal(settled, true);
  assert.equal(pos, 0);

  const js = fs.readFileSync(new URL("../public/p34-living.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../public/p34-living.css", import.meta.url), "utf8");
  assert.doesNotMatch(js + "\n" + css, /p34-girl-dock|p34-girl-figure|p34-under-sticky-mark|p34-piano-badge|p34-secret-interleaf|页边折签 · 034/);
  assert.doesNotMatch(js, /stopImmediatePropagation/);
  assert.doesNotMatch(css, /perspective\(|rotateY\(/);

});

test("multi-tab cookie sync preserves blog door unlock when returning to an already-open home tab", () => {
  let homeTab = advanceEncounterState(createDefaultWorldState(), "home").state;
  homeTab = applyPuzzleAction(homeTab, "find-rubbing").state;
  let cookieJar = `${WORLD_COOKIE_KEY}=${encodeURIComponent(serializeWorldState(homeTab))}`;

  let blogTab = advanceEncounterState(readWorldCookie(cookieJar), "blog").state;
  blogTab = applyPuzzleAction(blogTab, "try-blog-door").state;
  cookieJar = `${WORLD_COOKIE_KEY}=${encodeURIComponent(serializeWorldState(blogTab))}`;

  // Home tab syncs from cookie before handling piano click
  homeTab = mergeWorldStates(homeTab, readWorldCookie(cookieJar));
  assert.equal(homeTab.bm, 1);
  assert.equal(homeTab.ba, 1);
  const res = applyPuzzleAction(homeTab, "play-desk-chime");
  assert.equal(res.ok, true);
  assert.equal(res.state.dc, 1);
  assert.ok(GIRL_TEST_COPY.meta.authorPending.length > 0);
});

