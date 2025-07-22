import express from "express";
import session from 'express-session'
import userRouter from './routes/user.routes.js'
import messageRouter from './routes/message.routes.js'
import cors from 'cors'
import {app} from './utils/socket.js'

// Improved CORS configuration for Vercel with explicit domains
const corsOptions = {
    origin: function(origin, callback) {
        // Allow all origins in development
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        // List of allowed domains in production
        const allowedOrigins = [
            'https://rizz-frontend-two.vercel.app',
            'https://wchat-client.vercel.app',
            'https://rizz-frontend.vercel.app',
            process.env.CORS_ORIGIN
        ].filter(Boolean); // Remove undefined/null values
        
        // Always allow requests with no origin (like mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        
        // Check if the origin is in our allowlist
        if (allowedOrigins.indexOf(origin) !== -1 || origin.match(/\.vercel\.app$/)) {
            return callback(null, true);
        }
        
        console.log(`CORS blocked request from origin: ${origin}`);
        return callback(null, true); // Temporarily allow all origins while debugging
    },
    credentials: true,
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400 // Cache preflight response for 24 hours
}

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Manual CORS headers for problematic clients
app.use((req, res, next) => {
    // Set CORS headers for every response
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    next();
});

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

// Add basic request logging with CORS debugging
app.use((req, res, next) => {
    const start = Date.now();
    
    // Log incoming request details
    console.log(`REQUEST: ${req.method} ${req.originalUrl}`);
    console.log(`HEADERS: Origin=${req.headers.origin}, Referer=${req.headers.referer}`);
    
    // For OPTIONS requests, explicitly handle CORS preflight
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS preflight request');
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '86400'); // 24 hours
        res.status(204).end();
        return;
    }
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`RESPONSE: ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
        
        // Log CORS-related response headers for debugging
        const corsHeaders = {
            'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
            'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials'),
            'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods'),
            'access-control-allow-headers': res.getHeader('Access-Control-Allow-Headers')
        };
        console.log('CORS Headers:', corsHeaders);
    });
    
    next();
});

app.use('/auth', userRouter);
app.use('/messages', messageRouter);

app.get('/', (req, res) => {
    res.send('Welcome to the Chat Application API');
});

export default app;