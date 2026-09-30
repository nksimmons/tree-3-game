# Tiny Forest

A family-friendly TREE(3) game for GitHub Pages. Build colorful rooted trees, check whether an old tree hides inside your new one, and explore six illustrated lessons. No dependencies or build step.

## Play locally

With Node.js 22 or newer:

```sh
npm start
```

Open http://127.0.0.1:4173. Alternatively, serve this directory with any static HTTP server. Use an HTTP server instead of opening `index.html` directly: the game uses JavaScript modules.

## Publish on GitHub Pages

1. Commit and push these files to your repository’s `main` branch.
2. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Open **Actions → Test and deploy Tiny Forest → Run workflow** (or push another commit). The workflow runs the math tests and publishes only the four site files plus `.nojekyll`.
4. Once deployment finishes, open the URL shown under **Settings → Pages**. For this repository, the normal URL is `https://nksimmons.github.io/tree-3-game/`.

You can also choose **Deploy from a branch → main → / (root)** instead of GitHub Actions; all asset paths are relative, so repository subpaths work. In that case, disable the included Actions workflow to avoid duplicate deployment attempts.

This project is prepared for publication; creating local files does not itself push or publish them.

## How to play

- Play cooperatively or take turns at the same device. Select a dot, choose its color, and use **Add a child** to grow a branch. Every new child becomes selected. Select its parent again to add a sibling.
- Tree number *i* can have between 1 and *i* dots. You do not need to use the whole allowance.
- **Check my tree** explains whether the current draft is legal. **Plant this tree** checks it again and adds it only if legal.
- If a previous tree hides in the draft, the board highlights a witness. **Show me the match** pairs numbered dots across both trees and traces the stretched branches in gold.
- Click any planted tree to compare it with the draft. Use **Undo last edit**, **Remove branch**, or **Take back last tree** to explore another route.
- **How trees hide** has six small quizzes. Warm-ups offer TREE(1) and TREE(2).
- The current forest and draft are saved in this browser’s local storage. Nothing is sent to a game server. Browsers that block storage can still play for the current session. Google Fonts are optional; system fonts work if they cannot load.

## The mathematical rule

This game uses finite, unordered rooted trees and **color- and infimum-preserving homeomorphic embedding**. Given an earlier tree A and a proposed tree B, a forbidden embedding is an injection f from A’s dots to B’s dots such that:

1. Each dot keeps its exact color.
2. For every pair u, v in A, f(LCA(u,v)) = LCA(f(u),f(v)), where LCA is the least common ancestor.

Consequently, edges may stretch along downward paths, surplus branches may be ignored, child order is irrelevant, and the earlier root may map below the new root. Distinct branches must split at the image of their original fork, not further down. Intermediate dots on stretched edges may have any color.

The game checks **all** earlier trees. It does not confuse ordinary subtree equality with homeomorphic embedding. See [Harvey Friedman’s labeled finite-tree formulation](https://fomarchive.ugent.be/1998-September/002153.html).

TREE(1) = 1 and TREE(2) = 3; for example: one blue dot, two red dots in a chain, then one red dot. TREE(3) is finite but unimaginably large. This is a game of building legal sequences, not an attempt to compute that number or an optimal move solver. The UI announces a completed forest only in the provable case where every available color has already appeared as a one-dot tree. There may be other dead ends; it does not claim a general search for remaining moves. Large trees and long histories are limited by browser resources.

## Validation

```sh
npm test
```

The engine uses memoized embedding checks and bipartite matching between child branches. Tests cover color equality, root relocation, stretched paths, child-order independence, fork preservation, direction, injection, branch reassignment, size limits, all-history checks, malformed trees, and TREE(1)/TREE(2). An independent brute-force injection/LCA oracle checks all **13,924 pairs** of two-colored increasing trees of up to four dots, including each reported witness.

Files: `engine.js` is the pure math engine; `app.js` handles editing, witness diagrams, lessons, and local saving; `index.html` and `style.css` contain the interface.
