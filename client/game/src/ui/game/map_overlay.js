const SCREEN_ANGLES = { 'right': 0, 'down-right': Math.PI/4, 'down': Math.PI/2, 'down-left': Math.PI*0.75, 'left': Math.PI, 'up-left': -Math.PI*0.75, 'up': -Math.PI/2, 'up-right': -Math.PI/4 };

export class MapOverlayManager {
  constructor(engine) {
    this.engine = engine;
    this.active = false;
    this.zoom = 4;
    this.setupUI();
  }

  setupUI() {
    const toggleMap = () => {
      this.active = !this.active;
      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.blur();
      
      const controls = document.getElementById('map-controls');
      if (controls) {
        controls.style.display = this.active ? 'flex' : 'none';
        if (this.active) this.updateScale();
      }
    };

    const sideHud = document.querySelector('.game-side-hud');
    if (sideHud && !document.getElementById('btn-fullscreen-map')) {
      const btn = document.createElement('button');
      btn.id = 'btn-fullscreen-map';
      btn.className = 'btn-secondary';
      btn.style.cssText = 'width: 45px; height: 45px; font-weight: bold; background: rgba(0,0,0,0.8); border-color: #f39c12; color: #f39c12; border-radius: 4px; font-size: 1.2rem; cursor: pointer; transition: background 0.2s;';
      btn.innerText = 'M';
      btn.onclick = toggleMap;
      btn.onmouseenter = () => btn.style.background = 'rgba(243, 156, 18, 0.2)';
      btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,0.8)';
      const btnPowers = document.getElementById('btn-powers');
      if (btnPowers) {
        sideHud.insertBefore(btn, btnPowers);
      } else {
        sideHud.appendChild(btn);
      }
    }

    const gameScreen = document.getElementById('game-screen');
    if (gameScreen && !document.getElementById('map-controls')) {
      const controls = document.createElement('div');
      controls.id = 'map-controls';
      controls.style.cssText = 'position: absolute; bottom: 30px; right: 30px; display: none; flex-direction: column; align-items: flex-end; gap: 15px; z-index: 200; font-family: var(--font-mono); user-select: none; pointer-events: auto;';

      const zoomGroup = document.createElement('div');
      zoomGroup.style.cssText = 'display: flex; flex-direction: column; border: 2px solid #f39c12; border-radius: 4px; overflow: hidden; background: rgba(5, 7, 10, 0.9); box-shadow: 0 0 15px rgba(0,0,0,0.8);';

      const btnIn = document.createElement('button');
      btnIn.innerText = '+';
      btnIn.style.cssText = 'width: 40px; height: 40px; background: transparent; color: #f39c12; border: none; border-bottom: 1px solid rgba(243, 156, 18, 0.5); font-weight: bold; cursor: pointer; font-size: 1.5rem; transition: background 0.2s;';
      btnIn.onmouseenter = () => btnIn.style.background = 'rgba(243, 156, 18, 0.2)';
      btnIn.onmouseleave = () => btnIn.style.background = 'transparent';
      btnIn.onclick = () => { this.zoom = Math.min(this.zoom + 1, 16); this.updateScale(); };

      const btnOut = document.createElement('button');
      btnOut.innerText = '−';
      btnOut.style.cssText = 'width: 40px; height: 40px; background: transparent; color: #f39c12; border: none; font-weight: bold; cursor: pointer; font-size: 1.5rem; transition: background 0.2s;';
      btnOut.onmouseenter = () => btnOut.style.background = 'rgba(243, 156, 18, 0.2)';
      btnOut.onmouseleave = () => btnOut.style.background = 'transparent';
      btnOut.onclick = () => { this.zoom = Math.max(this.zoom - 1, 1); this.updateScale(); };

      zoomGroup.appendChild(btnIn);
      zoomGroup.appendChild(btnOut);

      const scaleBar = document.createElement('div');
      scaleBar.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; color: #f39c12; text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000; font-size: 0.85rem; font-weight: bold;';
      
      const scaleLabel = document.createElement('span');
      scaleLabel.id = 'map-scale-label';
      scaleLabel.innerText = '100 ft';
      scaleLabel.style.marginBottom = '4px';
      scaleLabel.style.marginRight = '2px';

      const scaleLine = document.createElement('div');
      scaleLine.id = 'map-scale-line';
      scaleLine.style.cssText = 'height: 8px; border-left: 2px solid #f39c12; border-right: 2px solid #f39c12; border-bottom: 2px solid #f39c12; width: 80px; transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: inset 0 -2px 0 rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.5);';

      scaleBar.appendChild(scaleLabel);
      scaleBar.appendChild(scaleLine);

      controls.appendChild(zoomGroup);
      controls.appendChild(scaleBar);
      gameScreen.appendChild(controls);
    }

    this.keydownListener = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return; 
      if (e.key.toLowerCase() === 'm') {
        toggleMap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.wheelListener = (e) => {
      if (!this.active) return;
      if (e.target !== this.engine.canvas) return;
      if (e.deltaY < 0) {
        this.zoom = Math.min(this.zoom + 1, 16);
      } else {
        this.zoom = Math.max(this.zoom - 1, 1);
      }
      this.updateScale();
    };
    window.addEventListener('wheel', this.wheelListener);
  }

