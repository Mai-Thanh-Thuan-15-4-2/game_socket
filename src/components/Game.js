import React, { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { io } from 'socket.io-client';
import GameScene from './GameScene';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

function Game({ username, roomId, onLeaveGame }) {
  const [socket, setSocket] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState({});
  const [notifications, setNotifications] = useState([]);
  const notificationTimeoutRef = useRef(null);

  useEffect(() => {
    // Kết nối socket
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Join room
    newSocket.emit('joinRoom', { username, roomId });

    // Lắng nghe sự kiện
    newSocket.on('playerJoined', ({ playerId, gameState }) => {
      setPlayerId(playerId);
      const playersMap = {};
      gameState.players.forEach(player => {
        playersMap[player.id] = player;
      });
      setPlayers(playersMap);
    });

    newSocket.on('newPlayer', ({ player }) => {
      setPlayers(prev => ({
        ...prev,
        [player.id]: player
      }));
      showNotification(`${player.username} đã tham gia game!`);
    });

    newSocket.on('playerMoved', ({ playerId, position, velocity }) => {
      setPlayers(prev => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          position,
          velocity
        }
      }));
    });

    newSocket.on('playerLeft', ({ playerId }) => {
      setPlayers(prev => {
        const newPlayers = { ...prev };
        const playerName = newPlayers[playerId]?.username;
        delete newPlayers[playerId];
        if (playerName) {
          showNotification(`${playerName} đã rời khỏi game`);
        }
        return newPlayers;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [username, roomId]);

  const showNotification = (message) => {
    setNotifications(prev => [...prev, { id: Date.now(), message }]);
    
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    notificationTimeoutRef.current = setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 3000);
  };

  const handlePositionUpdate = (position, velocity) => {
    if (socket && playerId) {
      socket.emit('updatePosition', { position, velocity });
      
      // Cập nhật local
      setPlayers(prev => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          position,
          velocity
        }
      }));
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.disconnect();
    }
    onLeaveGame();
  };

  const totalPlayers = Object.keys(players).length;

  return (
    <>
      <Canvas
        camera={{ position: [0, 30, 30], fov: 60 }}
        shadows
      >
        <GameScene
          playerId={playerId}
          players={players}
          onPositionUpdate={handlePositionUpdate}
        />
      </Canvas>

      <div className="game-ui">
        <button className="leave-button" onClick={handleLeave}>
          Rời Khỏi Game
        </button>

        <div className="hud">
          <h3>🎈 Bubble Game</h3>
          <p>Phòng: {roomId}</p>
          <p>Tên: {username}</p>
          <p>Người chơi: {totalPlayers}</p>
        </div>

        <div className="players-list">
          <h3>👥 Người chơi ({totalPlayers})</h3>
          {Object.values(players).map(player => (
            <div
              key={player.id}
              className="player-item"
              style={{ borderLeftColor: player.color }}
            >
              <span style={{ color: player.color }}>●</span> {player.username}
              {player.id === playerId && ' (You)'}
            </div>
          ))}
        </div>

        <div className="controls-info">
          <h4>⌨️ Điều khiển:</h4>
          <p>W/A/S/D - Di chuyển</p>
          <p>Space - Bay lên</p>
          <p>Shift - Bay xuống</p>
        </div>

        {notifications.map(notif => (
          <div key={notif.id} className="notification">
            {notif.message}
          </div>
        ))}
      </div>
    </>
  );
}

export default Game;
