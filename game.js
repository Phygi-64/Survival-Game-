const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- World ----------
const WORLD_W = 2400, WORLD_H = 1600;
const camera = {x:0, y:0};

function rand(a,b){ return a + Math.random()*(b-a); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

// ---------- Player ----------
const player = {
  x: WORLD_W/2, y: WORLD_H/2,
  w: 24, h: 24,
  speed: 170, // pixels par seconde
  hp: 100, maxHp: 100,
  hunger: 100,
  facing: 'down',
  dead:false,
  attackCooldown:0,
  equipped:null
};

const keys = {};
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'i') { toggleModal('craftModal', false); toggleModal('invModal', !document.getElementById('invModal').classList.contains('hidden') ? false : true); renderInvGrid(); }
  if (k === 't') { toggleModal('invModal', false); const willShow = document.getElementById('craftModal').classList.contains('hidden'); toggleModal('craftModal', willShow); if (willShow){ renderCraftCategories(); renderCraftDetail(); } }
  if (k === 'f') quickPlace('campfire');
  if (k === 'r') quickPlace('wall');
  if (k === 'escape') { toggleModal('invModal', false); toggleModal('craftModal', false); }
  const num = parseInt(k);
  if (num >= 1 && num <= 9){ selectedHotbarSlot = num-1; renderHotbar(); }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function quickPlace(id){
  const r = RECIPE_BY_ID[id];
  if (!canAfford(r.cost)){ showMsg('Ressources insuffisantes.'); return; }
  pay(r.cost);
  r.effect();
  renderHotbar();
  renderInvGrid();
}

document.getElementById('btnInventory').onclick = () => {
  toggleModal('craftModal', false);
  const willShow = document.getElementById('invModal').classList.contains('hidden');
  toggleModal('invModal', willShow);
  if (willShow) renderInvGrid();
};
document.getElementById('btnCraft').onclick = () => {
  toggleModal('invModal', false);
  const willShow = document.getElementById('craftModal').classList.contains('hidden');
  toggleModal('craftModal', willShow);
  if (willShow){ renderCraftCategories(); renderCraftDetail(); }
};
document.getElementById('btnDay').onclick = () => {
  showMsg(isNight ? `🌙 Nuit — Jour ${dayCount}` : `☀️ Jour ${dayCount}`);
};
document.getElementById('btnCampfire').onclick = () => quickPlace('campfire');
document.getElementById('btnWall').onclick = () => quickPlace('wall');
document.getElementById('closeInv').onclick = () => toggleModal('invModal', false);
document.getElementById('closeCraft').onclick = () => toggleModal('craftModal', false);

// ---------- Inventory ----------
const inventory = {
  wood: 0, stone: 0, berry: 0, meat: 0, fiber: 0,
  coal: 0, copper: 0, iron: 0, gold: 0, diamond: 0
};
const ITEM_ICONS = {
  wood:'🪵', stone:'🪨', berry:'🍒', meat:'🍖', fiber:'🌾',
  coal:'⚫', copper:'🟠', iron:'🔩', gold:'🥇', diamond:'💎',
  campfire:'🔥', wall:'🧱',
  axe:'🪓', pickaxe:'⛏️', sword:'🗡️'
};
// Tiers: 0 = aucun, 1 = basique (pierre), 2 = fer, 3 = or/diamant
const TOOL_TIER_NAMES = { axe:['—','Bois','Fer','Diamant'], pickaxe:['—','Pierre','Fer','Diamant'], sword:['—','Bois','Fer','Or','Diamant'] };
let tools = { axeTier:0, pickaxeTier:0, swordTier:0 };
const SWORD_DMG = [6, 12, 20, 26, 38]; // index = tier
let placedCampfires = [];

function addItem(name, qty){
  inventory[name] = (inventory[name]||0) + qty;
  renderHotbar();
  renderInvGrid();
}

// Ordre d'affichage : outils d'abord, puis ressources
const HOTBAR_ORDER = ['axe','pickaxe','sword','wood','stone','coal','copper','iron','gold','diamond','berry','meat','fiber'];
let selectedHotbarSlot = 0;

function getHotbarItems(){
  const items = [];
  ['axe','pickaxe','sword'].forEach(tool => {
    const tier = tools[tool+'Tier'];
    if (tier > 0) items.push({ name:tool, isTool:true, tierLabel: TOOL_TIER_NAMES[tool][tier] });
  });
  Object.keys(inventory).forEach(k => {
    if (inventory[k] > 0) items.push({ name:k, isTool:false, qty: inventory[k] });
  });
  return items.slice(0, 9);
}

function renderHotbar(){
  const el = document.getElementById('hotbar');
  el.innerHTML = '';
  const items = getHotbarItems();
  for (let i=0;i<9;i++){
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot' + (i===selectedHotbarSlot ? ' selected' : '');
    const item = items[i];
    if (item){
      slot.innerHTML = `<span class="num">${i+1}</span><div>${ITEM_ICONS[item.name]||'❔'}</div>` +
        (item.isTool ? `<span class="tierLbl">${item.tierLabel}</span>` : `<span class="cnt">${item.qty}</span>`);
    } else {
      slot.innerHTML = `<span class="num">${i+1}</span>`;
    }
    slot.onclick = () => {
      selectedHotbarSlot = i;
      renderHotbar();
      if (item && !item.isTool && (item.name==='berry' || item.name==='meat')) consumeFood(item.name);
    };
    el.appendChild(slot);
  }
}

