// Rewrites each workspace package's package.json into its GitHub-Packages
// publish identity, IN PLACE, inside a CI runner's checkout only — never
// run this against your own working copy and commit the result.
//
// Why this exists at all: GitHub Packages' npm registry requires a
// package's scope to match the GitHub user/org that owns the repository
// it's published from (@5636mohamed here). The workspace packages are
// named @advisor/shared, @advisor/api, @advisor/web internally — renaming
// those for real would mean touching every `import ... from '@advisor/x'`
// across the whole codebase for a purely cosmetic publish-time concern.
// Instead, this script does the rename in an ephemeral copy right before
// `npm publish`, and nothing it does is ever committed back:
//   - name: @advisor/x -> @5636mohamed/academic-advisor-x
//   - removes "private": true (npm refuses to publish a private package)
//   - adds publishConfig.registry + a repository field (GitHub Packages
//     wants both to correctly associate the package with this repo)
//   - rewrites any @advisor/* entry in "dependencies" to the same renamed
//     scope, so a published @advisor/api doesn't declare a dependency on
//     an @advisor/shared that was never actually published anywhere
import fs from 'node:fs';

const OWNER = '5636mohamed';
const REPO = 'academic-advisor';

const RENAME = {
  '@advisor/shared': `@${OWNER}/${REPO}-shared`,
  '@advisor/api': `@${OWNER}/${REPO}-api`,
  '@advisor/web': `@${OWNER}/${REPO}-web`,
};

const PACKAGE_DIRS = {
  '@advisor/shared': 'packages/shared',
  '@advisor/api': 'packages/api',
  '@advisor/web': 'packages/web',
};

for (const [originalName, dir] of Object.entries(PACKAGE_DIRS)) {
  const pkgPath = `${dir}/package.json`;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  pkg.name = RENAME[originalName];
  delete pkg.private;
  pkg.publishConfig = { registry: 'https://npm.pkg.github.com' };
  pkg.repository = { type: 'git', url: `https://github.com/${OWNER}/${REPO}.git` };

  if (pkg.dependencies) {
    for (const [dep, version] of Object.entries(pkg.dependencies)) {
      if (RENAME[dep]) {
        delete pkg.dependencies[dep];
        pkg.dependencies[RENAME[dep]] = version;
      }
    }
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`${pkgPath}: ${originalName} -> ${pkg.name}`);
}
