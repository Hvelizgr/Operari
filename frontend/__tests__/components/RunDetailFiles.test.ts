import { filesIn } from '../../components/Runs/RunDetail';

describe('filesIn', () => {
  it('finds file references anywhere in a step output, once each', () => {
    const file = { kind: 'file', id: 'f1', name: 'report.csv', size: 10, mimeType: 'text/csv' };
    expect(
      filesIn({
        status: 200,
        file,
        nested: { list: [file, { kind: 'file', id: 'f2', name: 'b.png', size: 3 }] },
      })
    ).toEqual([
      { id: 'f1', name: 'report.csv', size: 10 },
      { id: 'f2', name: 'b.png', size: 3 },
    ]);
  });

  it('ignores lookalikes and non-objects', () => {
    expect(filesIn({ kind: 'file', name: 'no id' })).toEqual([]);
    expect(filesIn('text')).toEqual([]);
    expect(filesIn(null)).toEqual([]);
  });
});
