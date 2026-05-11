export class MinimapManager {
  constructor(engine) {
    this.engine = engine;
  }

  draw(ctx) {
    const eng = this.engine;
    const mmSize = 250;
    const mmX = eng.canvas.width - mmSize - 20;
    const mmY = 70; 
    const mmTileSize = 8; 
    const mmRadius = Math.ceil(((mmSize / mmTileSize) / 2) * 1.5) + 1;

    ctx.save();
    // Minimap Background & Border
    ctx.fillStyle = 'rgba(5, 7, 10, 0.8)';
    ctx.fillRect(mmX, mmY, mmSize, mmSize);
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mmX, mmY, mmSize, mmSize);

    // Clip graphics strictly to the bounds of the minimap box
    ctx.beginPath();
    ctx.rect(mmX, mmY, mmSize, mmSize);
    ctx.clip();

    // Translate to the center of the minimap, then rotate
    ctx.translate(mmX + mmSize / 2, mmY + mmSize / 2);
    ctx.rotate(45 * Math.PI / 180);

    const pFracX = eng.player.x / 32;
    const pFracY = eng.player.y / 32;
    const pGx = Math.floor(pFracX);
    const pGy = Math.floor(pFracY);
    const offsetX = (pFracX - pGx) * mmTileSize;
    const offsetY = (pFracY - pGy) * mmTileSize;

    for (let gy = pGy - mmRadius; gy <= pGy + mmRadius; gy++) {
      for (let gx = pGx - mmRadius; gx <= pGx + mmRadius; gx++) {
        const tileKey = `${gx},${gy}`;
        let sourceImg = null;
        let finalSy = 0;
        let sw = 64, sh = 64;
        
        const tileData = eng.mapData[tileKey];
        const color = typeof tileData === 'object' ? tileData.color : '#ffffff';
        
        if (tileData) {
          const texId = typeof tileData === 'object' ? tileData.tex : tileData;
          if (texId && eng.customTiles[texId] && eng.customTiles[texId].complete) {
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

        if (!sourceImg && eng.grassVariations && eng.grassVariations.length > 0) {
          const patchX = Math.floor(gx / 6);
          const patchY = Math.floor(gy / 6);
          let patchHash = Math.sin(patchX * 12.9898 + patchY * 78.233) * 43758.5453;
          patchHash -= Math.floor(patchHash);
          const baseIndex = Math.floor(patchHash * eng.grassVariations.length);
          
          let localHash = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453;
          localHash -= Math.floor(localHash);
          let variation = 0;
          if (localHash > 0.85) variation = 1;
          else if (localHash < 0.15) variation = -1;
          
          let finalIndex = Math.max(0, Math.min(eng.grassVariations.length - 1, baseIndex + variation));
          sourceImg = eng.grassVariations[finalIndex];
          sw = sourceImg.width || 64;
          sh = sourceImg.height || 64;
        }

        if (sourceImg && (sourceImg.naturalWidth > 0 || sourceImg.width > 0)) {
          const drawX = (gx - pGx) * mmTileSize - offsetX - (mmTileSize / 2);
          const drawY = (gy - pGy) * mmTileSize - offsetY - (mmTileSize / 2);
          
          ctx.drawImage(sourceImg, 0, finalSy, sw, sh, drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
          
          if (tileData && color !== '#ffffff' && (!eng.tintCache || !eng.tintCache[`${tileData.tex}_${color}_${finalSy}`])) {
             ctx.fillStyle = color;
             ctx.globalCompositeOperation = 'multiply';
             ctx.fillRect(drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
             ctx.globalCompositeOperation = 'source-over';
          }
        }
      }
    }

    // Entity Blips
    const drawMinimapDot = (worldX, worldY, dotColor, size) => {
      const drawX = (worldX / 32 - pFracX) * mmTileSize;
      const drawY = (worldY / 32 - pFracY) * mmTileSize;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
      ctx.fill();
    };

    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead') drawMinimapDot(npc.x, npc.y, '#ff4757', 2);
    });

    Object.values(eng.otherPlayers).forEach(op => {
      if (op.state !== 'death') drawMinimapDot(op.x, op.y, '#3498db', 2.5);
    });

    // Center Player Dot
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}
