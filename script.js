/* Neon Survivors
   - Single-file vanilla JS canvas game for GitHub Pages
   - Auto-aim + auto-attack, XP gems, level-up choices, waves, scaling, simple meta stats
   - All visuals are original simple shapes (no copyrighted assets)
*/
(() => {
  "use strict";

  // ---------- Canvas / DPI ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  // ---------- HUD ----------
  const elTime = document.getElementById("time");
  const elHP = document.getElementById("hp");
  const elHPMax = document.getElementById("hpMax");
  const elLevel = document.getElementById("level");
  const elKills = document.getElementById("kills");
  const elXPFill = document.getElementById("xpFill");

  // ---------- Utility ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  const len = (x, y) => Math.hypot(x, y);
  const norm = (x, y) => {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  // ---------- Input (Keyboard + Touch joystick) ----------
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === "p") togglePause();
  }, { passive:false });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()), { passive:true });

  const joyBase = document.getElementById("joyBase");
  const joyKnob = document.getElementById("joyKnob");
  let joy = { active:false, id:null, cx:0, cy:0, vx:0, vy:0 };

  function setKnob(nx, ny) {
    // nx, ny in [-1,1]
    const radius = 45;
    joyKnob.style.left = (50 + nx * (radius/70) * 50) + "%";
    joyKnob.style.top  = (50 + ny * (radius/70) * 50) + "%";
  }
  function joyStart(e) {
    const t = (e.changedTouches ? e.changedTouches[0] : e);
    const rect = joyBase.getBoundingClientRect();
    joy.active = true;
    joy.id = t.identifier ?? "mouse";
    joy.cx = rect.left + rect.width/2;
    joy.cy = rect.top + rect.height/2;
    joyMove(e);
  }
  function joyMove(e) {
    if (!joy.active) return;
    let touch = null;
    if (e.changedTouches) {
      for (const t of e.changedTouches) if ((t.identifier ?? null) === joy.id) { touch = t; break; }
      if (!touch) return;
    } else touch = e;

    const dx = touch.clientX - joy.cx;
    const dy = touch.clientY - joy.cy;
    const radius = 52;
    const l = Math.hypot(dx, dy);
    const k = l > radius ? radius / l : 1;
    const ndx = dx * k;
    const ndy = dy * k;

    joy.vx = ndx / radius;
    joy.vy = ndy / radius;

    setKnob(joy.vx, joy.vy);
  }
  function joyEnd(e) {
    if (!joy.active) return;
    joy.active = false;
    joy.id = null;
    joy.vx = 0; joy.vy = 0;
    setKnob(0,0);
  }

  joyBase.addEventListener("touchstart", (e) => { e.preventDefault(); joyStart(e); }, { passive:false });
  joyBase.addEventListener("touchmove", (e) => { e.preventDefault(); joyMove(e); }, { passive:false });
  joyBase.addEventListener("touchend", (e) => { e.preventDefault(); joyEnd(e); }, { passive:false });
  joyBase.addEventListener("touchcancel", (e) => { e.preventDefault(); joyEnd(e); }, { passive:false });

  joyBase.addEventListener("mousedown", (e) => { e.preventDefault(); joyStart(e); }, { passive:false });
  window.addEventListener("mousemove", (e) => joyMove(e), { passive:true });
  window.addEventListener("mouseup", () => joyEnd({}), { passive:true });

  // ---------- UI overlays ----------
  const overlay = document.getElementById("overlay");
  const pauseBtn = document.getElementById("pauseBtn");
  const resumeBtn = document.getElementById("resume");
  const restartBtn = document.getElementById("restart");
  const bestTimeEl = document.getElementById("bestTime");
  const lastTimeEl = document.getElementById("lastTime");

  pauseBtn.addEventListener("click", () => togglePause(), { passive:true });
  resumeBtn.addEventListener("click", () => setPaused(false), { passive:true });
  restartBtn.addEventListener("click", () => hardRestart(), { passive:true });

  const levelUpOverlay = document.getElementById("levelUp");
  const cardsEl = document.getElementById("cards");

  // ---------- World ----------
  const world = {
    time: 0,
    paused: false,
    gameOver: false,
    camX: 0,
    camY: 0,
    shake: 0,
    kills: 0,
    difficulty: 1, // scales with time
    lastDT: 0,
    seed: Math.random()*1e9,
  };

  // ---------- Save (best time) ----------
  const SAVE_KEY = "neon_survivors_save_v1";
  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveSave(obj) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); } catch {}
  }
  let save = loadSave();
  bestTimeEl.textContent = fmtTime(save.bestTime || 0);
  lastTimeEl.textContent = fmtTime(save.lastTime || 0);

  // ---------- Entities ----------
  const bullets = [];
  const enemies = [];
  const gems = [];
  const particles = [];

  function makePlayer() {
    return {
      x: 0, y: 0,
      r: 14,
      speed: 165,
      hpMax: 100,
      hp: 100,
      regen: 0,
      armor: 0,
      magnet: 110,
      iFrames: 0, // invuln after hit
      xp: 0,
      level: 1,
      xpToNext: 20,
      // core weapons
      weapons: {
        wand: { level: 1, cd: 0, baseCd: 0.58, dmg: 18, projSpeed: 420, pierce: 0, count: 1 },
        orbit: { level: 0, angle: 0, count: 0, radius: 42, dmg: 10 },
        nova: { level: 0, cd: 0, baseCd: 6.0, dmg: 28, radius: 90 },
        chain: { level: 0, cd: 0, baseCd: 3.2, dmg: 22, jumps: 2, range: 170 },
      },
      // general modifiers
      mod: {
        damage: 1.0,
        area: 1.0,
        cd: 1.0,
        proj: 1.0,
        move: 1.0,
      }
    };
  }
  let player = makePlayer();

  function resetRun() {
    bullets.length = 0;
    enemies.length = 0;
    gems.length = 0;
    particles.length = 0;

    world.time = 0;
    world.kills = 0;
    world.gameOver = false;
    world.paused = true; // start paused with menu
    world.shake = 0;

    player = makePlayer();
    player.x = 0; player.y = 0;

    updateHUD();
    showMenu(true);
  }

  // ---------- Spawning / Waves ----------
  function spawnEnemy(type, x, y, scale=1) {
    const base = {
      grunt: { r: 13, hp: 46, speed: 75, dmg: 12, xp: 1, color: "#ff4d6d" },
      runner:{ r: 11, hp: 34, speed: 110, dmg: 10, xp: 1, color: "#ff8a4d" },
      tank:  { r: 18, hp: 115, speed: 55, dmg: 18, xp: 2, color: "#c04dff" },
      spitter:{ r: 14, hp: 58, speed: 70, dmg: 12, xp: 2, color: "#4df0ff" },
      elite: { r: 22, hp: 260, speed: 65, dmg: 26, xp: 8, color: "#6dff95" },
    }[type] || null;

    if (!base) return;

    enemies.push({
      type,
      x, y,
      r: base.r * scale,
      hpMax: base.hp * (0.85 + 0.15*scale),
      hp: base.hp * (0.85 + 0.15*scale),
      speed: base.speed * (0.9 + 0.1*scale),
      dmg: base.dmg,
      xp: base.xp,
      color: base.color,
      hitFlash: 0,
      shotCd: rand(0.4, 1.1),
    });
  }

  function spawnRing(count, minDist, maxDist, types) {
    for (let i=0;i<count;i++){
      const a = rand(0, Math.PI*2);
      const d = rand(minDist, maxDist);
      const x = player.x + Math.cos(a)*d;
      const y = player.y + Math.sin(a)*d;
      const t = types[randi(0, types.length-1)];
      spawnEnemy(t, x, y, 1);
    }
  }

  function waveDirector(dt) {
    // Scale difficulty smoothly with time
    world.difficulty = 1 + world.time / 75;

    // Spawn budget per second
    const budget = 2.0 + world.difficulty * 1.25;
    waveDirector.acc = (waveDirector.acc || 0) + budget * dt;

    while (waveDirector.acc >= 1) {
      waveDirector.acc -= 1;

      // Choose enemy mix by time
      const t = world.time;
      let pool = ["grunt","runner"];
      if (t > 40) pool.push("tank");
      if (t > 75) pool.push("spitter");
      if (t > 105) pool.push("tank","runner");
      if (t > 140) pool.push("spitter","tank");

      // Spawn one enemy somewhere off-screen
      const pad = 70;
      const side = randi(0,3);
      let x = player.x, y = player.y;
      const rx = W/2 + pad;
      const ry = H/2 + pad;
      if (side===0){ x += rand(-rx, rx); y += -ry; }
      if (side===1){ x += rx; y += rand(-ry, ry); }
      if (side===2){ x += rand(-rx, rx); y += ry; }
      if (side===3){ x += -rx; y += rand(-ry, ry); }

      const type = pool[randi(0, pool.length-1)];
      const scale = 1 + (world.difficulty-1)*0.12;
      spawnEnemy(type, x, y, scale);
    }

    // Milestones: elites
    if (!waveDirector.nextElite) waveDirector.nextElite = 45;
    if (world.time >= waveDirector.nextElite) {
      waveDirector.nextElite += 45;
      const a = rand(0, Math.PI*2);
      const d = rand(W*0.65, W*0.85);
      spawnEnemy("elite", player.x + Math.cos(a)*d, player.y + Math.sin(a)*d, 1 + world.difficulty*0.05);
      popText("ELITE!", player.x, player.y - 90);
    }
  }

  // ---------- Combat / Weapons ----------
  function nearestEnemy(maxRange=99999) {
    let best = null;
    let bestD2 = maxRange*maxRange;
    for (const e of enemies) {
      const d2 = dist2(player.x, player.y, e.x, e.y);
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  function fireWand() {
    const w = player.weapons.wand;
    const target = nearestEnemy(650);
    if (!target) return;

    const [dx,dy] = norm(target.x - player.x, target.y - player.y);
    const spread = 0.14;
    for (let i=0;i<w.count;i++){
      const ang = Math.atan2(dy,dx) + rand(-spread, spread) * (w.count>1 ? 1 : 0.6);
      const vx = Math.cos(ang) * w.projSpeed * player.mod.proj;
      const vy = Math.sin(ang) * w.projSpeed * player.mod.proj;
      bullets.push({
        x: player.x, y: player.y,
        vx, vy,
        r: 4.5,
        life: 1.9,
        dmg: w.dmg * player.mod.damage,
        pierce: w.pierce,
        color: "#6df0ff",
        kind: "wand"
      });
    }
    puff(player.x, player.y, 6);
  }

  function tickOrbit(dt) {
    const o = player.weapons.orbit;
    if (o.level<=0 || o.count<=0) return;
    o.angle += dt * 2.2;
    const count = o.count;
    for (let i=0;i<count;i++){
      const ang = o.angle + i*(Math.PI*2/count);
      const r = o.radius * player.mod.area;
      const ox = player.x + Math.cos(ang)*r;
      const oy = player.y + Math.sin(ang)*r;

      // Damage enemies that overlap
      for (const e of enemies) {
        if (dist2(ox,oy,e.x,e.y) <= (e.r+9)*(e.r+9)) {
          // small continuous damage with cooldown per enemy
          e._orbitHit = e._orbitHit || 0;
          e._orbitHit -= dt;
          if (e._orbitHit <= 0) {
            e._orbitHit = 0.22;
            hitEnemy(e, o.dmg * player.mod.damage, ox, oy, true);
          }
        }
      }
    }
  }

  function tickNova(dt) {
    const n = player.weapons.nova;
    if (n.level<=0) return;
    n.cd -= dt;
    if (n.cd > 0) return;
    n.cd = n.baseCd / player.mod.cd;

    const radius = n.radius * player.mod.area;
    // big pulse damage
    for (const e of enemies) {
      if (dist2(player.x,player.y,e.x,e.y) <= (radius+e.r)*(radius+e.r)) {
        hitEnemy(e, n.dmg * player.mod.damage, e.x, e.y, false);
      }
    }
    // visual ring
    ring(player.x, player.y, radius);
    world.shake = Math.max(world.shake, 6);
  }

  function tickChain(dt) {
    const c = player.weapons.chain;
    if (c.level<=0) return;
    c.cd -= dt;
    if (c.cd > 0) return;
    c.cd = c.baseCd / player.mod.cd;

    let cur = nearestEnemy(c.range * player.mod.area);
    if (!cur) return;

    const hits = new Set();
    for (let j=0;j<1 + c.jumps; j++){
      if (!cur) break;
      hits.add(cur);
      hitEnemy(cur, c.dmg * player.mod.damage, cur.x, cur.y, false);
      zap(player.x, player.y, cur.x, cur.y);
      // find next nearest to current excluding hits
      let best = null, bestD2 = (c.range*player.mod.area)**2;
      for (const e of enemies) {
        if (hits.has(e)) continue;
        const d2 = dist2(cur.x,cur.y,e.x,e.y);
        if (d2 < bestD2) { bestD2 = d2; best = e; }
      }
      cur = best;
    }
  }

  // ---------- Damage / Death / XP ----------
  function hitEnemy(e, dmg, hx, hy, soft=false) {
    e.hp -= dmg;
    e.hitFlash = 0.08;
    // particles
    spark(hx, hy, soft ? 4 : 8);
    if (e.hp <= 0) {
      killEnemy(e);
    }
  }

  function killEnemy(e) {
    // drop gems
    const n = (e.xp <= 1) ? 1 : (e.xp===2 ? 2 : 4);
    for (let i=0;i<n;i++){
      gems.push({
        x: e.x + rand(-8,8),
        y: e.y + rand(-8,8),
        r: 5,
        val: e.xp===8 ? 6 : 1,
        vx: rand(-25,25),
        vy: rand(-25,25),
        t: 0
      });
    }
    // death burst
    boom(e.x, e.y, e.r*1.25);
    world.kills++;
    // remove
    const idx = enemies.indexOf(e);
    if (idx >= 0) enemies.splice(idx, 1);
  }

  function addXP(amount) {
    player.xp += amount;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level++;
      player.xpToNext = Math.floor(18 + player.level*8 + (player.level**1.2)*2);
      openLevelUp();
    }
    updateHUD();
  }

  // ---------- Level Up / Upgrade system ----------
  const UPGRADE_POOL = [
    {
      id:"wand+",
      title:"Magic Wand",
      desc: () => {
        const w = player.weapons.wand;
        return `Increase damage +15% and projectile speed. Current: L${w.level}`;
      },
      can: () => player.weapons.wand.level < 9,
      apply: () => {
        const w = player.weapons.wand;
        w.level++;
        w.dmg = Math.round(w.dmg * 1.15);
        w.projSpeed = Math.round(w.projSpeed * 1.07);
        if (w.level === 3) w.count = 2;
        if (w.level === 6) w.count = 3;
        if (w.level === 8) w.pierce = 1;
      },
      tag:"Weapon"
    },
    {
      id:"orbit_unlock",
      title:"Orbit Blades",
      desc: () => {
        const o = player.weapons.orbit;
        return o.level===0
          ? "Unlock orbiting blades that deal contact damage."
          : `More blades + radius. Current: ${o.count} blades`;
      },
      can: () => player.weapons.orbit.level < 7,
      apply: () => {
        const o = player.weapons.orbit;
        o.level++;
        if (o.level === 1) { o.count = 2; o.radius = 42; o.dmg = 10; }
        else { o.count = Math.min(8, o.count + 1); o.radius += 6; o.dmg = Math.round(o.dmg * 1.12); }
      },
      tag:"Weapon"
    },
    {
      id:"nova_unlock",
      title:"Pulse Nova",
      desc: () => {
        const n = player.weapons.nova;
        return n.level===0
          ? "Unlock a periodic shockwave that hits nearby enemies."
          : `More damage + bigger radius. Current: L${n.level}`;
      },
      can: () => player.weapons.nova.level < 6,
      apply: () => {
        const n = player.weapons.nova;
        n.level++;
        n.dmg = Math.round((n.dmg || 28) * 1.18);
        n.radius = Math.round((n.radius || 90) * 1.10);
        n.baseCd = Math.max(2.6, (n.baseCd || 6.0) * 0.92);
      },
      tag:"Weapon"
    },
    {
      id:"chain_unlock",
      title:"Chain Spark",
      desc: () => {
        const c = player.weapons.chain;
        return c.level===0
          ? "Unlock lightning that chains between enemies."
          : `More jumps + damage. Current: ${c.jumps} jumps`;
      },
      can: () => player.weapons.chain.level < 6,
      apply: () => {
        const c = player.weapons.chain;
        c.level++;
        c.dmg = Math.round((c.dmg || 22) * 1.14);
        c.jumps = Math.min(6, (c.jumps || 2) + 1);
        c.baseCd = Math.max(1.2, (c.baseCd || 3.2) * 0.92);
        c.range = Math.round((c.range || 170) * 1.07);
      },
      tag:"Weapon"
    },
    {
      id:"cooldown",
      title:"Quick Hands",
      desc: () => `Reduce cooldowns by 10%. Current CD mult: ${player.mod.cd.toFixed(2)}x`,
      can: () => player.mod.cd < 1.75,
      apply: () => { player.mod.cd *= 1.10; },
      tag:"Passive"
    },
    {
      id:"damage",
      title:"Power Core",
      desc: () => `Increase all damage by 12%. Current: ${Math.round((player.mod.damage-1)*100)}%`,
      can: () => player.mod.damage < 3.0,
      apply: () => { player.mod.damage *= 1.12; },
      tag:"Passive"
    },
    {
      id:"area",
      title:"Amplifier Field",
      desc: () => `Increase area/radius by 10%. Current: ${Math.round((player.mod.area-1)*100)}%`,
      can: () => player.mod.area < 2.8,
      apply: () => { player.mod.area *= 1.10; },
      tag:"Passive"
    },
    {
      id:"move",
      title:"Light Boots",
      desc: () => `Move speed +8%. Current: ${Math.round((player.mod.move-1)*100)}%`,
      can: () => player.mod.move < 2.0,
      apply: () => { player.mod.move *= 1.08; },
      tag:"Passive"
    },
    {
      id:"hp",
      title:"Vitality",
      desc: () => `Max HP +20. Current: ${player.hpMax}`,
      can: () => player.hpMax < 220,
      apply: () => { player.hpMax += 20; player.hp += 20; },
      tag:"Passive"
    },
    {
      id:"regen",
      title:"Nano Regen",
      desc: () => `Gain +0.35 HP/sec regen. Current: ${player.regen.toFixed(2)}/s`,
      can: () => player.regen < 3.0,
      apply: () => { player.regen += 0.35; },
      tag:"Passive"
    },
    {
      id:"magnet",
      title:"Magnet",
      desc: () => `Pickup range +18. Current: ${Math.round(player.magnet)}`,
      can: () => player.magnet < 220,
      apply: () => { player.magnet += 18; },
      tag:"Passive"
    },
    {
      id:"armor",
      title:"Plating",
      desc: () => `Armor +1 (reduces contact damage). Current: ${player.armor}`,
      can: () => player.armor < 10,
      apply: () => { player.armor += 1; },
      tag:"Passive"
    },
  ];

  function pickUpgrades(n=3) {
    const valid = UPGRADE_POOL.filter(u => u.can());
    // shuffle
    for (let i=valid.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [valid[i],valid[j]]=[valid[j],valid[i]];
    }
    return valid.slice(0, Math.min(n, valid.length));
  }

  function openLevelUp() {
    setPaused(true, true);
    levelUpOverlay.classList.remove("hidden");
    cardsEl.innerHTML = "";
    const picks = pickUpgrades(3);
    for (const u of picks) {
      const b = document.createElement("button");
      b.className = "card";
      b.innerHTML = `<div class="title">${u.title}<span class="badge">${u.tag}</span></div>
                     <div class="desc">${u.desc()}</div>`;
      b.addEventListener("click", () => {
        u.apply();
        levelUpOverlay.classList.add("hidden");
        setPaused(false, true);
        popText(u.title, player.x, player.y - 70);
        updateHUD();
      });
      cardsEl.appendChild(b);
    }
  }

  // ---------- Pause / Menu ----------
  function setPaused(p, silent=false) {
    world.paused = p;
    if (!silent) showMenu(p);
  }
  function showMenu(show) {
    if (show) overlay.classList.remove("hidden");
    else overlay.classList.add("hidden");
    // update stats
    bestTimeEl.textContent = fmtTime(save.bestTime || 0);
    lastTimeEl.textContent = fmtTime(save.lastTime || 0);
  }
  function togglePause() {
    if (world.gameOver) return;
    setPaused(!world.paused);
  }

  function hardRestart() {
    // record last run time
    if (world.time > 1) {
      save.lastTime = Math.floor(world.time);
      save.bestTime = Math.max(save.bestTime || 0, save.lastTime);
      saveSave(save);
    }
    resetRun();
  }

  // ---------- Effects ----------
  function puff(x,y,n){
    for(let i=0;i<n;i++){
      particles.push({
        x,y, vx:rand(-60,60), vy:rand(-60,60),
        r:rand(2,5), life:rand(0.25,0.55),
        kind:"puff"
      });
    }
  }
  function spark(x,y,n){
    for(let i=0;i<n;i++){
      particles.push({
        x,y, vx:rand(-160,160), vy:rand(-160,160),
        r:rand(1.5,3.2), life:rand(0.18,0.35),
        kind:"spark"
      });
    }
  }
  function boom(x,y,r){
    for(let i=0;i<18;i++){
      const a = rand(0,Math.PI*2);
      const sp = rand(70,240);
      particles.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:rand(2.5,5.2), life:rand(0.25,0.6), kind:"boom" });
    }
    particles.push({ x,y, vx:0, vy:0, r:r, life:0.25, kind:"ring" });
    world.shake = Math.max(world.shake, 4);
  }
  function ring(x,y,r){
    particles.push({ x,y, vx:0, vy:0, r:r, life:0.35, kind:"nova" });
  }
  function zap(x1,y1,x2,y2){
    particles.push({ x:x1, y:y1, x2, y2, life:0.08, kind:"zap" });
  }
  function popText(text,x,y){
    particles.push({ x,y, text, life:0.9, kind:"text" });
  }

  // ---------- Game loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 0.033);
    last = now;

    if (!world.paused && !world.gameOver) {
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- Update ----------
  function update(dt) {
    world.time += dt;

    // player movement (keyboard + joystick)
    let mx = 0, my = 0;
    if (keys.has("w") || keys.has("arrowup")) my -= 1;
    if (keys.has("s") || keys.has("arrowdown")) my += 1;
    if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
    if (keys.has("d") || keys.has("arrowright")) mx += 1;

    mx += joy.vx;
    my += joy.vy;

    // normalize
    const ml = Math.hypot(mx,my);
    if (ml > 1) { mx /= ml; my /= ml; }

    const sp = player.speed * player.mod.move;
    player.x += mx * sp * dt;
    player.y += my * sp * dt;

    // camera follow
    world.camX = lerp(world.camX, player.x, 0.12);
    world.camY = lerp(world.camY, player.y, 0.12);

    // regen + iFrames
    player.iFrames = Math.max(0, player.iFrames - dt);
    if (player.regen > 0) player.hp = Math.min(player.hpMax, player.hp + player.regen * dt);

    // waves
    waveDirector(dt);

    // weapons
    // wand auto fires
    const w = player.weapons.wand;
    w.cd -= dt;
    const wandCd = w.baseCd / player.mod.cd;
    while (w.cd <= 0) {
      w.cd += wandCd;
      fireWand();
    }
    tickOrbit(dt);
    tickNova(dt);
    tickChain(dt);

    // bullets
    for (let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // collision
      let hit = false;
      for (let j=enemies.length-1;j>=0;j--){
        const e = enemies[j];
        if (dist2(b.x,b.y,e.x,e.y) <= (b.r+e.r)*(b.r+e.r)) {
          hitEnemy(e, b.dmg, b.x, b.y, false);
          hit = true;
          if (b.pierce > 0) b.pierce--;
          else { bullets.splice(i,1); }
          break;
        }
      }
      if (b.life <= 0) bullets.splice(i,1);
      if (hit) continue;
    }

    // enemies
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      const [dx,dy] = norm(player.x - e.x, player.y - e.y);
      e.x += dx * e.speed * (0.82 + world.difficulty*0.06) * dt;
      e.y += dy * e.speed * (0.82 + world.difficulty*0.06) * dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      // spitter ranged poke
      if (e.type === "spitter") {
        e.shotCd -= dt;
        if (e.shotCd <= 0) {
          e.shotCd = rand(1.2, 2.2);
          const tx = player.x + mx*20, ty = player.y + my*20;
          const [sx,sy] = norm(tx - e.x, ty - e.y);
          bullets.push({
            x: e.x, y: e.y,
            vx: sx * 300, vy: sy * 300,
            r: 4,
            life: 2.0,
            dmg: 10 + world.difficulty*2,
            pierce: 0,
            color: "#4df0ff",
            kind: "enemy"
          });
        }
      }

      // contact damage to player
      if (dist2(player.x,player.y,e.x,e.y) <= (player.r+e.r)*(player.r+e.r)) {
        if (player.iFrames <= 0) {
          const dmg = Math.max(1, (e.dmg + world.difficulty*2) - player.armor*1.5);
          player.hp -= dmg;
          player.iFrames = 0.35;
          world.shake = Math.max(world.shake, 6);
          spark(player.x, player.y, 10);
          if (player.hp <= 0) {
            player.hp = 0;
            gameOver();
          }
        }
      }
    }

    // enemy bullets hitting player
    for (let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      if (b.kind !== "enemy") continue;
      if (dist2(player.x,player.y,b.x,b.y) <= (player.r+b.r)*(player.r+b.r)) {
        if (player.iFrames <= 0) {
          const dmg = Math.max(1, b.dmg - player.armor);
          player.hp -= dmg;
          player.iFrames = 0.25;
          bullets.splice(i,1);
          world.shake = Math.max(world.shake, 5);
          spark(player.x, player.y, 8);
          if (player.hp <= 0) { player.hp = 0; gameOver(); }
        }
      }
    }

    // gems physics + magnet + pickup
    for (let i=gems.length-1;i>=0;i--){
      const g = gems[i];
      g.t += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= Math.pow(0.12, dt);
      g.vy *= Math.pow(0.12, dt);

      // magnet
      const d2 = dist2(player.x,player.y,g.x,g.y);
      const m = player.magnet;
      if (d2 < m*m) {
        const d = Math.sqrt(d2) || 1;
        const pull = (1 - d/m) * 950;
        const [nx,ny] = [(player.x - g.x)/d, (player.y - g.y)/d];
        g.vx += nx * pull * dt;
        g.vy += ny * pull * dt;
      }
      // pickup
      if (d2 <= (player.r+g.r+2)*(player.r+g.r+2)) {
        addXP(g.val);
        puff(g.x,g.y,6);
        gems.splice(i,1);
      }
    }

    // particles
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.life -= dt;
      if (p.kind==="puff"||p.kind==="spark"||p.kind==="boom"){
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.04, dt);
        p.vy *= Math.pow(0.04, dt);
      }
      if (p.kind==="text"){
        p.y -= 26 * dt;
      }
      if (p.life <= 0) particles.splice(i,1);
    }

    updateHUD();
  }

  function updateHUD() {
    elTime.textContent = fmtTime(world.time);
    elHP.textContent = Math.ceil(player.hp);
    elHPMax.textContent = Math.ceil(player.hpMax);
    elLevel.textContent = player.level;
    elKills.textContent = world.kills;

    const xpPct = clamp(player.xp / player.xpToNext, 0, 1);
    elXPFill.style.width = (xpPct * 100).toFixed(1) + "%";
  }

  function gameOver() {
    world.gameOver = true;
    // record run time
    save.lastTime = Math.floor(world.time);
    save.bestTime = Math.max(save.bestTime || 0, save.lastTime);
    saveSave(save);

    popText("DOWN!", player.x, player.y - 70);
    setPaused(true);
  }

  // ---------- Render ----------
  function render() {
    // camera shake
    let sx = 0, sy = 0;
    if (world.shake > 0) {
      world.shake = Math.max(0, world.shake - 20 * (world.paused ? 0.016 : 0.016));
      sx = rand(-1,1) * world.shake;
      sy = rand(-1,1) * world.shake;
    }

    const camX = world.camX + sx;
    const camY = world.camY + sy;

    // background
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0,0,W,H);

    // subtle grid
    const grid = 44;
    ctx.save();
    ctx.translate(W/2 - camX, H/2 - camY);
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#6df0ff";
    ctx.lineWidth = 1;
    const minX = Math.floor((camX - W/2 - 200)/grid)*grid;
    const maxX = Math.floor((camX + W/2 + 200)/grid)*grid;
    const minY = Math.floor((camY - H/2 - 200)/grid)*grid;
    const maxY = Math.floor((camY + H/2 + 200)/grid)*grid;
    for (let x=minX; x<=maxX; x+=grid) {
      ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
    }
    for (let y=minY; y<=maxY; y+=grid) {
      ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
    }
    ctx.restore();

    // world translate
    ctx.save();
    ctx.translate(W/2 - camX, H/2 - camY);

    // gems
    for (const g of gems) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#6dff95";
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r+5, 0, Math.PI*2);
      ctx.strokeStyle = "#6dff95";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // orbit blades
    const o = player.weapons.orbit;
    if (o.level>0 && o.count>0) {
      const count = o.count;
      for (let i=0;i<count;i++){
        const ang = o.angle + i*(Math.PI*2/count);
        const r = o.radius * player.mod.area;
        const ox = player.x + Math.cos(ang)*r;
        const oy = player.y + Math.sin(ang)*r;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#c04dff";
        ctx.beginPath();
        ctx.arc(ox, oy, 7.5, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(ox, oy, 13, 0, Math.PI*2);
        ctx.strokeStyle = "#c04dff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // enemies
    for (const e of enemies) {
      const flash = e.hitFlash > 0 ? 1 : 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = flash ? "#ffffff" : e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
      ctx.fill();

      // outline
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r+4, 0, Math.PI*2);
      ctx.stroke();

      // hp bar for elite
      if (e.type === "elite") {
        const w = 46, h = 6;
        const pct = clamp(e.hp / e.hpMax, 0, 1);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(e.x - w/2, e.y - e.r - 18, w, h);
        ctx.fillStyle = "#6dff95";
        ctx.fillRect(e.x - w/2, e.y - e.r - 18, w*pct, h);
      }
    }

    // bullets
    for (const b of bullets) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r+5, 0, Math.PI*2);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // player
    const inv = player.iFrames > 0 ? 0.55 : 1;
    ctx.globalAlpha = inv;
    // body
    ctx.fillStyle = "#6df0ff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
    ctx.fill();
    // inner
    ctx.globalAlpha = inv * 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r*0.55, 0, Math.PI*2);
    ctx.fill();
    // aura
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#6df0ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.magnet, 0, Math.PI*2);
    ctx.stroke();

    // particles
    for (const p of particles) {
      const t = clamp(p.life, 0, 1);
      if (p.kind === "puff") {
        ctx.globalAlpha = 0.18 * t;
        ctx.fillStyle = "#6df0ff";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.3 - t*0.3),0,Math.PI*2); ctx.fill();
      } else if (p.kind === "spark") {
        ctx.globalAlpha = 0.35 * t;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      } else if (p.kind === "boom") {
        ctx.globalAlpha = 0.25 * t;
        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      } else if (p.kind === "ring") {
        ctx.globalAlpha = 0.22 * t;
        ctx.strokeStyle = "#ff4d6d";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.25 - t*0.2),0,Math.PI*2); ctx.stroke();
      } else if (p.kind === "nova") {
        ctx.globalAlpha = 0.24 * t;
        ctx.strokeStyle = "#c04dff";
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.1 - t*0.15),0,Math.PI*2); ctx.stroke();
      } else if (p.kind === "zap") {
        ctx.globalAlpha = 0.8 * t;
        ctx.strokeStyle = "#6dff95";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        // jagged
        const steps = 6;
        for (let i=1;i<steps;i++){
          const tt = i/steps;
          const ix = lerp(p.x, p.x2, tt) + rand(-10,10);
          const iy = lerp(p.y, p.y2, tt) + rand(-10,10);
          ctx.lineTo(ix, iy);
        }
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else if (p.kind === "text") {
        ctx.globalAlpha = 1 * t;
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto";
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
      }
    }

    // vignette
    ctx.restore();
    ctx.globalAlpha = 1;
    const grd = ctx.createRadialGradient(W/2,H/2, Math.min(W,H)*0.2, W/2,H/2, Math.max(W,H)*0.72);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,W,H);
  }

  // ---------- Start ----------
  resetRun();
})();
