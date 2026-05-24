
import { ChatManager } from './chat.js?v=new-engine-311';
import { NetworkManager } from './network.js?v=new-engine-311';
import { UIManager } from './ui.js?v=new-engine-311';
import { InputManager } from './input.js?v=new-engine-311';
import { MinimapManager } from './minimap.js?v=new-engine-311';
import { Renderer } from './renderer.js?v=new-engine-311';
import { CombatManager } from './combat.js?v=new-engine-311';
import { EntityManager } from './entity_manager.js?v=new-engine-311';
import { MapOverlayManager } from './map_overlay.js?v=new-engine-311';
import { MapManager } from './chunk_manager.js?v=new-engine-311';
import { getBlockProps } from './blocks.js?v=new-engine-311';
import { FURNITURE_REGISTRY, POWERSET_REGISTRY, POWER_REGISTRY } from './registry.js?v=new-engine-311';

export class GameEngine {
  constructor(canvasId, playerData, accountUuid) {
    this.canvas = document.getElementById(canvasId);
    this.playerData = playerData;
    this.accountUuid = accountUuid;

        this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

            if (!this.playerData.powersets) this.playerData.powersets = [];
    const psIdx = this.playerData.powersets.indexOf('Inherited');
    if (psIdx !== -1) this.playerData.powersets[psIdx] = 'inherited';
    if (!this.playerData.powersets.includes('inherited')) {
      this.playerData.powersets.push('Inherited');
    }

    if (!this.playerData.powers) this.playerData.powers = [];
    const brIdx = this.playerData.powers.indexOf('Brawl');
    if (brIdx !== -1) this.playerData.powers[brIdx] = 'brawl';
    const taIdx = this.playerData.powers.indexOf('Throw Airplane');
    if (taIdx !== -1) this.playerData.powers[taIdx] = 'throw_airplane';

    if (!this.playerData.powers.includes('brawl')) {
      this.playerData.powers.push('brawl');
    }
    if (!this.playerData.powers.includes('throw_airplane')) {
      this.playerData.powers.push('throw_airplane');
    }

    const savedSettingsStr = localStorage.getItem('b_client_settings');
    const defaultSettings = { showCoords: false, showFPS: false, showPing: false, showBaseplates: false, cameraFollowsJump: true, showMinimap: true, rotateMinimap: true, clickToMove: false, alwaysSprint: false, showPlayerNames: true, showPlayerHealth: true, showEntityNames: true, showEntityHealth: true, invertCameraRotation: false, invertDragRotation: false, middleMouseRotation: true, dragRotationSensitivity: 0.25, lockBuilderPanel: false, cameraAngle: 0, keybinds: { undo: 'z', redo: 'y', picker: '', flyDown: 'x' } };
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

    const maxMapSize = 127 * 32;
    const mapCenter = (128 * 32) / 2;

    let startX = this.playerData.position?.x;
    let startY = this.playerData.position?.y;
    let startZ = this.playerData.position?.z;

    if (startX === undefined || (startX === 0 && startY === 0)) {
      startX = mapCenter;
      startY = mapCenter;
    }

    startX = Math.max(0, Math.min(startX, maxMapSize));
    startY = Math.max(0, Math.min(startY, maxMapSize));

    if (this.playerData.name && this.playerData.name.toLowerCase() === 'tim') {
      if (!this.playerData.powersets.includes('developer')) {
        this.playerData.powersets.push('developer');
      }
      ['dev_noclip', 'dev_heal', 'dev_smite'].forEach(p => {
        if (!this.playerData.powers.includes(p)) this.playerData.powers.push(p);
      });
      startX = mapCenter;
      startY = mapCenter;
      console.log("Welcome back, Tim. Spawning at map center and granting Developer powers.");
    }

    this.player = {
      x: startX,
      y: startY,
      z: startZ,
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
      maxEnergy: 1000,
      activePowers: this.playerData.activePowers ? [...this.playerData.activePowers] : []
    };
    this.screenFade = 0;
    this.lastEmit = { x: this.player.x, y: this.player.y, z: this.player.z, state: this.player.state, dir: this.player.dir, hp: this.player.hp, activePowers: this.player.activePowers.join(',') };

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
      if (this.renderer && this.renderer.handleResize) this.renderer.handleResize();
    };

