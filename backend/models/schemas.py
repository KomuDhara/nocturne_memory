from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class CreateNodeRequest(BaseModel):
    """新增节点请求"""
    entity_id: str = Field(..., description="节点唯一ID")
    node_type: str = Field(..., description="节点类型（character/location/faction/event/item/relationship）")
    name: str = Field(..., description="节点名称")
    content: str = Field(..., description="节点内容")
    task_description: Optional[str] = Field(None, description="创建任务描述")


class CreateNodeResponse(BaseModel):
    """新增节点响应"""
    entity_id: str
    state_id: str
    version: int


class UpdateNodeRequest(BaseModel):
    """更新节点请求"""
    new_content: str = Field(..., description="新的内容")
    new_name: Optional[str] = Field(None, description="新的名称（不提供则继承上一版本）")
    task_description: Optional[str] = Field(None, description="更新任务描述")


class UpdateNodeResponse(BaseModel):
    """更新节点响应"""
    entity_id: str
    old_version: int
    new_version: int
    state_id: str


class DeleteStateResponse(BaseModel):
    """删除State响应"""
    deleted_state_id: str
    entity_id: str
    new_current_version: Optional[int] = None


class DeleteEntityResponse(BaseModel):
    """删除Entity响应"""
    deleted_entity_id: str
    deleted_states: List[str]
    deleted_edges: int


class DiffRequest(BaseModel):
    """文本diff请求"""
    text_a: str = Field(..., description="旧文本")
    text_b: str = Field(..., description="新文本")


class DiffResponse(BaseModel):
    """文本diff响应"""
    diff_html: str = Field(..., description="HTML格式的diff")
    diff_unified: str = Field(..., description="unified格式的diff")
    summary: str = Field(..., description="变化摘要")


# ============ 边相关模型 ============

class CreateDirectEdgeRequest(BaseModel):
    """创建1跳边请求"""
    from_entity_id: str = Field(..., description="起始Entity节点ID")
    to_entity_id: str = Field(..., description="目标Entity节点ID")
    relation: str = Field(..., description="关系名称（自由命名）")
    content: str = Field(..., description="详细描述正文")
    inheritable: bool = Field(..., description="是否可被子节点继承")


class CreateDirectEdgeResponse(BaseModel):
    """创建1跳边响应"""
    edge_id: str
    from_state_id: str
    to_state_id: str
    from_entity_id: str
    to_entity_id: str
    relation: str
    created_at: str


class DeleteDirectEdgeResponse(BaseModel):
    """删除1跳边响应"""
    from_entity_id: str
    to_entity_id: str
    deleted_relay_edges: int = Field(..., description="同时删除的2跳边数量")


class CreateRelayEdgeRequest(BaseModel):
    """创建2跳边请求"""
    from_entity_id: str = Field(..., description="起始Entity节点ID")
    to_entity_id: str = Field(..., description="目标Entity节点ID")
    relation: str = Field(..., description="关系的某个方面（2跳边的relation）")
    content: str = Field(..., description="储存在中继节点中的内容")
    inheritable: bool = Field(..., description="是否可被子节点继承")
    parent_direct_edge_id: str = Field(..., description="依附的 DIRECT_EDGE ID")


class CreateRelayEdgeResponse(BaseModel):
    """创建2跳边响应"""
    edge_id: str
    from_state_id: str
    to_state_id: str
    relay_node_id: str
    relation: str
    created_at: str


class DeleteRelayEdgeResponse(BaseModel):
    """删除2跳边响应"""
    edge_id: str
    deleted: bool


# ============ 查询相关模型 ============

class GetStateResponse(BaseModel):
    """获取State节点响应"""
    state_id: str
    entity_id: str
    version: int
    name: str
    content: str
    created_at: str
    task_description: Optional[str] = None
    in_count: int = Field(0, description="入边数量")
    out_count: int = Field(0, description="出边数量")


class EntityStateItem(BaseModel):
    """Entity的单个State信息"""
    state_id: str
    version: int
    created_at: str
    task_description: Optional[str] = None


class OutboundEdgeItem(BaseModel):
    """Entity的单个出边信息"""
    target_entity_id: str
    target_name: str
    relation: str
    content_snippet: str
    inheritable: bool
    viewer_version: int
    target_version: int
    relay_count: int


class GetEntityInfoResponse(BaseModel):
    """获取Entity整合信息响应"""
    entity_id: str
    basic: Optional[GetStateResponse] = None
    history: Optional[List[EntityStateItem]] = None
    edges: Optional[List[OutboundEdgeItem]] = None
    # 子节点列表：每个元素就是该子 Entity 的 CURRENT State 结构
    children: Optional[List[GetStateResponse]] = None


# ============ 探索相关模型 (Exploration) ============

class SearchRequest(BaseModel):
    """搜索请求"""
    query: str = Field(..., description="搜索关键词")
    node_types: Optional[List[str]] = Field(None, description="节点类型过滤")
    limit: int = Field(10, description="返回数量限制")


class SearchResultItem(BaseModel):
    """搜索结果项"""
    resource_id: str
    name: str
    node_type: str
    match_snippet: Optional[str] = None
    score: float


class SearchResponse(BaseModel):
    """搜索响应"""
    results: List[SearchResultItem]


# ============ 回滚相关模型 (Rollback/Review) ============

