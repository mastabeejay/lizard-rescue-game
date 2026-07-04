// Central tuning knobs. Everything here is safe to edit live in devtools:
//   import { CONFIG } from './js/config.js'; CONFIG.PINCH_CLOSE_DIST = 0.05;
export const CONFIG = {
  DEBUG_SHOW_LANDMARKS: true,

  // --- Cursor & pinch (gestureEngine.js) ---
  CURSOR_SMOOTHING_ALPHA: 0.35, // EMA weight on new sample, 0..1 (higher = more responsive, less smooth)
  PINCH_CLOSE_DIST: 0.055, // normalized thumb-index distance to ENTER pinch
  PINCH_OPEN_DIST: 0.09, // normalized distance to EXIT pinch (hysteresis gap avoids flicker)

  // --- Grab force (startle + squeeze) — TUNE ME during playtesting ---
  GRAB_VELOCITY_GENTLE_MAX: 0.15, // closing speed (norm units/sec) below this = gentle grab
  GRAB_VELOCITY_STARTLE: 0.4, // closing speed above this = instant startle pain tick
  STARTLE_PAIN_AMOUNT: 18,
  SQUEEZE_BASE_RATE: 6, // pain points/sec at max tightness
  JITTER_PAIN_WEIGHT: 40, // pain points/sec per unit stddev of pinch distance
  PAIN_SAFE_TIGHTNESS: 0.5, // below this tightness, ~zero pain accrues

  // --- Petting (gestureEngine.js) ---
  PET_MAX_SPEED_PER_SEC: 0.6, // normalized units/sec, fingertip must move slower than this
  PET_MIN_SPEED_PER_SEC: 0.05, // must move at least this much (stillness isn't stroking)
  PET_DWELL_MS: 400, // min continuous time over a lizard before it counts as petting
  AFFECTION_RATE_PER_SEC: 25,
  FAST_RELEASE_SPEED_PX: 400, // px/sec cursor speed at release to count as a deliberate "fling"

  // --- Stroking with a second finger while a lizard is HELD (thumb+index pinch) ---
  ROUGH_STROKE_SPEED_PER_SEC: 1.1, // middle-fingertip speed above this while held = too rough, causes pain
  ROUGH_STROKE_PAIN_RATE: 25, // pain points/sec while stroking too roughly

  // --- Lizard mood meters (entities/lizard.js) ---
  PAIN_DECAY_PER_SEC: 3,
  AFFECTION_DECAY_PER_SEC: 2,
  PAIN_FLEE_THRESHOLD: 70,
  PAIN_SCORE_PENALTY_PER_POINT: -0.5,
  AFFECTION_BONUS_PER_POINT: 1,

  // --- Houses / scoring ---
  DANGEROUS_GRAB_PENALTY: -30,
  CHASE_AWAY_BONUS: 50,
  LOST_LIZARD_PENALTY: -10,

  // --- Slingshot / marbles ---
  MARBLE_PILE_START: 5,
  MARBLE_PILE_MAX: 5,
  MARBLE_REGEN_SEC: 8,
  MARBLE_PILE_GRAB_RADIUS: 55,
  POUCH_SNAP_RADIUS: 45,
  MAX_PULL_DIST: 220,
  LAUNCH_SPEED_SCALE: 4, // px/sec per px of pull distance
  GRAVITY: 500, // px/sec^2
  MARBLE_RADIUS: 10,
  MIN_PULL_DURATION_MS: 100, // reject glitch open->close->open frames

  // --- Hand-lost handling ---
  HAND_LOST_GRACE_MS: 250,

  // --- Spawning / difficulty ---
  SPAWN_INTERVAL_SEC_START: 4,
  SPAWN_INTERVAL_SEC_MIN: 1.5,
  SPAWN_RAMP_SEC: 60,
  MAX_ALIVE_LIZARDS: 6,
  DANGEROUS_SPAWN_CHANCE: 0.2,

  // --- Capture ---
  CAPTURE_WIDTH: 640,
  CAPTURE_HEIGHT: 480,
};
