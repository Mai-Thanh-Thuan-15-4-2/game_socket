// Class quản lý hệ thống tên lửa
class RocketSystem {
  constructor() {
    this.rocket = null;
    this.rocketLaunched = false;
  }

  // Khởi tạo và bắn tên lửa mới
  launchRocket(car, targetBalloon, fakeTarget, aliveBalloons, CAR_WIDTH, CAR_HEIGHT, SWORD_LENGTH) {
    if (this.rocketLaunched) return false;

    // Tính toán vị trí mũi kiếm
    const isTruckForCalc = aliveBalloons.length > 10;
    const vehicleHeightForCalc = isTruckForCalc ? CAR_HEIGHT * 2 : CAR_HEIGHT;
    const swordTipX = car.x + Math.sin(car.angle) * (vehicleHeightForCalc / 2 + SWORD_LENGTH);
    const swordTipY = car.y - Math.cos(car.angle) * (vehicleHeightForCalc / 2 + SWORD_LENGTH);
    
    // Tạo waypoints thông minh - bay qua các bong bóng xa
    const referenceTarget = fakeTarget || targetBalloon;
    const targetAngle = Math.atan2(referenceTarget.y - swordTipY, referenceTarget.x - swordTipX);
    
    // Lọc các bong bóng khác (trừ cả mục tiêu thật và giả)
    const waypoints = [];
    const availableForWaypoints = aliveBalloons.filter(b => b !== targetBalloon && b !== fakeTarget);
    
    // Tính điểm cho mỗi bong bóng dựa trên khoảng cách và góc lệch
    const scoredBalloons = availableForWaypoints.map(balloon => {
      const balloonAngle = Math.atan2(balloon.y - swordTipY, balloon.x - swordTipX);
      let angleDiff = Math.abs(targetAngle - balloonAngle);
      
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      const distance = Math.sqrt(
        Math.pow(balloon.x - swordTipX, 2) + 
        Math.pow(balloon.y - swordTipY, 2)
      );
      
      const angleScore = angleDiff / Math.PI;
      const distanceScore = Math.min(distance / 600, 1);
      
      return {
        balloon,
        score: angleScore * 0.3 + distanceScore * 0.7,
        angle: balloonAngle,
        distance
      };
    });
    
    // Sắp xếp theo điểm và chọn 1-3 waypoints
    scoredBalloons.sort((a, b) => b.score - a.score);
    const numWaypoints = Math.min(1 + Math.floor(Math.random() * 3), scoredBalloons.length);
    
    // Thêm mục tiêu giả vào đầu danh sách waypoints (nếu có)
    if (fakeTarget) {
      waypoints.push({
        x: fakeTarget.x,
        y: fakeTarget.y,
        isFake: true
      });
      console.log('🎯 FAKE TARGET:', fakeTarget.name, 'at', {x: fakeTarget.x, y: fakeTarget.y});
    }
    
    // Thêm waypoints từ các bong bóng được chọn - ĐẢM BẢO KHOẢNG CÁCH TỐI THIỂU
    const minDistanceBetweenWaypoints = 50; // Giảm từ 60 xuống 50 để chọn nhiều hơn
    for (let i = 0; i < scoredBalloons.length && waypoints.length < numWaypoints + (fakeTarget ? 1 : 0); i++) {
      const candidate = scoredBalloons[i];
      
      // Kiểm tra khoảng cách với các waypoints đã có
      let tooClose = false;
      for (let j = 0; j < waypoints.length; j++) {
        const dist = Math.sqrt(
          Math.pow(candidate.balloon.x - waypoints[j].x, 2) + 
          Math.pow(candidate.balloon.y - waypoints[j].y, 2)
        );
        if (dist < minDistanceBetweenWaypoints) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        waypoints.push({
          x: candidate.balloon.x,
          y: candidate.balloon.y,
          isFake: false
        });
      }
    }
    
    console.log('🚀 REAL TARGET:', targetBalloon.name, 'at', {x: targetBalloon.x, y: targetBalloon.y});
    console.log('📍 Total waypoints:', waypoints.length, '(including fake target)');
    
    // Khởi tạo rocket
    this.rocket = {
      x: swordTipX,
      y: swordTipY,
      angle: car.angle,
      speed: 8,
      targetX: targetBalloon.x,
      targetY: targetBalloon.y,
      targetBalloon: targetBalloon,
      trail: [],
      phase: 'launch',
      launchTimer: 0,
      launchDuration: 30,
      loopRadius: 80,
      loopProgress: 0,
      loopSpeed: 0.02, // Giảm xuống 0.02 để bay mượt hơn
      loopCenter: null,
      loopStartAngle: 0,
      arcCurvature: 0.06, // Giảm từ 0.08 xuống 0.06 để bay cong hơn
      waypoints: waypoints,
      currentWaypointIndex: 0,
      flyTimer: 0,
      minFlyTime: 240, // Tăng từ 180 lên 240 frames (4 giây thay vì 3 giây)
      maxFlyTime: 300,
      returningToCar: false
    };
    
    this.rocketLaunched = true;
    return true;
  }

