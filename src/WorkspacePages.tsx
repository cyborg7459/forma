import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from './router';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Circle, GripVertical, MoreHorizontal, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useWorkspace } from './api';
import { Confirm, dateLabel, Empty, Field, Form, IconButton, Modal, Progress, textValue } from './components';
import { deadlineProgress, stepProgress } from '../shared/calculations';
import { phaseLabels, phases, today, type Item, type Log, type Phase, type Section, type SectionKind, type Step } from '../shared/models';

export function SectionEditor({ kind, section, onClose }: { kind: SectionKind; section?: Section; onClose: () => void }) {
  const { mutate } = useWorkspace();
  return <Modal title={section ? 'Edit subsection' : `A new ${kind === 'learning' ? 'learning' : 'goals'} space`}
    subtitle="Make room for something that matters to you." onClose={onClose}>
    <Form onClose={onClose} submit={section ? 'Save changes' : 'Create subsection'} onSubmit={data => mutate(
      section ? `/sections/${section.id}` : '/sections', section ? 'PATCH' : 'POST',
      { name: textValue(data, 'name'), description: textValue(data, 'description'), ...(!section ? { kind } : {}) },
      section ? 'Subsection updated' : 'Your new space is ready',
    )}>
      <Field label="Subsection name"><input autoFocus name="name" required maxLength={120}
        defaultValue={section?.name} placeholder={kind === 'learning' ? 'Books, courses, languages...' : 'Health, career, personal...'} /></Field>
      <Field label="Description"><textarea name="description" rows={4} maxLength={10000}
        defaultValue={section?.description} placeholder="What would you like to explore or accomplish here?" /></Field>
    </Form>
  </Modal>;
}

export function CollectionPage({ kind }: { kind: SectionKind }) {
  const { state } = useWorkspace();
  const [create, setCreate] = useState(false);
  if (!state) return null;
  const sections = state.sections.filter(section => section.kind === kind);
  const learning = kind === 'learning';
  return <div className="page-enter">
    <header className="page-header"><div><div className="eyebrow">A little better, every day</div>
      <h1>{learning ? 'Keep your curiosity alive.' : 'Big ideas. Small steps.'}</h1>
      <p>{learning ? 'A home for everything you want to learn, and everything it teaches you.' : 'Turn the things you care about into things you make happen.'}</p>
    </div><button className="button primary" onClick={() => setCreate(true)}><Plus size={17} />New subsection</button></header>
    <div className="section-grid">
      {sections.map(section => {
        const items = state.items.filter(item => item.sectionId === section.id);
        const active = items.filter(item => item.phase === (learning ? 'active' : 'current')).length;
        const done = items.filter(item => item.phase === (learning ? 'past' : 'achieved')).length;
        return <Link to={`/${kind}/${section.id}`} className="section-card" key={section.id}>
          <div className="section-card-top"><span className={`tile-icon ${learning ? 'sage' : 'peach'}`}>
            {learning ? <BookOpen size={23} /> : <Target size={23} />}</span><ArrowRight size={20} /></div>
          <h2>{section.name}</h2><p>{section.description || (learning ? 'Collect ideas. Follow your curiosity.' : 'One step closer to your next milestone.')}</p>
          <div className="section-card-bottom"><span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            <span>{active} {learning ? 'active' : 'current'} <span className="separator-dot">/</span> {done} {learning ? 'finished' : 'achieved'}</span></div>
        </Link>;
      })}
      <button className="new-section-card" onClick={() => setCreate(true)}><span className="empty-mark"><Plus size={22} /></span>
        <h3>{sections.length ? 'Room for more' : 'Start with your first space'}</h3>
        <p>{learning ? 'Books, podcasts, a new skill...' : 'A healthier you, a new project...'}</p></button>
    </div>
    <div className="quiet-note"><span className="note-line" />{learning ? 'Learning is not a race. Follow what makes you curious.' : 'You do not have to see the whole staircase. Just take the first step.'}</div>
    {create && <SectionEditor kind={kind} onClose={() => setCreate(false)} />}
  </div>;
}

