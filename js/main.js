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
    this.time.addEvent({ delay: 6000, callback: () => spawnHole(this, true), loop: true }); // Policiais focam na estrada

    // Colisões e Overlaps Automáticos para os Policiais
    this.physics.add.overlap(workerGroup, holes, (police, hole) => {
        hole.destroy();
        gameState.money += 20; // Bônus de multa/serviço
        updateUI();
        showAnnouncement("Policial consertou a via! +$20");
    });

    window.gameScene = this;
}

function update() {
    // IA dos Policiais: Buscam problemas automaticamente!
    gameState.workers.forEach(p => {
        if (!p.sprite.active) return;
        
        let target = null;
        let minDistance = 300;

        // 1. Procurar buracos
        holes.children.entries.forEach(h => {
            const dist = Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, h.x, h.y);
            if (dist < minDistance) { target = h; minDistance = dist; }
        });

        // 2. Procurar distraídos
        gameState.citizens.forEach(c => {
            if (c.isDistracted) {
                const dist = Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, c.sprite.x, c.sprite.y);
                if (dist < minDistance) { target = c.sprite; minDistance = dist; }
            }
        });

        if (target) {
            this.physics.moveToObject(p.sprite, target, 120);
            p.sprite.flipX = target.x < p.sprite.x;
        } else {
            moveNPC(p.sprite, 100, 0.05); // Deambula se não houver problemas
        }
        
        if (p.sprite.customMask) p.sprite.customMask.setPosition(p.sprite.x, p.sprite.y);
    });

    // Cidadãos Distraídos e Intervenção Policial
    gameState.citizens.forEach(c => {
        if (!c.sprite.active) return;
        
        if (c.isDistracted) {
            c.sprite.body.setVelocity(0, 0); 
            if (c.cellIcon) c.cellIcon.setPosition(c.sprite.x, c.sprite.y - 20);
            
            // Se um policial encostar (proximidade < 30) remove celular
            gameState.workers.forEach(p => {
                if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, c.sprite.x, c.sprite.y) < 30) {
                    c.isDistracted = false;
                    if (c.cellIcon) c.cellIcon.destroy();
                    gameState.money += 10;
                    updateUI();
                    showAnnouncement("Policial confiscou celular! +$10");
                }
            });
        } else {
            moveNPC(c.sprite, 60, 0.03);
        }
        
        if (c.sprite.customMask) c.sprite.customMask.setPosition(c.sprite.x, c.sprite.y);
    });

    // Manutenção de Carros
    carGroup.children.entries.forEach(car => {
        if (car.x > 900 || car.x < -100) car.destroy();
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
    const colors = {
        'car_red': 0xef4444,
        'car_blue': 0x3b82f6,
        'car_green': 0x22c55e,
        'car_yellow': 0xfbbf24
    };

    // 1. Cores Básicas
    Object.entries(colors).forEach(([key, color]) => {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRoundedRect(2, 2, 28, 28, 6);
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(4, 6, 24, 20, 4);
        graphics.fillStyle(0xbae6fd, 1); 
        graphics.fillRect(10, 8, 12, 16);
        graphics.generateTexture(key, 32, 32);
    });

    // 2. Station Wagon Presidencial (Inspirada no upload)
    const wagon = scene.make.graphics({ x: 0, y: 0, add: false });
    wagon.fillStyle(0x000000, 0.3);
    wagon.fillRoundedRect(2, 2, 40, 28, 6);
    wagon.fillStyle(0xef4444, 1);
    wagon.fillRoundedRect(4, 6, 36, 20, 4);
    wagon.fillStyle(0x3b82f6, 1); // Vidros azuis como pedido
    wagon.fillRect(10, 8, 10, 16); wagon.fillRect(24, 8, 10, 16);
    wagon.generateTexture('car_station_wagon', 44, 32);

    // 3. Viatura da Polícia
    const pol = scene.make.graphics({ x: 0, y: 0, add: false });
    pol.fillStyle(0x1e293b, 1); // Preto/Azul escuro
    pol.fillRoundedRect(4, 6, 24, 20, 4);
    pol.fillStyle(0xffffff, 1); // Faixa branca
    pol.fillRect(4, 14, 24, 4);
    pol.fillStyle(0x3b82f6, 1); // Giroflex azul
    pol.fillRect(14, 4, 4, 4);
    pol.generateTexture('car_police', 32, 32);
}

function spawnCar(scene) {
    const ts = window.tileSize || 32;
    const roadY = 7 * ts + ts/2;
    const fromRight = Math.random() > 0.5;
    const startX = fromRight ? 900 : -100;
    
    // Mix de Tráfego
    const keys = ['car_red', 'car_blue', 'car_green', 'car_yellow', 'car_police', 'car_station_wagon'];
    const randomKey = Phaser.Utils.Array.GetRandom(keys);
    
    const car = scene.physics.add.sprite(startX, roadY, randomKey).setInteractive();
    car.setDepth(100);
    car.setVelocityX(fromRight ? -140 : 140);
    car.flipX = fromRight;
    
    car.on('pointerdown', () => {
        showAnnouncement("Veículo sob sua autoridade!");
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
