type PaymentData = {
  amount: number;
  address: {
    recipentName: string;
    street: string;
    city: string;
    zip: string;
    floor?: string;
  };
  payment: {
    method: 'MASTER_CARD' | 'VISA';
  };
};

type StripeCustomer = {
  id: string;
  email: string;
  name?: string;
};

type StripeCustomerSearchResponse = {
  data: StripeCustomer[];
};

const stripePaymentMethods = {
  MASTER_CARD: 'pm_card_mastercard',
  VISA: 'pm_card_visa',
};

export const pay = async (paymentData: PaymentData, email: string) => {
  try {
    const customer = await createStripeCustomer(email);

    // call stripe api to create a payment intent
    const bodyParams = new URLSearchParams({
      amount: (paymentData.amount * 100).toString(), // Stripe uses smallest currency unit
      currency: 'dkk',
      payment_method: stripePaymentMethods[paymentData.payment.method],
      confirm: 'true',
      return_url: process.env.PAYMENT_SERVICE_URL ?? 'https://localhost:3004',
      customer: customer.id,
      'shipping[name]': paymentData.address.recipentName,
      'shipping[address][line1]': paymentData.address.street,
      'shipping[address][city]': paymentData.address.city,
      'shipping[address][postal_code]': paymentData.address.zip,
      'shipping[address][country]': 'DK',
    });

    if (paymentData.address.floor) {
      bodyParams.append('shipping[address][line2]', paymentData.address.floor);
    }

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    const data = await response.json();

    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const createStripeCustomer = async (
  email: string,
): Promise<StripeCustomer> => {
  try {
    // search for existing customer
    const searchResponse = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const searchData: StripeCustomerSearchResponse =
      (await searchResponse.json()) as StripeCustomerSearchResponse;

    if (searchData.data && searchData.data.length > 0) {
      return searchData.data[0];
    }

    // create new customer if not found
    const createResponse = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email,
      }).toString(),
    });

    const createData: StripeCustomer =
      (await createResponse.json()) as StripeCustomer;

    return createData;
  } catch (error) {
    console.error('Error creating or retrieving customer:', error);
    throw error;
  }
};

export async function handlePayouts(event: {
  order: {
    id: string;
    paymentIntentId: string;
    totalAmount: number;
  };
  deliveryData: {
    id: string;
    deliveryTime: string;
    deliveryAddress: string;
    agent: {
      id: string;
      name: string;
      email: string;
      regNo: string;
      accountNo: string;
    };
  };
  restaurant: {
    restaurant: {
      id: string;
      email: string;
      regNo: string;
      accountNo: string;
    };
  };
}) {
  // process payouts
  const { totalAmount } = event.order;

  // Constants for fees
  const stripeFeePercentage = 0.015; // 1.5%
  const stripeFlatFee = 1.8; // fixed Stripe fee in DKK
  const mtogoFeePercentage = 0.015; // 1.5% MTOGO fee

  // Calculating MTOGO net revenue after Stripe fees
  const afterStripeFees =
    totalAmount - totalAmount * stripeFeePercentage - stripeFlatFee;
  const afterMtogoFees = afterStripeFees - afterStripeFees * mtogoFeePercentage;

  // Calculate restaurant payout
  let variableSharePercentage = 0;
  if (totalAmount < 100) {
    variableSharePercentage = 0.08;
  } else if (totalAmount <= 500) {
    variableSharePercentage = 0.06;
  } else if (totalAmount <= 1000) {
    variableSharePercentage = 0.04;
  } else {
    variableSharePercentage = 0.03;
  }

  const restaurantPayout =
    afterMtogoFees - afterMtogoFees * variableSharePercentage;

  // Simpler delivery agent payout for now
  const baseDeliveryFee = 30;
  const deliveryAgentBonusPercentage = 0.1; // bonus percentage for prime hours
  const deliveryHour = new Date(event.deliveryData.deliveryTime).getHours();
  const isPrimeHours = deliveryHour >= 17 && deliveryHour <= 21;

  const deliveryAgentPayout =
    baseDeliveryFee +
    (isPrimeHours ? baseDeliveryFee * deliveryAgentBonusPercentage : 0);

  // PERFORM PAYOUTS TO RESTAURANT AND DELIVERY AGENT

  // Retrieve or create Stripe Connect accounts for restaurant and delivery agent
  const restaurant_StripeCustomer =
    await createRestaurantOrDeliveryAgentInStripe(
      event.restaurant.restaurant.email,
      event.restaurant.restaurant.regNo,
      event.restaurant.restaurant.accountNo,
    );

  if (!restaurant_StripeCustomer) {
    throw new Error('Failed to create or retrieve restaurant Stripe customer');
  }

  const deliveryAgent_StripeCustomer =
    await createRestaurantOrDeliveryAgentInStripe(
      event.deliveryData.agent.email,
      event.deliveryData.agent.regNo,
      event.deliveryData.agent.accountNo,
    );

  if (!deliveryAgent_StripeCustomer) {
    throw new Error(
      'Failed to create or retrieve delivery agent Stripe customer',
    );
  }

  // Perform payouts
  await performPayout(
    restaurant_StripeCustomer.id,
    restaurantPayout,
    'Restaurant Payout',
  );

  await performPayout(
    deliveryAgent_StripeCustomer.id,
    deliveryAgentPayout,
    'Delivery Agent Payout',
  );

  return {
    restaurantPayout,
    deliveryAgentPayout,
  };
}

async function performPayout(
  accountId: string,
  amount: number,
  description: string,
) {
  try {
    const response = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: (amount * 100).toString(),
        currency: 'dkk',
        destination: accountId,
        description,
      }).toString(),
    });

    const data = await response.json();

    console.log('Payout response:', data);

    // TODO - fix this to actually simulate a payment

    return data;
  } catch (error) {
    console.error(error);
  }
}

type StripeAccount = {
  id: string;
};

const createRestaurantOrDeliveryAgentInStripe = async (
  email: string,
  regNo: string,
  accountNo: string,
): Promise<StripeAccount | null> => {
  try {
    console.log(
      'createRestaurantOrDeliveryAgentInStripe()',
      email,
      regNo,
      accountNo,
    );

    // Search for existing Connect account
    const searchResponse = await fetch(
      `https://api.stripe.com/v1/accounts?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        },
      },
    );

    const searchData = (await searchResponse.json()) as {
      data: StripeAccount[];
    };

    if (searchData.data && searchData.data.length > 0) {
      console.log('Stripe account already exists:', searchData.data[0]);
      return searchData.data[0]; // Return existing account
    }

    // Create a new Connect account
    const createResponse = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        type: 'custom',
        email,
        country: 'DK',
        business_type: 'individual',
        'individual[first_name]': 'John',
        'individual[last_name]': 'Doe',
        'external_account[object]': 'bank_account',
        'external_account[country]': 'DK',
        'external_account[currency]': 'dkk',
        'external_account[account_number]': 'DK5000400440116243',
        'external_account[registration_number]': regNo,
        'capabilities[transfers][requested]': 'true',
      }).toString(),
    });

    const accountData = await createResponse.json();

    if (!createResponse.ok) {
      console.error(
        'Error creating Stripe Connect account:',
        createResponse.statusText,
      );
      return null;
    }

    console.log('Stripe Connect account created:', accountData);
    return accountData as StripeAccount;
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    throw error;
  }
};
