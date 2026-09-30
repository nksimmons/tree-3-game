import { checkMove, findEmbedding, embeddingPaths, removeBranch, makeTree, validateTree, rootedSubtree } from './engine.js';

const $ = selector => document.querySelector(selector);
const COLORS = [ { name: 'Blue', letter: 'B', fill: '#3972c3' }, { name: 'Red', letter: 'R', fill: '#c55442' }, { name: 'Yellow', letter: 'Y', fill: '#e2b332' } ];
const STORAGE_KEY = 'tiny-forest-v1';
const clone = value => structuredClone(value);
let state = { mode: 3, history: [], draft: makeTree([0]) };
let selected = 0, edits = [], feedback = null, lessonIndex = 0, lessonRevealed = false, lessonGuess = null;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && [1, 2, 3].includes(saved.mode) && Array.isArray(saved.history) && saved.history.every(t => Array.isArray(t)) && Array.isArray(saved.draft) && validateTree(saved.draft, saved.mode) && saved.draft.length <= saved.history.length + 1 && saved.history.every((tree, i) => checkMove(tree, saved.history.slice(0, i), saved.mode).legal)) state = saved;
} catch { /* A blocked or damaged local save must not stop play. */ }
selected = state.draft.find(n => n.parent === null).id;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $('#save-status').textContent = 'Saved on this device'; }
  catch { $('#save-status').textContent = 'Saving unavailable · keep this tab open'; }
}

/** A tidy leaf-based layout, independent of the mathematical checker. */
function layout(tree) {
  const children = new Map(tree.map(n => [n.id, []]));
  tree.forEach(n => { if (n.parent !== null) children.get(n.parent).push(n.id); });
  const positions = new Map();
  let leaf = 0, maxDepth = 0;
  function place(id, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const cs = children.get(id);
    const xs = cs.map(child => place(child, depth + 1));
    const x = xs.length ? (xs[0] + xs.at(-1)) / 2 : leaf++;
    positions.set(id, { x, depth });
    return x;
  }
  const root = tree.find(n => n.parent === null).id;
  place(root, 0);
  const width = Math.max(250, leaf * 86 + 30), height = Math.max(220, maxDepth * 80 + 120);
  for (const p of positions.values()) {
    p.x = leaf === 1 ? width / 2 : 45 + p.x * (width - 90) / (leaf - 1);
    p.y = maxDepth === 0 ? height / 2 : 57 + p.depth * 80;
  }
  return { positions, width, height, root };
}

function treeSvg(tree, { interactive = false, mapping = null, source = null, sourceLabels = false, mini = false, explore = false, activeNode = selected, scope = null } = {}) {
  const { positions, width, height, root } = layout(tree);
  const marks = new Map();
  let paths = null;
  if (mapping && source) {
    paths = embeddingPaths(source, tree, mapping);
    source.forEach((n, i) => marks.set(mapping[n.id], i + 1));
  }
  if (sourceLabels) tree.forEach((n, i) => marks.set(n.id, i + 1));
  const nodeDescription = tree.map(n => `${COLORS[n.color].name} dot ${n.id + 1}${n.parent === null ? ' (root)' : `, child of dot ${n.parent + 1}`}`).join('; ');
  const clickable = interactive || explore;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="${clickable ? 'group' : 'img'}" aria-label="${nodeDescription}"${interactive ? ` style="min-width:${Math.min(width, 1800)}px;min-height:${height}px"` : ''}>`;
  for (const n of tree) {
    if (n.parent === null) continue;
    const p = positions.get(n.parent), q = positions.get(n.id);
    svg += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="tree-edge${paths?.edges.has(n.id) ? ' match' : paths || (scope && (!scope.has(n.id) || !scope.has(n.parent))) ? ' fade' : ''}"/>`;
  }
  if (!mini) svg += `<text class="root-label" x="${positions.get(root).x}" y="${positions.get(root).y - 35}">ROOT</text>`;
  for (const n of tree) {
    const p = positions.get(n.id), color = COLORS[n.color], matched = marks.has(n.id);
    const skipped = paths?.nodes.has(n.id) && !matched;
    const faded = paths ? !paths.nodes.has(n.id) : scope && !scope.has(n.id);
    svg += `<g class="tree-node${faded ? ' fade' : ''}${skipped ? ' skipped-node' : ''}" transform="translate(${p.x},${p.y})"${clickable ? ` role="button" tabindex="0" aria-label="${explore ? 'Try starting at ' : ''}${color.name} dot ${n.id + 1}${n.id === root ? ', root' : ''}${activeNode === n.id ? ', selected' : ''}" aria-pressed="${activeNode === n.id}" ${explore ? 'data-explorer-node' : 'data-node'}="${n.id}"` : ''}>`;
    if (clickable && activeNode === n.id) svg += `<circle class="${explore ? 'start-ring' : 'selection-ring'}" r="${explore ? 31 : 28}"/>`;
    if (matched) svg += '<circle class="match-ring" r="26"/>';
    svg += `<circle class="node-fill" r="21" fill="${color.fill}"/><text class="${n.color === 2 ? 'dark-letter' : ''}" y="0">${color.letter}</text>`;
    if (matched) svg += `<circle class="badge-bg" cx="21" cy="-20" r="10"/><text class="match-number" x="21" y="-20">${marks.get(n.id)}</text>`;
    if (explore) svg += `<text class="dot-identifier" y="${activeNode === n.id ? 44 : 35}">dot ${n.id + 1}</text>`;
    svg += '</g>';
  }
  return svg + '</svg>';
}

