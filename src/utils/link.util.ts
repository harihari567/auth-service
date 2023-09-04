import prismaClient from '../config/prisma';

export function processKey(key: string) {
  const validKeyRegex = new RegExp(/^[0-9A-Za-z\u0080-\uFFFF\/\-]*$/u);

  if (!validKeyRegex.test(key)) {
    return null;
  }
  // remove all leading and trailing slashes from key
  key = key.replace(/^\/+|\/+$/g, '');
  if (key.length === 0) {
    return null;
  }
  return key;
}

export async function checkIfKeyExists(key: string) {
  const reservedKeys = ['blog', 'pricing', 'privacy'];

  if (reservedKeys.includes(key)) {
    return true;
  }
  const link = await prismaClient.link.findUnique({
    where: {
      key: key
    }
  });
  return !!link;
}

export const truncate = (str: string | null, length: number) => {
  if (!str || str.length <= length) return str;
  return `${str.slice(0, length - 3)}...`;
};
