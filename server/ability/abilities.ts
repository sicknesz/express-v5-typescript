import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { MongoAbility, RawRuleOf } from "@casl/ability";
import type { IAccount } from "../models/Account.ts";

export type Actions = "manage" | "create" | "read" | "update" | "delete";
export type Subjects = "all" | "exercise" | "test" | "Account";
export type AppAbility = MongoAbility<[Actions, Subjects]>;
export type AppBuilder = AbilityBuilder<AppAbility>;

export function defineRulesFor(user?: IAccount): RawRuleOf<AppAbility>[] {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!user) {
    builder.can(["read"], "exercise");
  }

  else if (user.role === "ROLE_ADMIN") {
    builder.can("manage", "all");
  } else {
    builder.can(["read", "create"], "exercise");
    builder.can("update", "exercise", { publisherId: user._id.toString() });
    builder.can("read", "test");
  }

  return builder.rules;
}

export const ability = createMongoAbility<[Actions, Subjects]>(defineRulesFor(undefined));