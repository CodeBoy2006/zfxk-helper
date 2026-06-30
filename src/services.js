import { buildContextRequest } from './context.js';
import { endpoints } from './endpoints.js';
import { mapCourse, mapSelectionSnapshot, mapTeachingClass } from './mappers.js';
import { normalizeConflictCheck, normalizeDropSelection, normalizeSaveSelection, normalizeTitleCheck } from './normalizers.js';
import { asArray, bool, compact, firstDefined, joinCsv, number } from './utils.js';

export class CatalogService {
  constructor(client) {
    this.client = client;
  }

  async searchCourses(query = {}) {
    const context = this.client.requireContext();
    const page = query.page ?? {};
    const start = page.start ?? 1;
    const size = page.size ?? 20;
    const filters = query.filters ?? {};
    const response = await this.client.transport.post(
      endpoints.coursePage,
      buildContextRequest(context, {
        searchInput: query.keyword,
        kspage: start,
        jspage: size,
        yl_list: filters.hasCapacity === undefined ? undefined : filters.hasCapacity ? '1' : '0',
        tjbj_list: filters.recommended === undefined ? undefined : filters.recommended ? '1' : '0',
        cxbj_list: filters.retake === undefined ? undefined : filters.retake ? '1' : '0',
        ...(query.extra ?? {})
      })
    );

    if (response === 0 || response === '0') throw new Error('Illegal access while loading course page.');
    if (response?.flag === '0') throw new Error(response.msg ?? 'Course search failed.');
    return asArray(response?.tmpList ?? response).map(mapCourse);
  }

  async getTeachingClasses(courseId, query = {}) {
    const context = this.client.requireContext();
    const response = await this.client.transport.post(
      endpoints.teachingClasses,
      buildContextRequest(context, {
        kch_id: courseId,
        cxbj: query.retake,
        fxbj: query.auxiliary,
        ...(query.extra ?? {})
      })
    );
    if (response === '0' || response === 0) throw new Error('Illegal access while loading teaching classes.');
    return asArray(response).map((row) => mapTeachingClass({ ...row, kch_id: firstDefined(row.kch_id, courseId) }));
  }
}

export class ChosenService {
  constructor(client) {
    this.client = client;
  }

  async snapshot() {
    const context = this.client.requireContext();
    const rows = await this.client.transport.post(
      endpoints.chosenDisplay,
      compact({
        jg_id: context.student.jgId,
        zyh_id: context.student.zyhId,
        njdm_id: context.student.njdmId,
        zyfx_id: context.student.zyfxId,
        bh_id: context.student.bhId,
        xz: context.student.xz,
        ccdm: context.student.ccdm,
        xqh_id: context.student.campusId,
        xkxnm: context.term.xkxnm,
        xkxqm: context.term.xkxqm,
        xkly: context.raw.xkly
      })
    );
    return mapSelectionSnapshot(asArray(rows));
  }

  async listSelected() {
    return (await this.snapshot()).selectedClasses;
  }

  async hasSelected(input = {}) {
    const snapshot = await this.snapshot();
    if (input.classId && snapshot.byClassId.has(input.classId)) return true;
    if (input.courseId && snapshot.byCourseId.has(input.courseId)) return true;
    return false;
  }
}

export class SelectionService {
  constructor(client) {
    this.client = client;
  }

  async choose(input, policy = {}) {
    const context = this.client.requireContext();
    const target = await this.resolveTeachingClass(input);
    const localBlock = this.localPrecheck(target);
    if (localBlock) return localBlock;

    if (this.client.mode === 'dry-run') {
      return { status: 'planned', plan: await this.plan(input, target) };
    }

    for (const bj of this.titleChecksFor(target)) {
      const result = await this.runTitleCheck(context, target, bj, policy);
      if (result) return result;
    }

    const prepared = await this.prepareSelection(context, target, policy);
    if (prepared.status) return prepared;

    const conflict = await this.runConflictCheck(context, prepared, policy);
    if (conflict) return conflict;

    const textbookIds = await this.resolveTextbooks(context, prepared, policy);
    if (textbookIds.status) return textbookIds;

    const saveResponse = await this.client.transport.post(this.client.functionPath(endpoints.saveSelection), this.savePayload(context, prepared, textbookIds));
    const saveResult = normalizeSaveSelection(saveResponse);
    if (!saveResult.ok) {
      if (saveResult.code === 'CAPACITY_FULL') {
        return {
          status: 'capacity-full',
          waitlistAvailable: true,
          messages: messageList(saveResult)
        };
      }
      return { status: 'rejected', reason: saveResult.code, messages: messageList(saveResult) };
    }

    const snapshot = await this.client.chosen.snapshot();
    const selected = snapshot.byClassId.get(target.classId) ?? snapshot.byClassId.get(target.submitClassId);
    return {
      status: selected?.selectedBySystem === false ? 'pending-filter' : 'selected',
      selection: selected,
      snapshot,
      messages: messageList(saveResult)
    };
  }

