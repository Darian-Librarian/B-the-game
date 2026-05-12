export class UIManager {
  constructor(engine) {
    this.engine = engine;
    this.setupDevTools();
    this.setupBuilderTools();
    this.setupInventory();
    this.setupPowersUI();
    this.setupContextMenu();
    this.setupTradeUI();
    this.setupPowerbar();

    this.makeDraggable('dev-panel', '.dev-panel-header');
    this.makeDraggable('builder-panel', '.dev-panel-header');
    this.makeDraggable('npc-manager-panel', '.dev-panel-header');
    this.makeDraggable('npc-edit-modal', '.dev-panel-header');
    this.makeDraggable('inventory-panel', '.dev-panel-header');
    this.makeDraggable('powers-panel', '.dev-panel-header');
    this.makeDraggable('trade-panel', '.dev-panel-header');
    this.makeDraggable('trainer-dialog-modal', '.dev-panel-header');
  }

  makeDraggable(panelId, headerSelector) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const header = panel.querySelector(headerSelector);
    if (!header) return;

    header.style.cursor = 'move';
    header.style.userSelect = 'none';

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return; // Don't drag if clicking the X
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = panel.getBoundingClientRect();
      // Convert panel to absolute positioning without transforms for reliable dragging
      if (panel.style.transform) {
        panel.style.transform = 'none';
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
      }
      
      initialLeft = panel.offsetLeft;
      initialTop = panel.offsetTop;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        panel.style.left = `${initialLeft + dx}px`;
        panel.style.top = `${initialTop + dy}px`;
        panel.style.right = 'auto'; // Clear constraints
        panel.style.bottom = 'auto';
      };

      const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  setupPowerbar() {
    let container = document.getElementById('powerbar-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'powerbar-container';
        
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            const scaler = gameScreen.querySelector('.screen-scaler');
            if (scaler) scaler.appendChild(container);
            else gameScreen.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    }
    container.style.cssText = 'position: absolute; bottom: 75px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 999999; padding: 10px; background: rgba(5, 7, 10, 0.85); border: 2px solid #333; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.8); pointer-events: auto;';

    container.innerHTML = '';
    this.powerSlots = [];
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    
    for (let i = 0; i < 10; i++) {
        const slot = document.createElement('div');
        slot.className = 'powerbar-slot';
        slot.style.cssText = 'width: 44px; height: 44px; background: rgba(0, 0, 0, 0.7); border: 2px solid #444; border-radius: 4px; position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);';
        
        const keyLabel = document.createElement('span');
        keyLabel.innerText = keys[i];
        keyLabel.style.cssText = 'position: absolute; top: 2px; left: 4px; font-size: 0.75rem; font-weight: bold; color: #888; font-family: var(--font-mono, monospace); text-shadow: 1px 1px 0 #000;';
        
        const iconOrName = document.createElement('div');
        iconOrName.style.cssText = 'color: #fff; font-size: 0.7rem; font-family: var(--font-header, sans-serif); text-align: center; line-height: 1.1; pointer-events: none; padding: 0 2px; word-wrap: break-word; overflow: hidden; max-height: 30px; text-shadow: 1px 1px 0 #000;';
        
        slot.appendChild(keyLabel);
        slot.appendChild(iconOrName);
        container.appendChild(slot);
        
        slot.onmouseenter = () => {
            const powers = this.engine.playerData.powers || [];
            const powerName = powers[i];
            if (powerName) slot.style.background = 'rgba(52, 152, 219, 0.4)';
        };
        slot.onmouseleave = () => slot.style.background = 'rgba(0, 0, 0, 0.7)';
        
        slot.onclick = () => {
            const powers = this.engine.playerData.powers || [];
            const powerName = powers[i];
            if (powerName) {
                if (powerName === 'Brawl') this.engine.combat?.triggerAttack();
            }
        };

        this.powerSlots.push({ element: slot, iconEl: iconOrName });
    }
    this.updatePowerbar();
  }

  updatePowerbar() {
      if (!this.powerSlots) return;
      const powers = this.engine.playerData.powers || [];
      
      for (let i = 0; i < 10; i++) {
          const slotData = this.powerSlots[i];
          const powerName = powers[i];
          if (powerName) {
              const words = powerName.split(' ');
              let displayTxt = powerName;
              if (displayTxt.length > 8) {
                  displayTxt = words.map(w => w[0]).join('').toUpperCase();
                  if (words.length === 1) displayTxt = displayTxt.substring(0, 6) + '..';
              }
              slotData.iconEl.innerText = displayTxt;
              slotData.element.style.borderColor = 'var(--accent-neon, #3498db)';
              slotData.element.title = powerName;
          } else {
              slotData.iconEl.innerText = '';
              slotData.element.style.borderColor = '#444';
              slotData.element.title = 'Empty Slot';
          }
      }
  }

  setupPowersUI() {
    const btnPowers = document.getElementById('btn-powers');
    const powersPanel = document.getElementById('powers-panel');
    if (btnPowers && powersPanel) {
      btnPowers.onclick = (e) => {
        e.stopPropagation();
        powersPanel.style.display = powersPanel.style.display === 'none' ? 'flex' : 'none';
        if (powersPanel.style.display === 'flex') this.renderPowersUI();
      };
      const btnClose = document.getElementById('btn-close-powers');
      if (btnClose) btnClose.onclick = () => powersPanel.style.display = 'none';
    }
  }

  renderPowersUI() {
    const pd = this.engine.playerData;
    const level = pd.level || 1;
    
    const elLevel = document.getElementById('powers-level-text');
    const elLearned = document.getElementById('powersets-learned-text');
    const elPicks = document.getElementById('powers-picks-text');
    const elSets = document.getElementById('powersets-picks-text');
    const elSlots = document.getElementById('powers-slots-text');
    const listContainer = document.getElementById('powers-list-container');
    
    if (!listContainer) return;

    const totalPowerPicks = pd.unspentPowerPicks !== undefined ? pd.unspentPowerPicks : 0;
    const totalPowersetPicks = pd.unspentPowersetPicks !== undefined ? pd.unspentPowersetPicks : 0;
    const learnedSetsCount = pd.powersets ? pd.powersets.length : 0;
    const totalEnhancementSlots = Math.ceil(level / 2) * 2;
    
    if (elLevel) elLevel.innerText = level;
    if (elPicks) elPicks.innerText = totalPowerPicks;
    if (elSets) elSets.innerText = totalPowersetPicks;
    if (elSlots) elSlots.innerText = totalEnhancementSlots;
    if (elLearned) elLearned.innerText = learnedSetsCount;
    
    listContainer.innerHTML = '';
    const powers = pd.powers || [];
    
    if (powers.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px; font-family: var(--font-mono); font-size: 0.9rem;">No powers selected.</div>`;
    } else {
      powers.forEach(pName => {
        const pDiv = document.createElement('div');
        pDiv.style.cssText = 'background: rgba(0,0,0,0.4); border: 1px solid var(--text-dim); padding: 10px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono);';
        pDiv.innerHTML = `
          <span style="color: var(--accent-neon); font-weight: bold; font-size: 0.95rem;">${pName}</span>
          <div style="display: flex; gap: 5px;">
            <div style="width: 14px; height: 14px; background: rgba(52, 152, 219, 0.1); border: 1px solid #3498db; border-radius: 50%;" title="Enhancement Slot (Empty)"></div>
            <div style="width: 14px; height: 14px; background: rgba(52, 152, 219, 0.1); border: 1px solid #3498db; border-radius: 50%;" title="Enhancement Slot (Empty)"></div>
          </div>
        `;
        listContainer.appendChild(pDiv);
      });
    }
  }

  setupDevTools() {
    const eng = this.engine;
    const devPanel = document.getElementById('dev-panel');
    if (devPanel) {
      document.getElementById('btn-close-dev').onclick = () => devPanel.style.display = 'none';

      const setupDevBtn = (id, prop, color, labelText) => {
        let btn = document.getElementById(id);
        if (!btn && devPanel) {
           btn = document.createElement('button');
           btn.id = id;
           btn.className = 'btn-secondary';
           btn.innerText = labelText || id;
           btn.style.cssText = 'width: 100%; margin-top: 5px;';
           const referenceNode = document.getElementById('btn-dev-mouse');
           if (referenceNode && referenceNode.parentNode) {
               referenceNode.parentNode.insertBefore(btn, referenceNode.nextSibling);
           } else {
               devPanel.appendChild(btn);
           }
        }
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

      setupDevBtn('btn-dev-player', 'showPlayerPos', '#ff4757', 'Toggle Player Pos');
      setupDevBtn('btn-dev-player-tile', 'showPlayerTile', '#ff4757', 'Toggle Player Tile');
      setupDevBtn('btn-dev-entity', 'showEntityPos', '#ff4757', 'Toggle Entity Pos');
      setupDevBtn('btn-dev-entity-tile', 'showEntityTile', '#ff4757', 'Toggle Entity Tile');
      setupDevBtn('btn-dev-mouse', 'showMousePos', '#ff4757', 'Toggle Mouse Pos');
      setupDevBtn('btn-dev-melee', 'showMelee', '#ff4757', 'Toggle Melee Range');
      setupDevBtn('btn-dev-hitbox', 'showHitboxes', '#ff4757', 'Toggle Hitboxes');
      setupDevBtn('btn-dev-tile', 'showTile', '#ff4757', 'Toggle Tile Grids');
      setupDevBtn('btn-dev-chunk', 'showChunk', '#ff4757', 'Toggle Chunk Grids');
      setupDevBtn('btn-dev-dist-npc', 'showDistToNPC', '#f1c40f', 'Dist: Player to NPC');
      setupDevBtn('btn-dev-dist-mouse', 'showDistNpcToMouse', '#f1c40f', 'Dist: NPC to Mouse');

      const btnEditTarget = document.getElementById('btn-dev-edit-target');
      if (btnEditTarget) {
        btnEditTarget.onclick = () => {
          if (eng.selectedTarget && eng.selectedTarget.type === 'npc') {
            const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
            if (npc) {
              document.getElementById('edit-npc-uuid').value = npc.uuid;
              document.getElementById('edit-npc-name').value = npc.name;
              document.getElementById('edit-npc-hp').value = Math.floor(npc.hp);
              document.getElementById('edit-npc-maxhp').value = npc.maxHp;
              document.getElementById('edit-npc-energy').value = Math.floor(npc.energy || 1000);
              document.getElementById('edit-npc-x').value = Math.round(npc.x);
              document.getElementById('edit-npc-y').value = Math.round(npc.y);
              document.getElementById('edit-npc-z').value = Math.round(npc.z || 0);
              document.getElementById('edit-npc-type').value = npc.type || 'idle';
              document.getElementById('edit-npc-dir').value = npc.dir || 'down';
              
              document.getElementById('npc-edit-modal').style.display = 'flex';
            }
          }
        };
      }

      const btnNpcManager = document.getElementById('btn-dev-npc-manager');
      const npcPanel = document.getElementById('npc-manager-panel');
      if (btnNpcManager && npcPanel) {
        btnNpcManager.onclick = () => {
          npcPanel.style.display = 'flex';
          this.renderNpcManager();
        };
        document.getElementById('btn-close-npc-manager').onclick = () => npcPanel.style.display = 'none';

        document.getElementById('btn-close-npc-edit').onclick = () => document.getElementById('npc-edit-modal').style.display = 'none';
        
        document.getElementById('btn-edit-npc-tp-me').onclick = () => {
          document.getElementById('edit-npc-x').value = Math.round(eng.player.x);
          document.getElementById('edit-npc-y').value = Math.round(eng.player.y);
          document.getElementById('edit-npc-z').value = Math.round(eng.player.z || 0);
          emitNpcUpdate();
        };

        const emitNpcUpdate = () => {
          const uuid = document.getElementById('edit-npc-uuid').value;
          if (!uuid) return;
          const energyVal = parseFloat(document.getElementById('edit-npc-energy').value);
          const updates = {
            name: document.getElementById('edit-npc-name').value,
            hp: parseFloat(document.getElementById('edit-npc-hp').value),
            maxHp: parseFloat(document.getElementById('edit-npc-maxhp').value),
            energy: energyVal,
            maxEnergy: energyVal, // Sync max energy automatically!
            x: parseFloat(document.getElementById('edit-npc-x').value),
            y: parseFloat(document.getElementById('edit-npc-y').value),
            z: parseFloat(document.getElementById('edit-npc-z').value),
            type: document.getElementById('edit-npc-type').value,
            dir: document.getElementById('edit-npc-dir').value
          };
          eng.socket.emit('edit_npc', { uuid, updates });
        };

        // Fire updates over the socket instantly as the developer types or selects!
        ['edit-npc-name', 'edit-npc-hp', 'edit-npc-maxhp', 'edit-npc-energy', 'edit-npc-x', 'edit-npc-y', 'edit-npc-z'].forEach(id => {
          document.getElementById(id).addEventListener('input', emitNpcUpdate);
        });
        ['edit-npc-type', 'edit-npc-dir'].forEach(id => {
          document.getElementById(id).addEventListener('change', emitNpcUpdate);
        });

        document.getElementById('btn-save-npc-edit').onclick = () => document.getElementById('npc-edit-modal').style.display = 'none';

        eng.socket.on('npc_deleted', (uuid) => {
          const idx = eng.npcs.findIndex(n => n.uuid === uuid);
          if (idx !== -1) eng.npcs.splice(idx, 1);
          if (npcPanel.style.display === 'flex') this.renderNpcManager();
        });
        eng.socket.on('npc_spawned', () => {
          if (npcPanel.style.display === 'flex') this.renderNpcManager();
        });
        eng.socket.on('npc_updated', (updatedNpc) => {
          const idx = eng.npcs.findIndex(n => n.uuid === updatedNpc.uuid);
          if (idx !== -1) {
            Object.assign(eng.npcs[idx], updatedNpc);
          }
          if (npcPanel.style.display === 'flex') this.renderNpcManager();
        });
      }
    }
  }

  renderNpcManager() {
    const list = document.getElementById('npc-manager-list');
    if (!list) return;
    list.innerHTML = '';

    if (this.engine.npcs.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">No NPCs found in the world.</div>`;
      return;
    }

    this.engine.npcs.forEach(npc => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.5); border: 1px solid var(--text-dim); padding: 10px; border-radius: 4px;';
      
      const type = npc.type || 'idle';
      const group = npc.group || 'Civilian';
      const notes = npc.notes || '';
      const z = npc.z || 0;

      row.innerHTML = `
        <button class="btn-edit btn-secondary" style="width: auto; height: auto; padding: 5px; border-color: #f39c12; color: #f39c12; font-weight: bold; margin-right: 5px; font-size: 0.9rem;" title="Edit NPC">✎</button>
        <div style="flex: 1.5; font-weight: bold; color: var(--accent-neon); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${npc.name}">${npc.name}</div>
        <div style="flex: 1.5; display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 0.85rem;">
          <span>X:${Math.round(npc.x)} Y:${Math.round(npc.y)} Z:${Math.round(z)}</span>
          <button class="btn-tp btn-secondary" style="padding: 2px 8px; font-size: 0.75rem; width: auto; height: auto;">TP</button>
        </div>
        <div style="flex: 1.5; font-family: var(--font-mono); font-size: 0.85rem; color: #aaa;">
          <div><span style="color:#fff;">Type:</span> ${type}</div>
          <div><span style="color:#fff;">Grp:</span> ${group}</div>
        </div>
        <div style="flex: 2; font-family: var(--font-mono); font-size: 0.8rem; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${notes}">
          ${notes || '<em style="opacity: 0.5;">No notes</em>'}
        </div>
        <button class="btn-del btn-secondary" style="width: auto; height: auto; padding: 5px 10px; border-color: #ff4757; color: #ff4757; font-weight: bold;">X</button>
      `;

      row.querySelector('.btn-edit').onclick = () => {
        document.getElementById('edit-npc-uuid').value = npc.uuid;
        document.getElementById('edit-npc-name').value = npc.name;
        document.getElementById('edit-npc-hp').value = Math.floor(npc.hp);
        document.getElementById('edit-npc-maxhp').value = npc.maxHp;
        document.getElementById('edit-npc-energy').value = Math.floor(npc.energy || 1000);
        document.getElementById('edit-npc-x').value = Math.round(npc.x);
        document.getElementById('edit-npc-y').value = Math.round(npc.y);
        document.getElementById('edit-npc-z').value = Math.round(npc.z || 0);
        document.getElementById('edit-npc-type').value = npc.type || 'idle';
        document.getElementById('edit-npc-dir').value = npc.dir || 'down';
        
        document.getElementById('npc-edit-modal').style.display = 'flex';
      };

      row.querySelector('.btn-tp').onclick = () => {
        this.engine.player.x = npc.x;
        this.engine.player.y = npc.y;
        this.engine.camera.x = npc.x;
        this.engine.camera.y = npc.y;
        this.engine.chat.addMessage('system', 'System', `Teleported to ${npc.name}.`);
      };

      row.querySelector('.btn-del').onclick = () => {
        if (confirm(`Are you absolutely sure you want to delete NPC: ${npc.name}?`)) {
          this.engine.socket.emit('delete_npc', npc.uuid);
        }
      };

      list.appendChild(row);
    });
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
        if (this.engine.contextTarget && this.engine.contextTarget.type === 'player') {
          this.engine.socket.emit('trade_request', this.engine.contextTarget.id);
          this.engine.chat.addMessage('system', 'System', `Trade request sent to ${this.engine.otherPlayers[this.engine.contextTarget.id]?.name || 'Player'}.`);
        }
        document.getElementById('player-context-menu').style.display = 'none';
      };
    }
    const btnTalk = document.getElementById('ctx-btn-talk');
    if (btnTalk) {
      btnTalk.onclick = () => {
        if (this.engine.contextTarget && this.engine.contextTarget.type === 'npc') {
          const npc = this.engine.npcs.find(n => n.uuid === this.engine.contextTarget.id);
          if (npc) {
            if (npc.type === 'trainer') {
              this.openTrainerUI(npc);
            } else {
              this.engine.chat.addMessage('system', 'System', 'This NPC has nothing to say.');
            }
          }
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

    const btnEditTarget = document.getElementById('btn-dev-edit-target');
    if (btnEditTarget) {
      if (eng.selectedTarget && eng.selectedTarget.type === 'npc') {
        btnEditTarget.disabled = false;
        btnEditTarget.style.opacity = '1';
        btnEditTarget.style.cursor = 'pointer';
      } else {
        btnEditTarget.disabled = true;
        btnEditTarget.style.opacity = '0.5';
        btnEditTarget.style.cursor = 'not-allowed';
      }
    }

    // Dynamically update the Edit Window if it is open and we click a new NPC!
    const npcEditModal = document.getElementById('npc-edit-modal');
    if (npcEditModal && npcEditModal.style.display !== 'none' && eng.selectedTarget && eng.selectedTarget.type === 'npc') {
      const uuidField = document.getElementById('edit-npc-uuid');
      if (uuidField && uuidField.value !== eng.selectedTarget.id) {
        const npc = eng.npcs.find(n => n.uuid === eng.selectedTarget.id);
        if (npc) {
          uuidField.value = npc.uuid;
          document.getElementById('edit-npc-name').value = npc.name;
          document.getElementById('edit-npc-hp').value = Math.floor(npc.hp);
          document.getElementById('edit-npc-maxhp').value = npc.maxHp;
          document.getElementById('edit-npc-energy').value = Math.floor(npc.energy || 1000);
          document.getElementById('edit-npc-x').value = Math.round(npc.x);
          document.getElementById('edit-npc-y').value = Math.round(npc.y);
          document.getElementById('edit-npc-z').value = Math.round(npc.z || 0);
          document.getElementById('edit-npc-type').value = npc.type || 'idle';
          document.getElementById('edit-npc-dir').value = npc.dir || 'down';
        }
      }
    }

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

        const targetActions = document.getElementById('target-actions');
        if (targetObj.type === 'trainer' && targetActions) {
            targetActions.style.display = 'block';
            document.getElementById('btn-target-talk').onclick = () => this.openTrainerUI(targetObj);
        } else if (targetActions) {
            targetActions.style.display = 'none';
        }
      } else {
        targetWindow.style.display = 'none';
        eng.selectedTarget = null;
      }
    } else if (targetWindow) {
      targetWindow.style.display = 'none';
    }

    if (eng.activeTrainer) {
      const dist = Math.hypot(eng.player.x - eng.activeTrainer.x, eng.player.y - eng.activeTrainer.y);
      if (dist > 150) {
        eng.activeTrainer = null;
        const tModal = document.getElementById('trainer-dialog-modal');
        if (tModal) tModal.style.display = 'none';
      }
    }
  }

  openTrainerUI(npc) {
    const dist = Math.hypot(this.engine.player.x - npc.x, this.engine.player.y - npc.y);
    if (dist > 150) {
        this.engine.chat.addMessage('system', 'System', 'You are too far away to interact.');
        return;
    }
    this.engine.activeTrainer = npc;
    document.getElementById('trainer-dialog-name').innerText = npc.name;
    const modal = document.getElementById('trainer-dialog-modal');
    if (modal) modal.style.display = 'flex';
    
    const btnCloseTrainer = document.getElementById('btn-close-trainer');
    if (btnCloseTrainer) btnCloseTrainer.onclick = () => {
        this.engine.activeTrainer = null;
        if (modal) modal.style.display = 'none';
    };

    const viewDialog = modal ? modal.querySelector('#trainer-dialog-view') : document.getElementById('trainer-dialog-view');
    const viewTraining = modal ? modal.querySelector('#trainer-training-view') : document.getElementById('trainer-training-view');
    if (viewDialog) viewDialog.style.display = 'block';
    if (viewTraining) viewTraining.style.display = 'none';
    
    const powerPicks = this.engine.playerData.unspentPowerPicks || 0;
    const setPicksRaw = this.engine.playerData.unspentPowersetPicks;
    let setPicksCount = Array.isArray(setPicksRaw) ? setPicksRaw.length : (typeof setPicksRaw === 'number' ? setPicksRaw : 0);

    if (viewDialog) {
        // Scorched earth rebuild: destroy everything inside the view and manually construct the perfect layout!
        viewDialog.innerHTML = `
            <p style="font-family: var(--font-mono); margin-bottom: 15px; color: #fff;">Hello, recruit. Ready to improve your skills?</p>
            <div id="trainer-actions-container" style="display: flex; flex-direction: column; gap: 5px;"></div>
        `;
        
        const actionsBox = viewDialog.querySelector('#trainer-actions-container');

        const btnUnlock = document.createElement('button');
        btnUnlock.id = 'btn-trainer-unlock';
        btnUnlock.innerText = 'Select New Powerset';
        btnUnlock.className = 'btn-primary';
        btnUnlock.style.cssText = 'border-color: #2ecc71; color: #2ecc71; background: rgba(46, 204, 113, 0.1); margin-top: 5px; width: 100%; text-align: left; padding: 10px; font-family: var(--font-header); letter-spacing: 1px; display: block;';
        
        if (setPicksCount <= 0) {
            btnUnlock.disabled = true;
            btnUnlock.style.opacity = '0.5';
            btnUnlock.style.cursor = 'not-allowed';
        } else {
            btnUnlock.disabled = false;
            btnUnlock.style.opacity = '1';
            btnUnlock.style.cursor = 'pointer';
        }
        btnUnlock.onclick = () => {
            if (setPicksCount <= 0) return;
            if (viewDialog) viewDialog.style.display = 'none';
            if (viewTraining) {
                viewTraining.style.display = 'flex';
                this.renderPowersetUnlockUI(viewTraining, powerPicks, setPicksRaw, () => {
                    viewTraining.style.display = 'none';
                    if (viewDialog) viewDialog.style.display = 'block';
                });
            }
        };

        const btnTrain = document.createElement('button');
        btnTrain.id = 'btn-trainer-train';
        btnTrain.innerText = 'Select New Abilities';
        btnTrain.className = 'btn-secondary';
        btnTrain.style.cssText = 'margin-top: 5px; width: 100%; text-align: left; padding: 10px; font-family: var(--font-header); letter-spacing: 1px; display: block;';

        if (powerPicks <= 0) {
            btnTrain.disabled = true;
            btnTrain.style.opacity = '0.5';
            btnTrain.style.cursor = 'not-allowed';
        } else {
            btnTrain.disabled = false;
            btnTrain.style.opacity = '1';
            btnTrain.style.cursor = 'pointer';
        }
        btnTrain.onclick = () => {
            if (powerPicks <= 0) {
              this.engine.chat.addMessage('system', 'System', 'You have no unspent power picks.');
              return;
            }
            if (viewDialog) viewDialog.style.display = 'none';
            if (viewTraining) {
                viewTraining.style.display = 'flex';
                this.renderTrainingUI(viewTraining);
            }
        };

        const btnEnhance = document.createElement('button');
        btnEnhance.id = 'btn-trainer-enhance';
        btnEnhance.innerText = 'Select New Enhancement Slots';
        btnEnhance.className = 'btn-secondary';
        btnEnhance.style.cssText = 'margin-top: 5px; width: 100%; text-align: left; padding: 10px; font-family: var(--font-header); letter-spacing: 1px; display: block;';
        btnEnhance.disabled = true;
        btnEnhance.style.opacity = '0.5';
        btnEnhance.style.cursor = 'not-allowed';

        const btnLeave = document.createElement('button');
        btnLeave.id = 'btn-trainer-leave';
        btnLeave.innerText = 'Leave (close)';
        btnLeave.className = 'btn-secondary';
        btnLeave.style.cssText = 'margin-top: 10px; width: 100%; text-align: left; padding: 10px; font-family: var(--font-mono); display: block;';
        btnLeave.onclick = () => {
            this.engine.activeTrainer = null;
            if (modal) modal.style.display = 'none';
        };
        
        actionsBox.appendChild(btnUnlock);
        actionsBox.appendChild(btnTrain);
        actionsBox.appendChild(btnEnhance);
        actionsBox.appendChild(btnLeave);
    }
  }

  renderTrainingUI(container) {
      let pd = this.engine.playerData;
      let powersets = pd.powersets || [];
      let powerPicks = pd.unspentPowerPicks || 0;
      let setPicksRaw = pd.unspentPowersetPicks;
      let setPicksCount = Array.isArray(setPicksRaw) ? setPicksRaw.length : (typeof setPicksRaw === 'number' ? setPicksRaw : 0);

      const renderList = () => {
        const hasPicks = powerPicks > 0 || setPicksCount > 0;
        container.innerHTML = `
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--text-dim); padding-bottom: 10px; font-family: var(--font-mono);">
             <span style="color: #f39c12; font-weight: bold;">Power Picks: ${powerPicks}</span>
             <span style="color: #f39c12; font-weight: bold;">Powerset Picks: ${setPicksCount}</span>
          </div>
          <div style="font-size: 0.9rem; color: #ccc; font-family: var(--font-mono); margin-top: 5px;">
            ${hasPicks ? 'Select a learned Powerset to train abilities:' : 'You have no unspent picks.'}
          </div>
          <div style="display: flex; flex-direction: column; gap: 5px; max-height: 200px; overflow-y: auto; font-family: var(--font-header); font-size: 1.1rem; letter-spacing: 1px; margin-top: 5px;">
             ${powersets.map((ps, i) => `<button class="btn-ps-select btn-secondary" data-index="${i}" style="text-align: left; padding: 10px;">${ps.toUpperCase()}</button>`).join('')}
          </div>
          <button id="btn-training-back" class="btn-secondary" style="margin-top: 10px; font-family: var(--font-mono);">Back</button>
        `;

        document.getElementById('btn-training-back').onclick = () => {
            document.getElementById('trainer-training-view').style.display = 'none';
            document.getElementById('trainer-dialog-view').style.display = 'block';
        };
        
        container.querySelectorAll('.btn-ps-select').forEach(btn => {
          btn.onclick = () => {
            const psName = powersets[parseInt(btn.dataset.index)];
            this.renderPowerSelectionUI(container, psName, powerPicks, setPicksRaw, renderList);
          };
        });
      };
      
      renderList();
  }

  renderPowerSelectionUI(container, psName, powerPicks, setPicksRaw, goBackCb) {
      let psData = this.engine.powersetsData[psName];
      let knownPowers = this.engine.playerData.powers || [];
      let currentPowerPicks = this.engine.playerData.unspentPowerPicks || 0;
      let setPicksCount = Array.isArray(setPicksRaw) ? setPicksRaw.length : (typeof setPicksRaw === 'number' ? setPicksRaw : 0);

      const renderPowerList = () => {
        container.innerHTML = `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--text-dim); padding-bottom: 10px; font-family: var(--font-mono);">
           <span style="color: #f39c12; font-weight: bold;">Power Picks: ${powerPicks}</span>
           <span style="color: #f39c12; font-weight: bold;">Powerset Picks: ${setPicksCount}</span>
        </div>
        <div style="font-size: 0.9rem; color: #ccc; font-family: var(--font-mono); margin-top: 5px;">Abilities in <strong style="color: var(--accent-neon);">${psName.toUpperCase()}</strong>:</div>
        <div id="power-select-list" style="display: flex; flex-direction: column; gap: 5px; max-height: 200px; overflow-y: auto; font-family: var(--font-header); font-size: 1.1rem; letter-spacing: 1px; margin-top: 5px;">
           <!-- Populated by JS -->
        </div>
        <button id="btn-power-back" class="btn-secondary" style="margin-top: 10px; font-family: var(--font-mono);">Back</button>
      `;
        document.getElementById('btn-power-back').onclick = goBackCb;

        const powerListContainer = document.getElementById('power-select-list');
        if (!psData || !psData.powers) {
          powerListContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">Could not load power details.</div>`;
          return;
        }

        const powerItems = [];

        const updateLocks = () => {
          powerItems.forEach((pItem, idx) => {
            if (idx > 1) {
              const prev1Active = powerItems[idx - 1].classList.contains('learned');
              const prev2Active = powerItems[idx - 2].classList.contains('learned');
              if (prev1Active || prev2Active) {
                pItem.classList.remove('locked');
                pItem.style.opacity = pItem.disabled ? '0.6' : '1';
                pItem.style.cursor = pItem.disabled ? 'not-allowed' : 'pointer';
              } else {
                pItem.classList.add('locked');
                pItem.style.opacity = '0.3';
                pItem.style.cursor = 'not-allowed';
              }
            }
          });
        };

        psData.powers.forEach((power, i) => {
          const alreadyLearned = knownPowers.includes(power.name);
          const canAfford = currentPowerPicks > 0;
          const isLocked = i >= 2;

          const pButton = document.createElement('button');
          pButton.className = `btn-secondary power-select-item ${alreadyLearned ? 'learned' : ''} ${isLocked ? 'locked' : ''}`;
          pButton.style.textAlign = 'left';
          pButton.style.padding = '10px';
          pButton.innerHTML = `<span style="color: ${alreadyLearned ? '#aaa' : '#fff'};">${power.name}</span>`;

          if (alreadyLearned) {
            pButton.disabled = true;
            pButton.style.cursor = 'not-allowed';
            pButton.style.opacity = 0.6;
          } else if (!canAfford) {
            pButton.disabled = true;
            pButton.style.cursor = 'not-allowed';
            pButton.style.opacity = 0.6;
          } else if (isLocked) {
            pButton.style.cursor = 'not-allowed';
            pButton.style.opacity = 0.3;
          }

          pButton.onclick = () => {
            if (pButton.classList.contains('locked')) {
              this.engine.chat.addMessage('system', 'System', 'You must learn earlier powers in this set first.');
            } else if (!alreadyLearned && canAfford) {
               this.engine.socket.emit('learn_power', { powerName: power.name, powerset: psName });
            }
          };
          powerItems.push(pButton);
          powerListContainer.appendChild(pButton);
        });

        updateLocks();
      };

      renderPowerList();
  }

      renderPowersetUnlockUI(container, powerPicks, setPicksRaw, goBackCb) {
          let setPicksCount = 0;
          let pickType = 'any';
          if (Array.isArray(setPicksRaw) && setPicksRaw.length > 0) {
              setPicksCount = setPicksRaw.length;
              pickType = setPicksRaw[0];
          } else if (typeof setPicksRaw === 'number') {
              setPicksCount = setPicksRaw;
          }

      const allSets = Object.values(this.engine.powersetsData);
      const knownSets = this.engine.playerData.powersets || [];
          let availableSets = allSets.filter(ps => !knownSets.includes(ps.id));

          if (pickType !== 'any') {
              const allowedTypes = pickType.split('/');
              availableSets = availableSets.filter(ps => {
                  const psCat = ps.category ? ps.category.toLowerCase() : '';
                  const psId = ps.id.toLowerCase();
                  return allowedTypes.some(t => 
                      (psCat && (psCat.includes(t) || t.includes(psCat))) ||
                      (!psCat && (psId.includes(t) || t.includes('melee') && psId.includes('fu') || t.includes('ranged') && psId.includes('blast')))
                  );
              });
          }

      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--text-dim); padding-bottom: 10px; font-family: var(--font-mono);">
           <span style="color: #f39c12; font-weight: bold;">Power Picks: ${powerPicks}</span>
               <span style="color: #f39c12; font-weight: bold;">Powerset Picks: ${setPicksCount}</span>
        </div>
            <div style="font-size: 0.9rem; color: #ccc; font-family: var(--font-mono); margin-top: 5px;">Available Powersets ${pickType !== 'any' ? `(${pickType.toUpperCase()})` : ''}:</div>
        <div id="powerset-unlock-list" style="display: flex; flex-direction: column; gap: 5px; max-height: 200px; overflow-y: auto; font-family: var(--font-header); font-size: 1.1rem; letter-spacing: 1px; margin-top: 5px;">
           <!-- Populated by JS -->
        </div>
        <button id="btn-power-back" class="btn-secondary" style="margin-top: 10px; font-family: var(--font-mono);">Back</button>
      `;
      document.getElementById('btn-power-back').onclick = goBackCb;

      const setListContainer = document.getElementById('powerset-unlock-list');
          
          if (availableSets.length === 0) {
              setListContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">No powersets match this requirement.</div>`;
          }

      availableSets.forEach(set => {
        const sButton = document.createElement('button');
        sButton.className = 'btn-secondary';
        sButton.style.textAlign = 'left';
        sButton.style.padding = '10px';
        sButton.innerText = set.name.toUpperCase();
        sButton.onclick = () => {
          this.engine.socket.emit('learn_powerset', { powerset: set.id });
        };
        setListContainer.appendChild(sButton);
      });
  }
}
