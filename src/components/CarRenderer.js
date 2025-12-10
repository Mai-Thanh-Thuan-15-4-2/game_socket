// Component vẽ xe (cảnh sát hoặc xe tải)
class CarRenderer {
  constructor(CAR_WIDTH, CAR_HEIGHT, SWORD_LENGTH) {
    this.CAR_WIDTH = CAR_WIDTH;
    this.CAR_HEIGHT = CAR_HEIGHT;
    this.SWORD_LENGTH = SWORD_LENGTH;
  }

  // Vẽ xe cảnh sát
  drawPoliceCar(ctx, car, gameTimer, speedBoosted) {
    const { CAR_WIDTH, CAR_HEIGHT } = this;

    // Thân xe - hình dáng xe thật với đầu nhọn
    const bodyGradient = ctx.createLinearGradient(-CAR_WIDTH / 2, 0, CAR_WIDTH / 2, 0);
    
    if (speedBoosted) {
      bodyGradient.addColorStop(0, '#7f1d1d');
      bodyGradient.addColorStop(0.3, '#991b1b');
      bodyGradient.addColorStop(0.5, '#b91c1c');
      bodyGradient.addColorStop(0.7, '#991b1b');
      bodyGradient.addColorStop(1, '#7f1d1d');
    } else {
      bodyGradient.addColorStop(0, '#0a0a0a');
      bodyGradient.addColorStop(0.3, '#1a1a1a');
      bodyGradient.addColorStop(0.5, '#2d2d2d');
      bodyGradient.addColorStop(0.7, '#1a1a1a');
      bodyGradient.addColorStop(1, '#0a0a0a');
    }
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(0, -CAR_HEIGHT / 2 - 10);
    ctx.lineTo(-CAR_WIDTH / 2, -CAR_HEIGHT / 2 + 10);
    ctx.lineTo(-CAR_WIDTH / 2, CAR_HEIGHT / 2 - 10);
    ctx.arcTo(-CAR_WIDTH / 2, CAR_HEIGHT / 2, 0, CAR_HEIGHT / 2, 8);
    ctx.arcTo(CAR_WIDTH / 2, CAR_HEIGHT / 2, CAR_WIDTH / 2, CAR_HEIGHT / 2 - 10, 8);
    ctx.lineTo(CAR_WIDTH / 2, -CAR_HEIGHT / 2 + 10);
    ctx.lineTo(0, -CAR_HEIGHT / 2 - 10);
    ctx.closePath();
    ctx.fill();
    
    // Viền bạc kim loại
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    // LED strip effect
    this.drawLEDStrip(ctx, gameTimer, CAR_HEIGHT, CAR_WIDTH);
    
    // Đèn pha
    ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
    ctx.beginPath();
    ctx.arc(-10, -CAR_HEIGHT / 2 + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -CAR_HEIGHT / 2 + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Cửa sổ trước
    this.drawWindow(ctx, CAR_HEIGHT);
    
    // Sọc thể thao
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -CAR_HEIGHT / 2 + 40);
    ctx.lineTo(-8, CAR_HEIGHT / 2 - 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -CAR_HEIGHT / 2 + 40);
    ctx.lineTo(8, CAR_HEIGHT / 2 - 15);
    ctx.stroke();
    
    // Logo giữa xe
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Đèn nhấp nháy cảnh sát
    this.drawPoliceLight(ctx, gameTimer, CAR_HEIGHT);
  }

