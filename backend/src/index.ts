import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Both signToken() and requireAuth() fall back to the literal 'dev-secret'
// when JWT_SECRET is unset — a value that is public in this repository. Refuse
// to start in production rather than silently issuing forgeable tokens.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production; refusing to start with the dev fallback secret.');
}

app.listen(PORT, () => {
  console.log(`HAPP backend listening on port ${PORT}`);
});
