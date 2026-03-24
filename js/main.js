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

// Global Game Objects
let holes;
let crops;
let ground;
let workerGroup;
let carGroup;
let citizenGroup;

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

    // Criar Texturas IMEDIATAMENTE antes de qualquer spawn
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

    // Timers de Vida Urbana (Muito mais frequentes agora!)
    this.time.addEvent({ delay: 1000, callback: () => spawnCar(this), loop: true });
    this.time.addEvent({ delay: 3000, callback: () => spawnCitizen(this), loop: true });
    this.time.addEvent({ delay: 8000, callback: () => spawnHole(this, false), loop: true }); // Apenas fora da estrada

    // Colisões e Overlaps
    this.physics.add.overlap(workerGroup, holes, (worker, hole) => {
        hole.destroy();
        gameState.money += 15;
        updateUI();
        showAnnouncement("Reparo concluído! +$15");
    });

    // Desativado acidente temporariamente para depuração
    // this.physics.add.overlap(carGroup, holes, (car, hole) => { ... });

    window.gameScene = this;
}

let carCounter = 0; // Para depuração

function update() {
    // Mover NPCs e sincronizar máscaras/emojis
    gameState.workers.forEach(w => {
        if (w.sprite.active) {
            moveNPC(w.sprite, 100, 0.05);
            if (w.sprite.customMask) {
                w.sprite.customMask.setPosition(w.sprite.x, w.sprite.y);
            }
        }
    });

    gameState.citizens.forEach(c => {
        if (c.sprite.active) {
            if (!c.isDistracted) {
                moveNPC(c.sprite, 60, 0.03);
            } else {
                c.sprite.body.setVelocity(0, 0); 
                if (c.cellIcon) {
                    c.cellIcon.setPosition(c.sprite.x, c.sprite.y - 20);
                }
            }
            if (c.sprite.customMask) {
                c.sprite.customMask.setPosition(c.sprite.x, c.sprite.y);
            }
        }
    });

    carGroup.children.entries.forEach(car => {
        if (car.x > config.width + 100 || car.x < -100) car.destroy();
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
    // Versão Simplificada e Robusta para garantir visibilidade
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    
    // Corpo Vermelho Vivo
    graphics.fillStyle(0xff0000, 1);
    graphics.fillRect(4, 8, 24, 16);
    
    // Janelas Azuis Claras
    graphics.fillStyle(0x00ffff, 1);
    graphics.fillRect(10, 10, 12, 12);
    
    // Rodas Pretas
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(6, 6, 4, 4);
    graphics.fillRect(20, 6, 4, 4);
    graphics.fillRect(6, 22, 4, 4);
    graphics.fillRect(20, 22, 4, 4);

    graphics.generateTexture('car_simple', 32, 32);
}

function spawnCar(scene) {
    if (!carGroup) return; // Segurança contra inicialização lenta
    
    const ts = window.tileSize || 32;
    const roadY = 7 * ts + ts/2; // O asfalto está na linha 7
    const fromRight = Math.random() > 0.5;
    const startX = fromRight ? 850 : -50;
    
    const car = scene.physics.add.sprite(startX, roadY, 'car_simple').setInteractive();
    car.setDepth(100); // Garante que o carro fique por cima de tudo
    car.setVelocityX(fromRight ? -150 : 150);
    car.flipX = fromRight;
    
    // Mecânica de Controle
    car.on('pointerdown', () => {
        showAnnouncement("Carro sob controle presidencial!");
        car.setTint(0x00ff00);
        scene.physics.moveToObject(car, scene.input.activePointer, 300);
    });

    carGroup.add(car);
}

function spawnCitizen(scene) {
    const x = Phaser.Math.Between(0, 800);
    const y = Phaser.Math.Between(0, 600);
    const sprite = scene.physics.add.sprite(x, y, 'worker');
    
    sprite.setTint(Phaser.Math.Between(0x000000, 0xffffff));
    sprite.setDisplaySize(window.tileSize, window.tileSize);
    sprite.setInteractive();
    
    const citizen = {
        sprite: sprite,
        isDistracted: Math.random() < 0.3,
        cellIcon: null
    };

    if (citizen.isDistracted) {
        citizen.cellIcon = scene.add.text(x, y - 20, '📱', { fontSize: '16px' }).setOrigin(0.5);
        showAnnouncement("Cidadão distraído detectado!");
    }

    sprite.on('pointerdown', () => {
        if (citizen.isDistracted) {
            citizen.isDistracted = false;
            if (citizen.cellIcon) citizen.cellIcon.destroy();
            gameState.money += 5;
            updateUI();
            showAnnouncement("Prevenção! +$5");
        }
    });

    applyTransparencyMask(scene, sprite);
    citizenGroup.add(sprite);
    gameState.citizens.push(citizen);
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

window.spawnManualCar = function() {
    if (window.gameScene) {
        spawnCar(window.gameScene);
        showAnnouncement("Gerando tráfego na via!");
    }
}

