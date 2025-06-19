class SpaceInvadersGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.gameWidth = 800;
        this.gameHeight = 600;
        
        // ゲーム状態
        this.gameState = 'menu'; // menu, playing, paused, gameOver, levelClear
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.isPaused = false;
        
        // プレイヤー
        this.player = {
            x: 400,
            y: 550,
            width: 40,
            height: 30,
            speed: 5
        };
        
        // 弾丸配列
        this.playerBullets = [];
        this.enemyBullets = [];
        
        // 敵配列
        this.enemies = [];
        this.boss = null;
        
        // エフェクト
        this.explosions = [];
        this.stars = [];
        
        // キー入力
        this.keys = {};
        
        // タイミング
        this.lastTime = 0;
        this.enemyShootTimer = 0;
        this.enemyMoveTimer = 0;
        this.enemyDirection = 1; // 1: 右, -1: 左
        
        // Bluetooth通信用
        this.characteristic = null;
        this.device_name = 'ESP32';
        this.service_uuid = '12345678-1234-1234-1234-1234567890ab';
        this.characteristic_uuid = 'abcdefab-1234-1234-1234-abcdefabcdef';
        this.dataArray = [];
        this.prevFiltered = 0;
        this.alpha = 0.4;
        this.beatCount = 0;
        this.lastBeatTime = 0;
        this.threshold = 2080;
        this.aboveThreshold = false;
        
        this.init();
    }
    
    init() {
        this.createStars();
        this.setupEventListeners();
        this.createPlayer();
        this.setupUI();
    }
    
    createStars() {
        const starsGroup = document.getElementById('stars');
        for (let i = 0; i < 100; i++) {
            const star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            star.setAttribute('cx', Math.random() * this.gameWidth);
            star.setAttribute('cy', Math.random() * this.gameHeight);
            star.setAttribute('r', Math.random() * 1.5 + 0.5);
            star.setAttribute('fill', '#ffffff');
            star.setAttribute('class', 'star');
            star.style.animationDelay = Math.random() * 2 + 's';
            starsGroup.appendChild(star);
            
            this.stars.push({
                element: star,
                x: parseFloat(star.getAttribute('cx')),
                y: parseFloat(star.getAttribute('cy')),
                speed: Math.random() * 0.5 + 0.1
            });
        }
    }
    
    createPlayer() {
        const playerGroup = document.getElementById('player');
        const playerSVG = this.createPlayerSVG();
        playerGroup.appendChild(playerSVG);
    }
    
    createPlayerSVG() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'player-ship');
        g.setAttribute('transform', `translate(${this.player.x - this.player.width/2}, ${this.player.y - this.player.height/2})`);

        fetch('svg/player.svg')
            .then(response => response.text())
            .then(svgText => {
                // SVG全体ではなく、<svg>タグの中身だけを抽出
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = svgText;
                const svgElem = tempDiv.querySelector('svg');
                if (svgElem) {
                    g.innerHTML = svgElem.innerHTML;
                }
            });
        
        return g;
    }
    
    createLevel() {
        this.enemies = [];
        const enemiesGroup = document.getElementById('enemies');
        enemiesGroup.innerHTML = '';
        
        // 通常の敵を作成
        const rows = 5;
        const cols = 10;
        const enemyWidth = 30;
        const enemyHeight = 25;
        const spacing = 50;
        const startX = 100;
        const startY = 50;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const enemy = {
                    x: startX + col * spacing,
                    y: startY + row * spacing,
                    width: enemyWidth,
                    height: enemyHeight,
                    type: row < 2 ? 'weak' : 'normal',
                    health: row < 2 ? 1 : 2,
                    points: row < 2 ? 10 : 20
                };
                
                const enemySVG = this.createEnemySVG(enemy);
                enemiesGroup.appendChild(enemySVG);
                enemy.element = enemySVG;
                this.enemies.push(enemy);
            }
        }
        
        // ボス敵を作成（レベル3以降）
        if (this.level >= 3) {
            this.createBoss();
        }
    }
    
    createEnemySVG(enemy) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'enemy-ship');
        g.setAttribute('transform', `translate(${enemy.x - enemy.width/2}, ${enemy.y - enemy.height/2})`);
        
        if (enemy.type === 'weak') {
            g.innerHTML = `
                <polygon points="15,0 0,15 5,20 25,20 30,15" fill="#ff4444" stroke="#cc0000" stroke-width="1"/>
                <circle cx="8" cy="8" r="1.5" fill="#ffff00"/>
                <circle cx="22" cy="8" r="1.5" fill="#ffff00"/>
            `;
        } else {
            g.innerHTML = `
                <polygon points="15,0 0,18 6,25 24,25 30,18" fill="#ff6666" stroke="#cc0000" stroke-width="1"/>
                <polygon points="10,18 20,18 15,25" fill="#cc0000"/>
                <circle cx="8" cy="10" r="2" fill="#ffff00"/>
                <circle cx="22" cy="10" r="2" fill="#ffff00"/>
            `;
        }
        
        return g;
    }
    
    createBoss() {
        this.boss = {
            x: this.gameWidth / 2,
            y: 100,
            width: 80,
            height: 60,
            health: 10 + this.level * 5,
            maxHealth: 10 + this.level * 5,
            points: 500,
            moveDirection: 1,
            shootTimer: 0
        };
        
        const bossSVG = this.createBossSVG();
        document.getElementById('enemies').appendChild(bossSVG);
        this.boss.element = bossSVG;
    }
    
    createBossSVG() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'boss-ship');
        g.setAttribute('transform', `translate(${this.boss.x - this.boss.width/2}, ${this.boss.y - this.boss.height/2})`);
        
        g.innerHTML = `
            <polygon points="40,0 10,20 0,30 15,50 25,60 55,60 65,50 80,30 70,20" fill="#ff00ff" stroke="#cc00cc" stroke-width="2"/>
            <polygon points="20,30 30,35 50,35 60,30 40,45" fill="#aa00aa"/>
            <circle cx="25" cy="20" r="3" fill="#ffff00"/>
            <circle cx="55" cy="20" r="3" fill="#ffff00"/>
            <circle cx="40" cy="25" r="4" fill="#ff0000"/>
            <!-- 体力バー -->
            <rect x="10" y="65" width="60" height="4" fill="#333" stroke="#fff" stroke-width="0.5"/>
            <rect x="10" y="65" width="${60 * (this.boss.health / this.boss.maxHealth)}" height="4" fill="#ff0000"/>
        `;
        
        return g;
    }
    
    setupEventListeners() {
        // キーボードイベント
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // スペースキーでの射撃を無効化
            // if (e.code === 'Space') {
            //     e.preventDefault();
            //     this.shoot();
            // }
            
            if (e.code === 'KeyP') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // ボタンイベント
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('pauseButton').addEventListener('click', () => {
            this.togglePause();
        });
        
        document.getElementById('restartButton').addEventListener('click', () => {
            this.restartGame();
        });
        
        document.getElementById('nextLevelButton').addEventListener('click', () => {
            this.nextLevel();
        });
        
        // Bluetoothボタンイベント
        document.getElementById('connectBluetoothButton').addEventListener('click', () => {
            this.connectToBluetooth();
        });
        
        // 通信開始・終了ボタンのイベントリスナーを削除（自動化されているため不要）
        // document.getElementById('startCommButton').addEventListener('click', () => {
        //     this.sendStart();
        // });
        
        // document.getElementById('stopCommButton').addEventListener('click', () => {
        //     this.sendStop();
        // });
        
        // しきい値スライダーのイベント
        const thresholdSlider = document.getElementById("thresholdSlider");
        const thresholdValue = document.getElementById("thresholdValue");
        thresholdSlider.addEventListener("input", () => {
            this.threshold = parseInt(thresholdSlider.value);
            thresholdValue.textContent = this.threshold;
            console.log(`しきい値を ${this.threshold} に変更しました`);
        });
    }
    
    setupUI() {
        this.updateScore();
        this.updateLives();
        this.updateLevel();
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('startButton').style.display = 'none';
        document.getElementById('pauseButton').style.display = 'inline-block';
        this.createLevel();
        this.gameLoop();
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseButton').textContent = '再開';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseButton').textContent = 'ポーズ';
            this.gameLoop();
        }
    }
    
    shoot() {
        if (this.gameState !== 'playing') return;
        
        const bullet = {
            x: this.player.x,
            y: this.player.y - this.player.height/2,
            width: 4,
            height: 10,
            speed: 8
        };
        
        const bulletSVG = this.createBulletSVG(bullet, '#00ff00');
        document.getElementById('playerBullets').appendChild(bulletSVG);
        bullet.element = bulletSVG;
        this.playerBullets.push(bullet);
    }
    
    createBulletSVG(bullet, color) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', bullet.x - bullet.width/2);
        rect.setAttribute('y', bullet.y - bullet.height/2);
        rect.setAttribute('width', bullet.width);
        rect.setAttribute('height', bullet.height);
        rect.setAttribute('fill', color);
        rect.setAttribute('class', 'bullet');
        rect.style.color = color;
        return rect;
    }
    
    gameLoop(currentTime = 0) {
        if (this.gameState !== 'playing') return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.updateAnimations();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        this.updatePlayer();
        this.updateBullets();
        this.updateEnemies(deltaTime);
        this.updateBoss(deltaTime);
        this.updateExplosions();
        this.updateStars();
        this.checkCollisions();
        this.checkWinCondition();
    }
    
    updatePlayer() {
        if (this.keys['ArrowLeft'] && this.player.x > this.player.width/2) {
            this.player.x -= this.player.speed;
        }
        if (this.keys['ArrowRight'] && this.player.x < this.gameWidth - this.player.width/2) {
            this.player.x += this.player.speed;
        }
        
        // プレイヤーの位置を更新
        const playerElement = document.querySelector('#player .player-ship');
        if (playerElement) {
            playerElement.setAttribute('transform', 
                `translate(${this.player.x - this.player.width/2}, ${this.player.y - this.player.height/2})`);
        }
    }
    
    updateBullets() {
        // プレイヤーの弾
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];
            bullet.y -= bullet.speed;
            
            bullet.element.setAttribute('y', bullet.y - bullet.height/2);
            
            if (bullet.y < 0) {
                bullet.element.remove();
                this.playerBullets.splice(i, 1);
            }
        }
        
        // 敵の弾
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            bullet.y += bullet.speed;
            
            bullet.element.setAttribute('y', bullet.y - bullet.height/2);
            
            if (bullet.y > this.gameHeight) {
                bullet.element.remove();
                this.enemyBullets.splice(i, 1);
            }
        }
    }
    
    updateEnemies(deltaTime) {
        this.enemyMoveTimer += deltaTime;
        this.enemyShootTimer += deltaTime;
        
        // 敵の移動
        if (this.enemyMoveTimer > 1000) {
            this.enemyMoveTimer = 0;
            let shouldMoveDown = false;
            
            // 端にいる敵をチェック
            for (const enemy of this.enemies) {
                if ((this.enemyDirection > 0 && enemy.x > this.gameWidth - 50) ||
                    (this.enemyDirection < 0 && enemy.x < 50)) {
                    shouldMoveDown = true;
                    break;
                }
            }
            
            if (shouldMoveDown) {
                this.enemyDirection *= -1;
                this.enemies.forEach(enemy => {
                    enemy.y += 20;
                    enemy.element.setAttribute('transform', 
                        `translate(${enemy.x - enemy.width/2}, ${enemy.y - enemy.height/2})`);
                });
            } else {
                this.enemies.forEach(enemy => {
                    enemy.x += this.enemyDirection * 20;
                    enemy.element.setAttribute('transform', 
                        `translate(${enemy.x - enemy.width/2}, ${enemy.y - enemy.height/2})`);
                });
            }
        }
        
        // 敵の射撃
        if (this.enemyShootTimer > 1500 && this.enemies.length > 0) {
            this.enemyShootTimer = 0;
            const shootingEnemy = this.enemies[Math.floor(Math.random() * this.enemies.length)];
            this.enemyShoot(shootingEnemy);
        }
    }
    
    updateBoss(deltaTime) {
        if (!this.boss) return;
        
        // ボスの移動
        this.boss.x += this.boss.moveDirection * 2;
        if (this.boss.x <= this.boss.width/2 || this.boss.x >= this.gameWidth - this.boss.width/2) {
            this.boss.moveDirection *= -1;
        }
        
        // ボスの射撃
        this.boss.shootTimer += deltaTime;
        if (this.boss.shootTimer > 800) {
            this.boss.shootTimer = 0;
            this.bossShoot();
        }
        
        // ボスの位置を更新
        this.boss.element.setAttribute('transform', 
            `translate(${this.boss.x - this.boss.width/2}, ${this.boss.y - this.boss.height/2})`);
        
        // 体力バーを更新
        const healthBar = this.boss.element.querySelector('rect:last-child');
        if (healthBar) {
            healthBar.setAttribute('width', 60 * (this.boss.health / this.boss.maxHealth));
        }
    }
    
    enemyShoot(enemy) {
        const bullet = {
            x: enemy.x,
            y: enemy.y + enemy.height/2,
            width: 4,
            height: 8,
            speed: 3
        };
        
        const bulletSVG = this.createBulletSVG(bullet, '#ff0000');
        document.getElementById('enemyBullets').appendChild(bulletSVG);
        bullet.element = bulletSVG;
        this.enemyBullets.push(bullet);
    }
    
    bossShoot() {
        // ボスは3発同時に撃つ
        for (let i = -1; i <= 1; i++) {
            const bullet = {
                x: this.boss.x + i * 20,
                y: this.boss.y + this.boss.height/2,
                width: 6,
                height: 12,
                speed: 4
            };
            
            const bulletSVG = this.createBulletSVG(bullet, '#ff00ff');
            document.getElementById('enemyBullets').appendChild(bulletSVG);
            bullet.element = bulletSVG;
            this.enemyBullets.push(bullet);
        }
    }
    
    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            explosion.timer += 16;
            
            if (explosion.timer > explosion.duration) {
                explosion.element.remove();
                this.explosions.splice(i, 1);
            }
        }
    }
    
    updateStars() {
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > this.gameHeight) {
                star.y = 0;
                star.x = Math.random() * this.gameWidth;
            }
            star.element.setAttribute('cx', star.x);
            star.element.setAttribute('cy', star.y);
        });
    }
    
    checkCollisions() {
        // プレイヤーの弾と敵の衝突
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];
            
            // 通常の敵との衝突
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                
                if (this.isColliding(bullet, enemy)) {
                    this.createExplosion(enemy.x, enemy.y);
                    enemy.health--;
                    
                    if (enemy.health <= 0) {
                        this.score += enemy.points;
                        enemy.element.remove();
                        this.enemies.splice(j, 1);
                    }
                    
                    bullet.element.remove();
                    this.playerBullets.splice(i, 1);
                    this.updateScore();
                    break;
                }
            }
            
            // ボスとの衝突
            if (this.boss && this.isColliding(bullet, this.boss)) {
                this.createExplosion(bullet.x, bullet.y);
                this.boss.health--;
                
                if (this.boss.health <= 0) {
                    this.score += this.boss.points;
                    this.createExplosion(this.boss.x, this.boss.y);
                    this.boss.element.remove();
                    this.boss = null;
                }
                
                bullet.element.remove();
                this.playerBullets.splice(i, 1);
                this.updateScore();
            }
        }
        
        // 敵の弾とプレイヤーの衝突
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];
            
            if (this.isColliding(bullet, this.player)) {
                this.createExplosion(this.player.x, this.player.y);
                this.lives--;
                this.updateLives();
                
                bullet.element.remove();
                this.enemyBullets.splice(i, 1);
                
                if (this.lives <= 0) {
                    this.gameOver();
                }
                break;
            }
        }
        
        // 敵がプレイヤーに到達した場合
        for (const enemy of this.enemies) {
            if (enemy.y > this.player.y - 50) {
                this.gameOver();
                break;
            }
        }
    }
    
    isColliding(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width/2 &&
               obj1.x + obj1.width/2 > obj2.x - obj2.width/2 &&
               obj1.y < obj2.y + obj2.height/2 &&
               obj1.y + obj1.height/2 > obj2.y - obj2.height/2;
    }
    
    createExplosion(x, y) {
        const explosion = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        explosion.setAttribute('class', 'explosion');
        explosion.setAttribute('transform', `translate(${x}, ${y})`);
        
        explosion.innerHTML = `
            <circle cx="0" cy="0" r="5" fill="#ffff00" opacity="0.8">
                <animate attributeName="r" values="5;20;0" dur="0.5s"/>
                <animate attributeName="opacity" values="0.8;0.4;0" dur="0.5s"/>
            </circle>
            <circle cx="0" cy="0" r="3" fill="#ff8800" opacity="0.6">
                <animate attributeName="r" values="3;15;0" dur="0.4s"/>
                <animate attributeName="opacity" values="0.6;0.3;0" dur="0.4s"/>
            </circle>
        `;
        
        document.getElementById('explosions').appendChild(explosion);
        
        this.explosions.push({
            element: explosion,
            timer: 0,
            duration: 500
        });
    }
    
    checkWinCondition() {
        if (this.enemies.length === 0 && !this.boss) {
            this.levelClear();
        }
    }
    
    levelClear() {
        this.gameState = 'levelClear';
        const bonusScore = this.lives * 100 + 1000;
        this.score += bonusScore;
        
        document.getElementById('bonusScore').textContent = bonusScore;
        document.getElementById('levelClearScreen').style.display = 'block';
        this.updateScore();
    }
    
    nextLevel() {
        this.level++;
        this.updateLevel();
        document.getElementById('levelClearScreen').style.display = 'none';
        this.clearBullets();
        this.createLevel();
        this.gameState = 'playing';
        this.gameLoop();
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverScreen').style.display = 'block';
        document.getElementById('pauseButton').style.display = 'none';
    }
    
    restartGame() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.player.x = 400;
        this.player.y = 550;
        
        this.clearBullets();
        this.clearEnemies();
        this.explosions.forEach(explosion => explosion.element.remove());
        this.explosions = [];
        
        document.getElementById('gameOverScreen').style.display = 'none';
        
        // Bluetooth接続状態をチェック
        if (this.characteristic) {
            // 接続済みの場合は通常のリスタート
            document.getElementById('startButton').style.display = 'inline-block';
            document.getElementById('pauseButton').style.display = 'none';
            this.gameState = 'menu';
        } else {
            // 未接続の場合は再接続が必要
            document.getElementById('connectBluetoothButton').style.display = 'inline-block';
            document.getElementById('thresholdControl').style.display = 'none';
            
            const startButton = document.getElementById('startButton');
            startButton.disabled = true;
            startButton.style.opacity = '0.5';
            startButton.style.cursor = 'not-allowed';
            startButton.textContent = 'Bluetooth接続後にゲーム開始';
            startButton.style.display = 'inline-block';
            
            document.getElementById('pauseButton').style.display = 'none';
            this.gameState = 'menu';
        }
        
        this.updateScore();
        this.updateLives();
        this.updateLevel();
    }
    
    clearBullets() {
        this.playerBullets.forEach(bullet => bullet.element.remove());
        this.enemyBullets.forEach(bullet => bullet.element.remove());
        this.playerBullets = [];
        this.enemyBullets = [];
    }
    
    clearEnemies() {
        this.enemies.forEach(enemy => enemy.element.remove());
        this.enemies = [];
        
        if (this.boss) {
            this.boss.element.remove();
            this.boss = null;
        }
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
    }
    
    updateLives() {
        document.getElementById('lives').textContent = this.lives;
    }
    
    updateLevel() {
        document.getElementById('level').textContent = this.level;
    }
    
    updateAnimations() {
        // アニメーション更新（必要に応じて）
    }
    
    // Bluetooth接続機能
    async connectToBluetooth() {
        try {
            console.log('Bluetooth接続を試行中...');
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ name: this.device_name }],
                optionalServices: [this.service_uuid]
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(this.service_uuid);
            this.characteristic = await service.getCharacteristic(this.characteristic_uuid);

            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', (event) => this.handleNotify(event));

            console.log('Bluetooth接続完了＆通知待機中');
            
            // 接続成功時にUI要素を更新
            document.getElementById('connectBluetoothButton').style.display = 'none';
            document.getElementById('thresholdControl').style.display = 'block';
            
            // ゲーム開始ボタンを有効化
            const startButton = document.getElementById('startButton');
            startButton.disabled = false;
            startButton.style.opacity = '1';
            startButton.style.cursor = 'pointer';
            startButton.textContent = 'ゲーム開始';
            
            // 通信開始を自動実行
            await this.sendStart();
            
            // 自動でゲームを開始
            console.log('自動でゲームを開始します');
            this.startGame();
            
        } catch (error) {
            console.log('Bluetooth接続エラー: ' + error);
            alert('Bluetooth接続に失敗しました。ESP32デバイスが近くにあることを確認してください。');
        }
    }

    handleNotify(event) {
        const valueStr = new TextDecoder().decode(event.target.value).trim();
        const valueNum = parseFloat(valueStr);
        if (!isNaN(valueNum)) {
            const filtered = this.lowPassFilter(valueNum);
            this.detectBeat(filtered);
            this.addData(Math.round(filtered));
        }
    }

    detectBeat(value) {
        const now = Date.now();
        if (value > this.threshold && !this.aboveThreshold) {
            if (now - this.lastBeatTime > 300) {
                this.beatCount++;
                this.lastBeatTime = now;
                console.log(`ドックン ${this.beatCount} 回 - 弾発射!`);
                // 弾を発射
                this.shoot();
            }
            this.aboveThreshold = true;
        } else if (value < this.threshold) {
            this.aboveThreshold = false;
        }
    }

    lowPassFilter(currentValue) {
        if (currentValue === "") return;
        const filtered = this.alpha * currentValue + (1 - this.alpha) * this.prevFiltered;
        this.prevFiltered = filtered;
        return filtered;
    }

    addData(data) {
        this.dataArray.push(data);
        if (this.dataArray.length > 800) this.dataArray.shift(); // 最大800点まで
    }

    async sendToESP(text) {
        if (!this.characteristic) {
            console.log("まだ接続されていません");
            return;
        }
        const data = new TextEncoder().encode(text);
        await this.characteristic.writeValue(data);
        console.log("送信済: " + text);
    }

    async sendStart() {
        await this.sendToESP("start");
        console.log("START");
    }

    async sendStop() {
        await this.sendToESP("stop");
        console.log("STOP");
    }
}

// ゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    const game = new SpaceInvadersGame();
}); 