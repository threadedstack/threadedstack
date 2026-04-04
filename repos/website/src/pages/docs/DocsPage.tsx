import { useLocation } from 'react-router'
import { useState, useEffect } from 'react'
import { MDXProvider } from '@mdx-js/react'
import ComingSoon from '@TAF/components/Docs/ComingSoon'
import DocsPrevNext from '@TAF/components/Docs/DocsPrevNext'
import { mdxComponents } from '@TAF/components/Docs/MDXComponents'
import { findContentModule } from '@TAF/utils/docsContent'

const DocsPage = () => {
  const { pathname } = useLocation()
  const slug = pathname.replace(/^\/docs\/?/, '') || 'index'
  const [Content, setContent] = useState<React.ComponentType | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setNotFound(false)

    const loader = findContentModule(slug)
    if (loader) {
      loader()
        .then((mod: any) => {
          if (!cancelled) setContent(() => mod.default)
        })
        .catch((err) => {
          console.error(`Failed to load docs page "${slug}":`, err)
          if (!cancelled) setNotFound(true)
        })
    } else {
      setNotFound(true)
    }

    return () => {
      cancelled = true
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
