import { CONFIG } from "./config.js";
import { HandTracker } from "./handTracker.js";
import { GestureEngine } from "./gestureEngine.js";
import { Game } from "./game.js";
import { mirrorX } from "./utils.js";

const video = document.getElementById("camera");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const startOverlay = document.getElementById("startOverlay");
const loadingOverlay = document.getElementById("loadingOverlay");
const permissionError = document.getElementById("permissionError");
const modelError = document.getElementById("modelError");
const protocolHint = document.getElementById("protocolHint");
const startBtn = document.getElementById("startBtn");
const orientationHint = document.getElementById("orientationHint");

function isSecureContextOk() {
  return location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function showOnly(overlay) {
  startOverlay.classList.add("hidden");
  loadingOverlay.classList.add("hidden");
  permissionError.classList.add("hidden");
  modelError.classList.add("hidden");
  if (overlay) overlay.classList.remove("hidden");
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function updateOrientationHint() {
  const isTouchPrimary = matchMedia("(pointer: coarse)").matches;
  const isPortrait = window.innerHeight > window.innerWidth;
  orientationHint.classList.toggle("hidden", !(isTouchPrimary && isPortrait));
}
window.addEventListener("resize", updateOrientationHint);
window.addEventListener("orientationchange", updateOrientationHint);
updateOrientationHint();

function drawDebugLandmarks(raw) {
  const hands = raw.landmarks || [];
  ctx.save();
  ctx.fillStyle = "rgba(0, 230, 255, 0.85)";
  for (const lm of hands) {
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(mirrorX(p.x) * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

async function main() {
  showOnly(loadingOverlay);

  if (!isSecureContextOk()) {
    protocolHint.textContent = `현재 주소: ${location.href} — 휴대폰에서 카메라를 쓰려면 https 주소(또는 PC의 localhost)로 열어야 합니다.`;
    showOnly(permissionError);
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: CONFIG.CAPTURE_WIDTH },
        height: { ideal: CONFIG.CAPTURE_HEIGHT },
        facingMode: { ideal: "user" },
      },
      audio: false,
    });
  } catch (err) {
    console.error("Camera permission/getUserMedia failed", err);
    showOnly(permissionError);
    return;
  }

  video.srcObject = stream;
  await video.play();

  const handTracker = new HandTracker();
  try {
    await handTracker.init();
  } catch (err) {
    console.error("HandLandmarker model failed to load", err);
    showOnly(modelError);
    return;
  }

  resizeCanvas();
  showOnly(null);

  const gestureEngine = new GestureEngine();
  const game = new Game(canvas.width, canvas.height);

  let lastTs = performance.now();
  function loop() {
    const nowMs = performance.now();
    const dt = Math.min((nowMs - lastTs) / 1000, 1 / 15);
    lastTs = nowMs;

    const raw = handTracker.detect(video, nowMs);
    const handStates = gestureEngine.update(raw, canvas.width, canvas.height, nowMs, dt);

    game.update(dt, handStates);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (CONFIG.DEBUG_SHOW_LANDMARKS) drawDebugLandmarks(raw);
    game.draw(ctx, nowMs, handStates);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Gate camera init behind a real user gesture: iOS Safari (and some Android
// browsers) block getUserMedia/video.play() unless triggered by a tap/click.
startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  main();
});
