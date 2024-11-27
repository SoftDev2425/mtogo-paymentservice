import { Request, Response } from 'express';
import { NotFoundError } from '../utils/NotFoundErrorClass';
import { pay } from '../services/payment.service';

const handleOrderPayment = async (req: Request, res: Response) => {
  try {
    const data = req.body;

    const payment = await pay(data, req.email as string);

    res.status(200).json({
      payment,
    });
  } catch (e) {
    if (e instanceof NotFoundError || (e as Error).name === 'NotFoundError') {
      return res.status(404).json({ error: (e as Error).message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  handleOrderPayment,
};
