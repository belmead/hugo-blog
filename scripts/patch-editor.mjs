import fs from 'node:fs';
import assert from 'node:assert/strict';
const file = 'node_modules/@toast-ui/editor/dist/esm/index.js';
const source = fs.readFileSync(file, 'utf8');
const before = 'this.handleResize = throttle_1(function () {';
// TOAST UI 3.2.2 leaves its throttled resize callback queued after destroy().
const after = `${before}\n            if (!_this.refs.el?.isConnected) return;`;
if (!source.includes(after)) {
  assert.equal(source.split(before).length, 2, 'Review the TOAST UI resize patch before updating the editor.');
  fs.writeFileSync(file, source.replace(before, after));
}
