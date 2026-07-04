import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class HandTracker {
  constructor() {
    this.landmarker = null;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const baseOptions = {
      numHands: 2,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...baseOptions,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      });
    } catch (err) {
      console.warn("GPU delegate failed for HandLandmarker, falling back to CPU", err);
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...baseOptions,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      });
    }
  }

  // Returns raw MediaPipe result: { landmarks: [[{x,y,z}, ...21], ...], handedness: [...] }
  detect(video, timestampMs) {
    if (!this.landmarker) return { landmarks: [], handedness: [] };
    return this.landmarker.detectForVideo(video, timestampMs);
  }
}
