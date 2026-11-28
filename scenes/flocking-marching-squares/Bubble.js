// A bubble drifting up through the water.
class Bubble {
  constructor(sceneW, sceneH) {
    this.sceneW = sceneW;
    this.sceneH = sceneH;
    this.position = createVector(random(sceneW), random(sceneH));
    this.respawn(false);
  }

  respawn(atBottom) {
    this.position.x = random(this.sceneW);
    if (atBottom) this.position.y = this.sceneH + 20;
    this.size = random(3, 11);
    this.speed = map(this.size, 3, 11, 0.5, 1.4); // bigger bubbles rise faster
    this.wobble = random(TWO_PI);
  }

  update() {
    this.position.y -= this.speed;
    this.wobble += 0.03;
    this.position.x += sin(this.wobble) * 0.4;
    if (this.position.y < -20) this.respawn(true);
  }

  display(g) {
    g.strokeWeight(1.2);
    g.stroke(220, 245, 255, 110);
    g.fill(220, 245, 255, 25);
    g.ellipse(this.position.x, this.position.y, this.size);
    // Little highlight
    g.noStroke();
    g.fill(255, 255, 255, 140);
    g.ellipse(this.position.x - this.size * 0.2, this.position.y - this.size * 0.2, this.size * 0.25);
  }
}