function renderEditor(focusNode = false) {
  const move = state.history.length + 1, node = state.draft.find(n => n.id === selected);
  $('#move-label').textContent = `TREE NO. ${String(move).padStart(2, '0')}`;
  $('#node-budget').textContent = `${state.draft.length} / ${move} ${move === 1 ? 'dot' : 'dots'}`;
  $('#budget-rule').textContent = `Tree ${move} gets up to ${move} ${move === 1 ? 'dot' : 'dots'}.`;
  $('#mode').value = state.mode;
  $('#palette').innerHTML = COLORS.slice(0, state.mode).map((c, i) => `<button class="color-button" data-color="${i}" aria-label="Color selected dot ${c.name.toLowerCase()}" aria-pressed="${node.color === i}"><span class="swatch c${i}" style="background:${c.fill}" aria-hidden="true">${c.letter}</span><span class="color-name">${c.name}</span></button>`).join('');
  const conflict = feedback?.reason === 'embedding' ? feedback : null;
  $('#tree-canvas').innerHTML = treeSvg(state.draft, { interactive: true, mapping: conflict?.mapping, source: conflict ? state.history[conflict.index] : null });
  $('#add-node').disabled = state.draft.length >= move;
  $('#remove-node').disabled = node.parent === null;
  $('#undo-edit').disabled = edits.length === 0;
  $('#editor-hint').textContent = state.draft.length >= move ? `${move === 1 ? 'Your 1 dot is' : `All ${move} dots are`} used. Tap a dot to change its color${move > 1 ? ' or remove its branch' : ''}.` : 'Tap a dot, then add a child below it or change its color.';
  if (focusNode) $(`[data-node="${selected}"]`)?.focus({ preventScroll: true });
}

