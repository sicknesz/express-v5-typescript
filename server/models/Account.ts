
import { Schema, model } from "mongoose";
import type { PassportLocalMongooseDocument, PassportLocalMongooseModel } from "passport-local-mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import type { InferSchemaType } from "mongoose"


const ROLES = ["ROLE_ADMIN", "ROLE_USER"] as const;
export type Role = typeof ROLES[number];

// define the POJO interface 
export interface IAccount {
  email: string;
  authorization: object;
  role: Role;
}

// extends to include "hash, "salt", "password", ....
export interface IAccountDocument extends IAccount, PassportLocalMongooseDocument { }

// extends to include authenticate(), serializeUser/deserializeUser 
export interface IAccountModel extends PassportLocalMongooseModel<IAccountDocument> { }

// the schematics 
const AccountSchema = new Schema<IAccountDocument>({
  email: { type: String, required: true, unique: true },
  authorization: { type: Object, required: false },
  role: { type: String, required: true, enum: ROLES, default: "ROLE_USER" },
}, {
  timestamps: true
});

// passport-local-mongoose rate-limiting / ban options 
const pluginOptions = {
  attemptsField: "failedLoginAttempts",
  lastLoginField: "lastLoggedTimestamp",
  usernameField: "username",
  usernameUnique: true,
  limitAttempts: true,
  maxAttempts: 3,           // 3 maximum failed password within unlockInterval => banned for maxInterval
  unlockInterval: 300000,   // 5 minutes,
  maxInterval: 300000,      // 5 minutes
  errorMessages: {
    MissingPasswordError: "Mot de passe manquant",
    AttemptTooSoonError: "Votre compte est actuellement verrouillé. Essayez plus tard.",
    TooManyAttemptsError: "Compte verrouillé pour une durée de 5 minutes à cause d'un trop grand nombre d'échecs",
    UserExistsError: "Nom d'utilisateur déjà pris",
    NoSaltValueStoredError: "Authentification impossible, sel manquant",
    IncorrectPasswordError: "Mot de passe ou utilisateur incorrect",
    IncorrectUsernameError: "Mot de passe ou utilisateur incorrect",
    MissingUsernameError: "Pas de nom d'utilisateur",
  },
};

/*
import i18n from "i18n";
    MissingPasswordError: i18n.__("MissingPasswordError"),
    AttemptTooSoonError: i18n.__("AttemptTooSoonError"),
    TooManyAttemptsError: i18n.__("TooManyAttemptsError"),
    UserExistsError: i18n.__("UserExistsError"),
    NoSaltValueStoredError: i18n.__("NoSaltValueStoredError"),
    IncorrectPasswordError: i18n.__("IncorrectPasswordError"),
    IncorrectUsernameError: i18n.__("IncorrectUsernameError"),
    MissingUsernameError: i18n.__("MissingUsernameError"),
*/

// export attributes for ACL/ability conditions 
export type AccountAttributes = InferSchemaType<typeof AccountSchema>;

AccountSchema.plugin(passportLocalMongoose.default, pluginOptions);

// export the Model (findOne, find, update...)
export const Account = model<IAccountDocument, IAccountModel>("Account", AccountSchema);