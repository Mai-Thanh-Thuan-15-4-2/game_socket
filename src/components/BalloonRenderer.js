// Component vẽ bong bóng
class BalloonRenderer {
  constructor(BALLOON_RADIUS) {
    this.BALLOON_RADIUS = BALLOON_RADIUS;
  }

  // Vẽ một bong bóng
  drawBalloon(ctx, balloon, index) {
    if (!balloon.alive) return;

    ctx.save();
    
    // Gradient cho bong bóng
    const gradient = ctx.createRadialGradient(
      balloon.x - balloon.radius * 0.3,
      balloon.y - balloon.radius * 0.3,
      balloon.radius * 0.1,
      balloon.x,
      balloon.y,
      balloon.radius
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.4, balloon.color);
    gradient.addColorStop(1, balloon.color);
    
    // Vẽ bóng chính
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(balloon.x, balloon.y, balloon.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Viền sáng
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Hiệu ứng bóng sáng
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(
      balloon.x - balloon.radius * 0.3,
      balloon.y - balloon.radius * 0.3,
      balloon.radius * 0.3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Vẽ khiên bảo vệ
    if (balloon.shield) {
      this.drawShield(ctx, balloon);
    }

    // Vẽ tên
    this.drawName(ctx, balloon);
    
    // Vẽ thanh máu
    this.drawHealthBar(ctx, balloon);

    // Vẽ dây bong bóng
    this.drawString(ctx, balloon, index);
    
    ctx.restore();
  }

  // Vẽ khiên bảo vệ
  drawShield(ctx, balloon) {
    const shieldRadius = balloon.radius + 8;
    const shieldAlpha = Math.max(0, 1 - balloon.shieldTime / 3);
    const shimmer = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
    
    // Khiên ngoài
    ctx.strokeStyle = `rgba(100, 200, 255, ${shieldAlpha * shimmer})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(balloon.x, balloon.y, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Khiên trong
    ctx.strokeStyle = `rgba(150, 220, 255, ${shieldAlpha * shimmer * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(balloon.x, balloon.y, shieldRadius - 3, 0, Math.PI * 2);
    ctx.stroke();
    
    // Hiệu ứng ánh sáng
    ctx.fillStyle = `rgba(100, 200, 255, ${shieldAlpha * 0.1})`;
    ctx.beginPath();
    ctx.arc(balloon.x, balloon.y, shieldRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Hiển thị thời gian còn lại
    const timeLeft = Math.max(0, 3 - balloon.shieldTime).toFixed(1);
    ctx.fillStyle = `rgba(100, 200, 255, ${shieldAlpha})`;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${timeLeft}s`, balloon.x, balloon.y - balloon.radius - 15);
  }

  // Vẽ tên bong bóng
  drawName(ctx, balloon) {
    ctx.fillStyle = '#000';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(balloon.name, balloon.x, balloon.y);
    ctx.shadowBlur = 0;
  }

  // Vẽ thanh máu
  drawHealthBar(ctx, balloon) {
    if (!balloon.health || !balloon.maxHealth) return;
    
    const barWidth = balloon.radius * 1.6;
    const barHeight = 8;
    const barX = balloon.x - barWidth / 2;
    const barY = balloon.y + balloon.radius + 20;
    
    // Background (màu đỏ)
    ctx.fillStyle = 'rgba(200, 50, 50, 0.8)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Health (màu xanh lá)
    const healthPercent = balloon.health / balloon.maxHealth;
    const healthWidth = barWidth * healthPercent;
    
    // Gradient cho thanh máu
    const healthGradient = ctx.createLinearGradient(barX, barY, barX + healthWidth, barY);
    if (healthPercent > 0.6) {
      healthGradient.addColorStop(0, '#00ff00');
      healthGradient.addColorStop(1, '#00cc00');
    } else if (healthPercent > 0.3) {
      healthGradient.addColorStop(0, '#ffff00');
      healthGradient.addColorStop(1, '#ffcc00');
    } else {
      healthGradient.addColorStop(0, '#ff6600');
      healthGradient.addColorStop(1, '#ff3300');
    }
    
    ctx.fillStyle = healthGradient;
    ctx.fillRect(barX, barY, healthWidth, barHeight);
    
    // Viền
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Text HP
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${balloon.health}/${balloon.maxHealth}`, balloon.x, barY + barHeight / 2);
    ctx.shadowBlur = 0;
  }

  // Vẽ dây bong bóng với hiệu ứng lắc lư
  drawString(ctx, balloon, index) {
    const time = Date.now() * 0.002;
    const swingX = Math.sin(time + index) * 3;
    
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(balloon.x, balloon.y + balloon.radius);
    
    const midX = balloon.x + swingX;
    const midY = balloon.y + balloon.radius + 8;
    ctx.quadraticCurveTo(midX, midY, balloon.x + swingX * 0.5, balloon.y + balloon.radius + 15);
    ctx.stroke();
    
    // Nút cuối dây
    ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.beginPath();
    ctx.arc(balloon.x + swingX * 0.5, balloon.y + balloon.radius + 15, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vẽ tất cả bong bóng
  drawAll(ctx, balloons) {
    balloons.forEach((balloon, index) => {
      this.drawBalloon(ctx, balloon, index);
    });
  }
}

export default BalloonRenderer;
