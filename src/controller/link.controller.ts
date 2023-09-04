import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import prismaClient from '../config/prisma';
import type { LinkRequestBody, TypedRequest } from '../types/types';
import { checkIfKeyExists, processKey, truncate } from '../utils/link.util';
import { getMetadata } from '../utils/getMetadata.util';
import redisClient from '../config/redis';
import { JwtPayload } from 'jsonwebtoken';
import logger from '../middleware/logger';
import isbot from 'isbot';
import generateLinkPreview from '../utils/generateLinkPreview.util';
import updateLinkClicks from '../utils/updateLinkClicks.util';

/**
 * This function handles the create link. It expects a request object with the following properties:
 *
 * @param {TypedRequest<LinkRequestBody>} req - The request object that includes user's username, email, and password.
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 400 BAD REQUEST status code and an error message if the request body is missing any required parameters.
 *   - A 409 CONFLICT status code if the link already exists in the database.
 *   - A 201 CREATED status code and a success message if the new link is successfully created and a verification email is sent.
 *   - A 500 INTERNAL SERVER ERROR status code if there is an error in the server.
 */

export const handleCreateLink = async (
  req: TypedRequest<LinkRequestBody>,
  res: Response
) => {
  const { url, key, expiresAt } = req.body;
  const { userId } = req.payload as JwtPayload;

  if (!url || !key) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'Link and Key are required!' });
  }

  if (!processKey(key)) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid Key!' });
  }

  if (await checkIfKeyExists(key)) {
    return res
      .status(httpStatus.CONFLICT)
      .json({ message: 'Key already exists!' });
  }

  // Get link metadata if no metadata return default metadata
  const metadata = await getMetadata(url);
  const { open_graph } = metadata;
  const { title, description, images } = open_graph || {};

  const image =
    images && images.length > 0
      ? images[0]?.secure_url || images[0]?.url
      : undefined;

  // Create link
  await prismaClient.link.create({
    data: {
      userId,
      url,
      key,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      title: truncate(title, 120) || null,
      description: truncate(description || '', 240) || null,
      image: image || null
    }
  });

  const exat = expiresAt ? new Date(expiresAt).getTime() / 1000 : null;

  await redisClient.set(
    key,
    JSON.stringify({
      url,
      title: truncate(title, 120) || null,
      description: truncate(description || '', 240) || null,
      image: image || null
    }),
    {
      NX: true,
      ...(exat && { EXAT: exat })
    }
  );

  logger.info(`Link created: ${url}`);
  return res.status(httpStatus.CREATED).json({ message: 'Link created!' });
};

/**
 * This function handles get links. It expects a request object with the following properties:
 *
 * @param {TypedRequest<LinkRequestBody>} req - The request object that includes user's username, email, and password.
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 400 BAD REQUEST status code and an error message if the request body is missing any required parameters.
 *   - A 200 OK status code and a success message if links
 */

export const handleGetLinks = async (req: Request, res: Response) => {
  const { userId, search, sort, page, showArchived } = req.query;

  const links = await prismaClient.link.findMany({
    where: {
      userId: userId as string,
      archived: showArchived === 'true' ? true : false,
      ...(search && {
        OR: [
          { url: { contains: search as string } },
          { key: { contains: search as string } },
          { title: { contains: search as string } },
          { description: { contains: search as string } }
        ]
      })
    },
    orderBy: {
      ...(sort && {
        [sort as string]: 'asc'
      })
    },
    skip: page ? (parseInt(page as string) - 1) * 10 : 0,
    take: 10
  });

  if (!links) {
    return res.status(httpStatus.NOT_FOUND).json({ message: 'No links found' });
  }

  return res.status(httpStatus.OK).json(links);
};

/**
 * This function handles the retrieval of a specific link. It expects a request object with the following properties:
 *
 * @param {Request} req - The request object that includes the key of the link in the parameters.
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 400 BAD REQUEST status code and an error message if the key is not provided in the request parameters.
 *   - A 404 NOT FOUND status code and an error message if the link associated with the provided key does not exist.
 *   - A 410 GONE status code and an error message if the link has expired or has been archived.
 *   - A 200 OK status code and the link preview HTML if the request is from a bot.
 *   - A 302 FOUND status code and redirects the user to the link URL if the request is from a user.
 */

export const handleGetLink = async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!key) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'Key is required!' });
  }

  // get from redis
  let link = await redisClient.get(key);

  if (!link) {
    // If it's not in Redis, fetch it from the Prisma database
    link = await prismaClient.link.findUnique({
      where: {
        key
      }
    });

    if (!link) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: 'Link not found' });
    }

    // Store the link data in Redis for future requests
    await redisClient.set(key, JSON.stringify(link));
  } else {
    // Parse the link data from Redis
    link = JSON.parse(link);
  }

  if (!link) {
    return res.status(httpStatus.NOT_FOUND).json({ message: 'Link not found' });
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return res.status(httpStatus.GONE).json({ message: 'Link expired' });
  }

  if (link.archived) {
    return res.status(httpStatus.GONE).json({ message: 'Link archived' });
  }

  if (isbot(req.get('user-agent'))) {
    const linkPreviewHtml = generateLinkPreview(
      link.title,
      link.description,
      link.image
    );
    return res.status(httpStatus.OK).send(linkPreviewHtml);
  }

  const workerData = {
    key,
    clicks: link.clicks + 1
  };

  updateLinkClicks(workerData);
  return res.status(httpStatus.FOUND).redirect(link.url);
};

/**
 * This function handles the archiving of a specific link. It expects a request object with the following properties:
 *
 * @param {Request} req - The request object that includes the key of the link in the parameters.
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 400 BAD REQUEST status code and an error message if the key is not provided in the request parameters.
 *   - A 404 NOT FOUND status code and an error message if the link associated with the provided key does not exist.
 *   - A 409 CONFLICT status code and an error message if the link has already been archived.
 *   - A 200 OK status code and a success message if the link is successfully archived.
 */
export const handleLinkArchive = async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!key) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'Key is required!' });
  }

  const link = await prismaClient.link.findUnique({
    where: {
      key
    }
  });

  if (!link) {
    return res.status(httpStatus.NOT_FOUND).json({ message: 'Link not found' });
  }

  if (link.archived) {
    return res
      .status(httpStatus.CONFLICT)
      .json({ message: 'Link already archived' });
  }

  // remove from redis
  await redisClient.del(key);

  await prismaClient.link.update({
    where: {
      key
    },
    data: {
      archived: true
    }
  });

  return res.status(httpStatus.OK).json({ message: 'Link archived' });
};

/**
 * This function handles the retrieval of click counts for a specific link. It expects a request object with the following properties:
 *
 * @param {Request} req - The request object that includes the key of the link in the parameters.
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 400 BAD REQUEST status code and an error message if the key is not provided in the request parameters.
 *   - A 404 NOT FOUND status code and an error message if the link associated with the provided key does not exist.
 *   - A 200 OK status code and the number of clicks if the link exists.
 */
export const handleLinkClicks = async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!key) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'Key is required!' });
  }

  const link = await prismaClient.link.findUnique({
    where: {
      key
    }
  });

  if (!link) {
    return res.status(httpStatus.NOT_FOUND).json({ message: 'Link not found' });
  }

  return res.status(httpStatus.OK).json({ clicks: link.clicks });
};