  // Cập nhật vị trí và trạng thái rocket
  update(balloons, car, gameTimer, swordVisible, animalImages, onHit, onTimeout) {
    if (!this.rocket) return;

    const rocket = this.rocket;
    rocket.flyTimer++;
    
    // Kiểm tra timeout 5 giây - chọn mục tiêu mới và bay tiếp
    if (rocket.flyTimer >= rocket.maxFlyTime && !rocket.returningToCar) {
      const aliveBalloons = balloons.filter(b => b.alive && !b.shield);
      if (aliveBalloons.length > 0) {
        const newTarget = aliveBalloons[Math.floor(Math.random() * aliveBalloons.length)];
        
        // Tính waypoints mới
        const candidates = [];
        aliveBalloons.forEach((balloon) => {
          if (balloon !== newTarget) {
            const dx = balloon.x - rocket.x;
            const dy = balloon.y - rocket.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const targetAngle = Math.atan2(newTarget.y - rocket.y, newTarget.x - rocket.x);
            let angleDiff = Math.abs(angle - targetAngle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            const angleScore = 1 - (angleDiff / Math.PI);
            const distanceScore = Math.min(distance / 500, 1);
            const score = angleScore * 0.3 + distanceScore * 0.7;
            candidates.push({ balloon, score });
          }
        });
        
        candidates.sort((a, b) => b.score - a.score);
        const numWaypoints = Math.min(Math.floor(Math.random() * 5) + 6, candidates.length);
        const newWaypoints = [];
        
        for (let i = 0; i < numWaypoints; i++) {
          newWaypoints.push({
            x: candidates[i].balloon.x,
            y: candidates[i].balloon.y,
            isFake: false
          });
        }
        
        rocket.waypoints = newWaypoints;
        rocket.currentWaypointIndex = 0;
        rocket.targetX = newTarget.x;
        rocket.targetY = newTarget.y;
        rocket.targetBalloon = newTarget;
        rocket.flyTimer = 0;
        rocket.phase = 'arc';
        rocket.returningToCar = false;
        
        // Callback khi timeout
        if (onTimeout) {
          onTimeout();
        }
      }
    }
    
    // Cập nhật trail
    rocket.trail.push({ x: rocket.x, y: rocket.y });
    if (rocket.trail.length > 30) rocket.trail.shift();
    
    // Phase 1: Launch - bay thẳng lên
    if (rocket.phase === 'launch') {
      rocket.launchTimer++;
      
      if (rocket.launchTimer < rocket.launchDuration) {
        // Bay thẳng theo hướng xe
        rocket.x += Math.sin(rocket.angle) * rocket.speed;
        rocket.y -= Math.cos(rocket.angle) * rocket.speed;
      } else {
        // Chuyển sang phase loop - tính tâm vòng loop
        const perpAngle = rocket.angle + Math.PI / 2;
        rocket.loopCenter = {
          x: rocket.x + Math.sin(perpAngle) * rocket.loopRadius,
          y: rocket.y - Math.cos(perpAngle) * rocket.loopRadius
        };
        rocket.loopStartAngle = Math.atan2(
          rocket.x - rocket.loopCenter.x,
          -(rocket.y - rocket.loopCenter.y)
        );
        rocket.loopProgress = 0;
        rocket.phase = 'loop';
      }
    }
    // Phase 2: Loop - vẽ vòng tròn hoàn chỉnh
    else if (rocket.phase === 'loop') {
      rocket.loopProgress += rocket.loopSpeed; // Sử dụng loopSpeed
      const loopAngle = rocket.loopProgress * Math.PI * 2;
      
      // Di chuyển trên vòng tròn
      const currentAngle = rocket.loopStartAngle + loopAngle;
      rocket.x = rocket.loopCenter.x + Math.sin(currentAngle) * rocket.loopRadius;
      rocket.y = rocket.loopCenter.y - Math.cos(currentAngle) * rocket.loopRadius;
      
      // Cập nhật góc rocket để tiếp tuyến với vòng tròn
      rocket.angle = currentAngle + Math.PI / 2;
      
      // Hoàn thành vòng loop (360 độ)
      if (rocket.loopProgress >= 1) {
        rocket.phase = 'arc';
      }
    }
    // Phase 3: Arc - bay vòng qua waypoints
    else if (rocket.phase === 'arc') {
      let targetX, targetY;
      
      if (rocket.waypoints && rocket.currentWaypointIndex < rocket.waypoints.length) {
        const currentWaypoint = rocket.waypoints[rocket.currentWaypointIndex];
        targetX = currentWaypoint.x;
        targetY = currentWaypoint.y;
      } else {
        if (rocket.flyTimer >= rocket.minFlyTime) {
          targetX = rocket.targetX;
          targetY = rocket.targetY;
        } else {
          const circleAngle = (rocket.flyTimer * 0.05) % (Math.PI * 2);
          targetX = rocket.targetX + Math.cos(circleAngle) * 150;
          targetY = rocket.targetY + Math.sin(circleAngle) * 150;
        }
      }
      
      const dx = targetX - rocket.x;
      const dy = targetY - rocket.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= 30) {
        if (rocket.waypoints && rocket.currentWaypointIndex < rocket.waypoints.length) {
          rocket.currentWaypointIndex++;
        } else if (rocket.flyTimer >= rocket.minFlyTime) {
          rocket.phase = 'homing';
        }
      } else {
        const targetAngle = Math.atan2(dx, -dy);
        let angleDiff = targetAngle - rocket.angle;
        
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        rocket.angle += Math.sign(angleDiff) * rocket.arcCurvature;
        rocket.x += Math.sin(rocket.angle) * rocket.speed;
        rocket.y -= Math.cos(rocket.angle) * rocket.speed;
      }
    }
    // Phase 3: Homing - bay thẳng về mục tiêu thật
    else if (rocket.phase === 'homing') {
      const dx = rocket.targetX - rocket.x;
      const dy = rocket.targetY - rocket.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 20) {
        if (onHit) {
          onHit(rocket.targetBalloon);
        }
        this.reset();
        return;
      }
      
      const targetAngle = Math.atan2(dx, -dy);
      let angleDiff = targetAngle - rocket.angle;
      
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      rocket.angle += Math.sign(angleDiff) * 0.15;
      rocket.x += Math.sin(rocket.angle) * rocket.speed;
      rocket.y -= Math.cos(rocket.angle) * rocket.speed;
    }
    
