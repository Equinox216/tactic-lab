import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import * as d3 from "d3";

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const VERSION = "v1.5”;
const PITCH = { w: 65, h: 45 };
const SCALE = 12;
const PW = PITCH.w * SCALE, PH = PITCH.h * SCALE, PAD = 30;
const FULL_W = PW + PAD * 2, FULL_H = PH + PAD * 2;

const ROLES = [
{ id: “GK”, label: “Goalkeeper”, short: “GK” },
{ id: “CB”, label: “Center Back”, short: “CB” },
{ id: “FB”, label: “Full Back”, short: “FB” },
{ id: “DM”, label: “Defensive Mid”, short: “DM” },
{ id: “CM”, label: “Central Mid”, short: “CM” },
{ id: “AM”, label: “Attacking Mid”, short: “AM” },
{ id: “W”, label: “Winger”, short: “W” },
{ id: “ST”, label: “Striker”, short: “ST” },
];

const ROLE_COLORS = { GK:”#f59e0b”, CB:”#3b82f6”, FB:”#6366f1”, DM:”#14b8a6”, CM:”#10b981”, AM:”#8b5cf6”, W:”#ec4899”, ST:”#ef4444” };

const PRESETS = [
{ id: “press_high”, label: “Press High”, dx: 12, dy: 0, desc: “Push forward aggressively” },
{ id: “drop_deep”, label: “Drop Deep”, dx: -12, dy: 0, desc: “Fall back into defensive shape” },
{ id: “overlap_left”, label: “Overlap Left”, dx: 8, dy: -8, desc: “Overlap run down the left” },
{ id: “overlap_right”, label: “Overlap Right”, dx: 8, dy: 8, desc: “Overlap run down the right” },
{ id: “tuck_inside”, label: “Tuck Inside”, dx: 2, dy: (p) => p.my < PITCH.h / 2 ? 6 : -6, desc: “Cut inward from wide” },
{ id: “hold_position”, label: “Hold Position”, dx: 0, dy: 0, desc: “Stay in current position” },
{ id: “push_wide”, label: “Push Wide”, dx: 0, dy: (p) => p.my < PITCH.h / 2 ? -6 : 6, desc: “Stretch wide” },
{ id: “advance_carry”, label: “Advance w/ Ball”, dx: 15, dy: 0, desc: “Carry the ball forward” },
];

const FORMATIONS = {
“2-3-1”: { label: “2-3-1”, pos: [
{ x:.04,y:.5,role:“GK” },{ x:.22,y:.28,role:“CB” },{ x:.22,y:.72,role:“CB” },
{ x:.48,y:.15,role:“W” },{ x:.48,y:.5,role:“CM” },{ x:.48,y:.85,role:“W” },{ x:.72,y:.5,role:“ST” }
]},
“3-2-1”: { label: “3-2-1”, pos: [
{ x:.04,y:.5,role:“GK” },{ x:.22,y:.2,role:“FB” },{ x:.22,y:.5,role:“CB” },{ x:.22,y:.8,role:“FB” },
{ x:.48,y:.35,role:“CM” },{ x:.48,y:.65,role:“CM” },{ x:.75,y:.5,role:“ST” }
]},
“3-1-2”: { label: “3-1-2”, pos: [
{ x:.04,y:.5,role:“GK” },{ x:.22,y:.2,role:“FB” },{ x:.22,y:.5,role:“CB” },{ x:.22,y:.8,role:“FB” },
{ x:.45,y:.5,role:“CM” },{ x:.7,y:.32,role:“ST” },{ x:.7,y:.68,role:“ST” }
]},
“1-2-2-2”: { label: “Diamond”, pos: [
{ x:.04,y:.5,role:“GK” },{ x:.2,y:.5,role:“CB” },{ x:.38,y:.25,role:“CM” },{ x:.38,y:.75,role:“CM” },
{ x:.58,y:.25,role:“W” },{ x:.58,y:.75,role:“W” },{ x:.75,y:.5,role:“ST” }
]},
“2-1-2-1”: { label: “2-1-2-1”, pos: [
{ x:.04,y:.5,role:“GK” },{ x:.2,y:.3,role:“CB” },{ x:.2,y:.7,role:“CB” },{ x:.38,y:.5,role:“DM” },
{ x:.56,y:.25,role:“W” },{ x:.56,y:.75,role:“W” },{ x:.75,y:.5,role:“ST” }
]},
“1-3-2”: { label: “1-3-2”, pos: [
{ x:.04,y:.5,role:“GK” },{ x:.2,y:.5,role:“CB” },{ x:.42,y:.15,role:“W” },{ x:.42,y:.5,role:“CM” },
{ x:.42,y:.85,role:“W” },{ x:.68,y:.35,role:“ST” },{ x:.68,y:.65,role:“ST” }
]},
};

const SET_PIECES = {
// Corners — attacking (opponent’s half, x ~ 0.93-0.97)
corner_left: { label: “Corner (Left)”, ballPos: { x: 0.97, y: 0.02 }, positions: [
{x:.04,y:.5},{x:.75,y:.25},{x:.78,y:.45},{x:.78,y:.6},{x:.82,y:.35},{x:.82,y:.6},{x:.97,y:.02}
]},
corner_right: { label: “Corner (Right)”, ballPos: { x: 0.97, y: 0.98 }, positions: [
{x:.04,y:.5},{x:.75,y:.75},{x:.78,y:.4},{x:.78,y:.55},{x:.82,y:.4},{x:.82,y:.65},{x:.97,y:.98}
]},
free_kick_central: { label: “Free Kick (Central)”, ballPos: { x: 0.55, y: 0.5 }, positions: [
{x:.04,y:.5},{x:.3,y:.35},{x:.3,y:.65},{x:.52,y:.35},{x:.52,y:.65},{x:.58,y:.5},{x:.55,y:.5}
]},
goal_kick: { label: “Goal Kick”, ballPos: { x: 0.06, y: 0.5 }, positions: [
{x:.04,y:.5},{x:.15,y:.25},{x:.15,y:.75},{x:.35,y:.15},{x:.35,y:.5},{x:.35,y:.85},{x:.55,y:.5}
]},
throw_in_left: { label: “Throw-in (Left)”, ballPos: { x: 0.5, y: 0 }, positions: [
{x:.04,y:.5},{x:.35,y:.3},{x:.35,y:.6},{x:.48,y:.1},{x:.48,y:.35},{x:.55,y:.2},{x:.5,y:.02}
]},
throw_in_right: { label: “Throw-in (Right)”, ballPos: { x: 0.5, y: 1 }, positions: [
{x:.04,y:.5},{x:.35,y:.4},{x:.35,y:.7},{x:.48,y:.65},{x:.48,y:.9},{x:.55,y:.8},{x:.5,y:.98}
]},
};

const PHASE_LABELS = [“Attacking”, “Defending”];
const PHASE_COLORS = [”#22c55e”, “#ef4444”];

const toPixel = (mx, my) => ({ px: PAD + mx * SCALE, py: PAD + my * SCALE });
const toMeter = (px, py) => ({ mx: Math.max(0, Math.min(PITCH.w, (px - PAD) / SCALE)), my: Math.max(0, Math.min(PITCH.h, (py - PAD) / SCALE)) });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Grid zones: 4 columns × 4 rows = 16 zones, numbered 1-16 ───
// Columns: Defensive | Def-Mid | Att-Mid | Attacking
// Rows: Left | Centre-Left | Centre-Right | Right
const GRID_COLS = 4;
const GRID_ROWS = 4;
// Zone number 1-16 left-to-right, top-to-bottom
const zoneNum = (col, row) => row * GRID_COLS + col + 1;
const zoneId = (col, row) => `${col}-${row}`;
const zoneFromId = (zid) => { const [c,r]=zid.split(”-”).map(Number); return {col:c,row:r}; };
// Returns pixel rect for a zone
const zoneRect = (col, row) => ({
x: PAD + (col / GRID_COLS) * PW,
y: PAD + (row / GRID_ROWS) * PH,
w: PW / GRID_COLS,
h: PH / GRID_ROWS,
});
// Zone center in meters
const zoneCenterM = (col, row) => ({
mx: (col + 0.5) / GRID_COLS * PITCH.w,
my: (row + 0.5) / GRID_ROWS * PITCH.h,
});
// Find nearest zone for a player position
const nearestZone = (mx, my) => {
let best = “0-0”, bestD = Infinity;
for(let c=0;c<GRID_COLS;c++) for(let r=0;r<GRID_ROWS;r++){
const cz = zoneCenterM(c,r);
const d = Math.sqrt((mx-cz.mx)**2+(my-cz.my)**2);
if(d<bestD){bestD=d;best=zoneId(c,r);}
}
return best;
};

function mirror(pos) { return pos.map(p => ({ …p, x: 1 - p.x })); }

function makeTeam(fKey, team, existingNames) {
const f = FORMATIONS[fKey];
const ps = team === “away” ? mirror(f.pos) : f.pos;
return ps.map((p, i) => ({
id: `${team}-${i}`, team, num: i + 1,
name: existingNames?.[i] || “”,
role: p.role, role2: null,
mx: p.x * PITCH.w, my: p.y * PITCH.h,
zones: [],
instructions: “”, preset: null,
coverTarget: null,
// Player stats
jerseyNum: i + 1,
foot: “R”,
age: “”,
goals: 0,
assists: 0,
onBench: false,
}));
}

function makeSubstitutes(team) {
return Array.from({length:3}, (_,i) => ({
id: `${team}-sub-${i}`, team,
num: 8 + i, jerseyNum: 8 + i,
name: “”, role: “CM”, role2: null,
mx: 0, my: 0, zones: [],
instructions: “”, preset: null, coverTarget: null,
foot: “R”, age: “”, goals: 0, assists: 0,
onBench: true,
}));
}

// ═══════════════════════════════════════════════════════
// PITCH SVG
// ═══════════════════════════════════════════════════════
function PitchSVG({ children, homeName, awayName, showOpponent, svgRef }) {
const stripes = useMemo(() => {
const s = [], sw = PW / 10;
for (let i = 0; i < 10; i++) s.push(<rect key={i} x={PAD+i*sw} y={PAD} width={sw} height={PH} fill={i%2===0?”#2a7d2a”:”#268f26”} />);
return s;
}, []);
return (
<svg ref={svgRef}
viewBox={`0 0 ${FULL_W} ${FULL_H}`}
preserveAspectRatio=“xMidYMid meet”
style={{ width:“100%”, height:“100%”, borderRadius:10, display:“block”, touchAction:“none”, userSelect:“none”, WebkitUserSelect:“none” }}
onTouchStart={e=>e.preventDefault()}>
<rect width={FULL_W} height={FULL_H} fill="#1a5c1a" />
{stripes}
<rect x={PAD} y={PAD} width={PW} height={PH} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
<line x1={PAD+PW/2} y1={PAD} x2={PAD+PW/2} y2={PAD+PH} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
<circle cx={PAD+PW/2} cy={PAD+PH/2} r={PH*0.17} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
<circle cx={PAD+PW/2} cy={PAD+PH/2} r={3} fill="rgba(255,255,255,0.6)" />
<rect x={PAD} y={PAD+PH/2-PH*0.28} width={PW*0.07} height={PH*0.56} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} />
<rect x={PAD+PW-PW*0.07} y={PAD+PH/2-PH*0.28} width={PW*0.07} height={PH*0.56} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} />
<rect x={PAD} y={PAD+PH/2-PH*0.4} width={PW*0.15} height={PH*0.8} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
<rect x={PAD+PW-PW*0.15} y={PAD+PH/2-PH*0.4} width={PW*0.15} height={PH*0.8} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
<rect x={PAD-8} y={PAD+PH/2-24} width={8} height={48} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2} rx={2} />
<rect x={PAD+PW} y={PAD+PH/2-24} width={8} height={48} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2} rx={2} />
{/* Team names */}
<text x={PAD+PW*0.25} y={PAD-10} textAnchor=“middle” fontSize={11} fill=”#ef4444” fontWeight=“700” style={{fontFamily:”‘Outfit’,sans-serif”}}>{homeName || “Home”}</text>
{showOpponent && <text x={PAD+PW*0.75} y={PAD-10} textAnchor=“middle” fontSize={11} fill=”#3b82f6” fontWeight=“700” style={{fontFamily:”‘Outfit’,sans-serif”}}>{awayName || “Away”}</text>}
{children}
</svg>
);
}

// ═══════════════════════════════════════════════════════
// PLAYER DOT
// ═══════════════════════════════════════════════════════
function PlayerDot({ player, selected, onSelect, onDrag, onDragEnd, isHome, showData, ghost }) {
const fill = player.role === “GK” ? “#f59e0b” : (isHome ? “#ef4444” : “#3b82f6”);
const r = selected ? 16 : 14;

const gRef = useRef(null);
// dragState holds everything needed during a drag — no React state involved
const dragState = useRef({ active: false, offsetX: 0, offsetY: 0, curMx: player.mx, curMy: player.my, pointerId: null });

useEffect(() => {
dragState.current.curMx = player.mx;
dragState.current.curMy = player.my;
}, [player.mx, player.my]);

const getSVGPoint = (clientX, clientY) => {
const svg = gRef.current?.closest(“svg”);
if (!svg) return null;
const rect = svg.getBoundingClientRect();
return {
svgX: (clientX - rect.left) * (FULL_W / rect.width),
svgY: (clientY - rect.top)  * (FULL_H / rect.height),
};
};

const { px: basePx, py: basePy } = toPixel(player.mx, player.my);

const handlePointerDown = (e) => {
e.stopPropagation();
e.preventDefault();
try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
dragState.current.pointerId = e.pointerId;
dragState.current.active = false;
const pos = getSVGPoint(e.clientX, e.clientY);
if (!pos) return;
dragState.current.offsetX = pos.svgX - basePx;
dragState.current.offsetY = pos.svgY - basePy;
dragState.current.curMx = player.mx;
dragState.current.curMy = player.my;
};

const handlePointerMove = (e) => {
if (dragState.current.pointerId === null) return;
if (e.pointerId !== dragState.current.pointerId) return;
e.preventDefault();
const pos = getSVGPoint(e.clientX, e.clientY);
if (!pos) return;
dragState.current.active = true;
const { mx, my } = toMeter(
pos.svgX - dragState.current.offsetX,
pos.svgY - dragState.current.offsetY
);
dragState.current.curMx = mx;
dragState.current.curMy = my;
if (gRef.current) {
const { px: npx, py: npy } = toPixel(mx, my);
gRef.current.setAttribute(“transform”, `translate(${npx - basePx},${npy - basePy})`);
}
};

const handlePointerUp = (e) => {
if (e.pointerId !== dragState.current.pointerId) return;
dragState.current.pointerId = null;
try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(_) {}
if (dragState.current.active) {
onDragEnd(player.id, dragState.current.curMx, dragState.current.curMy);
if (gRef.current) gRef.current.removeAttribute(“transform”);
} else {
onSelect(player.id);
}
dragState.current.active = false;
};

// iOS Safari fires pointercancel instead of pointerup when scroll intercepts — commit position
const handlePointerCancel = (e) => {
if (e.pointerId !== dragState.current.pointerId) return;
dragState.current.pointerId = null;
if (dragState.current.active) {
onDragEnd(player.id, dragState.current.curMx, dragState.current.curMy);
if (gRef.current) gRef.current.removeAttribute(“transform”);
}
dragState.current.active = false;
};

const getInitials = (name) => {
const parts = name.trim().split(/\s+/);
if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
const displayName = player.name || `#${player.jerseyNum ?? player.num}`;
const roleLabel = player.role2 ? `${player.role}/${player.role2}` : player.role;
const circleLabel = player.name ? getInitials(player.name) : String(player.jerseyNum ?? player.num);
const circleFontSize = player.name ? (circleLabel.length > 1 ? 8 : 10) : 10;
const { px, py } = toPixel(player.mx, player.my);

return (
<g ref={gRef} style={{ cursor: “grab”, opacity: ghost ? 0.55 : 1 }}>
<ellipse cx={px+2} cy={py+3} rx={r*0.8} ry={r*0.4} fill="rgba(0,0,0,0.3)" />
{selected && <circle cx={px} cy={py} r={r+6} fill="none" stroke="#fff" strokeWidth={2} opacity={0.5}>
<animate attributeName=“r” values={`${r+4};${r+8};${r+4}`} dur=“1.5s” repeatCount=“indefinite” />
</circle>}
{player.preset && <circle cx={px+r-2} cy={py-r+2} r={4} fill="#f59e0b" stroke="#000" strokeWidth={1} />}
{/* hasBall indicator — larger ball on top of circle, clearly distinct from preset */}
{player.hasBall && (
<g>
<circle cx={px} cy={py-r-7} r={8} fill="#f5f5f0" stroke="#111" strokeWidth={1.5}/>
<circle cx={px-2} cy={py-r-9} r={2} fill="#bbb"/>
<circle cx={px+2} cy={py-r-5} r={1.5} fill="#ccc"/>
<text x={px} y={py-r-4} textAnchor="middle" dominantBaseline="middle" fontSize={8} pointerEvents="none">⚽</text>
</g>
)}
{/* Touch target — larger invisible hit area for mobile */}
<circle cx={px} cy={py} r={r+10} fill=“transparent” pointerEvents=“all”
onPointerDown={handlePointerDown}
onPointerMove={handlePointerMove}
onPointerUp={handlePointerUp}
onPointerCancel={handlePointerCancel}
style={{ touchAction: “none”, WebkitTouchCallout:“none” }} />
<circle cx={px} cy={py} r={r} fill={fill} stroke=”#fff” strokeWidth={2} pointerEvents=“none”
style={{ filter: selected ? `drop-shadow(0 0 8px ${fill})` : “none” }} />
<text x={px} y={py+1} textAnchor=“middle” dominantBaseline=“middle” fontSize={circleFontSize} fontWeight=“900” fill=”#fff” pointerEvents=“none”
style={{ fontFamily:”‘Outfit’,sans-serif”, letterSpacing: player.name?”-0.5px”:“0” }}>{circleLabel}</text>
<text x={px} y={py+r+12} textAnchor=“middle” fontSize={8.5} fill=”#fff” pointerEvents=“none” fontWeight=“800”
style={{ fontFamily:”‘Outfit’,sans-serif” }}>{displayName}</text>
<text x={px} y={py+r+22} textAnchor=“middle” fontSize={7} fill=“rgba(255,255,255,0.55)” pointerEvents=“none” fontWeight=“600”
style={{ fontFamily:”‘Outfit’,sans-serif” }}>{roleLabel}</text>
{showData && isHome && (
<text x={px} y={py-r-6} textAnchor=“middle” fontSize={7} fill=“rgba(255,255,200,0.7)” pointerEvents=“none” style={{fontFamily:“monospace”}}>
{player.mx.toFixed(0)}m, {player.my.toFixed(0)}m
</text>
)}
</g>
);
}

// ═══════════════════════════════════════════════════════
// OVERLAYS
// ═══════════════════════════════════════════════════════
function CoverLines({ home, away }) {
return <>{home.filter(h=>h.coverTarget).map(h=>{
const t=away.find(a=>a.id===h.coverTarget); if(!t) return null;
const f=toPixel(h.mx,h.my),to=toPixel(t.mx,t.my);
return <g key={`cv-${h.id}`}>
<line x1={f.px} y1={f.py} x2={to.px} y2={to.py} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6}/>
<circle cx={to.px} cy={to.py} r={18} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.4}/>
</g>;
})}</>;
}

