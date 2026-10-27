import express from 'express';
import { AuthController } from '../controllers/authController.ts';

const router = express.Router();

router.post('/login', AuthController.login);
router.post('/signup', AuthController.signup);
router.get('/logout', AuthController.logout);


export default router;