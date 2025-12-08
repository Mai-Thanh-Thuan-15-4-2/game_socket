import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Plus, Users, Eye, LogOut } from 'lucide-react';
import { io } from 'socket.io-client';
import './BalloonCarGame.css';
import pigImage from './images/pig.png';
import frogImage from './images/frog.png';
import bearImage from './images/bear.png';

const BalloonCarGame = () => {
  const canvasRef = useRef(null);
  const miniMapRef = useRef(null);
  const socketRef = useRef(null);
  const audioRef = useRef(null); // Ref cho nhạc nền
  const boomAudioRef = useRef(null); // Ref cho âm thanh boom
  const endAudioRef = useRef(null); // Ref cho âm thanh chiến thắng
  const laserAudioRef = useRef(null); // Ref cho âm thanh tên lửa
  const [gameState, setGameState] = useState('setup'); // Bỏ qua menu, vào setup luôn
  const [roomList, setRoomList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isHost, setIsHost] = useState(true); // Offline nên luôn là host
  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [players, setPlayers] = useState(['Vietnam', 'Thailand', 'Indonesia']);
  const [newPlayer, setNewPlayer] = useState('');
  const [currentTurn, setCurrentTurn] = useState(0);
  const [winner, setWinner] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]);
  const [showEliminated, setShowEliminated] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCarMoving, setIsCarMoving] = useState(false);
  const [cameraTarget, setCameraTarget] = useState('car'); // 'car' hoặc index của balloon
  const [continuousRocketMode, setContinuousRocketMode] = useState(false); // Chế độ bắn tên lửa liên tục

  const randomNames = [
    'Malaysia', 'Singapore', 'Philippines', 'Laos', 'Cambodia', 'Myanmar', 'Brunei',
    'China', 'Japan', 'Korea', 'India', 'Pakistan',
    'Bangladesh', 'SriLanka', 'Nepal', 'Bhutan', 'Maldives',
    'Russia', 'USA', 'UK', 'France', 'Germany',
    'Italy', 'Spain', 'Portugal', 'Brazil', 'Argentina', 'Australia', 'Canada', 'Mexico'
  ];
  
  const gameRef = useRef({
    balloons: [],
    car: null,
    keys: {},
    animationId: null,
    camera: { x: 0, y: 0 },
    particles: [],
    followCar: true,
    arenaRadius: 200,
    carTrail: [], // Quỹ đạo ảo của xe
    sparks: [], // Hạt lửa xẹt khi chạm tường
    audioStarted: false, // Flag để theo dõi âm thanh đã bắt đầu cho lượt này chưa
    gameTimer: 0, // Đếm thời gian chơi (tính bằng frame)
    speedBoosted: false, // Flag để kiểm tra đã tăng tốc chưa
    animalImages: [], // Mảng chứa 3 hình ảnh động vật
    rocket: null, // Tên lửa bắn ra từ mũi kiếm
    rocketLaunched: false, // Flag kiểm tra đã bắn tên lửa chưa
    swordVisible: true // Hiển thị thanh đao (tắt khi bắn rocket)
  });

  const BALLOON_RADIUS = 50;
  const CAR_WIDTH = 50;
  const CAR_HEIGHT = 70;
  const SWORD_LENGTH = 40;

  // Load 3 hình ảnh động vật
  useEffect(() => {
    const images = [
      { src: pigImage, name: 'pig' },
      { src: frogImage, name: 'frog' },
      { src: bearImage, name: 'bear' }
    ];
    
    let loadedCount = 0;
    const loadedImages = [];
    
    images.forEach((imgData, index) => {
      const img = new Image();
      img.src = imgData.src;
      img.onload = () => {
        loadedImages[index] = img;
        loadedCount++;
        if (loadedCount === images.length) {
          gameRef.current.animalImages = loadedImages;
        }
      };
    });
  }, []);

  // Khởi tạo audio
  useEffect(() => {
    try {
      // Audio sẽ được load random khi game bắt đầu
      
      // Khởi tạo âm thanh boom
      boomAudioRef.current = new Audio(require('./audio/boom.mp3'));
      boomAudioRef.current.volume = 1.0;
      
      // Khởi tạo âm thanh chiến thắng
      endAudioRef.current = new Audio(require('./audio/end.mp3'));
      endAudioRef.current.volume = 0.8;
      
      // Khởi tạo âm thanh tên lửa
      laserAudioRef.current = new Audio(require('./audio/laser.mp3'));
      laserAudioRef.current.volume = 0.6;
    } catch (err) {
      console.log('Failed to load audio:', err);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (boomAudioRef.current) {
        boomAudioRef.current = null;
      }
      if (endAudioRef.current) {
        endAudioRef.current = null;
      }
      if (laserAudioRef.current) {
        laserAudioRef.current = null;
      }
    };
  }, []);

  // Xử lý keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' && gameState === 'playing' && !gameRef.current.rocketLaunched) {
        event.preventDefault();
        
        const { car, balloons } = gameRef.current;
        if (!car || !balloons) return;
        
        // Tìm bong bóng gần nhất hoặc ngẫu nhiên
        const aliveBalloons = balloons.filter(b => b.alive && !b.shield);
        if (aliveBalloons.length === 0) return;
        
        const targetBalloon = aliveBalloons[Math.floor(Math.random() * aliveBalloons.length)];
        
        // Tính vị trí mũi kiếm trước để dùng cho waypoint calculation
        const isTruckForCalc = balloons.filter(b => b.alive).length > 10;
        const vehicleHeightForCalc = isTruckForCalc ? CAR_HEIGHT * 2 : CAR_HEIGHT;
        const swordTipX = car.x + Math.sin(car.angle) * (vehicleHeightForCalc / 2 + SWORD_LENGTH);
        const swordTipY = car.y - Math.cos(car.angle) * (vehicleHeightForCalc / 2 + SWORD_LENGTH);
        
        // Tạo waypoints thông minh - chọn bong bóng ở phía đối diện để tạo vòng cung dài nhất
        // Tính góc từ vị trí hiện tại đến mục tiêu
        const targetAngle = Math.atan2(targetBalloon.y - swordTipY, targetBalloon.x - swordTipX);
        
        // Lọc các bong bóng khác và tính góc lệch
        const waypoints = [];
        const availableForWaypoints = aliveBalloons.filter(b => b !== targetBalloon);
        
        // Tính điểm cho mỗi bong bóng dựa trên khoảng cách và góc lệch
        const scoredBalloons = availableForWaypoints.map(balloon => {
          const balloonAngle = Math.atan2(balloon.y - swordTipY, balloon.x - swordTipX);
          let angleDiff = Math.abs(targetAngle - balloonAngle);
          
          // Chuẩn hóa góc lệch
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          
          const distance = Math.sqrt(
            Math.pow(balloon.x - swordTipX, 2) + 
            Math.pow(balloon.y - swordTipY, 2)
          );
          
          // ƪu tiên bong bóng ở góc lệch lớn (90-180 độ) và xa
          const angleScore = angleDiff / Math.PI; // 0-1, cao hơn = góc lệch lớn hơn
          const distanceScore = distance / 1000; // Chuẩn hóa khoảng cách
          
          return {
            balloon,
            score: angleScore * 0.7 + distanceScore * 0.3, // Ưu tiên góc lệch
            angle: balloonAngle,
            distance
          };
        });
        
        // Sắp xếp theo điểm và chọn 2-3 waypoints tốt nhất
        scoredBalloons.sort((a, b) => b.score - a.score);
        const numWaypoints = Math.min(2 + Math.floor(Math.random() * 2), scoredBalloons.length);
        
        for (let i = 0; i < numWaypoints; i++) {
          waypoints.push({
            x: scoredBalloons[i].balloon.x, 
            y: scoredBalloons[i].balloon.y
          });
        }
        
        console.log('Calculated waypoints with max arc distance:', waypoints.length);
        
        // Dừng xe lại
        car.speed = 0;
        car.canMove = false;
        
        // Sử dụng lại swordTipX, swordTipY đã tính ở trên
        gameRef.current.rocket = {
          x: swordTipX,
          y: swordTipY,
          targetX: targetBalloon.x,
          targetY: targetBalloon.y,
          waypoints: waypoints, // Danh sách điểm qua
          currentWaypointIndex: 0, // Đang bay đến waypoint nào
          speed: 10, // Tăng tốc độ
          angle: car.angle, // Bắn thẳng theo hướng xe
          initialAngle: car.angle, // Lưu hướng xe ban đầu
          trail: [],
          phase: 'launch', // 'launch', 'loop', 'arc', hoặc 'homing'
          launchDistance: 0, // Khoảng cách bay thẳng
          maxLaunchDistance: 150, // Bay thẳng 150px rồi mới vòng
          loopAngle: 0, // Góc đã quay trong vòng loop
          loopRadius: 60, // Bán kính vòng loop
          loopCenter: null, // Tâm vòng loop
          loopSpeed: 0.12, // Tốc độ quay vòng (rad/frame)
          arcCurvature: 0.08 // Độ cong của quỹ đạo
        };
        
        gameRef.current.rocketLaunched = true;
        gameRef.current.swordVisible = false; // Ẩn thanh đao khi bắn tên lửa
        
        // Phát âm thanh tên lửa
        if (laserAudioRef.current) {
          laserAudioRef.current.currentTime = 0;
          laserAudioRef.current.play().catch(err => console.log('Laser audio play failed:', err));
        }
        
        console.log('Manual rocket launched at balloon:', targetBalloon.name);
        console.log('Rocket created:', gameRef.current.rocket);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState]);

  // Kết nối socket - TẮT TẠM THỜI
  useEffect(() => {
    // TẮT SOCKET - CHẠY OFFLINE
    console.log('Socket disabled - running in offline mode');
    
    /* COMMENT TẠM THỜI - BẬT LẠI KHI CẦN MULTIPLAYER
    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
    socketRef.current = io(SOCKET_URL);
    
    socketRef.current.on('connect', () => {
      console.log('Connected to server');
    });

    socketRef.current.on('roomList', (rooms) => {
      setRoomList(rooms);
    });

    socketRef.current.on('roomCreated', ({ roomId, roomInfo }) => {
      setCurrentRoom(roomInfo);
      setIsHost(true);
      setGameState('setup');
    });

    socketRef.current.on('joinedRoom', ({ roomInfo, gameState: serverGameState }) => {
      setCurrentRoom(roomInfo);
      setIsHost(false);
      if (serverGameState.isPlaying) {
        setGameState('watching');
        // Khởi tạo game state từ server
        if (serverGameState.balloons) {
          gameRef.current.balloons = serverGameState.balloons;
        }
        if (serverGameState.car) {
          gameRef.current.car = serverGameState.car;
        }
        if (serverGameState.currentTurn !== undefined) {
          setCurrentTurn(serverGameState.currentTurn);
        }
        if (serverGameState.arenaRadius) {
          gameRef.current.arenaRadius = serverGameState.arenaRadius;
        }
        // Khởi tạo camera
        if (!gameRef.current.camera) {
          gameRef.current.camera = { x: 0, y: 0 };
        }
        if (!gameRef.current.particles) {
          gameRef.current.particles = [];
        }
        if (!gameRef.current.carTrail) {
          gameRef.current.carTrail = [];
        }
      } else {
        setGameState('setup');
      }
    });

    socketRef.current.on('gameStateUpdated', (serverGameState) => {
      if (!isHost) {
        // Cập nhật game state từ server cho người xem
        if (serverGameState.balloons) {
          gameRef.current.balloons = serverGameState.balloons;
        }
        if (serverGameState.car) {
          gameRef.current.car = serverGameState.car;
        }
        if (serverGameState.currentTurn !== undefined) {
          setCurrentTurn(serverGameState.currentTurn);
        }
        if (serverGameState.arenaRadius) {
          gameRef.current.arenaRadius = serverGameState.arenaRadius;
        }
        if (serverGameState.countdown !== undefined && serverGameState.countdown !== null) {
          setCountdown(serverGameState.countdown);
        }
        if (serverGameState.winner) {
          setWinner(serverGameState.winner);
          setGameState('ended');
        }
        if (serverGameState.isPlaying === false && gameState === 'watching') {
          setGameState('ended');
        }
      }
    });

    socketRef.current.on('playerJoined', ({ player }) => {
      console.log('Player joined:', player);
    });

    socketRef.current.on('playerLeft', ({ playerId }) => {
      console.log('Player left:', playerId);
    });

    socketRef.current.on('roomClosed', ({ roomId }) => {
      if (currentRoom && currentRoom.roomId === roomId) {
        alert('Phòng đã đóng');
        setGameState('menu');
        setCurrentRoom(null);
      }
    });
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gameState === 'playing' || gameState === 'watching') {
      if (gameState === 'playing') {
        initGame();
      }
      // Đảm bảo audio được khởi tạo cho cả viewer
      if (!audioRef.current) {
        try {
          // Random với tỉ lệ: music_man 40%, music_car 30%, rumba 30%
          const rand = Math.random();
          if (rand < 0.4) {
            audioRef.current = new Audio(require('./audio/music_man.mp3'));
          } else if (rand < 0.7) {
            audioRef.current = new Audio(require('./audio/music_car.mp3'));
          } else {
            audioRef.current = new Audio(require('./audio/rumba.mp3'));
          }
          audioRef.current.loop = true;
          audioRef.current.volume = 0.5;
        } catch (err) {
          console.log('Failed to load audio:', err);
        }
      }
      gameLoop();
    }
    return () => {
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
      }
    };
    // eslint-disable-next-line
  }, [gameState]);

  // Countdown logic - chạy cho cả host và viewer
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const countInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 0) {
            clearInterval(countInterval);
            return null;
          }
          const newValue = prev - 1;
          if (newValue === 0) {
            // Khi đếm về 0, đợi 1 giây rồi cho xe chạy và RESET khiên về 0 để bắt đầu đếm
            setTimeout(() => {
              setCountdown(null);
              if (gameRef.current.car) {
                gameRef.current.car.canMove = true;
                setIsCarMoving(true); // Cập nhật state
              }
              // Reset thời gian khiên về 0 để bắt đầu đếm khi xe chạy
              if (gameRef.current.balloons) {
                gameRef.current.balloons.forEach(balloon => {
                  balloon.shield = true;
                  balloon.shieldTime = 0; // Reset về 0 để bắt đầu đếm
                });
              }
            }, 1000);
          }
          return newValue;
        });
      }, 1000);
      
      return () => clearInterval(countInterval);
    }
  }, [countdown]);

  const initGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Lấy danh sách bong bóng còn sống từ lượt trước (nếu có)
    const previousBalloons = gameRef.current.balloons || [];
    let alivePlayers;
    
    if (previousBalloons.length === 0) {
      // Lần đầu tiên - tất cả người chơi
      alivePlayers = [...players];
    } else {
      // Lấy những người còn bong bóng sống
      alivePlayers = previousBalloons.filter(b => b.alive).map(b => b.name);
    }
    
    const arenaRadius = alivePlayers.length * BALLOON_RADIUS * 2;
    
    // Khởi tạo bong bóng ở vị trí ngẫu nhiên
    const balloons = alivePlayers.map((name, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = (Math.random() * 0.5 + 0.3) * arenaRadius;
      
      // Mỗi bong bóng có tốc độ drift khác nhau (một số đứng yên, một số di chuyển nhiều)
      const driftSpeed = Math.random() < 0.3 ? 0 : Math.random() * 0.5 + 0.2; // 30% không di chuyển
      const driftPattern = Math.random() * 10; // Pattern khác nhau cho mỗi bong bóng
      
      // Tính màu dựa trên vị trí trong danh sách players gốc để đảm bảo mỗi người có màu riêng
      const originalIndex = players.indexOf(name);
      const hue = (360 * originalIndex) / players.length;
      
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        radius: BALLOON_RADIUS,
        name: name,
        alive: true,
        color: `hsl(${hue}, 70%, 60%)`,
        driftSpeed: driftSpeed,
        driftPattern: driftPattern,
        shield: true, // Khiên bảo vệ 3 giây
        shieldTime: 0 // Thời gian khiên đã tồn tại
      };
    });

    // Khởi tạo xe - ĐẶT VỀ GIỮA ARENA
    const car = {
      x: 0, // Reset về giữa
      y: 0, // Reset về giữa
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
      canMove: false,
      speedMultiplier: 1, // Hệ số tốc độ (x1 hoặc x2)
    };

    gameRef.current.balloons = balloons;
    gameRef.current.car = car;
    gameRef.current.camera = { x: 0, y: 0 }; // Reset camera về giữa
    gameRef.current.particles = [];
    gameRef.current.carTrail = []; // Reset quỹ đạo xe
    gameRef.current.followCar = true;
    gameRef.current.arenaRadius = arenaRadius; // Lưu kích thước arena cho lượt chơi này
    gameRef.current.audioStarted = false; // Reset flag âm thanh cho lượt mới
    gameRef.current.gameTimer = 0; // Reset timer
    gameRef.current.speedBoosted = false; // Reset speed boost flag
    gameRef.current.cameraTarget = 'car'; // Reset camera target về xe
    gameRef.current.rocket = null; // Reset tên lửa
    gameRef.current.rocketLaunched = false; // Reset flag bắn tên lửa
    gameRef.current.swordVisible = true; // Phục hồi thanh đao
    setCameraTarget('car'); // Reset state camera target

    // Đếm ngược 3-2-1 (logic countdown được xử lý trong useEffect riêng)
    setCountdown(3);
  };

  const gameLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { car, balloons, camera, particles, arenaRadius } = gameRef.current;

    // Kiểm tra xem có đủ dữ liệu không
    if (!balloons || balloons.length === 0 || !car) {
      gameRef.current.animationId = requestAnimationFrame(gameLoop);
      return;
    }

    // Nếu đang xem (không phải host), chỉ vẽ không cập nhật logic
    if (gameState === 'watching' && !isHost) {
      draw(ctx, canvas.width, canvas.height, arenaRadius);
      drawMiniMap();
      gameRef.current.animationId = requestAnimationFrame(gameLoop);
      return;
    }

    // Chỉ chạy khi được phép di chuyển (chỉ áp dụng cho host)
    
    // Cập nhật tên lửa nếu đã bắn (luôn chạy bất kể trạng thái xe)
    if (gameRef.current.rocket) {
      const rocket = gameRef.current.rocket;
      
      // Kiểm tra va chạm với bong bóng trong tất cả các phase
      let hitBalloon = false;
      balloons.forEach((balloon, index) => {
        if (balloon.alive) {
          const bdx = balloon.x - rocket.x;
          const bdy = balloon.y - rocket.y;
          const bDistance = Math.sqrt(bdx * bdx + bdy * bdy);
          
          if (bDistance < balloon.radius + 25) {
            hitBalloon = true;
            balloon.alive = false;
            createExplosion(balloon.x, balloon.y, balloon.color);
            setEliminatedPlayers(prev => [...prev, balloon.name]);
            
            if (boomAudioRef.current) {
              boomAudioRef.current.currentTime = 0;
              boomAudioRef.current.play().catch(err => console.log('Boom audio play failed:', err));
            }
            
            console.log('Rocket hit balloon:', balloon.name);
          }
        }
      });
      
      if (hitBalloon) {
        // Nổ tên lửa khi chạm bong bóng
        gameRef.current.explosionLocation = {x: rocket.x, y: rocket.y};
        createExplosion(rocket.x, rocket.y, '#ff4444');
        gameRef.current.rocket = null;
        gameRef.current.rocketLaunched = false;
        
        // Nếu ở chế độ continuous, cho phép bắn tiếp và phục hồi thanh đao
        if (continuousRocketMode) {
          setTimeout(() => {
            gameRef.current.explosionLocation = null;
            gameRef.current.swordVisible = true; // Phục hồi thanh đao
          }, 1000);
          console.log('Rocket exploded, ready for next launch (continuous mode)');
        } else {
          // Chế độ bình thường - qua ván mới
          setTimeout(() => {
            gameRef.current.explosionLocation = null;
            nextTurn();
          }, 2000);
          console.log('Rocket exploded on collision, checking game end');
        }
      } else {
        // Di chuyển tên lửa theo phase
        if (rocket.phase === 'launch') {
          // Phase 1: Bắn thẳng theo hướng xe
          rocket.x += Math.sin(rocket.angle) * rocket.speed;
          rocket.y -= Math.cos(rocket.angle) * rocket.speed;
          rocket.launchDistance += rocket.speed;
          
          // Chuyển sang phase loop sau khi bay đủ khoảng cách
          if (rocket.launchDistance >= rocket.maxLaunchDistance) {
            // Tính tâm vòng loop - ở bên phải hướng bay (vuông góc với hướng xe)
            // Sử dụng hệ tọa độ xe: sin(angle) cho x, -cos(angle) cho y
            const perpAngle = rocket.angle + Math.PI / 2;
            rocket.loopCenter = {
              x: rocket.x + Math.sin(perpAngle) * rocket.loopRadius,
              y: rocket.y - Math.cos(perpAngle) * rocket.loopRadius
            };
            // Lưu góc bắt đầu loop (từ tâm đến vị trí hiện tại)
            rocket.loopStartAngle = Math.atan2(
              rocket.x - rocket.loopCenter.x,
              -(rocket.y - rocket.loopCenter.y)
            );
            rocket.loopAngle = 0;
            rocket.phase = 'loop';
            console.log('Rocket switching to loop mode, center:', rocket.loopCenter);
          }
        } else if (rocket.phase === 'loop') {
          // Phase 2: Bay vòng tròn (looping)
          rocket.loopAngle += rocket.loopSpeed;
          
          // Tính vị trí trên vòng tròn - giữ nguyên startAngle
          const currentAngle = rocket.loopStartAngle + rocket.loopAngle;
          
          // Chuyển từ góc về tọa độ (sử dụng hệ tọa độ xe)
          rocket.x = rocket.loopCenter.x + Math.sin(currentAngle) * rocket.loopRadius;
          rocket.y = rocket.loopCenter.y - Math.cos(currentAngle) * rocket.loopRadius;
          
          // Cập nhật góc rocket để luôn tiếp tuyến với vòng tròn
          // Trong hệ tọa độ xe, tiếp tuyến = góc vị trí + 90° (PI/2)
          rocket.angle = currentAngle + Math.PI / 2;
          
          // Hoàn thành vòng loop (360 độ)
          if (rocket.loopAngle >= Math.PI * 2) {
            rocket.phase = 'arc';
            console.log('Rocket completed loop, switching to arc mode');
          }
        } else if (rocket.phase === 'arc') {
          // Phase 2: Bay vòng cung qua các waypoints
          let targetX, targetY;
          
          if (rocket.waypoints && rocket.currentWaypointIndex < rocket.waypoints.length) {
            // Bay đến waypoint hiện tại
            const currentWaypoint = rocket.waypoints[rocket.currentWaypointIndex];
            targetX = currentWaypoint.x;
            targetY = currentWaypoint.y;
          } else {
            // Hết waypoints, bay đến mục tiêu cuối
            targetX = rocket.targetX;
            targetY = rocket.targetY;
          }
          
          const dx = targetX - rocket.x;
          const dy = targetY - rocket.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Kiểm tra đến waypoint hoặc mục tiêu
          if (distance <= 30) {
            if (rocket.waypoints && rocket.currentWaypointIndex < rocket.waypoints.length) {
              // Chuyển sang waypoint tiếp theo
              rocket.currentWaypointIndex++;
              console.log('Reached waypoint, moving to next:', rocket.currentWaypointIndex);
            } else {
              // Đến mục tiêu cuối, chuyển sang homing
              rocket.phase = 'homing';
              console.log('Reached final target area, switching to homing');
            }
          } else {
            // Bay theo quỹ đạo vòng cung với hệ tọa độ xe
            // Tính góc mục tiêu theo hệ tọa độ xe
            const targetAngle = Math.atan2(dx, -dy);
            let angleDiff = targetAngle - rocket.angle;
            
            // Chuẩn hóa góc
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            // Xoay dần theo quỹ đạo vòng cung
            rocket.angle += Math.sign(angleDiff) * rocket.arcCurvature;
            
            // Di chuyển theo hướng hiện tại (hệ tọa độ xe)
            rocket.x += Math.sin(rocket.angle) * rocket.speed;
            rocket.y -= Math.cos(rocket.angle) * rocket.speed;
          }
        } else if (rocket.phase === 'homing') {
          // Phase 3: Homing về mục tiêu cuối cùng
          const dx = rocket.targetX - rocket.x;
          const dy = rocket.targetY - rocket.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= 5) {
            // Đến mục tiêu, nổ
            gameRef.current.explosionLocation = {x: rocket.x, y: rocket.y};
            createExplosion(rocket.x, rocket.y, '#ff4444');
            gameRef.current.rocket = null;
            gameRef.current.rocketLaunched = false;
            
            if (continuousRocketMode) {
              setTimeout(() => {
                gameRef.current.explosionLocation = null;
                gameRef.current.swordVisible = true;
              }, 1000);
              console.log('Rocket reached final target (continuous mode)');
            } else {
              setTimeout(() => {
                gameRef.current.explosionLocation = null;
                nextTurn();
              }, 2000);
              console.log('Rocket reached final target, exploding');
            }
          } else {
            // Tiếp tục bay vòng cung về mục tiêu (hệ tọa độ xe)
            const targetAngle = Math.atan2(dx, -dy);
            let angleDiff = targetAngle - rocket.angle;
            
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            rocket.angle += Math.sign(angleDiff) * rocket.arcCurvature;
            
            rocket.x += Math.sin(rocket.angle) * rocket.speed;
            rocket.y -= Math.cos(rocket.angle) * rocket.speed;
          }
        }
      }
      
      // Cập nhật trail
      rocket.trail.push({x: rocket.x, y: rocket.y});
      if (rocket.trail.length > 50) {
        rocket.trail.shift();
      }
    }
    
    if (!car.canMove) {
      car.speed = 0;
    } else if (car.isReversing) {
      // Đang lùi - lùi xa hơn (áp dụng speedMultiplier)
      car.reverseTimer++;
      car.speed = -3 * (car.speedMultiplier || 1);
      car.reverseDistance += 3;
      
      // Lùi xa hơn (100 pixels thay vì 60)
      if (car.reverseDistance >= 100) {
        car.isReversing = false;
        car.reverseTimer = 0;
        car.reverseDistance = 0;
        // Chọn hướng ngẫu nhiên hoàn toàn mới
        car.targetAngle = Math.random() * Math.PI * 2;
      }
    } else {
      // Reset và phát nhạc khi xe bắt đầu chạy lần đầu trong lượt này
      if (audioRef.current && !gameRef.current.audioStarted) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.log('Audio play failed:', err));
        gameRef.current.audioStarted = true; // Đánh dấu đã phát âm thanh cho lượt này
      }
      
      // Tăng timer (60 fps = 1 giây sau 60 frames)
      gameRef.current.gameTimer++;
      
      // Sau 30 giây (1800 frames), tăng tốc xe lên x2
      if (gameRef.current.gameTimer >= 1800 && !gameRef.current.speedBoosted) {
        car.speedMultiplier = 2;
        gameRef.current.speedBoosted = true;
        console.log('Speed boost activated! Car speed x2');
      }
      
      // Sau 50 giây (3000 frames), dừng xe và bắn tên lửa vào bong bóng ngẫu nhiên
      if (gameRef.current.gameTimer >= 3000 && !gameRef.current.rocketLaunched) {
        const aliveBalloons = balloons.filter(b => b.alive && !b.shield);
        if (aliveBalloons.length > 0) {
          const targetBalloon = aliveBalloons[Math.floor(Math.random() * aliveBalloons.length)];
          
          // Tạo waypoints thông minh - chọn bong bóng tạo vòng cung dài nhất
          const isTruck = balloons.filter(b => b.alive).length > 10;
          const vehicleHeight = isTruck ? CAR_HEIGHT * 2 : CAR_HEIGHT;
          const swordTipX = car.x + Math.sin(car.angle) * (vehicleHeight / 2 + SWORD_LENGTH);
          const swordTipY = car.y - Math.cos(car.angle) * (vehicleHeight / 2 + SWORD_LENGTH);
          
          const targetAngle = Math.atan2(targetBalloon.y - swordTipY, targetBalloon.x - swordTipX);
          
          const waypoints = [];
          const availableForWaypoints = aliveBalloons.filter(b => b !== targetBalloon);
          
          const scoredBalloons = availableForWaypoints.map(balloon => {
            const balloonAngle = Math.atan2(balloon.y - swordTipY, balloon.x - swordTipX);
            let angleDiff = Math.abs(targetAngle - balloonAngle);
            
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
            
            const distance = Math.sqrt(
              Math.pow(balloon.x - swordTipX, 2) + 
              Math.pow(balloon.y - swordTipY, 2)
            );
            
            const angleScore = angleDiff / Math.PI;
            const distanceScore = distance / 1000;
            
            return {
              balloon,
              score: angleScore * 0.7 + distanceScore * 0.3,
              angle: balloonAngle,
              distance
            };
          });
          
          scoredBalloons.sort((a, b) => b.score - a.score);
          const numWaypoints = Math.min(2 + Math.floor(Math.random() * 2), scoredBalloons.length);
          
          for (let i = 0; i < numWaypoints; i++) {
            waypoints.push({
              x: scoredBalloons[i].balloon.x, 
              y: scoredBalloons[i].balloon.y
            });
          }
          
          // Dừng xe lại
          car.speed = 0;
          car.canMove = false;
          
          // Sử dụng lại swordTipX, swordTipY đã tính ở trên
          gameRef.current.rocket = {
            x: swordTipX,
            y: swordTipY,
            targetX: targetBalloon.x,
            targetY: targetBalloon.y,
            waypoints: waypoints,
            currentWaypointIndex: 0,
            speed: 10,
            angle: car.angle,
            initialAngle: car.angle,
            trail: [],
            phase: 'launch',
            launchDistance: 0,
            maxLaunchDistance: 150,
            loopAngle: 0,
            loopRadius: 60,
            loopCenter: null,
            loopSpeed: 0.12,
            arcCurvature: 0.08
          };
          
          gameRef.current.rocketLaunched = true;
          gameRef.current.swordVisible = false; // Ẩn thanh đao
          
          // Phát âm thanh tên lửa
          if (laserAudioRef.current) {
            laserAudioRef.current.currentTime = 0;
            laserAudioRef.current.play().catch(err => console.log('Laser audio play failed:', err));
          }
          
          console.log('Rocket launched at balloon:', targetBalloon.name);
        }
      }

      // Xe tự động chạy ngẫu nhiên (chỉ khi không có tên lửa và xe được phép di chuyển)
      if (!gameRef.current.rocket && car.canMove) {
        car.changeDirectionTimer++;
        if (car.changeDirectionTimer >= car.changeDirectionInterval) {
          car.targetAngle = Math.random() * Math.PI * 2;
          car.changeDirectionInterval = 60 + Math.random() * 120;
          car.changeDirectionTimer = 0;
        }
      }

      // Xoay xe về hướng mục tiêu
      let angleDiff = car.targetAngle - car.angle;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      if (Math.abs(angleDiff) > 0.05) {
        car.angle += Math.sign(angleDiff) * car.rotationSpeed;
      }

      // Tự động tiến về phía trước (áp dụng speedMultiplier) - chỉ khi không có tên lửa
      if (!gameRef.current.rocket) {
        car.speed = 3 * (car.speedMultiplier || 1);
      } else {
        car.speed = 0; // Dừng xe khi có tên lửa
      }
    }

    const oldX = car.x;
    const oldY = car.y;
    
    car.x += Math.sin(car.angle) * car.speed;
    car.y -= Math.cos(car.angle) * car.speed;

    // Thêm vào quỹ đạo nếu xe đang di chuyển
    if (Math.abs(car.speed) > 0.5) {
      gameRef.current.carTrail.push({
        x: oldX,
        y: oldY,
        alpha: 1,
        angle: car.angle
      });
      
      // Giới hạn số lượng điểm quỹ đạo (tăng lên để đuôi lửa dài hơn)
      if (gameRef.current.carTrail.length > 25) {
        gameRef.current.carTrail.shift();
      }
    }

    // Giữ xe trong arena - kiểm tra cả mũi và đuôi xe
    const isTruckCollision = balloons.filter(b => b.alive).length > 10;
    const vHeight = isTruckCollision ? CAR_HEIGHT * 2 : CAR_HEIGHT;
    const vWidth = isTruckCollision ? CAR_WIDTH * 2 : CAR_WIDTH;
    
    const carFrontX = car.x + Math.sin(car.angle) * vHeight / 2;
    const carFrontY = car.y - Math.cos(car.angle) * vHeight / 2;
    const carBackX = car.x - Math.sin(car.angle) * vHeight / 2;
    const carBackY = car.y + Math.cos(car.angle) * vHeight / 2;
    
    const frontDist = Math.sqrt(carFrontX * carFrontX + carFrontY * carFrontY);
    const backDist = Math.sqrt(carBackX * carBackX + carBackY * carBackY);
    const centerDist = Math.sqrt(car.x * car.x + car.y * car.y);
    
    // Nếu bất kỳ phần nào của xe chạm tường
    if (frontDist > arenaRadius || backDist > arenaRadius || centerDist > arenaRadius - vWidth / 2) {
      // Tạo hiệu ứng lửa xẹt ở điểm chạm tường
      const contactAngle = Math.atan2(car.y, car.x);
      const wallX = Math.cos(contactAngle) * arenaRadius;
      const wallY = Math.sin(contactAngle) * arenaRadius;
      
      // Tạo 5-8 hạt lửa mỗi frame
      if (Math.random() < 0.7) {
        const sparkCount = Math.floor(Math.random() * 4) + 5;
        for (let i = 0; i < sparkCount; i++) {
          const sparkAngle = contactAngle + Math.PI + (Math.random() - 0.5) * Math.PI / 2;
          const speed = Math.random() * 3 + 2;
          gameRef.current.sparks.push({
            x: wallX + (Math.random() - 0.5) * 30,
            y: wallY + (Math.random() - 0.5) * 30,
            vx: Math.cos(sparkAngle) * speed,
            vy: Math.sin(sparkAngle) * speed,
            life: 1.0,
            size: Math.random() * 3 + 2,
            color: Math.random() > 0.5 ? '#ff6b00' : '#ffff00'
          });
        }
      }
      
      // Đẩy xe về vị trí hợp lệ
      const angle = Math.atan2(car.y, car.x);
      const maxDist = arenaRadius - vHeight / 2 - 5; // Thêm margin an toàn
      if (centerDist > maxDist) {
        car.x = Math.cos(angle) * maxDist;
        car.y = Math.sin(angle) * maxDist;
      }
      
      // Bắt đầu lùi nếu chưa lùi
      if (!car.isReversing) {
        car.isReversing = true;
        car.reverseTimer = 0;
        car.reverseDistance = 0;
      }
    }

    // Camera theo xe, balloon hoặc tên lửa tùy theo cameraTarget
    if (gameRef.current.followCar) {
      // Ưu tiên focus vị trí nổ nếu vừa nổ xong
      if (gameRef.current.explosionLocation) {
        camera.x = gameRef.current.explosionLocation.x;
        camera.y = gameRef.current.explosionLocation.y;
      } else if (gameRef.current.rocket) {
        // Focus tên lửa nếu đang có tên lửa bay
        camera.x = gameRef.current.rocket.x;
        camera.y = gameRef.current.rocket.y;
      } else {
        const target = gameRef.current.cameraTarget;
        if (target === 'car') {
          camera.x = car.x;
          camera.y = car.y;
        } else if (typeof target === 'number') {
          // Focus vào balloon
          const targetBalloon = balloons[target];
          if (targetBalloon && targetBalloon.alive) {
            camera.x = targetBalloon.x;
            camera.y = targetBalloon.y;
          } else {
            // Nếu balloon chết thì quay về xe
            camera.x = car.x;
            camera.y = car.y;
            gameRef.current.cameraTarget = 'car';
          }
        }
      }
    }

    // Vị trí mũi kiếm (điều chỉnh theo loại xe)
    const isTruck = balloons.filter(b => b.alive).length > 10;
    const vehicleHeight = isTruck ? CAR_HEIGHT * 2 : CAR_HEIGHT;
    const swordTipX = car.x + Math.sin(car.angle) * (vehicleHeight / 2 + SWORD_LENGTH);
    const swordTipY = car.y - Math.cos(car.angle) * (vehicleHeight / 2 + SWORD_LENGTH);

    // Cập nhật bong bóng
    balloons.forEach((balloon, i) => {
      if (!balloon.alive) return;

      // Cập nhật thời gian khiên - tăng dần và tự động tắt sau 3 giây
      if (balloon.shield && car.canMove && balloon.alive) {
        balloon.shieldTime += 1/60; // Tăng theo frame (60fps)
        if (balloon.shieldTime >= 3) {
          balloon.shield = false;
          balloon.shieldTime = 3; // Đánh dấu đã hết khiên
        }
      }

      // Kiểm tra va chạm với mũi kiếm - chỉ khi không có khiên
      const dx = swordTipX - balloon.x;
      const dy = swordTipY - balloon.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Kiểm tra chạm mũi kiếm (tăng bán kính kiểm tra lên 1 chút)
      if (dist < balloon.radius + 10 && !balloon.shield && car.canMove) {
        balloon.alive = false;
        createExplosion(balloon.x, balloon.y, balloon.color);
        
        // Thêm vào danh sách bị loại
        setEliminatedPlayers(prev => [...prev, balloon.name]);
        
        // Phát âm thanh boom
        if (boomAudioRef.current) {
          boomAudioRef.current.currentTime = 0;
          boomAudioRef.current.play().catch(err => console.log('Boom audio play failed:', err));
        }
        
        // Dừng xe ngay lập tức
        car.canMove = false;
        car.speed = 0;
        setIsCarMoving(false); // Cập nhật state
        
        setTimeout(() => {
          nextTurn();
        }, 500);
        return;
      }

      // Va chạm với xe
      const carDx = car.x - balloon.x;
      const carDy = car.y - balloon.y;
      const carDist = Math.sqrt(carDx * carDx + carDy * carDy);
      const vWidthCollision = isTruckCollision ? CAR_WIDTH * 2 : CAR_WIDTH;

      if (carDist < balloon.radius + vWidthCollision / 2) {
        const angle = Math.atan2(carDy, carDx);
        const overlap = balloon.radius + vWidthCollision / 2 - carDist;
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
      // Thêm chuyển động ngẫu nhiên nhẹ nhàng (drift) - chậm hơn và khác nhau cho mỗi bong bóng
      if (balloon.driftSpeed > 0) {
        const time = Date.now() * 0.0005; // Chậm hơn 50%
        const driftX = Math.sin(time + balloon.driftPattern * 1.5) * 0.015 * balloon.driftSpeed;
        const driftY = Math.cos(time + balloon.driftPattern * 2.0) * 0.015 * balloon.driftSpeed;
        
        balloon.vx += driftX;
        balloon.vy += driftY;
      }
      
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
    
    // Cập nhật sparks (hạt lửa xẹt)
    for (let i = gameRef.current.sparks.length - 1; i >= 0; i--) {
      const spark = gameRef.current.sparks[i];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vy += 0.2; // Trọng lực
      spark.life -= 0.02;
      spark.size *= 0.96;
      
      if (spark.life <= 0) {
        gameRef.current.sparks.splice(i, 1);
      }
    }
    
    // Cập nhật quỹ đạo xe (giảm chậm hơn để đuôi lửa dài hơn)
    const trail = gameRef.current.carTrail;
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].alpha -= 0.03;
      if (trail[i].alpha <= 0) {
        trail.splice(i, 1);
      }
    }
    
    // Gửi game state cho server nếu là host
    if (isHost && socketRef.current && currentRoom) {
      socketRef.current.emit('updateGameState', {
        balloons: balloons,
        car: car,
        currentTurn: currentTurn,
        arenaRadius: arenaRadius,
        countdown: countdown,
        winner: winner,
        isPlaying: gameState === 'playing'
      });
    }

    // Vẽ
    draw(ctx, canvas.width, canvas.height, arenaRadius);
    drawMiniMap();

    gameRef.current.animationId = requestAnimationFrame(gameLoop);
  };

  const handleMiniMapClick = (e) => {
    const canvas = miniMapRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = 150;

    const { arenaRadius } = gameRef.current;
    const scale = (size / 2 - 10) / arenaRadius;

    // Chuyển tọạ độ click thành tọạ độ thế giới
    const worldX = (x - size / 2) / scale;
    const worldY = (y - size / 2) / scale;

    // Cập nhật camera và tắt chế độ theo xe
    gameRef.current.camera.x = worldX;
    gameRef.current.camera.y = worldY;
    gameRef.current.followCar = false;

    // Tự động bật lại chế độ theo xe sau 3 giây
    setTimeout(() => {
      if (gameRef.current) {
        gameRef.current.followCar = true;
      }
    }, 3000);
  };

  useEffect(() => {
    let interval;
    if (gameState === 'playing' && isCarMoving) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [gameState, isCarMoving]);

  const drawMiniMap = () => {
    const canvas = miniMapRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = 150;
    const { car, balloons, arenaRadius } = gameRef.current;
    
    if (!balloons || balloons.length === 0 || !car) return;
    
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
  
  // Helper function to convert HSL to RGB
  const hslToRgb = (h, s, l) => {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const draw = (ctx, width, height, arenaRadius) => {
    const { car, balloons, camera, particles } = gameRef.current;
    
    // Kiểm tra dữ liệu trước khi vẽ
    if (!balloons || !car) return;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    
    // Scale toàn bộ vùng vẽ xuống 0.75 để có phạm vi nhìn rộng hơn
    const scale = 0.75;
    ctx.translate(width / 2 - camera.x * scale, height / 2 - camera.y * scale);
    ctx.scale(scale, scale);

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
    balloons.forEach((balloon, index) => {
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
      
      // Màu gradient
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

      // Vẽ khiên bảo vệ nếu còn hiệu lực
      if (balloon.shield) {
        const shieldRadius = balloon.radius + 8;
        const shieldAlpha = Math.max(0, 1 - balloon.shieldTime / 3); // Mờ dần theo thời gian
        
        // Vẽ khiên với hiệu ứng lấp lánh
        const shimmer = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
        
        // Khiên ngoài
        ctx.strokeStyle = `rgba(100, 200, 255, ${shieldAlpha * shimmer})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(balloon.x, balloon.y, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Khiên trong mỏng hơn
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

      // Tên
      ctx.fillStyle = '#000';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(balloon.name, balloon.x, balloon.y);
      ctx.shadowBlur = 0;

      // Dây bong bóng với hiệu ứng lắc lư
      const time = Date.now() * 0.002;
      const swingX = Math.sin(time + index) * 3;
      
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(balloon.x, balloon.y + balloon.radius);
      
      // Dây có độ cong
      const midX = balloon.x + swingX;
      const midY = balloon.y + balloon.radius + 8;
      ctx.quadraticCurveTo(midX, midY, balloon.x + swingX * 0.5, balloon.y + balloon.radius + 15);
      ctx.stroke();
      
      // Nút cuối dây
      ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
      ctx.beginPath();
      ctx.arc(balloon.x + swingX * 0.5, balloon.y + balloon.radius + 15, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });

    // Vẽ bóng đuôi lửa phía sau xe (chỉ khi xe chạy)
    const trail = gameRef.current.carTrail;
    const isTrailTruck = balloons.length > 10;
    if (Math.abs(car.speed) > 0.5) {
      trail.forEach((point, i) => {
        ctx.save();
        const fadeAlpha = point.alpha * (i / trail.length) * 0.6;
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(point.x, point.y);
        ctx.rotate(point.angle);
        
        if (isTrailTruck) {
          // Xe tải: Hai đuôi lửa hai bên
          for (let side of [-1, 1]) {
            const xOffset = side * (CAR_WIDTH * 0.5); // Vị trí hai bên xe tải
            const particleSize = 12 + (i / trail.length) * 18;
            const gradient = ctx.createRadialGradient(xOffset, CAR_HEIGHT * 1.3, 0, xOffset, CAR_HEIGHT * 1.3, particleSize);
            gradient.addColorStop(0, 'rgba(255, 140, 0, 0.8)'); // Cam sáng
            gradient.addColorStop(0.4, 'rgba(231, 76, 60, 0.6)'); // Đỏ
            gradient.addColorStop(1, 'rgba(231, 76, 60, 0)'); // Mờ dần
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(xOffset, CAR_HEIGHT * 1.3, particleSize, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Xe cảnh sát: Một đuôi lửa giữa
          const particleSize = 8 + (i / trail.length) * 12;
          const gradient = ctx.createRadialGradient(0, CAR_HEIGHT/3, 0, 0, CAR_HEIGHT/3, particleSize);
          gradient.addColorStop(0, 'rgba(255, 140, 0, 0.8)'); // Cam sáng
          gradient.addColorStop(0.4, 'rgba(231, 76, 60, 0.6)'); // Đỏ
          gradient.addColorStop(1, 'rgba(231, 76, 60, 0)'); // Mờ dần
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, CAR_HEIGHT/3, particleSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      });
    }

    // Vẽ tên lửa nếu có
    if (gameRef.current.rocket) {
      const rocket = gameRef.current.rocket;
      
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
      
      // Rocket.angle sử dụng hệ tọa độ xe (0 = lên trên, tăng theo chiều kim đồng hồ)
      // Cần xoay canvas để mũi tên lửa (vẽ hướng lên, y âm) chỉ đúng hướng bay
      ctx.rotate(rocket.angle);
      
      // Bóng tên lửa (hiệu ứng 3D)
      ctx.shadowColor = 'rgba(255, 68, 68, 0.5)';
      ctx.shadowBlur = 10;
      
      // Thân tên lửa - gradient đỏ sang vàng (lớn hơn)
      const gradient = ctx.createLinearGradient(0, -15, 0, 15);
      gradient.addColorStop(0, '#ff4444');
      gradient.addColorStop(0.5, '#ff6b35');
      gradient.addColorStop(1, '#ffaa00');
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      ctx.moveTo(0, -18);  // Đầu nhọn (to hơn)
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
      
      // Lửa đuôi - hiệu ứng ngọn lửa (lớn hơn)
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
      
      // Lửa đuôi thứ 2 (nhỏ hơn, lung linh)
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

    // Vẽ particles (hiệu ứng nổ)
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Vẽ sparks (hiệu ứng lửa xẹt khi chạm tường)
    gameRef.current.sparks.forEach(spark => {
      ctx.globalAlpha = spark.life;
      
      // Ánh sáng phát ra
      const sparkGlow = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.size * 3);
      sparkGlow.addColorStop(0, spark.color);
      sparkGlow.addColorStop(0.5, spark.color + '80');
      sparkGlow.addColorStop(1, spark.color + '00');
      ctx.fillStyle = sparkGlow;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Hạt lửa
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Kiểm tra số lượng bong bóng để quyết định loại xe
    const isTruck = balloons.length > 10;
    const vehicleWidth = isTruck ? CAR_WIDTH * 2 : CAR_WIDTH;
    const vehicleHeight = isTruck ? CAR_HEIGHT * 2 : CAR_HEIGHT;

    // Vẽ xe
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Bóng đổ dưới xe
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, vehicleHeight / 2 + 5, vehicleWidth * 0.4, isTruck ? 15 : 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isTruck) {
      // VẼ XE TẢI
      const bodyGradient = ctx.createLinearGradient(-vehicleWidth / 2, 0, vehicleWidth / 2, 0);
      
      // Kiểm tra nếu đang speed boost thì đổi màu đỏ
      if (gameRef.current.speedBoosted) {
        bodyGradient.addColorStop(0, '#7f1d1d'); // Đỏ đen
        bodyGradient.addColorStop(0.3, '#991b1b'); // Đỏ đậm
        bodyGradient.addColorStop(0.5, '#b91c1c'); // Đỏ
        bodyGradient.addColorStop(0.7, '#991b1b'); // Đỏ đậm
        bodyGradient.addColorStop(1, '#7f1d1d'); // Đỏ đen
      } else {
        bodyGradient.addColorStop(0, '#000000ff'); 
        bodyGradient.addColorStop(0.3, '#1a1a1aff'); 
        bodyGradient.addColorStop(0.5, '#080808ff');
        bodyGradient.addColorStop(0.7, 'rgba(18, 2, 2, 1)'); 
        bodyGradient.addColorStop(1, '#000000ff'); 
      }
      
      // Thùng xe tải (phần sau) - dài hơn
      ctx.fillStyle = bodyGradient;
      ctx.fillRect(-vehicleWidth / 2, -vehicleHeight / 2 + 30, vehicleWidth, vehicleHeight - 35);
      
      // Vẽ hình động vật lên thùng xe - thay đổi mỗi 3 giây
      if (gameRef.current.animalImages && gameRef.current.animalImages.length > 0) {
        const cargoX = -vehicleWidth / 2;
        const cargoY = -vehicleHeight / 2 + 30;
        const cargoWidth = vehicleWidth;
        const cargoHeight = vehicleHeight - 35;
        
        // Tính toán hình ảnh nào sẽ hiển thị (thay đổi mỗi 3 giây = 180 frames)
        const imageIndex = Math.floor(gameRef.current.gameTimer / 180) % 3;
        const currentImage = gameRef.current.animalImages[imageIndex];
        
        // Vẽ hình động vật với kích thước vừa khít thùng xe, padding 5px
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
      
      // Cabin xe tải (phần đầu)
      const cabinGradient = ctx.createLinearGradient(-vehicleWidth / 2, -vehicleHeight / 2, vehicleWidth / 2, -vehicleHeight / 2);
      if (gameRef.current.speedBoosted) {
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
      
      // Kính cabin
      const windowGrad = ctx.createLinearGradient(0, -vehicleHeight / 2, 0, -vehicleHeight / 2 + 30);
      windowGrad.addColorStop(0, '#34495e');
      windowGrad.addColorStop(1, '#1a252f');
      ctx.fillStyle = windowGrad;
      ctx.fillRect(-vehicleWidth / 2 + 15, -vehicleHeight / 2 + 5, vehicleWidth - 30, 35);
      
      // 3 đèn LED trên kính cabin - cùng màu và nhấp nháy đồng bộ
      const ledTimer = gameRef.current.gameTimer;
      const blinkCycle = Math.floor(ledTimer / 30) % 2; // Nhấp nháy mỗi 0.5 giây
      const colorCycle = Math.floor(ledTimer / 90) % 3; // Đổi màu mỗi 1.5 giây
      
      // 3 màu: Xanh lá, Xanh dương, Vàng
      const colors = [
        { rgb: [34, 197, 94], name: 'green' },   // Xanh lá
        { rgb: [59, 130, 246], name: 'blue' },   // Xanh dương
        { rgb: [234, 179, 8], name: 'yellow' }   // Vàng
      ];
      
      const currentColor = colors[colorCycle];
      const isLightOn = blinkCycle === 1;
      
      // Tính toán vị trí đèn dựa trên kích thước kính cabin
      const windowWidth = vehicleWidth - 30; // Chiều rộng kính
      const windowCenterX = 0; // Tâm kính
      const ledSpacing = windowWidth / 4; // Khoảng cách giữa các đèn
      const ledPositions = [
        windowCenterX - ledSpacing,  // Trái
        windowCenterX,                // Giữa
        windowCenterX + ledSpacing    // Phải
      ];
      
      // Đặt đèn ở giữa chiều cao kính cabin
      const yPos = -vehicleHeight / 2 + 5 + 35 / 2;
      const ledSize = 6; // Kích thước đồng nhất cho cả 3 đèn
      
      ledPositions.forEach((xPos) => {
        if (isLightOn) {
          // Đèn sáng - ánh sáng tỏa ra
          const glow = ctx.createRadialGradient(xPos, yPos, 0, xPos, yPos, 18);
          glow.addColorStop(0, `rgba(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]}, 0.9)`);
          glow.addColorStop(0.5, `rgba(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]}, 0.5)`);
          glow.addColorStop(1, `rgba(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]}, 0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(xPos, yPos, 18, 0, Math.PI * 2);
          ctx.fill();
          
          // Đèn LED sáng
          ctx.fillStyle = `rgb(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]})`;
          ctx.shadowColor = `rgb(${currentColor.rgb[0]}, ${currentColor.rgb[1]}, ${currentColor.rgb[2]})`;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(xPos, yPos, ledSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // Đèn tắt - màu xám đen tối
          ctx.fillStyle = '#2a2a2a';
          ctx.beginPath();
          ctx.arc(xPos, yPos, ledSize, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // LED strip cho xe tải
      const lightProgress = (gameRef.current.gameTimer * 0.1) % 1;
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
      
    } else {
      // VẼ XE CẢNH SÁT (code gốc)
    
    // Thân xe - hình dáng xe thật với đầu nhọn
    const bodyGradient = ctx.createLinearGradient(-CAR_WIDTH / 2, 0, CAR_WIDTH / 2, 0);
    
    // Kiểm tra nếu đang speed boost thì đổi màu đỏ
    if (gameRef.current.speedBoosted) {
      bodyGradient.addColorStop(0, '#7f1d1d'); // Đỏ đen
      bodyGradient.addColorStop(0.3, '#991b1b'); // Đỏ đậm
      bodyGradient.addColorStop(0.5, '#b91c1c'); // Đỏ
      bodyGradient.addColorStop(0.7, '#991b1b'); // Đỏ đậm
      bodyGradient.addColorStop(1, '#7f1d1d'); // Đỏ đen
    } else {
      bodyGradient.addColorStop(0, '#0a0a0a'); // Đen
      bodyGradient.addColorStop(0.3, '#1a1a1a'); // Đen nhạt
      bodyGradient.addColorStop(0.5, '#2d2d2d'); // Xám đen
      bodyGradient.addColorStop(0.7, '#1a1a1a'); // Đen nhạt
      bodyGradient.addColorStop(1, '#0a0a0a'); // Đen
    }
    
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    // Đầu xe nhọn
    ctx.moveTo(0, -CAR_HEIGHT / 2 - 10);
    ctx.lineTo(-CAR_WIDTH / 2, -CAR_HEIGHT / 2 + 10);
    ctx.lineTo(-CAR_WIDTH / 2, CAR_HEIGHT / 2 - 10);
    // Đuôi xe bo tròn
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
    
    // Hiệu ứng ánh sáng chạy dọc hai bên viền xe (LED strip effect)
    const lightProgress = (gameRef.current.gameTimer * 0.1) % 1; // Tốc độ chạy
    const numLights = 8; // Số điểm sáng
    
    for (let i = 0; i < numLights; i++) {
      const progress = (i / numLights + lightProgress) % 1;
      const yPos = -CAR_HEIGHT / 2 + progress * CAR_HEIGHT;
      
      // Độ sáng giảm dần theo vị trí
      const brightness = Math.sin(progress * Math.PI) * 0.8 + 0.2;
      
      // Luân phiên giữa đỏ và xanh dương
      const isRed = Math.floor((progress + lightProgress) * numLights) % 2 === 0;
      const colorRGB = isRed ? [239, 68, 68] : [59, 130, 246]; // Đỏ hoặc xanh dương
      
      // Ánh sáng bên trái
      const leftGlow = ctx.createRadialGradient(-CAR_WIDTH / 2, yPos, 0, -CAR_WIDTH / 2, yPos, 8);
      leftGlow.addColorStop(0, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness})`);
      leftGlow.addColorStop(0.5, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness * 0.5})`);
      leftGlow.addColorStop(1, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, 0)`);
      ctx.fillStyle = leftGlow;
      ctx.beginPath();
      ctx.arc(-CAR_WIDTH / 2, yPos, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Điểm sáng bên trái
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
      ctx.beginPath();
      ctx.arc(-CAR_WIDTH / 2, yPos, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Ánh sáng bên phải
      const rightGlow = ctx.createRadialGradient(CAR_WIDTH / 2, yPos, 0, CAR_WIDTH / 2, yPos, 8);
      rightGlow.addColorStop(0, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness})`);
      rightGlow.addColorStop(0.5, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, ${brightness * 0.5})`);
      rightGlow.addColorStop(1, `rgba(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]}, 0)`);
      ctx.fillStyle = rightGlow;
      ctx.beginPath();
      ctx.arc(CAR_WIDTH / 2, yPos, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Điểm sáng bên phải
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
      ctx.beginPath();
      ctx.arc(CAR_WIDTH / 2, yPos, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // // Đèn pha trước (2 bên đầu xe)
    // const lightGradient = ctx.createRadialGradient(-10, -CAR_HEIGHT / 2 + 5, 0, -10, -CAR_HEIGHT / 2 + 5, 8);
    // lightGradient.addColorStop(0, '#fff');
    // lightGradient.addColorStop(0.5, '#f1c40f');
    // lightGradient.addColorStop(1, '#f39c12');
    // ctx.fillStyle = lightGradient;
    // ctx.beginPath();
    // ctx.arc(-10, -CAR_HEIGHT / 2 + 5, 6, 0, Math.PI * 2);
    // ctx.fill();
    // ctx.beginPath();
    // ctx.arc(10, -CAR_HEIGHT / 2 + 5, 6, 0, Math.PI * 2);
    // ctx.fill();
    
    // Ánh sáng đèn
    ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
    ctx.beginPath();
    ctx.arc(-10, -CAR_HEIGHT / 2 + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -CAR_HEIGHT / 2 + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Cửa sổ trước dạng kính cong
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
    
    // Phản chiếu ánh sáng trên kính
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-12, -CAR_HEIGHT / 2 + 18);
    ctx.lineTo(-14, -CAR_HEIGHT / 2 + 28);
    ctx.lineTo(-8, -CAR_HEIGHT / 2 + 28);
    ctx.lineTo(-6, -CAR_HEIGHT / 2 + 18);
    ctx.closePath();
    ctx.fill();
    
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
    
    // Logo/biểu tượng giữa xe
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Đèn nhấp nháy cảnh sát trên đầu xe (giống xe cảnh sát)
    const blinkPhase = Math.floor(gameRef.current.gameTimer / 10) % 2; // Nhấp nháy mỗi 10 frame
    
    // Đèn trái (xanh dương)
    if (blinkPhase === 0) {
      // Ánh sáng xanh dương
      const blueGlow = ctx.createRadialGradient(-12, -20, 0, -12, -20, 15);
      blueGlow.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
      blueGlow.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
      blueGlow.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = blueGlow;
      ctx.beginPath();
      ctx.arc(-12, -20, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Đèn xanh dương
      ctx.fillStyle = '#3b82f6';
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(-12, -20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    // Đèn phải (đỏ)
    if (blinkPhase === 1) {
      // Ánh sáng đỏ
      const redGlow = ctx.createRadialGradient(12, -20, 0, 12, -20, 15);
      redGlow.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      redGlow.addColorStop(0.5, 'rgba(239, 68, 68, 0.4)');
      redGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = redGlow;
      ctx.beginPath();
      ctx.arc(12, -20, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Đèn đỏ
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(12, -20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    } // Kết thúc phần vẽ xe cảnh sát

    // Mũi kiếm nhọn - chỉ vẽ nếu swordVisible = true
    if (gameRef.current.swordVisible) {
      const swordYStart = isTruck ? -vehicleHeight / 2 : -CAR_HEIGHT / 2;
      const swordGradient = ctx.createLinearGradient(
        0, swordYStart,
        0, swordYStart - SWORD_LENGTH
      );
      swordGradient.addColorStop(0, '#dc2626');
      swordGradient.addColorStop(0.5, '#ef4444');
      swordGradient.addColorStop(1, '#f87171');
      
      ctx.strokeStyle = swordGradient;
      ctx.lineWidth = isTruck ? 10 : 6;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(0, swordYStart);
      ctx.lineTo(0, swordYStart - SWORD_LENGTH + 8);
      ctx.stroke();

      // Lưỡi kiếm nhọn
      ctx.fillStyle = '#ff0404e0';
      ctx.strokeStyle = '#820909ff';
      ctx.lineWidth = isTruck ? 3 : 2;
      ctx.beginPath();
      const bladeWidth = isTruck ? 10 : 6;
      ctx.moveTo(0, swordYStart - SWORD_LENGTH);
      ctx.lineTo(-bladeWidth, swordYStart - SWORD_LENGTH + 12);
      ctx.lineTo(bladeWidth, swordYStart - SWORD_LENGTH + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Hiệu ứng phát sáng trên lưỡi kiếm
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(-1, -CAR_HEIGHT / 2 - SWORD_LENGTH + 2);
      ctx.lineTo(-4, -CAR_HEIGHT / 2 - SWORD_LENGTH + 10);
      ctx.lineTo(1, -CAR_HEIGHT / 2 - SWORD_LENGTH + 10);
      ctx.closePath();
      ctx.fill();
    }

    // Hiển thị x2 nếu đã tăng tốc
    if (car.speedMultiplier === 2) {
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillText('x2', 0, 10);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    ctx.restore();
  };

  const nextTurn = () => {
    const aliveBalloons = gameRef.current.balloons.filter(b => b.alive);
    
    if (aliveBalloons.length === 1) {
      setWinner(aliveBalloons[0].name);
      setGameState('ended');
      
      // Dừng tất cả âm thanh khác và phát âm thanh chiến thắng
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (boomAudioRef.current) {
        boomAudioRef.current.pause();
        boomAudioRef.current.currentTime = 0;
      }
      if (endAudioRef.current) {
        endAudioRef.current.currentTime = 0;
        endAudioRef.current.play().catch(err => console.log('End audio play failed:', err));
      }
      return;
    }

    // Chuyển sang màn mới
    setCurrentTurn((currentTurn + 1) % aliveBalloons.length);
    
    // Reset countdown về null trước khi tạo màn mới
    setCountdown(null);
    setIsCarMoving(false); // Dừng timer khi chuyển lượt
    setElapsedTime(0); // Reset timer về 0 cho ván mới
    
    // Dừng nhạc cũ và random nhạc mới
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Random nhạc mới với tỉ lệ: music_man 40%, music_car 30%, rumba 30%
    try {
      const rand = Math.random();
      if (rand < 0.4) {
        audioRef.current = new Audio(require('./audio/music_man.mp3'));
      } else if (rand < 0.7) {
        audioRef.current = new Audio(require('./audio/music_car.mp3'));
      } else {
        audioRef.current = new Audio(require('./audio/rumba.mp3'));
      }
      audioRef.current.loop = true;
      audioRef.current.volume = 0.5;
    } catch (err) {
      console.log('Failed to load audio:', err);
    }
    
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
    setEliminatedPlayers([]); // Reset danh sách bị loại
    setElapsedTime(0); // Reset timer
    setIsCarMoving(false); // Reset state xe
  };

  const resetGame = () => {
    setGameState('setup');
    setCurrentTurn(0);
    setWinner(null);
    setCountdown(null);
    setPlayers(['Vietnam', 'Thailand', 'Indonesia']); // Reset về 3 người chơi mặc định
    setNewPlayer('');
    setEditingIndex(null);
    setEditingName('');
    setEliminatedPlayers([]); // Reset danh sách bị loại
    setShowEliminated(false); // Đóng panel bị loại
    setElapsedTime(0); // Reset timer
    
    // Dừng nhạc nền
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Dừng nhạc end
    if (endAudioRef.current) {
      endAudioRef.current.pause();
      endAudioRef.current.currentTime = 0;
    }
    
    // Reset gameRef
    gameRef.current = {
      balloons: [],
      car: null,
      keys: {},
      animationId: null,
      camera: { x: 0, y: 0 },
      particles: [],
      followCar: true,
      arenaRadius: 200,
      carTrail: [],
      sparks: [],
      audioStarted: false,
      gameTimer: 0,
      speedBoosted: false
    };
  };

  const addPlayer = () => {
    if (newPlayer.trim() && players.length < 20) {
      const name = newPlayer.trim().split(' ')[0]; // Chỉ lấy từ đầu tiên
      setPlayers([...players, name]);
      setNewPlayer('');
    }
  };

  const addRandomPlayer = () => {
    if (players.length >= 20) return;
    
    const availableNames = randomNames.filter(name => !players.includes(name));
    if (availableNames.length === 0) {
      alert('Đã hết tên ngẫu nhiên!');
      return;
    }
    
    const randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
    setPlayers([...players, randomName]);
  };

  const addMaxPlayers = () => {
    const availableNames = randomNames.filter(name => !players.includes(name));
    const numToAdd = Math.min(20 - players.length, availableNames.length);
    
    if (numToAdd === 0) {
      alert('Đã đủ 20 người chơi hoặc hết tên!');
      return;
    }
    
    // Shuffle và lấy ngẫu nhiên
    const shuffled = [...availableNames].sort(() => Math.random() - 0.5);
    const newPlayers = shuffled.slice(0, numToAdd);
    
    setPlayers([...players, ...newPlayers]);
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

  const createRoom = () => {
    if (roomName.trim() && username.trim()) {
      socketRef.current.emit('createRoom', {
        roomName: roomName.trim(),
        hostName: username.trim()
      });
    }
  };

  const joinRoom = (roomId) => {
    if (username.trim()) {
      socketRef.current.emit('joinRoom', {
        username: username.trim(),
        roomId: roomId
      });
    } else {
      alert('Vui lòng nhập tên của bạn');
    }
  };

  const backToMenu = () => {
    if (socketRef.current && currentRoom) {
      socketRef.current.disconnect();
      const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';
      socketRef.current = io(SOCKET_URL);
    }
    setGameState('menu');
    setCurrentRoom(null);
    setIsHost(false);
    setPlayers(['Putin', 'Donald Trump']);
  };

  if (gameState === 'menu') {
    return (
      <div className="game-container">
        <div className="setup-box">
          <h1 className="title">
            🎈 Game 🚗
          </h1>
          
          <div style={{marginBottom: '1.5rem'}}>
            <h2 className="section-title">Tên của bạn:</h2>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên của bạn"
              className="player-input"
              style={{marginBottom: '1rem'}}
            />
            
            <h2 className="section-title">Tạo phòng mới:</h2>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Tên phòng"
              className="player-input"
              style={{marginBottom: '0.5rem'}}
            />
            <button
              onClick={createRoom}
              className="btn btn-green"
              style={{width: '100%', marginBottom: '1.5rem'}}
            >
              <Plus size={20} />
              Tạo phòng
            </button>

            <h2 className="section-title">Danh sách phòng:</h2>
            <div style={{maxHeight: '300px', overflowY: 'auto'}}>
              {roomList.length === 0 ? (
                <div style={{textAlign: 'center', color: '#9ca3af', padding: '1rem'}}>
                  Chưa có phòng nào
                </div>
              ) : (
                roomList.map((room) => (
                  <div key={room.roomId} className="room-item">
                    <div>
                      <div style={{fontWeight: 'bold', fontSize: '1rem'}}>
                        {room.roomName}
                      </div>
                      <div style={{fontSize: '0.875rem', color: '#9ca3af'}}>
                        Host: {room.hostName} • <Users size={14} style={{display: 'inline', verticalAlign: 'middle'}} /> {room.playerCount} người
                        {room.isPlaying && ' • 🎮 Đang chơi'}
                      </div>
                    </div>
                    <button
                      onClick={() => joinRoom(room.roomId)}
                      className="btn btn-blue"
                    >
                      <Eye size={16} />
                      {room.isPlaying ? 'Xem' : 'Vào'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div className="game-container">
        <div className="setup-box">
          <h1 className="title">
            🎈 {currentRoom ? currentRoom.roomName : 'Game'} 🚗
          </h1>
          
          {currentRoom && (
            <div style={{marginBottom: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.3)'}}>
              <div style={{fontSize: '0.875rem', color: '#93c5fd'}}>
                Host: {currentRoom.hostName} • Người chơi: {currentRoom.playerCount}
              </div>
            </div>
          )}
          
          <div style={{marginBottom: '1.5rem'}}>
            <h2 className="section-title">Người chơi:</h2>
            <div className="player-list">
              {players.map((player, i) => (
                <div key={i} className="player-item">
                  {editingIndex === i ? (
                    <div style={{flex: 1, display: 'flex', gap: '0.5rem'}}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && savePlayerName()}
                        className="edit-input"
                        autoFocus
                      />
                      <button
                        onClick={savePlayerName}
                        className="btn btn-green"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="btn btn-gray"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{player}</span>
                      <div className="player-buttons">
                        <button
                          onClick={() => startEditingPlayer(i)}
                          className="btn-blue"
                        >
                          ✎
                        </button>
                        {players.length > 2 && (
                          <button
                            onClick={() => removePlayer(i)}
                            className="btn-red"
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

            {players.length < 20 && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                <div className="input-group">
                  <input
                    type="text"
                    value={newPlayer}
                    onChange={(e) => setNewPlayer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                    placeholder="Nhập tên (1 từ)..."
                    className="text-input"
                  />
                  <button
                    onClick={addPlayer}
                    className="btn btn-green"
                  >
                    Thêm
                  </button>
                </div>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button
                    onClick={addRandomPlayer}
                    className="btn btn-purple"
                    style={{flex: 1}}
                  >
                    🎲 Thêm Tên Ngẫu Nhiên
                  </button>
                  <button
                    onClick={addMaxPlayers}
                    className="btn btn-orange"
                    style={{flex: 1}}
                  >
                    🚀 Tối Đa (20)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
            <button
              onClick={startGame}
              className="btn btn-start"
              disabled={!isHost}
              style={{opacity: isHost ? 1 : 0.5}}
            >
              <Play size={24} />
              {isHost ? 'Bắt Đầu Chơi' : 'Chờ Host bắt đầu'}
            </button>
          </div>
 {/* Checkbox cho chế độ bắn rocket liên tục */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={continuousRocketMode}
                onChange={(e) => setContinuousRocketMode(e.target.checked)}
                style={{width: '20px', height: '20px', cursor: 'pointer', marginTop: '5px'}}
              />
              <span style={{fontSize: '0.9rem'}}>
                🚀 Chế độ bắn tên lửa (nhấn SPACE sau 5s)
              </span>
            </label>

          <div className="info-box">
            <p>🚗 <strong>Xe tự động chạy ngẫu nhiên</strong></p>
            <p>⚔️ Dùng mũi kiếm để đâm bong bóng đối thủ!</p>
            <p>🎯 Người còn lại cuối cùng sẽ chiến thắng!</p>
            <p className="small-text">💡 {isHost ? 'Bạn là Host - Bạn có thể bắt đầu game' : 'Đang chờ Host bắt đầu game'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'ended') {
    // Tính toán rankings (eliminatedPlayers được thêm theo thứ tự bị loại)
    // Người bị loại sau cùng = hạng 3, trước đó = hạng 2, người chiến thắng = hạng 1
    const rankings = [];
    rankings.push({ place: 1, name: winner, medal: '🥇', color: '#FFD700' }); // Vàng
    
    if (eliminatedPlayers.length >= 1) {
      rankings.push({ 
        place: 2, 
        name: eliminatedPlayers[eliminatedPlayers.length - 1], 
        medal: '🥈', 
        color: '#C0C0C0' 
      }); // Bạc
    }
    
    if (eliminatedPlayers.length >= 2) {
      rankings.push({ 
        place: 3, 
        name: eliminatedPlayers[eliminatedPlayers.length - 2], 
        medal: '🥉', 
        color: '#CD7F32' 
      }); // Đồng
    }
    
    return (
      <div className="end-container">
        {/* Fireworks effect */}
        <div className="fireworks">
          <div className="firework"></div>
          <div className="firework"></div>
          <div className="firework"></div>
          <div className="firework"></div>
          <div className="firework"></div>
        </div>
        
        <div className="end-box">
          <h1 className="winner-title">🎉 KẾT QUẢ TRẬN ĐẤU 🎉</h1>
          
          <div className="podium-container">
            {rankings.map((rank, index) => (
              <div 
                key={rank.place} 
                className={`podium-card podium-${rank.place}`}
                style={{ animationDelay: `${index * 0.3}s` }}
              >
                <div className="medal">{rank.medal}</div>
                <div className="place-number" style={{ color: rank.color }}>
                  #{rank.place}
                </div>
                <div className="player-name-podium">{rank.name}</div>
              </div>
            ))}
          </div>
          
          <button
            onClick={resetGame}
            className="btn-replay"
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
    <div className="game-screen">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="game-canvas"
      />
      
      <div className="hud-top-left">
        <div style={{fontSize: '1rem', marginBottom: '0.5rem', color: '#fbbf24'}}>🎈 Bong bóng</div>
        <div style={{fontSize: '2.5rem', fontWeight: 'bold'}}>{alivePlayers.length}</div>
        <div style={{fontSize: '0.875rem', marginTop: '0.25rem', color: '#9ca3af'}}>còn lại</div>
      </div>

      {/* Timer ở giữa góc trên */}
      <div className="hud-top-center">
        <div style={{fontSize: '1rem', fontWeight: 'bold'}}>
          {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
        </div>
      </div>

      {/* Mini Map */}
      <div className="hud-top-right">
        <canvas
          ref={miniMapRef}
          width={150}
          height={150}
          className="mini-map-canvas"
          onClick={handleMiniMapClick}
          style={{cursor: 'pointer'}}
        />
        <div className="mini-map-label">Mini Map (Click để di chuyển)</div>
      </div>

      {/* Players Panel */}
      <div className="players-panel">
        <div className="players-panel-header">
          <div className="players-panel-title">👥 NGƯỜI CHƠI</div>
          <button 
            className="focus-car-btn"
            onClick={() => {
              setCameraTarget('car');
              gameRef.current.cameraTarget = 'car';
            }}
            title="Focus về xe"
          >
            🚗
          </button>
        </div>
        {gameRef.current.balloons && gameRef.current.balloons.map((balloon, i) => (
          <div 
            key={i} 
            className={`player-tag ${!balloon.alive ? 'dead' : ''} ${cameraTarget === i ? 'focused' : ''}`}
            onClick={() => {
              if (balloon.alive) {
                setCameraTarget(i);
                gameRef.current.cameraTarget = i;
              }
            }}
            style={{cursor: balloon.alive ? 'pointer' : 'default'}}
            title={balloon.alive ? 'Click để xem bong bóng này' : ''}
          >
            <div 
              className="player-color-dot" 
              style={{backgroundColor: balloon.color}}
            />
            <div className="player-tag-name">{balloon.name}</div>
            {balloon.shield && balloon.alive && (
              <span className="player-shield-icon">🛡️</span>
            )}
          </div>
        ))}
      </div>

      {/* Eliminated Players Panel */}
      <div className="eliminated-panel">
        <button 
          className="eliminated-toggle-btn"
          onClick={() => setShowEliminated(!showEliminated)}
        >
          <span className="toggle-text">💔 ({eliminatedPlayers.length})</span>
        </button>
        {showEliminated && (
          <div className="eliminated-list">
            {eliminatedPlayers.length === 0 ? (
              <div className="eliminated-empty">Chưa có ai bị loại</div>
            ) : (
              eliminatedPlayers.map((name, i) => (
                <div key={i} className="eliminated-item">
                  <span className="eliminated-order">#{i + 1}</span>
                  <span className="eliminated-name">{name}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {countdown !== null && (
        <div className="countdown-overlay">
          <div 
            key={countdown} 
            className={`countdown-text ${
              countdown === 0 ? 'go-text' : 
              countdown === 1 ? 'count-one' : 
              countdown === 2 ? 'count-two' : 
              countdown === 3 ? 'count-three' : ''
            }`}
          >
            {countdown === 0 ? 'GOO!' : countdown}
          </div>
        </div>
      )}

      <button
        onClick={() => window.location.reload()}
        className="exit-btn"
      >
        <LogOut size={20} />
      </button>

      {/* Nút khởi động lại xe khi bị đứng yên - chỉ hiện cho host */}
      {isHost && (
        <button
          onClick={() => {
            if (gameRef.current.car) {
              gameRef.current.car.canMove = true;
              gameRef.current.car.speed = 3;
              setCountdown(null);
              setIsCarMoving(true); // Cập nhật state
              // Bật khiên 3 giây để công bằng
              if (gameRef.current.balloons) {
                gameRef.current.balloons.forEach(balloon => {
                  balloon.shield = true;
                  balloon.shieldTime = 0;
                });
                // Tắt khiên sau 3 giây
                setTimeout(() => {
                  if (gameRef.current.balloons) {
                    gameRef.current.balloons.forEach(balloon => {
                      balloon.shield = false;
                    });
                  }
                }, 3000);
              }
              // Reset và phát lại nhạc nền khi khởi động xe khẩn cấp
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(err => console.log('Audio play failed:', err));
                gameRef.current.audioStarted = true; // Đánh dấu đã phát
              }
            }
          }}
          disabled={gameRef.current.car?.canMove === true}
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            background: gameRef.current.car?.canMove === true 
              ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            cursor: gameRef.current.car?.canMove === true ? 'not-allowed' : 'pointer',
            fontSize: '0.5rem',
            // fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: gameRef.current.car?.canMove === true 
              ? '0 4px 15px rgba(156, 163, 175, 0.4)' 
              : '0 4px 15px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s ease',
            opacity: gameRef.current.car?.canMove === true ? 0.5 : 1
          }}
          onMouseEnter={(e) => {
            if (gameRef.current.car?.canMove !== true) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (gameRef.current.car?.canMove !== true) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }
          }}
        >
          <Play size={10} />
          Khởi động xe
        </button>
      )}

      {gameState === 'watching' && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '0.5rem',
          fontWeight: 'bold',
          fontSize: '1rem'
        }}>
          👁️ Đang xem
        </div>
      )}
    </div>
  );
};

export default BalloonCarGame;