export class InGameMenuUIManager {
  constructor(app) {
    this.app = app;
    this.setupUI();
  }

  setupUI() {
    const btnGameMenu = document.getElementById('btn-game-menu');
    const gameDropdown = document.getElementById('game-dropdown');

    if (btnGameMenu && gameDropdown) {
      btnGameMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        gameDropdown.style.display = gameDropdown.style.display === 'none' ? 'flex' : 'none';
      });

      document.addEventListener('click', (e) => {
        if (gameDropdown.style.display === 'flex' && !e.target.closest('.game-top-bar')) {
          gameDropdown.style.display = 'none';
        }
      });

      document.getElementById('btn-char-select').addEventListener('click', () => {
        if (window.currentGameEngine) window.currentGameEngine.stop();
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('selection-screen').style.display = 'flex';
        gameDropdown.style.display = 'none';
        
        const trainerModal = document.getElementById('trainer-dialog-modal');
        if (trainerModal) trainerModal.style.display = 'none';
        
        const powerbar = document.getElementById('powerbar-container');
        if (powerbar) powerbar.style.display = 'none';
      });

      document.getElementById('btn-logout').addEventListener('click', () => {
        if (window.currentGameEngine) window.currentGameEngine.stop();
        this.app.currentAccount = null;
        localStorage.removeItem('b_current_account');
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('creation-screen').style.display = 'block';
        gameDropdown.style.display = 'none';

        const trainerModal = document.getElementById('trainer-dialog-modal');
        if (trainerModal) trainerModal.style.display = 'none';

        const powerbar = document.getElementById('powerbar-container');
        if (powerbar) powerbar.style.display = 'none';
      });

      document.getElementById('btn-edit-id').addEventListener('click', () => {
        gameDropdown.style.display = 'none';
        if (!window.currentGameEngine) return;
        
        const char = window.currentGameEngine.playerData;
        document.getElementById('ig-id-name').value = char.name;
        document.getElementById('ig-id-alignment').value = char.alignment || 'hero';
        document.getElementById('ig-id-city').value = char.city || 'atlas';
        document.getElementById('ig-char-bio').value = char.bio || '';
        
        document.getElementById('in-game-id-modal').style.display = 'flex';
      });

      const btnSettings = document.getElementById('btn-settings');
      if (btnSettings && !document.getElementById('btn-keybinds')) {
        const btnKeybinds = btnSettings.cloneNode(true);
        btnKeybinds.id = 'btn-keybinds';
        
        const walker = document.createTreeWalker(btnKeybinds, NodeFilter.SHOW_TEXT, null, false);
        let node;
        let validNodes = [];
        while (node = walker.nextNode()) {
          // Only target text nodes containing actual alphanumeric characters
          if (node.nodeValue.trim().match(/[a-zA-Z0-9]/)) {
            const parent = node.parentNode;
            const parentTag = parent && parent.tagName ? parent.tagName.toLowerCase() : '';
            const parentClass = parent && typeof parent.className === 'string' ? parent.className.toLowerCase() : '';
            // Skip typical icon elements (like FontAwesome or Material Icons)
            if (parentTag === 'i' || parentTag === 'svg' || parentClass.includes('icon') || parentClass.includes('material')) {
              continue;
            }
            validNodes.push(node);
          }
        }
        
        if (validNodes.length > 0) {
          validNodes.forEach(n => n.nodeValue = '');
          const targetNode = validNodes[validNodes.length - 1];
          targetNode.nodeValue = 'Keybinds';
        } else {
          btnKeybinds.innerText = 'Keybinds';
        }

        btnSettings.parentNode.insertBefore(btnKeybinds, btnSettings);

        const kbModal = document.createElement('div');
        kbModal.id = 'keybinds-modal';
        kbModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 1000000;';
        kbModal.innerHTML = `
            <div style="background: #0b0e14; border: 2px solid #3498db; padding: 20px; border-radius: 8px; font-family: var(--font-mono); width: 280px; display: flex; flex-direction: column; gap: 15px;">
                <h3 style="color: #3498db; margin-top: 0; text-align: center;">Keybinds</h3>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #fff;">Undo</span>
                    <div style="display: flex; align-items: center; gap: 5px;"><span style="color: #aaa;">Ctrl + </span><input type="text" id="kb-undo" maxlength="1" style="width: 30px; text-align: center; background: #111; color: #fff; border: 1px solid #444; padding: 5px; text-transform: lowercase;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #fff;">Redo</span>
                    <div style="display: flex; align-items: center; gap: 5px;"><span style="color: #aaa;">Ctrl + </span><input type="text" id="kb-redo" maxlength="1" style="width: 30px; text-align: center; background: #111; color: #fff; border: 1px solid #444; padding: 5px; text-transform: lowercase;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #fff;">Picker Tool</span>
                    <div style="display: flex; align-items: center; gap: 5px;"><input type="text" id="kb-picker" maxlength="1" style="width: 30px; text-align: center; background: #111; color: #fff; border: 1px solid #444; padding: 5px; text-transform: lowercase;" placeholder="-"></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #fff;">Fly Down</span>
                    <div style="display: flex; align-items: center; gap: 5px;"><input type="text" id="kb-flydown" maxlength="1" style="width: 30px; text-align: center; background: #111; color: #fff; border: 1px solid #444; padding: 5px; text-transform: lowercase;" placeholder="x"></div>
                </div>
                <button id="btn-close-keybinds" class="btn-primary" style="margin-top: 10px;">Save & Close</button>
            </div>
        `;
        document.body.appendChild(kbModal);
        
        document.getElementById('btn-close-keybinds').onclick = () => {
            if (window.currentGameEngine) {
                const undoKey = document.getElementById('kb-undo').value.toLowerCase() || 'z';
                const redoKey = document.getElementById('kb-redo').value.toLowerCase() || 'y';
                const pickerKey = document.getElementById('kb-picker').value.toLowerCase() || '';
                const flyDownKey = document.getElementById('kb-flydown').value.toLowerCase() || 'x';
                window.currentGameEngine.clientSettings.keybinds = { undo: undoKey, redo: redoKey, picker: pickerKey, flyDown: flyDownKey };
                localStorage.setItem('b_client_settings', JSON.stringify(window.currentGameEngine.clientSettings));
            }
            kbModal.style.display = 'none';
        };

        btnKeybinds.onclick = () => {
            gameDropdown.style.display = 'none';
            const eng = window.currentGameEngine;
            const kbs = eng?.clientSettings?.keybinds || { undo: 'z', redo: 'y', picker: '', flyDown: 'x' };
            document.getElementById('kb-undo').value = kbs.undo;
            document.getElementById('kb-redo').value = kbs.redo;
            document.getElementById('kb-picker').value = kbs.picker || '';
            document.getElementById('kb-flydown').value = kbs.flyDown || 'x';
            kbModal.style.display = 'flex';
        };
      }

