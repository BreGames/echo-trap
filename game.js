// Echo Trap: Neon Survival — Full build with Escape to menu from anywhere

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resizeCanvas(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

/* =========================
   Input
   ========================= */
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

/* Global Escape: return to main menu from any state */
window.addEventListener('keydown', e=>{
  if(e.code==='Escape'){ state = 'menu'; }
});

/* =========================
   Game state
   ========================= */
let state = 'menu'; // 'menu','levelselect','settings','playing','gameover'
let frame = 0, score = 0, bestScore = 0;
let unlockedLevels = 1;
let selectedLevel = 1;

/* =========================
   Levels (1–100) dynamic config
   ========================= */
const PALETTES = ['cyan-magenta','lime-orange','purple-yellow','azure-rose','teal-pink','gold-violet'];
function getLevelConfig(level){
  const l = Math.max(1, Math.min(100, level));
  const echoRate   = Math.max(70, 160 - Math.floor(l * 0.9));
  const enemyRate  = Math.max(80, 260 - Math.floor(l * 1.5));
  const powerRate  = Math.max(360, 500 - Math.floor(l * 1.0));
  const enemySpeed = 2.0 + (l * 0.015);
  const maxEnemies = Math.min(12 + Math.floor(l * 0.18), 60);
  const palette    = PALETTES[(l - 1) % PALETTES.length];
  return { echoRate, enemyRate, powerRate, enemySpeed, maxEnemies, palette, level: l };
}
let currentLevel = getLevelConfig(1);

/* =========================
   Settings
   ========================= */
const settings = {
  sound: true,
  difficulty: 'normal', // 'easy','normal','hard'
  paletteCycle: false
};

/* =========================
   Achievements
   ========================= */
const achievements = [
  { id:'shielded', name:'Shielded', unlocked:false },
  { id:'magneto', name:'Magneto', unlocked:false },
  { id:'timeLord', name:'Time Lord', unlocked:false },
  { id:'bulletWeave', name:'Bullet Weave', unlocked:false },
  { id:'singularity', name:'Singularity', unlocked:false },
  { id:'levelTwo', name:'Level 2 Unlocked', unlocked:false },
  { id:'levelThree', name:'Level 3 Unlocked', unlocked:false },
  { id:'centurion', name:'Level 100 Reached', unlocked:false }
];
let unlockBanner = { text:'', timer:0 };
let levelBanner = { text:'', timer:0 };
function announceUnlock(name){ unlockBanner.text = `Achievement: ${name}`; unlockBanner.timer = 180; }
function unlockOnce(id){ const a = achievements.find(x=>x.id===id); if(a && !a.unlocked){ a.unlocked = true; announceUnlock(a.name); } }
function announceLevelUp(next){ levelBanner.text = `LEVEL UP → ${next}`; levelBanner.timer = 150; }

/* =========================
   Entities
   ========================= */
const player = { x: canvas.width/2 - 9, y: canvas.height/2 - 9, w:18, h:18, speed:3, alive:true };
let echoes=[], enemies=[], bullets=[], powerUps=[];
let particles=[];

/* =========================
   Timers & effects
   ========================= */
let shieldTimer=0, slowTimer=0, dashTimer=0, dashCooldown=0, dashIFrames=0;
let magnetTimer=0, decoyTimer=0, timewarpTimer=0, pierceTimer=0, gravityTimer=0;
let freezeFrames=0;
let decoy=null, gravityWell=null;

/* =========================
   Utility
   ========================= */
function randRange(min,max){ return Math.random()*(max-min)+min; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function rectsOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
function edgeSpawn(){
  const side = Math.floor(Math.random()*4);
  if(side===0) return { x: randRange(0, canvas.width), y: -20 };
  if(side===1) return { x: canvas.width+20, y: randRange(0, canvas.height) };
  if(side===2) return { x: randRange(0, canvas.width), y: canvas.height+20 };
  return { x: -20, y: randRange(0, canvas.height) };
}

/* =========================
   Background
   ========================= */
function drawBackground(){
  ctx.fillStyle='#0a0c12'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='rgba(0,180,255,0.06)'; ctx.beginPath();
  for(let x=0;x<canvas.width;x+=40){ ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
  for(let y=0;y<canvas.height;y+=40){ ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
  ctx.stroke();
  const tintMap={
    'cyan-magenta':'rgba(0,224,255,0.04)',
    'lime-orange':'rgba(255,180,0,0.04)',
    'purple-yellow':'rgba(180,0,255,0.04)',
    'azure-rose':'rgba(0,160,255,0.04)',
    'teal-pink':'rgba(0,200,160,0.04)',
    'gold-violet':'rgba(255,200,0,0.04)'
  };
  ctx.fillStyle=tintMap[currentLevel.palette]||'rgba(255,255,255,0.02)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

/* =========================
   Menus
   ========================= */
function drawMenu(){
  ctx.textAlign='center';
  ctx.fillStyle='#00e0ff';
  ctx.font="36px 'Press Start 2P'";
  ctx.fillText('ECHO TRAP', canvas.width/2, canvas.height/2 - 90);

  ctx.font="18px 'Press Start 2P'";
  ctx.fillStyle='#ffffff';
  ctx.fillText('Enter: Start', canvas.width/2, canvas.height/2 - 30);
  ctx.fillText('Shift: Level Select', canvas.width/2, canvas.height/2 + 10);
  ctx.fillText('S: Settings', canvas.width/2, canvas.height/2 + 50);
  ctx.font="12px 'Press Start 2P'";
  ctx.fillText('Esc: Back to Menu (anywhere)', canvas.width/2, canvas.height/2 + 90);
}

function drawLevelSelect(){
  ctx.textAlign='center'; ctx.fillStyle='#00e0ff'; ctx.font="28px 'Press Start 2P'";
  ctx.fillText('LEVEL SELECT', canvas.width/2, 80);
  ctx.font="16px 'Press Start 2P'";
  const maxShow=12;
  const start=Math.max(1, selectedLevel-Math.floor(maxShow/2));
  const end=Math.min(100, Math.max(start+maxShow-1, selectedLevel+Math.floor(maxShow/2)));
  let y=140;
  for(let i=start;i<=end;i++){
    const locked=i>unlockedLevels;
    const text=locked?`Level ${i} (Locked)`:`Level ${i}`;
    ctx.fillStyle=(!locked && i===selectedLevel)?'#39ff14':(locked?'rgba(255,255,255,0.35)':'#ffffff');
    ctx.fillText(text, canvas.width/2, y); y+=34;
  }
  ctx.fillStyle='#ffffff'; ctx.font="12px 'Press Start 2P'";
  ctx.fillText('↑ ↓ select • PageUp/PageDown ±10 • Home/End • Enter start • Esc menu', canvas.width/2, canvas.height-60);
  ctx.fillText(`Unlocked: ${unlockedLevels}/100`, canvas.width/2, canvas.height-40);
}

function drawSettings(){
  ctx.textAlign='center'; ctx.fillStyle='#00e0ff'; ctx.font="28px 'Press Start 2P'";
  ctx.fillText('SETTINGS', canvas.width/2, 80);
  ctx.font="16px 'Press Start 2P'"; ctx.fillStyle='#ffffff';
  ctx.fillText(`Sound: ${settings.sound?'On':'Off'}  (T)`, canvas.width/2, 150);
  ctx.fillText(`Difficulty: ${settings.difficulty}  (D cycles)`, canvas.width/2, 190);
  ctx.fillText(`Palette cycle: ${settings.paletteCycle?'On':'Off'}  (P)`, canvas.width/2, 230);
  ctx.font="12px 'Press Start 2P'";
  ctx.fillText('Esc: Back to Menu', canvas.width/2, canvas.height-40);
}

/* =========================
   HUD & banners
   ========================= */
function drawHUD(){
  ctx.textAlign='left'; ctx.fillStyle='#ffffff'; ctx.font="14px 'Press Start 2P'";
  ctx.fillText(`Score: ${Math.floor(score)}`, 20, 28);
  ctx.fillText(`Best: ${Math.floor(bestScore)}`, 20, 50);
  ctx.fillText(`Level: ${currentLevel.level}`, 20, 72);

  const bars = [
    { label:'Shield', val:shieldTimer },
    { label:'Slow', val:slowTimer },
    { label:'Dash', val:dashTimer },
    { label:'Magnet', val:magnetTimer },
    { label:'Decoy', val:decoyTimer },
    { label:'TimeWarp', val:timewarpTimer },
    { label:'Pierce', val:pierceTimer },
    { label:'Gravity', val:gravityTimer }
  ];
  let y=100;
  bars.forEach(b=>{
    if(b.val>0){
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fillRect(20, y, 160, 8);
      ctx.fillStyle='#39ff14'; ctx.fillRect(20, y, clamp(b.val,0,180)/180*160, 8);
      ctx.fillStyle='#ffffff'; ctx.font="11px 'Press Start 2P'"; ctx.fillText(b.label, 190, y+8);
      y+=16;
    }
  });

  if(unlockBanner.timer>0){
    ctx.textAlign='center'; ctx.fillStyle='#39ff14'; ctx.font="16px 'Press Start 2P'";
    ctx.fillText(unlockBanner.text, canvas.width/2, 40);
    unlockBanner.timer--;
  }
  if(levelBanner.timer>0){
    ctx.textAlign='center'; ctx.fillStyle='#00e0ff'; ctx.font="16px 'Press Start 2P'";
    ctx.fillText(levelBanner.text, canvas.width/2, 64);
    levelBanner.timer--;
  }
}

/* =========================
   Enemy archetypes
   ========================= */
function makeEnemy(type){
  const p = edgeSpawn();
  const size = 16;
  return { type, x:p.x, y:p.y, w:size, h:size, vx:0, vy:0, hp: (type==='Bomber'||type==='Phaser')?2:1, alive:true, cooldown:0 };
}

function updateEnemy(e){
  const speed = currentLevel.enemySpeed * (slowTimer>0 ? 0.6 : 1.0);

  if(e.type==='Chaser'){
    const dx = (player.x+player.w/2) - (e.x+e.w/2);
    const dy = (player.y+player.h/2) - (e.y+e.h/2);
    const len = Math.max(1, Math.hypot(dx,dy));
    e.vx = speed * dx/len; e.vy = speed * dy/len;
  }

  if(e.type==='Patroller'){
    if(e.cooldown<=0){
      const target = edgeSpawn();
      const dx = target.x - e.x, dy = target.y - e.y;
      const len = Math.max(1, Math.hypot(dx,dy));
      e.vx = speed * dx/len; e.vy = speed * dy/len;
      e.cooldown = 120;
    } else e.cooldown--;
  }

  if(e.type==='Shooter'){
    const dx = (player.x+player.w/2) - (e.x+e.w/2);
    const dy = (player.y+player.h/2) - (e.y+e.h/2);
    const len = Math.max(1, Math.hypot(dx,dy));
    e.vx = speed*0.6 * dx/len; e.vy = speed*0.6 * dy/len;
    if(e.cooldown<=0){
      bullets.push({
        x:e.x+e.w/2, y:e.y+e.h/2, w:6, h:6,
        vx: (pierceTimer>0?3.6:3.0) * dx/len,
        vy: (pierceTimer>0?3.6:3.0) * dy/len,
        friendly:false, alive:true
      });
      e.cooldown = 90;
      if(pierceTimer>0) unlockOnce('bulletWeave');
    } else e.cooldown--;
  }

  if(e.type==='Teleporter'){
    if(e.cooldown<=0){
      const p = edgeSpawn(); e.x=p.x; e.y=p.y; e.cooldown = 120;
    } else {
      e.vx = speed*0.4 * (Math.random()<0.5?1:-1);
      e.vy = speed*0.4 * (Math.random()<0.5?1:-1);
      e.cooldown--;
    }
  }

  if(e.type==='Dasher'){
    if(e.cooldown<=0){
      const dx = (player.x+player.w/2) - (e.x+e.w/2);
      const dy = (player.y+player.h/2) - (e.y+e.h/2);
      const len = Math.max(1, Math.hypot(dx,dy));
      e.vx = speed*2.2 * dx/len; e.vy = speed*2.2 * dy/len;
      e.cooldown = 60;
      unlockOnce('dashEscape');
    } else { e.vx*=0.95; e.vy*=0.95; e.cooldown--; }
  }

  if(e.type==='Splitter'){
    const dx = (player.x+player.w/2) - (e.x+e.w/2);
    const dy = (player.y+player.h/2) - (e.y+e.h/2);
    const len = Math.max(1, Math.hypot(dx,dy));
    e.vx = speed * dx/len; e.vy = speed * dy/len;
  }

  if(e.type==='Healer'){
    let target=null, best=1e9;
    enemies.forEach(o=>{
      if(o!==e && o.alive){
        const d = Math.hypot(o.x-e.x, o.y-e.y);
        if(d<best){ best=d; target=o; }
      }
    });
    if(target){
      const dx = target.x - e.x, dy = target.y - e.y;
      const len = Math.max(1, Math.hypot(dx,dy));
      e.vx = speed*0.9 * dx/len; e.vy = speed*0.9 * dy/len;
      if(best<40 && target.hp<3) target.hp++;
    } else { e.vx=0; e.vy=0; }
  }

  if(e.type==='Mirror'){
    e.vx = (player.x - e.x) * 0.02 * speed;
    e.vy = (player.y - e.y) * 0.02 * speed;
  }

  if(e.type==='Bomber'){
    e.vx += (Math.random()-0.5)*0.2; e.vy += (Math.random()-0.5)*0.2;
    e.vx = clamp(e.vx, -speed, speed); e.vy = clamp(e.vy, -speed, speed);
    if(e.cooldown<=0){
      for(let i=0;i<6;i++){
        const ang = i*(Math.PI*2/6);
        bullets.push({
          x:e.x+e.w/2, y:e.y+e.h/2, w:6, h:6,
          vx: Math.cos(ang)*2.4, vy: Math.sin(ang)*2.4,
          friendly:false, alive:true
        });
      }
      e.cooldown=120;
    } else e.cooldown--;
  }

  if(e.type==='Phaser'){
    if(e.cooldown%120<60){ e.vx = speed*1.6*(Math.random()<0.5?1:-1); e.vy = speed*1.6*(Math.random()<0.5?1:-1); }
    else { e.vx*=0.9; e.vy*=0.9; }
    if(e.cooldown%90===0){
      const dx = player.x - e.x, dy = player.y - e.y, len=Math.max(1,Math.hypot(dx,dy));
      bullets.push({ x:e.x+e.w/2, y:e.y+e.h/2, w:6, h:6, vx:dx/len*3.3, vy:dy/len*3.3, friendly:false, alive:true });
    }
    e.cooldown++;
  }

  e.x += e.vx; e.y += e.vy;
  if(e.x<-40||e.x>canvas.width+40||e.y<-40||e.y>canvas.height+40) e.alive=false;
}
function drawEnemy(e){
  const colors = {
    Chaser:'#ff0055', Patroller:'#ffaa00', Shooter:'#ff66ff', Teleporter:'#66ccff',
    Dasher:'#ff3333', Splitter:'#ffdd00', Healer:'#66ff99', Mirror:'#9999ff',
    Bomber:'#ff7744', Phaser:'#cc66ff'
  };
  ctx.fillStyle = colors[e.type]||'#ffffff';
  ctx.fillRect(e.x, e.y, e.w, e.h);
}

/* =========================
   Power-ups
   ========================= */
function spawnPowerUp(){
  const types = ['Shield','Slow','Clear','Dash','Magnet','Decoy','TimeWarp','Pierce','Gravity','ShieldBoost'];
  const t = types[Math.floor(Math.random()*types.length)];
  powerUps.push({ type:t, x:randRange(40,canvas.width-40), y:randRange(40,canvas.height-40), w:14, h:14, alive:true });
}
function drawPowerUp(p){
  const colors={
    Shield:'#39ff14', Slow:'#00e0ff', Clear:'#ffffff', Dash:'#ffcc00', Magnet:'#00ffcc',
    Decoy:'#ff99cc', TimeWarp:'#99ffff', Pierce:'#ff66aa', Gravity:'#66ff66', ShieldBoost:'#aaff00'
  };
  ctx.fillStyle = colors[p.type]||'#ffffff';
  ctx.fillRect(p.x, p.y, p.w, p.h);
}
function applyPowerUp(t){
  if(t==='Shield'){ shieldTimer=180; unlockOnce('shielded'); }
  if(t==='Slow'){ slowTimer=180; }
  if(t==='Clear'){ enemies.forEach(e=>e.alive=false); bullets.forEach(b=>b.alive=false); }
  if(t==='Dash'){ dashTimer=60; }
  if(t==='Magnet'){ magnetTimer=180; unlockOnce('magneto'); }
  if(t==='Decoy'){ decoyTimer=180; decoy={ x:player.x, y:player.y, w:14, h:14 }; }
  if(t==='TimeWarp'){ timewarpTimer=180; unlockOnce('timeLord'); }
  if(t==='Pierce'){ pierceTimer=180; }
  if(t==='Gravity'){ gravityTimer=180; gravityWell={ x:player.x, y:player.y, r:80 }; unlockOnce('singularity'); }
  if(t==='ShieldBoost'){ shieldTimer= clamp(shieldTimer+60, 0, 240); }
}

/* =========================
   Echoes
   ========================= */
function spawnEcho(){
  const p=edgeSpawn();
  echoes.push({ x:p.x, y:p.y, w:12, h:12, vx: (Math.random()<0.5?1:-1)*randRange(1.2,2.2), vy:(Math.random()<0.5?1:-1)*randRange(1.2,2.2), alive:true });
}
function updateEcho(e){
  const mult = slowTimer>0 ? 0.6 : 1.0;
  e.x += e.vx*mult; e.y += e.vy*mult;
  if(e.x<-30||e.x>canvas.width+30||e.y<-30||e.y>canvas.height+30) e.alive=false;
}
function drawEcho(e){ ctx.fillStyle='rgba(0,224,255,0.5)'; ctx.fillRect(e.x,e.y,e.w,e.h); }

/* =========================
   Player + bullets
   ========================= */
function updatePlayer(){
  let spd = player.speed;
  if(keys['ArrowLeft']||keys['KeyA']) player.x -= spd;
  if(keys['ArrowRight']||keys['KeyD']) player.x += spd;
  if(keys['ArrowUp']||keys['KeyW']) player.y -= spd;
  if(keys['ArrowDown']||keys['KeyS']) player.y += spd;

  // Dash (Space) with cooldown
  if(keys['Space'] && dashCooldown<=0){
    dashIFrames = 20; dashCooldown = 60;
    player.x += (keys['ArrowRight']||keys['KeyD']?30: (keys['ArrowLeft']||keys['KeyA']?-30:0));
    player.y += (keys['ArrowDown']||keys['KeyS']?30: (keys['ArrowUp']||keys['KeyW']?-30:0));
  }
  if(dashCooldown>0) dashCooldown--;

  player.x = clamp(player.x, 0, canvas.width-player.w);
  player.y = clamp(player.y, 0, canvas.height-player.h);

  if(gravityTimer>0 && gravityWell){
    enemies.forEach(e=>{
      const dx = gravityWell.x - e.x, dy = gravityWell.y - e.y, d = Math.max(1, Math.hypot(dx,dy));
      e.vx += dx/d*0.2; e.vy += dy/d*0.2;
    });
  }

  if(magnetTimer>0){
    powerUps.forEach(p=>{
      const dx = (player.x+player.w/2) - (p.x+p.w/2), dy = (player.y+player.h/2) - (p.y+p.h/2);
      const d = Math.max(1, Math.hypot(dx,dy));
      p.x += dx/d*1.4; p.y += dy/d*1.4;
    });
  }

  if(dashIFrames>0) dashIFrames--;
}
function drawPlayer(){
  ctx.fillStyle = shieldTimer>0 ? '#39ff14' : '#00d1ff';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  if(decoyTimer>0 && decoy){
    ctx.fillStyle='rgba(255,153,204,0.6)';
    ctx.fillRect(decoy.x, decoy.y, decoy.w, decoy.h);
  }
}

/* =========================
   Collisions
   ========================= */
function handleCollisions(){
  powerUps.forEach(p=>{
    if(p.alive && rectsOverlap(player,p)){ p.alive=false; applyPowerUp(p.type); }
  });

  const harmRects = [].concat(echoes, enemies, bullets.filter(b=>!b.friendly));
  harmRects.forEach(h=>{
    if(h.alive && rectsOverlap(player,h)){
      if(shieldTimer>0 || dashIFrames>0){
        if(shieldTimer>0) shieldTimer = Math.max(0, shieldTimer-30);
        h.alive=false;
      } else {
        player.alive=false; state='gameover';
        bestScore = Math.max(bestScore, score);
      }
    }
  });

  bullets.filter(b=>b.friendly && b.alive).forEach(b=>{
    enemies.forEach(e=>{
      if(e.alive && rectsOverlap(b,e)){
        e.hp--; b.alive = (pierceTimer>0);
        if(e.hp<=0){
          e.alive=false; score += 3;
          if(e.type==='Splitter'){
            const c1=makeEnemy('Chaser'); c1.x=e.x-10; c1.y=e.y-10;
            const c2=makeEnemy('Chaser'); c2.x=e.x+10; c2.y=e.y+10;
            enemies.push(c1,c2);
          }
        }
      }
    });
  });
}

/* =========================
   Spawning
   ========================= */
function spawnEnemy(){
  const pool = ['Chaser','Patroller','Shooter','Teleporter','Dasher','Splitter','Healer','Mirror','Bomber','Phaser'];
  const t = pool[Math.floor(Math.random()*pool.length)];
  enemies.push( makeEnemy(t) );
}
function spawnFriendlyBullet(){
  const dx = (canvas.width/2) - (player.x+player.w/2);
  const dy = (canvas.height/2) - (player.y+player.h/2);
  const len = Math.max(1, Math.hypot(dx,dy));
  bullets.push({ x:player.x+player.w/2, y:player.y+player.h/2, w:6, h:6, vx:dx/len*4.2, vy:dy/len*4.2, friendly:true, alive:true });
}

/* =========================
   Update loop
   ========================= */
function update(){
  if(state==='menu'){
    if(keys['Enter']) startGame(selectedLevel);
    if(keys['ShiftLeft']||keys['ShiftRight']) state='levelselect';
    if(keys['KeyS']) state='settings';
    return;
  }
  if(state==='levelselect'){
    if(keys['ArrowUp']) selectedLevel = Math.max(1, selectedLevel-1);
    if(keys['ArrowDown']) selectedLevel = Math.min(unlockedLevels, selectedLevel+1);
    if(keys['PageUp']) selectedLevel = Math.max(1, selectedLevel-10);
    if(keys['PageDown']) selectedLevel = Math.min(unlockedLevels, selectedLevel+10);
    if(keys['Home']) selectedLevel = 1;
    if(keys['End']) selectedLevel = unlockedLevels;
    if(keys['Enter']) startGame(selectedLevel);
    return;
  }
  if(state==='settings'){
    if(keys['KeyT']) settings.sound = !settings.sound;
    if(keys['KeyD']){
      settings.difficulty = settings.difficulty==='easy' ? 'normal' :
                            settings.difficulty==='normal' ? 'hard' : 'easy';
    }
    if(keys['KeyP']) settings.paletteCycle = !settings.paletteCycle;
    return;
  }
  if(state==='gameover'){
    if(keys['Enter']) state='menu';
    return;
  }
  if(state!=='playing') return;

  frame++; score += 0.05;

  if(settings.paletteCycle && frame%600===0){
    const idx = PALETTES.indexOf(currentLevel.palette);
    currentLevel.palette = PALETTES[(idx+1)%PALETTES.length];
  }

  // Auto level progression up to 100
  const s = Math.floor(score);
  const levelThreshold = selectedLevel * 60;
  if(s >= levelThreshold && selectedLevel < 100){
    selectedLevel++;
    currentLevel = getLevelConfig(selectedLevel);
    announceLevelUp(selectedLevel);
    if(unlockedLevels < selectedLevel) unlockedLevels = selectedLevel;
    if(selectedLevel===2) unlockOnce('levelTwo');
    if(selectedLevel===3) unlockOnce('levelThree');
    if(selectedLevel===100) unlockOnce('centurion');
  }

  // Timers decay
  if(shieldTimer>0) shieldTimer--;
  if(slowTimer>0) slowTimer--;
  if(dashTimer>0) dashTimer--;
  if(magnetTimer>0) magnetTimer--;
  if(decoyTimer>0) decoyTimer--;
  if(timewarpTimer>0) timewarpTimer--;
  if(pierceTimer>0) pierceTimer--;
  if(gravityTimer>0) gravityTimer--;
  if(freezeFrames>0) freezeFrames--;

  // Player
  updatePlayer();

  // Echoes & spawn
  if(frame%currentLevel.echoRate===0) spawnEcho();
  echoes.forEach(e=>updateEcho(e));
  echoes = echoes.filter(e=>e.alive);

  // Enemies & spawn cap
  if(enemies.length<currentLevel.maxEnemies && frame%currentLevel.enemyRate===0) spawnEnemy();
  enemies.forEach(e=>updateEnemy(e));
  enemies = enemies.filter(e=>e.alive);

  // Bullets
  if(frame%45===0) spawnFriendlyBullet();
  bullets.forEach(b=>{
    const mult = slowTimer>0 ? 0.7 : 1.0;
    b.x += b.vx*mult; b.y += b.vy*mult;
    if(b.x<-20||b.x>canvas.width+20||b.y<-20||b.y>canvas.height+20) b.alive=false;
  });
  bullets = bullets.filter(b=>b.alive);

  // Power-ups
  if(frame%currentLevel.powerRate===0) spawnPowerUp();
  powerUps = powerUps.filter(p=>p.alive);

  // Decoy follows slowly
  if(decoyTimer>0 && decoy){
    decoy.x += (player.x-decoy.x)*0.03;
    decoy.y += (player.y-decoy.y)*0.03;
  }

  // Collisions
  handleCollisions();
}

/* =========================
   Drawing
   ========================= */
function draw(){
  drawBackground();

  if(state==='menu') { drawMenu(); return; }
  if(state==='levelselect') { drawLevelSelect(); return; }
  if(state==='settings') { drawSettings(); return; }
  if(state==='gameover'){
    ctx.textAlign='center';
    ctx.fillStyle='#ff0055'; ctx.font="28px 'Press Start 2P'";
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 10);
    ctx.fillStyle='#ffffff'; ctx.font="16px 'Press Start 2P'";
    ctx.fillText(`Score: ${Math.floor(score)}  Best: ${Math.floor(bestScore)}`, canvas.width/2, canvas.height/2 + 26);
    ctx.fillText('Enter: Menu • Esc: Menu', canvas.width/2, canvas.height/2 + 56);
    return;
  }

  echoes.forEach(drawEcho);
  powerUps.forEach(drawPowerUp);
  enemies.forEach(drawEnemy);

  ctx.fillStyle='#ffffff';
  bullets.forEach(b=>ctx.fillRect(b.x,b.y,b.w,b.h));

  drawPlayer();
  drawHUD();
}

/* =========================
   Loop
   ========================= */
function loop(){ update(); draw(); requestAnimationFrame(loop); }
loop();

/* =========================
   Start/reset
   ========================= */
function startGame(level=1){
  selectedLevel = clamp(level,1,100);
  currentLevel = getLevelConfig(selectedLevel);
  state='playing'; frame=0; score=0;
  player.x=canvas.width/2 - player.w/2; player.y=canvas.height/2 - player.h/2; player.alive=true;
  echoes=[]; enemies=[]; bullets=[]; powerUps=[]; particles=[];
  shieldTimer=slowTimer=dashTimer=dashCooldown=dashIFrames=0;
  magnetTimer=decoyTimer=timewarpTimer=pierceTimer=gravityTimer=0;
  freezeFrames=0; decoy=null; gravityWell=null;
  unlockBanner.text=''; unlockBanner.timer=0; levelBanner.text=''; levelBanner.timer=0;
}