    // Kiểm tra va chạm với BẤT KỲ bong bóng nào (không chỉ mục tiêu)
    let hitBalloon = null;
    
    // NÉ TRÁNH các bong bóng KHÔNG phải target thật
    balloons.forEach(balloon => {
      if (!balloon.alive || balloon.shield || hitBalloon) return;
      
      const dx = balloon.x - rocket.x;
      const dy = balloon.y - rocket.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Kiểm tra xem có phải target thật không
      const isRealTarget = balloon === rocket.targetBalloon;
      
      // NÉ TRÁNH các balloon không phải target thật (bao gồm fake target và waypoints)
      if (!isRealTarget && (rocket.phase === 'arc' || rocket.phase === 'homing')) {
        // 50% tỷ lệ né tránh
        if (Math.random() < 0.5) {
          // Phát hiện từ xa và né mạnh
          if (distance < balloon.radius + 120 && distance > balloon.radius + 30) {
            const angleToBalloon = Math.atan2(dx, -dy);
            let angleDiff = angleToBalloon - rocket.angle;
            
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            // Tính độ mạnh né tránh (càng gần né càng mạnh)
            const dodgeStrength = Math.min((120 - (distance - balloon.radius)) / 120, 1);
            const dodgeAngle = 0.3 * dodgeStrength; // Tăng độ mạnh né
            
            // Né sang phía ngược lại
            const dodgeDirection = angleDiff > 0 ? -1 : 1;
            rocket.angle += dodgeDirection * dodgeAngle;
            
            // Giảm tốc khi né
            if (distance < balloon.radius + 60) {
              rocket.speed = Math.max(rocket.speed * 0.92, 5);
            }
          }
        }
      }
      
      // Với target thật - chỉ homing khi ở phase homing và rất gần
      if (isRealTarget && rocket.phase === 'homing' && distance < balloon.radius + 100) {
        const angleToTarget = Math.atan2(dx, -dy);
        let angleDiff = angleToTarget - rocket.angle;
        
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        rocket.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.2);
        rocket.speed = Math.min(rocket.speed * 1.05, 12);
      }
      
      // VA CHẠM - nổ khi chạm bất kỳ balloon nào
      if (distance < balloon.radius + 25) {
        hitBalloon = balloon;
        console.log('💥 BALLOON HIT:', balloon.name, 'at', {x: balloon.x, y: balloon.y});
        console.log('   Is Real Target?', isRealTarget);
        console.log('   Phase:', rocket.phase);
      }
    });
    
    // Nếu có va chạm, gọi callback và reset
    if (hitBalloon) {
      if (onHit) {
        onHit(hitBalloon);
      }
      this.reset();
    }
  }

  // Vẽ rocket
  draw(ctx) {
    if (!this.rocket) return;

    const rocket = this.rocket;
    
    // Vẽ trail của tên lửa với gradient
    if (rocket.trail.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      for (let i = 1; i < rocket.trail.length; i++) {
        const alpha = i / rocket.trail.length;
        const size = alpha * 5;
        
        ctx.strokeStyle = `rgba(255, 107, 53, ${alpha * 0.8})`;
        ctx.lineWidth = size;
        ctx.beginPath();
        ctx.moveTo(rocket.trail[i - 1].x, rocket.trail[i - 1].y);
        ctx.lineTo(rocket.trail[i].x, rocket.trail[i].y);
        ctx.stroke();
        
        // Hiệu ứng lửa đuôi
        if (i < 8) {
          ctx.strokeStyle = `rgba(255, 200, 50, ${(1 - i/8) * 0.6})`;
          ctx.lineWidth = size * 0.6;
          ctx.beginPath();
          ctx.moveTo(rocket.trail[i - 1].x, rocket.trail[i - 1].y);
          ctx.lineTo(rocket.trail[i].x, rocket.trail[i].y);
          ctx.stroke();
        }
      }
    }
    
    // Vẽ thân tên lửa
    ctx.save();
    ctx.translate(rocket.x, rocket.y);
    ctx.rotate(rocket.angle);
    
    // Bóng tên lửa
    ctx.shadowColor = 'rgba(255, 68, 68, 0.5)';
    ctx.shadowBlur = 10;
    
    // Thân tên lửa - gradient đỏ sang vàng
    const gradient = ctx.createLinearGradient(0, -15, 0, 15);
    gradient.addColorStop(0, '#ff4444');
    gradient.addColorStop(0.5, '#ff6b35');
    gradient.addColorStop(1, '#ffaa00');
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(6, -9);
    ctx.lineTo(6, 9);
    ctx.lineTo(3, 15);
    ctx.lineTo(-3, 15);
    ctx.lineTo(-6, 9);
    ctx.lineTo(-6, -9);
    ctx.closePath();
    ctx.fill();
    
    // Đường viền sáng
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(-4.5, -9);
    ctx.stroke();
    
    // Lửa đuôi - hiệu ứng ngọn lửa
    const flameSize = 12 + Math.random() * 9;
    const flameGradient = ctx.createLinearGradient(0, 15, 0, 15 + flameSize);
    flameGradient.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
    flameGradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.7)');
    flameGradient.addColorStop(1, 'rgba(255, 68, 68, 0)');
    
    ctx.fillStyle = flameGradient;
    ctx.beginPath();
    ctx.moveTo(-3, 15);
    ctx.lineTo(0, 15 + flameSize);
    ctx.lineTo(3, 15);
    ctx.closePath();
    ctx.fill();
    
    // Lửa đuôi thứ 2
    ctx.fillStyle = 'rgba(255, 255, 100, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-1.5, 15);
    ctx.lineTo(0, 15 + flameSize * 0.7);
    ctx.lineTo(1.5, 15);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Reset rocket
  reset() {
    this.rocket = null;
    this.rocketLaunched = false;
  }

  // Getter để kiểm tra trạng thái
  isActive() {
    return this.rocket !== null;
  }

  isLaunched() {
    return this.rocketLaunched;
  }
}

export default RocketSystem;
