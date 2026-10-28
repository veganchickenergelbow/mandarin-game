import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,similarity,intentCheck} from '../js/core/match.js';

test('normalize keeps CJK and alphanumerics, lowercased',()=>{
  assert.equal(normalize('你好，ABC 123！ ?'),'你好abc123');
  assert.equal(normalize(''),'');
  assert.equal(normalize(null),'');
});
test('similarity is LCS length over target length',()=>{
  assert.equal(similarity('我要一份鸡饭','我要一份鸡饭'),1);
  assert.equal(similarity('我要一份鸡饭！','我要一份鸡饭'),1);
  assert.equal(similarity('','我要'),0);
  assert.equal(similarity('我要鸡饭','我要一份鸡饭'),4/6);
  assert.equal(similarity('完全不同','我要一份鸡饭'),0);
  assert.equal(similarity('abc',''),0);
});
test('similarity ignores extra words and keeps order',()=>{
  assert.equal(similarity('阿姨我要一份鸡饭打包','我要一份鸡饭'),1);
  assert.ok(similarity('饭鸡','鸡饭')<1);
});
test('intentCheck: all groups hit',()=>{
  const g=[['理解','明白'],['确实'],['不过','但是']];
  assert.deepEqual(intentCheck('我理解，价格确实高，不过值得',g),{allHit:true,hit:[0,1,2],missed:[]});
});
test('intentCheck: reports missed groups, ignores punctuation and spaces',()=>{
  const g=[['理解','明白'],['确实'],['不过','但是']];
  const r=intentCheck('我 明白，但是…',g);
  assert.equal(r.allHit,false);
  assert.deepEqual(r.hit,[0,2]);
  assert.deepEqual(r.missed,[1]);
});
test('intentCheck: empty heard misses everything',()=>{
  assert.deepEqual(intentCheck('',[['a'],['b']]).missed,[0,1]);
});
