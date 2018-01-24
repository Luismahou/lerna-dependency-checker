// Detect if sub-packages are using dependencies with a different version
// from the ones declared in the top-level package.

const fs = require('fs');

const NOT_FOUND = 'NOT_FOUND';
const VERSION_MISMATCH = 'VERSION_MISMATCH';
const OK = 'OK';

function readIgnorePackages(args) {
  if (args.length > 0 && args.length !== 2) {
    throw new Error(
      'Invalid arguments passed. Hint: to ignore packages use "--ignore pkg1,pkg2,pkg3"',
    );
  }
  if (args.length === 2) {
    return args[1].split(',').map(pkgName => pkgName.trim());
  }
  return [];
}

function readBaseDependencies() {
  try {
    const basePkg = JSON.parse(fs.readFileSync('./package.json'));
    return basePkg.devDependencies || {};
  } catch (error) {
    console.log(error);
    throw new Error('Cannot read "devDependencies" from main "package.json"')
  }
}

function findProblems(baseDeps, deps) {
  return Object.keys(deps)
    .map(dep => {
      const depVersion = deps[dep];
      const baseVersion = baseDeps[dep];
      if (!baseVersion) {
        return { type: NOT_FOUND, dependency: dep };
      }
      if (depVersion !== baseVersion) {
        return { type: VERSION_MISMATCH, dependency: dep };
      }
      return { type: OK, dependency: dep };
    })
    .filter(result => result.type !== OK);
}

function reportProblems(pkgName, baseDeps, deps) {
  const problems = findProblems(baseDeps, deps);
  if (problems.length > 0) {
    console.log(`\nProblems found in package: ${pkgName}`);
    problems.forEach(problem => {
      if (problem.type === NOT_FOUND) {
        console.log(
          `Dependency ${problem.dependency} not found in main package.json`,
        );
      } else if (problem.type === VERSION_MISMATCH) {
        console.log(
          `Dependency ${problem.dependency} requires version ${
            baseDeps[problem.dependency]
          } instead of ${deps[problem.dependency]}`,
        );
      }
    });
  }
  return problems.length > 0;
}

function inspectDependencies(folder, baseDependencies, ignoredPackages) {
  let anyProblem = false;
  const pkgDirs = fs.readdirSync('./packages');
  pkgDirs.filter(dir => ignoredPackages.indexOf(dir) < 0).forEach(dir => {
    const filePath = `./packages/${dir}/package.json`;
    if (fs.statSync(filePath)) {
      try {
        const pkgContents = fs.readFileSync(filePath, { encoding: 'utf-8' });
        const pkgJson = JSON.parse(pkgContents);
        if (pkgJson.peerDependencies) {
          const anyProblemPkg = reportProblems(
            dir,
            baseDependencies,
            pkgJson.peerDependencies,
          );
          if (anyProblemPkg) {
            anyProblem = true;
          }
        }
      } catch (error) {
        console.error(error);
        throw new Error(`Cannot process ${filePath}`);
      }
    }
  });
  return anyProblem;
}

function run(args) {
  const ignoredPackages = readIgnorePackages(args);
  const baseDeps = readBaseDependencies();
  const anyProblem =
    inspectDependencies('./packages', baseDeps, ignoredPackages);
  if (anyProblem) {
    console.log(
      '\nErrors where found while checking the dependencies. See above',
    );
    process.exit(1);
  }
}

module.exports = run;
