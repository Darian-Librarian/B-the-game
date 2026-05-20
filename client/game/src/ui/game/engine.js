//yeah we're not gonna talk about that version number
import { ChatManager } from './chat.js?v=new-engine-240';
import { NetworkManager } from './network.js?v=new-engine-240';
import { UIManager } from './ui.js?v=new-engine-240';
import { InputManager } from './input.js?v=new-engine-240';
import { MinimapManager } from './minimap.js?v=new-engine-240';
import { Renderer } from './renderer.js?v=new-engine-240';
import { CombatManager } from './combat.js?v=new-engine-240';
import { EntityManager } from './entity_manager.js?v=new-engine-240';
import { MapOverlayManager } from './map_overlay.js?v=new-engine-240';
import { MapManager } from './chunk_manager.js?v=new-engine-240';
import { getBlockProps } from './blocks.js?v=new-engine-240';

export class GameEngine {
  constructor(canvasId, playerData, accountUuid) {
    this.canvas = document.getElementById(canvasId);
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
    const airplaneIdx = this.playerData.powers.indexOf('Throw Airplane');
    if (airplaneIdx !== -1) {
      this.playerData.powers[airplaneIdx] = 'Throw Airplane';
    }
    if (!this.playerData.powers.includes('Throw Airplane')) {
      this.playerData.powers.push('Throw Airplane');
    }

    const savedSettingsStr = localStorage.getItem('b_client_settings');
    const defaultSettings = { showCoords: false, showFPS: false, showPing: false, showBaseplates: false, cameraFollowsJump: true, showMinimap: true, rotateMinimap: true, clickToMove: false, alwaysSprint: false, showPlayerNames: true, showPlayerHealth: true, showEntityNames: true, showEntityHealth: true, invertCameraRotation: false, middleMouseRotation: true, dragRotationSensitivity: 0.25, lockBuilderPanel: false, keybinds: { undo: 'z', redo: 'y', picker: '' } };
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

    const maxMapSize = 128 * 32;
    const mapCenter = maxMapSize / 2;

    let startX = this.playerData.position?.x;
    let startY = this.playerData.position?.y;

    if (startX === undefined || (startX === 0 && startY === 0)) {
      startX = mapCenter;
      startY = mapCenter;
    }

    startX = Math.max(0, Math.min(startX, maxMapSize));
    startY = Math.max(0, Math.min(startY, maxMapSize));

    if (this.playerData.name && this.playerData.name.toLowerCase() === 'tim') {
      startX = mapCenter;
      startY = mapCenter;
      console.log("Welcome back, Tim. Spawning at map center.");
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
      momentumX: 0,
      momentumY: 0,
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
    this.debris = [];

        this.input = new InputManager(this);
    this.keys = this.input.keys;
    this.mousePos = this.input.mousePos;

    this.handleResize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };

        window.addEventListener('resize', this.handleResize);

        const defaultDev = { showPlayerPos: false, showPlayerTile: false, showEntityPos: false, showEntityTile: false, showMousePos: false, showMelee: false, showLoS: false, showHitboxes: false, showTile: false, showChunk: false, showDistToNPC: false, showDistNpcToMouse: false, showDistPlayerToMouse: false, losDistance: 400, losAngle: 60, useDebugTooltip: false, useBlockPreview: true };
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
    this.mapManager = new MapManager(this);

    this.loadPowersets();

    console.log("Game Engine successfully booted!", this.playerData);
    this.ui.update();

    this.mapManager.loadFullMap();

    this.network.sendJoinGame({
      name: this.playerData.name,
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      state: this.player.state,
      dir: this.player.dir,
      level: this.playerData.level || 1,
      alignment: this.playerData.alignment || 'hero',
      race: this.playerData.race || 'Human',
      integrity: this.playerData.integrity || 0
    });

    this.syncTimer = setInterval(() => {
      if (this.socket && this.socket.connected && this.accountUuid) {
        this.network.sendPlayerSync(this.accountUuid, this.playerData, { x: this.player.x, y: this.player.y });
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

  undo() {
    if (this.history && this.history.length > 0) {
      const lastAction = this.history.pop();
      const redoAction = [];
      const updates = [];
      lastAction.forEach(u => {
        const currentVoxel = this.mapManager.getVoxelAt(u.worldX, u.worldY, u.worldZ);
        redoAction.push({ worldX: u.worldX, worldY: u.worldY, worldZ: u.worldZ, voxelData: currentVoxel ? { ...currentVoxel } : null });
        this.mapManager.setVoxelAt(u.worldX, u.worldY, u.worldZ, u.voxelData, false);
        updates.push(u);
      });
      this.redoHistory = this.redoHistory || [];
      this.redoHistory.push(redoAction);
      if (this.redoHistory.length > 30) this.redoHistory.shift();
      this.renderer.needsVoxelUpdate = true;
      updates.forEach(u => this.network.sendUpdateBlock(u));
      this.chat.addMessage('system', 'System', `Undo successful (${lastAction.length} blocks reverted).`);
    } else {
      this.chat.addMessage('system', 'System', 'Nothing to undo.');
    }
  }

  redo() {
    if (this.redoHistory && this.redoHistory.length > 0) {
      const redoAction = this.redoHistory.pop();
      const undoAction = [];
      const updates = [];
      redoAction.forEach(u => {
        const currentVoxel = this.mapManager.getVoxelAt(u.worldX, u.worldY, u.worldZ);
        undoAction.push({ worldX: u.worldX, worldY: u.worldY, worldZ: u.worldZ, voxelData: currentVoxel ? { ...currentVoxel } : null });
        this.mapManager.setVoxelAt(u.worldX, u.worldY, u.worldZ, u.voxelData, false);
        updates.push(u);
      });
      this.history = this.history || [];
      this.history.push(undoAction);
      if (this.history.length > 30) this.history.shift();
      this.renderer.needsVoxelUpdate = true;
      updates.forEach(u => this.network.sendUpdateBlock(u));
      this.chat.addMessage('system', 'System', `Redo successful (${redoAction.length} blocks reapplied).`);
    } else {
      this.chat.addMessage('system', 'System', 'Nothing to redo.');
    }
  }

  updateSelectionArea() {
    this.selectedTiles = [];
    if (!this.selectionStart || !this.selectionEnd) return;
    
    const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);
    const minZ = Math.min(this.selectionStart.z, this.selectionEnd.z);
    const maxZ = Math.max(this.selectionStart.z, this.selectionEnd.z);
    
    // Safety check to prevent memory overflow on huge selections
    const volume = ((maxX - minX) / 32 + 1) * ((maxY - minY) / 32 + 1) * ((maxZ - minZ) / 32 + 1);
    if (volume > 4000) return;

    for (let x = minX; x <= maxX; x += 32) {
      for (let y = minY; y <= maxY; y += 32) {
        for (let z = minZ; z <= maxZ; z += 32) {
          this.selectedTiles.push({ x, y, z });
        }
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

    if (this.renderer && this.renderer.webgl) {
      this.renderer.webgl.dispose();
      if (this.canvas && this.canvas.parentNode) {
        const newCanvas = this.canvas.cloneNode(true);
        this.canvas.parentNode.replaceChild(newCanvas, this.canvas);
      }
    }
  }

  playSound(path, volume = 1.0) {
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch(e => console.warn('Audio play failed:', e));
  }

  getVoxelTop(voxel, zIndex, x, y) {
    if (!voxel) return -1000;
    if (voxel.shape === 'slab') return (zIndex * 32) + 0;
    if (voxel.shape && voxel.shape.startsWith('ramp')) {
      const lx = ((x % 32) + 32) % 32;
      const ly = ((y % 32) + 32) % 32;
      let factor = 1;
      if (voxel.shape === 'ramp_s') factor = ly / 32;
      else if (voxel.shape === 'ramp_n') factor = (32 - ly) / 32;
      else if (voxel.shape === 'ramp_e') factor = lx / 32;
      else if (voxel.shape === 'ramp_w') factor = (32 - lx) / 32;
      return (zIndex * 32) - 16 + (32 * factor);
    }
    return (zIndex * 32) + 16;
  }

  getTerrainZ(x, y, currentZ, exactOnly = false) {
    if (!this.mapManager) return -96;
    const radius = 14;
    const corners = exactOnly ? [{ dx: 0, dy: 0 }] : [
      { dx: 0, dy: 0 }, { dx: -radius, dy: -radius }, { dx: radius, dy: -radius },
      { dx: -radius, dy: radius }, { dx: radius, dy: radius }
    ];

    const maxZ = currentZ !== undefined ? currentZ + 16 : 10000; 

    for (let z = 15; z >= -10; z--) {
      let highestZ = -96;

      for (let c of corners) {
        const vx = x + c.dx;
        const vy = y + c.dy;
        const voxel = this.mapManager.getVoxelAt(vx, vy, z * 32);
        if (voxel) {
          const props = getBlockProps(voxel.tex);
          if (props.isSolid) {
            const blockTop = this.getVoxelTop(voxel, z, vx, vy);
            if (blockTop > highestZ) highestZ = blockTop;
          }
        }
      }
      if (highestZ > -96 && highestZ <= maxZ) return highestZ;
    }
    return -96;
  }

  checkCollision(nextX, nextY, overrideZ) {
    if (this.noclip) return false;

    const radius = 14;
    const corners = [
      { dx: -radius, dy: -radius },
      { dx: radius, dy: -radius },
      { dx: -radius, dy: radius },
      { dx: radius, dy: radius }
    ];

    const pZ = overrideZ !== undefined ? overrideZ : (this.player.z || 0);

    const currentGridZ = Math.max(0, Math.floor((pZ + 5) / 32));
    const headGridZ = Math.max(0, Math.floor((pZ + 60) / 32)); 

    for (let c of corners) {
      for (let z = currentGridZ; z <= headGridZ; z++) {
        const vx = nextX + c.dx;
        const vy = nextY + c.dy;
        const voxel = this.mapManager.getVoxelAt(vx, vy, z * 32);
        if (voxel) {
          const props = getBlockProps(voxel.tex);
          if (props.isSolid) {
            const blockTop = this.getVoxelTop(voxel, z, vx, vy);
            if (blockTop > pZ + 5) return true; 
          }
        }
      }
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
    const blockTop = this.getTerrainZ(entity.x, entity.y, entity.z);
    if (entity.z === undefined) entity.z = blockTop;
    if (entity.vz === undefined) entity.vz = 0;

    let currentlyInWater = false;
    let waterVoxel = null;
    let wZ = 0;

    if (this.mapManager) {
      const currentGridZ = Math.round(entity.z / 32);
      for (let offset = 0; offset <= 2; offset++) {
        const checkZ = (currentGridZ + offset) * 32;
        const v = this.mapManager.getVoxelAt(entity.x, entity.y, checkZ);
        if (v) {
          const props = getBlockProps(v.tex);
          if (props.isFluid) {
            waterVoxel = v;
            wZ = checkZ;
            break;
          }
        }
      }

      currentlyInWater = !!waterVoxel;
    }

    if (currentlyInWater) {
      entity.vz -= 250 * (dt / 1000); // Slow sinking
      entity.vz -= entity.vz * 4.0 * (dt / 1000); // Water drag/friction
      entity.z += entity.vz * (dt / 1000);

      
      if (Math.abs(entity.vz) < 20) {
        entity.z += Math.sin(performance.now() / 400) * 15 * (dt / 1000);
      }
      
      const props = getBlockProps(waterVoxel.tex);
      if (props.damagePerSecond && entity.hp !== undefined && entity.hp > 0 && entity.state !== 'death' && entity.state !== 'dead') {
          entity.hp -= props.damagePerSecond * (dt / 1000);
          entity.hurtTimer = 100; 
          
          if (Math.random() > 0.4) {
              const isAcid = waterVoxel.tex === 'acid';
              this.particles.push({
                  x: entity.x + (Math.random() - 0.5) * 20,
                  y: entity.y + (Math.random() - 0.5) * 20,
                  z: entity.z + 10 + Math.random() * 20,
                  vx: (Math.random() - 0.5) * 15,
                  vy: (Math.random() - 0.5) * 15,
                  vz: 20 + Math.random() * 30,
                  noGravity: true,
                  life: 0.4 + Math.random() * 0.4,
                  maxLife: 0.8,
                  color: isAcid ? '#2ecc71' : (Math.random() > 0.5 ? '#ff5d00' : 'rgba(100,100,100,0.8)'),
                  tex: isAcid ? 'bubble' : undefined,
                  size: isAcid ? 1 + Math.random() * 2 : 3 + Math.random() * 3
              });
          }

          if (entity.hp <= 0) {
              entity.hp = 0;
              entity.state = entity.uuid ? 'dead' : 'death';
              entity.frame = 0;
              if (entity === this.player) {
                  this.player.respawnTimer = 10000;
                  this.chat.addMessage('combat', 'Combat', 'You melted in the lava!');
              }
          }
          if (entity === this.player) this.ui.update();
      }
    } else {
      if (entity.z > blockTop || entity.vz > 0) {
        entity.vz -= 2000 * (dt / 1000);
        entity.z += entity.vz * (dt / 1000);
      }
    }

    if (entity.z <= blockTop) {
      entity.z = blockTop;
      if (entity.vz < 0) entity.vz = 0;
    }

    if (this.mapManager) {

      if (currentlyInWater && !entity.wasInWater) {
        let color = waterVoxel.color;
        if (!color || typeof color !== 'string' || !color.startsWith('#') || color.includes('NaN')) {
          color = waterVoxel.tex === 'lava' ? '#ff5d00' : '#3498db';
        }
        
        for (let i = 0; i < 15; i++) {
          const isWater = waterVoxel.tex !== 'lava';
          const pColor = (isWater && Math.random() > 0.6) ? '#ffffff' : color;

          this.particles.push({
            x: entity.x + (Math.random() - 0.5) * 20,
            y: entity.y + (Math.random() - 0.5) * 20,
            z: wZ + 16,
            vx: (Math.random() - 0.5) * 80,
            vy: (Math.random() - 0.5) * 80,
            vz: 50 + Math.random() * 80,
            life: 0.3 + Math.random() * 0.3,
            maxLife: 0.6,
            color: pColor,
            size: 2 + Math.random() * 3
          });
        }
      }
      entity.wasInWater = currentlyInWater;
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
      if (p.life <= 0) {
        if (p.tex === 'bubble' && !p.isPop) {
          this.particles.push({
            x: p.x, y: p.y, z: p.z,
            vx: 0, vy: 0, vz: 0,
            noGravity: true,
            life: 0.15, maxLife: 0.15,
            tex: 'bubble',
            color: p.color,
            size: p.size,
            isPop: true
          });

          if (Math.random() > 0.3) {
            const drops = 2 + Math.floor(Math.random() * 2);
            for (let d = 0; d < drops; d++) {
              this.particles.push({
                x: p.x + (Math.random() - 0.5) * 4,
                y: p.y + (Math.random() - 0.5) * 4,
                z: p.z,
                vx: (p.vx || 0) + (Math.random() - 0.5) * 20,
                vy: (p.vy || 0) + (Math.random() - 0.5) * 20,
                vz: ((p.vz || 0) * 0.3) + Math.random() * 25,
                noGravity: false,
                life: 0.1 + Math.random() * 0.15,
                maxLife: 0.25,
                color: p.color,
                size: 1 + Math.random()
              });
            }
          }
        }
        this.particles.splice(i, 1);
        continue;
      }
      if (p.vx) p.x += p.vx * (dt / 1000);
      if (p.vy) p.y += p.vy * (dt / 1000);
      if (p.vz) {
        p.z += p.vz * (dt / 1000);
        if (!p.noGravity) p.vz -= 800 * (dt / 1000); // Gravity for falling bits
      }
      if (p.vr) p.rot = (p.rot || 0) + p.vr * (dt / 1000);
    }

    if (this.splashPoints) {
      const baseSplashRate = 48 * (dt / 1000); 
      this.splashPoints.forEach(sp => {
        if (Math.hypot(this.camera.x - sp.x, this.camera.y - sp.y) > 1000) return;
        
        const heightMod = Math.min(sp.fallHeight || 1, 5);
        const splashRate = baseSplashRate * (1 + heightMod * 0.5);
        const particlesToSpawn = Math.floor(splashRate) + (Math.random() < (splashRate % 1) ? 1 : 0);
        
        for (let i = 0; i < particlesToSpawn; i++) {
          const pColor = Math.random() > 0.6 ? '#ffffff' : sp.color;
          this.particles.push({
            x: sp.x + (Math.random() - 0.5) * 40,
            y: sp.y + (Math.random() - 0.5) * 40,
            z: sp.z + Math.random() * 8,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            vz: (30 + Math.random() * 60) * (1 + heightMod * 0.2),
            life: 0.2 + Math.random() * 0.3,
            maxLife: 0.5,
            color: pColor,
            size: 1.5 + Math.random() * 2
          });
        }
      });
    }

    if (this.lavaPoints) {
      const spitRate = 1.0 * (dt / 1000);
      const smokeRate = 0.5 * (dt / 1000);
      const bubbleRate = 2.0 * (dt / 1000);
      
      this.lavaPoints.forEach(lp => {
        if (Math.hypot(this.camera.x - lp.x, this.camera.y - lp.y) > 1000) return;
        
        if (!lp.isAcid && Math.random() < spitRate) {
          this.particles.push({
            x: lp.x + (Math.random() - 0.5) * 32,
            y: lp.y + (Math.random() - 0.5) * 32,
            z: lp.z + 16,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            vz: 40 + Math.random() * 60,
            life: 0.2 + Math.random() * 0.3,
            maxLife: 0.5,
            color: '#f1c40f',
            size: 1.5 + Math.random() * 2
          });
        }
        
        if (!lp.isAcid && Math.random() < smokeRate) {
          this.particles.push({
            x: lp.x + (Math.random() - 0.5) * 32,
            y: lp.y + (Math.random() - 0.5) * 32,
            z: lp.z + 16,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            vz: 15 + Math.random() * 15,
            noGravity: true, 
            life: 1.0 + Math.random() * 1.5,
            maxLife: 2.5,
            color: 'rgba(120, 120, 120, 0.5)',
            size: 3 + Math.random() * 4
          });
        }
        
        const currentBubbleRate = lp.isAcid ? 1.0 * (dt / 1000) : 0;

        if (Math.random() < currentBubbleRate) {
          let cHex = lp.color || (lp.isAcid ? '#2ecc71' : '#ff5d00');
          if (!lp.isAcid && cHex.startsWith('#') && cHex.length === 7) {
             let r = parseInt(cHex.slice(1, 3), 16);
             let g = parseInt(cHex.slice(3, 5), 16);
             let b = parseInt(cHex.slice(5, 7), 16);
             const offset = (Math.random() - 0.5) * 50;
             r = Math.min(255, Math.max(0, Math.floor(r + offset)));
             g = Math.min(255, Math.max(0, Math.floor(g + offset)));
             b = Math.min(255, Math.max(0, Math.floor(b + offset)));
             cHex = `rgb(${r}, ${g}, ${b})`;
          }

          this.particles.push({
            x: lp.x + (Math.random() - 0.5) * 32,
            y: lp.y + (Math.random() - 0.5) * 32,
            z: lp.z + 16,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            vz: 10 + Math.random() * 15,
            noGravity: true,
            life: 0.5 + Math.random() * 1.0,
            maxLife: 2.0,
            tex: 'bubble',
            color: cHex,
            size: lp.isAcid ? 1 + Math.random() * 1.5 : 2 + Math.random() * 3
          });
        }
      });
    }

    for (let i = this.debris.length - 1; i >= 0; i--) {
      let d = this.debris[i];
      d.life -= dt / 1000;
      if (d.crumpleTimer > 0) d.crumpleTimer -= dt / 1000;

      if (d.life <= 0) {
        this.debris.splice(i, 1);
        continue;
      }

      d.vz -= 1000 * (dt / 1000);
      d.x += d.vx * (dt / 1000);
      d.y += d.vy * (dt / 1000);
      d.z += d.vz * (dt / 1000);

      let inLava = false;
      const currentGridZ = Math.round(d.z / 32);
      for (let offset = -1; offset <= 1; offset++) {
        const v = this.mapManager.getVoxelAt(d.x, d.y, (currentGridZ + offset) * 32);
        if (v && v.tex === 'lava') { inLava = true; break; }
      }

      if (inLava) {
        if (!d.isCharred) {
          d.isCharred = true;
          d.life = 1.0; // Give it 1 second to sink before destroying
          d.crumpleTimer = 0;
          
          for (let pIdx = 0; pIdx < 8; pIdx++) {
            this.particles.push({
              x: d.x + (Math.random() - 0.5) * 16,
              y: d.y + (Math.random() - 0.5) * 16,
              z: d.z + 5,
              vx: (Math.random() - 0.5) * 15,
              vy: (Math.random() - 0.5) * 15,
              vz: 15 + Math.random() * 20,
              noGravity: true,
              life: 0.6 + Math.random() * 0.6,
              maxLife: 1.2,
              color: 'rgba(100, 100, 100, 0.7)',
              size: 3 + Math.random() * 4
            });
          }
        }
        
        d.vx = 0;
        d.vy = 0;
        d.vz = -15; // Slow steady sink
        
        if (Math.random() > 0.5) {
           this.particles.push({
              x: d.x + (Math.random() - 0.5) * 10, y: d.y + (Math.random() - 0.5) * 10, z: d.z + 5,
              vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, vz: 10 + Math.random() * 20,
              noGravity: true, life: 0.3 + Math.random() * 0.4, maxLife: 0.7,
              color: Math.random() > 0.5 ? '#ff5d00' : 'rgba(80, 80, 80, 0.7)', size: 2 + Math.random() * 2
           });
        }
        continue;
      }

      const tz = this.getTerrainZ(d.x, d.y, d.z);
      if (d.z <= tz) {
        d.z = tz;

        d.vz *= -0.4;
        d.vx *= 0.6;
        d.vy *= 0.6;
        if (Math.abs(d.vz) < 20) d.vz = 0;
      }
      
      if (d.vx !== 0 || d.vy !== 0) {
        d.rotation = (d.rotation || 0) + (Math.sqrt(d.vx*d.vx + d.vy*d.vy)) * 0.05 * (dt/1000) * (d.vx > 0 ? 1 : -1);
      }
    }

    this.entityManager.update(dt);
    this.mapManager.update(dt);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      let proj = this.projectiles[i];
      let distToMove = proj.speed * (dt / 1000);
      proj.distTravelled += distToMove;
      if (proj.distTravelled >= proj.maxDist) {
        if (proj.onHit) proj.onHit();
        this.projectiles.splice(i, 1);
      } else {
        let ratio = proj.distTravelled / proj.maxDist;
        
        let baseRatio = ratio;
        if (proj.isCritLoop) {
          if (ratio < 0.25) {
            baseRatio = ratio * 2;
          } else if (ratio < 0.75) {
            baseRatio = 0.5;
          } else {
            baseRatio = 0.5 + (ratio - 0.75) * 2;
          }
        }

        proj.x = proj.startX + (proj.targetX - proj.startX) * baseRatio;
        proj.y = proj.startY + (proj.targetY - proj.startY) * baseRatio;
        proj.z = proj.startZ + (proj.targetZ - proj.startZ) * baseRatio;

        if (proj.isCritLoop) {
          if (ratio >= 0.25 && ratio <= 0.75) {
            const loopRatio = (ratio - 0.25) / 0.5;
            const R = 60; 
            const theta = -Math.PI / 2 + (loopRatio * Math.PI * 2);

            const dx = proj.targetX - proj.startX;
            const dy = proj.targetY - proj.startY;
            const dist = Math.hypot(dx, dy) || 1;

            const forwardOffset = Math.cos(theta) * R;
            const zOffset = R + Math.sin(theta) * R;

            proj.x += (dx / dist) * forwardOffset;
            proj.y += (dy / dist) * forwardOffset;
            proj.z += zOffset;

            proj.loopPitch = loopRatio * Math.PI * 2;
          } else {
            proj.loopPitch = 0;
          }
        }

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
      this.network.sendPlayerMoved({
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
    
    this.renderer.draw();
    
    if (this.renderer.debugCtx) {
      if (this.clientSettings.showMinimap && (!this.mapOverlay || !this.mapOverlay.active)) {
        this.minimap.draw(this.renderer.debugCtx);
      }
      if (this.mapOverlay && this.mapOverlay.active) {
        this.mapOverlay.draw(this.renderer.debugCtx);
        this.mapOverlay.drawBorder(this.renderer.debugCtx);
      }
    }
    
    this.reqId = requestAnimationFrame(this.loop);
  }
}
