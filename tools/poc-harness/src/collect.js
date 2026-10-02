// Runs inside the patched prototype page; collects what the prototype computes.
(() => {
  const clone = (v) => JSON.parse(JSON.stringify(v));

  function runPlan(name, kind) {
    const poc = window.__poc;
    let input;
    if (kind === 'drawn') {
      window.__scenarios[name](poc);
      input = clone(poc.serialize());
    } else {
      input = clone(window.__rawPlans[name](poc));
    }
    poc.load(clone(input));
    const st = poc.state;
    const horses = st.players.map((p) => {
      poc.invalidate();
      const tl = poc.timeline(p);
      const times = new Set([-0.5, 0]);
      for (let t = 0; t <= tl.total + 1; t += 0.25) times.add(Math.round(t * 1000) / 1000);
      tl.ts.forEach((t) => times.add(t));
      tl.t0s.forEach((t) => times.add(t));
      const pos = [...times].sort((a, b) => a - b).map((t) => ({ t, ...poc.posAt(p, t) }));
      return {
        normalized: {
          tack: p.tack, pts: p.pts, strokes: p.strokes, sg: p.sg, gaps: p.gaps, gt: p.gt,
          pendJump: !!p.pendJump, pendGap: p.pendGap || null,
        },
        timeline: {
          ts: tl.ts, t0s: tl.t0s, total: tl.total, dist: tl.dist, secs: tl.secs,
          vs: Array.from(tl.vs), flag: Array.from(tl.flag),
        },
        radii: Array.from(poc.curveRadii(p.pts)),
        heading: p.pts.map((_, i) => poc.headingAt(p, i)),
        pos,
      };
    });
    return clone({ name, input, gaits: st.gaits, drawGait: st.drawGait, horses, exported: poc.serialize() });
  }

  function runGeometry(cases) {
    const poc = window.__poc;
    poc.load({ field: 'arena40', horses: [] });
    poc.setCheck('snapOn', true);
    return clone(cases.map((c) => {
      poc.state.gaits = c.gaits;
      poc.setDrawGait(c.gait);
      poc.setCheck('roundCorners', c.round);
      poc.setCircle({ hand: c.hand, half: c.half });
      let out;
      if (c.fn === 'geometry') out = poc.geometry(c.kind, c.S, c.hd, c.E, c.shift);
      else if (c.fn === 'turnThenStraight') out = poc.turnThenStraight(c.S, c.hd, c.E, c.R);
      else out = poc.arc3Points(c.S, c.M, c.E);
      return { ...c, out };
    }));
  }

  function runOp(name) {
    const poc = window.__poc;
    const info = window.__ops[name](poc);
    return clone({ name, before: window.__opBefore, after: poc.serialize(), info, field: { w: 40, h: 20 } });
  }

  window.__harness = {
    names: () => ({ drawn: Object.keys(window.__scenarios), raw: Object.keys(window.__rawPlans), ops: Object.keys(window.__ops) }),
    runPlan,
    runGeometry,
    runOp,
  };
})();
