"""
简单的API测试脚本
"""
import requests
import json

BASE_URL = "http://localhost:8000"


def test_create_node():
    """测试创建节点"""
    print("=== 测试创建节点 ===")
    response = requests.post(
        f"{BASE_URL}/nodes/entities",
        json={
            "entity_id": "test_character_001",
            "node_type": "character",
            "name": "测试角色",
            "content": "这是一个测试角色的背景故事。",
            "task_description": "测试创建节点"
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.json()


def test_update_node(entity_id: str):
    """测试更新节点"""
    print(f"\n=== 测试更新节点: {entity_id} ===")
    response = requests.post(
        f"{BASE_URL}/nodes/entities/{entity_id}/update",
        json={
            "new_content": "这是更新后的内容，添加了更多细节。角色经历了重大转折。",
            "task_description": "测试更新节点"
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.json()


def test_diff():
    """测试diff比较"""
    print("\n=== 测试文本diff ===")
    response = requests.post(
        f"{BASE_URL}/utils/diff",
        json={
            "text_a": "这是一个测试角色的背景故事。",
            "text_b": "这是更新后的内容，添加了更多细节。角色经历了重大转折。"
        }
    )
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Summary: {result['summary']}")
    print(f"Unified diff:\n{result['diff_unified']}")
    return result


def test_health():
    """测试健康检查"""
    print("\n=== 测试健康检查 ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")


if __name__ == "__main__":
    # 测试健康检查
    test_health()

    # 测试创建节点
    create_result = test_create_node()

    # 测试更新节点
    if "entity_id" in create_result:
        test_update_node(create_result["entity_id"])

    # 测试diff
    test_diff()

    print("\n=== 所有测试完成 ===")