class SessionInfo(BaseModel):
    """Session 元信息"""
    session_id: str
    created_at: Optional[str] = None
    resource_count: int


class SnapshotInfo(BaseModel):
    """快照元信息"""
    resource_id: str
    resource_type: str  # 'entity' | 'direct_edge' | 'relay_edge'
    snapshot_time: str
    operation_type: Optional[str] = "modify"


class SnapshotDetail(BaseModel):
    """快照详细数据"""
    resource_id: str
    resource_type: str
    snapshot_time: str
    data: Dict[str, Any]


class ResourceDiff(BaseModel):
    """资源的快照与当前状态对比"""
    resource_id: str
    resource_type: str
    snapshot_time: str
    snapshot_content: str
    current_content: str
    diff_unified: str
    diff_summary: str
    has_changes: bool


class RollbackRequest(BaseModel):
    """回滚请求"""
    task_description: Optional[str] = Field(
        "Rollback to snapshot by Salem",
        description="任务描述（记录在版本历史中）"
    )


class RollbackResponse(BaseModel):
    """回滚响应"""
    resource_id: str
    resource_type: str
    success: bool
    message: str
    new_version: Optional[int] = None


# ============ 维护相关模型 (Maintenance) ============

class OrphanStateItem(BaseModel):
    """闲置 State 节点信息"""
    state_id: str
    entity_id: str
    version: int
    name: str
    content_snippet: str
    created_at: Optional[str] = None
    is_current: bool = Field(..., description="是否是 CURRENT 版本（通常不应删除）")
    in_count: int = Field(..., description="入边数量（排除版本管理边）")
    out_count: int = Field(..., description="出边数量（排除版本管理边）")
    entity_type: str = Field(..., description="Entity 类型")


class OrphanStatesResponse(BaseModel):
    """查询闲置 State 响应"""
    mode: str = Field(..., description="查询模式: in_zero | all_zero")
    count: int
    states: List[OrphanStateItem]


class DeleteStatesRequest(BaseModel):
    """批量删除 State 请求"""
    state_ids: List[str] = Field(..., description="要删除的 State ID 列表")


class DeleteStateFailure(BaseModel):
    """删除失败的单项信息"""
    state_id: str
    error: str


class DeleteStatesResponse(BaseModel):
    """批量删除 State 响应"""
    deleted_count: int
    failed_count: int
    deleted: List[str]
    failed: List[DeleteStateFailure]


class OrphanEntityItem(BaseModel):
    """孤儿 Entity（没有任何子嗣的孤家寡人）"""
    entity_id: str
    name: str
    node_type: str = Field(..., description="Entity 类型 (Character, Location, etc.)")
    created_at: Optional[str] = None


class OrphanEntitiesResponse(BaseModel):
    """查询孤儿 Entity 响应"""
    count: int
    entities: List[OrphanEntityItem]


class DeleteEntitiesRequest(BaseModel):
    """批量删除 Entity 请求"""
    entity_ids: List[str] = Field(..., description="要删除的 Entity ID 列表")


class DeleteEntityFailure(BaseModel):
    """删除失败的单项信息"""
    entity_id: str
    error: str


class DeleteEntitiesResponse(BaseModel):
    """批量删除 Entity 响应"""
    deleted_count: int
    failed_count: int
    deleted: List[str]
    failed: List[DeleteEntityFailure]


# ============ 编辑相关模型 (Edit) ============

class UpdateDirectEdgeRequest(BaseModel):
    """更新 Direct Edge 请求（Salem 前端编辑用）"""
    new_content: str = Field(..., description="新的关系描述内容")
    new_relation: Optional[str] = Field(None, description="新的关系名称（不提供则保持不变）")
    task_description: Optional[str] = Field("Salem edited via frontend", description="编辑任务描述")


class UpdateDirectEdgeResponse(BaseModel):
    """更新 Direct Edge 响应"""
    viewer_id: str
    target_id: str
    viewer_new_version: int
    message: str


class UpdateChapterRequest(BaseModel):
    """更新 Chapter (Relay Edge) 请求（Salem 前端编辑用）"""
    new_content: str = Field(..., description="新的章节内容")
    task_description: Optional[str] = Field("Salem edited via frontend", description="编辑任务描述")


class UpdateChapterResponse(BaseModel):
    """更新 Chapter 响应"""
    viewer_id: str
    target_id: str
    chapter_name: str
    viewer_new_version: int
    message: str


class GetChapterResponse(BaseModel):
    """获取 Chapter (Relay Edge) 响应"""
    edge_id: str
    state: GetStateResponse


# ============ 父子关系模型 (Parent-Child) ============

class LinkParentRequest(BaseModel):
    """建立父子关系请求"""
    child_id: str = Field(..., description="子节点 Entity ID")
    parent_id: str = Field(..., description="父节点 Entity ID")


class LinkParentResponse(BaseModel):
    """建立父子关系响应"""
    child_id: str
    parent_id: str
    created: bool


class UnlinkParentRequest(BaseModel):
    """解除父子关系请求"""
    child_id: str = Field(..., description="子节点 Entity ID")
    parent_id: str = Field(..., description="父节点 Entity ID")


class UnlinkParentResponse(BaseModel):
    """解除父子关系响应"""
    child_id: str
    parent_id: str
    deleted: bool
