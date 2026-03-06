import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import * as d3 from "d3";

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const VERSION = "v0.2";
const PITCH = { w: 65, h: 45 };
const SCALE = 12;
const PW = PITCH.w * SCALE, PH = PITCH.h * SCALE, PAD = 30;
const FULL_W = PW + PAD * 2, FULL_H = PH + PAD * 2;

const ROLES = [
  { id: "GK", label: "Goalkeeper", short: "GK" },
  { id: "CB", label: "Center Back", short: "CB" },
  { id: "FB", label: "Full Back", short: "FB" },
  { id: "DM", label: "Defensive Mid", short: "DM" },
  { id: "CM", label: "Central Mid", short: "CM" },
  { id: "AM", label: "Attacking Mid", short: "AM" },
  { id: "W", label: "Winger", short: "W" },
  { id: "ST", label: "Striker", short: "ST" },
];

const ROLE_COLORS = { GK:"#f59e0b", CB:"#3b82f6", FB:"#6366f1", DM:"#14b8a6", CM:"#10b981", AM:"#8b5cf6", W:"#ec4899", ST:"#ef4444" };

const PRESETS = [
  { id: "press_high", label: "Press High", dx: 12, dy: 0, desc: "Push forward aggressively" },
  { id: "drop_deep", label: "Drop Deep", dx: -12, dy: 0, desc: "Fall back into defensive shape" },
  { id: "overlap_left", label: "Overlap Left", dx: 8, dy: -8, desc: "Overlap run down the left" },
  { id: "overlap_right", label: "Overlap Right", dx: 8, dy: 8, desc: "Overlap run down the right" },
  { id: "tuck_inside", label: "Tuck Inside", dx: 2, dy: (p) => p.my < PITCH.h / 2 ? 6 : -6, desc: "Cut inward from wide" },
  { id: "hold_position", label: "Hold Position", dx: 0, dy: 0, desc: "Stay in current position" },
  { id: "push_wide", label: "Push Wide", dx: 0, dy: (p) => p.my < PITCH.h / 2 ? -6 : 6, desc: "Stretch wide" },
  { id: "advance_carry", label: "Advance w/ Ball", dx: 15, dy: 0, desc: "Carry the ball forward" },
];

const FORMATIONS = {
  "2-3-1": { label: "2-3-1", pos: [
    { x:.04,y:.5,role:"GK" },{ x:.22,y:.28,role:"CB" },{ x:.22,y:.72,role:"CB" },
    { x:.48,y:.15,role:"W" },{ x:.48,y:.5,role:"CM" },{ x:.48,y:.85,role:"W" },{ x:.72,y:.5,role:"ST" }
  ]},
  "3-2-1": { label: "3-2-1", pos: [
    { x:.04,y:.5,role:"GK" },{ x:.22,y:.2,role:"FB" },{ x:.22,y:.5,role:"CB" },{ x:.22,y:.8,role:"FB" },
    { x:.48,y:.35,role:"CM" },{ x:.48,y:.65,role:"CM" },{ x:.75,y:.5,role:"ST" }
  ]},
  "3-1-2": { label: "3-1-2", pos: [
    { x:.04,y:.5,role:"GK" },{ x:.22,y:.2,role:"FB" },{ x:.22,y:.5,role:"CB" },{ x:.22,y:.8,role:"FB" },
    { x:.45,y:.5,role:"CM" },{ x:.7,y:.32,role:"ST" },{ x:.7,y:.68,role:"ST" }
  ]},
  "1-2-2-2": { label: "Diamond", pos: [
    { x:.04,y:.5,role:"GK" },{ x:.2,y:.5,role:"CB" },{ x:.38,y:.25,role:"CM" },{ x:.38,y:.75,role:"CM" },
    { x:.58,y:.25,role:"W" },{ x:.58,y:.75,role:"W" },{ x:.75,y:.5,role:"ST" }
  ]},
  "2-1-2-1": { label: "2-1-2-1", pos: [
    { x:.04,y:.5,role:"GK" },{ x:.2,y:.3,role:"CB" },{ x:.2,y:.7,role:"CB" },{ x:.38,y:.5,role:"DM" },
    { x:.56,y:.25,role:"W" },{ x:.56,y:.75,role:"W" },{ x:.75,y:.5,role:"ST" }
  ]},
  "1-3-2": { label: "1-3-2", pos: [
    { x:.04,y:.5,role:"GK" },{ x:.2,y:.5,role:"CB" },{ x:.42,y:.15,role:"W" },{ x:.42,y:.5,role:"CM" },
    { x:.42,y:.85,role:"W" },{ x:.68,y:.35,role:"ST" },{ x:.68,y:.65,role:"ST" }
  ]},
};

