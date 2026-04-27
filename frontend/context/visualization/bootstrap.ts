import { ACCENT_HEX, ANIMATION_SPEED_MULT, FLOW_SPEED_MULT, NODE_SHADOW_HEX } from './defaults';
import { STORAGE_KEY } from './storage';

/**
 * Inline script that runs BEFORE React hydrates to apply the user's
 * saved Appearance prefs to `<html>`. Without this, the first paint
 * would flash the factory defaults (emerald/bezier/orbs/modern)
 * before the React effect fired, then jump to the user's choices.
 *
 * The script body is duplicated structurally with `applyToDocument`
 * in [./dom.ts] — it has to be, because this runs as a plain <script>
 * string before any module system exists. We keep the two in sync by
 * sharing every value mapping (ACCENT_HEX, NODE_SHADOW_HEX, the two
 * *_SPEED_MULT tables) through `JSON.stringify` so a hex tweak in
 * `./defaults.ts` flows into both places. The set of attribute names
 * and CSS-var names is still hand-written in both files — they rarely
 * change and the cost of a tiny DSL to generate them isn't worth it.
 *
 * If you add a new pref, update BOTH:
 *   - `applyToDocument` in ./dom.ts (runtime)
 *   - the literal below (first-paint)
 */
export const themeBootstrapScript = `(function(){
try{var t=localStorage.getItem('operari-theme');if(t!=='light'&&t!=='dark'&&t!=='midnight')t='dark';document.documentElement.setAttribute('data-theme',t);if(t!=='light')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}
try{
var v=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||'{}');
var html=document.documentElement;
var ACCENT_HEX=${JSON.stringify(ACCENT_HEX)};
var SHADOW_HEX=${JSON.stringify(NODE_SHADOW_HEX)};
var ANIM_MULT=${JSON.stringify(ANIMATION_SPEED_MULT)};
var FLOW_MULT=${JSON.stringify(FLOW_SPEED_MULT)};
// Derive animationSpeed from legacy animationsEnabled for first-paint compat.
var speed=v.animationSpeed||(v.animationsEnabled===false?'off':'default');
var mult=ANIM_MULT[speed]||1;
var accent=v.accentColor||'emerald';
var accentHex=ACCENT_HEX[accent]||ACCENT_HEX.emerald;
var shadow=SHADOW_HEX[v.nodeShadowPreset||'md']||SHADOW_HEX.md;
var flowSpeedMult=FLOW_MULT[v.flowSpeed||'normal']||1;
html.setAttribute('data-anim',speed==='off'?'off':'on');
html.setAttribute('data-anim-speed',speed);
html.setAttribute('data-flow',v.flowAnimationsEnabled===false?'off':'on');
html.setAttribute('data-density',v.nodeDensity||'comfortable');
html.setAttribute('data-node-style',v.nodeStyle||'modern');
html.setAttribute('data-line-style',v.lineStyle||'bezier');
html.setAttribute('data-flow-style',v.flowStyle||'orbs');
html.setAttribute('data-accent',accent);
html.setAttribute('data-node-shadow',v.nodeShadowPreset||'md');
html.setAttribute('data-node-icon',v.nodeIconSize||'md');
html.setAttribute('data-edge-dash',v.edgeDashPattern||'solid');
html.setAttribute('data-edge-arrow',v.edgeArrowEnabled?'on':'off');
html.setAttribute('data-flow-speed',v.flowSpeed||'normal');
html.setAttribute('data-pulse-variant',v.runningPulseVariant||'breathe');
html.setAttribute('data-flash-variant',v.completionFlashVariant||'flash');
html.setAttribute('data-bg-pattern',v.bgPattern||'dots');
html.setAttribute('data-minimap',v.minimapPosition||'bottom-right');
html.style.setProperty('--editor-glow',String(typeof v.glowIntensity==='number'?v.glowIntensity:1));
html.style.setProperty('--anim-duration-mult',String(mult));
html.style.setProperty('--accent-override',accentHex);
html.style.setProperty('--node-shadow-user',shadow);
html.style.setProperty('--node-radius-boost',(typeof v.nodeRadiusBoost==='number'?v.nodeRadiusBoost:0)+'px');
html.style.setProperty('--node-scale',String(typeof v.nodeScale==='number'?v.nodeScale:1));
html.style.setProperty('--edge-thickness',String(typeof v.edgeThickness==='number'?v.edgeThickness:1.6));
html.style.setProperty('--edge-arrow-size',String(typeof v.edgeArrowSize==='number'?v.edgeArrowSize:8));
html.style.setProperty('--edge-idle-opacity',String(typeof v.edgeIdleOpacity==='number'?v.edgeIdleOpacity:0.55));
html.style.setProperty('--flow-particle-count',String(typeof v.flowParticleCount==='number'?v.flowParticleCount:3));
html.style.setProperty('--flow-particle-size',String(typeof v.flowParticleSize==='number'?v.flowParticleSize:3.5));
html.style.setProperty('--flow-speed-mult',String(flowSpeedMult));
html.style.setProperty('--grid-size',(typeof v.bgGridSize==='number'?v.bgGridSize:20)+'px');
html.style.setProperty('--grid-opacity',String(typeof v.bgGridOpacity==='number'?v.bgGridOpacity:0.55));
var sc=v.statusColors||{};
// Use setProperty/removeProperty so gate selectors like
// html[style*="--status-running:"] in WorkflowNode.css match exactly
// when the user has set a custom status color, and not otherwise.
if(sc.running)html.style.setProperty('--status-running',sc.running);else html.style.removeProperty('--status-running');
if(sc.success)html.style.setProperty('--status-success',sc.success);else html.style.removeProperty('--status-success');
if(sc.failed)html.style.setProperty('--status-failed',sc.failed);else html.style.removeProperty('--status-failed');
if(sc.idle)html.style.setProperty('--status-idle',sc.idle);else html.style.removeProperty('--status-idle');
}catch(e){}
})();`;
