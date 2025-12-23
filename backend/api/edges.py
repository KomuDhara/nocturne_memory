from fastapi import APIRouter, HTTPException
from models import (
    CreateDirectEdgeRequest,
    CreateDirectEdgeResponse,
    DeleteDirectEdgeResponse,
    CreateRelayEdgeRequest,
    CreateRelayEdgeResponse,
    DeleteRelayEdgeResponse,
    UpdateDirectEdgeRequest,
    UpdateDirectEdgeResponse,
    UpdateChapterRequest,
    UpdateChapterResponse,
    GetChapterResponse,
)
from db import get_neo4j_client

router = APIRouter(prefix="/edges", tags=["edges"])


@router.post("/direct", response_model=CreateDirectEdgeResponse)
async def create_direct_edge(request: CreateDirectEdgeRequest):
    """
    创建1跳边 - 直接连接两个 Entity 的当前 State 节点（不可变历史记录）

    前提：自动查找 Entity 的 CURRENT State，如果边已存在（同一对 Entity 之间），则抛出异常。

    唯一性：(from_entity_id, to_entity_id) 二元组唯一

    Args:
        request: 包含from_entity_id, to_entity_id, relation, content, inheritable

    Returns:
        CreateDirectEdgeResponse: 包含edge_id, from_state_id, to_state_id, from_entity_id, to_entity_id, relation, created_at

    Raises:
        404: Entity节点或State节点不存在
        409: 边已存在（相同的from, to组合）
    """
    client = get_neo4j_client()
    try:
        result = client.create_direct_edge(
            from_entity_id=request.from_entity_id,
            to_entity_id=request.to_entity_id,
            relation=request.relation,
            content=request.content,
            inheritable=request.inheritable
        )
        return CreateDirectEdgeResponse(**result)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        elif "already exists" in error_msg:
            raise HTTPException(status_code=409, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/direct/{from_entity_id}/{to_entity_id}")
async def get_direct_edge(from_entity_id: str, to_entity_id: str):
    """
    获取1跳边

    Args:
        from_entity_id: 起始Entity节点ID
        to_entity_id: 目标Entity节点ID

    Returns:
        边的详细信息

    Raises:
        404: 边不存在
    """
    client = get_neo4j_client()
    result = client.get_direct_edge(from_entity_id, to_entity_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Direct edge not found between {from_entity_id} and {to_entity_id}"
        )
    return result


@router.delete("/direct/{from_entity_id}/{to_entity_id}", response_model=DeleteDirectEdgeResponse)
async def delete_direct_edge(from_entity_id: str, to_entity_id: str):
    """
    删除1跳边

    默认行为：带依赖检查
    - 如果存在基于该1跳边建立的2跳边（中继节点），则会返回409而不是直接级联删除
    - 需要先显式删除2跳边（或未来通过force参数明确指定级联删除）

    Args:
        from_entity_id: 起始Entity节点ID
        to_entity_id: 目标Entity节点ID

    Returns:
        DeleteDirectEdgeResponse: 包含from_entity_id, to_entity_id, deleted_relay_edges（当前默认总为0）

    Raises:
        404: 边不存在
        409: 存在依赖的2跳边，拒绝删除
    """
    client = get_neo4j_client()
    try:
        result = client.delete_direct_edge(from_entity_id, to_entity_id)
        return DeleteDirectEdgeResponse(**result)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(status_code=404, detail=error_msg)
        elif "Cannot delete direct edge" in error_msg:
            raise HTTPException(status_code=409, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/relay", response_model=CreateRelayEdgeResponse)
async def create_relay_edge(request: CreateRelayEdgeRequest):
    """
    创建2跳边 - 通过中继节点连接

    前置条件：
    - 必须存在 from_state -> to_state 的1跳边 (通过 parent_direct_edge_id 关联)
    - 如果1跳边的inheritable=False，则2跳边的inheritable强制为False

    Args:
        request: 包含from_entity_id, to_entity_id, relation, content, inheritable, parent_direct_edge_id

    Returns:
        CreateRelayEdgeResponse: 包含edge_id, from_state_id, to_state_id, relay_node_id, relation, created_at

    Raises:
        400: 1跳边不存在
    """
    client = get_neo4j_client()
    try:
        result = client.create_relay_edge(
            from_entity_id=request.from_entity_id,
            to_entity_id=request.to_entity_id,
            relation=request.relation,
            content=request.content,
            inheritable=request.inheritable,
            parent_direct_edge_id=request.parent_direct_edge_id
        )
        return CreateRelayEdgeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/relay/{viewer_id}/{target_id}/{chapter_name}", response_model=GetChapterResponse)
async def get_relay_edge(viewer_id: str, target_id: str, chapter_name: str):
    """
    获取特定的 2跳边 (Chapter)

    Args:
        viewer_id: 观察者 Entity ID
        target_id: 目标 Entity ID
        chapter_name: 章节名称

    Returns:
        GetChapterResponse: 包含 edge_id 和 state 详情

    Raises:
        404: 章节不存在
    """
    client = get_neo4j_client()
    
    # 1. Calculate IDs
    relay_entity_id = client.generate_relay_entity_id(viewer_id, chapter_name, target_id)
    edge_id = client._generate_edge_id(viewer_id, chapter_name, target_id)
    
    # 2. Get Entity Info (Basic) to find the state ID
    entity_info = client.get_entity_info(relay_entity_id, include_basic=True)
    
    if not entity_info or not entity_info.get("basic"):
        raise HTTPException(
            status_code=404,
            detail=f"Chapter '{chapter_name}' not found between {viewer_id} and {target_id}"
        )
        
    basic = entity_info["basic"]
    
    # 3. Get full State Info (including counts)
    state_details = client.get_state_info(basic["state_id"])
    
    if not state_details:
        # Fallback if state fetch fails (unlikely)
        state_data = {
            "state_id": basic["state_id"],
            "entity_id": basic["entity_id"],
            "version": basic["version"],
            "name": basic["name"],
            "content": basic["content"],
            "created_at": basic["created_at"],
            "task_description": basic["task_description"],
            "in_count": 0,
            "out_count": 0
        }
    else:
        state_data = state_details
    
    return {
        "edge_id": edge_id,
        "state": state_data
    }


@router.delete("/relay/{edge_id}", response_model=DeleteRelayEdgeResponse)
async def delete_relay_edge(edge_id: str):
    """
    删除指定的2跳边及其中继节点

    Args:
        edge_id: 边的唯一ID

    Returns:
        DeleteRelayEdgeResponse: 包含edge_id, deleted

    Raises:
        404: 边不存在
    """
    client = get_neo4j_client()
    try:
        result = client.delete_relay_edge(edge_id)
        return DeleteRelayEdgeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Salem 前端编辑用 API ============

@router.put("/direct/{viewer_id}/{target_id}", response_model=UpdateDirectEdgeResponse)
async def update_direct_edge(viewer_id: str, target_id: str, request: UpdateDirectEdgeRequest):
    """
    更新 Direct Edge（关系概述）- Salem 前端编辑用

    通过 evolve_relationship 实现，会创建 viewer 的新版本。

    Args:
        viewer_id: 观察者 Entity ID
        target_id: 目标 Entity ID
        request: 包含 new_content, new_relation(可选), task_description

    Returns:
        UpdateDirectEdgeResponse: 包含 viewer_new_version

    Raises:
        404: 关系不存在
    """
    client = get_neo4j_client()
    try:
        # 构建 direct_patch
        direct_patch = {"content": request.new_content}
        if request.new_relation:
            direct_patch["relation"] = request.new_relation

        result = client.evolve_relationship(
            viewer_entity_id=viewer_id,
            target_entity_id=target_id,
            direct_patch=direct_patch,
            task_description=request.task_description or "Salem edited via frontend"
        )

        return UpdateDirectEdgeResponse(
            viewer_id=viewer_id,
            target_id=target_id,
            viewer_new_version=result["viewer_new_version"],
            message=f"Direct edge updated. Viewer evolved to v{result['viewer_new_version']}."
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/chapter/{viewer_id}/{target_id}/{chapter_name}", response_model=UpdateChapterResponse)
async def update_chapter(
    viewer_id: str,
    target_id: str,
    chapter_name: str,
    request: UpdateChapterRequest
):
    """
    更新 Chapter（记忆章节）- Salem 前端编辑用

    通过 evolve_relationship 实现，会创建 viewer 的新版本。

    Args:
        viewer_id: 观察者 Entity ID
        target_id: 目标 Entity ID
        chapter_name: 章节名称
        request: 包含 new_content, new_name(可选), task_description

    Returns:
        UpdateChapterResponse: 包含 viewer_new_version

    Raises:
        404: 章节不存在
    """
    client = get_neo4j_client()
    try:
        # 构建 chapter_updates
        chapter_update = {"content": request.new_content}

        result = client.evolve_relationship(
            viewer_entity_id=viewer_id,
            target_entity_id=target_id,
            chapter_updates={chapter_name: chapter_update},
            task_description=request.task_description or "Salem edited via frontend"
        )

        return UpdateChapterResponse(
            viewer_id=viewer_id,
            target_id=target_id,
            chapter_name=chapter_name,
            viewer_new_version=result["viewer_new_version"],
            message=f"Chapter '{chapter_name}' updated. Viewer evolved to v{result['viewer_new_version']}."
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