  async drop(input, policy = {}) {
    const context = this.client.requireContext();
    const localBlock = this.localDropPrecheck(input);
    if (localBlock) return localBlock;

    const submitClassId = input.submitClassId ?? input.doJxbId ?? input.classId;
    const controlId = input.controlId ?? context.current.xkkzId;

    if (number(context.raw.tkzgcs_jb) > 0 || number(context.raw.tkzgcs_qt) > 0) {
      const check = await this.client.transport.post(endpoints.cancelTitleCheck, {
        xkkz_id: controlId,
        jxb_id: submitClassId,
        bj: '10'
      });
      const flag = String(check?.flag ?? check);
      if (flag === '1') {
        const confirmed = await confirm(policy, { kind: 'drop-title-check', message: check.msg ?? '', raw: check });
        if (!confirmed) return { status: 'rejected', reason: 'USER_CANCELLED' };
      } else if (flag === '3') {
        // continue
      } else {
        return { status: 'rejected', reason: flag === '-1' ? 'SESSION_EXPIRED' : 'REJECTED', message: check?.msg };
      }
    } else {
      const confirmed = await confirm(policy, { kind: 'drop-confirm', message: 'Confirm drop.', raw: null });
      if (!confirmed) return { status: 'rejected', reason: 'USER_CANCELLED' };
    }

    if (number(context.raw.tkdxyzms) > 0) {
      const inTime = await this.client.transport.post(endpoints.cancelInTimeCheck, {
        xkkz_id: controlId,
        jxb_id: submitClassId,
        xnm: context.term.xkxnm,
        xqm: context.term.xkxqm
      });
      if (String(inTime) === '0') {
        return { status: 'already-dropped', snapshot: await this.client.chosen.snapshot() };
      }
      if (String(inTime) !== '1') {
        return { status: 'rejected', reason: 'REJECTED', message: String(inTime) };
      }
      if (!policy.smsCode) return { status: 'sms-failed', message: 'SMS code required.' };
      const code = await policy.smsCode({ classId: input.classId, submitClassId, raw: inTime });
      const sms = await this.client.transport.post(endpoints.smsVerify, { jxb_id: submitClassId, dxyzm: code });
      if (String(sms) === '2') return { status: 'sms-failed', message: 'SMS code is incorrect.' };
      if (String(sms) === '3') return { status: 'sms-failed', message: 'SMS code expired.' };
    }

    const drop = normalizeDropSelection(
      await this.client.transport.post(endpoints.dropSelection, {
        kch_id: input.courseId,
        jxb_ids: submitClassId,
        xkxnm: context.term.xkxnm,
        xkxqm: context.term.xkxqm,
        txbsfrl: context.raw.txbsfrl
      })
    );
    if (!drop.ok) return { status: 'rejected', reason: drop.code, message: drop.message };
    return { status: 'dropped', snapshot: await this.client.chosen.snapshot() };
  }

  async quickSelect(input = {}) {
    const context = this.client.requireContext();
    const result = await this.client.transport.post(endpoints.quickSelect, {
      xkkz_id: input.controlId ?? context.current.xkkzId
    });
    if (result?.flag === '0') return { status: 'rejected', reason: 'REJECTED', message: result.msg };
    return { status: 'selected', snapshot: await this.client.chosen.snapshot(), raw: result };
  }

  async reorder(input) {
    const classIds = input.classIds ?? [];
    const zypxs = classIds.map((_, index) => index + 1);
    const result = await this.client.transport.post(endpoints.saveOrder, {
      zypxs: zypxs.join(','),
      jxb_ids: classIds.join(',')
    });
    if (result !== 'success') {
      throw new Error(result === 'no-permission' ? 'No permission to reorder selected classes.' : 'Failed to save selected-class order.');
    }
    return this.client.chosen.snapshot();
  }

  async updateWeight(input) {
    const context = this.client.requireContext();
    const editable = await this.client.transport.post(endpoints.checkWeightEditable, {
      jxb_id: input.submitClassId ?? input.classId,
      xnm: context.term.xkxnm,
      xqm: context.term.xkxqm,
      xkkz_id: context.current.xkkzId
    });
    if (String(editable) !== '1') throw new Error(`Weight is not editable: ${editable}`);
    const saved = await this.client.transport.post(endpoints.saveWeight, {
      jxb_id: input.submitClassId ?? input.classId,
      qz: input.weight
    });
    if (String(saved) !== '1') throw new Error(`Failed to save weight: ${saved}`);
    return this.client.chosen.snapshot();
  }