function DataOverlay({ players }) {
const home = players.filter(p=>p.team===“home”);
if(home.length<2) return null;
const pts = home.map(p=>toPixel(p.mx,p.my));
const hull = d3.polygonHull(pts.map(p=>[p.px,p.py]));
const lanes = [];
for(let i=0;i<home.length;i++) for(let j=i+1;j<home.length;j++){
const dist=Math.sqrt((home[i].mx-home[j].mx)**2+(home[i].my-home[j].my)**2);
if(dist<20){const a=toPixel(home[i].mx,home[i].my),b=toPixel(home[j].mx,home[j].my);
lanes.push(<g key={`l-${i}-${j}`}>
<line x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke="rgba(255,255,100,0.15)" strokeWidth={8} strokeLinecap="round"/>
<text x={(a.px+b.px)/2} y={(a.py+b.py)/2-4} textAnchor=“middle” fontSize={8} fill=“rgba(255,255,200,0.6)” style={{fontFamily:“monospace”}}>{dist.toFixed(1)}m</text>
</g>);
}
}
return <g>{hull&&<polygon points={hull.map(p=>p.join(”,”)).join(” “)} fill=“rgba(239,68,68,0.06)” stroke=“rgba(239,68,68,0.3)” strokeWidth={1.5} strokeDasharray=“6 4”/>}{lanes}</g>;
}

