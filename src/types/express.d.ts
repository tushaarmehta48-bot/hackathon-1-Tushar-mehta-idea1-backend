import type { AuthenticatedUser } from '../users/user.types.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
