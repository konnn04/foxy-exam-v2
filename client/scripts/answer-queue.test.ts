// Run: npx vite-node scripts/answer-queue.test.ts
import assert from "node:assert/strict";

const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
g.window = { addEventListener() {}, setTimeout: (f: () => void) => 0 as unknown as number, clearTimeout() {} };
let online = false;
let fail: number | null = null;
const sent: string[] = [];
g.fetch = async (_url: string, init: { body: string }) => {
  if (!online) throw new TypeError("offline");
  sent.push(JSON.parse(init.body).answer_content ?? "");
  return new Response(JSON.stringify(fail ? { message: "no" } : { success: true }), { status: fail ?? 200 });
};

const { queueAnswer, flushAnswers, pendingAnswers } = await import("../src/lib/answerQueue");
const a = (questionId: number, text: string) => ({ examId: 1, attemptId: 9, questionId, answerContent: text });

queueAnswer(a(1, "first"));
queueAnswer(a(1, "second"));
queueAnswer(a(2, "other"));
await flushAnswers();
assert.equal(pendingAnswers(), 2, "offline: both questions wait, the older answer of question 1 was replaced");

online = true;
assert.equal(await flushAnswers(), true);
assert.deepEqual(sent.sort(), ["other", "second"], "only the latest answer of each question is sent");
assert.equal(pendingAnswers(), 0);

fail = 409; // the attempt ended: retrying would never work
queueAnswer(a(3, "late"));
assert.equal(await flushAnswers(), true);
assert.equal(pendingAnswers(), 0, "a rejected answer is dropped");
console.log("answer queue ok");
process.exit(0);
