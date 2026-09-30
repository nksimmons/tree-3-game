import test from 'node:test';
import assert from 'node:assert/strict';
import { findEmbedding, checkMove, makeTree, validateTree, embeddingPaths, removeBranch, rootedSubtree } from '../engine.js';

const tree = makeTree;
const fits = (a, b) => Boolean(findEmbedding(tree(a), tree(b)));

test('colors match exactly, including single-dot trees below the root', () => {
  assert.equal(fits([0], [1]), false);
  assert.equal(fits([0], [1, [2, [0]]]), true);
  assert.equal(fits([1], [0, [2]]), false);
});
test('edges stretch over any colors and surplus branches are ignored', () => {
  assert.equal(fits([0, [1]], [0, [2, [2, [1]]], [0]]), true);
  const a = tree([0, [1]]), b = tree([2, [0, [2, [1]]]]);
  const mapping = findEmbedding(a, b);
  assert.deepEqual(mapping, { 0: 1, 1: 3 });
  assert.deepEqual([...embeddingPaths(a, b, mapping).edges].sort(), [2, 3]);
});
test('branch order is irrelevant, but direction and fork points are preserved', () => {
  assert.equal(fits([0, [1], [2]], [0, [2], [1]]), true);
  assert.equal(fits([0, [1]], [1, [0]]), false);
  assert.equal(fits([0, [1], [1]], [0, [2, [1], [1]]]), false);
  assert.equal(fits([0, [1], [1]], [0, [1, [1]]]), false);
  assert.equal(fits([0, [1], [1]], [2, [0, [2, [1]], [1]]]), true);
});
test('matching reassigns branches rather than relying on a greedy first fit', () => {
  assert.equal(fits([0, [1], [1, [2]]], [0, [1, [2]], [1]]), true);
});
test('each old dot needs its own target dot', () => {
  assert.equal(fits([0, [1], [1]], [0, [1]]), false);
  assert.equal(fits([0, [0]], [0]), false);
});
test('a chosen starting dot fixes the old root, rather than searching below it', () => {
  const a = tree([0, [1]]), b = tree([0, [0, [1]], [2]]);
  assert.equal(findEmbedding(a, b, 0)[0], 0);
  assert.equal(findEmbedding(a, b, 1)[0], 1);
  assert.equal(findEmbedding(a, b, 2), null);
  assert.equal(findEmbedding(a, b, 99), null);
  const hidden = tree([2, [0, [2, [1]]]]);
  assert.equal(findEmbedding(a, hidden, 0), null);
  assert.deepEqual(findEmbedding(a, hidden, 1), { 0: 1, 1: 3 });
});
test('a whole old tree is forbidden, not each of its root colors or pieces', () => {
  assert.equal(fits([0, [1]], [2, [0, [2], [0]]]), false);
  assert.equal(fits([0], [2, [0, [2], [0]]]), true);
});
test('rooted subtrees keep all descendants and IDs without mutating the original', () => {
  const original = tree([2, [0, [2, [1]], [1], [2]]]);
  const snapshot = structuredClone(original);
  const part = rootedSubtree([...original].reverse(), 1);
  assert.equal(validateTree(part), true);
  assert.deepEqual(part.map(n => n.id).sort(), [1, 2, 3, 4, 5]);
  assert.equal(part.find(n => n.id === 1).parent, null);
  assert.equal(part.find(n => n.id === 3).parent, 2);
  assert.deepEqual(rootedSubtree(original, 3), [{ id: 3, parent: null, color: 1 }]);
  assert.deepEqual(rootedSubtree(original, 99), []);
  assert.deepEqual(original, snapshot);
});
test('moves enforce the size limit, nonempty rooted structure, and all old trees', () => {
  assert.deepEqual(checkMove(tree([0, [1]]), []), { legal: false, reason: 'size', limit: 1 });
  assert.equal(checkMove([], []).reason, 'structure');
  assert.equal(checkMove(tree([2]), [], 2).reason, 'structure');
  const history = [tree([0]), tree([1, [1]])];
  assert.equal(checkMove(tree([2, [0]]), history).index, 0);
  assert.equal(checkMove(tree([2, [1, [1]]]), history).index, 1);
  assert.equal(checkMove(tree([2, [1]]), history).legal, true);
});
test('TREE(1)=1 and a maximal TREE(2) sequence has three trees', () => {
  assert.equal(checkMove(tree([0]), [], 1).legal, true);
  assert.equal(checkMove(tree([0]), [tree([0])], 1).legal, false);
  const history = [];
  for (const t of [tree([0]), tree([1, [1]]), tree([1])]) {
    assert.equal(checkMove(t, history, 2).legal, true); history.push(t);
  }
  for (const t of generateTrees(4)) assert.equal(checkMove(t, history, 2).legal, false);
});
test('reject malformed trees, accept arbitrary node order, remove whole branches', () => {
  assert.equal(validateTree([{ id: 0, parent: null, color: 0 }, { id: 1, parent: 1, color: 0 }]), false);
  assert.equal(validateTree([{ id: 0, parent: null, color: 0 }, { id: 1, parent: 9, color: 0 }]), false);
  assert.equal(validateTree([{ id: 0, parent: null, color: 0 }, { id: 0, parent: 0, color: 0 }]), false);
  assert.equal(validateTree([{ id: 0, parent: null, color: 0 }, { id: 1, parent: null, color: 0 }]), false);
  assert.equal(validateTree([{ id: 0, parent: null, color: 0 }, { id: 1, parent: 2, color: 0 }, { id: 2, parent: 1, color: 0 }]), false);
  const t = tree([0, [1, [2]], [1]]);
  assert.equal(validateTree([...t].reverse()), true);
  assert.deepEqual(removeBranch(t, 1).map(n => n.id), [0, 3]);
});