  async plan(input, resolvedTarget) {
    const target = resolvedTarget ?? await this.resolveTeachingClass(input);
    const blockers = [];
    if (!target.flags.canSelect) blockers.push({ code: 'REJECTED', message: 'Teaching class is not selectable.' });
    return {
      target,
      estimatedMode: target.childClassCount > 1 ? 'child-classes' : this.client.context.switches.useWeight ? 'weighted' : 'normal',
      steps: [
        { name: 'local-precheck', required: true },
        { name: 'title-check', endpoint: endpoints.titleCheck, required: true },
        { name: 'conflict-check', endpoint: endpoints.conflictCheck, required: shouldRunConflictCheck(this.client.context) },
        { name: 'textbook-check', endpoint: endpoints.textbookCheck, required: this.client.context.switches.enableTextbook },
        { name: 'save', endpoint: endpoints.saveSelection, required: true }
      ],
      blockers
    };
  }

  async resolveTeachingClass(input) {
    if (input.teachingClass) return input.teachingClass;
    const classes = await this.client.catalog.getTeachingClasses(input.courseId, input.query);
    const found = classes.find((item) => item.classId === input.classId || item.submitClassId === input.classId);
    if (!found) throw new Error(`Teaching class not found: ${input.classId}`);
    return found;
  }

  localPrecheck(target) {
    if (!target.flags.canSelect) {
      return { status: 'rejected', reason: 'REJECTED', messages: [{ code: 'REJECTED', message: 'Teaching class is not selectable.' }] };
    }
    return null;
  }

  localDropPrecheck(input = {}) {
    const source = input.selection ?? input.selectedClass ?? input;
    if (source.canDrop !== false) return null;
    const dropRestriction = source.dropRestriction ?? {
      code: 'NOT_DROPPABLE',
      message: 'Selected class is not droppable.'
    };
    return {
      status: 'rejected',
      reason: 'NOT_DROPPABLE',
      message: dropRestriction.message,
      dropRestriction
    };
  }

  titleChecksFor(target) {
    const context = this.client.context;
    const checks = [];
    if (bool(context.raw.xxkbkztskg) && target.raw.xxkbj === '1') checks.push('2');
    if (context.raw.xxdm === '12792' && context.current.kklxdm === '10') checks.push('5');
    checks.push('7');
    if (bool(context.raw.xkpksjctqrkg)) checks.push('9');
    return checks;
  }

  async runTitleCheck(context, target, bj, policy) {
    const result = normalizeTitleCheck(
      await this.client.transport.post(endpoints.titleCheck, {
        jxb_ids: target.submitClassId,
        xkxnm: context.term.xkxnm,
        xkxqm: context.term.xkxqm,
        bj,
        kch_id: target.courseId,
        njdm_id: context.student.njdmId,
        zyh_id: context.student.zyhId,
        kklxdm: context.current.kklxdm
      })
    );
    if (result.ok) return null;
    if (result.code === 'CONFIRM_REQUIRED') {
      const confirmed = await confirm(policy, { kind: 'title-check', bj, message: result.message, raw: result.raw });
      return confirmed ? null : { status: 'rejected', reason: 'USER_CANCELLED', messages: messageList(result) };
    }
    return { status: 'rejected', reason: result.code, messages: messageList(result) };
  }

  async prepareSelection(context, target, policy) {
    if (target.childClassCount > 1) {
      if (!policy.chooseChildClasses) {
        return { status: 'rejected', reason: 'CHILD_CLASSES_REQUIRED', messages: [{ code: 'CHILD_CLASSES_REQUIRED', message: 'Child teaching classes must be selected.' }] };
      }
      const childClassIds = await policy.chooseChildClasses({ target, context });
      return { target, qz: '0', classIds: asArray(childClassIds) };
    }

    if (context.switches.useWeight) {
      if (!policy.chooseWeight) {
        return { status: 'rejected', reason: 'WEIGHT_REQUIRED', messages: [{ code: 'WEIGHT_REQUIRED', message: 'Weight is required for this selection mode.' }] };
      }
      const qz = await policy.chooseWeight({ target, context });
      return { target, qz: String(qz), classIds: [target.submitClassId] };
    }

    return { target, qz: '0', classIds: [target.submitClassId] };
  }

