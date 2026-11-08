import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  phases, sectionInput, sectionPatch, itemInput, itemPatch, stepInput, stepPatch,
  logInput, logPatch, accountInput, accountPatch, targetInput, targetPatch,
  financeSettingsPatch, type Database, type Item, type Phase, type Section, type SectionKind,
} from '../../shared/models';
import { financeSummary } from '../../shared/calculations';
import { found, HttpError } from '../errors';
import type { Repository } from '../repositories/repository';

const stamps = () => {
  const now = new Date().toISOString();
  return { id: randomUUID(), createdAt: now, updatedAt: now };
};
const touch = <T extends { updatedAt: string }>(entity: T) => {
  entity.updatedAt = new Date().toISOString();
  return entity;
};
const sectionIn = (db: Database, id: string) => found(db.sections.find(section => section.id === id), 'Subsection');
const itemIn = (db: Database, id: string) => found(db.items.find(item => item.id === id), 'Item');
const goalIn = (db: Database, id: string) => {
  const item = itemIn(db, id);
  if (sectionIn(db, item.sectionId).kind !== 'goals') throw new HttpError(400, 'Only goals can have steps');
  return item;
};
const validItem = (item: Item, section: Section) => {
  if (!(phases[section.kind] as readonly Phase[]).includes(item.phase))
    throw new HttpError(400, 'Phase does not belong to this subsection');
  if (item.deadline && item.deadline < item.startedOn)
    throw new HttpError(400, 'Deadline must be on or after the start date');
  if (section.kind === 'learning' && item.deadline)
    throw new HttpError(400, 'Deadlines are only available for goals');
};
const uniqueSection = (db: Database, kind: SectionKind, name: string, except?: string) => {
  if (db.sections.some(section => section.kind === kind && section.id !== except && section.name.toLowerCase() === name.toLowerCase()))
    throw new HttpError(409, 'A subsection with this name already exists');
};

export class WorkspaceService {
  constructor(public repository: Repository) {}

  async state() {
    const db = await this.repository.read();
    return { ...db, finance: financeSummary(db) };
  }

  async listSections(kind?: unknown) {
    const parsed = kind === undefined ? undefined : z.enum(['learning', 'goals']).parse(kind);
    return (await this.repository.read()).sections.filter(section => !parsed || section.kind === parsed);
  }

  async section(id: string) { return sectionIn(await this.repository.read(), id); }

  createSection(body: unknown) {
    const input = sectionInput.parse(body);
    return this.repository.update(db => {
      uniqueSection(db, input.kind, input.name);
      const section = { ...input, ...stamps() };
      db.sections.push(section);
      return section;
    });
  }

  updateSection(id: string, body: unknown) {
    const input = sectionPatch.parse(body);
    return this.repository.update(db => {
      const section = sectionIn(db, id);
      uniqueSection(db, section.kind, input.name ?? section.name, id);
      return touch(Object.assign(section, input));
    });
  }

  deleteSection(id: string) {
    return this.repository.update(db => {
      sectionIn(db, id);
      const items = new Set(db.items.filter(item => item.sectionId === id).map(item => item.id));
      db.sections = db.sections.filter(section => section.id !== id);
      db.items = db.items.filter(item => item.sectionId !== id);
      db.steps = db.steps.filter(step => !items.has(step.itemId));
      db.logs = db.logs.filter(log => !(log.ownerType === 'section' && log.ownerId === id)
        && !(log.ownerType === 'item' && items.has(log.ownerId)));
    });
  }

  async listItems(sectionId: string) {
    const db = await this.repository.read();
    sectionIn(db, sectionId);
    return db.items.filter(item => item.sectionId === sectionId);
  }

  async item(id: string) { return itemIn(await this.repository.read(), id); }

  createItem(sectionId: string, body: unknown) {
    const input = itemInput.parse(body);
    return this.repository.update(db => {
      const section = sectionIn(db, sectionId);
      const item = { ...input, ...stamps(), sectionId };
      validItem(item, section);
      db.items.push(item);
      touch(section);
      return item;
    });
  }

  updateItem(id: string, body: unknown) {
    const input = itemPatch.parse(body);
    return this.repository.update(db => {
      const item = itemIn(db, id);
      validItem({ ...item, ...input }, sectionIn(db, item.sectionId));
      touch(sectionIn(db, item.sectionId));
      return touch(Object.assign(item, input));
    });
  }

