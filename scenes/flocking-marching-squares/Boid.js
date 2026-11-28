// A boid: flocks with its neighbors and reacts to the TerrainField walls.
class Boid {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D().mult(1.5);
    this.acceleration = createVector(0, 0);
    this.radius = 4.5;
    this.maxSpeed = 3.4;
    this.maxForce = 0.16;
    this.hue = random(175, 225); // teal to blue (drawn in HSB)
    this.trail = [];             // recent positions, drawn as a fading tail
  }

  run(boids, field, params) {
    this.flock(boids, params);
    this.avoidWalls(field, params);
    this.update();
    this.collide(field);
    this.borders(field);
    this.recordTrail();
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
    let neighborDistance = 60;
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
    let desiredSeparation = 28;
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
      if (into.mag() < 1e-7) break;
      normal = into.mult(-1).normalize();
      this.position.add(p5.Vector.mult(normal, 3));
      if (field.sample(this.position.x, this.position.y) <= field.threshold) break;
    }
    // Reflect the part of the velocity that points into the wall.
    let speedIntoWall = this.velocity.dot(normal);
    if (speedIntoWall < 0) {
      this.velocity.sub(p5.Vector.mult(normal, 1.7 * speedIntoWall));
    }
  }

  // Wrap around the screen edges.
  borders(field) {
    // field.w and field.h are the scene size (1920x1080), not the preview canvas size.
    if (this.position.x < -this.radius) this.position.x = field.w + this.radius;
    if (this.position.y < -this.radius) this.position.y = field.h + this.radius;
    if (this.position.x > field.w + this.radius) this.position.x = -this.radius;
    if (this.position.y > field.h + this.radius) this.position.y = -this.radius;
  }

  recordTrail() {
    let last = this.trail[this.trail.length - 1];
    // Don't draw a streak across the screen when wrapping around an edge.
    if (last && p5.Vector.dist(last, this.position) > 60) this.trail = [];
    this.trail.push(this.position.copy());
    if (this.trail.length > 18) this.trail.shift();
  }

  // ---- Drawing (g is the p5.Graphics we're rendering into, in HSB color mode) ----

  display(g) {
    // Fading tail
    g.strokeCap(ROUND);
    for (let i = 1; i < this.trail.length; i += 1) {
      let t = i / this.trail.length;
      g.stroke(this.hue, 60, 100, t * 0.5);
      g.strokeWeight(1 + t * 2.2);
      g.line(this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i].x, this.trail[i].y);
    }

    // Soft glow, then a triangle pointing the way we're heading
    g.noStroke();
    g.fill(this.hue, 80, 100, 0.12);
    g.ellipse(this.position.x, this.position.y, this.radius * 6);
    g.fill(this.hue, 20, 100);
    g.push();
    g.translate(this.position.x, this.position.y);
    g.rotate(this.velocity.heading());
    g.triangle(this.radius * 1.6, 0, -this.radius, -this.radius * 0.8, -this.radius, this.radius * 0.8);
    g.pop();
  }
}
