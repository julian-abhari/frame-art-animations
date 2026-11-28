// TerrainField: the coral reef.
//
// An animated noise field, drawn with marching squares. Field values above `threshold`
// are solid coral that the fish can't enter. The edge of the coral is the contour line
// where the field equals the threshold. Marching squares finds that line, and we use
// the line segments three ways: to draw the coral edge, to block the fish, and as the
// walls that stop the sunbeams (see Raycasting.js).
class TerrainField {
  constructor(w, h, resolution, seed, threshold) {
    this.w = w;
    this.h = h;
    this.resolution = resolution; // size of one marching-squares cell in pixels
    this.columns = ceil(w / resolution) + 1;
    this.rows = ceil(h / resolution) + 1;
    this.threshold = threshold;

    // One value per grid corner, stored in a flat array: index = j * columns + i
    this.values = new Array(this.columns * this.rows).fill(0);
    this.noiseBig = new OpenSimplexNoise(seed);
    this.noiseSmall = new OpenSimplexNoise(seed + 1013);

    this.reefEdges = []; // Boundary segments along the coral edge, rebuilt every update

    // The water and coral colors are painted into a small image, then stretched to full size.
    this.imageScale = 10; // 1 image pixel = 10x10 scene pixels (keeps painting fast)
    this.terrainImage = createImage(ceil(w / this.imageScale), ceil(h / this.imageScale));
  }

  // Recompute every grid corner for time `zOffset` (this is what makes the reef drift).
  update(zOffset) {
    for (let j = 0; j < this.rows; j += 1) {
      for (let i = 0; i < this.columns; i += 1) {
        let x = i * this.resolution;
        let y = j * this.resolution;
        let big = this.noiseBig.noise3D(x * 0.0019, y * 0.0019, zOffset);
        let small = this.noiseSmall.noise3D(x * 0.0046, y * 0.0046, zOffset * 1.4);
        // Push the field up near the bottom of the screen so the reef rises from a sea floor.
        let seaFloor = pow(constrain(map(y, this.h * 0.68, this.h, 0, 1), 0, 1), 1.5) * 1.1;
        this.values[j * this.columns + i] = big * 0.72 + small * 0.28 + seaFloor;
      }
    }
    this.reefEdges = this.contourSegments(this.threshold);
  }

  // Field value at any pixel position (bilinear blend of the 4 surrounding corners).
  sample(x, y) {
    let fx = constrain(x / this.resolution, 0, this.columns - 1.001);
    let fy = constrain(y / this.resolution, 0, this.rows - 1.001);
    let i = floor(fx);
    let j = floor(fy);
    let k = j * this.columns + i;
    let top = lerp(this.values[k], this.values[k + 1], fx - i);
    let bottom = lerp(this.values[k + this.columns], this.values[k + this.columns + 1], fx - i);
    return lerp(top, bottom, fy - j);
  }

  // Direction the field increases fastest (i.e. pointing into the coral).
  gradient(x, y) {
    let e = this.resolution * 0.5;
    return createVector(
      this.sample(x + e, y) - this.sample(x - e, y),
      this.sample(x, y + e) - this.sample(x, y - e)
    );
  }

  // ---- Marching squares ----

  // Look at each cell's 4 corners, pick the matching line pattern, and collect the
  // line segments (as Boundary objects) for one iso-level.
  contourSegments(level) {
    let segments = [];
    for (let i = 0; i < this.columns - 1; i += 1) {
      for (let j = 0; j < this.rows - 1; j += 1) {
        let k = j * this.columns + i;
        let tl = this.values[k];
        let tr = this.values[k + 1];
        let bl = this.values[k + this.columns];
        let br = this.values[k + this.columns + 1];
        let state = getState(tl > level, tr > level, br > level, bl > level);
        if (state === 0 || state === 15) continue; // cell is all water or all coral

        // a = top edge, b = right edge, c = bottom edge, d = left edge.
        // The point on each edge slides to where the field actually crosses `level`.
        let x = i * this.resolution;
        let y = j * this.resolution;
        let r = this.resolution;
        let a = createVector(x + r * inverseLerp(tl, tr, level), y);
        let b = createVector(x + r, y + r * inverseLerp(tr, br, level));
        let c = createVector(x + r * inverseLerp(bl, br, level), y + r);
        let d = createVector(x, y + r * inverseLerp(tl, bl, level));
        for (let pair of linesForState(state, a, b, c, d)) {
          segments.push(new Boundary(pair[0].x, pair[0].y, pair[1].x, pair[1].y));
        }
      }
    }
    return segments;
  }

