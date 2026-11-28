// Vapor: a little bubble that drifts up and fades out.
// Ported from the old Slither sketch, where every segment of the snake gave off vapor.
// Here the fish give off the bubbles.
class Vapor {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = createVector(random(-0.4, 0.4), random(-0.4, 0.4));
    this.acceleration = createVector(0, 0);
    this.maxSpeed = 1;
    this.lifeSpan = 255; // counts down to 0; also used as the opacity
    this.dead = false;
    this.size = random(2, 6);
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.applyForce(createVector(0, -0.015)); // bubbles float up
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);

    this.lifeSpan -= 1.2;
    if (this.lifeSpan <= 0) {
      this.dead = true;
    }
  }

  display(g) {
    g.stroke(255, this.lifeSpan);
    g.strokeWeight(this.size);
    g.point(this.position.x, this.position.y);
  }
}
