import { Kafka, Producer } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

let producer: Producer;

async function initializeProducer(retries = 5, delay = 3000) {
  const kafka = new Kafka({
    clientId: 'restaurant-order-service',
    brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  });

  producer = kafka.producer();

  for (let i = 0; i < retries; i++) {
    try {
      await producer.connect();
      console.log('Kafka producer connected');
      return;
    } catch (error) {
      console.error(
        `Retrying Kafka producer connection (${i + 1}/${retries}):`,
        error,
      );
      if (i === retries - 1) {
        throw new Error('Kafka producer failed to connect after retries');
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function produceEvent(topic: string, message: Record<string, unknown>) {
  console.log('Producing event to topic:', topic);
  if (!producer) {
    throw new Error(
      'Producer is not initialized, Call initializeProducer() first',
    );
  }

  try {
    const serializedMessage = JSON.stringify(message);

    await producer.send({
      topic,
      messages: [{ value: serializedMessage }],
    });

    console.log(`Event produced to topic ${topic}`, message);
  } catch (error) {
    console.error('Error producing event:', error);
    throw error;
  }
}

async function shutdownProducer() {
  if (producer) {
    await producer.disconnect();
    console.log('Producer disconnected');
  }
}

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down producer...');
  await shutdownProducer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down producer...');
  await shutdownProducer();
  process.exit(0);
});

export { initializeProducer, produceEvent, shutdownProducer };
