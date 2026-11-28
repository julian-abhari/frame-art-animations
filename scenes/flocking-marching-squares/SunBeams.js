// SunBeams: shafts of sunlight slanting down through the water.
//
// Light only comes down through a few random bands that add up to 40% of the screen width.
// Each band is tiled with beams (Raycasting.js). Every beam is one polygon running from the
// top of the screen to wherever its rays hit the reef, filled with a smooth fade.
class SunBeams {
  constructor(sceneWidth) {
    let coverage = 0.4;  // fraction of the width that gets light
    let bandCount = 3;
    this.beams = [];

    // Split the lit width into random band widths, and the dark width into random gaps.
    let bandWidths = randomShares(bandCount).map((share) => share * sceneWidth * coverage);
    let gaps = randomShares(bandCount + 1).map((share) => share * sceneWidth * (1 - coverage));

    let x = gaps[0];
    for (let b = 0; b < bandCount; b += 1) {
      let bandEnd = x + bandWidths[b];
      // Tile the band with beams of random width
      while (x < bandEnd - 0.5) {
        let beamWidth = min(random(25, 70), bandEnd - x);
        if (bandEnd - x - beamWidth < 15) beamWidth = bandEnd - x; // don't leave a sliver
        this.beams.push(new LightBeam(x, beamWidth, ceil(beamWidth / 10) + 1));
        x += beamWidth;
      }
      x = bandEnd + gaps[b + 1];
    }
  }

  // Aim all the beams and cast their rays against the reef walls (a list of Boundary).
  update(time, walls) {
    // The sun leans a little and drifts slowly
    let angle = HALF_PI + 0.16 + (noise(time * 0.1) - 0.5) * 0.1;
    for (let beam of this.beams) {
      beam.aim(angle);
      beam.look(walls);
      beam.brightness = map(noise(beam.flicker, time * 0.4), 0, 1, 0.45, 1);
    }
  }

  display(g) {
    let ctx = g.drawingContext;
    g.blendMode(ADD); // light adds up where beams overlap
    g.noStroke();
    for (let beam of this.beams) {
      // One smooth fade from the top of the screen to the bottom (a single gradient fill,
      // so the beam has no visible steps along its length).
      let fade = ctx.createLinearGradient(0, 0, 0, 1080);
      fade.addColorStop(0, `rgba(255, 255, 255, ${0.2 * beam.brightness})`);
      fade.addColorStop(1, `rgba(255, 255, 255, ${0.07 * beam.brightness})`);
      g.fill(255);           // (turns filling on)
      ctx.fillStyle = fade;  // ...and swap the plain color for the gradient

      // Outline of the beam: along the top edge, then back up along where the rays ended
      g.beginShape();
      for (let ray of beam.rays) {
        g.vertex(ray.position.x, ray.position.y);
      }
      for (let i = beam.hits.length - 1; i >= 0; i -= 1) {
        g.vertex(beam.hits[i].x, beam.hits[i].y);
      }
      g.endShape(CLOSE);
    }
    g.blendMode(BLEND);
  }
}

// n random numbers that add up to 1, each between roughly 0.3/n and 1/n * 2.
function randomShares(n) {
  let shares = [];
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    shares.push(random(0.4, 1));
    total += shares[i];
  }
  return shares.map((share) => share / total);
}
