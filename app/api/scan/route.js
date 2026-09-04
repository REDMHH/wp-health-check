function isValidUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function extractPlugins(html) {
  const pluginPattern = /\/wp-content\/plugins\/([^/'"]+)/g
  const plugins = new Set()
  let match

  while ((match = pluginPattern.exec(html)) !== null) {
    plugins.add(match[1])
  }

  return [...plugins]
}

export async function POST(request) {
  let body

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url } = body

  // Validate the target URL before calling external services.
  if (!url || typeof url !== 'string' || !isValidUrl(url)) {
    return Response.json({ error: 'A valid url is required' }, { status: 400 })
  }

  try {
    // Fetch mobile performance data from Google PageSpeed Insights.
    const pagespeedUrl = new URL(
      'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    )
    pagespeedUrl.searchParams.set('url', url)
    pagespeedUrl.searchParams.set('strategy', 'mobile')

    const pagespeedResponse = await fetch(pagespeedUrl)

    if (!pagespeedResponse.ok) {
      throw new Error(`PageSpeed API failed with status ${pagespeedResponse.status}`)
    }

    const pagespeedData = await pagespeedResponse.json()
    const score = pagespeedData?.lighthouseResult?.categories?.performance?.score
    const performanceScore =
      typeof score === 'number' ? Math.round(score * 100) : null

    // Fetch the page HTML and scan for WordPress/plugin markers.
    const htmlResponse = await fetch(url)

    if (!htmlResponse.ok) {
      throw new Error(`Target website failed with status ${htmlResponse.status}`)
    }

    const html = await htmlResponse.text()
    const isWordPress = html.includes('wp-content')
    const plugins = extractPlugins(html)

    return Response.json({
      url,
      is_wordpress: isWordPress,
      performance_score: performanceScore,
      plugins,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    )
  }
}
