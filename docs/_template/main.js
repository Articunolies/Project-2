title = "SURVIVOR";

description = `
[Tap] Jump
`;

// Character sprite animation
characters = [
  `
llllll
ll l l
ll l l
llllll
 l  ll
 l  
  `,
  `
llllll
ll l l
ll l l
llllll
ll  l
    l
  `,
];

// Game settings
options = {
  isPlayingBgm: true,
  isReplayEnabled: true,
  seed: 16,
};

// Interactables
let obstacle;
let extraLifeItem;
let bonusPlayers = false;
let invincibilityItem;
let invincibility = false;
let meteor;
let meteorActivated = false;
let meteorSpawnedThisRound = false;

// Gameplay parameters
const PLAYER_JUMP_HEIGHT = 1.75;
const JUMP_DILATION = 175; // (0-inf) range. Higher number = less jump dilation
const METEOR_SLAM_FORCE = 2.5;
const METEOR_SPAWN_RATE = 0.15;
const BONUS_PLAYER_COUNT = 2;
const BONUS_LIFE_SPAWN_RATE = 0.4;
const INVINCIBILITY_SPAWN_RATE = 0.2;

let players;
let downedPlayers;
let playersCount = 8;

// Main game loop
function update() {
  // check if game is running
  if (!ticks) {
    players = [];
    downedPlayers = [];
    obstacle = undefined;
    extraLifeItem = undefined;
    invincibilityItem = undefined;
  }

  // start next obstacle wave
  if (obstacle == null) {
    spawnWave();
  }

  // move obstacle across the screen
  obstacle.update(difficulty);

  // move item across screen if player hasn't yet collected it
  if (extraLifeItem) {
    extraLifeItem.update(difficulty);
  }

  // move invincibility item across screen
  if (invincibilityItem) {
    invincibilityItem.update(difficulty);
  }

  if (players.length == 1 && !meteor && !meteorSpawnedThisRound) {
    meteorActivated = true;
    meteorSpawnedThisRound = true;
    triggerMeteor();
  }

  if (meteor) {
    meteor.update(difficulty);
    if (meteor.isOffScreen()) {
      play("explosion");
      players.forEach((p) => {
        jump(p, METEOR_SLAM_FORCE);
      });

      meteor = undefined;
    }
  }

  // draw ground
  rect(0, 93, 99, 7);

  // handle player movement + collisions
  updatePlayers();

  checkGameOver();
  updateDownedPlayers();

  // End wave once all wave elements are destroyed/off screen
  if (isWaveOver()) {
    resetWaveElements();
    addScore(players.length, 10, 50);
  }
}

function spawnWave() {
  addPlayers(); // spawn players
  obstacle = getRandomObstacle(); // spawn obstacle
  extraLifeItem =
    rnd(0, 1) < BONUS_LIFE_SPAWN_RATE ? new ExtraLifeItem() : undefined; // randomly spawn extra life
  invincibilityItem =
    rnd(0, 1) < INVINCIBILITY_SPAWN_RATE ? new InvincibilityItem() : undefined; // randomly spawn invincibility item
}

function isWaveOver() {
  return (
    obstacle.isOffScreen() &&
    (!extraLifeItem || extraLifeItem.isOffScreen()) &&
    (!invincibilityItem || invincibilityItem.isOffScreen())
  );
}

function triggerMeteor() {
  if (meteorActivated) {
    console.log("meteor spawned");
    meteor = new Meteor();
    meteorActivated = false;
  }
}

function resetWaveElements() {
  obstacle = undefined;
  extraLifeItem = undefined;
  invincibilityItem = undefined;
  invincibility = false;
  meteorSpawnedThisRound = false;
}

// incrementally add players until max player count is reached
function addPlayers() {
  play("powerUp");
  let extraPlayers = bonusPlayers ? BONUS_PLAYER_COUNT : 0;
  while (players.length < playersCount + extraPlayers) {
    addPlayer();
  }
  bonusPlayers = false;
}

// spawn player
function addPlayer() {
  players.push({
    pos: vec(rnd(10, 40), rnd(-9, 0)),
    vel: vec(rnds(1), rnd(1)),
    isOnFloor: false,
    isJumping: false,
    isJumped: false,
    underFoot: undefined,
    onHead: undefined,
    ticks: rndi(60),
  });
}

// Main player movement + collision handler
function updatePlayers() {
  let addingPlayerCount = 0;

  players = players.filter((player) => {
    player.ticks++;

    handleStacking(player);
    handleJumping(player);
    updatePlayerPositionAndVelocity(player);

    if (!invincibility && isCollidingWithObstacle(player)) {
      handleCollision(player);
      return false;
    }

    if (hitExtraLifeItem(player)) {
      play("coin");
      bonusPlayers = true;
      if (extraLifeItem) addScore(2, extraLifeItem.pos.x, extraLifeItem.pos.y);
      extraLifeItem = undefined;
    }

    if (hitInvincibilityItem(player)) {
      play("laser");
      invincibility = true;
      invincibilityItem = undefined;
    }

    if (!playerOutOfBounds(player)) {
      addingPlayerCount++;
      return false;
    }

    return true;
  });

  times(addingPlayerCount, addPlayer);
  updateJumpingStates();
}

