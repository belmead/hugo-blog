import fs from 'node:fs';
import assert from 'node:assert/strict';
const file = 'node_modules/@toast-ui/editor/dist/esm/index.js';
let source = fs.readFileSync(file, 'utf8');
const before = 'this.handleResize = throttle_1(function () {';
// TOAST UI 3.2.2 leaves its throttled resize callback queued after destroy().
const after = `${before}\n            if (!_this.refs.el?.isConnected) return;`;
if (!source.includes(after)) {
  assert.equal(source.split(before).length, 2, 'Review the TOAST UI resize patch before updating the editor.');
  source=source.replace(before, after);
}

const linkBefore="        linkUrlEl.value = linkUrl || '';\n        linkTextEl.value = linkText || '';";
// Focus after the popup is mounted and visible, without scrolling the document.
const linkAfter=linkBefore+"\n        queueMicrotask(() => { if (linkUrlEl.isConnected && this.props.show) { linkUrlEl.focus({ preventScroll: true }); linkUrlEl.select(); } });";
if(!source.includes(linkAfter)){
  assert.equal(source.split(linkBefore).length,2,'Review the TOAST UI link-focus patch before updating the editor.');
  source=source.replace(linkBefore,linkAfter);
}
fs.writeFileSync(file,source);
