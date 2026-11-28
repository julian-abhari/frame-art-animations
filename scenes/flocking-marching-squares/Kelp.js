// Kelp: a tall inverse-kinematics chain growing up from the reef and swaying in the current.
class Kelp {
  constructor(x, height) {
    this.x = x;
    this.height = height;
    this.hue = random(95, 145); // yellow-green to green
    this.chain = new Chain(x, 1000, 14, height / 14);
    this.base = createVector(x, 1000);
  }

  // Re-plant at the reef surface and sway. `time` is in seconds.
  update(field, time) {
    // Walk down this column until we hit solid reef: that's where the kelp is rooted.
    let y = 480;
    while (y < field.h && field.sample(this.x, y) < field.threshold) {
      y += 4;
    }
    this.base.set(this.x, y);

    // The current pushes the tip left and right. Aim a little short of full length
    // so the chain keeps a gentle curve instead of going bolt straight.
    let reachLength = this.height * 0.96;
    let sway = (noise(this.x * 0.004, time * 0.35) - 0.5) * 2; // -1 to 1
    let sideways = sway * reachLength * 0.5;
    let upward = sqrt(reachLength * reachLength - sideways * sideways);
    let target = createVector(this.base.x + sideways, this.base.y - upward);
    // A few passes of reach() settle the chain into a smooth curve (one pass leaves kinks).
    for (let pass = 0; pass < 4; pass += 1) {
      this.chain.reach(this.base, target);
    }
  }

  // g is in HSB color mode.
  display(g) {
    g.strokeCap(ROUND);
    let segments = this.chain.segments;
    for (let i = 0; i < segments.length; i += 1) {
      let t = i / (segments.length - 1); // 0 at the root, 1 at the tip
      g.stroke(this.hue, 75, lerp(48, 88, t));
      g.strokeWeight(lerp(9, 2.5, t));
      g.line(segments[i].start.x, segments[i].start.y, segments[i].end.x, segments[i].end.y);
    }
  }
}
