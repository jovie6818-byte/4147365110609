// ==========================================
// 綠動未來：手勢感應海洋淨化大作戰
// 開發者：414736511_張又瑄
// [UX 優化版：響應式全螢幕 + AR 半透明視訊背景]
// ==========================================

let video;
let handpose;
let predictions = [];

// 狀態機變數: 'START', 'PLAY', 'GAMEOVER'
let gameState = 'START'; 
let startCounter = 0; 

// 手指坐標平滑化變數
let pointerX = 0;
let pointerY = 0;
let lerpFactor = 0.35; 
let isHandDetected = false;

// 遊戲變數
let score = 0;
let gameTimer = 45 * 60; // 45秒
let trashItems = [];
let maxTrash = 6;
let particles = [];

// 定義 AI 底層視訊的解析度 (維持 640x480 以確保影像辨識效能不卡頓)
const VIDEO_W = 640;
const VIDEO_H = 480;

// 垃圾種類定義
let trashTypes = [
  { name: '塑膠袋', color: [240, 240, 240, 200], size: 30 },
  { name: '寶特瓶', color: [56, 189, 248, 200], size: 25 },
  { name: '廢棄漁網', color: [148, 163, 184, 180], size: 40 },
  { name: '保麗龍盒', color: [255, 255, 255, 220], size: 35 }
];

function setup() {
  // 使用視窗當前的寬高創建畫布
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  
  // 視訊維持固定尺寸，不隨全螢幕放大而拖垮效能
  video = createCapture(VIDEO);
  video.size(VIDEO_W, VIDEO_H);
  video.hide();

  handpose = ml5.handpose(video, modelReady);
  handpose.on('predict', (results) => {
    predictions = results;
    isHandDetected = predictions.length > 0;
  });

  pointerX = width / 2;
  pointerY = height / 2;
}

// 監聽瀏覽器視窗大小變化，自動重新調整畫布
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// 點擊畫面任意處即可切換/退出全螢幕模式
function mousePressed() {
  if (gameState === 'START') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}

function modelReady() {
  console.log('Model Loaded! ml5.handpose 模型已成功就緒！');
}

function draw() {
  drawOceanBackground();

  if (gameState === 'START') {
    drawStartScreen();
  } else if (gameState === 'PLAY') {
    runGameLogic();
  } else if (gameState === 'GAMEOVER') {
    drawGameOverScreen();
  }
  
  handleParticles();
}

// 全新的背景渲染函數：AR 鏡頭半透明海洋風格
function drawOceanBackground() {
  // 1. 繪製鏡像的視訊畫面作為最底層
  push();
  translate(width, 0); // 水平位移到右側
  scale(-1, 1);        // 鏡像翻轉，讓畫面跟現實動作完全同步
  // 將視訊拉伸填滿全螢幕畫布
  image(video, 0, 0, width, height); 
  pop();

  // 2. 疊加半透明的深藍色遮罩，讓攝影機畫面變成「半透明底圖」
  fill(15, 23, 42, 180); // 180 是透明度，覺得太暗或太亮可以調這個數值
  rectMode(CORNER);
  rect(0, 0, width, height);

  // 3. 保留原本的裝飾性波浪氣泡，維持水下氛圍
  noStroke();
  fill(255, 255, 255, 30);
  for (let i = 0; i < 5; i++) {
    let bubbleX = (noise(frameCount * 0.005 + i * 100) * width);
    let bubbleY = ((frameCount + i * 120) % height);
    ellipse(bubbleX, height - bubbleY, 15 + i * 3);
  }
}

