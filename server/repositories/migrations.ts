import { z } from 'zod';
import { databaseSchema, moneySchema, targetSchema, type Database } from '../../shared/models.js';
import { inclusiveMonths, roundMoney } from '../../shared/calculations.js';

const legacyDatabaseSchema = databaseSchema.extend({
  version: z.literal(1),
  targets: z.array(targetSchema.omit({ amount: true }).extend({
    monthlySavings: moneySchema.nullable().default(null),
    additionalAmount: moneySchema.nullable().default(null),
  }).strict()),
}).strict();

export function migrateDatabase(value: unknown): Database {
  if (typeof value === 'object' && value !== null && 'version' in value && value.version === 1) {
    const legacy = legacyDatabaseSchema.parse(value);
    return databaseSchema.parse({
      ...legacy,
      version: 2,
      targets: legacy.targets.map(({ monthlySavings, additionalAmount, ...target }) => ({
        ...target,
        // Freeze each old formula at its current value instead of losing existing milestones.
        amount: roundMoney((monthlySavings ?? legacy.financeSettings.monthlySavings)
          * inclusiveMonths(legacy.financeSettings.earningsStartMonth, target.month)
          + (additionalAmount ?? legacy.financeSettings.additionalAmount)),
      })),
    });
  }
  return databaseSchema.parse(value);
}
