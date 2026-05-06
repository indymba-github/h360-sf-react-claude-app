import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { type SessionData, sessionOptions } from "./session-config";

export type { SessionData } from "./session-config";
export { sessionOptions } from "./session-config";

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireSession(): Promise<IronSession<SessionData> & Required<SessionData>> {
  const session = await getSession();
  if (!session.accessToken || !session.instanceUrl) {
    throw new Error("NOT_AUTHENTICATED");
  }
  return session as IronSession<SessionData> & Required<SessionData>;
}
