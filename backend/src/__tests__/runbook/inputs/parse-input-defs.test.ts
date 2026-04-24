import { parseInputDefs } from '../../../runbook/inputs/parse-input-defs';

describe('parseInputDefs', () => {
  // Silence the error logger during the "malformed input" cases so
  // the test output stays clean. The parsing behavior is what we
  // assert on; the log line is a side effect verified by the mock.
  let errorSpy: jest.SpyInstance;
  beforeAll(() => {
    errorSpy = jest
      .spyOn(require('../../../config/logger.config').logger, 'error')
      .mockImplementation(() => {
        /* noop */
      });
  });
  afterAll(() => {
    errorSpy.mockRestore();
  });
  beforeEach(() => {
    errorSpy.mockClear();
  });

  it('returns an empty array for null (the Prisma default for JSON?)', () => {
    expect(parseInputDefs(null)).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    expect(parseInputDefs(undefined)).toEqual([]);
  });

  it('returns an empty array for the default "[]" Prisma literal', () => {
    expect(parseInputDefs([])).toEqual([]);
  });

  it('parses a well-formed single input', () => {
    const result = parseInputDefs([{ name: 'env', type: 'text', required: true }]);
    expect(result).toEqual([{ name: 'env', type: 'text', required: true }]);
  });

  it('parses multiple inputs of mixed types', () => {
    const input = [
      { name: 'env', type: 'select', options: ['dev', 'prod'], required: true },
      { name: 'retries', type: 'number', default: 3 },
      { name: 'dry', type: 'boolean' },
    ];
    expect(parseInputDefs(input)).toEqual(input);
  });

  it('falls back to empty + logs error when the value is not an array', () => {
    expect(parseInputDefs('garbage')).toEqual([]);
    expect(parseInputDefs(42)).toEqual([]);
    expect(parseInputDefs({ name: 'env' })).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(3);
  });

  it('falls back to empty + logs error when an entry fails schema validation', () => {
    // missing type
    expect(parseInputDefs([{ name: 'env' }])).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to empty when a select input has no options', () => {
    // select without options breaks runbookInputDefinitionSchema's refine
    expect(parseInputDefs([{ name: 'env', type: 'select' }])).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('falls back to empty when the name is not a valid identifier', () => {
    expect(parseInputDefs([{ name: '1invalid', type: 'text' }])).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });
});
