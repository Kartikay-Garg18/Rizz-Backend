import { Router } from "express";
import { getUsersForSidebar , getMessages , sendMessage} from "../controllers/message.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import cors from 'cors';

const router = Router();

// Configure permissive CORS for all message routes
const messageCors = cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: false
});

// Apply CORS to all routes
router.use(messageCors);

// Special handler for OPTIONS requests
router.options('*', (req, res) => {
    console.log('MESSAGE ROUTER: OPTIONS request received for', req.path);
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.sendStatus(204);
});

router.route('/user').get(verifyJWT, getUsersForSidebar);
router.route('/:id').get(verifyJWT, getMessages);
router.route('/send/:id').post(
    upload.array('images'),
    verifyJWT, 
    sendMessage
);

export default router;