export class DevToolsUIManager {
  constructor(engine, mainUIManager) {
    this.engine = engine;
    this.ui = mainUIManager;

    this.ui.makeDraggable('dev-panel', '.dev-panel-header');
    this.ui.makeDraggable('builder-panel', '.dev-panel-header');
    this.ui.makeDraggable('npc-manager-panel', '.dev-panel-header');
    this.ui.makeDraggable('npc-edit-modal', '.dev-panel-header');

    this.setupDevTools();
    this.setupBuilderTools();
    this.setupSideHudButtons();
    this.setupPlayerManager();
  }

  setupSideHudButtons() {
    const sideHud = document.querySelector('.game-side-hud');
    if (!sideHud) return;

    const createBtn = (id, text, title, onClick, permission) => {
      if (permission) {
        const pName = this.engine.playerData.name.toLowerCase();
        const perms = this.engine.permissions[permission] || [];
        if (!perms.includes('*') && !perms.includes(pName)) {
          return;
        }
      }

      if (document.getElementById(id)) return;
      const btn = document.createElement('button');
      btn.id = id;
      btn.className = 'btn-secondary';
      btn.style.cssText = 'width: auto; height: 45px; padding: 0 10px; font-weight: bold; background: rgba(0,0,0,0.8); border-color: #f39c12; color: #f39c12; border-radius: 4px; font-size: 1rem; cursor: pointer; transition: background 0.2s;';
      btn.innerText = text;
      btn.title = title;
      btn.onclick = onClick;
      btn.onmouseenter = () => btn.style.background = 'rgba(243, 156, 18, 0.2)';
      btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,0.8)';
      
      const btnPowers = document.getElementById('btn-powers');
      if (btnPowers) sideHud.insertBefore(btn, btnPowers);
      else sideHud.appendChild(btn);
    };

    createBtn('btn-hud-npc', 'NPC', 'NPC Manager', () => {
      const npcPanel = document.getElementById('npc-manager-panel');
      if (npcPanel) {
        npcPanel.style.display = npcPanel.style.display === 'none' ? 'flex' : 'none';
        if (npcPanel.style.display === 'flex') this.renderNpcManager();
      }
    });
    createBtn('btn-hud-dev', '/dev', 'Toggle Dev Tools', () => this.engine.chat.processCommand('/dev'));
    createBtn('btn-hud-edit', '/edit', 'Toggle Edit Mode', () => this.engine.chat.processCommand('/editmode'));
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
      setupDevBtn('btn-dev-los', 'showLoS', '#f1c40f', 'Toggle Line of Sight');

      const btnLos = document.getElementById('btn-dev-los');
      if (btnLos && !document.getElementById('btn-dev-los-edit')) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '5px';
        wrapper.style.marginTop = '5px';
        wrapper.style.width = '100%';
        
        btnLos.parentNode.insertBefore(wrapper, btnLos);
        btnLos.style.marginTop = '0';
        wrapper.appendChild(btnLos);
        
