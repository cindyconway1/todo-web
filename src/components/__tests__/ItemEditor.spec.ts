import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ItemEditor from '@/components/ItemEditor.vue'
import type { ItemEditorPayload } from '@/components/ItemEditor.vue'
import type { components } from '@/api/schema'

type TodoItemDto = components['schemas']['TodoItemDto']

function mountEditor(item?: TodoItemDto) {
  return mount(ItemEditor, {
    props: { submitLabel: 'Add to-do', savingLabel: 'Adding…', item },
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
