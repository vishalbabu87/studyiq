import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();
if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

const routeModules = import.meta.glob('../src/app/api/**/route.js');

// Helper function to transform file path to Hono route path
function getHonoPathFromModulePath(modulePath: string): { name: string; pattern: string }[] {
  const relativePath = modulePath
    .replace('../src/app/api/', '')
    .replace(/\/route\.js$/, '');
  if (relativePath === '') {
    return [{ name: 'root', pattern: '' }];
  }
  const transformedParts = relativePath.split('/').filter(Boolean).map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

// Import and register all routes
async function registerRoutes() {
  const routeFiles = Object.keys(routeModules)
    .slice()
    .sort((a, b) => b.length - a.length);

  // Clear existing routes
  api.routes = [];

  for (const modulePath of routeFiles) {
    const loader = routeModules[modulePath];
    const parts = getHonoPathFromModulePath(modulePath);
    const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;

    const handler: Handler = async (c) => {
      try {
        const route = await loader();
        const method = c.req.method?.toUpperCase();
        const action = route?.[method];
        if (!action) {
          return c.json({ error: `Method ${method} not allowed` }, 405);
        }
        const params = c.req.param();
        return await action(c.req.raw, { params });
      } catch (error) {
        console.error(`Error handling route ${modulePath}:`, error);
        return c.json({ error: 'API route failed to execute' }, 500);
      }
    };

    api.all(honoPath, handler);
  }
}

// Initial route registration
await registerRoutes();

// Hot reload routes in development
if (import.meta.env.DEV) {
  if (import.meta.hot) {
    import.meta.hot.accept((newSelf) => {
      registerRoutes().catch((err) => {
        console.error('Error reloading routes:', err);
      });
    });
  }
}

export { api, API_BASENAME };
