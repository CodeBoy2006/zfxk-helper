import { bool, compact, firstDefined } from './utils.js';

const REQUEST_RAW_KEYS = [
  'rwlx',
  'xklc',
  'xkly',
  'bklx_id',
  'sfkkjyxdxnxq',
  'kzkcgs',
  'xqh_id',
  'jg_id',
  'jg_id_1',
  'njdm_id_1',
  'zyh_id_1',
  'gnjkxdnj',
  'zyh_id',
  'zyfx_id',
  'njdm_id',
  'bh_id',
  'bjgkczxbbjwcx',
  'xbm',
  'xslbdm',
  'mzm',
  'xz',
  'ccdm',
  'xsbj',
  'sfkknj',
  'sfkkzy',
  'kzybkxy',
  'sfznkx',
  'zdkxms',
  'sfkxq',
  'bhbcyxkjxb',
  'sfkcfx',
  'kkbk',
  'kkbkdj',
  'bklbkcj',
  'sfkgbcx',
  'sfrxtgkcxd',
  'xkkz_xh',
  'tykczgxdcs',
  'xkxnm',
  'xkxqm',
  'kklxdm',
  'bbhzxjxb',
  'zxgbxkkg',
  'xkkz_id',
  'rlkz',
  'cdrlkz',
  'rlzlkz',
  'xkzgbj',
  'jxbzb',
  'zh',
  'jxbzcxskg',
  'cxcykclxxskg'
];

export function extractHiddenFields(html = '') {
  const raw = {};
  const inputPattern = /<input\b[^>]*>/gi;
  for (const [tag] of html.matchAll(inputPattern)) {
    const key = readAttribute(tag, 'id') ?? readAttribute(tag, 'name');
    if (!key) continue;
    raw[key] = readAttribute(tag, 'value') ?? '';
  }
  return raw;
}

export function loadRuntimeContext(input = {}) {
  const existing = input.context?.raw ?? {};
  const raw = {
    ...extractHiddenFields(input.html),
    ...existing,
    ...(input.raw ?? {})
  };
  const baseUrl = String(input.baseUrl ?? input.context?.baseUrl ?? '').replace(/\/$/, '');

  return {
    baseUrl,
    term: {
      xkxnm: raw.xkxnm ?? input.context?.term?.xkxnm ?? '',
      xkxqm: raw.xkxqm ?? input.context?.term?.xkxqm ?? ''
    },
    student: {
      xhId: firstDefined(raw.xh_id, raw.xhId, input.context?.student?.xhId),
      jgId: firstDefined(raw.jg_id_1, raw.jg_id, input.context?.student?.jgId),
      zyhId: firstDefined(raw.zyh_id, raw.firstZyhId, input.context?.student?.zyhId, ''),
      njdmId: firstDefined(raw.njdm_id, raw.firstNjdmId, input.context?.student?.njdmId, ''),
      zyfxId: firstDefined(raw.zyfx_id, input.context?.student?.zyfxId),
      bhId: firstDefined(raw.bh_id, input.context?.student?.bhId),
      xz: firstDefined(raw.xz, input.context?.student?.xz),
      ccdm: firstDefined(raw.ccdm, input.context?.student?.ccdm),
      campusId: firstDefined(raw.xqh_id, input.context?.student?.campusId)
    },
    current: {
      xkkzId: firstDefined(raw.xkkz_id, raw.firstXkkzId, input.context?.current?.xkkzId, ''),
      kklxdm: firstDefined(raw.kklxdm, raw.firstKklxdm, input.context?.current?.kklxdm, ''),
      kklxmc: firstDefined(raw.kklxmc, raw.firstKklxmc, input.context?.current?.kklxmc),
      xklc: firstDefined(raw.xklc, input.context?.current?.xklc),
      xkkzXh: firstDefined(raw.xkkz_xh, raw.firstXkkzXh, input.context?.current?.xkkzXh)
    },
    switches: {
      isInSelectionTime: bool(firstDefined(raw.isinxksj, input.context?.switches?.isInSelectionTime)),
      canSelect: bool(firstDefined(raw.iskxk, input.context?.switches?.canSelect)),
      canDrop: firstDefined(raw.sfktk, input.context?.switches?.canDrop) !== '0',
      useWeight: bool(firstDefined(raw.sfqzxk, input.context?.switches?.useWeight)),
      enableTextbook: bool(raw.xksdxjckg) && (raw.xkydjc === undefined || bool(raw.xkydjc)),
      enableWaitlist: bool(firstDefined(raw.zzxkwylksqxkyxkg, input.context?.switches?.enableWaitlist)),
      enableListenerApply: bool(firstDefined(raw.xkwkxkcqjtsqkg, input.context?.switches?.enableListenerApply))
    },
    raw
  };
}

export function buildContextRequest(context, overrides = {}, keys = REQUEST_RAW_KEYS) {
  const rawData = {};
  for (const key of keys) {
    if (context.raw[key] !== undefined) rawData[key === 'jg_id_1' ? 'jg_id' : key] = context.raw[key];
  }

  return compact({
    ...rawData,
    xkxnm: context.term.xkxnm,
    xkxqm: context.term.xkxqm,
    xkkz_id: context.current.xkkzId,
    kklxdm: context.current.kklxdm,
    xklc: context.current.xklc,
    xkkz_xh: context.current.xkkzXh,
    zyh_id: context.student.zyhId,
    njdm_id: context.student.njdmId,
    zyfx_id: context.student.zyfxId,
    bh_id: context.student.bhId,
    xz: context.student.xz,
    ccdm: context.student.ccdm,
    xqh_id: context.student.campusId,
    ...overrides
  });
}

function readAttribute(tag, name) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}
