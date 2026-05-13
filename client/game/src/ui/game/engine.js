import { ChatManager } from './chat.js?v=voxel-builder-33';
import { NetworkManager } from './network.js?v=voxel-builder-33';
import { UIManager } from './ui.js?v=voxel-builder-33';
import { InputManager } from './input.js?v=voxel-builder-33';
import { MinimapManager } from './minimap.js?v=voxel-builder-33';
import { Renderer } from './renderer.js?v=voxel-builder-33';
import { CombatManager } from './combat.js?v=voxel-builder-33';
import { EntityManager } from './entity_manager.js?v=voxel-builder-33';
import { MapOverlayManager } from './map_overlay.js?v=voxel-builder-33';

export class GameEngine {
  constructor(canvasId, playerData, accountUuid) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.playerData = playerData;
    this.accountUuid = accountUuid;

        this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

            if (!this.playerData.powersets) this.playerData.powersets = [];
    if (!this.playerData.powersets.includes('Inherited') && !this.playerData.powersets.includes('inherited')) {
      this.playerData.powersets.push('Inherited');
    }
    if (!this.playerData.powers) this.playerData.powers = [];
    if (!this.playerData.powers.includes('Brawl')) {
      this.playerData.powers.push('Brawl');
    }
    const knifeIdx = this.playerData.powers.indexOf('Throw Knife');
    if (knifeIdx !== -1) {
      this.playerData.powers[knifeIdx] = 'Throw Airplane';
    }
    if (!this.playerData.powers.includes('Throw Airplane')) {
      this.playerData.powers.push('Throw Airplane');
    }

    const savedSettingsStr = localStorage.getItem('b_client_settings');
    const defaultSettings = { showCoords: false, showFPS: false, showPing: false, showBaseplates: false, cameraFollowsJump: true, showMinimap: true, clickToMove: false, alwaysSprint: false, showPlayerNames: true, showPlayerHealth: true, showEntityNames: true, showEntityHealth: true };
    this.clientSettings = savedSettingsStr ? Object.assign({}, defaultSettings, JSON.parse(savedSettingsStr)) : defaultSettings;
    this.tilt = 0.5;
    this.selectedTarget = null;
    this.selectedTiles = [];
    this.isDraggingSelection = false;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isDraggingElevation = false;
    this.elevationStartY = 0;
    this.elevationOriginalZ = {};
    this.mapData = {};
    this.powersetsData = {};
    this.permissions = {};
    this.noclip = false;
    
    this.fps = 0;
    this.framesThisSecond = 0;
    this.lastFpsTime = performance.now();
    this.ping = 0;

    let startX = this.playerData.position ? this.playerData.position.x : 0;
    let startY = this.playerData.position ? this.playerData.position.y : 0;

    if (this.playerData.name && this.playerData.name.toLowerCase() === 'tim') {
      startX = 0;
      startY = 0;
      console.log("Welcome back, Tim. Spawning at absolute zero.");
    }

    this.player = {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      speed: 180,
      runSpeed: 405,
      dir: 'down',
      state: 'idle',
      frame: 0,
      frameTimer: 0,
      frameInterval: 120,
      actionTimer: 0,
      wasPressingShift: false,
      wasPressingSpace: false,
      nextAttack: 1,
      moveTarget: null,
      hurtTimer: 0,
      respawnTimer: 0,
      hp: (this.playerData.stats && this.playerData.stats.hp > 10) ? this.playerData.stats.hp : 1000,
      maxHp: 1000,
      energy: (this.playerData.stats && (this.playerData.stats.energy > 10 || this.playerData.stats.mp > 10)) ? (this.playerData.stats.energy || this.playerData.stats.mp) : 1000,
      maxEnergy: 1000
    };
    this.screenFade = 0;
    this.lastEmit = { x: this.player.x, y: this.player.y, state: this.player.state, dir: this.player.dir, hp: this.player.hp };

    this.camera = {
      x: this.player.x,
      y: this.player.y,
      z: 0
    };
    
    this.npcs = [];
    this.projectiles = [];
    this.particles = [];

        this.input = new InputManager(this);
    this.keys = this.input.keys;
    this.mousePos = this.input.mousePos;

