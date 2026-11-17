import { getStore } from '@netlify/blobs';
import { createApi } from './lib.mjs';

export default async (req) => {
  const handler = createApi({
    store: getStore({ name: 'putzplan', consistency: 'strong' }),
    teamCode: (process.env.TEAM_CODE || '').trim(),
    secret: process.env.SESSION_SECRET,
  });
  return handler(req);
};

export const config = { path: '/api/*' };
