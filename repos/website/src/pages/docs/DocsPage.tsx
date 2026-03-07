import { useLocation } from 'react-router'
import { useState, useEffect } from 'react'
import { MDXProvider } from '@mdx-js/react'
import ComingSoon from '@TAF/components/Docs/ComingSoon'
import DocsPrevNext from '@TAF/components/Docs/DocsPrevNext'
import { mdxComponents } from '@TAF/components/Docs/MDXComponents'

const contentModules = import.meta.glob('../../content/docs/**/*.mdx')

const DocsPage = () => {
  const { pathname } = useLocation()
  const slug = pathname.replace('/docs/', '') || 'getting-started'
  const [Content, setContent] = useState<React.ComponentType | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setContent(null)
    setNotFound(false)

    // Try multiple path patterns
    const paths = [
      `../../content/docs/${slug}.mdx`,
      `../../content/docs/${slug}/introduction.mdx`,
      `../../content/docs/${slug}/index.mdx`,
    ]

    const match = paths.find((p) => contentModules[p])
    if (match) {
      contentModules[match]().then((mod: any) => setContent(() => mod.default))
    } else {
      setNotFound(true)
    }
  }, [slug])

  if (notFound)
    return (
      <>
        <ComingSoon />
        <DocsPrevNext />
      </>
    )
  if (!Content) return null

  return (
    <MDXProvider components={mdxComponents}>
      <Content />
      <DocsPrevNext />
    </MDXProvider>
  )
}

export default DocsPage
