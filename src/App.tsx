import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Archive, ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, CheckSquare, ChevronLeft, ChevronRight, Circle, Flower2, Heart, Home, ListTodo, MoreHorizontal, NotebookPen, Pin, Plus, Search, Settings, Sparkles, Trash2, X } from 'lucide-react'
import { Share } from '@capacitor/share'
import { defaultData, loadData, saveData } from './db'
import type { BloomData, BloomEvent, Category, Note, Task } from './types'

type View = 'Home' | 'Notes' | 'Tasks' | 'Calendar' | 'More'
const colors = ['#fff0e7', '#f9e5eb', '#eee9fa', '#e7f0e5', '#fff2ce', '#e5eef7']
const today = () => new Date().toISOString().slice(0, 10)
const uid = () => crypto.randomUUID()
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const fullDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
function notePreview(note: Note) {
  const items = note.checklist.slice(0, 2).map(item => `${item.startsWith('✓ ') ? '✓' : '○'} ${item.startsWith('✓ ') ? item.slice(2) : item}`)
  if (note.checklist.length > 2) items.push(`+${note.checklist.length - 2} more checklist items`)
  return [...items, note.content.trim()].filter(Boolean).join(' · ')
}

export default function App() {
  const [data, setData] = useState<BloomData>(defaultData)
  const [view, setView] = useState<View>('Home')
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<'note' | 'task' | 'event' | 'category' | null>(null)
  const [editing, setEditing] = useState<Note | Task | BloomEvent | null>(null)
  const [filter, setFilter] = useState('Today')
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(today())
  const [archived, setArchived] = useState(false)

  useEffect(() => { loadData().then(value => { setData(value); setReady(true) }) }, [])
  useEffect(() => { if (ready) void saveData(data) }, [data, ready])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer) }, [notice])
  const update = (patch: Partial<BloomData>) => setData(current => ({ ...current, ...patch }))
  const categories = data.categories
  const catName = (id: string) => categories.find(category => category.id === id)?.name ?? 'Personal'
  const shownNotes = useMemo(() => data.notes.filter(note => note.archived === archived && `${note.title} ${note.content} ${catName(note.category)}`.toLowerCase().includes(query.toLowerCase())), [data.notes, archived, query, categories])
  const globalResults = useMemo(() => ({
    notes: data.notes.filter(note => !note.archived && `${note.title} ${note.content} ${catName(note.category)}`.toLowerCase().includes(query.toLowerCase())),
    tasks: data.tasks.filter(task => `${task.title} ${task.description} ${catName(task.category)}`.toLowerCase().includes(query.toLowerCase())),
    events: data.events.filter(event => `${event.title} ${event.description}`.toLowerCase().includes(query.toLowerCase())),
  }), [data.notes, data.tasks, data.events, query, categories])
  const visibleTasks = useMemo(() => data.tasks.filter(task => `${task.title} ${task.description} ${catName(task.category)}`.toLowerCase().includes(query.toLowerCase())).filter(task => {
    if (filter === 'Today') return !task.completed && (!task.dueDate || task.dueDate <= today())
    if (filter === 'Upcoming') return !task.completed && task.dueDate > today()
    if (filter === 'Completed') return task.completed
    if (filter === 'High priority') return !task.completed && task.priority === 'High'
    return true
  }).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')), [data.tasks, filter, query, categories])
  const openModal = (kind: 'note' | 'task' | 'event' | 'category', item: Note | Task | BloomEvent | null = null) => { setEditing(item); setModal(kind) }
  const removeItem = (kind: 'note' | 'task' | 'event', id: string) => {
    if (!window.confirm('Delete this forever? This can’t be undone.')) return
    if (kind === 'note') update({ notes: data.notes.filter(item => item.id !== id) })
    if (kind === 'task') update({ tasks: data.tasks.filter(item => item.id !== id) })
    if (kind === 'event') update({ events: data.events.filter(item => item.id !== id) })
    setModal(null); setEditing(null); setNotice('A little tidied up ✿')
  }
  const saveNote = (item: Note) => { update({ notes: [item, ...data.notes.filter(note => note.id !== item.id)] }); setModal(null); setEditing(null); setNotice('Note saved ✿') }
  const saveTask = (item: Task) => { update({ tasks: [item, ...data.tasks.filter(task => task.id !== item.id)] }); setModal(null); setEditing(null); setNotice('Task saved ✿') }
  const saveEvent = (item: BloomEvent) => { update({ events: [item, ...data.events.filter(event => event.id !== item.id)] }); setModal(null); setEditing(null); setNotice('Event saved ✿') }
  const toggleTask = (task: Task) => update({ tasks: data.tasks.map(item => item.id === task.id ? { ...item, completed: !item.completed } : item) })
  const addNote = () => openModal('note')
  const exportData = async () => {
    const filename = `little-bloom-${today()}.json`
    const backup = JSON.stringify(data, null, 2)
    if (Capacitor.isNativePlatform()) {
      try {
        const file = await Filesystem.writeFile({ path: filename, data: backup, directory: Directory.Cache, encoding: Encoding.UTF8 })
        await Share.share({ title: 'Little Bloom backup', files: [file.uri] })
        setNotice('Your backup is ready ✿')
      } catch {
        setNotice('The backup could not be shared. Please try again.')
      }
      return
    }
    const blob = new Blob([backup], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); setNotice('Your backup is ready ✿')
  }
  const importData = async (file?: File) => { if (!file) return; try { const parsed = JSON.parse(await file.text()) as BloomData; if (!Array.isArray(parsed.notes) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.events) || !Array.isArray(parsed.categories)) throw new Error('Invalid backup'); update({ ...defaultData, ...parsed }); setNotice('Your backup is restored ✿') } catch { setNotice('That file doesn’t look like a Little Bloom backup.') } }
  const navItems: { name: View; icon: typeof Home }[] = [{ name: 'Home', icon: Home }, { name: 'Notes', icon: NotebookPen }, { name: 'Tasks', icon: CheckSquare }, { name: 'Calendar', icon: CalendarDays }, { name: 'More', icon: MoreHorizontal }]

  return <div className="app-shell" data-theme={data.theme}>
    <header className="topbar"><a className="brand" href="#home" onClick={event => { event.preventDefault(); setView('Home') }}><span className="brand-mark"><img src="/icon-192.svg" alt="" /></span><span>little bloom<small>your personal notebook</small></span></a><button className="icon-button search-toggle" aria-label="Search" onClick={() => document.getElementById('global-search')?.focus()}><Search size={19} /></button></header>
    <main className="main-content">
      <div className="search-wrap"><Search size={16} /><input id="global-search" placeholder="Search your little world..." value={query} onChange={event => setQuery(event.target.value)} /><kbd>⌘ K</kbd></div>
      {query && <><div className="search-hint">Searching your notes, tasks, and plans for “{query}”</div><section className="global-results">{[
        ...globalResults.notes.slice(0, 3).map(item => ({ kind: 'note' as const, id: item.id, title: item.title || 'Untitled note', subtitle: 'Note', item })),
        ...globalResults.tasks.slice(0, 3).map(item => ({ kind: 'task' as const, id: item.id, title: item.title, subtitle: 'Task', item })),
        ...globalResults.events.slice(0, 3).map(item => ({ kind: 'event' as const, id: item.id, title: item.title, subtitle: `Plan · ${dateLabel(item.date)}`, item })),
      ].slice(0, 7).map(result => <button className="global-result" key={`${result.kind}-${result.id}`} onClick={() => openModal(result.kind, result.item)}><span className="result-type">{result.kind === 'note' ? <NotebookPen size={14} /> : result.kind === 'task' ? <CheckSquare size={14} /> : <CalendarDays size={14} />}</span><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><ChevronRight size={14} /></button>)}{globalResults.notes.length + globalResults.tasks.length + globalResults.events.length === 0 && <p>No little matches yet. Try another word?</p>}</section></>}
      {view === 'Home' && <section className="page">
        <div className="hero"><div><p className="eyebrow">{fullDate}</p><h1>A little space<br />for <em>you.</em></h1><p className="hero-copy">Keep the things that matter, close.</p><button className="primary-button" onClick={addNote}><Plus size={17} /> Write a note</button></div><div className="hero-art"><div className="art-circle"><Flower2 size={73} strokeWidth={1.1} /><span className="art-star">✳</span><span className="art-heart">♡</span></div><span className="art-caption">bloom at your own pace</span></div></div>
        <div className="home-grid"><section className="panel today-panel"><div className="section-heading"><div><span className="section-kicker">A gentle little nudge</span><h2>Today’s tasks <span className="heading-flower">✿</span></h2></div><button className="text-link" onClick={() => setView('Tasks')}>See all <ChevronRight size={15} /></button></div>
          {data.tasks.filter(task => !task.completed && (!task.dueDate || task.dueDate <= today())).slice(0, 4).map(task => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} onEdit={() => openModal('task', task)} catName={catName} />)}
          {!data.tasks.some(task => !task.completed && (!task.dueDate || task.dueDate <= today())) && <div className="quiet-empty"><span>♡</span><div>All caught up.<small>Enjoy this little pocket of calm.</small></div></div>}
          <button className="add-row" onClick={() => openModal('task')}><Plus size={16} /> Add a task</button>
        </section>
        <section className="panel progress-panel"><div className="section-heading"><div><span className="section-kicker">One thing at a time</span><h2>Your day</h2></div><span className="progress-flower">✳</span></div><div className="progress-ring" style={{ '--progress': `${data.tasks.length ? data.tasks.filter(task => task.completed).length / data.tasks.length * 100 : 0}%` } as CSSProperties}><div><strong>{data.tasks.filter(task => task.completed).length}</strong><span>of {data.tasks.length}</span></div></div><p className="progress-caption">Every little step counts.</p></section>
        <section className="panel deadline-panel"><div className="section-heading"><div><span className="section-kicker">Coming up softly</span><h2>On the horizon</h2></div><CalendarDays size={18} className="muted-icon" /></div>
          {[...data.tasks.filter(task => !task.completed && task.dueDate > today()).map(task => ({ label: task.title, date: task.dueDate, type: 'Task' })), ...data.events.filter(event => event.date >= today()).map(event => ({ label: event.title, date: event.date, type: 'Event' }))].sort((a,b)=>a.date.localeCompare(b.date)).slice(0, 3).map((item, index) => <div className="horizon-row" key={`${item.type}-${item.label}`}><span className={`horizon-dot dot-${index % 3}`} /><div><strong>{item.label}</strong><small>{item.type}</small></div><time>{dateLabel(item.date)}</time></div>)}
          {!data.tasks.some(task => !task.completed && task.dueDate > today()) && !data.events.some(event => event.date >= today()) && <div className="quiet-empty compact"><span>☼</span><div>Nothing looming just yet.</div></div>}
          <button className="text-link bottom-link" onClick={() => setView('Calendar')}>Open planner <ChevronRight size={15} /></button>
        </section>
        <section className="panel recent-panel"><div className="section-heading"><div><span className="section-kicker">Little thoughts, kept safe</span><h2>Recently written</h2></div><button className="text-link" onClick={() => setView('Notes')}>All notes <ChevronRight size={15} /></button></div>
          <div className="recent-notes">{data.notes.filter(note => !note.archived).slice(0, 3).map(note => <button className="recent-note" key={note.id} style={{ backgroundColor: note.color }} onClick={() => openModal('note', note)}><span className="note-card-top">{note.pinned && <Pin size={13} />}<span>{catName(note.category)}</span></span><strong>{note.title || 'Untitled note'}</strong><small>{notePreview(note).slice(0, 90) || 'A blank page, full of possibility...'}</small></button>)}
            {data.notes.filter(note => !note.archived).length === 0 && <button className="empty-note" onClick={addNote}><Sparkles size={19} /><span>Your first little thought starts here.</span><b>Write a note <Plus size={14} /></b></button>}</div>
        </section></div>
        {data.notes.some(note => note.pinned && !note.archived) && <section className="panel pinned-panel"><div className="section-heading"><div><span className="section-kicker">A few things to keep close</span><h2><Pin size={16} /> Pinned notes</h2></div><button className="text-link" onClick={() => setView('Notes')}>All notes <ChevronRight size={15} /></button></div><div className="pinned-list">{data.notes.filter(note => note.pinned && !note.archived).slice(0, 4).map(note => <button key={note.id} className="pinned-note" style={{ background: note.color }} onClick={() => openModal('note', note)}><Pin size={13} /><span>{note.title || 'Untitled note'}</span><ChevronRight size={14} /></button>)}</div></section>}
      </section>}
      {view === 'Notes' && <section className="page"><PageTitle eyebrow={archived ? 'Tucked away for later' : 'Your thoughts, in one place'} title={archived ? 'Archived notes' : 'Notes'}><button className="soft-button" onClick={() => setArchived(value => !value)}><Archive size={16} /> {archived ? 'All notes' : 'Archive'}</button><button className="primary-button small" onClick={addNote}><Plus size={16} /> New note</button></PageTitle>
        <CategoryChips categories={categories} />
      <div className="notes-grid">{shownNotes.map(note => <article className="note-tile" key={note.id} style={{ background: note.color }} onClick={() => openModal('note', note)}><div className="tile-tools"><span className="category-pill">{catName(note.category)}</span><button className="tile-icon" title={note.pinned ? 'Unpin' : 'Pin'} onClick={event => { event.stopPropagation(); update({ notes: data.notes.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n) }) }}>{note.pinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}</button></div><h3>{note.title || 'Untitled note'}</h3><p>{notePreview(note) || 'A fresh page, waiting for a thought...'}</p><footer><span>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><button className="tile-icon" title={note.archived ? 'Restore note' : 'Archive note'} onClick={event => { event.stopPropagation(); update({ notes: data.notes.map(n => n.id === note.id ? { ...n, archived: !n.archived } : n) }); setNotice(note.archived ? 'Note restored ✿' : 'Note tucked away ✿') }}><Archive size={14} /></button></footer></article>)}
          {shownNotes.length === 0 && <EmptyPanel icon={<NotebookPen size={22} />} title={archived ? 'A clear little shelf' : 'A page all your own'} text={archived ? 'Archived notes will find a home here.' : 'Save a thought, a list, or a little daydream.'} action="Write a note" onClick={addNote} />}</div>
      </section>}
      {view === 'Tasks' && <section className="page"><PageTitle eyebrow="Small steps add up" title="Tasks"><button className="primary-button small" onClick={() => openModal('task')}><Plus size={16} /> Add task</button></PageTitle><div className="filter-row">{['Today', 'Upcoming', 'Completed', 'All', 'High priority'].map(item => <button className={`filter-chip ${filter === item ? 'selected' : ''}`} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="task-list panel">{visibleTasks.map(task => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} onEdit={() => openModal('task', task)} catName={catName} />)}{visibleTasks.length === 0 && <div className="task-empty"><span>✿</span><h3>It’s a gentle little blank slate.</h3><p>{filter === 'Completed' ? 'Completed tasks will gather here.' : 'Nothing on this list right now.'}</p><button className="soft-button" onClick={() => openModal('task')}><Plus size={15} /> Add a task</button></div>}</div></section>}
      {view === 'Calendar' && <section className="page"><PageTitle eyebrow="Make room for what matters" title="Your planner"><button className="primary-button small" onClick={() => openModal('event')}><Plus size={16} /> New event</button></PageTitle><div className="calendar-layout"><section className="panel calendar-panel"><div className="month-heading"><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={19} /></button><h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={19} /></button></div><div className="calendar-grid weekday-row">{'SMTWTFS'.split('').map((letter, i) => <span key={i}>{letter}</span>)}</div><div className="calendar-grid">{Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => { const day = i + 1; const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const count = data.events.filter(event => event.date === key).length + data.tasks.filter(task => task.dueDate === key && !task.completed).length; return <button key={key} className={`calendar-day ${selectedDay === key ? 'selected-day' : ''} ${today() === key ? 'is-today' : ''}`} onClick={() => setSelectedDay(key)}>{day}{count > 0 && <i />}</button> })}</div><button className="text-link today-link" onClick={() => { setMonth(new Date()); setSelectedDay(today()) }}>Back to today</button></section>
        <section className="panel agenda-panel"><div className="section-heading"><div><span className="section-kicker">Saved for this day</span><h2>{selectedDay === today() ? 'Today' : new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2></div><button className="icon-button" title="Add event" onClick={() => openModal('event')}><Plus size={18} /></button></div>
          {data.events.filter(event => event.date === selectedDay).sort((a,b)=>a.time.localeCompare(b.time)).map(event => <button className="agenda-item" key={event.id} onClick={() => openModal('event', event)}><span className="agenda-dot" /><span><strong>{event.title}</strong><small>{event.time || 'Any time'}{event.description ? ` · ${event.description}` : ''}</small></span><ChevronRight size={15} /></button>)}
          {data.tasks.filter(task => task.dueDate === selectedDay && !task.completed).map(task => <button className="agenda-item" key={task.id} onClick={() => openModal('task', task)}><span className="agenda-dot task-agenda-dot" /><span><strong>{task.title}</strong><small>Task · {task.priority} priority</small></span><ChevronRight size={15} /></button>)}
          {!data.events.some(event => event.date === selectedDay) && !data.tasks.some(task => task.dueDate === selectedDay && !task.completed) && <div className="agenda-empty"><span>☁</span><p>A little open space in the day.</p><button className="text-link" onClick={() => openModal('event')}>Add something lovely <Plus size={14} /></button></div>}</section></div>
        <section className="panel upcoming-panel"><div className="section-heading"><div><span className="section-kicker">The next few moments</span><h2>Coming up</h2></div></div>{data.events.filter(event => event.date >= today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0, 4).map(event => <button className="upcoming-item" key={event.id} onClick={() => { setSelectedDay(event.date); setMonth(new Date(`${event.date}T12:00:00`)) }}><span className="upcoming-date">{dateLabel(event.date)}</span><strong>{event.title}</strong><small>{event.time || 'Any time'}</small></button>)}{data.events.filter(event => event.date >= today()).length === 0 && <p className="subtle-copy">Your next lovely plan will show up here.</p>}</section>
      </section>}
      {view === 'More' && <section className="page"><PageTitle eyebrow="Make it feel like yours" title="A little more" /><div className="more-grid"><section className="panel setting-card"><div className="setting-icon"><Settings size={19} /></div><h2>Your little space</h2><p>Choose a gentle accent for your notebook.</p><div className="theme-options">{[['rose', '#f7dce5', 'Rose'], ['lavender', '#e9e3f5', 'Lilac'], ['sage', '#dfeBDD', 'Sage'], ['peach', '#f6dfd0', 'Peach']].map(([id, color, label]) => <button key={id} className={`theme-choice ${data.theme === id ? 'active' : ''}`} onClick={() => update({ theme: id })}><i style={{ background: color }} /><span>{label}</span>{data.theme === id && <Check size={14} />}</button>)}</div></section>
          <section className="panel setting-card"><div className="setting-icon"><Heart size={18} /></div><h2>Your collections</h2><p>Little shelves for all your different things.</p><div className="category-management">{categories.map(category => <div className="manage-category" key={category.id}><i style={{ background: category.color }} /><span>{category.name}</span><button className="tile-icon" aria-label={`Delete ${category.name}`} onClick={() => { if (categories.length < 2) { setNotice('Keep at least one collection ✿'); return } if (window.confirm(`Delete “${category.name}”? Items in this collection will move to the first collection.`)) { update({ categories: categories.filter(c => c.id !== category.id), notes: data.notes.map(n => n.category === category.id ? { ...n, category: categories.find(c => c.id !== category.id)!.id } : n), tasks: data.tasks.map(t => t.category === category.id ? { ...t, category: categories.find(c => c.id !== category.id)!.id } : t) }) } }}><Trash2 size={14} /></button></div>)}<button className="add-row" onClick={() => openModal('category')}><Plus size={15} /> Add a collection</button></div></section>
          <section className="panel setting-card backup-card"><div className="setting-icon"><ArrowDownToLine size={19} /></div><h2>A little safety net</h2><p>Your notebook is saved on this device. Keep a backup file, or bring one back in.</p><div className="backup-actions"><button className="soft-button" onClick={exportData}><ArrowDownToLine size={16} /> Export backup</button><label className="soft-button file-button"><ArrowUpFromLine size={16} /> Restore backup<input type="file" accept="application/json,.json" onChange={event => { void importData(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></div></section>
          <section className="panel setting-card about-card"><div className="setting-icon"><Flower2 size={19} /></div><h2>Made for your everyday</h2><p>Little Bloom keeps your notes, tasks, and plans stored privately on this device. No account, no backend, just your own little space.</p></section></div></section>}
    </main>
    <nav className="bottom-nav" aria-label="Main navigation">{navItems.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${view === name ? 'active' : ''}`} onClick={() => { setView(name); setQuery('') }}><span><Icon size={20} strokeWidth={view === name ? 2.2 : 1.8} /></span><small>{name}</small></button>)}</nav>
    {modal && <Dialog kind={modal} editing={editing} categories={categories} onClose={() => { setModal(null); setEditing(null) }} onSaveNote={saveNote} onSaveTask={saveTask} onSaveEvent={saveEvent} onSaveCategory={category => { update({ categories: [...categories, category] }); setModal(null); setNotice('Collection created ✿') }} onDelete={removeItem} />}
    {notice && <div className="toast"><span>✿</span>{notice}</div>}
  </div>
}

function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><div className="title-actions">{children}</div></div> }
function CategoryChips({ categories }: { categories: Category[] }) { return <div className="collection-strip">{categories.map(category => <span className="collection-chip" key={category.id}><i style={{ background: category.color }} />{category.name}</span>)}</div> }
function TaskRow({ task, onToggle, onEdit, catName }: { task: Task; onToggle: () => void; onEdit: () => void; catName: (id: string) => string }) { const overdue = !task.completed && task.dueDate && task.dueDate < today(); return <div className={`task-row ${task.completed ? 'completed' : ''}`}><button className={`check-circle ${task.completed ? 'checked' : ''}`} aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'} onClick={onToggle}>{task.completed && <Check size={13} />}</button><button className="task-content" onClick={onEdit}><strong>{task.title}</strong><small>{task.description || catName(task.category)}{task.description && ` · ${catName(task.category)}`}</small></button><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>{task.dueDate && <time className={overdue ? 'overdue' : ''}>{overdue ? 'Overdue · ' : ''}{dateLabel(task.dueDate)}</time>}</div> }

function Dialog({ kind, editing, categories, onClose, onSaveNote, onSaveTask, onSaveEvent, onSaveCategory, onDelete }: { kind: 'note' | 'task' | 'event' | 'category'; editing: Note | Task | BloomEvent | null; categories: Category[]; onClose: () => void; onSaveNote: (note: Note) => void; onSaveTask: (task: Task) => void; onSaveEvent: (event: BloomEvent) => void; onSaveCategory: (category: Category) => void; onDelete: (kind: 'note' | 'task' | 'event', id: string) => void }) {
  const note = kind === 'note' ? editing as Note | null : null
  const task = kind === 'task' ? editing as Task | null : null
  const bloomEvent = kind === 'event' ? editing as BloomEvent | null : null
  const [title, setTitle] = useState(note?.title ?? task?.title ?? bloomEvent?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [description, setDescription] = useState(task?.description ?? bloomEvent?.description ?? '')
  const [category, setCategory] = useState(note?.category ?? task?.category ?? categories[0]?.id ?? '')
  const [color, setColor] = useState(note?.color ?? colors[0])
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'Medium')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? today())
  const [date, setDate] = useState(bloomEvent?.date ?? today())
  const [time, setTime] = useState(bloomEvent?.time ?? '')
  const [pinned, setPinned] = useState(note?.pinned ?? false)
  const [checklist, setChecklist] = useState(note?.checklist ?? [])
  const [newCheck, setNewCheck] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [error, setError] = useState('')
  const editingId = editing && 'id' in editing ? editing.id : uid()
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!title.trim() && kind !== 'category') { setError('Give this a little name first.'); return }
    if (kind === 'note') { const now = new Date().toISOString(); onSaveNote({ id: editingId, title: title.trim(), content, category, color, pinned, archived: note?.archived ?? false, checklist, createdAt: note?.createdAt ?? now, updatedAt: now }) }
    if (kind === 'task') onSaveTask({ id: editingId, title: title.trim(), description, category, dueDate, priority, completed: task?.completed ?? false, createdAt: task?.createdAt ?? new Date().toISOString() })
    if (kind === 'event') onSaveEvent({ id: editingId, title: title.trim(), description, date, time })
    if (kind === 'category') { if (!categoryName.trim()) { setError('Give your collection a name.'); return } onSaveCategory({ id: uid(), name: categoryName.trim(), color: colors[Math.floor(Math.random() * colors.length)] }) }
  }
  const heading = kind === 'note' ? note ? 'A little edit' : 'A new little thought' : kind === 'task' ? task ? 'Edit your task' : 'A new little step' : kind === 'event' ? bloomEvent ? 'Edit your plan' : 'Save a little plan' : 'A new collection'
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><form className={`dialog ${kind === 'note' ? 'note-dialog' : ''}`} onSubmit={submit}><div className="dialog-heading"><div><p className="eyebrow">A moment for the little things</p><h2>{heading}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div>
    {kind === 'note' && <>
      <input className="editor-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Give this thought a name..." autoFocus />
      <div className="editor-options"><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" className={`soft-button pin-toggle ${pinned ? 'pin-active' : ''}`} onClick={() => setPinned(!pinned)}><Pin size={15} /> {pinned ? 'Pinned' : 'Pin it'}</button></div>
      <div className="checklist-editor"><div className="checklist-caption"><ListTodo size={15} /> Little checklist</div>{checklist.map((item, index) => <div className={`checklist-edit-row ${item.startsWith('✓ ') ? 'check-done' : ''}`} key={`${item}-${index}`}><button className="checklist-toggle" type="button" aria-label="Toggle checklist item" onClick={() => setChecklist(checklist.map((value, i) => i === index ? value.startsWith('✓ ') ? value.slice(2) : `✓ ${value}` : value))}>{item.startsWith('✓ ') ? <Check size={13} /> : <Circle size={13} />}</button><span>{item.startsWith('✓ ') ? item.slice(2) : item}</span><button type="button" aria-label="Remove checklist item" onClick={() => setChecklist(checklist.filter((_, i) => i !== index))}><X size={13} /></button></div>)}<div className="add-check"><input value={newCheck} onChange={event => setNewCheck(event.target.value)} placeholder="Add a checklist item..." onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (newCheck.trim()) { setChecklist([...checklist, newCheck.trim()]); setNewCheck('') } } }} /><button type="button" onClick={() => { if (newCheck.trim()) { setChecklist([...checklist, newCheck.trim()]); setNewCheck('') } }}><Plus size={15} /></button></div></div>
      <textarea className="note-editor" value={content} onChange={event => setContent(event.target.value)} placeholder="Let your thoughts wander..." />
      <div className="color-picker"><span>A soft little color</span>{colors.map(value => <button type="button" aria-label="Choose note color" key={value} className={color === value ? 'color-selected' : ''} style={{ background: value }} onClick={() => setColor(value)} />)}</div>{note && <div className="note-date">Started {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · Updated {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>}
    </>}
    {kind === 'task' && <><label className="field-label">What’s on your mind?<input value={title} onChange={event => setTitle(event.target.value)} placeholder="A small step to take..." autoFocus /></label><label className="field-label">A few details <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Anything else to remember?" rows={3} /></label><div className="form-pair"><label className="field-label">Due date<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label><label className="field-label">Priority<select value={priority} onChange={event => setPriority(event.target.value as Task['priority'])}>{['Low', 'Medium', 'High'].map(value => <option key={value}>{value}</option>)}</select></label></div><label className="field-label">Collection<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
    {kind === 'event' && <><label className="field-label">What’s the plan?<input value={title} onChange={event => setTitle(event.target.value)} placeholder="A little thing to look forward to..." autoFocus /></label><label className="field-label">A few details <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Add a note..." rows={3} /></label><div className="form-pair"><label className="field-label">Date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label className="field-label">Time<input type="time" value={time} onChange={event => setTime(event.target.value)} /></label></div></>}
    {kind === 'category' && <label className="field-label">What shall we call it?<input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="A cozy corner for..." autoFocus /></label>}
    {error && <p className="form-error">{error}</p>}<div className="dialog-actions">{editing && kind !== 'category' && <button type="button" className="delete-button" onClick={() => onDelete(kind, editingId)}><Trash2 size={15} /> Delete</button>}<button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={16} /> {editing ? 'Save changes' : kind === 'category' ? 'Create collection' : 'Save this'}</button></div></form></div>
}

function EmptyPanel({ icon, title, text, action, onClick }: { icon: ReactNode; title: string; text: string; action: string; onClick: () => void }) { return <div className="empty-panel"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p><button className="soft-button" onClick={onClick}><Plus size={15} />{action}</button></div> }
