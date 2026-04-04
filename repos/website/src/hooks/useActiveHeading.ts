import { useState, useEffect } from 'react'

export const useActiveHeading = (deps?: unknown) => {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-64px 0px -80% 0px', threshold: 0 }
    )

    const headings = document.querySelectorAll('h2[id], h3[id]')
    for (const heading of headings) observer.observe(heading)

    return () => observer.disconnect()
  }, [deps])

  return activeId
}