function renderFeedback() {
  const el = $('#feedback'), move = state.history.length + 1;
  el.className = 'coach-card';
  if (feedback?.reason === 'embedding') {
    el.classList.add('error');
    el.innerHTML = `<span class="eyebrow">A HIDDEN TREE!</span><h2>Tree ${feedback.index + 1} is hiding in here.</h2><p>The gold outline shows the old pattern. Every old dot has a same-color match. Try changing a color or a connection.</p><button class="button outline" id="show-match">Show me the match</button>`;
  } else if (feedback?.legal) {
    el.classList.add('success');
    el.innerHTML = '<span class="eyebrow">LOOKING GOOD</span><h2>This tree is ready to plant.</h2><p>It fits your dot limit, and no earlier tree hides inside it. Plant it to add it to your forest.</p>';
  } else if (feedback?.planted) {
    el.innerHTML = `<span class="eyebrow">NICE GROWING!</span><h2>${state.history.length === 1 ? 'Your forest has begun.' : `Tree ${state.history.length} is in the forest.`}</h2><p>Now build tree ${move} with up to ${move} dots. Remember: it must avoid <em>every</em> earlier tree.</p>`;
  } else if (feedback?.reason) {
    el.classList.add('error');
    el.innerHTML = `<span class="eyebrow">ONE LITTLE CHANGE</span><h2>${feedback.reason === 'size' ? 'Too many dots this time.' : 'This needs to be a tree.'}</h2><p>Make one connected tree with 1 to ${move} dots using your challenge’s colors.</p>`;
  } else {
    el.innerHTML = move === 1 ? '<span class="eyebrow">START SMALL. THINK BIG.</span><h2>One dot. A whole adventure.</h2><p>Pick a color for your first tree, then plant it. A single dot counts as a tree!</p>' : `<span class="eyebrow">YOUR NEXT LITTLE CHALLENGE</span><h2>Something we haven’t seen.</h2><p>Use up to ${move} dots. Select a dot to grow a branch. Check your tree whenever you’re curious.</p>`;
  }
  // A one-dot old tree bans its color everywhere. Only claim a dead end when proved.
  const banned = new Set(state.history.filter(t => t.length === 1).map(t => t[0].color));
  if (banned.size === state.mode && feedback?.reason !== 'embedding') {
    el.className = 'coach-card success';
    el.innerHTML = `<span class="eyebrow">THIS FOREST IS COMPLETE</span><h2>You grew ${state.history.length} ${state.history.length === 1 ? 'tree' : 'trees'}!</h2><p>Each color now has a one-dot tree in your forest, so any new dot repeats an old tree. Take back a tree to explore another path, or start fresh.${state.mode === 2 && state.history.length === 3 ? ' You reached TREE(2): the maximum is 3!' : ''}</p>`;
  }
}

function renderForest() {
  $('#forest-count').textContent = `${state.history.length} ${state.history.length === 1 ? 'tree' : 'trees'}`;
  $('#take-back').disabled = state.history.length === 0;
  $('#forest').innerHTML = state.history.length ? state.history.map((tree, i) => `<button class="forest-tree${feedback?.reason === 'embedding' && feedback.index === i ? ' conflict' : ''}" data-history="${i}" aria-label="Compare tree ${i + 1} with your current tree"><span class="forest-tree-label"><span>TREE ${String(i + 1).padStart(2, '0')}</span><span>${tree.length} ${tree.length === 1 ? 'dot' : 'dots'}</span></span>${treeSvg(tree, { mini: true })}</button>`).join('') : '<div class="empty-forest"><span class="empty-symbol" aria-hidden="true">✳</span><div><strong>A tiny beginning for a big idea.</strong><p>Your trees will appear here. Plant your first one above.</p></div></div>';
}