        const editBtn = document.createElement('button');
        editBtn.id = 'btn-dev-los-edit';
        editBtn.className = 'btn-secondary';
        editBtn.innerText = '✎';
        editBtn.style.cssText = 'padding: 0 10px; border-color: #f1c40f; color: #f1c40f;';
        editBtn.onclick = () => {
          const modal = document.getElementById('los-edit-modal');
          if (modal) {
            document.getElementById('edit-los-dist').value = eng.devOptions.losDistance !== undefined ? eng.devOptions.losDistance : 400;
            document.getElementById('edit-los-angle').value = eng.devOptions.losAngle !== undefined ? eng.devOptions.losAngle : 60;
            modal.style.display = 'flex';
          }
        };
        wrapper.appendChild(editBtn);
      }

      setupDevBtn('btn-dev-hitbox', 'showHitboxes', '#ff4757', 'Toggle Hitboxes');
      setupDevBtn('btn-dev-tile', 'showTile', '#ff4757', 'Toggle Tile Grids');
      setupDevBtn('btn-dev-chunk', 'showChunk', '#ff4757', 'Toggle Chunk Grids');
      setupDevBtn('btn-dev-dist-npc', 'showDistToNPC', '#f1c40f', 'Dist: Player to NPC');
      setupDevBtn('btn-dev-dist-mouse', 'showDistNpcToMouse', '#f1c40f', 'Dist: NPC to Mouse');
      setupDevBtn('btn-dev-dist-player-mouse', 'showDistPlayerToMouse', '#f1c40f', 'Dist: Player to Mouse');

      const btnDistPlayerMouse = document.getElementById('btn-dev-dist-player-mouse');
      if (btnDistPlayerMouse && !document.getElementById('btn-dev-tooltip-toggle')) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '5px';
        wrapper.style.marginTop = '5px';
        wrapper.style.width = '100%';
        
        btnDistPlayerMouse.parentNode.insertBefore(wrapper, btnDistPlayerMouse);
        btnDistPlayerMouse.style.marginTop = '0';
        wrapper.appendChild(btnDistPlayerMouse);
        
        const tBtn = document.createElement('button');
        tBtn.id = 'btn-dev-tooltip-toggle';
        tBtn.className = 'btn-secondary';
        tBtn.innerText = 'T';
        tBtn.title = 'Toggle Tooltip Mode';
        tBtn.style.cssText = `padding: 0 10px; border-color: #f1c40f; color: #f1c40f; ${eng.devOptions.useDebugTooltip ? 'background: rgba(241, 196, 15, 0.2);' : ''}`;
        tBtn.onclick = () => {
          eng.devOptions.useDebugTooltip = !eng.devOptions.useDebugTooltip;
          tBtn.style.background = eng.devOptions.useDebugTooltip ? 'rgba(241, 196, 15, 0.2)' : 'transparent';
          localStorage.setItem('b_dev_options', JSON.stringify(eng.devOptions));
        };
        wrapper.appendChild(tBtn);
      }

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
            maxEnergy: energyVal,
            x: parseFloat(document.getElementById('edit-npc-x').value),
            y: parseFloat(document.getElementById('edit-npc-y').value),
            z: parseFloat(document.getElementById('edit-npc-z').value),
            type: document.getElementById('edit-npc-type').value,
            dir: document.getElementById('edit-npc-dir').value
          };
          eng.network.sendEditNpc(uuid, updates);
        };

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

      const btnPlayerManager = document.getElementById('btn-dev-player-manager');
      if (btnPlayerManager) {
        btnPlayerManager.onclick = () => {
          const playerPanel = document.getElementById('player-manager-panel');
          if (playerPanel) {
            playerPanel.style.display = 'flex';
            this.renderPlayerManager();
          }
        };
      }
    }

    if (!document.getElementById('los-edit-modal')) {
      const modal = document.createElement('div');
      modal.id = 'los-edit-modal';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 1000000;';
      modal.innerHTML = `
        <div style="background: #0b0e14; border: 2px solid #f1c40f; padding: 20px; border-radius: 8px; font-family: var(--font-mono); width: 250px;">
          <h3 style="color: #f1c40f; margin-top: 0;">Edit Line of Sight</h3>
          <div style="margin-bottom: 10px;">
            <label style="color: #fff; display: block; margin-bottom: 5px;">Distance (px)</label>
            <input type="number" id="edit-los-dist" style="width: 100%; background: #111; color: #fff; border: 1px solid #444; padding: 5px;" value="400">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="color: #fff; display: block; margin-bottom: 5px;">FOV Angle (degrees)</label>
            <input type="number" id="edit-los-angle" style="width: 100%; background: #111; color: #fff; border: 1px solid #444; padding: 5px;" value="60">
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="btn-save-los" class="btn-primary" style="flex: 1;">Save</button>
            <button id="btn-close-los" class="btn-secondary" style="flex: 1;">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('btn-close-los').onclick = () => modal.style.display = 'none';
      document.getElementById('btn-save-los').onclick = () => {
        eng.devOptions.losDistance = parseInt(document.getElementById('edit-los-dist').value, 10) || 400;
        eng.devOptions.losAngle = parseInt(document.getElementById('edit-los-angle').value, 10) || 60;
        localStorage.setItem('b_dev_options', JSON.stringify(eng.devOptions));
        modal.style.display = 'none';
      };
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
          this.engine.network.sendDeleteNpc(npc.uuid);
        }
      };

      list.appendChild(row);
    });
  }

  setupBuilderTools() {
    const eng = this.engine;
    const builderPanel = document.getElementById('builder-panel');
    if (builderPanel) {
      builderPanel.style.width = '260px';
      
      if (!builderPanel.querySelector('.dev-panel-header')) {
        const header = document.createElement('div');
        header.className = 'dev-panel-header';
        header.style.cssText = 'background: rgba(52, 152, 219, 0.2); padding: 8px 10px; border-bottom: 2px solid #3498db; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; margin-bottom: 10px;';
        header.innerHTML = `<span style="color: #fff; font-weight: bold; font-size: 0.9rem;">Builder Tools</span><button id="btn-close-builder" style="background: transparent; border: none; color: #fff; cursor: pointer; font-weight: bold; padding: 0 5px;">X</button>`;
        builderPanel.insertBefore(header, builderPanel.firstChild);
        this.ui.makeDraggable('builder-panel', '.dev-panel-header');
      }
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
      const oldCoordsBtn = document.getElementById('btn-build-coords');
      if (oldCoordsBtn) oldCoordsBtn.remove();
      setupBuilderBtn('btn-build-preview', 'useBlockPreview');
    }

    const builderHotbar = document.getElementById('builder-hotbar');
    if (builderHotbar) {
      builderHotbar.innerHTML = ''; 
      
      builderHotbar.style.position = 'absolute';
      builderHotbar.style.bottom = '20px';
      builderHotbar.style.left = '50%';
      builderHotbar.style.transform = 'translateX(-50%)';
      builderHotbar.style.background = 'rgba(5, 7, 10, 0.9)';
      builderHotbar.style.border = '2px solid #3498db';
      builderHotbar.style.borderRadius = '8px';
      builderHotbar.style.pointerEvents = 'auto';
      builderHotbar.style.display = 'flex';
      builderHotbar.style.flexDirection = 'column';
      builderHotbar.style.padding = '10px';
      builderHotbar.style.gap = '10px';
      builderHotbar.style.zIndex = '1000';
      builderHotbar.style.width = '240px';

      const header = document.createElement('div');
      header.className = 'dev-panel-header';
      header.style.cssText = 'background: rgba(52, 152, 219, 0.2); padding: 8px 10px; border-bottom: 2px solid #3498db; display: flex; justify-content: center; align-items: center; cursor: move; user-select: none; margin: -10px -10px 10px -10px; border-radius: 6px 6px 0 0;';
      header.innerHTML = `<span style="color: #fff; font-weight: bold; font-size: 0.9rem;">Texture Palette</span>`;
      builderHotbar.appendChild(header);

      const controlsContainer = document.createElement('div');
      controlsContainer.style.display = 'flex';
      controlsContainer.style.flexDirection = 'column';
      controlsContainer.style.gap = '5px';

      let selectedColor = '#ffffff';
      const colorPicker = document.createElement('input');
      colorPicker.id = 'build-color-picker';
      colorPicker.type = 'color';
      colorPicker.value = '#ffffff';
      colorPicker.style.width = '100%';
      colorPicker.addEventListener('input', (e) => selectedColor = e.target.value);
      controlsContainer.appendChild(colorPicker);

      const shapeContainer = document.createElement('div');
      shapeContainer.id = 'build-shape-container';
      shapeContainer.style.cssText = 'display: flex; gap: 5px; align-items: center; background: rgba(0,0,0,0.5); padding: 5px; border-radius: 4px; border: 1px solid #333; justify-content: center;';
        
      const shapeBtn = document.createElement('button');
      shapeBtn.id = 'build-shape-btn';
      shapeBtn.className = 'btn-secondary';
      shapeBtn.style.cssText = 'padding: 5px 10px; font-weight: bold; font-family: var(--font-mono); border-color: #3498db; color: #3498db; min-width: 100px;';
      shapeBtn.innerText = 'Shape: CUBE';
        
      const dirBtn = document.createElement('button');
      dirBtn.id = 'build-dir-btn';
      dirBtn.className = 'btn-secondary';
      dirBtn.style.cssText = 'padding: 5px 10px; font-weight: bold; font-family: var(--font-mono); border-color: #f39c12; color: #f39c12; display: none; min-width: 40px;';
      dirBtn.innerText = 'N';

      const relBtn = document.createElement('button');
      relBtn.id = 'build-rel-btn';
      relBtn.className = 'btn-secondary';
      relBtn.style.cssText = 'padding: 5px 10px; font-weight: bold; font-family: var(--font-mono); border-color: #9b59b6; color: #9b59b6; display: none; min-width: 40px;';
      relBtn.innerText = 'P';
      relBtn.title = 'Toggle Player Perspective';

      shapeContainer.appendChild(shapeBtn);
      shapeContainer.appendChild(relBtn);
      shapeContainer.appendChild(dirBtn);
      controlsContainer.appendChild(shapeContainer);
        
      const fluidBtn = document.createElement('button');
      fluidBtn.id = 'build-fluid-btn';
      fluidBtn.className = 'btn-secondary';
      fluidBtn.style.cssText = 'padding: 5px 10px; font-weight: bold; font-family: var(--font-mono); border-color: #3498db; color: #3498db; display: none; width: 100%;';
      fluidBtn.innerText = 'Fluid State: STILL';
      controlsContainer.appendChild(fluidBtn);

      builderHotbar.appendChild(controlsContainer);
        
      eng.editShapeBase = 'cube';
      eng.editShapeDir = 'n';
      eng.editShapeRelative = false;
      eng.editFluid = 'still';
        
      fluidBtn.onclick = () => {
         eng.editFluid = eng.editFluid === 'still' ? 'flow' : 'still';
         fluidBtn.innerText = 'Fluid State: ' + eng.editFluid.toUpperCase();
      };
        
      const updateShapeUI = () => {
        shapeBtn.innerText = 'Shape: ' + eng.editShapeBase.toUpperCase();
        if (eng.editShapeBase === 'ramp') {
          dirBtn.style.display = eng.editShapeRelative ? 'none' : 'block';
          relBtn.style.display = 'block';
        } else {
          dirBtn.style.display = 'none';
          relBtn.style.display = 'none';
        }
        dirBtn.innerText = eng.editShapeDir.toUpperCase();
        relBtn.style.background = eng.editShapeRelative ? 'rgba(155, 89, 182, 0.2)' : 'transparent';
          
        let finalShape = eng.editShapeBase;
        if (finalShape === 'ramp') {
           if (eng.editShapeRelative) {
              eng.editShape = 'ramp_player'; 
           } else {
              eng.editShape = 'ramp_' + eng.editShapeDir;
           }
        } else {
           eng.editShape = finalShape;
        }
      };

      shapeBtn.onclick = () => {
        const bases = ['cube', 'slab', 'ramp'];
        eng.editShapeBase = bases[(bases.indexOf(eng.editShapeBase) + 1) % bases.length];
        updateShapeUI();
      };

      dirBtn.onclick = () => {
        const dirs = ['n', 'e', 's', 'w'];
        eng.editShapeDir = dirs[(dirs.indexOf(eng.editShapeDir) + 1) % dirs.length];
        updateShapeUI();
      };

      relBtn.onclick = () => {
        eng.editShapeRelative = !eng.editShapeRelative;
        updateShapeUI();
      };
      updateShapeUI();

      const gridContainer = document.createElement('div');
      gridContainer.style.cssText = 'display: grid; grid-template-columns: repeat(5, 36px); gap: 8px; justify-content: center; align-content: start; max-height: 150px; overflow-y: scroll; padding-right: 5px;';

      const ensureSlot = (tex, bgStyle, text = '', title = '') => {
        if (!gridContainer.querySelector(`[data-tex="${tex}"]`)) {
          const slot = document.createElement('div');
          slot.className = 'hotbar-slot';
          slot.dataset.tex = tex;
          slot.style.background = bgStyle;
          slot.style.borderRadius = '4px';
          slot.style.border = '2px solid #444';
          slot.style.cursor = 'pointer';
          slot.style.display = 'flex';
          slot.style.alignItems = 'center';
          slot.style.justifyContent = 'center';
          slot.style.width = '36px';
          slot.style.height = '36px';
          slot.innerHTML = text;
          if (title) slot.title = title;
          else slot.title = tex.toUpperCase();
          gridContainer.appendChild(slot);

          slot.addEventListener('click', () => {
            gridContainer.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
            
            if (slot.dataset.tex === 'picker') {
               eng.selectedTiles = [];
               eng.isDraggingSelection = false;
               eng.renderer.needsVoxelUpdate = true;
               return;
            }
            
            const isFluid = ['water', 'lava', 'acid'].includes(slot.dataset.tex);
            fluidBtn.style.display = isFluid ? 'block' : 'none';
            if (isFluid) {
                eng.editFluid = 'still';
                fluidBtn.innerText = 'Fluid State: STILL';
            }

            if (eng.selectedTiles.length > 0) {
              const isErase = slot.dataset.tex === 'erase';
              let placeShape = eng.editShape || 'cube';
              if (placeShape === 'ramp_player') {
                const pDir = eng.player.dir;
                if (pDir.includes('up')) placeShape = 'ramp_n';
                else if (pDir.includes('down')) placeShape = 'ramp_s';
                else if (pDir.includes('right')) placeShape = 'ramp_e';
                else if (pDir.includes('left')) placeShape = 'ramp_w';
                else placeShape = 'ramp_s';
              }
              
              let finalTex = slot.dataset.tex;
              if (finalTex === 'water' && eng.editFluid === 'flow') finalTex = 'water_flow';
              
              const updates = [];
              const previousStates = [];
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
                  const clickedVoxelOld = eng.mapManager.getVoxelAt(tile.x, tile.y, tile.z);
                  previousStates.push({ worldX: tile.x, worldY: tile.y, worldZ: tile.z, voxelData: clickedVoxelOld ? { ...clickedVoxelOld } : null });

                  if (isErase) {
                    eng.mapManager.setVoxelAt(tile.x, tile.y, tile.z, null, false);
                    updates.push({ worldX: tile.x, worldY: tile.y, worldZ: tile.z, voxelData: null });
                    for (let i = 0; i < 5; i++) {
                      eng.particles.push({
                        x: tile.x, y: tile.y, z: tile.z,
                        vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, vz: (Math.random() - 0.5) * 100,
                        life: 0.3 + Math.random() * 0.3, maxLife: 0.6, color: 'rgba(200, 200, 200, 0.7)', size: 1 + Math.random()
                      });
                    }
                  } else {
                    eng.mapManager.setVoxelAt(tile.x, tile.y, tile.z, { tex: finalTex, color: selectedColor, shape: placeShape }, false);
                    updates.push({ worldX: tile.x, worldY: tile.y, worldZ: tile.z, voxelData: { tex: finalTex, color: selectedColor, shape: placeShape } });
                    for (let i = 0; i < 3; i++) {
                      eng.particles.push({
                        x: tile.x + (Math.random() - 0.5) * 32, y: tile.y + (Math.random() - 0.5) * 32, z: tile.z + (Math.random() - 0.5) * 32,
                        life: 0.2 + Math.random() * 0.2, maxLife: 0.4, color: selectedColor, size: 1 + Math.random()
                      });
                    }
                  }
                });

                eng.history = eng.history || [];
                if (previousStates.length > 0) eng.history.push(previousStates);
                if (eng.history.length > 30) eng.history.shift();
                eng.redoHistory = [];

                eng.selectedTiles = [];
                eng.isDraggingSelection = false;
                eng.renderer.needsVoxelUpdate = true;
                eng.chat.addMessage('system', 'System', `Bulk operation completed on area.`);
                updates.forEach(u => eng.network.sendBlockUpdate(u));
              }
            }
          });
        }
      };

      ensureSlot('picker', 'rgba(155, 89, 182, 0.5)', '🔍', 'Picker Tool');
      ensureSlot('erase', 'rgba(231, 76, 60, 0.5)', 'X', 'Erase Tool');
      ensureSlot('level', 'rgba(52, 152, 219, 0.5)', 'L', 'Level Tool');

      ensureSlot('grass', '#51852E', '', 'Grass');
      ensureSlot('dirt', 'url("assets/tiles/base/all-facing/dirt.png") center/cover', '', 'Dirt');
      ensureSlot('stone', 'url("assets/tiles/base/all-facing/stone.png") center/cover', '', 'Stone');
      ensureSlot('mud', 'url("assets/tiles/base/all-facing/packed_mud1.png") center/cover', '', 'Mud');
      ensureSlot('ice', 'url("assets/tiles/base/all-facing/ice.png") center/cover', '', 'Ice');
      
      const cb = '?v=' + Date.now();
      ensureSlot('water', `url("assets/tiles/base/fluid/water_still.png${cb}") center/cover`, '', 'Water');
      ensureSlot('lava', `linear-gradient(rgba(255, 93, 0, 0.6), rgba(255, 93, 0, 0.6)), url("assets/tiles/base/fluid/lava_still.png${cb}") center/cover`, '', 'Lava');
      ensureSlot('acid', `linear-gradient(rgba(46, 204, 113, 0.6), rgba(46, 204, 113, 0.6)), url("assets/tiles/base/fluid/water_still.png${cb}") center/cover`, '', 'Acid');

      ensureSlot('crate', 'rgba(139, 69, 19, 0.5)', '📦', 'Crate');

      builderHotbar.appendChild(gridContainer);
      this.ui.makeDraggable('builder-hotbar', '.dev-panel-header');

      const firstSlot = gridContainer.querySelector('.hotbar-slot[data-tex="stone"]');
      if (firstSlot) firstSlot.click();
    }
  }

  setupPlayerManager() {
    const eng = this.engine;
    let panel = document.getElementById('player-manager-panel');
    if (panel) return;

    panel = document.createElement('div');
    panel.id = 'player-manager-panel';
    panel.className = 'dev-panel';
    panel.style.cssText = 'position: absolute; top: 150px; left: 50px; display: none; width: 800px;';
    panel.innerHTML = `
        <div class="dev-panel-header">
            <span>Player Manager</span>
            <button id="btn-close-player-manager" class="btn-close">X</button>
        </div>
        <div id="player-manager-list" class="npc-manager-list" style="max-height: 500px;"></div>
    `;
    document.body.appendChild(panel);
    document.getElementById('btn-close-player-manager').onclick = () => panel.style.display = 'none';
    this.ui.makeDraggable('player-manager-panel', '.dev-panel-header');
  }

  renderPlayerManager() {
    const list = document.getElementById('player-manager-list');
    if (!list) return;
    list.innerHTML = '';

    const players = [this.engine.player, ...Object.values(this.engine.otherPlayers)];
    players.sort((a, b) => (a.name || this.engine.playerData.name).localeCompare(b.name));

    players.forEach(p => {
      const isSelf = p === this.engine.player;
      const name = isSelf ? this.engine.playerData.name : p.name;
      const level = isSelf ? this.engine.playerData.level : p.level;
      const alignment = isSelf ? this.engine.playerData.alignment : p.alignment;
      const race = isSelf ? this.engine.playerData.race : p.race;
      const integrity = isSelf ? this.engine.playerData.integrity : p.integrity;

      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.5); border: 1px solid var(--text-dim); padding: 8px; border-radius: 4px; font-size: 0.8rem;';
      
      row.innerHTML = `
          <div style="flex: 1.2; font-weight: bold; color: ${isSelf ? '#2ecc71' : '#3498db'};" title="${name}">${name} (Lv.${level || 1})</div>
          <div style="flex: 1.5; display: flex; align-items: center; gap: 5px;">
              <span>X:${Math.round(p.x)} Y:${Math.round(p.y)} Z:${Math.round(p.z || 0)}</span>
              <button class="btn-tp btn-secondary" style="padding: 2px 8px; font-size: 0.7rem;">TP</button>
          </div>
          <div style="flex: 0.8;">${alignment || 'N/A'}</div>
          <div style="flex: 0.8;">${race || 'N/A'}</div>
          <div style="flex: 0.8;">${integrity || 0}%</div>
          <div style="flex: 1;">${Math.floor(p.hp)} / ${p.maxHp}</div>
          <button class="btn-edit btn-secondary" style="padding: 2px 8px; font-size: 0.7rem;">Edit</button>
      `;

      row.querySelector('.btn-tp').onclick = () => {
        this.engine.chat.processCommand(`/tp ${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z || 0)}`);
      };

      row.querySelector('.btn-edit').onclick = () => {
        this.engine.chat.addMessage('system', 'System', `Editing player ${name} is not yet implemented.`);
      };

      list.appendChild(row);
    });
  }
}
