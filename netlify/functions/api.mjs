import { getStore } from '@netlify/blobs';
import { createApi } from '../lib/api.mjs';
import { createPush } from '../lib/push.mjs';

export default async (req) => {
  const store = getStore({ name: 'putzplan', consistency: 'strong' });
  const handler = createApi({
    store,
    photoStore: getStore({ name: 'putzplan-photos', consistency: 'strong' }),
    push: createPush(store),
    teamCode: (process.env.TEAM_CODE || '').trim(),
    secret: process.env.SESSION_SECRET,
  });
  return handler(req);
};

export const config = { path: '/api/*' };
