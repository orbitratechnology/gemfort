import type { DecodedAppCheckToken } from 'firebase-admin/app-check';
import type { DecodedIdToken } from 'firebase-admin/auth';

export type ApiUser = {
  uid: string;
  token: DecodedIdToken;
};

export type ApiVariables = {
  requestId: string;
  user?: ApiUser;
  appCheck?: DecodedAppCheckToken;
};

export type ApiEnv = {
  Variables: ApiVariables;
};
