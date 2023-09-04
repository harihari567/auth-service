import { createClient } from 'redis';

const client: any = createClient();

client.on('error', (err: any) => console.log('Redis Client Error', err));

client
  .connect()
  .catch((err: Error) => console.error('Failed to connect:', err));

export default client;
