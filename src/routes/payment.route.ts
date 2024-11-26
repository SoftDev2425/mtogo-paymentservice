import express from 'express';
import paymentController from '../controllers/payment.controller';
import { requireCustomer } from '../middlewares/role';

const router = express.Router();

router.post('/order/process', requireCustomer, paymentController.handleOrderPayment);

export default router;
