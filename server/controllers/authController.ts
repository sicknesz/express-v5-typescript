

import { Account, } from "../models/Account.ts"
import type { Request, Response } from "express";
import { log } from "../app.ts"
import { getCleanUser, authenticateAsync, logAndReturnToken } from "../utils/utils.ts"

export class AuthController {
  static async login(req: Request, res: Response/* , next: NextFunction */) {
    const { body: { username } } = req;

    log.debug(`[authenticate]: ${username} is trying to login with credentials ${username}/************`);

    const auth = await authenticateAsync(req, "local", {});
    if (!auth || !auth.user) {
      return res.json({ success: false, error: Error("Authentication failed") });
    }

    const { user } = auth;

    const credential = await logAndReturnToken(req, user);
    if (credential.error) {
      return res.json({ success: false, error: Error("Authentication failed") }); // you can specify password incorrect but its a leak
    }
    return res.json({ success: true, ...credential });
  }

  static async signup(req: Request, res: Response) {
    const newUser = new Account({ username: req.body.email, email: req.body.email, role: "ROLE_USER" });
    const user = await Account.register(newUser, req.body.password);
    return res.json({ success: true, user: getCleanUser(user) });
  }

  static async logout(req: Request, res: Response) {
    req.logOut({ keepSessionInfo: false }, (err: unknown) => {
      if (err) {
        return res.json({ success: false, error: err });
      }
    });

    return res.json({ success: true, message: "user logged out" });
  }
}