function renderInvGrid(){
  const el = document.getElementById('invGrid');
  el.innerHTML = '';
  const entries = Object.entries(inventory).filter(([k,v]) => v > 0);
  ['axe','pickaxe','sword'].forEach(tool => {
    const tier = tools[tool+'Tier'];
    if (tier > 0) entries.push([tool, TOOL_TIER_NAMES[tool][tier]]);
  });
  if (entries.length === 0){
    el.innerHTML = '<div class="invEmpty">Ton sac est vide. Récolte des ressources sur l\'île !</div>';
    return;
  }
  entries.forEach(([name, val]) => {
    const isTool = ['axe','pickaxe','sword'].includes(name);
    const isFood = (name === 'berry' || name === 'meat');
    const cell = document.createElement('div');
    cell.className = 'item-cell' + (isFood ? ' foodCell' : '');
    cell.innerHTML = `<div>${ITEM_ICONS[name]||'❔'}</div>` +
      (isTool ? `<div class="lbl">${val}</div>` : `<div class="cnt">${val}</div>`);
    if (isFood){
      cell.title = 'Cliquer pour manger';
      cell.onclick = () => consumeFood(name);
    }
    el.appendChild(cell);
  });
}

// ---------- Modales ----------
function toggleModal(id, show){
  document.getElementById(id).classList.toggle('hidden', !show);
}
function isAnyModalOpen(){
  return !document.getElementById('invModal').classList.contains('hidden') ||
         !document.getElementById('craftModal').classList.contains('hidden');
}

// ---------- Minerais ----------
// hp: coups nécessaires, reqTier: palier de pioche minimum, color/dot: rendu du filon
const ORES = {
  coal:    { name:'Charbon', hp:2, reqTier:1, color:'#5a5a5a', dot:'#111' },
  copper:  { name:'Cuivre',  hp:3, reqTier:1, color:'#8f9aa0', dot:'#c07a3a' },
  iron:    { name:'Fer',     hp:4, reqTier:1, color:'#8f9aa0', dot:'#c9c2b3' },
  gold:    { name:'Or',      hp:4, reqTier:2, color:'#8f9aa0', dot:'#e8c93e' },
  diamond: { name:'Diamant', hp:5, reqTier:2, color:'#8f9aa0', dot:'#5fe0e8' }
};

// ---------- Resources ----------
let resources = [];
function spawnResources(){
  resources = [];
  for (let i=0;i<70;i++){
    resources.push({
      type:'tree', x:rand(60,WORLD_W-60), y:rand(60,WORLD_H-60),
      r:18, hp:3, wobble:0
    });
  }
  for (let i=0;i<45;i++){
    resources.push({
      type:'rock', x:rand(60,WORLD_W-60), y:rand(60,WORLD_H-60),
      r:16, hp:4, wobble:0
    });
  }
  for (let i=0;i<35;i++){
    resources.push({
      type:'bush', x:rand(60,WORLD_W-60), y:rand(60,WORLD_H-60),
      r:12, hp:1, wobble:0, berries: Math.random()<0.9
    });
  }
  for (let i=0;i<25;i++){
    resources.push({
      type:'grass', x:rand(60,WORLD_W-60), y:rand(60,WORLD_H-60),
      r:10, hp:1, wobble:0
    });
  }
  // Gisements de minerai (nécessitent une pioche de palier suffisant)
  const oreCounts = { coal:26, copper:22, iron:16, gold:10, diamond:6 };
  Object.entries(oreCounts).forEach(([ore, count]) => {
    for (let i=0;i<count;i++){
      resources.push({
        type:'ore', ore, x:rand(60,WORLD_W-60), y:rand(60,WORLD_H-60),
        r:16, hp:ORES[ore].hp, wobble:0
      });
    }
  });
}
spawnResources();

// ---------- Ennemis (désactivés : pas de monstres la nuit dans le jeu de base) ----------
let enemies = [];

// ---------- Day/Night ----------
let dayLength = 60 * 12; // frames-ish counted via time accumulation (approx seconds*fps)
let time = 0; // 0..1 full cycle
let dayCount = 1;
let cycleSeconds = 90; // total day+night length in seconds
let isNight = false;

function updateDayNight(dt){
  time += dt / cycleSeconds;
  if (time >= 1){
    time -= 1;
    dayCount++;
  }
  const wasNight = isNight;
  isNight = time > 0.55 && time < 0.98;
  if (isNight && !wasNight){
    showMsg('🌙 La nuit tombe... la visibilité est réduite.');
  }
  if (!isNight && wasNight){
    showMsg('☀️ Le jour se lève.');
  }
  document.getElementById('dayLabel').textContent = 'Jour ' + dayCount;
  document.getElementById('phaseLabel').textContent = isNight ? '🌙 Nuit' : '☀️ Jour';
}

