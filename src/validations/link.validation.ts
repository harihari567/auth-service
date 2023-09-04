import Joi from 'joi';
import type { LinkRequestBody } from '../types/types';

export const linkSchema = {
  body: Joi.object<LinkRequestBody>().keys({
    url: Joi.string().required().uri(),
    key: Joi.string().required()
  })
};
