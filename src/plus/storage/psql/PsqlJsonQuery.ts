import { IJsonQuery } from '@waha/core/storage/sql/IJsonQuery';

export class PsqlJsonQuery implements IJsonQuery {
  filter(field: string, key: string): string {
    const paths = key.split('.');
    key = paths.pop();
    const jsonPath = paths.map((k) => `'${k}'`).join('->');
    if (jsonPath) {
      return `${field}::json->${jsonPath}->>'${key}' = ? `;
    }
    return `${field}::json->>'${key}' = ? `;
  }

  sortBy(field: string, sortBy: string, direction: string): string {
    const paths = sortBy.split('.');
    sortBy = paths.pop();
    const jsonPath = paths.map((k) => `'${k}'`).join('->');
    if (jsonPath) {
      return `${field}::json->${jsonPath}->>'${sortBy}' ${direction}`;
    }
    return `${field}::json->>'${sortBy}' ${direction}`;
  }
}
