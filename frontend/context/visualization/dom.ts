import {
  ACCENT_HEX,
  ANIMATION_SPEED_MULT,
  FLOW_SPEED_MULT,
  FONT_SCALE_MULT,
  NODE_SHADOW_HEX,
} from './defaults';
import type { VisualizationPrefs } from './types';

/**
 * Mirror every preference onto `<html>` as data-* attributes and
 * CSS custom properties. CSS rules and the canvas renderer read
 * directly from the DOM (no prop drilling), so this function is the
 * single choke point that turns a pref change into a visible effect.
 *
 * The set of `html.setAttribute` + `html.style.setProperty` calls
 * below is also reproduced inside the first-paint bootstrap script
 * in [app/layout.tsx]. The **shape** is duplicated (because the
 * bootstrap runs before React hydrates and can't import runtime
 * code), but the **values** are shared: the bootstrap script serializes
 * ACCENT_HEX / NODE_SHADOW_HEX / *_SPEED_MULT from this file via
 * JSON.stringify, so any map change propagates to both places.
 */
export function applyToDocument(prefs: VisualizationPrefs): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;

  // data-anim stays for backwards-compat with existing CSS rules that
  // gate transitions with html[data-anim="off"]. It's flipped to
  // "off" whenever animationSpeed is "off".
  html.setAttribute('data-anim', prefs.animationSpeed === 'off' ? 'off' : 'on');
  html.setAttribute('data-anim-speed', prefs.animationSpeed);
  html.setAttribute('data-flow', prefs.flowAnimationsEnabled ? 'on' : 'off');
  html.setAttribute('data-density', prefs.nodeDensity);
  html.setAttribute('data-node-style', prefs.nodeStyle);
  html.setAttribute('data-line-style', prefs.lineStyle);
  html.setAttribute('data-flow-style', prefs.flowStyle);
  html.setAttribute('data-accent', prefs.accentColor);
  html.setAttribute('data-node-shadow', prefs.nodeShadowPreset);
  html.setAttribute('data-node-icon', prefs.nodeIconSize);
  html.setAttribute('data-edge-dash', prefs.edgeDashPattern);
  html.setAttribute('data-edge-arrow', prefs.edgeArrowEnabled ? 'on' : 'off');
  html.setAttribute('data-flow-speed', prefs.flowSpeed);
  html.setAttribute('data-pulse-variant', prefs.runningPulseVariant);
  html.setAttribute('data-flash-variant', prefs.completionFlashVariant);
  html.setAttribute('data-bg-pattern', prefs.bgPattern);
  html.setAttribute('data-minimap', prefs.minimapPosition);

  html.style.setProperty('--editor-glow', String(prefs.glowIntensity));
  html.style.setProperty(
    '--anim-duration-mult',
    String(ANIMATION_SPEED_MULT[prefs.animationSpeed] ?? 1)
  );
  html.style.setProperty('--accent-override', ACCENT_HEX[prefs.accentColor]);
  // Shadow preset override — layered on top of nodeStyle's shadow so
  // users who like the bold shape but hate the drop shadow can just
  // pick `none`.
  html.style.setProperty('--node-shadow-user', NODE_SHADOW_HEX[prefs.nodeShadowPreset]);
  // Node sizing knobs exposed as CSS vars; consumed by WorkflowNode.css.
  html.style.setProperty('--node-radius-boost', `${prefs.nodeRadiusBoost}px`);
  html.style.setProperty('--node-scale', String(prefs.nodeScale));
  // Edge knobs — read by the canvas renderer via getComputedStyle.
  html.style.setProperty('--edge-thickness', String(prefs.edgeThickness));
  html.style.setProperty('--edge-arrow-size', String(prefs.edgeArrowSize));
  html.style.setProperty('--edge-idle-opacity', String(prefs.edgeIdleOpacity));
  html.style.setProperty('--flow-particle-count', String(prefs.flowParticleCount));
  html.style.setProperty('--flow-particle-size', String(prefs.flowParticleSize));
  html.style.setProperty('--flow-speed-mult', String(FLOW_SPEED_MULT[prefs.flowSpeed] ?? 1));

  // Per-status colors — use removeProperty() when the user hasn't
  // set a custom hex so CSS `var()` fallback resolves correctly.
  // If we set the property to an empty string, `var(--status-running)`
  // would evaluate to empty (invalid for a color), NOT fall through
  // to its second argument, and WorkflowNode.css's gate selector
  // `html[style*="--status-running:"]` would match unintentionally.
  applyStatusVar(html, '--status-running', prefs.statusColors.running);
  applyStatusVar(html, '--status-success', prefs.statusColors.success);
  applyStatusVar(html, '--status-failed', prefs.statusColors.failed);
  applyStatusVar(html, '--status-idle', prefs.statusColors.idle);

  // Canvas grid knobs.
  html.style.setProperty('--grid-size', `${prefs.bgGridSize}px`);
  html.style.setProperty('--grid-opacity', String(prefs.bgGridOpacity));

  // ---------------------------------------------------------------
  // V2 React Flow editor bridge — translate the V1-shaped prefs into
  // the `--rb-*` / `--op-*` vars the V2 canvas + BaseStepNode read
  // from. Keeps the user's accent + status overrides effective on
  // the React Flow editor without consuming the context inside every
  // node component.
  // ---------------------------------------------------------------

  // Accent → V2 selected ring + node muted text accent fallback.
  const accentHex = ACCENT_HEX[prefs.accentColor];
  html.style.setProperty('--rb-node-selected', accentHex);

  // Status colors → V2 edge stroke vars. When the user clears an
  // override (null) we removeProperty so the default (--op-*)
  // resolves through the cascade.
  bridgeStatusVar(html, '--rb-edge-running', prefs.statusColors.running);
  bridgeStatusVar(html, '--rb-edge-success', prefs.statusColors.success);
  bridgeStatusVar(html, '--rb-edge-failed', prefs.statusColors.failed);
  bridgeStatusVar(html, '--rb-edge-skipped', prefs.statusColors.idle);

  // V2 personalization additions.
  html.setAttribute('data-theme', prefs.theme);
  html.setAttribute('data-font-scale', prefs.fontScale);
  html.style.setProperty('--font-scale', String(FONT_SCALE_MULT[prefs.fontScale] ?? 1));

  // Node shape / variant selectors. CSS rules in globals.css read
  // these and override `.rb-node` styling without each node having
  // to consume the visualization context.
  html.setAttribute('data-node-variant', prefs.nodeVariant);
  html.setAttribute('data-node-corners', prefs.nodeCorners);
  html.setAttribute('data-node-header-band', prefs.nodeHeaderBand ? 'on' : 'off');
  html.setAttribute('data-flow-flavor', prefs.flowFlavor);

  // Reduced-motion is an a11y override on top of animationSpeed: when
  // on, force every animation off via the existing data-anim hook so
  // CSS rules that already gate on `html[data-anim="off"]` apply.
  if (prefs.reducedMotion) {
    html.setAttribute('data-anim', 'off');
    html.setAttribute('data-anim-speed', 'off');
  }
}

function bridgeStatusVar(html: HTMLElement, name: string, value: string | null): void {
  if (value) html.style.setProperty(name, value);
  else html.style.removeProperty(name);
}

/** Apply a status color CSS var. Uses removeProperty() when value is
 *  null so `var(--status-x)` in CSS properly falls through to its
 *  fallback argument and the `html[style*="--status-x:"]` gate
 *  selectors in WorkflowNode.css stop matching. Setting to "" would
 *  leave "--status-x:" in the style attribute, making the gate match
 *  a property that evaluates to an invalid color — subtle bug. */
function applyStatusVar(html: HTMLElement, name: string, value: string | null): void {
  if (value) {
    html.style.setProperty(name, value);
  } else {
    html.style.removeProperty(name);
  }
}
