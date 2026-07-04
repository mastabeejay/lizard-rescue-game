import { CONFIG } from "../config.js";
import { circleIntersectsCircle } from "../utils.js";

export class Marble {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = CONFIG.MARBLE_RADIUS;
    this.alive = true;
  }

  update(dt) {
    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  isOffscreen(w, h) {
    return this.x < -50 || this.x > w + 50 || this.y > h + 50;
  }

  hits(lizard) {
    return circleIntersectsCircle(this.x, this.y, this.radius, lizard.x, lizard.y, lizard.radius);
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = "#616161";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
