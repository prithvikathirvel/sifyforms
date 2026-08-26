import { Router } from 'express';
import { initiatePayment, handlePaymentResponse, checkPaymentStatus } from '../controllers/express/payment.controller';

const router = Router();

router.post('/initiate', initiatePayment);
router.post('/response', handlePaymentResponse);
router.get('/status/:orderId', checkPaymentStatus);

export default router;
