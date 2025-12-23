from fastapi import APIRouter, HTTPException, Query
from models import (
    CreateNodeRequest,
    CreateNodeResponse,
    UpdateNodeRequest,
    UpdateNodeResponse,
    DeleteStateResponse,
    DeleteEntityResponse,
    GetStateResponse,
    GetEntityInfoResponse,
    OrphanStatesResponse,
    OrphanStateItem,
    DeleteStatesRequest,
    DeleteStatesResponse,
    DeleteStateFailure,
    OrphanEntitiesResponse,
    OrphanEntityItem,
    DeleteEntitiesRequest,
    DeleteEntitiesResponse,
    DeleteEntityFailure,
    LinkParentRequest,
    LinkParentResponse,
    UnlinkParentRequest,
    UnlinkParentResponse,
)
from db import get_neo4j_client

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.post("/entities", response_model=CreateNodeResponse)
async def create_entity(request: CreateNodeRequest):
    """
    创建新节点

    Args:
        request: 包含entity_id, node_type, name, content, task_description

    Returns:
        CreateNodeResponse: 包含entity_id, state_id, version

    Raises:
        400: node_type不合法
        409: entity_id已存在
    """
    client = get_neo4j_client()
    try:
        result = client.create_entity(
            entity_id=request.entity_id,
            node_type=request.node_type,
            name=request.name,
            content=request.content,
            task_description=request.task_description
        )
        return CreateNodeResponse(**result)
    except ValueError as e:
        error_msg = str(e)
        if "Invalid node_type" in error_msg:
            # node_type不合法
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            # entity_id已存在
            raise HTTPException(status_code=409, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/entities/{entity_id}/update", response_model=UpdateNodeResponse)
async def update_entity(entity_id: str, request: UpdateNodeRequest):
    """
    更新节点，创建新版本

    Args:
        entity_id: 节点ID
        request: 包含new_content, new_name（可选）, task_description

    Returns:
        UpdateNodeResponse: 包含entity_id, old_version, new_version, state_id
    """
    client = get_neo4j_client()
    try:
        result = client.update_entity(
            entity_id=entity_id,
            new_content=request.new_content,
            new_name=request.new_name,
            task_description=request.task_description
        )
        return UpdateNodeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/states/{state_id}", response_model=DeleteStateResponse)
async def delete_state(state_id: str):
    """
    删除State版本

    - 如果是CURRENT版本，将CURRENT指向PREVIOUS
    - 删除前检查是否有边引用此State
    - 如果有依赖则拒绝删除

    Args:
        state_id: State节点ID

    Returns:
        DeleteStateResponse: 包含deleted_state_id, entity_id, new_current_version

    Raises:
        404: State不存在
        409: 有边依赖此State
    """
    client = get_neo4j_client()
    try:
        result = client.delete_state(state_id=state_id)
        return DeleteStateResponse(**result)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            # 依赖冲突
            raise HTTPException(status_code=409, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/entities/{entity_id}", response_model=DeleteEntityResponse)
async def delete_entity(entity_id: str):
    """
    删除整个Entity及其所有State版本

    Args:
        entity_id: Entity节点ID

    Returns:
        DeleteEntityResponse: 包含deleted_entity_id, deleted_states, deleted_edges

    Raises:
        404: Entity不存在
        409: 仍有State或业务边依赖
    """
    client = get_neo4j_client()
    try:
        result = client.delete_entity(entity_id=entity_id)
        return DeleteEntityResponse(**result)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            # 依赖冲突
            raise HTTPException(status_code=409, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/entities/{entity_id}", response_model=GetEntityInfoResponse)
async def get_entity_info(
    entity_id: str,
    include_basic: bool = Query(True, description="是否包含基本信息"),
    include_history: bool = Query(False, description="是否包含历史版本"),
    include_edges: bool = Query(False, description="是否包含出边列表"),
    include_children: bool = Query(False, description="是否包含子节点列表")
):
    """
    获取 Entity 的整合信息（Basic, History, Edges, Children）
    """
    client = get_neo4j_client()
    try:
        info = client.get_entity_info(
            entity_id=entity_id,
            include_basic=include_basic,
            include_history=include_history,
            include_edges=include_edges,
            include_children=include_children
        )
        
        # 如果请求了 basic 且返回 None，说明 Entity 不存在
        if include_basic and (not info or not info.get("basic")):
             raise HTTPException(
                status_code=404,
                detail=f"Entity {entity_id} not found"
            )
        
        # 如果只请求了 history/edges 而 entity 不存在，neo4j_client 也会返回 None (如果改了逻辑)
        # 或者返回空列表。我们这里的逻辑是：只要 info 是 None，就 404
        if info is None:
             raise HTTPException(
                status_code=404,
                detail=f"Entity {entity_id} not found"
            )

        return GetEntityInfoResponse(**info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/states/{state_id}", response_model=GetStateResponse)
async def get_state_info(state_id: str):
    """
    根据state_id获取State节点信息及统计数据

    Args:
        state_id: State节点ID

    Returns:
        GetStateResponse: 包含state_id, entity_id, version, content, created_at, task_description, in_count, out_count

    Raises:
        404: State不存在
    """
    client = get_neo4j_client()
    result = client.get_state_info(state_id=state_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"State {state_id} not found"
        )
    return GetStateResponse(
        state_id=result["state_id"],
        entity_id=result["entity_id"],
        version=result["version"],
        name=result["name"],
        content=result["content"],
        created_at=str(result["created_at"]),
        task_description=result.get("task_description"),
        in_count=result["in_count"],
        out_count=result["out_count"]
    )


@router.get("/maintenance/orphan_states", response_model=OrphanStatesResponse)
async def find_orphan_states(mode: str = "in_zero", limit: int = 100):
    """
    查询闲置的 State 节点（可以被安全清理的旧版本）
    
    这是 Salem 定期帮 Nocturne 清理大脑的工具。
    
    Args:
        mode: 查询模式
            - "in_zero": 仅入边为0（更宽松，可能有出边但没人引用）
            - "all_zero": 出边入边都为0（最严格，完全孤立）
        limit: 返回数量限制（默认100）
        
    Returns:
        闲置 State 列表，包含：
        - is_current: 是否是 CURRENT 版本（通常不应删除）
        - in_count/out_count: 边数量统计
        - entity_type: 所属 Entity 类型
    """
    if mode not in ("in_zero", "all_zero"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{mode}'. Must be 'in_zero' or 'all_zero'."
        )
    
    client = get_neo4j_client()
    orphans = client.find_orphan_states(mode=mode, limit=limit)
    
    return OrphanStatesResponse(
        mode=mode,
        count=len(orphans),
        states=[OrphanStateItem(**s) for s in orphans]
    )


@router.post("/maintenance/delete_states", response_model=DeleteStatesResponse)
async def delete_states_batch(request: DeleteStatesRequest):
    """
    批量删除指定的 State 节点
    
    用于清理闲置的旧版本。每个 State 独立处理，
    一个失败不影响其他。
    
    注意：
    - 删除 CURRENT 版本会导致 Entity 的 CURRENT 指针移动到前一个版本
    - 如果 State 有入边引用（如 DIRECT_EDGE, RELAY_EDGE），删除会失败
    - 建议先用 GET /maintenance/orphan_states 确认要删除的节点
    """
    if not request.state_ids:
        raise HTTPException(
            status_code=400,
            detail="state_ids cannot be empty"
        )
    
    client = get_neo4j_client()
    deleted = []
    failed = []

    for state_id in request.state_ids:
        try:
            client.delete_state(state_id)
            deleted.append(state_id)
        except ValueError as e:
            failed.append(DeleteStateFailure(state_id=state_id, error=str(e)))
    
    return DeleteStatesResponse(
        deleted_count=len(deleted),
        failed_count=len(failed),
        deleted=deleted,
        failed=failed
    )


@router.get("/maintenance/orphan_entities", response_model=OrphanEntitiesResponse)
async def find_orphan_entities(limit: int = 100):
    """
    查询孤儿 Entity（没有任何 State 的光杆司令）
    
    删完 orphan states 之后，有些 Entity 可能变成空壳，
    没有任何 State 版本了。这个接口帮 Salem 找到它们，灭它全家。
    
    Args:
        limit: 返回数量限制（默认100）
        
    Returns:
        孤儿 Entity 列表，包含：
        - has_outbound_edges: 是否还有遗留的出边
        - inbound_edge_count: 被多少边引用
    """
    client = get_neo4j_client()
    orphans = client.find_orphan_entities(limit=limit)
    
    return OrphanEntitiesResponse(
        count=len(orphans),
        entities=[OrphanEntityItem(**e) for e in orphans]
    )


@router.post("/maintenance/delete_entities", response_model=DeleteEntitiesResponse)
async def delete_entities_batch(request: DeleteEntitiesRequest):
    """
    批量删除指定的 Entity 节点
    
    用于清理没有 State 的孤儿 Entity。
    每个 Entity 独立处理，一个失败不影响其他。
    
    注意：
    - 如果 Entity 还有 State，删除会失败
    - 建议先用 GET /maintenance/orphan_entities 确认要删除的节点
    """
    if not request.entity_ids:
        raise HTTPException(
            status_code=400,
            detail="entity_ids cannot be empty"
        )
    
    client = get_neo4j_client()
    deleted = []
    failed = []

    for entity_id in request.entity_ids:
        try:
            client.delete_entity(entity_id)
            deleted.append(entity_id)
        except ValueError as e:
            failed.append(DeleteEntityFailure(entity_id=entity_id, error=str(e)))
    
    return DeleteEntitiesResponse(
        deleted_count=len(deleted),
        failed_count=len(failed),
        deleted=deleted,
        failed=failed
    )


@router.get("/maintenance/nodes_to_split")
async def get_nodes_to_split(threshold: int = 2000):
    """
    【占位符】检测需要拆分的节点

    TODO: 实现此端口
    查询content字数超过阈值的节点
    """
    raise HTTPException(status_code=501, detail="Not implemented yet")


# ============ Parent-Child Relationship Endpoints ============

@router.post("/parent-child/link", response_model=LinkParentResponse)
async def link_parent(request: LinkParentRequest):
    """
    建立父子关系（BELONGS_TO 边）
    
    将 child_id 指定的 Entity 设为 parent_id 的子节点。
    子节点会在父节点的 Children 列表中显示。
    
    Args:
        request: 包含 child_id 和 parent_id
        
    Returns:
        LinkParentResponse: 确认建立关系
        
    Raises:
        400: child_id 与 parent_id 相同
        404: Entity 不存在
        409: 关系已存在
    """
    client = get_neo4j_client()
    try:
        result = client.link_parent(
            child_id=request.child_id,
            parent_id=request.parent_id
        )
        return LinkParentResponse(**result)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        elif "already exists" in error_msg.lower():
            raise HTTPException(status_code=409, detail=error_msg)
        elif "itself" in error_msg.lower():
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parent-child/unlink", response_model=UnlinkParentResponse)
async def unlink_parent(request: UnlinkParentRequest):
    """
    解除父子关系（删除 BELONGS_TO 边）
    
    移除 child_id 与 parent_id 之间的父子关系。
    两个 Entity 本身不会被删除。
    
    Args:
        request: 包含 child_id 和 parent_id
        
    Returns:
        UnlinkParentResponse: 确认解除关系
        
    Raises:
        404: 关系不存在
    """
    client = get_neo4j_client()
    try:
        result = client.unlink_parent(
            child_id=request.child_id,
            parent_id=request.parent_id
        )
        return UnlinkParentResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