  // Vẽ xe tải
  drawTruck(ctx, car, gameTimer, speedBoosted, animalImages, vehicleWidth, vehicleHeight) {
    const bodyGradient = ctx.createLinearGradient(-vehicleWidth / 2, 0, vehicleWidth / 2, 0);
    
    if (speedBoosted) {
      bodyGradient.addColorStop(0, '#7f1d1d');
      bodyGradient.addColorStop(0.3, '#991b1b');
      bodyGradient.addColorStop(0.5, '#b91c1c');
      bodyGradient.addColorStop(0.7, '#991b1b');
      bodyGradient.addColorStop(1, '#7f1d1d');
    } else {
      bodyGradient.addColorStop(0, '#000000ff');
      bodyGradient.addColorStop(0.3, '#1a1a1aff');
      bodyGradient.addColorStop(0.5, '#080808ff');
      bodyGradient.addColorStop(0.7, 'rgba(18, 2, 2, 1)');
      bodyGradient.addColorStop(1, '#000000ff');
    }
    
    // Thùng xe tải
    ctx.fillStyle = bodyGradient;
    ctx.fillRect(-vehicleWidth / 2, -vehicleHeight / 2 + 30, vehicleWidth, vehicleHeight - 35);
    
    // Vẽ hình động vật lên thùng xe
    if (animalImages && animalImages.length > 0) {
      const cargoX = -vehicleWidth / 2;
      const cargoY = -vehicleHeight / 2 + 30;
      const cargoWidth = vehicleWidth;
      const cargoHeight = vehicleHeight - 35;
      
      const imageIndex = Math.floor(gameTimer / 180) % 3;
      const currentImage = animalImages[imageIndex];
      
      ctx.drawImage(
        currentImage,
        cargoX + 5,
        cargoY + 5,
        cargoWidth - 10,
        cargoHeight - 10
      );
    }
    
    // Viền thùng xe
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 3;
    ctx.strokeRect(-vehicleWidth / 2, -vehicleHeight / 2 + 30, vehicleWidth, vehicleHeight - 35);
    
    // Cabin xe tải
    this.drawTruckCabin(ctx, speedBoosted, vehicleWidth, vehicleHeight);
    
    // Kính cabin
    this.drawTruckWindow(ctx, vehicleWidth, vehicleHeight);
    
    // 3 đèn LED trên kính cabin
    this.drawTruckLEDs(ctx, gameTimer, vehicleWidth, vehicleHeight);
    
    // LED strip cho xe tải
    this.drawTruckLEDStrip(ctx, gameTimer, vehicleWidth, vehicleHeight);
  }

