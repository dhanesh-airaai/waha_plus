export interface IJsonQuery {
  filter(field: string, key: string): string;
  sortBy(field: string, sortBy: string, direction: string): string;
}
