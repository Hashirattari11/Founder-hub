import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://founderhub.site'
const SITE_NAME = 'FounderHub AI'
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`

interface SeoProps {
  title: string
  description?: string
  path?: string
  type?: string
}

/** Per-page SEO: title, description, canonical, Open Graph and Twitter cards. */
export function Seo({ title, description, path, type = 'website' }: SeoProps) {
  const url = path ? `${SITE_URL}${path}` : SITE_URL
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={DEFAULT_IMAGE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={DEFAULT_IMAGE} />
    </Helmet>
  )
}