  // Vẽ LED strip cho xe cảnh sát
  drawLEDStrip(ctx, gameTimer, CAR_HEIGHT, CAR_WIDTH) {
    const lightProgress = (gameTimer * 0.1) % 1;
    const numLights = 8;
    
    for (let i = 0; i < numLights; i++) {
      const progress = (i / numLights + lightProgress) % 1;
      const yPos = -CAR_HEIGHT / 2 + progress * CAR_HEIGHT;
      const brightness = Math.sin(progress * Math.PI) * 0.8 + 0.2;
      const isRed = Math.floor((progress + lightProgress) * numLights) % 2 === 0;
      const colorRGB = isRed ? [239, 68, 68] : [59, 130, 246];
      
      for (let side of [-1, 1]) {
        const xPos = side * CAR_WIDTH / 2;
        const glow = ctx.createRadialGradient(xPos, yPos, 0, xPos, yPos, 8);
        glow.addColorStop(0, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness})`);
        glow.addColorStop(0.5, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness * 0.5})`);
        glow.addColorStop(1, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(xPos, yPos, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.beginPath();
        ctx.arc(xPos, yPos, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Vẽ cửa sổ xe cảnh sát
  drawWindow(ctx, CAR_HEIGHT) {
    const windowGradient = ctx.createLinearGradient(0, -CAR_HEIGHT / 2 + 15, 0, -CAR_HEIGHT / 2 + 35);
    windowGradient.addColorStop(0, '#34495e');
    windowGradient.addColorStop(0.5, '#2c3e50');
    windowGradient.addColorStop(1, '#1a252f');
    
    ctx.fillStyle = windowGradient;
    ctx.beginPath();
    ctx.moveTo(-15, -CAR_HEIGHT / 2 + 15);
    ctx.lineTo(-18, -CAR_HEIGHT / 2 + 35);
    ctx.lineTo(18, -CAR_HEIGHT / 2 + 35);
    ctx.lineTo(15, -CAR_HEIGHT / 2 + 15);
    ctx.closePath();
    ctx.fill();
    
    // Phản chiếu ánh sáng
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-12, -CAR_HEIGHT / 2 + 18);
    ctx.lineTo(-14, -CAR_HEIGHT / 2 + 28);
    ctx.lineTo(-8, -CAR_HEIGHT / 2 + 28);
    ctx.lineTo(-6, -CAR_HEIGHT / 2 + 18);
    ctx.closePath();
    ctx.fill();
  }

  // Vẽ đèn cảnh sát nhấp nháy
  drawPoliceLight(ctx, gameTimer, CAR_HEIGHT) {
    const blinkPhase = Math.floor(gameTimer / 10) % 2;
    
    if (blinkPhase === 0) {
      const blueGlow = ctx.createRadialGradient(-12, -20, 0, -12, -20, 15);
      blueGlow.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
      blueGlow.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
      blueGlow.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = blueGlow;
      ctx.beginPath();
      ctx.arc(-12, -20, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#3b82f6';
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(-12, -20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    if (blinkPhase === 1) {
      const redGlow = ctx.createRadialGradient(12, -20, 0, 12, -20, 15);
      redGlow.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      redGlow.addColorStop(0.5, 'rgba(239, 68, 68, 0.4)');
      redGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = redGlow;
      ctx.beginPath();
      ctx.arc(12, -20, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(12, -20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Vẽ cabin xe tải
  drawTruckCabin(ctx, speedBoosted, vehicleWidth, vehicleHeight) {
    const cabinGradient = ctx.createLinearGradient(-vehicleWidth / 2, -vehicleHeight / 2, vehicleWidth / 2, -vehicleHeight / 2);
    if (speedBoosted) {
      cabinGradient.addColorStop(0, '#991b1b');
      cabinGradient.addColorStop(0.5, '#dc2626');
      cabinGradient.addColorStop(1, '#991b1b');
    } else {
      cabinGradient.addColorStop(0, '#991eafff');
      cabinGradient.addColorStop(0.5, '#f63be6ff');
      cabinGradient.addColorStop(1, '#af1e97ff');
    }
    ctx.fillStyle = cabinGradient;
    ctx.beginPath();
    ctx.moveTo(0, -vehicleHeight / 2 - 20);
    ctx.lineTo(-vehicleWidth / 2 + 10, -vehicleHeight / 2 + 10);
    ctx.lineTo(-vehicleWidth / 2 + 10, -vehicleHeight / 2 + 40);
    ctx.lineTo(vehicleWidth / 2 - 10, -vehicleHeight / 2 + 40);
    ctx.lineTo(vehicleWidth / 2 - 10, -vehicleHeight / 2 + 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Vẽ kính cabin xe tải
  drawTruckWindow(ctx, vehicleWidth, vehicleHeight) {
    const windowGrad = ctx.createLinearGradient(0, -vehicleHeight / 2, 0, -vehicleHeight / 2 + 30);
    windowGrad.addColorStop(0, '#34495e');
    windowGrad.addColorStop(1, '#1a252f');
    ctx.fillStyle = windowGrad;
    ctx.fillRect(-vehicleWidth / 2 + 15, -vehicleHeight / 2 + 5, vehicleWidth - 30, 35);
  }

  // Vẽ 3 đèn LED trên kính cabin xe tải
  drawTruckLEDs(ctx, gameTimer, vehicleWidth, vehicleHeight) {
    const ledTimer = gameTimer;
    const blinkCycle = Math.floor(ledTimer / 30) % 2;
    const colorCycle = Math.floor(ledTimer / 90) % 3;
    
    const colors = [
      { rgb: [34, 197, 94], name: 'green' },
      { rgb: [59, 130, 246], name: 'blue' },
      { rgb: [234, 179, 8], name: 'yellow' }
    ];
    
    const currentColor = colors[colorCycle];
    const isLightOn = blinkCycle === 1;
    
    const windowWidth = vehicleWidth - 30;
    const windowCenterX = 0;
    const ledSpacing = windowWidth / 4;
    const ledPositions = [
      windowCenterX - ledSpacing,
      windowCenterX,
      windowCenterX + ledSpacing
    ];
    
    const yPos = -vehicleHeight / 2 + 5 + 35 / 2;
    const ledSize = 6;
    
    ledPositions.forEach((xPos) => {
      if (isLightOn) {
        const glow = ctx.createRadialGradient(xPos, yPos, 0, xPos, yPos, 18);
        glow.addColorStop(0, `rgba(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]}, 0.9)`);
        glow.addColorStop(0.5, `rgba(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]}, 0.5)`);
        glow.addColorStop(1, `rgba(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(xPos, yPos, 18, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = `rgb(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]})`;
        ctx.shadowColor = `rgb(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]})`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(xPos, yPos, ledSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(xPos, yPos, ledSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Vẽ LED strip cho xe tải
  drawTruckLEDStrip(ctx, gameTimer, vehicleWidth, vehicleHeight) {
    const lightProgress = (gameTimer * 0.1) % 1;
    const numLights = 12;
    
    for (let i = 0; i < numLights; i++) {
      const progress = (i / numLights + lightProgress) % 1;
      const yPos = -vehicleHeight / 2 + 30 + progress * (vehicleHeight - 35);
      const brightness = Math.sin(progress * Math.PI) * 0.8 + 0.2;
      const isRed = Math.floor((progress + lightProgress) * numLights) % 2 === 0;
      const colorRGB = isRed ? [239, 68, 68] : [59, 130, 246];
      
      for (let side of [-1, 1]) {
        const xPos = side * vehicleWidth / 2;
        const glow = ctx.createRadialGradient(xPos, yPos, 0, xPos, yPos, 12);
        glow.addColorStop(0, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness})`);
        glow.addColorStop(0.5, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness * 0.5})`);
        glow.addColorStop(1, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(xPos, yPos, 12, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        ctx.beginPath();
        ctx.arc(xPos, yPos, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Vẽ mũi kiếm
  drawSword(ctx, isTruck, vehicleHeight, swordVisible) {
    if (!swordVisible) return;

    const swordYStart = isTruck ? -vehicleHeight / 2 : -this.CAR_HEIGHT / 2;
    const swordGradient = ctx.createLinearGradient(
      0, swordYStart,
      0, swordYStart - this.SWORD_LENGTH
    );
    swordGradient.addColorStop(0, '#dc2626');
    swordGradient.addColorStop(0.5, '#ef4444');
    swordGradient.addColorStop(1, '#f87171');
    
    ctx.strokeStyle = swordGradient;
    ctx.lineWidth = isTruck ? 10 : 6;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, swordYStart);
    ctx.lineTo(0, swordYStart - this.SWORD_LENGTH + 8);
    ctx.stroke();

    // Lưỡi kiếm nhọn
    ctx.fillStyle = '#ff0404e0';
    ctx.strokeStyle = '#820909ff';
    ctx.lineWidth = isTruck ? 3 : 2;
    ctx.beginPath();
    const bladeWidth = isTruck ? 10 : 6;
    ctx.moveTo(0, swordYStart - this.SWORD_LENGTH);
    ctx.lineTo(-bladeWidth, swordYStart - this.SWORD_LENGTH + 12);
    ctx.lineTo(bladeWidth, swordYStart - this.SWORD_LENGTH + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Hiệu ứng phát sáng
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-1, -this.CAR_HEIGHT / 2 - this.SWORD_LENGTH + 2);
    ctx.lineTo(-4, -this.CAR_HEIGHT / 2 - this.SWORD_LENGTH + 10);
    ctx.lineTo(1, -this.CAR_HEIGHT / 2 - this.SWORD_LENGTH + 10);
    ctx.closePath();
    ctx.fill();
  }

  // Vẽ shadow xe
  drawShadow(ctx, vehicleWidth, vehicleHeight, isTruck) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, vehicleHeight / 2 + 5, vehicleWidth * 0.4, isTruck ? 15 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vẽ biểu tượng x2
  drawSpeedMultiplier(ctx, speedMultiplier) {
    if (speedMultiplier === 2) {
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillText('x2', 0, 10);
      ctx.shadowBlur = 0;
    }
  }

  // Hàm chính để vẽ xe
  draw(ctx, car, balloons, gameTimer, swordVisible, animalImages) {
    const isTruck = balloons.filter(b => b.alive).length > 10;
    const vehicleWidth = isTruck ? this.CAR_WIDTH * 2 : this.CAR_WIDTH;
    const vehicleHeight = isTruck ? this.CAR_HEIGHT * 2 : this.CAR_HEIGHT;

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Vẽ bóng đổ
    this.drawShadow(ctx, vehicleWidth, vehicleHeight, isTruck);

    // Vẽ xe
    if (isTruck) {
      this.drawTruck(ctx, car, gameTimer, car.speedMultiplier === 2, animalImages, vehicleWidth, vehicleHeight);
    } else {
      this.drawPoliceCar(ctx, car, gameTimer, car.speedMultiplier === 2);
    }

    // Vẽ mũi kiếm
    this.drawSword(ctx, isTruck, vehicleHeight, swordVisible);

    // Vẽ biểu tượng x2
    this.drawSpeedMultiplier(ctx, car.speedMultiplier);

    ctx.restore();
  }
}

export default CarRenderer;
