# Balloon Car Game - Client

Multiplayer balloon car racing game frontend built with React.

## Server Repository

Backend server: [game_socket_server](https://github.com/Mai-Thanh-Thuan-15-4-2/game_socket_server)

## Live Demo

- **Client**: https://game-socket-7fls.vercel.app
- **Server**: https://game-socket-ekv1.vercel.app

## Local Development

```bash
cd client
npm install
npm start
```

The app will connect to `http://localhost:3001` in development, or the production server URL when deployed.

## Environment Variables

- `REACT_APP_SOCKET_URL`: Socket.io server URL (default: http://localhost:3001)

## Deploy to Vercel

This project is configured for automatic Vercel deployment. Push to GitHub and Vercel will build and deploy automatically.
