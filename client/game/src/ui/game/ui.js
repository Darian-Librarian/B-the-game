export class UIManager {
  constructor(engine) {
    this.engine = engine;
    this.setupDevTools();
    this.setupBuilderTools();
    this.setupInventory();
    this.setupContextMenu();
    this.setupTradeUI();
  }

  setupDevTools() {
    const eng = this.engine;
    const devPanel = document.getElementById('dev-panel');
    if (devPanel) {
      document.getElementById('btn-close-dev').onclick = () => devPanel.style.display = 'none';

      const setupDevBtn = (id, prop, color) => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.style.borderColor = eng.devOptions[prop] ? color : '';
          btn.style.color = eng.devOptions[prop] ? color : '';
          btn.onclick = () => {
            eng.devOptions[prop] = !eng.devOptions[prop];
            btn.style.borderColor = eng.devOptions[prop] ? color : '';
            btn.style.color = eng.devOptions[prop] ? color : '';
            localStorage.setItem('b_dev_options', JSON.stringify(eng.devOptions));
          };
        }
      };

      setupDevBtn('btn-dev-player', 'showPlayerPos', '#ff4757');
      setupDevBtn('btn-dev-player-tile', 'showPlayerTile', '#ff4757');
      setupDevBtn('btn-dev-mouse', 'showMousePos', '#ff4757');
      setupDevBtn('btn-dev-melee', 'showMelee', '#ff4757');
      setupDevBtn('btn-dev-hitbox', 'showHitboxes', '#ff4757');
      setupDevBtn('btn-dev-tile', 'showTile', '#ff4757');
      setupDevBtn('btn-dev-chunk', 'showChunk', '#ff4757');
    }
  }

  setupBuilderTools() {
    const eng = this.engine;
    const builderPanel = document.getElementById('builder-panel');
    if (builderPanel) {
      document.getElementById('btn-close-builder').onclick = () => builderPanel.style.display = 'none';
      const setupBuilderBtn = (id, prop) => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.style.borderColor = eng.devOptions[prop] ? '#3498db' : '';
          btn.style.color = eng.devOptions[prop] ? '#3498db' : '';
          btn.onclick = () => {
            eng.devOptions[prop] = !eng.devOptions[prop];
            btn.style.borderColor = eng.devOptions[prop] ? '#3498db' : '';
            btn.style.color = eng.devOptions[prop] ? '#3498db' : '';
            localStorage.setItem('b_dev_options', JSON.stringify(eng.devOptions));
          };
        }
      };
      setupBuilderBtn('btn-build-tile', 'showTile');
      setupBuilderBtn('btn-build-chunk', 'showChunk');
      setupBuilderBtn('btn-build-coords', 'showMousePos');
    }

    const builderHotbar = document.getElementById('builder-hotbar');
    if (builderHotbar) {
      let selectedColor = '#ffffff';
      const colorPicker = document.getElementById('build-color-picker');
      if (colorPicker) colorPicker.addEventListener('input', (e) => selectedColor = e.target.value);

      builderHotbar.querySelectorAll('.hotbar-slot').forEach(slot => {
        slot.addEventListener('click', () => {
          builderHotbar.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
          slot.classList.add('active');
          if (eng.selectedTiles.length > 0) {
            const updates = [];
            if (slot.dataset.tex === 'level') {
              const baseKey = `${eng.selectedTiles[0].x},${eng.selectedTiles[0].y}`;
              const baseTile = eng.mapData[baseKey];
              const targetZ = (baseTile && baseTile.z) ? baseTile.z : 0;
              
              eng.selectedTiles.forEach(tile => {
                const key = `${tile.x},${tile.y}`;
                const td = eng.mapData[key];
                if (!td && targetZ > 0) {
                  eng.mapData[key] = { tex: 'stone', color: selectedColor, z: targetZ };
                  updates.push({ x: tile.x, y: tile.y, tex: 'stone', color: selectedColor, z: targetZ });
                } else if (td) {
                  const newColor = typeof td === 'object' ? td.color : '#ffffff';
                  const newTex = typeof td === 'object' ? td.tex : td;
                  eng.mapData[key] = { tex: newTex, color: newColor, z: targetZ };
                  updates.push({ x: tile.x, y: tile.y, tex: newTex, color: newColor, z: targetZ });
                }
              });
            } else {
              eng.selectedTiles.forEach(tile => {
                const existingZ = (eng.mapData[`${tile.x},${tile.y}`] && eng.mapData[`${tile.x},${tile.y}`].z) ? eng.mapData[`${tile.x},${tile.y}`].z : 0;
                if (slot.dataset.tex === 'erase') {
                  delete eng.mapData[`${tile.x},${tile.y}`];
                  updates.push({ x: tile.x, y: tile.y, tex: null });
                } else {
                  eng.mapData[`${tile.x},${tile.y}`] = { tex: slot.dataset.tex, color: selectedColor, z: existingZ };
                  updates.push({ x: tile.x, y: tile.y, tex: slot.dataset.tex, color: selectedColor, z: existingZ });
                }
              });
            }
            eng.socket.emit('map_update', updates);
          }
        });
      });
    }
  }

  setupInventory() {
    const btnInv = document.getElementById('btn-inventory');
    const invPanel = document.getElementById('inventory-panel');
    if (btnInv && invPanel) {
      btnInv.onclick = () => {
        invPanel.style.display = invPanel.style.display === 'none' ? 'flex' : 'none';
        this.renderInventory();
      };
      document.getElementById('btn-close-inventory').onclick = () => invPanel.style.display = 'none';
    }
  }

  renderInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    this.engine.playerData.inventory = this.engine.playerData.inventory || [];
    const inv = this.engine.playerData.inventory;
    
    for (let i = 0; i < 16; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      if (inv[i]) {
        slot.innerHTML = `<span>${inv[i].icon || '📦'}</span><span class="inv-qty">${inv[i].qty}</span>`;
        slot.draggable = true;
        slot.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'inventory', index: i }));
        
        // Custom Tooltip Logic
        slot.onmouseenter = (e) => {
          const tooltip = document.getElementById('item-tooltip');
          if (tooltip) {
            tooltip.innerHTML = `<strong style="color: var(--accent-neon);">${inv[i].name}</strong><br><span style="color: #aaa;">Quantity: ${inv[i].qty}</span>`;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
          }
        };
        slot.onmousemove = (e) => {
          const tooltip = document.getElementById('item-tooltip');
          if (tooltip) {
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
          }
        };
        slot.onmouseleave = () => {
          const tooltip = document.getElementById('item-tooltip');
          if (tooltip) tooltip.style.display = 'none';
        };
      }
      
      // Drop Zone Logic
      slot.ondragover = (e) => e.preventDefault();
      slot.ondrop = (e) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.source === 'trade' && this.currentTrade) {
            const temp = inv[i];
            inv[i] = this.currentTrade.self[data.index];
            this.currentTrade.self[data.index] = temp || null;
            this.renderInventory();
            this.renderTradeGrids();
        } else if (data.source === 'inventory') {
            const temp = inv[i];
            inv[i] = inv[data.index];
            inv[data.index] = temp || null;
            this.renderInventory();
        }
      };
      
      grid.appendChild(slot);
    }

    const currencyEl = document.getElementById('inv-currency');
    if (currencyEl) currencyEl.innerText = (this.engine.playerData.currency || 0).toLocaleString();
  }

  setupTradeUI() {
    const tradePanel = document.getElementById('trade-panel');
    const btnCloseTrade = document.getElementById('btn-close-trade');
    const btnAcceptTrade = document.getElementById('btn-trade-accept');

    const tradeCurrencyInput = document.getElementById('trade-offer-currency');
    if (tradeCurrencyInput) {
      tradeCurrencyInput.oninput = (e) => {
        let val = parseInt(e.target.value, 10) || 0;
        if (val < 0) val = 0;
        if (val > (this.engine.playerData.currency || 0)) val = this.engine.playerData.currency || 0;
        e.target.value = val;
      };
    }

    if (tradePanel) {
      if (btnCloseTrade) btnCloseTrade.onclick = () => this.closeTrade();
      if (btnAcceptTrade) btnAcceptTrade.onclick = () => {
        btnAcceptTrade.innerText = "Accepted!";
        btnAcceptTrade.style.pointerEvents = 'none';
        btnAcceptTrade.style.background = 'rgba(46, 204, 113, 0.2)';
        btnAcceptTrade.style.borderColor = '#2ecc71';
        btnAcceptTrade.style.color = '#2ecc71';
      };
    }
  }

  closeTrade() {
    const tradePanel = document.getElementById('trade-panel');
    if (tradePanel) tradePanel.style.display = 'none';

    if (this.currentTrade) {
      const inv = this.engine.playerData.inventory || [];
      this.currentTrade.self.forEach(item => {
        if (item) {
          let placed = false;
          for (let i = 0; i < 16; i++) {
            if (!inv[i]) {
              inv[i] = item;
              placed = true;
              break;
            }
          }
          if (!placed) inv.push(item);
        }
      });
      this.currentTrade = null;
      this.renderInventory();
    }
  }

  renderTradeGrids() {
    const gridSelf = document.getElementById('trade-grid-self');
    const gridPartner = document.getElementById('trade-grid-partner');
    if (!gridSelf || !gridPartner || !this.currentTrade) return;

    gridSelf.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slotS = document.createElement('div'); 
      slotS.className = 'inv-slot'; 
      const item = this.currentTrade.self[i];
      if (item) {
        slotS.innerHTML = `<span>${item.icon || '📦'}</span><span class="inv-qty">${item.qty}</span>`;
        slotS.draggable = true;
        slotS.ondragstart = (e) => e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'trade', index: i }));
        
        slotS.onmouseenter = (e) => {
          const tooltip = document.getElementById('item-tooltip');
          if (tooltip) {
            tooltip.innerHTML = `<strong style="color: var(--accent-neon);">${item.name}</strong><br><span style="color: #aaa;">Quantity: ${item.qty}</span>`;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
          }
        };
        slotS.onmousemove = (e) => {
          const tooltip = document.getElementById('item-tooltip');
          if (tooltip) { tooltip.style.left = (e.clientX + 15) + 'px'; tooltip.style.top = (e.clientY + 15) + 'px'; }
        };
        slotS.onmouseleave = () => {
          const tooltip = document.getElementById('item-tooltip');
          if (tooltip) tooltip.style.display = 'none';
        };
      }

      slotS.ondragover = (e) => e.preventDefault();
      slotS.ondrop = (e) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.source === 'inventory') {
            this.engine.playerData.inventory = this.engine.playerData.inventory || [];
            const inv = this.engine.playerData.inventory;
            const temp = this.currentTrade.self[i];
            this.currentTrade.self[i] = inv[data.index];
            inv[data.index] = temp || null;
            this.renderInventory();
            this.renderTradeGrids();
        } else if (data.source === 'trade') {
            const temp = this.currentTrade.self[i];
            this.currentTrade.self[i] = this.currentTrade.self[data.index];
            this.currentTrade.self[data.index] = temp || null;
            this.renderTradeGrids();
        }
      };
      gridSelf.appendChild(slotS);
    }

    gridPartner.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slotP = document.createElement('div'); 
      slotP.className = 'inv-slot'; 
      const item = this.currentTrade.partner[i];
      if (item) {
        slotP.innerHTML = `<span>${item.icon || '📦'}</span><span class="inv-qty">${item.qty}</span>`;
      }
      gridPartner.appendChild(slotP);
    }
  }

  openTrade(partnerName) {
    const tradePanel = document.getElementById('trade-panel');
    if (tradePanel) {
      document.getElementById('trade-partner-name').innerText = partnerName;
      tradePanel.style.display = 'flex';
      
      this.currentTrade = { self: new Array(9).fill(null), partner: new Array(9).fill(null) };
      
      const tradeCurrencyInput = document.getElementById('trade-offer-currency');
      if (tradeCurrencyInput) tradeCurrencyInput.value = '0';
      const tradePartnerCurrency = document.getElementById('trade-partner-currency');
      if (tradePartnerCurrency) tradePartnerCurrency.innerText = '0';

      const btnAcceptTrade = document.getElementById('btn-trade-accept');
      if (btnAcceptTrade) {
        btnAcceptTrade.innerText = "Accept Trade";
        btnAcceptTrade.style.pointerEvents = 'auto';
        btnAcceptTrade.className = 'btn-primary';
        btnAcceptTrade.style.background = '';
        btnAcceptTrade.style.borderColor = '';
        btnAcceptTrade.style.color = '';
      }

      this.renderTradeGrids();
    }
  }

  setupContextMenu() {
    const btnTrade = document.getElementById('ctx-btn-trade');
    if (btnTrade) {
      btnTrade.onclick = () => {
        if (this.engine.contextTarget) {
          this.engine.socket.emit('trade_request', this.engine.contextTarget);
          this.engine.chat.addMessage('system', 'System', `Trade request sent to ${this.engine.otherPlayers[this.engine.contextTarget]?.name || 'Player'}.`);
        }
        document.getElementById('player-context-menu').style.display = 'none';
      };
    }
  }

  update() {
    const eng = this.engine;
    const hpFill = document.getElementById('health-bar-fill');
    const hpText = document.getElementById('health-bar-text');
    const epFill = document.getElementById('energy-bar-fill');
    const epText = document.getElementById('energy-bar-text');

    if (hpFill) hpFill.style.width = `${(eng.player.hp / eng.player.maxHp) * 100}%`;
    if (hpText) hpText.innerText = `${Math.floor(eng.player.hp)} / ${eng.player.maxHp}`;
    
    if (epFill) epFill.style.width = `${(eng.player.energy / eng.player.maxEnergy) * 100}%`;
    if (epText) epText.innerText = `${Math.floor(eng.player.energy)} / ${eng.player.maxEnergy}`;

    // Target Window Updates
    const targetWindow = document.getElementById('target-window');
    if (eng.selectedTarget && targetWindow) {
      let targetObj = null;
      let tName = '';
      if (eng.selectedTarget.type === 'npc') {
        targetObj = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
        if (targetObj) tName = targetObj.name;
      } else if (eng.selectedTarget.type === 'player') {
        targetObj = eng.otherPlayers[eng.selectedTarget.id];
        if (targetObj) tName = targetObj.name;
      } else if (eng.selectedTarget.type === 'self') {
        targetObj = eng.player;
        tName = eng.playerData.name;
      }

      if (targetObj && targetObj.state !== 'dead' && targetObj.state !== 'death') {
        targetWindow.style.display = 'flex';
        document.getElementById('target-name').innerText = tName;
        const hpPercent = Math.max(0, targetObj.hp / targetObj.maxHp);
        document.getElementById('target-health-fill').style.width = `${hpPercent * 100}%`;
        const hpTextEl = document.getElementById('target-health-text');
        if (hpTextEl) hpTextEl.innerText = `${Math.floor(targetObj.hp)} / ${targetObj.maxHp}`;

        const maxEp = targetObj.maxEnergy || 1000;
        const epPercent = Math.max(0, (targetObj.energy || maxEp) / maxEp);
        document.getElementById('target-energy-fill').style.width = `${epPercent * 100}%`;
        const epTextEl = document.getElementById('target-energy-text');
        if (epTextEl) epTextEl.innerText = `${Math.floor(targetObj.energy || maxEp)} / ${maxEp}`;
      } else {
        targetWindow.style.display = 'none';
        eng.selectedTarget = null;
      }
    } else if (targetWindow) {
      targetWindow.style.display = 'none';
    }
  }
}
