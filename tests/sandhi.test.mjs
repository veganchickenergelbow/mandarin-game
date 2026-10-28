import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceTones} from '../js/core/sandhi.js';
import {syllables,toneOf,tonesOf,hanziChars} from '../js/core/pinyin.js';

test('3-3 becomes 2-3, and 3-3-3 becomes 2-2-3',()=>{
  assert.deepEqual(surfaceTones('你好',[3,3]),[2,3]);
  assert.deepEqual(surfaceTones('展览馆',[3,3,3]),[2,2,3]);
  assert.deepEqual(surfaceTones('很好吗',[3,3,5]),[2,3,5]);
});
test('3 before other tones stays 3',()=>{
  assert.deepEqual(surfaceTones('老师',[3,1]),[3,1]);
  assert.deepEqual(surfaceTones('好吗',[3,5]),[3,5]);
});
test('不 before tone 4 becomes 2, otherwise stays 4',()=>{
  assert.deepEqual(surfaceTones('不是',[4,4]),[2,4]);
  assert.deepEqual(surfaceTones('不好',[4,3]),[4,3]);
  assert.deepEqual(surfaceTones('不',[4]),[4]);
});
test('一 before 4 becomes 2, before 1-3 becomes 4, alone stays 1',()=>{
  assert.deepEqual(surfaceTones('一共',[1,4]),[2,4]);
  assert.deepEqual(surfaceTones('一起',[1,3]),[4,3]);
  assert.deepEqual(surfaceTones('一天',[1,1]),[4,1]);
  assert.deepEqual(surfaceTones('一年',[1,2]),[4,2]);
  assert.deepEqual(surfaceTones('第一',[4,1]),[4,1]);
});
test('neutral 5 stays 5, other chars are unchanged',()=>{
  assert.deepEqual(surfaceTones('妈妈',[1,5]),[1,5]);
  assert.deepEqual(surfaceTones('大会',[4,4]),[4,4]);
});
test('punctuation in zh is ignored when aligning chars',()=>{
  assert.deepEqual(surfaceTones('不，是！',[4,4]),[2,4]);
});
test('pinyin helpers',()=>{
  assert.equal(toneOf('mā'),1);assert.equal(toneOf('má'),2);assert.equal(toneOf('mǎ'),3);assert.equal(toneOf('mà'),4);assert.equal(toneOf('ma'),5);
  assert.equal(toneOf('lǜ'),4);assert.equal(toneOf('nǚ'),3);assert.equal(toneOf('lüe'),5);
  assert.deepEqual(syllables('nǐ hǎo , wǒ jiào Lín ？'),['nǐ','hǎo','wǒ','jiào','Lín']);
  assert.deepEqual(tonesOf('gù lǜ'),[4,4]);
  assert.deepEqual(hanziChars('你好，我是 Lin。'),['你','好','我','是']);
});
