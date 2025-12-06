import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw } from 'lucide-react';

const BalloonCarGame = () => {
  const canvasRef = useRef(null);
  const miniMapRef = useRef(null);
  const [gameState, setGameState] = useState('setup');
  const [players, setPlayers] = useState(['Người chơi 1', 'Người chơi 2']);
  const [newPlayer, setNewPlayer] = useState('');
  const [currentTurn, setCurrentTurn] = useState(0);
  const [winner, setWinner] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState(null);

  const randomNames = [
    'Sư Tử', 'Hổ', 'Gấu', 'Rồng', 'Phượng',
    'Sói', 'Cáo', 'Đại Bàng', 'Cá Mập', 'Báo',
    'Khỉ', 'Voi', 'Ngựa', 'Bò', 'Heo',
    'Gà', 'Chó', 'Mèo', 'Thỏ', 'Chuột',
    'Ninja', 'Samurai', 'Hiệp Sĩ', 'Phù Thủy', 'Chiến Binh',
    'Sát Thủ', 'Đấu Sĩ', 'Cung Thủ', 'Pháp Sư', 'Kiếm Sĩ'
  ];
  
  const gameRef = useRef({
    balloons: [],
    car: null,
    keys: {},
    animationId: null,
    camera: { x: 0, y: 0 },
    particles: []
  });

  const BALLOON_RADIUS = 30;
  const CAR_WIDTH = 50;
  const CAR_HEIGHT = 70;
  const SWORD_LENGTH = 40;

  useEffect(() => {
    if (gameState === 'playing') {
      initGame();
      gameLoop();
    }
    return () => {
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
      }
    };
  }, [gameState]);

  const initGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const alivePlayers = players.filter((_, i) => 
      !gameRef.current.balloons || gameRef.current.balloons[i]?.alive !== false
    );
    const arenaRadius = alivePlayers.length * BALLOON_RADIUS * 2 * 2;
    
    // Khởi tạo bong bóng ở vị trí ngẫu nhiên
    const balloons = alivePlayers.map((name, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = (Math.random() * 0.5 + 0.3) * arenaRadius;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        radius: BALLOON_RADIUS,
        name: name,
        alive: true,
        color: `hsl(${(360 * players.indexOf(name)) / players.length}, 70%, 60%)`
      };
    });

    // Khởi tạo xe
    const car = {
      x: 0,
      y: 0,
      angle: Math.random() * Math.PI * 2,
      speed: 0,
      maxSpeed: 5,
      acceleration: 0.3,
      friction: 0.95,
      rotationSpeed: 0.08,
      targetAngle: Math.random() * Math.PI * 2,
      changeDirectionTimer: 0,
      changeDirectionInterval: 60 + Math.random() * 120,
      isReversing: false,
      reverseTimer: 0,
      reverseDistance: 0,
      canMove: false
    };

    gameRef.current.balloons = balloons;
    gameRef.current.car = car;
    gameRef.current.camera = { x: 0, y: 0 };
    gameRef.current.particles = [];

    // Đếm ngược 3-2-1
    setCountdown(3);
    
    const countInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countInterval);
          setTimeout(() => {
            setCountdown(null);
            if (gameRef.current.car) {
              gameRef.current.car.canMove = true;
            }
          }, 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const gameLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { car, balloons, camera, particles } = gameRef.current;
    const alivePlayers = players.filter((_, i) => balloons[i]?.alive !== false);
    const arenaRadius = alivePlayers.length * BALLOON_RADIUS * 2 * 2;

    // Chỉ chạy khi được phép di chuyển
    if (!car.canMove) {
      car.speed = 0;
    } else if (!car.isReversing) {
      // Xe tự động chạy ngẫu nhiên
      car.changeDirectionTimer++;
      if (car.changeDirectionTimer >= car.changeDirectionInterval) {
        car.targetAngle = Math.random() * Math.PI * 2;
        car.changeDirectionInterval = 60 + Math.random() * 120;
        car.changeDirectionTimer = 0;
      }

      // Xoay xe về hướng mục tiêu
      let angleDiff = car.targetAngle - car.angle;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      if (Math.abs(angleDiff) > 0.05) {
        car.angle += Math.sign(angleDiff) * car.rotationSpeed;
      }

      // Tự động tiến về phía trước
      car.speed = 3;
    } else {
      // Đang lùi - lùi xa hơn
      car.reverseTimer++;
      car.speed = -3;
      car.reverseDistance += 3;
      
      // Lùi xa hơn (100 pixels thay vì 60)
      if (car.reverseDistance >= 100) {
        car.isReversing = false;
        car.reverseTimer = 0;
        car.reverseDistance = 0;
        // Chọn hướng ngẫu nhiên hoàn toàn mới
        car.targetAngle = Math.random() * Math.PI * 2;
      }
    }

    const oldX = car.x;
    const oldY = car.y;
    
    car.x += Math.sin(car.angle) * car.speed;
    car.y -= Math.cos(car.angle) * car.speed;

    // Giữ xe trong arena - nếu chạm tường thì lùi
    const distFromCenter = Math.sqrt(car.x * car.x + car.y * car.y);
    if (distFromCenter > arenaRadius - CAR_WIDTH / 2) {
      car.x = oldX;
      car.y = oldY;
      
      if (!car.isReversing) {
        car.isReversing = true;
        car.reverseTimer = 0;
      }
    }

    // Camera theo xe
    camera.x = car.x;
    camera.y = car.y;

    // Vị trí mũi kiếm
    const swordTipX = car.x + Math.sin(car.angle) * (CAR_HEIGHT / 2 + SWORD_LENGTH);
    const swordTipY = car.y - Math.cos(car.angle) * (CAR_HEIGHT / 2 + SWORD_LENGTH);

    // Cập nhật bong bóng
    balloons.forEach((balloon, i) => {
      if (!balloon.alive) return;

      // Kiểm tra va chạm với mũi kiếm
      const dx = swordTipX - balloon.x;
      const dy = swordTipY - balloon.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < balloon.radius) {
        balloon.alive = false;
        createExplosion(balloon.x, balloon.y, balloon.color);
        
        setTimeout(() => {
          nextTurn();
        }, 500);
        return;
      }

      // Va chạm với xe
      const carDx = car.x - balloon.x;
      const carDy = car.y - balloon.y;
      const carDist = Math.sqrt(carDx * carDx + carDy * carDy);

      if (carDist < balloon.radius + CAR_WIDTH / 2) {
        const angle = Math.atan2(carDy, carDx);
        const overlap = balloon.radius + CAR_WIDTH / 2 - carDist;
        balloon.x -= Math.cos(angle) * overlap;
        balloon.y -= Math.sin(angle) * overlap;
        
        balloon.vx -= Math.cos(angle) * car.speed * 0.5;
        balloon.vy -= Math.sin(angle) * car.speed * 0.5;
      }

      // Va chạm giữa các bong bóng
      balloons.forEach((other, j) => {
        if (i >= j || !other.alive) return;
        
        const dx = other.x - balloon.x;
        const dy = other.y - balloon.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < balloon.radius * 2) {
          const angle = Math.atan2(dy, dx);
          const overlap = balloon.radius * 2 - dist;
          
          balloon.x -= Math.cos(angle) * overlap / 2;
          balloon.y -= Math.sin(angle) * overlap / 2;
          other.x += Math.cos(angle) * overlap / 2;
          other.y += Math.sin(angle) * overlap / 2;
          
          const vx = (balloon.vx - other.vx) * 0.5;
          const vy = (balloon.vy - other.vy) * 0.5;
          balloon.vx -= vx;
          balloon.vy -= vy;
          other.vx += vx;
          other.vy += vy;
        }
      });

      // Cập nhật vị trí
      balloon.x += balloon.vx;
      balloon.y += balloon.vy;
      balloon.vx *= 0.98;
      balloon.vy *= 0.98;

      // Giữ bong bóng trong arena
      const bDist = Math.sqrt(balloon.x * balloon.x + balloon.y * balloon.y);
      if (bDist > arenaRadius - balloon.radius) {
        const angle = Math.atan2(balloon.y, balloon.x);
        balloon.x = Math.cos(angle) * (arenaRadius - balloon.radius);
        balloon.y = Math.sin(angle) * (arenaRadius - balloon.radius);
        balloon.vx *= -0.7;
        balloon.vy *= -0.7;
      }
    });

    // Cập nhật particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // Trọng lực
      p.life--;
      p.alpha -= 0.02;
      
      if (p.life <= 0 || p.alpha <= 0) {
        particles.splice(i, 1);
      }
    }

    // Vẽ
    draw(ctx, canvas.width, canvas.height, arenaRadius);
    drawMiniMap();

    gameRef.current.animationId = requestAnimationFrame(gameLoop);
  };

  const drawMiniMap = () => {
    const canvas = miniMapRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = 150;
    const { car, balloons } = gameRef.current;
    
    if (!balloons || balloons.length === 0 || !car) return;
    
    const alivePlayers = players.filter((_, i) => balloons[i]?.alive !== false);
    if (alivePlayers.length === 0) return;
    
    const arenaRadius = alivePlayers.length * BALLOON_RADIUS * 2 * 2;
    const scale = (size / 2 - 10) / arenaRadius;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);
    
    // Vẽ arena
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (size / 2) - 5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Vẽ bong bóng
    balloons.forEach(balloon => {
      if (!balloon.alive) return;
      ctx.fillStyle = balloon.color;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        size / 2 + balloon.x * scale,
        size / 2 + balloon.y * scale,
        5,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
    });
    
    // Vẽ xe với vị trí hiện tại
    ctx.save();
    ctx.translate(size / 2 + car.x * scale, size / 2 + car.y * scale);
    ctx.rotate(car.angle);
    
    // Thân xe
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-4, -6, 8, 12);
    
    // Mũi kiếm
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, -12);
    ctx.stroke();
    
    ctx.restore();
  };

  const createExplosion = (x, y, color) => {
    const { particles } = gameRef.current;
    
    // Tạo nhiều hạt văng ra
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const speed = 2 + Math.random() * 4;
      
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 5,
        color: color,
        alpha: 1,
        life: 60
      });
    }
  };

  const draw = (ctx, width, height, arenaRadius) => {
    const { car, balloons, camera, particles } = gameRef.current;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2 - camera.x, height / 2 - camera.y);

    // Vẽ arena
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Vẽ lưới
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = -arenaRadius; i <= arenaRadius; i += 100) {
      ctx.beginPath();
      ctx.moveTo(i, -arenaRadius);
      ctx.lineTo(i, arenaRadius);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-arenaRadius, i);
      ctx.lineTo(arenaRadius, i);
      ctx.stroke();
    }

    // Vẽ bong bóng
    balloons.forEach(balloon => {
      if (!balloon.alive) return;

      // Bóng
      ctx.fillStyle = balloon.color;
      ctx.beginPath();
      ctx.arc(balloon.x, balloon.y, balloon.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tên
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(balloon.name, balloon.x, balloon.y);

      // Dây bong bóng
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(balloon.x, balloon.y + balloon.radius);
      ctx.lineTo(balloon.x, balloon.y + balloon.radius + 10);
      ctx.stroke();
    });

    // Vẽ particles (hiệu ứng nổ)
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Vẽ xe
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Thân xe
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
    
    // Cửa sổ
    ctx.fillStyle = '#34495e';
    ctx.fillRect(-CAR_WIDTH / 2 + 5, -CAR_HEIGHT / 2 + 5, CAR_WIDTH - 10, 20);

    // Mũi kiếm
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -CAR_HEIGHT / 2);
    ctx.lineTo(0, -CAR_HEIGHT / 2 - SWORD_LENGTH);
    ctx.stroke();

    // Lưỡi kiếm
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.moveTo(0, -CAR_HEIGHT / 2 - SWORD_LENGTH);
    ctx.lineTo(-5, -CAR_HEIGHT / 2 - SWORD_LENGTH + 10);
    ctx.lineTo(5, -CAR_HEIGHT / 2 - SWORD_LENGTH + 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.restore();
  };

  const nextTurn = () => {
    const aliveBalloons = gameRef.current.balloons.filter(b => b.alive);
    
    if (aliveBalloons.length === 1) {
      setWinner(aliveBalloons[0].name);
      setGameState('ended');
      return;
    }

    // Chuyển sang màn mới
    setRound(prev => prev + 1);
    setCurrentTurn((currentTurn + 1) % aliveBalloons.length);
    
    // Reset game với số bong bóng còn lại
    setTimeout(() => {
      initGame();
    }, 500);
  };

  const startGame = () => {
    if (players.length < 2) {
      alert('Cần ít nhất 2 người chơi!');
      return;
    }
    setGameState('playing');
    setCurrentTurn(0);
    setWinner(null);
    setRound(1);
  };

  const resetGame = () => {
    setGameState('setup');
    setCurrentTurn(0);
    setWinner(null);
    setRound(1);
    setCountdown(null);
  };

  const addPlayer = () => {
    if (newPlayer.trim() && players.length < 10) {
      const name = newPlayer.trim().split(' ')[0]; // Chỉ lấy từ đầu tiên
      setPlayers([...players, name]);
      setNewPlayer('');
    }
  };

  const addRandomPlayer = () => {
    if (players.length >= 10) return;
    
    const availableNames = randomNames.filter(name => !players.includes(name));
    if (availableNames.length === 0) {
      alert('Đã hết tên ngẫu nhiên!');
      return;
    }
    
    const randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
    setPlayers([...players, randomName]);
  };

  const removePlayer = (index) => {
    if (players.length > 2) {
      setPlayers(players.filter((_, i) => i !== index));
    }
  };

  const startEditingPlayer = (index) => {
    setEditingIndex(index);
    setEditingName(players[index]);
  };

  const savePlayerName = () => {
    if (editingName.trim() && editingIndex !== null) {
      const newPlayers = [...players];
      const name = editingName.trim().split(' ')[0]; // Chỉ lấy từ đầu tiên
      newPlayers[editingIndex] = name;
      setPlayers(newPlayers);
    }
    setEditingIndex(null);
    setEditingName('');
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingName('');
  };

  if (gameState === 'setup') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
            🎈 Trò Chơi Bong Bóng 🚗
          </h1>
          
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Người chơi:</h2>
            <div className="space-y-2 mb-4">
              {players.map((player, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-100 p-3 rounded-lg">
                  {editingIndex === i ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && savePlayerName()}
                        className="flex-1 px-3 py-1 border-2 border-blue-500 rounded focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={savePlayerName}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{player}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditingPlayer(i)}
                          className="text-blue-500 hover:text-blue-700 px-2"
                        >
                          ✎
                        </button>
                        {players.length > 2 && (
                          <button
                            onClick={() => removePlayer(i)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {players.length < 10 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlayer}
                    onChange={(e) => setNewPlayer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                    placeholder="Nhập tên (1 từ)..."
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={addPlayer}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                  >
                    Thêm
                  </button>
                </div>
                <button
                  onClick={addRandomPlayer}
                  className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium flex items-center justify-center gap-2"
                >
                  🎲 Thêm Tên Ngẫu Nhiên
                </button>
              </div>
            )}
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
          >
            <Play size={24} />
            Bắt Đầu Chơi
          </button>

          <div className="mt-6 text-sm text-gray-600 space-y-1">
            <p>🚗 <strong>Xe tự động chạy ngẫu nhiên</strong></p>
            <p>⚔️ Dùng mũi kiếm để đâm bong bóng đối thủ!</p>
            <p>🎯 Người còn lại cuối cùng sẽ chiến thắng!</p>
            <p className="text-xs text-gray-500">💡 Tên chỉ 1 từ, ví dụ: "Rồng", "Ninja"</p>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'ended') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">🎉 Chiến Thắng! 🎉</h1>
          <p className="text-2xl font-semibold text-purple-600 mb-8">{winner}</p>
          <button
            onClick={resetGame}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={24} />
            Chơi Lại
          </button>
        </div>
      </div>
    );
  }

  const alivePlayers = gameRef.current.balloons?.filter(b => b.alive) || [];

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute inset-0"
      />
      
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-4 rounded-lg">
        <div className="text-sm mb-2">Lượt chơi:</div>
        <div className="text-xl font-bold">{alivePlayers[currentTurn]?.name || ''}</div>
        <div className="text-xs mt-2 text-gray-300">
          Còn lại: {alivePlayers.length} bong bóng
        </div>
      </div>

      {/* Mini Map */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-80 p-2 rounded-lg border-2 border-white">
        <canvas
          ref={miniMapRef}
          width={150}
          height={150}
          className="rounded"
        />
        <div className="text-white text-xs text-center mt-1">Mini Map</div>
      </div>

      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-9xl font-bold animate-pulse">
            {countdown === 0 ? 'BẮT ĐẦU!' : countdown}
          </div>
        </div>
      )}

      <div className="absolute top-4 right-20">
        <button
          onClick={resetGame}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <RotateCcw size={20} />
          Thoát
        </button>
      </div>

      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-sm">
        <div>🚗 Xe tự động chạy ngẫu nhiên</div>
        <div>⚔️ Đâm bong bóng để loại đối thủ</div>
      </div>
    </div>
  );
};

export default BalloonCarGame;