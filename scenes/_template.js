// Template for a new scene. Copy to scenes/<name>/scene.js and add a <script> tag to index.html.
// Scenes are drawn in a fixed 1920x1080 space; the driver scales it for 1080p/4K export.
class MyScene {
  constructor() {
    this.params = {}; // anything listed in `controls` below becomes a slider
    this.reset();
  }

  // Start over. Use randomSeed()/noiseSeed() here so exports are repeatable.
  reset() {
    randomSeed(1);
    this.t = 0;
  }

  // One simulation tick = 1/60 s. Don't draw here.
  update() {
    this.t += 1 / 60;
  }

  // g is a p5.Graphics: call g.background(), g.ellipse(), g.fill(), etc.
  draw(g) {
    g.background(0);
  }

  // Optional: mouse click/drag on the preview TV, in 1920x1080 coordinates.
  onPointer(x, y) {}
}

SCENES.push({ name: 'My Scene', create: () => new MyScene(), controls: [] });
