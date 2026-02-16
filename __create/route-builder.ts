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
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1); // Remove 'route.js'
  if (relativePath === '' || routeParts.length === 0) {
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
    try {
      const loader = routeModules[modulePath];
      const route = await loader();

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        try {
          if (route[method]) {
            const parts = getHonoPathFromModulePath(modulePath);
            const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
            const handler: Handler = async (c) => {
              const params = c.req.param();
              if (import.meta.env.DEV) {
                const updatedRoute = await loader();
                return await updatedRoute[method](c.req.raw, { params });
              }
              return await route[method](c.req.raw, { params });
            };
            const methodLowercase = method.toLowerCase();
            switch (methodLowercase) {
              case 'get':
                api.get(honoPath, handler);
                break;
              case 'post':
                api.post(honoPath, handler);
                break;
              case 'put':
                api.put(honoPath, handler);
                break;
              case 'delete':
                api.delete(honoPath, handler);
                break;
              case 'patch':
                api.patch(honoPath, handler);
                break;
              default:
                console.warn(`Unsupported method: ${method}`);
                break;
            }
          }
        } catch (error) {
          console.error(`Error registering route ${modulePath} for method ${method}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error importing route file ${modulePath}:`, error);
    }
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
