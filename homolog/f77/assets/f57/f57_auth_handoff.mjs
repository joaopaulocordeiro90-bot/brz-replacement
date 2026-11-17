/** F57 authentication bridge contract: no token or trade payload enters this report. */
export function assertF57ReadOnlyHandoff(receipt) {
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))
    throw new Error('F57_READ_ONLY_RECEIPT_MISSING');
  if(receipt.verified!==true||receipt.readOnly!==true||receipt.writeActions!==0||
    receipt.readRows!==4011||!['mesa','admin'].includes(receipt.role))
    throw new Error('F57_READ_ONLY_SESSION_UNVERIFIED');
  if(Object.hasOwn(receipt,'token')||Object.hasOwn(receipt,'access_token')||
    Object.hasOwn(receipt,'records')||Object.hasOwn(receipt,'trades'))
    throw new Error('F57_READ_ONLY_RECEIPT_NOT_MINIMAL');
  return Object.freeze({status:'READ_ONLY',verified:true,readRows:4011,writesPermitted:false});
}
