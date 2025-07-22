import app from './app.js'
import connectDB from "./db/index.js";
import dotenv from "dotenv";
import { server, io } from './utils/socket.js'

// Load environment variables
dotenv.config({
    path: './.env'
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