function lightLevel(){
  // returns 0 (full dark) .. 1 (full bright)
  if (time < 0.5) return 1;
  if (time < 0.55) return 1 - (time-0.5)/0.05;
  if (time < 0.93) return 0.12;
  if (time < 0.98) return 0.12 + (time-0.93)/0.05*0.88;
  return 1;
}

// ---------- Crafting ----------
const RECIPES = [
  // Outils de base (pierre)
  { id:'axe1', name:'Hache en bois', icon:'🪓', cost:{wood:5, stone:2},
    effect:()=>{ tools.axeTier = 1; showMsg('Hache fabriquée !'); }, already:()=>tools.axeTier>=1 },
  { id:'pickaxe1', name:'Pioche en pierre', icon:'⛏️', cost:{wood:5, stone:3},
    effect:()=>{ tools.pickaxeTier = 1; showMsg('Pioche fabriquée !'); }, already:()=>tools.pickaxeTier>=1 },
  { id:'sword1', name:'Épée en bois', icon:'🗡️', cost:{wood:6, stone:1},
    effect:()=>{ tools.swordTier = 1; showMsg('Épée fabriquée !'); }, already:()=>tools.swordTier>=1 },

  // Palier fer (nécessite charbon + fer)
  { id:'pickaxe2', name:'Pioche en fer', icon:'⛏️', cost:{wood:4, iron:4, coal:2},
    effect:()=>{ tools.pickaxeTier = 2; showMsg('Pioche en fer forgée !'); }, already:()=>tools.pickaxeTier>=2 },
  { id:'axe2', name:'Hache en fer', icon:'🪓', cost:{wood:4, iron:3, coal:2},
    effect:()=>{ tools.axeTier = 2; showMsg('Hache en fer forgée !'); }, already:()=>tools.axeTier>=2 },
  { id:'sword2', name:'Épée en fer', icon:'🗡️', cost:{wood:2, iron:5, coal:2},
    effect:()=>{ tools.swordTier = 2; showMsg('Épée en fer forgée !'); }, already:()=>tools.swordTier>=2 },

  // Palier or (arme rapide)
  { id:'sword3', name:'Épée en or', icon:'🗡️', cost:{wood:2, gold:6, coal:2},
    effect:()=>{ tools.swordTier = 3; showMsg('Épée en or forgée !'); }, already:()=>tools.swordTier>=3 },

  // Palier diamant (meilleur du jeu)
  { id:'pickaxe3', name:'Pioche en diamant', icon:'⛏️', cost:{wood:4, diamond:3, iron:2},
    effect:()=>{ tools.pickaxeTier = 3; showMsg('Pioche en diamant forgée !'); }, already:()=>tools.pickaxeTier>=3 },
  { id:'sword4', name:'Épée en diamant', icon:'🗡️', cost:{wood:2, diamond:4, gold:1},
    effect:()=>{ tools.swordTier = 4; showMsg('Épée en diamant forgée !'); }, already:()=>tools.swordTier>=4 },

  { id:'campfire', name:'Feu de camp', icon:'🔥', cost:{wood:8, stone:4}, effect:()=>{ placeCampfire(); } },
  { id:'wall', name:'Mur en bois', icon:'🧱', cost:{wood:10}, effect:()=>{ placeWall(); } },
  { id:'bandage', name:'Bandage (+25 vie)', icon:'💉', cost:{fiber:4, berry:2}, effect:()=>{ player.hp = Math.min(player.maxHp, player.hp+25); showMsg('Vie restaurée.'); } },
];

function canAfford(cost){
  return Object.entries(cost).every(([k,v]) => (inventory[k]||0) >= v);
}
function pay(cost){
  Object.entries(cost).forEach(([k,v]) => inventory[k] -= v);
}
const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));

// Catégories affichées comme chaîne de losanges dans le menu Artisanat
const CRAFT_CATEGORIES = {
  axe:      { label:'Hache',        icon:'🪓', chain:['axe1','axe2'] },
  pickaxe:  { label:'Pioche',       icon:'⛏️', chain:['pickaxe1','pickaxe2','pickaxe3'] },
  sword:    { label:'Épée',         icon:'🗡️', chain:['sword1','sword2','sword3','sword4'] },
  campfire: { label:'Feu de camp',  icon:'🔥', chain:['campfire'], placeable:true },
  wall:     { label:'Mur',          icon:'🧱', chain:['wall'], placeable:true },
  bandage:  { label:'Bandage',      icon:'💉', chain:['bandage'], consumable:true },
};
let selectedCategory = 'axe';
let selectedNodeId = 'axe1';

function selectCraftCategory(key){
  selectedCategory = key;
  const cat = CRAFT_CATEGORIES[key];
  selectedNodeId = cat.chain.find(id => !(RECIPE_BY_ID[id].already && RECIPE_BY_ID[id].already())) || cat.chain[cat.chain.length-1];
  renderCraftCategories();
  renderCraftDetail();
}

