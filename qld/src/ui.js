// 두 페이지(index·hold)가 함께 쓰는 화면 코드: 숫자 표시, 캔버스 차트, 기간 선택 막대
const UI = (() => {
  const $ = id => document.getElementById(id);
  const toDate = d => new Date(d * 86400000);
  const ymd = d => { const t = toDate(d); return `${t.getUTCFullYear()}.${String(t.getUTCMonth() + 1).padStart(2, '0')}.${String(t.getUTCDate()).padStart(2, '0')}`; };
  const krw = x => { if (!isFinite(x)) return '–'; const a = Math.abs(x), s = x < 0 ? '−' : ''; if (a >= 1e8) return s + (a / 1e8).toFixed(a >= 1e10 ? 0 : 2) + '억원'; return s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만원'; };
  const pct = (x, d = 1) => isFinite(x) ? (x * 100).toFixed(d) + '%' : '–';
  const axisKrw = v => { const t = v >= 1e8 ? v / 1e8 : v / 1e4; const s = Number.isInteger(Math.round(t * 100) / 100) ? Math.round(t).toLocaleString('ko-KR') : (Math.round(t * 10) / 10).toLocaleString('ko-KR'); return s + (v >= 1e8 ? '억' : '만'); };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function makeChart(host, opts) {
    const cv = host.querySelector('canvas'); const ctx = cv.getContext('2d');
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; host.appendChild(tip);
    const st = { data: null, hover: -1 };
    function geom() {
      const w = host.clientWidth, h = host.clientHeight;
      return { w, h, l: opts.padL || 58, r: 10, t: 10, b: 24 };
    }
    function draw() {
      const g = geom(); const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(g.w * dpr); cv.height = Math.round(g.h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      const d = st.data; if (!d || d.x.length < 2) return;
      const pw = g.w - g.l - g.r, ph = g.h - g.t - g.b;
      const x0 = d.x[0], x1 = d.x[d.x.length - 1];
      const X = v => g.l + (v - x0) / (x1 - x0) * pw;
      let lo = Infinity, hi = -Infinity;
      for (const s of d.series) for (const v of s.v) if (isFinite(v) && (!d.log || v > 0)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (d.yMin != null) lo = d.yMin; if (d.yMax != null) hi = Math.max(hi, d.yMax);
      for (const hl of d.hlines || []) hi = Math.max(hi, hl.y * 1.08);
      if (!(hi > lo)) { hi = lo + 1; }
      const tf = d.log ? Math.log10 : (v => v);
      const L0 = tf(lo), L1 = tf(hi) + (d.log ? 0.04 : (hi - lo) * 0.04);
      const Y = v => g.t + ph - (tf(v) - L0) / (L1 - L0) * ph;
      const cFaint = css('--faint'), cLine = css('--line'), cMuted = css('--muted');
      // bands
      for (const b of d.bands || []) { ctx.fillStyle = css(b.color); ctx.fillRect(X(b.from), g.t, Math.max(1, X(b.to) - X(b.from)), ph); }
      // y grid
      ctx.font = '11px ' + css('--f-num'); ctx.fillStyle = cFaint; ctx.strokeStyle = cLine; ctx.lineWidth = 1; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      let ticks = [];
      if (d.log) { const e0 = Math.floor(L0), e1 = Math.ceil(L1); for (let e = e0; e <= e1; e++) for (const m of [1, 2, 5]) { const v = m * Math.pow(10, e); if (tf(v) >= L0 && tf(v) <= L1) ticks.push(v); }
        if (ticks.length > 7) ticks = ticks.filter(v => Math.abs(Math.log10(v) % 1) < 1e-9 || Math.abs(Math.log10(v) % 1 - Math.log10(3)) < 0.0); if (ticks.length < 2) ticks = [lo, hi]; }
      else { const span = hi - lo, raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => span / s <= 5);
        for (let v = Math.ceil(lo / step) * step; v <= L1 + 1e-12; v += step) ticks.push(v); }
      for (const v of ticks) { const y = Y(v); ctx.beginPath(); ctx.moveTo(g.l, y + 0.5); ctx.lineTo(g.w - g.r, y + 0.5); ctx.stroke(); ctx.fillText(d.yfmt(v), g.l - 6, y); }
      // x ticks: years
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const ys = toDate(x0).getUTCFullYear(), ye = toDate(x1).getUTCFullYear(); const span = ye - ys;
      const maxLab = Math.max(2, Math.floor(pw / 44));
      const ticksX = [];
      if ((x1 - x0) < 600) { const nm = Math.round((x1 - x0) / 30.4); const stepM = [1, 2, 3, 6].find(s => nm / s <= maxLab) || 6;
        const t0 = toDate(x0); for (let k = 1; k <= nm + 1; k++) { const y = t0.getUTCFullYear(), mo = t0.getUTCMonth() + k; const dd = Date.UTC(y, mo, 1) / 86400000; const tm = toDate(dd).getUTCMonth(); if (tm % stepM) continue; if (dd < x0 || dd > x1) continue; ticksX.push([dd, tm === 0 ? String(toDate(dd).getUTCFullYear()) : (tm + 1) + '월']); } }
      else { const stepY = [1, 2, 5, 10].find(s => span / s <= maxLab) || 10;
        for (let y = Math.ceil(ys / stepY) * stepY; y <= ye; y += stepY) { const dd = Date.UTC(y, 0, 1) / 86400000; if (dd < x0 || dd > x1) continue; ticksX.push([dd, String(y)]); } }
      for (const [dd, lab] of ticksX) { const x = X(dd); ctx.fillStyle = cFaint; ctx.fillText(lab, x, g.t + ph + 6); ctx.strokeStyle = cLine; ctx.beginPath(); ctx.moveTo(x + 0.5, g.t + ph); ctx.lineTo(x + 0.5, g.t + ph + 4); ctx.stroke(); }
      // hlines
      for (const hl of d.hlines || []) { const y = Y(hl.y); ctx.strokeStyle = css(hl.color); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(g.l, y); ctx.lineTo(g.w - g.r, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = css(hl.color); ctx.textAlign = 'right'; ctx.textBaseline = hl.below ? 'top' : 'bottom'; ctx.fillText(hl.label, g.w - g.r - 2, hl.below ? y + 2 : y - 2); }
      // zero/baseline
      if (!d.log && lo <= 0 && hi >= 0) { ctx.strokeStyle = cMuted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.l, Y(0) + 0.5); ctx.lineTo(g.w - g.r, Y(0) + 0.5); ctx.stroke(); }
      // series
      ctx.save(); ctx.beginPath(); ctx.rect(g.l, g.t, pw, ph); ctx.clip();
      for (const s of d.series) {
        ctx.strokeStyle = css(s.color); ctx.lineWidth = s.w || 2; ctx.lineJoin = 'round'; ctx.setLineDash(s.dash || []);
        ctx.beginPath(); let started = false;
        for (let k = 0; k < d.x.length; k++) { const v = s.v[k]; if (!isFinite(v) || (d.log && v <= 0)) { started = false; continue; } const px = X(d.x[k]), py = Y(v); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
      // hover
      if (st.hover >= 0) { const k = st.hover, px = X(d.x[k]);
        ctx.strokeStyle = cMuted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 0.5, g.t); ctx.lineTo(px + 0.5, g.t + ph); ctx.stroke();
        for (const s of d.series) { const v = s.v[k]; if (!isFinite(v) || (d.log && v <= 0)) continue; ctx.fillStyle = css(s.color); ctx.strokeStyle = css('--surface'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, Y(v), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        tip.innerHTML = `<div class="d">${ymd(d.x[k])}</div>` + d.series.filter(s => s.name).map(s => `<div class="r"><span><span class="key" style="background:${css(s.color)}"></span>${s.name}</span><b>${d.tfmt(s.v[k])}</b></div>`).join('') + (d.extra ? d.extra(k) : '');
        tip.hidden = false; const tw = tip.offsetWidth; let left = px + 12; if (left + tw > g.w) left = px - tw - 12; tip.style.left = Math.max(0, left) + 'px'; tip.style.top = (g.t + 4) + 'px';
      } else tip.hidden = true;
      st.geom = { g, X, x0, x1, pw };
    }
    function pick(ev) {
      const d = st.data, gm = st.geom; if (!d || !gm) return;
      const rect = cv.getBoundingClientRect(); const mx = ev.clientX - rect.left;
      if (mx < gm.g.l || mx > gm.g.w - gm.g.r) { st.hover = -1; draw(); return; }
      const xv = gm.x0 + (mx - gm.g.l) / gm.pw * (gm.x1 - gm.x0);
      let lo = 0, hi = d.x.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (d.x[m] < xv) lo = m + 1; else hi = m; }
      if (lo > 0 && Math.abs(d.x[lo - 1] - xv) < Math.abs(d.x[lo] - xv)) lo--;
      st.hover = lo; draw();
    }
    cv.addEventListener('pointermove', pick); cv.addEventListener('pointerdown', pick);
    cv.addEventListener('pointerleave', () => { st.hover = -1; draw(); });
    new ResizeObserver(() => draw()).observe(host);
    return { set(data) { st.data = data; st.hover = -1; draw(); }, draw };
  }
  // 기간 선택 막대: 전체 월별 가격(mPx)을 흐리게, 고른 구간(rS~rE)을 진하게 그린다
  function makeBrush(brushHost, months, mPx, rS, rE) {
    const bcv = brushHost.querySelector('canvas'), bctx = bcv.getContext('2d');
    function drawBrush() {
      const w = brushHost.clientWidth, h = brushHost.clientHeight, dpr = window.devicePixelRatio || 1; if (!w) return;
      bcv.width = Math.round(w * dpr); bcv.height = Math.round(h * dpr); bctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.clearRect(0, 0, w, h);
      const M = months.length - 1, tw = 20, X = k => tw / 2 + k / M * (w - tw);
      const lo = Math.log10(Math.min(...mPx)), hi = Math.log10(Math.max(...mPx)), Y = v => 8 + (1 - (Math.log10(v) - lo) / (hi - lo)) * (h - 26);
      const a = +rS.value, b = +rE.value;
      const path = (k0, k1) => { bctx.beginPath(); for (let k = k0; k <= k1; k++) { const x = X(k), y = Y(mPx[k]); k === k0 ? bctx.moveTo(x, y) : bctx.lineTo(x, y); } };
      // full series faint
      path(0, M); bctx.strokeStyle = css('--faint'); bctx.lineWidth = 1.25; bctx.stroke();
      // selected area + line
      path(a, b); bctx.lineTo(X(b), h - 18); bctx.lineTo(X(a), h - 18); bctx.closePath(); bctx.fillStyle = css('--sel-fill'); bctx.fill();
      path(a, b); bctx.strokeStyle = css('--accent'); bctx.lineWidth = 2; bctx.stroke();
      // year labels
      bctx.font = '10px ' + css('--f-num'); bctx.fillStyle = css('--faint'); bctx.textAlign = 'center'; bctx.textBaseline = 'bottom';
      const step = w < 360 ? 10 : 5;
      months.forEach((o, k) => { if (o.m === 1 && o.y % step === 0) bctx.fillText(String(o.y), X(k), h - 3); });
    }
    new ResizeObserver(drawBrush).observe(brushHost);
    return drawBrush;
  }
  // 표 항목명 '이름 (설명)' → 설명은 작은 둘째 줄 (폰에서 표 칸이 좁을 때 읽기 쉽게)
  const subLabel = s => s.replace(/ \((.+)\)$/, '<small class="sub-l">$1</small>');
  // 폰에서 설정 칸이 보이고 결과 칸은 안 보일 때만 화면 아래에 결과 요약을 띄운다
  function watchMini(ctl, res, mini) {
    if (!('IntersectionObserver' in window)) return;
    const seen = new Map();
    // 결과 칸은 머리글만 살짝 보이는 정도(30% 미만)면 안 보이는 것으로 친다
    const io = new IntersectionObserver(es => { for (const e of es) seen.set(e.target, e.intersectionRatio > (e.target === res ? 0.3 : 0));
      mini.hidden = !(seen.get(ctl) && !seen.get(res)); }, { threshold: [0, 0.3] });
    io.observe(ctl); io.observe(res);
  }
  return { $, toDate, ymd, krw, pct, axisKrw, css, makeChart, makeBrush, subLabel, watchMini };
})();
