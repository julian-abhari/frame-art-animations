// TerrainField: the reef.
//
// The original marching-squares sketch: a grid of noise values. Every cell is
// shaded by its value, and marching squares draws a line where the field crosses the
// threshold. Values above `threshold` are solid reef that the fish can't enter. The
// contour line and the solid shape it encloses are used three ways: they are drawn as the
// reef, they block the fish (isSolid), and they make the walls that stop the sunbeams
// (see Raycasting.js). All three use exactly the same shapes, so they always agree.
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
    this.needsPainting = true; // the small images are repainted only when the field changes

    // One image pixel per cell, stretched up (without smoothing) so cells stay blocky.
    // Water and reef are separate images so the sunbeams can be drawn in between:
    // the reef is opaque, so light can never show up inside it.
    this.imageScale = resolution;
    this.waterImage = createImage(ceil(w / this.imageScale), ceil(h / this.imageScale));
    this.reefImage = createImage(ceil(w / this.imageScale), ceil(h / this.imageScale));
  }

  // Fill the grid from one slice of the noise. `zOffset` picks the slice (the third noise
  // coordinate), so each number gives a different reef. The scene calls this once, so the reef
  // never moves.
  update(zOffset) {
    for (let j = 0; j < this.rows; j += 1) {
      for (let i = 0; i < this.columns; i += 1) {
        this.values[j * this.columns + i] = this.noise.noise3D(i * this.resolution * 0.0032, j * this.resolution * 0.0042, zOffset);
      }
    }
    this.reefEdges = this.contourSegments(this.threshold);
    this.needsPainting = true;
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

  // Is the point (x, y) inside the reef? This uses the exact shape that gets drawn: the
  // cell's corners pick a marching-squares case, and solidInCell() says which part of the
  // cell is reef.
  isSolid(x, y) {
    let i = constrain(floor(x / this.resolution), 0, this.columns - 2);
    let j = constrain(floor(y / this.resolution), 0, this.rows - 2);
    let k = j * this.columns + i;
    let T = this.threshold;
    let state = getState(this.values[k] > T, this.values[k + 1] > T,
                         this.values[k + this.columns + 1] > T, this.values[k + this.columns] > T);
    // Where we are inside the cell, from 0 to 1 (u goes right, v goes down)
    let u = constrain(x / this.resolution - i, 0, 1);
    let v = constrain(y / this.resolution - j, 0, 1);
    return solidInCell(state, u, v);
  }

  // Is anything within `clearance` pixels of (x, y) inside the reef? (Checks four points around it.)
  blocked(x, y, clearance = 6) {
    return this.isSolid(x, y) ||
           this.isSolid(x + clearance, y) || this.isSolid(x - clearance, y) ||
           this.isSolid(x, y + clearance) || this.isSolid(x, y - clearance);
  }

  // The closest spot to (x, y) that is clear of the reef, found by searching in widening
  // circles. Returns a p5.Vector, or null if there's nothing open nearby.
  nearestOpenPoint(x, y) {
    for (let radius = 4; radius <= 400; radius += 4) {
      for (let k = 0; k < 16; k += 1) {
        let angle = (TWO_PI * k) / 16 + radius * 0.1; // twist each ring so we don't favor one direction
        let px = x + cos(angle) * radius;
        let py = y + sin(angle) * radius;
        if (px >= 0 && px <= this.w && py >= 0 && py <= this.h && !this.blocked(px, py)) {
          return createVector(px, py);
        }
      }
    }
    return null;
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
  // The scene calls these in order: drawWater, (sunbeams), drawReef.

  drawWater(g) {
    if (this.needsPainting) {
      this.paintImages();
      this.needsPainting = false;
    }
    g.noSmooth(); // keep the blocky cells crisp when the small image is stretched
    g.image(this.waterImage, 0, 0, this.w, this.h);
    g.smooth();
  }

  // The reef is drawn in two parts that join up exactly:
  //  - cells that are completely reef come from a small image (blocky, like the original)
  //  - cells the edge passes through are filled with polygons built from the SAME points
  //    as the white edge line, so the fill and the line are always the same shape.
  drawReef(g) {
    g.noSmooth();
    g.image(this.reefImage, 0, 0, this.w, this.h);
    g.smooth();

    let T = this.threshold;
    let r = this.resolution;
    g.strokeJoin(ROUND);
    g.strokeWeight(1); // a hairline in the fill color hides seams between neighboring polygons
    for (let i = 0; i < this.columns - 1; i += 1) {
      for (let j = 0; j < this.rows - 1; j += 1) {
        let k = j * this.columns + i;
        let tl = this.values[k];
        let tr = this.values[k + 1];
        let bl = this.values[k + this.columns];
        let br = this.values[k + this.columns + 1];
        let state = getState(tl > T, tr > T, br > T, bl > T);
        if (state === 0 || state === 15) continue;

        // Cell corners and edge midpoints (a = top, b = right, c = bottom, d = left)
        let x = i * r;
        let y = j * r;
        let corners = { tl: [x, y], tr: [x + r, y], br: [x + r, y + r], bl: [x, y + r] };
        let mids = { a: [x + r / 2, y], b: [x + r, y + r / 2], c: [x + r / 2, y + r], d: [x, y + r / 2] };

        let shade = this.reefShade((tl + tr + bl + br) / 4);
        g.fill(shade[0], shade[1], shade[2]);
        g.stroke(shade[0], shade[1], shade[2]);
        g.beginShape();
        for (let p of solidPolygon(state, corners, mids)) {
          g.vertex(p[0], p[1]);
        }
        g.endShape(CLOSE);
      }
    }

    // The reef edge: thick white contour lines
    g.strokeCap(ROUND);
    g.strokeWeight(4);
    g.stroke(255, 235);
    for (let edge of this.reefEdges) {
      g.line(edge.pointA.x, edge.pointA.y, edge.pointB.x, edge.pointB.y);
    }
  }

  // Reef color for a field value: near-black navy, a touch lighter where the field is higher.
  reefShade(f) {
    let t = constrain(map(f, -0.9, 0.9, 0, 1), 0, 1);
    return [lerp(2, 9, t), lerp(6, 18, t), lerp(18, 44, t)];
  }

  // Shade every cell by its field value. Water is navy-blue and gets brighter or deeper with
  // the noise, and a little darker toward the bottom of the screen. The reef image is only
  // opaque for cells that are completely reef (edge cells are drawn as polygons instead).
  paintImages() {
    let water = this.waterImage;
    let reef = this.reefImage;
    let T = this.threshold;
    water.loadPixels();
    reef.loadPixels();
    for (let py = 0; py < water.height; py += 1) {
      let depthShade = lerp(1, 0.6, py / water.height); // 1 at the surface, 0.6 at the bottom
      for (let px = 0; px < water.width; px += 1) {
        let k = py * this.columns + px;
        let corners = [this.values[k], this.values[k + 1], this.values[k + this.columns], this.values[k + this.columns + 1]];
        let f = (corners[0] + corners[1] + corners[2] + corners[3]) / 4;
        let t = constrain(map(f, -0.9, 0.9, 0, 1), 0, 1);
        let p = 4 * (py * water.width + px);

        // The water image is filled everywhere (so there are never gaps behind the reef edge)
        water.pixels[p] = lerp(14, 44, t) * depthShade;
        water.pixels[p + 1] = lerp(56, 126, t) * depthShade;
        water.pixels[p + 2] = lerp(120, 200, t) * depthShade;
        water.pixels[p + 3] = 255;

        let shade = this.reefShade(f);
        reef.pixels[p] = shade[0];
        reef.pixels[p + 1] = shade[1];
        reef.pixels[p + 2] = shade[2];
        reef.pixels[p + 3] = corners.every((c) => c > T) ? 255 : 0;
      }
    }
    water.updatePixels();
    reef.updatePixels();
  }
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

// Is the spot (u, v) inside a cell (each from 0 to 1, v going down) part of the reef?
// `state` says which corners are reef. The edge line cuts the cell at the midpoints of its
// sides, so each case is either a half of the cell or a triangle around a corner.
function solidInCell(state, u, v) {
  // True when the spot is within the triangle that cuts off each corner
  let nearTL = u + v < 0.5;
  let nearTR = 1 - u + v < 0.5;
  let nearBR = 1 - u + 1 - v < 0.5;
  let nearBL = u + 1 - v < 0.5;
  switch (state) {
    case 0: return false;
    case 15: return true;
    case 8: return nearTL;
    case 4: return nearTR;
    case 2: return nearBR;
    case 1: return nearBL;
    case 12: return v < 0.5;   // top half
    case 3: return v >= 0.5;   // bottom half
    case 6: return u >= 0.5;   // right half
    case 9: return u < 0.5;    // left half
    case 7: return !nearTL;    // everything but the top-left triangle
    case 11: return !nearTR;
    case 13: return !nearBR;
    case 14: return !nearBL;
    case 5: return !nearTL && !nearBR;  // two opposite corners are reef, joined through the middle
    case 10: return !nearTR && !nearBL;
  }
  return false;
}

// The outline of the reef part of a cell, as a list of [x, y] points. These are the same
// points the contour line connects, which is why the fill and the line always match.
function solidPolygon(state, c, m) {
  switch (state) {
    case 1: return [m.d, m.c, c.bl];
    case 2: return [m.c, m.b, c.br];
    case 3: return [m.d, m.b, c.br, c.bl];
    case 4: return [m.a, c.tr, m.b];
    case 5: return [m.a, c.tr, m.b, m.c, c.bl, m.d];
    case 6: return [m.a, c.tr, c.br, m.c];
    case 7: return [m.a, c.tr, c.br, c.bl, m.d];
    case 8: return [c.tl, m.a, m.d];
    case 9: return [c.tl, m.a, m.c, c.bl];
    case 10: return [c.tl, m.a, m.b, c.br, m.c, m.d];
    case 11: return [c.tl, m.a, m.b, c.br, c.bl];
    case 12: return [c.tl, c.tr, m.b, m.d];
    case 13: return [c.tl, c.tr, m.b, m.c, c.bl];
    case 14: return [c.tl, c.tr, c.br, m.c, m.d];
  }
  return [];
}
