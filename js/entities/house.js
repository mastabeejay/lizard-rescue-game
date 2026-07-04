import { pointInRect, dist2D } from "../utils.js";

// v1: single house, accepts any species. Give it a `speciesFilter` (default null)
// so per-species houses can be added later without touching drop-scoring logic.
// Placement success is gated on the door hotspot specifically, not the whole
// house silhouette, so the player has to actually steer the lizard through the door.
export class House {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.speciesFilter = null;
    this.doorCenter = { x: x + w * 0.5, y: y + h * 0.8 };
    this.doorRadius = w * 0.14;
  }

  contains(px, py) {
    return pointInRect(px, py, this.x, this.y, this.w, this.h);
  }

  containsDoor(px, py) {
    return dist2D(px, py, this.doorCenter.x, this.doorCenter.y) <= this.doorRadius;
  }

  accepts(species) {
    return this.speciesFilter === null || this.speciesFilter === species.id;
  }

  draw(ctx, highlightDoor) {
    const { x, y, w, h } = this;
    ctx.save();
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
    ctx.beginPath();
    ctx.moveTo(x - 8, y + h * 0.35);
    ctx.lineTo(x + w / 2, y - h * 0.15);
    ctx.lineTo(x + w + 8, y + h * 0.35);
    ctx.closePath();
    ctx.fillStyle = "#5d4037";
    ctx.fill();

    if (highlightDoor) {
      ctx.beginPath();
      ctx.arc(this.doorCenter.x, this.doorCenter.y, this.doorRadius * 1.6, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffee58";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = "#4e342e";
    ctx.beginPath();
    ctx.arc(this.doorCenter.x, this.doorCenter.y, this.doorRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff3e0";
    ctx.fillText("🏠 집", x + w / 2, y + h * 0.2);
    ctx.restore();
  }
}
