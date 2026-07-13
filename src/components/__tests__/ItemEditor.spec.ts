import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ItemEditor from '@/components/ItemEditor.vue'
import type { ItemEditorPayload } from '@/components/ItemEditor.vue'
import type { components } from '@/api/schema'

type TodoItemDto = components['schemas']['TodoItemDto']
type PriorityDto = components['schemas']['PriorityDto']

// Mock API priority options, already in the store's API-provided sort order.
const priorities: PriorityDto[] = [
  { id: 1, name: 'High', sortOrder: 1 },
  { id: 2, name: 'Medium', sortOrder: 2 },
  { id: 3, name: 'Low', sortOrder: 3 },
]

function mountEditor(item?: TodoItemDto, priorityOptions?: PriorityDto[]) {
  return mount(ItemEditor, {
    props: { submitLabel: 'Add to-do', savingLabel: 'Adding…', item, priorities: priorityOptions },
  })
}

function lastSavePayload(wrapper: ReturnType<typeof mountEditor>): ItemEditorPayload {
  const events = wrapper.emitted('save')!
  return events[events.length - 1]![0] as ItemEditorPayload
}

describe('ItemEditor', () => {
  // AC 21 - create requires a title: empty and whitespace-only titles are rejected inline.
  it('rejects an empty title inline and does not emit save', async () => {
    const wrapper = mountEditor()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Title is required.')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('rejects a whitespace-only title inline and does not emit save', async () => {
    const wrapper = mountEditor()

    await wrapper.find('#item-title-new').setValue('   ')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Title is required.')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  // AC 21 - a valid title saves (trimmed).
  it('emits save with the trimmed title when it is valid', async () => {
    const wrapper = mountEditor()

    await wrapper.find('#item-title-new').setValue('  Order jerseys  ')
    await wrapper.find('form').trigger('submit')

    expect(lastSavePayload(wrapper)).toEqual({ title: 'Order jerseys' })
  })

  it('rejects a title longer than 200 characters', async () => {
    const wrapper = mountEditor()

    await wrapper.find('#item-title-new').setValue('x'.repeat(201))
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Title must be 200 characters or fewer.')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  // AC 22 - description > 200 chars is rejected with a max-length message.
  it('rejects a description longer than 200 characters', async () => {
    const wrapper = mountEditor()

    await wrapper.find('#item-title-new').setValue('Valid title')
    await wrapper.find('#item-description-new').setValue('d'.repeat(201))
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Description must be 200 characters or fewer.')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('accepts a description of exactly 200 characters', async () => {
    const wrapper = mountEditor()

    await wrapper.find('#item-title-new').setValue('Valid title')
    await wrapper.find('#item-description-new').setValue('d'.repeat(200))
    await wrapper.find('form').trigger('submit')

    expect(lastSavePayload(wrapper)).toEqual({ title: 'Valid title', description: 'd'.repeat(200) })
  })

  // AC 23 - a title-only item saves, and the payload omits description and dueDate
  // entirely (they are optional in the contract).
  it('omits description and dueDate from the payload when they are empty', async () => {
    const wrapper = mountEditor()

    await wrapper.find('#item-title-new').setValue('Only a title')
    await wrapper.find('form').trigger('submit')

    const payload = lastSavePayload(wrapper)
    expect(payload).toEqual({ title: 'Only a title' })
    expect(payload).not.toHaveProperty('description')
    expect(payload).not.toHaveProperty('dueDate')
  })

  // AC 24 - a valid YYYY-MM-DD from the native date input passes through unchanged.
  // Malformed input is impossible by construction (the native control only yields a
  // valid date or an empty string), so the empty/valid paths cover this AC.
  it('passes a valid date through unchanged as dueDate', async () => {
    const wrapper = mountEditor()

    await wrapper.find('#item-title-new').setValue('Dated to-do')
    await wrapper.find('#item-due-date-new').setValue('2026-08-01')
    await wrapper.find('form').trigger('submit')

    expect(lastSavePayload(wrapper)).toEqual({ title: 'Dated to-do', dueDate: '2026-08-01' })
  })

  // AC 24 - clearing the date submits without a dueDate and without any error.
  it('submits with dueDate omitted after the date field is cleared', async () => {
    const item: TodoItemDto = { id: 'i1', listId: 'l1', title: 'Had a date', dueDate: '2026-08-01' }
    const wrapper = mountEditor(item)

    await wrapper.find('#item-due-date-i1').setValue('')
    await wrapper.find('form').trigger('submit')

    const payload = lastSavePayload(wrapper)
    expect(payload).toEqual({ title: 'Had a date' })
    expect(payload).not.toHaveProperty('dueDate')
    expect(wrapper.find('.text-danger').exists()).toBe(false)
  })

  it('prefills the fields from an existing item', () => {
    const item: TodoItemDto = {
      id: 'i1',
      listId: 'l1',
      title: 'Existing',
      description: 'Notes',
      dueDate: '2026-08-01',
    }
    const wrapper = mountEditor(item)

    expect((wrapper.find('#item-title-i1').element as HTMLInputElement).value).toBe('Existing')
    expect((wrapper.find('#item-description-i1').element as HTMLTextAreaElement).value).toBe(
      'Notes',
    )
    expect((wrapper.find('#item-due-date-i1').element as HTMLInputElement).value).toBe('2026-08-01')
  })

  // Priority options render straight from the (mocked) API data in the order given -
  // the component holds no priority list of its own, only the blank default.
  it('renders the priority options from the API data, blank first, in the given order', () => {
    const wrapper = mountEditor(undefined, priorities)

    const options = wrapper.findAll('#item-priority-new option')
    expect(options.map((option) => option.text())).toEqual(['No priority', 'High', 'Medium', 'Low'])
    expect((wrapper.find('#item-priority-new').element as HTMLSelectElement).value).toBe('')
  })

  it('shows only the blank option when no priorities are provided', () => {
    const wrapper = mountEditor()

    const options = wrapper.findAll('#item-priority-new option')
    expect(options.map((option) => option.text())).toEqual(['No priority'])
  })

  // Create with blank priority: the payload omits priorityId entirely.
  it('omits priorityId from the payload when no priority is selected', async () => {
    const wrapper = mountEditor(undefined, priorities)

    await wrapper.find('#item-title-new').setValue('No priority set')
    await wrapper.find('form').trigger('submit')

    const payload = lastSavePayload(wrapper)
    expect(payload).toEqual({ title: 'No priority set' })
    expect(payload).not.toHaveProperty('priorityId')
  })

  it('includes the selected priorityId in the payload', async () => {
    const wrapper = mountEditor(undefined, priorities)

    await wrapper.find('#item-title-new').setValue('Urgent thing')
    await wrapper.find('#item-priority-new').setValue('1')
    await wrapper.find('form').trigger('submit')

    expect(lastSavePayload(wrapper)).toEqual({ title: 'Urgent thing', priorityId: 1 })
  })

  // Edit: the current priority is preserved in the dropdown and can be changed.
  it('prefills the priority from an existing item and emits the changed value', async () => {
    const item: TodoItemDto = {
      id: 'i1',
      listId: 'l1',
      title: 'Was medium',
      priorityId: 2,
      priorityName: 'Medium',
    }
    const wrapper = mountEditor(item, priorities)

    expect((wrapper.find('#item-priority-i1').element as HTMLSelectElement).value).toBe('2')

    await wrapper.find('#item-priority-i1').setValue('3')
    await wrapper.find('form').trigger('submit')

    expect(lastSavePayload(wrapper)).toEqual({ title: 'Was medium', priorityId: 3 })
  })

  // Edit: a previously set priority can be cleared back to blank; the payload then
  // omits priorityId so the full-replace PUT unsets it.
  it('submits with priorityId omitted after the priority is cleared', async () => {
    const item: TodoItemDto = {
      id: 'i1',
      listId: 'l1',
      title: 'Had a priority',
      priorityId: 1,
      priorityName: 'High',
    }
    const wrapper = mountEditor(item, priorities)

    await wrapper.find('#item-priority-i1').setValue('')
    await wrapper.find('form').trigger('submit')

    const payload = lastSavePayload(wrapper)
    expect(payload).toEqual({ title: 'Had a priority' })
    expect(payload).not.toHaveProperty('priorityId')
    expect(wrapper.find('.text-danger').exists()).toBe(false)
  })

  it('shows server field errors passed in from the parent', async () => {
    const wrapper = mount(ItemEditor, {
      props: {
        submitLabel: 'Add to-do',
        savingLabel: 'Adding…',
        serverFieldErrors: { title: 'Title is too long.' },
      },
    })

    expect(wrapper.text()).toContain('Title is too long.')
  })

  it('emits cancel when cancellable', async () => {
    const wrapper = mount(ItemEditor, {
      props: { submitLabel: 'Save', savingLabel: 'Saving…', cancellable: true },
    })

    await wrapper.find('button[type="button"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
