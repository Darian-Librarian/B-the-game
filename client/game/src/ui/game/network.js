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
        this.socket.emit('ping');
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
          eng.floatingTexts.push({ x: npc.x, y: npc.y, offsetY: 204, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: prefix + data.damage.toString(), life: 1.0, color: color });
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

    this.socket.on('trade_request_received', (data) => {
      const chatMsgs = document.getElementById('chat-messages');
      if (!chatMsgs) return;
      const msgDiv = eng.chat.createMessageBase('system', 'System');
      const textNode = document.createTextNode(`: ${data.senderName} has requested a trade. `);
      const link = document.createElement('span');
      link.className = 'chat-action-link';
      link.innerText = '[Accept]';
      link.onclick = () => {
        eng.socket.emit('trade_accept', data.senderId);
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
          eng.floatingTexts.push({ x: eng.player.x, y: eng.player.y, offsetY: 204, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: prefix + data.damage.toString(), life: 1.0, color: color });
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
          op.hurtTimer = 300;
          const isCrit = data.isCrit || (data.damage >= 6 && data.damage <= 10) || data.damage >= 300;
          const color = isCrit ? '#f39c12' : '#ff4757';
          const prefix = isCrit ? 'Crit! ' : '';
          eng.floatingTexts.push({ x: op.x, y: op.y, offsetY: 204, rndX: (Math.random() - 0.5) * 50, rndY: (Math.random() - 0.5) * 40, text: prefix + data.damage.toString(), life: 1.0, color: color });
        }
        if (data.isDead) { op.state = 'death'; op.frame = 0; }
        eng.ui.update();
        if (data.attackerName === eng.playerData.name) {
          eng.chat.addMessage('combat', 'Combat', `You hit ${op.name} for ${data.damage} damage!`);
          if (data.isDead) eng.chat.addMessage('combat', 'Combat', `You defeated ${op.name}!`);
        }
      }
    });
  }

  disconnect() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.socket) this.socket.disconnect();
  }
}