    this.handleResize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };

        window.addEventListener('resize', this.handleResize);

        const defaultDev = { showPlayerPos: false, showPlayerTile: false, showEntityPos: false, showEntityTile: false, showMousePos: false, showMelee: false, showLoS: false, showHitboxes: false, showTile: false, showChunk: false, showDistToNPC: false, showDistNpcToMouse: false, showDistPlayerToMouse: false, losDistance: 400, losAngle: 60 };
    const savedDev = localStorage.getItem('b_dev_options');
    this.devOptions = savedDev ? Object.assign({}, defaultDev, JSON.parse(savedDev)) : defaultDev;
    this.editMode = false;

    this.floatingTexts = [];

        this.otherPlayers = {};

    this.network = new NetworkManager(this);
    this.socket = this.network.socket;
    this.chat = new ChatManager(this);
    this.ui = new UIManager(this);
    this.minimap = new MinimapManager(this);
    this.renderer = new Renderer(this);
    this.combat = new CombatManager(this);
    this.entityManager = new EntityManager(this);
    this.mapOverlay = new MapOverlayManager(this);

    this.loadPowersets();

    console.log("Game Engine successfully booted!", this.playerData);
    this.ui.update();

    this.socket.emit('join_game', {
      name: this.playerData.name,
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      state: this.player.state,
      dir: this.player.dir,
      level: this.playerData.level || 1
    });

    this.syncTimer = setInterval(() => {
      if (this.socket && this.socket.connected && this.accountUuid) {
        this.socket.emit('sync_character', {
          uuid: this.accountUuid,
          charData: this.playerData,
          position: { x: this.player.x, y: this.player.y }
        });
      }
    }, 10000);

    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.reqId = requestAnimationFrame(this.loop);
  }

  async loadPowersets() {
        try {
      const res = await fetch('/api/powersets');
            if (res.ok) {
                const json = await res.json();
        for (const [catKey, powersetsList] of Object.entries(json)) {
          powersetsList.forEach(ps => {
                        const id = ps.Id || ps.id;
                        if (id && !this.powersetsData[id]) {
                            this.powersetsData[id] = {
                                id: id,
                                name: ps.Name || ps.name,
                category: catKey,
                                powers: (ps.Powers || ps.powers || []).map((p, i) => ({ id: p.Id || p.id || `${id}-p${i+1}`, name: p.Name || p.name || `Power ${i+1}`, desc: p.Description || p.desc || p.Focus || '' }))
                            };
                        }
                    });
        }
            }
        } catch (e) {
      console.warn('Failed to load powersets from API:', e);
        }
  }

  getScreenPos(wx, wy, wz = 0) {
    const sx = (wx - wy) - (this.camera.x - this.camera.y);
    const sy = (wx + wy) * this.tilt - (this.camera.x + this.camera.y) * this.tilt;
    let centerX = this.canvas.width / 2;
    let centerY = this.canvas.height / 2;
    
    if (this.mapOverlay && this.mapOverlay.active) {
       const mmSize = 250;
       centerX = this.canvas.width - mmSize / 2 - 20;
       centerY = 70 + mmSize / 2;
    }

    return {
      x: Math.round(sx + centerX),
      y: Math.round(sy - wz + (this.camera.z || 0) + centerY)
    };
  }

  getIsoRaycast(clientX, clientY) {
    let centerX = this.canvas.width / 2;
    let centerY = this.canvas.height / 2;
    
    if (this.mapOverlay && this.mapOverlay.active) {
       const mmSize = 250;
       centerX = this.canvas.width - mmSize / 2 - 20;
       centerY = 70 + mmSize / 2;
    }

    const sx = clientX - centerX;
    const sy = clientY - centerY - (this.camera.z || 0);
    
    let hitGx = 0, hitGy = 0, hitZ = 0;
    
    for (let z = 15; z >= 0; z--) {
      const virtualSy = sy + (z * 32);
      const A = sx + this.camera.x - this.camera.y;
      const B = (virtualSy / this.tilt) + this.camera.x + this.camera.y;
      const gx = Math.round(((A + B) / 2) / 32);
      const gy = Math.round(((B - A) / 2) / 32);
      
      if (z === 0) {
        hitGx = gx; hitGy = gy; hitZ = 0;
        break;
      } else {
        const td = this.mapData[`${gx},${gy}`];
        const blockZ = (td && td.z) ? td.z : 0;
        if (blockZ >= z) {
          hitGx = gx; hitGy = gy; hitZ = blockZ;
          break;
        }
      }
    }
    
    const finalSy = sy + (hitZ * 32);
    const finalA = sx + this.camera.x - this.camera.y;
    const finalB = (finalSy / this.tilt) + this.camera.x + this.camera.y;
    const exactX = (finalA + finalB) / 2;
    const exactY = (finalB - finalA) / 2;

    return { gx: hitGx, gy: hitGy, z: hitZ, exactX, exactY };
  }

  updateSelectionArea() {
    this.selectedTiles = [];
    if (!this.selectionStart || !this.selectionEnd) return;
    
    const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);
    
    if ((maxX - minX) * (maxY - minY) > 2500) return;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        this.selectedTiles.push({ x, y });
      }
    }
  }

  stop() {
    if (this.reqId) cancelAnimationFrame(this.reqId);
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.network) this.network.disconnect();
    if (this.input) this.input.disconnect();
    if (this.mapOverlay) this.mapOverlay.disconnect();
    window.removeEventListener('resize', this.handleResize);
    if (this.chatDropdownListener) document.removeEventListener('click', this.chatDropdownListener);
  }

  playSound(path, volume = 1.0) {
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch(e => console.warn('Audio play failed:', e));
  }

    getTerrainZ(x, y) {
    const gx = Math.round(x / 32);
    const gy = Math.round(y / 32);
    const tile = this.mapData[`${gx},${gy}`];
    return (tile && tile.z) ? tile.z * 32 : 0;
  }

  checkCollision(nextX, nextY) {
    if (this.noclip) return false;

    const radius = 14;
    const corners = [
      { dx: -radius, dy: -radius },
      { dx: radius, dy: -radius },
      { dx: -radius, dy: radius },
      { dx: radius, dy: radius }
    ];

    for (let c of corners) {
      const currZ = this.getTerrainZ(this.player.x + c.dx, this.player.y + c.dy);
      const nextZ = this.getTerrainZ(nextX + c.dx, nextY + c.dy);
      if (nextZ > currZ && nextZ > (this.player.z || 0)) return true;
    }

    for (let npc of this.npcs) {
      if (npc.state !== 'dead' && Math.hypot(npc.x - nextX, npc.y - nextY) < 55) return true;
    }
    for (let id in this.otherPlayers) {
      const op = this.otherPlayers[id];
      if (op.state !== 'death' && Math.hypot(op.x - nextX, op.y - nextY) < 55) return true;
    }
    return false;
  }

  applyGravity(entity, dt) {
    const targetZ = this.getTerrainZ(entity.x, entity.y);
    if (entity.z === undefined) entity.z = targetZ;
    if (entity.vz === undefined) entity.vz = 0;

    if (entity.z > targetZ || entity.vz > 0) {
      entity.vz -= 2000 * (dt / 1000);
      entity.z += entity.vz * (dt / 1000);
    }

    if (entity.z <= targetZ) {
      entity.z = targetZ;
      entity.vz = 0;
    }
  }



  update(dt) {
    this.framesThisSecond++;
    if (performance.now() - this.lastFpsTime >= 1000) {
      this.fps = this.framesThisSecond;
      this.framesThisSecond = 0;
      this.lastFpsTime = performance.now();
    }
    
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      let ft = this.floatingTexts[i];
      ft.life -= dt / 1000;
      ft.offsetY += 40 * (dt / 1000);
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.life -= dt / 1000;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.entityManager.update(dt);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      let proj = this.projectiles[i];
      let distToMove = proj.speed * (dt / 1000);
      proj.distTravelled += distToMove;
      if (proj.distTravelled >= proj.maxDist) {
        if (proj.onHit) proj.onHit();
        this.projectiles.splice(i, 1);
      } else {
        let ratio = proj.distTravelled / proj.maxDist;
        proj.x = proj.startX + (proj.targetX - proj.startX) * ratio;
        proj.y = proj.startY + (proj.targetY - proj.startY) * ratio;
        proj.z = proj.startZ + (proj.targetZ - proj.startZ) * ratio;

        if (proj.trail) {
          const particleCount = Math.random() > 0.5 ? 2 : 1;
          for (let pIdx = 0; pIdx < particleCount; pIdx++) {
            this.particles.push({
              x: proj.x + (Math.random() - 0.5) * 8,
              y: proj.y + (Math.random() - 0.5) * 8,
              z: proj.z + (Math.random() - 0.5) * 8,
              life: 0.3 + Math.random() * 0.2,
              maxLife: 0.5,
              color: proj.trailColor || 'rgba(255, 255, 255, 0.8)',
              size: proj.trailSize || 2
            });
          }
        }
      }
    }

    if (
      Math.abs(this.player.x - this.lastEmit.x) > 1 || 
      Math.abs(this.player.y - this.lastEmit.y) > 1 || 
      Math.abs(this.player.hp - this.lastEmit.hp) >= 1 || 
      this.player.state !== this.lastEmit.state || 
      this.player.dir !== this.lastEmit.dir
    ) {
      this.socket.emit('player_moved', {
        x: this.player.x, y: this.player.y,
        state: this.player.state, dir: this.player.dir,
        hp: this.player.hp
      });
      this.lastEmit = { x: this.player.x, y: this.player.y, state: this.player.state, dir: this.player.dir, hp: this.player.hp };
    }

    this.applyGravity(this.player, dt);
    Object.values(this.otherPlayers).forEach(op => {
      if (op.state === 'jump' && op.prevState !== 'jump') op.vz = 450;
      op.prevState = op.state;
      this.applyGravity(op, dt);
    });
    this.npcs.forEach(npc => this.applyGravity(npc, dt));

    this.camera.x += (this.player.x - this.camera.x) * 0.005 * dt;
    this.camera.y += (this.player.y - this.camera.y) * 0.005 * dt;

    const targetCamZ = this.clientSettings.cameraFollowsJump ? (this.player.z || 0) : 0;
    this.camera.z = this.camera.z || 0;
    this.camera.z += (targetCamZ - this.camera.z) * 0.02 * dt;
  }

  loop(time) {
    let dt = time - this.lastTime;
    if (isNaN(dt) || dt <= 0) dt = 16;
    if (dt > 100) dt = 16;
    this.lastTime = time;
    this.update(dt);
    
    if (this.mapOverlay && this.mapOverlay.active) {
      this.mapOverlay.draw(this.ctx);
    }
    
    this.renderer.draw();
    
    if (this.mapOverlay && this.mapOverlay.active) {
      this.mapOverlay.drawBorder(this.ctx);
    }
    
    this.reqId = requestAnimationFrame(this.loop);
  }
}
