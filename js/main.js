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

function preload() {
    // Basic Assets
    this.load.image('grass', 'assets/grass.png');
    this.load.image('hole', 'assets/hole.png');
    this.load.image('crop', 'assets/crop.png');
    this.load.image('worker', 'assets/worker.png');
}

function create() {
    const self = this;
    const tileSize = 32; // Reduzido drasticamente conforme solicitado
    const roadRow = 7; // Ajustado para a nova grade menor
    window.tileSize = tileSize;

    // Criar world groups
    ground = this.add.group();
    holes = this.physics.add.group();
    crops = this.physics.add.group();
    workerGroup = this.physics.add.group();
    carGroup = this.physics.add.group();
    citizenGroup = this.physics.add.group();

    // Criar Texturas
    createRoadTexture(this);
    createCarTexture(this);

    // Gerar Mapa
    for (let y = 0; y < config.height / tileSize; y++) {
        for (let x = 0; x < config.width / tileSize; x++) {
            let tileKey = (y === roadRow) ? 'road' : 'grass';
            const tile = this.add.sprite(x * tileSize + tileSize/2, y * tileSize + tileSize/2, tileKey).setInteractive();
            tile.setDisplaySize(tileSize, tileSize);
            
            if (tileKey === 'grass') {
                tile.on('pointerdown', () => plantCrop(self, x * tileSize + tileSize/2, y * tileSize + tileSize/2));
            }
            ground.add(tile);
        }
    }

    // Timers e Outros
    for(let i=0; i<3; i++) spawnHole(this, true); 
    this.time.addEvent({ delay: 5000, callback: () => spawnCar(this), loop: true });
    this.time.addEvent({ delay: 6000, callback: () => spawnCitizen(this), loop: true });
    this.time.addEvent({ delay: 10000, callback: () => spawnHole(this, true), loop: true });

    // Colisões e Overlaps
    this.physics.add.overlap(workerGroup, holes, (worker, hole) => {
        hole.destroy();
        gameState.money += 15;
        updateUI();
        showAnnouncement("Reparo concluído! +$15");
    });

    this.physics.add.overlap(carGroup, holes, (car, hole) => {
        car.setTint(0xff0000);
        car.body.setVelocity(0);
        car.body.setAngularVelocity(200);
        showAnnouncement("ACIDENTE NA VIA!");
        this.time.delayedCall(2000, () => car.destroy());
    });

    window.gameScene = this;
}

function update() {
    // Mover NPCs e sincronizar máscaras
    gameState.workers.forEach(w => {
        if (w.sprite.active) {
            moveNPC(w.sprite, 100, 0.05); // Aumentada frequência de movimento
            if (w.sprite.customMask) {
                w.sprite.customMask.x = w.sprite.x;
                w.sprite.customMask.y = w.sprite.y;
            }
        }
    });

    gameState.citizens.forEach(c => {
        if (c.sprite.active) {
            moveNPC(c.sprite, 60, 0.03);
            if (c.sprite.customMask) {
                c.sprite.customMask.x = c.sprite.x;
                c.sprite.customMask.y = c.sprite.y;
            }
        }
    });

    carGroup.children.entries.forEach(car => {
        if (car.x > config.width + 100) car.destroy();
    });
}

function moveNPC(sprite, speed, chance) {
    if (!sprite.active || !sprite.body) return;
    
    // Se estiver parado ou aleatoriamente, muda de direção
    if (sprite.body.velocity.x === 0 || Math.random() < chance) {
        const angle = Math.random() * Math.PI * 2;
        sprite.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        sprite.flipX = (sprite.body.velocity.x < 0);
    }
}

function applyTransparencyMask(scene, sprite) {
    // Criamos o gráfico da máscara na posição 0,0 para que setPosition funcione via coordenadas de mundo
    const shape = scene.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillCircle(0, 0, (window.tileSize / 2) * 0.9);
    
    const mask = shape.createGeometryMask();
    sprite.setMask(mask);
    sprite.customMask = shape;
    
    // Posiciona inicialmente
    shape.setPosition(sprite.x, sprite.y);
}

function createRoadTexture(scene) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x334155, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.fillStyle(0xfde047, 1);
    graphics.fillRect(8, 15, 16, 2);
    graphics.generateTexture('road', 32, 32);
}

function createCarTexture(scene) {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x3b82f6, 1);
    graphics.fillRect(5, 10, 22, 12); // Corpo menor
    graphics.fillStyle(0x60a5fa, 1);
    graphics.fillRect(10, 11, 10, 10);
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(6, 8, 4, 2); graphics.fillRect(20, 8, 4, 2); // Rodas
    graphics.fillRect(6, 22, 4, 2); graphics.fillRect(20, 22, 4, 2);
    graphics.generateTexture('car', 32, 32);
}

function spawnCar(scene) {
    const ts = window.tileSize;
    const roadY = 7 * ts + ts/2;
    const car = scene.physics.add.sprite(-50, roadY, 'car');
    car.setVelocityX(120);
    carGroup.add(car);
}

function spawnCitizen(scene) {
    const x = Phaser.Math.Between(0, 800);
    const y = Phaser.Math.Between(0, 600);
    const citizen = scene.physics.add.sprite(x, y, 'worker');
    citizen.setTint(Phaser.Math.Between(0x000000, 0xffffff));
    citizen.setDisplaySize(window.tileSize, window.tileSize);
    applyTransparencyMask(scene, citizen);
    citizenGroup.add(citizen);
    gameState.citizens.push({ sprite: citizen });
}

function spawnHole(scene, onRoad = false) {
    const ts = window.tileSize;
    let x, y;
    if (onRoad) {
        x = Phaser.Math.Between(50, config.width - 50);
        y = 7 * ts + ts/2;
    } else {
        x = Phaser.Math.Between(50, config.width - 50);
        y = Phaser.Math.Between(50, config.height - 50);
    }
    const hole = scene.physics.add.sprite(x, y, 'hole');
    hole.setDisplaySize(ts, ts);
    holes.add(hole);
}

function plantCrop(scene, x, y) {
    const ts = window.tileSize;
    if (gameState.money >= 10) {
        gameState.money -= 10;
        updateUI();
        const crop = scene.physics.add.sprite(x, y, 'crop');
        crop.setDisplaySize(ts * 0.3, ts * 0.3);
        applyTransparencyMask(scene, crop); // Também limpa o fundo das plantas
        crops.add(crop);
        scene.tweens.add({
            targets: crop,
            displayWidth: ts,
            displayHeight: ts,
            duration: 3000,
            ease: 'Power1',
            onComplete: () => {
                crop.setTint(0x00ff00);
                crop.setInteractive();
                crop.on('pointerdown', () => {
                    crop.destroy();
                    gameState.food += 10;
                    updateUI();
                });
            }
        });
    }
}

window.hireWorker = function() {
    if (gameState.money >= 100) {
        gameState.money -= 100;
        updateUI();
        const scene = window.gameScene;
        const sprite = scene.physics.add.sprite(400, 300, 'worker');
        sprite.setCollideWorldBounds(true);
        sprite.setBounce(1, 1);
        sprite.setDisplaySize(window.tileSize, window.tileSize);
        applyTransparencyMask(scene, sprite);
        sprite.setVelocity(100, 100);
        workerGroup.add(sprite);
        gameState.workers.push({ sprite: sprite });
    }
}