  updateScale() {
    const line = document.getElementById('map-scale-line');
    const label = document.getElementById('map-scale-label');
    if (line && label) {
      let tiles = 20;
      let feet = 100;
      
      if (this.zoom >= 10) {
        tiles = 10; feet = 50;
      } else if (this.zoom <= 2) {
        tiles = 40; feet = 200;
      }
      
      line.style.width = `${tiles * this.zoom}px`;
      label.innerText = `${feet} ft`;
    }
  }

  disconnect() {
    window.removeEventListener('keydown', this.keydownListener);
    window.removeEventListener('wheel', this.wheelListener);
    const btn = document.getElementById('btn-fullscreen-map');
    if (btn) btn.remove();
    const controls = document.getElementById('map-controls');
    if (controls) controls.remove();
  }

  draw(ctx) {
    if (!this.active || !this.engine.mapManager) return;
    
    const eng = this.engine;
    const canvasW = eng.canvas.width;
    const canvasH = eng.canvas.height;
    const mmTileSize = this.zoom;

    ctx.save();

    ctx.fillStyle = 'rgba(5, 7, 10, 0.95)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.translate(canvasW / 2, canvasH / 2);
    
    const camAngle = eng.renderer ? eng.renderer.cameraAngle : 0;
    const rotationAngle = eng.clientSettings.rotateMinimap ? camAngle : 0;
    ctx.scale(-1, 1);
    ctx.rotate((45 - rotationAngle) * Math.PI / 180);

    const pFracX = eng.player.x / 32;
    const pFracY = eng.player.y / 32;
    const pGx = Math.floor(pFracX);
    const pGy = Math.floor(pFracY);
    const offsetX = (pFracX - pGx) * mmTileSize;
    const offsetY = (pFracY - pGy) * mmTileSize;

    const tilesX = Math.ceil((canvasW / mmTileSize) / 2) + 1;
    const tilesY = Math.ceil((canvasH / mmTileSize) / 2) + 1;
    const maxRadius = Math.max(tilesX, tilesY);

    for (let gy = pGy - maxRadius; gy <= pGy + maxRadius; gy++) {
      for (let gx = pGx - maxRadius; gx <= pGx + maxRadius; gx++) {
        const drawX = (gx - pGx) * mmTileSize - offsetX - (mmTileSize / 2);
        const drawY = (gy - pGy) * mmTileSize - offsetY - (mmTileSize / 2);
      
        if (drawX < -canvasW * 1.5 || drawX > canvasW * 1.5 || drawY < -canvasH * 1.5 || drawY > canvasH * 1.5) continue;

        let color = null;
        for (let z = 15; z >= -4; z--) {
          const v = eng.mapManager.getVoxelAt(gx * 32, gy * 32, z * 32);
          if (v) {
            color = v.color || (v.tex === 'grass' ? '#51852E' : '#ffffff');
            break;
          }
        }

        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
        }
      }
    }

    const drawMapAvatar = (entity, isPlayer = false) => {
      const drawX = (entity.x / 32 - pFracX) * mmTileSize;
      const drawY = (entity.y / 32 - pFracY) * mmTileSize;
      
      if (drawX < -canvasW || drawX > canvasW || drawY < -canvasH || drawY > canvasH) return;

      ctx.save();
      ctx.translate(drawX, drawY);
      
      ctx.fillStyle = isPlayer ? '#2ecc71' : (entity.uuid ? '#ff4757' : '#3498db');
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(4, mmTileSize/2), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isPlayer) {
        const pAngle = SCREEN_ANGLES[eng.player.dir] || 0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(pAngle) * Math.max(8, mmTileSize), Math.sin(pAngle) * Math.max(8, mmTileSize));
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.rotate(-(45 - rotationAngle) * Math.PI / 180); // Un-rotate for text
      ctx.scale(-1, 1); // Un-mirror for text

      const name = isPlayer ? eng.playerData.name : entity.name;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      const textOffset = Math.max(12, mmTileSize * 1.5);
      ctx.strokeText(name, 0, textOffset);
      ctx.fillText(name, 0, textOffset);

      const hpPercent = Math.max(0, entity.hp / entity.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(-15, textOffset + 6, 30, 4);
      ctx.fillStyle = isPlayer ? '#2ecc71' : (entity.uuid ? '#ff4757' : '#3498db');
      ctx.fillRect(-15, textOffset + 6, 30 * hpPercent, 4);
      
      if (entity.energy !== undefined && entity.maxEnergy) {
         const epPercent = Math.max(0, entity.energy / entity.maxEnergy);
         ctx.fillStyle = '#0984e3';
         ctx.fillRect(-15, textOffset + 10, 30 * epPercent, 4);
      }

      ctx.restore();
    };

    eng.npcs.forEach(npc => { if (npc.state !== 'dead') drawMapAvatar(npc); });
    Object.values(eng.otherPlayers).forEach(op => { if (op.state !== 'death') drawMapAvatar(op); });
    drawMapAvatar(eng.player, true);

    ctx.restore();
  }

  drawBorder(ctx) {
    if (!this.active) return;
    const canvasW = this.engine.canvas.width;
    const mmSize = 250;
    const pipX = canvasW - mmSize / 2 - 20;
    const pipY = 70 + mmSize / 2;
    const pipRadius = mmSize / 2;

    ctx.beginPath();
    ctx.arc(pipX, pipY, pipRadius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(243, 156, 18, 0.8)';
    ctx.stroke();
  }
}
