import { parentExtraFields } from './parent.service';

describe('parentExtraFields (REQ-261112)', () => {
  it('leaves untouched fields out', () => {
    expect(parentExtraFields({})).toEqual({});
  });

  it('trims values and maps empty strings to null', () => {
    expect(
      parentExtraFields({
        parCountryCode: ' +84 ',
        parMessengerType: 'ZALO',
        parMessengerId: ' zalo.id ',
        parMemo: '  ',
      }),
    ).toEqual({ countryCode: '+84', messengerType: 'ZALO', messengerId: 'zalo.id', memo: null });
  });

  it('clears messenger id when messenger type is cleared', () => {
    expect(parentExtraFields({ parMessengerType: '', parMessengerId: 'kakao1' })).toEqual({
      messengerType: null,
      messengerId: null,
    });
  });
});
