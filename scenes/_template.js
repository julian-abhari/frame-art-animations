// Template for a new scene. Copy to scenes/<name>/scene.js and add a <script> tag to index.html.
// Scenes work in a fixed 1920x1080 logical space; the driver scales it for 1080p/4K export.
(function () {
  const W = 1920, H = 1080;

  class MyScene {
    constructor() {
      this.params = {};   // anything listed in `controls` below becomes a slider
      this.reset();
    }
    reset() { this.t = 0; }            // must be deterministic (use a seeded RNG) so exports are repeatable
    update() { this.t += 1 / 60; }     // one tick = 1/60 s
    draw(g) { g.background(0); }       // g is a p5.Graphics (use g.drawingContext for raw canvas)
    onPointer(x, y) {}                 // optional: mouse in logical coords
  }

  SCENES.push({ name: 'My Scene', create: () => new MyScene(), controls: [] });
})();
