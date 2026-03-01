import { DateTimeNodeConfig, DateTimeResult, ExecutionInput } from '../../types/workflow.types';

export class DateTimeNodeExecutor {
  execute(config: DateTimeNodeConfig, input: ExecutionInput): DateTimeResult {
    const operation = config.operation || 'format';
    const inputField = config.inputField || 'date';
    const dateInput = (input as any)[inputField] ?? new Date().toISOString();
    const dateStr = String(dateInput);

    const outputFormat = config.format || 'YYYY-MM-DD HH:mm:ss';
    const value = Number(config.amount) || 0;
    const unit = config.unit || 'seconds';

    let date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      if (!isNaN(Number(dateStr))) {
        date = new Date(Number(dateStr));
      } else {
        throw new Error(`Invalid date format: ${dateStr}`);
      }
    }

    let result: string | number = '';

    switch (operation) {
      case 'now':
        date = new Date();
        result = this.formatDate(date, outputFormat);
        break;
      case 'format':
        result = this.formatDate(date, outputFormat);
        break;
      case 'add':
        date = this.addTime(date, value, unit);
        result = this.formatDate(date, outputFormat);
        break;
      case 'subtract':
        date = this.addTime(date, -value, unit);
        result = this.formatDate(date, outputFormat);
        break;
      case 'diff': {
        const date2 = new Date();
        result = this.getDifference(date, date2, unit);
        break;
      }
      case 'parse':
        result = date.getTime();
        break;
    }

    return {
      ...input,
      result,
      formatted: typeof result === 'string' ? result : String(result),
      timestamp: date.getTime(),
    };
  }

  private addTime(date: Date, value: number, unit: string): Date {
    const newDate = new Date(date);
    switch (unit) {
      case 'seconds':
        newDate.setSeconds(newDate.getSeconds() + value);
        break;
      case 'minutes':
        newDate.setMinutes(newDate.getMinutes() + value);
        break;
      case 'hours':
        newDate.setHours(newDate.getHours() + value);
        break;
      case 'days':
        newDate.setDate(newDate.getDate() + value);
        break;
      case 'weeks':
        newDate.setDate(newDate.getDate() + value * 7);
        break;
      case 'months':
        newDate.setMonth(newDate.getMonth() + value);
        break;
      case 'years':
        newDate.setFullYear(newDate.getFullYear() + value);
        break;
    }
    return newDate;
  }

  private getDifference(date1: Date, date2: Date, unit: string): number {
    const diffMs = date1.getTime() - date2.getTime();
    switch (unit) {
      case 'seconds':
        return diffMs / 1000;
      case 'minutes':
        return diffMs / (1000 * 60);
      case 'hours':
        return diffMs / (1000 * 60 * 60);
      case 'days':
        return diffMs / (1000 * 60 * 60 * 24);
      case 'weeks':
        return diffMs / (1000 * 60 * 60 * 24 * 7);
      case 'months':
        return diffMs / (1000 * 60 * 60 * 24 * 30.44);
      case 'years':
        return diffMs / (1000 * 60 * 60 * 24 * 365.25);
      default:
        return diffMs;
    }
  }

  private formatDate(date: Date, format: string): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const Y = date.getFullYear();
    const M = pad(date.getMonth() + 1);
    const D = pad(date.getDate());
    const H = pad(date.getHours());
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());

    return format
      .replace('YYYY', Y.toString())
      .replace('MM', M)
      .replace('DD', D)
      .replace('HH', H)
      .replace('mm', m)
      .replace('ss', s);
  }
}
