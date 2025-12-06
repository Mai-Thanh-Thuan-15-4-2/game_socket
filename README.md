# Balloon Car Game

Multiplayer balloon car racing game with real-time socket communication.

## Structure

- `/client` - React frontend
- `/server` - Node.js + Socket.io backend

## Local Development

### Server
```bash
cd server
npm install
npm start
```

### Client
```bash
cd client
npm install
npm start
```

## Deploy to Vercel

This project is configured for Vercel deployment with monorepo structure.

1. Push code to GitHub
2. Import project to Vercel
3. Vercel will automatically detect the configuration

## Environment Variables

For production, set:
- Client will connect to your Vercel server URL automatically
- Server runs on Vercel serverless functions
