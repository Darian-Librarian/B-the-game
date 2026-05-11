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

    // Determine facing angle in radians
    let facingAngle = 0;
    if (eng.player.dir === 'up') facingAngle = -Math.PI * 0.75; // -135 degrees
    else if (eng.player.dir === 'down') facingAngle = Math.PI * 0.25; // 45 degrees
    else if (eng.player.dir === 'left') facingAngle = Math.PI * 0.75; // 135 degrees
    else if (eng.player.dir === 'right') facingAngle = -Math.PI * 0.25; // -45 degrees

    const fov = Math.PI / 3; // 60 degrees either side = 120 degree frontal cone!

    const checkHit = (tx, ty, tz) => {
      tz = tz || 0;
      
      // 1. Z-Level Check: Must be roughly on the same vertical level (1.5 blocks leeway)
      if (Math.abs(pz - tz) > 48) return false; 
      
      // 2. Distance Check
      const dist = Math.hypot(tx - px, ty - py);
      if (dist > 200) return false;

      // 3. Cone Check: Is the target in front of us?
      const angleToTarget = Math.atan2(ty - py, tx - px);
      let angleDiff = angleToTarget - facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; // Normalize to [-PI, PI]
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      if (Math.abs(angleDiff) > fov) return false; 

      // 4. Line of Sight Check: Raycast to see if a tall wall is in the way!
      const steps = Math.ceil(dist / 16); // Sample every 16 world units
      for (let i = 1; i <= steps; i++) {
        const sampleX = px + ((tx - px) * (i / steps));
        const sampleY = py + ((ty - py) * (i / steps));
        const terrainZ = eng.getTerrainZ(sampleX, sampleY);
        
        // If the terrain is 2 blocks (64 Z) higher than BOTH entities, it's a solid wall!
        if (terrainZ >= pz + 64 && terrainZ >= tz + 64) return false; 
      }

      return true;
    };

    // Combat Logic: Hit NPCs in range
    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead') {
        if (checkHit(npc.x, npc.y, npc.z)) {
          eng.socket.emit('npc_hit', { targetUuid: npc.uuid, damage: 200 });
        }
      }
    });

    // PvP Logic: Hit Other Players in range
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
