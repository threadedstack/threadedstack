import { Helmet } from 'react-helmet-async'

type Props = {
  title?: string
  description?: string
}

const PageMeta = ({ title, description }: Props) => (
  <Helmet>
    <title>
      {title
        ? `${title} | Threaded Stack`
        : 'Threaded Stack - The Developer Platform for AI Tools'}
    </title>
    {description && (
      <meta
        name='description'
        content={description}
      />
    )}
    <meta
      property='og:title'
      content={title || 'Threaded Stack'}
    />
    {description && (
      <meta
        property='og:description'
        content={description}
      />
    )}
    <meta
      property='og:type'
      content='website'
    />
  </Helmet>
)

export default PageMeta
