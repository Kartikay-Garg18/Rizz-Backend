import { Router } from "express";
import { createUser, getCurrentUser, loginUser, googleLoginUser, forgotPassword, resetPassword } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import cors from 'cors';

const router = Router();

// Configure permissive CORS for all auth routes
const authCors = cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: false
});

// Apply CORS to all routes
router.use(authCors);

// Special handler for OPTIONS requests
router.options('*', (req, res) => {
    console.log('AUTH ROUTER: OPTIONS request received for', req.path);
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.sendStatus(204);
});

// Special wrapper for adding CORS headers to all responses
const withCors = (handler) => {
    return (req, res, next) => {
        // Force CORS headers on every response
        const originalSend = res.send;
        res.send = function() {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
            return originalSend.apply(res, arguments);
        };
        return handler(req, res, next);
    };
};

// Use our wrapper for each route
router.route('/register').post(withCors(createUser));

router.route('/login')
    .options((req, res) => {
        console.log('Explicit OPTIONS handler for /login');
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        res.sendStatus(204);
    })
    .post(withCors(loginUser));

router.route('/user').get(verifyJWT, withCors(getCurrentUser));

router.route('/google').post(withCors(googleLoginUser));

router.route('/forgot')
    .post(withCors(forgotPassword))
    .patch(withCors(resetPassword))

export default router;