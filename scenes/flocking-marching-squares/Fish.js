// Fish: a Boid with a body.
//
// The Boid part handles flocking and bouncing off the reef. The body is an
// inverse-kinematics Chain (see InverseKinematics.js): every tick the head is
// dragged to the boid's position and the spine trails behind it. Turns bend the
// body naturally, and nudging the head side to side makes a swimming wiggle that
// travels down to the tail.

// Each school is one species: color (HSB) and whether it has white stripes.
const SPECIES = [
  { name: 'clownfish',  hue: 18,  saturation: 88, brightness: 100, stripes: true },
  { name: 'yellow tang', hue: 52,  saturation: 85, brightness: 100, stripes: false },
  { name: 'blue tang',   hue: 212, saturation: 80, brightness: 95,  stripes: false },
  { name: 'cyan wrasse', hue: 182, saturation: 65, brightness: 95,  stripes: false },
  { name: 'anthias',     hue: 335, saturation: 60, brightness: 100, stripes: false },
];

// How thick the body is at each joint, head first, as a fraction of the maximum.
// (8 numbers because the spine has 7 segments, so 8 joints.)
const BODY_PROFILE = [0.55, 0.85, 1.0, 0.9, 0.7, 0.45, 0.28, 0.2];

class Fish extends Boid {
  constructor(x, y, speciesIndex) {
    super(x, y);
    this.species = SPECIES[speciesIndex];
    this.bodyLength = random(30, 46);
    this.swimPhase = random(TWO_PI);
    this.resetBody();
  }

  // Lay the spine out in a straight line behind the head.
  resetBody() {
    let heading = this.velocity.heading();
    let tail = p5.Vector.sub(this.position, p5.Vector.fromAngle(heading).mult(this.bodyLength));
    this.chain = new Chain(tail.x, tail.y, 7, this.bodyLength / 7);
    this.chain.drag(this.position);
  }

  run(boids, field, params) {
    super.run(boids, field, params); // flock, avoid the reef, move
    this.swim();
  }

  // Pull the spine along behind the head, wiggling the head from side to side.
  swim() {
    // If we just wrapped around the screen, don't stretch the body across it.
    if (p5.Vector.dist(this.chain.tip, this.position) > this.bodyLength) {
      this.resetBody();
    }
    this.swimPhase += 0.12 + this.velocity.mag() * 0.06; // faster fish beat faster
    let wiggle = this.velocity.copy().rotate(HALF_PI);   // sideways to the swim direction
    wiggle.setMag(sin(this.swimPhase) * this.bodyLength * 0.09);
    this.chain.drag(p5.Vector.add(this.position, wiggle));
  }

  // ---- Drawing (g is in HSB color mode: hue 360, saturation 100, brightness 100, alpha 1) ----

  display(g) {
    let joints = this.chain.joints().reverse(); // head first, tail last
    let last = joints.length - 1;
    let maxHalfWidth = this.bodyLength * 0.15;

    // At every joint: which way the body points (toward the head) and its sideways direction
    let forward = [];
    let side = [];
    for (let k = 0; k <= last; k += 1) {
      let f = p5.Vector.sub(joints[max(k - 1, 0)], joints[min(k + 1, last)]).normalize();
      forward.push(f);
      side.push(createVector(-f.y, f.x));
    }
    // Which sideways direction is "up the screen"? Fins go on that side so fish swim right side up.
    let up = side[3].y < 0 ? 1 : -1;
    let halfWidth = (k) => BODY_PROFILE[k] * maxHalfWidth;

    let s = this.species;
    g.strokeJoin(ROUND);
    g.strokeWeight(1);

    // Tail fin (a notched triangle behind the last joint)
    let tailDirection = forward[last].copy().mult(-1);
    let finLength = this.bodyLength * 0.28;
    let finSpread = this.bodyLength * 0.2;
    g.fill(s.hue, s.saturation * 0.75, s.brightness, 0.85);
    g.stroke(s.hue, s.saturation, s.brightness * 0.6, 0.6);
    g.beginShape();
    g.vertex(joints[last].x, joints[last].y);
    g.vertex(joints[last].x + tailDirection.x * finLength + side[last].x * finSpread,
             joints[last].y + tailDirection.y * finLength + side[last].y * finSpread);
    g.vertex(joints[last].x + tailDirection.x * finLength * 0.7,
             joints[last].y + tailDirection.y * finLength * 0.7);
    g.vertex(joints[last].x + tailDirection.x * finLength - side[last].x * finSpread,
             joints[last].y + tailDirection.y * finLength - side[last].y * finSpread);
    g.endShape(CLOSE);

    // Dorsal fin (a triangle on the top edge of the body)
    let top = (k, extra) => createVector(
      joints[k].x + side[k].x * up * (halfWidth(k) + extra),
      joints[k].y + side[k].y * up * (halfWidth(k) + extra)
    );
    let apex = top(3, this.bodyLength * 0.16);
    apex.sub(p5.Vector.mult(forward[3], this.bodyLength * 0.05)); // sweep it back a little
    g.beginShape();
    g.vertex(top(2, 0).x, top(2, 0).y);
    g.vertex(apex.x, apex.y);
    g.vertex(top(4, 0).x, top(4, 0).y);
    g.endShape(CLOSE);

    // Body: a smooth closed outline around the spine
    let nose = p5.Vector.add(joints[0], p5.Vector.mult(forward[0], this.bodyLength * 0.05));
    let outline = [nose];
    for (let k = 0; k <= last; k += 1) {
      outline.push(createVector(joints[k].x + side[k].x * halfWidth(k), joints[k].y + side[k].y * halfWidth(k)));
    }
    for (let k = last; k >= 0; k -= 1) {
      outline.push(createVector(joints[k].x - side[k].x * halfWidth(k), joints[k].y - side[k].y * halfWidth(k)));
    }
    g.fill(s.hue, s.saturation, s.brightness);
    g.stroke(s.hue, s.saturation, s.brightness * 0.6, 0.8);
    g.beginShape();
    g.curveVertex(outline[outline.length - 1].x, outline[outline.length - 1].y); // curve control points:
    for (let p of outline) g.curveVertex(p.x, p.y);                              // wrap around so the
    g.curveVertex(outline[0].x, outline[0].y);                                   // outline closes smoothly
    g.curveVertex(outline[1].x, outline[1].y);
    g.endShape();

    // Stripes across the body
    if (s.stripes) {
      g.stroke(0, 0, 100, 0.9);
      g.strokeWeight(this.bodyLength * 0.07);
      for (let k of [2, 4]) {
        let w = halfWidth(k) * 0.85;
        g.line(joints[k].x + side[k].x * w, joints[k].y + side[k].y * w,
               joints[k].x - side[k].x * w, joints[k].y - side[k].y * w);
      }
    }

    // Eye
    let eye = createVector(
      lerp(joints[0].x, joints[1].x, 0.3) + side[0].x * up * maxHalfWidth * 0.25,
      lerp(joints[0].y, joints[1].y, 0.3) + side[0].y * up * maxHalfWidth * 0.25
    );
    g.noStroke();
    g.fill(0, 0, 100);
    g.ellipse(eye.x, eye.y, maxHalfWidth * 0.75);
    g.fill(0, 0, 5);
    g.ellipse(eye.x, eye.y, maxHalfWidth * 0.4);
  }
}
