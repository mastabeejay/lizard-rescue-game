import { CONFIG } from "./config.js";
import { dist2D, clamp, emaStep, mirrorX, stdDev } from "./utils.js";

const LM = { WRIST: 0, THUMB_TIP: 4, INDEX_TIP: 8, MIDDLE_TIP: 12, MIDDLE_MCP: 9, RING_TIP: 16, PINKY_TIP: 20 };

function freshSlot() {
  return {
    hasPosition: false,
    smoothedCursor: { x: 0, y: 0 },
    pinchActive: false,
    pinchStartTime: 0,
    prevPinchDist: null,
    pinchDistHistory: [], // {t, d}
    cursorHistory: [], // {t, x, y} pixel space, for release-speed calc
    prevIndexTipNorm: null,
    prevMiddleTipNorm: null,
    petDwellStart: null,
    lastSeenTime: null,
  };
}

// Converts raw per-frame MediaPipe HandLandmarker output into a stable, semantic
// per-hand HandState: smoothed cursor, hysteresis-debounced pinch, a grab-force
// proxy (no pressure sensor available), petting-motion detection, and a
// fast-release flag. Owns two persistent "slots" (not raw array indices) so hand
// identity stays stable frame-to-frame even if MediaPipe's result order swaps.
export class GestureEngine {
  constructor() {
    this.slots = [freshSlot(), freshSlot()];
  }

  // rawResult: { landmarks: [[{x,y,z}]*21]*handCount, handedness: [...] }
  // Returns an array of length 2: HandState | null-ish-but-always-an-object (present:false when unused/absent)
  update(rawResult, canvasWidth, canvasHeight, nowMs, dtSeconds) {
    const rawHands = rawResult.landmarks || [];
    const rawCursors = rawHands.map((lm) => this._rawCursorPixel(lm, canvasWidth, canvasHeight));
    const assignment = this._assignSlots(rawCursors);

    const states = [];
    for (let i = 0; i < 2; i++) {
      const rawIdx = assignment[i];
      const slot = this.slots[i];
      if (rawIdx === -1) {
        states.push(this._updateAbsent(slot));
      } else {
        states.push(this._updatePresent(slot, rawHands[rawIdx], canvasWidth, canvasHeight, nowMs, dtSeconds));
      }
    }
    return states;
  }

  _rawCursorPixel(landmarks, canvasWidth, canvasHeight) {
    const thumb = landmarks[LM.THUMB_TIP];
    const index = landmarks[LM.INDEX_TIP];
    const midX = (thumb.x + index.x) / 2;
    const midY = (thumb.y + index.y) / 2;
    return { x: mirrorX(midX) * canvasWidth, y: midY * canvasHeight };
  }

  // Greedy nearest-previous-position matching so identity survives frame-to-frame
  // even when MediaPipe's result array order swaps (e.g. hands crossing).
  _assignSlots(rawCursors) {
    const assignment = [-1, -1];
    const usedRaw = new Set();

    for (let i = 0; i < 2; i++) {
      const slot = this.slots[i];
      if (!slot.hasPosition) continue;
      let bestJ = -1;
      let bestDist = Infinity;
      for (let j = 0; j < rawCursors.length; j++) {
        if (usedRaw.has(j)) continue;
        const d = dist2D(slot.smoothedCursor.x, slot.smoothedCursor.y, rawCursors[j].x, rawCursors[j].y);
        if (d < bestDist) {
          bestDist = d;
          bestJ = j;
        }
      }
      if (bestJ !== -1) {
        assignment[i] = bestJ;
        usedRaw.add(bestJ);
      }
    }

    for (let j = 0; j < rawCursors.length; j++) {
      if (usedRaw.has(j)) continue;
      const freeSlot = assignment.indexOf(-1);
      if (freeSlot === -1) break;
      assignment[freeSlot] = j;
      usedRaw.add(j);
    }

    return assignment;
  }

  _updateAbsent(slot) {
    return {
      present: false,
      cursor: { ...slot.smoothedCursor },
      rawPinchDist: null,
      pinch: slot.pinchActive,
      pinchJustClosed: false,
      pinchJustOpened: false,
      pinchCloseVelocity: 0,
      pinchDurationMs: 0,
      squeezeTightness: 0,
      jitter: 0,
      handOpenness: 0,
      isPettingMotion: false,
      fingertip: null,
      strokeSpeed: 0,
      isFastRelease: false,
    };
  }

