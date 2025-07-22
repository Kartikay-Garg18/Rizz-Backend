import express from "express";
import session from 'express-session'
import userRouter from './routes/user.routes.js'
import messageRouter from './routes/message.routes.js'
import cors from 'cors'
import {app} from './utils/socket.js'

// Improved CORS configuration for Vercel
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? [process.env.CORS_ORIGIN, /\.vercel\.app$/] 
        : process.env.CORS_ORIGIN || "*",
    credentials: true,
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Setup middleware with optimizations for serverless
app.use(express.json({ 
    limit: '50mb',
    // Add buffers for improved reliability
    verify: (req, res, buf) => {
        // Store raw body buffer for potential verification needs
        req.rawBody = buf;
    }
}));

app.use(express.urlencoded({ 
    limit: '50mb', 
    extended: true 
}));

// Serve static files
app.use(express.static('public', {
    maxAge: '1d', // Cache static content for 1 day
    etag: true    // Use ETags for caching
}));

// Configure session with serverless optimizations
const sessionConfig = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Only save session when data exists
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Only secure in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax' // Helps with CSRF protection
    }
};

app.use(session(sessionConfig));

// Add basic request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
});

app.use('/auth', userRouter);
app.use('/messages', messageRouter);

app.get('/', (req, res) => {
    res.send('Welcome to the Chat Application API');
});

export default app;