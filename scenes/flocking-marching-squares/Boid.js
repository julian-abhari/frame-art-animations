// A boid that flocks (separation/alignment/cohesion) and reacts to a TerrainField.
class Boid {
  constructor(x, y, rand) {
    const a = rand() * Math.PI * 2;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * 1.5; this.vy = Math.sin(a) * 1.5;
    this.ax = 0; this.ay = 0;
    this.size = 4.5;
    this.maxSpeed = 3.4;
    this.maxForce = 0.16;
    this.hue = 175 + rand() * 50; // teal -> blue
    this.trail = [];
  }

  run(boids, field, params, W, H) {
    this.flock(boids, params);
    this.avoidWalls(field, params);
    this.update(field, W, H);
  }

  steer(dx, dy, limit) {
    // desired direction (dx,dy) -> steering force limited to `limit`
    const m = Math.hypot(dx, dy);
    if (m === 0) return [0, 0];
    let sx = (dx / m) * this.maxSpeed - this.vx;
    let sy = (dy / m) * this.maxSpeed - this.vy;
    const sm = Math.hypot(sx, sy);
    if (sm > limit) { sx = sx / sm * limit; sy = sy / sm * limit; }
    return [sx, sy];
  }

  flock(boids, params) {
    const sepD2 = 28 * 28, nbD2 = 60 * 60;
    let sx = 0, sy = 0, sc = 0;
    let ax = 0, ay = 0, cx = 0, cy = 0, nc = 0;
    for (let i = 0; i < boids.length; i++) {
      const o = boids[i];
      if (o === this) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nbD2) {
        ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; nc++;
        if (d2 < sepD2 && d2 > 0) { const d = Math.sqrt(d2); sx += dx / d / d; sy += dy / d / d; sc++; }
      }
    }
    if (sc > 0) {
      const f = this.steer(sx / sc, sy / sc, this.maxForce);
      this.ax += f[0] * params.separation; this.ay += f[1] * params.separation;
    }
    if (nc > 0) {
      const fa = this.steer(ax / nc, ay / nc, this.maxForce);
      this.ax += fa[0] * params.alignment; this.ay += fa[1] * params.alignment;
      const fc = this.steer(cx / nc - this.x, cy / nc - this.y, this.maxForce);
      this.ax += fc[0] * params.cohesion; this.ay += fc[1] * params.cohesion;
    }
  }

  // Soft steering: look ahead and turn away from walls before touching them.
  avoidWalls(field, params) {
    const T = field.threshold;
    const speed = Math.hypot(this.vx, this.vy) || 1;
    for (const look of [14, 32]) {
      const px = this.x + (this.vx / speed) * look;
      const py = this.y + (this.vy / speed) * look;
      const f = field.sample(px, py);
      if (f > T - 0.06) {
        const g = field.gradient(px, py);
        const m = Math.hypot(g.x, g.y);
        if (m > 1e-6) {
          const k = params.avoidance * Math.min(1, (f - (T - 0.06)) * 8 + 0.25);
          this.ax -= (g.x / m) * this.maxForce * k;
          this.ay -= (g.y / m) * this.maxForce * k;
        }
      }
    }
  }

  update(field, W, H) {
    this.vx += this.ax; this.vy += this.ay;
    this.ax = 0; this.ay = 0;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > this.maxSpeed) { this.vx = this.vx / sp * this.maxSpeed; this.vy = this.vy / sp * this.maxSpeed; }
    this.x += this.vx; this.y += this.vy;

    // Hard collision: if inside a wall, eject along the gradient and bounce.
    const T = field.threshold;
    let f = field.sample(this.x, this.y);
    if (f > T) {
      let nx = 0, ny = 0;
      for (let k = 0; k < 12 && f > T; k++) {
        const g = field.gradient(this.x, this.y);
        const m = Math.hypot(g.x, g.y);
        if (m < 1e-7) break;
        nx = -g.x / m; ny = -g.y / m; // outward normal
        this.x += nx * 3; this.y += ny * 3;
        f = field.sample(this.x, this.y);
      }
      const vn = this.vx * nx + this.vy * ny;
      if (vn < 0) { this.vx -= 1.7 * vn * nx; this.vy -= 1.7 * vn * ny; }
    }

    // Wrap around the screen edges.
    const pad = this.size;
    if (this.x < -pad) this.x = W + pad; else if (this.x > W + pad) this.x = -pad;
    if (this.y < -pad) this.y = H + pad; else if (this.y > H + pad) this.y = -pad;

    // Trail (skip points across a wrap so we don't draw streaks across the screen)
    const last = this.trail[this.trail.length - 1];
    if (last && Math.hypot(last[0] - this.x, last[1] - this.y) > 60) this.trail.length = 0;
    this.trail.push([this.x, this.y]);
    if (this.trail.length > 18) this.trail.shift();
  }

  draw(ctx) {
    const n = this.trail.length;
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const a = i / n;
      ctx.strokeStyle = `hsla(${this.hue},90%,70%,${a * 0.5})`;
      ctx.lineWidth = 1 + a * 2.2;
      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1][0], this.trail[i - 1][1]);
      ctx.lineTo(this.trail[i][0], this.trail[i][1]);
      ctx.stroke();
    }
    // Head: small triangle pointing along velocity
    const th = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(th);
    ctx.fillStyle = `hsl(${this.hue},95%,85%)`;
    ctx.shadowColor = `hsl(${this.hue},100%,65%)`;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(this.size * 1.6, 0);
    ctx.lineTo(-this.size, -this.size * 0.8);
    ctx.lineTo(-this.size, this.size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
