// Raycasting, ported from the old "Raycasting" sketch.
//
// A Ray starts at a point and travels in one direction forever. Cast it against
// a Boundary (a line segment) to find out where it hits. Cast it against every
// Boundary and keep the closest hit, and you know what a light can "see".
//
// Here the Boundaries are the edges of the coral reef, so sunlight stops when it hits coral.

// A wall: one straight line segment from pointA to pointB.
class Boundary {
  constructor(x1, y1, x2, y2) {
    this.pointA = createVector(x1, y1);
    this.pointB = createVector(x2, y2);
  }
}

// A ray: a starting position (shared with whoever owns it) and a unit direction.
class Ray {
  constructor(position, angle) {
    this.position = position; // a reference, so moving the light moves its rays
    this.direction = p5.Vector.fromAngle(angle);
  }

  setAngle(angle) {
    this.direction = p5.Vector.fromAngle(angle);
  }

  // Where does this ray hit `wall`? Returns a p5.Vector, or null if it misses.
  // (Standard line-line intersection: t runs along the wall, u runs along the ray.)
  cast(wall) {
    let x1 = wall.pointA.x;
    let y1 = wall.pointA.y;
    let x2 = wall.pointB.x;
    let y2 = wall.pointB.y;

    let x3 = this.position.x;
    let y3 = this.position.y;
    let x4 = this.position.x + this.direction.x;
    let y4 = this.position.y + this.direction.y;

    let denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denominator === 0) return null; // ray and wall are parallel

    let t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    let u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

    // t between 0 and 1 means the hit is on the wall; u > 0 means it's in front of the ray.
    if (t > 0 && t < 1 && u > 0) {
      return createVector(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
    }
    return null;
  }
}

// A light made of several "shafts" (bundles of neighboring rays) that all start at one point.
// Every shaft is drawn as one beam of sunlight.
class LightSource {
  constructor(x, y, shaftCount, raysPerShaft) {
    this.position = createVector(x, y);
    this.noiseSeed = random(1000); // so every light sways differently
    this.maxDistance = 1800;       // how far a ray travels if it never hits anything

    this.shafts = [];
    for (let s = 0; s < shaftCount; s += 1) {
      let rays = [];
      for (let r = 0; r < raysPerShaft; r += 1) {
        rays.push(new Ray(this.position, HALF_PI));
      }
      this.shafts.push({
        rays: rays,
        offset: map(s, 0, shaftCount - 1, -0.14, 0.14) + random(-0.012, 0.012), // angle from the light's center
        width: random(0.02, 0.06),   // angle between a shaft's first and last ray
        flicker: random(1000),        // noise seed for this shaft's shimmer
        brightness: 1,
        hits: [],                     // filled in by look()
      });
    }
  }

  // Point every ray: the whole light slowly sways, each shaft spreads its rays evenly.
  aim(time) {
    let sway = (noise(this.noiseSeed, time * 0.15) - 0.5) * 0.25;
    let centerAngle = HALF_PI + 0.25 + sway; // straight down, leaning right like afternoon sun
    for (let shaft of this.shafts) {
      for (let r = 0; r < shaft.rays.length; r += 1) {
        let spread = r / (shaft.rays.length - 1) - 0.5; // -0.5 to 0.5 across the shaft
        shaft.rays[r].setAngle(centerAngle + shaft.offset + spread * shaft.width);
      }
      shaft.brightness = map(noise(shaft.flicker, time * 0.4), 0, 1, 0.3, 1);
    }
  }

  // Cast every ray against the walls and remember the closest hit for each one.
  look(walls) {
    for (let shaft of this.shafts) {
      shaft.hits = [];
      for (let ray of shaft.rays) {
        let closest = null;
        let record = this.maxDistance;
        for (let wall of walls) {
          let hit = ray.cast(wall);
          if (hit !== null) {
            let distance = dist(this.position.x, this.position.y, hit.x, hit.y);
            if (distance < record) {
              record = distance;
              closest = hit;
            }
          }
        }
        shaft.hits.push({ ray: ray, distance: record, hit: closest });
      }
    }
  }
}
