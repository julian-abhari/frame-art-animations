// Scene 1: an underwater coral reef.
//
// - A school of fish flocks (boids) through the reef and bounces off the coral.
// - The reef is a drifting noise field drawn with marching squares (TerrainField.js).
// - Each fish has an inverse-kinematics spine so its body bends as it swims (Fish.js).
// - Kelp is an inverse-kinematics chain rooted on the reef, swaying in the current (Kelp.js).
// - Sunbeams are raycast from above and stop at the coral (SunBeams.js, Raycasting.js).
//
// Every scene is drawn in a fixed 1920x1080 space. The driver scales it for 1080p/4K export.
class FlockingMarchingScene {
  constructor() {
    this.seed = 20240607;
    this.params = { separation: 1.8, alignment: 1.0, cohesion: 1.0, avoidance: 2.5 };
    this.vignette = this.makeVignette();
    this.reset();
  }

  // Start over from the beginning. Seeded so every run (and every export) is identical.
  reset() {
    randomSeed(this.seed);
    noiseSeed(this.seed);
    this.time = 0;     // seconds
    this.zOffset = 0;  // how far through the noise the reef has drifted

    this.field = new TerrainField(1920, 1080, 20, this.seed, 0.2);
    this.field.update(this.zOffset);

    this.kelp = [];
    for (let i = 0; i < 26; i += 1) {
      let x = (i + 0.5) * (1920 / 26) + random(-25, 25);
      this.kelp.push(new Kelp(x, random(130, 270)));
    }

    // Five schools, one per species. Each starts clustered around its own spot.
    this.school = [];
    for (let s = 0; s < SPECIES.length; s += 1) {
      let centerX = random(200, 1720);
      let centerY = random(150, 650);
      for (let i = 0; i < 28; i += 1) {
        this.addFish(centerX + random(-120, 120), centerY + random(-120, 120), s);
      }
    }

    this.bubbles = [];
    for (let i = 0; i < 40; i += 1) {
      this.bubbles.push(new Bubble(1920, 1080));
    }

    this.sunBeams = new SunBeams(1920);
  }

  // Add a fish at (x, y), or somewhere open if (x, y) is inside the coral.
  addFish(x, y, speciesIndex) {
    for (let tries = 0; tries < 200; tries += 1) {
      if (this.field.sample(x, y) < this.field.threshold - 0.1) {
        this.school.push(new Fish(x, y, speciesIndex));
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
    for (let strand of this.kelp) {
      strand.update(this.field, this.time);
    }
    for (let fish of this.school) {
      fish.run(this.school, this.field, this.params);
    }
    for (let bubble of this.bubbles) {
      bubble.update();
    }
    this.sunBeams.update(this.time, this.field.reefEdges);
  }

  // g is a p5.Graphics already scaled to the 1920x1080 space.
  // Drawing order is back to front.
  draw(g) {
    g.colorMode(RGB, 255);
    this.field.draw(g); // water, coral and its edge

    g.colorMode(HSB, 360, 100, 100, 1);
    for (let strand of this.kelp) {
      strand.display(g);
    }
    for (let fish of this.school) {
      fish.display(g);
    }

    g.colorMode(RGB, 255);
    this.sunBeams.display(g);
    for (let bubble of this.bubbles) {
      bubble.display(g);
    }
    g.image(this.vignette, 0, 0, 1920, 1080);
  }

  // Click/drag on the preview TV adds fish (driver passes scene coordinates).
  onPointer(x, y) {
    this.addFish(x, y, floor(random(SPECIES.length)));
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
        img.pixels[p + 1] = 8;
        img.pixels[p + 2] = 20;
        img.pixels[p + 3] = constrain(map(d, 0.5, 1.1, 0, 130), 0, 130);
      }
    }
    img.updatePixels();
    return img;
  }
}

SCENES.push({
  name: 'Coral Reef',
  create: () => new FlockingMarchingScene(),
  controls: [
    { key: 'separation', label: 'Separation', min: 0, max: 3, step: 0.1 },
    { key: 'alignment', label: 'Alignment', min: 0, max: 3, step: 0.1 },
    { key: 'cohesion', label: 'Cohesion', min: 0, max: 3, step: 0.1 },
    { key: 'avoidance', label: 'Reef avoidance', min: 0, max: 5, step: 0.1 },
  ],
});
