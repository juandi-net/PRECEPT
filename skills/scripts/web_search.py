#!/usr/bin/env python3
"""Search the web and return structured results.

Usage: python web_search.py "search query" [--limit N]

Output: JSON array of {title, url, snippet} objects.
"""
import sys
import json
import re
import urllib.request
import urllib.parse


def search(query: str, limit: int = 5) -> list[dict]:
    """Search using DuckDuckGo HTML (no API key needed)."""
    encoded = urllib.parse.urlencode({'q': query})
    url = f'https://html.duckduckgo.com/html/?{encoded}'
    req = urllib.request.Request(url, headers={'User-Agent': 'PRECEPT-Worker/1.0'})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8')
    except Exception as e:
        return [{'error': str(e)}]

    # Parse results from DuckDuckGo HTML
    results = []
    links = re.findall(r'<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.*?)</a>', html)
    snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)

    for i, (href, title) in enumerate(links[:limit]):
        snippet = snippets[i] if i < len(snippets) else ''
        # Clean HTML tags from title and snippet
        title = re.sub(r'<[^>]+>', '', title).strip()
        snippet = re.sub(r'<[^>]+>', '', snippet).strip()
        # Decode DuckDuckGo redirect URL
        parsed = urllib.parse.urlparse(href)
        params = urllib.parse.parse_qs(parsed.query)
        actual_url = params.get('uddg', [href])[0]
        results.append({'title': title, 'url': actual_url, 'snippet': snippet})

    return results


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: web_search.py "query" [--limit N]'}))
        sys.exit(1)

    query = sys.argv[1]
    limit = 5
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        limit = int(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else 5

    results = search(query, limit)
    print(json.dumps(results, indent=2))