function drawStartScreen() {
  // 讓開頭畫面的遮罩再稍微深一點點，確保文字好讀
  fill(15, 23, 42, 100);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  fill(34, 197, 94);
  textSize(42);
  textStyle(BOLD);
  text("手勢感應消消樂大作戰", width / 2, height / 2 - 100);
  
  textStyle(NORMAL);
  fill(255);
  textSize(20);
  text("【教育科技學系 期末專案作品】", width / 2, height / 2 - 40);
  
  fill(241, 245, 249);
  textSize(18);
  text("💡 互動玩法引導：", width / 2, height / 2 + 30);
  text("1. 與鏡頭保持 60-100 公分距離，將單手舉至胸前張開", width / 2, height / 2 + 70);
  text("2. 空中移動手掌控制「綠能網」，對準海洋垃圾即可自動回收", width / 2, height / 2 + 105);
  text("3. 每局時間共 45 秒，挑戰最高綠能評級！", width / 2, height / 2 + 140);

  // --- 全螢幕提示 ---
  fill(56, 189, 248);
  textSize(16);
  text("👆 點擊畫面任意處可切換【全螢幕模式】", width / 2, height / 2 + 190);

  // --- 右上角偵測預覽小螢幕 ---
  let panelW = 200;
  let panelH = 150;
  let panelX = width - panelW - 30; 
  let panelY = 30;
  let panelRadius = 8;
  fill(0, 150); 
  stroke(255, 50);
  strokeWeight(2);
  rect(panelX, panelY, panelW, panelH, panelRadius);
  
  push();
  drawingContext.save();
  rectMode(CORNER);
  rect(panelX, panelY, panelW, panelH, panelRadius);
  drawingContext.clip();
  
  translate(panelX + panelW, panelY); 
  scale(-1, 1); 
  image(video, 0, 0, panelW, panelH);
  
  if (predictions.length > 0) {
    let landmarks = predictions[0].landmarks;
    noStroke();
    
    for (let j = 0; j < landmarks.length; j++) {
      let keypoint = landmarks[j];
      let lx = (keypoint[0] / VIDEO_W) * panelW;
      let ly = (keypoint[1] / VIDEO_H) * panelH;
      fill(34, 197, 94); 
      ellipse(lx, ly, 4); 
    }
    
    stroke(34, 197, 94, 150);
    strokeWeight(1);
    for (let j = 0; j < 5; j++) {
      let fingerBase = landmarks[0]; 
      let fingerTip = landmarks[(j+1)*4]; 
      let bx = (fingerBase[0] / VIDEO_W) * panelW;
      let by = (fingerBase[1] / VIDEO_H) * panelH;
      let tx = (fingerTip[0] / VIDEO_W) * panelW;
      let ty = (fingerTip[1] / VIDEO_H) * panelH;
      line(bx, by, tx, ty);
    }
  }
  drawingContext.restore(); 
  pop();
  
  fill(255);
  noStroke();
  textSize(14);
  textAlign(LEFT, TOP);
  text("📷 AI 偵測骨架", panelX + 10, panelY + 10);
  if (isHandDetected) {
    fill(34, 197, 94);
    ellipse(panelX + panelW - 20, panelY + 18, 10); 
  } else {
    fill(239, 68, 68, 200 + sin(frameCount * 0.1) * 55); 
    ellipse(panelX + panelW - 20, panelY + 18, 10);
  }

  // --- 狀態引導 ---
  if (isHandDetected) {
    fill(252, 211, 77); 
    textSize(22);
    textStyle(BOLD);
    text("✅ 手勢已感應成功！準備中...", width / 2, height / 2 + 250);
    
    startCounter++;
    if (startCounter > 20) { 
      gameState = 'PLAY'; 
    }
  } else {
    startCounter = 0; 
    fill(148, 163, 184); 
    textSize(20);
    text("📷 攝影機已啟用。請將手舉至畫面中。感應中...", width / 2, height / 2 + 250);
  }
  textStyle(NORMAL); 
}

