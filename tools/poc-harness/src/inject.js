  // ---- injected by tools/poc-harness: exposes the closure to the harness ----
  window.__poc = {
    get state() { return state; },
    get clip() { return clip; },
    load, serialize, normalize, migrateLegacy, timeline, invalidate, posAt, headingAt, curveRadii,
    turnThenStraight, arc3Points, geometry, sampleLine, sectionOf, sectionRange, sectionGeom,
    splitAt, deleteSection, mergeSel, rotateSel, mirrorSel, copyPart, copySel, doPaste, setPastePos,
    pasteOpts, pasteTargets, regenerate, affected, groupPivot, takePending, snapT, sampleState,
    selectOnly, toggleSel, selectWhole, clearSel, selGroups,
    setScale(v) { scale = v; },
    setFollow(v) { followFlag = v; },
    setActive(id) { state.active = id; },
    setDrawGait(id) { state.drawGait = id; },
    setCircle(o) { Object.assign(circleOpts, o); },
    setCheck(id, v) { $(id).checked = v; },
    // mirrors pointerdown + endStroke of the geometry tools (line, arc, circle)
    start(p, pt) {
      p.pts.push({ x: pt.x, y: pt.y }); p.strokes = [0]; p.sg = [state.drawGait]; p.gaps = [0]; p.gt = [null];
      p.pendJump = false; p.pendGap = null; normalize(p); invalidate();
    },
    // after "+ Pause" the pointer goes down at `jumpTo` (the new start) and is released at E
    draw(p, kind, E, shift, jumpTo) {
      if (p.pendJump) {
        p.strokes.push(p.pts.length); p.sg.push(state.drawGait); takePending(p);
        p.pts.push({ x: jumpTo.x, y: jumpTo.y, jump: true }); p.pendJump = false;
      }
      const S = p.pts[p.pts.length - 1], hd = p.pts.length > 1 ? headingAt(p, p.pts.length - 1) : null;
      const target = { x: E.x, y: E.y };
      const g = geometry(kind, { x: S.x, y: S.y }, hd, target, !!shift);
      if (!g.pts.length) { normalize(p); invalidate(); return g; }
      p.strokes.push(p.pts.length); p.sg.push(state.drawGait); takePending(p);
      g.pts.forEach(q => p.pts.push({ x: +q.x.toFixed(2), y: +q.y.toFixed(2) }));
      normalize(p);
      const end = kind === 'circle' ? target : g.end;
      p.pts[p.strokes[p.strokes.length - 1]].geo = { kind, E: { x: +end.x.toFixed(2), y: +end.y.toFixed(2) }, hand: circleOpts.hand, half: circleOpts.half, round: $('roundCorners').checked };
      invalidate();
      return g;
    },
    // mirrors the freehand pointerdown / pointermove / pointerup sequence
    free(p, raw) {
      const pts = raw.map(q => ({ x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 }));
      const first = pts[0];
      if (!p.pts.length) { p.pts.push({ ...first }); p.strokes = [0]; p.sg = [state.drawGait]; p.gaps = [0]; p.gt = [null]; p.pendJump = false; p.pendGap = null; }
      else {
        p.strokes.push(p.pts.length); p.sg.push(state.drawGait); takePending(p);
        const last = p.pts[p.pts.length - 1];
        if (p.pendJump) { p.pts.push({ ...first, jump: true }); p.pendJump = false; }
        else if (Math.hypot(last.x - first.x, last.y - first.y) * scale > 14) p.pts.push({ ...first });
      }
      const minStep = 4 / scale;
      for (const pt of pts.slice(1)) { const last = p.pts[p.pts.length - 1]; if (Math.hypot(pt.x - last.x, pt.y - last.y) >= minStep) p.pts.push({ ...pt }); }
      normalize(p); invalidate();
    },
    nextHalt(p) { p.pendGap = { w: 2, t: 'halt' }; p.pendJump = false; },
    nextPause(p) { p.pendGap = { w: 4, t: 'pause' }; p.pendJump = true; },
  };
