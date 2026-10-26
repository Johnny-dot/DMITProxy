import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { legacyPortalRedirectPath } from './legacy-routes.js';

describe('legacyPortalRedirectPath', () => {
  it('sends the old guide and community pages to the user portal', () => {
    expect(legacyPortalRedirectPath('/guides')).toBe('/my-subscription?section=setup');
    expect(legacyPortalRedirectPath('/guides/')).toBe('/my-subscription?section=setup');
    expect(legacyPortalRedirectPath('/community')).toBe('/my-subscription?section=help');
    expect(legacyPortalRedirectPath('/community/')).toBe('/my-subscription?section=help');
  });

  it('leaves guide screenshots and other paths alone', () => {
    expect(legacyPortalRedirectPath('/guides/flclash/url.png')).toBeNull();
    expect(legacyPortalRedirectPath('/my-subscription')).toBeNull();
  });
});

describe('legacy portal HTTP redirects', () => {
  const app = createApp();

  it('redirects the blank guide and community pages', async () => {
    const guides = await request(app).get('/guides/');
    expect(guides.status).toBe(302);
    expect(guides.headers.location).toBe('/my-subscription?section=setup');

    const community = await request(app).get('/community');
    expect(community.status).toBe(302);
    expect(community.headers.location).toBe('/my-subscription?section=help');
  });

  it('does not redirect guide screenshots', async () => {
    const asset = await request(app).get('/guides/flclash/url.png');
    expect(asset.status).not.toBe(302);
  });
});
