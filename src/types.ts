export type Category = { id: string; name: string; color: string }
export type Note = { id: string; title: string; content: string; category: string; color: string; pinned: boolean; archived: boolean; checklist: string[]; createdAt: string; updatedAt: string }
export type Task = { id: string; title: string; description: string; category: string; dueDate: string; priority: 'Low' | 'Medium' | 'High'; completed: boolean; createdAt: string }
export type BloomEvent = { id: string; title: string; description: string; date: string; time: string }
export type BloomData = { notes: Note[]; tasks: Task[]; events: BloomEvent[]; categories: Category[]; theme: string }
