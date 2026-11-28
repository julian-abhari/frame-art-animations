// Fish: a Boid drawn as a thin, glowing spine.
//
// The Boid part handles flocking and bouncing off the reef. The body is an
// inverse-kinematics Chain (see InverseKinematics.js), like a blade of grass in the old
// Multi Inverse Kinematics sketch: every tick the head is dragged along by the boid and
// the spine trails behind it. A noise flow field nudges the head, so the whole school
// ripples together, the way the grass blades did in the wind.
class Fish extends Boid {
  constructor(x, y) {
    super(x, y);
    this.bodyLength = random(40, 70);
    this.segmentCount = 12;
    this.headBrightness = random(200, 255);

    // Start as a straight line trailing behind the head.
    let tail = p5.Vector.sub(this.position, p5.Vector.fromAngle(this.velocity.heading()).mult(this.bodyLength));
    this.chain = new Chain(tail.x, tail.y, this.segmentCount, this.bodyLength / this.segmentCount);
    this.chain.drag(this.position);
  }

  // `time` is in seconds (it moves the flow field along).
  run(boids, field, params, time) {
    super.run(boids, field, params); // flock, avoid the reef, move
    this.swim(field, time);
  }

  // Pull the spine along behind the head, pushed around by the flow field.
  // Then move any joint that ended up in the reef out to open water.
  swim(field, time) {
    let flow = flowAt(this.position.x, this.position.y, time);
    flow.mult(this.bodyLength * 0.14);
    let headTarget = p5.Vector.add(this.position, flow);
    if (field.blocked(headTarget.x, headTarget.y)) headTarget = this.position.copy();

    this.chain.drag(headTarget);
    this.chain.keepClear(
      (point) => field.blocked(point.x, point.y),
      (point) => field.nearestOpenPoint(point.x, point.y)
    );
  }

  // ---- Drawing (g is in RGB color mode) ----

  // A tapered line: thick and bright at the head, thin and faint at the tail.
  display(g) {
    let segments = this.chain.segments; // the LAST segment is the head
    g.strokeCap(ROUND);
    for (let i = 0; i < segments.length; i += 1) {
      let t = i / (segments.length - 1); // 0 at the tail, 1 at the head
      g.stroke(this.headBrightness, lerp(50, 255, t));
      g.strokeWeight(lerp(0.6, 6, pow(t, 1.4)));
      g.line(segments[i].start.x, segments[i].start.y, segments[i].end.x, segments[i].end.y);
    }
  }
}

// The flow field, from the old grass sketch: Perlin noise turned into an angle,
// then into a direction. Slowly changes over time and from place to place.
function flowAt(x, y, time) {
  let n = noise(x * 0.004, y * 0.004, time * 0.25);
  let angle = map(n, 0, 1, 0, TWO_PI * 3);
  return p5.Vector.fromAngle(angle);
}
