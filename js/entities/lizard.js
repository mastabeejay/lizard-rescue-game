import { CONFIG } from "../config.js";
import { clamp, dist2D, randRange } from "../utils.js";

let nextId = 1;

// States: IDLE_WANDER -> HELD -> (PLACED | SCARED_FLEEING) ; dangerous-only: DANGEROUS_FLEEING
export class Lizard {
  constructor(species, x, y) {
    this.id = nextId++;
    this.species = species;
    this.x = x;
    this.y = y;
    this.radius = species.size / 2;
    this.state = "IDLE_WANDER";
    this.alive = true;
    this.pain = 0;
    this.affection = 0;
    this.wanderTarget = null;
    this.wanderSpeed = randRange(25, 50);
    this.vx = 0;
    this.vy = 0;
    this.fleeVX = 0;
    this.fleeVY = 0;
    this.fleeTimer = 0;
    this.settleTimer = 0;
    this.settleDuration = 0.8;
    this.shakeSeed = Math.random() * 100;
    this.facingRight = true;
    this.crawlPhase = Math.random() * 10;
  }

  addPain(amount) {
    this.pain = clamp(this.pain + amount, 0, 100);
  }

  addAffection(amount) {
    this.affection = clamp(this.affection + amount, 0, 100);
  }

  startHeld() {
    this.state = "HELD";
  }

  // Dropped without reaching the house (deliberate release or forced by pain).
  releaseGently() {
    this.state = "IDLE_WANDER";
    this.wanderTarget = null;
  }

  forceFleeFromHand(canvasW, canvasH) {
    this.state = "SCARED_FLEEING";
    this.fleeTimer = 2.5;
    this._pickFleeDirection(canvasW, canvasH);
  }

  markPlaced() {
    this.state = "PLACED";
    this.settleTimer = this.settleDuration;
  }

  hitBySlingshot(canvasW, canvasH) {
    this.state = "DANGEROUS_FLEEING";
    this._pickFleeDirection(canvasW, canvasH);
  }

  containsPoint(px, py) {
    return dist2D(px, py, this.x, this.y) <= this.radius;
  }

  update(dt, canvasW, canvasH) {
    switch (this.state) {
      case "IDLE_WANDER":
        this.pain = clamp(this.pain - CONFIG.PAIN_DECAY_PER_SEC * dt, 0, 100);
        this.affection = clamp(this.affection - CONFIG.AFFECTION_DECAY_PER_SEC * dt, 0, 100);
        this._wander(dt, canvasW, canvasH);
        break;
      case "HELD":
        // Position is driven externally by game.js each frame while held.
        break;
      case "SCARED_FLEEING":
        this.x += this.fleeVX * dt;
        this.y += this.fleeVY * dt;
        this._updateFacingAndCrawl(this.fleeVX, this.fleeVY, dt);
        this.fleeTimer -= dt;
        if (this.fleeTimer <= 0 || this._offscreen(canvasW, canvasH)) this.alive = false;
        break;
      case "DANGEROUS_FLEEING":
        this.x += this.fleeVX * dt;
        this.y += this.fleeVY * dt;
        this._updateFacingAndCrawl(this.fleeVX, this.fleeVY, dt);
        if (this._offscreen(canvasW, canvasH)) this.alive = false;
        break;
      case "PLACED":
        this.settleTimer -= dt;
        if (this.settleTimer <= 0) this.alive = false;
        break;
    }
  }

  _updateFacingAndCrawl(vx, vy, dt) {
    if (Math.abs(vx) > 2) this.facingRight = vx > 0;
    const speed = Math.hypot(vx, vy);
    this.crawlPhase += dt * (6 + speed * 0.05);
  }

  _wander(dt, w, h) {
    const margin = this.radius + 10;
    if (!this.wanderTarget || dist2D(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y) < 8) {
      this.wanderTarget = { x: randRange(margin, w - margin), y: randRange(margin, h - margin) };
    }
    const dx = this.wanderTarget.x - this.x;
    const dy = this.wanderTarget.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.vx = (dx / d) * this.wanderSpeed;
    this.vy = (dy / d) * this.wanderSpeed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this._updateFacingAndCrawl(this.vx, this.vy, dt);
  }

  _pickFleeDirection(w, h) {
    const distances = { left: this.x, right: w - this.x, top: this.y, bottom: h - this.y };
    const nearest = Object.keys(distances).reduce((a, b) => (distances[a] < distances[b] ? a : b));
    const speed = 230;
    const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[nearest];
    this.fleeVX = dir[0] * speed;
    this.fleeVY = dir[1] * speed;
  }

  _offscreen(w, h) {
    const pad = this.radius + 20;
    return this.x < -pad || this.x > w + pad || this.y < -pad || this.y > h + pad;
  }

  draw(ctx, nowMs) {
    const fleeing = this.state === "SCARED_FLEEING" || this.state === "DANGEROUS_FLEEING";
    const moving = fleeing || this.state === "IDLE_WANDER";
    const crawlBob = moving ? Math.sin(this.crawlPhase) * 3 : 0;
    const shakeX = fleeing ? Math.sin((nowMs / 1000) * 40 + this.shakeSeed) * 2 : 0;

    let scale = 1;
    let placedWiggleRot = 0;
    if (this.state === "PLACED") {
      const t = 1 - clamp(this.settleTimer / this.settleDuration, 0, 1);
      scale = 1 + Math.sin(t * Math.PI * 4) * 0.2 * (1 - t);
      placedWiggleRot = Math.sin(t * Math.PI * 6) * 0.2 * (1 - t);
    }

    const drawX = this.x + shakeX;
    const drawY = this.y + crawlBob;

    // Crawling lizard: no background shape, just the emoji flipped to face its
    // travel direction with a small bob, so it reads as walking rather than floating.
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(placedWiggleRot);
    if (!this.facingRight) ctx.scale(-1, 1);
    ctx.font = `${this.radius * 1.6 * scale}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.species.emoji, 0, 0);
    ctx.restore();

    if (this.pain > 40) {
      ctx.save();
      ctx.globalAlpha = clamp(this.pain / 100, 0.25, 0.9);
      ctx.strokeStyle = "#e53935";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(drawX, drawY, this.radius * 1.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (this.affection > 40) {
      ctx.save();
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("❤", drawX, drawY - this.radius * 1.3);
      ctx.restore();
    }
    if (this.state === "PLACED") {
      ctx.save();
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.globalAlpha = clamp(this.settleTimer / this.settleDuration, 0, 1);
      ctx.fillText("😊", drawX, drawY - this.radius * 1.2);
      ctx.restore();
    }
  }
}
