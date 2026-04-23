import type { PortDirection } from '../nodePortUtils';

/**
 * Pure geometry helpers for routing connections in canvas space.
 * No drawing, no DOM reads — just math. The renderer calls these
 * once per connection per frame; keep them allocation-light.
 */

export interface Point {
  x: number;
  y: number;
}

export interface OrientedPoint extends Point {
  direction: PortDirection;
}

/**
 * Offset a point outward from its port direction by `distance` px.
 * Used to compute bezier control handles so the curve leaves the node
 * in the port's direction before bending toward the target.
 */
export function getControlPoint(pos: Point, direction: PortDirection, distance: number): Point {
  switch (direction) {
    case 'left':
      return { x: pos.x - distance, y: pos.y };
    case 'right':
      return { x: pos.x + distance, y: pos.y };
    case 'top':
      return { x: pos.x, y: pos.y - distance };
    case 'bottom':
      return { x: pos.x, y: pos.y + distance };
  }
}

/**
 * Compute the two cubic-bezier control points for a connection from
 * `start` to `end`. Distance scales with the straight-line length so
 * short hops stay tight and long hops sweep more.
 */
export function getControlPoints(
  start: OrientedPoint,
  end: OrientedPoint
): { cp1: Point; cp2: Point; curvature: number } {
  const distX = Math.abs(end.x - start.x);
  const distY = Math.abs(end.y - start.y);
  const dist = Math.sqrt(distX * distX + distY * distY);
  const curvature = Math.min(Math.max(dist * 0.4, 50), 200);

  const cp1 = getControlPoint(start, start.direction, curvature);
  const cp2 = getControlPoint(end, end.direction, curvature);
  return { cp1, cp2, curvature };
}

/**
 * Sample a cubic bezier at parameter `t` ∈ [0, 1]. Used to position
 * flow orbs along the visible path.
 */
export function getBezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const c0 = Math.pow(1 - t, 3);
  const c1 = 3 * Math.pow(1 - t, 2) * t;
  const c2 = 3 * (1 - t) * Math.pow(t, 2);
  const c3 = Math.pow(t, 3);
  return {
    x: c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
    y: c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
  };
}

/**
 * Orthogonal "elbow" path. Goes outward from the source in its exit
 * direction, makes one or two 90° turns, then arrives at the target
 * along its entry direction. Returns the waypoints AFTER start — the
 * caller moves the cursor to `start` first.
 */
export function buildStepSegments(start: OrientedPoint, end: OrientedPoint): Point[] {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const startHoriz = start.direction === 'left' || start.direction === 'right';
  const endHoriz = end.direction === 'left' || end.direction === 'right';

  if (startHoriz && endHoriz) {
    return [
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      { x: end.x, y: end.y },
    ];
  }
  if (!startHoriz && !endHoriz) {
    return [
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      { x: end.x, y: end.y },
    ];
  }
  if (startHoriz) {
    return [
      { x: end.x, y: start.y },
      { x: end.x, y: end.y },
    ];
  }
  return [
    { x: start.x, y: end.y },
    { x: end.x, y: end.y },
  ];
}

/**
 * Walk a polyline of waypoints and return the point at parameter
 * `t` ∈ [0, 1] along its total length. Used so a flow orb tracing a
 * step-shaped path travels at constant real-space speed and doesn't
 * skip across corners.
 */
export function lerpSegments(pts: Point[], t: number): Point {
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    lens.push(len);
    total += len;
  }
  if (total === 0) return pts[0];
  let target = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i]) {
      const localT = lens[i] === 0 ? 0 : target / lens[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * localT,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * localT,
      };
    }
    target -= lens[i];
  }
  return pts[pts.length - 1];
}