const SET_PIECES = {
  corner_left: { label: "Corner (Left)", ballPos: { x: 0, y: 0 }, positions: [
    {x:.04,y:.5},{x:.55,y:.25},{x:.55,y:.45},{x:.55,y:.6},{x:.6,y:.35},{x:.6,y:.55},{x:.02,y:.02}
  ]},
  corner_right: { label: "Corner (Right)", ballPos: { x: 0, y: 1 }, positions: [
    {x:.04,y:.5},{x:.55,y:.4},{x:.55,y:.55},{x:.55,y:.75},{x:.6,y:.45},{x:.6,y:.65},{x:.02,y:.98}
  ]},
  free_kick_central: { label: "Free Kick (Central)", ballPos: { x: 0.55, y: 0.5 }, positions: [
    {x:.04,y:.5},{x:.3,y:.35},{x:.3,y:.65},{x:.52,y:.35},{x:.52,y:.65},{x:.58,y:.5},{x:.55,y:.5}
  ]},
  goal_kick: { label: "Goal Kick", ballPos: { x: 0.06, y: 0.5 }, positions: [
    {x:.04,y:.5},{x:.15,y:.25},{x:.15,y:.75},{x:.35,y:.15},{x:.35,y:.5},{x:.35,y:.85},{x:.55,y:.5}
  ]},
  throw_in_left: { label: "Throw-in (Left)", ballPos: { x: 0.5, y: 0 }, positions: [
    {x:.04,y:.5},{x:.35,y:.3},{x:.35,y:.6},{x:.48,y:.1},{x:.48,y:.35},{x:.55,y:.2},{x:.5,y:.02}
  ]},
};

const PHASE_LABELS = ["Base Shape", "Attacking Transition", "Defending Transition"];
const PHASE_COLORS = ["#94a3b8", "#22c55e", "#ef4444"];

const toPixel = (mx, my) => ({ px: PAD + mx * SCALE, py: PAD + my * SCALE });
const toMeter = (px, py) => ({ mx: Math.max(0, Math.min(PITCH.w, (px - PAD) / SCALE)), my: Math.max(0, Math.min(PITCH.h, (py - PAD) / SCALE)) });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function mirror(pos) { return pos.map(p => ({ ...p, x: 1 - p.x })); }

function makeTeam(fKey, team, existingNames) {
  const f = FORMATIONS[fKey];
  const ps = team === "away" ? mirror(f.pos) : f.pos;
  return ps.map((p, i) => ({
    id: `${team}-${i}`, team, num: i + 1,
    name: existingNames?.[i] || "",
    role: p.role, role2: null,
    mx: p.x * PITCH.w, my: p.y * PITCH.h,
    zonePts: null, // freeform polygon [{mx,my}...]
    instructions: "", preset: null,
    coverTarget: null,
  }));
}

