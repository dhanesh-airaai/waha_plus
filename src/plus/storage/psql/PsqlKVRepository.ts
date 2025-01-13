import { SqlKVRepository } from '@waha/core/storage/sql/SqlKVRepository';
import { PsqlKnexEngine } from '@waha/plus/storage/psql/PsqlKnexEngine';
import Knex from 'knex';

export class PsqlKVRepository<Entity> extends SqlKVRepository<Entity> {
  protected knex: Knex.Knex;

  constructor(knex: Knex.Knex) {
    const engine = new PsqlKnexEngine(knex);
    super(engine, knex);
  }
}
