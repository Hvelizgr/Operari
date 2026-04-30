/**
 * Integration test for the Python plugin bridge.
 *
 * Spawns the example plugin at packages/python-sdk/examples/hello_world/
 * via spawnPythonStep and asserts the EMIT + RESULT lines round-trip.
 * If python3 is not on PATH (CI environments without Python), the
 * test cleanly skips with a console.log so a missing tool does not
 * fake-pass or crash the suite.
 */

import { execSync } from 'child_process';
import path from 'path';

import { spawnPythonStep } from '../../../runbook/plugins/python-bridge';

const EXAMPLE_DIR = path.resolve(
  __dirname,
  '../../../../../packages/python-sdk/examples/hello_world'
);
const HELLO_ENTRY = path.join(EXAMPLE_DIR, 'hello_step.py');

// The hello_step.py example imports from `operari.steps`, so the
// Python interpreter that runs it must have the operari package
// installed. We use the SDK's local venv when present (created by
// `cd packages/python-sdk && python -m venv .venv && pip install
// -e .[dev]`) and fall back to system python3 otherwise. Tests
// that exercise the example skip cleanly if the venv is missing.
const SDK_VENV_PYTHON = path.resolve(
  __dirname,
  '../../../../../packages/python-sdk/.venv/bin/python'
);

function pythonAvailable(): boolean {
  try {
    execSync(process.env.OPERARI_PYTHON_BIN || 'python3 --version', {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

const HAS_PYTHON = pythonAvailable();
const maybeIt = HAS_PYTHON ? it : it.skip;

// Separate gate for tests that exercise the operari Python package —
// those need the SDK venv (or a system install). Tests that just
// spawn arbitrary scripts (timeout, stderr, no-result) only need
// raw python3.
const HAS_SDK_VENV = (() => {
  try {
    const fs = require('fs');
    return fs.existsSync(SDK_VENV_PYTHON);
  } catch {
    return false;
  }
})();
const maybeItSdk = HAS_PYTHON && HAS_SDK_VENV ? it : it.skip;

describe('spawnPythonStep (real subprocess)', () => {
  if (!HAS_PYTHON) {
    // eslint-disable-next-line no-console
    console.log('python3 not on PATH — skipping python-bridge integration suite');
  }

  maybeItSdk(
    'round-trips EMIT + RESULT against the hello_world example',
    async () => {
      const emits: Array<{ type: string; text: string }> = [];

      const result = await spawnPythonStep(
        { name: 'Operari' },
        {
          runId: 'r-python-1',
          stepId: 's-1',
          tenantId: 't-1',
          variables: {},
          previousOutputs: {},
          secrets: {},
          emit: ev => emits.push(ev),
        },
        {
          entry: HELLO_ENTRY,
          cwd: EXAMPLE_DIR,
          pythonBin: SDK_VENV_PYTHON,
        }
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ greeted: 'Operari' });
      expect(emits.length).toBeGreaterThan(0);
      expect(emits[0].type).toBe('log');
      expect(emits[0].text).toContain('Operari');
      expect(emits[0].text).toContain('r-python-1');
    },
    15_000
  );

  maybeIt(
    'returns a structured failure when the script itself crashes',
    async () => {
      // Use python -c as a one-shot to avoid touching a fixture file.
      // We point spawnPythonStep at an inline script that just throws.
      // Done by writing a temp script next to the example dir.
      const tmpScript = path.join(EXAMPLE_DIR, '_test_throw.py');
      const fs = await import('fs');
      fs.writeFileSync(
        tmpScript,
        [
          'import sys, json',
          'sys.stdin.read()',
          'raise SystemExit("forced exit no result line")',
        ].join('\n')
      );

      try {
        const result = await spawnPythonStep(
          {},
          {
            runId: 'r',
            stepId: 's',
            tenantId: 't',
            variables: {},
            previousOutputs: {},
            secrets: {},
            emit: () => undefined,
          },
          { entry: tmpScript, cwd: EXAMPLE_DIR }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no RESULT emitted/);
      } finally {
        fs.unlinkSync(tmpScript);
      }
    },
    15_000
  );

  maybeIt(
    'captures stderr (Python traceback) into the failure error',
    async () => {
      const tmpScript = path.join(EXAMPLE_DIR, '_test_stderr.py');
      const fs = await import('fs');
      fs.writeFileSync(
        tmpScript,
        ['import sys', 'sys.stdin.read()', 'raise RuntimeError("uncaught at top level")'].join('\n')
      );

      try {
        const result = await spawnPythonStep(
          {},
          {
            runId: 'r',
            stepId: 's',
            tenantId: 't',
            variables: {},
            previousOutputs: {},
            secrets: {},
            emit: () => undefined,
          },
          { entry: tmpScript, cwd: EXAMPLE_DIR }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/uncaught at top level|Traceback/);
      } finally {
        fs.unlinkSync(tmpScript);
      }
    },
    15_000
  );

  maybeIt(
    'honors timeoutMs and kills the subprocess on overrun',
    async () => {
      const tmpScript = path.join(EXAMPLE_DIR, '_test_timeout.py');
      const fs = await import('fs');
      fs.writeFileSync(
        tmpScript,
        ['import sys, time', 'sys.stdin.read()', 'time.sleep(60)'].join('\n')
      );

      try {
        const start = Date.now();
        const result = await spawnPythonStep(
          {},
          {
            runId: 'r',
            stepId: 's',
            tenantId: 't',
            variables: {},
            previousOutputs: {},
            secrets: {},
            emit: () => undefined,
          },
          { entry: tmpScript, cwd: EXAMPLE_DIR, timeoutMs: 500 }
        );
        const elapsed = Date.now() - start;

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/timed out/);
        // Should land in well under the 60s sleep — the timeout fires
        // at 500ms + 2s grace, so generous upper bound is 5s.
        expect(elapsed).toBeLessThan(5000);
      } finally {
        fs.unlinkSync(tmpScript);
      }
    },
    10_000
  );
});