function render() { renderEditor(); renderFeedback(); renderForest(); save(); }
function edit(action) {
  edits.push({ tree: clone(state.draft), selected });
  if (edits.length > 100) edits.shift();
  action(); feedback = null; render();
}
function runCheck(plant = false) {
  feedback = checkMove(state.draft, state.history, state.mode);
  if (feedback.legal && plant) {
    state.history.push(clone(state.draft));
    const banned = new Set(state.history.filter(t => t.length === 1).map(t => t[0].color));
    const color = COLORS.findIndex((_, i) => i < state.mode && !banned.has(i));
    state.draft = makeTree([Math.max(0, color)]); selected = 0; edits = [];
    feedback = { planted: true };
  }
  render();
  if ((!plant || !feedback.planted) && window.matchMedia('(max-width: 760px)').matches) $('#feedback').scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

$('#palette').addEventListener('click', event => {
  const button = event.target.closest('[data-color]');
  if (!button) return;
  const color = Number(button.dataset.color);
  if (state.draft.find(n => n.id === selected).color !== color) edit(() => { state.draft.find(n => n.id === selected).color = color; });
  $(`[data-color="${color}"]`).focus({ preventScroll: true });
});
function selectNode(event) {
  const node = event.target.closest('[data-node]');
  if (!node) return;
  if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
  if (event.type === 'keydown') event.preventDefault();
  selected = Number(node.dataset.node); renderEditor(true);
}
$('#tree-canvas').addEventListener('click', selectNode);
$('#tree-canvas').addEventListener('keydown', selectNode);
$('#add-node').addEventListener('click', () => {
  if (state.draft.length >= state.history.length + 1) return;
  edit(() => {
    const id = Math.max(...state.draft.map(n => n.id)) + 1;
    state.draft.push({ id, parent: selected, color: state.draft.find(n => n.id === selected).color }); selected = id;
  });
  $(`[data-node="${selected}"]`).focus({ preventScroll: true });
});
$('#remove-node').addEventListener('click', () => {
  const node = state.draft.find(n => n.id === selected);
  if (node.parent === null) return;
  edit(() => { state.draft = removeBranch(state.draft, selected); selected = node.parent; });
  $(`[data-node="${selected}"]`).focus({ preventScroll: true });
});
$('#undo-edit').addEventListener('click', () => {
  const previous = edits.pop(); if (!previous) return;
  state.draft = previous.tree; selected = previous.selected; feedback = null; render();
});
$('#check-tree').addEventListener('click', () => runCheck());
$('#plant-tree').addEventListener('click', () => runCheck(true));
$('#feedback').addEventListener('click', event => { if (event.target.closest('#show-match')) showComparison(feedback.index); });
$('#forest').addEventListener('click', event => { const button = event.target.closest('[data-history]'); if (button) showComparison(Number(button.dataset.history)); });

let confirmAction = null;
function confirmChange(title, description, action) {
  $('#confirm-title').textContent = title; $('#confirm-description').textContent = description;
  $('#confirm-accept').textContent = title.startsWith('Take') ? 'Take it back' : 'Start fresh';
  confirmAction = action; $('#confirm-dialog').returnValue = ''; $('#confirm-dialog').showModal();
}
$('#confirm-accept').addEventListener('click', () => $('#confirm-dialog').close('confirm'));
$('#confirm-cancel').addEventListener('click', () => $('#confirm-dialog').close('cancel'));
$('#confirm-dialog').addEventListener('close', () => { if ($('#confirm-dialog').returnValue === 'confirm') confirmAction?.(); confirmAction = null; $('#mode').value = state.mode; });
function reset(mode) { state = { mode, history: [], draft: makeTree([0]) }; selected = 0; edits = []; feedback = null; render(); }
$('#new-game').addEventListener('click', () => confirmChange('Start a new forest?', 'This replaces your forest and the tree you’re building.', () => reset(state.mode)));
$('#mode').addEventListener('change', event => {
  const mode = Number(event.target.value);
  if (mode === state.mode) return;
  confirmChange(`Start a TREE(${mode}) forest?`, 'Changing the number of colors starts a new forest. Your current forest will be replaced.', () => reset(mode));
});
$('#take-back').addEventListener('click', () => confirmChange('Take back the last tree?', 'Your last planted tree returns to the workbench. This replaces the tree you’re building now.', () => {
  if (!state.history.length) return;
  state.draft = state.history.pop(); selected = state.draft.find(n => n.parent === null).id; edits = []; feedback = null; render();
}));

/** Shared explorer for the practice diagrams and actual planted-tree comparisons. */
function mountExplorer(container, source, target, { sourceName = 'The earlier whole tree', startWithMatch = false } = {}) {
  const oldRoot = source.find(n => n.parent === null);
  const newRoot = target.find(n => n.parent === null);
  const matches = new Map(target.map(n => [n.id, findEmbedding(source, target, n.id)]));
  const working = target.filter(n => matches.get(n.id));
  let start = startWithMatch && working.length ? working[0].id : newRoot.id;
  let stage = startWithMatch && working.length ? 2 : 0;
  const names = ['1. Whole tree', '2. This subtree', '3. Trace the match', '4. Skip the extras'];

  function draw() {
    const node = target.find(n => n.id === start), mapping = matches.get(start);
    const subtree = rootedSubtree(target, start), scope = new Set(subtree.map(n => n.id));
    const matchView = stage >= 2 && mapping;
    const simplified = mapping ? source.map(n => ({ id: mapping[n.id], parent: n.parent === null ? null : mapping[n.parent], color: n.color })) : null;
    let selectedExplanation;
    if (mapping) {
      selectedExplanation = `The old ${COLORS[oldRoot.color].name.toLowerCase()} root can land on dot ${start + 1}. Every other old dot also has a same-colored match below it, with the right branching pattern.`;
    } else if (node.color !== oldRoot.color) {
      selectedExplanation = `The earlier root is ${COLORS[oldRoot.color].name.toLowerCase()}, but dot ${start + 1} is ${COLORS[node.color].name.toLowerCase()}. Those roots cannot match. A different starting dot might still work.`;
    } else {
      selectedExplanation = `Dot ${start + 1} has the right root color, but the whole old pattern does not fit below it. Matching the root color alone is not enough.`;
    }
    const stageExplanation = [
      'This is the whole new tree. Pick any dot as the possible home of the earlier root. The thick green ring marks your choice.',
      `Keep dot ${start + 1} and all its descendants. That is its rooted subtree (${subtree.length} ${subtree.length === 1 ? 'dot' : 'dots'}). Everything outside it is faded. The tree’s original root stays where it was.`,
      'Pair the gold numbers: 1 with 1, 2 with 2, and so on. Gold lines follow the old branches. Dashed dots on these paths are skipped; faded dots and branches are unused.',
      'Ignore the unused branches and remove the skipped dots from the traced paths. What remains is the whole earlier pattern! This redraw explains the match; it does not change your tree.'
    ][stage];
    container.innerHTML = `<div class="explorer-verdict ${working.length ? 'has-match' : 'no-match'}"><div><strong>${working.length ? `The old tree fits at ${working.length} starting ${working.length === 1 ? 'dot' : 'dots'}.` : 'This old tree fits nowhere in the new tree.'}</strong><p>${working.length ? 'One working start anywhere is enough to make this new tree illegal if the old tree was already planted.' : 'This old tree does not block the move. In a game, the dot limit and every other earlier tree still matter.'}</p></div>${working.length ? '<button class="button outline" data-show-working>Show a working start</button>' : ''}</div>
      <div class="explorer-stages" role="group" aria-label="Steps for seeing the subtree">${names.map((name, i) => `<button class="stage-button" data-stage="${i}" aria-pressed="${i === stage}" ${i >= 2 && !mapping ? 'disabled title="Choose a starting dot where the old tree fits first"' : ''}>${name}</button>`).join('')}</div>
      <div class="explorer-diagrams"><section><h3>${sourceName}</h3><div class="explorer-diagram old-pattern">${treeSvg(source, { sourceLabels: Boolean(matchView) })}</div><p class="diagram-caption">We need to find <strong>all ${source.length} ${source.length === 1 ? 'dot' : 'dots'}</strong> of this tree.</p></section><section><h3>${stage === 3 ? 'The hidden pattern, with extras removed' : 'The new tree · choose a starting dot'}</h3><div class="explorer-diagram new-pattern">${stage === 3 ? treeSvg(simplified, { sourceLabels: true }) : treeSvg(target, { explore: true, activeNode: start, scope: stage === 1 ? scope : null, mapping: matchView ? mapping : null, source })}</div><p class="diagram-caption">${stage === 3 ? 'Same colors. Same connections. Same old tree.' : `Selected start: <strong>${COLORS[node.color].name.toLowerCase()} dot ${start + 1}</strong>${start === newRoot.id ? ' · also the whole tree’s root.' : ' · below the whole tree’s root.'}`}</p></section></div>
      <p class="stage-explanation" aria-live="polite">${stageExplanation}</p>
      <div class="start-selector"><h3>Test every starting dot</h3><p>“Fits” means the <em>whole</em> old tree fits with its root at that exact dot.</p><div class="start-buttons" role="group" aria-label="Possible starting dots">${target.map(n => `<button data-start="${n.id}" class="start-button" aria-pressed="${n.id === start}"><span class="swatch c${n.color}" style="background:${COLORS[n.color].fill}" aria-hidden="true">${COLORS[n.color].letter}</span><span>Dot ${n.id + 1}</span><span class="start-result ${matches.get(n.id) ? 'fits' : ''}">${matches.get(n.id) ? '✓ Fits' : 'No match'}</span></button>`).join('')}</div></div>
      <div class="selected-explanation" role="status"><strong>${mapping ? `Yes, starting at dot ${start + 1}.` : `No match starting at dot ${start + 1}.`}</strong> ${selectedExplanation}${!mapping && working.length ? ` There is still a match starting at dot ${working[0].id + 1}, so the new tree is blocked by this old tree.` : ''}</div>`;
  }
  function activate(event) {
    const control = event.target.closest('[data-explorer-node], [data-start], [data-stage], [data-show-working]');
    if (!control || !container.contains(control)) return;
    // Native buttons synthesize their own click. SVG buttons need keyboard handling.
    if (event.type === 'keydown') {
      if (!control.hasAttribute('data-explorer-node') || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
    }
    let focusSelector;
    if (control.hasAttribute('data-show-working')) {
      start = working[0].id; stage = 2; focusSelector = '[data-show-working]';
    } else if (control.hasAttribute('data-stage')) {
      const next = Number(control.dataset.stage);
      if (next >= 2 && !matches.get(start)) return;
      stage = next; focusSelector = `[data-stage="${stage}"]`;
    } else {
      start = Number(control.dataset.start ?? control.dataset.explorerNode);
      stage = 1;
      focusSelector = control.hasAttribute('data-start') ? `[data-start="${start}"]` : `[data-explorer-node="${start}"]`;
    }
    draw(); container.querySelector(focusSelector)?.focus({ preventScroll: true });
  }
  container.onclick = activate;
  container.onkeydown = activate;
  draw();
}

function showComparison(i) {
  $('#compare-title').textContent = 'Explore a hidden tree';
  $('#compare-content').innerHTML = `<label class="compare-picker">Which earlier tree?<select id="compare-source">${state.history.map((_, index) => `<option value="${index}" ${index === i ? 'selected' : ''}>Tree ${index + 1}</option>`).join('')}</select></label><div id="game-explorer"></div>`;
  const draw = index => mountExplorer($('#game-explorer'), state.history[index], state.draft, { sourceName: `Tree ${index + 1} · already planted`, startWithMatch: true });
  draw(i);
  $('#compare-source').addEventListener('change', event => draw(Number(event.target.value)));
  $('#compare-dialog').showModal();
}
$('#close-compare').addEventListener('click', () => $('#compare-dialog').close());
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  const view = button.dataset.view;
  $('#play-view').hidden = view !== 'play'; $('#learn-view').hidden = view !== 'learn';
  document.querySelectorAll('.nav-button').forEach(nav => { nav.classList.toggle('active', nav.dataset.view === view); if (nav.dataset.view === view) nav.setAttribute('aria-current', 'page'); else nav.removeAttribute('aria-current'); });
  if (view === 'learn') renderLesson();
  window.scrollTo({ top: 0, behavior: 'instant' });
}));

