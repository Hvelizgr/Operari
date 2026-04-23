/**
 * Debug-mode drawing helpers. Gated behind the `?debug=ports` query
 * param in [useCanvasRenderer.ts], never shipped to end users.
 */

/**
 * Draws a large hollow ring around the computed port anchor. The ring
 * is 28px radius so it extends well beyond the node body (which
 * otherwise covers the canvas at this z-index).
 *
 * If the ring circles a visible pole button, the port math is right.
 * If the ring is offset from the pole, the delta is the port-position
 * bug you're hunting.
 *
 * Red is typically used for source outputs, blue for target inputs.
 */
export function drawPortCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  ctx.save();
  // Outer halo — bright, thick, visible even against the node card.
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.stroke();
  // Inner crosshair extending outward so at least half is outside
  // the node's covering element at z-index 2.
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 40, y);
  ctx.lineTo(x + 40, y);
  ctx.moveTo(x, y - 40);
  ctx.lineTo(x, y + 40);
  ctx.stroke();
  // Dead-center dot
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
