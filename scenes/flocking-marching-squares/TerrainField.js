// TerrainField: the reef.
//
// The original marching-squares sketch: a grid of animated noise values. Every cell is
// shaded by its value, and marching squares draws a line where the field crosses the
// threshold. Values above `threshold` are solid reef that the fish can't enter. The
// contour line is used three ways: it is drawn as the reef edge, it blocks the fish,
// and it makes the walls that stop the sunbeams (see Raycasting.js).
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
    this.noise = new OpenSimplexNoise(seed);

    this.reefEdges = []; // Boundary segments along the reef edge, rebuilt every update

    // One image pixel per cell, stretched up (without smoothing) so cells stay blocky.
    this.imageScale = resolution;
    this.terrainImage = createImage(ceil(w / this.imageScale), ceil(h / this.imageScale));
  }

  // Recompute every grid corner for time `zOffset` (this is what makes the reef drift).
  update(zOffset) {
    for (let j = 0; j < this.rows; j += 1) {
      for (let i = 0; i < this.columns; i += 1) {
        this.values[j * this.columns + i] = this.noise.noise3D(i * this.resolution * 0.0032, j * this.resolution * 0.0042, zOffset);
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

        // a = middle of the top edge, b = right edge, c = bottom edge, d = left edge
        let x = i * this.resolution;
        let y = j * this.resolution;
        let r = this.resolution;
        let a = createVector(x + r * 0.5, y);
        let b = createVector(x + r, y + r * 0.5);
        let c = createVector(x + r * 0.5, y + r);
        let d = createVector(x, y + r * 0.5);
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
    g.noSmooth(); // keep the blocky cells crisp when the small image is stretched
    g.image(this.terrainImage, 0, 0, this.w, this.h);
    g.smooth();

    // The reef edge: thick white contour lines
    g.strokeCap(ROUND);
    g.strokeWeight(4);
    g.stroke(255, 235);
    for (let edge of this.reefEdges) {
      g.line(edge.pointA.x, edge.pointA.y, edge.pointB.x, edge.pointB.y);
    }
  }

  // Shade every cell by its field value. Water is deep navy; reef is near black.
  // Both get darker toward the bottom of the screen.
  paintTerrain() {
    let img = this.terrainImage;
    let T = this.threshold;
    img.loadPixels();
    for (let py = 0; py < img.height; py += 1) {
      let depthShade = lerp(1, 0.45, py / img.height); // 1 at the surface, 0.45 at the bottom
      for (let px = 0; px < img.width; px += 1) {
        let f = this.sample((px + 0.5) * this.imageScale, (py + 0.5) * this.imageScale);
        let t = constrain(map(f, -0.9, 0.9, 0, 1), 0, 1);
        let r, g, b;
        if (f > T) {
          r = lerp(2, 9, t); g = lerp(6, 18, t); b = lerp(18, 44, t);
        } else {
          r = lerp(8, 22, t); g = lerp(24, 56, t); b = lerp(60, 120, t);
        }
        let p = 4 * (py * img.width + px);
        img.pixels[p] = r * depthShade;
        img.pixels[p + 1] = g * depthShade;
        img.pixels[p + 2] = b * depthShade;
        img.pixels[p + 3] = 255;
      }
    }
    img.updatePixels();
  }
}

// // Turn the 4 corners (true/false) into a number 0-15.
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