const lessons = [
  { tab: '1. Extra branches', title: 'Extra branches don’t disguise a tree.', old: [0, [1]], next: [0, [2], [1]], text: 'The blue root and red child still match. Just ignore the extra yellow branch. If this old tree were in your forest, the new one would be illegal.' },
  { tab: '2. Stretchy branches', title: 'A branch can take the scenic route.', old: [0, [1]], next: [0, [2, [1]]], text: 'Follow blue down to red, skipping the yellow dot on the way. One old branch can stretch along several new branches. Skipped dots can be any color.' },
  { tab: '3. A hidden root', title: 'The match can start further down.', old: [0, [1]], next: [2, [0, [1]]], text: 'The old blue root matches the blue dot below the new yellow root. A match does not have to start at the new root. Everything above the match can be ignored.' },
  { tab: '4. Left or right?', title: 'Swapping sides doesn’t fool the forest.', old: [0, [1], [2]], next: [0, [2], [1]], text: 'Left and right don’t matter. The blue dot still has separate red and yellow branches, so the old tree is hiding here.' },
  { tab: '5. Keep the fork', title: 'Two branches must stay separate.', old: [0, [1], [1]], next: [0, [2, [1], [1]]], text: 'The old red branches split at a BLUE dot. In the new tree they split at a YELLOW dot. They cannot both share the blue-to-yellow path. All the right colors are here, but the branching pattern doesn’t match.' },
  { tab: '6. Colors & direction', title: 'You can’t turn a tree upside down.', old: [0, [1]], next: [1, [0]], text: 'The old tree needs a blue dot with a red dot below it. The new tree has those colors in the opposite order. A branch must follow the direction away from the root; it cannot climb back up.' }
];
function renderLesson() {
  const lesson = lessons[lessonIndex], old = makeTree(lesson.old), next = makeTree(lesson.next), mapping = lessonRevealed ? findEmbedding(old, next) : null;
  $('#lesson-tabs').innerHTML = lessons.map((l, i) => `<button data-lesson="${i}" aria-pressed="${i === lessonIndex}">${l.tab}</button>`).join('');
  $('#lesson-number').textContent = `LITTLE LESSON ${lessonIndex + 1} OF ${lessons.length}`;
  $('#lesson-title').textContent = lessonRevealed ? lesson.title : ['A new branch appears.', 'There’s a dot in the middle.', 'There’s a new root on top.', 'The branches switch sides.', 'Look closely at the fork.', 'The colors change places.'][lessonIndex];
  $('#lesson-old').innerHTML = treeSvg(old, { sourceLabels: Boolean(mapping) });
  $('#lesson-new').innerHTML = treeSvg(next, { mapping, source: old });
  $('#guess-yes').disabled = lessonRevealed; $('#guess-no').disabled = lessonRevealed;
  $('#lesson-answer').innerHTML = '';
  if (lessonRevealed) renderLessonAnswer();
}
$('#lesson-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-lesson]'); if (!button) return;
  lessonIndex = Number(button.dataset.lesson); lessonRevealed = false; renderLesson();
  $(`[data-lesson="${lessonIndex}"]`).focus({ preventScroll: true });
});
function renderLessonAnswer() {
  const lesson = lessons[lessonIndex], fits = Boolean(findEmbedding(makeTree(lesson.old), makeTree(lesson.next)));
  $('#lesson-answer').innerHTML = `<strong>${lessonGuess === fits ? 'You spotted it!' : 'A sneaky one!'} ${fits ? 'Yes, the old tree is hiding.' : 'No, this old tree isn’t hiding.'}</strong><p>${lesson.text}</p>${fits ? '<p class="match-legend"><strong>Follow the gold:</strong> the numbers pair up matching dots.</p>' : ''}<button id="next-lesson" class="button outline">${lessonIndex === lessons.length - 1 ? 'Try the lessons again' : 'Next little lesson'}</button>`;
  $('#next-lesson').addEventListener('click', () => { lessonIndex = (lessonIndex + 1) % lessons.length; lessonRevealed = false; renderLesson(); $('#guess-yes').focus({ preventScroll: true }); });
}
function guess(answer) { lessonGuess = answer; lessonRevealed = true; renderLesson(); }
$('#guess-yes').addEventListener('click', () => guess(true));
$('#guess-no').addEventListener('click', () => guess(false));
render();


const subtreeExamples = [
  { old: [0, [1], [1]], next: [2, [0, [2, [1]], [1], [2]]] },
  { old: [0, [1]], next: [2, [0, [2], [0]]] },
  { old: [0, [1], [1]], next: [0, [2, [1], [1]]] },
  { old: [0], next: [2, [1, [0]], [0]] }
];
function renderSubtreeExample() {
  const example = subtreeExamples[Number($('#subtree-example').value)];
  mountExplorer($('#demo-explorer'), makeTree(example.old), makeTree(example.next));
}
$('#subtree-example').addEventListener('change', renderSubtreeExample);
renderSubtreeExample();
