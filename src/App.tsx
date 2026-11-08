import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from './router';
import { ArrowRight, BookOpen, CheckCheck, CircleHelp, Download, LayoutDashboard, Leaf, LoaderCircle, Plus, RefreshCw, Sparkles, Target, Wallet, X } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from './api';
import { dateLabel, Empty, IconButton, Modal, moneyLabel, Progress } from './components';
import { CollectionPage, ItemDetail, SectionEditor, SectionPage } from './WorkspacePages';
import { FinancePage } from './FinancePage';
import { today, type SectionKind } from '../shared/models';
import { deadlineProgress, stepProgress } from '../shared/calculations';

function Dashboard() {
  const { state } = useWorkspace();
  const [create, setCreate] = useState<SectionKind | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  if (!state) return null;
  const activeLearning = state.items.filter(item => item.phase === 'active');
  const currentGoals = state.items.filter(item => item.phase === 'current');
  const done = state.items.filter(item => ['past', 'achieved'].includes(item.phase)).length;
  const deadlines = currentGoals.filter(item => item.deadline)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 4);
  const recent = [...state.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  return <div className="page-enter">
    <header className="page-header"><div><div className="eyebrow"><span className="status-dot" />Your personal workspace</div>
      <h1>{greeting}<br /><span className="heading-muted">Make space for what matters.</span></h1>
      <p>Learn something. Move forward. Build the life you have in mind.</p></div><div className="today-card"><span>Today</span>
        <strong>{new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date())}</strong>
        <small>{dateLabel(today(), { month: 'long', day: 'numeric', year: 'numeric' })}</small></div></header>
    <section className="dashboard-hero">
      <div><span className="eyebrow">Small steps, meaningful days</span><h2>A little intention<br />goes a long way.</h2>
        <p>This is your space to stay curious, follow through,<br className="desktop-break" /> and see how far you have come.</p>
        <Link to="/goals" className="button hero-button">Find your focus <ArrowRight size={16} /></Link></div>
      <div className="hero-art" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" />
        <span className="art-circle"><Leaf size={62} strokeWidth={1.1} /></span><span className="art-pill pill-learning"><BookOpen size={16} />Stay curious</span>
        <span className="art-pill pill-goals"><Sparkles size={16} />Keep growing</span><span className="art-dot dot-one" /><span className="art-dot dot-two" /></div>
    </section>
    <div className="stats-grid"><Link to="/learning" className="stat-card"><span className="tile-icon sage"><BookOpen size={20} /></span>
      <div><span>Learning in motion</span><strong>{activeLearning.length}<small>active items</small></strong></div><ArrowRight size={17} /></Link>
      <Link to="/goals" className="stat-card"><span className="tile-icon peach"><Target size={20} /></span>
        <div><span>Goals in focus</span><strong>{currentGoals.length}<small>current goals</small></strong></div><ArrowRight size={17} /></Link>
      <div className="stat-card"><span className="tile-icon lilac"><CheckCheck size={20} /></span>
        <div><span>Wins along the way</span><strong>{done}<small>completed items</small></strong></div></div></div>
    <div className="dashboard-grid"><section className="panel focus-panel"><div className="block-header"><div><h2>Your next small step</h2><p>Current goals with a date on the horizon.</p></div>
      <Link to="/goals" className="text-link">View goals <ArrowRight size={14} /></Link></div>
      {deadlines.length ? <div className="focus-list">{deadlines.map(item => {
        const deadline = deadlineProgress(item)!;
        return <button className="focus-row" key={item.id} onClick={() => setSelected(item.id)}>
          <span className="tile-icon small peach"><Target size={17} /></span><div><h3>{item.title}</h3>
            <span className={deadline.overdue ? 'text-danger' : 'muted'}>{deadline.overdue ? `${Math.abs(deadline.daysRemaining)} days overdue` : `${deadline.daysRemaining} days remaining`} &middot; {dateLabel(item.deadline!)}</span>
            <Progress value={stepProgress(item, state.steps)} label={`${item.title} completion`} /></div>
          <strong>{Math.round(stepProgress(item, state.steps))}%</strong><ArrowRight size={16} /></button>;
      })}</div> : <Empty title="No deadlines in focus" description="Add a current goal and a deadline to see your next milestone here."
        action={<Link to="/goals" className="text-link">Explore your goals <ArrowRight size={15} /></Link>} />}</section>
      <section className="dashboard-finance"><div className="block-header"><span><Wallet size={17} />Your financial picture</span><Link to="/financials" aria-label="Open Financials"><ArrowRight size={18} /></Link></div>
        <div className="dashboard-wealth">{moneyLabel(state.finance.wealth, state.financeSettings.currency)}</div><p>Total net wealth</p>
        <div className="metric-label"><span>Current benchmark</span><strong>{Math.round(state.finance.percentage)}%</strong></div>
        <Progress value={state.finance.percentage} label="Wealth toward current benchmark" tone="light" />
        <small>{state.finance.currentTarget ? `Of ${moneyLabel(state.finance.currentTarget, state.financeSettings.currency)} target` : 'Set up your savings formula to begin.'}</small>
        <Link to="/financials" className="finance-link">See the bigger picture <ArrowRight size={15} /></Link></section></div>
    <section className="panel activity-panel"><div className="block-header"><div><h2>A thread of progress</h2><p>The things you have been giving your attention to.</p></div><span className="subtle-badge">Recently updated</span></div>
      {recent.length ? <div className="recent-list">{recent.map(item => {
        const section = state.sections.find(section => section.id === item.sectionId)!;
        return <button key={item.id} className="recent-row" onClick={() => setSelected(item.id)}>
          <span className={`tile-icon small ${section.kind === 'learning' ? 'sage' : 'peach'}`}>{section.kind === 'learning' ? <BookOpen size={16} /> : <Target size={16} />}</span>
          <div><h3>{item.title}</h3><span>{section.name}</span></div><span className={`phase-badge ${item.phase}`}>{item.phase}</span><ArrowRight size={16} /></button>;
      })}</div> : <div className="welcome-start"><div><h3>Your story starts here.</h3><p>Create your first space. You can name it anything you like.</p></div>
        <button className="button secondary" onClick={() => setCreate('learning')}><BookOpen size={16} />A learning space</button>
        <button className="button secondary" onClick={() => setCreate('goals')}><Target size={16} />A goals space</button></div>}</section>
    {create && <SectionEditor kind={create} onClose={() => setCreate(null)} />}
    {selected && <ItemDetail itemId={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function CurrentPage() {
  const { pathname } = useLocation();
  if (pathname === '/') return <Dashboard />;
  if (pathname === '/learning') return <CollectionPage kind="learning" />;
  if (pathname === '/goals') return <CollectionPage kind="goals" />;
  if (pathname === '/financials') return <FinancePage />;
  if (/^\/(learning|goals)\/[^/]+$/.test(pathname)) return <SectionPage key={pathname} />;
  return <Empty title="A little off the path" description="This page does not exist."
    action={<Link to="/" className="button primary">Back to overview</Link>} />;
}

function Shell() {
  const { state, loading, pending, error, notice, dismiss, reload } = useWorkspace();
  const [create, setCreate] = useState<SectionKind | null>(null);
  const [help, setHelp] = useState(false);
  const location = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [location.pathname]);
  return <div className="app-shell">
    <a href="#main-content" className="skip-link" onClick={event => {
      event.preventDefault(); document.getElementById('main-content')?.focus();
    }}>Skip to content</a>
    <aside className="sidebar"><Link to="/" className="brand"><span className="brand-mark">f.</span><span>forma<span className="brand-dot">.</span></span></Link>
      <div className="workspace-label"><span className="avatar">Y</span><div><strong>Your workspace</strong><small>Personal, by design</small></div></div>
      <nav aria-label="Main navigation" className="main-nav">
        <NavLink to="/" end><LayoutDashboard size={18} />Overview</NavLink>
        <NavLink to="/learning"><BookOpen size={18} />Learning</NavLink>
        <NavLink to="/goals"><Target size={18} />Goals</NavLink>
        <NavLink to="/financials"><Wallet size={18} />Financials</NavLink>
      </nav>
      <div className="sidebar-spaces">{(['learning', 'goals'] as const).map(kind => <div key={kind} className="sidebar-group">
        <div className="sidebar-group-heading"><span>{kind === 'learning' ? 'Learning spaces' : 'Goals spaces'}</span>
          <IconButton label={`New ${kind} subsection`} onClick={() => setCreate(kind)} disabled={!state || pending}><Plus size={15} /></IconButton></div>
        {state?.sections.filter(section => section.kind === kind).map(section => <NavLink key={section.id} to={`/${kind}/${section.id}`} className="subsection-link">
          <span className={`space-dot ${kind}`} /><span>{section.name}</span></NavLink>)}
        {!state?.sections.some(section => section.kind === kind) && <p className="sidebar-empty">Make a space your own.</p>}
      </div>)}</div>
      <div className="sidebar-bottom"><div className="local-badge"><span className="status-dot" /><span>Your data stays local</span></div>
        <div className="sidebar-bottom-links"><a href="/api/export" title="Download a JSON backup"><Download size={16} />Export data</a>
          <IconButton label="About Forma" onClick={() => setHelp(true)}><CircleHelp size={17} /></IconButton></div></div>
    </aside>
    <div className="main-wrap"><div className="topbar"><span>A thoughtful space for a meaningful life.</span><div>
      {pending && <span className="saving"><LoaderCircle size={14} className="spin" />Saving</span>}
      <button className="refresh-button" disabled={loading || pending} onClick={() => void reload()} aria-label="Refresh workspace"><RefreshCw size={15} /></button>
      <span className="topbar-local">LOCAL WORKSPACE</span><span className="topbar-avatar">Y</span></div></div>
      <main id="main-content" tabIndex={-1}>
        {loading && !state ? <div className="loading-state" aria-label="Loading workspace" role="status"><div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" /><div className="skeleton skeleton-hero" /><div className="skeleton-grid">{[1, 2, 3].map(value => <div key={value} className="skeleton skeleton-card" />)}</div><p>Making room for your day...</p></div> :
          !state ? <Empty title="Your workspace is taking a moment" description={error ?? 'Unable to connect to the backend.'}
            action={<button className="button primary" onClick={() => void reload()}><RefreshCw size={16} />Try again</button>} /> :
          <CurrentPage />}
        <footer className="main-footer"><span>Made for your own pace.</span><span><Leaf size={13} />A little better, every day.</span></footer>
      </main>
    </div>
    {(error || notice) && <div className={`toast${error ? ' toast-error' : ''}`} role={error ? 'alert' : 'status'}>
      <span>{error || notice}</span>{error && <button onClick={() => void reload()} disabled={pending}>Refresh</button>}
      <IconButton label="Dismiss notification" onClick={dismiss}><X size={17} /></IconButton></div>}
    {create && state && <SectionEditor kind={create} onClose={() => setCreate(null)} />}
    {help && <Modal title="A space that is yours" onClose={() => setHelp(false)}><div className="help-content">
      <p>Forma brings your learning, goals, and finances into one quiet, intentional workspace.</p>
      <h3>Follow your own pattern</h3><p>Create named learning and goals subsections. Move cards freely between phases. Add dated journals to a subsection or to an individual item. Goals can have checkable steps and adjustable deadlines.</p>
      <h3>Keep the numbers clear</h3><p>Your net wealth is assets minus liabilities. The current benchmark uses monthly savings &times; salary months since your first earning month + an additional amount. Each month is included from the 28th; before then, the calculation uses the previous month&apos;s count. Milestones are separate: choose a month and enter the total amount you want to reach.</p>
      <h3>Local, not cloud</h3><p>Everything is saved through the Node API to <code>data/db.json</code> on this computer. Export a backup regularly. This v1 is for single-user localhost use and has no authentication.</p>
      <a className="button secondary" href="/api/export"><Download size={16} />Download a backup</a>
    </div></Modal>}
  </div>;
}

export function App() { return <WorkspaceProvider><Shell /></WorkspaceProvider>; }
