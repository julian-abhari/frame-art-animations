// Main driver: shows the current scene on a makeshift Samsung Frame TV on a wall,
// and exports whatever scene is playing as an MP4 (or PNG still).
const $ = (id) => document.getElementById(id);

let sceneIdx = 0;
let scene = null;
let pg;                 // preview render target, 1920x1080 logical
let paused = false;
let exporting = false;
let cancelExport = false;
let exportPreview = null; // graphics shown on the TV while exporting
let screenRect = { x: 0, y: 0, w: 1, h: 1 };
let wasFullscreen = false;
let roomLayer;          // cached wall + floor

function setup() {
  const stage = $('stage');
  const c = createCanvas(stage.clientWidth, stage.clientHeight);
  c.parent('stage');
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  frameRate(60);
  pg = createGraphics(1920, 1080);
  pg.pixelDensity(1);
  makeRoom();

  $('prev').onclick = () => loadScene(sceneIdx - 1);
  $('next').onclick = () => loadScene(sceneIdx + 1);
  $('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Play' : 'Pause'; };
  $('restart').onclick = () => scene.reset();
  $('exportMp4').onclick = onExportClick;
  $('exportPng').onclick = savePng;
  $('fullscreen').onclick = () => fullscreen(!fullscreen());
  loadScene(0);
}

function loadScene(i) {
  if (exporting) return;
  sceneIdx = (i + SCENES.length) % SCENES.length;
  const def = SCENES[sceneIdx];
  scene = def.create();
  $('sceneName').textContent = `${sceneIdx + 1}/${SCENES.length} · ${def.name}`;
  const box = $('controls');
  box.innerHTML = '';
  for (const c of def.controls || []) {
    const label = document.createElement('label');
    const val = document.createElement('span');
    const input = document.createElement('input');
    input.type = 'range'; input.min = c.min; input.max = c.max; input.step = c.step;
    input.value = scene.params[c.key];
    val.textContent = input.value;
    input.oninput = () => { scene.params[c.key] = parseFloat(input.value); val.textContent = input.value; };
    label.append(c.label + ' ', input, val);
    box.appendChild(label);
  }
}

function windowResized() {
  resizeCanvas($('stage').clientWidth, $('stage').clientHeight);
  makeRoom();
}

function draw() {
  if (!exporting && !paused) {
    scene.update();
  }
  if (!exporting) {
    pg.push();
    pg.scale(pg.width / 1920);
    scene.draw(pg);
    pg.pop();
  }
  let src = exporting && exportPreview ? exportPreview : pg;

  // Entering/leaving fullscreen (button, F key, or Esc): hide the toolbar and resize
  let isFullscreen = !!fullscreen(); // p5 returns null (not false) when not fullscreen
  if (isFullscreen !== wasFullscreen) {
    wasFullscreen = isFullscreen;
    document.body.classList.toggle('fs', wasFullscreen);
    windowResized();
  }

  if (isFullscreen) {
    drawFullscreen(src);
  } else {
    image(roomLayer, 0, 0);
    drawTV(src);
  }
}

// Fullscreen: just the scene, as large as fits, on black (no wall, no TV).
function drawFullscreen(src) {
  background(0);
  let w = min(width, (height * 16) / 9);
  let h = (w * 9) / 16;
  screenRect = { x: (width - w) / 2, y: (height - h) / 2, w: w, h: h };
  image(src, screenRect.x, screenRect.y, screenRect.w, screenRect.h);
}

// Wall + floor, painted once into their own layer (rebuilt whenever the window resizes).
function makeRoom() {
  if (roomLayer) roomLayer.remove();
  roomLayer = createGraphics(width, height);
  roomLayer.pixelDensity(1);
  roomLayer.noStroke();
  // Wall: a bright patch of light fading to darker plaster, drawn as growing rings
  let maxR = max(width, height) * 0.8;
  roomLayer.background(color(95, 85, 72));
  for (let r = maxR; r > 0; r -= 4) {
    let t = r / maxR; // 1 at the edge, 0 in the middle
    roomLayer.fill(lerpColor(color(250, 244, 232), color(120, 110, 98), pow(t, 0.8)));
    roomLayer.ellipse(width / 2, height * 0.4, r * 2);
  }
  // Baseboard and floor
  roomLayer.fill('#efe9df');
  roomLayer.rect(0, height * 0.92, width, height * 0.012);
  roomLayer.fill('#6b5a49');
  roomLayer.rect(0, height * 0.932, width, height * 0.068);
}

