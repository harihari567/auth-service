import { unfurl } from 'unfurl.js';

export async function getMetadata(url: string) {
  const metadata = await unfurl(url);
  return metadata;
}