function renderCraftCategories(){
  const el = document.getElementById('craftCategories');
  el.innerHTML = '';
  Object.entries(CRAFT_CATEGORIES).forEach(([key, cat]) => {
    const btn = document.createElement('div');
    btn.className = 'craftCatBtn' + (key===selectedCategory ? ' active' : '');
    btn.innerHTML = `<span>${cat.icon}</span> ${cat.label}`;
    btn.onclick = () => selectCraftCategory(key);
    el.appendChild(btn);
  });
}

function renderCraftDetail(){
  const cat = CRAFT_CATEGORIES[selectedCategory];
  const chainEl = document.getElementById('craftChain');
  chainEl.innerHTML = '';
  cat.chain.forEach((id, i) => {
    const r = RECIPE_BY_ID[id];
    const owned = r.already && r.already();
    const node = document.createElement('div');
    node.className = 'tierNode' + (owned ? ' owned' : '') + (id===selectedNodeId ? ' active' : '');
    node.innerHTML = `<span class="icon">${r.icon}</span>`;
    node.onclick = () => { selectedNodeId = id; renderCraftDetail(); };
    chainEl.appendChild(node);
    if (i < cat.chain.length-1){
      const conn = document.createElement('div');
      conn.className = 'tierConnector';
      chainEl.appendChild(conn);
    }
  });

  const r = RECIPE_BY_ID[selectedNodeId] || RECIPE_BY_ID[cat.chain[0]];
  const owned = r.already && r.already();
  const afford = canAfford(r.cost);
  const actionEl = document.getElementById('craftAction');
  const costHtml = Object.entries(r.cost).map(([k,v]) => {
    const have = inventory[k]||0;
    return `<div class="costLine ${have>=v ? 'ok':'bad'}">${ITEM_ICONS[k]||''} ${have}/${v}</div>`;
  }).join('');
  const btnLabel = owned ? '✔ Obtenu' : (cat.placeable ? 'Construire' : (cat.consumable ? 'Utiliser' : 'Fabriquer'));
  actionEl.innerHTML = `
    <div class="craftIconBig">${r.icon}</div>
    <div class="craftName">${r.name}</div>
    <div class="costList">${costHtml}</div>
    <button id="craftActionBtn" ${(!afford||owned)?'disabled':''}>${btnLabel}</button>
  `;
  document.getElementById('craftActionBtn').onclick = () => {
    if (owned || !canAfford(r.cost)) return;
    pay(r.cost);
    r.effect();
    renderHotbar();
    renderInvGrid();
    renderCraftDetail();
  };
}

function placeCampfire(){
  placedCampfires.push({x:player.x, y:player.y - 10, life: 9999});
  showMsg('Feu de camp installé.');
}
let walls = [];
function placeWall(){
  const dx = player.facing==='left'?-30: player.facing==='right'?30:0;
  const dy = player.facing==='up'?-30: player.facing==='down'?30:0;
  walls.push({x:player.x+dx, y:player.y+dy, hp:40});
  showMsg('Mur placé.');
}

const FOOD_HUNGER = { berry: 15, meat: 35 };
function consumeFood(name){
  if (inventory[name] > 0){
    inventory[name]--;
    player.hunger = Math.min(100, player.hunger + FOOD_HUNGER[name]);
    showMsg(name === 'berry' ? 'Miam, +15 faim.' : 'Viande grillée, +35 faim.');
    renderHotbar();
    renderInvGrid();
  } else {
    showMsg("Tu n'as plus de " + (name === 'berry' ? 'baies' : 'viande') + ".");
  }
}

// ---------- Messages ----------
let msgTimeout;
function showMsg(text){
  const el = document.getElementById('msg');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(msgTimeout);
  msgTimeout = setTimeout(()=> el.style.opacity = 0, 2200);
}

// ---------- Souris (déclenche l'interaction, comme le bouton tactile) ----------
let mouse = {down:false};
canvas.addEventListener('mousedown', () => mouse.down = true);
canvas.addEventListener('mouseup', () => mouse.down = false);
canvas.addEventListener('mouseleave', () => mouse.down = false);
canvas.addEventListener('touchstart', e => { mouse.down = true; }, {passive:true});
canvas.addEventListener('touchend', () => mouse.down = false);
canvas.addEventListener('touchcancel', () => mouse.down = false);

// ---------- Joystick virtuel (mobile) ----------
const joystick = { active:false, baseX:0, baseY:0, dx:0, dy:0 };
const joyBase = document.getElementById('joystickBase');
const joyKnob = document.getElementById('joystickKnob');
const JOY_RADIUS = 40;

