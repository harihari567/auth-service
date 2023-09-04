import { Worker } from 'worker_threads';

export const updateLinkClicks = (workerData: {
  clicks: number;
  key: string;
}) => {
  const worker = new Worker('./src/worker/updateLinkClick.worker.js', {
    workerData
  });

  worker.on('message', (message) => {
    console.log('message', message);
    if (message.status === 'error') {
      console.error('Error in worker thread:', message.error);
    }
  });

  return worker;
};

export default updateLinkClicks;
