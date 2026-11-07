import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROUTES = join(__dirname, '../../routes');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

describe('web routers', () => {
  it.each(routeFiles(ROUTES).map(path => [path.slice(ROUTES.length + 1), path]))(
    '%s never assigns the anonymous user outside anonymous mode',
    (_name, path) => {
      const source = readFileSync(path, 'utf8');
      if (!source.includes("id: 'anonymous'")) return;
      expect(source).toContain("process.env.OPERARI_ANONYMOUS_MODE !== 'true'");
    }
  );

  it('only the OAuth callback router relies on anonymousFallback without a gate', () => {
    const open = routeFiles(ROUTES).filter(path =>
      readFileSync(path, 'utf8').includes('router.use(anonymousFallback)')
    );
    expect(open.map(path => path.slice(ROUTES.length + 1))).toEqual([
      'connected-accounts.routes.ts',
    ]);
  });
});
