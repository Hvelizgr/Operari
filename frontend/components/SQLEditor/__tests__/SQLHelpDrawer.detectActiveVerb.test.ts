import { detectActiveVerb } from '../SQLHelpDrawer';

describe('detectActiveVerb', () => {
  it('returns null for empty / whitespace input', () => {
    expect(detectActiveVerb('')).toBeNull();
    expect(detectActiveVerb('   ')).toBeNull();
    expect(detectActiveVerb('\n\n')).toBeNull();
  });

  it('detects the four core verbs', () => {
    expect(detectActiveVerb('SELECT 1;')).toBe('select');
    expect(detectActiveVerb('INSERT INTO t VALUES (1);')).toBe('insert');
    expect(detectActiveVerb('UPDATE t SET a = 1 WHERE id = 2;')).toBe('update');
    expect(detectActiveVerb('DELETE FROM t WHERE id = 1;')).toBe('delete');
  });

  it('treats WITH (CTE) as a select', () => {
    expect(detectActiveVerb('WITH cte AS (SELECT 1) SELECT * FROM cte;')).toBe('select');
  });

  it('is case-insensitive', () => {
    expect(detectActiveVerb('insert into t values (1);')).toBe('insert');
    expect(detectActiveVerb('Update t set a=1;')).toBe('update');
  });

  it('strips line comments before scanning', () => {
    expect(detectActiveVerb('-- comment lead\nINSERT INTO t VALUES (1);')).toBe('insert');
  });

  it('strips block comments before scanning', () => {
    expect(detectActiveVerb('/* block */ DELETE FROM t WHERE id = 1;')).toBe('delete');
  });

  it('picks the verb of the LAST statement in a multi-statement script', () => {
    const sql = `
      SELECT id FROM users LIMIT 5;
      INSERT INTO audit (event) VALUES ('seen');
    `;
    expect(detectActiveVerb(sql)).toBe('insert');
  });

  it('returns null for unknown verbs (CREATE, EXPLAIN, etc.)', () => {
    expect(detectActiveVerb('CREATE TABLE t (id INT);')).toBeNull();
    expect(detectActiveVerb('EXPLAIN ANALYZE SELECT 1;')).toBeNull();
    expect(detectActiveVerb('TRUNCATE t;')).toBeNull();
  });

  it('handles a trailing semicolon-less in-progress statement', () => {
    expect(detectActiveVerb('UPDATE employees SET salary = salary * 1.1')).toBe('update');
  });
});
