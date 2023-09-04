const { workerData, parentPort } = require('worker_threads');
const { PrismaClient } = require('@prisma/client');
const prismaClient = new PrismaClient();

async function updateLinkClicksWorker(workerData) {
  const { key } = workerData;

  await prismaClient.link.update({
    where: {
      key
    },
    data: {
      clicks: {
        increment: 1
      }
    }
  });
}

updateLinkClicksWorker(workerData)
  .then(() => parentPort.postMessage({ status: 'done' }))
  .catch((error) => parentPort.postMessage({ status: 'error', error }));