export function ItemEditor({ section, item, phase, onClose }: {
  section: Section; item?: Item; phase?: Phase; onClose: () => void;
}) {
  const { mutate } = useWorkspace();
  const [start, setStart] = useState(item?.startedOn ?? today());
  const goal = section.kind === 'goals';
  return <Modal title={item ? `Edit ${goal ? 'goal' : 'learning item'}` : goal ? 'What are you working toward?' : 'What will you explore next?'}
    subtitle={section.name} onClose={onClose}>
    <Form onClose={onClose} submit={item ? 'Save changes' : goal ? 'Create goal' : 'Add learning item'} onSubmit={data => mutate(
      item ? `/items/${item.id}` : `/sections/${section.id}/items`, item ? 'PATCH' : 'POST',
      { title: textValue(data, 'title'), description: textValue(data, 'description'), phase: textValue(data, 'phase'),
        startedOn: start, deadline: goal ? textValue(data, 'deadline') || null : null },
      item ? 'Item updated' : goal ? 'Goal created' : 'Added to your learning space',
    )}>
      <Field label={goal ? 'Goal title' : 'Title'}><input autoFocus name="title" required maxLength={120}
        defaultValue={item?.title} placeholder={goal ? 'Run my first half marathon' : 'The book, course, or skill on your mind'} /></Field>
      <Field label="Description"><textarea name="description" rows={3} maxLength={10000}
        defaultValue={item?.description} placeholder={goal ? 'What does success look like?' : 'A little context, a link, or why it interests you.'} /></Field>
      <Field label="Phase"><select name="phase" defaultValue={item?.phase ?? phase ?? (goal ? 'future' : 'planned')}>
        {phases[section.kind].map(value => <option key={value} value={value}>{phaseLabels[value]}</option>)}</select></Field>
      {goal && <div className="form-row"><Field label="Start date"><input name="startedOn" type="date" required value={start}
        onChange={event => setStart(event.target.value)} /></Field>
        <Field label="Deadline (optional)" hint="You can adjust this whenever life changes."><input name="deadline" type="date"
          min={start} defaultValue={item?.deadline ?? ''} /></Field></div>}
    </Form>
  </Modal>;
}

