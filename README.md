# Frame Art Animations

Generative p5.js art scenes built for a Samsung Frame TV. Scenes render inside a makeshift Frame TV in the browser, and whatever is playing can be exported as an **MP4** (or a PNG still).

## Run it

- Open `index.html` in a recent **Chrome, Edge, or Safari**. No build step and no server needed.
- Controls (top bar): switch scene, pause, restart, scene sliders, export settings.
- Keys: `←`/`→` switch scene, `Space` pause, `R` restart, `F` fullscreen (`Esc` exits).
- **Fullscreen** hides the toolbar and shows just the scene, as large as fits on black.
- Click or drag on the TV to add boids (Scene 1).

## Scenes

| # | Scene | Status |
|---|-------|--------|
| 1 | Coral Reef | Done |
| 2–4 | TBD | Not started |

**Scene 1, Fish in the Reef** (black, white and deep navy):
- **Marching squares** is your original sketch: a grid of fixed noise, every cell shaded by its value, with thick lines where the field crosses the threshold. That outline is the reef.
- **Flocking** (separation, alignment, cohesion) moves the fish, and they bounce off the reef edge.
- **Inverse kinematics** (from the Multi Inverse Kinematics sketch) makes each fish a thin spine that trails its head. A noise flow field, like the one in the grass sketch, pushes the spines around so the school ripples.
- **Raycasting** (from the Raycasting sketch) makes the sunbeams. Parallel rays are fired from above the screen through random bands that cover 40% of the width, and they stop at the reef edge. The beams are drawn between the water and the reef, so light never shows inside the reef.
- **Vapor** (from the Slither sketch) is the bubbles: fish give them off, and they float up and fade.

## Exporting

- **Export MP4:** renders frame by frame, not in real time, so output is smooth and identical every run. It always starts from t=0 with your current slider values.
  - Encoding is H.264 via WebCodecs, muxed with `mp4-muxer` (vendored in `libraries/`).
  - Pick 1080p or 4K, 30 or 60 fps, and a length in seconds. 4K is slow and the files are big.
  - Output downloads as `<scene>_<w>x<h>_<fps>fps.mp4`.
- **Save PNG:** a still of the current frame at the chosen resolution.
- Cancel an export with the same button.

## Getting it onto the Frame

- Samsung's article ([ANS10005224](https://www.samsung.com/us/support/answer/ANS10005224/)) only covers adding **photos**: SmartThings app, or USB into the One Connect Box → Art Mode → My Collection.
- It does **not** list video formats, sizes, or length limits. Whether your model's Art Mode plays MP4 is **untested**. Try a short 1080p clip first.
- If video won't play, use **Save PNG** stills. Images are the documented path.
- The Frame is 16:9, so exports are 1920×1080 or 3840×2160.

## Layout

```
index.html        page, toolbar, script tags (register new scenes here)
sketch.js         driver: room + Frame TV, scene switching, export UI
exporter.js       offline MP4 export (WebCodecs + mp4-muxer)
scenes/
  flocking-marching-squares/   Scene 1
    scene.js                   puts it all together (start here)
    TerrainField.js            noise field + marching squares (the reef)
    Boid.js, Fish.js           flocking behavior, and the fish spine
    InverseKinematics.js       Segment and Chain
    Vapor.js                   bubbles
    Raycasting.js, SunBeams.js Ray/Boundary/LightSource, and the beams
  _template.js                 starting point for new scenes
libraries/        p5.js 0.9.0, OpenSimplexNoise, mp4-muxer
legacy/           original standalone sketches, kept for reference
```

## Adding a scene

- Copy `scenes/_template.js` to `scenes/<name>/scene.js`.
- Add its `<script>` tag to `index.html`, above `exporter.js`.
- Contract: a class with `update()` (one tick = 1/60 s), `draw(g)` into a 1920×1080 logical space, and `reset()`.
- Scenes are plain p5.js: `createVector`, `random`, `map`, `g.ellipse()`, etc. `g` is the `p5.Graphics` being rendered into.
- It must be deterministic: call `randomSeed()` in `reset()`, or exports won't repeat.
- Optional: `controls` (sliders) and `onPointer(x, y)`.

## Known limits

- The video doesn't loop seamlessly yet. The Frame will jump at the loop point.
- Export needs WebCodecs H.264 support, so Firefox won't work.
