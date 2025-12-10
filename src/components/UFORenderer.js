// Class vẽ đĩa bay (UFO)
class UFORenderer {
  constructor() {
    this.UFO_RADIUS = 50;
  }

  // Vẽ đĩa bay
  draw(ctx, ufo) {
    if (!ufo) return;

    ctx.save();
    ctx.translate(ufo.x, ufo.y);
    ctx.rotate(ufo.angle);
    
    // Bóng đĩa bay
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, this.UFO_RADIUS * 0.3, this.UFO_RADIUS * 1.2, this.UFO_RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Phần dưới đĩa bay (đĩa chính)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.UFO_RADIUS);
    gradient.addColorStop(0, '#a0a0ff');
    gradient.addColorStop(0.5, '#6060ff');
    gradient.addColorStop(1, '#3030aa');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.UFO_RADIUS, this.UFO_RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Viền đĩa
    ctx.strokeStyle = '#8080ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Phần trên đĩa bay (cabin)
    const cabinGradient = ctx.createRadialGradient(0, -this.UFO_RADIUS * 0.3, 0, 0, -this.UFO_RADIUS * 0.3, this.UFO_RADIUS * 0.5);
    cabinGradient.addColorStop(0, '#80ffff');
    cabinGradient.addColorStop(0.6, '#4090ff');
    cabinGradient.addColorStop(1, '#2060aa');
    
    ctx.fillStyle = cabinGradient;
    ctx.beginPath();
    ctx.arc(0, -this.UFO_RADIUS * 0.3, this.UFO_RADIUS * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Viền cabin
    ctx.strokeStyle = '#60b0ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Đèn LED xung quanh đĩa
    const time = Date.now() * 0.005;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + time;
      const x = Math.cos(angle) * this.UFO_RADIUS * 0.85;
      const y = Math.sin(angle) * this.UFO_RADIUS * 0.34;
      
      const hue = (time * 50 + i * 45) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Ánh sáng phát ra
      ctx.globalAlpha = 0.4;
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
      glowGradient.addColorStop(0, `hsl(${hue}, 100%, 60%)`);
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    // Tia sáng hướng di chuyển (nếu đang di chuyển)
    if (ufo.speed > 1) {
      ctx.globalAlpha = 0.3 + Math.sin(time * 3) * 0.2;
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(0, this.UFO_RADIUS * 0.2);
      ctx.lineTo(-10, this.UFO_RADIUS * 1.5);
      ctx.lineTo(10, this.UFO_RADIUS * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    ctx.restore();
  }
}

export default UFORenderer;
