// Scene 1: a school of fish in a deep-navy reef. Black, white and navy.
//
// - The reef is a drifting noise field drawn with marching squares (TerrainField.js).
// - The fish flock (boids) and bounce off the reef edge (Boid.js).
// - Each fish is a thin inverse-kinematics spine that flows with a noise field (Fish.js).
// - Fish give off bubbles that float up and fade (Vapor.js).
// - Sunbeams are raycast from above and stop at the reef (SunBeams.js, Raycasting.js).
//   They are drawn between the water and the reef, so they never show inside it.
//
// Every scene is drawn in a fixed 1920x1080 space. The driver scales it for 1080p/4K export.
class FlockingMarchingScene {
  constructor() {
    this.seed = 20240607;
    this.params = { separation: 2.4, alignment: 1.0, cohesion: 0.6, avoidance: 3.0 };
    this.vignette = this.makeVignette();
    this.reset();
  }

  // Start over from the beginning. Seeded so every run (and every export) is identical.
  reset() {
    randomSeed(this.seed);
    noiseSeed(this.seed);
    this.time = 0;     // seconds
    this.zOffset = 0;  // how far through the noise the reef has drifted

    this.field = new TerrainField(1920, 1080, 15, this.seed, 0.3);
    this.field.update(this.zOffset);

    this.school = [];
    for (let i = 0; i < 200; i += 1) {
      this.addFish(random(1920), random(1080));
    }
    this.vapors = [];

    this.sunBeams = new SunBeams(1920);
  }

  // Add a fish at (x, y), or somewhere open if (x, y) is inside the reef.
  addFish(x, y) {
    for (let tries = 0; tries < 200; tries += 1) {
      if (this.field.sample(x, y) < this.field.threshold - 0.1) {
        this.school.push(new Fish(x, y));
        return;
      }
      x = random(1920);
      y = random(1080);
    }
  }

  // One simulation tick (the driver runs 60 of these per second).
  update() {
    this.time += 1 / 60;
    this.zOffset += 0.0035;

    this.field.update(this.zOffset);
    for (let fish of this.school) {
      fish.run(this.school, this.field, this.params, this.time);
      // Now and then a fish lets out a bubble
      if (random() < 0.01) {
        this.vapors.push(new Vapor(fish.position.x, fish.position.y));
      }
    }
    // Update every bubble, and remove the ones that have faded out
    for (let i = this.vapors.length - 1; i >= 0; i -= 1) {
      this.vapors[i].update();
      if (this.vapors[i].dead) {
        this.vapors.splice(i, 1);
      }
    }
    this.sunBeams.update(this.time, this.field.reefEdges);
  }

  // g is a p5.Graphics already scaled to the 1920x1080 space.
  // Drawing order is back to front.
  draw(g) {
    g.colorMode(RGB, 255);
    this.field.drawWater(g);   // ocean
    this.sunBeams.display(g);  // light shines on the water...
    this.field.drawReef(g);    // ...and the reef sits in front of it, so light never shows inside it

    for (let fish of this.school) {
      fish.display(g);
    }
    for (let vapor of this.vapors) {
      vapor.display(g);
    }
    g.image(this.vignette, 0, 0, 1920, 1080);
  }

  // Click/drag on the preview TV adds fish (driver passes scene coordinates).
  onPointer(x, y) {
    this.addFish(x, y);
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
        img.pixels[p + 2] = 6;
        img.pixels[p + 3] = constrain(map(d, 0.5, 1.1, 0, 110), 0, 110);
      }
    }
    img.updatePixels();
    return img;
  }
}

SCENES.push({
  name: 'Fish in the Reef',
  create: () => new FlockingMarchingScene(),
  controls: [
    { key: 'separation', label: 'Separation', min: 0, max: 3, step: 0.1 },
    { key: 'alignment', label: 'Alignment', min: 0, max: 3, step: 0.1 },
    { key: 'cohesion', label: 'Cohesion', min: 0, max: 3, step: 0.1 },
    { key: 'avoidance', label: 'Reef avoidance', min: 0, max: 5, step: 0.1 },
  ],
});
