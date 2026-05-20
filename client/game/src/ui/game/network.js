export class NetworkManager {
  constructor(engine) {
    this.engine = engine;
    this.socket = io(window.location.origin);

    this.setupPing();
    this.setupListeners();
  }

  setupPing() {
    const eng = this.engine;
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.pingStart = Date.now();
        this.sendPing();
      }
    }, 2000);
    this.socket.on('pong', () => { eng.ping = Date.now() - this.pingStart; });
  }

  setupListeners() {
    const eng = this.engine;

    this.socket.on('connect', () => {
      console.log(`%c[Network] Securely connected to game server! (Session ID: ${this.socket.id})`, 'color: #2ecc71; font-weight: bold; font-size: 1.1em;');
      if (eng.chat) eng.chat.addMessage('system', 'System', 'Network connection established.');
    });

    this.socket.on('disconnect', () => {
      console.log(`%c[Network] Connection to the server was lost!`, 'color: #ff4757; font-weight: bold; font-size: 1.1em;');
      if (eng.chat) eng.chat.addMessage('system', 'System', 'Lost connection to the server.');
    });

    this.socket.on('current_players', (players) => {
      for (let id in players) {
        if (id !== this.socket.id) eng.otherPlayers[id] = players[id];
      }
      if (eng.ui && eng.ui.playerList) eng.ui.playerList.updateList();
    });

    this.socket.on('player_joined', (player) => {
      eng.otherPlayers[player.id] = player;
      eng.chat.addMessage('system', 'System', `${player.name} connected.`);
      if (eng.ui && eng.ui.playerList) eng.ui.playerList.updateList();
    });

    this.socket.on('player_left', (id) => {
      if (eng.otherPlayers[id]) {
        eng.chat.addMessage('system', 'System', `${eng.otherPlayers[id].name} disconnected.`);
        delete eng.otherPlayers[id];
        if (eng.ui && eng.ui.playerList) eng.ui.playerList.updateList();
      }
    });

    this.socket.on('player_moved', (player) => {
      if (eng.otherPlayers[player.id]) {
        eng.otherPlayers[player.id].x = player.x;
        eng.otherPlayers[player.id].y = player.y;
        eng.otherPlayers[player.id].state = player.state;
        eng.otherPlayers[player.id].dir = player.dir;
        if (player.hp !== undefined) eng.otherPlayers[player.id].hp = player.hp;
        if (player.level !== undefined) eng.otherPlayers[player.id].level = player.level;
      }
    });

    this.socket.on('initial_map_data', (data) => { eng.mapData = data; });
    this.socket.on('server_permissions', (perms) => { eng.permissions = perms; });

    this.socket.on('map_update', (updates) => {
      updates.forEach(u => {
        if (u.tex === null) delete eng.mapData[`${u.x},${u.y}`];
        else eng.mapData[`${u.x},${u.y}`] = { tex: u.tex, color: u.color, z: u.z || 0 };
      });
    });

    this.socket.on('full_map_data_received', ({ data }) => {
      console.log(`[Network] Full Map Data Received (${data.length} voxels)`);

      if (eng.mapManager) {
        const savedVoxels = new Map(data);
        for (const [vKey, vData] of savedVoxels.entries()) {
           if (vData === null) {
             eng.mapManager.voxels.delete(vKey);
           } else {
             if (!vData.shape) vData.shape = 'cube';
             eng.mapManager.voxels.set(vKey, vData);
           }
        }
        if (eng.renderer) {
          eng.renderer.cacheOcclusion();
          eng.renderer.needsVoxelUpdate = true;
        }
      }
    });

    this.socket.on('block_updated', ({ worldX, worldY, worldZ, voxelData }) => {
      if (eng.mapManager) {
        eng.mapManager.setVoxelAt(worldX, worldY, worldZ, voxelData, false);
      }
    });

    this.socket.on('force_teleport', (data) => {
      const maxMapSize = 128 * 32;
      eng.player.x = Math.max(0, Math.min(data.x, maxMapSize));
      eng.player.y = Math.max(0, Math.min(data.y, maxMapSize));
      if (data.z !== undefined) {
        eng.player.z = data.z;
      } else {
        eng.player.z = eng.getTerrainZ(data.x, data.y);
      }
      eng.camera.x = eng.player.x;
      eng.camera.y = eng.player.y;
      eng.chat.addMessage('system', 'System', 'You have been teleported by an admin.');
    });

    this.socket.on('current_npcs', (npcs) => {
      eng.npcs = npcs.map(n => ({ ...n, hurtTimer: 0, frame: 0, frameTimer: 0 }));
    });

    this.socket.on('npc_spawned', (npc) => {
      eng.npcs.push({ ...npc, hurtTimer: 0, frame: 0, frameTimer: 0 });
    });

    this.socket.on('npc_took_damage', (data) => {
      const npc = eng.npcs.find(n => n.uuid === data.targetUuid);
      if (npc) {
        npc.hp = data.hp;
        if (data.damage > 0) {
          npc.hurtTimer = 300;
          const isCrit = data.isCrit || (data.damage >= 6 && data.damage <= 10) || data.damage >= 300;
          const color = isCrit ? '#f39c12' : '#ff4757';
          const prefix = isCrit ? 'Crit! ' : '';
          eng.floatingTexts.push({ x: npc.x, y: npc.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: prefix + data.damage.toString(), life: 1.0, color: color });
        }
        if (data.isDead) { npc.state = 'dead'; npc.frame = 0; }
        eng.ui.update(); 
        if (data.attackerName === eng.playerData.name) {
          eng.chat.addMessage('combat', 'Combat', `You hit ${npc.name} for ${data.damage} damage!`);
          if (data.isDead) eng.chat.addMessage('combat', 'Combat', `You defeated ${npc.name}!`);
        }
      }
    });

    this.socket.on('npc_respawned', (uuid) => {
      const npc = eng.npcs.find(n => n.uuid === uuid);
      if (npc) {
        npc.state = 'idle'; npc.hp = npc.maxHp; npc.frame = 0;
      }
    });

    this.socket.on('chat_message', (data) => {
      eng.chat.addMessage(data.type, data.name, data.text);
      for (let id in eng.otherPlayers) {
        if (eng.otherPlayers[id].name === data.name) {
          eng.otherPlayers[id].chatBubble = { text: data.text, timer: 4000 };
          break;
        }
      }
    });

    this.socket.on('player_typing', (data) => {
      if (eng.otherPlayers[data.id]) {
        eng.otherPlayers[data.id].isTyping = data.isTyping;
      }
    });

    this.socket.on('trade_request_received', (data) => {
      const chatMsgs = document.getElementById('chat-messages');
      if (!chatMsgs) return;
      const msgDiv = eng.chat.createMessageBase('system', 'System');
      const textNode = document.createTextNode(`: ${data.senderName} has requested a trade. `);
      const link = document.createElement('span');
      link.className = 'chat-action-link';
      link.innerText = '[Accept]';
      link.onclick = () => {
        eng.network.sendTradeAccept(data.senderId);
        link.innerText = '[Accepted]';
        link.style.pointerEvents = 'none';
        link.style.color = '#aaa';
      };
      msgDiv.appendChild(textNode);
      msgDiv.appendChild(link);
      chatMsgs.appendChild(msgDiv);
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
    });

    this.socket.on('trade_started', (data) => {
       eng.chat.addMessage('system', 'System', `Trade started with ${data.partnerName}!`);
       eng.ui.inventory.openTrade(data.partnerName);
    });

    this.socket.on('player_data_updated', (newCharData) => {
      Object.assign(eng.playerData, newCharData);
      const powersPanel = document.getElementById('powers-panel');
      if (powersPanel && powersPanel.style.display === 'flex') {
          eng.ui.powerbar.renderPowersUI();
      }
      const trainerModal = document.getElementById('trainer-dialog-modal');
      if (trainerModal && trainerModal.style.display === 'flex') {
          eng.ui.trainer.openTrainerUI(eng.activeTrainer);
      }
      if (eng.ui.powerbar && eng.ui.powerbar.updatePowerbar) eng.ui.powerbar.updatePowerbar();
    });

    this.socket.on('player_took_damage', (data) => {
      if (data.targetId === this.socket.id) {
        eng.player.hp = data.hp; eng.lastEmit.hp = data.hp;
        if (data.damage > 0) {
          eng.player.hurtTimer = 300;
          const isCrit = data.isCrit || (data.damage >= 6 && data.damage <= 10) || data.damage >= 300;
          const color = isCrit ? '#f39c12' : '#ff4757';
          const prefix = isCrit ? 'Crit! ' : '';
          eng.floatingTexts.push({ x: eng.player.x, y: eng.player.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: prefix + data.damage.toString(), life: 1.0, color: color });
          eng.chat.addMessage('combat', 'Combat', `${data.attackerName} hit you for ${data.damage} damage!`);
          eng.ui.update();
        }
        if (data.isDead) {
          eng.player.state = 'death'; eng.player.frame = 0; eng.player.respawnTimer = 10000;
          eng.chat.addMessage('combat', 'Combat', `You were defeated by ${data.attackerName}!`);
        }
      } else if (eng.otherPlayers[data.targetId]) {
        const op = eng.otherPlayers[data.targetId];
        op.hp = data.hp;
        if (data.damage > 0) {
          op.hurtTimer = 300;          const isCrit = data.isCrit || (data.damage >= 6 && data.damage <= 10) || data.damage >= 300;
          const color = isCrit ? '#f39c12' : '#ff4757';
          const prefix = isCrit ? 'Crit! ' : '';
          eng.floatingTexts.push({ x: op.x, y: op.y, offsetY: 90, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: prefix + data.damage.toString(), life: 1.0, color: color });
        }
        if (data.isDead) { op.state = 'death'; op.frame = 0; }
        eng.ui.update();
        if (data.attackerName === eng.playerData.name) {
          eng.chat.addMessage('combat', 'Combat', `You hit ${op.name} for ${data.damage} damage!`);
          if (data.isDead) eng.chat.addMessage('combat', 'Combat', `You defeated ${op.name}!`);
        }
      }
    });

    this.socket.on('spawn_projectile', (data) => {
      const maxDist = Math.max(1, Math.hypot(data.targetX - data.startX, data.targetY - data.startY));
      eng.projectiles.push({
        isAirplane: data.isAirplane,
        isCritLoop: data.isCritLoop,
        startX: data.startX, startY: data.startY, startZ: data.startZ,
        x: data.startX, y: data.startY, z: data.startZ,
        targetX: data.targetX, targetY: data.targetY, targetZ: data.targetZ,
        speed: data.speed,
        distTravelled: 0,
        maxDist: maxDist,
        trail: true,
        trailColor: 'rgba(200, 230, 255, 0.6)',
        trailSize: 2.5,
        onHit: () => {
          
          eng.debris.push({
            x: data.targetX, y: data.targetY, z: data.targetZ,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150,
            vz: 100 + Math.random() * 150,
            life: 5.0,
            maxLife: 5.0,
            crumpleTimer: 0.3,
            wasteTex: Math.random() > 0.5 ? 'waste_1' : 'waste_2',
            rotation: Math.random() * Math.PI * 2
          });
        }
      });
    });

    this.socket.on('force_refresh', () => {
      eng.chat.addMessage('system', 'System', 'SERVER UPDATE PUSHED! Reloading client in 3 seconds...');
      
      const savedAccountStr = localStorage.getItem('b_current_account');
      if (savedAccountStr) {
        try {
          const acc = JSON.parse(savedAccountStr);
          const charIdx = (acc.characters || []).findIndex(c => {
            const cName = typeof c === 'object' ? c.name : c;
            return cName && cName.trim().toLowerCase() === eng.playerData.name.trim().toLowerCase();
          });
          if (charIdx !== -1) {
            eng.playerData.position = { x: eng.player.x, y: eng.player.y };
            acc.characters[charIdx] = eng.playerData;
            localStorage.setItem('b_current_account', JSON.stringify(acc));
          }
        } catch (e) {}
      }

      setTimeout(() => {
        localStorage.setItem('b_auto_relog_char', eng.playerData.name);
        window.location.reload(true);
      }, 3000);
    });
  }

  disconnect() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.socket) this.socket.disconnect();
  }

  sendPing() {
    if (this.socket && this.socket.connected) this.socket.emit('ping');
  }

  sendTradeAccept(senderId) {
    if (this.socket) this.socket.emit('trade_accept', senderId);
  }

  sendJoinGame(data) {
    if (this.socket) this.socket.emit('join_game', data);
  }

  sendPlayerSync(uuid, charData, position) {
    if (this.socket) this.socket.emit('sync_character', { uuid, charData, position });
  }

  sendPlayerMoved(data) {
    if (this.socket) this.socket.emit('player_moved', data);
  }

  sendTradeRequest(targetId) {
    if (this.socket) this.socket.emit('trade_request', targetId);
  }

  sendRequestFullMap() {
    if (this.socket) this.socket.emit('request_full_map');
  }

  sendUpdateBlock(data) {
    if (this.socket) this.socket.emit('update_block', data);
  }

  sendNpcHit(data) {
    if (this.socket) this.socket.emit('npc_hit', data);
  }

  sendPlayerHit(data) {
    if (this.socket) this.socket.emit('player_hit', data);
  }

  sendPlayerTyping(isTyping) {
    if (this.socket) this.socket.emit('player_typing', { isTyping });
  }

  sendChatMessage(data) {
    if (this.socket) this.socket.emit('chat_message', data);
  }

  sendLogCommand(command) {
    if (this.socket) this.socket.emit('log_command', { command });
  }

  sendAdminTeleport(data) {
    if (this.socket) this.socket.emit('admin_teleport', data);
  }

  sendCreateNpc(data) {
    if (this.socket) this.socket.emit('create_npc', data);
  }

  sendLearnPower(data) {
    if (this.socket) this.socket.emit('learn_power', data);
  }

  sendLearnPowerset(data) {
    if (this.socket) this.socket.emit('learn_powerset', data);
  }

  sendEditNpc(uuid, updates) {
    if (this.socket) this.socket.emit('edit_npc', { uuid, updates });
  }

  sendDeleteNpc(uuid) {
    if (this.socket) this.socket.emit('delete_npc', uuid);
  }

  sendProjectile(data) {
    if (this.socket) this.socket.emit('spawn_projectile', data);
  }
}
