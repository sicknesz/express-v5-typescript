import passportJS from "passport"
import LocalStrategy from "passport-local"
import passportJWT from "passport-jwt"
import dotenv from "dotenv"
import { log, controllers } from "../app.ts"


import type { Express, Request, Response, NextFunction } from "express";

dotenv.config()

// const Account = controllers.get("Account");
// const localLoginStrategy = new LocalStrategy(Account.authenticate());

const tokenExtractor = function (req: Request) {
  return req.body.token || req.query.token || req.headers.authorization || req.headers.bearer;
};

const JwtStrategy = passportJWT.Strategy;
const jwtOptions: passportJWT.StrategyOptionsWithRequest = {
  jwtFromRequest: tokenExtractor,
  secretOrKey: process.env.secret as string,
  passReqToCallback: true,
};


const jwtLogin = new JwtStrategy(jwtOptions, async (req: Request, payload: any, done: passportJWT.VerifiedCallback) => {
  log.warn(`[JWT]: Stragegy::verify token`, payload)
  const Account = req.app.get("Account");
  const user = await Account.findById({ _id: payload._id });
  if (user) {
    done(null, user)
  }
  done(null, false);
});