function joyPointFromEvent(e){
  return e.touches && e.touches.length ? e.touches[0] : e;
}
function joyStart(e){
  e.preventDefault();
  joystick.active = true;
  const rect = joyBase.getBoundingClientRect();
  joystick.baseX = rect.left + rect.width/2;
  joystick.baseY = rect.top + rect.height/2;
  joyMove(e);
}
function joyMove(e){
  if (!joystick.active) return;
  e.preventDefault();
  const pt = joyPointFromEvent(e);
  let dx = pt.clientX - joystick.baseX;
  let dy = pt.clientY - joystick.baseY;
  const d = Math.hypot(dx, dy);
  if (d > JOY_RADIUS){ dx = dx/d*JOY_RADIUS; dy = dy/d*JOY_RADIUS; }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joystick.dx = dx / JOY_RADIUS;
  joystick.dy = dy / JOY_RADIUS;
}
function joyEnd(){
  joystick.active = false;
  joystick.dx = 0; joystick.dy = 0;
  joyKnob.style.transform = 'translate(0,0)';
}
joyBase.addEventListener('touchstart', joyStart, {passive:false});
joyBase.addEventListener('touchmove', joyMove, {passive:false});
joyBase.addEventListener('touchend', joyEnd);
joyBase.addEventListener('touchcancel', joyEnd);
// Le joystick fonctionne aussi à la souris pour tester sur ordinateur
joyBase.addEventListener('mousedown', joyStart);
window.addEventListener('mousemove', e => { if (joystick.active) joyMove(e); });
window.addEventListener('mouseup', () => { if (joystick.active) joyEnd(); });

// ---------- Bouton d'action tactile (récolter/interagir) ----------
const actionBtn = document.getElementById('actionBtn');
actionBtn.addEventListener('touchstart', e => { e.preventDefault(); mouse.down = true; }, {passive:false});
actionBtn.addEventListener('touchend', e => { e.preventDefault(); mouse.down = false; });
actionBtn.addEventListener('mousedown', () => mouse.down = true);
actionBtn.addEventListener('mouseup', () => mouse.down = false);
actionBtn.addEventListener('mouseleave', () => mouse.down = false);

// Affiche les contrôles tactiles si l'appareil supporte le toucher
if (('ontouchstart' in window) || navigator.maxTouchPoints > 0){
  document.body.classList.add('is-touch');
}

// Calcule le vecteur de déplacement : joystick prioritaire s'il est actif, sinon clavier
function getMoveVector(){
  if (joystick.active && (Math.abs(joystick.dx) > 0.08 || Math.abs(joystick.dy) > 0.08)){
    let dx = joystick.dx, dy = joystick.dy;
    const len = Math.hypot(dx, dy);
    if (len > 1){ dx/=len; dy/=len; }
    return { dx, dy };
  }
  let dx=0, dy=0;
  if (keys['q'] || keys['arrowleft']) dx-=1;
  if (keys['d'] || keys['arrowright']) dx+=1;
  if (keys['z'] || keys['arrowup']) dy-=1;
  if (keys['s'] || keys['arrowdown']) dy+=1;
  const len = Math.hypot(dx,dy);
  if (len>0){ dx/=len; dy/=len; }
  return { dx, dy };
}

// ---------- Update ----------
function updatePlayer(dtSec){
  if (player.dead) return;
  const { dx, dy } = getMoveVector();
  const len = Math.hypot(dx,dy);
  if (len > 0.08){
    player.x += dx*player.speed*dtSec;
    player.y += dy*player.speed*dtSec;
    player.x = Math.max(20, Math.min(WORLD_W-20, player.x));
    player.y = Math.max(20, Math.min(WORLD_H-20, player.y));
    if (Math.abs(dx) > Math.abs(dy)) player.facing = dx < 0 ? 'left' : 'right';
    else player.facing = dy < 0 ? 'up' : 'down';
  }

  // faim : perte totale en ~12 minutes de jeu
  player.hunger = Math.max(0, player.hunger - (100/720)*dtSec);
  if (player.hunger <= 0){
    player.hp = Math.max(0, player.hp - 1.2*dtSec);
  }

  // le feu de camp soigne lentement à proximité
  placedCampfires.forEach(cf => {
    if (dist(player, cf) < 60){
      player.hp = Math.min(player.maxHp, player.hp + 1.5*dtSec);
    }
  });

  if (player.attackCooldown > 0) player.attackCooldown -= dtSec*1000;

  if (mouse.down && player.attackCooldown <= 0){
    tryInteract();
    player.attackCooldown = 220;
  }

  if (player.hp <= 0 && !player.dead){
    player.dead = true;
    document.getElementById('goStats').textContent = `Tu as survécu ${dayCount} jour(s).`;
    document.getElementById('gameover').style.display = 'flex';
  }
}

function tryInteract(){
  // récolte la ressource la plus proche du joueur (fonctionne au clic comme au doigt)
  let res = null, minD = 60;
  resources.forEach(r => {
    const d = dist(r, player);
    if (d < minD){ minD = d; res = r; }
  });
  if (res){
    gatherResource(res);
  }
}

