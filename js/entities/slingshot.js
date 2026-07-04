import { CONFIG } from "../config.js";

// Holds the slingshot's anchor/visual state and marble-pile supply. The
// pull-and-release *state machine* (Section 2.4 of the plan) is driven by
// game.js since it needs hand input + spawns Marble entities; this class only
// owns its own data and draws itself.
export class Slingshot {
  constructor(anchorX, anchorY) {
    this.anchor = { x: anchorX, y: anchorY };
    this.forkLeft = { x: anchorX - 22, y: anchorY - 34 };
    this.forkRight = { x: anchorX + 22, y: anchorY - 34 };
    this.pileCenter = { x: anchorX - 70, y: anchorY };

    this.state = "IDLE"; // IDLE | HOLDING_MARBLE | LOADED | PULLING
    this.heldPos = null; // virtual marble position while HOLDING_MARBLE/LOADED/PULLING
    this.ownerSlot = null; // which hand slot (0/1) currently owns the interaction

    this.marblePile = CONFIG.MARBLE_PILE_START;
    this.marbleRegenTimer = 0;
  }

  update(dt) {
    if (this.marblePile < CONFIG.MARBLE_PILE_MAX) {
      this.marbleRegenTimer += dt;
      if (this.marbleRegenTimer >= CONFIG.MARBLE_REGEN_SEC) {
        this.marbleRegenTimer = 0;
        this.marblePile = Math.min(CONFIG.MARBLE_PILE_MAX, this.marblePile + 1);
      }
    }
  }

  reset() {
    this.state = "IDLE";
    this.heldPos = null;
    this.ownerSlot = null;
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.forkLeft.x, this.forkLeft.y);
    ctx.lineTo(this.anchor.x, this.anchor.y + 20);
    ctx.lineTo(this.forkRight.x, this.forkRight.y);
    ctx.stroke();

    if (this.state === "LOADED" || this.state === "PULLING") {
      const tip = this.heldPos || this.anchor;
      ctx.strokeStyle = "#a1887f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.forkLeft.x, this.forkLeft.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(this.forkRight.x, this.forkRight.y);
      ctx.stroke();
      ctx.fillStyle = "#616161";
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, CONFIG.MARBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state === "HOLDING_MARBLE" && this.heldPos) {
      ctx.fillStyle = "#616161";
      ctx.beginPath();
      ctx.arc(this.heldPos.x, this.heldPos.y, CONFIG.MARBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < this.marblePile; i++) {
      ctx.fillStyle = "#757575";
      ctx.beginPath();
      ctx.arc(
        this.pileCenter.x + (i % 3) * 14,
        this.pileCenter.y + 10 - Math.floor(i / 3) * 14,
        CONFIG.MARBLE_RADIUS * 0.8,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#3e2723";
    ctx.textAlign = "center";
    ctx.fillText(`구슬 x${this.marblePile}`, this.pileCenter.x + 14, this.pileCenter.y + 36);
    ctx.restore();
  }
}