  deleteItem(id: string) {
    return this.repository.update(db => {
      const item = itemIn(db, id);
      touch(sectionIn(db, item.sectionId));
      db.items = db.items.filter(item => item.id !== id);
      db.steps = db.steps.filter(step => step.itemId !== id);
      db.logs = db.logs.filter(log => !(log.ownerType === 'item' && log.ownerId === id));
    });
  }

  async listSteps(itemId: string) {
    const db = await this.repository.read();
    goalIn(db, itemId);
    return db.steps.filter(step => step.itemId === itemId);
  }

  createStep(itemId: string, body: unknown) {
    const input = stepInput.parse(body);
    return this.repository.update(db => {
      touch(goalIn(db, itemId));
      const step = { ...input, ...stamps(), itemId };
      db.steps.push(step);
      return step;
    });
  }

  updateStep(id: string, body: unknown) {
    const input = stepPatch.parse(body);
    return this.repository.update(db => {
      const step = found(db.steps.find(step => step.id === id), 'Step');
      touch(goalIn(db, step.itemId));
      return touch(Object.assign(step, input));
    });
  }

  deleteStep(id: string) {
    return this.repository.update(db => {
      const step = found(db.steps.find(step => step.id === id), 'Step');
      touch(goalIn(db, step.itemId));
      db.steps = db.steps.filter(step => step.id !== id);
    });
  }

  private logOwner(db: Database, type: 'section' | 'item', id: string) {
    return type === 'section' ? sectionIn(db, id) : itemIn(db, id);
  }

  async listLogs(type: 'section' | 'item', ownerId: string) {
    const db = await this.repository.read();
    this.logOwner(db, type, ownerId);
    return db.logs.filter(log => log.ownerType === type && log.ownerId === ownerId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }

  createLog(type: 'section' | 'item', ownerId: string, body: unknown) {
    const input = logInput.parse(body);
    return this.repository.update(db => {
      touch(this.logOwner(db, type, ownerId));
      const log = { ...input, ...stamps(), ownerType: type, ownerId };
      db.logs.push(log);
      return log;
    });
  }

  updateLog(id: string, body: unknown) {
    const input = logPatch.parse(body);
    return this.repository.update(db => {
      const log = found(db.logs.find(log => log.id === id), 'Log');
      touch(this.logOwner(db, log.ownerType, log.ownerId));
      return touch(Object.assign(log, input));
    });
  }

  deleteLog(id: string) {
    return this.repository.update(db => {
      const log = found(db.logs.find(log => log.id === id), 'Log');
      touch(this.logOwner(db, log.ownerType, log.ownerId));
      db.logs = db.logs.filter(log => log.id !== id);
    });
  }

  async finance() {
    const db = await this.repository.read();
    return { ...financeSummary(db), settings: db.financeSettings, accounts: db.accounts };
  }

  updateFinanceSettings(body: unknown) {
    const input = financeSettingsPatch.parse(body);
    return this.repository.update(db => {
      const next = { ...db.financeSettings, ...input };
      db.financeSettings = next;
      return next;
    });
  }

  async accounts() { return (await this.repository.read()).accounts; }

  createAccount(body: unknown) {
    const input = accountInput.parse(body);
    return this.repository.update(db => {
      const account = { ...input, ...stamps() };
      db.accounts.push(account);
      return account;
    });
  }

  updateAccount(id: string, body: unknown) {
    const input = accountPatch.parse(body);
    return this.repository.update(db => touch(Object.assign(
      found(db.accounts.find(account => account.id === id), 'Account'), input)));
  }

  deleteAccount(id: string) {
    return this.repository.update(db => {
      found(db.accounts.find(account => account.id === id), 'Account');
      db.accounts = db.accounts.filter(account => account.id !== id);
    });
  }

  async targets() { return (await this.finance()).targets; }

  createTarget(body: unknown) {
    const input = targetInput.parse(body);
    return this.repository.update(db => {
      const target = { ...input, ...stamps() };
      db.targets.push(target);
      return target;
    });
  }

  updateTarget(id: string, body: unknown) {
    const input = targetPatch.parse(body);
    return this.repository.update(db => {
      const target = found(db.targets.find(target => target.id === id), 'Target');
      return touch(Object.assign(target, input));
    });
  }

  deleteTarget(id: string) {
    return this.repository.update(db => {
      found(db.targets.find(target => target.id === id), 'Target');
      db.targets = db.targets.filter(target => target.id !== id);
    });
  }
}
