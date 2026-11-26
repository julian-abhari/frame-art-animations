// Scene 1: flocking boids swimming through an animated marching-squares landscape.
// Boids steer around the glowing contour walls and bounce off them if they touch.
(function () {
  const W = 1920, H = 1080;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class FlockingMarchingScene {
    constructor() {
      this.seed = 20240607;
      this.params = { separation: 1.6, alignment: 1.0, cohesion: 1.0, avoidance: 2.5 };
      this.reset();
    }

    reset() {
      this.rand = mulberry32(this.seed);
      this.t = 0;
      this.field = new TerrainField(W, H, 20, this.seed, 0.2);
      this.field.update(this.t);
      this.boids = [];
      for (let i = 0; i < 220; i++) this.addBoidInOpenSpace();
    }

    addBoidInOpenSpace(x, y) {
      for (let tries = 0; tries < 200; tries++) {
        const px = x !== undefined ? x : this.rand() * W;
        const py = y !== undefined ? y : this.rand() * H;
        if (this.field.sample(px, py) < this.field.threshold - 0.1) {
          this.boids.push(new Boid(px, py, this.rand));
          return;
        }
        x = y = undefined; // fall back to random placement
      }
    }

    // One simulation tick (defined at 60 ticks/second).
    update() {
      this.t += 0.0035;
      this.field.update(this.t);
      for (const b of this.boids) b.run(this.boids, this.field, this.params, W, H);
    }

    // Draw into a p5.Graphics that is already scaled to the 1920x1080 logical space.
    draw(g) {
      this.field.draw(g);
      const ctx = g.drawingContext;
      for (const b of this.boids) b.draw(ctx);
      // Soft vignette
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Click/drag in the preview to add boids (logical coordinates).
    onPointer(x, y) { this.addBoidInOpenSpace(x, y); }
  }

  SCENES.push({
    name: 'Flocking Boids in Marching Squares',
    create: () => new FlockingMarchingScene(),
    controls: [
      { key: 'separation', label: 'Separation', min: 0, max: 3, step: 0.1 },
      { key: 'alignment', label: 'Alignment', min: 0, max: 3, step: 0.1 },
      { key: 'cohesion', label: 'Cohesion', min: 0, max: 3, step: 0.1 },
      { key: 'avoidance', label: 'Wall avoidance', min: 0, max: 5, step: 0.1 },
    ],
  });
})();
