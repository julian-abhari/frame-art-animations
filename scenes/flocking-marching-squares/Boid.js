// A boid: flocks with its neighbors and reacts to the TerrainField walls.
// This class is only behavior (movement). Fish extends it to add a body to draw.
class Boid {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D().mult(1.5);
    this.acceleration = createVector(0, 0);
    this.radius = 6;
    this.maxSpeed = 2.8;
    this.maxForce = 0.12;
    this.neighborDistance = 90;     // how far a boid can see other boids
    this.desiredSeparation = 34;    // personal space
  }

  run(boids, field, params) {
    this.flock(boids, params);
    this.avoidWalls(field, params);
    this.update();
    this.collide(field);
    this.borders(field);
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  // ---- Flocking ----

  flock(boids, params) {
    let neighbors = this.findNeighbors(boids);
    let separateForce = this.separate(neighbors);
    let alignmentForce = this.align(neighbors);
    let cohesionForce = this.cohesion(neighbors);

    separateForce.mult(params.separation);
    alignmentForce.mult(params.alignment);
    cohesionForce.mult(params.cohesion);

    this.applyForce(separateForce);
    this.applyForce(alignmentForce);
    this.applyForce(cohesionForce);
  }

  // Measure distance to every other boid once, keep the ones that are close.
  findNeighbors(boids) {
    let neighborDistance = this.neighborDistance;
    let neighbors = [];
    for (let other of boids) {
      let distance = dist(this.position.x, this.position.y, other.position.x, other.position.y);
      if (distance > 0 && distance < neighborDistance) {
        neighbors.push({ boid: other, distance: distance });
      }
    }
    return neighbors;
  }

  // Steer away from boids that are too close.
  separate(neighbors) {
    let desiredSeparation = this.desiredSeparation;
    let separateForce = createVector(0, 0);
    let count = 0;
    for (let n of neighbors) {
      if (n.distance < desiredSeparation) {
        let difference = p5.Vector.sub(this.position, n.boid.position);
        difference.normalize();
        difference.div(n.distance); // closer neighbors push harder
        separateForce.add(difference);
        count += 1;
      }
    }
    if (count > 0) {
      separateForce.div(count);
      separateForce.setMag(this.maxSpeed);
      separateForce.sub(this.velocity); // steering = desired - velocity
      separateForce.limit(this.maxForce);
    }
    return separateForce;
  }

  // Steer to match the average heading of neighbors.
  align(neighbors) {
    if (neighbors.length === 0) return createVector(0, 0);
    let average = createVector(0, 0);
    for (let n of neighbors) {
      average.add(n.boid.velocity);
    }
    average.setMag(this.maxSpeed);
    let steeringForce = p5.Vector.sub(average, this.velocity);
    steeringForce.limit(this.maxForce);
    return steeringForce;
  }

  // Steer toward the center of nearby boids.
  cohesion(neighbors) {
    if (neighbors.length === 0) return createVector(0, 0);
    let center = createVector(0, 0);
    for (let n of neighbors) {
      center.add(n.boid.position);
    }
    center.div(neighbors.length);
    return this.seek(center);
  }

  // Steering force toward a target = desired velocity - current velocity.
  seek(target) {
    let desired = p5.Vector.sub(target, this.position);
    desired.setMag(this.maxSpeed);
    let steeringForce = p5.Vector.sub(desired, this.velocity);
    steeringForce.limit(this.maxForce);
    return steeringForce;
  }

  // ---- Reacting to the marching squares ----

  // Look a little ahead; if a wall is coming up, turn away from it.
  avoidWalls(field, params) {
    let margin = 0.06;
    for (let lookAhead of [14, 32]) {
      let ahead = p5.Vector.add(this.position, this.velocity.copy().setMag(lookAhead));
      let value = field.sample(ahead.x, ahead.y);
      if (value > field.threshold - margin) {
        // The gradient points into the wall, so push the opposite way.
        let away = field.gradient(ahead.x, ahead.y).mult(-1);
        let strength = constrain((value - (field.threshold - margin)) * 8 + 0.25, 0, 1);
        away.setMag(this.maxForce * params.avoidance * strength);
        this.applyForce(away);
      }
    }
  }

  // Hard collision: if we ended up inside a wall, push out and bounce.
  collide(field) {
    if (field.sample(this.position.x, this.position.y) <= field.threshold) return;

    let normal = createVector(0, 0); // points out of the wall
    for (let tries = 0; tries < 12; tries += 1) {
      let into = field.gradient(this.position.x, this.position.y);
      // Flat gradient (e.g. at the very edge of the field): just head for the surface
      normal = into.mag() < 1e-7 ? createVector(0, -1) : into.mult(-1).normalize();
      this.position.add(p5.Vector.mult(normal, 3));
      if (field.sample(this.position.x, this.position.y) <= field.threshold) break;
    }
    // Reflect the part of the velocity that points into the wall.
    let speedIntoWall = this.velocity.dot(normal);
    if (speedIntoWall < 0) {
      this.velocity.sub(p5.Vector.mult(normal, 1.7 * speedIntoWall));
    }
  }

  // Wrap around the screen edges, but only where the other side is open water.
  // If the reef is on the other side (like the sea floor), bounce back instead.
  borders(field) {
    // field.w and field.h are the scene size (1920x1080), not the preview canvas size.
    let r = this.radius;
    let x = this.position.x;
    let y = this.position.y;
    let wrappedX = x < -r ? field.w + r : (x > field.w + r ? -r : x);
    let wrappedY = y < -r ? field.h + r : (y > field.h + r ? -r : y);

    let openWater = field.threshold - 0.1;
    if (wrappedX !== x) {
      if (field.sample(wrappedX, y) < openWater) this.position.x = wrappedX;
      else this.velocity.x *= -1;
    }
    if (wrappedY !== y) {
      if (field.sample(x, wrappedY) < openWater) this.position.y = wrappedY;
      else this.velocity.y *= -1;
    }
    this.position.x = constrain(this.position.x, -r - 1, field.w + r + 1);
    this.position.y = constrain(this.position.y, -r - 1, field.h + r + 1);
  }
}
