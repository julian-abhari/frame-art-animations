// Offline MP4 export: steps a fresh copy of the scene frame-by-frame (not real-time),
// encodes with WebCodecs (H.264) and muxes with mp4-muxer. Output is identical every run.
const LOGICAL_W = 1920;

async function pickAvcCodec(width, height, fps, bitrate) {
  // High profile; level 4.0 (1080p30) -> 5.1/5.2 for 4K.
  const candidates = ['avc1.640028', 'avc1.64002A', 'avc1.640033', 'avc1.640034', 'avc1.4D0028'];
  for (const codec of candidates) {
    const cfg = { codec, width, height, bitrate, framerate: fps };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) return cfg; } catch (e) { /* try next */ }
  }
  return null;
}

// scene: a fresh, reset scene instance. onProgress(frame, total). Resolves with a Blob.
async function exportScene(scene, { width, height, fps, seconds, onProgress, shouldCancel, onFrame }) {
  if (!('VideoEncoder' in window)) throw new Error('This browser has no WebCodecs. Use recent Chrome, Edge or Safari.');
  const bitrate = width >= 3840 ? 40e6 : 16e6;
  const cfg = await pickAvcCodec(width, height, fps, bitrate);
  if (!cfg) throw new Error('No H.264 encoder available for ' + width + 'x' + height + '@' + fps);

  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width, height }, fastStart: 'in-memory' });
  let encError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encError = e; },
  });
  encoder.configure(cfg);

  const g = createGraphics(width, height);
  g.pixelDensity(1);
  const total = Math.round(seconds * fps);
  const ticksPerFrame = 60 / fps; // scene ticks are defined at 60/s
  let tickDebt = 0;

  try {
    for (let i = 0; i < total; i++) {
      if (shouldCancel && shouldCancel()) throw new Error('Export cancelled');
      if (encError) throw encError;
      tickDebt += ticksPerFrame;
      while (tickDebt >= 1 - 1e-9) { scene.update(); tickDebt -= 1; }

      g.push();
      g.scale(width / LOGICAL_W);
      scene.draw(g);
      g.pop();

      const frame = new VideoFrame(g.elt, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      if (onFrame) onFrame(g);
      if (onProgress) onProgress(i + 1, total);
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
      await new Promise((r) => setTimeout(r, 0)); // let the UI breathe
    }
    await encoder.flush();
    muxer.finalize();
  } finally {
    try { encoder.close(); } catch (e) { /* already closed */ }
    g.remove();
  }
  return new Blob([target.buffer], { type: 'video/mp4' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