function Arrows({ from, to, color }) {
return <g>{from.map((fp,i)=>{
const tp=to[i]; if(!tp) return null;
const d=Math.sqrt((fp.mx-tp.mx)**2+(fp.my-tp.my)**2); if(d<1) return null;
const f=toPixel(fp.mx,fp.my),t=toPixel(tp.mx,tp.my);
const a=Math.atan2(t.py-f.py,t.px-f.px);
const ex=t.px-Math.cos(a)*16,ey=t.py-Math.sin(a)*16;
return <g key={`ar-${fp.id}`}>
<line x1={f.px} y1={f.py} x2={ex} y2={ey} stroke={color} strokeWidth={2} opacity={0.5} strokeDasharray="4 4"/>
<polygon points={`${t.px},${t.py} ${t.px-8*Math.cos(a-.4)},${t.py-8*Math.sin(a-.4)} ${t.px-8*Math.cos(a+.4)},${t.py-8*Math.sin(a+.4)}`} fill={color} opacity={0.6}/>
</g>;
})}</g>;
}

// Static ball marker for set pieces
function SetPieceBall({ mx, my }) {
const { px, py } = toPixel(mx, my);
return <g pointerEvents="none">
<ellipse cx={px+2} cy={py+3} rx={7} ry={3.5} fill="rgba(0,0,0,0.3)"/>
<circle cx={px} cy={py} r={8} fill="#f5f5f0" stroke="#222" strokeWidth={1.5}/>
<path d={`M${px-3},${py-2} Q${px},${py-6} ${px+3},${py-2}`} fill=“none” stroke=”#999” strokeWidth={0.8}/>
<path d={`M${px-4},${py+1} Q${px-2},${py+4} ${px+1},${py+3}`} fill=“none” stroke=”#999” strokeWidth={0.8}/>
</g>;
}