function handleStacking(p) {
  if (p.underFoot == null) {
    players.forEach((ap) => {
      if (p !== ap && p.isOnFloor && p.pos.distanceTo(ap.pos) < 4) {
        play("select");
        let bp = p;
        for (let i = 0; i < 99; i++) {
          if (bp.underFoot == null) {
            break;
          }
          bp = bp.underFoot;
        }
        let tp = ap;
        for (let i = 0; i < 99; i++) {
          if (tp.onHead == null) {
            break;
          }
          tp = tp.onHead;
        }
        tp.onHead = bp;
        bp.underFoot = tp;
        let rp = p;
        for (let i = 0; i < 99; i++) {
          rp.isJumped = rp.isOnFloor = false;
          if (rp.onHead == null) {
            break;
          }
          rp = rp.onHead;
        }
        rp = p;
        for (let i = 0; i < 99; i++) {
          rp.isJumped = rp.isOnFloor = false;
          if (rp.underFoot == null) {
            break;
          }
          rp = rp.underFoot;
        }
      }
    });
  }
}

function handleJumping(p) {
  if (
    input.isJustPressed &&
    (p.isOnFloor || (p.underFoot != null && p.underFoot.isJumped))
  ) {
    jump(p, PLAYER_JUMP_HEIGHT);
  }
}

function jump(p, jump_height) {
  play("jump");
  p.vel.set(0, -jump_height * (1 + (100 - p.pos.y) / JUMP_DILATION));
  particle(p.pos, 10, 2, PI / 2, 0.5);
  p.isOnFloor = false;
  p.isJumping = true;
  if (p.underFoot != null) {
    p.underFoot.onHead = undefined;
    p.underFoot = undefined;
  }
}

function updateJumpingStates() {
  players.forEach((p) => {
    if (p.isJumping) {
      p.isJumped = true;
      p.isJumping = false;
    }
  });
}

function updatePlayerPositionAndVelocity(p) {
  if (p.underFoot != null) {
    p.pos.set(p.underFoot.pos).add(0, -6);
    p.vel.set();
  } else {
    p.pos.add(p.vel.x * difficulty, p.vel.y * difficulty);
    p.vel.x *= 0.95;
    if ((p.pos.x < 7 && p.vel.x < 0) || (p.pos.x >= 77 && p.vel.x > 0)) {
      p.vel.x *= -0.5;
    }
    if (p.pos.x < 50) {
      p.vel.x += 0.01 * sqrt(50 - p.pos.x + 1);
    } else {
      p.vel.x -= 0.01 * sqrt(p.pos.x - 50 + 1);
    }
    if (p.isOnFloor) {
      if (p.pos.x < obstacle.pos.x) {
        p.vel.x -=
          (0.1 * sqrt(rnd(5, 25))) / sqrt(obstacle.pos.x - p.pos.x + 1);
      }
    } else {
      p.vel.y += 0.1;
      if (p.pos.y > 90) {
        p.pos.y = 90;
        p.isOnFloor = true;
        p.isJumped = false;
        p.vel.y = 0;
      }
    }
    if (p.pos.y < 0 && p.vel.y < 0) {
      p.vel.y *= -0.5;
    }
  }
}

function isCollidingWithObstacle(p) {
  return char(addWithCharCode("a", floor(p.ticks / 30) % 2), p.pos).isColliding
    .rect.black;
}

function handleCollision(p) {
  if (p.onHead != null) {
    p.onHead.underFoot = undefined;
    p.onHead.isJumping = true;
  }
  if (p.underFoot != null) {
    p.underFoot.onHead = undefined;
  }

  // player hit an obstacle
  play("hit");

  downedPlayers.push({
    pos: vec(p.pos),
    vel: vec(p.vel).add(-obstacle.vx * 2, 0),
  });
}

function playerOutOfBounds(p) {
  return p.pos.isInRect(0, -50, 100, 150);
}

function checkGameOver() {
  if (players.length <= 0) {
    play("lucky");
    end();
  }
}

function hitExtraLifeItem(p) {
  return char(addWithCharCode("a", floor(p.ticks / 30) % 2), p.pos).isColliding
    .rect.green;
}

function hitInvincibilityItem(p) {
  return char(addWithCharCode("a", floor(p.ticks / 30) % 2), p.pos).isColliding
    .rect.blue;
}

