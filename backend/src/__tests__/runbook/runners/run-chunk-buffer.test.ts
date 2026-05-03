import { RunChunkBuffer } from '../../../runbook/runners/run-chunk-buffer';

describe('RunChunkBuffer', () => {
  it('appends consecutive chunks for the same machine into one stream', () => {
    const buf = new RunChunkBuffer();
    buf.append({ machineId: 'm1', stream: 'stdout', text: 'hello\n' });
    buf.append({ machineId: 'm1', stream: 'stdout', text: 'world\n' });
    expect(buf.drain('m1')).toEqual({ stdout: 'hello\nworld\n', stderr: '' });
  });

  it('keeps stdout and stderr in separate streams', () => {
    const buf = new RunChunkBuffer();
    buf.append({ machineId: 'm1', stream: 'stdout', text: 'a\n' });
    buf.append({ machineId: 'm1', stream: 'stderr', text: 'oops\n' });
    expect(buf.drain('m1')).toEqual({ stdout: 'a\n', stderr: 'oops\n' });
  });

  it('isolates buffers per machine', () => {
    const buf = new RunChunkBuffer();
    buf.append({ machineId: 'm1', stream: 'stdout', text: 'aaa' });
    buf.append({ machineId: 'm2', stream: 'stdout', text: 'bbb' });
    expect(buf.drain('m1').stdout).toBe('aaa');
    expect(buf.drain('m2').stdout).toBe('bbb');
  });

  it('drain removes the entry so a second drain returns empty', () => {
    const buf = new RunChunkBuffer();
    buf.append({ machineId: 'm1', stream: 'stdout', text: 'x' });
    expect(buf.drain('m1').stdout).toBe('x');
    expect(buf.drain('m1').stdout).toBe('');
    expect(buf.size).toBe(0);
  });

  it('forget drops the entry without reading and is idempotent', () => {
    const buf = new RunChunkBuffer();
    buf.append({ machineId: 'm1', stream: 'stdout', text: 'x' });
    buf.forget('m1');
    buf.forget('m1');
    expect(buf.drain('m1')).toEqual({ stdout: '', stderr: '' });
  });

  it('truncates a runaway stream to the configured cap (sliding window)', () => {
    const buf = new RunChunkBuffer({ maxBytesPerStream: 10 });
    buf.append({ machineId: 'm1', stream: 'stdout', text: '0123456789' });
    buf.append({ machineId: 'm1', stream: 'stdout', text: 'ABCDE' });
    // The accumulated text would be '0123456789ABCDE' (15 chars); the
    // cap is 10, so the head '01234' is dropped and we keep the
    // most recent 10 bytes.
    expect(buf.drain('m1').stdout).toBe('56789ABCDE');
  });

  it('returns empty for an unknown machine without polluting the map', () => {
    const buf = new RunChunkBuffer();
    expect(buf.drain('ghost')).toEqual({ stdout: '', stderr: '' });
    expect(buf.size).toBe(0);
  });
});
