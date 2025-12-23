from fastapi import APIRouter, HTTPException
from models import (
    SearchRequest,
    SearchResponse
)
from db import get_neo4j_client

router = APIRouter(prefix="/exploration", tags=["exploration"])


@router.post("/search", response_model=SearchResponse)
async def search_nodes(request: SearchRequest):
    """
    搜索节点（Flashlight - 寻找入口）
    
    支持按名称或内容进行模糊搜索。
    可以作为AI在记忆宫殿中定位的初始手段。
    
    Args:
        request: 包含query, node_types, limit
        
    Returns:
        SearchResponse: 包含匹配的节点列表
    """
    client = get_neo4j_client()
    try:
        results = client.search_nodes(
            query=request.query,
            node_types=request.node_types,
            limit=request.limit
        )
        return SearchResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

