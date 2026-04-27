import type {
  AmoebaTalkSendDto,
  AmoebaTalkSendResultDto,
} from '../dto/amoebatalk-message.dto';

export const AMOEBATALK_CLIENT = Symbol('AMOEBATALK_CLIENT');

export interface IAmoebaTalkClient {
  send(message: AmoebaTalkSendDto): Promise<AmoebaTalkSendResultDto>;
}
