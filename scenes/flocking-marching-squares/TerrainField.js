// TerrainField: an animated noise field drawn with marching squares.
// Field values above `threshold` are "solid" walls that the boids can't enter.
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

    // The smooth colored terrain is painted into a small image, then stretched to full size.
    this.imageScale = 10; // 1 image pixel = 10x10 scene pixels (keeps painting fast)
    this.terrainImage = createImage(ceil(w / this.imageScale), ceil(h / this.imageScale));
  }

  // Recompute every grid corner for time `zOffset` (this is what makes the walls drift).
  update(zOffset) {
    for (let j = 0; j < this.rows; j += 1) {
      for (let i = 0; i < this.columns; i += 1) {
        let x = i * this.resolution;
        let y = j * this.resolution;
        let big = this.noiseBig.noise3D(x * 0.0019, y * 0.0019, zOffset);
        let small = this.noiseSmall.noise3D(x * 0.0046, y * 0.0046, zOffset * 1.4);
        this.values[j * this.columns + i] = big * 0.72 + small * 0.28;
      }
    }
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

  // Direction the field increases fastest (i.e. pointing into a wall).
  gradient(x, y) {
    let e = this.resolution * 0.5;
    return createVector(
      this.sample(x + e, y) - this.sample(x - e, y),
      this.sample(x, y + e) - this.sample(x, y - e)
    );
  }

  // ---- Drawing ----

  draw(g) {
    this.paintTerrain();
    g.image(this.terrainImage, 0, 0, this.w, this.h);

    g.noFill();
    g.strokeCap(ROUND);
    let T = this.threshold;

    // Faint topographic rings around the walls
    g.strokeWeight(1.5);
    g.stroke(120, 150, 255, 26);
    this.drawContour(g, T - 0.16);
    this.drawContour(g, T - 0.32);
    g.stroke(255, 170, 120, 30);
    this.drawContour(g, T + 0.18);
    this.drawContour(g, T + 0.36);

    // The wall edge: wide soft glow, medium glow, bright core
    g.strokeWeight(14);
    g.stroke(255, 150, 70, 40);
    this.drawContour(g, T);
    g.strokeWeight(6);
    g.stroke(255, 190, 110, 76);
    this.drawContour(g, T);
    g.strokeWeight(2.2);
    g.stroke(255, 236, 190, 240);
    this.drawContour(g, T);
  }

  // Fill the small image: dark glowing "air" below the threshold, purple "rock" above it.
  paintTerrain() {
    let img = this.terrainImage;
    let T = this.threshold;
    img.loadPixels();
    for (let py = 0; py < img.height; py += 1) {
      for (let px = 0; px < img.width; px += 1) {
        let f = this.sample((px + 0.5) * this.imageScale, (py + 0.5) * this.imageScale);
        let r, g, b;
        if (f > T) {
          let t = constrain(map(f, T, T + 0.55, 0, 1), 0, 1);
          r = lerp(46, 166, t);
          g = lerp(18, 44, t);
          b = lerp(96, 136, t);
        } else {
          let depth = constrain(T - f, 0, 1);
          let glow = exp(-(T - f) * 7) * 38;
          r = 12 - depth * 5 + glow * 0.9;
          g = 18 - depth * 6 + glow * 0.35;
          b = 46 - depth * 16 + glow * 0.8;
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

  // Marching squares for one iso-level: look at each cell's 4 corners, pick the
  // matching line pattern, and draw it with the end points slid along each edge.
  drawContour(g, level) {
    for (let i = 0; i < this.columns - 1; i += 1) {
      for (let j = 0; j < this.rows - 1; j += 1) {
        let k = j * this.columns + i;
        let tl = this.values[k];
        let tr = this.values[k + 1];
        let bl = this.values[k + this.columns];
        let br = this.values[k + this.columns + 1];
        let state = getState(tl > level, tr > level, br > level, bl > level);
        if (state === 0 || state === 15) continue;

        // a = top edge, b = right edge, c = bottom edge, d = left edge
        let x = i * this.resolution;
        let y = j * this.resolution;
        let r = this.resolution;
        let a = createVector(x + r * inverseLerp(tl, tr, level), y);
        let b = createVector(x + r, y + r * inverseLerp(tr, br, level));
        let c = createVector(x + r * inverseLerp(bl, br, level), y + r);
        let d = createVector(x, y + r * inverseLerp(tl, bl, level));
        drawState(g, state, a, b, c, d);
      }
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

function drawState(g, state, a, b, c, d) {
  switch (state) {
    case 1: case 14:
      quickLine(g, c, d);
      break;
    case 2: case 13:
      quickLine(g, b, c);
      break;
    case 3: case 12:
      quickLine(g, b, d);
      break;
    case 4: case 11:
      quickLine(g, a, b);
      break;
    case 5:
      quickLine(g, b, c);
      quickLine(g, a, d);
      break;
    case 6: case 9:
      quickLine(g, a, c);
      break;
    case 7: case 8:
      quickLine(g, a, d);
      break;
    case 10:
      quickLine(g, a, b);
      quickLine(g, c, d);
      break;
  }
}

function quickLine(g, a, b) {
  g.line(a.x, a.y, b.x, b.y);
}