function gatherResource(res){
  let amount = 1;
  if (res.type === 'tree'){
    amount = tools.axeTier >= 2 ? 3 : (tools.axeTier >= 1 ? 2 : 1);
    res.hp--;
    res.wobble = 6;
    if (res.hp <= 0){
      addItem('wood', amount + 1);
      respawnResource(res, 'tree', 25000);
    } else {
      addItem('wood', amount);
    }
  } else if (res.type === 'rock'){
    if (tools.pickaxeTier < 1) { showMsg('Il faut une pioche pour miner la pierre.'); return; }
    amount = tools.pickaxeTier >= 2 ? 3 : 2;
    res.hp--;
    res.wobble = 6;
    if (res.hp <= 0){
      addItem('stone', amount + 1);
      respawnResource(res, 'rock', 30000);
    } else {
      addItem('stone', amount);
    }
  } else if (res.type === 'ore'){
    const data = ORES[res.ore];
    if (tools.pickaxeTier < data.reqTier){
      showMsg(`Il faut une pioche de meilleure qualité pour miner le ${data.name.toLowerCase()}.`);
      return;
    }
    amount = tools.pickaxeTier >= data.reqTier + 1 ? 2 : 1;
    res.hp--;
    res.wobble = 6;
    if (res.hp <= 0){
      addItem(res.ore, amount + 1);
      showMsg(`${data.name} obtenu !`);
      respawnOre(res);
    } else {
      addItem(res.ore, amount);
    }
  } else if (res.type === 'bush'){
    if (res.berries){
      addItem('berry', 2);
      res.berries = false;
      setTimeout(()=> res.berries = true, 15000);
    } else {
      showMsg('Pas de baies pour le moment.');
    }
  } else if (res.type === 'grass'){
    addItem('fiber', 1);
    respawnResource(res, 'grass', 8000);
  }
}

function respawnResource(res, type, delay){
  resources = resources.filter(r => r !== res);
  setTimeout(() => {
    resources.push({
      type, x: res.x, y: res.y, r: res.r,
      hp: type==='tree'?3:4, wobble:0
    });
  }, delay);
}

function respawnOre(res){
  const ore = res.ore;
  resources = resources.filter(r => r !== res);
  const delay = { coal:20000, copper:25000, iron:35000, gold:50000, diamond:70000 }[ore];
  setTimeout(() => {
    resources.push({
      type:'ore', ore, x: res.x, y: res.y, r: res.r,
      hp: ORES[ore].hp, wobble:0
    });
  }, delay);
}

function updateEnemies(dt){
  enemies.forEach(en => {
    const d = dist(en, player);
    // Les ennemis poursuivent TOUJOURS le joueur pendant la nuit (avant: ne bougeaient
    // que si le joueur était à moins de 300px, ce qui les laissait figés au loin).
    let ang;
    if (d < 900){
      ang = Math.atan2(player.y-en.y, player.x-en.x);
    } else {
      // trop loin : erre lentement dans une direction aléatoire pour se rapprocher naturellement
      en.wanderTimer -= dt;
      if (en.wanderTimer <= 0){
        en.wanderAngle = Math.atan2(player.y-en.y, player.x-en.x) + rand(-0.6,0.6);
        en.wanderTimer = 1000;
      }
      ang = en.wanderAngle;
    }
    en.x += Math.cos(ang)*en.speed*dt/16.6;
    en.y += Math.sin(ang)*en.speed*dt/16.6;
    en.x = Math.max(10, Math.min(WORLD_W-10, en.x));
    en.y = Math.max(10, Math.min(WORLD_H-10, en.y));

    if (en.dmgCooldown > 0) en.dmgCooldown -= dt;
    if (d < 26 && en.dmgCooldown <= 0 && !player.dead){
      player.hp -= 8;
      en.dmgCooldown = 900;
    }
  });
}

