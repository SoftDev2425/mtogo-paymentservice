import { Request, Response } from 'express';
import { NotFoundError } from '../utils/NotFoundErrorClass';
import { pay } from '../services/user.service';

const handleOrderPayment = async (_req: Request, res: Response) => {
  try {
    const user = await pay();

    res.status(200).json(user);
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
