// Run: npx vite-node scripts/vision-core.test.ts   (exits non-zero on failure)
import assert from "node:assert/strict";
import { AttentionTracker, LivenessChallenge, attention, eyeAway, eyesClosed, faceRatio, headPose, isFrontal, isLookingAway, type FrameReading } from "../src/lib/vision-core";

const reading = (o: Partial<FrameReading> = {}): FrameReading => ({ faces: 1, faceRatio: 0.4, yaw: 0, pitch: 0, eyeAway: 0, eyesClosed: 0, eyeX: 0, eyeY: 0, ...o });

// identity rotation = looking straight at the camera
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
assert.deepEqual(Object.values(headPose(identity)).map((n) => Math.round(n)), [0, 0]);
// head turned 40 degrees about Y: forward vector (sin40, 0, cos40)
const a = (40 * Math.PI) / 180;
const turned = [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
assert.ok(Math.abs(headPose(turned).yaw - 40) < 1, `yaw ${headPose(turned).yaw}`);

assert.equal(eyeAway({}), 0);
assert.ok(eyeAway({ eyeLookOutRight: 0.9, eyeLookInLeft: 0.9 }) > 0.8);
assert.ok(Math.abs(faceRatio([{ x: 0.3 }, { x: 0.7 }, { x: 0.5 }]) - 0.4) < 1e-9);

assert.equal(attention({ ...reading(), faces: 0 }), 0);
assert.equal(attention(reading()), 100);
assert.ok(attention(reading({ yaw: 30 })) < attention(reading({ yaw: 10 })));
assert.ok(isLookingAway(reading({ yaw: 50 })) && !isLookingAway(reading({ yaw: 10 })));

// no face: nothing for 4 s, one violation at 5 s, silent during the cooldown, again after it
const t = new AttentionTracker();
let events = 0;
for (let s = 0; s <= 4; s += 0.25) events += t.update(reading({ faces: 0 }), s).length;
assert.equal(events, 0);
assert.equal(t.update(reading({ faces: 0 }), 5).length, 1);
assert.equal(t.update(reading({ faces: 0 }), 20).length, 0, "cooldown");
assert.equal(t.update(reading({ faces: 0 }), 36).length, 1, "reported again after the cooldown");

// a blip resets the timer: the face returns for one frame
const t2 = new AttentionTracker();
t2.update(reading({ faces: 0 }), 0);
t2.update(reading(), 3);
assert.equal(t2.update(reading({ faces: 0 }), 6).length, 0);

// two faces are reported fast, looking away slowly
const t3 = new AttentionTracker();
t3.update(reading({ faces: 2 }), 0);
assert.equal(t3.update(reading({ faces: 2 }), 2)[0]?.kind, "MULTIPLE_PEOPLE");
const t4 = new AttentionTracker();
t4.update(reading({ yaw: 60 }), 0);
assert.equal(t4.update(reading({ yaw: 60 }), 3).length, 0);
assert.equal(t4.update(reading({ yaw: 60 }), 6)[0]?.kind, "LOOKING_AWAY");

// far away
const t5 = new AttentionTracker();
t5.update(reading({ faceRatio: 0.08 }), 0);
assert.equal(t5.update(reading({ faceRatio: 0.08 }), 8)[0]?.kind, "FACE_TOO_FAR");

// the lobby is stricter than the exam: straight face, open visible eyes, close enough
assert.ok(isFrontal(reading({ faceRatio: 0.3 })));
assert.ok(!isFrontal(reading({ faceRatio: 0.3, yaw: 20 })), "20 degrees is not straight");
assert.ok(!isFrontal(reading({ faceRatio: 0.3, eyesClosed: 0.7 })), "eyes must be visible");
assert.ok(!isFrontal(reading({ faceRatio: 0.1 })), "too far");
assert.ok(!isFrontal(reading({ faceRatio: 0.3, faces: 2 })));
assert.ok(isLookingAway(reading({ yaw: 30 })) && !isLookingAway(reading({ yaw: 20 })));
assert.ok(isLookingAway(reading({ eyesClosed: 0.8 })), "hidden eyes count as not facing the screen");
assert.equal(eyesClosed({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.1 }), 0.1, "a single blink is ignored");

// the eyes glance away while the head faces the screen: its own, quicker event
const g = new AttentionTracker();
g.update(reading({ eyeAway: 0.7, eyeX: 0.7 }), 0);
assert.equal(g.update(reading({ eyeAway: 0.7, eyeX: 0.7 }), 3).length, 0);
const glance = g.update(reading({ eyeAway: 0.7, eyeX: 0.7 }), 4.5)[0];
assert.equal(glance?.kind, "GAZE_AWAY");
assert.ok(glance.message.includes("ngang"), glance.message);
// a turned head is LOOKING_AWAY, never also a gaze event
const h = new AttentionTracker();
h.update(reading({ yaw: 50, eyeAway: 0.7 }), 0);
const kinds = h.update(reading({ yaw: 50, eyeAway: 0.7 }), 7).map((e) => e.kind);
assert.deepEqual(kinds, ["LOOKING_AWAY"]);

console.log("vision-core ok");

// liveness: blink twice + turn the head, in either order; a still face fails after the time limit
{
  const blinkTwice = (c: LivenessChallenge, t0: number) => {
    let last = c.update(reading({ eyesClosed: 0 }), t0);
    for (const [i, closed] of [1, 0, 1, 0].entries()) last = c.update(reading({ eyesClosed: closed ? 0.9 : 0.1 }), t0 + 0.2 * (i + 1));
    return last;
  };
  const turn = (c: LivenessChallenge, t0: number) => {
    c.update(reading({ yaw: 0 }), t0);
    c.update(reading({ yaw: 35 }), t0 + 0.3);
    return c.update(reading({ yaw: 5 }), t0 + 0.6);
  };
  for (const first of [0.1, 0.9]) {
    const c = new LivenessChallenge(() => first);
    const order = c.steps;
    const s1 = order[0] === "blink" ? blinkTwice(c, 0) : turn(c, 0);
    assert.equal(s1.done, false);
    assert.equal(s1.step, order[1]);
    const s2 = order[1] === "blink" ? blinkTwice(c, 2) : turn(c, 2);
    assert.ok(s2.done && !s2.failed && s2.progress === 1, "both steps done");
  }
  const still = new LivenessChallenge(() => 0.1);
  let st = still.update(reading(), 0);
  for (let s = 1; s <= 11; s++) st = still.update(reading(), s);
  assert.ok(st.failed && !st.done, "a face that never moves fails");
  const two = new LivenessChallenge(() => 0.1);
  two.update(reading({ faces: 2, eyesClosed: 0.9 }), 0);
  assert.equal(two.update(reading({ faces: 2, eyesClosed: 0.1 }), 0.3).progress, 0, "nothing counts with two faces in view");
  // a single blink is not enough
  const one = new LivenessChallenge(() => 0.1);
  for (const [i, closed] of [1, 0].entries()) one.update(reading({ eyesClosed: closed ? 0.9 : 0.1 }), 0.2 * i);
  assert.equal(one.update(reading({ eyesClosed: 0.1 }), 1).step, "blink");
}
console.log("liveness ok");

// speech gate: 2.5 s of voice-band energy triggers once, keyboard-like bursts and a noisy room do not
{
  const { SpeechGate } = await import("../src/lib/speech-core");
  const g = new SpeechGate();
  let t = 0;
  let fired = 0;
  for (let i = 0; i < 40; i++) fired += g.update({ voice: 0.003, total: 0.004 }, (t += 100)) ? 1 : 0; // quiet room
  assert.equal(fired, 0);
  for (let i = 0; i < 20; i++) fired += g.update({ voice: 0.2, total: 0.25 }, (t += 100)) ? 1 : 0; // 2 s of talking
  assert.equal(fired, 0, "2 s is not enough");
  for (let i = 0; i < 10; i++) fired += g.update({ voice: 0.2, total: 0.25 }, (t += 100)) ? 1 : 0;
  assert.equal(fired, 1, "sustained speech fires once");
  for (let i = 0; i < 60; i++) fired += g.update({ voice: 0.2, total: 0.25 }, (t += 100)) ? 1 : 0;
  assert.equal(fired, 1, "cooldown");
  const k = new SpeechGate();
  let kf = 0;
  for (let i = 0; i < 100; i++) kf += k.update(i % 10 === 0 ? { voice: 0.2, total: 0.6 } : { voice: 0.003, total: 0.004 }, i * 100) ? 1 : 0;
  assert.equal(kf, 0, "short broadband clicks are not speech");
  console.log("speech ok");
}
