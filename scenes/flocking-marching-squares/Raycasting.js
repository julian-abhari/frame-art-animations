// Raycasting, ported from the old "Raycasting" sketch.
//
// A Ray starts at a point and travels in one direction forever. Cast it against
// a Boundary (a line segment) to find out where it hits. Cast it against every
// Boundary and keep the closest hit, and you know how far the ray gets.
//
// Here the Boundaries are the edges of the reef, so sunlight stops where it hits the reef.

// A wall: one straight line segment from pointA to pointB.
class Boundary {
  constructor(x1, y1, x2, y2) {
    this.pointA = createVector(x1, y1);
    this.pointB = createVector(x2, y2);
  }
}

// A ray: a starting position and a unit direction.
class Ray {
  constructor(position, angle) {
    this.position = position;
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

// One beam of sunlight: a row of parallel rays starting side by side above the screen.
// Sunlight is so far away that its rays are parallel, so a beam keeps the same width
// all the way down.
class LightBeam {
  constructor(x, width, rayCount) {
    this.x = x;
    this.width = width;
    this.flicker = random(1000); // noise seed so each beam shimmers differently
    this.brightness = 1;
    this.maxDistance = 1800;     // how far a ray goes if it never hits anything

    this.rays = [];
    for (let r = 0; r < rayCount; r += 1) {
      let startX = x + (width * r) / (rayCount - 1);
      this.rays.push(new Ray(createVector(startX, -50), HALF_PI));
    }
    this.hits = []; // where each ray ended up, filled in by look()
  }

  // Point every ray the same way.
  aim(angle) {
    for (let ray of this.rays) {
      ray.setAngle(angle);
    }
  }

  // Cast every ray against the walls and remember where each one ends.
  look(walls) {
    this.hits = [];
    for (let ray of this.rays) {
      let closest = null;
      let record = this.maxDistance;
      for (let wall of walls) {
        let hit = ray.cast(wall);
        if (hit !== null) {
          let distance = dist(ray.position.x, ray.position.y, hit.x, hit.y);
          if (distance < record) {
            record = distance;
            closest = hit;
          }
        }
      }
      // No hit means the ray left the screen: end it far away
      this.hits.push(closest !== null ? closest : p5.Vector.add(ray.position, p5.Vector.mult(ray.direction, record)));
    }
  }
}
