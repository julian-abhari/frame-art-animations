// Inverse kinematics, ported from the old "Multi Inverse Kinematics" sketch.
//
// A Chain is a row of rigid Segments joined end to end. Instead of rotating each
// joint by hand, we say where we want one end to be and let the chain follow.
// Used for fish spines (the head leads, the body trails behind) and kelp (the base
// is pinned to the reef, the tip sways).

// One rigid stick: it has a start, a fixed length, and an angle that gives its end.
class Segment {
  constructor(x, y, length) {
    this.start = createVector(x, y);
    this.length = length;
    this.angle = 0;
    this.end = createVector(x + length, y);
  }

  // Turn to face `target`, and slide so that our END touches it.
  follow(target) {
    let direction = p5.Vector.sub(target, this.start);
    this.angle = direction.heading();
    direction.setMag(this.length);
    this.start = p5.Vector.sub(target, direction);
    this.updateEnd();
  }

  // Move our start to `base`, keeping the same angle.
  setStart(base) {
    this.start = base.copy();
    this.updateEnd();
  }

  updateEnd() {
    this.end = p5.Vector.add(this.start, p5.Vector.fromAngle(this.angle).mult(this.length));
  }
}

class Chain {
  // A straight chain of `count` segments starting at (x, y) and pointing right.
  constructor(x, y, count, segmentLength) {
    this.segments = [];
    let previous = null;
    for (let i = 0; i < count; i += 1) {
      let segment = previous ? new Segment(previous.end.x, previous.end.y, segmentLength)
                             : new Segment(x, y, segmentLength);
      this.segments.push(segment);
      previous = segment;
    }
  }

  // The free end of the chain (the head of a fish, the top of a kelp).
  get tip() {
    return this.segments[this.segments.length - 1].end;
  }

  // Pull the tip onto `target`; every other segment follows the one in front of it.
  // The base is NOT held in place, so the whole chain trails after the target.
  drag(target) {
    let last = this.segments.length - 1;
    this.segments[last].follow(target);
    for (let i = last - 1; i >= 0; i -= 1) {
      this.segments[i].follow(this.segments[i + 1].start);
    }
  }

  // Put the base back on `base` and re-join every segment end to start.
  pinTo(base) {
    this.segments[0].setStart(base);
    for (let i = 1; i < this.segments.length; i += 1) {
      this.segments[i].setStart(this.segments[i - 1].end);
    }
  }

  // Reach toward `target` while the base stays at `base`.
  reach(base, target) {
    this.drag(target);
    this.pinTo(base);
  }

  // Every joint from the base to the tip (one more point than there are segments).
  joints() {
    let points = this.segments.map((segment) => segment.start);
    points.push(this.tip);
    return points;
  }
}
