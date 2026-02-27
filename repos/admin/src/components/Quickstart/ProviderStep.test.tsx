import '@testing-library/jest-dom/vitest'
import { ProviderStep } from './ProviderStep'
import { ProviderTemplates } from '@tdsk/domain'
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'

vi.mock(`@TAF/actions/providers`, () => ({
  fetchProviderModels: vi.fn().mockResolvedValue({ data: [] }),
}))

vi.mock(`@tdsk/components`, () => ({
  ZAIIcon: (props: any) => <svg></svg>,
  OllamaIcon: (props: any) => <svg></svg>,
  OpenAIIcon: (props: any) => <svg></svg>,
  AnthropicIcon: (props: any) => <svg></svg>,
  OpenRouterIcon: (props: any) => <svg></svg>,
  TextInput: (props: any) => (
    <input
      id={props.id}
      type={props.type || `text`}
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props.label}
      onChange={props.onChange}
      onBlur={props.onBlur}
    />
  ),
  SelectInput: (props: any) => (
    <select
      id={props.id}
      value={props.value}
      aria-label={props.label}
      onChange={props.onChange}
    >
      {(props.items || []).map((item: any) => (
        <option
          key={item.value}
          value={item.value}
        >
          {item.label}
        </option>
      ))}
    </select>
  ),
}))

const theme = createTheme()
const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const defaultData = {
  model: ``,
  apiKey: ``,
  providerUrl: ``,
  providerName: ``,
  providerBrand: `` as any,
}

describe(`ProviderStep`, () => {
  it(`renders all 7 provider cards`, () => {
    const onChange = vi.fn()
    renderWithTheme(
      <ProviderStep
        data={defaultData}
        onChange={onChange}
      />
    )

    const templates = Object.values(ProviderTemplates)
    expect(templates).toHaveLength(7)

    for (const tmpl of templates) {
      expect(screen.getByText(tmpl.name)).toBeInTheDocument()
    }
  })

  it(`each provider card contains an SVG icon`, () => {
    const onChange = vi.fn()
    renderWithTheme(
      <ProviderStep
        data={defaultData}
        onChange={onChange}
      />
    )

    const templates = Object.values(ProviderTemplates)
    for (const tmpl of templates) {
      const label = screen.getByText(tmpl.name)
      const cardContent = label.closest(`.MuiCardContent-root`)!
      const svgs = cardContent.querySelectorAll(`svg`)
      expect(svgs.length).toBeGreaterThanOrEqual(1)
    }
  })

  it(`clicking a provider card calls onChange with the provider brand`, async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    renderWithTheme(
      <ProviderStep
        data={defaultData}
        onChange={onChange}
      />
    )

    await user.click(screen.getByText(`Anthropic`))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ providerBrand: `anthropic` })
    )
  })

  it(`shows API Key input when a provider is selected`, () => {
    const onChange = vi.fn()
    renderWithTheme(
      <ProviderStep
        data={{
          ...defaultData,
          providerBrand: `anthropic`,
          apiKey: `sk-ant-test`,
        }}
        onChange={onChange}
      />
    )

    expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument()
  })
})