    window.addEventListener('keydown', (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (e.key.toLowerCase() === 'n' && !isInput) {
        const newState = !this.clientSettings.showPlayerNames;
        this.clientSettings.showPlayerNames = newState;
        this.clientSettings.showPlayerHealth = newState;
        this.clientSettings.showEntityNames = newState;
        this.clientSettings.showEntityHealth = newState;
        localStorage.setItem('b_client_settings', JSON.stringify(this.clientSettings));
        this.chat.addMessage('system', 'System', `Nameplates are now ${newState ? 'ON' : 'OFF'}.`);
      }
    });

        window.addEventListener('resize', this.handleResize);

    const defaultDev = { showPlayerPos: false, showPlayerTile: false, showEntityPos: false, showEntityTile: false, showMelee: false, showLoS: false, showHitboxes: false, showTile: false, showChunk: false, showDistToNPC: false, showDistNpcToMouse: false, showDistPlayerToMouse: false, losDistance: 400, losAngle: 60, useDebugTooltip: false, useBlockPreview: true };
    
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
      integrity: this.playerData.integrity || 0,
      activePowers: this.player.activePowers
    });

    this.syncTimer = setInterval(() => {
      if (this.socket && this.socket.connected && this.accountUuid) {
        this.playerData.activePowers = this.player.activePowers;
        this.network.sendPlayerSync(this.accountUuid, this.playerData, { x: this.player.x, y: this.player.y, z: this.player.z });
      }
    }, 10000);

    this.autoOpenedDoors = new Map();
    this.player.doorPushTimer = 0;

    
    this.handleResize();

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
        
        for (const [id, ps] of Object.entries(POWERSET_REGISTRY)) {
          if (!this.powersetsData[id]) {
            this.powersetsData[id] = {
              id: id,
              name: ps.name,
              category: 'Innate',
              powers: ps.powers.map(pId => {
                const pDef = POWER_REGISTRY[pId];
                return { id: pId, name: pDef ? pDef.name : pId, desc: pDef ? pDef.description : '' };
              })
            };
          }
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
    if (FURNITURE_REGISTRY && FURNITURE_REGISTRY[voxel.shape]) return (zIndex * 32) + 0;
    if (voxel.shape && (voxel.shape.startsWith('ramp') || voxel.shape.startsWith('stair'))) {
      const vx = Math.round(x / 32) * 32;
      const vy = Math.round(y / 32) * 32;
      const localX = x - vx;
      const localY = y - vy;
      let factor = 0.5;
      if (voxel.shape.endsWith('_s')) factor = (localY + 16) / 32;
      else if (voxel.shape.endsWith('_n')) factor = (16 - localY) / 32;
      else if (voxel.shape.endsWith('_e')) factor = (localX + 16) / 32;
      else if (voxel.shape.endsWith('_w')) factor = (16 - localX) / 32;
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

    const maxZ = currentZ !== undefined ? currentZ + 24 : 10000; 

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

  findSafeSpawn() {
    if (this.noclip) return;

    if (this.player.z === undefined) {
      this.player.z = this.getTerrainZ(this.player.x, this.player.y);
    }
    
    if (!this.checkCollision(this.player.x, this.player.y, this.player.z)) {
      return; 
    }

    console.log("[Engine] Player is obstructed at spawn. Finding safe location...");
    const pZ = this.player.z;
    const startGridX = Math.round(this.player.x / 32);
    const startGridY = Math.round(this.player.y / 32);
    const startGridZ = Math.round(pZ / 32);

    const maxRadius = 6; 
    let safeSpot = null;

    for (let r = 0; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; 
          
          const checkX = startGridX + dx;
          const checkY = startGridY + dy;

          for (let zOffset = 0; zOffset <= 15; zOffset++) {
             const zDirs = zOffset === 0 ? [0] : [zOffset, -zOffset];
             
             for (let dz of zDirs) {
                const checkZ = startGridZ + dz;
                if (checkZ > 15 || checkZ < -10) continue;

                let hasFloor = false;
                const floorVoxel = this.mapManager.getVoxelAt(checkX * 32, checkY * 32, (checkZ - 1) * 32);
                if (floorVoxel && getBlockProps(floorVoxel.tex).isSolid) {
                   hasFloor = true;
                } else if (checkZ <= -3) { 
                   hasFloor = true;
                }
                
                if (hasFloor) {
                   let isClear = true;
                   for (let clearZ = 0; clearZ < 3; clearZ++) {
                      const v = this.mapManager.getVoxelAt(checkX * 32, checkY * 32, (checkZ + clearZ) * 32);
                      if (v && getBlockProps(v.tex).isSolid) {
                         isClear = false;
                         break;
                      }
                   }
                   if (isClear) {
                      safeSpot = { x: checkX * 32, y: checkY * 32, z: checkZ * 32 };
                      break;
                   }
                }
             }
             if (safeSpot) break;
          }
          if (safeSpot) break;
        }
        if (safeSpot) break;
      }
      if (safeSpot) break;
    }

    if (safeSpot) {
       console.log("[Engine] Found safe 3x3 spawn clearance near", safeSpot);
       this.player.x = safeSpot.x;
       this.player.y = safeSpot.y;
       this.player.z = safeSpot.z;
    } else {
       console.log("[Engine] Could not find 3x3 clearance nearby, moving to absolute top.");
       const highestZ = this.getTerrainZ(this.player.x, this.player.y);
       this.player.z = highestZ + 10;
    }
    
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.z = this.player.z;
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

    const currentGridZ = Math.floor((pZ + 5) / 32);
    const headGridZ = Math.floor((pZ + 60) / 32); 

    for (let c of corners) {
      for (let z = currentGridZ; z <= headGridZ; z++) {
        const vx = nextX + c.dx;
        const vy = nextY + c.dy;
        const voxel = this.mapManager.getVoxelAt(vx, vy, z * 32);
        if (voxel) {
          const props = getBlockProps(voxel.tex);
          if (props.isSolid) {
            if (voxel.shape && voxel.shape.startsWith('door')) {
              if (!voxel.shape.includes('_open')) {
                this.player.doorPushTimer = (this.player.doorPushTimer || 0) + 16;
                this.player.doorPushedThisFrame = true;
                if (this.player.doorPushTimer > 150) {
                  const openDoor = (tx, ty, tz) => {
                    const v = this.mapManager.getVoxelAt(tx, ty, tz);
                    if (v && v.shape && v.shape.startsWith('door') && !v.shape.includes('_open')) {
                      v.shape += '_open';
                      this.mapManager.setVoxelAt(tx, ty, tz, v);
                      this.autoOpenedDoors.set(`${tx}_${ty}_${tz}`, { x: tx, y: ty, z: tz });
                    }
                  };
                  openDoor(vx, vy, z * 32);
                  openDoor(vx, vy, z * 32 + 32);
                  openDoor(vx, vy, z * 32 - 32);
                }
              }
              continue; // Let the precise broadphase check handle door collision blocking
            }

            if (voxel.shape && voxel.shape.endsWith('_open')) continue;
            
            const blockTop = this.getVoxelTop(voxel, z, vx, vy);
            if (blockTop > pZ + 17) {
              this.player.doorPushTimer = 0;
              return true;
            }
          }
        }
      }
    }

    const cx = Math.round(nextX / 32) * 32;
    const cy = Math.round(nextY / 32) * 32;
    const cz = Math.round(pZ / 32) * 32;
    for (let dx = -32; dx <= 32; dx += 32) {
      for (let dy = -32; dy <= 32; dy += 32) {
        for (let dz = -32; dz <= 64; dz += 32) {
          const vx = cx + dx, vy = cy + dy, vz = cz + dz;
          const voxel = this.mapManager.getVoxelAt(vx, vy, vz);
          if (voxel && voxel.shape && voxel.shape.startsWith('door') && !voxel.shape.includes('_open')) {
             let minX = vx - 16, maxX = vx + 16, minY = vy - 16, maxY = vy + 16;
             if (voxel.shape.includes('door_e')) { minX = vx + 8; } 
             else if (voxel.shape.includes('door_n')) { minY = vy + 8; } 
             else if (voxel.shape.includes('door_w')) { maxX = vx - 8; }
             else { maxY = vy - 8; } 
             
             if (nextX > minX - 14 && nextX < maxX + 14 && nextY > minY - 14 && nextY < maxY + 14) {
                if (pZ < vz + 32 && pZ + 60 > vz - 16) return true;
             }
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
          const dmg = props.damagePerSecond * (dt / 1000);
          entity.hp -= dmg;
          entity.hurtTimer = 100; 
          
          entity.envDamageAcc = (entity.envDamageAcc || 0) + dmg;
          entity.envDamageTimer = (entity.envDamageTimer || 0) + dt;

          if (entity.envDamageTimer >= 500) { // Accumulate text pops every half second
              const tickDmg = Math.round(entity.envDamageAcc);
              if (tickDmg > 0) {
                  const isAcid = waterVoxel.tex === 'acid';
                  this.floatingTexts.push({
                      x: entity.x, y: entity.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40,
                      text: tickDmg.toString(), life: 1.0, color: isAcid ? '#2ecc71' : '#ff5d00'
                  });
              }
              entity.envDamageAcc = 0;
              entity.envDamageTimer = 0;
          }
          
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
  } else if (entity.activePowers && entity.activePowers.includes('fly')) {
      if (entity === this.player) {
        if (this.keys && this.keys[' ']) {
          entity.vz = 450;
        } else if (this.keys && this.keys['x']) {
          entity.vz = -450;
        } else {
          entity.vz = 0;
          entity.z += Math.sin(performance.now() / 400) * 15 * (dt / 1000);
        }
        entity.z += entity.vz * (dt / 1000);
      } else {
        entity.vz = 0;
      }
      
      if (Math.random() > 0.3) {
        this.particles.push({
          x: entity.x + (Math.random() - 0.5) * 20,
          y: entity.y + (Math.random() - 0.5) * 20,
          z: entity.z + Math.random() * 10,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          vz: -20 - Math.random() * 30,
          noGravity: true,
          life: 0.4 + Math.random() * 0.4,
          maxLife: 0.8,
          color: '#9b59b6',
          size: 2 + Math.random() * 3
        });
      }
    } else {
      if (entity.z > blockTop || entity.vz > 0) {
        let grav = 2000;
        if (entity.activePowers && entity.activePowers.includes('super_jump')) {
          grav = 900;
          if (Math.random() > 0.2) {
            this.particles.push({
              x: entity.x + (Math.random() - 0.5) * 20,
              y: entity.y + (Math.random() - 0.5) * 20,
              z: entity.z + 10 + Math.random() * 20,
              vx: -(entity.momentumX || 0) * 0.1 + (Math.random() - 0.5) * 15,
              vy: -(entity.momentumY || 0) * 0.1 + (Math.random() - 0.5) * 15,
              vz: -(entity.vz || 0) * 0.2 + (Math.random() - 0.5) * 15,
              noGravity: true,
              life: 0.3 + Math.random() * 0.4,
              maxLife: 0.7,
              color: 'rgba(255, 255, 255, 0.4)',
              size: 2 + Math.random() * 3
            });
          }
        }
        entity.vz -= grav * (dt / 1000);
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

    if (this.autoOpenedDoors) {
        for (const [key, data] of this.autoOpenedDoors.entries()) {
            const dist = Math.hypot(this.player.x - data.x, this.player.y - data.y);
            if (dist > 80) {
                const currentVoxel = this.mapManager.getVoxelAt(data.x, data.y, data.z);
                if (currentVoxel && currentVoxel.shape && currentVoxel.shape.includes('_open')) {
                    currentVoxel.shape = currentVoxel.shape.replace('_open', '');
                    this.mapManager.setVoxelAt(data.x, data.y, data.z, currentVoxel);
                }
                this.autoOpenedDoors.delete(key);
            }
        }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      let proj = this.projectiles[i];
      let distToMove = proj.speed * (dt / 1000);
      proj.distTravelled += distToMove;
      
      let ratio = Math.min(1.0, proj.distTravelled / proj.maxDist);
      
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

      let hitTarget = null;
      const hitRadius = 32;

      for (let npc of this.npcs) {
        if (npc.state !== 'dead' && Math.hypot(proj.x - npc.x, proj.y - npc.y) < hitRadius && Math.abs(proj.z - (npc.z || 0)) < 48) {
          hitTarget = { type: 'npc', entity: npc };
          break;
        }
      }

      if (!hitTarget) {
        for (let id in this.otherPlayers) {
          let op = this.otherPlayers[id];
          if (op.state !== 'death' && Math.hypot(proj.x - op.x, proj.y - op.y) < hitRadius && Math.abs(proj.z - (op.z || 0)) < 48) {
            hitTarget = { type: 'player', id: id, entity: op };
            break;
          }
        }
      }

      if (hitTarget) {
        proj.distTravelled = proj.maxDist;
        
        if (!proj.hasHit) {
          proj.hasHit = true;
          
          if (proj.isAirplane) {
            this.floatingTexts.push({
              x: hitTarget.entity.x,
              y: hitTarget.entity.y,
              offsetY: 90,
              rndX: (Math.random() - 0.5) * 50,
              rndY: (Math.random() - 0.5) * 40,
              text: proj.isCrit ? 'CRITICAL BONK!' : 'BONK!',
              life: 1.0,
              color: proj.isCrit ? '#f39c12' : '#ffffff'
            });
          }
          
          let isOurs = proj.senderId === (this.socket && this.socket.id);
          if (!isOurs && !proj.senderId && this.myRecentThrows) {
            isOurs = this.myRecentThrows.some(t => Math.hypot(proj.startX - t.x, proj.startY - t.y) < 10);
          }
          if (!isOurs && !proj.senderId) {
            isOurs = Math.hypot(proj.startX - this.player.x, proj.startY - this.player.y) < 64;
          }
          
          if (isOurs) {
            if (hitTarget.type === 'npc') {
              this.network.sendNpcHit({ targetUuid: hitTarget.entity.uuid, damage: proj.damage || 1, isCrit: proj.isCrit || false });
            } else if (hitTarget.type === 'player') {
              this.network.sendPlayerHit({ targetId: hitTarget.id, damage: proj.damage || 1, isCrit: proj.isCrit || false });
            }
          }
        }
      }

      if (proj.distTravelled >= proj.maxDist) {
        if (proj.onHit && !proj.hasHit) proj.onHit();
        this.projectiles.splice(i, 1);
      } else if (proj.trail) {
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

    if (
      Math.abs(this.player.x - this.lastEmit.x) > 1 || 
      Math.abs(this.player.y - this.lastEmit.y) > 1 || 
      (this.player.z !== undefined && this.lastEmit.z !== undefined && Math.abs(this.player.z - this.lastEmit.z) > 1) || 
      Math.abs(this.player.hp - this.lastEmit.hp) >= 1 || 
      this.player.state !== this.lastEmit.state || 
      this.player.dir !== this.lastEmit.dir ||
      this.player.activePowers.join(',') !== this.lastEmit.activePowers
    ) {
      this.network.sendPlayerMoved({
        x: this.player.x, y: this.player.y, z: this.player.z,
        state: this.player.state, dir: this.player.dir,
        hp: this.player.hp, activePowers: this.player.activePowers
      });
      this.lastEmit = { x: this.player.x, y: this.player.y, z: this.player.z, state: this.player.state, dir: this.player.dir, hp: this.player.hp, activePowers: this.player.activePowers.join(',') };
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
