import { fieldLabel, optionLabel } from '../../lib/field-labels';

describe('fieldLabel', () => {
  it('keeps English as is', () => {
    expect(fieldLabel('Customer id', 'en')).toBe('Customer id');
  });

  it('translates exact labels and composes "<noun> id/URL/name"', () => {
    expect(fieldLabel('Subject', 'es')).toBe('Asunto');
    expect(fieldLabel('Customer id', 'es')).toBe('ID de cliente');
    expect(fieldLabel('Calendar ids', 'es')).toBe('IDs de calendario');
    expect(fieldLabel('Jenkins URL', 'es')).toBe('URL de Jenkins');
    expect(fieldLabel('Project id or name', 'es')).toBe('ID o nombre de proyecto');
  });

  it('translates the core and the trailing parenthesis separately', () => {
    expect(fieldLabel('Timeout (minutes)', 'es')).toBe('Tiempo límite (minutos)');
    expect(fieldLabel('Due (ISO)', 'es')).toBe('Vence (ISO)');
    expect(fieldLabel('Rows (JSON array)', 'es')).toBe('Filas (arreglo JSON)');
  });

  it('falls back to English rather than mixing languages', () => {
    expect(fieldLabel('Flux capacitor id', 'es')).toBe('Flux capacitor id');
    expect(fieldLabel('JQL', 'es')).toBe('JQL');
  });
});

describe('optionLabel', () => {
  it('uses the Spanish name only when there is one', () => {
    expect(optionLabel({ name: 'List charges', es: 'Listar cobros' }, 'es')).toBe('Listar cobros');
    expect(optionLabel({ name: 'List charges', es: 'Listar cobros' }, 'en')).toBe('List charges');
    expect(optionLabel({ name: 'Python 3.12' }, 'es')).toBe('Python 3.12');
  });
});