// ---------- Draw ----------
function drawBackground(){
  ctx.fillStyle = '#3a7d3a';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  const gridSize = 64;
  const offX = -camera.x % gridSize;
  const offY = -camera.y % gridSize;
  for (let x = offX; x < W; x += gridSize){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  for (let y = offY; y < H; y += gridSize){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
}

function toScreen(x,y){ return { x: x - camera.x, y: y - camera.y }; }

function drawResources(){
  resources.forEach(r => {
    const p = toScreen(r.x, r.y);
    if (p.x < -50 || p.x > W+50 || p.y < -50 || p.y > H+50) return;
    if (r.type === 'tree'){
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(p.x-4, p.y-4, 8, 20);
      ctx.fillStyle = '#2d6b2d';
      ctx.beginPath();
      ctx.arc(p.x, p.y-18, 20, 0, Math.PI*2);
      ctx.fill();
    } else if (r.type === 'rock'){
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 16, 12, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.ellipse(p.x-4, p.y-3, 6, 4, 0, 0, Math.PI*2);
      ctx.fill();
    } else if (r.type === 'bush'){
      ctx.fillStyle = r.berries ? '#3a7d2a' : '#2a5a1a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI*2);
      ctx.fill();
      if (r.berries){
        ctx.fillStyle = '#c0203a';
        for (let i=0;i<3;i++){
          ctx.beginPath();
          ctx.arc(p.x-5+i*5, p.y-2+((i%2)*4), 2.5, 0, Math.PI*2);
          ctx.fill();
        }
      }
    } else if (r.type === 'grass'){
      ctx.strokeStyle = '#8fce6a';
      ctx.lineWidth = 2;
      for (let i=-1;i<=1;i++){
        ctx.beginPath();
        ctx.moveTo(p.x+i*4, p.y+8);
        ctx.lineTo(p.x+i*6, p.y-6);
        ctx.stroke();
      }
    } else if (r.type === 'ore'){
      const data = ORES[r.ore];
      ctx.fillStyle = data.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 17, 13, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.stroke();
      ctx.fillStyle = data.dot;
      const spots = [[-5,-2],[4,3],[-2,4],[6,-3]];
      spots.forEach(([ox,oy]) => {
        ctx.beginPath();
        ctx.arc(p.x+ox, p.y+oy, 3.4, 0, Math.PI*2);
        ctx.fill();
      });
      if (tools.pickaxeTier < data.reqTier){
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', p.x, p.y-20);
      }
    }
  });
}

function drawCampfires(){
  placedCampfires.forEach(cf => {
    const p = toScreen(cf.x, cf.y);
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(p.x-10, p.y+4, 20, 6);
    const flick = 10 + Math.sin(Date.now()/100)*3;
    const grad = ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,flick+6);
    grad.addColorStop(0,'rgba(255,200,80,0.9)');
    grad.addColorStop(1,'rgba(255,120,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x,p.y,flick+6,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(p.x, p.y, flick*0.5, 0, Math.PI*2);
    ctx.fill();
  });
}

function drawWalls(){
  walls.forEach(w => {
    const p = toScreen(w.x, w.y);
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(p.x-14, p.y-14, 28, 28);
    ctx.strokeStyle = '#5a3a15';
    ctx.strokeRect(p.x-14, p.y-14, 28, 28);
  });
}

function drawEnemies(){
  enemies.forEach(en => {
    const p = toScreen(en.x, en.y);
    ctx.fillStyle = '#7a1f8a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, en.r, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(p.x-4, p.y-3, 2, 0, Math.PI*2);
    ctx.arc(p.x+4, p.y-3, 2, 0, Math.PI*2);
    ctx.fill();
    // hp bar
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x-16, p.y-en.r-10, 32, 4);
    ctx.fillStyle = '#e33';
    ctx.fillRect(p.x-16, p.y-en.r-10, 32*(en.hp/en.maxHp), 4);
  });
}

function drawPlayer(){
  const p = toScreen(player.x, player.y);
  // Corps (haut)
  ctx.fillStyle = character.shirt;
  ctx.fillRect(p.x-10, p.y-2, 20, 14);
  // Tête
  ctx.fillStyle = character.skin;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12, 0, Math.PI*2);
  ctx.fill();
  // Cheveux
  ctx.fillStyle = character.hair;
  ctx.beginPath();
  ctx.arc(p.x, p.y-5, 11, Math.PI, Math.PI*2);
  ctx.fill();
  // direction indicator
  ctx.fillStyle = '#222';
  let ix=0, iy=0;
  if (player.facing==='up') iy=-14;
  if (player.facing==='down') iy=14;
  if (player.facing==='left') ix=-14;
  if (player.facing==='right') ix=14;
  ctx.beginPath();
  ctx.arc(p.x+ix*0.6, p.y+iy*0.6, 3, 0, Math.PI*2);
  ctx.fill();

  if (tools.axeTier > 0 || tools.pickaxeTier > 0 || tools.swordTier > 0){
    ctx.fillStyle = '#ccc';
    ctx.fillRect(p.x+10, p.y-4, 4, 14);
  }
}

function drawLighting(){
  const lvl = lightLevel();
  if (lvl < 1){
    ctx.fillStyle = `rgba(5,5,25,${(1-lvl)*0.82})`;
    ctx.fillRect(0,0,W,H);
    // light around player
    const p = toScreen(player.x, player.y);
    const grad = ctx.createRadialGradient(p.x,p.y,20,p.x,p.y,180);
    grad.addColorStop(0,`rgba(255,240,200,${(1-lvl)*0.5})`);
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(p.x-180,p.y-180,360,360);
    ctx.globalCompositeOperation = 'source-over';

    placedCampfires.forEach(cf => {
      const cp = toScreen(cf.x, cf.y);
      const g2 = ctx.createRadialGradient(cp.x,cp.y,10,cp.x,cp.y,140);
      g2.addColorStop(0,`rgba(255,180,80,${(1-lvl)*0.6})`);
      g2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g2;
      ctx.fillRect(cp.x-140,cp.y-140,280,280);
      ctx.globalCompositeOperation = 'source-over';
    });
  }
}

// ---------- HUD update ----------
function updateHUD(){
  document.getElementById('hpFill').style.width = player.hp+'%';
  document.getElementById('hpTxt').textContent = Math.round(player.hp);
  document.getElementById('hungerFill').style.width = player.hunger+'%';
  document.getElementById('hungerTxt').textContent = Math.round(player.hunger);
  document.getElementById('dayIcon').textContent = isNight ? '🌙' : '☀️';
}

