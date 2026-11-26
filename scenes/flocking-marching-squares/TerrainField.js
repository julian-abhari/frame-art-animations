// Animated scalar field + marching squares.
// Values above `threshold` are "solid" (walls the boids can't enter).
class TerrainField {
  constructor(w, h, cell, seed, threshold) {
    this.w = w;
    this.h = h;
    this.cell = cell;
    this.cols = Math.ceil(w / cell) + 1;
    this.rows = Math.ceil(h / cell) + 1;
    this.threshold = threshold;
    this.values = new Float32Array(this.cols * this.rows);
    this.noiseA = new OpenSimplexNoise(seed);
    this.noiseB = new OpenSimplexNoise(seed + 1013);
    this._g = { x: 0, y: 0 };

    // Low-res offscreen canvas for the smooth filled terrain.
    this.imgScale = 4;
    this.imgW = Math.ceil(w / this.imgScale);
    this.imgH = Math.ceil(h / this.imgScale);
    this.img = document.createElement('canvas');
    this.img.width = this.imgW;
    this.img.height = this.imgH;
    this.imgCtx = this.img.getContext('2d');
    this.imgData = this.imgCtx.createImageData(this.imgW, this.imgH);
  }

  update(t) {
    const { cols, rows, cell, values } = this;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cell, y = j * cell;
        const a = this.noiseA.noise3D(x * 0.0019, y * 0.0019, t);
        const b = this.noiseB.noise3D(x * 0.0046, y * 0.0046, t * 1.4);
        values[j * cols + i] = a * 0.72 + b * 0.28;
      }
    }
  }

  // Bilinear sample at world position.
  sample(x, y) {
    const { cols, rows, cell, values } = this;
    let fx = x / cell, fy = y / cell;
    if (fx < 0) fx = 0; else if (fx > cols - 1.001) fx = cols - 1.001;
    if (fy < 0) fy = 0; else if (fy > rows - 1.001) fy = rows - 1.001;
    const i = fx | 0, j = fy | 0;
    const u = fx - i, v = fy - j;
    const k = j * cols + i;
    const top = values[k] * (1 - u) + values[k + 1] * u;
    const bot = values[k + cols] * (1 - u) + values[k + cols + 1] * u;
    return top * (1 - v) + bot * v;
  }

  // Gradient (points toward higher field = into the wall). Returns shared object.
  gradient(x, y) {
    const e = this.cell * 0.5;
    this._g.x = this.sample(x + e, y) - this.sample(x - e, y);
    this._g.y = this.sample(x, y + e) - this.sample(x, y - e);
    return this._g;
  }

  // Marching squares: strokes all contour segments for `level` in one path.
  strokeContour(ctx, level) {
    const { cols, rows, cell, values } = this;
    ctx.beginPath();
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const k = j * cols + i;
        const tl = values[k], tr = values[k + 1];
        const bl = values[k + cols], br = values[k + cols + 1];
        const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = i * cell, y0 = j * cell;
        // Edge points by linear interpolation: 0 top, 1 right, 2 bottom, 3 left
        const pt = (e) => {
          switch (e) {
            case 0: return [x0 + cell * ((level - tl) / (tr - tl)), y0];
            case 1: return [x0 + cell, y0 + cell * ((level - tr) / (br - tr))];
            case 2: return [x0 + cell * ((level - bl) / (br - bl)), y0 + cell];
            default: return [x0, y0 + cell * ((level - tl) / (bl - tl))];
          }
        };
        let segs;
        switch (idx) {
          case 1: case 14: segs = [[2, 3]]; break;
          case 2: case 13: segs = [[1, 2]]; break;
          case 3: case 12: segs = [[1, 3]]; break;
          case 4: case 11: segs = [[0, 1]]; break;
          case 6: case 9: segs = [[0, 2]]; break;
          case 7: case 8: segs = [[0, 3]]; break;
          case 5: segs = ((tl + tr + bl + br) / 4 > level) ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]]; break;
          default: segs = ((tl + tr + bl + br) / 4 > level) ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]]; break; // 10
        }
        for (const [a, b] of segs) {
          const p = pt(a), q = pt(b);
          ctx.moveTo(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
        }
      }
    }
    ctx.stroke();
  }

  // Paint the filled terrain/background into the low-res canvas.
  renderImage() {
    const { imgW, imgH, imgScale, imgData, threshold: T } = this;
    const d = imgData.data;
    let p = 0;
    for (let py = 0; py < imgH; py++) {
      for (let px = 0; px < imgW; px++) {
        const f = this.sample((px + 0.5) * imgScale, (py + 0.5) * imgScale);
        let r, g, b;
        if (f > T) {
          const t = Math.min(1, (f - T) / 0.55);
          r = 46 + t * 120; g = 18 + t * 26; b = 96 + t * 40;
        } else {
          const depth = Math.min(1, (T - f) / 1.0);
          const glow = Math.exp(-(T - f) * 7) * 38;
          r = 12 - depth * 5 + glow * 0.9;
          g = 18 - depth * 6 + glow * 0.35;
          b = 46 - depth * 16 + glow * 0.8;
        }
        d[p++] = r; d[p++] = g; d[p++] = b; d[p++] = 255;
      }
    }
    this.imgCtx.putImageData(imgData, 0, 0);
  }

  draw(g) {
    const ctx = g.drawingContext;
    this.renderImage();
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.img, 0, 0, this.w, this.h);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const T = this.threshold;
    // Faint topographic rings
    ctx.strokeStyle = 'rgba(120,150,255,0.10)'; ctx.lineWidth = 1.5;
    this.strokeContour(ctx, T - 0.16);
    this.strokeContour(ctx, T - 0.32);
    ctx.strokeStyle = 'rgba(255,170,120,0.12)';
    this.strokeContour(ctx, T + 0.18);
    this.strokeContour(ctx, T + 0.36);
    // Wall edge: glow + core
    ctx.strokeStyle = 'rgba(255,150,70,0.16)'; ctx.lineWidth = 14;
    this.strokeContour(ctx, T);
    ctx.strokeStyle = 'rgba(255,190,110,0.30)'; ctx.lineWidth = 6;
    this.strokeContour(ctx, T);
    ctx.strokeStyle = 'rgba(255,236,190,0.95)'; ctx.lineWidth = 2.2;
    this.strokeContour(ctx, T);
    ctx.restore();
  }
}
