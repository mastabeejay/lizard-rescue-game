import { CONFIG } from "./config.js";
import { pickSpawnSpecies } from "../data/species.js";
import { Lizard } from "./entities/lizard.js";
import { House } from "./entities/house.js";
import { Slingshot } from "./entities/slingshot.js";
import { Marble } from "./entities/marble.js";
import { dist2D, clamp, lerp, randRange } from "./utils.js";

export class Game {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.score = 0;
    this.elapsed = 0;
    this.spawnTimer = CONFIG.SPAWN_INTERVAL_SEC_START;

    this.lizards = [];
    this.marbles = [];
    this.floatingTexts = [];

    this.house = new House(width - 170, height - 150, 140, 120);
    this.slingshot = new Slingshot(150, height - 90);

    // Per-hand-slot (0/1) bookkeeping.
    this.heldLizardBySlot = [null, null];
    this.handAbsentSinceBySlot = [null, null];
  }

  update(dt, handStates) {
    this.elapsed += dt;

    for (let slot = 0; slot < 2; slot++) {
      this._updateHandSlot(slot, handStates[slot], dt);
    }

    for (const lizard of this.lizards) lizard.update(dt, this.width, this.height);
    this.lizards = this.lizards.filter((l) => l.alive);

    for (const marble of this.marbles) {
      marble.update(dt);
      if (!marble.alive) continue;
      for (const lizard of this.lizards) {
        if (lizard.species.isDangerous && lizard.state === "IDLE_WANDER" && marble.hits(lizard)) {
          marble.alive = false;
          lizard.hitBySlingshot(this.width, this.height);
          this.score += CONFIG.CHASE_AWAY_BONUS;
          this._addFloatingText(lizard.x, lizard.y, `+${CONFIG.CHASE_AWAY_BONUS} 쫓아냄!`, "#2e7d32");
          break;
        }
      }
    }
    this.marbles = this.marbles.filter((m) => m.alive && !m.isOffscreen(this.width, this.height));

    this.slingshot.update(dt);
    this._updateSpawner(dt);

    for (const ft of this.floatingTexts) {
      ft.life -= dt;
      ft.y -= 20 * dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.life > 0);
  }

  _updateHandSlot(slot, hand, dt) {
    if (!hand || !hand.present) {
      this._handleAbsent(slot, dt);
      return;
    }
    this.handAbsentSinceBySlot[slot] = null;

    const heldLizard = this.heldLizardBySlot[slot];
    if (heldLizard) {
      this._updateHeldLizard(slot, heldLizard, hand, dt);
      return;
    }

    if (this.slingshot.ownerSlot === slot) {
      this._updateSlingshotInteraction(hand);
      return;
    }

    if (hand.isPettingMotion) {
      this._applyPetting(hand, dt);
    }

    if (hand.pinchJustClosed) {
      this._handlePinchDown(slot, hand);
    }
  }

  _handleAbsent(slot, dt) {
    const heldLizard = this.heldLizardBySlot[slot];
    const ownsSling = this.slingshot.ownerSlot === slot;
    if (!heldLizard && !ownsSling) return;

    this.handAbsentSinceBySlot[slot] = (this.handAbsentSinceBySlot[slot] ?? 0) + dt * 1000;
    if (this.handAbsentSinceBySlot[slot] < CONFIG.HAND_LOST_GRACE_MS) return;

    if (heldLizard) {
      heldLizard.releaseGently();
      this.heldLizardBySlot[slot] = null;
    }
    if (ownsSling) {
      if (this.slingshot.state === "HOLDING_MARBLE" || this.slingshot.state === "PULLING") {
        this.slingshot.marblePile = Math.min(CONFIG.MARBLE_PILE_MAX, this.slingshot.marblePile + 1);
      }
      this.slingshot.reset();
    }
    this.handAbsentSinceBySlot[slot] = null;
  }

  _handlePinchDown(slot, hand) {
    const cursor = hand.cursor;
    const s = this.slingshot;

    if (
      s.state === "IDLE" &&
      s.ownerSlot === null &&
      s.marblePile > 0 &&
      dist2D(cursor.x, cursor.y, s.pileCenter.x, s.pileCenter.y) <= CONFIG.MARBLE_PILE_GRAB_RADIUS
    ) {
      s.marblePile -= 1;
      s.state = "HOLDING_MARBLE";
      s.ownerSlot = slot;
      s.heldPos = { ...cursor };
      return;
    }

    if (
      s.state === "LOADED" &&
      s.ownerSlot === null &&
      dist2D(cursor.x, cursor.y, s.anchor.x, s.anchor.y) <= CONFIG.POUCH_SNAP_RADIUS
    ) {
      s.state = "PULLING";
      s.ownerSlot = slot;
      return;
    }

    const target = this._findGrabTarget(cursor.x, cursor.y);
    if (!target) return;

    if (target.species.isDangerous) {
      this.score += CONFIG.DANGEROUS_GRAB_PENALTY;
      this._addFloatingText(target.x, target.y, `${CONFIG.DANGEROUS_GRAB_PENALTY} 물렸다!`, "#c62828");
      const dx = target.x - cursor.x;
      const dy = target.y - cursor.y;
      const d = Math.hypot(dx, dy) || 1;
      target.x += (dx / d) * 40;
      target.y += (dy / d) * 40;
      return;
    }

    if (hand.pinchCloseVelocity > CONFIG.GRAB_VELOCITY_STARTLE) {
      target.addPain(CONFIG.STARTLE_PAIN_AMOUNT);
    }
    target.startHeld();
    this.heldLizardBySlot[slot] = target;
  }

  _updateHeldLizard(slot, lizard, hand, dt) {
    lizard.x = hand.cursor.x;
    lizard.y = hand.cursor.y;

    if (hand.pinch) {
      const effectiveTightness = hand.squeezeTightness < CONFIG.PAIN_SAFE_TIGHTNESS ? 0 : hand.squeezeTightness;
      const painRate = CONFIG.SQUEEZE_BASE_RATE * effectiveTightness + CONFIG.JITTER_PAIN_WEIGHT * hand.jitter;
      lizard.addPain(painRate * dt);
    }

    // Stroking with a second (middle) finger while held: gentle = affection, rough/fast = pain.
    if (hand.strokeSpeed >= CONFIG.PET_MIN_SPEED_PER_SEC && hand.strokeSpeed <= CONFIG.PET_MAX_SPEED_PER_SEC) {
      lizard.addAffection(CONFIG.AFFECTION_RATE_PER_SEC * dt);
    } else if (hand.strokeSpeed > CONFIG.ROUGH_STROKE_SPEED_PER_SEC) {
      lizard.addPain(CONFIG.ROUGH_STROKE_PAIN_RATE * dt);
    }

    if (lizard.pain >= CONFIG.PAIN_FLEE_THRESHOLD) {
      this.score += CONFIG.LOST_LIZARD_PENALTY;
      this._addFloatingText(lizard.x, lizard.y, `${CONFIG.LOST_LIZARD_PENALTY} 아파해요!`, "#c62828");
      lizard.forceFleeFromHand(this.width, this.height);
      this.heldLizardBySlot[slot] = null;
      return;
    }

    if (hand.pinchJustOpened) {
      if (this.house.containsDoor(hand.cursor.x, hand.cursor.y) && this.house.accepts(lizard.species)) {
        this._placeLizard(lizard);
      } else {
        lizard.releaseGently();
      }
      this.heldLizardBySlot[slot] = null;
    }
  }

  _updateSlingshotInteraction(hand) {
    const s = this.slingshot;

    if (s.state === "HOLDING_MARBLE") {
      s.heldPos = { ...hand.cursor };
      if (dist2D(hand.cursor.x, hand.cursor.y, s.anchor.x, s.anchor.y) <= CONFIG.POUCH_SNAP_RADIUS) {
        s.state = "LOADED";
        s.heldPos = { ...s.anchor };
      }
      if (hand.pinchJustOpened) {
        if (s.state === "LOADED") {
          s.ownerSlot = null; // sits loaded in the pouch, free for either hand to re-grab
        } else {
          s.reset(); // dropped before reaching the pouch: marble is lost
        }
      }
      return;
    }

    if (s.state === "PULLING") {
      const rawPull = { x: s.anchor.x - hand.cursor.x, y: s.anchor.y - hand.cursor.y };
      const rawDist = Math.hypot(rawPull.x, rawPull.y) || 1;
      const pullDist = Math.min(rawDist, CONFIG.MAX_PULL_DIST);
      const unit = { x: rawPull.x / rawDist, y: rawPull.y / rawDist };
      const clampedPull = { x: unit.x * pullDist, y: unit.y * pullDist };
      s.heldPos = { x: s.anchor.x - clampedPull.x, y: s.anchor.y - clampedPull.y };

      if (hand.pinchJustOpened && hand.pinchDurationMs >= CONFIG.MIN_PULL_DURATION_MS) {
        const vx = clampedPull.x * CONFIG.LAUNCH_SPEED_SCALE;
        const vy = clampedPull.y * CONFIG.LAUNCH_SPEED_SCALE;
        this.marbles.push(new Marble(s.anchor.x, s.anchor.y, vx, vy));
        s.reset();
      }
    }
  }

  _applyPetting(hand, dt) {
    const target = this._findPetTarget(hand.fingertip.x, hand.fingertip.y);
    if (!target) return;
    target.addAffection(CONFIG.AFFECTION_RATE_PER_SEC * dt);
    if (Math.random() < 0.05) this._addFloatingText(target.x, target.y - 20, "+1 ❤", "#e91e63");
  }

  _findGrabTarget(px, py) {
    for (let i = this.lizards.length - 1; i >= 0; i--) {
      const l = this.lizards[i];
      if (l.alive && l.state === "IDLE_WANDER" && l.containsPoint(px, py)) return l;
    }
    return null;
  }

  _findPetTarget(px, py) {
    for (let i = this.lizards.length - 1; i >= 0; i--) {
      const l = this.lizards[i];
      if (l.alive && l.state === "IDLE_WANDER" && !l.species.isDangerous && l.containsPoint(px, py)) return l;
    }
    return null;
  }

  _placeLizard(lizard) {
    const painPenalty = Math.round(lizard.pain * CONFIG.PAIN_SCORE_PENALTY_PER_POINT);
    const affectionBonus = Math.round(lizard.affection * CONFIG.AFFECTION_BONUS_PER_POINT);
    const total = Math.max(0, lizard.species.basePoints + painPenalty + affectionBonus);
    this.score += total;
    this._addFloatingText(lizard.x, lizard.y, `+${total}`, "#2e7d32");
    this._addFloatingText(lizard.x - 10, lizard.y - 10, "🎉", "#ffca28");
    this._addFloatingText(lizard.x + 12, lizard.y - 4, "❤", "#e91e63");
    lizard.markPlaced();
  }

  _updateSpawner(dt) {
    if (this.lizards.length >= CONFIG.MAX_ALIVE_LIZARDS) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    const rampT = clamp(this.elapsed / CONFIG.SPAWN_RAMP_SEC, 0, 1);
    this.spawnTimer = lerp(CONFIG.SPAWN_INTERVAL_SEC_START, CONFIG.SPAWN_INTERVAL_SEC_MIN, rampT);

    const species = pickSpawnSpecies(CONFIG.DANGEROUS_SPAWN_CHANCE);
    const { x, y } = this._randomEdgePosition(species.size / 2 + 10);
    this.lizards.push(new Lizard(species, x, y));
  }

  _randomEdgePosition(margin) {
    const edge = Math.floor(Math.random() * 4);
    const w = this.width;
    const h = this.height;
    if (edge === 0) return { x: margin, y: randRange(margin, h - margin) };
    if (edge === 1) return { x: w - margin, y: randRange(margin, h - margin) };
    if (edge === 2) return { x: randRange(margin, w - margin), y: margin };
    return { x: randRange(margin, w - margin), y: h - margin };
  }

  _addFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 1.2 });
  }

  draw(ctx, nowMs, handStates) {
    this.house.draw(ctx, this._isHeldLizardNearDoor());
    this.slingshot.draw(ctx);
    for (const l of this.lizards) l.draw(ctx, nowMs);
    for (const m of this.marbles) m.draw(ctx);
    this._drawHandCursors(ctx, handStates);
    this._drawFloatingTexts(ctx);
    this._drawHud(ctx);
  }

  _isHeldLizardNearDoor() {
    const hintRadius = this.house.doorRadius * 2.5;
    for (const lizard of this.heldLizardBySlot) {
      if (lizard && dist2D(lizard.x, lizard.y, this.house.doorCenter.x, this.house.doorCenter.y) <= hintRadius) {
        return true;
      }
    }
    return false;
  }

  _drawHandCursors(ctx, handStates) {
    if (!handStates) return;
    for (const hand of handStates) {
      if (!hand || !hand.present) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hand.cursor.x, hand.cursor.y, hand.pinch ? 10 : 14, 0, Math.PI * 2);
      ctx.strokeStyle = hand.pinch ? "#ffeb3b" : "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawFloatingTexts(ctx) {
    ctx.save();
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = clamp(ft.life / 1.2, 0, 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  _drawHud(ctx) {
    ctx.save();
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 4;
    ctx.textAlign = "left";
    ctx.strokeText(`점수: ${this.score}`, 20, 36);
    ctx.fillText(`점수: ${this.score}`, 20, 36);
    ctx.restore();
  }
}