      document.getElementById('btn-close-id').addEventListener('click', () => {
        document.getElementById('in-game-id-modal').style.display = 'none';
      });

      document.getElementById('btn-save-ig-id').addEventListener('click', async () => {
        if (!window.currentGameEngine) return;
        const char = window.currentGameEngine.playerData;
        
        char.bio = document.getElementById('ig-char-bio').value.trim();
        
        try {
          const updatedAccount = await this.app.auth.updateCharacter(this.app.currentAccount.uuid, char);
          this.app.currentAccount = updatedAccount;
          localStorage.setItem('b_current_account', JSON.stringify(updatedAccount));
          document.getElementById('in-game-id-modal').style.display = 'none';
          this.app.showModal("Success", "Citizen Identification Updated!");
        } catch (err) {
          this.app.showModal("Update Failed", err.message);
        }
      });

      document.getElementById('btn-settings').addEventListener('click', () => {
        gameDropdown.style.display = 'none';
        document.getElementById('settings-modal').style.display = 'flex';
      });
      
      document.getElementById('btn-close-settings').addEventListener('click', () => {
        document.getElementById('settings-modal').style.display = 'none';
      });

      const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
      const settingsTabPanels = document.querySelectorAll('.settings-tab-panel');

      settingsTabPanels.forEach(panel => {
        panel.style.maxHeight = '60vh';
        panel.style.overflowY = 'auto';
        panel.style.paddingRight = '10px';
      });

      settingsTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          settingsTabBtns.forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = 'var(--text-dim)';
            b.style.color = 'var(--text-primary)';
            b.style.background = 'transparent';
          });
          btn.classList.add('active');
          btn.style.borderColor = 'var(--accent-neon)';
          btn.style.color = 'var(--accent-neon)';
          btn.style.background = 'rgba(116, 185, 255, 0.1)';

          const tabId = btn.dataset.tab;
          settingsTabPanels.forEach(panel => {
            panel.style.display = panel.id === tabId ? 'flex' : 'none';
          });
        });
      });

      const rowToggleCombatChat = document.getElementById('row-toggle-combat-chat');
      const btnToggleCombatChat = document.getElementById('btn-toggle-combat-chat');
      const chatContainer = document.getElementById('game-chat-container');
      if (rowToggleCombatChat) {
        const savedCombatChat = localStorage.getItem('b_show_combat_chat');
        if (savedCombatChat === 'false') {
          chatContainer.classList.add('hide-combat');
          btnToggleCombatChat.innerText = 'Disabled';
          btnToggleCombatChat.className = 'btn-secondary';
        }

        rowToggleCombatChat.addEventListener('click', () => {
          if (chatContainer.classList.contains('hide-combat')) {
            chatContainer.classList.remove('hide-combat');
            btnToggleCombatChat.innerText = 'Enabled';
            btnToggleCombatChat.className = 'btn-primary';
            localStorage.setItem('b_show_combat_chat', 'true');
          } else {
            chatContainer.classList.add('hide-combat');
            btnToggleCombatChat.innerText = 'Disabled';
            btnToggleCombatChat.className = 'btn-secondary';
            localStorage.setItem('b_show_combat_chat', 'false');
          }
        });
      }

      const defaultSettings = { showCoords: false, showFPS: false, showPing: false, showBaseplates: false, cameraFollowsJump: true, showMinimap: true, rotateMinimap: true, clickToMove: false, alwaysSprint: false, showPlayerNames: true, showPlayerHealth: true, showEntityNames: true, showEntityHealth: true, cameraSensitivity: 120, cameraAngleSnap: 0, invertCameraRotation: false, invertDragRotation: false, middleMouseRotation: true, dragRotationSensitivity: 0.25, lockBuilderPanel: false, keybinds: { undo: 'z', redo: 'y', picker: '', flyDown: 'x' } };
      const savedSettingsStr = localStorage.getItem('b_client_settings');
      const savedSettings = savedSettingsStr ? Object.assign({}, defaultSettings, JSON.parse(savedSettingsStr)) : defaultSettings;
      
      const setupSettingToggle = (rowId, btnId, settingKey) => {
        const row = document.getElementById(rowId);
        const btn = document.getElementById(btnId);
        if (!row || !btn) return;
        
        if (savedSettings[settingKey]) {
          btn.innerText = 'Enabled';
          btn.className = 'btn-primary';
          btn.style.width = 'auto';
        } else {
          btn.innerText = 'Disabled';
          btn.className = 'btn-secondary';
        }

        row.addEventListener('click', () => {
          if (!window.currentGameEngine) return;
          const isEnabled = !window.currentGameEngine.clientSettings[settingKey];
          window.currentGameEngine.clientSettings[settingKey] = isEnabled;
          localStorage.setItem('b_client_settings', JSON.stringify(window.currentGameEngine.clientSettings));
          
          btn.innerText = isEnabled ? 'Enabled' : 'Disabled';
          btn.className = isEnabled ? 'btn-primary' : 'btn-secondary';
          btn.style.width = 'auto';
        });
      };

      const fpsRow = document.getElementById('row-toggle-fps');
      if (fpsRow && !document.getElementById('row-toggle-coords')) {
        const coordsRow = document.createElement('div');
        coordsRow.id = 'row-toggle-coords';
        coordsRow.className = 'settings-row';
        coordsRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer;';
        coordsRow.innerHTML = `<span style="color: #ccc;">Show Coordinates</span><button id="btn-toggle-coords" class="${savedSettings.showCoords ? 'btn-primary' : 'btn-secondary'}">${savedSettings.showCoords ? 'Enabled' : 'Disabled'}</button>`;
        fpsRow.parentNode.insertBefore(coordsRow, fpsRow);
      }

      setupSettingToggle('row-toggle-coords', 'btn-toggle-coords', 'showCoords');
      setupSettingToggle('row-toggle-fps', 'btn-toggle-fps', 'showFPS');
      setupSettingToggle('row-toggle-ping', 'btn-toggle-ping', 'showPing');
      setupSettingToggle('row-toggle-baseplates', 'btn-toggle-baseplates', 'showBaseplates');

      setupSettingToggle('row-toggle-lock-builder', 'btn-toggle-lock-builder', 'lockBuilderPanel');
      setupSettingToggle('row-toggle-cam-jump', 'btn-toggle-cam-jump', 'cameraFollowsJump');
      setupSettingToggle('row-toggle-minimap', 'btn-toggle-minimap', 'showMinimap');
      setupSettingToggle('row-toggle-minimap-rotate', 'btn-toggle-minimap-rotate', 'rotateMinimap');
      setupSettingToggle('row-toggle-click-move', 'btn-toggle-click-move', 'clickToMove');
      setupSettingToggle('row-toggle-always-sprint', 'btn-toggle-always-sprint', 'alwaysSprint');
      setupSettingToggle('row-toggle-player-names', 'btn-toggle-player-names', 'showPlayerNames');
      setupSettingToggle('row-toggle-player-health', 'btn-toggle-player-health', 'showPlayerHealth');
      setupSettingToggle('row-toggle-entity-names', 'btn-toggle-entity-names', 'showEntityNames');
      setupSettingToggle('row-toggle-entity-health', 'btn-toggle-entity-health', 'showEntityHealth');
            
      // Wire up the camera rotation and drag settings
      setupSettingToggle('row-toggle-invert-rot', 'btn-toggle-invert-rot', 'invertCameraRotation');
      setupSettingToggle('row-toggle-invert-camera', 'btn-toggle-invert-camera', 'invertCameraRotation');
      setupSettingToggle('row-toggle-invert', 'btn-toggle-invert', 'invertCameraRotation');
      setupSettingToggle('row-toggle-invert-qe', 'btn-toggle-invert-qe', 'invertCameraRotation');
      setupSettingToggle('row-toggle-invert-q-e', 'btn-toggle-invert-q-e', 'invertCameraRotation');
      setupSettingToggle('row-toggle-middle-mouse', 'btn-toggle-middle-mouse', 'middleMouseRotation');
      setupSettingToggle('row-toggle-drag-rot', 'btn-toggle-drag-rot', 'invertDragRotation');

      const camJumpRow = document.getElementById('row-toggle-cam-jump');
      if (camJumpRow && !document.getElementById('camera-sensitivity-row')) {
        const container = camJumpRow.parentNode;
        
        const snapRow = document.createElement('div');
        snapRow.id = 'camera-snap-row';
        snapRow.className = 'settings-row';
        snapRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: default;';
        snapRow.innerHTML = `
          <span style="color: #ccc;">Compass Snap Angle</span>
          <select id="select-camera-snap" style="background: rgba(0,0,0,0.5); color: #3498db; border: 1px solid #3498db; padding: 5px; font-weight: bold; cursor: pointer; border-radius: 4px;">
            <option value="0">North-West</option>
            <option value="90">North-East</option>
            <option value="180">South-East</option>
            <option value="270">South-West</option>
          </select>
        `;
        container.insertBefore(snapRow, camJumpRow.nextSibling);

        const sensRow = document.createElement('div');
        sensRow.id = 'camera-sensitivity-row';
        sensRow.className = 'settings-row';
        sensRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: default;';
        sensRow.innerHTML = `
          <span style="color: #ccc;">Camera Rotation Speed</span>
          <input type="range" id="slider-camera-sensitivity" min="30" max="360" value="${savedSettings.cameraSensitivity || 120}" style="width: 150px; cursor: pointer;">
        `;
        container.insertBefore(sensRow, snapRow.nextSibling);

        const dragSensRow = document.createElement('div');
        dragSensRow.id = 'camera-drag-sens-row';
        dragSensRow.className = 'settings-row';
        dragSensRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: default;';
        dragSensRow.innerHTML = `
          <span style="color: #ccc;">Mouse Drag Sensitivity</span>
          <input type="range" id="slider-drag-sensitivity" min="5" max="100" value="${(savedSettings.dragRotationSensitivity !== undefined ? savedSettings.dragRotationSensitivity : 0.25) * 100}" style="width: 150px; cursor: pointer;">
        `;
        container.insertBefore(dragSensRow, sensRow.nextSibling);

        const selectSnap = document.getElementById('select-camera-snap');
        selectSnap.value = savedSettings.cameraAngleSnap !== undefined ? savedSettings.cameraAngleSnap : 0;
        selectSnap.onchange = (e) => {
          if (!window.currentGameEngine) return;
          window.currentGameEngine.clientSettings.cameraAngleSnap = parseInt(e.target.value, 10);
          localStorage.setItem('b_client_settings', JSON.stringify(window.currentGameEngine.clientSettings));
        };

        const sliderSens = document.getElementById('slider-camera-sensitivity');
        sliderSens.oninput = (e) => {
          if (!window.currentGameEngine) return;
          window.currentGameEngine.clientSettings.cameraSensitivity = parseInt(e.target.value, 10);
          localStorage.setItem('b_client_settings', JSON.stringify(window.currentGameEngine.clientSettings));
        };

        const sliderDragSens = document.getElementById('slider-drag-sensitivity');
        sliderDragSens.oninput = (e) => {
          if (!window.currentGameEngine) return;
          window.currentGameEngine.clientSettings.dragRotationSensitivity = parseInt(e.target.value, 10) / 100;
          localStorage.setItem('b_client_settings', JSON.stringify(window.currentGameEngine.clientSettings));
        };
      }

      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === '\\' || e.key === '|') {
          e.preventDefault();
          btnGameMenu.click();
        }

        if (gameDropdown.style.display === 'flex') {
          const key = e.key.toLowerCase();
          if (key === 'i') { e.preventDefault(); document.getElementById('btn-edit-id').click(); }
          if (key === 'k') { e.preventDefault(); document.getElementById('btn-keybinds')?.click(); }
          if (key === 's') { e.preventDefault(); document.getElementById('btn-settings').click(); }
          if (key === 'c') { e.preventDefault(); document.getElementById('btn-char-select').click(); }
          if (key === 'q') { e.preventDefault(); document.getElementById('btn-logout').click(); }
        }
      });
    }
  }
}
