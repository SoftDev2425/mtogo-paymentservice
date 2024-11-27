import express from 'express';
import paymentController from '../controllers/payment.controller';
import { requireCustomer } from '../middlewares/role';

const router = express.Router();

router.post(
  '/order/process',
  requireCustomer,
  paymentController.handleOrderPayment,
);

// router.post('/order/process', (req: Request, res: Response) => {
//   console.log('Received data:', req.body); // This should now log the correct data
//   res.status(200).send({ success: true });
// });

export default router;
