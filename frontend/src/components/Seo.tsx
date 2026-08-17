import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://founderhub.site'
const SITE_NAME = 'FounderHub'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

interface SeoProps {
  title: string
  description?: string
  path?: string
  type?: string
  noindex?: boolean
}

/** Per-page SEO: title, description, canonical, Open Graph and Twitter cards. */
export function Seo({ title, description, path, type = 'website', noindex = false }: SeoProps) {
  const url = path ? `${SITE_URL}${path}` : SITE_URL
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={DEFAULT_IMAGE} />
      <meta property="og:image:alt" content="FounderHub — AI startup platform for founders" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={DEFAULT_IMAGE} />
    </Helmet>
  )
}
