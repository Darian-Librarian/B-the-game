import { CHAT_CONFIG } from './chat-config.js';

export class ChatManager {
  constructor(engine) {
    this.engine = engine;
    this.history = [];
    this.historyIndex = 0;
    this.sendChannel = CHAT_CONFIG.defaultSendChannel;
    this.input = document.getElementById('chat-input');
    this.dropdownListener = null;
    
    this.tabCompleting = false;
    this.tabMatches = [];
    this.tabIndex = 0;
    this.tabBase = '';

    this.setupUI();
  }

  setupUI() {
    const btnChatChannel = document.getElementById('btn-chat-channel');
    const chatChannelDropdown = document.getElementById('chat-channel-dropdown');

    if (btnChatChannel && chatChannelDropdown) {
      btnChatChannel.addEventListener('click', (e) => {
        e.stopPropagation();
        chatChannelDropdown.style.display = chatChannelDropdown.style.display === 'none' ? 'flex' : 'none';
      });

      this.dropdownListener = (e) => {
        if (chatChannelDropdown.style.display === 'flex' && !e.target.closest('.chat-channel-selector')) {
          chatChannelDropdown.style.display = 'none';
        }
      };
      document.addEventListener('click', this.dropdownListener);

      chatChannelDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          this.sendChannel = e.target.dataset.channel;
          const config = CHAT_CONFIG.channels[this.sendChannel];
          btnChatChannel.innerText = config.label.substring(0, 3) + ' ▾';
          btnChatChannel.style.color = config.color;
          chatChannelDropdown.style.display = 'none';
          if (this.input) this.input.focus();
        });
      });
    }

    if (this.input) {
      this.input.onkeydown = (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const val = this.input.value;
          if (!this.tabCompleting) {
            this.tabCompleting = true;
            this.tabBase = val;
            this.tabMatches = [];
            this.tabIndex = 0;

            if (val.startsWith('/') && !val.includes(' ')) {
              const cmds = ['/teleport', '/tp', '/speed', '/stuck', '/noclip', '/editmode', '/reload', '/dev', '/npc', '/heal'];
              this.tabMatches = cmds.filter(c => c.startsWith(val.toLowerCase()));
            } else if (val.toLowerCase().startsWith('/tp ') || val.toLowerCase().startsWith('/teleport ')) {
              const spaceIdx = val.indexOf(' ');
              const prefix = val.substring(spaceIdx + 1).toLowerCase();
              const cmdPrefix = val.substring(0, spaceIdx + 1);
              const names = Object.values(this.engine.otherPlayers).map(p => p.name);
              this.tabMatches = names.filter(n => n.toLowerCase().startsWith(prefix)).map(n => cmdPrefix + n);
            }
            if (this.tabMatches.length === 0) this.tabCompleting = false;
          }
          if (this.tabCompleting && this.tabMatches.length > 0) {
            this.input.value = this.tabMatches[this.tabIndex];
            this.tabIndex = (this.tabIndex + 1) % this.tabMatches.length;
          }
          return;
        } else if (e.key !== 'Shift') {
          this.tabCompleting = false;
        }

        if (e.key === 'Enter') {
          e.stopPropagation(); 
          const msg = this.input.value.trim();
          if (msg) {
            if (this.history[this.history.length - 1] !== msg) this.history.push(msg);
            this.historyIndex = this.history.length;

            if (msg.startsWith('/')) {
              this.processCommand(msg);
            } else {
              this.addMessage(this.sendChannel, this.engine.playerData.name, msg);
              this.engine.socket.emit('chat_message', { type: this.sendChannel, text: msg }); 
              if (!this.engine.player.chatBubbles) this.engine.player.chatBubbles = [];
              this.engine.player.chatBubbles.push({ text: msg, timer: 4000, opacity: 0 }); 
            }
            this.input.value = '';
          }
          this.input.blur(); 
        } else if (e.key === 'ArrowUp') {
          e.preventDefault(); 
          if (this.historyIndex > 0) {
            this.historyIndex--;
            this.input.value = this.history[this.historyIndex];
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault(); 
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.input.value = this.history[this.historyIndex];
          } else if (this.historyIndex === this.history.length - 1) {
            this.historyIndex++;
            this.input.value = '';
          }
        }
      };
    }
  }

  createMessageBase(type, name) {
    const channelConfig = CHAT_CONFIG.channels[type] || CHAT_CONFIG.channels.system;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message';
    msgDiv.dataset.type = type; 

    const typeSpan = document.createElement('span');
    typeSpan.className = 'chat-channel-tag';
    typeSpan.style.color = channelConfig.color;
    typeSpan.innerText = `[${channelConfig.label}] `;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-name';
    
    if (name && name.toLowerCase() === 'tim') {
      nameSpan.classList.add('dev-tim');
      nameSpan.innerText = 'Dev Tim';
    } else if (name === 'System' || name === 'Combat') {
      nameSpan.style.color = channelConfig.color; 
      nameSpan.innerText = name;
    } else {
      nameSpan.innerText = name;
    }

    msgDiv.appendChild(typeSpan);
    msgDiv.appendChild(nameSpan);
    return msgDiv;
  }

  addMessage(type, name, text) {
    const chatMsgs = document.getElementById('chat-messages');
    if (!chatMsgs) return;
    const msgDiv = this.createMessageBase(type, name);
    msgDiv.appendChild(document.createTextNode(`: ${text}`));
    chatMsgs.appendChild(msgDiv);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  processCommand(msg) {
    const args = msg.split(' ');
    const cmd = args[0].toLowerCase();
    const eng = this.engine;
    const pName = eng.playerData.name ? eng.playerData.name.toLowerCase() : '';

    eng.socket.emit('log_command', { command: msg });

    const checkPerm = (commandName) => {
      const perms = eng.permissions || {};
      const allowed = perms[commandName];
      if (!allowed) return false;
      if (allowed.includes('*')) return true;
      return allowed.includes(pName);
    };

    if (cmd === '/tp' || cmd === '/teleport') {
      if (!checkPerm('tp')) return this.addMessage('system', 'System', 'You do not have permission to use /tp.');
      if (args.length >= 3) {
        eng.player.x = parseFloat(args[1]);
        eng.player.y = parseFloat(args[2]);
        eng.camera.x = eng.player.x;
        eng.camera.y = eng.player.y;
        this.addMessage('system', 'System', `Teleported to ${eng.player.x}, ${eng.player.y}`);
      }
    } else if (cmd === '/speed') {
      if (!checkPerm('speed')) return this.addMessage('system', 'System', 'You do not have permission to use /speed.');
      eng.player.speed = parseFloat(args[1]) || eng.player.speed;
      eng.player.runSpeed = eng.player.speed * 2.25;
      this.addMessage('system', 'System', `Speed set to ${eng.player.speed}`);
    } else if (cmd === '/stuck') {
      eng.player.x += 64; eng.player.y += 64;
      eng.camera.x = eng.player.x; eng.camera.y = eng.player.y;
      this.addMessage('system', 'System', 'Nudged out of stuck position.');
    } else if (cmd === '/heal') {
      if (!checkPerm('heal')) return this.addMessage('system', 'System', 'You do not have permission to use /heal.');
      eng.player.hp = eng.player.maxHp;
      eng.ui.update();
      this.addMessage('system', 'System', 'You have been fully healed.');
    } else if (cmd === '/noclip') {
      if (!checkPerm('editmode')) return this.addMessage('system', 'System', 'You do not have permission to use /noclip.');
      eng.noclip = !eng.noclip;
      this.addMessage('system', 'System', `Noclip ${eng.noclip ? 'ENABLED' : 'DISABLED'}.`);
    } else if (cmd === '/editmode') {
      if (!checkPerm('editmode')) return this.addMessage('system', 'System', 'You do not have permission to use /editmode.');
      eng.editMode = !eng.editMode;
      const bPanel = document.getElementById('builder-panel');
      const bHotbar = document.getElementById('builder-hotbar');
      if (bPanel) bPanel.style.display = eng.editMode ? 'flex' : 'none';
      if (bHotbar) bHotbar.style.display = eng.editMode ? 'flex' : 'none';
      if (!eng.editMode) {
        eng.selectedTiles = [];
        eng.isDraggingSelection = false;
      }
      this.addMessage('system', 'System', eng.editMode ? 'Edit Mode ENABLED.' : 'Edit Mode DISABLED.');
    } else if (cmd === '/reload') {
      if (!checkPerm('reload')) return this.addMessage('system', 'System', 'You do not have permission to use /reload.');
      this.addMessage('system', 'System', 'Hot-reloading game engine...');
      if (!eng.playerData.position) eng.playerData.position = {};
      eng.playerData.position.x = eng.player.x;
      eng.playerData.position.y = eng.player.y;
      const oldEditMode = eng.editMode;
      eng.stop(); 
      import(`./engine.js?v=${Date.now()}`).then(module => {
        window.currentGameEngine = new module.GameEngine(eng.canvas.id, eng.playerData);
        if (oldEditMode) {
          window.currentGameEngine.editMode = true;
          const bPanel = document.getElementById('builder-panel');
          const bHotbar = document.getElementById('builder-hotbar');
          if (bPanel) bPanel.style.display = 'flex';
          if (bHotbar) bHotbar.style.display = 'flex';
        }
      });
    } else if (cmd === '/dev') {
      if (!checkPerm('dev')) return this.addMessage('system', 'System', 'You do not have permission to use /dev.');
      const devPanel = document.getElementById('dev-panel');
      if (devPanel) devPanel.style.display = devPanel.style.display === 'none' ? 'flex' : 'none';
    } else if (cmd === '/npc') {
      if (!checkPerm('npc')) return this.addMessage('system', 'System', 'You do not have permission to use /npc commands.');
      if (args.length >= 4 && args[1] === 'create') {
        const npcName = args.slice(2, args.length - 1).join(' '); 
        const health = parseInt(args[args.length - 1], 10);
        const sx = eng.mousePos.x - (eng.canvas.width / 2);
        const sy = eng.mousePos.y - (eng.canvas.height / 2) - (eng.camera.z || 0);
        const A = sx + eng.camera.x - eng.camera.y;
        const B = (sy / eng.tilt) + eng.camera.x + eng.camera.y; 
        eng.socket.emit('create_npc', { name: npcName, maxHp: health, x: (A + B) / 2, y: (B - A) / 2 });
      } else {
        this.addMessage('system', 'System', `Usage: /npc create <Name> <Health>`);
      }
    } else if (cmd.startsWith('/')) {
      const emoteText = `*${msg.substring(1)}*`;
      this.addMessage('local', eng.playerData.name, emoteText);
      eng.socket.emit('chat_message', { type: 'local', text: emoteText });
      if (!eng.player.chatBubbles) eng.player.chatBubbles = [];
      eng.player.chatBubbles.push({ text: emoteText, timer: 4000, opacity: 0 });
    }
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  drawBubbles(ctx, x, y, bubbles) {
    if (!bubbles || bubbles.length === 0) return;

    ctx.save();
    ctx.font = 'bold 12px monospace';
    const maxWidth = 180;
    const lineHeight = 16;
    const padding = 8;
    const pointerHeight = 8;

    let currentTargetY = 0;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (!b.lines) {
        b.lines = this.wrapText(ctx, b.text, maxWidth);
        b.width = Math.max(...b.lines.map(l => ctx.measureText(l).width)) + padding * 2;
        b.height = b.lines.length * lineHeight + padding * 2;
      }
      
      b.targetY = currentTargetY;
      currentTargetY += b.height + 5; 
    }

    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, b.opacity || 1));
      
      const bubbleY = y - (b.currentY || 0) - pointerHeight;
      
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;

      if (i === bubbles.length - 1) {
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 2);
        ctx.lineTo(x + 6, y - 2);
        ctx.lineTo(x, y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - 5, y - 2);
        ctx.lineTo(x + 5, y - 2);
        ctx.lineTo(x, y + 6);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
      }

      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - b.width / 2, bubbleY - b.height, b.width, b.height, 6);
      else ctx.rect(x - b.width / 2, bubbleY - b.height, b.width, b.height);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      b.lines.forEach((line, lineIndex) => {
        const lineY = bubbleY - b.height + padding + (lineIndex * lineHeight) + (lineHeight / 2);
        ctx.fillText(line, x, lineY);
      });
    }
    ctx.restore();
  }
}
