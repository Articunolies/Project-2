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
  isPlayingBgm: false,
  isReplayEnabled: true,
  seed: 16,
};

// Gameplay parameters
let players; // list
let downedPlayers; // list
let playersCount = 8;
let obstacle;
let extraLifeItem;
let bonusPlayers = false;

const BONUS_PLAYER_COUNT = 2;

// Main game loop
function update() {
  // check if game is running
  if (!ticks) {
    players = [];
    downedPlayers = [];
    obstacle = undefined;
    extraLifeItem = undefined;
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

  // draw ground
  rect(0, 93, 99, 7);

  // handle player movement + collisions
  updatePlayers();

  checkGameOver();
  updateDownedPlayers();

  // End wave once all wave elements are destroyed
  if (
    obstacle.isOffScreen() &&
    (!extraLifeItem || extraLifeItem.isOffScreen())
  ) {
    obstacle = undefined;
    extraLifeItem = undefined;
    addScore(players.length, 10, 50);
  }
}

function spawnWave() {
  addPlayers(); // spawn players
  obstacle = getRandomObstacle(); // spawn obstacle
  extraLifeItem = rnd(0, 1) < 0.4 ? new ExtraLifeItem() : undefined; // randomly spawn extra life
}

// incrementally add players until max player count is reached
function addPlayers() {
  // play("powerUp");  
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

    if (isCollidingWithObstacle(player)) {
      handleCollision(player);
      return false;
    }

    if (hitExtraLifeItem(player)) {
      bonusPlayers = true;
      extraLifeItem = undefined;
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
        // play("select");
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
    // play("jump");
    p.vel.set(0, -1.5);
    particle(p.pos, 10, 2, PI / 2, 0.5);
    p.isOnFloor = false;
    p.isJumping = true;
    if (p.underFoot != null) {
      p.underFoot.onHead = undefined;
      p.underFoot = undefined;
    }
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
    // play("lucky");
    end();
  }
}

function hitExtraLifeItem(p) {
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
    this.vx = rnd(0.4, 0.9);
    this.gap = rnd(30, 60);
    this.width = 6;
    this.height = rnd(15, 30);
  }

  update(difficulty) {
    this.pos.x -= this.vx * difficulty;
    this.draw();
  }

  draw() {
    rect(this.pos.x, this.pos.y, this.width, this.height); // top rect
    rect(this.pos.x, this.height + this.gap, this.width, 100); // bottom rect

    particle(this.pos.x, 95, 0.3, this.vx * 2, -0.4, 0.5);
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
    this.vx = rnd(0.5, 1);
    this.gap = rnd(30, 60);
    this.width = rnd(10, 40);
    this.height = 6;
  }

  update(difficulty) {
    this.pos.x -= this.vx * difficulty;
    this.draw();
  }

  draw() {
    rect(this.pos.x, this.pos.y, this.width, this.height); // left rect
    rect(
      this.pos.x + this.width + this.gap,
      this.pos.y,
      this.width,
      this.height
    ); // right rect
  }

  isOffScreen() {
    return this.pos.x + this.width * 2 + this.gap < -10;
  }
}

class ExtraLifeItem {
  constructor() {
    this.pos = vec(110, rnd(30, 80));
    this.vx = rnd(0.5, 1);
    this.radius = 0.5;
  }

  update() {
    this.pos.x -= this.vx * difficulty;
    this.draw();
  }

  draw() {
    color("blue");
    arc(this.pos, this.radius, 5, 360);
    color("black");
  }

  isOffScreen() {
    return this.pos.x < -this.radius;
  }
}
