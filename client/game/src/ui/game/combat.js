export class CombatManager {
  constructor(engine) {
    this.engine = engine;
  }

  triggerAttack() {
    const eng = this.engine;
    
    if (eng.player.state === 'dash' || eng.player.state === 'death' || eng.player.actionTimer > 0) return;

    if (eng.player.energy < 20) return;
    eng.player.energy -= 20;
    eng.ui.update();

    eng.player.state = `attack${eng.player.nextAttack}`;
    eng.player.nextAttack = eng.player.nextAttack === 1 ? 2 : 1;
    eng.player.frame = 0;
    eng.player.frameTimer = 0;
    eng.player.actionTimer = 8 * eng.player.frameInterval; 

    const px = eng.player.x;
    const py = eng.player.y;
    const pz = eng.player.z || 0;

    let facingAngle = 0;
    if (eng.player.dir === 'up') facingAngle = -Math.PI * 0.75;
    else if (eng.player.dir === 'down') facingAngle = Math.PI * 0.25;
    else if (eng.player.dir === 'left') facingAngle = Math.PI * 0.75;
    else if (eng.player.dir === 'right') facingAngle = -Math.PI * 0.25;

    const fov = Math.PI / 3;

    const checkHit = (tx, ty, tz) => {
      tz = tz || 0;
      
      if (Math.abs(pz - tz) > 48) return false; 
      
      const dist = Math.hypot(tx - px, ty - py);
      if (dist > 200) return false;

      const angleToTarget = Math.atan2(ty - py, tx - px);
      let angleDiff = angleToTarget - facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      if (Math.abs(angleDiff) > fov) return false; 

      const steps = Math.ceil(dist / 16);
      for (let i = 1; i <= steps; i++) {
        const sampleX = px + ((tx - px) * (i / steps));
        const sampleY = py + ((ty - py) * (i / steps));
        const terrainZ = eng.getTerrainZ(sampleX, sampleY);
        
        if (terrainZ >= pz + 64 && terrainZ >= tz + 64) return false; 
      }

      return true;
    };

    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead') {
        if (checkHit(npc.x, npc.y, npc.z)) {
          eng.socket.emit('npc_hit', { targetUuid: npc.uuid, damage: 200 });
        }
      }
    });

    for (let id in eng.otherPlayers) {
      const op = eng.otherPlayers[id];
      if (op.state !== 'death') {
        if (checkHit(op.x, op.y, op.z)) {
          eng.socket.emit('player_hit', { targetId: id, damage: 200 });
        }
      }
    }
  }
}
