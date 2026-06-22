import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import { MapItemTypeormEntity } from '../../infrastructure/typeorm/map-item.typeorm-entity';
import { MapTestSetTypeormEntity } from '../../infrastructure/typeorm/map-test-set.typeorm-entity';
import { MapTestSetItemTypeormEntity } from '../../infrastructure/typeorm/map-test-set-item.typeorm-entity';
import { MapTestSetService } from './map-test-set.service';

/**
 * Behaviors covered:
 *  1. findById — NotFoundException when missing-in-tenant
 *  2. create — defaults compositionMode=FIXED, status=DRAFT, totalPoints=0
 *  3. syncItems — bank lookup miss → BadRequestException
 *  4. syncItems — snapshot captured per item + totalPoints recomputed in tx
 *  5. delete — tenant-scoped findById gate before delete
 *  6. update — null items skips sync, items=[] empties + zeros totalPoints
 */
describe('MapTestSetService', () => {
  let svc: MapTestSetService;
  let testFindOne: jest.Mock;
  let testCreate: jest.Mock;
  let testSave: jest.Mock;
  let testUpdate: jest.Mock;
  let testDelete: jest.Mock;
  let testQb: { where: jest.Mock; andWhere: jest.Mock; orderBy: jest.Mock; getMany: jest.Mock };
  let itemFind: jest.Mock;
  let itemDelete: jest.Mock;
  let bankFind: jest.Mock;
  let txDelete: jest.Mock;
  let txCreate: jest.Mock;
  let txSave: jest.Mock;
  let txUpdate: jest.Mock;
  let transactionFn: jest.Mock;

  beforeEach(async () => {
    testFindOne = jest.fn();
    testCreate = jest.fn((row) => row);
    testSave = jest.fn((row) => Promise.resolve({ id: 'mts-new', ...row }));
    testUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    testDelete = jest.fn().mockResolvedValue({ affected: 1 });
    testQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    itemFind = jest.fn().mockResolvedValue([]);
    itemDelete = jest.fn().mockResolvedValue({ affected: 0 });
    bankFind = jest.fn();
    txDelete = jest.fn();
    txCreate = jest.fn((_e, row) => row);
    txSave = jest.fn((row) => Promise.resolve(row));
    txUpdate = jest.fn();
    transactionFn = jest.fn(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        delete: txDelete,
        create: txCreate,
        save: txSave,
        update: txUpdate,
      });
    });

    const mod = await Test.createTestingModule({
      providers: [
        MapTestSetService,
        {
          provide: getRepositoryToken(MapTestSetTypeormEntity, ACM_DS),
          useValue: {
            findOne: testFindOne,
            create: testCreate,
            save: testSave,
            update: testUpdate,
            delete: testDelete,
            createQueryBuilder: jest.fn(() => testQb),
            manager: { connection: { transaction: transactionFn } },
          },
        },
        {
          provide: getRepositoryToken(MapTestSetItemTypeormEntity, ACM_DS),
          useValue: { find: itemFind, delete: itemDelete },
        },
        {
          provide: getRepositoryToken(MapItemTypeormEntity, ACM_DS),
          useValue: { find: bankFind },
        },
      ],
    }).compile();

    svc = mod.get(MapTestSetService);
  });

  it('findById throws NotFoundException when missing in tenant', async () => {
    testFindOne.mockResolvedValueOnce(null);
    await expect(svc.findById('ent-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(testFindOne).toHaveBeenCalledWith({
      where: { entId: 'ent-1', id: 'missing' },
    });
  });

  it('create defaults FIXED/DRAFT/0pt', async () => {
    testFindOne.mockResolvedValueOnce({ id: 'mts-new', entId: 'ent-1' });
    await svc.create({ entId: 'ent-1', name: 'Spring Diagnostic' });
    expect(testCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entId: 'ent-1',
        name: 'Spring Diagnostic',
        compositionMode: 'FIXED',
        status: 'DRAFT',
        totalPoints: 0,
      }),
    );
  });

  it('syncItems throws when a referenced item id is missing from the bank', async () => {
    testFindOne.mockResolvedValueOnce({ id: 'mts-new', entId: 'ent-1' });
    // bank returns only 1 of 2 requested ids
    bankFind.mockResolvedValueOnce([
      { id: 'i1', points: 3, domain: 'RC', gradeLevel: 'G2', difficulty: 'BASIC',
        itemType: 'SINGLE', stem: '', options: [], answerKeys: [], version: 1, status: 'PUBLISHED' },
    ]);

    await expect(
      svc.create({
        entId: 'ent-1',
        name: 'T',
        items: [{ itemId: 'i1' }, { itemId: 'i2' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('syncItems captures per-item snapshot + recomputes totalPoints in tx', async () => {
    // initial save returns the new row; subsequent findById for the return.
    testFindOne.mockResolvedValueOnce({ id: 'mts-new', entId: 'ent-1' });
    bankFind.mockResolvedValueOnce([
      { id: 'i1', points: 3, version: 1, domain: 'RC', gradeLevel: 'G2',
        difficulty: 'BASIC', itemType: 'SINGLE', stem: 'q1', options: ['A','B'],
        answerKeys: [0], status: 'PUBLISHED' },
      { id: 'i2', points: 5, version: 2, domain: 'MATH', gradeLevel: 'G3',
        difficulty: 'INTERMEDIATE', itemType: 'SINGLE', stem: 'q2', options: ['A','B'],
        answerKeys: [1], status: 'PUBLISHED' },
    ]);

    await svc.create({
      entId: 'ent-1',
      name: 'T',
      items: [{ itemId: 'i1' }, { itemId: 'i2', ordinal: 7 }],
    });

    // delete existing items in tx
    expect(txDelete).toHaveBeenCalledWith(
      MapTestSetItemTypeormEntity,
      { testSetId: 'mts-new' },
    );
    // 2 saves with snapshots
    expect(txSave).toHaveBeenCalledTimes(2);
    expect(txSave).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        testSetId: 'mts-new',
        itemId: 'i1',
        ordinal: 1,
        itemVersionSnapshot: expect.objectContaining({
          itemId: 'i1', points: 3, version: 1, status: 'PUBLISHED',
        }),
      }),
    );
    expect(txSave).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        itemId: 'i2',
        ordinal: 7,
        itemVersionSnapshot: expect.objectContaining({ itemId: 'i2', points: 5 }),
      }),
    );
    // totalPoints = 3 + 5
    expect(txUpdate).toHaveBeenCalledWith(
      MapTestSetTypeormEntity,
      { id: 'mts-new' },
      { totalPoints: 8 },
    );
  });

  it('empty items list zeros totalPoints without running the tx', async () => {
    // update() does: findById → save (no-op patch) → syncItems → findById return
    testFindOne
      .mockResolvedValueOnce({ id: 'mts-1', entId: 'ent-1' })
      .mockResolvedValueOnce({ id: 'mts-1', entId: 'ent-1' });

    await svc.update('ent-1', 'mts-1', { items: [] });

    expect(itemDelete).toHaveBeenCalledWith({ testSetId: 'mts-1' });
    expect(testUpdate).toHaveBeenCalledWith(
      { id: 'mts-1' },
      { totalPoints: 0 },
    );
    expect(transactionFn).not.toHaveBeenCalled();
  });

  it('delete gates on tenant-scoped findById', async () => {
    testFindOne.mockResolvedValueOnce(null);
    await expect(svc.delete('ent-1', 'mts-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(testDelete).not.toHaveBeenCalled();
  });
});
