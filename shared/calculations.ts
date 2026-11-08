import type { Database, FinanceSummary, Item, Step } from './models';
import { today } from './models';

export function inclusiveMonths(start: string, end: string): number {
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  return Math.max(0, (endYear - startYear) * 12 + endMonth - startMonth + 1);
}

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const percentage = (value: number, total: number) => total > 0 ? Math.max(0, value / total * 100) : 0;
export const clampedPercentage = (value: number) => Math.min(100, Math.max(0, value));

export function financeSummary(db: Database, date = new Date()): FinanceSummary {
  const settings = db.financeSettings;
  const wealth = roundMoney(db.accounts.reduce((sum, account) =>
    sum + account.amount * (account.type === 'liability' ? -1 : 1), 0));
  const months = Math.max(0,
    inclusiveMonths(settings.earningsStartMonth, today(date).slice(0, 7)) - (date.getDate() < 28 ? 1 : 0));
  const currentTarget = roundMoney(settings.monthlySavings * months + settings.additionalAmount);
  const targets = [...db.targets].sort((a, b) => a.month.localeCompare(b.month) || a.createdAt.localeCompare(b.createdAt))
    .map(target => {
      return {
        ...target,
        percentage: percentage(wealth, target.amount),
        remaining: roundMoney(Math.max(0, target.amount - wealth)),
      };
    });
  return {
    wealth, months, currentTarget, percentage: percentage(wealth, currentTarget),
    remaining: roundMoney(Math.max(0, currentTarget - wealth)), targets,
  };
}

export function stepProgress(item: Item, steps: Step[]): number {
  const relevant = steps.filter(step => step.itemId === item.id);
  return relevant.length ? relevant.filter(step => step.completed).length / relevant.length * 100
    : item.phase === 'achieved' ? 100 : 0;
}

export function deadlineProgress(item: Item, currentDate = today()) {
  if (!item.deadline) return null;
  const start = Date.parse(`${item.startedOn}T00:00:00Z`);
  const end = Date.parse(`${item.deadline}T00:00:00Z`);
  const now = Date.parse(`${currentDate}T00:00:00Z`);
  const daysRemaining = Math.round((end - now) / 86400000);
  const elapsed = end === start ? (now >= end ? 100 : 0) : clampedPercentage((now - start) / (end - start) * 100);
  return { elapsed, daysRemaining, overdue: daysRemaining < 0 };
}
