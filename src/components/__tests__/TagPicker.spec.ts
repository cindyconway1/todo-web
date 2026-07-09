import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import TagPicker from '@/components/TagPicker.vue'

const options = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
]

function optionButton(wrapper: ReturnType<typeof mount>, name: string) {
  const button = wrapper.findAll('button').find((b) => b.text().includes(name))
  if (!button) {
    throw new Error(`No option button named "${name}"`)
  }
  return button
}

describe('TagPicker', () => {
  // AC 15 - team -> single league: picking one option replaces the previous pick.
  it('single-select emits the picked id and swaps selection on a second pick', async () => {
    const wrapper = mount(TagPicker, {
      props: { label: 'League', options, modelValue: null },
    })

    await optionButton(wrapper, 'Alpha').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['a'])

    await wrapper.setProps({ modelValue: 'a' })
    expect(optionButton(wrapper, 'Alpha').attributes('aria-pressed')).toBe('true')

    await optionButton(wrapper, 'Beta').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['b'])
  })

  it('single-select clears the selection when the picked option is clicked again', async () => {
    const wrapper = mount(TagPicker, {
      props: { label: 'League', options, modelValue: 'a' },
    })

    await optionButton(wrapper, 'Alpha').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
  })

  // AC 17 - volunteer -> multiple teams: picks accumulate into an array.
  it('multi-select accumulates picked ids and removes unpicked ones', async () => {
    const wrapper = mount(TagPicker, {
      props: { label: 'Teams', options, modelValue: [] as string[], multiple: true },
    })

    await optionButton(wrapper, 'Alpha').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['a']])

    await wrapper.setProps({ modelValue: ['a'] })
    await optionButton(wrapper, 'Gamma').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([['a', 'c']])

    await wrapper.setProps({ modelValue: ['a', 'c'] })
    await optionButton(wrapper, 'Alpha').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[2]).toEqual([['c']])
  })

  it('marks selected options with aria-pressed', () => {
    const wrapper = mount(TagPicker, {
      props: { label: 'Teams', options, modelValue: ['a', 'c'], multiple: true },
    })

    expect(optionButton(wrapper, 'Alpha').attributes('aria-pressed')).toBe('true')
    expect(optionButton(wrapper, 'Beta').attributes('aria-pressed')).toBe('false')
    expect(optionButton(wrapper, 'Gamma').attributes('aria-pressed')).toBe('true')
  })

  // AC 30 (picker flavor) - with nothing to tag, the picker explains instead of
  // rendering an empty control.
  it('renders the empty text when there are no options', () => {
    const wrapper = mount(TagPicker, {
      props: {
        label: 'League',
        options: [],
        modelValue: null,
        emptyText: 'No leagues yet — create one first.',
      },
    })

    expect(wrapper.text()).toContain('No leagues yet — create one first.')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('renders an inline error message when the error prop is set', () => {
    const wrapper = mount(TagPicker, {
      props: { label: 'League', options, modelValue: null, error: 'Pick a league you own.' },
    })

    expect(wrapper.text()).toContain('Pick a league you own.')
  })
})
