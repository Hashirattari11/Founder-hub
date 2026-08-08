import { Helmet } from 'react-helmet-async'

interface SeoProps {
  title: string
  description?: string
}

export function Seo({ title, description }: SeoProps) {
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
    </Helmet>
  )
}
