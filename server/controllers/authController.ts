
import type { IAccountDocument } from "../models/Account.ts"
import { Account } from "../models/Account.ts"
import type { Request, Response } from "express";
import { log } from "../app.ts"
import passport from "passport"
import { generateToken, getCleanUser } from "../utils/utils.ts"

type AuthenticateSuccess = { user: IAccountDocument, info: object };
type LoginSuccess = { user: IAccountDocument, token: string, error: null };
type Failure<E extends Error> = { user: null, token: null, error: E };

function authenticateAsync(req: Request, strategy: string, options = {}): Promise<AuthenticateSuccess | Failure<Error>> {
  return new Promise((resolve, reject) => {

    const callback = (err: Error, user: IAccountDocument, info = {}) => {
      if (err) {
        reject(err);
      }
      if (!user) {
        reject(new Error("bad"));
      }
      resolve({ user, info });
    }

    passport.authenticate(strategy, options, callback)(req);
  });
}


async function logAndReturnToken(req: Request, user: IAccountDocument): Promise<LoginSuccess | Failure<Error>> {
  return new Promise((resolve, reject) => {
    req.login(user, async (err) => {
      if (err) {
        reject({ error: err, user: null, token: null });
      }

      const authTokenPayload = {
        _id: user._id.toString(),
        scope: "auth",
      };

      const authToken = await generateToken(authTokenPayload);
      resolve({
        error: null,
        user: getCleanUser(user),
        token: authToken,
      });
    });
  });
}

export class AuthController {
  static async login(req: Request, res: Response) {
    const {
      body: { username },
    } = req;

    log.warn(`[authenticate]: ${username} is trying to login with credentials ${username}/************`);
    // const authenticator = await passport.authenticate("local", { session: false });
    // if (!authenticator) {
    //   return res.json({ success: false, error: Error("User not found") });
    // }

    // const account = authenticator(req);
    const auth = await authenticateAsync(req, "local", {});
    if (!auth || !auth.user) {
      return res.json({ success: false, error: Error("User not found") });
    }
    const { user } = auth;

    const credential = await logAndReturnToken(req, user);
    if (credential.error) {
      return res.json({ success: false, error: Error("User not found") }); // you can specify password incorrect but its a leak
    }
    return res.json({ success: true, ...credential });
  }

  static async signup(req: Request, res: Response) {
    const newUser = new Account({ username: req.body.email, email: req.body.email, role: "ROLE_USER" });
    const user = await Account.register(newUser, req.body.password);
    return res.json({ success: true, user: getCleanUser(user) });
  }
}