// ─── Mini pitch for phase comparison / pattern preview ───
function MiniPitch({ home, away, label, color, onClick, active }) {
const S = 0.22; // scale factor relative to full pitch
const mw = FULL_W * S, mh = FULL_H * S;
return (
<div onClick={onClick} style={{cursor:onClick?“pointer”:“default”,display:“flex”,flexDirection:“column”,alignItems:“center”,gap:4}}>
<svg width={mw} height={mh} viewBox={`0 0 ${FULL_W} ${FULL_H}`}
style={{borderRadius:6,border:`2px solid ${active?color:"rgba(255,255,255,0.08)"}`,display:“block”,transition:“border-color 0.15s”}}>
<rect width={FULL_W} height={FULL_H} fill="#1a5c1a"/>
{/* Stripes */}
{Array.from({length:10},(_,i)=><rect key={i} x={PAD+i*PW/10} y={PAD} width={PW/10} height={PH} fill={i%2===0?”#2a7d2a”:”#268f26”}/>)}
<rect x={PAD} y={PAD} width={PW} height={PH} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={3}/>
<line x1={PAD+PW/2} y1={PAD} x2={PAD+PW/2} y2={PAD+PH} stroke="rgba(255,255,255,0.35)" strokeWidth={2}/>
<circle cx={PAD+PW/2} cy={PAD+PH/2} r={PH*0.17} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={2}/>
{away && away.map((p,i)=>{const{px,py}=toPixel(p.mx,p.my);return<circle key={i} cx={px} cy={py} r={14} fill="#3b82f6" stroke="#fff" strokeWidth={2} opacity={0.7}/>;})}
{home && home.map((p,i)=>{const{px,py}=toPixel(p.mx,p.my);return<circle key={i} cx={px} cy={py} r={14} fill={p.role===“GK”?”#f59e0b”:”#ef4444”} stroke=”#fff” strokeWidth={2}/>;})}
</svg>
{label && <div style={{fontSize:9,fontWeight:700,color:active?color:”#64748b”,letterSpacing:0.5,textTransform:“uppercase”,fontFamily:”‘Outfit’,sans-serif”}}>{label}</div>}
</div>
);
}
function ZoneOverlay({ players, selectedId, showGrid }) {
const selPlayer = players.find(p=>p.id===selectedId);
const selZones = selPlayer ? (selPlayer.zones||[]) : [];

// All active zones across all home players (for context)
const allZones = {};
players.filter(p=>p.team===“home”).forEach(p=>{
(p.zones||[]).forEach(zid=>{
if(!allZones[zid]) allZones[zid]=[];
allZones[zid].push(p);
});
});

const cells = [];
for(let col=0;col<GRID_COLS;col++){
for(let row=0;row<GRID_ROWS;row++){
const zid=zoneId(col,row);
const num=zoneNum(col,row);
const rect=zoneRect(col,row);
const isSel=selZones.includes(zid);
const others=(allZones[zid]||[]).filter(p=>p.id!==selectedId);
const hasOther=others.length>0;
const show = showGrid || isSel || (hasOther && !!selectedId);

```
  cells.push(
    <g key={zid} pointerEvents="none">
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h}
        fill={isSel?"rgba(239,68,68,0.18)":(hasOther&&selectedId)?"rgba(59,130,246,0.06)":"transparent"}
        stroke={isSel?"rgba(239,68,68,0.65)":showGrid?"rgba(255,255,255,0.08)":"transparent"}
        strokeWidth={isSel?1.5:0.5}
      />
      {show && <text x={rect.x+rect.w/2} y={rect.y+rect.h/2} textAnchor="middle" dominantBaseline="middle"
        fontSize={isSel?12:8}
        fill={isSel?"rgba(239,68,68,0.9)":hasOther?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.15)"}
        fontWeight="800" style={{fontFamily:"'Outfit',sans-serif"}}>
        {num}
      </text>}
    </g>
  );
}
```

}
return <g>{cells}</g>;
}

// ═══════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════
function Panel({title,children,accent}){return(

  <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
    {title&&<div style={{fontSize:10,textTransform:"uppercase",letterSpacing:2,color:accent||"#64748b",marginBottom:10,fontWeight:700,fontFamily:"'Outfit',sans-serif"}}>{title}</div>}
    {children}
  </div>
);}
function Chip({label,active,onClick,color,small}){return(
  <button onClick={onClick} style={{
    background:active?(color||"rgba(255,255,255,0.12)"):"rgba(255,255,255,0.04)",
    color:active?"#fff":"#94a3b8",
    border:`1px solid ${active?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.06)"}`,
    borderRadius:6,
    padding:small?"clamp(2px,0.4vw,4px) clamp(5px,0.8vw,8px)":"clamp(4px,0.5vw,6px) clamp(7px,1vw,11px)",
    fontSize:"clamp(9px,1.1vw,11px)",
    fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.15s",
    whiteSpace:"nowrap"
  }}>{label}</button>
);}
function Btn({children,onClick,bg,disabled,small}){return(
  <button onClick={onClick} disabled={disabled} style={{
    background:disabled?"#1e293b":(bg||"#1e293b"),
    color:disabled?"#475569":"#fff",
    border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:8,
    padding:small?"clamp(4px,0.5vw,6px) clamp(8px,1vw,11px)":"clamp(6px,0.7vw,9px) clamp(10px,1.2vw,15px)",
    fontSize:"clamp(10px,1.1vw,12px)",
    fontWeight:600,cursor:disabled?"default":"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.15s",
    whiteSpace:"nowrap"
  }}>{children}</button>
);}
function Input({value,onChange,placeholder,style:s}){return(
  <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{
    background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,
    color:"#e2e8f0",padding:"5px 8px",fontSize:11,fontFamily:"'Outfit',sans-serif",outline:"none",width:"100%",...s}}/>
);}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function BandidosTacticLab() {
const [homeName, setHomeName] = useState(“Bandidos”);
const [awayName, setAwayName] = useState(“Opponent”);
const [phaseForms, setPhaseForms] = useState({ 0: { home:“2-3-1”, away:“3-2-1” }, 1: { home:“2-3-1”, away:“3-2-1” } });
const [showOpp, setShowOpp] = useState(true);
const [showData, setShowData] = useState(false);
const [showArrows, setShowArrows] = useState(true);
const [selected, setSelected] = useState(null);
const [mode, setMode] = useState(“tactics”);
const [setPiece, setSetPiece] = useState(null);
const [showGrid, setShowGrid] = useState(false);
const [flipped, setFlipped] = useState(false);
const [phaseNotes, setPhaseNotes] = useState({ 0:””, 1:”” });
const [ball, _ball] = useState(null); // removed — hasBall on player instead

const toggleHasBall = useCallback((playerId) => {
setPhases(prev => {
const n = {…prev};
for(let i=0;i<2;i++) n[i] = {
home: n[i].home.map(p=>({…p, hasBall: p.id===playerId ? !p.hasBall : false})),
away: n[i].away.map(p=>({…p, hasBall: p.id===playerId ? !p.hasBall : false})),
};
return n;
});
}, []);

// ─── Substitutes bench ───
const [homeSubs, setHomeSubs] = useState(() => makeSubstitutes(“home”));
const [awaySubs, setAwaySubs] = useState(() => makeSubstitutes(“away”));
const [showSubPlanner, _setShowSubPlanner] = useState(false); // reserved

// ─── Tactics slots (5 slots, slot 0 is active) ───
const EMPTY_SLOT = { label: “Empty”, phases: null, phaseNotes: null, homeSubs: null, awaySubs: null };
const [tacticSlots, setTacticSlots] = useState(() => [
{ label: “Tactic 1”, phases: null, phaseNotes: null, homeSubs: null, awaySubs: null },
EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT,
]);
const [activeSlot, setActiveSlot] = useState(0);
const [showSlots, setShowSlots] = useState(false);
const [tacticName, setTacticName] = useState(“Tactic 1”);

const pitchSvgRef = useRef(null);

const [phases, setPhases] = useState(() => {
const base = { home: makeTeam(“2-3-1”,“home”), away: makeTeam(“3-2-1”,“away”) };
return { 0: base, 1: JSON.parse(JSON.stringify(base)) };
});
const [phase, setPhase] = useState(0);
const homeForm = phaseForms[phase].home;
const awayForm = phaseForms[phase].away;
const setHomeForm = (k) => setPhaseForms(prev => ({…prev, [phase]: {…prev[phase], home:k}}));
const setAwayForm = (k) => setPhaseForms(prev => ({…prev, [phase]: {…prev[phase], away:k}}));
const [anim, setAnim] = useState(false);
const [animProg, setAnimProg] = useState(0);
const [animSpd, setAnimSpd] = useState(1);
const animRef = useRef(null);

// ─── Undo / Redo ───
const undoStack = useRef([]);
const redoStack = useRef([]);
const snapshot = useCallback(() => JSON.stringify(phases), [phases]);
const pushUndo = useCallback(() => {
undoStack.current.push(snapshot());
if (undoStack.current.length > 40) undoStack.current.shift();
redoStack.current = [];
}, [snapshot]);
const undo = useCallback(() => {
if (!undoStack.current.length) return;
redoStack.current.push(snapshot());
setPhases(JSON.parse(undoStack.current.pop()));
}, [snapshot]);
const redo = useCallback(() => {
if (!redoStack.current.length) return;
undoStack.current.push(snapshot());
setPhases(JSON.parse(redoStack.current.pop()));
}, [snapshot]);

// Keyboard shortcuts
useEffect(() => {
const handler = (e) => {
if ((e.metaKey || e.ctrlKey) && e.key === “z” && !e.shiftKey) { e.preventDefault(); undo(); }
if ((e.metaKey || e.ctrlKey) && (e.key === “y” || (e.key === “z” && e.shiftKey))) { e.preventDefault(); redo(); }
};
window.addEventListener(“keydown”, handler);
return () => window.removeEventListener(“keydown”, handler);
}, [undo, redo]);

const [setupLock, setSetupLock] = useState(false);

const cur = phases[phase];

// ─── Formation change (preserve names) ───
const changeForm = useCallback((key, team) => {
pushUndo();
setPhaseForms(prev => {
if (setupLock) {
return { 0: {…prev[0], [team]:key}, 1: {…prev[1], [team]:key} };
}
return {…prev, [phase]: {…prev[phase], [team]:key}};
});
setPhases(prev => {
const n = {…prev};
const old = n[phase][team];
const names = old.map(p=>p.name);
const extras = old.map(p=>({ jerseyNum:p.jerseyNum, foot:p.foot, age:p.age, goals:p.goals, assists:p.assists }));
const newTeam = makeTeam(key, team, names).map((p,i)=>({…p,…extras[i]}));
if (setupLock) {
n[0] = {…n[0], [team]: newTeam};
n[1] = {…n[1], [team]: newTeam};
} else {
n[phase] = {…n[phase], [team]: newTeam};
}
return n;
});
},[pushUndo, phase, setupLock]);

// ─── Update non-position field across both phases ───
const updatePlayerAll = useCallback((id, updates) => {
setPhases(prev => {
const team = id.startsWith(“home”)?“home”:“away”;
const n = {…prev};
for(let i=0;i<2;i++) n[i] = {…n[i], [team]: n[i][team].map(p=>p.id===id?{…p,…updates}:p)};
return n;
});
},[]);

// ─── Update player in current phase only ───
const updatePlayerPhase = useCallback((id, updates) => {
setPhases(prev => {
const team = id.startsWith(“home”)?“home”:“away”;
const n = {…prev};
if (setupLock) {
n[0] = {…n[0], [team]: n[0][team].map(p=>p.id===id?{…p,…updates}:p)};
n[1] = {…n[1], [team]: n[1][team].map(p=>p.id===id?{…p,…updates}:p)};
} else {
n[phase] = {…n[phase], [team]: n[phase][team].map(p=>p.id===id?{…p,…updates}:p)};
}
return n;
});
},[phase, setupLock]);

const handleDragEnd = useCallback((id, mx, my) => {
pushUndo();
updatePlayerPhase(id, {mx, my});
}, [updatePlayerPhase, pushUndo]);
// ─── Toggle a grid zone on the selected player ───
const toggleZone = useCallback((zid) => {
if(!selected) return;
const team = selected.startsWith(“home”)?“home”:“away”;
const player = phases[phase][team].find(p=>p.id===selected);
const existing = player?.zones || [];
updatePlayerAll(selected, {
zones: existing.includes(zid) ? existing.filter(z=>z!==zid) : […existing, zid]
});
}, [selected, phases, phase, updatePlayerAll]);

const handleSelect = useCallback((id) => {
setSelected(p=>p===id?null:id);
},[]);

// ─── Apply preset label/instructions to current phase only ───
const applyPreset = useCallback((playerId, presetId) => {
const preset = PRESETS.find(p=>p.id===presetId);
if(!preset) return;
// Only mark the player with the preset in the current phase — positions stay independent
updatePlayerPhase(playerId, { preset: presetId, instructions: preset.desc });
},[updatePlayerPhase]);

// ─── Set piece mode ───
const loadSetPiece = useCallback((key) => {
const sp = SET_PIECES[key];
if(!sp) return;
setSetPiece(key);
setMode(“setpiece”);
setPhases(prev => {
const n = {…prev};
const names = n[0].home.map(p=>p.name);
const homeTeam = sp.positions.map((p,i) => ({
…n[0].home[i], mx: p.x * PITCH.w, my: p.y * PITCH.h, name: names[i] || “”,
}));
n[0] = {…n[0], home: homeTeam};
return n;
});
setPhase(0);
},[]);

const exitSetPiece = useCallback(() => {
setMode(“tactics”); setSetPiece(null);
},[]);

// ─── Simple pitch click — deselect ───
const handlePitchClick = useCallback(() => { setSelected(null); }, []);

const switchPhase = useCallback((i) => {
if (anim) return;
setPhase(i);
setSelected(null);
}, [anim]);

// ─── Animation ───
const animActiveRef = useRef(false);
const animProgRef = useRef(0);

const startAnim = useCallback(() => {
if (animActiveRef.current) {
animActiveRef.current = false;
cancelAnimationFrame(animRef.current);
animProgRef.current = 0;
setAnim(false); setAnimProg(0);
return;
}
animActiveRef.current = true;
animProgRef.current = 0;
setAnim(true); setAnimProg(0);
const dur = 6000 / animSpd;
const t0 = performance.now();
const tick = (now) => {
if (!animActiveRef.current) return;
const p = Math.min(1, (now - t0) / dur);
animProgRef.current = p;
setAnimProg(p);
if (p < 1) {
animRef.current = requestAnimationFrame(tick);
} else {
animActiveRef.current = false;
animProgRef.current = 0;
setAnim(false); setAnimProg(0);
}
};
animRef.current = requestAnimationFrame(tick);
}, [animSpd]);

// Option B: animate from the OTHER phase into the current one
const animPlayers = useMemo(() => {
if (!anim || !animActiveRef.current) return cur;
const from = phases[phase === 0 ? 1 : 0]; // start from the other phase
const to   = phases[phase];                // arrive at current phase
const ease = animProg<0.5?2*animProg*animProg:1-Math.pow(-2*animProg+2,2)/2;
const lerp = (a,b) => a.map((fp,i) => {
const tp=b[i]; if(!tp) return fp;
return {…fp, mx:fp.mx+(tp.mx-fp.mx)*ease, my:fp.my+(tp.my-fp.my)*ease};
});
return { home: lerp(from.home, to.home), away: lerp(from.away, to.away) };
}, [anim, animProg, phases, phase, cur]);

const dispHome = anim ? animPlayers.home : cur.home;
const dispAway = anim ? animPlayers.away : cur.away;
const selData = selected ? […cur.home,…cur.away].find(p=>p.id===selected) : null;

// ─── Export / Import ───
const exportData = useCallback(() => {
const data = { version: VERSION, homeName, awayName, phaseForms, phases, phaseNotes, flipped, mode: mode===“setpiece”?setPiece:null };
const blob = new Blob([JSON.stringify(data, null, 2)], { type: “application/json” });
const url = URL.createObjectURL(blob);
const a = document.createElement(“a”); a.href = url;
a.download = `${homeName.replace(/\s+/g,"_")}_vs_${awayName.replace(/\s+/g,"_")}_tactics.json`;
a.click(); URL.revokeObjectURL(url);
},[homeName,awayName,phaseForms,phases,phaseNotes,flipped,mode,setPiece]);

const importRef = useRef(null);
const importData = useCallback((e) => {
const f = e.target.files?.[0]; if(!f) return;
const reader = new FileReader();
reader.onload = (ev) => {
try {
const d = JSON.parse(ev.target.result);
if(d.homeName) setHomeName(d.homeName);
if(d.awayName) setAwayName(d.awayName);
if(d.phaseForms) setPhaseForms(d.phaseForms);
else if(d.homeForm||d.awayForm) setPhaseForms({ 0:{home:d.homeForm||“2-3-1”,away:d.awayForm||“3-2-1”}, 1:{home:d.homeForm||“2-3-1”,away:d.awayForm||“3-2-1”} });
if(d.phases) setPhases(d.phases);
if(d.phaseNotes) setPhaseNotes(d.phaseNotes);
if(d.flipped !== undefined) setFlipped(d.flipped);
if(d.mode) { setMode(“setpiece”); setSetPiece(d.mode); }
} catch(err) { console.error(“Import failed”, err); }
};
reader.readAsText(f);
e.target.value = “”;
},[]);

// ─── Flip orientation ───
const flipOrientation = useCallback(() => {
pushUndo();
setFlipped(f => !f);
setPhases(prev => {
const flipTeam = (players) => players.map(p => ({
…p,
mx: PITCH.w - p.mx,
zones: (p.zones||[]).map(zid => {
const {col,row} = zoneFromId(zid);
return zoneId(GRID_COLS - 1 - col, row);
})
}));
const n = {…prev};
for(let i=0;i<2;i++) n[i] = { home: flipTeam(n[i].home), away: flipTeam(n[i].away) };
return n;
});
}, [pushUndo]);

// ─── Screenshot ───
// ─── Substitution: swap starter with sub ───
const doSubstitution = useCallback((starterId, subId) => {
pushUndo();
const team = starterId.startsWith(“home”) ? “home” : “away”;
const setSubs = team === “home” ? setHomeSubs : setAwaySubs;
setPhases(prev => {
const n = {…prev};
for(let i=0;i<2;i++) {
const subPlayer = (team===“home”?homeSubs:awaySubs).find(p=>p.id===subId);
if(!subPlayer) continue;
const starter = n[i][team].find(p=>p.id===starterId);
if(!starter) continue;
n[i] = {…n[i], [team]: n[i][team].map(p => p.id===starterId ? {
…subPlayer, id:starterId, mx:starter.mx, my:starter.my, onBench:false
} : p)};
}
return n;
});
setSubs(prev => prev.map(p => p.id===subId ? {
…phases[0][team].find(p2=>p2.id===starterId)||p,
id:subId, onBench:true
} : p));
}, [pushUndo, phases, homeSubs, awaySubs]);

// ─── Tactics slots: save current tactic to a slot ───
const saveToSlot = useCallback((slotIdx) => {
setTacticSlots(prev => {
const n = […prev];
n[slotIdx] = {
label: tacticName,
phases: JSON.parse(JSON.stringify(phases)),
phaseForms: JSON.parse(JSON.stringify(phaseForms)),
phaseNotes: {…phaseNotes},
homeSubs: JSON.parse(JSON.stringify(homeSubs)),
awaySubs: JSON.parse(JSON.stringify(awaySubs)),
homeForm, awayForm, homeName, awayName,
};
return n;
});
setActiveSlot(slotIdx);
setShowSlots(false);
}, [tacticName, phases, phaseForms, phaseNotes, homeSubs, awaySubs, homeName, awayName]);

const loadFromSlot = useCallback((slotIdx) => {
const slot = tacticSlots[slotIdx];
if(!slot.phases) return;
pushUndo();
setPhases(slot.phases);
setPhaseNotes(slot.phaseNotes);
setHomeSubs(slot.homeSubs);
setAwaySubs(slot.awaySubs);
if(slot.phaseForms) setPhaseForms(slot.phaseForms);
else if(slot.homeForm||slot.awayForm) setPhaseForms({ 0:{home:slot.homeForm||“2-3-1”,away:slot.awayForm||“3-2-1”}, 1:{home:slot.homeForm||“2-3-1”,away:slot.awayForm||“3-2-1”} });
if(slot.homeName) setHomeName(slot.homeName);
if(slot.awayName) setAwayName(slot.awayName);
setTacticName(slot.label);
setActiveSlot(slotIdx);
setShowSlots(false);
}, [tacticSlots, pushUndo]);
// ─── Custom tactical patterns (persisted in localStorage) ───
// ─── Saved tactical patterns ───
const [savedPatterns, setSavedPatterns] = useState(() => {
try { return JSON.parse(localStorage.getItem(“tl_saved_patterns”) || “[]”); }
catch { return []; }
});
const [patternNameInput, setPatternNameInput] = useState(””);
useEffect(() => {
try { localStorage.setItem(“tl_saved_patterns”, JSON.stringify(savedPatterns)); }
catch {}
}, [savedPatterns]);

const savePattern = useCallback(() => {
const name = patternNameInput.trim();
if (!name) return;
const entry = {
id: Date.now().toString(),
name,
phases: {
0: phases[0].home.map(p => ({ x: p.mx/PITCH.w, y: p.my/PITCH.h })),
1: phases[1].home.map(p => ({ x: p.mx/PITCH.w, y: p.my/PITCH.h })),
}
};
setSavedPatterns(prev => [entry, …prev]);
setPatternNameInput(””);
}, [phases, patternNameInput]);

const applyPattern = useCallback((pattern) => {
pushUndo();
setPhases(prev => {
const n = {…prev};
for(let i=0;i<2;i++) {
const positions = pattern.phases[i];
if(!positions) continue;
n[i] = {…n[i], home: n[i].home.map((p,j) => {
const pos = positions[j]; if(!pos) return p;
return {…p, mx: pos.x * PITCH.w, my: pos.y * PITCH.h};
})};
}
return n;
});
}, [pushUndo]);

const deletePattern = useCallback((id) => {
setSavedPatterns(prev => prev.filter(p => p.id !== id));
}, []);

// ─── Mobile state ───
// ═══════════════════════════════════════════════════════
// MOBILE STATE — overlay drawers
// ═══════════════════════════════════════════════════════
const [showTacticsDrawer, setShowTacticsDrawer] = useState(false);
const [showPlayerDrawer, setShowPlayerDrawer] = useState(false);

const handleSelectMobile = useCallback((id) => {
setSelected(p => {
const next = p===id ? null : id;
if(next && window.innerWidth < 768) setShowPlayerDrawer(true);
return next;
});
}, []);

// Preserve panel scroll positions across re-renders caused by inner component definitions
const leftScrollRef = useRef(0);
const rightScrollRef = useRef(0);
useEffect(() => {
const l = document.getElementById(“left-panel”);
const r = document.getElementById(“right-panel”);
if (l) l.scrollTop = leftScrollRef.current;
if (r) r.scrollTop = rightScrollRef.current;
});
const onLeftScroll = (e) => { leftScrollRef.current = e.currentTarget.scrollTop; };
const onRightScroll = (e) => { rightScrollRef.current = e.currentTarget.scrollTop; };

// ═══════════════════════════════════════════════════════
// SHARED PANEL CONTENT (reused in both layouts)
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// PITCH JSX (inlined — used in both desktop and mobile)
// ═══════════════════════════════════════════════════════
function pitchJSX(onSel) { return (
<div style={{position:“relative”,width:“100%”,height:“100%”,overflow:“hidden”,touchAction:“none”}}
onClick={handlePitchClick}>
<PitchSVG homeName={homeName} awayName={awayName} showOpponent={showOpp} svgRef={pitchSvgRef}>
<ZoneOverlay players={[...cur.home,...cur.away]} selectedId={selected} showGrid={showGrid}/>
{showData && <DataOverlay players={dispHome}/>}
{showArrows && !anim && !setupLock && (
<g>
<Arrows from={phases[phase===0?1:0].home} to={phases[phase].home} color=”#ef4444”/>
{showOpp && <Arrows from={phases[phase===0?1:0].away} to={phases[phase].away} color=”#3b82f6”/>}
</g>
)}
{showOpp && <CoverLines home={dispHome} away={dispAway}/>}
{showOpp && dispAway.map(p=><PlayerDot key={p.id} player={p} selected={selected===p.id} onSelect={onSel||handleSelect} onDragEnd={handleDragEnd} isHome={false} showData={showData} ghost/>)}
{dispHome.map(p=><PlayerDot key={p.id} player={p} selected={selected===p.id} onSelect={onSel||handleSelect} onDragEnd={handleDragEnd} isHome={true} showData={showData}/>)}
</PitchSVG>
{/* Phase badge */}
<div style={{position:“absolute”,top:8,left:8,pointerEvents:“none”}}>
<div style={{background:PHASE_COLORS[phase]+“33”,border:“1px solid “+PHASE_COLORS[phase]+“66”,
borderRadius:5,padding:“2px 8px”,fontSize:9,fontWeight:700,color:PHASE_COLORS[phase],letterSpacing:0.5}}>
{PHASE_LABELS[phase]}
</div>
</div>
</div>
); }
// ═══════════════════════════════════════════════════════
const leftPanelJSX = (
<div>
<Panel title="Team Names" accent="#94a3b8">
<div style={{display:“flex”,flexDirection:“column”,gap:6}}>
<div style={{display:“flex”,gap:6,alignItems:“center”}}>
<div style={{fontSize:9,color:”#64748b”,minWidth:34,fontWeight:600}}>NAME</div>
<Input value={tacticName} onChange={setTacticName} placeholder="Tactic name"/>
</div>
<div style={{display:“flex”,gap:6,alignItems:“center”}}>
<div style={{width:8,height:8,borderRadius:“50%”,background:”#ef4444”,flexShrink:0}}/>
<Input value={homeName} onChange={setHomeName} placeholder="Home team"/>
</div>
<div style={{display:“flex”,gap:6,alignItems:“center”}}>
<div style={{width:8,height:8,borderRadius:“50%”,background:”#3b82f6”,flexShrink:0}}/>
<Input value={awayName} onChange={setAwayName} placeholder="Away team"/>
</div>
</div>
</Panel>
<Panel title="Home Formation" accent="#ef4444">
<div style={{display:“flex”,flexWrap:“wrap”,gap:4}}>
{Object.keys(FORMATIONS).map(k=><Chip key={k} label={FORMATIONS[k].label} active={homeForm===k} onClick={()=>changeForm(k,“home”)} color=“rgba(239,68,68,0.25)”/>)}
</div>
</Panel>
{showOpp && <Panel title="Opponent Formation" accent="#3b82f6">
<div style={{display:“flex”,flexWrap:“wrap”,gap:4}}>
{Object.keys(FORMATIONS).map(k=><Chip key={k} label={FORMATIONS[k].label} active={awayForm===k} onClick={()=>changeForm(k,“away”)} color=“rgba(59,130,246,0.25)”/>)}
</div>
</Panel>}
<Panel title="Phases" accent="#f59e0b">
<div style={{display:“flex”,gap:3,marginBottom:8}}>
{PHASE_LABELS.map((l,i)=>(
<button key={i} onClick={()=>switchPhase(i)} style={{
flex:1,padding:“6px 2px”,fontSize:9,fontWeight:700,
background:phase===i?PHASE_COLORS[i]+“22”:“rgba(255,255,255,0.03)”,
border:“1px solid “+(phase===i?PHASE_COLORS[i]+“66”:“rgba(255,255,255,0.06)”),
borderRadius:6,color:phase===i?PHASE_COLORS[i]:”#64748b”,cursor:“pointer”,fontFamily:”‘Outfit’,sans-serif”
}}>{l}</button>
))}
</div>
{/* Setup lock */}
<button onClick={()=>setSetupLock(l=>!l)} style={{
width:“100%”,marginBottom:8,padding:“6px 10px”,borderRadius:6,cursor:“pointer”,
fontFamily:”‘Outfit’,sans-serif”,fontSize:10,fontWeight:700,letterSpacing:0.3,
background: setupLock ? “rgba(245,158,11,0.18)” : “rgba(255,255,255,0.04)”,
border: “1px solid “ + (setupLock ? “rgba(245,158,11,0.5)” : “rgba(255,255,255,0.1)”),
color: setupLock ? “#f59e0b” : “#475569”,
display:“flex”,alignItems:“center”,justifyContent:“center”,gap:6,
}}>
<span>{setupLock ? “🔒” : “🔓”}</span>
<span>{setupLock ? “Setup Lock ON — edits apply to both phases” : “Setup Lock OFF — edits affect this phase only”}</span>
</button>
<div style={{fontSize:10,color:”#475569”,marginBottom:8}}>
{setupLock
? “Arrange your formation freely. No movement arrows will build up.”
: “Animate shows the transition from “+PHASE_LABELS[phase===0?1:0]+” into “+PHASE_LABELS[phase]+”.”}
</div>
<textarea value={phaseNotes[phase]} onChange={e=>setPhaseNotes(n=>({…n,[phase]:e.target.value}))}
placeholder={“Notes for “+PHASE_LABELS[phase]+”…”} rows={2}
style={{width:“100%”,background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,
borderRadius:6,color:”#e2e8f0”,padding:“6px 8px”,fontSize:11,resize:“vertical”,
fontFamily:”‘Outfit’,sans-serif”,outline:“none”,marginBottom:8,boxSizing:“border-box”}}/>
<div style={{display:“flex”,gap:6,alignItems:“center”}}>
<Btn bg={anim?”#dc2626”:”#16a34a”} onClick={startAnim}>{anim?“Stop”:“Animate”}</Btn>
<select value={animSpd} onChange={e=>setAnimSpd(+e.target.value)} style={{background:”#1e293b”,color:”#e2e8f0”,border:“1px solid rgba(255,255,255,0.1)”,borderRadius:4,padding:“2px 4px”,fontSize:10,fontFamily:”‘Outfit’,sans-serif”}}>
<option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option>
</select>
</div>
{anim && <div style={{marginTop:8,height:4,borderRadius:2,background:“rgba(255,255,255,0.06)”,overflow:“hidden”}}>
<div style={{height:“100%”,width:(animProg*100)+”%”,background:PHASE_COLORS[phase],borderRadius:2,transition:“width 0.1s”}}/>
</div>}
</Panel>
<Panel title="Tools" accent="#64748b">
<div style={{display:“flex”,flexWrap:“wrap”,gap:6}}>
<Btn small bg="#1e293b" onClick={undo}>Undo</Btn>
<Btn small bg="#1e293b" onClick={redo}>Redo</Btn>
<Btn small bg="#1e293b" onClick={flipOrientation}>{flipped?“Unflip”:“Flip”}</Btn>
<Btn small bg=”#dc2626” onClick={()=>{
const base = {home:makeTeam(“2-3-1”,“home”),away:makeTeam(“3-2-1”,“away”)};
setPhases({0:base, 1:JSON.parse(JSON.stringify(base))});
setPhaseForms({0:{home:“2-3-1”,away:“3-2-1”},1:{home:“2-3-1”,away:“3-2-1”}});
setHomeName(“Bandidos”); setAwayName(“Opponent”);
setPhaseNotes({0:””,1:””});
setPhase(0); setSelected(null); setFlipped(false);
setHomeSubs(makeSubstitutes(“home”)); setAwaySubs(makeSubstitutes(“away”));
setTacticName(“Tactic 1”);
}}>Reset All</Btn>
</div>
</Panel>
<Panel title="My Patterns" accent="#8b5cf6">
<div style={{display:“flex”,gap:6,marginBottom:10}}>
<input
value={patternNameInput}
onChange={e=>setPatternNameInput(e.target.value)}
onKeyDown={e=>e.key===“Enter”&&savePattern()}
placeholder=“Name this pattern…”
style={{flex:1,background:“rgba(255,255,255,0.05)”,border:“1px solid rgba(255,255,255,0.1)”,
borderRadius:6,color:”#e2e8f0”,padding:“5px 8px”,fontSize:11,
fontFamily:”‘Outfit’,sans-serif”,outline:“none”,minWidth:0}}
/>
<button onClick={savePattern} style={{
background:“rgba(139,92,246,0.25)”,border:“1px solid rgba(139,92,246,0.4)”,
borderRadius:6,padding:“5px 10px”,fontSize:10,color:”#c4b5fd”,
cursor:“pointer”,fontWeight:700,fontFamily:”‘Outfit’,sans-serif”,whiteSpace:“nowrap”
}}>Save</button>
</div>
{savedPatterns.length===0
? <div style={{fontSize:10,color:”#374151”,textAlign:“center”,padding:“12px 0”}}>No saved patterns yet. Set up your positions and save.</div>
: <div style={{display:“flex”,flexDirection:“column”,gap:4}}>
{savedPatterns.map(p=>(
<div key={p.id} style={{display:“flex”,alignItems:“center”,gap:6,
background:“rgba(139,92,246,0.08)”,border:“1px solid rgba(139,92,246,0.15)”,
borderRadius:8,padding:“7px 10px”}}>
<div style={{flex:1,fontSize:11,fontWeight:700,color:”#c4b5fd”,fontFamily:”‘Outfit’,sans-serif”,overflow:“hidden”,textOverflow:“ellipsis”,whiteSpace:“nowrap”}}>{p.name}</div>
<button onClick={()=>applyPattern(p)} style={{background:“rgba(139,92,246,0.2)”,border:“1px solid rgba(139,92,246,0.3)”,borderRadius:4,padding:“2px 8px”,fontSize:9,color:”#c4b5fd”,cursor:“pointer”,fontWeight:700,fontFamily:”‘Outfit’,sans-serif”}}>Apply</button>
<button onClick={()=>deletePattern(p.id)} style={{background:“rgba(239,68,68,0.1)”,border:“1px solid rgba(239,68,68,0.2)”,borderRadius:4,padding:“2px 8px”,fontSize:9,color:”#f87171”,cursor:“pointer”,fontWeight:700,fontFamily:”‘Outfit’,sans-serif”}}>✕</button>
</div>
))}
</div>
}
</Panel>
<Panel title="Set Pieces" accent="#8b5cf6">
{mode===“setpiece” && <div style={{marginBottom:8}}>
<Btn small bg="#7c3aed" onClick={exitSetPiece}>Back to Tactics</Btn>
<div style={{fontSize:10,color:”#a78bfa”,marginTop:4}}>Editing: {SET_PIECES[setPiece] && SET_PIECES[setPiece].label}</div>
</div>}
<div style={{display:“flex”,flexWrap:“wrap”,gap:4}}>
{Object.keys(SET_PIECES).map(k=><Chip key={k} label={SET_PIECES[k].label} active={setPiece===k} onClick={()=>loadSetPiece(k)} color=“rgba(139,92,246,0.25)” small/>)}
</div>
</Panel>
<Panel title="Substitutions" accent="#f59e0b">
<div style={{fontSize:10,color:”#64748b”,marginBottom:8}}>Tap a starter then tap a sub to swap them</div>
{[“home”,“away”].map(team=>{
const subs=team===“home”?homeSubs:awaySubs;
const starters=cur[team];
const color=team===“home”?”#ef4444”:”#3b82f6”;
const isSelStarter=selected&&selected.startsWith(team)&&!selected.includes(“sub”);
return (
<div key={team} style={{marginBottom:10}}>
<div style={{fontSize:9,fontWeight:700,color,letterSpacing:1,textTransform:“uppercase”,marginBottom:5}}>
{team===“home”?homeName:awayName}
</div>
<div style={{display:“flex”,flexDirection:“column”,gap:3}}>
{subs.map(sub=>(
<div key={sub.id} onClick={()=>{if(isSelStarter)doSubstitution(selected,sub.id);}} style={{
display:“flex”,alignItems:“center”,gap:6,padding:“5px 8px”,borderRadius:6,
background:isSelStarter?“rgba(245,158,11,0.15)”:“rgba(255,255,255,0.03)”,
border:“1px solid “+(isSelStarter?“rgba(245,158,11,0.4)”:“rgba(255,255,255,0.06)”),
cursor:isSelStarter?“pointer”:“default”
}}>
<div style={{width:20,height:20,borderRadius:“50%”,background:color+“33”,border:“1px solid “+color+“66”,
display:“flex”,alignItems:“center”,justifyContent:“center”,fontSize:9,fontWeight:700,color,flexShrink:0}}>
{sub.jerseyNum||”?”}
</div>
<input value={sub.name} onChange={e=>{
const setter=team===“home”?setHomeSubs:setAwaySubs;
setter(prev=>prev.map(p=>p.id===sub.id?{…p,name:e.target.value}:p));
}} placeholder=“Sub name” style={{
background:“transparent”,border:“none”,outline:“none”,color:”#e2e8f0”,
fontSize:11,fontFamily:”‘Outfit’,sans-serif”,flex:1,minWidth:0
}}/>
<select value={sub.role} onChange={e=>{
const setter=team===“home”?setHomeSubs:setAwaySubs;
setter(prev=>prev.map(p=>p.id===sub.id?{…p,role:e.target.value}:p));
}} style={{background:”#1e293b”,border:“none”,color:”#94a3b8”,borderRadius:3,fontSize:9,padding:“1px 2px”,fontFamily:”‘Outfit’,sans-serif”}}>
{ROLES.map(r=><option key={r.id} value={r.id}>{r.short}</option>)}
</select>
{isSelStarter && <span style={{fontSize:9,color:”#f59e0b”,fontWeight:700}}>IN</span>}
</div>
))}
</div>
{isSelStarter && <div style={{fontSize:9,color:”#f59e0b”,marginTop:4}}>
Tap a sub to bring on for {starters.find(p=>p.id===selected)&&(starters.find(p=>p.id===selected).name||(”#”+starters.find(p=>p.id===selected).num))}
</div>}
</div>
);
})}
</Panel>
<Panel title="How to Use">
<div style={{fontSize:11,color:”#64748b”,lineHeight:1.7}}>
<div>Drag players to reposition</div>
<div>Tap a player to edit details</div>
<div>Assign presets to auto-generate transitions</div>
<div>Tap zones on the grid to set player areas</div>
<div>Export/Import to save tactics</div>
</div>
</Panel>
</div>
);

// ═══════════════════════════════════════════════════════
// RIGHT PANEL JSX
// ═══════════════════════════════════════════════════════
const rightPanelJSX = (
<div>
{selData ? (
<Panel title={(selData.name||“Player”)+” #”+(selData.jerseyNum!=null?selData.jerseyNum:selData.num)} accent={selData.team===“home”?”#ef4444”:”#3b82f6”}>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:3,fontWeight:600}}>NAME</div>
<Input value={selData.name} onChange={v=>updatePlayerAll(selData.id,{name:v})} placeholder={“Player “+selData.num}/>
</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr 1fr”,gap:6,marginBottom:8}}>
<div>
<div style={{fontSize:9,color:”#64748b”,marginBottom:3,fontWeight:600}}>JERSEY</div>
<input type=“number” min={1} max={99} value={selData.jerseyNum!=null?selData.jerseyNum:selData.num}
onChange={e=>updatePlayerAll(selData.id,{jerseyNum:+e.target.value})}
style={{width:“100%”,background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,
borderRadius:6,color:”#e2e8f0”,padding:“4px 6px”,fontSize:11,fontFamily:”‘Outfit’,sans-serif”,outline:“none”}}/>
</div>
<div>
<div style={{fontSize:9,color:”#64748b”,marginBottom:3,fontWeight:600}}>AGE</div>
<input type=“number” min={14} max={50} value={selData.age||””}
onChange={e=>updatePlayerAll(selData.id,{age:e.target.value})} placeholder=”–”
style={{width:“100%”,background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,
borderRadius:6,color:”#e2e8f0”,padding:“4px 6px”,fontSize:11,fontFamily:”‘Outfit’,sans-serif”,outline:“none”}}/>
</div>
<div>
<div style={{fontSize:9,color:”#64748b”,marginBottom:3,fontWeight:600}}>FOOT</div>
<select value={selData.foot||“R”} onChange={e=>updatePlayerAll(selData.id,{foot:e.target.value})}
style={{width:“100%”,background:”#1e293b”,border:“1px solid rgba(255,255,255,0.08)”,
borderRadius:6,color:”#e2e8f0”,padding:“4px 6px”,fontSize:11,fontFamily:”‘Outfit’,sans-serif”,outline:“none”}}>
<option value="R">Right</option>
<option value="L">Left</option>
<option value="B">Both</option>
</select>
</div>
</div>
<div style={{display:“grid”,gridTemplateColumns:“1fr 1fr”,gap:6,marginBottom:8}}>
<div>
<div style={{fontSize:9,color:”#64748b”,marginBottom:3,fontWeight:600}}>GOALS</div>
<input type=“number” min={0} value={selData.goals||0}
onChange={e=>updatePlayerAll(selData.id,{goals:+e.target.value})}
style={{width:“100%”,background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,
borderRadius:6,color:”#e2e8f0”,padding:“4px 6px”,fontSize:11,fontFamily:”‘Outfit’,sans-serif”,outline:“none”}}/>
</div>
<div>
<div style={{fontSize:9,color:”#64748b”,marginBottom:3,fontWeight:600}}>ASSISTS</div>
<input type=“number” min={0} value={selData.assists||0}
onChange={e=>updatePlayerAll(selData.id,{assists:+e.target.value})}
style={{width:“100%”,background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,
borderRadius:6,color:”#e2e8f0”,padding:“4px 6px”,fontSize:11,fontFamily:”‘Outfit’,sans-serif”,outline:“none”}}/>
</div>
</div>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:3,fontWeight:600}}>PRIMARY ROLE</div>
<div style={{display:“flex”,flexWrap:“wrap”,gap:3}}>
{ROLES.map(r=><Chip key={r.id} label={r.short} active={selData.role===r.id} onClick={()=>updatePlayerAll(selData.id,{role:r.id})} color={ROLE_COLORS[r.id]+“44”} small/>)}
</div>
</div>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:3,fontWeight:600}}>SECONDARY ROLE</div>
<div style={{display:“flex”,flexWrap:“wrap”,gap:3}}>
<Chip label=“None” active={!selData.role2} onClick={()=>updatePlayerAll(selData.id,{role2:null})} small/>
{ROLES.filter(r=>r.id!==selData.role).map(r=><Chip key={r.id} label={r.short} active={selData.role2===r.id} onClick={()=>updatePlayerAll(selData.id,{role2:r.id})} color={ROLE_COLORS[r.id]+“33”} small/>)}
</div>
</div>
<div style={{fontSize:11,color:”#64748b”,marginBottom:8,fontFamily:“monospace”}}>
{selData.mx.toFixed(1)}m x {selData.my.toFixed(1)}m
</div>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:6,fontWeight:600}}>MOVEMENT ZONES</div>
<div style={{display:“grid”,gridTemplateColumns:“repeat(4,1fr)”,gap:3,marginBottom:6}}>
{Array.from({length:GRID_ROWS},(*,row)=>
Array.from({length:GRID_COLS},(*,col)=>{
const zid=zoneId(col,row);
const num=zoneNum(col,row);
const active=(selData.zones||[]).includes(zid);
return <button key={zid} onClick={()=>toggleZone(zid)} style={{
padding:“6px 2px”,fontSize:10,fontWeight:800,borderRadius:4,cursor:“pointer”,
background:active?“rgba(239,68,68,0.3)”:“rgba(255,255,255,0.04)”,
border:“1.5px solid “+(active?“rgba(239,68,68,0.8)”:“rgba(255,255,255,0.08)”),
color:active?”#fca5a5”:”#4b5563”,fontFamily:”‘Outfit’,sans-serif”
}}>{num}</button>;
})
)}
</div>
<div style={{display:“flex”,gap:4,alignItems:“center”}}>
<Chip label={showGrid?“Grid on”:“Grid off”} active={showGrid} onClick={()=>setShowGrid(g=>!g)} small color=“rgba(139,92,246,0.3)”/>
{(selData.zones||[]).length>0 && <Btn small bg=”#dc2626” onClick={()=>updatePlayerAll(selData.id,{zones:[]})}>Clear</Btn>}
</div>
</div>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:3,fontWeight:600}}>MOVEMENT PRESET</div>
<div style={{display:“flex”,flexWrap:“wrap”,gap:3}}>
{PRESETS.map(p=><Chip key={p.id} label={p.label} active={selData.preset===p.id} onClick={()=>applyPreset(selData.id,p.id)} color=“rgba(245,158,11,0.25)” small/>)}
</div>
{selData.preset && <div style={{fontSize:10,color:”#fbbf24”,marginTop:4}}>
{PRESETS.find(p=>p.id===selData.preset)&&PRESETS.find(p=>p.id===selData.preset).desc}
</div>}
</div>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:3,fontWeight:600}}>INSTRUCTIONS</div>
<textarea value={selData.instructions} onChange={e=>updatePlayerAll(selData.id,{instructions:e.target.value})}
placeholder=“e.g. Press when ball enters their half.”
rows={3} style={{width:“100%”,background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,
borderRadius:6,color:”#e2e8f0”,padding:8,fontSize:11,resize:“vertical”,fontFamily:”‘Outfit’,sans-serif”,outline:“none”,boxSizing:“border-box”}}/>
</div>
{selData.team===“home” && showOpp && <div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:3,fontWeight:600}}>MARKING</div>
<div style={{display:“flex”,flexWrap:“wrap”,gap:3}}>
<Chip label=“None” active={!selData.coverTarget} onClick={()=>updatePlayerAll(selData.id,{coverTarget:null})} small/>
{cur.away.map(ap=><Chip key={ap.id} label={”#”+ap.num+” “+(ap.name||ap.role)} active={selData.coverTarget===ap.id}
onClick={()=>updatePlayerAll(selData.id,{coverTarget:ap.id})} color=“rgba(59,130,246,0.25)” small/>)}
</div>
</div>}
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:”#64748b”,marginBottom:3,fontWeight:600}}>BALL</div>
<Chip label={selData.hasBall?“Has Ball”:“Give Ball”} active={!!selData.hasBall}
onClick={()=>toggleHasBall(selData.id)} color=“rgba(245,158,11,0.3)” small/>
</div>
</Panel>
) : (
<Panel title="Player Details">
<div style={{fontSize:12,color:”#4b5563”,lineHeight:1.7,textAlign:“center”,padding:“20px 0”}}>
Tap any player on the pitch to edit their details.
</div>
</Panel>
)}
<Panel title="Team Shape" accent="#10b981">
{(()=>{
const h=cur.home;
const xs=h.map(p=>p.mx),ys=h.map(p=>p.my);
const w=(Math.max(…xs)-Math.min(…xs)).toFixed(1);
const d=(Math.max(…ys)-Math.min(…ys)).toFixed(1);
let td=0,pr=0;
for(let i=0;i<h.length;i++) for(let j=i+1;j<h.length;j++){td+=Math.sqrt((h[i].mx-h[j].mx)**2+(h[i].my-h[j].my)**2);pr++;}
const dl=h.filter(p=>p.role===“CB”||p.role===“FB”).map(p=>p.mx);
const dh=dl.length?(dl.reduce((a,b)=>a+b,0)/dl.length).toFixed(1):”–”;
return <div style={{fontSize:11,lineHeight:2,color:”#94a3b8”}}>
<div>Formation: <strong style={{color:”#e2e8f0”}}>{homeForm}</strong> / <strong style={{color:”#e2e8f0”}}>{awayForm}</strong></div>
<div>Width: <strong style={{color:”#e2e8f0”}}>{w}m</strong></div>
<div>Depth: <strong style={{color:”#e2e8f0”}}>{d}m</strong></div>
<div>Avg spacing: <strong style={{color:”#e2e8f0”}}>{pr?(td/pr).toFixed(1):”–”}m</strong></div>
<div>Def. line: <strong style={{color:”#e2e8f0”}}>{dh}m</strong></div>
</div>;
})()}
</Panel>
<Panel title="Roster" accent="#94a3b8">
<div style={{maxHeight:200,overflowY:“auto”}}>
{cur.home.map(p=>(
<div key={p.id} onClick={()=>setSelected(p.id)} style={{
display:“flex”,gap:6,alignItems:“center”,padding:“3px 6px”,borderRadius:4,cursor:“pointer”,
background:selected===p.id?“rgba(239,68,68,0.1)”:“transparent”,fontSize:11
}}>
<div style={{width:6,height:6,borderRadius:“50%”,background:”#ef4444”,flexShrink:0}}/>
<span style={{color:”#94a3b8”,fontFamily:“monospace”,minWidth:20}}>{”#”+(p.jerseyNum!=null?p.jerseyNum:p.num)}</span>
<span style={{color:”#e2e8f0”,flex:1}}>{p.name||(“Player “+p.num)}</span>
{(p.goals>0||p.assists>0)&&<span style={{fontSize:9,color:”#64748b”}}>{p.goals>0?p.goals+“g”:””}{p.assists>0?” “+p.assists+“a”:””}</span>}
<span style={{color:”#64748b”,fontSize:9}}>{p.role}{p.role2?”/”+p.role2:””}</span>
</div>
))}
{showOpp && <div>
<div style={{height:1,background:“rgba(255,255,255,0.06)”,margin:“6px 0”}}/>
{cur.away.map(p=>(
<div key={p.id} onClick={()=>setSelected(p.id)} style={{
display:“flex”,gap:6,alignItems:“center”,padding:“3px 6px”,borderRadius:4,cursor:“pointer”,
background:selected===p.id?“rgba(59,130,246,0.1)”:“transparent”,fontSize:11
}}>
<div style={{width:6,height:6,borderRadius:“50%”,background:”#3b82f6”,flexShrink:0}}/>
<span style={{color:”#94a3b8”,fontFamily:“monospace”,minWidth:20}}>{”#”+(p.jerseyNum!=null?p.jerseyNum:p.num)}</span>
<span style={{color:”#e2e8f0”,flex:1}}>{p.name||(“Player “+p.num)}</span>
<span style={{color:”#64748b”,fontSize:9}}>{p.role}</span>
</div>
))}
</div>}
</div>
</Panel>
</div>
);

// ═══════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════
return (
<div style={{height:“100vh”,overflow:“hidden”,background:“linear-gradient(170deg,#0a0f1a 0%,#0d1117 40%,#111318 100%)”,color:”#e2e8f0”,fontFamily:”‘Outfit’,‘Segoe UI’,system-ui,sans-serif”,display:“flex”,flexDirection:“column”}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'); * { box-sizing: border-box; } html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; } #root { height: 100%; } .dtop { display: flex; } .mobi { display: none; } @media (max-width: 767px) { .dtop { display: none !important; } .mobi { display: block !important; } } .slide-left { animation: slideInLeft 0.25s ease; } .slide-up { animation: slideInUp 0.25s ease; } @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } } @keyframes slideInUp { from { transform: translateY(100%); } to { transform: translateY(0); } } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:2px; }`}</style>

```
  {/* HEADER */}
  <div style={{background:"linear-gradient(90deg,rgba(239,68,68,0.08),transparent,rgba(59,130,246,0.08))",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:10,flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <button className="mobi" onClick={()=>setShowTacticsDrawer(d=>!d)} style={{
        background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:8,padding:"6px 8px",color:"#e2e8f0",cursor:"pointer",fontSize:14,display:"none"
      }}>Menu</button>
      <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#ef4444,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>T</div>
      <div>
        <div style={{fontSize:15,fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.2}}>Bandidos Tactic Lab</div>
        <div style={{fontSize:9,color:"#4b5563",letterSpacing:1.2,textTransform:"uppercase"}}>Football 7 — {VERSION}</div>
      </div>
    </div>
    <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
      <Chip label={showOpp?"Opp on":"Opp off"} active={showOpp} onClick={()=>setShowOpp(!showOpp)} small/>
      <Chip label="Data" active={showData} onClick={()=>setShowData(!showData)} color="rgba(245,158,11,0.3)" small/>
      <Chip label="Arrows" active={showArrows} onClick={()=>setShowArrows(!showArrows)} small/>
      <div style={{width:1,height:18,background:"rgba(255,255,255,0.1)",margin:"0 2px"}}/>
      <Btn small bg="#7c3aed" onClick={()=>setShowSlots(s=>!s)}>Slots</Btn>
      <Btn small bg="#1e293b" onClick={exportData}>Export</Btn>
      <Btn small bg="#1e293b" onClick={()=>importRef.current&&importRef.current.click()}>Import</Btn>
      <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importData}/>
    </div>
  </div>

  {/* DESKTOP LAYOUT */}
  <div className="dtop" style={{flex:1,overflow:"hidden",minHeight:0}}>
    <div style={{width:250,minWidth:250,padding:"12px",overflowY:"auto",borderRight:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.15)"}}>
      {leftPanelJSX}
    </div>
    <div style={{flex:1,overflow:"hidden",position:"relative"}}>
      {pitchJSX(null)}
    </div>
    <div style={{width:250,minWidth:250,padding:"12px",overflowY:"auto",borderLeft:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.15)"}}>
      {rightPanelJSX}
    </div>
  </div>

  {/* MOBILE LAYOUT */}
  <div className="mobi" style={{position:"relative",flex:1,overflow:"hidden",minHeight:0}}>
    <div style={{position:"absolute",inset:0}}>
      {pitchJSX(handleSelectMobile)}
    </div>

    {/* FABs */}
    <div style={{position:"absolute",bottom:16,right:12,display:"flex",flexDirection:"column",gap:8,zIndex:20}}>
      <button onClick={()=>{setShowTacticsDrawer(d=>!d);setShowPlayerDrawer(false);}} style={{
        width:48,height:48,borderRadius:14,
        background:showTacticsDrawer?"#ef4444":"rgba(15,20,35,0.92)",
        border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:20,cursor:"pointer",
        boxShadow:"0 4px 20px rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"
      }}>T</button>
      {selData && <button onClick={()=>{setShowPlayerDrawer(d=>!d);setShowTacticsDrawer(false);}} style={{
        width:48,height:48,borderRadius:14,
        background:showPlayerDrawer?"#3b82f6":"rgba(15,20,35,0.92)",
        border:"1px solid "+(showPlayerDrawer?"rgba(59,130,246,0.5)":"rgba(255,255,255,0.12)"),
        color:"#fff",fontSize:20,cursor:"pointer",
        boxShadow:"0 4px 20px rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"
      }}>P</button>}
    </div>

    {selData && !showPlayerDrawer && (
      <div onClick={()=>setShowPlayerDrawer(true)} style={{
        position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",
        background:"rgba(15,20,35,0.92)",border:"1px solid "+(selData.team==="home"?"rgba(239,68,68,0.4)":"rgba(59,130,246,0.4)"),
        borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"center",gap:8,
        cursor:"pointer",zIndex:20,boxShadow:"0 4px 16px rgba(0,0,0,0.4)"
      }}>
        <div style={{width:8,height:8,borderRadius:"50%",background:selData.team==="home"?"#ef4444":"#3b82f6"}}/>
        <span style={{fontSize:12,fontWeight:700}}>{selData.name||("Player "+selData.num)}</span>
        <span style={{fontSize:10,color:"#64748b"}}>{selData.role}</span>
      </div>
    )}

    {showTacticsDrawer && (
      <div style={{position:"absolute",inset:0,zIndex:29}}>
        <div onClick={()=>setShowTacticsDrawer(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"}}/>
        <div className="slide-left" style={{
          position:"absolute",top:0,left:0,bottom:0,width:"82%",maxWidth:320,
          background:"rgba(10,15,26,0.98)",borderRight:"1px solid rgba(255,255,255,0.08)",
          zIndex:30,overflowY:"auto",padding:"12px"
        }}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase"}}>Tactics</div>
            <button onClick={()=>setShowTacticsDrawer(false)} style={{
              background:"rgba(255,255,255,0.06)",border:"none",color:"#64748b",
              borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:14
            }}>X</button>
          </div>
          {leftPanelJSX}
        </div>
      </div>
    )}

    {showPlayerDrawer && (
      <div style={{position:"absolute",inset:0,zIndex:29}}>
        <div onClick={()=>setShowPlayerDrawer(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)"}}/>
        <div className="slide-up" style={{
          position:"absolute",left:0,right:0,bottom:0,height:"62%",
          background:"rgba(10,15,26,0.98)",borderTop:"1px solid rgba(255,255,255,0.08)",
          borderRadius:"16px 16px 0 0",zIndex:30,overflowY:"auto",padding:"0 12px 16px"
        }}>
          <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
            <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase"}}>
              {selData?(selData.name||("Player "+selData.num)):"Player"}
            </div>
            <button onClick={()=>setShowPlayerDrawer(false)} style={{
              background:"rgba(255,255,255,0.06)",border:"none",color:"#64748b",
              borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:14
            }}>X</button>
          </div>
          {rightPanelJSX}
        </div>
      </div>
    )}
  </div>

  {/* SLOTS MODAL */}
  {showSlots && (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setShowSlots(false)}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0d1117",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:20,width:"100%",maxWidth:480}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>Tactic Slots</div>
          <button onClick={()=>setShowSlots(false)} style={{background:"rgba(255,255,255,0.06)",border:"none",color:"#64748b",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:16}}>X</button>
        </div>
        <div style={{fontSize:10,color:"#64748b",marginBottom:14}}>Save up to 5 tactics and switch between them</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {tacticSlots.map((slot,i)=>(
            <div key={i} style={{
              display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,
              background:activeSlot===i?"rgba(124,58,237,0.12)":"rgba(255,255,255,0.03)",
              border:"1px solid "+(activeSlot===i?"rgba(124,58,237,0.4)":"rgba(255,255,255,0.07)"),
            }}>
              <div style={{width:28,height:28,borderRadius:8,background:activeSlot===i?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,
                color:activeSlot===i?"#c4b5fd":"#4b5563",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:slot.phases?"#e2e8f0":"#4b5563",
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {slot.phases?slot.label:"-- Empty --"}
                </div>
                {slot.phases && <div style={{fontSize:9,color:"#64748b",marginTop:1}}>
                  {slot.homeName} vs {slot.awayName}{slot.phaseForms ? ` - ${slot.phaseForms[0].home}/${slot.phaseForms[1].home}` : slot.homeForm ? ` - ${slot.homeForm}` : ""}
                </div>}
              </div>
              <div style={{display:"flex",gap:5}}>
                {slot.phases && <Btn small bg="#1e293b" onClick={()=>loadFromSlot(i)}>Load</Btn>}
                <Btn small bg="#7c3aed" onClick={()=>saveToSlot(i)}>Save</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )}

</div>
```

);
}
