/** Flat rooted trees: [{ id: number, parent: number | null, color: 0 | 1 | 2 }]. */
export function validateTree(tree, colors = 3) {
  if (!Array.isArray(tree) || tree.length === 0) return false;
  const ids = new Set();
  let roots = 0;
  for (const node of tree) {
    if (!node || !Number.isSafeInteger(node.id) || ids.has(node.id) || !Number.isInteger(node.color) || node.color < 0 || node.color >= colors) return false;
    ids.add(node.id);
    if (node.parent === null) roots++;
  }
  if (roots !== 1) return false;
  const byId = new Map(tree.map(n => [n.id, n]));
  for (const node of tree) {
    const seen = new Set([node.id]);
    let parent = node.parent;
    while (parent !== null) {
      if (!byId.has(parent) || seen.has(parent)) return false;
      seen.add(parent);
      parent = byId.get(parent).parent;
    }
  }
  return true;
}

function index(tree) {
  const nodes = new Map(tree.map(node => [node.id, { ...node, children: [] }]));
  for (const node of nodes.values()) if (node.parent !== null) nodes.get(node.parent).children.push(node.id);
  return { nodes, root: tree.find(node => node.parent === null).id };
}

/**
 * Find a color- and LCA-preserving embedding, including a witness mapping.
 * The source root can land anywhere. At an anchored pair, each source child
 * must embed somewhere in a DISTINCT immediate branch of the target parent.
 * Bipartite augmenting paths find this assignment without a greedy-order bug.
 */
export function findEmbedding(source, target) {
  if (source.length > target.length) return null;
  const a = index(source), b = index(target);
  const anchoredMemo = new Map(), anywhereMemo = new Map();
  function anywhere(aId, bId) {
    const key = `${aId}:${bId}`;
    if (anywhereMemo.has(key)) return anywhereMemo.get(key);
    let result = anchored(aId, bId);
    for (const child of b.nodes.get(bId).children) {
      if (result) break;
      result = anywhere(aId, child);
    }
    anywhereMemo.set(key, result);
    return result;
  }
  function anchored(aId, bId) {
    const key = `${aId}:${bId}`;
    if (anchoredMemo.has(key)) return anchoredMemo.get(key);
    const x = a.nodes.get(aId), y = b.nodes.get(bId);
    let result = null;
    if (x.color === y.color && x.children.length <= y.children.length) {
      const candidates = x.children.map(child => y.children.map(branch => anywhere(child, branch)));
      const owner = new Map();
      function assign(childIndex, visited) {
        for (let branchIndex = 0; branchIndex < y.children.length; branchIndex++) {
          if (!candidates[childIndex][branchIndex] || visited.has(branchIndex)) continue;
          visited.add(branchIndex);
          if (!owner.has(branchIndex) || assign(owner.get(branchIndex), visited)) {
            owner.set(branchIndex, childIndex);
            return true;
          }
        }
        return false;
      }
      if (x.children.every((_, i) => assign(i, new Set()))) {
        result = { [aId]: bId };
        for (const [branchIndex, childIndex] of owner) Object.assign(result, candidates[childIndex][branchIndex]);
      }
    }
    anchoredMemo.set(key, result);
    return result;
  }
  return anywhere(a.root, b.root);
}

export function checkMove(tree, history, colors = 3) {
  if (!validateTree(tree, colors)) return { legal: false, reason: 'structure' };
  const limit = history.length + 1;
  if (tree.length > limit) return { legal: false, reason: 'size', limit };
  for (let i = 0; i < history.length; i++) {
    const mapping = findEmbedding(history[i], tree);
    if (mapping) return { legal: false, reason: 'embedding', index: i, mapping };
  }
  return { legal: true };
}

/** Edges are identified by their lower (child) node; include skipped dots. */
export function embeddingPaths(source, target, mapping) {
  const byId = new Map(target.map(n => [n.id, n]));
  const edges = new Set(), nodes = new Set(Object.values(mapping));
  for (const node of source) {
    if (node.parent === null) continue;
    let child = mapping[node.id];
    while (child !== mapping[node.parent]) {
      edges.add(child);
      nodes.add(child);
      child = byId.get(child).parent;
    }
  }
  return { edges, nodes };
}

export function removeBranch(tree, id) {
  const removed = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of tree) if (removed.has(n.parent) && !removed.has(n.id)) { removed.add(n.id); changed = true; }
  }
  return tree.filter(n => !removed.has(n.id));
}

export function makeTree(description) {
  const nodes = [];
  function visit([color, ...children], parent = null) {
    const id = nodes.length;
    nodes.push({ id, parent, color });
    children.forEach(child => visit(child, id));
  }
  visit(description);
  return nodes;
}
