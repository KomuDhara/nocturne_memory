import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

// Handle URI encoding for resource IDs which might contain special chars
const encodeId = (id) => encodeURIComponent(id);

export const getSessions = () => api.get('/review/sessions').then(res => res.data);

export const getSnapshots = (sessionId) => 
  api.get(`/review/sessions/${sessionId}/snapshots`).then(res => res.data);

export const getDiff = (sessionId, resourceId) => 
  api.get(`/review/sessions/${sessionId}/diff/${encodeId(resourceId)}`).then(res => res.data);

export const rollbackResource = (sessionId, resourceId) => 
  api.post(`/review/sessions/${sessionId}/rollback/${encodeId(resourceId)}`, {}).then(res => res.data);

export const approveSnapshot = (sessionId, resourceId) => 
  api.delete(`/review/sessions/${sessionId}/snapshots/${encodeId(resourceId)}`).then(res => res.data);

export const clearSession = (sessionId) => 
  api.delete(`/review/sessions/${sessionId}`).then(res => res.data);

export const getCatalog = () => api.get('/catalog').then(res => res.data);

export const getRelationDetail = (viewerId, targetId) => 
  api.get(`/catalog/relation/${encodeId(viewerId)}/${encodeId(targetId)}`).then(res => res.data);

export const getEntityInfo = (entityId) =>
  api.get(`/nodes/entities/${encodeId(entityId)}`, {
    params: { include_basic: true, include_history: true, include_edges: true, include_children: true }
  }).then(res => res.data);

export const getState = (stateId) => 
  api.get(`/nodes/states/${encodeId(stateId)}`).then(res => res.data);

export const deleteState = (stateId) =>
  api.delete(`/nodes/states/${encodeId(stateId)}`).then(res => res.data);

export const deleteEntity = (entityId) =>
  api.delete(`/nodes/entities/${encodeId(entityId)}`).then(res => res.data);

export const deleteDirectEdge = (viewerId, targetId) =>
  api.delete(`/edges/direct/${encodeId(viewerId)}/${encodeId(targetId)}`).then(res => res.data);

export const deleteRelayEdge = (edgeId) =>
  api.delete(`/edges/relay/${encodeId(edgeId)}`).then(res => res.data);

export const getChapter = (viewerId, targetId, chapterName) =>
  api.get(`/edges/relay/${encodeId(viewerId)}/${encodeId(targetId)}/${encodeId(chapterName)}`).then(res => res.data);

// Maintenance endpoints
export const getOrphanStates = (mode = 'in_zero', limit = 100) =>
  api.get('/nodes/maintenance/orphan_states', { params: { mode, limit } }).then(res => res.data);

export const deleteStatesBatch = (stateIds) =>
  api.post('/nodes/maintenance/delete_states', { state_ids: stateIds }).then(res => res.data);

export const getOrphanEntities = (limit = 100) =>
  api.get('/nodes/maintenance/orphan_entities', { params: { limit } }).then(res => res.data);

export const deleteEntitiesBatch = (entityIds) =>
  api.post('/nodes/maintenance/delete_entities', { entity_ids: entityIds }).then(res => res.data);

// Edit endpoints (Salem frontend)
export const updateEntity = (entityId, newContent, newName = null, taskDescription = null) =>
  api.post(`/nodes/entities/${encodeId(entityId)}/update`, {
    new_content: newContent,
    new_name: newName,
    task_description: taskDescription || 'Salem edited via frontend'
  }).then(res => res.data);

export const updateDirectEdge = (viewerId, targetId, newContent, newRelation = null, taskDescription = null) =>
  api.put(`/edges/direct/${encodeId(viewerId)}/${encodeId(targetId)}`, {
    new_content: newContent,
    new_relation: newRelation,
    task_description: taskDescription || 'Salem edited via frontend'
  }).then(res => res.data);

export const updateChapter = (viewerId, targetId, chapterName, newContent, taskDescription = null) =>
  api.put(`/edges/chapter/${encodeId(viewerId)}/${encodeId(targetId)}/${encodeId(chapterName)}`, {
    new_content: newContent,
    task_description: taskDescription || 'Salem edited via frontend'
  }).then(res => res.data);

// Parent-Child relationship endpoints
export const linkParent = (childId, parentId) =>
  api.post('/nodes/parent-child/link', {
    child_id: childId,
    parent_id: parentId
  }).then(res => res.data);

export const unlinkParent = (childId, parentId) =>
  api.post('/nodes/parent-child/unlink', {
    child_id: childId,
    parent_id: parentId
  }).then(res => res.data);
