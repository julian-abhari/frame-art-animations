// SunBeams: shafts of sunlight slanting down through the water.
// Built from the raycasting classes: LightSources sit above the screen, fire rays downward,
// and each beam is a polygon from the light to wherever its rays hit the reef.
class SunBeams {
  constructor(sceneWidth) {
    this.lights = [];
    let count = 6;
    for (let i = 0; i < count; i += 1) {
      // Spread the lights across (and past) the top of the screen. They lean right,
      // so the first ones start left of the screen.
      let x = map(i, 0, count - 1, -350, sceneWidth + 350);
      this.lights.push(new LightSource(x, -160, 5, 10));
    }
    // Each beam is drawn in layers that reach different distances, so it fades with depth.
    this.layerReach = [450, 750, 1050, 1350, 1800];
  }

  // Aim the lights and cast their rays against the reef walls (a list of Boundary).
  update(time, walls) {
    for (let light of this.lights) {
      light.aim(time);
      light.look(walls);
    }
  }

  display(g) {
    g.blendMode(ADD); // light adds up where beams overlap
    g.noStroke();
    for (let light of this.lights) {
      for (let shaft of light.shafts) {
        g.fill(255, 255, 255, 7 * shaft.brightness);
        for (let reach of this.layerReach) {
          g.beginShape();
          g.vertex(light.position.x, light.position.y);
          for (let h of shaft.hits) {
            // Stop at the reef, or at this layer's reach, whichever comes first
            let d = min(h.distance, reach);
            g.vertex(light.position.x + h.ray.direction.x * d, light.position.y + h.ray.direction.y * d);
          }
          g.endShape(CLOSE);
        }
      }
    }
    g.blendMode(BLEND);
  }
}
