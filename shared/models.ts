import { z } from 'zod';

export const sectionKindSchema = z.enum(['learning', 'goals']);
export const phaseSchema = z.enum(['planned', 'active', 'past', 'future', 'current', 'achieved']);
export const phases = {
  learning: ['active', 'planned', 'past'],
  goals: ['current', 'future', 'achieved'],
} as const;
export const phaseLabels: Record<Phase, string> = {
  active: 'Active', planned: 'Planned', past: 'Past',
  current: 'Current', future: 'Future', achieved: 'Achieved',
};

export const today = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Enter a valid calendar date');
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const nameSchema = z.string().trim().min(1, 'A name is required').max(120);
const descriptionSchema = z.string().trim().max(10000);
export const moneySchema = z.number().finite().min(0).max(1e12)
  .refine(value => value === Math.round(value * 100) / 100, 'Use at most two decimal places');
const timestampSchema = z.string().datetime();
const idSchema = z.string().uuid();
const stamp = { id: idSchema, createdAt: timestampSchema, updatedAt: timestampSchema };

export const sectionInput = z.object({
  kind: sectionKindSchema,
  name: nameSchema,
  description: descriptionSchema.default(''),
}).strict();
export const sectionPatch = sectionInput.omit({ kind: true }).partial().strict();
export const sectionSchema = sectionInput.extend(stamp);
export const itemInput = z.object({
  title: nameSchema,
  description: descriptionSchema.default(''),
  phase: phaseSchema,
  startedOn: dateSchema.default(() => today()),
  deadline: dateSchema.nullable().default(null),
}).strict();
export const itemPatch = itemInput.partial().strict();
export const itemSchema = itemInput.extend({ ...stamp, sectionId: idSchema });
export const stepInput = z.object({ title: nameSchema, completed: z.boolean().default(false) }).strict();
export const stepPatch = stepInput.partial().strict();
export const stepSchema = stepInput.extend({ ...stamp, itemId: idSchema });
export const logInput = z.object({
  content: z.string().trim().min(1, 'Write something first').max(20000),
  date: dateSchema.default(() => today()),
}).strict();
export const logPatch = logInput.partial().strict();
export const logSchema = logInput.extend({
  ...stamp, ownerType: z.enum(['section', 'item']), ownerId: idSchema,
});
export const accountInput = z.object({
  name: nameSchema,
  type: z.enum(['asset', 'liability']).default('asset'),
  amount: moneySchema,
}).strict();
export const accountPatch = accountInput.partial().strict();
export const accountSchema = accountInput.extend(stamp);
export const targetInput = z.object({
  name: nameSchema,
  month: monthSchema,
  amount: moneySchema,
}).strict();
export const targetPatch = targetInput.partial().strict();
export const targetSchema = targetInput.extend(stamp);
export const financeSettingsSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code').refine(value => {
    // Intl accepts invented three-letter codes, so check the supported ISO currencies.
    return Intl.supportedValuesOf('currency').includes(value);
  }, 'Choose a supported ISO currency'),
  earningsStartMonth: monthSchema,
  monthlySavings: moneySchema,
  additionalAmount: moneySchema,
}).strict();
export const financeSettingsPatch = financeSettingsSchema.partial().strict();
export const databaseSchema = z.object({
  version: z.literal(2),
  sections: z.array(sectionSchema),
  items: z.array(itemSchema),
  steps: z.array(stepSchema),
  logs: z.array(logSchema),
  accounts: z.array(accountSchema),
  targets: z.array(targetSchema),
  financeSettings: financeSettingsSchema,
}).strict();

export type SectionKind = z.infer<typeof sectionKindSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Log = z.infer<typeof logSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Target = z.infer<typeof targetSchema>;
export type FinanceSettings = z.infer<typeof financeSettingsSchema>;
export type Database = z.infer<typeof databaseSchema>;
export interface TargetProgress extends Target {
  percentage: number;
  remaining: number;
}
export interface FinanceSummary {
  wealth: number;
  months: number;
  currentTarget: number;
  percentage: number;
  remaining: number;
  targets: TargetProgress[];
}
export interface AppState extends Database { finance: FinanceSummary }

export const emptyDatabase = (): Database => ({
  version: 2, sections: [], items: [], steps: [], logs: [], accounts: [], targets: [],
  financeSettings: { currency: 'INR', earningsStartMonth: '2023-08', monthlySavings: 0, additionalAmount: 0 },
});
