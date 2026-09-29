import assert from "node:assert/strict";
import {
  formatTuition,
  parseTuitionInput,
  tuitionCaret,
} from "../src/modules/csl/lib/tuition-format";
for (const [input, expected] of [
  ["", ""],
  ["0", "0"],
  ["999", "999"],
  ["1000", "1,000"],
  ["1500000", "1,500,000"],
  ["50000000", "50,000,000"],
  ["1,500,000", "1,500,000"],
])
  assert.equal(formatTuition(parseTuitionInput(input)!), expected);
for (const input of [
  "50000001",
  "-1",
  "1.5",
  "1e3",
  "abc",
  ",",
  "9007199254740992",
])
  assert.equal(parseTuitionInput(input), null);
assert.equal(tuitionCaret("1,234,567", 4), 5);
assert.equal(tuitionCaret("1,234", 0), 0);
assert.equal(tuitionCaret("123", 8), 3);
console.log(
  "Tuition formatting, bounds, paste, empty/zero and cursor tests passed.",
);
