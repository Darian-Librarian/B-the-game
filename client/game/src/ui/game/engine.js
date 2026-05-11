import { ChatManager } from './chat.js?v=entity-manager';
import { NetworkManager } from './network.js?v=entity-manager';
import { UIManager } from './ui.js?v=entity-manager';
import { InputManager } from './input.js?v=entity-manager';
import { MinimapManager } from './minimap.js?v=entity-manager';
import { Renderer } from './renderer.js?v=entity-manager';
import { CombatManager } from './combat.js?v=entity-manager';
import { EntityManager } from './entity_manager.js?v=entity-manager';

export class GameEngine {
  constructor(canvasId, playerData, accountUuid) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.playerData = playerData;
    this.accountUuid = accountUuid;

    // Resize canvas to fill the screen
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const savedSettingsStr = localStorage.getItem('b_client_settings');
    const defaultSettings = { showCoords: false, showFPS: false, showPing: false, showBaseplates: false, cameraFollowsJump: true, showMinimap: true };
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
    this.permissions = {};
    this.noclip = false;
    
    this.fps = 0;
    this.framesThisSecond = 0;
    this.lastFpsTime = performance.now();
    this.ping = 0;

    // Determine starting coordinates
    let startX = this.playerData.position ? this.playerData.position.x : 0;
    let startY = this.playerData.position ? this.playerData.position.y : 0;

    if (this.playerData.name && this.playerData.name.toLowerCase() === 'tim') {
      startX = 0;
      startY = 0;
      console.log("Welcome back, Tim. Spawning at absolute zero.");
    }

    // Initialize the player
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
      frameInterval: 120, // ms per frame
      actionTimer: 0,
      wasPressingShift: false,
      wasPressingSpace: false,
      nextAttack: 1,
      hurtTimer: 0,
      respawnTimer: 0,
      hp: (this.playerData.stats && this.playerData.stats.hp > 10) ? this.playerData.stats.hp : 1000,
      maxHp: 1000,
      energy: (this.playerData.stats && (this.playerData.stats.energy > 10 || this.playerData.stats.mp > 10)) ? (this.playerData.stats.energy || this.playerData.stats.mp) : 1000,
      maxEnergy: 1000
    };
    this.screenFade = 0;
    this.lastEmit = { x: this.player.x, y: this.player.y, state: this.player.state, dir: this.player.dir, hp: this.player.hp };

    // Initialize Camera
    this.camera = {
      x: this.player.x,
      y: this.player.y,
      z: 0
    };
    
    // Initialize NPCs
    this.npcs = [];

    // --- Input & Event Listeners ---
    this.input = new InputManager(this);
    this.keys = this.input.keys;
    this.mousePos = this.input.mousePos;

    this.handleResize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };

    // Attach isolated listeners
    window.addEventListener('resize', this.handleResize);

    // --- Developer Tools Setup ---
    const savedDev = localStorage.getItem('b_dev_options');
    this.devOptions = savedDev ? JSON.parse(savedDev) : { showPlayerPos: false, showPlayerTile: false, showMousePos: false, showMelee: false, showHitboxes: false, showTile: false, showChunk: false };
    this.editMode = false;

    this.floatingTexts = [];

    // --- Multiplayer Networking ---
    this.otherPlayers = {};

    // Instantiate External Managers
    this.chat = new ChatManager(this);
    this.ui = new UIManager(this);
    this.network = new NetworkManager(this);
    this.minimap = new MinimapManager(this);
    this.renderer = new Renderer(this);
    this.combat = new CombatManager(this);
    this.entityManager = new EntityManager(this);
    this.socket = this.network.socket;

    console.log("Game Engine successfully booted!", this.playerData);
    this.ui.update();

    this.socket.emit('join_game', {
      name: this.playerData.name,
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      state: this.player.state,
      dir: this.player.dir
    });

    // Server Sync Heartbeat
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

  getScreenPos(wx, wy, wz = 0) {
    const sx = (wx - wy) - (this.camera.x - this.camera.y);
    const sy = (wx + wy) * this.tilt - (this.camera.x + this.camera.y) * this.tilt;
    return {
      x: Math.round(sx + this.canvas.width / 2),
      y: Math.round(sy - wz + (this.camera.z || 0) + this.canvas.height / 2)
    };
  }

  getIsoRaycast(clientX, clientY) {
    const sx = clientX - (this.canvas.width / 2);
    const sy = clientY - (this.canvas.height / 2) - (this.camera.z || 0);
    
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
    return { gx: hitGx, gy: hitGy, z: hitZ };
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
    window.removeEventListener('resize', this.handleResize);
    if (this.chatDropdownListener) document.removeEventListener('click', this.chatDropdownListener);
  }

  // --- Core Game Math & Physics ---
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

    this.entityManager.update(dt);

    // Network Emission
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

    // --- Z-Axis (True Vertical Physics & Gravity) ---
    this.applyGravity(this.player, dt);
    Object.values(this.otherPlayers).forEach(op => {
      if (op.state === 'jump' && op.prevState !== 'jump') op.vz = 450;
      op.prevState = op.state;
      this.applyGravity(op, dt);
    });
    this.npcs.forEach(npc => this.applyGravity(npc, dt));

    // Smooth Camera Follow (Linear Interpolation)
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
    this.reqId = requestAnimationFrame(this.loop);
  }
}
