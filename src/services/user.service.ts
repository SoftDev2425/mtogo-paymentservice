export const pay = async () => {
  // https://api.stripe.com/v1/payment_intents?amount=20000&currency=dkk&payment_method=pm_card_visa_debit&confirm=true&return_url=https://localhost:3006&customer=cus_RHam6FVtUv0Hkk&shipping[name]=Andreas Fritzbøger&shipping[address][line1]=123 Main Street&shipping[address][city]=Copenhagen&shipping[address][country]=DK
};

export const createStripeCustomer = async () => {
  //https://api.stripe.com/v1/customers?email=arf@live.dk&name=Andreas Fritzbøger
};