function updateDownedPlayers() {
  downedPlayers = downedPlayers.filter((p) => {
    p.pos.add(p.vel);
    p.vel.y += 0.2;
    char("a", p.pos, { mirror: { y: -1 } });
    return p.pos.y < 105;
  });
}

function getRandomObstacle() {
  const randomValue = rnd(0, 3);

  if (randomValue < 1) {
    return new Wall();
  } else if (randomValue < 2) {
    return new Platform();
  } else {
    return new Barrel();
  }
}

// Obstacle prefabs
class Barrel {
  constructor() {
    this.type = "barrel";

    // obstacle parameters
    this.r = rnd(5, 25);
    this.pos = vec(120 + this.r, 93 - this.r);
    this.vx = rnd(1, 2) / sqrt(this.r * 0.3 + 1);
    this.angle = rnd(PI * 2);
    this.color = "black";
  }

  update(difficulty) {
    this.pos.x -= this.vx * difficulty;
    this.draw();
  }

  draw() {
    arc(this.pos, this.r, 3 + this.r * 0.1, this.angle, this.angle + PI);
    arc(
      this.pos,
      this.r,
      3 + this.r * 0.1,
      this.angle + PI,
      this.angle + PI + PI
    );
    this.angle -= (this.vx / this.r) * 1;
    particle(
      this.pos.x,
      this.pos.y + this.r,
      this.r * 0.05,
      this.vx * 5,
      -0.1,
      0.2
    );
  }

  isOffScreen() {
    return this.pos.x < -this.r;
  }
}

class Wall {
  constructor() {
    this.type = "wall";

    // obstacle parameters
    this.pos = vec(110, 0);
    this.vx = rnd(0.4, 0.8);
    this.gap = rnd(30, 60);
    this.width = 6;
    this.height = rnd(15, 30);
  }

  update(difficulty) {
    this.pos.x -= this.vx * difficulty;
    this.draw();
  }

  draw() {
    color("black");
    rect(this.pos.x, this.pos.y, this.width, this.height); // top rect
    rect(this.pos.x, this.height + this.gap, this.width, 100); // bottom rect

    particle(this.pos.x, 95, 0.3, this.vx * 2, -0.4, 0.5);
    color("black");
  }

  isOffScreen() {
    return this.pos.x < -this.width;
  }
}

class Platform {
  constructor() {
    this.type = "platform";

    // obstacle parameters
    this.pos = vec(110, rnd(60, 80));
    this.vx = rnd(0.5, 0.9);
    this.gap = rnd(30, 60);
    this.width = rnd(10, 40);
    this.height = 6;
  }

  update(difficulty) {
    this.pos.x -= this.vx * difficulty;
    this.draw();
  }

  draw() {
    color("black");
    rect(this.pos.x, this.pos.y, this.width, this.height); // left rect
    rect(
      this.pos.x + this.width + this.gap,
      this.pos.y,
      this.width,
      this.height
    ); // right rect
    color("black");
  }

  isOffScreen() {
    return this.pos.x + this.width * 2 + this.gap < -10;
  }
}

// Item prefabs
class ExtraLifeItem {
  constructor() {
    this.pos = vec(110, rnd(30, 80));
    this.vx = rnd(0.7, 1.2);
    this.radius = 0.5;
  }

  update() {
    this.pos.x -= this.vx * difficulty;
    this.draw();
  }

  draw() {
    color("green");
    arc(this.pos, this.radius, 5, 360);
    color("black");
  }

  isOffScreen() {
    return this.pos.x < -this.radius;
  }
}

class InvincibilityItem {
  constructor() {
    this.pos = vec(110, rnd(20, 50));
    this.vx = rnd(0.8, 1.5);
    this.radius = 0.5;
  }

  update() {
    this.pos.x -= this.vx * difficulty;
    this.pos.y += rnd(-2, 2);
    this.draw();
  }

  draw() {
    color("blue");
    arc(this.pos, this.radius, 5, 360);
    particle(this.pos.x, this.pos.y + this.radius, 0.3, this.vx, 0, 2);
    color("black");
  }

  isOffScreen() {
    return this.pos.x < -this.radius;
  }
}

class Meteor {
  constructor() {
    this.pos = vec(50, -10);
    this.vx = rnd(-0.5, 0.5);
    this.vy = rnd(1, 2);
    this.width = 8;
  }

  update() {
    this.pos.x -= this.vx * difficulty;
    this.pos.y += this.vy;
    this.draw();
  }

  draw() {
    color("red");
    rect(this.pos.x, this.pos.y, this.width, this.width);
    particle(
      this.pos.x + this.width / 2 - 1,
      this.pos.y + this.width / 2,
      1,
      -this.vy,
      1.5,
      2
    );
    color("black");
  }

  isOffScreen() {
    return this.pos.y > 85;
  }
}
