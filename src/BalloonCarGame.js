import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Plus, Users, Eye, LogOut } from 'lucide-react';
import { io } from 'socket.io-client';
import './BalloonCarGame.css';
import pigImage from './images/pig.png';
import frogImage from './images/frog.png';
import bearImage from './images/bear.png';
import CarRenderer from './components/CarRenderer';
import BalloonRenderer from './components/BalloonRenderer';
import RocketSystem from './components/RocketSystem';
import UFORenderer from './components/UFORenderer';

const BalloonCarGame = () => {
  const canvasRef = useRef(null);
  const miniMapRef = useRef(null);
  const socketRef = useRef(null);
  const audioRef = useRef(null); // Ref cho nhạc nền
  const boomAudioRef = useRef(null); // Ref cho âm thanh boom
  const endAudioRef = useRef(null); // Ref cho âm thanh chiến thắng
  const laserAudioRef = useRef(null); // Ref cho âm thanh tên lửa
  const rocketFlyAudioRef = useRef(null); // Ref cho âm thanh bay của rocket
  const [gameState, setGameState] = useState('setup'); // Bỏ qua menu, vào setup luôn
  const [roomList, setRoomList] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isHost, setIsHost] = useState(true); // Offline nên luôn là host
  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [players, setPlayers] = useState(['Vietnam', 'Thailand', 'Indonesia']);
  const [newPlayer, setNewPlayer] = useState('');
  const [isMusicMuted, setIsMusicMuted] = useState(false); // Trạng thái tắt nhạc nền
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
  const [rocketCooldown, setRocketCooldown] = useState(0); // Thời gian hồi chiêu rocket (giây)
  const [ufoMode, setUfoMode] = useState(false); // Chế độ đĩa bay

  const randomNames = [
    'DiuLt', 'ViNx', 'HaiTt', 'PhucDh', 'PhuongLk', 'KhanhTn', 'ThuyTtn',
    'TheNt', 'LongTnh', 'VuLnh', 'DungPa', 'TuDq', 'TuyenNt', 'DungTt',
    'QuangNt', 'ThuanMt', 'CuongNht', 'ManhLd', 'KhoaNha', 'HieuNv',
    'ToanNd', 'SonTt', 'GiangHh', 'NamHpv', 'KietTa'
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
    damageTexts: [], // Hiệu ứng số -1 bay lên khi trừ máu
    audioStarted: false, // Flag để theo dõi âm thanh đã bắt đầu cho lượt này chưa
    gameTimer: 0, // Đếm thời gian chơi (tính bằng frame)
    speedBoosted: false, // Flag để kiểm tra đã tăng tốc chưa
    balloonData: {}, // Lưu trữ health và lastDamageTime của từng balloon
    animalImages: [], // Mảng chứa 3 hình ảnh động vật
    swordVisible: true, // Hiển thị thanh đao (tắt khi bắn rocket)
    isTruck: false, // Loại xe cho lượt này (true = xe tải, false = xe cảnh sát)
    rocketCooldownTimer: 0 // Đếm ngược thời gian cooldown (frames)
  });

  const BALLOON_RADIUS = 50;
  const CAR_WIDTH = 50;
  const CAR_HEIGHT = 70;
  const SWORD_LENGTH = 40;

  // Khởi tạo renderers và systems
  const carRenderer = useRef(new CarRenderer(CAR_WIDTH, CAR_HEIGHT, SWORD_LENGTH));
  const balloonRenderer = useRef(new BalloonRenderer(BALLOON_RADIUS));
  const rocketSystem = useRef(new RocketSystem());
  const ufoRenderer = useRef(new UFORenderer());

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
      
      // Khởi tạo âm thanh bay của rocket
      rocketFlyAudioRef.current = new Audio(require('./audio/rocket_fly.m4a'));
      rocketFlyAudioRef.current.volume = 0.5;
      rocketFlyAudioRef.current.loop = true; // Lặp lại âm thanh bay
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
      if (rocketFlyAudioRef.current) {
        rocketFlyAudioRef.current.pause();
        rocketFlyAudioRef.current = null;
      }
    };
  }, []);

  // Xử lý toggle nhạc nền
  useEffect(() => {
    if (audioRef.current) {
      if (isMusicMuted) {
        audioRef.current.pause();
      } else if (gameRef.current.audioStarted) {
        // Chỉ phát lại nếu game đang chạy
        audioRef.current.play().catch(err => console.log('Audio play failed:', err));
      }
    }
  }, [isMusicMuted]);

  const toggleMusic = () => {
    setIsMusicMuted(!isMusicMuted);
  };

  // Xử lý keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space' && gameState === 'playing' && !rocketSystem.current.isActive()) {
        event.preventDefault();
        
        // Kiểm tra cooldown
        if (gameRef.current.rocketCooldownTimer > 0) {
          console.log('Rocket on cooldown:', Math.ceil(gameRef.current.rocketCooldownTimer / 60), 'seconds remaining');
          return;
        }
        
        const { car, balloons } = gameRef.current;
        if (!car || !balloons) return;
        
        // Tìm bong bóng mục tiêu thật
        const aliveBalloons = balloons.filter(b => b.alive && !b.shield);
        if (aliveBalloons.length === 0) return;
        
        const targetBalloon = aliveBalloons[Math.floor(Math.random() * aliveBalloons.length)];
        
        // CHỌN MỤC TIÊU GIẢ - bong bóng khác để tạo cảm giác hồi hộp
        const availableForFake = aliveBalloons.filter(b => b !== targetBalloon);
        let fakeTarget = null;
        
        if (availableForFake.length > 0) {
          // Ưu tiên chọn bong bóng gần mục tiêu thật để tạo cảm giác "suýt chạm"
          const sortedByDistanceToReal = availableForFake.map(balloon => {
            const dist = Math.sqrt(
              Math.pow(balloon.x - targetBalloon.x, 2) + 
              Math.pow(balloon.y - targetBalloon.y, 2)
            );
            return { balloon, dist };
          }).sort((a, b) => a.dist - b.dist);
          
          // Chọn 1 trong 3 bong bóng gần nhất mục tiêu thật
          const candidates = sortedByDistanceToReal.slice(0, Math.min(3, sortedByDistanceToReal.length));
          fakeTarget = candidates[Math.floor(Math.random() * candidates.length)].balloon;
        }
        
        // Dừng xe lại hoàn toàn
        car.speed = 0;
        car.canMove = false;
        car.isReversing = false;
        car.reverseTimer = 0;
        car.reverseDistance = 0;
        
        // Bắn rocket bằng RocketSystem
        const launched = rocketSystem.current.launchRocket(
          car,
          targetBalloon,
          fakeTarget,
          aliveBalloons,
          CAR_WIDTH,
          CAR_HEIGHT,
          SWORD_LENGTH
        );
        
        if (launched) {
          gameRef.current.swordVisible = false; // Ẩn thanh đao khi bắn tên lửa
          
          // CAMERA THEO ROCKET
          gameRef.current.cameraTarget = 'rocket';
          setCameraTarget('rocket');
          
          // Phát âm thanh tên lửa
          if (laserAudioRef.current) {
            laserAudioRef.current.currentTime = 0;
            laserAudioRef.current.play().catch(err => console.log('Laser audio play failed:', err));
            
            // Phát âm thanh bay sau khi laser kết thúc
            laserAudioRef.current.onended = () => {
              if (rocketFlyAudioRef.current && rocketSystem.current.isActive()) {
                rocketFlyAudioRef.current.currentTime = 0;
                rocketFlyAudioRef.current.play().catch(err => console.log('Rocket fly audio play failed:', err));
              }
            };
          }
        }
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
      // Đảm bảo audio được khởi tạo cho cả viewer (cả xe và UFO mode)
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
      
      // Đảm bảo không có animation loop nào đang chạy trước khi bắt đầu loop mới
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
        gameRef.current.animationId = null;
      }
      
      gameRef.current.animationId = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
        gameRef.current.animationId = null;
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

    // Reset balloonData khi bắt đầu turn mới (chỉ ở UFO mode)
    if (ufoMode) {
      gameRef.current.balloonData = {};
    }

    // Lấy danh sách bong bóng còn sống từ lượt trước (nếu có)
    const previousBalloons = gameRef.current.balloons || [];
    let alivePlayers;
    
    // Validation - đảm bảo players tồn tại
    if (!players || players.length < 2) {
      console.error('Cannot start game: need at least 2 players. Current players:', players);
      return;
    }
    
    if (previousBalloons.length === 0) {
      // Lần đầu tiên - tất cả người chơi
      alivePlayers = [...players];
    } else {
      // Lấy những người còn bong bóng sống - thêm check null
      alivePlayers = previousBalloons.filter(b => b && b.alive).map(b => b.name);
    }
    
    // Validation - đảm bảo alivePlayers không rỗng
    if (!alivePlayers || alivePlayers.length === 0) {
      console.error('No alive players found, resetting to full player list');
      alivePlayers = [...players];
    }
    
    console.log('Starting game with players:', alivePlayers);
    
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
      
      const balloon = {
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
      
      // Chỉ thêm health khi ở chế độ UFO
      if (ufoMode) {
        // Khởi tạo hoặc lấy data từ gameRef.current.balloonData
        if (!gameRef.current.balloonData[name]) {
          gameRef.current.balloonData[name] = {
            health: 3,
            lastDamageTime: -100
          };
        }
        
        balloon.health = gameRef.current.balloonData[name].health;
        balloon.maxHealth = 3;
        balloon.lastDamageTime = gameRef.current.balloonData[name].lastDamageTime;
      }
      
      return balloon;
    });

    // Khởi tạo đĩa bay (UFO) - ĐẶT VỀ GIỮA ARENA
    const car = {
      x: 0, // Reset về giữa
      y: 0, // Reset về giữa
      angle: Math.random() * Math.PI * 2,
      speed: 0,
      maxSpeed: 8, // Tăng tốc độ cho đĩa bay
      acceleration: 0.5,
      friction: 0.98, // Giảm ma sát để bay trơn hơn
      rotationSpeed: 0.08,
      targetAngle: Math.random() * Math.PI * 2,
      changeDirectionTimer: 0,
      changeDirectionInterval: 60 + Math.random() * 120,
      isReversing: false,
      reverseTimer: 0,
      reverseDistance: 0,
      canMove: false, // UFO và xe đều bắt đầu với canMove=false
      speedMultiplier: 1, // Hệ số tốc độ (x1 hoặc x2)
      dodgeTarget: null, // Bong bóng đang né tránh
      dodgeCooldown: 0, // Thời gian chờ giữa các lần né (frames)
      isUFO: ufoMode, // Chế độ đĩa bay (dựa vào state)
      vx: 0, // Vận tốc theo trục x
      vy: 0, // Vận tốc theo trục y
      damageCooldown: 0 // Cooldown giữa các lần gây damage (frames)
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
    gameRef.current.swordVisible = true; // Phục hồi thanh đao
    gameRef.current.isTruck = balloons.length > 10; // Xác định loại xe dựa trên số bóng lúc bắt đầu
    rocketSystem.current.reset(); // Reset rocket system
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
    if (rocketSystem.current.isActive()) {
      // Callback khi rocket hit balloon
      const onHit = (balloon) => {
        // Nếu là UFO mode: NỔ LUÔN khi rocket trúng
        if (ufoMode && balloon.health !== undefined) {
          console.log(`🚀 Rocket hit ${balloon.name}! EXPLODED!`);
          
          // Nổ luôn không cần trừ máu
          balloon.alive = false;
          balloon.health = 0;
          gameRef.current.balloonData[balloon.name].health = 0;
          
          createExplosion(balloon.x, balloon.y, balloon.color);
          setEliminatedPlayers(prev => [...prev, balloon.name]);
          
          if (boomAudioRef.current) {
            boomAudioRef.current.currentTime = 0;
            boomAudioRef.current.play().catch(err => console.log('Boom audio play failed:', err));
            }
          
        } else {
          // Chế độ xe: nổ ngay
          balloon.alive = false;
          createExplosion(balloon.x, balloon.y, balloon.color);
          setEliminatedPlayers(prev => [...prev, balloon.name]);
          
          if (boomAudioRef.current) {
            boomAudioRef.current.currentTime = 0;
            boomAudioRef.current.play().catch(err => console.log('Boom audio play failed:', err));
          }
        }
        
        // Dừng âm thanh bay của rocket
        if (rocketFlyAudioRef.current) {
          rocketFlyAudioRef.current.pause();
          rocketFlyAudioRef.current.currentTime = 0;
        }
        
        const rocketPos = rocketSystem.current.rocket;
        gameRef.current.explosionLocation = {x: rocketPos.x, y: rocketPos.y};
        createExplosion(rocketPos.x, rocketPos.y, '#ff4444');
        
        // Reset rocket system
        rocketSystem.current.reset();
        
        // Bắt đầu cooldown 3 giây (180 frames)
        gameRef.current.rocketCooldownTimer = 180;
        
        // QUAY CAMERA VỀ XE và reset cameraTarget
        gameRef.current.cameraTarget = 'car';
        setCameraTarget('car');
        
        // Nếu ở chế độ continuous, cho phép bắn tiếp và phục hồi thanh đao
        if (continuousRocketMode) {
          setTimeout(() => {
            gameRef.current.explosionLocation = null;
            gameRef.current.swordVisible = true;
            car.canMove = true; // Cho phép xe di chuyển tiếp
          }, 1000);
        } else {
          // Chế độ bình thường - qua ván mới
          setTimeout(() => {
            gameRef.current.explosionLocation = null;
            nextTurn();
          }, 2000);
        }
      };
      
      // Callback khi rocket timeout
      const onTimeout = () => {
        // Reset rocket flag để có thể bắn lại
        rocketSystem.current.rocketLaunched = false;
        
        // Reset camera về car
        gameRef.current.cameraTarget = 'car';
        
        // Reset game timer và speed boost (chỉ ở car mode)
        if (!car.isUFO) {
          gameRef.current.gameTimer = 0;
          gameRef.current.speedBoosted = false;
          car.speedMultiplier = 1;
        }
        console.log('Rocket timeout - reset for next launch');
      };
      
      // Update rocket
      rocketSystem.current.update(
        balloons,
        car,
        gameRef.current.gameTimer,
        gameRef.current.swordVisible,
        gameRef.current.animalImages,
        onHit,
        onTimeout
      );
      
      // CAMERA THEO ROCKET khi bay (kiểm tra rocket vẫn còn active sau update)
      if (gameRef.current.cameraTarget === 'rocket' && rocketSystem.current.isActive()) {
        const rocket = rocketSystem.current.rocket;
        if (rocket) {
          camera.x = rocket.x;
          camera.y = rocket.y;
        }
      }
    }
    
    if (!car.canMove) {
      car.speed = 0;
    } else if (car.isUFO) {
      // ===== CHẾ ĐỘ ĐĨA BAY =====
      // Tăng timer (60 fps = 1 giây sau 60 frames)
      gameRef.current.gameTimer++;
      
      // Tăng tốc độ UFO theo thời gian
      const currentTime = gameRef.current.gameTimer / 60; // Đổi sang giây
      if (currentTime >= 40) {
        // Sau 40 giây: x5 tốc độ
        if (car.speedMultiplier !== 5) {
          car.speedMultiplier = 5;
          console.log('🚀 UFO SPEED x5! (40s)');
        }
      } else if (currentTime >= 30) {
        // Sau 30 giây: x4 tốc độ
        if (car.speedMultiplier !== 4) {
          car.speedMultiplier = 4;
          console.log('🚀 UFO SPEED x4! (30s)');
        }
      } else if (currentTime >= 20) {
        // Sau 20 giây: x3 tốc độ
        if (car.speedMultiplier !== 3) {
          car.speedMultiplier = 3;
          console.log('🚀 UFO SPEED x3! (20s)');
        }
      } else if (currentTime >= 10) {
        // Sau 10 giây: x2 tốc độ
        if (car.speedMultiplier !== 2) {
          car.speedMultiplier = 2;
          console.log('🚀 UFO SPEED x2! (10s)');
        }
      }
      
      // Sau 30 giây, UFO tự động bắn tên lửa vào bong bóng ngẫu nhiên
      if (currentTime >= 30 && !rocketSystem.current.rocketLaunched && !rocketSystem.current.isActive()) {
        // Validation - đảm bảo balloons tồn tại
        if (!balloons || balloons.length === 0) {
          console.error('Auto-rocket: balloons undefined or empty');
        } else {
          const aliveBalloons = balloons.filter(b => b && b.alive && !b.shield);
          if (aliveBalloons.length > 0) {
            const targetBalloon = aliveBalloons[Math.floor(Math.random() * aliveBalloons.length)];
            
            console.log(`🚀 UFO AUTO-LAUNCHING ROCKET at ${targetBalloon.name}!`);
            
            // DỪNG UFO trước khi bắn tên lửa
            car.canMove = false;
            car.speed = 0;
            car.vx = 0;
            car.vy = 0;
            setIsCarMoving(false);
          
            // Bắn tên lửa từ UFO
            const launched = rocketSystem.current.launchRocket(
              car,
              targetBalloon,
              null, // fakeTarget
              aliveBalloons,
              CAR_WIDTH,
              CAR_HEIGHT,
              SWORD_LENGTH
            );
          
            if (launched) {
              rocketSystem.current.rocketLaunched = true;
            
              // Set cooldown 3 giây (180 frames)
              gameRef.current.rocketCooldownTimer = 180;
              setRocketCooldown(3);
            
              // Chuyển camera theo rocket
              gameRef.current.cameraTarget = 'rocket';
            
              // Phát âm thanh rocket
              if (rocketFlyAudioRef.current) {
                rocketFlyAudioRef.current.currentTime = 0;
                rocketFlyAudioRef.current.volume = 0.3;
                rocketFlyAudioRef.current.play().catch(err => console.log('Rocket fly audio error:', err));
              }
            }
          }
        }
      }
      
      // Cập nhật cooldown timer cho rocket
      if (gameRef.current.rocketCooldownTimer > 0) {
        gameRef.current.rocketCooldownTimer--;
        const cooldownSeconds = Math.ceil(gameRef.current.rocketCooldownTimer / 60);
        setRocketCooldown(cooldownSeconds);
      } else {
        setRocketCooldown(0);
      }
      
      // Tăng tốc dần đều
      if (car.speed < car.maxSpeed * (car.speedMultiplier || 1)) {
        car.speed += car.acceleration;
      }
      
      // Cập nhật vận tốc theo hướng hiện tại
      car.vx = Math.sin(car.angle) * car.speed;
      car.vy = -Math.cos(car.angle) * car.speed;
      
      const oldX = car.x;
      const oldY = car.y;
      
      // Di chuyển
      car.x += car.vx;
      car.y += car.vy;
      
      // Kiểm tra va chạm với tường arena và PHẢN XẠ
      const distFromCenter = Math.sqrt(car.x * car.x + car.y * car.y);
      const UFO_RADIUS = 50;
      const UFO_COLLISION_RADIUS = 80; // Bán kính va chạm lớn hơn để dễ chạm
      
      if (distFromCenter + UFO_RADIUS > arenaRadius) {
        // Đã chạm tường, tính vector phản xạ
        const normalX = car.x / distFromCenter;
        const normalY = car.y / distFromCenter;
        
        const velX = car.vx;
        const velY = car.vy;
        
        // Tính phản xạ: v' = v - 2(v·n)n
        const dotProduct = velX * normalX + velY * normalY;
        car.vx = velX - 2 * dotProduct * normalX;
        car.vy = velY - 2 * dotProduct * normalY;
        
        // Thêm góc lệch random (±15 độ) để tránh lặp vô tận
        const randomAngleOffset = (Math.random() - 0.5) * (Math.PI / 6); // ±15 độ
        const currentAngle = Math.atan2(car.vx, -car.vy);
        const newAngle = currentAngle + randomAngleOffset;
        
        // Cập nhật vận tốc với góc mới
        const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
        car.vx = Math.sin(newAngle) * speed;
        car.vy = -Math.cos(newAngle) * speed;
        
        // Cập nhật góc dựa trên vận tốc mới
        car.angle = newAngle;
        
        // Đẩy đĩa bay ra khỏi tường
        const overlap = distFromCenter + UFO_RADIUS - arenaRadius;
        car.x -= normalX * overlap;
        car.y -= normalY * overlap;
        
        // Tạo hiệu ứng tia lửa
        for (let i = 0; i < 8; i++) {
          const sparkAngle = Math.atan2(car.y, car.x) + (Math.random() - 0.5) * 0.5;
          gameRef.current.sparks.push({
            x: car.x + normalX * UFO_RADIUS,
            y: car.y + normalY * UFO_RADIUS,
            vx: Math.cos(sparkAngle) * (Math.random() * 3 + 2),
            vy: Math.sin(sparkAngle) * (Math.random() * 3 + 2),
            life: 1,
            size: Math.random() * 3 + 2,
            color: '#ffaa00'
          });
        }
      }
      
      // Kiểm tra va chạm với bong bóng để trừ máu
      // Mỗi bong bóng có cooldown riêng, không dùng cooldown chung cho UFO
      for (let i = 0; i < balloons.length; i++) {
        const balloon = balloons[i];
        
        if (!balloon.alive) continue;
        
        const dx = balloon.x - car.x;
        const dy = balloon.y - car.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Dùng UFO_COLLISION_RADIUS lớn hơn để dễ chạm
        if (distance < UFO_COLLISION_RADIUS + balloon.radius) {
          // ĐẨY BONG BÓNG RA XA UFO (dù có shield hay không)
          const pushAngle = Math.atan2(dy, dx); // Góc từ UFO đến balloon
          const pushForce = 15; // Lực đẩy
          balloon.vx += Math.cos(pushAngle) * pushForce;
          balloon.vy += Math.sin(pushAngle) * pushForce;
          
          // Nếu có shield, chỉ đẩy, không damage
          if (balloon.shield) {
            createExplosion(balloon.x, balloon.y, balloon.color, 5); // Hiệu ứng nhỏ
            continue;
          }
          
          // Kiểm tra cooldown của BONG BÓNG NÀY (không phải cooldown chung)
          const currentFrame = gameRef.current.gameTimer;
          const timeSinceLastDamage = currentFrame - (balloon.lastDamageTime || 0);
          
          // Giảm cooldown xuống 30 frames (0.5 giây) để damage nhanh hơn
          if (timeSinceLastDamage >= 30) {
            // Ghi nhận thời gian damage cho BONG BÓNG NÀY
            balloon.lastDamageTime = currentFrame;
            gameRef.current.balloonData[balloon.name].lastDamageTime = currentFrame;
            
            // BẬT SHIELD tạm thời 0.5 giây (không phải 3 giây như shield ban đầu)
            balloon.shield = true;
            balloon.shieldTime = 2.5; // Set = 2.5 để sau 0.5s (khi += 1/60 đủ 60 frame) sẽ đạt 3.0 và tắt
            
            balloon.health--;
            gameRef.current.balloonData[balloon.name].health = balloon.health;
            
            // Thêm hiệu ứng số -1 bay lên
            gameRef.current.damageTexts.push({
              x: balloon.x,
              y: balloon.y - balloon.radius,
              vx: (Math.random() - 0.5) * 2,
              vy: -3,
              life: 1,
              text: '-1',
              color: '#ff4444',
              size: 24
            });
            
            createExplosion(balloon.x, balloon.y, balloon.color, 10);
            
            // CHỈ NỔ KHI health <= 0
            if (balloon.health <= 0) {
              balloon.alive = false;
              createExplosion(balloon.x, balloon.y, balloon.color);
              setEliminatedPlayers(prev => [...prev, balloon.name]);
              
              if (boomAudioRef.current) {
                boomAudioRef.current.currentTime = 0;
                boomAudioRef.current.play().catch(err => console.log('Boom audio play failed:', err));
              }
              
              // Dừng UFO và chuyển turn
              car.canMove = false;
              car.speed = 0;
              setIsCarMoving(false);
              
              setTimeout(() => {
                nextTurn();
              }, 500);
            }
            
            break; // Dừng vòng lặp sau khi damage 1 balloon
          }
        }
      }
      
      // Thêm vào quỹ đạo
      if (car.speed > 0.5) {
        gameRef.current.carTrail.push({
          x: oldX,
          y: oldY,
          alpha: 1,
          angle: car.angle
        });
      }
    } else if (car.isReversing) {
      // ===== CHẾ ĐỘ XE - Đang lùi =====
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
      // ===== CHẾ ĐỘ XE - Chạy bình thường =====
      // Reset và phát nhạc khi xe bắt đầu chạy lần đầu trong lượt này
      if (audioRef.current && !gameRef.current.audioStarted && !isMusicMuted) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.log('Audio play failed:', err));
        gameRef.current.audioStarted = true; // Đánh dấu đã phát âm thanh cho lượt này
      }
      
      // Tăng timer (60 fps = 1 giây sau 60 frames)
      gameRef.current.gameTimer++;
      
      // Cập nhật cooldown timer
      if (gameRef.current.rocketCooldownTimer > 0) {
        gameRef.current.rocketCooldownTimer--;
        const cooldownSeconds = Math.ceil(gameRef.current.rocketCooldownTimer / 60);
        setRocketCooldown(cooldownSeconds);
      } else {
        setRocketCooldown(0);
      }
      
      // Sau 20 giây (1200 frames), tăng tốc xe lên x2
      if (gameRef.current.gameTimer >= 1200 && !gameRef.current.speedBoosted) {
        car.speedMultiplier = 2;
        gameRef.current.speedBoosted = true;
        console.log('Speed boost activated! Car speed x2');
      }
      
      // Sau 35 giây (2100 frames), dừng xe và bắn tên lửa vào bong bóng ngẫu nhiên
      if (gameRef.current.gameTimer >= 2100 && !rocketSystem.current.rocketLaunched) {
        const aliveBalloons = balloons.filter(b => b.alive && !b.shield);
        if (aliveBalloons.length > 0) {
          const targetBalloon = aliveBalloons[Math.floor(Math.random() * aliveBalloons.length)];
          
          // CHỌN MỤC TIÊU GIẢ - bong bóng khác để tạo cảm giác hồi hộp
          const availableForFake = aliveBalloons.filter(b => b !== targetBalloon);
          let fakeTarget = null;
          
          if (availableForFake.length > 0) {
            // Ưu tiên chọn bong bóng gần mục tiêu thật để tạo cảm giác "suýt chạm"
            const sortedByDistanceToReal = availableForFake.map(balloon => {
              const dist = Math.sqrt(
                Math.pow(balloon.x - targetBalloon.x, 2) + 
                Math.pow(balloon.y - targetBalloon.y, 2)
              );
              return { balloon, dist };
            }).sort((a, b) => a.dist - b.dist);
            
            // Chọn 1 trong 3 bong bóng gần nhất mục tiêu thật
            const candidates = sortedByDistanceToReal.slice(0, Math.min(3, sortedByDistanceToReal.length));
            fakeTarget = candidates[Math.floor(Math.random() * candidates.length)].balloon;
          }
          
          // Bắn rocket sử dụng RocketSystem
          const launched = rocketSystem.current.launchRocket(
            car,
            targetBalloon,
            fakeTarget,
            aliveBalloons,
            CAR_WIDTH,
            CAR_HEIGHT,
            SWORD_LENGTH
          );
          
          if (launched) {
            // Dừng xe lại
            car.speed = 0;
            car.canMove = false;
            
            // CAMERA THEO ROCKET
            gameRef.current.cameraTarget = 'rocket';
            setCameraTarget('rocket');
            
            // Ẩn thanh đao và phát âm thanh laser
            gameRef.current.swordVisible = false;
            if (laserAudioRef.current) {
              laserAudioRef.current.currentTime = 0;
              laserAudioRef.current.play().catch(err => console.log('Laser audio error:', err));
            }
            if (rocketFlyAudioRef.current) {
              rocketFlyAudioRef.current.currentTime = 0;
              rocketFlyAudioRef.current.volume = 0.3;
              rocketFlyAudioRef.current.play().catch(err => console.log('Rocket fly audio error:', err));
            }
          }
        }
      }

      // Giảm cooldown né tránh
      if (car.dodgeCooldown > 0) {
        car.dodgeCooldown--;
      }

      // Kiểm tra né tránh bong bóng - NÂNG CAO để tồn tại lâu hơn
      if (!rocketSystem.current.isActive() && car.canMove) {
        const aliveBalloons = balloons.filter(b => b.alive);
        let closestBalloon = null;
        let closestDist = Infinity;
        let closestAngleDiff = 0;
        
        // Debug: Log số bong bóng còn sống
        if (gameRef.current.gameTimer % 60 === 0) { // Log mỗi giây
          console.log('DEBUG: Xe đang chạy, bong bóng sống:', aliveBalloons.length, 'canMove:', car.canMove, 'cooldown:', car.dodgeCooldown);
        }
        
        aliveBalloons.forEach(balloon => {
          const dx = balloon.x - car.x;
          const dy = balloon.y - car.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Tăng khoảng cách phát hiện lên 150px để có thời gian né sớm hơn
          if (dist < 150) {
            const angleToBalloon = Math.atan2(dx, -dy);
            let angleDiff = angleToBalloon - car.angle;
            if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // Debug: Log khi phát hiện bong bóng gần
            if (dist < 100 && gameRef.current.gameTimer % 30 === 0) {
              console.log('DEBUG: Bong bóng gần:', balloon.name, 'khoảng cách:', Math.round(dist), 'góc lệch:', Math.round(Math.abs(angleDiff) * 180 / Math.PI), '°');
            }
            
            // Chỉ né nếu xe đang hướng về phía bong bóng (trong góc 90 độ)
            if (Math.abs(angleDiff) < Math.PI / 2 && dist < closestDist) {
              closestBalloon = balloon;
              closestDist = dist;
              closestAngleDiff = angleDiff;
            }
          }
        });
        
        // Né tránh với xác suất cao hơn khi gần hơn
        let dodgeChance = 0;
        if (closestBalloon) {
          if (closestDist < 80) {
            dodgeChance = 1.0; // 100% khi rất gần (< 80px)
          } else if (closestDist < 120) {
            dodgeChance = 0.5; // 50% khi gần (80-120px)
          } else {
            dodgeChance = 0.2; // 20% khi xa hơn (120-150px)
          }
          
          // Debug: Log khi có ứng viên né tránh
          if (gameRef.current.gameTimer % 30 === 0) {
            console.log('DEBUG: Ứng viên né:', closestBalloon.name, 'khoảng cách:', Math.round(closestDist), 'tỷ lệ né:', dodgeChance * 100 + '%', 'cooldown:', car.dodgeCooldown);
          }
        }
        
        if (closestBalloon && Math.random() < dodgeChance && car.dodgeCooldown === 0) {
          // Né theo hướng an toàn nhất (ngược với vị trí bong bóng)
          // Nếu bong bóng ở bên trái, né sang phải và ngược lại
          const dodgeDirection = closestAngleDiff > 0 ? -1 : 1;
          
          // Quẹo mạnh hơn (120-150 độ) để thoát xa
          const dodgeAngle = (Math.PI * 2 / 3) + (Math.random() * Math.PI / 6); // 120-150 độ
          car.targetAngle = car.angle + dodgeAngle * dodgeDirection;
          
          car.dodgeTarget = closestBalloon;
          car.dodgeCooldown = 30; // Giảm cooldown xuống 0.5 giây để có thể né liên tục
          console.log('🚗 XE NÉ TRÁNH:', closestBalloon.name, 'khoảng cách:', Math.round(closestDist), 'hướng:', dodgeDirection > 0 ? 'phải' : 'trái', 'góc quẹo:', Math.round(dodgeAngle * 180 / Math.PI) + '°');
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
      if (!rocketSystem.current.isActive()) {
        car.speed = 3 * (car.speedMultiplier || 1);
      } else {
        car.speed = 0; // Dừng xe khi có tên lửa
      }
    }

    // Di chuyển xe (chỉ cho chế độ xe, UFO đã tự di chuyển)
    if (!car.isUFO) {
      const oldX = car.x;
      const oldY = car.y;
      
      car.x += Math.sin(car.angle) * car.speed;
      car.y -= Math.cos(car.angle) * car.speed;

      // Thêm vào quỹ đạo nếu xe đang di chuyển (tạo đuôi lửa)
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
    const isTruckCollision = gameRef.current.isTruck;
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
    } // Đóng if (!car.isUFO)

    // Camera theo xe, balloon hoặc tên lửa tùy theo cameraTarget
    if (gameRef.current.followCar) {
      // Ưu tiên focus vị trí nổ nếu vừa nổ xong
      if (gameRef.current.explosionLocation) {
        camera.x = gameRef.current.explosionLocation.x;
        camera.y = gameRef.current.explosionLocation.y;
      } else if (rocketSystem.current.rocket) {
        // Focus tên lửa nếu đang có tên lửa bay (ưu tiên cho cả UFO và Car mode)
        camera.x = rocketSystem.current.rocket.x;
        camera.y = rocketSystem.current.rocket.y;
      } else if (gameRef.current.rocket) {
        // Fallback cho rocket cũ
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

    // Cập nhật bong bóng - CHẠY CHO CẢ 2 CHẾ ĐỘ
    if (balloons && balloons.length > 0) {
      balloons.forEach((balloon, i) => {
        if (!balloon.alive) return;

        // Cập nhật thời gian khiên - tăng dần và tự động tắt sau 3 giây
        // Chạy cho cả 2 mode (không cần car.canMove)
        if (balloon.shield && balloon.alive) {
          balloon.shieldTime += 1/60; // Tăng theo frame (60fps)
          if (balloon.shieldTime >= 3) {
            balloon.shield = false;
            balloon.shieldTime = 3; // Đánh dấu đã hết khiên
          }
        }

        // CHỈ KIỂM TRA VÀ MŨI KIẾM Ở CHẾ ĐỘ XE
        if (!car.isUFO) {
          const isTruck = gameRef.current.isTruck;
          const vehicleHeight = isTruck ? CAR_HEIGHT * 2 : CAR_HEIGHT;
          const swordTipX = car.x + Math.sin(car.angle) * (vehicleHeight / 2 + SWORD_LENGTH);
          const swordTipY = car.y - Math.cos(car.angle) * (vehicleHeight / 2 + SWORD_LENGTH);
          
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

          // Va chạm với xe (đẩy bong bóng)
          const carDx = car.x - balloon.x;
          const carDy = car.y - balloon.y;
          const carDist = Math.sqrt(carDx * carDx + carDy * carDy);
          const vWidthCollision = isTruck ? CAR_WIDTH * 2 : CAR_WIDTH;

          if (carDist < balloon.radius + vWidthCollision / 2) {
            const angle = Math.atan2(carDy, carDx);
            const overlap = balloon.radius + vWidthCollision / 2 - carDist;
            balloon.x -= Math.cos(angle) * overlap;
            balloon.y -= Math.sin(angle) * overlap;
            
            balloon.vx -= Math.cos(angle) * car.speed * 0.5;
            balloon.vy -= Math.sin(angle) * car.speed * 0.5;
          }
        }

        // Va chạm giữa các bong bóng - CHO CẢ 2 CHẾ ĐỘ
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

        // Cập nhật vị trí - CHO CẢ 2 CHẾ ĐỘ
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

        // Giữ bong bóng trong arena - CHO CẢ 2 CHẾ ĐỘ
        const bDist = Math.sqrt(balloon.x * balloon.x + balloon.y * balloon.y);
        if (bDist > arenaRadius - balloon.radius) {
          const angle = Math.atan2(balloon.y, balloon.x);
          balloon.x = Math.cos(angle) * (arenaRadius - balloon.radius);
          balloon.y = Math.sin(angle) * (arenaRadius - balloon.radius);
          balloon.vx *= -0.7;
          balloon.vy *= -0.7;
        }
      });
    } // Đóng if (balloons && balloons.length > 0)

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
    if (gameRef.current.sparks && gameRef.current.sparks.length > 0) {
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
    }
    
    // Cập nhật damage texts (số -1 bay lên)
    if (gameRef.current.damageTexts && gameRef.current.damageTexts.length > 0) {
      for (let i = gameRef.current.damageTexts.length - 1; i >= 0; i--) {
        const dmg = gameRef.current.damageTexts[i];
        dmg.x += dmg.vx;
        dmg.y += dmg.vy;
        dmg.vy -= 0.1; // Bay lên chậm dần
        dmg.life -= 0.015;
        dmg.size *= 0.98; // Thu nhỏ dần
        
        if (dmg.life <= 0) {
          gameRef.current.damageTexts.splice(i, 1);
        }
      }
    }
    
    // Cập nhật quỹ đạo xe (giảm chậm hơn để đuôi lửa dài hơn)
    const trail = gameRef.current.carTrail;
    if (trail && trail.length > 0) {
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].alpha -= 0.03;
        if (trail[i].alpha <= 0) {
          trail.splice(i, 1);
        }
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
    
    // Vẽ xe/UFO với vị trí hiện tại
    ctx.save();
    ctx.translate(size / 2 + car.x * scale, size / 2 + car.y * scale);
    ctx.rotate(car.angle);
    
    if (car.isUFO) {
      // Vẽ UFO trên minimap - nhấp nháy xanh đỏ
      const blinkColor = Math.floor(Date.now() / 300) % 2 === 0 ? '#00ffff' : '#ff0000';
      
      // Thân UFO
      ctx.fillStyle = blinkColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Vòm UFO
      ctx.fillStyle = blinkColor === '#00ffff' ? '#00cccc' : '#cc0000';
      ctx.beginPath();
      ctx.ellipse(0, -2, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Ánh sáng dưới UFO
      ctx.fillStyle = blinkColor === '#00ffff' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.lineTo(-8, 6);
      ctx.lineTo(8, 6);
      ctx.lineTo(5, 2);
      ctx.closePath();
      ctx.fill();
    } else {
      // Vẽ xe
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
    }
    
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

    // Vẽ bong bóng - sử dụng BalloonRenderer
    try {
      balloonRenderer.current.drawAll(ctx, balloons);
    } catch (err) {
      console.error('Error drawing balloons:', err);
    }

    // Vẽ bóng đuôi lửa phía sau xe (chỉ khi xe chạy và KHÔNG phải UFO)
    if (!car.isUFO && Math.abs(car.speed) > 0.5) {
      const trail = gameRef.current.carTrail;
      const isTrailTruck = gameRef.current.isTruck;
      trail.forEach((point, i) => {
        ctx.save();
        const fadeAlpha = point.alpha * (i / trail.length) * 0.6;
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(point.x, point.y);
        ctx.rotate(point.angle);
        
        if (isTrailTruck) {
          // Xe tải: Hai đuôi lửa hai bên phía sau thùng xe
          for (let side of [-1, 1]) {
            const xOffset = side * (CAR_WIDTH * 0.8); // Vị trí hai bên thùng xe tải
            const yOffset = CAR_HEIGHT * 2 * 0.5; // Phía sau thùng xe (truck height * 2)
            const particleSize = 12 + (i / trail.length) * 18;
            const gradient = ctx.createRadialGradient(xOffset, yOffset, 0, xOffset, yOffset, particleSize);
            gradient.addColorStop(0, 'rgba(255, 140, 0, 0.8)'); // Cam sáng
            gradient.addColorStop(0.4, 'rgba(231, 76, 60, 0.6)'); // Đỏ
            gradient.addColorStop(1, 'rgba(231, 76, 60, 0)'); // Mờ dần
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(xOffset, yOffset, particleSize, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Reset rocket flag để có thể bắn lại
          rocketSystem.current.rocketLaunched = false;
          
          // Reset camera về car sau khi nổ
          setTimeout(() => {
            gameRef.current.cameraTarget = 'car';
          }, 500);
        } else {
          // Xe cảnh sát: Một đuôi lửa giữa phía sau xe
          const yOffset = CAR_HEIGHT * 0.5; // Phía sau xe cảnh sát
          const particleSize = 8 + (i / trail.length) * 12;
          const gradient = ctx.createRadialGradient(0, yOffset, 0, 0, yOffset, particleSize);
          gradient.addColorStop(0, 'rgba(255, 140, 0, 0.8)'); // Cam sáng
          gradient.addColorStop(0.4, 'rgba(231, 76, 60, 0.6)'); // Đỏ
          gradient.addColorStop(1, 'rgba(231, 76, 60, 0)'); // Mờ dần
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, yOffset, particleSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      });
    }

    // Vẽ tên lửa nếu có - sử dụng RocketSystem
    rocketSystem.current.draw(ctx);

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

    // Vẽ damage texts (số -1 bay lên)
    gameRef.current.damageTexts.forEach(dmg => {
      ctx.save();
      ctx.globalAlpha = dmg.life;
      ctx.font = `bold ${dmg.size}px Arial`;
      ctx.fillStyle = dmg.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Viền đen
      ctx.strokeText(dmg.text, dmg.x, dmg.y);
      // Chữ đỏ
      ctx.fillText(dmg.text, dmg.x, dmg.y);
      ctx.restore();
    });

    // Vẽ đĩa bay (UFO) hoặc xe
    if (car.isUFO) {
      // VẼ ĐĨA BAY - sử dụng UFORenderer
      try {
        ufoRenderer.current.draw(ctx, car);
      } catch (err) {
        console.error('Error drawing UFO:', err);
      }
    } else {
      // VẼ XE - sử dụng CarRenderer
      try {
        carRenderer.current.draw(
          ctx, 
          car, 
          balloons, 
          gameRef.current.gameTimer,
          gameRef.current.swordVisible,
          gameRef.current.animalImages
        );
      } catch (err) {
        console.error('Error drawing car:', err);
      }
    }
    
    ctx.restore();
  };



  const nextTurn = () => {
    // Validation - đảm bảo balloons tồn tại
    if (!gameRef.current.balloons || gameRef.current.balloons.length === 0) {
      console.error('nextTurn called but no balloons exist');
      return;
    }
    
    const aliveBalloons = gameRef.current.balloons.filter(b => b && b.alive);
    
    // Validation - đảm bảo có ít nhất 1 balloon sống
    if (!aliveBalloons || aliveBalloons.length === 0) {
      console.error('No alive balloons found');
      return;
    }
    
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
    if (newPlayer.trim() && players.length < 30) {
      const name = newPlayer.trim().split(' ')[0]; // Chỉ lấy từ đầu tiên
      setPlayers([...players, name]);
      setNewPlayer('');
    }
  };

  const addRandomPlayer = () => {
    if (players.length >= 30) return;
    
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
    const numToAdd = Math.min(30 - players.length, availableNames.length);
    
    if (numToAdd === 0) {
      alert('Đã đủ 30 người chơi hoặc hết tên!');
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

            {players.length < 30 && (
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
                    🚀 VTCODE
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
          
          {/* Checkbox cho chế độ đĩa bay */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem',
            backgroundColor: 'rgba(138, 43, 226, 0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: '0.5rem'
          }}>
            <input
              type="checkbox"
              checked={ufoMode}
              onChange={(e) => setUfoMode(e.target.checked)}
              style={{width: '20px', height: '20px', cursor: 'pointer'}}
            />
            <span style={{fontSize: '0.9rem', fontWeight: 'bold'}}>
              🛸 Chế độ đĩa bay (UFO)
            </span>
          </label>
          
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
            {ufoMode ? (
              <>
                <p>🛸 <strong>Đĩa bay tự động bay thẳng và dội khi chạm tường</strong></p>
                <p>❤️ Mỗi bong bóng có <strong>3 máu</strong> - chạm để trừ máu!</p>
                <p>💥 Bong bóng nổ khi hết máu!</p>
              </>
            ) : (
              <>
                <p>🚗 <strong>Xe tự động chạy ngẫu nhiên</strong></p>
                <p>⚔️ Dùng mũi kiếm để đâm bong bóng đối thủ!</p>
              </>
            )}
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
        
        {/* Nút toggle nhạc nền */}
        <span 
          onClick={toggleMusic}
          style={{
            position: 'absolute',
            top: '5px',
            right: '170px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            // border: '2px solid rgba(255, 255, 255, 0.3)',
            backgroundColor: 'transparent !important',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
            zIndex: 1000
          }}
          title={isMusicMuted ? 'Bật nhạc nền' : 'Tắt nhạc nền'}
        >
          {isMusicMuted ? '🤐' : '🤬'}
        </span>
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
            {/* Hiển thị máu khi ở UFO mode */}
            {ufoMode && balloon.alive && balloon.health !== undefined && (
              <span className="player-health" style={{
                fontSize: '12px',
                marginLeft: '5px',
                color: balloon.health > 3 ? '#4ade80' : balloon.health > 1 ? '#fbbf24' : '#ef4444',
                fontWeight: 'bold'
              }}>
                ❤️{balloon.health}/{balloon.maxHealth || 5}
              </span>
            )}
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
              if (audioRef.current && !isMusicMuted) {
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

      {/* Nút Rocket Cooldown - góc dưới phải */}
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        right: '2rem',
        width: '80px',
        height: '80px',
      }}>
        <svg width="80" height="80" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: 'rotate(-90deg)'
        }}>
          {/* Background circle */}
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="6"
          />
          {/* Progress circle */}
          {rocketCooldown > 0 && (
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="#ef4444"
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 35}`}
              strokeDashoffset={`${2 * Math.PI * 35 * (1 - rocketCooldown / 3)}`}
              style={{
                transition: 'stroke-dashoffset 0.1s linear'
              }}
            />
          )}
          {rocketCooldown === 0 && (
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="#10b981"
              strokeWidth="6"
            />
          )}
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: rocketCooldown > 0 ? '1.5rem' : '2rem',
          fontWeight: 'bold',
          color: 'white',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          pointerEvents: 'none'
        }}>
          {rocketCooldown > 0 ? rocketCooldown : '🚀'}
        </div>
      </div>
    </div>
  );
};

export default BalloonCarGame;