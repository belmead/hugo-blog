import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageMarkdown } from '../src/image-markdown.js';
test('image Markdown uses the image URL and escapes alt-text brackets',()=>{
  assert.equal(imageMarkdown({name:'gotho-computer.png',url:'/uploads/gotho-computer.png'}),'![gotho-computer.png](/uploads/gotho-computer.png)');
  assert.equal(imageMarkdown({name:'a[b]\\c.png',url:'/img/a%5Bb%5D%5Cc.png'}),'![a\\[b\\]\\\\c.png](/img/a%5Bb%5D%5Cc.png)');
});
