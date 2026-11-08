import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Landmark, Pencil, Plus, Settings2, Trash2, Wallet } from 'lucide-react';
import { useWorkspace } from './api';
import { Confirm, dateLabel, Empty, Field, Form, IconButton, Modal, moneyLabel, Progress, textValue } from './components';
import { today, type Account, type Target } from '../shared/models';
import { roundMoney } from '../shared/calculations';

export function FinanceSettingsEditor({ onClose }: { onClose: () => void }) {
  const { state, mutate } = useWorkspace();
  const settings = state!.financeSettings;
  return <Modal title="Make the numbers yours" subtitle="Your savings formula, your starting point." onClose={onClose}>
    <Form onClose={onClose} onSubmit={data => mutate('/finance/settings', 'PATCH', {
      currency: textValue(data, 'currency'), earningsStartMonth: textValue(data, 'earningsStartMonth'),
      monthlySavings: Number(data.get('monthlySavings')), additionalAmount: Number(data.get('additionalAmount')),
    }, 'Financial settings updated')}>
      <div className="form-row"><Field label="Currency"><select name="currency" defaultValue={settings.currency}>
        {Intl.supportedValuesOf('currency').map(code => <option key={code} value={code}>{code}</option>)}</select></Field>
        <Field label="First earning month" hint="This is month 1, not month 0."><input name="earningsStartMonth" type="month" required defaultValue={settings.earningsStartMonth} /></Field></div>
      <Field label="Target monthly savings"><input name="monthlySavings" type="number" min="0" max="1000000000000" step="0.01" required defaultValue={settings.monthlySavings} /></Field>
      <Field label="Additional amount" hint="A starting balance or extra savings to add to the formula."><input name="additionalAmount"
        type="number" min="0" max="1000000000000" step="0.01" required defaultValue={settings.additionalAmount} /></Field>
      <div className="formula-note">Benchmark = monthly savings &times; salary months + additional amount.<br />
        The current month is counted from the 28th, when your salary arrives.<br />
        Changing currency changes the display unit only; amounts are not converted.</div>
    </Form>
  </Modal>;
}

