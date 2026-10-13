import { Schema, model } from "mongoose";
import type { ObjectId } from "mongoose";
import type { PassportLocalMongooseDocument, PassportLocalMongooseModel } from "passport-local-mongoose";
import passportLocalMongoose from "passport-local-mongoose";

export const ROLES = ["ROLE_ADMIN", "ROLE_USER"] as const;
export type Role = typeof ROLES[number];

export interface IAccount {
    email: string;
    role: Role;
}
export interface IAccountDocument extends IAccount, PassportLocalMongooseDocument { }
export interface IAccountModel extends PassportLocalMongooseModel<IAccountDocument> { }

const AccountSchema = new Schema<IAccountDocument>({
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true, enum: ROLES, default: "ROLE_USER" },
});

AccountSchema.plugin(passportLocalMongoose.default);

export const Account = model<IAccountDocument, IAccountModel>("Account", AccountSchema);