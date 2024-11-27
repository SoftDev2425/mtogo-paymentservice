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

    console.log('Payment data:', data);

    return data;
  } catch (error) {
    console.error(error);
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
