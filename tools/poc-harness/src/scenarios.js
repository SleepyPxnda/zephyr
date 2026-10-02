// Input scenarios, executed inside the prototype page. Each one builds a plan with the
// prototype's own drawing code; the harness then exports it with serialize() and records
// what the prototype computes after loading that export.
(() => {
  const STD_GAITS = [
    { id: 'g1', name: 'Schritt', w: 1.6, o: 1.7, md: 2, c: '#A8DCC4' },
    { id: 'g2', name: 'Trab', w: 3.6, o: 3.9, md: 6, c: '#9CC5EA' },
    { id: 'g3', name: 'Galopp', w: 5.5, o: 6.0, md: 8, c: '#F6C1A0' },
  ];
  const horse = (num, tack = true) => ({ name: 'Pferd ' + num, num, color: '#c0392b', tack, pts: [], strokes: [], gaits: [] });
  const base = (horses, gaits = STD_GAITS) => ({ field: 'arena40', gaits, drawGait: 'g2', horses, parts: [] });

  // loads an empty plan and returns the horses, ready for drawing
  function fresh(poc, opts = {}) {
    poc.load(base(opts.horses || [horse(1)], opts.gaits));
    poc.setScale(opts.scale || 20);
    poc.setCheck('roundCorners', opts.round !== false);
    poc.setCheck('snapOn', true);
    poc.setCircle({ hand: 'auto', half: false });
    return poc.state.players;
  }
  const wave = (x0, y0, len, amp, n) =>
    Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (len * i) / n, y: y0 + amp * Math.sin((i / n) * Math.PI * 3) }));

  window.__scenarios = {
    'lines-corner'(poc) {
      const [p] = fresh(poc, { round: false });
      poc.start(p, { x: 2, y: 10 });
      poc.draw(p, 'line', { x: 20, y: 10 });
      poc.draw(p, 'line', { x: 20, y: 3 });
      poc.draw(p, 'line', { x: 35, y: 3 });
    },
    'line-turn'(poc) {
      const [p] = fresh(poc);
      poc.start(p, { x: 5, y: 10 });
      poc.draw(p, 'line', { x: 25, y: 10 });
      poc.draw(p, 'line', { x: 10, y: 4 });
      poc.setDrawGait('g3');
      poc.draw(p, 'line', { x: 30, y: 16 });
      // target inside the galop turning circle: straight line, flagged
      poc.draw(p, 'line', { x: 30.5, y: 13 });
      poc.setDrawGait('g1');
      poc.draw(p, 'line', { x: 34, y: 18 }, true);
    },
    'arc-tangent'(poc) {
      const [p] = fresh(poc);
      poc.start(p, { x: 3, y: 15 });
      poc.draw(p, 'arc', { x: 10, y: 15 }); // no heading yet: straight
      poc.draw(p, 'arc', { x: 20, y: 8 });
      poc.setDrawGait('g3');
      poc.draw(p, 'arc', { x: 30, y: 15 });
      poc.draw(p, 'arc', { x: 22, y: 18 });
    },
    'arc3'(poc) {
      const [p] = fresh(poc);
      poc.start(p, { x: 3, y: 10 });
      poc.draw(p, 'line', { x: 12, y: 10 });
      const S = p.pts[p.pts.length - 1], M = { x: 18, y: 4 }, E = { x: 26, y: 9 };
      const res = poc.arc3Points(S, M, E);
      p.strokes.push(p.pts.length); p.sg.push('g2'); poc.takePending(p);
      res.pts.forEach((q) => p.pts.push({ x: +q.x.toFixed(2), y: +q.y.toFixed(2) }));
      poc.normalize(p);
      p.pts[p.strokes[p.strokes.length - 1]].geo = { kind: 'arc3', E: { ...E }, M: { ...M }, hand: 'auto', half: false, round: true };
      // collinear S, M, E: falls back to two straight pieces
      const S2 = p.pts[p.pts.length - 1];
      const r2 = poc.arc3Points(S2, { x: S2.x + 3, y: S2.y }, { x: S2.x + 6, y: S2.y });
      p.strokes.push(p.pts.length); p.sg.push('g1'); poc.takePending(p);
      r2.pts.forEach((q) => p.pts.push({ x: +q.x.toFixed(2), y: +q.y.toFixed(2) }));
      poc.normalize(p); poc.invalidate();
    },
    'volte'(poc) {
      const [p] = fresh(poc);
      poc.start(p, { x: 2, y: 10 });
      poc.draw(p, 'line', { x: 8, y: 10 });
      poc.setCircle({ hand: 'left', half: false });
      poc.draw(p, 'circle', { x: 9, y: 0 }); // 10 m to the left
      poc.setCircle({ hand: 'right', half: false });
      poc.draw(p, 'circle', { x: 9, y: 16.2 }); // ~6 m, snapped to 0.5 m
      poc.setCircle({ hand: 'left', half: true });
      poc.draw(p, 'line', { x: 20, y: 10 });
      poc.draw(p, 'circle', { x: 20, y: 2 });
      poc.setCircle({ hand: 'right', half: true });
      poc.setDrawGait('g3');
      poc.draw(p, 'circle', { x: 21, y: 25 });
      poc.setCircle({ hand: 'auto', half: false });
      poc.setDrawGait('g1');
      poc.draw(p, 'circle', { x: 30, y: 4.3 });
    },
    'volte-no-heading'(poc) {
      const [p, q, r] = fresh(poc, { horses: [horse(1), horse(2), horse(3)] });
      poc.start(p, { x: 10, y: 10 });
      poc.setCircle({ hand: 'auto', half: false });
      poc.draw(p, 'circle', { x: 30, y: 10 }); // Zirkel 20 m
      poc.start(q, { x: 5, y: 5 });
      poc.setCircle({ hand: 'right', half: true });
      poc.draw(q, 'circle', { x: 9.2, y: 8.1 });
      poc.start(r, { x: 30, y: 5 });
      poc.setCircle({ hand: 'left', half: false });
      poc.draw(r, 'circle', { x: 30.2, y: 5.3 }); // too small: nothing drawn
      poc.draw(r, 'circle', { x: 30, y: 20 }, true);
    },
    'freehand'(poc) {
      const [p] = fresh(poc, { scale: 20 });
      poc.free(p, wave(2, 10, 30, 3, 240));
      poc.setDrawGait('g1');
      poc.free(p, [{ x: 32.3, y: 10.1 }, { x: 33, y: 12 }, { x: 34, y: 15 }, { x: 34.05, y: 15.02 }, { x: 36, y: 16 }]);
      // far away start: an extra connecting point is inserted
      poc.free(p, wave(36, 18, -20, 1.5, 120));
    },
    'halt-pause'(poc) {
      const [p] = fresh(poc);
      poc.start(p, { x: 2, y: 5 });
      poc.draw(p, 'line', { x: 15, y: 5 });
      poc.nextHalt(p);
      poc.draw(p, 'line', { x: 15, y: 15 });
      poc.nextPause(p);
      poc.draw(p, 'line', { x: 35, y: 15 }, false, { x: 25, y: 10 });
      poc.nextPause(p);
      poc.free(p, wave(5, 18, 10, 1, 60));
      poc.nextHalt(p);
      p.gaps[0] = 3.5; // start time
    },
    'pending-at-end'(poc) {
      const [p, q] = fresh(poc, { horses: [horse(1), horse(2)] });
      poc.start(p, { x: 2, y: 5 });
      poc.draw(p, 'line', { x: 15, y: 5 });
      poc.nextPause(p);
      poc.start(q, { x: 2, y: 12 });
      poc.draw(q, 'line', { x: 15, y: 12 });
      poc.nextHalt(q);
    },
    'gaits-tack'(poc) {
      const [p, q] = fresh(poc, { horses: [horse(1, true), horse(2, false)] });
      for (const h of [p, q]) {
        const y = h === p ? 5 : 15;
        poc.start(h, { x: 2, y });
        poc.setDrawGait('g1'); poc.draw(h, 'line', { x: 12, y });
        poc.setDrawGait('g2'); poc.draw(h, 'line', { x: 24, y });
        poc.setDrawGait('g3'); poc.draw(h, 'line', { x: 38, y });
      }
    },
    'ref-volte-trot'(poc) {
      const [p] = fresh(poc);
      poc.start(p, { x: 5, y: 15 });
      poc.draw(p, 'line', { x: 10, y: 15 });
      poc.setCircle({ hand: 'left', half: false });
      poc.draw(p, 'circle', { x: 11, y: 5 });
    },
    'ref-galop-volte-md8'(poc) {
      const [p] = fresh(poc);
      poc.setDrawGait('g3');
      poc.start(p, { x: 5, y: 15 });
      poc.draw(p, 'line', { x: 12, y: 15 });
      poc.setCircle({ hand: 'left', half: false });
      poc.draw(p, 'circle', { x: 13, y: 9 });
      poc.draw(p, 'line', { x: 30, y: 15 });
    },
    'ref-galop-volte-md5'(poc) {
      const [p] = fresh(poc, { gaits: STD_GAITS.map((g) => (g.id === 'g3' ? { ...g, md: 5 } : g)) });
      poc.setDrawGait('g3');
      poc.start(p, { x: 5, y: 15 });
      poc.draw(p, 'line', { x: 12, y: 15 });
      poc.setCircle({ hand: 'left', half: false });
      poc.draw(p, 'circle', { x: 13, y: 9 });
      poc.draw(p, 'line', { x: 30, y: 15 });
    },
  };

  // plans given as raw prototype JSON (not drawn)
  window.__rawPlans = {
    // the prototype's demo plan: legacy halt points (w) and per-horse delay
    'sample-legacy': (poc) => poc.sampleState(),
    'legacy-pause'() {
      return {
        field: 'arena40', drawGait: 'g2',
        horses: [
          {
            name: 'Alt', num: 1, color: '#2471a3', tack: true, delay: 1.5, gaits: ['g1', 'g1', 'g2', 'g2', 'g2', 'g3'], strokes: [0, 3, 4, 7, 8, 10],
            pts: [
              { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 6, y: 2 },
              { x: 6, y: 2, w: 2 },
              { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 6, y: 8 },
              { x: 6, y: 8, w: 3, gap: true },
              { x: 20, y: 8 }, { x: 22, y: 8 },
              { x: 22, y: 9 }, { x: 22, y: 12 },
            ],
          },
          {
            name: 'Ende', num: 2, color: '#d4a017', tack: false, gaits: ['g2', 'g2'], strokes: [0, 3],
            pts: [{ x: 2, y: 15 }, { x: 8, y: 15 }, { x: 14, y: 15 }, { x: 14, y: 15, w: 4, gap: true, pend: true }],
          },
          {
            name: 'Halt am Ende', num: 3, color: '#16a085', tack: true, gaits: ['g3', 'g3'], strokes: [0, 2],
            pts: [{ x: 2, y: 18 }, { x: 12, y: 18 }, { x: 12, y: 18, w: 2.5 }],
          },
        ],
      };
    },
    'normalize-messy'() {
      return {
        field: 'arena40', drawGait: 'g2',
        gaits: STD_GAITS,
        horses: [
          {
            name: 'Chaos', num: 1, color: '#8e44ad', tack: true,
            strokes: [2, 1, 3, 3, 9, 40], gaits: ['g1', 'g9', 'g2', 'g3', 'g1', 'g2'], gaps: [-1, 2, 'x', 1, 4, 5], gapTypes: ['pause', 'pause', null, 'bogus'],
            pts: [{ x: 1, y: 1, jump: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 7, y: 1 }, { x: 9, y: 1, jump: 1 }, { x: 11, y: 3 }, { x: 13, y: 5 }, { x: 13, y: 9 }, { x: 'a', y: 2 }, { x: 15, y: 9 }],
          },
          { name: 'Leer', num: 2, color: '#16a085', tack: true, strokes: [], gaits: [], pts: [] },
          { name: 'Punkt', num: 3, color: '#16a085', tack: true, strokes: [0], gaits: ['g1'], gaps: [2], pts: [{ x: 4, y: 4 }] },
          {
            name: 'Sprungstart', num: 4, color: '#f5f5f5', tack: true, strokes: [0, 1, 4], gaits: ['g1', 'g2', 'g3'], gaps: [1, 2, 3], gapTypes: [null, 'halt', null],
            pts: [{ x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 10, y: 8, jump: true }, { x: 11, y: 9 }, { x: 12, y: 9 }],
          },
          {
            name: 'Nur Sprung', num: 5, color: '#f5f5f5', tack: true, strokes: [0, 2, 3], gaits: ['g1', 'g2', 'g3'], gaps: [0, 2, 3], gapTypes: [null, 'halt', 'halt'],
            pts: [{ x: 1, y: 12 }, { x: 4, y: 12 }, { x: 9, y: 12, jump: true }, { x: 12, y: 12 }, { x: 12, y: 15 }],
          },
        ],
      };
    },
  };
})();
