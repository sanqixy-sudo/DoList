import { ipcMain } from 'electron';
import { normalizeTimestamp, validDay } from '../../../types/validation';
type Rule = (value: any) => void;
const string = (max: number, nonempty = false): Rule => value => {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) throw new Error('文本参数无效');
};
const id = string(200, true);
const bool: Rule = value => { if (typeof value !== 'boolean') throw new Error('布尔参数无效'); };
const integer: Rule = value => { if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) throw new Error('数值参数无效'); };
const oneOf = (values: any[]): Rule => value => { if (!values.includes(value)) throw new Error('枚举参数无效'); };
const optional = (rule: Rule): Rule => value => { if (value !== undefined) rule(value); };
const nullable = (rule: Rule): Rule => value => { if (value !== null) rule(value); };
const array = (rule: Rule): Rule => value => { if (!Array.isArray(value) || value.length > 100000) throw new Error('数组参数无效'); value.forEach(rule); };
const object = (rules: Record<string, Rule>): Rule => value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('对象参数无效');
  if (Object.keys(value).some(key => !Object.hasOwn(rules, key))) throw new Error('包含不允许修改的字段');
  for (const [key, rule] of Object.entries(rules)) rule(value[key]);
};
const timestamp: Rule = value => { normalizeTimestamp(value); if (typeof value !== 'string') throw new Error('日期不能为空'); };
const planned: Rule = value => { if (!validDay(value)) throw new Error('计划日期无效'); };
const attachment = object({ sourcePath: string(32767,true), name:string(1024,true), fileSize:optional(integer), mimeType:optional(nullable(string(200))) });
const taskFields = { title:optional(string(10000,true)), notes:optional(nullable(string(1000000))), status:optional(oneOf(['todo','done','canceled'])), priority:optional(oneOf([0,1,2,3])), listId:optional(id), startDate:optional(nullable(timestamp)), dueDate:optional(nullable(timestamp)), plannedDate:optional(nullable(planned)), sortOrder:optional(integer), restoreCompletedAt:optional(timestamp) };
const projectFields = { name:optional(string(1000,true)),color:optional(nullable(string(100))),sortOrder:optional(integer) };
const rules: Record<string, Rule[]> = {
 'tasks:list':[optional(object({listId:optional(id),status:optional(oneOf(['todo','done','all'])),priority:optional(oneOf([0,1,2,3])),tagId:optional(id),dueDate:optional(oneOf(['today','week','month','overdue'])),search:optional(string(10000))}))],
 'tasks:create':[object({...taskFields,title:string(10000,true),listId:id,tags:optional(array(id)),attachments:optional(array(attachment))})],
 'tasks:update':[id,object(taskFields)], 'tasks:bulkUpdate':[array(id),object({plannedDate:taskFields.plannedDate,dueDate:taskFields.dueDate,listId:taskFields.listId,status:taskFields.status,priority:taskFields.priority})],
 'tasks:search':[string(10000)],'tasks:reorder':[array(id)],'tasks:trash':[array(id)],'tasks:restore':[array(id)],'tasks:purge':[array(id)],
 'tasks:get':[id],'tasks:delete':[id],'tasks:undo':[id],'tasks:addAttachment':[id,attachment],'tasks:removeAttachment':[id],
 'tasks:getAttachmentPreviewUrl':[string(32767,true)],'tasks:openAttachment':[string(32767,true)],
 'lists:create':[object({...projectFields,name:string(1000,true),groupId:optional(nullable(id))})],
 'lists:update':[id,object({...projectFields,groupId:optional(nullable(id)),isArchived:optional(bool)})],
 'projectGroups:create':[object({...projectFields,name:string(1000,true)})],'projectGroups:update':[id,object(projectFields)],
 'tags:create':[string(1000,true),optional(string(100))],'tags:update':[id,object({name:optional(string(1000,true)),color:optional(nullable(string(100)))})],
 'subtasks:create':[object({taskId:id,title:string(10000,true)})],
 'subtasks:update':[id,object({title:optional(string(10000,true)),isDone:optional(bool),sortOrder:optional(integer)})],
 'subtasks:reorder':[id,array(id)],
 'reminders:create':[object({taskId:id,remindAt:timestamp,method:optional(oneOf(['local']))})],
 'backup:restore':[id], 'app:setTheme':[oneOf(['light','dark','system'])], 'app:openExternal':[string(4096,true)], 'app:setAutoLaunch':[bool],
};
for (const prefix of ['lists','projectGroups','tags','subtasks','reminders']) {
  rules[prefix+':delete']=[id];
  if (['lists','projectGroups'].includes(prefix)) { rules[prefix+':get']=[id]; rules[prefix+':reorder']=[array(id)]; }
}
rules['subtasks:toggle']=[id];
export function validateIpcArgs(channel: string, args: any[]) {
  const expected = rules[channel] ?? [];
  if (args.length > expected.length) throw new Error('参数数量无效');
  expected.forEach((rule, index) => rule(args[index]));
}
export const safeIpc = {
 handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
   ipcMain.handle(channel, (event, ...args) => { validateIpcArgs(channel, args); return listener(event, ...args); });
 },
};
