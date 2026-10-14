import { Ability, AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { MongoAbility, RawRuleOf } from "@casl/ability";
import type { IAccountDocument/* , Role */ } from "../models/Account.ts";

export type Actions = "manage" | "create" | "read" | "update" | "delete" | "execute";
export type Subjects = "all" | "exercise" | "test" | "Account";
export type AppAbilities = [Actions, Subjects];
export type AppAbility = MongoAbility<AppAbilities>;
export type AppBuilder = AbilityBuilder<AppAbility>;



export function getAbilityFor(user: IAccountDocument) {
  const rules = getRulesFor(user);
  return new Ability<AppAbilities>(rules);
}

export function getRulesFor(user: IAccountDocument): RawRuleOf<AppAbility>[] {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case 'ROLE_ADMIN': {
      return getAdminRules(builder);
    }
    case 'ROLE_USER': {
      return getUserRules(builder/*, user*/);
    }

    default: builder.can(["read"], "exercise");
  }

  return builder.rules;
}

function getAdminRules(builder: AbilityBuilder<AppAbility>) {
  builder.can("manage", "all");
  return builder.rules;
}

function getUserRules(builder: AbilityBuilder<AppAbility>/*, user?: IAccountDocument*/) {
  builder.can(["read", "create", "execute"], "exercise");
  builder.can("update", "exercise"/*, { publisherId: user._id.toString() }*/);
  builder.can("read", "test");
  return builder.rules;
}

