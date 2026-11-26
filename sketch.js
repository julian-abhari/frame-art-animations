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

function setup() {
  const stage = $('stage');
  const c = createCanvas(stage.clientWidth, stage.clientHeight);
  c.parent('stage');
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  frameRate(60);
  pg = createGraphics(1920, 1080);
  pg.pixelDensity(1);

  $('prev').onclick = () => loadScene(sceneIdx - 1);
  $('next').onclick = () => loadScene(sceneIdx + 1);
  $('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Play' : 'Pause'; };
  $('restart').onclick = () => scene.reset();
  $('exportMp4').onclick = onExportClick;
  $('exportPng').onclick = savePng;
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
  drawRoom();
  drawTV(exporting && exportPreview ? exportPreview : pg);
}

function drawRoom() {
  // Plaster wall with a soft light falloff
  background('#cfc8bd');
  const ctx = drawingContext;
  const g = ctx.createRadialGradient(width / 2, height * 0.4, 50, width / 2, height * 0.4, Math.max(width, height) * 0.8);
  g.addColorStop(0, 'rgba(255,250,240,0.55)');
  g.addColorStop(1, 'rgba(60,50,40,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  // Floor / baseboard
  noStroke();
  fill('#6b5a49'); rect(0, height * 0.93, width, height * 0.07);
  fill('#efe9df'); rect(0, height * 0.92, width, height * 0.012);
}

function drawTV(src) {
  // Fit a 16:9 screen plus frame into the room
  const frameT = 0.018;      // frame thickness as fraction of screen width
  const maxW = width * 0.86, maxH = height * 0.80;
  let sw = maxW;
  let sh = sw * 9 / 16;
  if (sh + sw * frameT * 2 > maxH) { sh = maxH - sw * frameT * 2; sw = sh * 16 / 9; }
  // recompute so the frame fits
  const ft = sw * frameT;
  const tvW = sw + ft * 2, tvH = sh + ft * 2;
  const tx = (width - tvW) / 2, ty = (height * 0.92 - tvH) / 2 + height * 0.01;
  screenRect = { x: tx + ft, y: ty + ft, w: sw, h: sh };

  const ctx = drawingContext;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  fill('#1c1815'); noStroke();
  rect(tx, ty, tvW, tvH, 3);
  ctx.restore();
  // Frame bevel (walnut-ish) and inner black bezel
  fill('#3b2c22'); rect(tx, ty, tvW, tvH, 3);
  fill('#241a14'); rect(tx + ft * 0.15, ty + ft * 0.15, tvW - ft * 0.3, tvH - ft * 0.3, 2);
  fill('#0a0a0a'); rect(tx + ft * 0.7, ty + ft * 0.7, tvW - ft * 1.4, tvH - ft * 1.4);
  // Screen
  image(src, screenRect.x, screenRect.y, screenRect.w, screenRect.h);
  // Subtle glass glare
  const glare = ctx.createLinearGradient(screenRect.x, screenRect.y, screenRect.x + screenRect.w, screenRect.y + screenRect.h);
  glare.addColorStop(0, 'rgba(255,255,255,0.06)');
  glare.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);

  if (exporting) {
    noStroke(); fill(0, 150);
    rect(screenRect.x, screenRect.y, screenRect.w, 28);
    fill(255); textSize(14); textAlign(LEFT, CENTER);
    text('Exporting… ' + ($('status').textContent), screenRect.x + 10, screenRect.y + 14);
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