function AccountEditor({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { state, mutate } = useWorkspace();
  return <Modal title={account ? 'Update account' : 'Add a piece of your wealth'} subtitle="Keep balances current to see the whole picture." onClose={onClose}>
    <Form onClose={onClose} submit={account ? 'Update balance' : 'Add account'} onSubmit={data => mutate(
      account ? `/finance/accounts/${account.id}` : '/finance/accounts', account ? 'PATCH' : 'POST',
      { name: textValue(data, 'name'), type: textValue(data, 'type'), amount: Number(data.get('amount')) }, 'Account saved',
    )}>
      <Field label="Account name"><input autoFocus name="name" required maxLength={120} defaultValue={account?.name} placeholder="Savings, investments, a loan..." /></Field>
      <Field label="Type"><select name="type" defaultValue={account?.type ?? 'asset'}>
        <option value="asset">Asset - adds to wealth</option><option value="liability">Liability - subtracts from wealth</option></select></Field>
      <Field label={`Current balance (${state!.financeSettings.currency})`} hint="Enter a positive balance. Liabilities are subtracted automatically.">
        <input name="amount" type="number" min="0" max="1000000000000" step="0.01" required defaultValue={account?.amount} placeholder="0.00" /></Field>
    </Form>
  </Modal>;
}

function TargetEditor({ target, onClose }: { target?: Target; onClose: () => void }) {
  const { state, mutate } = useWorkspace();
  return <Modal title={target ? 'Adjust your milestone' : 'Give your future a milestone'} subtitle="A savings target to work toward, one month at a time." onClose={onClose}>
    <Form onClose={onClose} submit={target ? 'Save milestone' : 'Create milestone'} onSubmit={data => mutate(
      target ? `/finance/targets/${target.id}` : '/finance/targets', target ? 'PATCH' : 'POST',
      { name: textValue(data, 'name'), month: textValue(data, 'month'), amount: Number(data.get('amount')) }, 'Milestone saved',
    )}>
      <Field label="Milestone name"><input autoFocus name="name" required maxLength={120} defaultValue={target?.name} placeholder="My December 2027 target" /></Field>
      <Field label="Target month"><input name="month" type="month" required defaultValue={target?.month ?? today().slice(0, 7)} /></Field>
      <Field label={`Milestone amount (${state!.financeSettings.currency})`}
        hint={state!.financeSettings.currency === 'INR' ? 'For 30 lakh, enter 3000000.' : 'Enter the total wealth you want to reach.'}>
        <input name="amount" type="number" min="0" max="1000000000000" step="0.01" required
          defaultValue={target?.amount} placeholder="3000000" />
      </Field>
    </Form>
  </Modal>;
}

export function FinancePage() {
  const { state, mutate, pending } = useWorkspace();
  const [settings, setSettings] = useState(false);
  const [accountEditor, setAccountEditor] = useState<Account | 'new' | null>(null);
  const [targetEditor, setTargetEditor] = useState<Target | 'new' | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; kind: 'accounts' | 'targets'; name: string } | null>(null);
  if (!state) return null;
  const finance = state.finance;
  const benchmarkDifference = roundMoney(finance.wealth - finance.currentTarget);
  const format = (value: number) => moneyLabel(value, state.financeSettings.currency);
  const assets = state.accounts.filter(account => account.type === 'asset').reduce((sum, account) => sum + account.amount, 0);
  const liabilities = state.accounts.filter(account => account.type === 'liability').reduce((sum, account) => sum + account.amount, 0);
  return <div className="page-enter">
    <header className="page-header"><div><div className="eyebrow">A clearer picture of tomorrow</div><h1>Build a little freedom.</h1>
      <p>Your wealth, your rhythm, your next milestone.</p></div>
      <button className="button secondary" onClick={() => setSettings(true)}><Settings2 size={16} />Configure</button></header>
    <div className="finance-top">
      <section className="wealth-card"><div className="wealth-card-heading"><span><Wallet size={17} />Total net wealth</span><span className="currency-pill">{state.financeSettings.currency}</span></div>
        <h2>{format(finance.wealth)}</h2><p>A snapshot of everything you own, less what you owe.</p>
        <div className="wealth-breakdown"><div><span><ArrowUpRight size={15} />Assets</span><strong>{format(assets)}</strong></div>
          <div><span><ArrowDownLeft size={15} />Liabilities</span><strong>{format(liabilities)}</strong></div></div>
        <span className="wealth-decoration" aria-hidden="true" />
      </section>
      <section className="monthly-card panel"><div className="block-header"><h2>Current benchmark</h2><span className="subtle-badge">{dateLabel(today(), { month: 'short', year: 'numeric' })}</span></div>
        <div className="benchmark-amount">{format(finance.currentTarget)}</div><div className="metric-label"><span>Wealth toward benchmark</span><strong>{Math.round(finance.percentage)}%</strong></div>
        <Progress value={finance.percentage} label="Current benchmark progress" />
        <p className="muted small-text">{finance.currentTarget === 0 ? 'Set your monthly savings to establish a benchmark.' :
          `${format(Math.abs(benchmarkDifference))} ${benchmarkDifference >= 0 ? 'ahead of' : 'behind'} target.`}</p>
        <div className="formula-detail"><span>{format(state.financeSettings.monthlySavings)} <b>&times;</b> {finance.months} months <b>+</b> {format(state.financeSettings.additionalAmount)}</span>
          <small>Since {dateLabel(state.financeSettings.earningsStartMonth, { month: 'long', year: 'numeric' })} (inclusive). Each month counts from the 28th.</small></div>
      </section>
    </div>
    <section className="milestones"><div className="block-header"><div><h2>Milestones on the horizon</h2><p>Always ordered from the earliest target to the latest.</p></div>
      <button className="button primary small" disabled={pending} onClick={() => setTargetEditor('new')}><Plus size={16} />New milestone</button></div>
      {finance.targets.length ? <div className="milestone-grid">{finance.targets.map(target => <article className="milestone-card panel" key={target.id}>
        <div className="milestone-heading"><span className="subtle-badge">{dateLabel(target.month, { month: 'short', year: 'numeric' })}</span><div>
          <IconButton label={`Edit milestone: ${target.name}`} disabled={pending} onClick={() => setTargetEditor(target)}><Pencil size={14} /></IconButton>
          <IconButton label={`Delete milestone: ${target.name}`} disabled={pending} onClick={() => setDeleting({ id: target.id, kind: 'targets', name: target.name })} danger><Trash2 size={14} /></IconButton></div></div>
        <h3>{target.name}</h3><div className="milestone-amount">{format(target.amount)}</div>
        <div className="metric-label"><span>{format(finance.wealth)} saved</span><strong>{Math.round(target.percentage)}%</strong></div>
        <Progress value={target.percentage} label={`${target.name} progress`} />
        <p className="small-text muted">{target.amount === 0 ? 'Set a nonzero milestone amount.' : target.remaining === 0 ? 'Milestone reached. A little more freedom.' : `${format(target.remaining)} to go`}</p>
      </article>)}</div> : <div className="panel"><Empty title="Something to look forward to" description="Choose a target month and the amount you want to reach."
        action={<button className="button secondary" onClick={() => setTargetEditor('new')}><Plus size={16} />Create a milestone</button>} /></div>}
    </section>
    <section className="accounts panel"><div className="block-header"><div><h2>Where your wealth lives</h2><p>Update these balances whenever you want a fresh snapshot.</p></div>
      <button className="button secondary small" disabled={pending} onClick={() => setAccountEditor('new')}><Plus size={16} />Add account</button></div>
      {state.accounts.length ? <div className="account-list">{state.accounts.map(account => <article className="account-row" key={account.id}>
        <span className={`tile-icon small ${account.type === 'asset' ? 'sage' : 'peach'}`}><Landmark size={18} /></span>
        <div className="account-name"><h3>{account.name}</h3><span>{account.type === 'asset' ? 'Asset' : 'Liability'} &middot; Updated {dateLabel(account.updatedAt.slice(0, 10))}</span></div>
        <strong className={account.type === 'liability' ? 'text-danger' : ''}>{account.type === 'liability' ? '-' : ''}{format(account.amount)}</strong>
        <IconButton label={`Edit account: ${account.name}`} disabled={pending} onClick={() => setAccountEditor(account)}><Pencil size={15} /></IconButton>
        <IconButton label={`Delete account: ${account.name}`} disabled={pending} onClick={() => setDeleting({ id: account.id, kind: 'accounts', name: account.name })} danger><Trash2 size={15} /></IconButton>
      </article>)}</div> : <Empty title="Start with what you have" description="Add savings, cash, investments, or liabilities to calculate your total wealth."
        action={<button className="button secondary" onClick={() => setAccountEditor('new')}><Plus size={16} />Add your first account</button>} />}
    </section>
    {settings && <FinanceSettingsEditor onClose={() => setSettings(false)} />}
    {accountEditor && <AccountEditor account={accountEditor === 'new' ? undefined : accountEditor} onClose={() => setAccountEditor(null)} />}
    {targetEditor && <TargetEditor target={targetEditor === 'new' ? undefined : targetEditor} onClose={() => setTargetEditor(null)} />}
    {deleting && <Confirm title={`Delete "${deleting.name}"?`} description={deleting.kind === 'accounts'
      ? 'This account will be removed and your total wealth will be recalculated.' : 'This milestone will be permanently removed.'}
      onClose={() => setDeleting(null)} onConfirm={() => mutate(`/finance/${deleting.kind}/${deleting.id}`, 'DELETE', undefined, 'Deleted')} />}
  </div>;
}