export function Logs({ ownerType, ownerId, title = 'Progress journal' }: {
  ownerType: 'section' | 'item'; ownerId: string; title?: string;
}) {
  const { state, mutate, pending } = useWorkspace();
  const [editing, setEditing] = useState<Log | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Log | null>(null);
  const logs = (state?.logs ?? []).filter(log => log.ownerType === ownerType && log.ownerId === ownerId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const existing = editing && editing !== 'new' ? editing : undefined;
  return <section className="journal">
    <div className="block-header"><div><h2>{title}</h2><p>A record of the thoughts and small wins along the way.</p></div>
      <button className="button secondary small" disabled={pending} onClick={() => setEditing('new')}><Plus size={15} />Add log</button></div>
    {logs.length ? <div className="log-list">{logs.map(log => <article className="log-entry" key={log.id}>
      <div className="log-date"><span className="timeline-dot" /><time dateTime={log.date}>{dateLabel(log.date)}</time>
        {log.updatedAt !== log.createdAt && <span className="edited">edited</span>}</div>
      <p>{log.content}</p><div className="log-actions">
        <IconButton label="Edit log" disabled={pending} onClick={() => setEditing(log)}><Pencil size={15} /></IconButton>
        <IconButton label="Delete log" disabled={pending} onClick={() => setDeleting(log)} danger><Trash2 size={15} /></IconButton>
      </div></article>)}</div> :
      <div className="journal-empty"><Pencil size={18} /><p>Nothing written yet. Every thought is worth keeping.</p></div>}
    {editing && <Modal title={existing ? 'Edit your log' : 'A moment to reflect'} onClose={() => setEditing(null)}>
      <Form onClose={() => setEditing(null)} submit={existing ? 'Save log' : 'Add log'} onSubmit={data => mutate(
        existing ? `/logs/${existing.id}` : `/${ownerType === 'section' ? 'sections' : 'items'}/${ownerId}/logs`,
        existing ? 'PATCH' : 'POST', { content: textValue(data, 'content'), date: textValue(data, 'date') }, 'Journal saved',
      )}>
        <Field label="Date"><input type="date" name="date" required defaultValue={existing?.date ?? today()} /></Field>
        <Field label="Your thoughts"><textarea autoFocus name="content" rows={6} required maxLength={20000}
          defaultValue={existing?.content} placeholder="What did you learn? What moved forward? What is on your mind?" /></Field>
      </Form></Modal>}
    {deleting && <Confirm title="Delete this log?" description="This journal entry will be permanently removed."
      onClose={() => setDeleting(null)} onConfirm={() => mutate(`/logs/${deleting.id}`, 'DELETE', undefined, 'Log deleted')} />}
  </section>;
}

function Steps({ item }: { item: Item }) {
  const { state, mutate, pending } = useWorkspace();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<Step | null>(null);
  const [deleting, setDeleting] = useState<Step | null>(null);
  const steps = state!.steps.filter(step => step.itemId === item.id);
  const completed = steps.filter(step => step.completed).length;
  return <section className="steps-block"><div className="block-header"><h2>The small steps</h2><span className="muted">{completed} of {steps.length} complete</span></div>
    <Progress value={stepProgress(item, steps)} label="Goal completion" />
    <div className="step-list">{steps.map(step => <div className={`step-row${step.completed ? ' completed' : ''}`} key={step.id}>
      <button className="step-check" aria-label={`${step.completed ? 'Mark undone' : 'Mark done'}: ${step.title}`}
        aria-pressed={step.completed} disabled={pending} onClick={() => void mutate(`/steps/${step.id}`, 'PATCH', { completed: !step.completed }, 'Step updated')}>
        {step.completed ? <Check size={15} /> : <Circle size={19} />}</button><span>{step.title}</span>
      <IconButton label={`Edit step: ${step.title}`} disabled={pending} onClick={() => setEditing(step)}><Pencil size={14} /></IconButton>
      <IconButton label={`Delete step: ${step.title}`} disabled={pending} onClick={() => setDeleting(step)} danger><Trash2 size={14} /></IconButton>
    </div>)}</div>
    <form className="inline-form" onSubmit={async event => {
      event.preventDefault();
      if (pending) return;
      if (await mutate(`/items/${item.id}/steps`, 'POST', { title }, 'Step added')) setTitle('');
    }}><input aria-label="New step" placeholder="Break it down into a small, doable step..." value={title}
      onChange={event => setTitle(event.target.value)} required maxLength={120} disabled={pending} />
      <button className="button secondary small" disabled={pending}><Plus size={16} />Add step</button></form>
    {editing && <Modal title="Edit step" onClose={() => setEditing(null)}>
      <Form onClose={() => setEditing(null)} onSubmit={data => mutate(`/steps/${editing.id}`, 'PATCH', { title: textValue(data, 'title') })}>
        <Field label="Step title"><input autoFocus name="title" required maxLength={120} defaultValue={editing.title} /></Field>
      </Form></Modal>}
    {deleting && <Confirm title="Delete this step?" description="Goal progress will be recalculated from the remaining steps."
      onClose={() => setDeleting(null)} onConfirm={() => mutate(`/steps/${deleting.id}`, 'DELETE', undefined, 'Step deleted')} />}
  </section>;
}

export function ItemDetail({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { state, mutate, pending } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const item = state!.items.find(item => item.id === itemId);
  if (!item) return null;
  const section = state!.sections.find(section => section.id === item.sectionId)!;
  const goal = section.kind === 'goals';
  const deadline = deadlineProgress(item);
  const steps = state!.steps.filter(step => step.itemId === itemId);
  return <Modal title={item.title} subtitle={`${goal ? 'Goals' : 'Learning'} / ${section.name}`} onClose={onClose} wide>
    <div className="detail-body">
      <div className="detail-toolbar"><label className="phase-field"><span>Phase</span>
        <select aria-label="Move to phase" value={item.phase} disabled={pending}
          onChange={event => void mutate(`/items/${item.id}`, 'PATCH', { phase: event.target.value }, `Moved to ${phaseLabels[event.target.value as Phase]}`)}>
          {phases[section.kind].map(value => <option key={value} value={value}>{phaseLabels[value]}</option>)}</select></label>
        <div className="detail-actions"><button className="button secondary small" disabled={pending} onClick={() => setEditing(true)}><Pencil size={14} />Edit details</button>
          <IconButton label="Delete item" disabled={pending} onClick={() => setDeleting(true)} danger><Trash2 size={17} /></IconButton></div></div>
      {item.description ? <p className="item-description">{item.description}</p> : <p className="muted">Add a description to give this {goal ? 'goal' : 'learning item'} a little context.</p>}
      {goal && <div className="detail-metrics">
        <div><div className="metric-label"><span>Step completion</span><strong>{Math.round(stepProgress(item, steps))}%</strong></div>
          <Progress value={stepProgress(item, steps)} label="Step completion" />
          <small>{steps.length ? `${steps.filter(step => step.completed).length} of ${steps.length} steps complete` : 'Add steps to track your progress'}</small></div>
        <div><div className="metric-label"><span><CalendarDays size={14} />Timeline</span><strong className={deadline?.overdue && item.phase !== 'achieved' ? 'text-danger' : ''}>
          {deadline ? item.phase === 'achieved' ? 'Achieved' : deadline.overdue ? `${Math.abs(deadline.daysRemaining)} days overdue` : `${deadline.daysRemaining} days left` : 'No deadline'}</strong></div>
          <Progress value={deadline?.elapsed ?? 0} label="Deadline time elapsed" tone={deadline?.overdue ? 'orange' : 'sand'} />
          <small>{dateLabel(item.startedOn)}{item.deadline ? ` - ${dateLabel(item.deadline)}` : ' - open-ended'} <button className="text-button" onClick={() => setEditing(true)}>Adjust</button></small></div>
      </div>}
      {goal && <Steps item={item} />}
      <Logs ownerType="item" ownerId={item.id} title={goal ? 'Goal journal' : 'Thoughts & notes'} />
    </div>
    {editing && <ItemEditor section={section} item={item} onClose={() => setEditing(false)} />}
    {deleting && <Confirm title={`Delete "${item.title}"?`} description="This item, all of its steps, and its journal entries will be permanently deleted."
      onClose={() => setDeleting(false)} onConfirm={async () => {
        const success = await mutate(`/items/${item.id}`, 'DELETE', undefined, 'Item deleted');
        if (success) onClose();
        return success;
      }} />}
  </Modal>;
}

export function ItemCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const { state, mutate, pending } = useWorkspace();
  const section = state!.sections.find(section => section.id === item.sectionId)!;
  const goal = section.kind === 'goals';
  const steps = state!.steps.filter(step => step.itemId === item.id);
  const logs = state!.logs.filter(log => log.ownerType === 'item' && log.ownerId === item.id);
  const deadline = deadlineProgress(item);
  return <article className="item-card" draggable={!pending} onDragStart={event => {
    event.dataTransfer.setData('application/x-forma-item', item.id);
    event.dataTransfer.effectAllowed = 'move';
  }}>
    <div className="item-card-header"><span className="item-type"><GripVertical size={13} />{goal ? 'Goal' : 'Learning'}</span>
      <IconButton label={`Open ${item.title}`} onClick={onOpen}><MoreHorizontal size={18} /></IconButton></div>
    <button className="item-title" onClick={onOpen}>{item.title}</button>
    {item.description && <p className="card-description">{item.description}</p>}
    {goal && <div className="card-progress"><div className="metric-label"><span>{steps.filter(step => step.completed).length}/{steps.length} steps</span>
      <strong>{Math.round(stepProgress(item, steps))}%</strong></div><Progress value={stepProgress(item, steps)} label={`${item.title} completion`} /></div>}
    {goal && deadline && <div className="card-deadline"><div className="metric-label"><span><CalendarDays size={13} />{dateLabel(item.deadline!, { month: 'short', day: 'numeric' })}</span>
      <span className={deadline.overdue && item.phase !== 'achieved' ? 'text-danger' : ''}>{item.phase === 'achieved' ? 'Achieved' : deadline.overdue ? 'Overdue' : `${deadline.daysRemaining}d left`}</span></div>
      <Progress value={deadline.elapsed} label={`${item.title} deadline time elapsed`} tone={deadline.overdue ? 'orange' : 'sand'} /></div>}
    <div className="item-card-footer"><span>{logs.length ? `${logs.length} ${logs.length === 1 ? 'log' : 'logs'}` : 'A fresh start'}</span>
      <select aria-label={`Move ${item.title} to phase`} value={item.phase} disabled={pending} onChange={event =>
        void mutate(`/items/${item.id}`, 'PATCH', { phase: event.target.value }, 'Phase updated')}>
        {phases[section.kind].map(phase => <option key={phase} value={phase}>{phaseLabels[phase]}</option>)}
      </select></div>
  </article>;
}

function PhaseItems({ items, phase, emptyMessage, onOpen }: {
  items: Item[]; phase: Phase; emptyMessage: string; onOpen: (id: string) => void;
}) {
  const reference = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>();
  const scrollable = items.length > 3;
  const visibleIds = items.slice(0, 3).map(item => item.id).join(',');

  useLayoutEffect(() => {
    if (!scrollable) {
      setMaxHeight(undefined);
      return;
    }
    const container = reference.current!;
    const cards = Array.from(container.children).slice(0, 3);
    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(container).rowGap);
      const height = cards.reduce((total, card) => total + card.getBoundingClientRect().height, 0);
      setMaxHeight(Math.ceil(height + gap * (cards.length - 1)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [scrollable, visibleIds]);

  return <div ref={reference} className={`column-items${scrollable ? ' is-scrollable' : ''}`}
    style={scrollable ? { maxHeight } : undefined} tabIndex={scrollable ? 0 : undefined}
    role={scrollable ? 'region' : undefined} aria-label={scrollable ? `${phaseLabels[phase]} items` : undefined}>
    {items.map(item => <ItemCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />)}
    {!items.length && <div className="column-empty"><span>{emptyMessage}</span></div>}
  </div>;
}

export function SectionPage() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { state, mutate, pending } = useWorkspace();
  const [edit, setEdit] = useState(false);
  const [create, setCreate] = useState<Phase | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'board' | 'journal'>('board');
  const [dragPhase, setDragPhase] = useState<Phase | null>(null);
  const [search, setSearch] = useState('');
  const section = state!.sections.find(section => section.id === sectionId);
  if (!section) return <Empty title="This space could not be found" description="It may have been deleted."
    action={<Link className="button secondary" to="/">Back to overview</Link>} />;
  const items = state!.items.filter(item => item.sectionId === section.id);
  const learning = section.kind === 'learning';
  return <div className="page-enter">
    <Link to={`/${section.kind}`} className="back-link"><ArrowLeft size={15} />{learning ? 'Learning' : 'Goals'}</Link>
    <header className="page-header section-heading"><div><div className="eyebrow">Your {learning ? 'learning' : 'goals'} space</div><h1>{section.name}</h1>
      <p className="preserve-lines">{section.description || 'A little progress, one day at a time.'}</p></div>
      <div className="header-actions"><IconButton label="Edit subsection" disabled={pending} onClick={() => setEdit(true)}><Pencil size={18} /></IconButton>
        <IconButton label="Delete subsection" disabled={pending} onClick={() => setDeleting(true)} danger><Trash2 size={18} /></IconButton>
        <button className="button primary" disabled={pending} onClick={() => setCreate(learning ? 'planned' : 'future')}><Plus size={17} />{learning ? 'Add item' : 'New goal'}</button></div></header>
    <div className="board-toolbar"><div className="tabs" role="tablist" aria-label="Subsection view">
      <button id="board-tab" role="tab" aria-controls="board-panel" aria-selected={tab === 'board'} className={tab === 'board' ? 'selected' : ''}
        onClick={() => setTab('board')}>Board <span>{items.length}</span></button>
      <button id="journal-tab" role="tab" aria-controls="journal-panel" aria-selected={tab === 'journal'} className={tab === 'journal' ? 'selected' : ''}
        onClick={() => setTab('journal')}>Subsection journal</button></div>
      {tab === 'board' && <input type="search" className="search-input" aria-label="Search items" placeholder="Find an item..."
        value={search} onChange={event => setSearch(event.target.value)} />}</div>
    {tab === 'board' ? <div className="board" id="board-panel" role="tabpanel" aria-labelledby="board-tab">
      {phases[section.kind].map(phase => {
        const phaseItems = items.filter(item => item.phase === phase && `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
        return <section className={`board-column${dragPhase === phase ? ' drag-over' : ''}`} key={phase}
          onDragOver={event => { if (event.dataTransfer.types.includes('application/x-forma-item')) { event.preventDefault(); setDragPhase(phase); } }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragPhase(null); }}
          onDrop={event => {
            event.preventDefault(); setDragPhase(null);
            const id = event.dataTransfer.getData('application/x-forma-item');
            if (!pending && items.some(item => item.id === id)) void mutate(`/items/${id}`, 'PATCH', { phase }, `Moved to ${phaseLabels[phase]}`);
          }}>
          <div className="column-heading"><h2><span className={`phase-dot ${phase}`} />{phaseLabels[phase]}<span className="count">{phaseItems.length}</span></h2>
            <IconButton label={`Add to ${phaseLabels[phase]}`} disabled={pending} onClick={() => setCreate(phase)}><Plus size={17} /></IconButton></div>
          <PhaseItems items={phaseItems} phase={phase} onOpen={setSelected}
            emptyMessage={search ? 'No matching items' : phase === 'past' || phase === 'achieved' ? 'Your wins will live here.' : 'A little room for possibility.'} />
          <button className="add-card" disabled={pending} onClick={() => setCreate(phase)}><Plus size={15} />{learning ? 'Add an item' : 'Add a goal'}</button>
        </section>;
      })}
    </div> : <div id="journal-panel" role="tabpanel" aria-labelledby="journal-tab" className="panel">
      <Logs ownerType="section" ownerId={section.id} title={`${section.name} journal`} />
    </div>}
    {tab === 'board' && <p className="board-hint">Drag cards between phases, or use the phase menu on any card. Nothing is locked in.</p>}
    {edit && <SectionEditor kind={section.kind} section={section} onClose={() => setEdit(false)} />}
    {create && <ItemEditor section={section} phase={create} onClose={() => setCreate(null)} />}
    {selected && <ItemDetail itemId={selected} onClose={() => setSelected(null)} />}
    {deleting && <Confirm title={`Delete "${section.name}"?`} description="This subsection and all its items, steps, and journal entries will be permanently deleted."
      onClose={() => setDeleting(false)} onConfirm={async () => {
        const success = await mutate(`/sections/${section.id}`, 'DELETE', undefined, 'Subsection deleted');
        if (success) navigate(`/${section.kind}`);
        return success;
      }} />}
  </div>;
}