// ═══════════════════════════════════════════════════════
// PITCH SVG
// ═══════════════════════════════════════════════════════
function PitchSVG({ children, homeName, awayName, showOpponent }) {
  const stripes = useMemo(() => {
    const s = [], sw = PW / 10;
    for (let i = 0; i < 10; i++) s.push(<rect key={i} x={PAD+i*sw} y={PAD} width={sw} height={PH} fill={i%2===0?"#2a7d2a":"#268f26"} />);
    return s;
  }, []);
  return (
    <svg width={FULL_W} height={FULL_H} viewBox={`0 0 ${FULL_W} ${FULL_H}`} style={{ borderRadius: 10, display: "block" }}>
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
      <text x={PAD+PW*0.25} y={PAD-10} textAnchor="middle" fontSize={11} fill="#ef4444" fontWeight="700" style={{fontFamily:"'Outfit',sans-serif"}}>{homeName || "Home"}</text>
      {showOpponent && <text x={PAD+PW*0.75} y={PAD-10} textAnchor="middle" fontSize={11} fill="#3b82f6" fontWeight="700" style={{fontFamily:"'Outfit',sans-serif"}}>{awayName || "Away"}</text>}
      {children}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
// PLAYER DOT
// ═══════════════════════════════════════════════════════
function PlayerDot({ player, selected, onSelect, onDrag, isHome, showData, ghost }) {
  const { px, py } = toPixel(player.mx, player.my);
  const fill = player.role === "GK" ? "#f59e0b" : (isHome ? "#ef4444" : "#3b82f6");
  const r = selected ? 16 : 14;
  const dragRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  const onDown = useCallback((e) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    dragRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMove = useCallback((e) => {
    if (!e.target.hasPointerCapture(e.pointerId)) return;
    if (Math.abs(e.clientX - startRef.current.x) > 3 || Math.abs(e.clientY - startRef.current.y) > 3) dragRef.current = true;
    const svg = e.target.closest("svg");
    if (!svg) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const sp = pt.matrixTransform(svg.getScreenCTM().inverse());
    const { mx, my } = toMeter(sp.x, sp.y);
    onDrag(player.id, mx, my);
  }, [player.id, onDrag]);
  const onUp = useCallback((e) => {
    e.target.releasePointerCapture(e.pointerId);
    if (!dragRef.current) onSelect(player.id);
  }, [player.id, onSelect]);

  const displayName = player.name || `#${player.num}`;
  const roleLabel = player.role2 ? `${player.role}/${player.role2}` : player.role;

  return (
    <g style={{ cursor: "grab", opacity: ghost ? 0.65 : 1, transition: "opacity 0.3s" }}>
      {/* Freeform zone */}
      {player.zonePts && player.zonePts.length > 2 && (
        <polygon
          points={player.zonePts.map(p => { const pp = toPixel(p.mx, p.my); return `${pp.px},${pp.py}`; }).join(" ")}
          fill={fill} opacity={0.1} stroke={fill} strokeWidth={1.5} strokeDasharray="5 3" strokeOpacity={0.35}
        />
      )}
      <ellipse cx={px+2} cy={py+3} rx={r*0.8} ry={r*0.4} fill="rgba(0,0,0,0.3)" />
      {selected && <circle cx={px} cy={py} r={r+6} fill="none" stroke="#fff" strokeWidth={2} opacity={0.5}>
        <animate attributeName="r" values={`${r+4};${r+8};${r+4}`} dur="1.5s" repeatCount="indefinite" />
      </circle>}
      {/* Preset indicator */}
      {player.preset && (
        <circle cx={px+r-2} cy={py-r+2} r={4} fill="#f59e0b" stroke="#000" strokeWidth={1} />
      )}
      <circle cx={px} cy={py} r={r} fill={fill} stroke="#fff" strokeWidth={2}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        style={{ filter: selected ? `drop-shadow(0 0 8px ${fill})` : "none" }} />
      <text x={px} y={py+1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="800" fill="#fff" pointerEvents="none"
        style={{ fontFamily: "'Outfit',sans-serif" }}>{player.num}</text>
      {/* Name + role below */}
      <text x={px} y={py+r+11} textAnchor="middle" fontSize={7.5} fill="rgba(255,255,255,0.8)" pointerEvents="none" fontWeight="600"
        style={{ fontFamily: "'Outfit',sans-serif" }}>{displayName}</text>
      <text x={px} y={py+r+21} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.45)" pointerEvents="none" fontWeight="500"
        style={{ fontFamily: "'Outfit',sans-serif" }}>{roleLabel}</text>
      {showData && isHome && (
        <text x={px} y={py-r-6} textAnchor="middle" fontSize={7} fill="rgba(255,255,200,0.7)" pointerEvents="none" style={{fontFamily:"monospace"}}>
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
  const home = players.filter(p=>p.team==="home");
  if(home.length<2) return null;
  const pts = home.map(p=>toPixel(p.mx,p.my));
  const hull = d3.polygonHull(pts.map(p=>[p.px,p.py]));
  const lanes = [];
  for(let i=0;i<home.length;i++) for(let j=i+1;j<home.length;j++){
    const dist=Math.sqrt((home[i].mx-home[j].mx)**2+(home[i].my-home[j].my)**2);
    if(dist<20){const a=toPixel(home[i].mx,home[i].my),b=toPixel(home[j].mx,home[j].my);
      lanes.push(<g key={`l-${i}-${j}`}>
        <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke="rgba(255,255,100,0.15)" strokeWidth={8} strokeLinecap="round"/>
        <text x={(a.px+b.px)/2} y={(a.py+b.py)/2-4} textAnchor="middle" fontSize={8} fill="rgba(255,255,200,0.6)" style={{fontFamily:"monospace"}}>{dist.toFixed(1)}m</text>
      </g>);
    }
  }
  return <g>{hull&&<polygon points={hull.map(p=>p.join(",")).join(" ")} fill="rgba(239,68,68,0.06)" stroke="rgba(239,68,68,0.3)" strokeWidth={1.5} strokeDasharray="6 4"/>}{lanes}</g>;
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

// Ball marker for set pieces
function BallMarker({ mx, my }) {
  const { px, py } = toPixel(mx, my);
  return <g>
    <circle cx={px} cy={py} r={6} fill="#fff" stroke="#333" strokeWidth={1.5}/>
    <circle cx={px-1} cy={py-1} r={1.5} fill="#ccc"/>
  </g>;
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
  <button onClick={onClick} style={{background:active?(color||"rgba(255,255,255,0.12)"):"rgba(255,255,255,0.04)",color:active?"#fff":"#94a3b8",
    border:`1px solid ${active?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:6,padding:small?"3px 7px":"5px 10px",
    fontSize:small?10:11,fontWeight:600,cursor:"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.15s"}}>{label}</button>
);}
function Btn({children,onClick,bg,disabled,small}){return(
  <button onClick={onClick} disabled={disabled} style={{background:disabled?"#1e293b":(bg||"#1e293b"),color:disabled?"#475569":"#fff",
    border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:small?"5px 10px":"8px 14px",
    fontSize:small?11:12,fontWeight:600,cursor:disabled?"default":"pointer",fontFamily:"'Outfit',sans-serif",transition:"all 0.15s"}}>{children}</button>
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
  const [homeName, setHomeName] = useState("Bandidos");
  const [awayName, setAwayName] = useState("Opponent");
  const [homeForm, setHomeForm] = useState("2-3-1");
  const [awayForm, setAwayForm] = useState("3-2-1");
  const [showOpp, setShowOpp] = useState(true);
  const [showData, setShowData] = useState(false);
  const [showArrows, setShowArrows] = useState(true);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("tactics"); // tactics | setpiece | drawzone
  const [setPiece, setSetPiece] = useState(null);
  const [drawingZone, setDrawingZone] = useState(null); // {playerId, points:[]}

  const [phases, setPhases] = useState(() => ({
    0: { home: makeTeam("2-3-1","home"), away: makeTeam("3-2-1","away") },
    1: { home: makeTeam("2-3-1","home"), away: makeTeam("3-2-1","away") },
    2: { home: makeTeam("2-3-1","home"), away: makeTeam("3-2-1","away") },
  }));
  const [phase, setPhase] = useState(0);
  const [anim, setAnim] = useState(false);
  const [animProg, setAnimProg] = useState(0);
  const [animSpd, setAnimSpd] = useState(1);
  const animRef = useRef(null);

  const cur = phases[phase];

  // ─── Formation change (preserve names) ───
  const changeForm = useCallback((key, team) => {
    if (team==="home") setHomeForm(key); else setAwayForm(key);
    setPhases(prev => {
      const n = {...prev};
      for(let i=0;i<3;i++){
        const oldPlayers = n[i][team];
        const names = oldPlayers.map(p=>p.name);
        n[i] = {...n[i], [team]: makeTeam(key, team, names)};
      }
      return n;
    });
  },[]);

  // ─── Update player field across all phases ───
  const updatePlayerAll = useCallback((id, updates) => {
    setPhases(prev => {
      const team = id.startsWith("home")?"home":"away";
      const n = {...prev};
      for(let i=0;i<3;i++) n[i] = {...n[i], [team]: n[i][team].map(p => p.id===id?{...p,...updates}:p)};
      return n;
    });
  },[]);

  // ─── Update player in current phase only ───
  const updatePlayerPhase = useCallback((id, updates) => {
    setPhases(prev => {
      const team = id.startsWith("home")?"home":"away";
      const n = {...prev};
      n[phase] = {...n[phase], [team]: n[phase][team].map(p => p.id===id?{...p,...updates}:p)};
      return n;
    });
  },[phase]);

  const handleDrag = useCallback((id,mx,my) => updatePlayerPhase(id,{mx,my}),[updatePlayerPhase]);
  const handleSelect = useCallback((id) => {
    if(mode==="drawzone") return;
    setSelected(p=>p===id?null:id);
  },[mode]);

  // ─── Apply preset to generate next phase positions ───
  const applyPreset = useCallback((playerId, presetId) => {
    const preset = PRESETS.find(p=>p.id===presetId);
    if(!preset) return;
    updatePlayerAll(playerId, { preset: presetId, instructions: preset.desc });
    // Apply movement to phases 1 and 2
    setPhases(prev => {
      const team = playerId.startsWith("home")?"home":"away";
      const n = {...prev};
      const basePlayer = n[0][team].find(p=>p.id===playerId);
      if(!basePlayer) return prev;
      const dy = typeof preset.dy === "function" ? preset.dy(basePlayer) : preset.dy;
      // Phase 1 (attacking transition): apply half movement
      n[1] = {...n[1], [team]: n[1][team].map(p => p.id===playerId ? {
        ...p, mx: clamp(basePlayer.mx + preset.dx * 0.5, 0, PITCH.w), my: clamp(basePlayer.my + dy * 0.5, 0, PITCH.h)
      } : p)};
      // Phase 2 (defending transition): return closer to base
      n[2] = {...n[2], [team]: n[2][team].map(p => p.id===playerId ? {
        ...p, mx: clamp(basePlayer.mx - preset.dx * 0.3, 0, PITCH.w), my: clamp(basePlayer.my - dy * 0.3, 0, PITCH.h)
      } : p)};
      return n;
    });
  },[updatePlayerAll]);

  // ─── Set piece mode ───
  const loadSetPiece = useCallback((key) => {
    const sp = SET_PIECES[key];
    if(!sp) return;
    setSetPiece(key);
    setMode("setpiece");
    setPhases(prev => {
      const n = {...prev};
      const names = n[0].home.map(p=>p.name);
      const homeTeam = sp.positions.map((p,i) => ({
        ...n[0].home[i],
        mx: p.x * PITCH.w, my: p.y * PITCH.h,
        name: names[i] || "",
      }));
      n[0] = {...n[0], home: homeTeam};
      return n;
    });
    setPhase(0);
  },[]);

  const exitSetPiece = useCallback(() => {
    setMode("tactics"); setSetPiece(null);
  },[]);

  // ─── Zone drawing ───
  const startDrawZone = useCallback((playerId) => {
    setMode("drawzone");
    setDrawingZone({ playerId, points: [] });
  },[]);

  const handlePitchClick = useCallback((e) => {
    if(mode === "drawzone" && drawingZone) {
      const svg = e.target.closest("svg");
      if(!svg) return;
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const sp = pt.matrixTransform(svg.getScreenCTM().inverse());
      const { mx, my } = toMeter(sp.x, sp.y);
      setDrawingZone(prev => ({...prev, points: [...prev.points, {mx,my}]}));
      return;
    }
    setSelected(null);
  },[mode, drawingZone]);

  const finishDrawZone = useCallback(() => {
    if(drawingZone && drawingZone.points.length >= 3) {
      updatePlayerAll(drawingZone.playerId, { zonePts: drawingZone.points });
    }
    setDrawingZone(null);
    setMode("tactics");
  },[drawingZone, updatePlayerAll]);

  const cancelDrawZone = useCallback(() => {
    setDrawingZone(null);
    setMode("tactics");
  },[]);

  // ─── Copy phase ───
  const copyPhase = useCallback((from,to) => {
    setPhases(prev => { const n={...prev}; n[to]=JSON.parse(JSON.stringify(prev[from])); return n; });
  },[]);

  // ─── Animation ───
  const interp = useCallback((from,to,t) => from.map((fp,i) => {
    const tp=to[i]; if(!tp) return fp;
    return {...fp, mx:fp.mx+(tp.mx-fp.mx)*t, my:fp.my+(tp.my-fp.my)*t};
  }),[]);

  const startAnim = useCallback(() => {
    if(anim){cancelAnimationFrame(animRef.current);setAnim(false);return;}
    setAnim(true);setAnimProg(0);
    const dur=4000/animSpd, t0=performance.now();
    const tick=(now)=>{const p=Math.min(1,(now-t0)/dur);setAnimProg(p);if(p<1)animRef.current=requestAnimationFrame(tick);else setAnim(false);};
    animRef.current=requestAnimationFrame(tick);
  },[anim,animSpd]);

  const animPlayers = useMemo(()=>{
    if(!anim&&animProg===0) return {home:cur.home,away:cur.away};
    let fi,ti,t;
    if(animProg<=0.5){fi=0;ti=1;t=animProg*2;} else{fi=1;ti=2;t=(animProg-0.5)*2;}
    t=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    return {home:interp(phases[fi].home,phases[ti].home,t),away:interp(phases[fi].away,phases[ti].away,t)};
  },[anim,animProg,phases,cur,interp]);

  const dispHome = anim ? animPlayers.home : cur.home;
  const dispAway = anim ? animPlayers.away : cur.away;
  const selData = selected ? [...cur.home,...cur.away].find(p=>p.id===selected) : null;

  // ─── Export / Import ───
  const exportData = useCallback(() => {
    const data = { version: VERSION, homeName, awayName, homeForm, awayForm, phases, mode: mode==="setpiece"?setPiece:null };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${homeName.replace(/\s+/g,"_")}_vs_${awayName.replace(/\s+/g,"_")}_tactics.json`;
    a.click(); URL.revokeObjectURL(url);
  },[homeName,awayName,homeForm,awayForm,phases,mode,setPiece]);

  const importRef = useRef(null);
  const importData = useCallback((e) => {
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if(d.homeName) setHomeName(d.homeName);
        if(d.awayName) setAwayName(d.awayName);
        if(d.homeForm) setHomeForm(d.homeForm);
        if(d.awayForm) setAwayForm(d.awayForm);
        if(d.phases) setPhases(d.phases);
        if(d.mode) { setMode("setpiece"); setSetPiece(d.mode); }
      } catch(err) { console.error("Import failed", err); }
    };
    reader.readAsText(f);
    e.target.value = "";
  },[]);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(170deg,#0a0f1a 0%,#0d1117 40%,#111318 100%)",color:"#e2e8f0",fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* ─── HEADER ─── */}
      <div style={{background:"linear-gradient(90deg,rgba(239,68,68,0.06),transparent,rgba(59,130,246,0.06))",borderBottom:"1px solid rgba(255,255,255,0.05)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#ef4444,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 4px 12px rgba(239,68,68,0.3)"}}>⚽</div>
          <div>
            <div style={{fontSize:17,fontWeight:700,letterSpacing:"-0.02em"}}>Bandidos Tactic Lab</div>
            <div style={{fontSize:10,color:"#4b5563",letterSpacing:1.5,textTransform:"uppercase"}}>Football 7 Tactical Simulator — {VERSION}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <Chip label={showOpp?"Opponent ✓":"Opponent"} active={showOpp} onClick={()=>setShowOpp(!showOpp)} />
          <Chip label="Data" active={showData} onClick={()=>setShowData(!showData)} color="rgba(245,158,11,0.3)" />
          <Chip label="Arrows" active={showArrows} onClick={()=>setShowArrows(!showArrows)} />
          <div style={{width:1,height:20,background:"rgba(255,255,255,0.1)",margin:"0 4px"}}/>
          <Btn small bg="#1e293b" onClick={exportData}>💾 Export</Btn>
          <Btn small bg="#1e293b" onClick={()=>importRef.current?.click()}>📂 Import</Btn>
          <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importData}/>
        </div>
      </div>

      <div style={{display:"flex",gap:0,height:"calc(100vh - 56px)"}}>
        {/* ═══ LEFT SIDEBAR ═══ */}
        <div style={{width:260,minWidth:260,padding:"12px",overflowY:"auto",borderRight:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.15)"}}>

          {/* Team Names */}
          <Panel title="Team Names" accent="#94a3b8">
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#ef4444"}}/>
                <Input value={homeName} onChange={setHomeName} placeholder="Home team"/>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#3b82f6"}}/>
                <Input value={awayName} onChange={setAwayName} placeholder="Away team"/>
              </div>
            </div>
          </Panel>

          {/* Formations */}
          <Panel title="🔴 Home Formation" accent="#ef4444">
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {Object.keys(FORMATIONS).map(k=><Chip key={k} label={FORMATIONS[k].label} active={homeForm===k} onClick={()=>changeForm(k,"home")} color="rgba(239,68,68,0.25)"/>)}
            </div>
          </Panel>
          {showOpp && <Panel title="🔵 Opponent Formation" accent="#3b82f6">
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {Object.keys(FORMATIONS).map(k=><Chip key={k} label={FORMATIONS[k].label} active={awayForm===k} onClick={()=>changeForm(k,"away")} color="rgba(59,130,246,0.25)"/>)}
            </div>
          </Panel>}

          {/* Phases */}
          <Panel title="⏱ Phases" accent="#f59e0b">
            <div style={{display:"flex",gap:3,marginBottom:8}}>
              {PHASE_LABELS.map((l,i)=>(
                <button key={i} onClick={()=>{if(!anim)setPhase(i);}} style={{
                  flex:1,padding:"6px 2px",fontSize:9,fontWeight:700,
                  background:phase===i?PHASE_COLORS[i]+"22":"rgba(255,255,255,0.03)",
                  border:`1px solid ${phase===i?PHASE_COLORS[i]+"66":"rgba(255,255,255,0.06)"}`,
                  borderRadius:6,color:phase===i?PHASE_COLORS[i]:"#64748b",cursor:"pointer",fontFamily:"'Outfit',sans-serif"
                }}>{l}</button>
              ))}
            </div>
            {phase>0&&<div style={{marginBottom:8}}><Btn small bg="#1e293b" onClick={()=>copyPhase(phase-1,phase)}>← Copy from {PHASE_LABELS[phase-1]}</Btn></div>}
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <Btn bg={anim?"#dc2626":"#16a34a"} onClick={startAnim}>{anim?"⏹ Stop":"▶ Animate"}</Btn>
              <select value={animSpd} onChange={e=>setAnimSpd(+e.target.value)} style={{background:"#1e293b",color:"#e2e8f0",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,padding:"2px 4px",fontSize:10,fontFamily:"'Outfit',sans-serif"}}>
                <option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option>
              </select>
            </div>
            {anim&&<div style={{marginTop:8,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${animProg*100}%`,background:`linear-gradient(90deg,${PHASE_COLORS[0]},${PHASE_COLORS[1]},${PHASE_COLORS[2]})`,borderRadius:2}}/>
            </div>}
          </Panel>

          {/* Set Pieces */}
          <Panel title="🏁 Set Pieces" accent="#8b5cf6">
            {mode==="setpiece" && <div style={{marginBottom:8}}>
              <Btn small bg="#7c3aed" onClick={exitSetPiece}>← Back to Tactics</Btn>
              <div style={{fontSize:10,color:"#a78bfa",marginTop:4}}>Editing: {SET_PIECES[setPiece]?.label}</div>
            </div>}
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {Object.keys(SET_PIECES).map(k=><Chip key={k} label={SET_PIECES[k].label} active={setPiece===k} onClick={()=>loadSetPiece(k)} color="rgba(139,92,246,0.25)" small/>)}
            </div>
          </Panel>

          {/* How to use */}
          <Panel title="💡 How to Use">
            <div style={{fontSize:11,color:"#64748b",lineHeight:1.7}}>
              <div>• <strong style={{color:"#94a3b8"}}>Drag</strong> players to reposition</div>
              <div>• <strong style={{color:"#94a3b8"}}>Click</strong> a player to edit details</div>
              <div>• Assign <strong style={{color:"#f59e0b"}}>presets</strong> to auto-generate transitions</div>
              <div>• <strong style={{color:"#94a3b8"}}>Draw zones</strong> by painting on the pitch</div>
              <div>• <strong style={{color:"#94a3b8"}}>Export/Import</strong> to save tactics</div>
            </div>
          </Panel>
        </div>

        {/* ═══ PITCH ═══ */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",overflow:"auto",padding:16,position:"relative"}}>
          {/* Zone drawing banner */}
          {mode==="drawzone"&&<div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",zIndex:10,
            background:"rgba(124,58,237,0.9)",borderRadius:8,padding:"8px 16px",display:"flex",gap:10,alignItems:"center",fontSize:12,fontWeight:600}}>
            Click on pitch to draw zone ({drawingZone?.points.length || 0} points)
            <Btn small bg="#16a34a" onClick={finishDrawZone}>✓ Done</Btn>
            <Btn small bg="#dc2626" onClick={cancelDrawZone}>✕ Cancel</Btn>
          </div>}

          <div onClick={handlePitchClick}>
            <PitchSVG homeName={homeName} awayName={awayName} showOpponent={showOpp}>
              {showData && <DataOverlay players={dispHome}/>}
              {showArrows && !anim && phase>0 && <>
                <Arrows from={phases[phase-1].home} to={phases[phase].home} color="#ef4444"/>
                {showOpp && <Arrows from={phases[phase-1].away} to={phases[phase].away} color="#3b82f6"/>}
              </>}
              {showOpp && <CoverLines home={dispHome} away={dispAway}/>}

              {/* Set piece ball */}
              {mode==="setpiece" && setPiece && SET_PIECES[setPiece] && (
                <BallMarker mx={SET_PIECES[setPiece].ballPos.x * PITCH.w} my={SET_PIECES[setPiece].ballPos.y * PITCH.h}/>
              )}

              {/* Drawing zone preview */}
              {drawingZone && drawingZone.points.length > 0 && (
                <polygon
                  points={drawingZone.points.map(p=>{const pp=toPixel(p.mx,p.my);return `${pp.px},${pp.py}`;}).join(" ")}
                  fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3"
                />
              )}

              {showOpp && dispAway.map(p=><PlayerDot key={p.id} player={p} selected={selected===p.id} onSelect={handleSelect} onDrag={handleDrag} isHome={false} showData={showData} ghost/>)}
              {dispHome.map(p=><PlayerDot key={p.id} player={p} selected={selected===p.id} onSelect={handleSelect} onDrag={handleDrag} isHome={true} showData={showData}/>)}
            </PitchSVG>
          </div>
        </div>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <div style={{width:260,minWidth:260,padding:"12px",overflowY:"auto",borderLeft:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.15)"}}>
          {selData ? <>
            <Panel title={`${selData.name||"Player"} #${selData.num}`} accent={selData.team==="home"?"#ef4444":"#3b82f6"}>
              {/* Name */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:600}}>NAME</div>
                <Input value={selData.name} onChange={v=>updatePlayerAll(selData.id,{name:v})} placeholder={`Player ${selData.num}`}/>
              </div>
              {/* Primary Role */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:600}}>PRIMARY ROLE</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {ROLES.map(r=><Chip key={r.id} label={r.short} active={selData.role===r.id} onClick={()=>updatePlayerAll(selData.id,{role:r.id})} color={ROLE_COLORS[r.id]+"44"} small/>)}
                </div>
              </div>
              {/* Secondary Role */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:600}}>SECONDARY ROLE <span style={{color:"#4b5563"}}>(optional)</span></div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  <Chip label="None" active={!selData.role2} onClick={()=>updatePlayerAll(selData.id,{role2:null})} small/>
                  {ROLES.filter(r=>r.id!==selData.role).map(r=><Chip key={r.id} label={r.short} active={selData.role2===r.id} onClick={()=>updatePlayerAll(selData.id,{role2:r.id})} color={ROLE_COLORS[r.id]+"33"} small/>)}
                </div>
              </div>
              {/* Position */}
              <div style={{fontSize:11,color:"#64748b",marginBottom:8,fontFamily:"monospace"}}>
                Pos: {selData.mx.toFixed(1)}m × {selData.my.toFixed(1)}m
              </div>
              {/* Movement Zone */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:600}}>MOVEMENT ZONE</div>
                <div style={{display:"flex",gap:4}}>
                  <Btn small bg={mode==="drawzone"?"#7c3aed":"#1e293b"} onClick={()=>startDrawZone(selData.id)}>🎨 Paint Zone</Btn>
                  {selData.zonePts && <Btn small bg="#dc2626" onClick={()=>updatePlayerAll(selData.id,{zonePts:null})}>✕ Clear</Btn>}
                </div>
                {selData.zonePts && <div style={{fontSize:10,color:"#a78bfa",marginTop:4}}>{selData.zonePts.length} points defined</div>}
              </div>
              {/* Presets */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:600}}>MOVEMENT PRESET</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {PRESETS.map(p=><Chip key={p.id} label={p.label} active={selData.preset===p.id} onClick={()=>applyPreset(selData.id,p.id)} color="rgba(245,158,11,0.25)" small/>)}
                </div>
                {selData.preset && <div style={{fontSize:10,color:"#fbbf24",marginTop:4}}>
                  {PRESETS.find(p=>p.id===selData.preset)?.desc}
                </div>}
              </div>
              {/* Instructions */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:600}}>INSTRUCTIONS</div>
                <textarea value={selData.instructions} onChange={e=>updatePlayerAll(selData.id,{instructions:e.target.value})}
                  placeholder="e.g. Press when ball enters their half. Track back on transitions."
                  rows={3} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:6,color:"#e2e8f0",padding:8,fontSize:11,resize:"vertical",fontFamily:"'Outfit',sans-serif",outline:"none"}}/>
              </div>
              {/* Cover */}
              {selData.team==="home" && showOpp && <div>
                <div style={{fontSize:10,color:"#64748b",marginBottom:3,fontWeight:600}}>MARKING ASSIGNMENT</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  <Chip label="None" active={!selData.coverTarget} onClick={()=>updatePlayerAll(selData.id,{coverTarget:null})} small/>
                  {cur.away.map(ap=><Chip key={ap.id} label={`#${ap.num} ${ap.name||ap.role}`} active={selData.coverTarget===ap.id}
                    onClick={()=>updatePlayerAll(selData.id,{coverTarget:ap.id})} color="rgba(59,130,246,0.25)" small/>)}
                </div>
              </div>}
            </Panel>
          </> : <Panel title="Player Details">
            <div style={{fontSize:12,color:"#4b5563",lineHeight:1.7,textAlign:"center",padding:"20px 0"}}>
              Click on any player to edit their name, role, instructions, and assignments.
            </div>
          </Panel>}

          {/* Team stats */}
          <Panel title="📊 Team Shape" accent="#10b981">
            {(()=>{
              const h=cur.home;
              const xs=h.map(p=>p.mx),ys=h.map(p=>p.my);
              const w=(Math.max(...xs)-Math.min(...xs)).toFixed(1);
              const d=(Math.max(...ys)-Math.min(...ys)).toFixed(1);
              let td=0,pr=0;
              for(let i=0;i<h.length;i++) for(let j=i+1;j<h.length;j++){td+=Math.sqrt((h[i].mx-h[j].mx)**2+(h[i].my-h[j].my)**2);pr++;}
              const dl=h.filter(p=>p.role==="CB"||p.role==="FB").map(p=>p.mx);
              const dh=dl.length?(dl.reduce((a,b)=>a+b,0)/dl.length).toFixed(1):"—";
              return <div style={{fontSize:11,lineHeight:2,color:"#94a3b8"}}>
                <div>Formation: <strong style={{color:"#e2e8f0"}}>{homeForm}</strong></div>
                <div>Width: <strong style={{color:"#e2e8f0"}}>{w}m</strong></div>
                <div>Depth: <strong style={{color:"#e2e8f0"}}>{d}m</strong></div>
                <div>Avg spacing: <strong style={{color:"#e2e8f0"}}>{pr?(td/pr).toFixed(1):"—"}m</strong></div>
                <div>Def. line: <strong style={{color:"#e2e8f0"}}>{dh}m</strong></div>
              </div>;
            })()}
          </Panel>

          {/* Player roster */}
          <Panel title="📋 Roster" accent="#94a3b8">
            <div style={{maxHeight:200,overflowY:"auto"}}>
              {cur.home.map(p=>(
                <div key={p.id} onClick={()=>setSelected(p.id)} style={{
                  display:"flex",gap:6,alignItems:"center",padding:"3px 6px",borderRadius:4,cursor:"pointer",
                  background:selected===p.id?"rgba(239,68,68,0.1)":"transparent",fontSize:11
                }}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#ef4444"}}/>
                  <span style={{color:"#94a3b8",fontFamily:"monospace",minWidth:16}}>#{p.num}</span>
                  <span style={{color:"#e2e8f0",flex:1}}>{p.name||`Player ${p.num}`}</span>
                  <span style={{color:"#64748b",fontSize:9}}>{p.role}{p.role2?`/${p.role2}`:""}</span>
                </div>
              ))}
              {showOpp && <>
                <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"6px 0"}}/>
                {cur.away.map(p=>(
                  <div key={p.id} onClick={()=>setSelected(p.id)} style={{
                    display:"flex",gap:6,alignItems:"center",padding:"3px 6px",borderRadius:4,cursor:"pointer",
                    background:selected===p.id?"rgba(59,130,246,0.1)":"transparent",fontSize:11
                  }}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#3b82f6"}}/>
                    <span style={{color:"#94a3b8",fontFamily:"monospace",minWidth:16}}>#{p.num}</span>
                    <span style={{color:"#e2e8f0",flex:1}}>{p.name||`Player ${p.num}`}</span>
                    <span style={{color:"#64748b",fontSize:9}}>{p.role}</span>
                  </div>
                ))}
              </>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
