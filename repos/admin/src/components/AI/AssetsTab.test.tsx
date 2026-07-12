import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockFetchAssets = vi.fn().mockResolvedValue({ data: {} })
const mockDeleteAsset = vi.fn().mockResolvedValue({ data: {} })

const mockUseActiveOrgId = vi.fn(() => [`org-1`])
const mockUseActiveProjectId = vi.fn(() => [`project-1`])
const mockUseProjectAssets = vi.fn(() => [{}])

vi.mock(`@TAF/state/selectors`, () => ({
  useActiveOrgId: () => mockUseActiveOrgId(),
  useActiveProjectId: () => mockUseActiveProjectId(),
  useProjectAssets: () => mockUseProjectAssets(),
}))

vi.mock(`@TAF/actions/assets/api/fetchAssets`, () => ({
  fetchAssets: (...args: any[]) => mockFetchAssets(...args),
}))

vi.mock(`@TAF/actions/assets/api/deleteAsset`, () => ({
  deleteAsset: (...args: any[]) => mockDeleteAsset(...args),
}))

vi.mock(`@TAF/components/PageLayout/PageLayout`, () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock(`@TAF/components/EmptyState/EmptyState`, () => ({
  EmptyState: ({ message }: { message: string }) => (
    <div data-testid='empty-state'>{message}</div>
  ),
}))

vi.mock(`@tdsk/components`, () => ({
  ConfirmDelete: () => null,
}))

import { AssetsTab } from './AssetsTab'

const urlAssetData = {
  'asset-1': {
    id: `asset-1`,
    name: `screenshot.png`,
    type: `image/png`,
    orgId: `org-1`,
    threadId: `thread-1`,
    url: `https://storage.example.com/screenshot.png`,
    createdAt: `2026-01-01`,
  },
}

const contentAssetData = {
  'asset-2': {
    id: `asset-2`,
    name: `report.json`,
    type: `application/json`,
    orgId: `org-1`,
    threadId: `thread-1`,
    content: { summary: `test report`, count: 3 },
    createdAt: `2026-01-02`,
  },
}

describe(`AssetsTab`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAssets.mockResolvedValue({ data: {} })
    mockDeleteAsset.mockResolvedValue({ data: {} })
    mockUseActiveOrgId.mockReturnValue([`org-1`])
    mockUseActiveProjectId.mockReturnValue([`project-1`])
    mockUseProjectAssets.mockReturnValue([{}])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(`should open the asset url in a new tab when the asset has a url`, () => {
    mockUseProjectAssets.mockReturnValue([urlAssetData])
    const openSpy = vi.spyOn(window, `open`).mockImplementation(() => null)

    render(<AssetsTab />)

    const downloadButton = screen.getByTitle(`Download asset`)
    fireEvent.click(downloadButton)

    expect(openSpy).toHaveBeenCalledWith(
      `https://storage.example.com/screenshot.png`,
      `_blank`
    )
  })

  it(`should download a blob of the serialized content when the asset has no url`, () => {
    mockUseProjectAssets.mockReturnValue([contentAssetData])

    const createObjectURL = vi.fn().mockReturnValue(`blob:mock-url`)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal(`URL`, { ...URL, createObjectURL, revokeObjectURL })

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, `click`)
      .mockImplementation(() => {})

    render(<AssetsTab />)

    const downloadButton = screen.getByTitle(`Download asset`)
    fireEvent.click(downloadButton)

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe(`application/json`)

    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(`blob:mock-url`)
  })

  it(`should not attempt a download when the asset has neither url nor content`, () => {
    mockUseProjectAssets.mockReturnValue([
      {
        'asset-3': {
          id: `asset-3`,
          name: `empty.txt`,
          type: `text/plain`,
          orgId: `org-1`,
          threadId: `thread-1`,
          createdAt: `2026-01-03`,
        },
      },
    ])
    const openSpy = vi.spyOn(window, `open`).mockImplementation(() => null)
    const createObjectURL = vi.fn()
    vi.stubGlobal(`URL`, { ...URL, createObjectURL, revokeObjectURL: vi.fn() })

    render(<AssetsTab />)

    const downloadButton = screen.getByTitle(`Download asset`)
    fireEvent.click(downloadButton)

    expect(openSpy).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
