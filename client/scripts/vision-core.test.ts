// Run: npx vite-node scripts/vision-core.test.ts   (exits non-zero on failure)
import assert from "node:assert/strict";
import { AttentionTracker, attention, eyeAway, faceRatio, headPose, isLookingAway, type FrameReading } from "../src/lib/vision-core";

const reading = (o: Partial<FrameReading> = {}): FrameReading => ({ faces: 1, faceRatio: 0.4, yaw: 0, pitch: 0, eyeAway: 0, ...o });

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

console.log("vision-core ok");