// Independent oracle: enumerate color-matching injections and check the LCA
// equation for every pair. It does NOT use the recursive matching algorithm.
function lca(tree, x, y) {
  const byId = new Map(tree.map(n => [n.id, n]));
  const ancestors = new Set();
  while (x !== null) { ancestors.add(x); x = byId.get(x).parent; }
  while (!ancestors.has(y)) y = byId.get(y).parent;
  return y;
}
function isWitness(a, b, mapping) {
  if (Object.keys(mapping).length !== a.length || new Set(Object.values(mapping)).size !== a.length) return false;
  for (const x of a) {
    if (b.find(y => y.id === mapping[x.id])?.color !== x.color) return false;
    for (const y of a) if (mapping[lca(a, x.id, y.id)] !== lca(b, mapping[x.id], mapping[y.id])) return false;
  }
  return true;
}
function bruteEmbedding(a, b, rootAt = null) {
  if (a.length > b.length) return false;
  const mapping = {}, used = new Set();
  function assign(i) {
    if (i === a.length) return isWitness(a, b, mapping);
    for (const y of b) {
      if (a[i].color !== y.color || used.has(y.id)) continue;
      if (a[i].parent === null && rootAt !== null && y.id !== rootAt) continue;
      mapping[a[i].id] = y.id; used.add(y.id);
      if (assign(i + 1)) return true;
      used.delete(y.id); delete mapping[a[i].id];
    }
    return false;
  }
  return assign(0);
}
function generateTrees(maxSize) {
  const all = [];
  for (let size = 1; size <= maxSize; size++) {
    function grow(nodes) {
      if (nodes.length === size) { all.push(nodes); return; }
      const id = nodes.length;
      for (let parent = 0; parent < id; parent++) for (let color = 0; color < 2; color++) grow([...nodes, { id, parent, color }]);
    }
    for (let color = 0; color < 2; color++) grow([{ id: 0, parent: null, color }]);
  }
  return all;
}
test('all 13,924 pairs of two-colored increasing trees up to 4 dots agree with the independent LCA oracle', () => {
  const trees = generateTrees(4);
  assert.equal(trees.length, 118);
  for (const a of trees) for (const b of trees) {
    const mapping = findEmbedding(a, b);
    assert.equal(Boolean(mapping), bruteEmbedding(a, b), JSON.stringify({ a, b }));
    if (mapping) assert.ok(isWitness(a, b, mapping));
    for (const node of b) {
      const anchored = findEmbedding(a, b, node.id);
      assert.equal(Boolean(anchored), bruteEmbedding(a, b, node.id), JSON.stringify({ a, b, start: node.id }));
      if (anchored) {
        assert.equal(anchored[a.find(n => n.parent === null).id], node.id);
        assert.ok(isWitness(a, b, anchored));
      }
    }
  }
});
