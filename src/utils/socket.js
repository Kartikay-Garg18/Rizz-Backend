import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const userSocketMap = {};

// Improved Socket.io configuration for Vercel deployment
const io = new Server(server, {
    cors: {
        // Use explicit origin for production or allow all for development
        origin: process.env.NODE_ENV === 'production' 
            ? [process.env.CORS_ORIGIN, /\.vercel\.app$/] 
            : "*",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
    },
    allowEIO3: true, // Allow Engine.IO v3 compatibility
    transports: ['websocket', 'polling'], // Support both WebSocket and polling
    pingTimeout: 60000, // Increased timeout for serverless environments
    pingInterval: 25000, // More frequent pings to keep connection alive
    maxHttpBufferSize: 1e8, // Increased buffer size for larger payloads
    connectTimeout: 60000, // Longer connect timeout for slow connections
    path: '/socket.io/', // Standard path for socket.io
    // Additional settings for improved reliability in serverless environments
    upgradeTimeout: 30000, // Longer timeout for WebSocket upgrade
    allowUpgrades: true, // Allow transport upgrades
    perMessageDeflate: {
        threshold: 2048, // Only compress data if message is larger than this value
        zlibDeflateOptions: {
            level: 6, // Compression level (0-9, where 9 is max compression)
            memLevel: 8, // Memory level (1-9, where 9 is max memory usage)
        },
    },
});

const getSocketId = (userId) => {
    return userSocketMap[userId];
};

io.on("connection", (socket) => {
    const user = socket.handshake.query.userId;
    const clientType = socket.handshake.query.clientType || 'unknown';
    
    console.log(`Socket connected: ${socket.id} for user: ${user}, transport: ${socket.conn.transport.name}, client: ${clientType}`);
    
    if (user && user !== 'undefined') {
        // If user already has a socket, keep track of it before overwriting
        const existingSocketId = userSocketMap[user];
        
        // Store the new socket ID for this user ID
        userSocketMap[user] = socket.id;
        
        // Handle different ID formats for better compatibility
        try {
            // Store a normalized version to handle various ID formats
            const cleanId = user.toString().replace(/^ObjectId\(['"](.+)['"]\)$/, '$1');
            userSocketMap[cleanId] = socket.id;
            
            // Handle MongoDB ObjectId format variations
            if (cleanId.match(/^[0-9a-fA-F]{24}$/)) {
                userSocketMap[cleanId] = socket.id;
            }
        } catch (err) {
            console.error(`Error handling user ID: ${err.message}`);
        }
        
        // If this is a new connection (not a reconnection), notify all users
        if (existingSocketId !== socket.id) {
            io.emit("onlineUsers", Object.keys(userSocketMap));
        }
        
        // Confirm connection back to the user
        socket.emit("connectionConfirmed", {
            socketId: socket.id,
            transport: socket.conn.transport.name
        });
    }

    // Monitor transport changes (e.g., from polling to websocket)
    socket.conn.on('upgrade', (transport) => {
        console.log(`Socket ${socket.id} transport upgraded from ${socket.conn.transport.name} to ${transport.name}`);
    });

    socket.on("disconnect", (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        
        if (user && user !== 'undefined') {
            // Add a longer delay for disconnection to handle temporary network issues
            // Don't remove the user immediately to avoid flickering online status
            const disconnectionTimeout = setTimeout(() => {
                // Check if the user has reconnected with a different socket
                const currentSocketForUser = userSocketMap[user];
                if (currentSocketForUser === socket.id) {
                    // Only delete if this socket is still the one mapped to the user
                    delete userSocketMap[user];
                    io.emit("onlineUsers", Object.keys(userSocketMap));
                    console.log(`User ${user} removed from online users after disconnect timeout`);
                }
            }, 10000); // Longer timeout to allow for reconnection
            
            // Store the timeout so it can be cleared if needed
            socket.disconnectionTimeout = disconnectionTimeout;
        }
    });
    
    // Handle manual requests for online users list
    socket.on("getOnlineUsers", () => {
        socket.emit("onlineUsers", Object.keys(userSocketMap));
    });
    
    // Handle heartbeat to detect zombie connections
    socket.on("heartbeat", (data, callback) => {
        if (typeof callback === 'function') {
            callback({ status: "ok", timestamp: Date.now() });
        }
    });
    
    socket.on("error", (error) => {
        console.error(`Socket error for ${socket.id}: ${error?.message || 'Unknown error'}`);
    });
});

export { io, app, server, getSocketId, userSocketMap };