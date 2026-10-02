// Edit operations, executed with the prototype's own functions on a prepared plan.
// Each op returns what it selected and any extra values; the harness records the plan
// before and after.
(() => {
  const DEG = Math.PI / 180;
  const sel = (poc, picks) => {
    poc.clearSel();
    picks.forEach(([hi, k]) => poc.toggleSel(poc.state.players[hi].id, k));
    return picks;
  };
  // a plan with three horses and several sections each, plus volte geo with fixed hands
  function multi(poc) {
    poc.load({ field: 'arena40', drawGait: 'g2', horses: [1, 2, 3, 4].map((n) => ({ name: 'P' + n, num: n, color: '#c0392b', tack: n !== 2, pts: [], strokes: [], gaits: [] })) });
    poc.setScale(20); poc.setCheck('roundCorners', true); poc.setCheck('snapOn', true);
    const [a, b, c] = poc.state.players;
    poc.setCircle({ hand: 'auto', half: false });
    poc.start(a, { x: 3, y: 4 });
    poc.draw(a, 'line', { x: 12, y: 4 });
    poc.setCircle({ hand: 'left', half: false });
    poc.draw(a, 'circle', { x: 13, y: 12 });
    poc.draw(a, 'line', { x: 22, y: 6 });
    poc.setDrawGait('g3');
    poc.draw(a, 'arc', { x: 30, y: 12 });
    poc.nextPause(a);
    poc.setDrawGait('g1');
    poc.draw(a, 'line', { x: 36, y: 18 }, false, { x: 30, y: 18 });
    poc.setDrawGait('g2');
    poc.start(b, { x: 4, y: 16 });
    poc.draw(b, 'line', { x: 14, y: 16 });
    poc.nextHalt(b);
    poc.setCircle({ hand: 'right', half: true });
    poc.draw(b, 'circle', { x: 15, y: 20 });
    poc.free(b, [{ x: 15, y: 13.5 }, { x: 18, y: 13 }, { x: 21, y: 14 }, { x: 24, y: 12 }, { x: 27, y: 13 }]);
    poc.start(c, { x: 35, y: 3 });
    poc.draw(c, 'line', { x: 25, y: 3 });
    poc.draw(c, 'line', { x: 25, y: 9 });
    poc.setCircle({ hand: 'auto', half: false });
    poc.invalidate();
    mark(poc);
    return poc.state.players;
  }
  // the plan as it is right before the operation runs
  const mark = (poc) => { window.__opBefore = JSON.parse(JSON.stringify(poc.serialize())); };

  const ops = {};
  // rotation (buttons ±15°), with and without "Folgende hängen dran"
  [[[[0, 1]], true], [[[0, 1]], false], [[[0, 0], [0, 2], [1, 1]], false], [[[0, 0], [0, 2], [1, 1]], true], [[[2, 0], [2, 1]], false]].forEach(([picks, follow], i) => {
    [15, -15].forEach((deg) => {
      ops[`rotate-${i}-${deg}`] = (poc) => { multi(poc); poc.setFollow(follow); sel(poc, picks); poc.rotateSel(deg * DEG); return { picks, follow, angle: deg * DEG }; };
    });
  });
  // mirror
  [[[[0, 1]], true], [[[0, 1]], false], [[[0, 0], [0, 1], [0, 3]], false], [[[0, 1], [1, 1], [1, 2]], true], [[[0, 4]], false], [[[1, 0], [1, 1], [1, 2]], false]].forEach(([picks, follow], i) => {
    ['hand', 'ac', 'eb'].forEach((mode) => {
      ops[`mirror-${i}-${mode}`] = (poc) => { multi(poc); poc.setFollow(follow); sel(poc, picks); poc.mirrorSel(mode); return { picks, follow, mode }; };
    });
  });
  // delete
  [[[0, 1]], [[0, 0]], [[0, 2], [0, 4], [1, 1]], [[2, 1]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]].forEach((picks, i) => {
    ops[`delete-${i}`] = (poc) => {
      multi(poc); sel(poc, picks);
      const groups = poc.selGroups();
      groups.forEach((ks, p) => ks.slice().reverse().forEach((k) => poc.deleteSection(p, k, true)));
      return { picks };
    };
  });
  // merge
  [[[0, 1], [0, 2]], [[0, 2], [0, 3], [0, 4]], [[1, 0], [1, 1]]].forEach((picks, i) => {
    ops[`merge-${i}`] = (poc) => { multi(poc); sel(poc, picks); poc.mergeSel(); return { picks }; };
  });
  // split at a point on a segment (scale decides the 4 px snap)
  [[0, 5, 0.5], [0, 5, 0.02], [0, 20, 0.97], [1, 3, 0.3], [0, 1, 0.01], [2, 4, 0.5]].forEach(([hi, i, f], n) => {
    ops[`split-${n}`] = (poc) => {
      multi(poc);
      const p = poc.state.players[hi], a = p.pts[i - 1], b = p.pts[i];
      const ok = poc.splitAt({ p, i, f, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      return { horse: hi, i, f, scale: 20, ok };
    };
  });
  // rebuild a remembered figure with a new end point (dragging the end handle)
  [[0, 1, { x: 12, y: 14 }], [0, 2, { x: 24, y: 9 }], [0, 3, { x: 31, y: 8 }], [0, 0, { x: 14, y: 2 }], [1, 1, { x: 14, y: 22 }], [2, 1, { x: 22, y: 12 }], [0, 4, { x: 37, y: 15 }]].forEach(([hi, k, E], n) => {
    ops[`regenerate-${n}`] = (poc) => {
      multi(poc);
      const p = poc.state.players[hi];
      const before = poc.sectionGeom(p, k);
      const r = poc.regenerate(p, k, E);
      return { horse: hi, k, E, result: r, hadGeo: !!before.meta };
    };
  });
  // copy and paste
  const paste = (picks, opts) => (poc) => {
    multi(poc);
    if (opts.prep) { opts.prep(poc); mark(poc); }
    sel(poc, picks);
    poc.copySel(poc.selGroups());
    const clip = JSON.parse(JSON.stringify(poc.clip));
    poc.setActive(poc.state.players[opts.active].id);
    poc.pasteOpts.target = opts.target || 'same';
    // as openPaste: position and link defaults
    poc.setPastePos(clip.parts.length > 1 ? 'orig' : 'end');
    poc.pasteOpts.link = clip.parts.length > 1 ? 'gap' : 'line';
    if (opts.pos) poc.setPastePos(opts.pos);
    if (opts.link) poc.pasteOpts.link = opts.link;
    if (opts.off) poc.pasteOpts.off = opts.off;
    const off = { ...poc.pasteOpts.off };
    const targets = poc.pasteTargets().map((p) => (p ? poc.state.players.indexOf(p) : null));
    poc.doPaste();
    return { picks, active: opts.active, target: poc.pasteOpts.target, link: poc.pasteOpts.link, off, targets, clip };
  };
  ops['paste-single-end-line'] = paste([[0, 2], [0, 3]], { active: 2 });
  ops['paste-single-end-gap'] = paste([[0, 2], [0, 3]], { active: 2, link: 'gap', off: { x: 1, y: 1 } });
  ops['paste-single-orig'] = paste([[0, 1]], { active: 0, pos: 'orig' });
  ops['paste-noncontiguous'] = paste([[0, 0], [0, 2], [0, 4]], { active: 1 });
  ops['paste-into-empty'] = paste([[1, 1], [1, 2]], { active: 3 });
  ops['paste-after-pause'] = paste([[2, 0]], { active: 1, prep: (poc) => poc.nextPause(poc.state.players[1]) });
  ops['paste-after-halt'] = paste([[2, 1]], { active: 2, prep: (poc) => poc.nextHalt(poc.state.players[2]) });
  ops['paste-multi-same'] = paste([[0, 1], [0, 3], [1, 2], [2, 1]], { active: 0 });
  ops['paste-multi-from-selected'] = paste([[0, 1], [1, 2]], { active: 2, target: 'from' });
  ops['paste-multi-line-offset'] = paste([[0, 1], [1, 0]], { active: 0, link: 'line', pos: 'orig', off: { x: 0.5, y: -1 } });
  ops['paste-multi-overflow'] = paste([[0, 1], [1, 2], [2, 0]], { active: 2, target: 'from' });

  window.__ops = ops;
})();