// ---------- Création de personnage ----------
const character = { skin:'#e8b877', hair:'#3a2a1a', shirt:'#2255aa' };
const SKIN_COLORS = ['#f4d0a8','#e8b877','#d9a066','#c1793f','#8a5a2e','#6b4423','#e8e8e8'];
const HAIR_COLORS = ['#3a2a1a','#5a3a1a','#8a5a2e','#1a1a1a','#7a7a7a','#e8e8e8','#c07a2a'];
const SHIRT_COLORS = ['#2255aa','#aa2233','#2a8a4a','#8a3aaa','#aa7a1a','#333333','#1aa0a0'];

function renderSwatches(containerId, colors, key){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  colors.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (character[key]===color ? ' selected' : '');
    sw.style.background = color;
    sw.onclick = () => {
      character[key] = color;
      renderSwatches(containerId, colors, key);
      drawCharPreview();
    };
    el.appendChild(sw);
  });
}

const ccCanvas = document.getElementById('ccCanvas');
const ccCtx = ccCanvas.getContext('2d');
function drawCharPreview(){
  ccCtx.clearRect(0,0,ccCanvas.width,ccCanvas.height);
  const cx = ccCanvas.width/2, cy = 120;
  // corps
  ccCtx.fillStyle = character.shirt;
  ccCtx.fillRect(cx-30, cy+10, 60, 90);
  // bras
  ccCtx.fillStyle = character.skin;
  ccCtx.fillRect(cx-46, cy+16, 16, 60);
  ccCtx.fillRect(cx+30, cy+16, 16, 60);
  // jambes
  ccCtx.fillStyle = '#3a2a1a';
  ccCtx.fillRect(cx-24, cy+96, 20, 60);
  ccCtx.fillRect(cx+4, cy+96, 20, 60);
  // tête
  ccCtx.fillStyle = character.skin;
  ccCtx.beginPath();
  ccCtx.arc(cx, cy-20, 34, 0, Math.PI*2);
  ccCtx.fill();
  // cheveux
  ccCtx.fillStyle = character.hair;
  ccCtx.beginPath();
  ccCtx.arc(cx, cy-30, 32, Math.PI, Math.PI*2);
  ccCtx.fill();
}

renderSwatches('skinSwatches', SKIN_COLORS, 'skin');
renderSwatches('hairSwatches', HAIR_COLORS, 'hair');
renderSwatches('shirtSwatches', SHIRT_COLORS, 'shirt');
drawCharPreview();

// ---------- Menu de démarrage ----------
let gameStarted = false;
document.getElementById('playBtn').addEventListener('click', () => {
  document.getElementById('startMenu').style.display = 'none';
  document.getElementById('charCreate').classList.remove('hidden');
  drawCharPreview();
});
document.getElementById('spawnBtn').addEventListener('click', () => {
  document.getElementById('charCreate').classList.add('hidden');
  gameStarted = true;
  last = performance.now(); // évite un grand saut de temps au premier frame
  // Sur mobile, on tente automatiquement le plein écran + paysage pour plus de confort
  if (document.body.classList.contains('is-touch')) enterFullscreen();
});
document.getElementById('rulesBtn').addEventListener('click', () => toggleModal('rulesModal', true));
document.getElementById('closeRules').addEventListener('click', () => toggleModal('rulesModal', false));

// ---------- Plein écran ----------
function enterFullscreen(){
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req){ req.call(el).catch(() => {}); }
  if (screen.orientation && screen.orientation.lock){
    screen.orientation.lock('landscape').catch(() => {});
  }
}
function exitFullscreenMode(){
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (exit) exit.call(document).catch(() => {});
}
document.getElementById('fullscreenBtn').addEventListener('click', () => {
  if (!document.fullscreenElement) enterFullscreen();
  else exitFullscreenMode();
});
document.addEventListener('fullscreenchange', () => {
  document.getElementById('fullscreenBtn').textContent = document.fullscreenElement ? '⛝' : '⛶';
});

// ---------- Main loop ----------
let last = performance.now();
let craftRefreshTimer = 0;
function loop(now){
  const dt = Math.min(50, now - last);
  last = now;
  const dtSec = dt/1000;

  if (gameStarted && !player.dead){
    updatePlayer(dtSec);
    updateEnemies(dtSec);
    updateDayNight(dtSec);
  }

  camera.x = Math.max(0, Math.min(WORLD_W - W, player.x - W/2));
  camera.y = Math.max(0, Math.min(WORLD_H - H, player.y - H/2));

  drawBackground();
  drawWalls();
  drawResources();
  drawCampfires();
  drawEnemies();
  drawPlayer();
  drawLighting();
  updateHUD();

  if (gameStarted){
    craftRefreshTimer += dt;
    if (craftRefreshTimer > 400){
      if (!document.getElementById('craftModal').classList.contains('hidden')) renderCraftDetail();
      if (!document.getElementById('invModal').classList.contains('hidden')) renderInvGrid();
      craftRefreshTimer = 0;
    }
  }

  requestAnimationFrame(loop);
}
renderHotbar();
renderInvGrid();
renderCraftCategories();
requestAnimationFrame(loop);