  async runConflictCheck(context, prepared, policy) {
    if (!shouldRunConflictCheck(context)) return null;
    const result = normalizeConflictCheck(
      await this.client.transport.post(endpoints.conflictCheck, {
        jxb_ids: joinCsv(prepared.classIds),
        xkxnm: context.term.xkxnm,
        xkxqm: context.term.xkxqm,
        kch_id: prepared.target.courseId,
        sfyxsksjct: context.raw.sfyxsksjct
      })
    );
    if (result.ok) return null;
    if (result.code === 'LISTENER_APPLY_REQUIRED') {
      return { status: 'requires-listener-apply', messages: messageList(result) };
    }
    if (result.code === 'CONFIRM_REQUIRED') {
      const confirmed = await confirm(policy, { kind: 'conflict-check', message: result.message, raw: result.raw });
      return confirmed ? null : { status: 'rejected', reason: 'USER_CANCELLED', messages: messageList(result) };
    }
    return { status: 'rejected', reason: result.code, messages: messageList(result) };
  }

  async resolveTextbooks(context, prepared, policy) {
    if (!context.switches.enableTextbook) return [];
    const result = await this.client.transport.post(endpoints.textbookCheck, {
      jxb_id: prepared.target.classId,
      xkkz_id: context.current.xkkzId
    });
    if (String(result) !== '1') return [];
    if (!policy.chooseTextbooks) {
      return { status: 'rejected', reason: 'TEXTBOOK_REQUIRED', messages: [{ code: 'TEXTBOOK_REQUIRED', message: 'Textbook selection is required.' }] };
    }
    return asArray(await policy.chooseTextbooks({ target: prepared.target, context, requiredItems: [] }));
  }

  savePayload(context, prepared, textbookIds) {
    const target = prepared.target;
    const capacityControl = bool(context.raw.rlkz) || bool(context.raw.cdrlkz) || bool(context.raw.rlzlkz);
    return buildContextRequest(context, {
      jxb_ids: joinCsv(prepared.classIds),
      kch_id: target.courseId,
      kcmc: target.raw.kcmc ?? target.name,
      rwlx: context.raw.rwlx,
      rlkz: context.raw.rlkz,
      cdrlkz: context.raw.cdrlkz,
      rlzlkz: context.raw.rlzlkz,
      sxbj: capacityControl ? '1' : '0',
      xxkbj: target.raw.xxkbj,
      qz: prepared.qz,
      cxbj: target.raw.cxbj,
      jcxx_id: joinCsv(textbookIds)
    });
  }
}

export class TextbookService {
  constructor(client) {
    this.client = client;
  }

  async order(input) {
    return this.update(input.classId, '1', input.reason);
  }

  async cancel(input) {
    return this.update(input.classId, '0', input.reason);
  }

  async update(classId, sfydjc, reason) {
    const context = this.client.requireContext();
    const result = await this.client.transport.post(endpoints.textbookUpdate, {
      jxb_id: classId,
      sfydjc,
      tdyy: reason,
      xkxnm: context.term.xkxnm,
      xkxqm: context.term.xkxqm
    });
    return { ok: result?.flag === '1', message: result?.msg, raw: result };
  }
}

export class WaitlistService {
  constructor(client) {
    this.client = client;
  }

  async join(input) {
    const context = this.client.requireContext();
    const result = await this.client.transport.post(endpoints.waitlistAdd, {
      xkxnm: context.term.xkxnm,
      xkxqm: context.term.xkxqm,
      kch_id: input.courseId,
      jxb_id: input.classId,
      kklxdm: context.current.kklxdm
    });
    return { ok: String(result) === '1', raw: result };
  }

  async leave(input) {
    const context = this.client.requireContext();
    const result = await this.client.transport.post(endpoints.waitlistRemove, {
      xkxnm: context.term.xkxnm,
      xkxqm: context.term.xkxqm,
      kch_id: input.courseId
    });
    return { ok: String(result) === '1', raw: result };
  }
}

export class ListenerService {
  constructor(client) {
    this.client = client;
  }

  async apply(input) {
    const context = this.client.requireContext();
    const result = await this.client.transport.post(endpoints.listenerAdd, {
      xnm: context.term.xkxnm,
      xqm: context.term.xkxqm,
      jxxmlbdm: '1055',
      'bmqkbList[0].kch_id': input.courseId,
      'bmqkbList[0].jxb_id': input.classId,
      ctjxb_id: joinCsv(input.conflictClassIds ?? [])
    });
    return { ok: String(result).includes('成功'), raw: result };
  }

  async cancel(input) {
    const result = await this.client.transport.post(endpoints.listenerRemove, {
      xsbmxq_id: input.applicationId
    });
    return { ok: String(result).includes('成功'), raw: result };
  }
}

function shouldRunConflictCheck(context) {
  return bool(context.raw.sfyxsksjct) || bool(context.raw.tbtkxqxktskg) || bool(context.raw.xkwkxkcqjtsqkg);
}

async function confirm(policy, event) {
  if (!policy.confirm) return false;
  return Boolean(await policy.confirm(event));
}

function messageList(result) {
  return result.message ? [{ code: result.code ?? result.status, message: result.message, raw: result.raw }] : [];
}
