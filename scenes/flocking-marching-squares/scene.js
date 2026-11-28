// Scene 1: flocking boids swimming through an animated marching-squares landscape.
// The boids steer around the glowing contour walls and bounce off if they touch.
//
// Every scene is drawn in a fixed 1920x1080 space. The driver scales it for 1080p/4K export.
class FlockingMarchingScene {
  constructor() {
    this.seed = 20240607;
    this.params = { separation: 1.6, alignment: 1.0, cohesion: 1.0, avoidance: 2.5 };
    this.vignette = this.makeVignette();
    this.reset();
  }

  // Start over from the beginning. Seeded so every run (and every export) is identical.
  reset() {
    randomSeed(this.seed);
    this.zOffset = 0;
    this.field = new TerrainField(1920, 1080, 20, this.seed, 0.2);
    this.field.update(this.zOffset);
    this.flock = [];
    for (let i = 0; i < 220; i += 1) {
      this.addBoid(random(1920), random(1080));
    }
  }

  // Add a boid at (x, y), or somewhere open nearby if (x, y) is inside a wall.
  addBoid(x, y) {
    for (let tries = 0; tries < 200; tries += 1) {
      if (this.field.sample(x, y) < this.field.threshold - 0.1) {
        this.flock.push(new Boid(x, y));
        return;
      }
      x = random(1920);
      y = random(1080);
    }
  }

  // One simulation tick (the driver runs 60 of these per second).
  update() {
    this.zOffset += 0.0035;
    this.field.update(this.zOffset);
    for (let boid of this.flock) {
      boid.run(this.flock, this.field, this.params);
    }
  }

  // g is a p5.Graphics already scaled to the 1920x1080 space.
  draw(g) {
    g.colorMode(RGB, 255);
    this.field.draw(g);

    g.colorMode(HSB, 360, 100, 100, 1);
    for (let boid of this.flock) {
      boid.display(g);
    }

    g.image(this.vignette, 0, 0, 1920, 1080);
  }

  // Click/drag on the preview TV adds boids (driver passes scene coordinates).
  onPointer(x, y) {
    this.addBoid(x, y);
  }

  // Dark edges, painted once into a small image.
  makeVignette() {
    let img = createImage(192, 108);
    img.loadPixels();
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        let d = dist(x, y, img.width / 2, img.height / 2) / (img.height / 2);
        let p = 4 * (y * img.width + x);
        img.pixels[p] = 0;
        img.pixels[p + 1] = 0;
        img.pixels[p + 2] = 0;
        img.pixels[p + 3] = constrain(map(d, 0.45, 1.0, 0, 115), 0, 115);
      }
    }
    img.updatePixels();
    return img;
  }
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