  // ---- Drawing (g is in RGB color mode) ----

  draw(g) {
    this.paintTerrain();
    g.image(this.terrainImage, 0, 0, this.w, this.h);
    this.drawCoralEdge(g);
  }

  // Fill the small image: water that gets darker with depth, and coral that is
  // bright pink-orange at its edge and fades to deep purple inside.
  paintTerrain() {
    let img = this.terrainImage;
    let T = this.threshold;
    img.loadPixels();
    for (let py = 0; py < img.height; py += 1) {
      let depth = py / img.height; // 0 at the surface, 1 at the bottom
      for (let px = 0; px < img.width; px += 1) {
        let f = this.sample((px + 0.5) * this.imageScale, (py + 0.5) * this.imageScale);
        let r, g, b;
        if (f > T) {
          // Coral: blend through three colors as we go deeper into the rock
          let t = constrain(map(f, T, T + 0.6, 0, 1), 0, 1);
          if (t < 0.25) {
            let u = t / 0.25;
            r = lerp(236, 170, u); g = lerp(104, 60, u); b = lerp(98, 110, u);
          } else {
            let u = (t - 0.25) / 0.75;
            r = lerp(170, 40, u); g = lerp(60, 18, u); b = lerp(110, 62, u);
          }
        } else {
          // Water: bright turquoise at the top, deep blue at the bottom,
          // with a faint glow near the coral
          let glow = exp(-(T - f) * 6) * 22;
          r = lerp(34, 3, pow(depth, 0.7)) + glow * 0.4;
          g = lerp(138, 24, pow(depth, 0.7)) + glow * 0.5;
          b = lerp(176, 58, pow(depth, 0.7)) + glow * 0.6;
        }
        let p = 4 * (py * img.width + px);
        img.pixels[p] = r;
        img.pixels[p + 1] = g;
        img.pixels[p + 2] = b;
        img.pixels[p + 3] = 255;
      }
    }
    img.updatePixels();
  }

  // A bright rim along the edge, with little coral fingers and polyps growing outward.
  drawCoralEdge(g) {
    let polypColors = [[255, 140, 120], [255, 185, 110], [240, 110, 170], [255, 225, 175]];

    g.strokeCap(ROUND);
    g.strokeWeight(3);
    g.stroke(255, 170, 140, 210);
    for (let edge of this.reefEdges) {
      g.line(edge.pointA.x, edge.pointA.y, edge.pointB.x, edge.pointB.y);
    }

    for (let edge of this.reefEdges) {
      let mid = p5.Vector.lerp(edge.pointA, edge.pointB, 0.5);
      // The gradient points into the coral, so growth goes the opposite way
      let outward = this.gradient(mid.x, mid.y).mult(-1);
      if (outward.mag() < 1e-7) continue;
      outward.normalize();

      // Low-frequency noise gives each patch of coral its own color and finger length
      let n = noise(mid.x * 0.02, mid.y * 0.02);
      let fingerLength = map(n, 0, 1, 3, 17);
      let tip = p5.Vector.add(mid, p5.Vector.mult(outward, fingerLength));
      let c = polypColors[floor(n * 3.99)];

      g.stroke(c[0], c[1], c[2], 190);
      g.strokeWeight(2);
      g.line(mid.x, mid.y, tip.x, tip.y);
      g.noStroke();
      g.fill(c[0], c[1], c[2]);
      g.ellipse(tip.x, tip.y, map(n, 0, 1, 3, 7));
    }
  }
}

// Where between two values `level` falls (0 to 1). Used to smooth the contour lines.
function inverseLerp(v0, v1, level) {
  return (level - v0) / (v1 - v0);
}

// Turn the 4 corners (true/false) into a number 0-15.
function getState(a, b, c, d) {
  return a * 8 + b * 4 + c * 2 + d * 1;
}

// Which lines does a cell with this state contain? Returns a list of [point, point] pairs.
function linesForState(state, a, b, c, d) {
  switch (state) {
    case 1: case 14:
      return [[c, d]];
    case 2: case 13:
      return [[b, c]];
    case 3: case 12:
      return [[b, d]];
    case 4: case 11:
      return [[a, b]];
    case 5:
      return [[b, c], [a, d]];
    case 6: case 9:
      return [[a, c]];
    case 7: case 8:
      return [[a, d]];
    case 10:
      return [[a, b], [c, d]];
    default:
      return [];
  }
}
