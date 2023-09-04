import { Router } from 'express';
import validate from '../../middleware/validate';
import { linkSchema } from '../../validations/link.validation';
import * as linkController from '../../controller/link.controller';
import isAuth from '../../middleware/isAuth';

const linkRouter = Router();

linkRouter.post(
  '/link',
  isAuth,
  validate(linkSchema),
  linkController.handleCreateLink
);

linkRouter.get('/links', isAuth, linkController.handleGetLinks);

linkRouter.get('/link/:key/clicks', isAuth, linkController.handleLinkClicks);

linkRouter.put('/link/:key/archive', isAuth, linkController.handleLinkArchive);

export default linkRouter;
