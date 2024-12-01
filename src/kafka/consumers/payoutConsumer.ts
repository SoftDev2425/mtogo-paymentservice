import { EachMessagePayload } from 'kafkajs';
import { createConsumer } from '../consumerManager';
import { produceEvent } from '../../utils/produceEvent';
import { handlePayouts } from '../../services/payment.service';

export async function payoutConsumer() {
  const consumer = await createConsumer('mtogo-payoutConsumer');

  await consumer.subscribe({
    topic: 'paymentService_Payout',
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      try {
        console.log(topic, partition, message);

        const value = message.value?.toString();

        if (value) {
          const event = JSON.parse(value);

          console.log(
            `payoutConsumer received message from topic: ${topic}`,
            event,
          );

          const payouts = await handlePayouts(event);

          const { order } = event;

          // produce notification events
          await produceEvent('notificationService_Payout_Restaurant', {
            recipent: event.restaurant,
            payouts,
            order,
          });

          await produceEvent('notificationService_Payout_DeliveryAgent', {
            recipent: event.deliveryData.agent,
            payouts,
            order,
          });
        }

        console.log('Message processed successfully');
      } catch (error) {
        console.error('Error processing message:', error);
      }
    },
  });

  return consumer;
}
