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

    // Dynamically inject the M button beneath the I button
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
      sideHud.appendChild(btn);
    }

    // Dynamically inject the Map Controls overlay
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen && !document.getElementById('map-controls')) {
      const controls = document.createElement('div');
      controls.id = 'map-controls';
      controls.style.cssText = 'position: absolute; bottom: 30px; right: 30px; display: none; flex-direction: column; align-items: flex-end; gap: 15px; z-index: 200; font-family: var(--font-mono); user-select: none; pointer-events: auto;';

      // Zoom Buttons
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

      // Scale/Ruler Marker
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

    // Map Hotkey
    this.keydownListener = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return; // Prevent rapid flickering if key is held!
      if (e.key.toLowerCase() === 'm') {
        toggleMap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    // Map Scroll Zoom
    this.wheelListener = (e) => {
      if (!this.active) return;
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
      // Standard assumption: 1 Block (32x32) = 5 ft
      let tiles = 20; // 100 ft default
      let feet = 100;
      
      if (this.zoom >= 10) {
        tiles = 10; feet = 50; // Map is super zoomed in, show 50ft ruler
      } else if (this.zoom <= 2) {
        tiles = 40; feet = 200; // Map is extremely zoomed out, show 200ft ruler
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
    if (!this.active) return;
    
    const eng = this.engine;
    const canvasW = eng.canvas.width;
    const canvasH = eng.canvas.height;
    const mmTileSize = this.zoom; // Dynamically scales via mouse-wheel

    ctx.save();

    // Black out the map area
    ctx.fillStyle = 'rgba(5, 7, 10, 0.95)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Set up Top-Down projection
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(45 * Math.PI / 180);

    const pFracX = eng.player.x / 32;
    const pFracY = eng.player.y / 32;
    const pGx = Math.floor(pFracX);
    const pGy = Math.floor(pFracY);
    const offsetX = (pFracX - pGx) * mmTileSize;
    const offsetY = (pFracY - pGy) * mmTileSize;

    // 1. Draw Solid Base Grass Color (Fixes black screen rendering bug!)
    ctx.fillStyle = '#447525';
    const maxD = Math.max(canvasW, canvasH) * 2;
    ctx.fillRect(-maxD, -maxD, maxD * 2, maxD * 2);

    // 1.5. Draw Endless Grass Pattern seamlessly across the map!
    if (!this.grassPattern && eng.grassVariations && eng.grassVariations.length > 0) {
      this.grassPattern = ctx.createPattern(eng.grassVariations[0], 'repeat');
    }
    if (this.grassPattern) {
      ctx.save();
      const shiftX = (pFracX * mmTileSize);
      const shiftY = (pFracY * mmTileSize);
      ctx.translate(-shiftX, -shiftY);
      const scale = mmTileSize / 64; // Scale pattern exactly to Zoom level
      ctx.scale(scale, scale);
      ctx.fillStyle = this.grassPattern;
      const fillMax = maxD / scale;
      ctx.fillRect(-fillMax, -fillMax, fillMax * 2, fillMax * 2);
      ctx.restore();
    }

    // 2. Enable Image Smoothing (Fixes the dither-y/static look on tiny textures!)
    ctx.imageSmoothingEnabled = true;

    // 3. Draw Custom Placed Tiles
    for (let key in eng.mapData) {
      const coords = key.split(',');
      const gx = parseInt(coords[0], 10);
      const gy = parseInt(coords[1], 10);

      const drawX = (gx - pGx) * mmTileSize - offsetX - (mmTileSize / 2);
      const drawY = (gy - pGy) * mmTileSize - offsetY - (mmTileSize / 2);
      
      // Safe Culling
      if (drawX < -canvasW || drawX > canvasW || drawY < -canvasH || drawY > canvasH) continue;

      const tileData = eng.mapData[key];
      const color = typeof tileData === 'object' ? tileData.color : '#ffffff';
      let sourceImg = null;
      let finalSy = 0;
      let sw = 64, sh = 64;

      if (tileData) {
        const texId = typeof tileData === 'object' ? tileData.tex : tileData;
        if (texId && eng.customTiles && eng.customTiles[texId] && eng.customTiles[texId].complete) {
          const img = eng.customTiles[texId];
          sw = img.width;
          sh = img.height;
          if (img.animated) {
             sh = sw;
             const frameCount = Math.max(1, img.height / sh);
             finalSy = (Math.floor(performance.now() / 100) % frameCount) * sh;
          }
          
          const cacheKey = `${texId}_${color}_${finalSy}`;
          if (eng.tintCache && eng.tintCache[cacheKey]) {
            sourceImg = eng.tintCache[cacheKey];
            finalSy = 0;
          } else {
            sourceImg = img;
          }
        }
      }

      if (sourceImg && (sourceImg.naturalWidth > 0 || sourceImg.width > 0)) {
        ctx.drawImage(sourceImg, 0, finalSy, sw, sh, drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
        
        if (tileData && color !== '#ffffff' && (!eng.tintCache || !eng.tintCache[`${tileData.tex}_${color}_${finalSy}`])) {
           ctx.fillStyle = color;
           ctx.globalCompositeOperation = 'multiply';
           ctx.fillRect(drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
           ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    // 3. Draw Avatars and HUDs for Entities
    const drawMapAvatar = (entity, isPlayer = false) => {
      const drawX = (entity.x / 32 - pFracX) * mmTileSize;
      const drawY = (entity.y / 32 - pFracY) * mmTileSize;
      
      if (drawX < -canvasW || drawX > canvasW || drawY < -canvasH || drawY > canvasH) return;

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(-45 * Math.PI / 180);

      let state = entity.state;
      if (state === 'dead') state = 'death';
      else if (entity.hurtTimer > 0) state = 'hurt';

      const spriteKey = `${state}_${entity.dir}`;
      const img = eng.sprites[spriteKey];

      if (img && img.complete && img.naturalWidth > 0) {
        const fw = 96; const fh = 90;
        const scale = Math.max(0.3, mmTileSize / 24); // Scale avatar dynamically but keep a minimum size
        ctx.scale(scale, scale);
        ctx.drawImage(img, (entity.frame || 0) * fw, 0, fw, fh, -fw / 2, -fh + 35, fw, fh);
      } else {
        ctx.fillStyle = isPlayer ? '#2ecc71' : (entity.uuid ? '#ff4757' : '#3498db');
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // Drop scale context for text
      
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(-45 * Math.PI / 180); // Reverse rotation for readable text!
      
      const name = isPlayer ? eng.playerData.name : entity.name;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      const textOffset = Math.max(10, mmTileSize * 1.5);
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
