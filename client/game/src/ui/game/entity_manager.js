export class EntityManager {
  constructor(engine) {
    this.engine = engine;
  }

  update(dt) {
    const updateBubbles = (entity) => {
      
      if (entity.chatBubble) {
        if (!entity.chatBubbles) entity.chatBubbles = [];
        entity.chatBubbles.push({ text: entity.chatBubble.text, timer: 4000, opacity: 0 });
        delete entity.chatBubble;
      }
      if (!entity.chatBubbles) return;
      for (let i = entity.chatBubbles.length - 1; i >= 0; i--) {
        const b = entity.chatBubbles[i];
        b.timer -= dt;
        
                if (b.timer > 0 && b.opacity < 1) b.opacity = Math.min(1, b.opacity + dt / 150);
        else if (b.timer <= 0) b.opacity -= dt / 300;
        
                if (b.currentY === undefined) b.currentY = b.targetY || 0;
        b.currentY += ((b.targetY || 0) - b.currentY) * 15 * (dt / 1000);
        
        if (b.opacity <= 0) entity.chatBubbles.splice(i, 1);
      }
    };

    updateBubbles(this.engine.player);
    for (let id in this.engine.otherPlayers) updateBubbles(this.engine.otherPlayers[id]);

    this.updatePlayer(dt);
    this.updateNpcs(dt);
    this.updateOtherPlayers(dt);
  }

  updatePlayer(dt) {
    const eng = this.engine;
    const player = eng.player;

    if (player.actionTimer > 0) {
      player.actionTimer -= dt;
      if (player.actionTimer <= 0) {
        if (player.state !== 'death') player.state = 'idle';
      }
    }

    if (player.hurtTimer > 0) player.hurtTimer -= dt;

    if (player.state !== 'death' && player.hp < player.maxHp) {
      const integrity = eng.playerData.integrity || 0;
      if (integrity === 0) {
        player.hp += 1 * (dt / 1000);
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        eng.ui.update();
      }
    }

    if (player.energy < player.maxEnergy) {
      player.energy += 50 * (dt / 1000);
      if (player.energy > player.maxEnergy) player.energy = player.maxEnergy;
      if (player.state !== 'death') eng.ui.update();
    }

    let dx = 0; let dy = 0;
    let isPressingShift = false;
    let isPressingSpace = false;

    if (player.state === 'death') {
      eng.screenFade = Math.min(1.0, eng.screenFade + (dt / 3000));
      player.respawnTimer -= dt;
      if (player.respawnTimer <= 0) {
        player.state = 'idle';
        player.hp = player.maxHp;
        player.frame = 0;
        player.x = (Math.random() - 0.5) * 300;
        player.y = (Math.random() - 0.5) * 300;
        eng.camera.x = player.x;
        eng.camera.y = player.y;
        eng.ui.update();
        eng.chat.addMessage('system', 'System', 'You have respawned!');
        eng.lastEmit.state = 'respawning';
      }
    } else {
      if (eng.screenFade > 0) eng.screenFade = Math.max(0, eng.screenFade - (dt / 2000));
      if (eng.keys['w']) { dx -= 1; dy -= 1; }
      if (eng.keys['s']) { dx += 1; dy += 1; }
      if (eng.keys['a']) { dx -= 1; dy += 1; }
      if (eng.keys['d']) { dx += 1; dy -= 1; }
      isPressingShift = eng.clientSettings.alwaysSprint ? !eng.keys['shift'] : !!eng.keys['shift'];
      isPressingSpace = eng.keys[' '];
    }

    if (dx !== 0 || dy !== 0) {
      player.moveTarget = null;
    } else if (player.moveTarget) {
      player.moveTarget.timer -= (dt / 1000);
      if (player.moveTarget.timer <= 0) {
        player.moveTarget = null;
      } else {
        const dist = Math.hypot(player.moveTarget.x - player.x, player.moveTarget.y - player.y);
        if (dist < 5) {
          player.moveTarget = null;
        } else {
          dx = player.moveTarget.x - player.x;
          dy = player.moveTarget.y - player.y;
          if (player.moveTarget.sprint) isPressingShift = true;
        }
      }
    }

    const isMoving = dx !== 0 || dy !== 0;
    let speed = player.speed;

    if (isPressingShift && !player.wasPressingShift && isMoving && player.actionTimer <= 0) {
      if (player.energy >= 50) {
        player.energy -= 50;
        eng.ui.update();
        player.state = 'dash';
        player.frame = 0;
        player.frameTimer = 0;
        player.actionTimer = 400;
      }
    }
    player.wasPressingShift = isPressingShift;

    if (isPressingSpace && !player.wasPressingSpace && player.actionTimer <= 0) {
      const targetZ = eng.getTerrainZ(player.x, player.y);
      if (player.energy >= 25 && (player.z || 0) <= targetZ + 1) {
        player.energy -= 25;
        eng.ui.update();
        player.state = 'jump';
        player.frame = 0;
        player.frameTimer = 0;
        player.actionTimer = 4 * player.frameInterval;
        player.vz = 450;
      }
    }
    player.wasPressingSpace = isPressingSpace;

    if (player.state === 'death') {
      speed = 0;
    } else if (player.actionTimer > 0) {
      if (player.state === 'dash') speed = player.runSpeed * 1.5;
      else if (player.state === 'jump') speed = isMoving ? (isPressingShift ? player.runSpeed : player.speed) : 0;
      else if (player.state.startsWith('attack') || player.state.startsWith('throw_attack')) speed = 0;
    } else {
      if (isMoving) {
        player.state = isPressingShift ? 'run' : 'walk';
        speed = isPressingShift ? player.runSpeed : player.speed;
      } else {
        player.state = 'idle';
      }
    }

    if (isMoving && speed > 0) {
      const currentSpeed = speed * (dt / 1000);
      const len = Math.sqrt(dx * dx + dy * dy);
      const moveX = (dx / len) * currentSpeed;
      const moveY = (dy / len) * currentSpeed;

      if (!eng.checkCollision(player.x + moveX, player.y)) player.x += moveX;
      if (!eng.checkCollision(player.x, player.y + moveY)) player.y += moveY;

      if (!player.state.startsWith('attack') && !player.state.startsWith('throw_attack')) {
        const screenDx = dx - dy;
        const screenDy = dx + dy;
        if (Math.abs(screenDy) > Math.abs(screenDx)) {
          player.dir = screenDy > 0 ? 'down' : 'up';
        } else {
          player.dir = screenDx > 0 ? 'right' : 'left';
        }
      }
    }

    player.frameTimer += dt;
    let currentInterval = player.frameInterval;
    if (player.state === 'death') currentInterval *= 3;
    else if (player.state.startsWith('throw_attack')) currentInterval /= 8;
    if (player.frameTimer >= currentInterval) {
      player.frameTimer = 0;
      if (player.state === 'death') {
        if (player.frame < 7) player.frame++;
      } else if (player.state === 'jump' || player.hurtTimer > 0) {
        player.frame = (player.frame + 1) % 4;
      } else {
        player.frame = (player.frame + 1) % 8;
      }
    }
  }

  updateNpcs(dt) {
    this.engine.npcs.forEach(npc => {
      if (npc.hurtTimer > 0) npc.hurtTimer -= dt;
      npc.frameTimer += dt;
      if (npc.frameTimer >= this.engine.player.frameInterval) {
        npc.frameTimer = 0;
        if (npc.state === 'dead') {
          if (npc.frame < 7) npc.frame++;
        } else if (npc.state === 'jump' || npc.hurtTimer > 0) {
          npc.frame = (npc.frame + 1) % 4;
        } else {
          npc.frame = (npc.frame + 1) % 8;
        }
      }
    });
  }

  updateOtherPlayers(dt) {
    Object.values(this.engine.otherPlayers).forEach(op => {
      if (op.hurtTimer > 0) op.hurtTimer -= dt;
      op.frameTimer = (op.frameTimer || 0) + dt;
      let opInterval = this.engine.player.frameInterval;
      if (op.state === 'death') opInterval *= 3;
      else if (op.state && op.state.startsWith('throw_attack')) opInterval /= 8;
      if (op.frameTimer >= opInterval) {
        op.frameTimer = 0;
        if (op.state === 'death') {
          if ((op.frame || 0) < 7) op.frame = (op.frame || 0) + 1;
        } else if (op.state === 'jump' || op.hurtTimer > 0) {
          op.frame = ((op.frame || 0) + 1) % 4;
        } else {
          op.frame = ((op.frame || 0) + 1) % 8;
        }
      }
    });
  }
}