import {
  HtmlExtractNodeConfig,
  HtmlExtractResult,
  ExecutionInput,
} from '../../types/workflow.types';

export class HtmlExtractExecutor {
  execute(config: HtmlExtractNodeConfig, input: ExecutionInput): HtmlExtractResult {
    const inputField = config.inputField || 'html';
    const source = (input as any)[inputField] || config.sourceData || '';
    const selector = config.selector;
    const extractType = config.extractType || 'text';
    const multiple = config.multiple || false;
    let result: string | string[] = '';
    let count = 0;

    if (selector) {
      const regex = new RegExp(`<${selector}[^>]*>(.*?)</${selector}>`, 'gi');
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(source)) !== null) {
        if (extractType === 'text') {
          matches.push(match[1].replace(/<[^>]*>/g, '').trim());
        } else if (extractType === 'html') {
          matches.push(match[0]);
        } else if (extractType === 'attribute' && config.attribute) {
          const attrMatch = match[0].match(new RegExp(`${config.attribute}=["']([^"']+)["']`, 'i'));
          if (attrMatch) matches.push(attrMatch[1]);
        }
        if (!multiple) break;
      }
      result = multiple ? matches : (matches[0] || '');
      count = matches.length;
    } else {
      result = source
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      count = result ? 1 : 0;
    }

    return {
      ...input,
      extracted: result,
      count,
    };
  }
}
