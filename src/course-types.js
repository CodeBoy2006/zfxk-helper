import { extractHiddenFields } from './context.js';
import { firstDefined } from './utils.js';

export function parseCourseTypeOptions(input = {}) {
  const html = typeof input === 'string' ? input : input.html ?? '';
  const raw = {
    ...extractHiddenFields(html),
    ...((typeof input === 'string' ? undefined : input.raw) ?? {})
  };
  const options = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const [, attributes, content] of html.matchAll(anchorPattern)) {
    const onclick = readAttribute(attributes, 'onclick') ?? '';
    const call = onclick.match(/queryCourse\s*\(([\s\S]*?)\)/);
    if (!call) continue;

    const args = readQuotedArgs(call[1]);
    if (args.length < 5) continue;
    const [kklxdm, xkkzId, njdmId, zyhId, xkkzXh] = args.slice(-5);
    const label = cleanText(content) || readAttribute(attributes, 'title') || raw.firstKklxmc || raw.kklxmc || kklxdm;
    options.push({
      label,
      kklxdm,
      xkkzId,
      njdmId,
      zyhId,
      xkkzXh,
      active: matchesInitial(raw, { kklxdm, xkkzId, xkkzXh })
    });
  }

  const unique = dedupeOptions(options);
  if (unique.length) {
    if (!unique.some((option) => option.active)) unique[0].active = true;
    return unique;
  }

  const fallback = {
    label: firstDefined(raw.kklxmc, raw.firstKklxmc, '当前课程'),
    kklxdm: firstDefined(raw.kklxdm, raw.firstKklxdm, ''),
    xkkzId: firstDefined(raw.xkkz_id, raw.firstXkkzId, ''),
    njdmId: firstDefined(raw.njdm_id, raw.firstNjdmId, ''),
    zyhId: firstDefined(raw.zyh_id, raw.firstZyhId, ''),
    xkkzXh: firstDefined(raw.xkkz_xh, raw.firstXkkzXh, ''),
    active: true
  };
  return fallback.kklxdm || fallback.xkkzId ? [fallback] : [];
}

function matchesInitial(raw, option) {
  const kklxdm = firstDefined(raw.kklxdm, raw.firstKklxdm, '');
  const xkkzId = firstDefined(raw.xkkz_id, raw.firstXkkzId, '');
  const xkkzXh = firstDefined(raw.xkkz_xh, raw.firstXkkzXh, '');
  return Boolean(
    (option.kklxdm && option.kklxdm === kklxdm) ||
    (option.xkkzId && option.xkkzId === xkkzId) ||
    (option.xkkzXh && option.xkkzXh === xkkzXh)
  );
}

function dedupeOptions(options) {
  const seen = new Map();
  for (const option of options) {
    const key = [option.kklxdm, option.xkkzId, option.xkkzXh].join('::');
    if (!seen.has(key)) seen.set(key, option);
  }
  return [...seen.values()];
}

function readQuotedArgs(source) {
  return [...source.matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2] ?? '');
}

function readAttribute(source, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = source.match(pattern);
  return match?.[2] ?? match?.[3] ?? match?.[4];
}

function cleanText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeEntities(value) {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'");
}
