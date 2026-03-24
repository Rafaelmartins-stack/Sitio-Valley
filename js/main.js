// --- Phaser Setup ---
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// --- Game State ---
let gameState = {
    money: 1000,
    food: 0,
    population: 100,
    workers: [],
    citizens: [],
    cars: []
};

// UI References
const moneyDisplay = document.getElementById('money-display');
const foodDisplay = document.getElementById('food-display');
const announcement = document.getElementById('announcement');

function updateUI() {
    moneyDisplay.textContent = `$${gameState.money}`;
    foodDisplay.textContent = gameState.food;
}

function showAnnouncement(text) {
    announcement.textContent = text;
    announcement.style.opacity = '1';
    setTimeout(() => {
        announcement.style.opacity = '0';
    }, 3000);
}

// --- Game Logic ---
let holes;
let crops;
let ground;
let workerGroup;
let carGroup;
let citizenGroup;

function preload() {
    // Basic Assets
    this.load.image('grass', 'assets/grass.png');
    this.load.image('hole', 'assets/hole.png');
    this.load.image('crop', 'assets/crop.png');
    this.load.image('worker', 'assets/worker.png');
}

function create() {
    const self = this;
    
    // Create world groups
    ground = this.add.group();
    holes = this.physics.add.group();
    crops = this.physics.add.group();
    workerGroup = this.physics.add.group();
    carGroup = this.physics.add.group();
    citizenGroup = this.physics.add.group();

    // Create Procedural Textures for missing/extra assets
    createRoadTexture(this);
    createCarTexture(this);

    // Create Grid Map with a "Street" in the middle
    const tileSize = 64;
    const roadRow = 4; // Road on row 4

    for (let y = 0; y < config.height / tileSize; y++) {
        for (let x = 0; x < config.width / tileSize; x++) {
            let tileKey = 'grass';
            if (y === roadRow) {
                tileKey = 'road';
            }
            
            const tile = this.add.sprite(x * tileSize + tileSize/2, y * tileSize + tileSize/2, tileKey).setInteractive();
            
            if (tileKey === 'grass') {
                tile.on('pointerdown', () => {
                    plantCrop(self, x * tileSize + tileSize/2, y * tileSize + tileSize/2);
                });
            }
            
            ground.add(tile);
        }
    }

    // Initial holes (on the road only for accidents!)
    for(let i=0; i<3; i++) {
        spawnHole(this, true); 
    }

    // Car spawning timer
    this.time.addEvent({
        delay: 5000,
        callback: () => spawnCar(this),
        loop: true
    });

    // Citizen spawning timer
    this.time.addEvent({
        delay: 8000,
        callback: () => spawnCitizen(this),
        loop: true
    });

    // Hole spawning timer
    this.time.addEvent({
        delay: 10000,
        callback: () => spawnHole(this, true),
        loop: true
    });

    // Collision Logic
    // 1. Workers fix holes
    this.physics.add.overlap(workerGroup, holes, (worker, hole) => {
        hole.destroy();
        gameState.money += 15;
        updateUI();
        showAnnouncement("Manutenção realizada! +$15");
    });

    // 2. Cars crash on holes
    this.physics.add.overlap(carGroup, holes, (car, hole) => {
        car.setTint(0xff0000);
        car.body.setVelocity(0);
        car.body.setAngularVelocity(100);
        showAnnouncement("ACIDENTE! 'Sprite Crash' bloqueou a via!");
        
        // Remove car after delay
        this.time.delayedCall(3000, () => car.destroy());
    });

    window.gameScene = this;
}

function update() {
    // NPC Movement (Workers & Citizens)
    gameState.workers.forEach(w => moveNPC(w.sprite, 100, 0.02));
    gameState.citizens.forEach(c => moveNPC(c.sprite, 60, 0.01));

    // Cleanup cars out of bounds
    carGroup.children.entries.forEach(car => {
        if (car.x > config.width + 100) car.destroy();
    });
}

function moveNPC(sprite, speed, chance) {
    if (!sprite.active) return;
    if (Math.random() < chance) {
        const angle = Math.random() * Math.PI * 2;
        sprite.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        sprite.flipX = sprite.body.velocity.x < 0;
    }
}

function createRoadTexture(scene) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(0, 0, 64, 64);
    graphics.fillStyle(0xfde047, 1);
    graphics.fillRect(16, 30, 32, 4); // Yellow line
    graphics.generateTexture('road', 64, 64);
}

function createCarTexture(scene) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    // Car Body
    graphics.fillStyle(0x3b82f6, 1);
    graphics.fillRect(10, 20, 44, 24);
    // Roof
    graphics.fillStyle(0x60a5fa, 1);
    graphics.fillRect(18, 22, 28, 20);
    // Wheels
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(12, 18, 8, 4);
    graphics.fillRect(44, 18, 8, 4);
    graphics.fillRect(12, 42, 8, 4);
    graphics.fillRect(44, 42, 8, 4);
    graphics.generateTexture('car', 64, 64);
}

function spawnCar(scene) {
    const roadY = 4 * 64 + 32;
    const car = scene.physics.add.sprite(-50, roadY, 'car');
    car.setVelocityX(200);
    carGroup.add(car);
}

function spawnCitizen(scene) {
    const x = Phaser.Math.Between(0, 800);
    const y = Phaser.Math.Between(0, 600);
    const citizen = scene.physics.add.sprite(x, y, 'worker');
    citizen.setTint(Phaser.Math.Between(0x000000, 0xffffff));
    citizen.setScale(0.8);
    citizenGroup.add(citizen);
    gameState.citizens.push({ sprite: citizen });
}

function spawnHole(scene, onRoad = false) {
    let x, y;
    if (onRoad) {
        x = Phaser.Math.Between(50, config.width - 50);
        y = 4 * 64 + 32;
    } else {
        x = Phaser.Math.Between(50, config.width - 50);
        y = Phaser.Math.Between(50, config.height - 50);
    }
    const hole = scene.physics.add.sprite(x, y, 'hole');
    holes.add(hole);
}

function plantCrop(scene, x, y) {
    if (gameState.money >= 10) {
        gameState.money -= 10;
        updateUI();
        
        const crop = scene.physics.add.sprite(x, y, 'crop');
        crop.setScale(0.5);
        crops.add(crop);

        scene.tweens.add({
            targets: crop,
            scale: 1,
            duration: 5000,
            ease: 'Power1',
            onComplete: () => {
                crop.setTint(0x00ff00);
                crop.setInteractive();
                crop.on('pointerdown', () => {
                    crop.destroy();
                    gameState.food += 10;
                    updateUI();
                    showAnnouncement("Colheita Sucedida! +10");
                });
            }
        });
    } else {
        showAnnouncement("Dinheiro insuficiente!");
    }
}

window.hireWorker = function() {
    if (gameState.money >= 100) {
        gameState.money -= 100;
        updateUI();
        const scene = window.gameScene;
        const x = config.width / 2;
        const y = config.height / 2;
        const sprite = scene.physics.add.sprite(x, y, 'worker');
        sprite.setCollideWorldBounds(true);
        sprite.setBounce(1, 1);
        sprite.setVelocity(100, 100);
        workerGroup.add(sprite);
        gameState.workers.push({ sprite: sprite });
    } else {
        showAnnouncement("Dinheiro insuficiente!");
    }
}
