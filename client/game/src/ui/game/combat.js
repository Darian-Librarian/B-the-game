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

    // Combat Logic: Hit NPCs in range
    eng.npcs.forEach(npc => {
      if (npc.state !== 'dead') {
        const dist = Math.hypot(npc.x - eng.player.x, npc.y - eng.player.y);
        if (dist < 200) {
          eng.socket.emit('npc_hit', { targetUuid: npc.uuid, damage: 200 });
        }
      }
    });

    // PvP Logic: Hit Other Players in range
    for (let id in eng.otherPlayers) {
      const op = eng.otherPlayers[id];
      if (op.state !== 'death') {
        const dist = Math.hypot(op.x - eng.player.x, op.y - eng.player.y);
        if (dist < 200) { 
          eng.socket.emit('player_hit', { targetId: id, damage: 200 });
        }
      }
    }
  }
}
