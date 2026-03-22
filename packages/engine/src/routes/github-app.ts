import { Hono } from 'hono';
import { getOrg, getOrgConfig, getGitHubAppCredentials, saveGitHubAppCredentials, saveGitHubInstallationId } from '../db/orgs.js';
import { logEvent } from '../db/audit.js';
import { generateAppJwt } from '../lib/github-app.js';

export const githubApp = new Hono();

/**
 * GET /setup?orgId=...
 *
 * Serves an HTML page with a form that POSTs the manifest to GitHub.
 * The org owner clicks "Create GitHub App" on GitHub's confirmation page.
 */
githubApp.get('/setup', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) return c.json({ error: 'orgId required' }, 400);

  const org = await getOrg(orgId);
  if (!org) return c.json({ error: 'Org not found' }, 404);

  const config = await getOrgConfig(orgId);
  const githubOrg = config?.githubOrg;
  if (!githubOrg) {
    return c.json({ error: 'Org has no github_org configured. Set it in org_config first.' }, 400);
  }

  const appName = `${org.slug}-worker`;
  const engineUrl = process.env.ENGINE_PUBLIC_URL ?? 'http://localhost:3001';
  const webUrl = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';
  const callbackUrl = `${engineUrl}/api/github/app/callback`;

  const manifest = {
    name: appName,
    url: webUrl,
    hook_attributes: {
      url: `${engineUrl}/api/webhooks/github`,
      active: false,
    },
    redirect_url: callbackUrl,
    public: false,
    default_permissions: {
      contents: 'write',
      metadata: 'read',
      pull_requests: 'write',
      issues: 'write',
      administration: 'read',
    },
    default_events: [],
  };

  const githubUrl = `https://github.com/organizations/${githubOrg}/settings/apps/new`;

  const html = `<!DOCTYPE html>
<html>
<head><title>Connect GitHub — ${org.name}</title></head>
<body style="font-family: 'Times New Roman', serif; max-width: 600px; margin: 80px auto; color: #111;">
  <h1 style="font-size: 1.5rem; font-weight: normal;">Connect GitHub</h1>
  <p>This will create a GitHub App called <strong>${appName}</strong> in the <strong>${githubOrg}</strong> organization.</p>
  <p>All worker commits will be attributed to <strong>${appName}[bot]</strong>.</p>
  <form action="${githubUrl}" method="post">
    <input type="hidden" name="manifest" value='${JSON.stringify(manifest)}'>
    <input type="hidden" name="state" value="${orgId}">
    <button type="submit" style="background: #111; color: #fff; border: 1px solid #111; padding: 12px 24px; font-family: inherit; font-size: 1rem; cursor: pointer;">
      Create GitHub App →
    </button>
  </form>
  <p style="font-size: 0.85rem; color: #666; margin-top: 24px;">
    You'll be redirected to GitHub to confirm. Click "Create GitHub App" there.
  </p>
</body>
</html>`;

  return c.html(html);
});

/**
 * GET /callback?code=...&state=...
 *
 * GitHub redirects here after the owner creates the app.
 * Exchange the code for app credentials, store them, then redirect to install.
 */
githubApp.get('/callback', async (c) => {
  const code = c.req.query('code');
  const orgId = c.req.query('state');
  const webUrl = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';

  if (!code || !orgId) {
    return c.json({ error: 'Missing code or state (orgId)' }, 400);
  }

  try {
    const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[github-app] Manifest conversion failed (${response.status}):`, body);
      return c.redirect(`${webUrl}/interface?github=error`);
    }

    const data = (await response.json()) as {
      id: number;
      slug: string;
      pem: string;
      webhook_secret: string;
      client_id: string;
      client_secret: string;
      owner: { login: string };
      html_url: string;
    };

    await saveGitHubAppCredentials(orgId, {
      appId: data.id,
      slug: data.slug,
      pem: data.pem,
      webhookSecret: data.webhook_secret,
      clientId: data.client_id,
      clientSecret: data.client_secret,
    });

    await logEvent(orgId, 'github_app.created', 'system', {
      appId: data.id,
      slug: data.slug,
      owner: data.owner.login,
    });

    // Redirect owner to install the app on their org
    return c.redirect(`https://github.com/apps/${data.slug}/installations/new`);
  } catch (err) {
    console.error('[github-app] Callback error:', err);
    return c.redirect(`${webUrl}/interface?github=error`);
  }
});

/**
 * POST /resolve-installation
 *
 * Fetches the installation ID from GitHub API and stores it.
 * Called after the owner installs the app on their org.
 */
githubApp.post('/resolve-installation', async (c) => {
  const { orgId } = await c.req.json<{ orgId: string }>();
  if (!orgId) return c.json({ error: 'orgId required' }, 400);

  const creds = await getGitHubAppCredentials(orgId);
  if (!creds) return c.json({ error: 'No GitHub App configured for this org' }, 404);

  if (creds.installationId) {
    return c.json({ installationId: creds.installationId, status: 'already_set' });
  }

  const appJwt = generateAppJwt({ appId: creds.appId, privateKey: creds.pem });
  const response = await fetch('https://api.github.com/app/installations', {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    return c.json({ error: 'Failed to fetch installations' }, 500);
  }

  const installations = (await response.json()) as Array<{
    id: number;
    account: { login: string };
  }>;

  if (installations.length === 0) {
    return c.json({ error: 'App is not installed on any org yet.' }, 404);
  }

  const installation = installations[0];
  await saveGitHubInstallationId(orgId, installation.id);

  await logEvent(orgId, 'github_app.installed', 'system', {
    installationId: installation.id,
    account: installation.account.login,
  });

  return c.json({ installationId: installation.id, status: 'resolved' });
});