function runGameLogic() {
  if (predictions.length > 0) {
    let landmarks = predictions[0].landmarks;
    
    // 將 640x480 的座標，映射(map)放大到全螢幕尺寸，並維持水平鏡像
    let targetX = map(landmarks[8][0], 0, VIDEO_W, width, 0); 
    let targetY = map(landmarks[8][1], 0, VIDEO_H, 0, height);
    
    pointerX = lerp(pointerX, targetX, lerpFactor);
    pointerY = lerp(pointerY, targetY, lerpFactor);
  }

  if (trashItems.length < maxTrash && random(1) < 0.03) {
    generateTrash();
  }

  for (let i = trashItems.length - 1; i >= 0; i--) {
    let t = trashItems[i];
    t.y += t.speedY;
    t.x += sin(frameCount * 0.02 + t.seed) * 0.5;

    fill(t.type.color);
    stroke(255, 255, 255, 50);
    strokeWeight(1);
    rectMode(CENTER);
    rect(t.x, t.y, t.type.size, t.type.size, 8);
    
    fill(255, 255, 255, 30);
    noStroke();
    rect(t.x, t.y, t.type.size * 0.6, t.type.size * 0.2);

    if (t.y > height + 50) {
      trashItems.splice(i, 1);
      continue;
    }

    let d = dist(pointerX, pointerY, t.x, t.y);
    if (d < t.type.size / 2 + 40) { 
      createExplosion(t.x, t.y);
      score += 10;
      trashItems.splice(i, 1);
    }
  }

  if (isHandDetected) {
    noFill();
    stroke(34, 197, 94, 150 + sin(frameCount * 0.1) * 50);
    strokeWeight(3);
    ellipse(pointerX, pointerY, 80 + sin(frameCount * 0.1) * 5); 
    
    fill(34, 197, 94, 200);
    noStroke();
    ellipse(pointerX, pointerY, 20);
    
    stroke(34, 197, 94, 180);
    strokeWeight(2);
    line(pointerX - 35, pointerY, pointerX + 35, pointerY);
    line(pointerX, pointerY - 35, pointerX, pointerY + 35);
  } else {
    fill(239, 68, 68, 200);
    textAlign(CENTER, CENTER);
    textSize(20);
    text("⚠️ 未偵測到手掌，請將手舉至胸前", width / 2, 60);
  }

  fill(15, 23, 42, 180);
  rectMode(CORNER);
  rect(0, 0, width, 60);
  
  fill(255);
  textSize(22);
  textAlign(LEFT, CENTER);
  text(`🌱 永續積分: ${score}`, 30, 30);
  
  textAlign(RIGHT, CENTER);
  let remainingTime = ceil(gameTimer / 60);
  text(`⏱️ 剩餘時間: ${remainingTime} 秒`, width - 30, 30);

  gameTimer--;
  if (gameTimer <= 0) {
    gameState = 'GAMEOVER';
  }
}

function generateTrash() {
  let type = random(trashTypes);
  trashItems.push({
    x: random(100, width - 100), 
    y: -30,
    type: type,
    speedY: random(2, 4.5), 
    seed: random(1000)
  });
}

function createExplosion(x, y) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x,
      y: y,
      vx: random(-4, 4),
      vy: random(-4, 4),
      alpha: 255,
      size: random(8, 16) 
    });
  }
}

function handleParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 5;
    p.size *= 0.96;
    
    fill(34, 197, 94, p.alpha);
    noStroke();
    ellipse(p.x, p.y, p.size);
    
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawGameOverScreen() {
  // 結算畫面也上一個稍微深一點的遮罩
  fill(15, 23, 42, 200);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER);
  fill(252, 211, 77);
  textSize(48);
  textStyle(BOLD);
  text("🌊 淨化任務完成！", width / 2, height / 2 - 100);

  fill(255);
  textSize(32);
  text(`您的最終永續環境積分: ${score} 分`, width / 2, height / 2 - 30);

  textSize(24);
  fill(34, 197, 94);
  if (score >= 200) {
    text("🎖️ 評等：卓越級·海洋守護神", width / 2, height / 2 + 40);
  } else if (score >= 100) {
    text("🎖️ 評等：專業級·減碳先鋒", width / 2, height / 2 + 40);
  } else {
    text("🎖️ 評等：實習級·環保小兵", width / 2, height / 2 + 40);
  }

  fill(148, 163, 184);
  textSize(18);
  text("提示：若要重新挑戰，請重新整理網頁頁面。", width / 2, height / 2 + 150);
}
