import passport from "passport"
import { Strategy as LocalStrategy } from 'passport-local';
import passportJWT from "passport-jwt"
import dotenv from "dotenv"
import { log } from "../app.ts"

import { Account } from "../models/Account.ts"
import type { Request } from "express";

dotenv.config();

const tokenExtractor = function (req: Request) {
  return req?.body?.token || req?.query?.token || req.headers.authorization || req.headers.bearer;
};

const JwtStrategy = passportJWT.Strategy;
const jwtOptions: passportJWT.StrategyOptionsWithRequest = {
  jwtFromRequest: tokenExtractor,
  secretOrKey: process.env.JWT_SECRET as string || "secret",
  passReqToCallback: true,
};


function initPassport() {

  const localLoginStrategy = new LocalStrategy(Account.authenticate());

  const jwtLoginStrategy = new JwtStrategy(jwtOptions, async (_: Request, payload: any, done: passportJWT.VerifiedCallback) => {
    log.warn(`[JWT]: Stragegy::verify token`, payload)

    const user = await Account.findById(payload._id);
    if (user) {
      return done(null, user);
    }

    done(null, false);
  });

  passport.use(Account.createStrategy());
  passport.use(jwtLoginStrategy);   // enable passport JWT strategy
  passport.use(localLoginStrategy); // enable passport Local strategy

  // Serialize: Save just the user's ID to the session cookie
  passport.serializeUser((user: any, done) => {
    done(null, user._id);
  });

  // Deserialize: Retrieve the full user document from the database using that ID
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await Account.findById({ _id: id });
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  return passport;
}

export { initPassport };