import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ItemRow from '@/components/ItemRow.vue'
import type { components } from '@/api/schema'

type TodoItemDto = components['schemas']['TodoItemDto']

const item: TodoItemDto = {
  id: 'i1',
  listId: 'l1',
  title: 'Order jerseys',
  description: 'Sizes S-XL',
  dueDate: '2026-08-01',
  isCompleted: false,
}

describe('ItemRow', () => {
  it('renders the title, description and due date', () => {
    const wrapper = mount(ItemRow, { props: { item } })

    expect(wrapper.text()).toContain('Order jerseys')
    expect(wrapper.text()).toContain('Sizes S-XL')
    expect(wrapper.text()).toContain('Due 2026-08-01')
  })

  it('hides the description and due date rows when the item has neither', () => {
    const wrapper = mount(ItemRow, {
      props: { item: { id: 'i2', listId: 'l1', title: 'Bare item' } },
    })

    expect(wrapper.text()).toContain('Bare item')
    expect(wrapper.text()).not.toContain('Due')
  })

  // Read-only priority: the badge renders the API-provided name next to the due date.
  it('renders the priority badge when the item has a priority', () => {
    const wrapper = mount(ItemRow, {
      props: { item: { ...item, priorityId: 1, priorityName: 'High' } },
    })

    const badge = wrapper.find('[data-testid="priority-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('High')
  })

  // Consistent empty state: no priority set means no badge at all.
  it('renders no priority badge when the item has no priority', () => {
    const wrapper = mount(ItemRow, { props: { item } })

    expect(wrapper.find('[data-testid="priority-badge"]').exists()).toBe(false)
  })

  // AC 25 - the checkbox is a one-way "complete" affordance.
  it('emits complete when the checkbox is clicked', async () => {
    const wrapper = mount(ItemRow, { props: { item } })

    await wrapper.find('button[aria-label="Complete Order jerseys"]').trigger('click')

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('emits edit and delete from their buttons', async () => {
    const wrapper = mount(ItemRow, { props: { item } })

    await wrapper.find('button[aria-label="Edit Order jerseys"]').trigger('click')
    await wrapper.find('button[aria-label="Delete Order jerseys"]').trigger('click')

    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })
})
