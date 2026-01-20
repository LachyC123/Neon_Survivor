/* Neon Survivors v2
   - Vanilla HTML/CSS/JS Canvas (GitHub Pages friendly)
   - Inspired by survivor-like gameplay (original presentation)
   - Adds: run goal + bosses, chest drops, crit + damage numbers,
           evolutions (synergies), meta progression (coins bank),
           stage variants, reduced difficulty curve.
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
  const elCoins = document.getElementById("coins");
  const elXPFill = document.getElementById("xpFill");
  const elRunFill = document.getElementById("runFill");

  // ---------- Menu / overlays ----------
  const overlay = document.getElementById("overlay");
  const pauseBtn = document.getElementById("pauseBtn");
  const startBtn = document.getElementById("start");
  const resumeBtn = document.getElementById("resume");
  const restartBtn = document.getElementById("restart");
  const bestTimeEl = document.getElementById("bestTime");
  const lastTimeEl = document.getElementById("lastTime");
  const bankCoinsEl = document.getElementById("bankCoins");
  const stageNameEl = document.getElementById("stageName");

  const metaHpBtn = document.getElementById("metaHp");
  const metaDmgBtn = document.getElementById("metaDmg");
  const metaMoveBtn = document.getElementById("metaMove");
  const metaMagBtn  = document.getElementById("metaMag");

  const levelUpOverlay = document.getElementById("levelUp");
  const cardsEl = document.getElementById("cards");

  const endOverlay = document.getElementById("end");
  const endTitle = document.getElementById("endTitle");
  const endDesc  = document.getElementById("endDesc");
  const endTime  = document.getElementById("endTime");
  const endKills = document.getElementById("endKills");
  const endCoins = document.getElementById("endCoins");
  const endBank  = document.getElementById("endBank");
  const endRestart = document.getElementById("endRestart");
  const endClose   = document.getElementById("endClose");

  pauseBtn.addEventListener("click", () => togglePause(), { passive:true });
  resumeBtn.addEventListener("click", () => setPaused(false), { passive:true });
  restartBtn.addEventListener("click", () => hardRestart(), { passive:true });
  startBtn.addEventListener("click", () => startRun(), { passive:true });
  endRestart.addEventListener("click", () => hardRestart(), { passive:true });
  endClose.addEventListener("click", () => { endOverlay.classList.add("hidden"); showMenu(true); }, { passive:true });

  // ---------- Utility ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
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

  // ---------- Input ----------
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
  function joyEnd() {
    if (!joy.active) return;
    joy.active = false;
    joy.id = null;
    joy.vx = 0; joy.vy = 0;
    setKnob(0,0);
  }

  joyBase.addEventListener("touchstart", (e) => { e.preventDefault(); joyStart(e); }, { passive:false });
  joyBase.addEventListener("touchmove",  (e) => { e.preventDefault(); joyMove(e); }, { passive:false });
  joyBase.addEventListener("touchend",   (e) => { e.preventDefault(); joyEnd(); }, { passive:false });
  joyBase.addEventListener("touchcancel",(e) => { e.preventDefault(); joyEnd(); }, { passive:false });
  joyBase.addEventListener("mousedown", (e) => { e.preventDefault(); joyStart(e); }, { passive:false });
  window.addEventListener("mousemove", (e) => joyMove(e), { passive:true });
  window.addEventListener("mouseup", () => joyEnd(), { passive:true });

  // ---------- Save / Meta ----------
  const SAVE_KEY = "neon_survivors_save_v2";
  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveSave(obj) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); } catch {}
  }

  const save = Object.assign({
    bestTime: 0,
    lastTime: 0,
    bankCoins: 0,
    meta: { hp:0, dmg:0, move:0, mag:0 }
  }, loadSave());

  function updateMenuStats() {
    bestTimeEl.textContent = fmtTime(save.bestTime || 0);
    lastTimeEl.textContent = fmtTime(save.lastTime || 0);
    bankCoinsEl.textContent = String(save.bankCoins|0);
    metaHpBtn.textContent   = `+ Max HP (${50 + save.meta.hp*35}c)`;
    metaDmgBtn.textContent  = `+ Damage (${60 + save.meta.dmg*45}c)`;
    metaMoveBtn.textContent = `+ Move (${40 + save.meta.move*30}c)`;
    metaMagBtn.textContent  = `+ Magnet (${40 + save.meta.mag*30}c)`;
  }

  function buyMeta(kind) {
    const cost = {
      hp: 50 + save.meta.hp*35,
      dmg: 60 + save.meta.dmg*45,
      move:40 + save.meta.move*30,
      mag: 40 + save.meta.mag*30
    }[kind];
    if (save.bankCoins < cost) { popText("Not enough coins", world.camX, world.camY - 80); return; }
    save.bankCoins -= cost;
    save.meta[kind] += 1;
    saveSave(save);
    updateMenuStats();
    popText("Upgraded!", world.camX, world.camY - 80);
  }

  metaHpBtn.addEventListener("click", () => buyMeta("hp"));
  metaDmgBtn.addEventListener("click", () => buyMeta("dmg"));
  metaMoveBtn.addEventListener("click", () => buyMeta("move"));
  metaMagBtn.addEventListener("click", () => buyMeta("mag"));

  // ---------- Stage variants ----------
  const STAGES = [
    { id:"grid",  name:"Neon Grid", grid:44, gridAlpha:0.12, vignette:0.45 },
    { id:"dusk",  name:"Dusk Circuit", grid:36, gridAlpha:0.10, vignette:0.52 },
  ];
  let stage = STAGES[0];

  // ---------- World ----------
  const world = {
    time: 0,
    paused: true,
    started: false,
    ended: false,
    win: false,
    camX: 0,
    camY: 0,
    shake: 0,
    kills: 0,
    coinsRun: 0,
    difficulty: 1,
    runGoal: 12*60, // 12 minutes win
  };

  // ---------- Entities ----------
  const bullets = [];
  const enemies = [];
  const gems = [];
  const particles = [];

  // ---------- Player ----------
  function makePlayer() {
    const p = {
      x: 0, y: 0,
      r: 14,
      speed: 160,
      hpMax: 100,
      hp: 100,
      regen: 0,
      armor: 0,
      magnet: 110,
      iFrames: 0,
      xp: 0,
      level: 1,
      xpToNext: 20,
      coins: 0,
      // crit system
      critChance: 0.06,
      critMult: 1.75,
      // weapons
      weapons: {
        wand: { level: 1, cd: 0, baseCd: 0.62, dmg: 18, projSpeed: 420, pierce: 0, count: 1, tag:"Wand" },
        orbit:{ level: 0, angle: 0, count: 0, radius: 42, dmg: 10, tag:"Orbit" },
        nova: { level: 0, cd: 0, baseCd: 6.2, dmg: 28, radius: 90, tag:"Nova" },
        chain:{ level: 0, cd: 0, baseCd: 3.4, dmg: 22, jumps: 2, range: 170, tag:"Chain" },
        shotgun:{ level: 0, cd: 0, baseCd: 1.15, pellets: 5, spread: 0.45, dmg: 10, speed: 420, tag:"Shotgun" },
        drone:{ level: 0, cd: 0, baseCd: 1.8, dmg: 16, speed: 360, tag:"Drone" },
        mines:{ level: 0, cd: 0, baseCd: 2.4, dmg: 34, radius: 75, tag:"Mines" },
      },
      // modifiers
      mod: { damage: 1.0, area: 1.0, cd: 1.0, proj: 1.0, move: 1.0 }
    };

    // apply meta bonuses (small but noticeable)
    p.hpMax += save.meta.hp * 8;
    p.hp = p.hpMax;
    p.mod.damage *= (1 + save.meta.dmg * 0.04);
    p.mod.move   *= (1 + save.meta.move * 0.03);
    p.magnet     += save.meta.mag * 10;

    return p;
  }
  let player = makePlayer();

  // ---------- Reset / Start ----------
  function resetRun() {
    bullets.length = 0;
    enemies.length = 0;
    gems.length = 0;
    particles.length = 0;

    world.time = 0;
    world.kills = 0;
    world.shake = 0;
    world.difficulty = 1;
    world.started = false;
    world.ended = false;
    world.win = false;
    world.coinsRun = 0;

    // random stage each run for variety
    stage = STAGES[(Math.random()*STAGES.length)|0];
    stageNameEl.textContent = stage.name;

    player = makePlayer();
    player.x = 0; player.y = 0;

    directorReset();
    updateHUD();
    updateMenuStats();
    showMenu(true);
  }

  function startRun() {
    if (world.ended) endOverlay.classList.add("hidden");
    world.started = true;
    setPaused(false);
    showMenu(false);
  }

  function setPaused(p) {
    world.paused = p;
    if (p) showMenu(true);
    else showMenu(false);
  }
  function showMenu(show) {
    if (show) overlay.classList.remove("hidden");
    else overlay.classList.add("hidden");
    updateMenuStats();
  }
  function togglePause() {
    if (world.ended) return;
    setPaused(!world.paused);
  }

  function endRun(win) {
    world.ended = true;
    world.win = win;
    world.paused = true;

    // finalize coins into bank
    save.lastTime = Math.floor(world.time);
    save.bestTime = Math.max(save.bestTime || 0, save.lastTime);
    save.bankCoins = (save.bankCoins|0) + (world.coinsRun|0);
    saveSave(save);

    endTitle.textContent = win ? "Run Complete!" : "Defeated!";
    endDesc.textContent  = win ? "You cleared the stage. Spend coins on meta upgrades!" : "Try again with better upgrades.";
    endTime.textContent  = fmtTime(world.time);
    endKills.textContent = String(world.kills);
    endCoins.textContent = String(world.coinsRun|0);
    endBank.textContent  = String(save.bankCoins|0);

    endOverlay.classList.remove("hidden");
    overlay.classList.add("hidden");
  }

  function hardRestart() {
    resetRun();
  }

  // ---------- Spawning / Director (reduced curve) ----------
  function spawnEnemy(type, x, y, scale=1) {
    const base = {
      grunt:  { r: 13, hp: 44, speed: 74, dmg: 12, xp: 1, coins: 0.25, color: "#ff4d6d" },
      runner: { r: 11, hp: 32, speed: 108, dmg: 10, xp: 1, coins: 0.25, color: "#ff8a4d" },
      tank:   { r: 18, hp: 110, speed: 55, dmg: 18, xp: 2, coins: 0.45, color: "#c04dff" },
      spitter:{ r: 14, hp: 56, speed: 70, dmg: 12, xp: 2, coins: 0.45, color: "#4df0ff" },
      chest:  { r: 16, hp: 85, speed: 52, dmg: 0,  xp: 0, coins: 0,    color: "#ffd36d" }, // special
      boss:   { r: 34, hp: 980, speed: 62, dmg: 28, xp: 18, coins: 10,   color: "#6dff95" }, // 5:00/10:00
    }[type] || null;
    if (!base) return;

    enemies.push({
      type,
      x, y,
      r: base.r * scale,
      hpMax: base.hp * (0.88 + 0.12*scale),
      hp: base.hp * (0.88 + 0.12*scale),
      speed: base.speed * (0.92 + 0.08*scale),
      dmg: base.dmg,
      xp: base.xp,
      coins: base.coins,
      color: base.color,
      hitFlash: 0,
      shotCd: rand(0.6, 1.3),
      // boss abilities
      auraT: rand(0, 2.5),
    });
  }

  function spawnOffscreen(type, scale=1) {
    const pad = 70;
    const side = randi(0,3);
    let x = player.x, y = player.y;
    const rx = W/2 + pad;
    const ry = H/2 + pad;
    if (side===0){ x += rand(-rx, rx); y += -ry; }
    if (side===1){ x += rx; y += rand(-ry, ry); }
    if (side===2){ x += rand(-rx, rx); y += ry; }
    if (side===3){ x += -rx; y += rand(-ry, ry); }
    spawnEnemy(type, x, y, scale);
  }

  function directorReset(){
    waveDirector.acc = 0;
    waveDirector.nextChest = 70;   // first chest
    waveDirector.nextBossIdx = 0;
    waveDirector.bossTimes = [5*60, 10*60];
    waveDirector.bossAlive = false;
  }

  function waveDirector(dt) {
    // smoother, slower difficulty ramp (your request)
    world.difficulty = 1 + (world.time / 120); // was faster before

    // spawn budget per second (reduced)
    const budget = 1.35 + world.difficulty * 0.85;
    waveDirector.acc += budget * dt;

    while (waveDirector.acc >= 1) {
      waveDirector.acc -= 1;

      const t = world.time;
      let pool = ["grunt","runner"];
      if (t > 55) pool.push("tank");
      if (t > 90) pool.push("spitter");
      if (t > 140) pool.push("tank","runner");

      const type = pool[randi(0, pool.length-1)];
      const scale = 1 + (world.difficulty-1)*0.10;
      spawnOffscreen(type, scale);
    }

    // chest event every ~70-85 sec
    if (world.time >= waveDirector.nextChest) {
      waveDirector.nextChest += rand(70, 85);
      spawnOffscreen("chest", 1 + world.difficulty*0.03);
      popText("CHEST!", player.x, player.y - 90);
    }

    // bosses at fixed times
    const idx = waveDirector.nextBossIdx;
    if (idx < waveDirector.bossTimes.length && world.time >= waveDirector.bossTimes[idx] && !waveDirector.bossAlive) {
      waveDirector.bossAlive = true;
      waveDirector.nextBossIdx++;
      spawnOffscreen("boss", 1 + world.difficulty*0.06);
      popText("BOSS!", player.x, player.y - 90);
    }
  }

  // ---------- Weapons / Combat ----------
  function nearestEnemy(maxRange=99999, prefer="any") {
    let best = null;
    let bestD2 = maxRange*maxRange;
    for (const e of enemies) {
      if (prefer !== "any" && e.type !== prefer) continue;
      const d2 = dist2(player.x, player.y, e.x, e.y);
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  function critify(dmg){
    const isCrit = Math.random() < player.critChance;
    return { dmg: dmg * (isCrit ? player.critMult : 1), crit: isCrit };
  }

  function addBullet(x,y,vx,vy,r,life,dmg,color,kind,pierce=0){
    bullets.push({ x,y,vx,vy,r,life,dmg,color,kind,pierce });
  }

  function fireWand() {
    const w = player.weapons.wand;
    const target = nearestEnemy(700);
    if (!target) return;

    const [dx,dy] = norm(target.x - player.x, target.y - player.y);
    const spread = 0.14;
    for (let i=0;i<w.count;i++){
      const ang = Math.atan2(dy,dx) + rand(-spread, spread) * (w.count>1 ? 1 : 0.6);
      const vx = Math.cos(ang) * w.projSpeed * player.mod.proj;
      const vy = Math.sin(ang) * w.projSpeed * player.mod.proj;
      const c = critify(w.dmg * player.mod.damage);
      addBullet(player.x, player.y, vx, vy, 4.5, 1.9, c.dmg, "#6df0ff", "wand", w.pierce);
      bullets[bullets.length-1].crit = c.crit;
    }
    puff(player.x, player.y, 6, "#6df0ff");
  }

  function fireShotgun(){
    const s = player.weapons.shotgun;
    const target = nearestEnemy(650);
    if (!target) return;
    const [dx,dy] = norm(target.x - player.x, target.y - player.y);
    const baseAng = Math.atan2(dy,dx);
    for(let i=0;i<s.pellets;i++){
      const ang = baseAng + rand(-s.spread, s.spread);
      const vx = Math.cos(ang) * s.speed * player.mod.proj;
      const vy = Math.sin(ang) * s.speed * player.mod.proj;
      const c = critify(s.dmg * player.mod.damage);
      addBullet(player.x, player.y, vx, vy, 3.8, 1.1, c.dmg, "#ffd36d", "shot", 0);
      bullets[bullets.length-1].crit = c.crit;
    }
    puff(player.x, player.y, 7, "#ffd36d");
  }

  function tickDrone(dt){
    const d = player.weapons.drone;
    if (d.level<=0) return;
    d.cd -= dt;
    if (d.cd > 0) return;
    d.cd = d.baseCd / player.mod.cd;

    // drones fire at 2 nearest enemies
    const targets = [];
    for (const e of enemies){
      targets.push([dist2(player.x,player.y,e.x,e.y), e]);
    }
    targets.sort((a,b)=>a[0]-b[0]);
    const shots = Math.min(2 + Math.floor(d.level/2), targets.length);
    for(let i=0;i<shots;i++){
      const e = targets[i][1];
      const [dx,dy] = norm(e.x - player.x, e.y - player.y);
      const c = critify(d.dmg * player.mod.damage);
      addBullet(player.x, player.y, dx*d.speed*player.mod.proj, dy*d.speed*player.mod.proj, 4.2, 1.5, c.dmg, "#6dff95", "drone", 1);
      bullets[bullets.length-1].crit = c.crit;
    }
    puff(player.x, player.y, 6, "#6dff95");
  }

  function tickMines(dt){
    const m = player.weapons.mines;
    if (m.level<=0) return;
    m.cd -= dt;
    if (m.cd > 0) return;
    m.cd = m.baseCd / player.mod.cd;

    // drop a mine at player position; detonates after short delay or on contact
    const mine = { x:player.x, y:player.y, r:7, life:1.4, arm:0.35, dmg:m.dmg*player.mod.damage, radius:m.radius*player.mod.area };
    particles.push({ kind:"mine", ...mine });
    puff(player.x, player.y, 6, "#c04dff");
  }

  function tickOrbit(dt) {
    const o = player.weapons.orbit;
    if (o.level<=0 || o.count<=0) return;
    o.angle += dt * (2.2 + o.level*0.08);
    const count = o.count;
    for (let i=0;i<count;i++){
      const ang = o.angle + i*(Math.PI*2/count);
      const r = o.radius * player.mod.area;
      const ox = player.x + Math.cos(ang)*r;
      const oy = player.y + Math.sin(ang)*r;

      for (const e of enemies) {
        if (dist2(ox,oy,e.x,e.y) <= (e.r+9)*(e.r+9)) {
          e._orbitHit = e._orbitHit || 0;
          e._orbitHit -= dt;
          if (e._orbitHit <= 0) {
            e._orbitHit = 0.22;
            const c = critify(o.dmg * player.mod.damage);
            hitEnemy(e, c.dmg, ox, oy, true, c.crit);
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
    for (const e of enemies) {
      if (dist2(player.x,player.y,e.x,e.y) <= (radius+e.r)*(radius+e.r)) {
        const c = critify(n.dmg * player.mod.damage);
        hitEnemy(e, c.dmg, e.x, e.y, false, c.crit);
      }
    }
    ring(player.x, player.y, radius, "#c04dff");
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
    let lastX = player.x, lastY = player.y;
    for (let j=0;j<1 + c.jumps; j++){
      if (!cur) break;
      hits.add(cur);

      const cc = critify(c.dmg * player.mod.damage);
      hitEnemy(cur, cc.dmg, cur.x, cur.y, false, cc.crit);
      zap(lastX, lastY, cur.x, cur.y, "#6dff95");
      lastX = cur.x; lastY = cur.y;

      let best = null, bestD2 = (c.range*player.mod.area)**2;
      for (const e of enemies) {
        if (hits.has(e)) continue;
        const d2 = dist2(cur.x,cur.y,e.x,e.y);
        if (d2 < bestD2) { bestD2 = d2; best = e; }
      }
      cur = best;
    }
  }

  // ---------- Damage / Death / Loot ----------
  function hitEnemy(e, dmg, hx, hy, soft=false, crit=false) {
    e.hp -= dmg;
    e.hitFlash = 0.08;

    // damage number
    dmgText(Math.round(dmg), hx, hy, crit);

    spark(hx, hy, soft ? 4 : 8, crit ? "#ffd36d" : "#ffffff");
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    // coins (small chance; bosses give a lot; chest drops big)
    if (e.type === "boss") {
      world.coinsRun += 10 + Math.floor(world.difficulty*2);
    } else if (e.type !== "chest") {
      if (Math.random() < (0.12 + world.time/9000)) world.coinsRun += 1;
    }

    // XP gems
    if (e.type !== "chest") {
      const n = (e.xp <= 1) ? 1 : (e.xp===2 ? 2 : 4);
      for (let i=0;i<n;i++){
        gems.push({
          x: e.x + rand(-8,8),
          y: e.y + rand(-8,8),
          r: 5,
          val: e.xp===18 ? 10 : (e.xp===8 ? 6 : 1),
          vx: rand(-25,25),
          vy: rand(-25,25),
          t: 0
        });
      }
    }

    // chest reward: guaranteed level-up OR coins burst
    if (e.type === "chest") {
      world.coinsRun += 6;
      popText("TREASURE!", e.x, e.y - 26);
      // open a special choice (paused like level up)
      openLevelUp(true);
    }

    // boss death clears bossAlive + rewards
    if (e.type === "boss") {
      waveDirector.bossAlive = false;
      world.coinsRun += 6;
      popText("BOSS DOWN!", e.x, e.y - 26);
    }

    boom(e.x, e.y, e.r*1.25, e.color);
    world.kills++;

    const idx = enemies.indexOf(e);
    if (idx >= 0) enemies.splice(idx, 1);
  }

  function addXP(amount) {
    player.xp += amount;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level++;
      player.xpToNext = Math.floor(18 + player.level*8 + (player.level**1.18)*2);
      openLevelUp(false);
    }
    updateHUD();
  }

  // ---------- Evolutions (Synergies) ----------
  function tryEvolution() {
    // Simple evolution rules that feel “real” without copying:
    // - Orbit L6 + Area >= 1.5 => Saw Ring (more blades + faster + more dmg)
    // - Wand L7 + Cooldown >= 1.45 => Prism Wand (extra projectiles + pierce)
    // - Shotgun L6 + Damage >= 1.6 => Thunder Buck (pellets chain mini zaps)
    const evol = [];

    const orbit = player.weapons.orbit;
    const wand  = player.weapons.wand;
    const shot  = player.weapons.shotgun;

    if (!player._evoSaw && orbit.level >= 6 && player.mod.area >= 1.5) evol.push("saw");
    if (!player._evoPrism && wand.level >= 7 && player.mod.cd >= 1.45) evol.push("prism");
    if (!player._evoBuck && shot.level >= 6 && player.mod.damage >= 1.6) evol.push("buck");

    if (evol.length === 0) return false;
    const pick = evol[(Math.random()*evol.length)|0];

    if (pick==="saw") {
      player._evoSaw = true;
      orbit.count = Math.min(10, Math.max(orbit.count, 6) + 2);
      orbit.dmg = Math.round(orbit.dmg * 1.45);
      popText("EVOLUTION: Saw Ring", player.x, player.y - 70);
      ring(player.x, player.y, 120, "#c04dff");
    } else if (pick==="prism") {
      player._evoPrism = true;
      wand.count = Math.max(wand.count, 3) + 1;
      wand.pierce = Math.max(wand.pierce, 1) + 1;
      wand.dmg = Math.round(wand.dmg * 1.25);
      popText("EVOLUTION: Prism Wand", player.x, player.y - 70);
      ring(player.x, player.y, 120, "#6df0ff");
    } else if (pick==="buck") {
      player._evoBuck = true;
      shot.pellets += 2;
      shot.dmg = Math.round(shot.dmg * 1.35);
      popText("EVOLUTION: Thunder Buck", player.x, player.y - 70);
      ring(player.x, player.y, 120, "#ffd36d");
    }
    return true;
  }

  // ---------- Level Up / Upgrade pool ----------
  const U = () => ({
    wand: player.weapons.wand,
    orbit: player.weapons.orbit,
    nova: player.weapons.nova,
    chain: player.weapons.chain,
    shotgun: player.weapons.shotgun,
    drone: player.weapons.drone,
    mines: player.weapons.mines
  });

  const UPGRADE_POOL = [
    // Weapons
    { id:"wand+", title:"Magic Wand", tag:"Weapon",
      desc: () => `Damage +15%, speed up. L${U().wand.level}`,
      can: () => U().wand.level < 9,
      apply: () => { const w=U().wand; w.level++; w.dmg=Math.round(w.dmg*1.15); w.projSpeed=Math.round(w.projSpeed*1.07);
        if (w.level===3) w.count=2; if (w.level===6) w.count=3; if (w.level===8) w.pierce=1; } },
    { id:"orbit_unlock", title:"Orbit Blades", tag:"Weapon",
      desc: () => U().orbit.level===0 ? "Unlock orbiting blades." : `More blades + radius. ${U().orbit.count} blades`,
      can: () => U().orbit.level < 7,
      apply: () => { const o=U().orbit; o.level++; if(o.level===1){o.count=2;o.radius=42;o.dmg=10;}
        else { o.count=Math.min(8,o.count+1); o.radius+=6; o.dmg=Math.round(o.dmg*1.12);} } },
    { id:"nova_unlock", title:"Pulse Nova", tag:"Weapon",
      desc: () => U().nova.level===0 ? "Unlock periodic shockwave." : `More damage + bigger radius. L${U().nova.level}`,
      can: () => U().nova.level < 6,
      apply: () => { const n=U().nova; n.level++; n.dmg=Math.round((n.dmg||28)*1.18); n.radius=Math.round((n.radius||90)*1.10); n.baseCd=Math.max(2.6,(n.baseCd||6.2)*0.92);} },
    { id:"chain_unlock", title:"Chain Spark", tag:"Weapon",
      desc: () => U().chain.level===0 ? "Unlock chaining lightning." : `More jumps + damage. ${U().chain.jumps} jumps`,
      can: () => U().chain.level < 6,
      apply: () => { const c=U().chain; c.level++; c.dmg=Math.round((c.dmg||22)*1.14); c.jumps=Math.min(7,(c.jumps||2)+1);
        c.baseCd=Math.max(1.15,(c.baseCd||3.4)*0.92); c.range=Math.round((c.range||170)*1.07);} },

    { id:"shotgun_unlock", title:"Scatter Blaster", tag:"Weapon",
      desc: () => U().shotgun.level===0 ? "Unlock cone burst pellets." : `More pellets + damage. L${U().shotgun.level}`,
      can: () => U().shotgun.level < 7,
      apply: () => { const s=U().shotgun; s.level++; s.pellets = Math.min(11, (s.pellets||5) + 1); s.dmg = Math.round((s.dmg||10)*1.12);
        s.baseCd = Math.max(0.55, (s.baseCd||1.15)*0.94); } },

    { id:"drone_unlock", title:"Hunter Drones", tag:"Weapon",
      desc: () => U().drone.level===0 ? "Unlock drones that fire at targets." : `More shots + damage. L${U().drone.level}`,
      can: () => U().drone.level < 6,
      apply: () => { const d=U().drone; d.level++; d.dmg = Math.round((d.dmg||16)*1.12); d.baseCd = Math.max(0.75, (d.baseCd||1.8)*0.92);} },

    { id:"mines_unlock", title:"Shock Mines", tag:"Weapon",
      desc: () => U().mines.level===0 ? "Unlock mines that explode." : `More damage + radius. L${U().mines.level}`,
      can: () => U().mines.level < 6,
      apply: () => { const m=U().mines; m.level++; m.dmg = Math.round((m.dmg||34)*1.18); m.radius = Math.round((m.radius||75)*1.10);
        m.baseCd = Math.max(0.9, (m.baseCd||2.4)*0.93);} },

    // Passives
    { id:"cooldown", title:"Quick Hands", tag:"Passive",
      desc: () => `Cooldowns -10%. CD mult: ${player.mod.cd.toFixed(2)}x`,
      can: () => player.mod.cd < 1.9,
      apply: () => { player.mod.cd *= 1.10; } },

    { id:"damage", title:"Power Core", tag:"Passive",
      desc: () => `Damage +12%. Bonus: ${Math.round((player.mod.damage-1)*100)}%`,
      can: () => player.mod.damage < 3.2,
      apply: () => { player.mod.damage *= 1.12; } },

    { id:"area", title:"Amplifier Field", tag:"Passive",
      desc: () => `Area +10%. Bonus: ${Math.round((player.mod.area-1)*100)}%`,
      can: () => player.mod.area < 3.0,
      apply: () => { player.mod.area *= 1.10; } },

    { id:"move", title:"Light Boots", tag:"Passive",
      desc: () => `Move +8%. Bonus: ${Math.round((player.mod.move-1)*100)}%`,
      can: () => player.mod.move < 2.1,
      apply: () => { player.mod.move *= 1.08; } },

    { id:"hp", title:"Vitality", tag:"Passive",
      desc: () => `Max HP +20. Current: ${player.hpMax}`,
      can: () => player.hpMax < 260,
      apply: () => { player.hpMax += 20; player.hp += 20; } },

    { id:"regen", title:"Nano Regen", tag:"Passive",
      desc: () => `Regen +0.35 HP/s. Current: ${player.regen.toFixed(2)}/s`,
      can: () => player.regen < 3.5,
      apply: () => { player.regen += 0.35; } },

    { id:"magnet", title:"Magnet", tag:"Passive",
      desc: () => `Pickup range +18. Current: ${Math.round(player.magnet)}`,
      can: () => player.magnet < 260,
      apply: () => { player.magnet += 18; } },

    { id:"armor", title:"Plating", tag:"Passive",
      desc: () => `Armor +1. Current: ${player.armor}`,
      can: () => player.armor < 12,
      apply: () => { player.armor += 1; } },

    { id:"crit", title:"Targeting Lens", tag:"Passive",
      desc: () => `Crit chance +2%. Current: ${(player.critChance*100).toFixed(1)}%`,
      can: () => player.critChance < 0.25,
      apply: () => { player.critChance += 0.02; } },

    { id:"critdmg", title:"Overcharge", tag:"Passive",
      desc: () => `Crit damage +0.15x. Current: ${player.critMult.toFixed(2)}x`,
      can: () => player.critMult < 3.0,
      apply: () => { player.critMult += 0.15; } },
  ];

  function pickUpgrades(n=3) {
    const valid = UPGRADE_POOL.filter(u => u.can());
    for (let i=valid.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [valid[i],valid[j]]=[valid[j],valid[i]];
    }
    return valid.slice(0, Math.min(n, valid.length));
  }

  function openLevelUp(isChest) {
    // evolution check first (feels premium)
    if (!isChest && tryEvolution()) return;

    setPaused(true);
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
        setPaused(false);
        popText(u.title, player.x, player.y - 70);
        updateHUD();
      });
      cardsEl.appendChild(b);
    }
  }

  // ---------- Particles / VFX ----------
  function puff(x,y,n,color){
    for(let i=0;i<n;i++){
      particles.push({ kind:"puff", x,y, vx:rand(-60,60), vy:rand(-60,60), r:rand(2,5), life:rand(0.25,0.55), color });
    }
  }
  function spark(x,y,n,color){
    for(let i=0;i<n;i++){
      particles.push({ kind:"spark", x,y, vx:rand(-160,160), vy:rand(-160,160), r:rand(1.5,3.2), life:rand(0.18,0.35), color });
    }
  }
  function boom(x,y,r,color){
    for(let i=0;i<18;i++){
      const a = rand(0,Math.PI*2);
      const sp = rand(70,240);
      particles.push({ kind:"boom", x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:rand(2.5,5.2), life:rand(0.25,0.6), color: color||"#ff4d6d" });
    }
    particles.push({ kind:"ring", x,y, r, life:0.25, color: color||"#ff4d6d" });
    world.shake = Math.max(world.shake, 4);
  }
  function ring(x,y,r,color){ particles.push({ kind:"nova", x,y, r, life:0.35, color: color||"#c04dff" }); }
  function zap(x1,y1,x2,y2,color){ particles.push({ kind:"zap", x:x1, y:y1, x2, y2, life:0.09, color: color||"#6dff95" }); }
  function popText(text,x,y){ particles.push({ kind:"text", x,y, text, life:0.9 }); }
  function dmgText(n,x,y,crit){
    particles.push({ kind:"dmg", x,y, n, crit:!!crit, life:0.75, vy: -38 });
  }

  // ---------- Loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 0.033);
    last = now;
    if (!world.paused && world.started && !world.ended) update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- Update ----------
  function update(dt) {
    world.time += dt;

    // win condition
    if (world.time >= world.runGoal) {
      endRun(true);
      return;
    }

    // movement
    let mx = 0, my = 0;
    if (keys.has("w") || keys.has("arrowup")) my -= 1;
    if (keys.has("s") || keys.has("arrowdown")) my += 1;
    if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
    if (keys.has("d") || keys.has("arrowright")) mx += 1;
    mx += joy.vx; my += joy.vy;
    const ml = Math.hypot(mx,my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const sp = player.speed * player.mod.move;
    player.x += mx * sp * dt;
    player.y += my * sp * dt;

    // camera follow
    world.camX = lerp(world.camX, player.x, 0.12);
    world.camY = lerp(world.camY, player.y, 0.12);

    // regen + iframes
    player.iFrames = Math.max(0, player.iFrames - dt);
    if (player.regen > 0) player.hp = Math.min(player.hpMax, player.hp + player.regen * dt);

    // director
    waveDirector(dt);

    // weapons tick
    const w = player.weapons.wand;
    w.cd -= dt;
    const wandCd = w.baseCd / player.mod.cd;
    while (w.cd <= 0) { w.cd += wandCd; fireWand(); }

    const s = player.weapons.shotgun;
    if (s.level>0) { s.cd -= dt; const cd = s.baseCd / player.mod.cd; while (s.cd <= 0) { s.cd += cd; fireShotgun(); } }

    tickOrbit(dt);
    tickNova(dt);
    tickChain(dt);
    tickDrone(dt);
    tickMines(dt);

    // bullets
    for (let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // enemy bullets hit player
      if (b.kind === "enemy") {
        if (dist2(player.x,player.y,b.x,b.y) <= (player.r+b.r)*(player.r+b.r)) {
          if (player.iFrames <= 0) {
            const dmg = Math.max(1, b.dmg - player.armor);
            player.hp -= dmg;
            player.iFrames = 0.25;
            bullets.splice(i,1);
            world.shake = Math.max(world.shake, 5);
            spark(player.x, player.y, 8, "#ffffff");
            if (player.hp <= 0) { player.hp = 0; endRun(false); }
          }
        }
        if (b.life <= 0) bullets.splice(i,1);
        continue;
      }

      // player bullet hits enemies
      for (let j=enemies.length-1;j>=0;j--){
        const e = enemies[j];
        if (dist2(b.x,b.y,e.x,e.y) <= (b.r+e.r)*(b.r+e.r)) {
          hitEnemy(e, b.dmg, b.x, b.y, false, !!b.crit);

          // thunder buck evolution: pellet hits cause mini chain
          if (player._evoBuck && b.kind==="shot") {
            // mini zap to 1 nearby enemy
            let best=null, bestD2=160*160;
            for (const other of enemies){
              if (other===e) continue;
              const d2=dist2(e.x,e.y,other.x,other.y);
              if (d2<bestD2){bestD2=d2;best=other;}
            }
            if (best) {
              zap(e.x,e.y,best.x,best.y,"#ffd36d");
              hitEnemy(best, b.dmg*0.35, best.x, best.y, true, false);
            }
          }

          if (b.pierce > 0) b.pierce--;
          else { bullets.splice(i,1); }
          break;
        }
      }
      if (b.life <= 0) bullets.splice(i,1);
    }

    // enemies
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];

      // basic movement
      const [dx,dy] = norm(player.x - e.x, player.y - e.y);
      const spdScale = (0.84 + world.difficulty*0.05); // gentler scaling
      e.x += dx * e.speed * spdScale * dt;
      e.y += dy * e.speed * spdScale * dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      // spitter + boss ranged poke
      if (e.type === "spitter" || e.type === "boss") {
        e.shotCd -= dt;
        if (e.shotCd <= 0) {
          e.shotCd = e.type==="boss" ? rand(0.7, 1.2) : rand(1.3, 2.3);
          const tx = player.x + mx*30, ty = player.y + my*30;
          const [sx,sy] = norm(tx - e.x, ty - e.y);
          addBullet(e.x, e.y, sx*320, sy*320, 4, 2.0, 10 + world.difficulty*1.2, "#4df0ff", "enemy", 0);
        }
      }

      // boss aura pulses
      if (e.type === "boss") {
        e.auraT -= dt;
        if (e.auraT <= 0) {
          e.auraT = rand(2.0, 2.7);
          ring(e.x, e.y, 120, "#6dff95");
          // small knockback-like damage if close
          const r=120;
          if (dist2(player.x,player.y,e.x,e.y) <= r*r && player.iFrames<=0) {
            const dmg = Math.max(1, (16 + world.difficulty*1.0) - player.armor);
            player.hp -= dmg;
            player.iFrames = 0.25;
            spark(player.x, player.y, 10, "#6dff95");
            world.shake = Math.max(world.shake, 6);
            if (player.hp <= 0) { player.hp = 0; endRun(false); }
          }
        }
      }

      // contact damage
      if (e.dmg > 0 && dist2(player.x,player.y,e.x,e.y) <= (player.r+e.r)*(player.r+e.r)) {
        if (player.iFrames <= 0) {
          const dmg = Math.max(1, (e.dmg + world.difficulty*1.5) - player.armor*1.5);
          player.hp -= dmg;
          player.iFrames = 0.35;
          world.shake = Math.max(world.shake, 6);
          spark(player.x, player.y, 10, "#ffffff");
          if (player.hp <= 0) { player.hp = 0; endRun(false); }
        }
      }
    }

    // gems
    for (let i=gems.length-1;i>=0;i--){
      const g = gems[i];
      g.t += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= Math.pow(0.12, dt);
      g.vy *= Math.pow(0.12, dt);

      const d2 = dist2(player.x,player.y,g.x,g.y);
      const m = player.magnet;
      if (d2 < m*m) {
        const d = Math.sqrt(d2) || 1;
        const pull = (1 - d/m) * 920;
        const nx = (player.x - g.x)/d, ny = (player.y - g.y)/d;
        g.vx += nx * pull * dt;
        g.vy += ny * pull * dt;
      }
      if (d2 <= (player.r+g.r+2)*(player.r+g.r+2)) {
        addXP(g.val);
        puff(g.x,g.y,6,"#6dff95");
        gems.splice(i,1);
      }
    }

    // particles
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.life -= dt;
      if (p.kind==="puff"||p.kind==="spark"||p.kind==="boom"){
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(0.04, dt); p.vy *= Math.pow(0.04, dt);
      } else if (p.kind==="text"||p.kind==="dmg"){
        p.y += (p.vy||-26) * dt;
      } else if (p.kind==="mine") {
        // mine countdown; detonate
        p.arm -= dt;
        p.life -= 0; // life tracked already
        if (p.arm <= 0) {
          // detonate at end of life
          p.life -= dt;
          if (p.life <= 0) {
            // explode
            ring(p.x,p.y,p.radius,"#c04dff");
            for (const e of enemies) {
              if (dist2(p.x,p.y,e.x,e.y) <= (p.radius+e.r)*(p.radius+e.r)) {
                hitEnemy(e, p.dmg, e.x, e.y, false, false);
              }
            }
            boom(p.x,p.y, p.radius*0.55, "#c04dff");
            particles.splice(i,1);
            continue;
          }
        }
      }
      if (p.life <= 0) particles.splice(i,1);
    }

    updateHUD();
  }

  // ---------- HUD update ----------
  function updateHUD() {
    elTime.textContent = fmtTime(world.time);
    elHP.textContent = Math.ceil(player.hp);
    elHPMax.textContent = Math.ceil(player.hpMax);
    elLevel.textContent = player.level;
    elKills.textContent = world.kills;
    elCoins.textContent = world.coinsRun|0;

    elXPFill.style.width = (clamp(player.xp/player.xpToNext,0,1)*100).toFixed(1)+"%";
    elRunFill.style.width = (clamp(world.time/world.runGoal,0,1)*100).toFixed(1)+"%";
  }

  // ---------- Render ----------
  function render() {
    // shake
    let sx = 0, sy = 0;
    if (world.shake > 0) {
      world.shake = Math.max(0, world.shake - 20 * 0.016);
      sx = rand(-1,1) * world.shake;
      sy = rand(-1,1) * world.shake;
    }
    const camX = world.camX + sx;
    const camY = world.camY + sy;

    // bg
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0,0,W,H);

    // grid
    const grid = stage.grid;
    ctx.save();
    ctx.translate(W/2 - camX, H/2 - camY);
    ctx.globalAlpha = stage.gridAlpha;
    ctx.strokeStyle = "#6df0ff";
    ctx.lineWidth = 1;
    const minX = Math.floor((camX - W/2 - 200)/grid)*grid;
    const maxX = Math.floor((camX + W/2 + 200)/grid)*grid;
    const minY = Math.floor((camY - H/2 - 200)/grid)*grid;
    const maxY = Math.floor((camY + H/2 + 200)/grid)*grid;
    for (let x=minX; x<=maxX; x+=grid) { ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke(); }
    for (let y=minY; y<=maxY; y+=grid) { ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke(); }
    ctx.restore();

    // world transform
    ctx.save();
    ctx.translate(W/2 - camX, H/2 - camY);

    // gems
    for (const g of gems) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#6dff95";
      ctx.beginPath(); ctx.arc(g.x,g.y,g.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(g.x,g.y,g.r+5,0,Math.PI*2); ctx.strokeStyle="#6dff95"; ctx.lineWidth=2; ctx.stroke();
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
        ctx.beginPath(); ctx.arc(ox,oy,7.5,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(ox,oy,13,0,Math.PI*2); ctx.strokeStyle="#c04dff"; ctx.lineWidth=2; ctx.stroke();
      }
    }

    // enemies
    for (const e of enemies) {
      const flash = e.hitFlash > 0 ? 1 : 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = flash ? "#ffffff" : e.color;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();

      // outline
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r+4,0,Math.PI*2); ctx.stroke();

      // hp bar for boss/chest
      if (e.type==="boss" || e.type==="chest") {
        const w = 70, h = 7;
        const pct = clamp(e.hp / e.hpMax, 0, 1);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(e.x - w/2, e.y - e.r - 22, w, h);
        ctx.fillStyle = e.type==="boss" ? "#6dff95" : "#ffd36d";
        ctx.fillRect(e.x - w/2, e.y - e.r - 22, w*pct, h);
      }
    }

    // bullets
    for (const b of bullets) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+5,0,Math.PI*2); ctx.strokeStyle=b.color; ctx.lineWidth=2; ctx.stroke();
    }

    // player
    const inv = player.iFrames > 0 ? 0.55 : 1;
    ctx.globalAlpha = inv;
    ctx.fillStyle = "#6df0ff";
    ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = inv * 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(player.x,player.y,player.r*0.55,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#6df0ff";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x,player.y,player.magnet,0,Math.PI*2); ctx.stroke();

    // particles
    for (const p of particles) {
      const t = clamp(p.life, 0, 1);
      if (p.kind === "puff") {
        ctx.globalAlpha = 0.18 * t;
        ctx.fillStyle = p.color || "#6df0ff";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.3 - t*0.3),0,Math.PI*2); ctx.fill();
      } else if (p.kind === "spark") {
        ctx.globalAlpha = 0.35 * t;
        ctx.fillStyle = p.color || "#ffffff";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      } else if (p.kind === "boom") {
        ctx.globalAlpha = 0.25 * t;
        ctx.fillStyle = p.color || "#ff4d6d";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      } else if (p.kind === "ring") {
        ctx.globalAlpha = 0.22 * t;
        ctx.strokeStyle = p.color || "#ff4d6d";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.25 - t*0.2),0,Math.PI*2); ctx.stroke();
      } else if (p.kind === "nova") {
        ctx.globalAlpha = 0.24 * t;
        ctx.strokeStyle = p.color || "#c04dff";
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1.1 - t*0.15),0,Math.PI*2); ctx.stroke();
      } else if (p.kind === "zap") {
        ctx.globalAlpha = 0.85 * t;
        ctx.strokeStyle = p.color || "#6dff95";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
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
      } else if (p.kind === "dmg") {
        ctx.globalAlpha = (p.crit ? 1 : 0.9) * t;
        ctx.fillStyle = p.crit ? "#ffd36d" : "#ffffff";
        ctx.font = p.crit ? "1000 18px system-ui" : "900 14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(p.n), p.x, p.y);
      } else if (p.kind === "mine") {
        // draw mine
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#c04dff";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = "#c04dff";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x,p.y,(p.arm>0? p.r+6: p.radius),0,Math.PI*2); ctx.stroke();
      }
    }

    ctx.restore();

    // vignette
    ctx.globalAlpha = 1;
    const grd = ctx.createRadialGradient(W/2,H/2, Math.min(W,H)*0.2, W/2,H/2, Math.max(W,H)*0.72);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, `rgba(0,0,0,${stage.vignette})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,W,H);
  }

  // ---------- Boot ----------
  updateMenuStats();
  resetRun();
})();