  _updatePresent(slot, landmarks, canvasWidth, canvasHeight, nowMs, dtSeconds) {
    const wrist = landmarks[LM.WRIST];
    const thumbTip = landmarks[LM.THUMB_TIP];
    const indexTip = landmarks[LM.INDEX_TIP];
    const middleMcp = landmarks[LM.MIDDLE_MCP];

    // --- cursor: mirrored midpoint of thumb/index tip, EMA-smoothed in pixel space ---
    const targetPixel = {
      x: mirrorX((thumbTip.x + indexTip.x) / 2) * canvasWidth,
      y: ((thumbTip.y + indexTip.y) / 2) * canvasHeight,
    };
    if (!slot.hasPosition) {
      slot.smoothedCursor = { ...targetPixel };
      slot.hasPosition = true;
    } else {
      slot.smoothedCursor.x = emaStep(slot.smoothedCursor.x, targetPixel.x, CONFIG.CURSOR_SMOOTHING_ALPHA);
      slot.smoothedCursor.y = emaStep(slot.smoothedCursor.y, targetPixel.y, CONFIG.CURSOR_SMOOTHING_ALPHA);
    }
    slot.lastSeenTime = nowMs;

    // --- pinch hysteresis (Schmitt trigger) ---
    const rawPinchDist = dist2D(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);
    let pinchJustClosed = false;
    let pinchJustOpened = false;
    if (!slot.pinchActive && rawPinchDist < CONFIG.PINCH_CLOSE_DIST) {
      slot.pinchActive = true;
      pinchJustClosed = true;
      slot.pinchStartTime = nowMs;
    } else if (slot.pinchActive && rawPinchDist > CONFIG.PINCH_OPEN_DIST) {
      slot.pinchActive = false;
      pinchJustOpened = true;
    }

    // --- grab force proxy (a): closing velocity at the instant of the grab ---
    let pinchCloseVelocity = 0;
    if (pinchJustClosed && slot.prevPinchDist !== null && dtSeconds > 0) {
      pinchCloseVelocity = (slot.prevPinchDist - rawPinchDist) / dtSeconds;
    }
    slot.prevPinchDist = rawPinchDist;

    slot.pinchDistHistory.push({ t: nowMs, d: rawPinchDist });
    slot.pinchDistHistory = slot.pinchDistHistory.filter((e) => nowMs - e.t <= 500);

    // --- grab force proxy (b): sustained tightness + jitter while held ---
    // Correct-feeling mapping: distance == PINCH_CLOSE_DIST (just barely triggered,
    // loose fingers) -> tightness 0 ("gentle zone"); distance -> 0 (fully mashed) -> tightness 1.
    const squeezeTightness = slot.pinchActive
      ? clamp((CONFIG.PINCH_CLOSE_DIST - rawPinchDist) / CONFIG.PINCH_CLOSE_DIST, 0, 1)
      : 0;
    const jitter = slot.pinchActive ? stdDev(slot.pinchDistHistory.map((e) => e.d)) : 0;

    const pinchDurationMs = slot.pinchActive || pinchJustOpened ? nowMs - slot.pinchStartTime : 0;

    // --- petting motion: open hand, small+slow steady fingertip motion, sustained ---
    let instSpeed = 0;
    if (slot.prevIndexTipNorm) {
      instSpeed =
        dist2D(slot.prevIndexTipNorm.x, slot.prevIndexTipNorm.y, indexTip.x, indexTip.y) /
        Math.max(dtSeconds, 1 / 120);
    }
    slot.prevIndexTipNorm = { x: indexTip.x, y: indexTip.y };

    // --- stroke speed: middle fingertip motion, tracked regardless of pinch state so
    // it still works while thumb+index are pinched holding a lizard (a second-finger rub). ---
    const middleTip = landmarks[LM.MIDDLE_TIP];
    let strokeSpeed = 0;
    if (slot.prevMiddleTipNorm) {
      strokeSpeed =
        dist2D(slot.prevMiddleTipNorm.x, slot.prevMiddleTipNorm.y, middleTip.x, middleTip.y) /
        Math.max(dtSeconds, 1 / 120);
    }
    slot.prevMiddleTipNorm = { x: middleTip.x, y: middleTip.y };

    const inPetSpeedBand =
      !slot.pinchActive && instSpeed >= CONFIG.PET_MIN_SPEED_PER_SEC && instSpeed <= CONFIG.PET_MAX_SPEED_PER_SEC;
    if (inPetSpeedBand) {
      if (slot.petDwellStart === null) slot.petDwellStart = nowMs;
    } else {
      slot.petDwellStart = null;
    }
    const isPettingMotion = slot.petDwellStart !== null && nowMs - slot.petDwellStart >= CONFIG.PET_DWELL_MS;

    // --- fast release: cursor speed over the last ~120ms at the moment of pinchJustOpened ---
    slot.cursorHistory.push({ t: nowMs, x: slot.smoothedCursor.x, y: slot.smoothedCursor.y });
    slot.cursorHistory = slot.cursorHistory.filter((e) => nowMs - e.t <= 120);

    let isFastRelease = false;
    if (pinchJustOpened && slot.cursorHistory.length >= 2 && pinchDurationMs >= CONFIG.MIN_PULL_DURATION_MS) {
      const first = slot.cursorHistory[0];
      const last = slot.cursorHistory[slot.cursorHistory.length - 1];
      const dtHist = Math.max((last.t - first.t) / 1000, 1 / 60);
      const releaseSpeed = dist2D(first.x, first.y, last.x, last.y) / dtHist;
      isFastRelease = releaseSpeed > CONFIG.FAST_RELEASE_SPEED_PX;
    }

    // --- hand openness (rough, diagnostic): avg fingertip reach vs a hand-size reference ---
    const handSizeRef = Math.max(dist2D(wrist.x, wrist.y, middleMcp.x, middleMcp.y), 0.0001);
    const tipIdxs = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP];
    const avgTipDist =
      tipIdxs.reduce((sum, idx) => sum + dist2D(wrist.x, wrist.y, landmarks[idx].x, landmarks[idx].y), 0) /
      tipIdxs.length;
    const handOpenness = avgTipDist / handSizeRef;

    return {
      present: true,
      cursor: { ...slot.smoothedCursor },
      rawPinchDist,
      pinch: slot.pinchActive,
      pinchJustClosed,
      pinchJustOpened,
      pinchCloseVelocity,
      pinchDurationMs,
      squeezeTightness,
      jitter,
      handOpenness,
      isPettingMotion,
      fingertip: { x: mirrorX(indexTip.x) * canvasWidth, y: indexTip.y * canvasHeight },
      strokeSpeed,
      isFastRelease,
    };
  }
}
