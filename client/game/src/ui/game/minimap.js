const SCREEN_ANGLES = { 'right': 0, 'down-right': Math.PI/4, 'down': Math.PI/2, 'down-left': Math.PI*0.75, 'left': Math.PI, 'up-left': -Math.PI*0.75, 'up': -Math.PI/2, 'up-right': -Math.PI/4 };

export class MinimapManager {
  constructor(engine) {
    this.engine = engine;
  }

  draw(ctx) {
    const eng = this.engine;
    if (!eng.mapManager) return;
    const mmSize = 250;
    const mmX = eng.canvas.width - mmSize - 20;
    const mmY = 70; 
    const mmTileSize = 8; 
    const mmRadius = Math.ceil(((mmSize / mmTileSize) / 2) * 1.5) + 1;

    ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 10, 0.8)';
    ctx.fillRect(mmX, mmY, mmSize, mmSize);
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mmX, mmY, mmSize, mmSize);

        ctx.beginPath();
    ctx.rect(mmX, mmY, mmSize, mmSize);
    ctx.clip();

        ctx.translate(mmX + mmSize / 2, mmY + mmSize / 2);
    
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

    for (let gy = pGy - mmRadius; gy <= pGy + mmRadius; gy++) {
      for (let gx = pGx - mmRadius; gx <= pGx + mmRadius; gx++) {
        let color = null;
        
        for (let z = 15; z >= -4; z--) {
          const v = eng.mapManager.getVoxelAt(gx * 32, gy * 32, z * 32);
          if (v) {
            color = v.color || (v.tex === 'grass' ? '#51852E' : '#ffffff');
            break;
          }
        }

        if (color) {
          const drawX = (gx - pGx) * mmTileSize - offsetX - (mmTileSize / 2);
          const drawY = (gy - pGy) * mmTileSize - offsetY - (mmTileSize / 2);
          
          ctx.fillStyle = color;
          ctx.fillRect(drawX, drawY, mmTileSize + 0.5, mmTileSize + 0.5);
        }
      }
    }

        const drawMinimapDot = (worldX, worldY, dotColor, size) => {
      const drawX = (worldX / 32 - pFracX) * mmTileSize;
      const drawY = (worldY / 32 - pFracY) * mmTileSize;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead') drawMinimapDot(npc.x, npc.y, '#ff4757', 2);
    });

    Object.values(eng.otherPlayers).forEach(op => {
      if (op.state !== 'death') drawMinimapDot(op.x, op.y, '#3498db', 2.5);
    });

        ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    const pAngle = SCREEN_ANGLES[eng.player.dir] || 0;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(pAngle) * 8, Math.sin(pAngle) * 8);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}
