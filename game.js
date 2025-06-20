class SpaceInvadersGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.gameWidth = 800;
    this.gameHeight = 600;

    // ゲーム状態
    this.gameState = "menu"; // menu, preparation, playing, paused, gameOver
    this.score = 0;
    this.lives = 5;
    this.isPaused = false;

    // 準備時間用
    this.preparationTime = 10; // 10秒の準備時間
    this.preparationTimer = 0;
    this.preparationStartTime = 0;

    // プレイヤー
    this.player = {
      x: 400,
      y: 550,
      width: 40,
      height: 30,
      speed: 5,
      invulnerable: false,
      invulnerableTime: 0,
      // より精密な当たり判定用のコリジョンボックス
      collisionBoxes: [
        // メインボディ（中央下部）
        { x: -10, y: -8, width: 20, height: 16 },
        // コックピット（上部中央）
        { x: -4, y: -12, width: 8, height: 8 },
        // 左翼（上部左）
        { x: -14, y: -10, width: 6, height: 8 },
        // 右翼（上部右）
        { x: 8, y: -10, width: 6, height: 8 },
      ],
    };

    // 弾丸配列
    this.playerBullets = [];
    this.enemyBullets = [];

    // 敵配列
    this.enemies = [];
    this.bosses = []; // ボス敵を配列で管理

    // エフェクト
    this.explosions = [];
    this.stars = [];

    // ボス登場フラグ
    this.bossSpawning = false;
    // ボス討伐数を追跡
    this.bossesDefeated = 0;
    // 複数ボス生成中フラグ
    this.spawningMultipleBosses = false;

    // キー入力
    this.keys = {};

    // タイミング
    this.lastTime = 0;
    this.enemyShootTimer = 0;
    this.enemyMoveTimer = 0;
    this.enemyDirection = 1; // 1: 右, -1: 左

    // 時間ベーススコア用
    this.gameStartTime = 0;
    this.gameTime = 0;

    // Bluetooth通信用
    this.characteristic = null;
    this.device_name = "ESP32";
    this.service_uuid = "12345678-1234-1234-1234-1234567890ab";
    this.characteristic_uuid = "abcdefab-1234-1234-1234-abcdefabcdef";
    this.dataArray = [];
    this.prevFiltered = 0;
    this.alpha = 0.4;
    this.beatCount = 0;
    this.lastBeatTime = 0;
    this.threshold = 1800;
    this.aboveThreshold = false;

    // デバッグ用
    this.showCollisionBoxes = false; // 当たり判定表示フラグ

    // BGM用
    this.bgmAudio = null;
    this.bgmVolume = 0.005; // 控えめな音量

    // 効果音用
    this.deadSoundAudio = null;
    this.damageSoundAudio = null;
    this.effectVolume = 0.01; // 効果音用の音量（BGMより少し大きめ）

    // グラフ描画用
    this.graphCanvas = null;
    this.graphCtx = null;

    // ドックンアニメーション用
    this.heartCanvas = null;
    this.heartCtx = null;
    this.heartImages = [];
    this.frameCount = 7;
    this.frameDelay = 50;

    this.init();
  }

  init() {
    this.createStars();
    this.setupEventListeners();
    this.createPlayer();
    this.setupUI();
    this.setupCanvases();
    this.setupBGM();
  }

  setupCanvases() {
    // グラフキャンバスの設定
    this.graphCanvas = document.getElementById("heartDataGraph");
    this.graphCtx = this.graphCanvas.getContext("2d");

    // ドックンキャンバスの設定
    this.heartCanvas = document.getElementById("heartCanvas");
    this.heartCtx = this.heartCanvas.getContext("2d");

    // ハートのSVG画像を読み込み（簡単な円形で代用）
    this.loadHeartImages();
  }

  setupBGM() {
    try {
      this.bgmAudio = new Audio("music.mp3");
      this.bgmAudio.loop = true; // ループ再生
      this.bgmAudio.volume = this.bgmVolume; // 控えめな音量
      this.bgmAudio.preload = "auto"; // 事前読み込み

      console.log("BGMセットアップ完了");
    } catch (error) {
      console.error("BGMセットアップエラー:", error);
    }

    // 効果音のセットアップ
    try {
      this.deadSoundAudio = new Audio("dead.mp3");
      this.deadSoundAudio.volume = this.effectVolume;
      this.deadSoundAudio.preload = "auto";

      this.damageSoundAudio = new Audio("get-damage.mp3");
      this.damageSoundAudio.volume = this.effectVolume;
      this.damageSoundAudio.preload = "auto";

      console.log("効果音セットアップ完了");
    } catch (error) {
      console.error("効果音セットアップエラー:", error);
    }
  }

  loadHeartImages() {
    // SVGファイルの代わりに、動的に生成したハート画像を使用
    for (let i = 0; i < this.frameCount; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      // ハート形状を描画（サイズを段階的に変更）
      const scale = 0.5 + (i / (this.frameCount - 1)) * 0.5; // 0.5から1.0まで
      this.drawHeartShape(ctx, 128, 128, 80 * scale, "#ff6666");

      this.heartImages.push(canvas);
    }
  }

  drawHeartShape(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 80, size / 80);

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // ハート形状の描画
    ctx.moveTo(0, 15);
    ctx.bezierCurveTo(-50, -40, -90, 10, 0, 50);
    ctx.bezierCurveTo(90, 10, 50, -40, 0, 15);
    ctx.fill();

    ctx.restore();
  }

  // BGM制御関数
  playBGM() {
    if (this.bgmAudio) {
      this.bgmAudio
        .play()
        .then(() => {
          console.log("BGM再生開始");
        })
        .catch((error) => {
          console.error("BGM再生エラー:", error);
        });
    }
  }

  pauseBGM() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.pause();
      console.log("BGM一時停止");
    }
  }

  stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      console.log("BGM停止");
    }
  }

  // 効果音制御関数
  playDeadSound() {
    if (this.deadSoundAudio) {
      this.deadSoundAudio.currentTime = 0; // 最初から再生
      this.deadSoundAudio
        .play()
        .then(() => {
          console.log("敵撃破音再生");
        })
        .catch((error) => {
          console.error("敵撃破音再生エラー:", error);
        });
    }
  }

  playDamageSound() {
    if (this.damageSoundAudio) {
      this.damageSoundAudio.currentTime = 0; // 最初から再生
      this.damageSoundAudio
        .play()
        .then(() => {
          console.log("ダメージ音再生");
        })
        .catch((error) => {
          console.error("ダメージ音再生エラー:", error);
        });
    }
  }

  createStars() {
    const starsGroup = document.getElementById("stars");
    for (let i = 0; i < 100; i++) {
      const star = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      star.setAttribute("cx", Math.random() * this.gameWidth);
      star.setAttribute("cy", Math.random() * this.gameHeight);
      star.setAttribute("r", Math.random() * 1.5 + 0.5);
      star.setAttribute("fill", "#ffffff");
      star.setAttribute("class", "star");
      star.style.animationDelay = Math.random() * 2 + "s";
      starsGroup.appendChild(star);

      this.stars.push({
        element: star,
        x: parseFloat(star.getAttribute("cx")),
        y: parseFloat(star.getAttribute("cy")),
        speed: Math.random() * 0.5 + 0.1,
      });
    }
  }

  createPlayer() {
    const playerGroup = document.getElementById("player");
    const playerSVG = this.createPlayerSVG();
    playerGroup.appendChild(playerSVG);
  }

  createPlayerSVG() {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "player-ship");
    g.setAttribute(
      "transform",
      `translate(${this.player.x - this.player.width / 2}, ${
        this.player.y - this.player.height / 2
      })`
    );

    fetch("svg/player.svg")
      .then((response) => response.text())
      .then((svgText) => {
        // SVG全体ではなく、<svg>タグの中身だけを抽出
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = svgText;
        const svgElem = tempDiv.querySelector("svg");
        if (svgElem) {
          // 元のサイズを取得
          const originalWidth = parseFloat(svgElem.getAttribute("width")) || 64;
          const originalHeight =
            parseFloat(svgElem.getAttribute("height")) || 64;

          // スケールを計算（プレイヤーのサイズに合わせる）
          const scaleX = this.player.width / originalWidth;
          const scaleY = this.player.height / originalHeight;

          // 内容をコピー
          g.innerHTML = svgElem.innerHTML;

          // スケール変換を適用
          g.setAttribute(
            "transform",
            `translate(${this.player.x - this.player.width / 2}, ${
              this.player.y - this.player.height / 2
            }) scale(${scaleX}, ${scaleY})`
          );

          console.log(
            `プレイヤーSVG読み込み完了 (${originalWidth}x${originalHeight} → ${this.player.width}x${this.player.height})`
          );
        }
      })
      .catch((error) => {
        console.error("player.svg読み込みエラー:", error);
        // フォールバック：シンプルな図形を作成
        g.innerHTML = `
                    <polygon points="20,0 0,30 40,30" fill="#00ff00" stroke="#00cc00" stroke-width="1"/>
                    <circle cx="20" cy="15" r="3" fill="#ffffff"/>
                `;
      });

    return g;
  }

  setupUI() {
    this.updateScore();
    this.updateLives();
  }

  createLevel() {
    this.enemies = [];
    const enemiesGroup = document.getElementById("enemies");
    enemiesGroup.innerHTML = "";

    // 通常の敵を作成（数を減らす：3×8→2×6）
    const rows = 2;
    const cols = 6;
    const enemyWidth = 40; // サイズを大きく：30→40
    const enemyHeight = 35; // サイズを大きく：25→35
    const spacing = 80;
    const startX = 200;
    const startY = 80;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const enemy = {
          x: startX + col * spacing,
          y: startY + row * spacing,
          width: enemyWidth,
          height: enemyHeight,
          type: row < 1 ? "weak" : "normal",
          health: 0.5, // 雑魚敵のHPをさらに半分に
        };

        const enemySVG = this.createEnemySVG(enemy);
        enemiesGroup.appendChild(enemySVG);
        enemy.element = enemySVG;
        this.enemies.push(enemy);
      }
    }

    // ボスは最初は作成しない（雑魚敵が3匹になったら登場）
    this.bosses = [];

    console.log(
      `レベル作成完了！初期敵数: ${this.enemies.length}, ボス出現条件: 敵が3匹になったとき`
    );
  }

  createEnemySVG(enemy) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "enemy-ship");
    g.setAttribute(
      "transform",
      `translate(${enemy.x - enemy.width / 2}, ${enemy.y - enemy.height / 2})`
    );

    // 外部SVGファイルを読み込み
    fetch("svg/zako.svg")
      .then((response) => response.text())
      .then((svgText) => {
        // SVG全体ではなく、<svg>タグの中身だけを抽出
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = svgText;
        const svgElem = tempDiv.querySelector("svg");
        if (svgElem) {
          // 元のサイズを取得
          const originalWidth = parseFloat(svgElem.getAttribute("width")) || 64;
          const originalHeight =
            parseFloat(svgElem.getAttribute("height")) || 64;

          // スケールを計算（敵のサイズに合わせる）
          const scaleX = enemy.width / originalWidth;
          const scaleY = enemy.height / originalHeight;

          // 内容をコピー
          g.innerHTML = svgElem.innerHTML;

          // スケール変換を適用
          g.setAttribute(
            "transform",
            `translate(${enemy.x - enemy.width / 2}, ${
              enemy.y - enemy.height / 2
            }) scale(${scaleX}, ${scaleY})`
          );

          console.log(
            `雑魚敵SVG読み込み完了 (${originalWidth}x${originalHeight} → ${enemy.width}x${enemy.height})`
          );
        }
      })
      .catch((error) => {
        console.error("zako.svg読み込みエラー:", error);
        // フォールバック：シンプルな図形を作成
        g.innerHTML = `
                    <polygon points="20,0 0,20 7,27 33,27 40,20" fill="#ff4444" stroke="#cc0000" stroke-width="1"/>
                    <circle cx="10" cy="12" r="2" fill="#ffff00"/>
                    <circle cx="30" cy="12" r="2" fill="#ffff00"/>
                `;
      });

    return g;
  }

  createBoss() {
    // 最初のボス敵の設定
    const bossIndex = this.bosses.length;
    const baseShootInterval = 3600;
    const shootInterval = baseShootInterval; // 最初のボスは基本間隔
    const initialDelay = 1000; // 最初のボスは1秒後に射撃開始

    this.bosses.push({
      x: this.gameWidth / 2,
      y: 100,
      width: 80,
      height: 60,
      health: 8, // HPを半分に：15→8
      maxHealth: 8, // 最大HPも調整
      moveDirection: 1,
      shootTimer: initialDelay,
      shootInterval: shootInterval,
      bossId: bossIndex,
    });

    const bossSVG = this.createBossSVG();
    document.getElementById("enemies").appendChild(bossSVG);
    this.bosses[this.bosses.length - 1].element = bossSVG;

    console.log(
      `最初のボス${bossIndex}を作成: 射撃間隔=${shootInterval}ms, 初期遅延=${initialDelay}ms`
    );
  }

  createBossSVG() {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "boss-ship");
    g.setAttribute(
      "transform",
      `translate(${
        this.bosses[this.bosses.length - 1].x -
        this.bosses[this.bosses.length - 1].width / 2
      }, ${
        this.bosses[this.bosses.length - 1].y -
        this.bosses[this.bosses.length - 1].height / 2
      })`
    );

    // PNG画像を読み込み
    const image = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "image"
    );
    image.setAttribute("href", "svg/boss.png");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", this.bosses[this.bosses.length - 1].width);
    image.setAttribute("height", this.bosses[this.bosses.length - 1].height);

    // 画像の読み込み完了を待つ
    image.addEventListener("load", () => {
      console.log(
        `ボスPNG読み込み完了 (${this.bosses[this.bosses.length - 1].width}x${
          this.bosses[this.bosses.length - 1].height
        })`
      );
    });

    image.addEventListener("error", () => {
      console.error("boss.png読み込みエラー、フォールバックを使用");
      // フォールバック：シンプルな図形を作成
      g.innerHTML = `
                <polygon points="40,0 10,20 0,30 15,50 25,60 55,60 65,50 80,30 70,20" fill="#ff00ff" stroke="#cc00cc" stroke-width="2"/>
                <polygon points="20,30 30,35 50,35 60,30 40,45" fill="#aa00aa"/>
                <circle cx="25" cy="20" r="3" fill="#ffff00"/>
                <circle cx="55" cy="20" r="3" fill="#ffff00"/>
                <circle cx="40" cy="25" r="4" fill="#ff0000"/>
            `;
      this.addBossHealthBar(g);
      console.log("ボスPNGフォールバック使用");
    });

    g.appendChild(image);

    // 体力バーを追加
    this.addBossHealthBar(g);

    return g;
  }

  addBossHealthBar(parentG) {
    // 体力バーを作成
    const healthBarBg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    healthBarBg.setAttribute("x", "10");
    healthBarBg.setAttribute(
      "y",
      this.bosses[this.bosses.length - 1].height + 5
    );
    healthBarBg.setAttribute("width", "60");
    healthBarBg.setAttribute("height", "4");
    healthBarBg.setAttribute("fill", "#333");
    healthBarBg.setAttribute("stroke", "#fff");
    healthBarBg.setAttribute("stroke-width", "0.5");

    const healthBar = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    healthBar.setAttribute("class", "boss-health-bar");
    healthBar.setAttribute("x", "10");
    healthBar.setAttribute("y", this.bosses[this.bosses.length - 1].height + 5);
    healthBar.setAttribute(
      "width",
      60 *
        (this.bosses[this.bosses.length - 1].health /
          this.bosses[this.bosses.length - 1].maxHealth)
    );
    healthBar.setAttribute("height", "4");
    healthBar.setAttribute("fill", "#ff0000");

    parentG.appendChild(healthBarBg);
    parentG.appendChild(healthBar);
  }

  setupEventListeners() {
    // キーボードイベント
    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;

      // スペースキーでの射撃を無効化
      // if (e.code === 'Space') {
      //     e.preventDefault();
      //     this.shoot();
      // }

      if (e.code === "KeyP") {
        this.togglePause();
      }

      // デバッグ：当たり判定表示切り替え
      if (e.code === "KeyC") {
        this.showCollisionBoxes = !this.showCollisionBoxes;
        console.log(
          `当たり判定表示: ${this.showCollisionBoxes ? "ON" : "OFF"}`
        );
      }

      // ゲームオーバー時にEnterキーでリスタート
      if (e.code === "Enter" && this.gameState === "gameOver") {
        e.preventDefault();
        this.restartGame();
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // ボタンイベント
    document.getElementById("startButton").addEventListener("click", () => {
      this.startGame();
    });

    document.getElementById("pauseButton").addEventListener("click", () => {
      this.togglePause();
    });

    document.getElementById("restartButton").addEventListener("click", () => {
      this.restartGame();
    });

    // Bluetoothボタンイベント
    document
      .getElementById("connectBluetoothButton")
      .addEventListener("click", () => {
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

  startGame() {
    // Bluetooth接続の確認
    if (!this.characteristic) {
      alert("Bluetooth接続が必要です。");
      return;
    }

    // しきい値の確認
    console.log(`現在のしきい値: ${this.threshold} でゲームを開始します`);

    // ドックンカウントをリセット
    this.beatCount = 0;
    this.updateBeatCount();

    // ゲーム時間の初期化
    this.gameTime = 0;
    this.gameStartTime = 0; // 準備時間後に設定
    this.score = 0;
    this.updateScore(); // スコア表示を更新

    console.log("準備時間開始");

    // BGM開始
    this.playBGM();

    this.gameState = "preparation";
    this.preparationStartTime = Date.now();
    this.preparationTimer = 0;

    document.getElementById("startButton").style.display = "none";

    // 準備時間中はポーズボタンを無効化
    const pauseButton = document.getElementById("pauseButton");
    pauseButton.style.display = "inline-block";
    pauseButton.textContent = "心拍数上げタイム中...";
    pauseButton.disabled = true;
    pauseButton.style.opacity = "0.5";
    pauseButton.style.cursor = "not-allowed";

    // 準備時間中の表示を開始
    this.showPreparationScreen();

    // しきい値コントロールはプレイ中も表示したまま
    this.updateScore();
    this.gameLoop();
  }

  togglePause() {
    // 心拍数上げタイム中はポーズ不可
    if (this.gameState === "preparation") {
      console.log("心拍数上げタイム中はポーズできません");
      return;
    }

    if (this.gameState === "playing") {
      this.gameState = "paused";
      this.pauseBGM(); // BGM一時停止
      document.getElementById("pauseButton").textContent = "再開";
    } else if (this.gameState === "paused") {
      this.gameState = "playing";
      this.playBGM(); // BGM再開
      document.getElementById("pauseButton").textContent = "ポーズ";
      this.gameLoop();
    }
  }

  shoot() {
    if (this.gameState !== "playing" && this.gameState !== "preparation")
      return;

    // 3発連続で発射
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const bullet = {
          x: this.player.x + (i - 1) * 8, // 左右に少しずらして発射
          y: this.player.y - this.player.height / 2,
          width: 4,
          height: 10,
          speed: 8,
          damage: 1, // プレイヤーの弾の威力
        };

        const bulletSVG = this.createBulletSVG(bullet, "#00ff00");
        document.getElementById("playerBullets").appendChild(bulletSVG);
        bullet.element = bulletSVG;
        this.playerBullets.push(bullet);
      }, i * 50); // 50msずつ遅らせて発射
    }
  }

  createBulletSVG(bullet, color) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", bullet.x - bullet.width / 2);
    rect.setAttribute("y", bullet.y - bullet.height / 2);
    rect.setAttribute("width", bullet.width);
    rect.setAttribute("height", bullet.height);
    rect.setAttribute("fill", color);
    rect.setAttribute("class", "bullet");
    rect.style.color = color;
    return rect;
  }

  gameLoop(currentTime = 0) {
    if (this.gameState !== "playing" && this.gameState !== "preparation")
      return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.updateAnimations();

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  update(deltaTime) {
    // 準備時間中の処理
    if (this.gameState === "preparation") {
      this.updatePreparationTimer();
      this.updatePlayer();
      this.updatePlayerInvulnerability(deltaTime);
      this.updateBullets();
      this.updateExplosions();
      this.updateStars();
      return; // 敵の処理はスキップ
    }

    // 通常のゲーム処理
    this.updatePlayer();
    this.updatePlayerInvulnerability(deltaTime);
    this.updateBullets();
    this.updateEnemies(deltaTime);
    this.updateBoss(deltaTime);
    this.updateExplosions();
    this.updateStars();
    this.updateGameTime();
    this.checkCollisions();
    this.checkBossSpawn();
    this.checkWinCondition();
  }

  updatePlayer() {
    // 左移動: 矢印キー左 または Aキー
    if (
      (this.keys["ArrowLeft"] || this.keys["KeyA"]) &&
      this.player.x > this.player.width / 2
    ) {
      this.player.x -= this.player.speed;
    }
    // 右移動: 矢印キー右 または Dキー
    if (
      (this.keys["ArrowRight"] || this.keys["KeyD"]) &&
      this.player.x < this.gameWidth - this.player.width / 2
    ) {
      this.player.x += this.player.speed;
    }

    // プレイヤーの位置を更新（スケールも維持）
    const playerElement = document.querySelector("#player .player-ship");
    if (playerElement) {
      const scaleX = this.player.width / 64;
      const scaleY = this.player.height / 64;
      playerElement.setAttribute(
        "transform",
        `translate(${this.player.x - this.player.width / 2}, ${
          this.player.y - this.player.height / 2
        }) scale(${scaleX}, ${scaleY})`
      );
    }

    // 当たり判定ボックスの表示を更新
    this.updateCollisionBoxes();
  }

  updateCollisionBoxes() {
    if (!this.showCollisionBoxes) {
      this.removeCollisionBoxes();
      return;
    }

    // 既存のボックスを削除
    this.removeCollisionBoxes();

    // 新しいボックスを追加
    const collisionGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    collisionGroup.setAttribute("id", "playerCollisionBoxes");

    this.player.collisionBoxes.forEach((box, index) => {
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      rect.setAttribute("x", this.player.x + box.x);
      rect.setAttribute("y", this.player.y + box.y);
      rect.setAttribute("width", box.width);
      rect.setAttribute("height", box.height);
      rect.setAttribute("fill", "rgba(255, 0, 0, 0.3)");
      rect.setAttribute("stroke", "#ff0000");
      rect.setAttribute("stroke-width", "1");
      rect.setAttribute("class", "collision-box");

      collisionGroup.appendChild(rect);
    });

    document.getElementById("gameCanvas").appendChild(collisionGroup);
  }

  removeCollisionBoxes() {
    const existingBoxes = document.getElementById("playerCollisionBoxes");
    if (existingBoxes) {
      existingBoxes.remove();
    }
  }

  updatePlayerInvulnerability(deltaTime) {
    if (this.player.invulnerable) {
      this.player.invulnerableTime += deltaTime;
      if (this.player.invulnerableTime > 1000) {
        // 1秒間無敵
        this.player.invulnerable = false;
        this.player.invulnerableTime = 0;
      }
    }
  }

  updateBullets() {
    // プレイヤーの弾
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const bullet = this.playerBullets[i];
      bullet.y -= bullet.speed;

      bullet.element.setAttribute("y", bullet.y - bullet.height / 2);

      if (bullet.y < 0) {
        bullet.element.remove();
        this.playerBullets.splice(i, 1);
      }
    }

    // 敵の弾
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = this.enemyBullets[i];

      // 散弾（velocityがある場合）とそうでない場合を分ける
      if (bullet.velocityX !== undefined && bullet.velocityY !== undefined) {
        // 散弾の移動
        bullet.x += bullet.velocityX;
        bullet.y += bullet.velocityY;

        bullet.element.setAttribute("x", bullet.x - bullet.width / 2);
        bullet.element.setAttribute("y", bullet.y - bullet.height / 2);
      } else {
        // 通常の弾の移動
        bullet.y += bullet.speed;
        bullet.element.setAttribute("y", bullet.y - bullet.height / 2);
      }

      // 画面外に出た弾を削除
      if (
        bullet.y > this.gameHeight ||
        bullet.y < 0 ||
        bullet.x < 0 ||
        bullet.x > this.gameWidth
      ) {
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
        if (
          (this.enemyDirection > 0 && enemy.x > this.gameWidth - 50) ||
          (this.enemyDirection < 0 && enemy.x < 50)
        ) {
          shouldMoveDown = true;
          break;
        }
      }

      if (shouldMoveDown) {
        this.enemyDirection *= -1;
        this.enemies.forEach((enemy) => {
          enemy.y += 20;
          enemy.element.setAttribute(
            "transform",
            `translate(${enemy.x - enemy.width / 2}, ${
              enemy.y - enemy.height / 2
            })`
          );
        });
      } else {
        this.enemies.forEach((enemy) => {
          enemy.x += this.enemyDirection * 20;
          enemy.element.setAttribute(
            "transform",
            `translate(${enemy.x - enemy.width / 2}, ${
              enemy.y - enemy.height / 2
            })`
          );
        });
      }
    }

    // 敵の射撃
    if (this.enemyShootTimer > 1500 && this.enemies.length > 0) {
      this.enemyShootTimer = 0;
      const shootingEnemy =
        this.enemies[Math.floor(Math.random() * this.enemies.length)];
      this.enemyShoot(shootingEnemy);
    }
  }

  updateBoss(deltaTime) {
    if (this.bosses.length === 0) return;

    // 全てのボス敵を更新
    for (let i = 0; i < this.bosses.length; i++) {
      const boss = this.bosses[i];

      // ボスの移動
      boss.x += boss.moveDirection * 1;
      if (
        boss.x <= boss.width / 2 ||
        boss.x >= this.gameWidth - boss.width / 2
      ) {
        boss.moveDirection *= -1;
      }

      // ボスの射撃（各ボス固有の射撃間隔を使用）
      boss.shootTimer += deltaTime;
      if (boss.shootTimer > boss.shootInterval) {
        boss.shootTimer = 0;
        this.bossShoot(boss);
        console.log(`ボス${boss.bossId}が射撃しました`);
      }

      // ボスの位置を更新
      boss.element.setAttribute(
        "transform",
        `translate(${boss.x - boss.width / 2}, ${boss.y - boss.height / 2})`
      );

      // 体力バーを更新
      const healthBar = boss.element.querySelector(".boss-health-bar");
      if (healthBar) {
        healthBar.setAttribute("width", 60 * (boss.health / boss.maxHealth));
      }
    }
  }

  enemyShoot(enemy) {
    const bullet = {
      x: enemy.x,
      y: enemy.y + enemy.height / 2,
      width: 4,
      height: 8,
      speed: 3,
    };

    const bulletSVG = this.createBulletSVG(bullet, "#ff0000");
    document.getElementById("enemyBullets").appendChild(bulletSVG);
    bullet.element = bulletSVG;
    this.enemyBullets.push(bullet);
  }

  bossShoot(boss) {
    // ボスIDに基づいて異なる射撃パターンを設定
    const bossId = boss.bossId || 0;
    const bulletCount = 5 + (bossId % 2) * 2; // ボス0,2,4は5発、ボス1,3,5は7発
    const spreadAngle = Math.PI / 3 + (bossId % 2) * (Math.PI / 6); // 角度も変える
    const startAngle = -spreadAngle / 2;
    const bulletColor =
      bossId === 0 ? "#ff00ff" : bossId % 2 === 0 ? "#ff4400" : "#44ff00";

    for (let i = 0; i < bulletCount; i++) {
      const angle = startAngle + (spreadAngle / (bulletCount - 1)) * i;
      const bullet = {
        x: boss.x,
        y: boss.y + boss.height / 2,
        width: 6,
        height: 12,
        speed: 4,
        velocityX: Math.sin(angle) * 4, // X方向の速度
        velocityY: Math.cos(angle) * 4, // Y方向の速度
      };

      const bulletSVG = this.createBulletSVG(bullet, bulletColor);
      document.getElementById("enemyBullets").appendChild(bulletSVG);
      bullet.element = bulletSVG;
      this.enemyBullets.push(bullet);
    }
  }

  // 2匹のボス敵を生成する関数
  spawnTwoBosses() {
    // 複数ボス生成が既に進行中の場合は実行しない
    if (this.spawningMultipleBosses) {
      console.log("複数ボス生成が既に進行中です");
      return;
    }

    this.spawningMultipleBosses = true;
    console.log("2匹のボス敵を生成します！");

    // 警告メッセージを表示
    this.showBossMultipleAppearanceEffect();

    setTimeout(() => {
      // 左側のボス
      this.createBossAtPosition(this.gameWidth * 0.25, 100);

      // 右側のボス
      this.createBossAtPosition(this.gameWidth * 0.75, 100);

      this.spawningMultipleBosses = false;
      console.log(`2匹のボス敵を生成完了！現在のボス数: ${this.bosses.length}`);
    }, 1500);
  }

  // 指定位置にボス敵を作成
  createBossAtPosition(x, y) {
    // ボスの番号に基づいて異なる射撃間隔を設定
    const bossIndex = this.bosses.length;
    const baseShootInterval = 2400;
    const shootInterval = baseShootInterval + bossIndex * 400; // 各ボス400ms間隔をずらす
    const initialDelay = bossIndex * 800; // 初期射撃タイミングも大きくずらす

    this.bosses.push({
      x: x,
      y: y,
      width: 80,
      height: 60,
      health: 10,
      maxHealth: 10,
      moveDirection: Math.random() > 0.5 ? 1 : -1, // ランダムな初期方向
      shootTimer: initialDelay, // 初期射撃遅延を大きくずらす
      shootInterval: shootInterval, // 各ボス固有の射撃間隔
      bossId: bossIndex, // ボス識別用ID
    });

    const bossSVG = this.createBossSVGAtPosition(x, y);
    document.getElementById("enemies").appendChild(bossSVG);
    this.bosses[this.bosses.length - 1].element = bossSVG;

    console.log(
      `ボス${bossIndex}を作成: 射撃間隔=${shootInterval}ms, 初期遅延=${initialDelay}ms`
    );
  }

  // 指定位置にボスSVGを作成
  createBossSVGAtPosition(x, y) {
    const boss = this.bosses[this.bosses.length - 1];
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "boss-ship");
    g.setAttribute(
      "transform",
      `translate(${x - boss.width / 2}, ${y - boss.height / 2})`
    );

    // PNG画像を読み込み
    const image = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "image"
    );
    image.setAttribute("href", "svg/boss.png");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", boss.width);
    image.setAttribute("height", boss.height);

    image.addEventListener("load", () => {
      console.log(`ボスPNG読み込み完了 (${boss.width}x${boss.height})`);
    });

    image.addEventListener("error", () => {
      console.log("ボスPNG読み込み失敗、代替図形を作成");
      g.removeChild(image);

      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", boss.width);
      rect.setAttribute("height", boss.height);
      rect.setAttribute("fill", "#8B0000");
      rect.setAttribute("stroke", "#FF0000");
      rect.setAttribute("stroke-width", "2");
      g.appendChild(rect);
    });

    g.appendChild(image);
    this.addBossHealthBar(g);

    return g;
  }

  // 複数ボス登場演出
  showBossMultipleAppearanceEffect() {
    const warningText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    warningText.setAttribute("x", this.gameWidth / 2);
    warningText.setAttribute("y", this.gameHeight / 2);
    warningText.setAttribute("text-anchor", "middle");
    warningText.setAttribute("fill", "#ff4444");
    warningText.setAttribute("font-size", "36");
    warningText.setAttribute("font-weight", "bold");
    warningText.setAttribute("opacity", "0");
    warningText.textContent = "DOUBLE BOSS ATTACK!";

    const animateOpacity = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "animate"
    );
    animateOpacity.setAttribute("attributeName", "opacity");
    animateOpacity.setAttribute("values", "0;1;0;1;0;1;0");
    animateOpacity.setAttribute("dur", "2s");

    warningText.appendChild(animateOpacity);
    document.getElementById("explosions").appendChild(warningText);

    setTimeout(() => {
      if (warningText.parentNode) {
        warningText.remove();
      }
    }, 2000);

    console.log("複数ボス登場警告を表示しました");
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
    this.stars.forEach((star) => {
      star.y += star.speed;
      if (star.y > this.gameHeight) {
        star.y = 0;
        star.x = Math.random() * this.gameWidth;
      }
      star.element.setAttribute("cx", star.x);
      star.element.setAttribute("cy", star.y);
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
          enemy.health -= bullet.damage; // ダメージ計算を使用

          if (enemy.health <= 0) {
            enemy.element.remove();
            this.enemies.splice(j, 1);
            this.score += 30; // 雑魚敵を倒したら30ポイント
            this.playDeadSound(); // 敵撃破音を再生
            console.log(
              `敵を倒しました！残り敵数: ${this.enemies.length}, スコア: ${this.score}`
            );
          }

          bullet.element.remove();
          this.playerBullets.splice(i, 1);
          this.updateScore();
          break;
        }
      }

      // ボスとの衝突
      for (
        let bossIndex = this.bosses.length - 1;
        bossIndex >= 0;
        bossIndex--
      ) {
        const boss = this.bosses[bossIndex];
        if (this.isColliding(bullet, boss)) {
          this.createExplosion(bullet.x, bullet.y);
          boss.health -= bullet.damage;

          if (boss.health <= 0) {
            this.createExplosion(boss.x, boss.y);
            boss.element.remove();
            this.bosses.splice(bossIndex, 1);
            this.bossesDefeated++;
            this.score += 100; // ボス敵を倒したら100ポイント
            this.playDeadSound(); // ボス撃破音を再生
            console.log(
              `ボスを倒しました！討伐数: ${this.bossesDefeated}, スコア: ${this.score}`
            );

            // ボスを倒した後に2匹のボス敵を生成
            setTimeout(() => {
              this.spawnTwoBosses();
            }, 1000);
          }

          bullet.element.remove();
          this.playerBullets.splice(i, 1);
          this.updateScore();
          break;
        }
      }
    }

    // 敵の弾とプレイヤーの衝突
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = this.enemyBullets[i];

      if (this.isColliding(bullet, this.player) && !this.player.invulnerable) {
        this.createExplosion(this.player.x, this.player.y);
        this.playerDamageEffect();
        this.playDamageSound(); // ダメージ音を再生
        this.player.invulnerable = true;
        this.player.invulnerableTime = 0;
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
        this.playerDamageEffect();
        this.playDamageSound(); // ダメージ音を再生
        this.gameOver();
        break;
      }
    }
  }

  isColliding(obj1, obj2) {
    // プレイヤーとの衝突判定の場合、より精密な判定を使用
    if (obj2 === this.player) {
      return this.isCollidingWithPlayer(obj1);
    } else if (obj1 === this.player) {
      return this.isCollidingWithPlayer(obj2);
    }

    // 通常の矩形同士の衝突判定
    return (
      obj1.x < obj2.x + obj2.width / 2 &&
      obj1.x + obj1.width / 2 > obj2.x - obj2.width / 2 &&
      obj1.y < obj2.y + obj2.height / 2 &&
      obj1.y + obj1.height / 2 > obj2.y - obj2.height / 2
    );
  }

  isCollidingWithPlayer(obj) {
    // プレイヤーの複数のコリジョンボックスと衝突判定
    for (const collisionBox of this.player.collisionBoxes) {
      // プレイヤーの中心座標からの相対位置を計算
      const playerBoxX =
        this.player.x + collisionBox.x + collisionBox.width / 2;
      const playerBoxY =
        this.player.y + collisionBox.y + collisionBox.height / 2;

      // 各コリジョンボックスとの矩形衝突判定（中心座標ベース）
      if (
        Math.abs(obj.x - playerBoxX) < (obj.width + collisionBox.width) / 2 &&
        Math.abs(obj.y - playerBoxY) < (obj.height + collisionBox.height) / 2
      ) {
        return true;
      }
    }
    return false;
  }

  createExplosion(x, y) {
    const explosion = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    explosion.setAttribute("class", "explosion");
    explosion.setAttribute("transform", `translate(${x}, ${y})`);

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

    document.getElementById("explosions").appendChild(explosion);

    this.explosions.push({
      element: explosion,
      timer: 0,
      duration: 500,
    });
  }

  // プレイヤーダメージエフェクト
  playerDamageEffect() {
    const playerElement = document.querySelector("#player .player-ship");
    if (!playerElement) return;

    // 軽量な赤いリングエフェクトを追加
    const damageRing = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    damageRing.setAttribute("cx", this.player.x);
    damageRing.setAttribute("cy", this.player.y);
    damageRing.setAttribute("r", "20");
    damageRing.setAttribute("fill", "none");
    damageRing.setAttribute("stroke", "#ff0000");
    damageRing.setAttribute("stroke-width", "3");
    damageRing.setAttribute("opacity", "0.8");

    // シンプルなリングアニメーション
    const animateR = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "animate"
    );
    animateR.setAttribute("attributeName", "r");
    animateR.setAttribute("values", "20;40");
    animateR.setAttribute("dur", "0.3s");

    const animateOpacity = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "animate"
    );
    animateOpacity.setAttribute("attributeName", "opacity");
    animateOpacity.setAttribute("values", "0.8;0");
    animateOpacity.setAttribute("dur", "0.3s");

    damageRing.appendChild(animateR);
    damageRing.appendChild(animateOpacity);
    document.getElementById("explosions").appendChild(damageRing);

    // CSSアニメーションクラスを追加（transformは使用しない）
    playerElement.classList.add("damaged");

    // 短時間でクリーンアップ
    setTimeout(() => {
      if (playerElement && playerElement.classList.contains("damaged")) {
        playerElement.classList.remove("damaged");
      }
      if (damageRing && damageRing.parentNode) {
        damageRing.remove();
      }
    }, 300);

    console.log("プレイヤーダメージエフェクト実行");
  }

  // ボス登場チェック
  checkBossSpawn() {
    // デバッグ用：毎回チェック状況をログ出力
    if (this.enemies.length <= 5) {
      // 5匹以下になったら詳細ログ
      console.log(
        `ボス出現チェック - 敵数: ${this.enemies.length}, ボス存在: ${
          this.bosses.length > 0
        }, 登場処理中: ${this.bossSpawning}`
      );
    }

    // 雑魚敵が exactly 3匹の時のみボスが登場（かつボスがまだ存在しない場合）
    if (
      this.enemies.length === 3 &&
      this.bosses.length === 0 &&
      !this.bossSpawning
    ) {
      console.log(
        `🔴 ボス出現条件満たしました！雑魚敵がちょうど3匹になったのでボスが登場します！（現在の敵数: ${this.enemies.length}）`
      );

      this.bossSpawning = true; // 登場処理中フラグをON

      // ボス登場演出
      this.showBossAppearanceEffect();

      // 少し遅れてボスを作成
      setTimeout(() => {
        this.createBoss();
        this.bossSpawning = false; // フラグをリセット
        console.log("ボス作成完了！");
      }, 1000);
    }
  }

  // ボス登場演出
  showBossAppearanceEffect() {
    // 画面中央に警告メッセージを表示
    const warningText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    warningText.setAttribute("x", this.gameWidth / 2);
    warningText.setAttribute("y", this.gameHeight / 2);
    warningText.setAttribute("text-anchor", "middle");
    warningText.setAttribute("fill", "#ff0000");
    warningText.setAttribute("font-size", "48");
    warningText.setAttribute("font-weight", "bold");
    warningText.setAttribute("opacity", "0");
    warningText.textContent = "WARNING! BOSS APPEARS!";

    // 点滅アニメーション
    const animateOpacity = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "animate"
    );
    animateOpacity.setAttribute("attributeName", "opacity");
    animateOpacity.setAttribute("values", "0;1;0;1;0;1;0");
    animateOpacity.setAttribute("dur", "2s");

    warningText.appendChild(animateOpacity);
    document.getElementById("explosions").appendChild(warningText);

    // 2秒後にメッセージを削除
    setTimeout(() => {
      if (warningText.parentNode) {
        warningText.remove();
      }
    }, 2000);

    console.log("ボス登場警告を表示しました");
  }

  checkWinCondition() {
    // 雑魚敵がいない、かつボス敵がいない、かつ3匹以上のボス敵を倒した場合、
    // かつボス生成処理中でない場合にゲームクリア
    if (
      this.enemies.length === 0 &&
      this.bosses.length === 0 &&
      this.bossesDefeated >= 3 &&
      !this.spawningMultipleBosses &&
      !this.bossSpawning
    ) {
      console.log(
        `ゲームクリア条件達成！討伐したボス数: ${this.bossesDefeated}`
      );
      this.gameWin();
    }
  }

  gameWin() {
    console.log("gameWin() が呼び出されました");
    this.gameState = "gameOver";

    // 通信を停止
    if (this.characteristic) {
      this.sendStop();
    }

    // BGM停止
    this.stopBGM();

    // リザルト画面にリダイレクト（ゲームクリア）
    setTimeout(() => {
      const finalScore = this.score;
      const result = "win"; // ゲームクリアの場合
      console.log(
        `ゲームクリア！スコア: ${finalScore} でリザルト画面へリダイレクトします`
      );
      window.location.href = `/result.html?score=${finalScore}&beatCount=${this.beatCount}`;
    }, 1000);

    console.log("ゲームクリア！");
  }

  gameOver() {
    console.log("gameOver() が呼び出されました");
    this.gameState = "gameOver";

    // 通信を停止
    if (this.characteristic) {
      this.sendStop();
    }

    // BGM停止
    this.stopBGM();

    // リザルト画面にリダイレクト（ゲームオーバー）
    setTimeout(() => {
      const finalScore = this.score;
      const result = "lose"; // ゲームオーバーの場合
      console.log(
        `ゲームオーバー！スコア: ${finalScore} でリザルト画面へリダイレクトします`
      );
      window.location.href = `/result.html?score=${finalScore}&beatCount=${this.beatCount}`;
    }, 1000);

    console.log("ゲームオーバー");
  }

  restartGame() {
    // BGM停止
    this.stopBGM();

    // ゲーム状態の完全リセット
    this.score = 0;
    this.lives = 5;
    this.gameTime = 0;
    this.gameStartTime = 0;
    this.beatCount = 0;
    this.lastBeatTime = 0;
    this.bossSpawning = false; // ボス登場フラグもリセット
    this.bossesDefeated = 0; // ボス討伐数もリセット
    this.spawningMultipleBosses = false; // 複数ボス生成フラグもリセット

    // 準備時間状態もリセット
    this.preparationTimer = 0;
    this.preparationStartTime = 0;

    // プレイヤー位置のリセット
    this.player.x = 400;
    this.player.y = 550;
    this.player.invulnerable = false;
    this.player.invulnerableTime = 0;

    // 弾丸と敵のクリア
    this.clearBullets();
    this.clearEnemies();
    this.explosions.forEach((explosion) => explosion.element.remove());
    this.explosions = [];

    // 準備画面があれば削除
    const preparationScreen = document.getElementById("preparationScreen");
    if (preparationScreen) {
      preparationScreen.remove();
    }

    // 当たり判定ボックスも削除
    this.removeCollisionBoxes();

    // UI要素のリセット
    this.updateBeatCount();
    document.getElementById("gameOverScreen").style.display = "none";

    // データ配列をクリア（グラフのリセット）
    this.dataArray = [];
    if (this.graphCtx) {
      this.graphCtx.clearRect(
        0,
        0,
        this.graphCanvas.width,
        this.graphCanvas.height
      );
    }
    if (this.heartCtx) {
      this.heartCtx.clearRect(
        0,
        0,
        this.heartCanvas.width,
        this.heartCanvas.height
      );
    }

    // Bluetooth接続状態をチェック
    if (this.characteristic) {
      // 接続済みの場合は通常のリスタート
      document.getElementById("startButton").style.display = "inline-block";
      document.getElementById("startButton").textContent =
        "しきい値を調整してゲーム開始";
      document.getElementById("thresholdControl").style.display = "block";
      document.getElementById("pauseButton").style.display = "none";
      this.gameState = "menu";
    } else {
      // 未接続の場合は再接続が必要
      document.getElementById("connectBluetoothButton").style.display =
        "inline-block";
      document.getElementById("thresholdControl").style.display = "none";

      const startButton = document.getElementById("startButton");
      startButton.disabled = true;
      startButton.style.opacity = "0.5";
      startButton.style.cursor = "not-allowed";
      startButton.textContent = "Bluetooth接続後にゲーム開始";
      startButton.style.display = "inline-block";

      document.getElementById("pauseButton").style.display = "none";
      this.gameState = "menu";
    }

    this.updateScore();
    this.updateLives();

    console.log("ゲームがリスタートされました");
  }

  clearBullets() {
    this.playerBullets.forEach((bullet) => bullet.element.remove());
    this.enemyBullets.forEach((bullet) => bullet.element.remove());
    this.playerBullets = [];
    this.enemyBullets = [];
  }

  clearEnemies() {
    this.enemies.forEach((enemy) => enemy.element.remove());
    this.enemies = [];

    this.bosses.forEach((boss) => boss.element.remove());
    this.bosses = [];
  }

  updateScore() {
    const scoreElement = document.getElementById("score");
    scoreElement.textContent = `${this.score}点`;
  }

  updateLives() {
    const livesElement = document.getElementById("lives");
    livesElement.innerHTML = "";

    // 残機数分のハートSVGを作成
    for (let i = 0; i < this.lives; i++) {
      const heartSvg = this.createHeartSVG();
      livesElement.appendChild(heartSvg);
    }
  }

  createHeartSVG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.style.marginLeft = "5px";
    svg.style.filter = "drop-shadow(0 0 3px #ff6666)";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M50,85 C50,85 20,60 20,40 C20,25 30,15 45,15 C47,15 50,18 50,18 C50,18 53,15 55,15 C70,15 80,25 80,40 C80,60 50,85 50,85 Z"
    );
    path.setAttribute("fill", "#ff6666");
    path.setAttribute("stroke", "#cc0000");
    path.setAttribute("stroke-width", "2");

    svg.appendChild(path);
    return svg;
  }

  updateAnimations() {
    // アニメーション更新（必要に応じて）
  }

  updateGameTime() {
    if (this.gameState === "playing" && this.gameStartTime > 0) {
      this.gameTime = Math.floor((Date.now() - this.gameStartTime) / 1000); // 秒単位
      this.updateScore(); // 時間の更新と同時にスコア表示も更新
    }
  }

  // Bluetooth接続機能
  async connectToBluetooth() {
    try {
      console.log("Bluetooth接続を試行中...");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: this.device_name }],
        optionalServices: [this.service_uuid],
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(this.service_uuid);
      this.characteristic = await service.getCharacteristic(
        this.characteristic_uuid
      );

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener(
        "characteristicvaluechanged",
        (event) => this.handleNotify(event)
      );

      console.log("Bluetooth接続完了＆通知待機中");

      // 接続成功時にUI要素を更新
      document.getElementById("connectBluetoothButton").style.display = "none";
      document.getElementById("thresholdControl").style.display = "block";

      // ゲーム開始ボタンを有効化
      const startButton = document.getElementById("startButton");
      startButton.disabled = false;
      startButton.style.opacity = "1";
      startButton.style.cursor = "pointer";
      startButton.textContent = "しきい値を調整してゲーム開始";

      // 通信開始を自動実行
      await this.sendStart();

      console.log("しきい値を調整してからゲーム開始ボタンを押してください");
    } catch (error) {
      console.log("Bluetooth接続エラー: " + error);
      alert(
        "Bluetooth接続に失敗しました。ESP32デバイスが近くにあることを確認してください。"
      );
    }
  }

  handleNotify(event) {
    const valueStr = new TextDecoder().decode(event.target.value).trim();
    const valueNum = parseFloat(valueStr);
    if (!isNaN(valueNum)) {
      const filtered = this.lowPassFilter(valueNum);
      this.detectBeat(filtered);
      this.addData(Math.round(filtered));

      // UIの更新
      this.updateCurrentValue(Math.round(filtered));
      this.drawGraph();
    }
  }

  detectBeat(value) {
    // ポーズ中はドックンカウントを停止
    if (this.gameState === "paused") {
      return;
    }

    const now = Date.now();
    if (value > this.threshold && !this.aboveThreshold) {
      if (now - this.lastBeatTime > 300) {
        this.beatCount++;
        this.lastBeatTime = now;
        console.log(`ドックン ${this.beatCount} 回 - 弾発射!`);

        // UI更新
        this.updateBeatCount();

        // ドックンアニメーション実行
        this.playHeartAnimation();

        // 弾を発射（ゲーム中または準備時間中）
        if (this.gameState === "playing" || this.gameState === "preparation") {
          this.shoot();
        }
      }
      this.aboveThreshold = true;
    } else if (value < this.threshold) {
      this.aboveThreshold = false;
    }
  }

  lowPassFilter(currentValue) {
    if (currentValue === "") return;
    const filtered =
      this.alpha * currentValue + (1 - this.alpha) * this.prevFiltered;
    this.prevFiltered = filtered;
    return filtered;
  }

  addData(data) {
    this.dataArray.push(data);
    if (this.dataArray.length > 300) this.dataArray.shift(); // グラフ幅に合わせて調整
  }

  updateCurrentValue(value) {
    document.getElementById("valueText").textContent = value;
  }

  updateBeatCount() {
    document.getElementById("beatCount").textContent = this.beatCount;
  }

  drawGraph() {
    if (!this.graphCtx || this.dataArray.length === 0) return;

    const canvas = this.graphCanvas;
    const ctx = this.graphCtx;

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // グリッド描画
    this.drawGrid(ctx, canvas);

    // しきい値ライン描画
    this.drawThresholdLine(ctx, canvas);

    // データ線描画
    this.drawDataLine(ctx, canvas);
  }

  drawGrid(ctx, canvas) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    // 縦線
    for (let x = 0; x <= canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // 横線
    for (let y = 0; y <= canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  drawThresholdLine(ctx, canvas) {
    if (this.dataArray.length === 0) return;

    const minValue = Math.min(...this.dataArray);
    const maxValue = Math.max(...this.dataArray);
    const range = maxValue - minValue || 1000;

    const thresholdY =
      canvas.height - ((this.threshold - minValue) / range) * canvas.height;

    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(canvas.width, thresholdY);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  drawDataLine(ctx, canvas) {
    if (this.dataArray.length < 2) return;

    const minValue = Math.min(...this.dataArray);
    const maxValue = Math.max(...this.dataArray);
    const range = maxValue - minValue || 1000;

    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < this.dataArray.length; i++) {
      const x = (i / (this.dataArray.length - 1)) * canvas.width;
      const y =
        canvas.height -
        ((this.dataArray[i] - minValue) / range) * canvas.height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  async playHeartAnimation() {
    if (this.heartImages.length === 0) return;

    for (let i = this.frameCount - 1; i >= 0; i--) {
      this.heartCtx.clearRect(
        0,
        0,
        this.heartCanvas.width,
        this.heartCanvas.height
      );
      this.heartCtx.drawImage(this.heartImages[i], 0, 0);
      await this.wait(this.frameDelay);
    }
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  showPreparationScreen() {
    // 準備時間カウントダウン画面を表示
    const preparationScreen = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    preparationScreen.setAttribute("id", "preparationScreen");

    // 背景
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", this.gameWidth);
    background.setAttribute("height", this.gameHeight);
    background.setAttribute("fill", "rgba(0, 0, 50, 0.8)");
    preparationScreen.appendChild(background);

    // タイトル
    const title = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    title.setAttribute("x", this.gameWidth / 2);
    title.setAttribute("y", 200);
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("fill", "#ffff00");
    title.setAttribute("font-size", "36");
    title.setAttribute("font-weight", "bold");
    title.textContent = "心拍数上げタイム！";
    preparationScreen.appendChild(title);

    // 説明
    const instruction = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    instruction.setAttribute("x", this.gameWidth / 2);
    instruction.setAttribute("y", 250);
    instruction.setAttribute("text-anchor", "middle");
    instruction.setAttribute("fill", "#ffffff");
    instruction.setAttribute("font-size", "24");
    instruction.textContent = "運動して心拍数を上げて弾を撃つ練習をしよう！";
    preparationScreen.appendChild(instruction);

    // カウントダウン
    const countdown = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    countdown.setAttribute("id", "preparationCountdown");
    countdown.setAttribute("x", this.gameWidth / 2);
    countdown.setAttribute("y", 350);
    countdown.setAttribute("text-anchor", "middle");
    countdown.setAttribute("fill", "#ff6666");
    countdown.setAttribute("font-size", "72");
    countdown.setAttribute("font-weight", "bold");
    countdown.textContent = this.preparationTime;
    preparationScreen.appendChild(countdown);

    // 残り時間ラベル
    const timerLabel = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    timerLabel.setAttribute("x", this.gameWidth / 2);
    timerLabel.setAttribute("y", 400);
    timerLabel.setAttribute("text-anchor", "middle");
    timerLabel.setAttribute("fill", "#ffffff");
    timerLabel.setAttribute("font-size", "20");
    timerLabel.textContent = "残り時間（秒）";
    preparationScreen.appendChild(timerLabel);

    document.getElementById("gameCanvas").appendChild(preparationScreen);
  }

  updatePreparationTimer() {
    const elapsed = (Date.now() - this.preparationStartTime) / 1000;
    const remaining = Math.max(0, this.preparationTime - elapsed);

    const countdownElement = document.getElementById("preparationCountdown");
    if (countdownElement) {
      countdownElement.textContent = Math.ceil(remaining);
    }

    // 準備時間終了
    if (remaining <= 0) {
      this.endPreparation();
    }
  }

  endPreparation() {
    console.log("準備時間終了、ゲーム開始！");

    // 準備画面を削除
    const preparationScreen = document.getElementById("preparationScreen");
    if (preparationScreen) {
      preparationScreen.remove();
    }

    // ポーズボタンを有効化
    const pauseButton = document.getElementById("pauseButton");
    pauseButton.textContent = "ポーズ";
    pauseButton.disabled = false;
    pauseButton.style.opacity = "1";
    pauseButton.style.cursor = "pointer";

    // ゲーム開始
    this.gameState = "playing";
    this.gameStartTime = Date.now(); // ここで正式なゲーム時間を開始
    this.createLevel();

    // ゲーム開始エフェクト
    this.showGameStartEffect();
  }

  showGameStartEffect() {
    const gameStartText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    gameStartText.setAttribute("x", this.gameWidth / 2);
    gameStartText.setAttribute("y", this.gameHeight / 2);
    gameStartText.setAttribute("text-anchor", "middle");
    gameStartText.setAttribute("fill", "#00ff00");
    gameStartText.setAttribute("font-size", "48");
    gameStartText.setAttribute("font-weight", "bold");
    gameStartText.setAttribute("opacity", "1");
    gameStartText.textContent = "ゲーム開始！";

    // フェードアウトアニメーション
    const animateOpacity = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "animate"
    );
    animateOpacity.setAttribute("attributeName", "opacity");
    animateOpacity.setAttribute("values", "1;1;0");
    animateOpacity.setAttribute("dur", "2s");

    gameStartText.appendChild(animateOpacity);
    document.getElementById("explosions").appendChild(gameStartText);

    // 2秒後にテキストを削除
    setTimeout(() => {
      if (gameStartText.parentNode) {
        gameStartText.remove();
      }
    }, 2000);
  }
}

// ゲーム開始
document.addEventListener("DOMContentLoaded", () => {
  const game = new SpaceInvadersGame();
});
