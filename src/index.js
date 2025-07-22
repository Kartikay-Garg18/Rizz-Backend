import app from './app.js'
import connectDB from "./db/index.js";
import dotenv from "dotenv";
import { server, io } from './utils/socket.js'

// Load environment variables
dotenv.config({
    path: './.env'
});

// Direct server-level CORS handler for all requests
// This ensures CORS headers are sent even if Express middleware isn't hit
server.on('request', (req, res) => {
    const oldEnd = res.end;
    const oldWriteHead = res.writeHead;
    const oldSetHeader = res.setHeader;
    
    // Override setHeader to ensure our CORS headers aren't overwritten
    res.setHeader = function(name, value) {
        if (name.toLowerCase() === 'access-control-allow-origin') return;
        if (name.toLowerCase() === 'access-control-allow-methods') return;
        if (name.toLowerCase() === 'access-control-allow-headers') return;
        if (name.toLowerCase() === 'access-control-allow-credentials') return;
        return oldSetHeader.apply(this, arguments);
    };
    
    // Override writeHead to inject CORS headers
    res.writeHead = function(statusCode, statusMessage, headers) {
        let newHeaders = headers || {};
        
        if (typeof statusMessage === 'object') {
            newHeaders = statusMessage;
            statusMessage = undefined;
        }
        
        // Force CORS headers
        newHeaders['Access-Control-Allow-Origin'] = '*';
        newHeaders['Access-Control-Allow-Methods'] = 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS';
        newHeaders['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
        
        if (statusMessage) {
            return oldWriteHead.call(this, statusCode, statusMessage, newHeaders);
        }
        return oldWriteHead.call(this, statusCode, newHeaders);
    };
    
    // Override end to ensure CORS headers are sent
    res.end = function() {
        // Ensure CORS headers are set before ending response
        res.setHeader = oldSetHeader; // Restore original for this call
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        // Special handling for OPTIONS requests
        if (req.method === 'OPTIONS') {
            console.log('HTTP SERVER LEVEL: Intercepted OPTIONS request for:', req.url);
            res.statusCode = 204;
            return oldEnd.call(this, '');
        }
        
        return oldEnd.apply(this, arguments);
    };
});

const PORT = process.env.PORT || 3000;
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enhanced server startup with proper error handling
const startServer = async () => {
    console.log(`Starting server in ${NODE_ENV} environment`);
    
    try {
        // Connect to database
        console.log('Connecting to database...');
        await connectDB();
        console.log('Database connected successfully');
        
        // Handle global unhandled errors
        setupErrorHandlers();
        
        // Handle serverless environment gracefully
        if (IS_VERCEL) {
            console.log('Running on Vercel serverless environment');
            
            // For Vercel, we export the app/server instead of listening
            if (module && module.exports) {
                module.exports = server;
            }
            
            // Log socket.io configuration
            console.log(`Socket.IO configured with transports: ${io.engine.opts.transports.join(', ')}`);
            console.log(`Socket.IO CORS configuration: ${JSON.stringify(io.engine.opts.cors)}`);
            
            // Log middleware count as a simple check
            console.log(`Express app has ${app._router.stack.length} middleware functions registered`);
        } else {
            // For traditional environments, listen on port
            server.listen(PORT, () => {
                console.log(`Server is running on port ${PORT}`);
                console.log(`Socket.IO server available at ${PORT}/socket.io/`);
            });
            
            // Setup graceful shutdown for non-serverless environments
            setupGracefulShutdown();
        }
    } catch (err) {
        console.error(`Server startup error: ${err.message}`);
        console.error(err.stack);
        
        // Don't exit process in production - allow for recovery
        if (NODE_ENV !== 'production') {
            console.error('Exiting due to startup failure in development mode');
            process.exit(1);
        }
    }
};

// Enhanced error handlers
const setupErrorHandlers = () => {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION:');
        console.error(error.stack || error);
        
        // Only exit in development - in production we want to try to keep running
        if (NODE_ENV !== 'production') {
            process.exit(1);
        }
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('UNHANDLED REJECTION:');
        console.error(reason);
    });
};

// Setup graceful shutdown (not relevant for serverless, but good for development)
const setupGracefulShutdown = () => {
    const shutdown = () => {
        console.log('Received shutdown signal');
        
        // Close socket.io server first
        io.close(() => {
            console.log('Socket.IO server closed');
            
            // Then close HTTP server
            server.close(() => {
                console.log('HTTP server closed');
                process.exit(0);
            });
            
            // Force close after timeout
            setTimeout(() => {
                console.error('Could not close connections in time, forcing shutdown');
                process.exit(1);
            }, 10000);
        });
    };
    
    // Listen for termination signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
};

// Start the server
startServer();