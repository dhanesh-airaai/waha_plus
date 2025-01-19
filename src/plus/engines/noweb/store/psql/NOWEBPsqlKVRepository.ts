import { BufferJSON } from '@adiwajshing/baileys/lib/Utils';
import {
  convertProtobufToPlainObject,
  replaceLongsWithNumber,
} from '@waha/core/engines/noweb/utils';
import { PsqlKVRepository } from '@waha/plus/storage/psql/PsqlKVRepository';

/**
 * Key value repository with extra metadata
 * Add support for converting protobuf to plain object
 */
export class NOWEBPsqlKVRepository<Entity> extends PsqlKVRepository<Entity> {
  protected stringify(data: any): string {
    return JSON.stringify(data, BufferJSON.replacer);
  }

  protected parse(row: any): any {
    return JSON.parse(row.data, BufferJSON.reviver);
  }

  protected dump(entity: Entity) {
    const raw = convertProtobufToPlainObject(entity);
    replaceLongsWithNumber(raw);
    return super.dump(raw);
  }
}