function drawTV(src) {
  // Work out the biggest 16:9 screen that fits, with the frame around it
  let frameFraction = 0.018; // frame thickness as a fraction of screen width
  let screenW = width * 0.92;
  let screenH = (screenW * 9) / 16;
  let maxH = height * 0.86;
  if (screenH + screenW * frameFraction * 2 > maxH) {
    screenH = maxH - screenW * frameFraction * 2;
    screenW = (screenH * 16) / 9;
  }
  let frameT = screenW * frameFraction;
  let tvW = screenW + frameT * 2;
  let tvH = screenH + frameT * 2;
  let tvX = (width - tvW) / 2;
  let tvY = (height * 0.92 - tvH) / 2 + height * 0.01;
  screenRect = { x: tvX + frameT, y: tvY + frameT, w: screenW, h: screenH };

  noStroke();
  // Drop shadow: a stack of faint, growing rectangles
  for (let i = 18; i > 0; i -= 1) {
    fill(0, 0, 0, 5);
    rect(tvX - i * 1.5, tvY - i * 0.5 + 14, tvW + i * 3, tvH + i * 3, 6);
  }
  // Wood frame, darker inner edge, black bezel
  fill('#3b2c22');
  rect(tvX, tvY, tvW, tvH, 3);
  fill('#241a14');
  rect(tvX + frameT * 0.15, tvY + frameT * 0.15, tvW - frameT * 0.3, tvH - frameT * 0.3, 2);
  fill('#0a0a0a');
  rect(tvX + frameT * 0.7, tvY + frameT * 0.7, tvW - frameT * 1.4, tvH - frameT * 1.4);

  // The screen itself
  image(src, screenRect.x, screenRect.y, screenRect.w, screenRect.h);

  if (exporting) {
    fill(0, 150);
    rect(screenRect.x, screenRect.y, screenRect.w, 28);
    fill(255);
    textSize(14);
    textAlign(LEFT, CENTER);
    text('Exporting… ' + $('status').textContent, screenRect.x + 10, screenRect.y + 14);
  }
}

function pointerToLogical() {
  const r = screenRect;
  if (mouseX < r.x || mouseX > r.x + r.w || mouseY < r.y || mouseY > r.y + r.h) return null;
  return [(mouseX - r.x) / r.w * 1920, (mouseY - r.y) / r.h * 1080];
}
function mouseDragged() { const p = pointerToLogical(); if (p && scene.onPointer && !exporting) scene.onPointer(p[0], p[1]); }
function mousePressed() { mouseDragged(); }

function keyPressed() {
  if (exporting) return;
  if (key === ' ') $('pause').click();
  else if (keyCode === LEFT_ARROW) $('prev').click();
  else if (keyCode === RIGHT_ARROW) $('next').click();
  else if (key === 'r' || key === 'R') $('restart').click();
  else if (key === 'f' || key === 'F') fullscreen(!fullscreen());
}

function currentExportSettings() {
  const [w, h] = $('res').value.split('x').map(Number);
  return { width: w, height: h, fps: parseInt($('fps').value, 10), seconds: Math.max(2, parseFloat($('secs').value) || 30) };
}

function setBusy(b) {
  exporting = b;
  for (const id of ['prev', 'next', 'restart', 'pause', 'res', 'fps', 'secs', 'exportPng']) $(id).disabled = b;
  $('exportMp4').textContent = b ? 'Cancel' : 'Export MP4';
}

async function onExportClick() {
  if (exporting) { cancelExport = true; return; }
  const s = currentExportSettings();
  const def = SCENES[sceneIdx];
  // Fresh copy so exports always start at t=0, with the current slider values.
  const fresh = def.create();
  Object.assign(fresh.params, scene.params);
  cancelExport = false;
  setBusy(true);
  const t0 = performance.now();
  try {
    const blob = await exportScene(fresh, {
      ...s,
      shouldCancel: () => cancelExport,
      onFrame: (g) => { exportPreview = g; },
      onProgress: (i, n) => {
        const eta = ((performance.now() - t0) / i) * (n - i) / 1000;
        $('status').textContent = `${i}/${n} (${Math.round(i / n * 100)}%) · ~${Math.ceil(eta)}s left`;
      },
    });
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadBlob(blob, `${slug}_${s.width}x${s.height}_${s.fps}fps.mp4`);
    $('status').textContent = 'Done — MP4 downloaded';
  } catch (e) {
    console.error(e);
    $('status').textContent = e.message;
  } finally {
    exportPreview = null;
    setBusy(false);
  }
}

function savePng() {
  const s = currentExportSettings();
  const g = createGraphics(s.width, s.height);
  g.pixelDensity(1);
  g.push(); g.scale(s.width / 1920); scene.draw(g); g.pop();
  const slug = SCENES[sceneIdx].name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  g.elt.toBlob((b) => { downloadBlob(b, `${slug}_${s.width}x${s.height}.png`); g.remove(); }, 'image/png');
  $('status').textContent = 'PNG saved';
}
