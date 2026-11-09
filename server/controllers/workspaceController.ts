import type { RequestHandler } from 'express';
import type { WorkspaceService } from '../services/workspaceService.js';

type Endpoint = (request: Parameters<RequestHandler>[0]) => Promise<unknown>;
const endpoint = (action: Endpoint, status = 200): RequestHandler => async (request, response) => {
  const data = await action(request);
  if (status === 204) response.status(204).end();
  else response.status(status).json({ data });
};
const parameter = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

export function workspaceController(service: WorkspaceService) {
  return {
    state: endpoint(() => service.state()),
    sections: endpoint(request => service.listSections(request.query.kind)),
    section: endpoint(request => service.section(parameter(request.params.id))),
    createSection: endpoint(request => service.createSection(request.body), 201),
    updateSection: endpoint(request => service.updateSection(parameter(request.params.id), request.body)),
    deleteSection: endpoint(request => service.deleteSection(parameter(request.params.id)), 204),
    items: endpoint(request => service.listItems(parameter(request.params.id))),
    item: endpoint(request => service.item(parameter(request.params.id))),
    createItem: endpoint(request => service.createItem(parameter(request.params.id), request.body), 201),
    updateItem: endpoint(request => service.updateItem(parameter(request.params.id), request.body)),
    deleteItem: endpoint(request => service.deleteItem(parameter(request.params.id)), 204),
    steps: endpoint(request => service.listSteps(parameter(request.params.id))),
    createStep: endpoint(request => service.createStep(parameter(request.params.id), request.body), 201),
    updateStep: endpoint(request => service.updateStep(parameter(request.params.id), request.body)),
    deleteStep: endpoint(request => service.deleteStep(parameter(request.params.id)), 204),
    sectionLogs: endpoint(request => service.listLogs('section', parameter(request.params.id))),
    itemLogs: endpoint(request => service.listLogs('item', parameter(request.params.id))),
    createSectionLog: endpoint(request => service.createLog('section', parameter(request.params.id), request.body), 201),
    createItemLog: endpoint(request => service.createLog('item', parameter(request.params.id), request.body), 201),
    updateLog: endpoint(request => service.updateLog(parameter(request.params.id), request.body)),
    deleteLog: endpoint(request => service.deleteLog(parameter(request.params.id)), 204),
    finance: endpoint(() => service.finance()),
    accounts: endpoint(() => service.accounts()),
    createAccount: endpoint(request => service.createAccount(request.body), 201),
    updateAccount: endpoint(request => service.updateAccount(parameter(request.params.id), request.body)),
    deleteAccount: endpoint(request => service.deleteAccount(parameter(request.params.id)), 204),
    targets: endpoint(() => service.targets()),
    createTarget: endpoint(request => service.createTarget(request.body), 201),
    updateTarget: endpoint(request => service.updateTarget(parameter(request.params.id), request.body)),
    deleteTarget: endpoint(request => service.deleteTarget(parameter(request.params.id)), 204),
    settings: endpoint(async () => (await service.repository.read()).financeSettings),
    updateSettings: endpoint(request => service.updateFinanceSettings(request.body)),
    export: (async (_request, response) => {
      const db = await service.repository.read();
      response.attachment(`forma-backup-${new Date().toISOString().slice(0, 10)}.json`).json(db);
    }) satisfies RequestHandler,
  };
}
