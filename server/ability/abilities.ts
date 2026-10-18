import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { MongoAbility, RawRuleOf, MongoQuery, ForcedSubject } from "@casl/ability";
import type { IAccountDocument, AccountAttributes } from "../models/Account.ts";
import type { ExerciseAttributes } from '../models/Exercise.ts'
import type { TestAttributes } from '../models/Test.ts'
import mongoose from 'mongoose'

export type AccountSubject = AccountAttributes & ForcedSubject<"account"> & { _id: mongoose.Types.ObjectId };
export type TestSubject = TestAttributes & ForcedSubject<"test"> & { _id: mongoose.Types.ObjectId };
export type ExerciseSubject = Omit<ExerciseAttributes, "tests"> & ForcedSubject<"exercise"> & { _id: mongoose.Types.ObjectId };

export type Actions = "manage" | "execute" | "create" | "read" | "update" | "delete";
export type Subjects = "all" | "exercise" | "test" | "account" | ExerciseSubject | TestSubject | AccountSubject;
export type AppAbilities = [Actions, Subjects];
export type AppAbility = MongoAbility<AppAbilities>;
export type AppBuilder = AbilityBuilder<AppAbility>;
export type Conditions = MongoQuery;

export function getAbilityFor(user: IAccountDocument) {
  const rules = getRulesFor(user);
  return createMongoAbility<AppAbilities, Conditions>(rules);
}

export function getRulesFor(user: IAccountDocument): RawRuleOf<AppAbility>[] {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case 'ROLE_ADMIN': {
      return getAdminRules(builder);
    }
    case 'ROLE_USER': {
      return getUserRules(builder, user);
    }
    default: builder.can(["read"], "exercise");
  }

  return builder.rules;
}



function getAdminRules(builder: AbilityBuilder<AppAbility>) {
  const { can: allow } = builder;
  allow("manage", "all");
  return builder.rules;
}

function getUserRules(builder: AbilityBuilder<AppAbility>, user: IAccountDocument) {
  const { can: allow } = builder;
  allow(["create"], "exercise");
  allow(["read", "execute"], "exercise", { status: "published" });
  allow(["read", "update", "delete"], "exercise", { publisherId: user._id.toString() });
  allow("update", "exercise", { publisherId: user._id.toString() });
  allow(["read", "create", "execute", "delete"], "test", { publisherId: user._id.toString() });
  return builder.rules;
}

